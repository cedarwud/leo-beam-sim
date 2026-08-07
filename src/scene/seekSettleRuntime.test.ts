/**
 * Seek-landing regression: the frame a timeline SEEK lands on must carry real
 * secondary-handover state.
 *
 * This is deliberately NOT a selector-source test (otherHandoverUeSelector.test.ts
 * already covers the projection, and it passed throughout the bug). It reproduces
 * the hook's seek recipe end to end — plan the settle from the profile, reseat a
 * fresh RuntimeFrameStepState at the planned offset, render the paused dt=0 frame,
 * run the real model through to the landing — and then asserts what the renderer
 * actually receives: the selected/cue ids AND the resulting displayed UE list.
 *
 * The `SEEK-BUG` case pins the regression itself: the pre-fix recipe (reseat AT the
 * landing, one paused dt=0 step) is run against the same sim-time and must produce
 * zero — so a future change that silently drops the settle fails here instead of
 * quietly restoring an empty checkbox.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createObserverContext } from '../engine/orbit';
import { HandoverManager } from '../engine/handover/handover-manager';
import { loadProfile } from '../profiles';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  stepRuntimeFrame,
} from './runtimeFrameStep';
import { planSeekSettle, SEEK_SETTLE_MAX_STEP_SEC } from './seekSettle';
import {
  filterOtherHandoverDisplayUes,
  selectOtherHandoverUeIds,
} from './otherHandoverUeSelector';

const PROFILE_ID = 'hobs-2024-candidate-rich';
const APP_EPOCH_MS = Date.UTC(2026, 0, 1);
const UE_COUNT = 100;
// The scene cap the live lane passes in (NTPU_SCENE_CONFIG.maxOtherHandoverUes).
const MAX_OTHER_HANDOVER_UES = 6;
// demoStartOffsetSec 450 + T+110 — the acceptance landing, a sim-time where the
// candidate-rich geometry genuinely has a concurrent secondary handover wave.
const HANDOVER_LANDING_SEC = 560;
// A landing in the same demo window with no concurrent secondary handover, used to
// pin that a quiet frame keeps the whole UE population on screen.
const QUIET_LANDING_SEC = 600;

const profile = loadProfile(PROFILE_ID);
const observer = createObserverContext(
  profile.orbit.observerLatDeg,
  profile.orbit.observerLonDeg,
);
const replay = {
  epochUtcMs: APP_EPOCH_MS,
  startOffsetSec: 450,
  loop: true,
  windowLengthSec: 7200,
};
const trajectoryCache = createTrajectoryCache(profile, observer, APP_EPOCH_MS);
const beamLayoutsByShellId = createBeamLayoutsByShellId(profile);

/** The hook's seek recipe: reseat at the planned offset, then run through to T. */
function landSeekAt(landingSec: number, options: { settle: boolean }) {
  const plan = options.settle
    ? planSeekSettle(profile.handover, landingSec)
    : { settleSec: 0, stepSec: SEEK_SETTLE_MAX_STEP_SEC, reseatOffsetSec: landingSec };
  const hoManager = new HandoverManager(profile.handover);
  const secondaryHoManagers = Array.from(
    { length: UE_COUNT - 1 },
    () => new HandoverManager(profile.handover),
  );
  const state = createRuntimeFrameStepState(plan.reseatOffsetSec);
  const stepAt = (paused: boolean, deltaSec: number) => stepRuntimeFrame({
    profile,
    replay,
    speed: 1,
    paused,
    deltaSec,
    observer,
    beamLayoutsByShellId,
    trajectoryCache,
    hoManager,
    secondaryHoManagers,
    state,
    ueCount: UE_COUNT,
    uePrimaryAnchorMode: 'observer',
  });

  let output = stepAt(true, 0);
  let ranSec = 0;
  while (plan.settleSec - ranSec > 1e-9) {
    const stepSec = Math.min(plan.stepSec, plan.settleSec - ranSec);
    output = stepAt(false, stepSec);
    ranSec += stepSec;
  }

  const ues = output.frame.perUePositions;
  const primaryUeId = ues[0]?.id;
  const selectedIds = selectOtherHandoverUeIds({
    ues,
    primaryUeId,
    triggerTimeSec: profile.handover.triggerTimeSec,
    maxOtherHandoverUes: MAX_OTHER_HANDOVER_UES,
  });
  const selected = new Set(selectedIds);
  return {
    plan,
    simTimeSec: output.frame.simTimeSec,
    primaryUeId,
    selectedIds,
    pendingUeCount: ues.filter(ue => ue.pendingTargetSatId !== null).length,
    // Checkbox ON — what GroundScene is handed.
    renderedWithFilter: filterOtherHandoverDisplayUes(ues, primaryUeId, selected).length,
    // Checkbox OFF — the unfiltered population.
    renderedWithoutFilter: ues.length,
  };
}

test('SEEK-LANDING: a settled seek lands on real concurrent secondary handovers', () => {
  const landed = landSeekAt(HANDOVER_LANDING_SEC, { settle: true });

  assert.ok(
    landed.plan.settleSec > 0,
    'the seek plan must settle before the landing',
  );
  assert.ok(
    Math.abs(landed.simTimeSec - HANDOVER_LANDING_SEC) < 1e-6,
    `the settle must land EXACTLY on the requested sim-time, got ${landed.simTimeSec}`,
  );
  assert.ok(
    landed.pendingUeCount > 0,
    'the landed frame carries UEs with a live pending target',
  );
  assert.ok(
    landed.selectedIds.length > 0,
    'the landed frame yields a non-empty secondary-handover selection',
  );
  assert.ok(
    landed.selectedIds.length <= MAX_OTHER_HANDOVER_UES,
    'the selection honours the scene cap',
  );
  assert.ok(
    landed.selectedIds.every(id => id !== landed.primaryUeId),
    'the primary UE is never selected as an "other" handover UE',
  );
  // Requirement: with the checkbox on, the canvas shows the primary + the selected
  // secondaries — not the whole 100-UE population.
  assert.equal(
    landed.renderedWithFilter,
    1 + landed.selectedIds.length,
    'the filtered render list is the primary plus the selected secondaries',
  );
  assert.equal(
    landed.renderedWithoutFilter,
    UE_COUNT,
    'the unfiltered (checkbox off) render list keeps the full population',
  );
});

test('SEEK-BUG: the pre-fix landing (reseat at T, one paused dt=0 step) selects nothing', () => {
  const landed = landSeekAt(HANDOVER_LANDING_SEC, { settle: false });

  assert.equal(landed.plan.settleSec, 0, 'the pre-fix arm runs with no settle');
  assert.equal(
    landed.pendingUeCount,
    0,
    'the dt=0 landing cannot produce a pending target (fresh ping-pong guard, no TTT)',
  );
  assert.equal(
    landed.selectedIds.length,
    0,
    'the dt=0 landing selects nothing — this is the bug the settle fixes',
  );
});

test('SEEK-LANDING: a quiet landing keeps the whole UE population on screen', () => {
  const landed = landSeekAt(QUIET_LANDING_SEC, { settle: true });

  assert.equal(
    landed.selectedIds.length,
    0,
    `vacuous: ${QUIET_LANDING_SEC}s is meant to be a no-secondary-handover landing`,
  );
  // "No concurrent handover right now" must never read as "hide every UE".
  assert.equal(
    landed.renderedWithFilter,
    UE_COUNT,
    'an empty selection leaves the full UE population visible',
  );
});

test('the one-reset recipe wires the settle into the seek intent only', () => {
  const useSimSrc = readFileSync(new URL('./useSimulation.ts', import.meta.url), 'utf8');

  assert.ok(
    useSimSrc.includes("import { planSeekSettle, SEEK_SETTLE_MAX_STEP_SEC } from './seekSettle';"),
    'useSimulation must consume the shared settle planner',
  );
  assert.ok(
    /const settle = params\.intent === 'seek'\s*\?\s*planSeekSettle\(profile\.handover, landingOffset\)/.test(useSimSrc),
    'the recipe must plan the settle from the profile handover config on a seek',
  );
  assert.ok(
    useSimSrc.includes('const targetOffset = settle.reseatOffsetSec;'),
    'the reseat must happen at the planned offset, not at the raw landing',
  );
  assert.ok(
    useSimSrc.includes('const runThroughSec = warmupCapSec > 0 ? warmupCapSec : settle.settleSec;'),
    'the run-through loop must advance the settle window when there is no warm-up cap',
  );
  // cold-start / wrap keep their existing dt=0 reseat semantics.
  assert.ok(
    useSimSrc.includes("{ settleSec: 0, stepSec: SEEK_SETTLE_MAX_STEP_SEC, reseatOffsetSec: landingOffset }"),
    'a non-seek intent must plan no settle (cold-start / wrap semantics unchanged)',
  );
});

test('planSeekSettle derives its window and grain from the profile', () => {
  const plan = planSeekSettle(profile.handover, HANDOVER_LANDING_SEC);

  assert.ok(
    plan.settleSec >= profile.handover.pingPongGuardSec + profile.handover.triggerTimeSec,
    'the window covers the ping-pong guard plus at least one trigger time',
  );
  assert.ok(
    plan.stepSec < profile.handover.triggerTimeSec,
    'the grain stays under one TTT so a pending target can be observed mid-accumulation',
  );
  assert.ok(plan.stepSec <= SEEK_SETTLE_MAX_STEP_SEC, 'the grain honours the coarse-step bound');
  assert.equal(
    plan.reseatOffsetSec,
    HANDOVER_LANDING_SEC - plan.settleSec,
    'the reseat sits one settle window before the landing',
  );

  // Near the start of the trajectory the window clamps instead of reseating at a
  // negative sim-time.
  const early = planSeekSettle(profile.handover, 4);
  assert.equal(early.reseatOffsetSec, 0, 'an early landing reseats at t=0');
  assert.equal(early.settleSec, 4, 'an early landing settles only over the available time');

  const atZero = planSeekSettle(profile.handover, 0);
  assert.equal(atZero.settleSec, 0, 'a landing at t=0 has nothing to settle over');
  assert.equal(atZero.reseatOffsetSec, 0, 'a landing at t=0 reseats at t=0');

  // A degenerate profile must not produce a NaN/negative reseat.
  const degenerate = planSeekSettle({ pingPongGuardSec: Number.NaN, triggerTimeSec: 0 }, 100);
  assert.equal(degenerate.settleSec, 0, 'a degenerate handover config plans no settle');
  assert.equal(degenerate.reseatOffsetSec, 100, 'a degenerate config still reseats at the landing');
  assert.equal(degenerate.stepSec, SEEK_SETTLE_MAX_STEP_SEC, 'a degenerate config falls back to the coarse grain');
});
