import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INSTRUCTOR_HANDOVER_ALLOWED_CONTROLS,
  INSTRUCTOR_HANDOVER_BEAM_COUNT,
  INSTRUCTOR_HANDOVER_PHASE_MARKERS,
  INSTRUCTOR_HANDOVER_REQUIRED_SURFACES,
  INSTRUCTOR_HANDOVER_SCENARIO,
  INSTRUCTOR_HANDOVER_SCENARIO_ID,
  instructorHandoverEntryStartSec,
  isInstructorHandoverBeamTopologyAdmitted,
  resolveInstructorHandoverScenarioFrame,
  resolveInstructorHandoverScenarioPosition,
} from './instructorHandoverScenario';
import type { TeachingIdentityBinding } from './handoverTeachingScript';

const BINDING: TeachingIdentityBinding = Object.freeze({
  serving: Object.freeze({
    satelliteLabel: 'SAT-A',
    beamLabel: 'B1',
    elevationDeg: 60,
  }),
  candidates: Object.freeze([
    Object.freeze({ satelliteLabel: 'SAT-A', beamLabel: 'B2', elevationDeg: 55 }),
    Object.freeze({ satelliteLabel: 'SAT-B', beamLabel: 'B1', elevationDeg: 50 }),
    Object.freeze({ satelliteLabel: 'SAT-C', beamLabel: 'B1', elevationDeg: 45 }),
  ]),
});

test('R5 scenario is one versioned seven-beam Intra then Inter contract', () => {
  assert.equal(INSTRUCTOR_HANDOVER_SCENARIO.scenarioId, INSTRUCTOR_HANDOVER_SCENARIO_ID);
  assert.equal(INSTRUCTOR_HANDOVER_SCENARIO.beamCount, INSTRUCTOR_HANDOVER_BEAM_COUNT);
  assert.deepEqual(
    INSTRUCTOR_HANDOVER_SCENARIO.segments.map(segment => segment.kind),
    ['intra', 'inter'],
  );
  assert.deepEqual(
    INSTRUCTOR_HANDOVER_SCENARIO.segments.map(segment => [segment.startSec, segment.endSec]),
    [[0, 72], [72, 144]],
  );
  assert.equal(INSTRUCTOR_HANDOVER_SCENARIO.totalSec, 144);
  assert.deepEqual(
    INSTRUCTOR_HANDOVER_SCENARIO.allowedControls,
    INSTRUCTOR_HANDOVER_ALLOWED_CONTROLS,
  );
  assert.deepEqual(
    INSTRUCTOR_HANDOVER_SCENARIO.requiredSurfaces,
    INSTRUCTOR_HANDOVER_REQUIRED_SURFACES,
  );
  assert.ok(Object.isFrozen(INSTRUCTOR_HANDOVER_SCENARIO));
  assert.ok(Object.isFrozen(INSTRUCTOR_HANDOVER_SCENARIO.segments));
});

test('the instructor scenario admits only an exact seven-beam serving/candidate topology', () => {
  assert.equal(isInstructorHandoverBeamTopologyAdmitted(7, 7), true);
  assert.equal(isInstructorHandoverBeamTopologyAdmitted(7, undefined), true);
  assert.equal(isInstructorHandoverBeamTopologyAdmitted(1, 7), false);
  assert.equal(isInstructorHandoverBeamTopologyAdmitted(7, 19), false);
  assert.equal(isInstructorHandoverBeamTopologyAdmitted(19, 19), false);
  assert.equal(isInstructorHandoverBeamTopologyAdmitted(null, null), false);
});

test('segment ownership is exact at the Intra to Inter boundary', () => {
  assert.equal(resolveInstructorHandoverScenarioPosition(71.999).segment.kind, 'intra');
  const boundary = resolveInstructorHandoverScenarioPosition(72);
  assert.equal(boundary.segment.kind, 'inter');
  assert.equal(boundary.segmentTimeSec, 0);
  const end = resolveInstructorHandoverScenarioPosition(144);
  assert.equal(end.segment.kind, 'inter');
  assert.equal(end.segmentTimeSec, 72);
  assert.equal(end.complete, true);
});

test('phase markers cover both scripts on one source-time axis', () => {
  assert.deepEqual(
    INSTRUCTOR_HANDOVER_PHASE_MARKERS.map(marker => [
      marker.sourceTimeSec,
      marker.kind,
      marker.phase,
    ]),
    [
      [0, 'intra', 'serving'],
      [12, 'intra', 'candidate'],
      [28, 'intra', 'countdown'],
      [46, 'intra', 'switching'],
      [58, 'intra', 'settled'],
      [72, 'inter', 'serving'],
      [84, 'inter', 'candidate'],
      [100, 'inter', 'countdown'],
      [118, 'inter', 'switching'],
      [130, 'inter', 'settled'],
    ],
  );
});

test('the same source time resolves the same authored frame', () => {
  const first = resolveInstructorHandoverScenarioFrame(52, BINDING);
  const second = resolveInstructorHandoverScenarioFrame(52, BINDING);
  assert.deepEqual(first, second);
  assert.equal(first.segment.kind, 'intra');
  assert.equal(first.frame.phase.id, 'switching');
  assert.equal(first.frame.committed, true);
  assert.equal(first.frame.elapsedSec, 52);
  assert.equal(first.frame.serving.satelliteLabel, 'SAT-A');
});

test('Inter uses the same pure frame resolver after the shared boundary', () => {
  const beforeCommit = resolveInstructorHandoverScenarioFrame(123.999, BINDING);
  const atCommit = resolveInstructorHandoverScenarioFrame(124, BINDING);
  assert.equal(beforeCommit.segment.kind, 'inter');
  assert.equal(beforeCommit.frame.phase.id, 'switching');
  assert.equal(beforeCommit.frame.committed, false);
  assert.equal(atCommit.frame.committed, true);
  assert.equal(atCommit.segmentTimeSec, 52);
});

test('entry points are explicit rather than inferred by a renderer', () => {
  assert.equal(instructorHandoverEntryStartSec('intra'), 0);
  assert.equal(instructorHandoverEntryStartSec('inter'), 72);
});
