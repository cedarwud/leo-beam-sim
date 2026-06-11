/**
 * Consolidation S3-2 — served-survives-wrap gate.
 *
 * Proves the S3-2 cut: at a sim-time jump (loop wrap, window re-loop, seek) the
 * steered HO managers clock-REBASE instead of reset(), so served UEs do not crash
 * across the jump — the served-N/N flicker (S3 plan §1.6). Three layers, weakest
 * dependency on geometry first:
 *
 *   A. UNIT contract (no constellation, fully deterministic) — the mechanism:
 *      reset() nukes eventLog+serving+guard; rebase() preserves eventLog+serving and
 *      offsets ONLY guardUntilMs/pendingSinceMs by exactly the jump (with backward
 *      clamps). And the PRODUCTION BENEFIT directly: an eventLog-nonempty manager
 *      re-attaches a MARGINAL candidate via the −3 dB relax that an eventLog-empty
 *      (cold-reset) manager rejects. This is *why* preserving eventLog matters.
 *
 *   B. INTEGRATION continuity (real runtime, small wrap) — when the serving sat is
 *      still visible across the jump, rebase keeps the link (served holds) where
 *      reset() crashes it. (Mechanism demo; the SHIPPED loop is full-window — see C.)
 *
 *   C. INTEGRATION recovery (real runtime, FULL-window wrap = the shipped loop,
 *      LIVE_SIM_TIMELINE_DURATION_SEC == maxTimeSec == 7200) — the sky fully turns
 *      over, so served drops to ~0 at the wrap for BOTH arms; rebase then re-acquires
 *      FASTER than reset() over the following frames (eventLog survives → relaxed
 *      threshold). Asserts rebase dominates reset at every post-wrap frame.
 *
 * Positive controls everywhere: B/C compare production-rebase against the legacy
 * reset()-on-wrap behavior (managers reset() right before the wrap step, so the
 * production rebase no-ops). If rebase were secretly a reset, A1/A3/B all fail.
 */
import assert from 'node:assert/strict';

import { loadProfile } from '../src/profiles/index.ts';
import { createObserverContext } from '../src/engine/orbit';
import { HandoverManager } from '../src/engine/handover/handover-manager';
import type { LinkSample } from '../src/engine/signal/types';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  stepRuntimeFrame,
} from '../src/scene/runtimeFrameStep.ts';

const GATE = 'validate:s3:served-survives-wrap';
const PROFILE_ID = 'hobs-2024-candidate-rich';
const APP_EPOCH_MS = 1_767_225_600_000; // 2026-01-01T00:00:00Z
const UE_COUNT = 100;
const NOW_MS = 1_000_000; // injected display clock (S3-1) — irrelevant to served truth

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A — unit-level rebase/reset contract + the relax mechanism (no geometry)
// ─────────────────────────────────────────────────────────────────────────────

function linkSample(satId: string, beamId: number, sinrDb: number): LinkSample {
  // update() reads only satId/beamId/sinrDb; the rest are display-only fillers.
  return {
    satId, beamId, sinrDb,
    rsrpDbm: -90, signalDbm: -90, intraInterferenceDbm: -150, interInterferenceDbm: -150,
    noiseDbm: -120, denominatorDbm: -120, txPowerDbm: 30, pathLossDb: 160,
    beamGainDb: 30, steeringLossDb: 0, receiverGainDbi: 0,
  };
}

function unitContract(): { relaxGapDb: number } {
  const profile = loadProfile(PROFILE_ID);
  const thresholdDb = profile.handover.sinrThresholdDb; // -5
  const relaxDb = 3; // HandoverManager.REATTACH_THRESHOLD_RELAX_DB
  const strongSinr = thresholdDb + 5; // comfortably attaches under the STRICT threshold
  const marginalSinr = thresholdDb - 1.5; // in [threshold-3, threshold): relax-only

  // ── A1: reset() nukes eventLog+serving+guard; rebase() PRESERVES eventLog+serving ──
  const mkWarm = () => {
    const m = new HandoverManager(profile.handover);
    m.update([linkSample('sat-A', 0, strongSinr)], 1, APP_EPOCH_MS); // initial attach → eventLog+guard
    return m;
  };
  const warmReset = mkWarm();
  assert.ok(warmReset.eventLog.length > 0 && warmReset.state.satId === 'sat-A', 'A1 setup: warm manager serving with a logged event');
  assert.ok((warmReset as unknown as { guardUntilMs: number }).guardUntilMs > 0, 'A1 setup: inter-HO armed the ping-pong guard');
  warmReset.reset();
  assert.equal(warmReset.eventLog.length, 0, 'A1: reset() nukes eventLog');
  assert.equal(warmReset.state.satId, null, 'A1: reset() drops serving');
  assert.equal((warmReset as unknown as { guardUntilMs: number }).guardUntilMs, 0, 'A1: reset() zeroes the guard');

  const warmRebase = mkWarm();
  const eventsBefore = warmRebase.eventLog.length;
  warmRebase.rebase(-1234);
  assert.equal(warmRebase.eventLog.length, eventsBefore, 'A1: rebase() PRESERVES eventLog');
  assert.equal(warmRebase.state.satId, 'sat-A', 'A1: rebase() PRESERVES serving');

  // ── A2: rebase offsets guardUntilMs/pendingSinceMs by EXACTLY delta; backward clamps ──
  const fwd = mkWarm();
  const g0 = (fwd as unknown as { guardUntilMs: number }).guardUntilMs;
  (fwd as unknown as { pendingSinceMs: number | null }).pendingSinceMs = APP_EPOCH_MS + 500; // synthetic pending stamp
  fwd.rebase(777);
  assert.equal((fwd as unknown as { guardUntilMs: number }).guardUntilMs, g0 + 777, 'A2: guardUntilMs offset by exactly +delta');
  assert.equal((fwd as unknown as { pendingSinceMs: number | null }).pendingSinceMs, APP_EPOCH_MS + 500 + 777, 'A2: pendingSinceMs offset by exactly +delta');

  const back = mkWarm();
  (back as unknown as { pendingSinceMs: number | null }).pendingSinceMs = 1000;
  back.rebase(-1e15); // huge backward jump
  assert.equal((back as unknown as { guardUntilMs: number }).guardUntilMs, 0, 'A2: huge backward jump clamps guardUntilMs to 0');
  assert.equal((back as unknown as { pendingSinceMs: number | null }).pendingSinceMs, null, 'A2: backward jump below sim-start retracts the pending (pendingSinceMs null)');
  assert.equal(back.state.pendingTarget, null, 'A2: backward-jump retraction also clears the pending target (self-consistent)');

  // ── A3: THE PRODUCTION BENEFIT — eventLog>0 ⟹ marginal attaches (relax); empty ⟹ rejected (strict) ──
  const relaxArm = mkWarm();         // eventLog>0 (rebase keeps this across a wrap)
  relaxArm.clearServing();           // sat-A gone; serving dropped but eventLog preserved
  relaxArm.update([linkSample('sat-B', 0, marginalSinr)], 1, APP_EPOCH_MS + 10_000);
  assert.equal(relaxArm.state.satId, 'sat-B', 'A3: eventLog-nonempty manager re-attaches the MARGINAL candidate via the −3 dB relax');

  const strictArm = new HandoverManager(profile.handover); // eventLog empty (what reset() leaves)
  strictArm.update([linkSample('sat-B', 0, marginalSinr)], 1, APP_EPOCH_MS + 10_000);
  assert.equal(strictArm.state.satId, null, 'A3: eventLog-empty (cold-reset) manager REJECTS the same marginal candidate (strict threshold)');

  return { relaxGapDb: relaxDb };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION B/C — integration helpers (real runtime, 100 UEs, candidate-rich)
// ─────────────────────────────────────────────────────────────────────────────

function countServed(perUePositions: ReadonlyArray<{ servingSatId: string | null }>): number {
  return perUePositions.filter(ue => ue.servingSatId !== null).length;
}
function servingIdentity(perUePositions: ReadonlyArray<{ id: string; servingSatId: string | null; servingBeamId: number | null }>): string {
  return perUePositions
    .filter(ue => ue.servingSatId !== null && ue.servingBeamId !== null)
    .map(ue => `${ue.id}>${ue.servingSatId}:${ue.servingBeamId}`)
    .sort()
    .join('|');
}

interface Harness {
  step: (paused: boolean, dt: number) => ReturnType<typeof stepRuntimeFrame>;
  state: ReturnType<typeof createRuntimeFrameStepState>;
  maxTimeSec: number;
  managers: HandoverManager[];
}
function makeHarness(sliceLen?: number): Harness {
  const profile = loadProfile(PROFILE_ID);
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const fullCache = createTrajectoryCache(profile, observer, APP_EPOCH_MS);
  const trajectoryCache = sliceLen === undefined ? fullCache : fullCache.slice(0, sliceLen);
  const maxTimeSec = getTrajectoryMaxTimeSec(trajectoryCache);
  const beamLayoutsByShellId = createBeamLayoutsByShellId(profile);
  const hoManager = new HandoverManager(profile.handover);
  const secondaryHoManagers = Array.from({ length: UE_COUNT - 1 }, () => new HandoverManager(profile.handover));
  const state = createRuntimeFrameStepState(0);
  const replay = { epochUtcMs: APP_EPOCH_MS, startOffsetSec: 0, loop: true, windowLengthSec: 7200 };
  const step = (paused: boolean, dt: number) =>
    stepRuntimeFrame({
      profile, replay, speed: 1, paused, deltaSec: paused ? 0 : dt, nowMs: NOW_MS,
      observer, beamLayoutsByShellId, trajectoryCache, hoManager, state,
      ueCount: UE_COUNT, secondaryHoManagers, uePrimaryAnchorMode: 'observer',
    });
  return { step, state, maxTimeSec, managers: [hoManager, ...secondaryHoManagers] };
}

// ── SECTION B — small-wrap serving CONTINUITY (mechanism demo) ──
// Slice the trajectory short, warm to a well-served sky, then take ONE overshoot
// step (dt = maxTime − WRAP_JUMP_SEC) that wraps by a small backward jump so the
// serving sats stay visible. coldResetAtWrap reproduces legacy reset()-on-wrap.
const B_SLICE_LEN = 8; // maxTimeSec = 140 s
const B_WARM_DT = 10;
const B_WARM_TO_SEC = 70;
const B_WRAP_JUMP_SEC = 5;
interface ContinuityResult { servedBefore: number; servedAtWrap: number; identityAtWrap: string; wrapped: boolean; preSec: number; postSec: number; }
function runContinuity(coldResetAtWrap: boolean): ContinuityResult {
  const h = makeHarness(B_SLICE_LEN);
  h.step(true, 0);
  let servedBefore = 0;
  while (h.state.simTimeSec + B_WARM_DT <= B_WARM_TO_SEC + 1e-9) {
    servedBefore = countServed(h.step(false, B_WARM_DT).frame.perUePositions);
  }
  const preSec = h.state.simTimeSec;
  if (coldResetAtWrap) h.managers.forEach(m => m.reset());
  const wrapOut = h.step(false, h.maxTimeSec - B_WRAP_JUMP_SEC);
  return {
    servedBefore,
    servedAtWrap: countServed(wrapOut.frame.perUePositions),
    identityAtWrap: servingIdentity(wrapOut.frame.perUePositions),
    wrapped: wrapOut.didLoopWrap,
    preSec,
    postSec: h.state.simTimeSec,
  };
}

// ── SECTION C — FULL-window recovery (the shipped loop) ──
// Full trajectory cache (maxTime=7200=LIVE_SIM_TIMELINE_DURATION_SEC). Warm near the
// window end, cross the natural wrap to t≈0 (sky fully turns over → served≈0 for both),
// then measure served over K post-wrap frames. Rebase re-acquires faster (eventLog→relax).
const C_START_SEC = 7170;
const C_WARM_DT = 5;
const C_POST_DT = 5;
const C_POST_FRAMES = 12;
interface RecoveryResult { servedBefore: number; wrapped: boolean; preSec: number; postServed: number[]; cumulative: number; }
function runRecovery(coldResetAtWrap: boolean): RecoveryResult {
  const h = makeHarness();
  h.state.simTimeSec = C_START_SEC; // start near the window end so the wrap is a few steps away
  h.step(true, 0);
  let servedBefore = 0;
  let guard = 0;
  while (h.state.simTimeSec + C_WARM_DT < h.maxTimeSec && guard++ < 3000) {
    servedBefore = countServed(h.step(false, C_WARM_DT).frame.perUePositions);
    if (h.state.simTimeSec >= h.maxTimeSec - C_WARM_DT) break;
  }
  const preSec = h.state.simTimeSec;
  if (coldResetAtWrap) h.managers.forEach(m => m.reset());
  const wrapOut = h.step(false, C_WARM_DT);
  const postServed = [countServed(wrapOut.frame.perUePositions)];
  for (let k = 0; k < C_POST_FRAMES; k += 1) postServed.push(countServed(h.step(false, C_POST_DT).frame.perUePositions));
  return { servedBefore, wrapped: wrapOut.didLoopWrap, preSec, postServed, cumulative: postServed.reduce((a, b) => a + b, 0) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════════════════

const { relaxGapDb } = unitContract();

// SECTION B
const bFix = runContinuity(false);
const bCtl = runContinuity(true);
const bFixRepeat = runContinuity(false);

assert.ok(bFix.wrapped && bCtl.wrapped, `B VACUOUS: no small wrap fired (fix=${bFix.wrapped}, ctl=${bCtl.wrapped})`);
const bJump = bFix.preSec - bFix.postSec;
assert.ok(
  bFix.postSec < bFix.preSec && Math.abs(bJump - B_WRAP_JUMP_SEC) < 1e-6,
  `B VACUOUS: wrap was not the intended small jump (pre=${bFix.preSec}, post=${bFix.postSec}, jump=${bJump}s)`,
);
assert.ok(bFix.servedBefore > UE_COUNT / 2, `B VACUOUS: only ${bFix.servedBefore}/${UE_COUNT} served before the wrap`);
// determinism: byte-stable serving IDENTITY (not just count) across two fix runs + warm-up equality
assert.equal(bCtl.servedBefore, bFix.servedBefore, `B NON-DETERMINISTIC warm-up: ${bFix.servedBefore} != ${bCtl.servedBefore}`);
assert.equal(bFixRepeat.identityAtWrap, bFix.identityAtWrap, 'B NON-DETERMINISTIC: serving identity diverged across two fix runs');
// FIX: rebase keeps (nearly) all serving; CONTROL: reset crashes it by a clear margin
const bFixFloor = Math.ceil(bFix.servedBefore * 0.85);
assert.ok(bFix.servedAtWrap >= bFixFloor, `B FIX FAILED: served crashed WITH rebase — ${bFix.servedAtWrap} (was ${bFix.servedBefore}; need >= ${bFixFloor})`);
const bGap = bFix.servedAtWrap - bCtl.servedAtWrap;
assert.ok(
  bCtl.servedAtWrap <= Math.floor(bFix.servedAtWrap * 0.85) && bGap >= 10,
  `B POSITIVE CONTROL FAILED: reset()-on-wrap did not drop served meaningfully (reset=${bCtl.servedAtWrap}, rebase=${bFix.servedAtWrap}, gap=${bGap})`,
);

// SECTION C
const cFix = runRecovery(false);
const cCtl = runRecovery(true);
const cFixRepeat = runRecovery(false);

assert.ok(cFix.wrapped && cCtl.wrapped, `C VACUOUS: no full-window wrap fired (fix=${cFix.wrapped}, ctl=${cCtl.wrapped})`);
assert.ok(cFix.preSec > C_START_SEC && cFix.preSec >= 7000, `C VACUOUS: did not warm near the window end (pre=${cFix.preSec})`);
assert.ok(cFix.servedBefore > UE_COUNT / 2, `C VACUOUS: only ${cFix.servedBefore}/${UE_COUNT} served before the wrap`);
assert.deepEqual(cFixRepeat.postServed, cFix.postServed, 'C NON-DETERMINISTIC: post-wrap served sequence diverged across runs');
// the full-window wrap collapses BOTH arms at the wrap step (sky fully turned over)
assert.ok(
  cFix.postServed[0] <= cFix.servedBefore * 0.5 && cCtl.postServed[0] <= cCtl.servedBefore * 0.5,
  `C SETUP: full-window wrap should collapse served for both arms (rebase@wrap=${cFix.postServed[0]}, reset@wrap=${cCtl.postServed[0]}, before=${cFix.servedBefore})`,
);
// THE PRODUCTION WIN: rebase re-acquires at least as fast at EVERY post-wrap frame, strictly faster somewhere
const dominates = cFix.postServed.every((v, i) => v >= cCtl.postServed[i]);
const strictlyFasterSomewhere = cFix.postServed.some((v, i) => v > cCtl.postServed[i]);
const cGap = cFix.cumulative - cCtl.cumulative;
assert.ok(dominates, `C FAILED: rebase did NOT dominate reset on recovery — rebase=[${cFix.postServed}] reset=[${cCtl.postServed}]`);
assert.ok(strictlyFasterSomewhere, `C FAILED: rebase recovered no faster than reset (no strict gain) — the eventLog-relax benefit is absent`);
assert.ok(cGap >= 10, `C WEAK: cumulative recovery gain ${cGap} below floor 10 (rebase=${cFix.cumulative}, reset=${cCtl.cumulative})`);

console.log(
  `[${GATE}] PASS\n`
  + `  A unit: reset nukes eventLog/serving/guard; rebase preserves eventLog+serving, offsets timers by exact delta (backward clamps); `
  + `eventLog-relax (−${relaxGapDb} dB) re-attaches a marginal candidate that a cold-reset manager rejects.\n`
  + `  B small-wrap continuity: before=${bFix.servedBefore} rebase@wrap=${bFix.servedAtWrap} reset@wrap=${bCtl.servedAtWrap} (gap ${bGap}).\n`
  + `  C full-window recovery (${bFix.preSec ? '' : ''}${cFix.preSec.toFixed(0)}s→0): rebase=[${cFix.postServed}] reset=[${cCtl.postServed}] cumΔ=${cGap}.`,
);
