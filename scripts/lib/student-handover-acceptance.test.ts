import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  R6_ACTIVITY_ID,
  R6_COMPARABLE_FIELDS,
  R6_EXPECTED_CHECKPOINTS,
  R6_RESET_IDENTITY,
  validateR6EvidenceTelemetry,
  validateR6ResetEquivalence,
  validateR6StudentSurfaceSet,
  type R6CheckpointId,
  type R6EvidenceClaim,
  type R6EvidenceTelemetry,
  type R6StudentSurface,
  type R6StudentTelemetry,
} from './student-handover-acceptance';

function telemetry(
  surface: R6StudentSurface,
  step: 'predict' | 'operate' | 'observe' | 'explain' | 'complete' = 'predict',
  checkpointId: R6CheckpointId | null = null,
): R6StudentTelemetry {
  const checkpoint = checkpointId === null ? null : R6_EXPECTED_CHECKPOINTS[checkpointId];
  const locked = step !== 'predict';
  const runId = locked ? 'student-intra-7' : '';
  const complete = step === 'complete';
  return {
    surface,
    binding: 'active',
    schemaVersion: '1',
    activityId: R6_ACTIVITY_ID,
    activityVersion: '1',
    step,
    runId,
    prediction: locked ? 'switch-target' : '',
    predictionLocked: String(locked),
    checkpointId: checkpoint?.id ?? '',
    observedCheckpoints: checkpoint?.observedCheckpoints ?? '',
    explanation: complete ? 'all-four-conditions-held' : '',
    evidenceClaims: complete ? 'serving-below-floor,hold-complete' : '',
    receiptId: complete ? `${R6_ACTIVITY_ID}:${runId}:complete` : '',
    resetIdentity: R6_RESET_IDENTITY,
    scenarioId: 'homepage-seven-beam-intra-inter-v1',
    scenarioVersion: '1',
    segment: 'intra',
    instructorRunId: '11',
    sourceTimeSec: String(checkpoint?.sourceTimeSec ?? 0),
    storyId: 'teaching-intra:sat-a:0',
    pairKey: 'intra:sat-a|B1|0>sat-a|B2|1',
    storyPhase: checkpoint?.storyPhase ?? 'serving',
    committed: String(checkpoint?.committed ?? false),
  };
}

function surfaces(
  step: 'predict' | 'operate' | 'observe' | 'explain' | 'complete' = 'predict',
  checkpointId: R6CheckpointId | null = null,
): readonly [
  R6StudentTelemetry,
  R6StudentTelemetry,
  R6StudentTelemetry,
  R6StudentTelemetry,
  R6StudentTelemetry,
] {
  return [
    telemetry('root', step, checkpointId),
    telemetry('scene', step, checkpointId),
    telemetry('rail', step, checkpointId),
    telemetry('caption', step, checkpointId),
    telemetry('activity', step, checkpointId),
  ];
}

function evidence(checkpointId: R6CheckpointId): R6EvidenceTelemetry {
  const expected = R6_EXPECTED_CHECKPOINTS[checkpointId];
  const claims = Object.fromEntries(
    Object.entries(expected.truth).map(([claim, value]) => [claim, String(value)]),
  ) as Record<R6EvidenceClaim, string>;
  return {
    checkpointId,
    sourceTimeSec: String(expected.sourceTimeSec),
    storyId: 'teaching-intra:sat-a:0',
    pairKey: 'intra:sat-a|B1|0>sat-a|B2|1',
    claims,
  };
}

test('independent R6 contract accepts clean Predict and locked Operate', () => {
  assert.deepEqual(validateR6StudentSurfaceSet(...surfaces('predict')), []);
  assert.deepEqual(validateR6StudentSurfaceSet(...surfaces('operate')), []);
});

test('independent R6 contract accepts every stable Observe checkpoint', () => {
  for (const checkpointId of Object.keys(R6_EXPECTED_CHECKPOINTS) as R6CheckpointId[]) {
    const capture = surfaces('observe', checkpointId);
    assert.deepEqual(
      validateR6StudentSurfaceSet(...capture, checkpointId),
      [],
      checkpointId,
    );
    assert.deepEqual(
      validateR6EvidenceTelemetry(evidence(checkpointId), checkpointId, capture[4]),
      [],
      `${checkpointId} evidence`,
    );
  }
});

test('independent R6 contract accepts Explain and Complete at the commit checkpoint', () => {
  assert.deepEqual(
    validateR6StudentSurfaceSet(...surfaces('explain', 'commit-receipt'), 'commit-receipt'),
    [],
  );
  assert.deepEqual(
    validateR6StudentSurfaceSet(...surfaces('complete', 'commit-receipt'), 'commit-receipt'),
    [],
  );
});

test('cross-surface mutations turn the independent gate red', () => {
  for (const field of R6_COMPARABLE_FIELDS) {
    const pristine = surfaces('complete', 'commit-receipt');
    const mutatedActivity: R6StudentTelemetry = {
      ...pristine[4],
      [field]: `${pristine[4][field] || 'empty'}::mutation`,
    };
    assert.ok(
      validateR6StudentSurfaceSet(
        pristine[0], pristine[1], pristine[2], pristine[3], mutatedActivity,
        'commit-receipt',
      ).length > 0,
      `${field} stayed green`,
    );
  }
});

test('required activity, story, clock, evidence, and reset mutations turn red', () => {
  const requiredFields = [
    'step',
    'runId',
    'predictionLocked',
    'storyId',
    'pairKey',
    'sourceTimeSec',
    'checkpointId',
    'evidenceClaims',
    'resetIdentity',
  ] as const satisfies readonly (keyof R6StudentTelemetry)[];
  for (const field of requiredFields) {
    const pristine = surfaces('complete', 'commit-receipt');
    const mutatedRoot: R6StudentTelemetry = {
      ...pristine[0],
      [field]: `${pristine[0][field] || 'empty'}::required-mutation`,
    };
    assert.ok(
      validateR6StudentSurfaceSet(
        mutatedRoot, pristine[1], pristine[2], pristine[3], pristine[4],
        'commit-receipt',
      ).length > 0,
      `${field} stayed green`,
    );
  }
});

test('independent evidence truth mutations turn red at every checkpoint', () => {
  for (const checkpointId of Object.keys(R6_EXPECTED_CHECKPOINTS) as R6CheckpointId[]) {
    const pristine = evidence(checkpointId);
    const activity = telemetry('activity', 'observe', checkpointId);
    for (const claim of Object.keys(pristine.claims) as R6EvidenceClaim[]) {
      const mutated: R6EvidenceTelemetry = {
        ...pristine,
        claims: { ...pristine.claims, [claim]: pristine.claims[claim] === 'true' ? 'false' : 'true' },
      };
      assert.ok(
        validateR6EvidenceTelemetry(mutated, checkpointId, activity).length > 0,
        `${checkpointId}.${claim} stayed green`,
      );
    }
  }
});

test('reset equivalence ignores a fresh instructor run but rejects residual activity identity', () => {
  const initial = telemetry('root', 'predict');
  const replay = { ...initial, instructorRunId: '12' };
  assert.deepEqual(validateR6ResetEquivalence(initial, replay), []);
  for (const mutation of [
    { field: 'runId', value: 'residual-run' },
    { field: 'prediction', value: 'switch-target' },
    { field: 'checkpointId', value: 'commit-receipt' },
    { field: 'storyId', value: `${initial.storyId}::residual` },
    { field: 'sourceTimeSec', value: '52' },
    { field: 'resetIdentity', value: `${initial.resetIdentity}::residual` },
  ] as const) {
    const changed = { ...replay, [mutation.field]: mutation.value };
    assert.ok(validateR6ResetEquivalence(initial, changed).length > 0, mutation.field);
  }
});

test('acceptance oracle has no production imports', async () => {
  const source = await readFile(
    new URL('./student-handover-acceptance.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /^import /m);
  assert.doesNotMatch(source, /studentHandoverActivity(State|Telemetry)|resolveHandoverTeachingSurfaceProjection/);
});
