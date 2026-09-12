import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  STUDENT_HANDOVER_ACTIVITY_CONTRACT,
  STUDENT_HANDOVER_FORBIDDEN_CONTROLS,
  STUDENT_HANDOVER_OBSERVATION_CHECKPOINTS,
  STUDENT_HANDOVER_SAFE_CONTROLS,
  type StudentHandoverCheckpointId,
  type StudentHandoverEvidenceClaimId,
} from './studentHandoverActivityContract';
import {
  createActiveStudentHandoverActivityState,
  createInactiveStudentHandoverActivityState,
  normalizeStudentHandoverResetState,
  reduceStudentHandoverActivity,
  studentHandoverResetEquivalent,
  type StudentHandoverActivityAction,
  type StudentHandoverActivityState,
  type StudentHandoverObservationRecord,
} from './studentHandoverActivityState';
import { resolveStudentHandoverActivityEvidence } from './studentHandoverActivityEvidence';
import {
  buildHandoverTeachingScript,
  resolveTeachingFrame,
} from './handoverTeachingScript';
import {
  createInstructorHandoverTransportState,
  openInstructorHandoverTransport,
  resolveInstructorHandoverTransportSnapshot,
  seekInstructorHandoverTransport,
  setInstructorHandoverPaused,
} from './instructorHandoverTransport';
import { resolveTeachingHandoverStoryFrame } from '../../scene/handoverStoryFrame';
import { resolveHandoverSurfaceBinding } from '../../scene/handoverSurfaceBinding';
import { resolveHandoverTeachingSurfaceProjection } from '../../scene/handoverTeachingSurfaceProjection';

const CLAIMS = Object.freeze({
  'candidate-comparison': Object.freeze([
    'replacement-above-floor',
    'replacement-beats-serving',
  ] as const),
  'conditions-and-hold': Object.freeze([
    'serving-below-floor',
    'replacement-above-floor',
    'replacement-beats-serving',
    'hold-complete',
  ] as const),
  'commit-receipt': Object.freeze([
    'serving-below-floor',
    'replacement-above-floor',
    'replacement-beats-serving',
    'hold-complete',
    'committed',
  ] as const),
} satisfies Readonly<
  Record<StudentHandoverCheckpointId, readonly StudentHandoverEvidenceClaimId[]>
>);

function accept(
  state: StudentHandoverActivityState,
  action: StudentHandoverActivityAction,
): StudentHandoverActivityState {
  const transition = reduceStudentHandoverActivity(state, action);
  assert.equal(transition.accepted, true, `${action.type}: ${transition.reason}`);
  return transition.state;
}

function reject(
  state: StudentHandoverActivityState,
  action: StudentHandoverActivityAction,
): StudentHandoverActivityState {
  const transition = reduceStudentHandoverActivity(state, action);
  assert.equal(transition.accepted, false, `${action.type} unexpectedly accepted`);
  assert.equal(transition.state, state, `${action.type} changed state on rejection`);
  return transition.state;
}

function observation(checkpointId: StudentHandoverCheckpointId): StudentHandoverObservationRecord {
  return Object.freeze({ checkpointId, evidenceClaims: CLAIMS[checkpointId] });
}

function predictReady(): StudentHandoverActivityState {
  return accept(createActiveStudentHandoverActivityState(), {
    type: 'select-prediction',
    prediction: 'switch-target',
  });
}

function operateState(): StudentHandoverActivityState {
  return accept(predictReady(), { type: 'lock-prediction', runId: 'student-intra-1' });
}

function observeCompleteState(): StudentHandoverActivityState {
  let state = accept(operateState(), { type: 'begin-observe' });
  for (const checkpoint of STUDENT_HANDOVER_OBSERVATION_CHECKPOINTS) {
    if (state.pendingCheckpointId === null) {
      state = accept(state, { type: 'request-checkpoint', checkpointId: checkpoint.id });
    }
    state = accept(state, {
      type: 'record-observation',
      observation: observation(checkpoint.id),
    });
  }
  return state;
}

function explainReadyState(): StudentHandoverActivityState {
  let state = accept(observeCompleteState(), { type: 'finish-observe' });
  state = accept(state, {
    type: 'select-explanation',
    explanation: 'all-four-conditions-held',
  });
  state = accept(state, { type: 'toggle-evidence-claim', claim: 'serving-below-floor' });
  return state;
}

function completeState(): StudentHandoverActivityState {
  return accept(explainReadyState(), { type: 'submit-explanation' });
}

test('R6 contract is versioned, Intra-only, bounded, and explicitly denies unsafe controls', () => {
  assert.equal(STUDENT_HANDOVER_ACTIVITY_CONTRACT.schemaVersion, 1);
  assert.equal(STUDENT_HANDOVER_ACTIVITY_CONTRACT.segment, 'intra');
  assert.equal(STUDENT_HANDOVER_ACTIVITY_CONTRACT.entryPointSec, 0);
  assert.deepEqual(
    STUDENT_HANDOVER_OBSERVATION_CHECKPOINTS.map(checkpoint => checkpoint.sourceTimeSec),
    [20, 40, 52],
  );
  assert.ok(STUDENT_HANDOVER_SAFE_CONTROLS.includes('start-bounded-observation'));
  assert.ok(STUDENT_HANDOVER_ACTIVITY_CONTRACT.reset.clear.includes('caption-hold'));
  for (const forbidden of [
    'arbitrary-timeline-seek',
    'arbitrary-speed-control',
    'simulation-source-switch',
    'power-tuning',
    'ttt-tuning',
    'offset-tuning',
    'candidate-ranking-control',
    'topology-mutation',
    'direct-scientific-state-mutation',
    'instructor-direct-inter-entry',
    'shell-visibility-control',
  ] as const) {
    assert.ok(STUDENT_HANDOVER_FORBIDDEN_CONTROLS.includes(forbidden));
  }
});

test('every legal and illegal step-changing transition is covered', () => {
  const states = Object.freeze({
    predict: predictReady(),
    operate: operateState(),
    observe: observeCompleteState(),
    explain: explainReadyState(),
    complete: completeState(),
  });
  const transitions = Object.freeze([
    Object.freeze({
      name: 'lock-prediction',
      legalFrom: 'predict',
      expectedStep: 'operate',
      action: Object.freeze({ type: 'lock-prediction', runId: 'student-intra-matrix' }),
    }),
    Object.freeze({
      name: 'begin-observe',
      legalFrom: 'operate',
      expectedStep: 'observe',
      action: Object.freeze({ type: 'begin-observe' }),
    }),
    Object.freeze({
      name: 'finish-observe',
      legalFrom: 'observe',
      expectedStep: 'explain',
      action: Object.freeze({ type: 'finish-observe' }),
    }),
    Object.freeze({
      name: 'submit-explanation',
      legalFrom: 'explain',
      expectedStep: 'complete',
      action: Object.freeze({ type: 'submit-explanation' }),
    }),
    Object.freeze({
      name: 'reset',
      legalFrom: 'complete',
      expectedStep: 'predict',
      action: Object.freeze({ type: 'reset' }),
    }),
  ] as const);

  for (const transition of transitions) {
    for (const [step, state] of Object.entries(states)) {
      const result = reduceStudentHandoverActivity(
        state,
        transition.action as StudentHandoverActivityAction,
      );
      assert.equal(
        result.accepted,
        step === transition.legalFrom,
        `${transition.name} from ${step}`,
      );
      assert.equal(
        result.state.step,
        step === transition.legalFrom ? transition.expectedStep : state.step,
        `${transition.name} step result from ${step}`,
      );
    }
  }

  const inactive = createInactiveStudentHandoverActivityState();
  const activated = reduceStudentHandoverActivity(inactive, { type: 'activate' });
  assert.equal(activated.accepted, true);
  assert.equal(activated.state.active, true);
  const deactivated = reduceStudentHandoverActivity(
    createActiveStudentHandoverActivityState(),
    { type: 'deactivate' },
  );
  assert.equal(deactivated.accepted, true);
  assert.equal(deactivated.state.active, false);
  const selectedButUnlockedExit = reduceStudentHandoverActivity(
    predictReady(),
    { type: 'deactivate' },
  );
  assert.equal(selectedButUnlockedExit.accepted, true);
  assert.equal(selectedButUnlockedExit.state.active, false);
  reject(operateState(), { type: 'deactivate' });
});

test('prediction locks at Operate and cannot be changed or relocked', () => {
  const locked = operateState();
  reject(locked, { type: 'select-prediction', prediction: 'stay-serving' });
  reject(locked, { type: 'lock-prediction', runId: 'replacement-run' });
  assert.equal(locked.selectedPrediction, 'switch-target');
  assert.equal(locked.runId, 'student-intra-1');
  assert.equal(locked.predictionLocked, true);
});

test('checkpoint commands and observations fail closed on order or malformed evidence', () => {
  let state = accept(operateState(), { type: 'begin-observe' });
  reject(state, { type: 'request-checkpoint', checkpointId: 'conditions-and-hold' });
  reject(state, {
    type: 'record-observation',
    observation: observation('conditions-and-hold'),
  });
  reject(state, {
    type: 'record-observation',
    observation: { checkpointId: 'candidate-comparison', evidenceClaims: [] },
  });
  reject(state, {
    type: 'record-observation',
    observation: {
      checkpointId: 'candidate-comparison',
      evidenceClaims: ['replacement-above-floor', 'replacement-above-floor'],
    },
  });
  state = accept(state, {
    type: 'record-observation',
    observation: observation('candidate-comparison'),
  });
  reject(state, { type: 'request-checkpoint', checkpointId: 'commit-receipt' });
  reject(state, { type: 'finish-observe' });
});

test('Explain requires a finite choice and at least one comparable observed claim', () => {
  let state = accept(observeCompleteState(), { type: 'finish-observe' });
  reject(state, { type: 'submit-explanation' });
  state = accept(state, {
    type: 'select-explanation',
    explanation: 'candidate-alone-was-enough',
  });
  state = accept(state, { type: 'toggle-evidence-claim', claim: 'committed' });
  reject(state, { type: 'submit-explanation' });
  state = accept(state, { type: 'toggle-evidence-claim', claim: 'serving-below-floor' });
  const completed = accept(state, { type: 'submit-explanation' });
  assert.equal(completed.step, 'complete');
  assert.equal(completed.completionReceipt?.scenarioId, STUDENT_HANDOVER_ACTIVITY_CONTRACT.scenarioId);
  assert.equal(completed.completionReceipt?.segment, 'intra');
});

test('Reset reconstructs the normalized clean Predict state exactly', () => {
  const initial = createActiveStudentHandoverActivityState();
  const reset = accept(completeState(), { type: 'reset' });
  assert.deepEqual(normalizeStudentHandoverResetState(reset), normalizeStudentHandoverResetState(initial));
  assert.equal(studentHandoverResetEquivalent(reset), true);
  assert.equal(Object.isFrozen(reset), true);
  assert.equal(Object.isFrozen(reset.observations), true);
});

function evidenceFixture(sourceTimeSec: number, checkpointId: StudentHandoverCheckpointId) {
  const script = buildHandoverTeachingScript('intra');
  const frame = resolveTeachingFrame(script, sourceTimeSec, null);
  const storyFrame = resolveTeachingHandoverStoryFrame({
    story: {
      kind: 'intra',
      sourceSatelliteId: 'sat-r6',
      sourceCellId: 0,
      targetSatelliteId: null,
      targetCellId: 1,
      storyKey: 'teaching-intra:sat-r6:0',
    },
    frame,
  });
  assert.ok(storyFrame);
  const binding = resolveHandoverSurfaceBinding('teaching', storyFrame);
  assert.ok(binding);
  const projection = resolveHandoverTeachingSurfaceProjection(binding, frame, 'intra');
  assert.ok(projection);
  let transportState = openInstructorHandoverTransport(
    createInstructorHandoverTransportState(),
    'intra',
  );
  transportState = seekInstructorHandoverTransport(transportState, sourceTimeSec);
  transportState = setInstructorHandoverPaused(transportState, true);
  const transport = resolveInstructorHandoverTransportSnapshot(transportState);
  assert.ok(transport);
  const evidence = resolveStudentHandoverActivityEvidence(checkpointId, transport, projection);
  assert.ok(evidence);
  return { frame, projection, transport, evidence };
}

test('the same R5 source time resolves the same story frame and student evidence', () => {
  for (const checkpoint of STUDENT_HANDOVER_OBSERVATION_CHECKPOINTS) {
    const first = evidenceFixture(checkpoint.sourceTimeSec, checkpoint.id);
    const second = evidenceFixture(checkpoint.sourceTimeSec, checkpoint.id);
    assert.deepEqual(first.frame, second.frame);
    assert.deepEqual(first.evidence, second.evidence);
    assert.equal(first.evidence.sourceTimeSec, checkpoint.sourceTimeSec);
    assert.equal(first.evidence.storyId, first.projection.binding.identity.storyId);
    assert.equal(first.evidence.pairKey, first.projection.binding.identity.pairKey);
  }
});

test('production activity sources contain no embedded checkpoint answer key', async () => {
  const [contractSource, stateSource, evidenceSource] = await Promise.all([
    readFile(new URL('./studentHandoverActivityContract.ts', import.meta.url), 'utf8'),
    readFile(new URL('./studentHandoverActivityState.ts', import.meta.url), 'utf8'),
    readFile(new URL('./studentHandoverActivityEvidence.ts', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(contractSource, /expectedTruth/);
  assert.doesNotMatch(stateSource, /SUPPORTED_EXPLANATION|all-four-conditions-held/);
  assert.doesNotMatch(evidenceSource, /expectedTruth|sameTruth/);
});
