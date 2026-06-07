/**
 * CQ3 off-axis probe (throwaway). Steps the real runtime for the PRIMARY UE and
 * logs the serving beam's ground-distance to the UE (= the off-axis lever) and
 * the serving SINR. Answers: is the primary UE always at the serving beam
 * centre (dist~0, off-axis~0)?
 */
import { createObserverContext } from '../src/engine/orbit';
import { HandoverManager } from '../src/engine/handover/handover-manager';
import { computeOffAxisDeg } from '../src/engine/signal/beam-gain';
import { loadProfile } from '../src/profiles/index';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  stepRuntimeFrame,
} from '../src/scene/runtimeFrameStep';

const APP_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const profile = loadProfile('hobs-2024-candidate-rich');
const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
const trajectoryCache = createTrajectoryCache(profile, observer, APP_EPOCH_MS);
const beamLayoutsByShellId = createBeamLayoutsByShellId(profile);
const hoManager = new HandoverManager(profile.handover);
const state = createRuntimeFrameStepState(0);
const replay = { epochUtcMs: APP_EPOCH_MS, startOffsetSec: 0, loop: false, windowLengthSec: 7200 };

const dists: number[] = [];
let prevBeam: number | null = null;
let prevSat: string | null = null;
let switches = 0;
let rows = 0;

for (let t = 0; t <= 1200; t += 1) {
  const out = stepRuntimeFrame({
    profile, replay, speed: 1, paused: t === 0, deltaSec: t === 0 ? 0 : 1,
    observer, beamLayoutsByShellId, trajectoryCache, hoManager, state, ueCount: 1,
    uePrimaryAnchorMode: 'observer',
  });
  const servingSat = out.frame.serving.satId;
  const servingBeam = out.frame.serving.beamId;
  if (servingSat === null || servingBeam === null) { prevBeam = null; prevSat = null; continue; }
  const cells = out.frame.beamCellsBySatId.get(servingSat) ?? [];
  const cell = cells.find(c => c.beamId === servingBeam);
  if (!cell) continue;
  const distKm = Math.hypot(cell.offsetEastKm, cell.offsetNorthKm);
  const offAxisDeg = computeOffAxisDeg(distKm, 550);
  dists.push(distKm);
  if (prevBeam !== null && servingBeam !== prevBeam && servingSat === prevSat) switches += 1;
  prevBeam = servingBeam;
  prevSat = servingSat;
  rows += 1;
  if (t % 60 === 0) {
    console.log(`t=${String(t).padStart(4)}s  serving=${servingSat}#${servingBeam}  distToUE=${distKm.toFixed(3)}km  offAxis=${offAxisDeg.toFixed(4)}deg  SINR=${(out.frame.serving.sinrDb ?? NaN).toFixed(1)}dB`);
  }
}

dists.sort((a, b) => a - b);
const mean = dists.reduce((s, d) => s + d, 0) / Math.max(dists.length, 1);
const p50 = dists[Math.floor(dists.length / 2)] ?? 0;
const p95 = dists[Math.floor(dists.length * 0.95)] ?? 0;
const max = dists[dists.length - 1] ?? 0;
console.log(`\nSUMMARY over ${rows} frames: serving-beam dist-to-UE  mean=${mean.toFixed(3)}km  p50=${p50.toFixed(3)}km  p95=${p95.toFixed(3)}km  max=${max.toFixed(3)}km`);
console.log(`(footprint radius ~16km, lattice spacing ~27.6km for reference)`);
console.log(`intra beam switches counted (same-sat beamId change): ${switches}`);
