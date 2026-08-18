import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BEAM_SCHEDULE_TRACE_EVIDENCE_BASIS,
  BEAM_SCHEDULE_TRACE_SCHEMA,
  createBeamScheduleTrace,
  createHexBeamLayout,
  type BeamScheduleServiceAssociation,
  type BeamScheduleSlotIdentity,
} from './index';

const TRACE_IDENTITY = Object.freeze({
  analysisRunId: 'analysis-run-test',
  geometryRunId: 'geometry-run-test',
});

function layout(satelliteId: string, beamCount: 1 | 7 | 19) {
  return createHexBeamLayout({
    satelliteId,
    beamCount,
    halfPowerBeamWidthDeg: 3.32,
  });
}

function identity(index: number): BeamScheduleSlotIdentity {
  return {
    slotId: `accepted-slot-${index}`,
    slotIndex: index,
    anchorIndex: index,
    anchorTimeSec: index * 30,
    instantUtc: `2026-08-16T00:00:${String(index).padStart(2, '0')}.000Z`,
  };
}

function service(
  userId: string,
  satelliteId: string | null,
  beamId: number | null,
): BeamScheduleServiceAssociation {
  return { userId, satelliteId, beamId };
}

test('fixed illumination keeps satellite-local 7-beam eligibility and derives active masks from load', () => {
  const input = {
    ...TRACE_IDENTITY,
    satellites: [{
      layout: layout('serving-7', 7),
      mode: 'fixed' as const,
      maxEligiblePerSlot: 7,
    }],
    slots: [
      { identity: identity(0), associations: [service('ue-a', 'serving-7', 0), service('ue-b', 'serving-7', 1)] },
      { identity: identity(1), associations: [service('ue-a', 'serving-7', 0), service('ue-b', 'serving-7', 1)] },
    ],
  };
  const trace = createBeamScheduleTrace(input);
  const first = trace.slots[0]!.satelliteSlots[0]!;

  assert.equal(trace.schemaVersion, BEAM_SCHEDULE_TRACE_SCHEMA);
  assert.deepEqual(first.eligibleBeamIds, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(first.beamLoad, [1, 1, 0, 0, 0, 0, 0]);
  assert.deepEqual(first.activeBeamMask, [true, true, false, false, false, false, false]);
  assert.deepEqual(first.activeBeamIds, [0, 1]);
  assert.deepEqual(
    trace.slots[1]!.satelliteSlots[0]!.eligibleBeamIds,
    first.eligibleBeamIds,
  );
  assert.equal(trace.transitionEvidence.length, 2);
  assert.ok(trace.transitionEvidence.every(item => item.kind === 'stay'));
  assert.ok(trace.transitionEvidence.every(item => item.scheduleChanged === false));
  assert.ok(trace.transitionEvidence.every(item => item.activeMaskChanged === false));
  assert.ok(trace.transitionEvidence.every(item => item.basis === BEAM_SCHEDULE_TRACE_EVIDENCE_BASIS));
  assert.equal('handoverEvents' in trace, false, 'trace must not invent a handover event stream');
  assert.equal('v_max' in trace, false, 'trace must not expose the thesis v_max as a layout control');
  assert.equal(Object.isFrozen(trace), true);
  assert.equal(Object.isFrozen(trace.slots), true);
  assert.equal(Object.isFrozen(first.activeBeamMask), true);

  const repeated = createBeamScheduleTrace({
    ...TRACE_IDENTITY,
    satellites: [...input.satellites],
    slots: input.slots.map(slot => ({ ...slot, associations: [...slot.associations] })),
  });
  assert.equal(repeated.traceDigest, trace.traceDigest, 'normalized trace identity is deterministic');
});

test('beam hopping is deterministic while serving and candidate satellites retain different local layouts', () => {
  const input = {
    ...TRACE_IDENTITY,
    satellites: [
      {
        layout: layout('serving-7', 7),
        mode: 'beam-hopping' as const,
        maxEligiblePerSlot: 3,
      },
      {
        layout: layout('candidate-19', 19),
        mode: 'fixed' as const,
        maxEligiblePerSlot: 19,
      },
    ],
    slots: [
      {
        identity: identity(0),
        associations: [service('ue-a', 'serving-7', 0), service('ue-b', 'candidate-19', 18)],
      },
      {
        identity: identity(1),
        associations: [service('ue-a', 'serving-7', 3), service('ue-b', 'candidate-19', 18)],
      },
      {
        identity: identity(2),
        associations: [service('ue-a', 'serving-7', 6), service('ue-b', 'candidate-19', 18)],
      },
    ],
  };
  const trace = createBeamScheduleTrace(input);
  const servingSlots = trace.slots.map(slot => slot.satelliteSlots.find(item => item.satelliteId === 'serving-7')!);
  const candidateSlots = trace.slots.map(slot => slot.satelliteSlots.find(item => item.satelliteId === 'candidate-19')!);

  assert.equal(trace.satellites.find(item => item.satelliteId === 'serving-7')!.layout.beamCount, 7);
  assert.equal(trace.satellites.find(item => item.satelliteId === 'candidate-19')!.layout.beamCount, 19);
  assert.deepEqual(servingSlots.map(slot => slot.eligibleBeamIds), [[0, 1, 2], [3, 4, 5], [6, 0, 1]]);
  assert.ok(servingSlots.every(slot => slot.activeBeamMask.length === 7));
  assert.ok(candidateSlots.every(slot => slot.activeBeamMask.length === 19));
  assert.deepEqual(candidateSlots.map(slot => slot.eligibleBeamIds), [
    Array.from({ length: 19 }, (_, index) => index),
    Array.from({ length: 19 }, (_, index) => index),
    Array.from({ length: 19 }, (_, index) => index),
  ]);

  const servingTransitions = trace.transitionEvidence.filter(item => item.userId === 'ue-a');
  const candidateTransitions = trace.transitionEvidence.filter(item => item.userId === 'ue-b');
  assert.deepEqual(servingTransitions.map(item => item.kind), [
    'same-satellite-beam-switch',
    'same-satellite-beam-switch',
  ]);
  assert.ok(servingTransitions.every(item => item.scheduleChanged && item.activeMaskChanged));
  assert.ok(candidateTransitions.every(item => item.kind === 'stay'));
  assert.ok(candidateTransitions.every(item => item.scheduleChanged && item.activeMaskChanged));
  assert.ok(candidateTransitions.every(item => item.changedSatelliteIds.includes('serving-7')));

  const repeated = createBeamScheduleTrace({
    ...TRACE_IDENTITY,
    satellites: [...input.satellites].reverse(),
    slots: input.slots.map(slot => ({ ...slot, associations: [...slot.associations].reverse() })),
  });
  assert.equal(repeated.traceDigest, trace.traceDigest, 'satellite and UE input order does not alter the trace digest');
  assert.deepEqual(
    repeated.slots.map(slot => slot.satelliteSlots.map(item => item.satelliteId)),
    trace.slots.map(slot => slot.satelliteSlots.map(item => item.satelliteId)),
  );
});

test('schedule changes without a service-pair change remain stay evidence, not intra-handover claims', () => {
  const trace = createBeamScheduleTrace({
    ...TRACE_IDENTITY,
    satellites: [{
      layout: layout('sat-a', 7),
      mode: 'beam-hopping',
      maxEligiblePerSlot: 4,
    }],
    slots: [
      { identity: identity(0), associations: [service('ue-a', 'sat-a', 0)] },
      { identity: identity(1), associations: [service('ue-a', 'sat-a', 0)] },
    ],
  });
  const evidence = trace.transitionEvidence[0]!;

  assert.equal(evidence.kind, 'stay');
  assert.equal(evidence.servicePairChanged, false);
  assert.equal(evidence.scheduleChanged, true);
  assert.equal(evidence.activeMaskChanged, false);
  assert.deepEqual(evidence.changedSatelliteIds, ['sat-a']);
  assert.equal('handoverEvent' in evidence, false);
});

test('the trace requires accepted slot identity and a complete stable UE domain', () => {
  const sat = layout('sat-a', 1);
  const base = {
    ...TRACE_IDENTITY,
    satellites: [{ layout: sat, mode: 'fixed' as const, maxEligiblePerSlot: 1 }],
    slots: [
      { identity: identity(0), associations: [service('ue-a', 'sat-a', 0)] },
      { identity: identity(1), associations: [service('ue-a', 'sat-a', 0)] },
    ],
  };

  assert.throws(
    () => createBeamScheduleTrace({
      ...base,
      slots: [{ ...base.slots[0]!, identity: { ...identity(0), slotId: '' } }, base.slots[1]!],
    }),
    /slotId must be a non-empty string/,
  );
  assert.throws(
    () => createBeamScheduleTrace({
      ...base,
      slots: [base.slots[0]!, { ...base.slots[1]!, associations: [] }],
    }),
    /same complete UE association domain/,
  );
  assert.throws(
    () => createBeamScheduleTrace({
      ...base,
      slots: [base.slots[1]!, base.slots[0]!],
    }),
    /ordered by strictly increasing slotIndex/,
  );
});

console.log('beam schedule trace domain tests passed');
