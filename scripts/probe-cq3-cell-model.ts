/**
 * CQ3 cell-model probe (throwaway). Drives the S-cells-1 pure cell model
 * (`src/scene/sinrLiveCellModel.ts`) over the REAL candidate-rich Walker
 * trajectory and reports the deliverables of `docs/sinr-live-earth-fixed-cells-
 * mini-sdd.md` §6 S-cells-1:
 *
 *   - real off-axis distribution (UE → its serving CELL CENTRE) — must be a
 *     genuine spread, NOT collapsed to ~0 the way the steered-lattice render
 *     does via `anchorToUe` (compare `probe-cq3-offaxis.ts`).
 *   - nearest-cell coverage (geometric) + served fraction over the pass.
 *   - sane intra/inter counts: STATIC population (inter from sat passes, intra
 *     ≈ 0 — honest cell-model behaviour) vs MOBILE population (UEs translate on
 *     a slow circle → cross fixed cell boundaries → intra fires). intra-HO is a
 *     MOBILITY story in the cell model (CQ3b, S-cells-5), by design (§5.2).
 *
 * No runtime mutation; pure model only. Not MODQN/paper proof — leo 550 km
 * live SINR-offset surface (§7).
 */
import { createObserverContext } from '../src/engine/orbit';
import { buildCellLayout } from '../src/engine/cells/cellLayout';
import { computeOffAxisDeg } from '../src/engine/signal/beam-gain';
import { generateUePositions } from '../src/engine/ue/multiUeState';
import { loadProfile } from '../src/profiles/index';
import {
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  interpolateVisibleSats,
} from '../src/scene/runtimeFrameStep';
import { SinrLiveCellModel, assignUeToNearestCell, type UeInput } from '../src/scene/sinrLiveCellModel';

const APP_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const STEP_SEC = 20;
const UE_COUNT = 100;

const profile = loadProfile('hobs-2024-candidate-rich');
const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
const trajectoryCache = createTrajectoryCache(profile, observer, APP_EPOCH_MS);
const maxTimeSec = getTrajectoryMaxTimeSec(trajectoryCache);
const beamwidthRad = profile.antenna.beamwidth3dBRad;
const altKm = profile.orbit.shells[0].altitudeKm;

// Real UE truth: uniform-rectangle 200×90, seed 7 (matches the sinr-live lane).
const basePositions = generateUePositions({
  ueCount: UE_COUNT,
  primaryEastKm: 0,
  primaryNorthKm: 0,
  primaryFootprintRadiusKm: 0,
  ueWorldScale: 1,
  seed: profile.ueDistribution?.seed ?? 7,
  mode: 'random',
  primaryAnchorMode: 'observer',
  rectangleAreaKm: { widthKm: 200, heightKm: 90 },
});
const baseUes: UeInput[] = basePositions.map(p => ({ id: p.id, eastKm: p.eastKm, northKm: p.northKm }));

function pct(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

function coverageReport(cellCount: number): void {
  const layout = buildCellLayout({
    centerLatDeg: observer.latDeg,
    centerLonDeg: observer.lonDeg,
    altitudeKm: altKm,
    beamwidth3dBRad: beamwidthRad,
    cellCount,
  });
  const circum = layout.cellRadiusKm;
  const inscribed = layout.cellRadiusKm * Math.sqrt(3) / 2;
  let inCell = 0;
  let inCircum = 0;
  for (const ue of baseUes) {
    const d = assignUeToNearestCell(ue, layout).distanceKm;
    if (d <= inscribed) inCell += 1;
    if (d <= circum) inCircum += 1;
  }
  console.log(`  cells=${cellCount} cellRadius=${circum.toFixed(1)}km → in-beam(inscribed) ${inCell}/${UE_COUNT}, tiled(circum) ${inCircum}/${UE_COUNT}`);
}

function circleDrift(t: number, radiusKm: number, periodSec: number): { eastKm: number; northKm: number } {
  const theta = (2 * Math.PI * t) / periodSec;
  return { eastKm: radiusKm * Math.cos(theta) - radiusKm, northKm: radiusKm * Math.sin(theta) };
}

interface RunResult {
  offAxis: number[];
  servedPerFrame: number[];
  servingSatsPerFrame: number[];
  intra: number;
  inter: number;
  frames: number;
}

function runTrajectory(cellCount: number, mobile: boolean): RunResult {
  const layout = buildCellLayout({
    centerLatDeg: observer.latDeg,
    centerLonDeg: observer.lonDeg,
    altitudeKm: altKm,
    beamwidth3dBRad: beamwidthRad,
    cellCount,
  });
  const model = new SinrLiveCellModel({
    profile,
    cellLayout: layout,
    observer: { latDeg: observer.latDeg, lonDeg: observer.lonDeg },
    epochUtcMs: APP_EPOCH_MS,
  });
  const res: RunResult = { offAxis: [], servedPerFrame: [], servingSatsPerFrame: [], intra: 0, inter: 0, frames: 0 };

  let prevT = 0;
  for (let t = 0; t <= maxTimeSec; t += STEP_SEC) {
    const visibleSats = interpolateVisibleSats(trajectoryCache, t, false);
    const ues: UeInput[] = mobile
      ? baseUes.map(u => {
        const d = circleDrift(t, 30, 1200);
        return { id: u.id, eastKm: u.eastKm + d.eastKm, northKm: u.northKm + d.northKm };
      })
      : baseUes;
    const frame = model.step({ visibleSats, ues, simTimeSec: t, dtSec: t === 0 ? 0 : t - prevT });
    prevT = t;
    res.frames += 1;
    res.servedPerFrame.push(frame.servedUeCount);
    res.servingSatsPerFrame.push(frame.servingSatCount);
    res.intra += frame.intraHandoverCount;
    res.inter += frame.interHandoverCount;
    for (const ue of frame.ues) {
      if (ue.servingSatId !== null) res.offAxis.push(ue.offAxisDeg);
    }
  }
  return res;
}

function summarize(label: string, res: RunResult): void {
  const off = [...res.offAxis].sort((a, b) => a - b);
  const meanOff = off.reduce((s, d) => s + d, 0) / Math.max(off.length, 1);
  const served = [...res.servedPerFrame].sort((a, b) => a - b);
  const sats = [...res.servingSatsPerFrame].sort((a, b) => a - b);
  const nonZeroOff = off.filter(d => d > 0.01).length;
  console.log(`\n=== ${label} (${res.frames} frames, ${STEP_SEC}s step) ===`);
  console.log(`  off-axis(UE→serving cell centre) deg: mean=${meanOff.toFixed(3)} p50=${pct(off, 0.5).toFixed(3)} p95=${pct(off, 0.95).toFixed(3)} max=${pct(off, 0.999).toFixed(3)}`);
  console.log(`  off-axis NON-zero samples: ${nonZeroOff}/${off.length} (steered-lattice render collapses these to ~0 via anchorToUe)`);
  console.log(`  served UEs/frame: min=${served[0]} p50=${pct(served, 0.5)} max=${served[served.length - 1]}`);
  console.log(`  distinct serving sats/frame: min=${sats[0]} p50=${pct(sats, 0.5)} max=${sats[sats.length - 1]}`);
  console.log(`  handovers over pass: intra=${res.intra}  inter=${res.inter}`);
}

console.log(`profile=${profile.id} alt=${altKm}km beamwidth=${(beamwidthRad * 180 / Math.PI).toFixed(2)}deg trajectory=${maxTimeSec}s`);
console.log('\n--- nearest-cell coverage (geometric, static UEs) ---');
coverageReport(37);
coverageReport(61);

summarize('STATIC population, 37 cells', runTrajectory(37, false));
summarize('MOBILE population (circle r=30km/1200s), 37 cells', runTrajectory(37, true));
