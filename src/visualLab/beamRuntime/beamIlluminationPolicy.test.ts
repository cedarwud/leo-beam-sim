import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  classifyServiceTransition,
  createBeamIlluminationPolicy,
  realizeBeamIllumination,
  scheduleEligibleBeamPositions,
  type BeamAssociation,
  type BeamPosition,
  type BeamIlluminationSchedule,
} from './index';

const CANDIDATE_BEAMS: readonly BeamPosition[] = Object.freeze([
  Object.freeze({ beamId: 0, satelliteId: 'sat-a' }),
  Object.freeze({ beamId: 1, satelliteId: 'sat-a' }),
  Object.freeze({ beamId: 2, satelliteId: 'sat-a' }),
  Object.freeze({ beamId: 3, satelliteId: 'sat-a' }),
  Object.freeze({ beamId: 4, satelliteId: 'sat-a' }),
  Object.freeze({ beamId: 5, satelliteId: 'sat-a' }),
  Object.freeze({ beamId: 6, satelliteId: 'sat-a' }),
]);

function ids(schedule: BeamIlluminationSchedule): readonly number[] {
  return schedule.eligibleBeamPositions.map(position => position.beamId);
}

function association(userId: string, beamId: number | null): BeamAssociation {
  return { userId, beamId };
}

function service(satelliteId: string, beamId: number) {
  return { satelliteId, beamId };
}

test('fixed mode returns a stable deterministic subset and exposes eligibility only', () => {
  const policy = createBeamIlluminationPolicy({
    mode: 'fixed',
    candidateBeamPositions: CANDIDATE_BEAMS,
    maxEligiblePerSlot: 4,
  });

  const first = scheduleEligibleBeamPositions(policy, 0);
  const later = scheduleEligibleBeamPositions(policy, 41);

  assert.equal(policy.satelliteId, 'sat-a');
  assert.equal(first.satelliteId, 'sat-a');
  assert.deepEqual(ids(first), [0, 1, 2, 3]);
  assert.deepEqual(ids(later), [0, 1, 2, 3]);
  assert.equal('beamActiveB' in first, false);
  assert.equal('z' in first, false);
  assert.ok('eligibleBeamPositions' in first);
});

test('beam-hopping mode follows its declared per-slot count without assuming thesis v_max', () => {
  const policy = createBeamIlluminationPolicy({
    mode: 'beam-hopping',
    candidateBeamPositions: CANDIDATE_BEAMS,
    maxEligiblePerSlot: 4,
  });

  const firstRun = [0, 1, 2, 3].map(slot => scheduleEligibleBeamPositions(policy, slot));
  const secondRun = [0, 1, 2, 3].map(slot => scheduleEligibleBeamPositions(policy, slot));

  assert.deepEqual(firstRun.map(ids), [
    [0, 1, 2, 3],
    [4, 5, 6, 0],
    [1, 2, 3, 4],
    [5, 6, 0, 1],
  ]);
  assert.deepEqual(firstRun.map(ids), secondRun.map(ids));
  assert.ok(firstRun.every(schedule => schedule.eligibleBeamPositions.length === 4));
  assert.deepEqual(
    [...new Set(firstRun.slice(0, 2).flatMap(schedule => ids(schedule)))].sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5, 6],
  );
});

test('candidate domain size and per-slot maximum remain configurable', () => {
  const policy = createBeamIlluminationPolicy({
    mode: 'beam-hopping',
    candidateBeamPositions: [
      { beamId: 10, satelliteId: 'sat-x' },
      { beamId: 20, satelliteId: 'sat-x' },
      { beamId: 30, satelliteId: 'sat-x' },
      { beamId: 40, satelliteId: 'sat-x' },
    ],
    maxEligiblePerSlot: 2,
  });

  assert.deepEqual(ids(scheduleEligibleBeamPositions(policy, 0)), [10, 20]);
  assert.deepEqual(ids(scheduleEligibleBeamPositions(policy, 1)), [30, 40]);
  assert.deepEqual(ids(scheduleEligibleBeamPositions(policy, 2)), [10, 20]);
});

test('realization derives load and active mask from associations, with active iff positive load', () => {
  const policy = createBeamIlluminationPolicy({
    mode: 'fixed',
    candidateBeamPositions: CANDIDATE_BEAMS,
    maxEligiblePerSlot: 4,
  });
  const schedule = scheduleEligibleBeamPositions(policy, 0);
  const realization = realizeBeamIllumination(schedule, [
    association('u-0', 0),
    association('u-1', 0),
    association('u-2', 2),
    association('u-4', 3),
    association('u-3', null),
  ]);

  assert.deepEqual(realization.beamIds, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(realization.beamLoad, [2, 0, 1, 1, 0, 0, 0]);
  assert.deepEqual(realization.activeMask, [true, false, true, true, false, false, false]);
  assert.equal(realization.satelliteId, 'sat-a');
  for (let index = 0; index < realization.beamLoad.length; index += 1) {
    assert.equal(realization.activeMask[index], realization.beamLoad[index]! > 0);
  }
});

test('policy and realization reject invalid or non-eligible inputs', () => {
  assert.throws(
    () => createBeamIlluminationPolicy({
      mode: 'beam-hopping',
      candidateBeamPositions: CANDIDATE_BEAMS,
      maxEligiblePerSlot: 0,
    }),
    /maxEligiblePerSlot must be a positive integer/,
  );
  assert.throws(
    () => createBeamIlluminationPolicy({
      mode: 'fixed',
      candidateBeamPositions: CANDIDATE_BEAMS,
      maxEligiblePerSlot: 8,
    }),
    /cannot exceed candidateBeamPositions length/,
  );
  assert.throws(
    () => createBeamIlluminationPolicy({
      mode: 'fixed',
      candidateBeamPositions: [
        { beamId: 0, satelliteId: 'sat-a' },
        { beamId: 1, satelliteId: 'sat-b' },
      ],
      maxEligiblePerSlot: 2,
    }),
    /must belong to one satellite/,
  );
  assert.throws(
    () => createBeamIlluminationPolicy({
      mode: 'fixed',
      candidateBeamPositions: [
        { beamId: 0, satelliteId: 'sat-a' },
        { beamId: 0, satelliteId: 'sat-a' },
      ],
      maxEligiblePerSlot: 1,
    }),
    /duplicate beamId 0/,
  );

  const policy = createBeamIlluminationPolicy({
    mode: 'fixed',
    candidateBeamPositions: CANDIDATE_BEAMS,
    maxEligiblePerSlot: 4,
  });
  assert.throws(() => scheduleEligibleBeamPositions(policy, -1), /slotIndex must be a non-negative integer/);
  const schedule = scheduleEligibleBeamPositions(policy, 0);
  assert.throws(
    () => realizeBeamIllumination(schedule, [association('u-0', 4)]),
    /UE u-0 is associated with ineligible beam 4/,
  );
  assert.throws(
    () => realizeBeamIllumination(schedule, [association('u-0', 99)]),
    /UE u-0 references unknown beam 99/,
  );
  assert.throws(
    () => realizeBeamIllumination(schedule, [association('u-0', 0), association('u-0', 2)]),
    /duplicate userId u-0/,
  );
});

test('service transition classification ignores active-set changes and distinguishes service events', () => {
  assert.equal(classifyServiceTransition(null, service('sat-a', 0)).kind, 'initial-attach');
  assert.equal(classifyServiceTransition(service('sat-a', 0), null).kind, 'service-loss');
  assert.equal(classifyServiceTransition(null, null).kind, 'stay');
  assert.equal(classifyServiceTransition(service('sat-a', 0), service('sat-a', 0)).kind, 'stay');
  assert.equal(
    classifyServiceTransition(service('sat-a', 0), service('sat-a', 1)).kind,
    'same-satellite-beam-switch',
  );
  assert.equal(
    classifyServiceTransition(service('sat-a', 0), service('sat-b', 3)).kind,
    'cross-satellite-handover',
  );
});
