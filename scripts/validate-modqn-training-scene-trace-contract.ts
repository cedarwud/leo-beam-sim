#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MODQN_REPLAY_FORBIDDEN_BEAM_HOPPING_TRUTH_FIELDS,
  MODQN_REPLAY_SOURCE_GAP_FIELDS,
  type ModqnReplaySourceGapField,
} from '../src/modqn/replay-source-gaps';
import {
  MODQN_TRAINING_SCENE_LANE_CONTRACTS,
  MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS,
  getDisplayDerivedTrainingSceneFields,
  getTrainingSceneLaneContract,
  getTrainingSceneSourceGapFieldsForLane,
  getTrainingSceneTraceRequirementsForLane,
  type ModqnTrainingSceneLane,
  type ModqnTrainingSceneTraceField,
} from '../src/modqn/training-scene-trace';

function read(path: string): string {
  return fs.readFileSync(path, 'utf8');
}

function requirement(field: ModqnTrainingSceneTraceField) {
  const item = MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS.find(candidate => candidate.field === field);
  assert.ok(item, `trace requirement exists: ${field}`);
  return item;
}

function assertLaneContract(
  lane: ModqnTrainingSceneLane,
  expected: {
    readonly sceneLane: string;
    readonly proofClaimAllowed: boolean;
    readonly profileDerivedOverlayAllowed: boolean;
    readonly sinrLiveVisualsAllowed: boolean;
    readonly missingTruthPolicy: string;
  },
): void {
  const contract = getTrainingSceneLaneContract(lane);
  assert.equal(contract.sceneLane, expected.sceneLane, `${lane} scene lane`);
  assert.equal(contract.proofClaimAllowed, expected.proofClaimAllowed, `${lane} proof claim`);
  assert.equal(
    contract.profileDerivedOverlayAllowed,
    expected.profileDerivedOverlayAllowed,
    `${lane} profile overlay`,
  );
  assert.equal(contract.sinrLiveVisualsAllowed, expected.sinrLiveVisualsAllowed, `${lane} SINR live visuals`);
  assert.equal(contract.missingTruthPolicy, expected.missingTruthPolicy, `${lane} missing truth policy`);
}

function assertLaneHasRequirements(
  lane: ModqnTrainingSceneLane,
  fields: readonly ModqnTrainingSceneTraceField[],
): void {
  const laneFields = new Set(getTrainingSceneTraceRequirementsForLane(lane).map(item => item.field));
  for (const field of fields) {
    assert.ok(laneFields.has(field), `${lane} includes trace requirement ${field}`);
  }
}

function assertLaneHasSourceGaps(
  lane: ModqnTrainingSceneLane,
  fields: readonly ModqnReplaySourceGapField[],
): void {
  const gapFields = new Set(getTrainingSceneSourceGapFieldsForLane(lane));
  for (const field of fields) {
    assert.ok(gapFields.has(field), `${lane} maps absent truth to source gap ${field}`);
  }
}

function assertNoForbiddenScheduleAliases(field: ModqnTrainingSceneTraceField): void {
  const item = requirement(field);
  const requiredProducerPaths = item.requiredProducerPaths.join('\n');
  for (const forbidden of MODQN_REPLAY_FORBIDDEN_BEAM_HOPPING_TRUTH_FIELDS) {
    assert.ok(
      !requiredProducerPaths.includes(forbidden),
      `${field} must not use ${forbidden} as beam schedule producer truth`,
    );
  }
}

console.log('validate-modqn-training-scene-trace-contract');

assert.equal(MODQN_TRAINING_SCENE_LANE_CONTRACTS.length, 6, 'six display lanes are registered');
assertLaneContract('live-demo-profile-preview', {
  sceneLane: 'modqn-live-cell-preview',
  proofClaimAllowed: false,
  profileDerivedOverlayAllowed: true,
  sinrLiveVisualsAllowed: true,
  missingTruthPolicy: 'display-derived-ok',
});
assertLaneContract('baseline-replay-proof', {
  sceneLane: 'modqn-replay-proof',
  proofClaimAllowed: true,
  profileDerivedOverlayAllowed: false,
  sinrLiveVisualsAllowed: false,
  missingTruthPolicy: 'source-gap',
});
assertLaneContract('user-trained-model-replay', {
  sceneLane: 'modqn-replay-proof',
  proofClaimAllowed: false,
  profileDerivedOverlayAllowed: false,
  sinrLiveVisualsAllowed: false,
  missingTruthPolicy: 'source-gap',
});
assertLaneContract('training-run-replay', {
  sceneLane: 'future-lane',
  proofClaimAllowed: false,
  profileDerivedOverlayAllowed: false,
  sinrLiveVisualsAllowed: false,
  missingTruthPolicy: 'source-gap',
});
assertLaneContract('model-comparison-replay', {
  sceneLane: 'future-lane',
  proofClaimAllowed: false,
  profileDerivedOverlayAllowed: false,
  sinrLiveVisualsAllowed: false,
  missingTruthPolicy: 'source-gap',
});
assertLaneContract('artifact-replay', {
  sceneLane: 'artifact-replay',
  proofClaimAllowed: true,
  profileDerivedOverlayAllowed: false,
  sinrLiveVisualsAllowed: false,
  missingTruthPolicy: 'fail-closed',
});

assertLaneHasRequirements('baseline-replay-proof', [
  'provenance.runIdentity',
  'environment.scheduler',
  'environment.algorithmFlags',
  'entities.satellites',
  'entities.beams',
  'entities.ues',
  'step.timeIndex',
  'step.focusUe',
  'step.previousServing',
  'step.selectedServing',
  'step.selectedAction',
  'step.decisionMasks',
  'step.activeBeamSchedule',
  'step.nextBeamSchedule',
  'step.handoverEvent',
  'step.reward',
  'step.queueState',
  'step.policyDiagnostics',
  'step.angleAwareTerms',
  'step.energyEfficiencyTerms',
]);

assertLaneHasRequirements('user-trained-model-replay', [
  'entities.models',
  'step.activeBeamSchedule',
  'step.reward',
  'step.sourceGaps',
]);
assertLaneHasRequirements('training-run-replay', [
  'entities.models',
  'step.policyDiagnostics',
  'step.sourceGaps',
]);
assertLaneHasRequirements('model-comparison-replay', [
  'comparison.alignedTimebase',
  'comparison.perModelStreams',
  'comparison.aggregateMetrics',
]);

assertLaneHasSourceGaps('baseline-replay-proof', [
  'beamHopping.activeSchedule',
  'beamHopping.nextSchedule',
  'timeline.sourceRowIdentity',
  'timeline.focusUeSelection',
  'timeline.activeCellState',
  'timeline.allUeServingHistory',
  'timeline.handoverPenaltyAttribution',
  'diagnostics.denseQPolicy',
  'traffic.queueRows',
  'metrics.angleAwareTerms',
  'metrics.energyEfficiencyTerms',
  'metrics.reward',
  'diagnostics.policy',
  'provenance.claimBoundary',
]);
assertLaneHasSourceGaps('model-comparison-replay', [
  'comparison.alignedTimebase',
  'diagnostics.policy',
  'metrics.reward',
]);

assert.equal(requirement('step.activeBeamSchedule').sourceGapField, 'beamHopping.activeSchedule');
assert.equal(requirement('step.nextBeamSchedule').sourceGapField, 'beamHopping.nextSchedule');
assert.equal(requirement('step.focusUe').sourceGapField, 'timeline.focusUeSelection');
assert.equal(requirement('step.handoverEvent').sourceGapField, 'timeline.handoverPenaltyAttribution');
assert.equal(requirement('step.policyDiagnostics').sourceGapField, 'diagnostics.denseQPolicy');
assert.equal(requirement('step.queueState').sourceGapField, 'traffic.queueRows');
assert.equal(requirement('comparison.alignedTimebase').sourceGapField, 'comparison.alignedTimebase');

assertNoForbiddenScheduleAliases('step.activeBeamSchedule');
assertNoForbiddenScheduleAliases('step.nextBeamSchedule');
assert.ok(
  requirement('step.decisionMasks').note.includes('must never replace active schedule truth'),
  'decision masks are documented as masks only',
);

const displayDerived = getDisplayDerivedTrainingSceneFields();
assert.deepEqual(
  displayDerived,
  ['step.focusUe', 'step.sourceGaps'],
  'only focus selection labelling and consumer source-gap augmentation are display-derived',
);

for (const item of MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS) {
  assert.ok(item.requiredProducerPaths.length > 0, `${item.field} lists producer paths`);
  if (item.sourceGapField !== undefined) {
    assert.ok(
      MODQN_REPLAY_SOURCE_GAP_FIELDS.includes(item.sourceGapField),
      `${item.field} source gap is registered: ${item.sourceGapField}`,
    );
  }
}

const contractSource = read('src/modqn/training-scene-trace/contract.ts');
assert.ok(
  contractSource.includes("sceneLane: 'future-lane'"),
  'future training/comparison viewports are not silently added to current SceneLane',
);
assert.ok(
  contractSource.includes('profileDerivedOverlayAllowed: false'),
  'proof-like lanes explicitly reject profile-derived overlays',
);
assert.ok(
  contractSource.includes('sinrLiveVisualsAllowed: false'),
  'proof-like lanes explicitly reject SINR live visuals',
);

const sdd = read('docs/modqn-training-scene-replay-sdd.md');
assert.ok(
  sdd.includes('src/modqn/training-scene-trace/contract.ts'),
  'training scene SDD points to the typed consumer registry',
);
for (const field of [
  'timeline.sourceRowIdentity',
  'timeline.focusUeSelection',
  'timeline.activeCellState',
  'timeline.handoverPenaltyAttribution',
  'diagnostics.denseQPolicy',
  'traffic.queueRows',
  'comparison.alignedTimebase',
]) {
  assert.ok(sdd.includes(field), `training scene SDD documents source-gap field ${field}`);
}

console.log(`PASS: ${MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS.length} trace requirements validated`);
