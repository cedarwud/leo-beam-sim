#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { E1ArmId, E2Action, IdeaCard } from './contract';
import { C90_FIXTURE_PROVIDER } from './fixtures/e1-fixture';
import {
  advanceE1Frame,
  advanceE2Frame,
  advanceTleStage,
  buildLearningBundleInput,
  completeCourse,
  courseSessionExportReadiness,
  courseSessionReadiness,
  courseSessionStorageKey,
  createInitialCourseSession,
  finishE1Arm,
  freezeE2Rule,
  markReadyCheckComplete,
  selectE2Action,
  setE1CheckpointUpdate,
  setE1Decision,
  setE1Prediction,
  setE2Decision,
  setE2Trace,
  setE2TraceAction,
  setIdeaCardField,
  setIoTRecord,
  setIoTVersion,
  setTleExplanation,
  setTleSourceSelection,
  setTleTimelineIndex,
  setTleWindowSelection,
  restoreCourseSession,
  serializeCourseSession,
  startCompetition,
  startE1Arm,
  startE2,
  startIoT,
  type CourseSessionState,
} from './session';

const provider = C90_FIXTURE_PROVIDER;

function advanceE1ArmToEnd(state: CourseSessionState, armId: E1ArmId): CourseSessionState {
  const arm = provider.getE1Experiment().arms.find(candidate => candidate.id === armId);
  assert.ok(arm);
  let next = startE1Arm(state, armId);
  for (let index = 1; index < arm.frames.length; index += 1) {
    next = advanceE1Frame(next, arm.frames.length);
  }
  return next;
}

function advanceE2ActionToEnd(state: CourseSessionState, action: E2Action): CourseSessionState {
  const trace = state.e2TraceId === 'trace-a' ? provider.getE2Experiment().traceA : provider.getE2Experiment().traceB;
  const branch = trace.branches.find(candidate => candidate.action === action);
  assert.ok(branch);
  let next = selectE2Action(state, action);
  for (let index = 1; index < branch.frames.length; index += 1) {
    next = advanceE2Frame(next, branch.frames.length);
  }
  return setE2TraceAction(next, action);
}

function reachTleEnd(resetOrdinal = 0): CourseSessionState {
  let state = createInitialCourseSession(provider.getManifest(), resetOrdinal);
  state = markReadyCheckComplete(state);
  state = setTleSourceSelection(state, provider.getTleJourney().courseSourceId, 'bundled');
  state = setTleExplanation(state, 'TLE gives source elements; the program derives position; the course adds policy.');
  const stageCount = provider.getTleJourney().stages.length;
  for (let index = 0; index < stageCount; index += 1) {
    state = advanceTleStage(state, stageCount, true);
  }
  return state;
}

function reachE1Decision(resetOrdinal = 0): CourseSessionState {
  let state = reachTleEnd(resetOrdinal);
  state = setE1Prediction(state, 'fast-finish first, then compare service against total energy');
  for (const arm of provider.getE1Experiment().arms) {
    state = advanceE1ArmToEnd(state, arm.id);
    if (!state.e1CheckpointCaptured) {
      state = setE1CheckpointUpdate(state, 'The first observed frame changed my W/rate/time expectation.');
    }
    state = finishE1Arm(state, arm.id);
  }
  return setE1Decision(state, 'balanced', 'qualify', 'The service constraint and total energy must be read together.');
}

function reachE2Decision(resetOrdinal = 0): CourseSessionState {
  let state = reachE1Decision(resetOrdinal);
  state = startE2(state);
  state = { ...state, e2Prediction: 'wait first, then compare the future trend before switching' };
  state = advanceE2ActionToEnd(state, 'wait');
  state = advanceE2ActionToEnd(state, 'switch-now');
  state = setE2Decision(state, 'switch only after stable improvement', null, '');
  state = freezeE2Rule(state);
  state = setE2Trace(state, 'trace-b');
  state = advanceE2ActionToEnd(state, 'remain');
  return setE2Decision(state, state.e2FrozenRule, 'qualify', 'Trace B changes the trend, so the rule is conditional.');
}

function completeLearnerPath(resetOrdinal = 0): CourseSessionState {
  let state = reachE2Decision(resetOrdinal);
  state = startIoT(state);
  state = { ...state, iotPrediction: 'protect alarm freshness while batching routine work' };
  const runs = provider.getIoTChallenge().runs;
  state = setIoTVersion(state, 'baseline');
  state = setIoTRecord(state, state.iotPrediction, runs[0].rule, '', null, '');
  state = setIoTVersion(state, 'learner');
  state = setIoTRecord(state, state.iotPrediction, runs[1].rule, 'promote urgent tasks and batch routine work', null, '');
  state = setIoTVersion(state, 'revision');
  state = setIoTRecord(state, state.iotPrediction, runs[2].rule, 'protect alarm freshness and batch routine work', 'accept', 'Freshness improved without hiding the energy trade-off.');
  state = startCompetition(state);

  const ideaCard: IdeaCard = {
    sensedData: 'task arrivals',
    stateToPredict: 'freshness risk',
    baseline: 'all tasks treated alike',
    controlAction: 'priority and batching rule',
    powerTimePathway: 'less active time for routine data',
    energyIndicator: 'energyJ',
    serviceConstraint: 'alarm freshness',
    falsifier: 'same freshness with higher energy',
  };
  for (const field of Object.keys(ideaCard) as (keyof IdeaCard)[]) {
    state = setIdeaCardField(state, field, ideaCard[field]);
  }
  return completeCourse(state);
}

test('complete learner path records Phase-1 evidence and reaches export readiness', () => {
  const state = completeLearnerPath();
  const readiness = courseSessionReadiness(state, provider);
  const exportReadiness = courseSessionExportReadiness(state, provider);

  assert.equal(state.activeStage, 'complete');
  assert.equal(state.readyCheckCompleted, true);
  assert.equal(state.tleCompleted, true);
  assert.equal(state.e1CheckpointCaptured, true);
  assert.deepEqual([...state.e1CompletedArmIds].sort(), ['balanced', 'fast-finish', 'low-power']);
  assert.equal(state.e2TraceACompleted, true);
  assert.equal(state.e2TraceAReplayCompleted, true);
  assert.equal(state.e2TraceBCompleted, true);
  assert.deepEqual(state.iotObservedVersions, ['baseline', 'learner', 'revision']);
  assert.equal(readiness.ready, true);
  assert.equal(exportReadiness.ready, true);

  const input = buildLearningBundleInput(state, provider);
  assert.equal(input.sessionId, state.sessionId);
  assert.equal(input.tle.selectedSourceId, provider.getTleJourney().courseSourceId);
  assert.equal(input.e1.completedArmIds.length, 3);
  assert.equal(input.e2.traceAAction, 'wait');
  assert.equal(input.e2.traceAReplayAction, 'switch-now');
  assert.equal(input.e2.traceBAction, 'remain');
  assert.equal(input.iot.revisedRule, 'protect alarm freshness and batch routine work');
  assert.equal(input.ideaCard.falsifier, state.ideaCard.falsifier);
});

test('reset/replay is deterministic and does not retain prior session state', () => {
  const replayA = completeLearnerPath(7);
  const replayB = completeLearnerPath(7);
  assert.deepEqual(replayA, replayB);

  const reset = createInitialCourseSession(provider.getManifest(), 8);
  assert.equal(reset.activeStage, 'ready');
  assert.equal(reset.e1ActiveArmId, null);
  assert.deepEqual(reset.e1CompletedArmIds, []);
  assert.deepEqual(reset.iotObservedVersions, ['baseline']);
  assert.deepEqual(reset.ideaCard, {
    sensedData: '',
    stateToPredict: '',
    baseline: '',
    controlAction: '',
    powerTimePathway: '',
    energyIndicator: '',
    serviceConstraint: '',
    falsifier: '',
  });
  assert.deepEqual(reset, createInitialCourseSession(provider.getManifest(), 8));
});

test('local checkpoint persistence restores the same provider-bound session and rejects mismatches', () => {
  const state = reachE1Decision(11);
  const manifest = provider.getManifest();
  const serialized = serializeCourseSession(manifest, state);

  assert.match(courseSessionStorageKey(manifest), /^c90-session-v2:C-90-ENERGY-1:/);
  assert.deepEqual(restoreCourseSession(manifest, serialized), state);
  assert.equal(restoreCourseSession(manifest, serialized.replace(manifest.providerId, 'other-provider')), null);
  assert.equal(restoreCourseSession(manifest, '{not-json'), null);
});

test('incomplete export and out-of-order transitions fail closed', () => {
  const initial = createInitialCourseSession(provider.getManifest());
  assert.strictEqual(advanceTleStage(initial, provider.getTleJourney().stages.length, false), initial);
  assert.strictEqual(startE2(initial), initial);

  const readiness = courseSessionExportReadiness(initial, provider);
  assert.equal(readiness.ready, false);
  assert.match(readiness.reasons.join('\n'), /ready check/);
  assert.throws(() => buildLearningBundleInput(initial, provider), /learning bundle export blocked/);
});

test('TLE selection, window replay, import provenance, and fallback remain explicit', () => {
  const journey = provider.getTleJourney();
  const comparison = journey.sources.find(source => source.role === 'teaching-comparison');
  assert.ok(comparison);
  let state = markReadyCheckComplete(createInitialCourseSession(provider.getManifest()));

  state = setTleSourceSelection(state, comparison.sourceId, 'imported', 'student-download.tle');
  state = setTleWindowSelection(state, 'context-30m');
  state = setTleTimelineIndex(state, 12, 61);
  assert.equal(state.tleSourceConfirmed, true);
  assert.equal(state.tleSourceMode, 'imported');
  assert.equal(state.tleImportedFilename, 'student-download.tle');
  assert.equal(state.tleTimelineIndex, 12);
  assert.equal(courseSessionReadiness(state, provider).reasons.some(reason => reason.includes('E1 scenario identity')), true);

  state = setTleSourceSelection(state, journey.courseSourceId, 'fallback');
  assert.equal(state.tleFallbackUsed, true);
  assert.equal(state.tleImportedFilename, null);
  assert.equal(state.tleSelectedSourceId, journey.courseSourceId);
});

test('E2 Trace A replay, frozen rule, and withheld Trace B stay branch-separated', () => {
  let state = reachE1Decision();
  state = startE2(state);
  state = { ...state, e2Prediction: 'wait until the trend is stable' };

  state = advanceE2ActionToEnd(state, 'wait');
  assert.equal(state.e2TraceAAction, 'wait');
  assert.strictEqual(setE2Trace(state, 'trace-b'), state);
  const blockedTraceB = { ...state, e2TraceId: 'trace-b' as const };
  assert.strictEqual(selectE2Action(blockedTraceB, 'remain'), blockedTraceB);

  const sameActionReplayAttempt = advanceE2ActionToEnd(state, 'wait');
  assert.deepEqual(sameActionReplayAttempt, state);
  state = advanceE2ActionToEnd(state, 'switch-now');
  state = setE2Decision(state, 'switch only after stable improvement', null, '');
  state = freezeE2Rule(state);
  state = setE2Trace(state, 'trace-b');
  state = advanceE2ActionToEnd(state, 'remain');

  assert.equal(state.e2TraceAAction, 'wait');
  assert.equal(state.e2TraceAReplayAction, 'switch-now');
  assert.equal(state.e2TraceBAction, 'remain');
  assert.equal(state.e2FrozenRule, 'switch only after stable improvement');
  assert.equal(state.e2RuleFrozen, true);
  assert.notEqual(state.e2TraceAReplayAction, state.e2TraceBAction);
});
