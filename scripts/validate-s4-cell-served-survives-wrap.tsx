/**
 * Consolidation S4-1 — cell-served-survives-wrap gate (the deferred D5 cell flavour).
 *
 * Proves the S4-1 cut: on a sim-time jump the earth-fixed CELL model
 * (`SinrLiveCellModel`) clock-REBASEs its per-cell HandoverManagers instead of
 * leaving them with a stale future guard, so served cells/UEs do not crash and
 * inter-HO is not suppressed across the jump — the cell flavour of the served-N/N
 * flicker that S3-2 fixed for the steered managers but DEFERRED for the cell lane (D5).
 *
 * Two production time-shift paths, both covered:
 *   - the live LOOP WRAP is the in-step didLoopWrap (production windowLengthSec ==
 *     maxTimeSec → the in-hook window-reloop guard is unreachable). The step rebases
 *     the STEERED managers in-step but NOT the externally-attached cell model, so
 *     useSimulation's useFrame rebases the cell model itself when out.didLoopWrap.
 *   - SEEK / window-reloop go through transitionHoManagers (rebase branch).
 *
 * Sections:
 *   A. UNIT — rebase on a fresh model is a safe no-op; rebase(0) is a pure no-op.
 *   W. REAL LIVE WRAP (the blocker) — drive the production useFrame in-step didLoopWrap.
 *      The FIX rebases the cell model on the wrap; a CONTROL arm (no wrap rebase = the
 *      bug) leaves the per-cell guardUntilMs STALE (far future). Directly asserts the
 *      guard staleness gap + served recovery. This is the only section that exercises
 *      the actual live wrap and the timer-offset mechanism.
 *   B. SEEK continuity — rebase keeps serving where reset() cold-re-acquires.
 *   P. PHANTOM-HO — across a sat-set-changing seek, rebase CLEARS prevUeServing so the
 *      seam classifies as attach, NOT a phantom inter-HO (locks the cleared-prevUeServing
 *      decision; a rebase that KEEPS prevUeServing spikes seam inter-HO vs the reset arm).
 *   D. WIRING — both the useFrame didLoopWrap rebase AND the transitionHoManagers swap.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { loadProfile } from '../src/profiles/index.ts';
import { createObserverContext } from '../src/engine/orbit';
import { HandoverManager } from '../src/engine/handover/handover-manager';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  stepRuntimeFrame,
} from '../src/scene/runtimeFrameStep.ts';
import {
  attachSinrLiveCellFrame,
  createSinrLiveCellModel,
  type CellTruthFrame,
} from '../src/scene/sinrLiveCellRuntime.ts';
import { SinrLiveCellModel, type SinrLiveCellFrame } from '../src/scene/sinrLiveCellModel.ts';

const GATE = 'validate:s4:cell-served-survives-wrap';
const PROFILE_ID = 'hobs-2024-candidate-rich';
const APP_EPOCH_MS = 1_767_225_600_000; // 2026-01-01T00:00:00Z
const UE_COUNT = 100;
const NOW_MS = 1_000_000; // injected display clock (S3-1) — irrelevant to served truth

// Reach the per-cell HandoverManagers' clock-absolute guard (private) the way the s3
// gate reaches guardUntilMs — via `as unknown` cast, no class pollution.
function guardStaleness(model: SinrLiveCellModel, simTimeSec: number): { maxStalenessMs: number; staleCount: number; total: number } {
  const nowMs = APP_EPOCH_MS + simTimeSec * 1000;
  const managers = (model as unknown as { cellManagers: Map<number, unknown> }).cellManagers;
  let maxStalenessMs = -Infinity;
  let staleCount = 0;
  let total = 0;
  for (const m of managers.values()) {
    total += 1;
    const guard = (m as { guardUntilMs: number }).guardUntilMs;
    const staleness = guard - nowMs;
    if (staleness > maxStalenessMs) maxStalenessMs = staleness;
    if (staleness > 60_000) staleCount += 1; // >60s in the future = stale (a legit ping-pong guard is seconds)
  }
  return { maxStalenessMs, staleCount, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// Harness: stepRuntimeFrame + cell attach, replicating useSimulation's useFrame
// (incl. the S4-1 didLoopWrap cell rebase, toggleable for the W positive control).
// ─────────────────────────────────────────────────────────────────────────────
interface StepOut { cells: SinrLiveCellFrame; didLoopWrap: boolean; }
interface CellHarness {
  stepCell: (paused: boolean, dt: number) => StepOut;
  rebaseCell: (deltaMs: number) => void;
  resetCell: () => void;
  seekTo: (toSec: number) => void;
  model: SinrLiveCellModel;
  state: ReturnType<typeof createRuntimeFrameStepState>;
  maxTimeSec: number;
}
function makeCellHarness(opts?: { rebaseCellOnWrap?: boolean }): CellHarness {
  const rebaseOnWrap = opts?.rebaseCellOnWrap ?? true;
  const profile = loadProfile(PROFILE_ID);
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const trajectoryCache = createTrajectoryCache(profile, observer, APP_EPOCH_MS);
  const maxTimeSec = getTrajectoryMaxTimeSec(trajectoryCache);
  const beamLayoutsByShellId = createBeamLayoutsByShellId(profile);
  const hoManager = new HandoverManager(profile.handover);
  const secondaryHoManagers = Array.from({ length: UE_COUNT - 1 }, () => new HandoverManager(profile.handover));
  const state = createRuntimeFrameStepState(0);
  const cellModel = createSinrLiveCellModel(profile, true, APP_EPOCH_MS);
  assert.ok(cellModel !== null, 'setup: cell model must be non-null on the sinr-live lane');
  const replay = { epochUtcMs: APP_EPOCH_MS, startOffsetSec: 0, loop: true, windowLengthSec: 7200 };
  const stepCell = (paused: boolean, dt: number): StepOut => {
    const out = stepRuntimeFrame({
      profile, replay, speed: 1, paused, deltaSec: paused ? 0 : dt, nowMs: NOW_MS,
      observer, beamLayoutsByShellId, trajectoryCache, hoManager, state,
      ueCount: UE_COUNT, secondaryHoManagers, uePrimaryAnchorMode: 'observer',
    });
    // Replicate useSimulation.ts useFrame: rebase the cell model on the in-step wrap.
    if (out.didLoopWrap && rebaseOnWrap) {
      cellModel.rebase((out.frame.simTimeSec - out.previousSimTimeSec) * 1000);
    }
    attachSinrLiveCellFrame(out.frame as unknown as CellTruthFrame, cellModel, out.frame.simTimeSec - out.previousSimTimeSec);
    const cells = out.frame.sinrLiveCells;
    assert.ok(cells !== undefined, 'attach must populate frame.sinrLiveCells on the sinr-live lane');
    return { cells, didLoopWrap: out.didLoopWrap };
  };
  return {
    stepCell,
    rebaseCell: (deltaMs: number) => cellModel.rebase(deltaMs),
    resetCell: () => cellModel.reset(),
    seekTo: (toSec: number) => { state.simTimeSec = toSec; },
    model: cellModel,
    state,
    maxTimeSec,
  };
}

const servedUe = (s: StepOut): number => s.cells.servedUeCount;
const cellServingIdentity = (s: StepOut): string =>
  s.cells.cells.filter(c => c.servingSatId !== null).map(c => `${c.cellId}>${c.servingSatId}`).sort().join('|');

function warmTo(h: CellHarness, toSec: number, dt: number): StepOut {
  h.stepCell(true, 0);
  let last = h.stepCell(false, 0);
  while (h.state.simTimeSec + dt <= toSec + 1e-9) last = h.stepCell(false, dt);
  return last;
}

// ─────────────────────────────────────────────────────────────────────────────
// A — unit no-op
// ─────────────────────────────────────────────────────────────────────────────
function unitNoop(): void {
  const profile = loadProfile(PROFILE_ID);
  const fresh = createSinrLiveCellModel(profile, true, APP_EPOCH_MS);
  assert.ok(fresh !== null, 'A setup: model non-null');
  assert.doesNotThrow(() => fresh.rebase(-123_456), 'A: rebase on a fresh model does not throw');

  // rebase(0) is a PURE no-op: compare rebase(0)+re-step against the SAME re-step without
  // rebase (the cell model is NOT idempotent across a re-step, so compare like-for-like).
  const hNoop = makeCellHarness();
  const beforeNoop = warmTo(hNoop, 48, 6);
  assert.ok(beforeNoop.cells.servedUeCount > UE_COUNT / 3, `A VACUOUS: only ${beforeNoop.cells.servedUeCount}/${UE_COUNT} served before`);
  hNoop.rebaseCell(0);
  const afterNoop = hNoop.stepCell(true, 0);

  const hPlain = makeCellHarness();
  const beforePlain = warmTo(hPlain, 48, 6);
  assert.equal(beforePlain.cells.servedUeCount, beforeNoop.cells.servedUeCount, 'A NON-DETERMINISTIC: warm served differs across harnesses');
  const afterPlain = hPlain.stepCell(true, 0);
  assert.equal(cellServingIdentity(afterNoop), cellServingIdentity(afterPlain), 'A: rebase(0) is a pure no-op (re-step with vs without rebase(0) must match)');
}

// ─────────────────────────────────────────────────────────────────────────────
// W — REAL live wrap (the blocker): in-step didLoopWrap, guard staleness + recovery
// ─────────────────────────────────────────────────────────────────────────────
const W_START_SEC = 7170;
const W_WARM_DT = 5;
const W_POST_DT = 5;
const W_POST_FRAMES = 10;
interface WrapResult { servedBefore: number; wrapped: boolean; simAtWrap: number; staleAtWrap: ReturnType<typeof guardStaleness>; postServed: number[]; cumulative: number; }
function runWrap(rebaseCellOnWrap: boolean): WrapResult {
  const h = makeCellHarness({ rebaseCellOnWrap });
  h.state.simTimeSec = W_START_SEC;
  h.stepCell(true, 0);
  let servedBefore = 0;
  let guard = 0;
  while (h.state.simTimeSec + W_WARM_DT < h.maxTimeSec && guard++ < 3000) {
    servedBefore = servedUe(h.stepCell(false, W_WARM_DT));
    if (h.state.simTimeSec >= h.maxTimeSec - W_WARM_DT) break;
  }
  const wrapStep = h.stepCell(false, W_WARM_DT); // crosses maxTimeSec → didLoopWrap
  const staleAtWrap = guardStaleness(h.model, h.state.simTimeSec);
  const postServed = [servedUe(wrapStep)];
  for (let k = 0; k < W_POST_FRAMES; k += 1) postServed.push(servedUe(h.stepCell(false, W_POST_DT)));
  return { servedBefore, wrapped: wrapStep.didLoopWrap, simAtWrap: h.state.simTimeSec - W_POST_DT * W_POST_FRAMES, staleAtWrap, postServed, cumulative: postServed.reduce((a, b) => a + b, 0) };
}

// ─────────────────────────────────────────────────────────────────────────────
// B — small backward seek continuity (the transitionHoManagers/seek path method)
// ─────────────────────────────────────────────────────────────────────────────
const B_WARM_TO = 60;
const B_WARM_DT = 6;
const B_SEEK_BACK = 8;
function runSmallSeek(coldReset: boolean): { servedBefore: number; servedAtSeek: number } {
  const h = makeCellHarness();
  const before = warmTo(h, B_WARM_TO, B_WARM_DT);
  const fromSec = h.state.simTimeSec;
  const toSec = fromSec - B_SEEK_BACK;
  if (coldReset) h.resetCell(); else h.rebaseCell((toSec - fromSec) * 1000);
  h.seekTo(toSec);
  const atSeek = h.stepCell(true, 0);
  return { servedBefore: before.cells.servedUeCount, servedAtSeek: atSeek.cells.servedUeCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// P — phantom-HO: a sat-set-changing seek must NOT fabricate seam inter-HO
// ─────────────────────────────────────────────────────────────────────────────
const P_WARM_TO = 60;
const P_WARM_DT = 6;
const P_SEEK_FWD = 1800; // sky rotates → serving sat set changes
function runPhantom(coldReset: boolean): { seamInterHo: number; seamIntraHo: number } {
  const h = makeCellHarness();
  warmTo(h, P_WARM_TO, P_WARM_DT);
  const fromSec = h.state.simTimeSec;
  const toSec = fromSec + P_SEEK_FWD;
  if (coldReset) h.resetCell(); else h.rebaseCell((toSec - fromSec) * 1000);
  h.seekTo(toSec);
  const atSeek = h.stepCell(true, 0);
  return { seamInterHo: atSeek.cells.interHandoverCount, seamIntraHo: atSeek.cells.intraHandoverCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// D — wiring (both production rebase sites)
// ─────────────────────────────────────────────────────────────────────────────
function wiringDispatch(): void {
  const src = readFileSync(new URL('../src/scene/useSimulation.ts', import.meta.url), 'utf8');
  // (1) transitionHoManagers: rebase branch rebases the cell model, cold-start resets it.
  const start = src.indexOf('const transitionHoManagers = useCallback(');
  assert.ok(start !== -1, 'D WIRING: transitionHoManagers not found');
  const depsAt = src.indexOf('sinrLiveCellModel]', start);
  assert.ok(depsAt !== -1, 'D WIRING: transitionHoManagers deps (cell model) not found');
  const body = src.slice(start, depsAt);
  const elseAt = body.indexOf('} else {');
  assert.ok(elseAt !== -1, 'D WIRING: transitionHoManagers branch split not found');
  assert.ok(
    body.slice(0, elseAt).includes('sinrLiveCellModel?.rebase(transition.deltaMs)'),
    'D WIRING FAILED: transitionHoManagers rebase branch does not rebase the cell model (seek/reloop hole)',
  );
  assert.ok(
    body.slice(elseAt).includes('sinrLiveCellModel?.reset()'),
    'D WIRING FAILED: transitionHoManagers cold-start branch does not reset the cell model',
  );
  assert.ok(
    !body.slice(0, elseAt).includes('sinrLiveCellModel?.reset()'),
    'D WIRING FAILED: transitionHoManagers rebase branch still resets the cell model',
  );
  // (2) the useFrame in-step didLoopWrap rebases the cell model (the live-wrap path).
  assert.ok(
    /if \(didLoopWrap\) \{[\s\S]{0,160}sinrLiveCellModel\?\.rebase\(\(frame\.simTimeSec - previousSimTimeSec\) \* 1000\)/.test(src),
    'D WIRING FAILED: the useFrame didLoopWrap branch does not rebase the cell model (the live loop-wrap hole — the blocker)',
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════════════════

wiringDispatch();
unitNoop();

// SECTION W — the live wrap (blocker)
const wFix = runWrap(true);
const wCtl = runWrap(false);
const wFixRepeat = runWrap(true);

assert.ok(wFix.wrapped && wCtl.wrapped, `W VACUOUS: no didLoopWrap fired (fix=${wFix.wrapped}, ctl=${wCtl.wrapped})`);
assert.ok(wFix.servedBefore > UE_COUNT / 3, `W VACUOUS: only ${wFix.servedBefore}/${UE_COUNT} served before the wrap`);
assert.deepEqual(wFixRepeat.postServed, wFix.postServed, 'W NON-DETERMINISTIC: post-wrap served sequence diverged across runs');
// CONTROL (no wrap rebase = the bug): managers keep a stale FAR-FUTURE guard.
assert.ok(
  wCtl.staleAtWrap.staleCount >= 5 && wCtl.staleAtWrap.maxStalenessMs > 1_000_000,
  `W POSITIVE CONTROL FAILED: not rebasing the cell model on the wrap did NOT leave stale guards (staleCount=${wCtl.staleAtWrap.staleCount}/${wCtl.staleAtWrap.total}, maxStaleness=${wCtl.staleAtWrap.maxStalenessMs}ms) — the blocker is unobserved`,
);
// FIX: the wrap rebase offsets every guard back onto the new clock (no far-future guard).
assert.ok(
  wFix.staleAtWrap.staleCount === 0 && wFix.staleAtWrap.maxStalenessMs < 60_000,
  `W FIX FAILED: cell-model rebase on the wrap left a stale guard (staleCount=${wFix.staleAtWrap.staleCount}/${wFix.staleAtWrap.total}, maxStaleness=${wFix.staleAtWrap.maxStalenessMs}ms) — rebase did not offset the timers (no-op/wrong-sign)`,
);
const wStaleGap = wCtl.staleAtWrap.maxStalenessMs - wFix.staleAtWrap.maxStalenessMs;
assert.ok(wStaleGap > 1_000_000, `W FIX FAILED: rebase staleness gap ${wStaleGap}ms below floor (fix=${wFix.staleAtWrap.maxStalenessMs}, ctl=${wCtl.staleAtWrap.maxStalenessMs})`);
// continuity: the fix recovers served at least as well as the (eventLog-keeping) control.
assert.ok(wFix.cumulative >= wCtl.cumulative, `W FIX FAILED: rebase recovered worse than control (fix=[${wFix.postServed}] ctl=[${wCtl.postServed}])`);

// SECTION B — small seek continuity (rebase keeps serving; reset crashes)
const bFix = runSmallSeek(false);
const bCtl = runSmallSeek(true);
const bFixRepeat = runSmallSeek(false);
assert.ok(bFix.servedBefore > UE_COUNT / 3, `B VACUOUS: only ${bFix.servedBefore}/${UE_COUNT} served before the seek`);
assert.equal(bFixRepeat.servedAtSeek, bFix.servedAtSeek, 'B NON-DETERMINISTIC: served-at-seek diverged across runs');
const bFixFloor = Math.ceil(bFix.servedBefore * 0.7);
assert.ok(bFix.servedAtSeek >= bFixFloor, `B FIX FAILED: served crashed WITH rebase — ${bFix.servedAtSeek} (was ${bFix.servedBefore}; need >= ${bFixFloor})`);
const bGap = bFix.servedAtSeek - bCtl.servedAtSeek;
assert.ok(bGap >= 5 && bCtl.servedAtSeek < bFix.servedAtSeek, `B POSITIVE CONTROL FAILED: reset()-on-seek did not drop served (reset=${bCtl.servedAtSeek}, rebase=${bFix.servedAtSeek}, gap=${bGap})`);

// SECTION P — phantom-HO: clearing prevUeServing keeps the seam classification truthful
const pFix = runPhantom(false); // rebase (clears prevUeServing)
const pReset = runPhantom(true); // reset (also clears prevUeServing) — the truthful reference
assert.equal(
  pFix.seamInterHo, pReset.seamInterHo,
  `P PHANTOM-HO FAILED: rebase seam inter-HO (${pFix.seamInterHo}) != reset reference (${pReset.seamInterHo}) — rebase is fabricating phantom inter-HO at the seam (prevUeServing not cleared)`,
);
assert.ok(pFix.seamInterHo <= 2, `P: seam inter-HO unexpectedly high after a teleport (${pFix.seamInterHo}) — prevUeServing leak?`);

console.log(
  `[${GATE}] PASS\n`
  + `  D wiring: useFrame didLoopWrap rebases the cell model (live wrap) + transitionHoManagers rebase/cold-start (seek).\n`
  + `  A unit: rebase no-op on fresh model; rebase(0)+re-step == plain re-step.\n`
  + `  W live wrap: before=${wFix.servedBefore}; ctl stale guards=${wCtl.staleAtWrap.staleCount}/${wCtl.staleAtWrap.total} (max ${(wCtl.staleAtWrap.maxStalenessMs / 1000).toFixed(0)}s) vs fix=${wFix.staleAtWrap.staleCount} (max ${(wFix.staleAtWrap.maxStalenessMs / 1000).toFixed(1)}s); recover fix=[${wFix.postServed}].\n`
  + `  B small seek (${B_SEEK_BACK}s): before=${bFix.servedBefore} rebase@seek=${bFix.servedAtSeek} reset@seek=${bCtl.servedAtSeek} (gap ${bGap}).\n`
  + `  P phantom-HO (+${P_SEEK_FWD}s seek): rebase seam inter-HO=${pFix.seamInterHo} == reset reference (no fabricated HO).`,
);
