/**
 * S-cells-4 probe (throwaway). Drives the SINR-live cell model with the REAL
 * S-cells-4a override config (self-consistent 33.5 dBi @ 3.32°, 50° steering,
 * 4.5 dB scan loss, 7-beam hopping) over the candidate-rich Walker trajectory at
 * the DEMO WINDOW (`demoStartOffsetSec`), comparing cellCount 19 vs 37 vs 61.
 *
 * Two jobs:
 *   (a) sanity that the gain de-bias (40 → 33.5 dBi) + 50° steering does NOT
 *       collapse served counts at the demo window;
 *   (e) the cellCount 19-vs-37 decision data (served continuity / off-axis).
 *
 * Not MODQN/paper proof — leo 550 km live SINR-offset surface.
 */
import { createObserverContext } from '../src/engine/orbit';
import { buildCellLayout } from '../src/engine/cells/cellLayout';
import { generateUePositions } from '../src/engine/ue/multiUeState';
import { loadProfile } from '../src/profiles/index';
import {
  createTrajectoryCache,
  interpolateVisibleSats,
} from '../src/scene/runtimeFrameStep';
import { SinrLiveCellModel, type UeInput } from '../src/scene/sinrLiveCellModel';
import {
  SINR_LIVE_BEAMS_PER_SAT,
  SINR_LIVE_CELL_BEAMWIDTH_RAD,
  SINR_LIVE_CELL_MAX_GAIN_DBI,
  SINR_LIVE_CELL_MAX_STEERING_DEG,
  SINR_LIVE_CELL_SCAN_LOSS_DB,
  SINR_LIVE_HOP_SLOT_SEC,
} from '../src/scene/sinrLiveCellRuntime';

const APP_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const STEP_SEC = 5;
const UE_COUNT = 100;
const WINDOW_SEC = 300; // demo window length

const profile = loadProfile('hobs-2024-candidate-rich');
const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
const trajectoryCache = createTrajectoryCache(profile, observer, APP_EPOCH_MS);
const altKm = profile.orbit.shells[0].altitudeKm;
const demoStart = profile.demoStartOffsetSec ?? 450;

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

function run(cellCount: number): void {
  const layout = buildCellLayout({
    centerLatDeg: observer.latDeg,
    centerLonDeg: observer.lonDeg,
    altitudeKm: altKm,
    beamwidth3dBRad: SINR_LIVE_CELL_BEAMWIDTH_RAD,
    cellCount,
  });
  const model = new SinrLiveCellModel({
    profile,
    cellLayout: layout,
    observer: { latDeg: observer.latDeg, lonDeg: observer.lonDeg },
    epochUtcMs: APP_EPOCH_MS,
    beamsPerSat: SINR_LIVE_BEAMS_PER_SAT,
    hopSlotSec: SINR_LIVE_HOP_SLOT_SEC,
    beamwidthOverrideRad: SINR_LIVE_CELL_BEAMWIDTH_RAD,
    maxGainDbiOverrideDbi: SINR_LIVE_CELL_MAX_GAIN_DBI,
    maxSteeringAngleOverrideDeg: SINR_LIVE_CELL_MAX_STEERING_DEG,
    scanLossAtMaxSteeringOverrideDb: SINR_LIVE_CELL_SCAN_LOSS_DB,
  });

  const servedUe: number[] = [];
  const servedCells: number[] = [];
  const sats: number[] = [];
  const offAxis: number[] = [];
  const sinr: number[] = [];
  let prevT = demoStart;
  for (let t = demoStart; t <= demoStart + WINDOW_SEC; t += STEP_SEC) {
    const visibleSats = interpolateVisibleSats(trajectoryCache, t, false);
    const frame = model.step({ visibleSats, ues: baseUes, simTimeSec: t, dtSec: t === demoStart ? 0 : t - prevT });
    prevT = t;
    servedUe.push(frame.servedUeCount);
    servedCells.push(frame.servedCellCount);
    sats.push(frame.servingSatCount);
    for (const ue of frame.ues) {
      if (ue.servingSatId !== null) {
        offAxis.push(ue.offAxisDeg);
        if (ue.sinrDb !== null && Number.isFinite(ue.sinrDb)) sinr.push(ue.sinrDb);
      }
    }
  }
  const su = [...servedUe].sort((a, b) => a - b);
  const sc = [...servedCells].sort((a, b) => a - b);
  const ss = [...sats].sort((a, b) => a - b);
  const oa = [...offAxis].sort((a, b) => a - b);
  const sr = [...sinr].sort((a, b) => a - b);
  console.log(`\n=== cells=${cellCount} cellRadius=${layout.cellRadiusKm.toFixed(1)}km (window ${demoStart}..${demoStart + WINDOW_SEC}s) ===`);
  console.log(`  served UEs/100:  min=${su[0]} p50=${pct(su, 0.5)} max=${su[su.length - 1]}`);
  console.log(`  served cells:    min=${sc[0]} p50=${pct(sc, 0.5)} max=${sc[sc.length - 1]}`);
  console.log(`  serving sats:    min=${ss[0]} p50=${pct(ss, 0.5)} max=${ss[ss.length - 1]}`);
  console.log(`  off-axis deg:    p50=${pct(oa, 0.5).toFixed(2)} p95=${pct(oa, 0.95).toFixed(2)}`);
  console.log(`  served SINR dB:  p05=${pct(sr, 0.05).toFixed(1)} p50=${pct(sr, 0.5).toFixed(1)} p95=${pct(sr, 0.95).toFixed(1)} (n=${sr.length})`);
}

console.log(`profile=${profile.id} alt=${altKm}km beamwidth=${(SINR_LIVE_CELL_BEAMWIDTH_RAD * 180 / Math.PI).toFixed(2)}deg`);
console.log(`override: gain=${SINR_LIVE_CELL_MAX_GAIN_DBI}dBi steer=${SINR_LIVE_CELL_MAX_STEERING_DEG}deg scanLoss=${SINR_LIVE_CELL_SCAN_LOSS_DB}dB hop=${SINR_LIVE_BEAMS_PER_SAT}/${SINR_LIVE_HOP_SLOT_SEC}s`);
run(19);
run(37);
run(61);
