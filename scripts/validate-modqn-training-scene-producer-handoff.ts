#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MODQN_REPLAY_FORBIDDEN_BEAM_HOPPING_TRUTH_FIELDS,
} from '../src/modqn/replay-source-gaps';
import {
  MODQN_TRAINING_SCENE_P0_REQUIRED_FIELDS,
  MODQN_TRAINING_SCENE_P1_SOURCE_GAP_ALLOWED_FIELDS,
  MODQN_TRAINING_SCENE_P2_COMPARISON_ONLY_FIELDS,
  MODQN_TRAINING_SCENE_PRODUCER_HANDOFF_PACKET,
  MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS,
  getModqnTrainingSceneProducerHandoffItem,
  getModqnTrainingSceneProducerHandoffPacketByPriority,
  type ModqnTrainingSceneTraceField,
} from '../src/modqn/training-scene-trace';

function read(path: string): string {
  return fs.readFileSync(path, 'utf8');
}

function assertIncludes<T>(values: readonly T[], value: T, message: string): void {
  assert.ok(values.includes(value), message);
}

console.log('validate-modqn-training-scene-producer-handoff');

assert.equal(
  MODQN_TRAINING_SCENE_PRODUCER_HANDOFF_PACKET.length,
  MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS.length,
  'handoff packet covers every trace requirement',
);

const allPriorityFields = [
  ...MODQN_TRAINING_SCENE_P0_REQUIRED_FIELDS,
  ...MODQN_TRAINING_SCENE_P1_SOURCE_GAP_ALLOWED_FIELDS,
  ...MODQN_TRAINING_SCENE_P2_COMPARISON_ONLY_FIELDS,
] as readonly ModqnTrainingSceneTraceField[];
assert.equal(new Set(allPriorityFields).size, allPriorityFields.length, 'priority field sets do not overlap');
assert.deepEqual(
  new Set(allPriorityFields),
  new Set(MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS.map(requirement => requirement.field)),
  'priority field sets exactly cover the trace contract',
);

assert.equal(getModqnTrainingSceneProducerHandoffPacketByPriority('P0-required').length, 26);
assert.equal(getModqnTrainingSceneProducerHandoffPacketByPriority('P1-source-gap-allowed').length, 12);
assert.equal(getModqnTrainingSceneProducerHandoffPacketByPriority('P2-comparison-only').length, 3);

for (const item of MODQN_TRAINING_SCENE_PRODUCER_HANDOFF_PACKET) {
  assert.ok(item.requiredProducerPaths.length > 0, `${item.field} lists producer paths`);
  if (item.priority === 'P0-required') {
    assert.equal(item.validationGate, 'reject-trace-if-absent', `${item.field} rejects trace when absent`);
    assert.ok(item.producerAction.startsWith('Export '), `${item.field} tells producer to export`);
  }
  if (item.priority === 'P1-source-gap-allowed') {
    assert.equal(item.validationGate, 'accept-trace-with-source-gap', `${item.field} source-gaps when absent`);
    assert.ok(item.sourceGapField !== undefined, `${item.field} has a canonical source-gap mapping`);
  }
  if (item.priority === 'P2-comparison-only') {
    assert.equal(item.validationGate, 'gate-comparison-feature', `${item.field} gates comparison`);
    assert.ok(item.field.startsWith('comparison.'), `${item.field} is comparison-only`);
  }
}

for (const field of [
  'provenance.schemaVersion',
  'provenance.runIdentity',
  'provenance.claimBoundary',
  'provenance.seedSet',
  'environment.scheduler',
  'environment.objectiveWeights',
  'environment.handoverPenalty',
  'step.focusUe',
  'step.previousServing',
  'step.selectedServing',
  'step.selectedAction',
  'step.decisionMasks',
  'step.activeBeamSchedule',
  'step.handoverEvent',
  'step.reward',
  'step.sourceGaps',
] as const) {
  assertIncludes(MODQN_TRAINING_SCENE_P0_REQUIRED_FIELDS, field, `P0 includes ${field}`);
  assert.equal(getModqnTrainingSceneProducerHandoffItem(field).priority, 'P0-required');
}

for (const field of [
  'environment.frequencyReuse',
  'entities.cells',
  'entities.models',
  'step.satelliteState',
  'step.beamFootprints',
  'step.allUePositions',
  'step.allUeServingHistory',
  'step.nextBeamSchedule',
  'step.queueState',
  'step.angleAwareTerms',
  'step.energyEfficiencyTerms',
  'step.policyDiagnostics',
] as const) {
  assertIncludes(MODQN_TRAINING_SCENE_P1_SOURCE_GAP_ALLOWED_FIELDS, field, `P1 includes ${field}`);
  assert.equal(getModqnTrainingSceneProducerHandoffItem(field).priority, 'P1-source-gap-allowed');
}

for (const field of [
  'comparison.alignedTimebase',
  'comparison.perModelStreams',
  'comparison.aggregateMetrics',
] as const) {
  assertIncludes(MODQN_TRAINING_SCENE_P2_COMPARISON_ONLY_FIELDS, field, `P2 includes ${field}`);
  assert.equal(getModqnTrainingSceneProducerHandoffItem(field).priority, 'P2-comparison-only');
}

for (const field of ['step.activeBeamSchedule', 'step.nextBeamSchedule'] as const) {
  const item = getModqnTrainingSceneProducerHandoffItem(field);
  const paths = item.requiredProducerPaths.join('\n');
  for (const forbidden of MODQN_REPLAY_FORBIDDEN_BEAM_HOPPING_TRUTH_FIELDS) {
    assert.ok(!paths.includes(forbidden), `${field} must not use ${forbidden} as producer schedule path`);
  }
}

const activeSchedule = getModqnTrainingSceneProducerHandoffItem('step.activeBeamSchedule');
assert.equal(activeSchedule.priority, 'P0-required');
assert.equal(activeSchedule.validationGate, 'reject-trace-if-absent');
assert.equal(activeSchedule.sourceGapField, 'beamHopping.activeSchedule');

const nextSchedule = getModqnTrainingSceneProducerHandoffItem('step.nextBeamSchedule');
assert.equal(nextSchedule.priority, 'P1-source-gap-allowed');
assert.equal(nextSchedule.validationGate, 'accept-trace-with-source-gap');
assert.equal(nextSchedule.sourceGapField, 'beamHopping.nextSchedule');

const handoffDoc = read('docs/modqn-training-scene-producer-handoff-packet.md');
for (const token of [
  'P0 required',
  'P1 source-gap allowed',
  'P2 comparison-only',
  'step.activeBeamSchedule',
  'step.nextBeamSchedule',
  'step.queueState',
  'selectedServing',
  'decisionActionValidityMask',
  'validate:modqn:training-scene-producer-handoff',
]) {
  assert.ok(handoffDoc.includes(token), `handoff packet doc includes ${token}`);
}

const sdd = read('docs/modqn-training-scene-replay-sdd.md');
assert.ok(
  sdd.includes('docs/modqn-training-scene-producer-handoff-packet.md'),
  'training scene SDD links producer handoff packet doc',
);
assert.ok(
  sdd.includes('src/modqn/training-scene-trace/producerHandoff.ts'),
  'training scene SDD links typed producer handoff packet',
);

const packageJson = read('package.json');
assert.ok(
  packageJson.includes('validate:modqn:training-scene-producer-handoff'),
  'package exposes producer handoff validator',
);

console.log(JSON.stringify({
  result: 'PASS',
  totalFields: MODQN_TRAINING_SCENE_PRODUCER_HANDOFF_PACKET.length,
  p0Required: MODQN_TRAINING_SCENE_P0_REQUIRED_FIELDS.length,
  p1SourceGapAllowed: MODQN_TRAINING_SCENE_P1_SOURCE_GAP_ALLOWED_FIELDS.length,
  p2ComparisonOnly: MODQN_TRAINING_SCENE_P2_COMPARISON_ONLY_FIELDS.length,
}, null, 2));
