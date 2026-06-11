/**
 * Consolidation S3-1 — pure-step clock-injection gate.
 *
 * Proves the S3-1 cut: `stepRuntimeFrame` takes NO ambient wall-clock read on the
 * driven path — the display-only handover viz latches are stamped from the
 * injected `nowMs` input, and truth (serving / SINR / handover decisions /
 * per-UE serving) is a pure function of (state, dt, config), independent of nowMs.
 *
 * Unlike validate:s0:geometry-trace this gate deliberately does NOT monkey-patch
 * performance.now / Date.now. That is the whole point: if the step still read the
 * ambient clock, two runs with identical injected nowMs would diverge on the latch
 * timestamps (real wall time advances between runs) and PURITY would FAIL. Passing
 * WITHOUT the patch is the proof the wall clock left the driven path.
 *
 * Meta-gates: (1) PURITY — run-twice-no-patch determinism (truth + latch byte-equal);
 * (2) NON-VACUOUS — a viz latch is actually stamped + serving on > half the steps +
 * a handover fires; (3) FLOW / perturbation control — a DELTA offset on injected
 * nowMs shifts every active latch timestamp by exactly DELTA (nowMs -> display) while
 * leaving truth byte-identical (nowMs ⊥ truth).
 */
import assert from 'node:assert/strict';

import { loadProfile } from '../src/profiles/index.ts';
import { createObserverContext } from '../src/engine/orbit';
import { HandoverManager } from '../src/engine/handover/handover-manager';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  stepRuntimeFrame,
} from '../src/scene/runtimeFrameStep.ts';

const GATE = 'validate:s3:pure-step';
const PROFILE_ID = 'hobs-2024-candidate-rich';
const APP_EPOCH_MS = 1_767_225_600_000; // 2026-01-01T00:00:00Z
const UE_COUNT = 100;
const STEP_SEC = 5;
const STEP_COUNT = 40; // 200 s — same window as the geometry-trace golden (~4 handovers)
const NOW_TICK_MS = 1000; // injected wall-clock advance per sim step (keeps latches alive a few steps)
const NOW_BASE_A_MS = 1_000_000;
const DELTA_MS = 4_000_000; // a large, distinctive offset for run B

interface StepCapture {
  // TRUTH — must be a pure function of (state, dt, config); NEVER carries wall-clock.
  readonly truth: {
    readonly serving: { readonly satId: string | null; readonly beamId: number | null; readonly sinrDb: number | null };
    readonly pendingTargetSatId: string | null;
    readonly pendingTargetBeamId: number | null;
    readonly hoCount: number;
    readonly perUeServing: readonly string[]; // sorted "ueId>satId:beamId" (unserved omitted)
  };
  // DISPLAY — the handover viz latch wall-clock, stamped from injected nowMs ONLY.
  readonly latch: {
    readonly intraStart: number | null;
    readonly intraExpires: number | null;
    readonly interStart: number | null;
    readonly interExpires: number | null;
  };
}

function captureRun(nowBaseMs: number): StepCapture[] {
  const profile = loadProfile(PROFILE_ID);
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const trajectoryCache = createTrajectoryCache(profile, observer, APP_EPOCH_MS);
  const beamLayoutsByShellId = createBeamLayoutsByShellId(profile);
  const hoManager = new HandoverManager(profile.handover);
  const secondaryHoManagers = Array.from(
    { length: UE_COUNT - 1 },
    () => new HandoverManager(profile.handover),
  );
  const state = createRuntimeFrameStepState(0);
  const replay = { epochUtcMs: APP_EPOCH_MS, startOffsetSec: 0, loop: false, windowLengthSec: 7200 };

  const captures: StepCapture[] = [];
  for (let step = 0; step < STEP_COUNT; step += 1) {
    const frame = stepRuntimeFrame({
      profile,
      replay,
      speed: 1,
      paused: step === 0,
      deltaSec: step === 0 ? 0 : STEP_SEC,
      // S3-1: inject the display-latch clock; the step must NOT read performance.now itself.
      nowMs: nowBaseMs + step * NOW_TICK_MS,
      observer,
      beamLayoutsByShellId,
      trajectoryCache,
      hoManager,
      state,
      ueCount: UE_COUNT,
      secondaryHoManagers,
      uePrimaryAnchorMode: 'observer',
    }).frame;

    captures.push({
      truth: {
        serving: { satId: frame.serving.satId, beamId: frame.serving.beamId, sinrDb: frame.serving.sinrDb },
        pendingTargetSatId: frame.pendingTargetSatId,
        pendingTargetBeamId: frame.pendingTargetBeamId,
        hoCount: frame.hoCount,
        perUeServing: frame.perUePositions
          .filter(ue => ue.servingSatId !== null && ue.servingBeamId !== null)
          .map(ue => `${ue.id}>${ue.servingSatId}:${ue.servingBeamId}`)
          .sort(),
      },
      latch: {
        intraStart: frame.intraHandoverWallClockStartMs,
        intraExpires: frame.intraHandoverWallClockExpiresMs,
        interStart: frame.interHandoverWallClockStartMs,
        interExpires: frame.interHandoverWallClockExpiresMs,
      },
    });
  }
  return captures;
}

// ── (1) PURITY: two runs, identical injected nowMs, NO clock patch → byte-identical ──
const runA1 = captureRun(NOW_BASE_A_MS);
const runA2 = captureRun(NOW_BASE_A_MS);
assert.deepStrictEqual(
  runA2,
  runA1,
  'PURITY FAILED: two runs with identical injected nowMs (and NO performance.now/Date.now patch) '
    + 'diverged — stepRuntimeFrame still reads an ambient wall clock somewhere on the truth/display path',
);

// ── (2) NON-VACUOUS: a latch was stamped, serving holds, a handover fired ──
const latchSteps = runA1.filter(s => s.latch.intraStart !== null || s.latch.interStart !== null);
assert.ok(
  latchSteps.length > 0,
  `VACUOUS: no handover viz latch was stamped across ${STEP_COUNT} steps — cannot prove nowMs reaches the display latch`,
);
const servingSteps = runA1.filter(s => s.truth.serving.satId !== null);
assert.ok(
  servingSteps.length > STEP_COUNT / 2,
  `VACUOUS truth: only ${servingSteps.length}/${STEP_COUNT} steps have a serving link`,
);
const finalHoCount = runA1[STEP_COUNT - 1].truth.hoCount;
assert.ok(
  finalHoCount > 0,
  `VACUOUS: hoCount=${finalHoCount} — no handover fired, the latch-stamp path was never exercised`,
);

// ── (3) FLOW / perturbation control: DELTA on nowMs shifts the latch, NOT the truth ──
const runB = captureRun(NOW_BASE_A_MS + DELTA_MS);
for (let i = 0; i < STEP_COUNT; i += 1) {
  assert.deepStrictEqual(
    runB[i].truth,
    runA1[i].truth,
    `nowMs LEAKED INTO TRUTH at step ${i}: a ${DELTA_MS}ms wall-clock offset changed serving/handover truth — `
      + 'the latch clock is not display-isolated',
  );
}
let comparedLatches = 0;
for (let i = 0; i < STEP_COUNT; i += 1) {
  const a = runA1[i].latch;
  const b = runB[i].latch;
  if (a.intraStart !== null && b.intraStart !== null) {
    assert.equal(b.intraStart - a.intraStart, DELTA_MS, `intra latch START did not track injected nowMs at step ${i}`);
    assert.equal(b.intraExpires! - a.intraExpires!, DELTA_MS, `intra latch EXPIRES did not track injected nowMs at step ${i}`);
    comparedLatches += 1;
  }
  if (a.interStart !== null && b.interStart !== null) {
    assert.equal(b.interStart - a.interStart, DELTA_MS, `inter latch START did not track injected nowMs at step ${i}`);
    assert.equal(b.interExpires! - a.interExpires!, DELTA_MS, `inter latch EXPIRES did not track injected nowMs at step ${i}`);
    comparedLatches += 1;
  }
}
assert.ok(
  comparedLatches > 0,
  'VACUOUS flow control: no step had an active latch in both runs to compare the nowMs offset against',
);

console.log(
  `[${GATE}] PASS — purity (no-patch A==B), nowMs⊥truth, latch tracks nowMs by ${DELTA_MS}ms `
    + `(${latchSteps.length} latch-step(s), ${comparedLatches} latch comparison(s), ${servingSteps.length}/${STEP_COUNT} served, hoCount=${finalHoCount})`,
);
