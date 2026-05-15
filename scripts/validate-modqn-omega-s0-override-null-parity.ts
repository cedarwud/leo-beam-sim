/**
 * Slice S0 — `HandoverManager` decisionOverride null-parity validator.
 *
 * SDD: `docs/modqn-omega-handover-sdd.md` §5.3 (override hook contract) and
 * §9.1 (S0 acceptance: ≥1000 simulated decision steps from the
 * `hobs-2024-candidate-rich` profile must yield identical engine state when
 * the override returns `null`).
 *
 * Strategy
 * --------
 * Two parallel deterministic frame-step runners share the exact same inputs
 * (profile, replay window, observer, beam layouts, trajectory cache, dt).
 * Each runner owns its own `HandoverManager` instance and `RuntimeFrameStepState`:
 *   - Runner A: stock manager. `stepRuntimeFrame` calls `update(c, dt, t)`.
 *   - Runner B: identical manager whose `update` is wrapped so the engine's
 *     internal call site delegates to `update(c, dt, t, () => null)`.
 *
 * Because `stepRuntimeFrame` does not yet thread an override through, we
 * monkey-patch `manager.update` on the B-runner only. This keeps the scope
 * of S0 to (i) the new optional parameter on `HandoverManager.update` and
 * (ii) this single test file.
 *
 * Parity assertions per tick:
 *   - serving.satId, serving.beamId equal
 *   - serving.sinrDb equal (Number.isNaN comparison-aware)
 *   - serving.pendingTarget structural equality
 *   - eventLog length equal
 *
 * After the run we additionally compare the full event logs deeply.
 */

import assert from 'node:assert/strict';
import { createObserverContext } from '../src/engine/orbit/index.ts';
import {
  HandoverManager,
  type HandoverDecisionOverride,
} from '../src/engine/handover/handover-manager.ts';
import type { HandoverEvent, ServingState } from '../src/engine/handover/types.ts';
import { loadProfile } from '../src/profiles/index.ts';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  stepRuntimeFrame,
  type RuntimeFrameStepState,
} from '../src/scene/runtimeFrameStep.ts';
import { normalizeReplayOffset, type CachedSatState, type ShellBeamLayout } from '../src/scene/simulationHelpers.ts';

const PROFILE_ID = 'hobs-2024-candidate-rich';
const EPOCH_UTC_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
// Replay window pinned to the same start offset used by the phase6P baseline
// fixture (`scripts/validate-modqn-phase6p-hobs-sinr-kpi-baseline.ts`) so the
// candidate stream visits the same orbital region. The phase6P fixture stops
// at 60 frames; S0 runs 1100 frames (≥1000 required by SDD §9.1).
const START_OFFSET_SEC = 450;
const FRAME_DT_SEC = 0.2;
const SPEED = 5;
const FRAME_COUNT = 1100;
const LOOP = true;
const PAUSED = false;

interface RunnerInputs {
  profile: ReturnType<typeof loadProfile>;
  observer: ReturnType<typeof createObserverContext>;
  beamLayoutsByShellId: Map<string, ShellBeamLayout>;
  trajectoryCache: readonly CachedSatState[][];
  maxTimeSec: number;
  replay: { epochUtcMs: number; startOffsetSec: number; loop: boolean };
}

interface ManagerRunner {
  hoManager: HandoverManager;
  state: RuntimeFrameStepState;
}

interface PerTickSnapshot {
  frame: number;
  simTimeSec: number;
  servingSatId: string | null;
  servingBeamId: number | null;
  servingSinrDb: number;
  pendingTargetSatId: string | null;
  pendingTargetBeamId: number | null;
  triggerTimeSec: number;
  eventLogLen: number;
  decisionCount: number;
}

function buildSharedInputs(): RunnerInputs {
  const profile = loadProfile(PROFILE_ID);
  const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
  const beamLayoutsByShellId = createBeamLayoutsByShellId(profile);
  const trajectoryCache = createTrajectoryCache(profile, observer, EPOCH_UTC_MS);
  const maxTimeSec = getTrajectoryMaxTimeSec(trajectoryCache);
  return {
    profile,
    observer,
    beamLayoutsByShellId,
    trajectoryCache,
    maxTimeSec,
    replay: { epochUtcMs: EPOCH_UTC_MS, startOffsetSec: START_OFFSET_SEC, loop: LOOP },
  };
}

function createRunner(inputs: RunnerInputs): ManagerRunner {
  const simTimeSec = normalizeReplayOffset(START_OFFSET_SEC, inputs.maxTimeSec, LOOP);
  return {
    hoManager: new HandoverManager(inputs.profile.handover),
    state: createRuntimeFrameStepState(simTimeSec),
  };
}

/**
 * Wraps `manager.update` so every engine-side call delegates to the 4-arg
 * form with `decisionOverride = () => null`. The override always returns
 * `null` (defer to sinr-offset), which must be byte-equivalent to omitting
 * the override entirely — that is the SDD §9.1 contract under test.
 */
function installNullOverride(manager: HandoverManager): { callCount: () => number } {
  const nullOverride: HandoverDecisionOverride = () => null;
  let calls = 0;
  const original = manager.update.bind(manager);
  // The wrapper must keep the same external signature `stepRuntimeFrame` calls.
  manager.update = ((candidates, dt, simTimeMs) => {
    calls += 1;
    return original(candidates, dt, simTimeMs, nullOverride);
  }) as HandoverManager['update'];
  return { callCount: () => calls };
}

function snapshot(
  frame: number,
  simTimeSec: number,
  state: ServingState,
  eventLogLen: number,
  decisionCount: number,
): PerTickSnapshot {
  return {
    frame,
    simTimeSec,
    servingSatId: state.satId,
    servingBeamId: state.beamId,
    servingSinrDb: state.sinrDb,
    pendingTargetSatId: state.pendingTarget?.satId ?? null,
    pendingTargetBeamId: state.pendingTarget?.beamId ?? null,
    triggerTimeSec: state.triggerTimeSec,
    eventLogLen,
    decisionCount,
  };
}

function eqNumber(a: number, b: number): boolean {
  if (Number.isNaN(a) && Number.isNaN(b)) return true;
  if (!Number.isFinite(a) && !Number.isFinite(b)) return Math.sign(a) === Math.sign(b);
  return a === b;
}

function snapshotsEqual(a: PerTickSnapshot, b: PerTickSnapshot): string | null {
  if (a.servingSatId !== b.servingSatId) return `servingSatId ${a.servingSatId} vs ${b.servingSatId}`;
  if (a.servingBeamId !== b.servingBeamId) return `servingBeamId ${a.servingBeamId} vs ${b.servingBeamId}`;
  if (!eqNumber(a.servingSinrDb, b.servingSinrDb)) {
    return `servingSinrDb ${a.servingSinrDb} vs ${b.servingSinrDb}`;
  }
  if (a.pendingTargetSatId !== b.pendingTargetSatId) {
    return `pendingTargetSatId ${a.pendingTargetSatId} vs ${b.pendingTargetSatId}`;
  }
  if (a.pendingTargetBeamId !== b.pendingTargetBeamId) {
    return `pendingTargetBeamId ${a.pendingTargetBeamId} vs ${b.pendingTargetBeamId}`;
  }
  if (!eqNumber(a.triggerTimeSec, b.triggerTimeSec)) {
    return `triggerTimeSec ${a.triggerTimeSec} vs ${b.triggerTimeSec}`;
  }
  if (a.eventLogLen !== b.eventLogLen) return `eventLogLen ${a.eventLogLen} vs ${b.eventLogLen}`;
  return null;
}

function eventsEqual(a: HandoverEvent, b: HandoverEvent): string | null {
  if (a.timeMs !== b.timeMs) return `timeMs ${a.timeMs} vs ${b.timeMs}`;
  if (a.action !== b.action) return `action ${a.action} vs ${b.action}`;
  if (a.fromSatId !== b.fromSatId) return `fromSatId ${a.fromSatId} vs ${b.fromSatId}`;
  if (a.fromBeamId !== b.fromBeamId) return `fromBeamId ${a.fromBeamId} vs ${b.fromBeamId}`;
  if (a.toSatId !== b.toSatId) return `toSatId ${a.toSatId} vs ${b.toSatId}`;
  if (a.toBeamId !== b.toBeamId) return `toBeamId ${a.toBeamId} vs ${b.toBeamId}`;
  if (!eqNumber(a.toSinrDb, b.toSinrDb)) return `toSinrDb ${a.toSinrDb} vs ${b.toSinrDb}`;
  if (a.fromSinrDb === null && b.fromSinrDb !== null) return 'fromSinrDb null/non-null';
  if (a.fromSinrDb !== null && b.fromSinrDb === null) return 'fromSinrDb non-null/null';
  if (a.fromSinrDb !== null && b.fromSinrDb !== null && !eqNumber(a.fromSinrDb, b.fromSinrDb)) {
    return `fromSinrDb ${a.fromSinrDb} vs ${b.fromSinrDb}`;
  }
  if (a.deltaDb === null && b.deltaDb !== null) return 'deltaDb null/non-null';
  if (a.deltaDb !== null && b.deltaDb === null) return 'deltaDb non-null/null';
  if (a.deltaDb !== null && b.deltaDb !== null && !eqNumber(a.deltaDb, b.deltaDb)) {
    return `deltaDb ${a.deltaDb} vs ${b.deltaDb}`;
  }
  return null;
}

function run(): void {
  const sharedInputs = buildSharedInputs();
  const runnerA = createRunner(sharedInputs); // baseline (no override)
  const runnerB = createRunner(sharedInputs); // null override
  const overrideMeter = installNullOverride(runnerB.hoManager);

  const snapshotsA: PerTickSnapshot[] = [];
  const snapshotsB: PerTickSnapshot[] = [];

  for (let frameIndex = 0; frameIndex < FRAME_COUNT; frameIndex++) {
    const outA = stepRuntimeFrame({
      profile: sharedInputs.profile,
      replay: sharedInputs.replay,
      speed: SPEED,
      paused: PAUSED,
      deltaSec: FRAME_DT_SEC,
      observer: sharedInputs.observer,
      beamLayoutsByShellId: sharedInputs.beamLayoutsByShellId,
      trajectoryCache: sharedInputs.trajectoryCache,
      hoManager: runnerA.hoManager,
      state: runnerA.state,
    });
    const outB = stepRuntimeFrame({
      profile: sharedInputs.profile,
      replay: sharedInputs.replay,
      speed: SPEED,
      paused: PAUSED,
      deltaSec: FRAME_DT_SEC,
      observer: sharedInputs.observer,
      beamLayoutsByShellId: sharedInputs.beamLayoutsByShellId,
      trajectoryCache: sharedInputs.trajectoryCache,
      hoManager: runnerB.hoManager,
      state: runnerB.state,
    });

    snapshotsA.push(
      snapshot(
        frameIndex,
        outA.frame.simTimeSec,
        runnerA.hoManager.state,
        runnerA.hoManager.eventLog.length,
        overrideMeter.callCount(),
      ),
    );
    snapshotsB.push(
      snapshot(
        frameIndex,
        outB.frame.simTimeSec,
        runnerB.hoManager.state,
        runnerB.hoManager.eventLog.length,
        overrideMeter.callCount(),
      ),
    );

    const drift = snapshotsEqual(snapshotsA[frameIndex], snapshotsB[frameIndex]);
    if (drift !== null) {
      throw new Error(
        `Parity drift at frame ${frameIndex} (simTimeSec=${outA.frame.simTimeSec.toFixed(3)}): ${drift}`,
      );
    }
  }

  // Full event-log deep comparison.
  const logA = runnerA.hoManager.eventLog;
  const logB = runnerB.hoManager.eventLog;
  assert.equal(logA.length, logB.length, `eventLog length mismatch: A=${logA.length} B=${logB.length}`);
  for (let i = 0; i < logA.length; i++) {
    const diff = eventsEqual(logA[i], logB[i]);
    if (diff !== null) {
      throw new Error(`Event[${i}] diverged: ${diff}`);
    }
  }

  // Acceptance accounting (SDD §9.1).
  assert.ok(
    FRAME_COUNT >= 1000,
    `frame count ${FRAME_COUNT} below SDD §9.1 minimum of 1000 simulated decision steps`,
  );
  assert.ok(
    overrideMeter.callCount() >= 1000,
    `override was invoked only ${overrideMeter.callCount()} times; need ≥ 1000 to satisfy parity coverage`,
  );

  // Sanity: confirm at least one engine decision actually happened (the
  // override is otherwise vacuously equivalent on empty/no-op sequences).
  assert.ok(
    logA.length > 0,
    `baseline manager produced 0 handover events over ${FRAME_COUNT} frames — candidate stream is degenerate`,
  );

  // Sanity: confirm we exercised more than just "no candidates" branch by
  // requiring the engine to attach (initial inter-handover).
  assert.ok(
    logA[0].action === 'inter-handover' && logA[0].fromSatId === null,
    `expected the first decision to be an initial attach; got action=${logA[0].action} fromSatId=${logA[0].fromSatId}`,
  );

  const summary = {
    schemaVersion: 'modqn-omega-s0-override-null-parity-summary-v1',
    slice: 'S0',
    sdd: 'docs/modqn-omega-handover-sdd.md §5.3 + §9.1',
    profileId: PROFILE_ID,
    replayWindow: {
      epochUtcMs: EPOCH_UTC_MS,
      startOffsetSec: START_OFFSET_SEC,
      frameCount: FRAME_COUNT,
      frameDtSec: FRAME_DT_SEC,
      speed: SPEED,
      simulatedDecisionSteps: overrideMeter.callCount(),
    },
    parity: {
      perTickAssertions: snapshotsA.length,
      eventLogLength: logA.length,
      initialAttachAction: logA[0]?.action ?? null,
      finalServing: {
        satId: runnerA.hoManager.state.satId,
        beamId: runnerA.hoManager.state.beamId,
      },
      finalServingMatch:
        runnerA.hoManager.state.satId === runnerB.hoManager.state.satId
        && runnerA.hoManager.state.beamId === runnerB.hoManager.state.beamId,
      eventCount: {
        baseline: logA.length,
        nullOverride: logB.length,
      },
      eventCountMatch: logA.length === logB.length,
    },
    status: 'PASS' as const,
  };

  console.log(JSON.stringify(summary, null, 2));
}

run();
