#!/usr/bin/env node
/**
 * G2-WARMSTART gate: prove the optional diagnostic warm-start recipe still
 * produces a real post-guard frame, while the homepage default remains at the
 * exact replay origin (no hidden 1:40–2:10 jump).
 *
 * For the legacy non-multi lane:
 *  A freshly attached `HandoverManager` cannot hand over until its
 *  `pingPongGuardSec` (30s) + TTT (3.5s) elapse. The warm-up runs the REAL model
 *  forward at a demo cold-start (run-through, discarding intermediate frames),
 *  stopping at the first frame that carries a live pulse (recentHandoverEvents > 0).
 *
 * For the multiCandidateDecisionEnabled lane:
 *  The cold-start run-through instead stops at the first REAL HandoverDecisionFrame
 *  that is still pre-selection (selectedTarget null, provisionalLeader null),
 *  phase qualifying, and has hardEligibility eligible pairs from at least TWO
 *  distinct ALTERNATE satellite IDs excluding the serving satellite, preserving the
 *  multi-candidate comparison stage for the user.
 *
 * This gate proves the PHYSICS both warm-ups rely on, deterministically and
 * without a browser:
 *  - POSITIVE CONTROL: cold reseat frames have zero pulses / are pre-qualification;
 *  - PAYOFF (legacy): break-on-pulse publishes a frame with live pulses before the cap;
 *  - PAYOFF (multi-candidate): break-on-multi-sat publishes a qualifying pre-selection
 *    frame with >= 2 distinct alternate eligible satellites around t=98s before the cap;
 *  - STRUCTURAL: `buildRuntimeStateAt` implements both stopping paths correctly,
 *    lane-gated, FIRST-open-latched, wrap-faithful;
 *  - VALUE: warm-up constants match what this gate asserts.
 *
 * Run: `npm run validate:phase-c:warm-start`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { loadProfile } from '../src/profiles/index.ts';
import { createObserverContext } from '../src/engine/orbit';
import { HandoverManager } from '../src/engine/handover/handover-manager';
import { recommendDemoReplayStartOffsetSec } from '../src/scene/replay-recommendation';
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
  resolveSinrLiveSceneCellCount,
} from '../src/scene/sinrLiveCellRuntime';
import {
  isMultiCandidateWarmStartDecisionFrame,
  isMultiCandidateWarmStartFrame,
} from '../src/scene/multiCandidateWarmStart';

const GATE = 'validate:phase-c:warm-start';
const PROFILE_ID = 'hobs-2024-candidate-rich';
const APP_EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const UE_COUNT = 100;
const NOW_MS = 1_000_000;
// Must match useSimulation.ts (asserted by VALUE checks below).
const CAP_SEC = 130;
const STEP_SEC = 2;

let passed = 0;
function ok(cond: boolean, label: string): void {
  if (!cond) throw new Error(`FAIL: ${label}`);
  passed += 1;
}

const profile = loadProfile(PROFILE_ID);
const observer = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
const trajectoryCache = createTrajectoryCache(profile, observer, APP_EPOCH_MS);
const maxTimeSec = getTrajectoryMaxTimeSec(trajectoryCache);
const beamLayoutsByShellId = createBeamLayoutsByShellId(profile);
const demoStartOffset = recommendDemoReplayStartOffsetSec(profile, APP_EPOCH_MS);

function makeManagers() {
  return {
    primary: new HandoverManager(profile.handover),
    secondaries: Array.from({ length: UE_COUNT - 1 }, () => new HandoverManager(profile.handover)),
  };
}
function step(
  state: ReturnType<typeof createRuntimeFrameStepState>,
  managers: ReturnType<typeof makeManagers>,
  paused: boolean,
  dt: number,
) {
  return stepRuntimeFrame({
    profile,
    replay: { epochUtcMs: APP_EPOCH_MS, startOffsetSec: demoStartOffset, loop: true, windowLengthSec: maxTimeSec },
    speed: 1,
    paused,
    deltaSec: paused ? 0 : dt,
    nowMs: NOW_MS,
    observer,
    beamLayoutsByShellId,
    trajectoryCache,
    hoManager: managers.primary,
    secondaryHoManagers: managers.secondaries,
    ueCount: UE_COUNT,
    uePrimaryAnchorMode: 'observer',
    state,
  });
}

// ── BEHAVIOR: Legacy non-multi lane (cold start = dead; warm-up = alive) ──
const model = createSinrLiveCellModel(profile, true, APP_EPOCH_MS);
ok(model !== null, 'cell-truth model exists on the sinr-live lane');

const managers = makeManagers();
const state = createRuntimeFrameStepState(demoStartOffset);
const cold = step(state, managers, true, 0); // the recipe's paused dt=0 reseat
attachSinrLiveCellFrame(cold.frame, model, 0);
const coldEvents = (cold.frame as { sinrLiveCells?: { recentHandoverEvents: readonly unknown[] } }).sinrLiveCells;
ok(coldEvents !== undefined, 'cold reseat attaches the cell truth on the sinr-live lane');
ok(
  coldEvents!.recentHandoverEvents.length === 0,
  `POSITIVE CONTROL: a COLD reseat at the demo start (t=${demoStartOffset}) has ZERO recent handovers — the dead start the warm-up exists to skip`,
);

// Run the legacy warm-up: step the real model forward at STEP_SEC, STOPPING the
// moment the PUBLISHED frame carries a live pulse (break-on-pulse), bounded by CAP_SEC.
let totalFired = 0;
let warmedSec = 0;
let publishedPulseCount = 0;
while (warmedSec < CAP_SEC) {
  const stepSec = Math.min(STEP_SEC, CAP_SEC - warmedSec);
  const warm = step(state, managers, false, stepSec);
  attachSinrLiveCellFrame(warm.frame, model, warm.frame.simTimeSec - warm.previousSimTimeSec);
  const cells = (warm.frame as {
    sinrLiveCells?: { recentHandoverEvents: readonly unknown[]; interHandoverCount: number; intraHandoverCount: number };
  }).sinrLiveCells;
  warmedSec += stepSec;
  if (cells) {
    totalFired += cells.interHandoverCount + cells.intraHandoverCount;
    publishedPulseCount = cells.recentHandoverEvents.length;
    if (cells.recentHandoverEvents.length > 0) break; // break-on-pulse
  }
}

ok(
  publishedPulseCount > 0,
  `PAYOFF (legacy non-multi): the PUBLISHED opening frame carries a live handover pulse (recentHandoverEvents=${publishedPulseCount}) — the demo opens with G2c cones, not a dead gap`,
);
ok(
  warmedSec < CAP_SEC,
  `the legacy break-on-pulse stops BEFORE the cap (warmed ${warmedSec}s < ${CAP_SEC}s cap) — the cap only bounds a quiet window`,
);
ok(
  totalFired > 0,
  `(supporting) warming past the guard fired ${totalFired} handover(s)`,
);
console.log(
  `[${GATE}] legacy cold @${demoStartOffset}s: 0 HO (dead) → break-on-pulse @+${warmedSec}s: `
  + `published-frame pulse events=${publishedPulseCount}, ${totalFired} HO fired to that point`,
);

// ── BEHAVIOR: Multi-candidate lane (stops at first qualifying pre-selection frame with >= 2 alternate eligible sats) ──
const MULTI_CANDIDATE_EPOCH_MS = Date.UTC(2026, 7, 25, 12, 0, 0);
const mcTrajectoryCache = createTrajectoryCache(profile, observer, MULTI_CANDIDATE_EPOCH_MS);
const sceneCellCount = resolveSinrLiveSceneCellCount(profile.beams.perSatellite);
const mcModel = createSinrLiveCellModel(
  profile,
  true,
  MULTI_CANDIDATE_EPOCH_MS,
  {},
  sceneCellCount,
  sceneCellCount,
  false,
  'sampled-steering',
  true,
);
ok(mcModel !== null, 'multi-candidate cell-truth model created');

const mcManagers = makeManagers();
const mcState = createRuntimeFrameStepState(demoStartOffset);

function mcStep(paused: boolean, dt: number) {
  return stepRuntimeFrame({
    profile,
    replay: { epochUtcMs: MULTI_CANDIDATE_EPOCH_MS, startOffsetSec: demoStartOffset, loop: true, windowLengthSec: maxTimeSec },
    speed: 1,
    paused,
    deltaSec: paused ? 0 : dt,
    nowMs: NOW_MS,
    observer,
    beamLayoutsByShellId,
    trajectoryCache: mcTrajectoryCache,
    hoManager: mcManagers.primary,
    secondaryHoManagers: mcManagers.secondaries,
    ueCount: UE_COUNT,
    uePrimaryAnchorMode: 'observer',
    state: mcState,
  });
}

const mcCold = mcStep(true, 0);
attachSinrLiveCellFrame(mcCold.frame, mcModel, 0);
ok(
  !isMultiCandidateWarmStartFrame(mcCold.frame),
  `POSITIVE CONTROL: cold reseat at demo start (t=${demoStartOffset}) is pre-qualification (does not meet multi-candidate warm-start predicate)`,
);

let mcWarmedSec = 0;
let mcPublishedFrame = mcCold.frame;
while (mcWarmedSec < CAP_SEC) {
  const stepSec = Math.min(STEP_SEC, CAP_SEC - mcWarmedSec);
  const warm = mcStep(false, stepSec);
  attachSinrLiveCellFrame(warm.frame, mcModel, warm.frame.simTimeSec - warm.previousSimTimeSec);
  mcPublishedFrame = warm.frame;
  mcWarmedSec += stepSec;
  if (isMultiCandidateWarmStartFrame(warm.frame)) break;
}

ok(
  isMultiCandidateWarmStartFrame(mcPublishedFrame),
  'PAYOFF (multi-candidate): the PUBLISHED multi-candidate opening frame satisfies isMultiCandidateWarmStartFrame',
);
ok(
  mcWarmedSec < CAP_SEC,
  `multi-candidate warm-start stops BEFORE the cap (warmed ${mcWarmedSec}s < ${CAP_SEC}s cap)`,
);
const mcDecision = mcPublishedFrame.handoverDecisionFrame!;
ok(mcDecision !== null && mcDecision !== undefined, 'multi-candidate opening frame has handoverDecisionFrame');
ok(mcDecision.phase === 'qualifying', `decision frame phase is qualifying (got ${mcDecision.phase})`);
ok(mcDecision.selectedTarget === null, 'decision frame selectedTarget is null (pre-selection)');
ok(mcDecision.provisionalLeader === null, 'decision frame provisionalLeader is null (pre-selection)');

const mcServingSat = mcDecision.serving?.satelliteId ?? null;
const mcEligibleAltSats = new Set(
  mcDecision.states
    .filter(s => s.hardEligibility === 'eligible')
    .map(s => s.key.satelliteId)
    .filter(id => mcServingSat === null || id !== mcServingSat),
);
ok(
  mcEligibleAltSats.size >= 2,
  `decision frame has hardEligibility eligible pairs from >=2 distinct alternate sats (got ${Array.from(mcEligibleAltSats).join(', ')})`,
);
console.log(
  `[${GATE}] multi-candidate @${demoStartOffset}s → break-on-multi-sat @+${mcWarmedSec}s: `
  + `phase=${mcDecision.phase}, eligibleAltSats=${Array.from(mcEligibleAltSats).join(',')}`,
);

// ── STRUCTURAL: the live recipe runs the warm-up — lane-gated, FIRST-open-latched,
//    break-on-pulse for legacy, break-on-multi-sat for multiCandidateDecisionEnabled ──
const useSimSrc = readFileSync(new URL('../src/scene/useSimulation.ts', import.meta.url), 'utf8');
ok(
  useSimSrc.includes('const warmupCapSec = resolveInitialReplayWarmupSec({'),
  'STRUCTURAL: the warm-up duration is resolved by the single replay-start policy boundary',
);
ok(
  useSimSrc.includes('cellTruthAvailable: sinrLiveCellModel !== null,')
    && useSimSrc.includes('enabled: SINR_LIVE_INITIAL_WARMUP_ENABLED,')
    && useSimSrc.includes('alreadyWarmed: hasWarmedOnceRef.current,'),
  'STRUCTURAL: the warm-up policy is lane-gated, explicitly opted-in, and latched to the first warm',
);
ok(
  useSimSrc.includes('hasWarmedOnceRef.current = true;'),
  'STRUCTURAL: the first-warm latch is set so later cold-starts (handover/signal reset, profile switch) do not re-warm',
);
ok(
  useSimSrc.includes('const stopOnFirstPulse = warmupCapSec > 0 && !multiCandidateDecisionEnabled;'),
  'STRUCTURAL: stopOnFirstPulse is gated to legacy non-multi lane warm-up',
);
ok(
  useSimSrc.includes('const stopOnMultiCandidateWarmStart = warmupCapSec > 0 && multiCandidateDecisionEnabled;'),
  'STRUCTURAL: stopOnMultiCandidateWarmStart is gated to multiCandidateDecisionEnabled warm-up',
);
ok(
  useSimSrc.includes('if (stopOnFirstPulse && (warm.frame.sinrLiveCells?.recentHandoverEvents.length ?? 0) > 0) break;'),
  'STRUCTURAL: legacy lane stops on first live pulse',
);
ok(
  useSimSrc.includes('if (stopOnMultiCandidateWarmStart && isMultiCandidateWarmStartFrame(warm.frame)) break;'),
  'STRUCTURAL: multi-candidate lane stops on first multi-candidate comparison frame',
);
ok(
  useSimSrc.includes('const runThroughStepSec = warmupCapSec > 0 ? SINR_LIVE_WARMUP_STEP_SEC : settle.stepSec;'),
  'STRUCTURAL: the warm-up keeps its own coarse grain when it owns the run-through',
);
ok(
  useSimSrc.includes('sinrLiveCellModel?.rebase((warm.frame.simTimeSec - warm.previousSimTimeSec) * 1000);'),
  'STRUCTURAL: the warm-up mirrors the play loop\'s didLoopWrap cell-model rebase (wrap-faithful)',
);
ok(
  useSimSrc.includes('warmupSec: options?.timeShift || !SINR_LIVE_INITIAL_WARMUP_ENABLED')
    && useSimSrc.includes(': SINR_LIVE_WARMUP_CAP_SEC,'),
  'STRUCTURAL: a wrap and the default homepage cold-start publish at the origin; only explicit opt-in uses the cap',
);
ok(
  useSimSrc.includes("buildRuntimeStateAt({ toSec: targetSec, intent: 'seek' });"),
  'STRUCTURAL: seekToTimelineFrame stays a plain seek (no warm-up cap)',
);

// ── VALUE: the warm-up constants this gate asserts match the source ──
ok(
  useSimSrc.includes(`const SINR_LIVE_WARMUP_CAP_SEC = ${CAP_SEC};`),
  `VALUE: SINR_LIVE_WARMUP_CAP_SEC is ${CAP_SEC}`,
);
ok(
  useSimSrc.includes(`const SINR_LIVE_WARMUP_STEP_SEC = ${STEP_SEC};`),
  `VALUE: SINR_LIVE_WARMUP_STEP_SEC is ${STEP_SEC}`,
);

console.log(`[${GATE}] PASS — ${passed} checks (diagnostic warm-start is bounded; homepage cold-start stays at replay origin)`);
