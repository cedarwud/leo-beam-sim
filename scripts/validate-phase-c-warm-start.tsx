#!/usr/bin/env node
/**
 * G2-WARMSTART gate: a demo cold-start opens the SINR-live scene WARM (live
 * handovers already firing), not in the ~42s static cold-attach window.
 *
 * A freshly attached `HandoverManager` cannot hand over until its
 * `pingPongGuardSec` (30s) + TTT (3.5s) elapse, so a t=0 cold start shows ZERO
 * handovers — and thus zero live-pulse cones (G2c) — until the guard clears
 * (probe: ~42s at the candidate-rich demo start `demoStartOffsetSec` 450). The
 * warm-up runs the REAL model forward `SINR_LIVE_DEMO_WARMUP_SEC` of sim-time at
 * a demo cold-start (run-through, discarding intermediate frames), so the FIRST
 * published frame is already past the guard.
 *
 * This gate proves the PHYSICS the live warm-up relies on, deterministically and
 * without a browser, by driving the SAME `stepRuntimeFrame` + `attachSinrLiveCellFrame`
 * the recipe runs, with the SAME break-on-pulse stop condition:
 *  - POSITIVE CONTROL (warm-up is NEEDED): the cold reseat frame at the demo start
 *    has ZERO `recentHandoverEvents` (a dead start — no pulses);
 *  - PAYOFF (warm-up WORKS): the break-on-pulse run-through publishes a frame whose
 *    `recentHandoverEvents.length > 0` — the PUBLISHED opening frame the user sees
 *    (not a discarded intermediate) carries a live pulse, so the demo opens WITH G2c
 *    cones — and it stops BEFORE the cap;
 *  - STRUCTURAL: `buildRuntimeStateAt` runs the warm-up lane-gated on the cell model,
 *    latched to the first warm, break-on-pulse, wrap-faithful; mount warms, seek/wrap
 *    do not;
 *  - VALUE: the warm-up constants match what this gate asserts.
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
import { attachSinrLiveCellFrame, createSinrLiveCellModel } from '../src/scene/sinrLiveCellRuntime';

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

// ── BEHAVIOR: cold start = dead (no pulses); warm-up = alive (pulses fire) ──
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

// Run the warm-up exactly as buildRuntimeStateAt does: step the real model forward
// at STEP_SEC, STOPPING the moment the PUBLISHED frame carries a live pulse
// (break-on-pulse), bounded by CAP_SEC. The PUBLISHED frame is the one the user sees
// at open (the recipe discards intermediate frames), so the load-bearing assert is on
// IT, not on aggregate/discarded frames.
let totalFired = 0;
let warmedSec = 0;
let publishedPulseCount = 0; // recentHandoverEvents.length on the frame that gets published
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
    publishedPulseCount = cells.recentHandoverEvents.length; // last assignment = the published frame
    if (cells.recentHandoverEvents.length > 0) break; // break-on-pulse, exactly as the recipe does
  }
}

// LOAD-BEARING: the PUBLISHED opening frame carries a live pulse → the demo opens WITH
// bright G2c pulse cones, not in a between-burst gap. (framesWithLivePulse over
// discarded frames would be a silent weakening — finding #2.)
ok(
  publishedPulseCount > 0,
  `PAYOFF: the PUBLISHED opening frame carries a live handover pulse (recentHandoverEvents=${publishedPulseCount}) — the demo opens with G2c cones, not a dead gap`,
);
ok(
  warmedSec < CAP_SEC,
  `the break-on-pulse stops BEFORE the cap (warmed ${warmedSec}s < ${CAP_SEC}s cap) — the cap only bounds a quiet window`,
);
ok(
  totalFired > 0,
  `(supporting) warming past the guard fired ${totalFired} handover(s)`,
);
console.log(
  `[${GATE}] cold @${demoStartOffset}s: 0 HO (dead) → break-on-pulse @+${warmedSec}s: `
  + `published-frame pulse events=${publishedPulseCount}, ${totalFired} HO fired to that point`,
);

// ── STRUCTURAL: the live recipe runs the warm-up — lane-gated, FIRST-open-latched,
//    break-on-pulse, wrap-faithful, mount-only ──
const useSimSrc = readFileSync(new URL('../src/scene/useSimulation.ts', import.meta.url), 'utf8');
ok(
  useSimSrc.includes('const warmupCapSec = (sinrLiveCellModel && !hasWarmedOnceRef.current) ? (params.warmupSec ?? 0) : 0;'),
  'STRUCTURAL: the warm-up is LANE-GATED on the cell model AND latched to the first warm (no re-freeze on later cold-starts)',
);
ok(
  useSimSrc.includes('hasWarmedOnceRef.current = true;'),
  'STRUCTURAL: the first-warm latch is set so later cold-starts (handover/signal reset, profile switch) do not re-warm',
);
ok(
  useSimSrc.includes('if (stopOnFirstPulse && (warm.frame.sinrLiveCells?.recentHandoverEvents.length ?? 0) > 0) break;'),
  'STRUCTURAL: break-on-pulse — the warm-up stops on the first frame that carries a live pulse (opens on a handover)',
);
// The run-through loop is now shared with the SEEK-SETTLE (a seek reseats one settle
// window early and runs the real model up to its landing). Break-on-pulse must stay
// WARM-UP-ONLY: a settle that stopped early would land short of the sim-time the user
// asked for. `stopOnFirstPulse` is exactly the warm-up predicate.
ok(
  useSimSrc.includes('const stopOnFirstPulse = warmupCapSec > 0;'),
  'STRUCTURAL: break-on-pulse is gated to the warm-up — a seek settle must land exactly on its target',
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
  useSimSrc.includes('warmupSec: options?.timeShift ? 0 : SINR_LIVE_WARMUP_CAP_SEC,'),
  'STRUCTURAL: the cold-start mount path warms (cap); a wrap (window re-loop) does NOT',
);
// seek (timeline scrub) must NOT warm — it passes no cap, so it can never advance
// PAST its target. (It does settle UP TO the target; see src/scene/seekSettle.ts and
// src/scene/seekSettleRuntime.test.ts — a bounded pre-roll, not a warm-up.)
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

console.log(`[${GATE}] PASS — ${passed} checks (cold start dead → warm-up opens the demo with live handovers)`);
