#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MODQN_REPLAY_FORBIDDEN_BEAM_HOPPING_TRUTH_FIELDS,
} from '../src/modqn/replay-source-gaps';
import {
  MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS,
  countCurrentTrainingSceneTraceCoverageByStatus,
  getBestCurrentTrainingSceneTraceCoverage,
  getCurrentTrainingSceneTraceCoverage,
  getCurrentTrainingSceneTraceCoverageForField,
  type ModqnTrainingSceneCoverageStatus,
  type ModqnTrainingSceneInventorySource,
  type ModqnTrainingSceneTraceField,
} from '../src/modqn/training-scene-trace';

function read(path: string): string {
  return fs.readFileSync(path, 'utf8');
}

function coverage(
  source: ModqnTrainingSceneInventorySource,
  field: ModqnTrainingSceneTraceField,
) {
  const item = getCurrentTrainingSceneTraceCoverage(source).find(entry => entry.field === field);
  assert.ok(item, `${source} coverage exists for ${field}`);
  return item;
}

function assertCoverage(
  source: ModqnTrainingSceneInventorySource,
  field: ModqnTrainingSceneTraceField,
  status: ModqnTrainingSceneCoverageStatus,
): void {
  assert.equal(coverage(source, field).status, status, `${source} ${field} coverage status`);
}

function assertCurrentPathsInclude(
  source: ModqnTrainingSceneInventorySource,
  field: ModqnTrainingSceneTraceField,
  token: string,
): void {
  const joined = coverage(source, field).currentConsumerPaths.join('\n');
  assert.ok(joined.includes(token), `${source} ${field} paths include ${token}`);
}

function assertNoScheduleAliasCoverage(
  source: ModqnTrainingSceneInventorySource,
  field: ModqnTrainingSceneTraceField,
): void {
  const item = coverage(source, field);
  const paths = item.currentConsumerPaths.join('\n');
  for (const forbidden of MODQN_REPLAY_FORBIDDEN_BEAM_HOPPING_TRUTH_FIELDS) {
    assert.ok(
      !paths.includes(forbidden),
      `${source} ${field} must not use ${forbidden} as beam schedule coverage`,
    );
  }
}

console.log('validate-modqn-training-scene-trace-inventory');

const sources = [
  'phase03a-replay-bundle',
  'user-trained-manifest',
  'visual-showcase-v1',
] as const satisfies readonly ModqnTrainingSceneInventorySource[];

for (const source of sources) {
  const sourceCoverage = getCurrentTrainingSceneTraceCoverage(source);
  assert.equal(
    sourceCoverage.length,
    MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS.length,
    `${source} has one coverage entry per trace requirement`,
  );
  for (const requirement of MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS) {
    const item = sourceCoverage.find(entry => entry.field === requirement.field);
    assert.ok(item, `${source} includes ${requirement.field}`);
    if (item.status === 'source-gap') {
      assert.equal(item.currentConsumerPaths.length, 0, `${source} ${requirement.field} source-gap has no paths`);
      assert.equal(
        item.sourceGapField,
        requirement.sourceGapField,
        `${source} ${requirement.field} source-gap follows contract mapping`,
      );
    } else {
      assert.ok(item.currentConsumerPaths.length > 0, `${source} ${requirement.field} covered status lists paths`);
    }
  }
}

assertCoverage('phase03a-replay-bundle', 'provenance.schemaVersion', 'producer-backed');
assertCoverage('phase03a-replay-bundle', 'provenance.claimBoundary', 'producer-backed');
assertCoverage('phase03a-replay-bundle', 'step.previousServing', 'producer-backed');
assertCoverage('phase03a-replay-bundle', 'step.selectedServing', 'producer-backed');
assertCoverage('phase03a-replay-bundle', 'step.selectedAction', 'partial-producer-backed');
assertCoverage('phase03a-replay-bundle', 'step.decisionMasks', 'producer-backed');
assertCoverage('phase03a-replay-bundle', 'step.focusUe', 'display-derived');
assertCoverage('phase03a-replay-bundle', 'step.activeBeamSchedule', 'source-gap');
assertCoverage('phase03a-replay-bundle', 'step.nextBeamSchedule', 'source-gap');
assertCoverage('phase03a-replay-bundle', 'step.allUePositions', 'source-gap');
assertCoverage('phase03a-replay-bundle', 'step.allUeServingHistory', 'source-gap');
assertCoverage('phase03a-replay-bundle', 'step.angleAwareTerms', 'source-gap');
assertCoverage('phase03a-replay-bundle', 'step.energyEfficiencyTerms', 'source-gap');
assertCurrentPathsInclude('phase03a-replay-bundle', 'step.selectedAction', 'timelineRows[].action');
assert.ok(
  coverage('phase03a-replay-bundle', 'step.selectedAction').note.includes('display identity alias'),
  'phase03a selected action coverage keeps display alias caveat',
);

assertCoverage('user-trained-manifest', 'provenance.runIdentity', 'partial-producer-backed');
assertCoverage('user-trained-manifest', 'provenance.claimBoundary', 'producer-backed');
assertCoverage('user-trained-manifest', 'provenance.seedSet', 'partial-producer-backed');
assertCoverage('user-trained-manifest', 'environment.objectiveWeights', 'producer-backed');
assertCoverage('user-trained-manifest', 'environment.algorithmFlags', 'partial-producer-backed');
assertCoverage('user-trained-manifest', 'entities.models', 'partial-producer-backed');
assertCoverage('user-trained-manifest', 'step.activeBeamSchedule', 'source-gap');
assertCoverage('user-trained-manifest', 'step.reward', 'source-gap');
assertCurrentPathsInclude('user-trained-manifest', 'provenance.claimBoundary', 'effectivenessClaimAuthorized');

assertCoverage('visual-showcase-v1', 'provenance.schemaVersion', 'producer-backed');
assertCoverage('visual-showcase-v1', 'provenance.producerRevision', 'producer-backed');
assertCoverage('visual-showcase-v1', 'provenance.claimBoundary', 'producer-backed');
assertCoverage('visual-showcase-v1', 'environment.frequencyReuse', 'producer-backed');
assertCoverage('visual-showcase-v1', 'entities.satellites', 'producer-backed');
assertCoverage('visual-showcase-v1', 'entities.beams', 'producer-backed');
assertCoverage('visual-showcase-v1', 'entities.ues', 'producer-backed');
assertCoverage('visual-showcase-v1', 'step.satelliteState', 'producer-backed');
assertCoverage('visual-showcase-v1', 'step.beamFootprints', 'producer-backed');
assertCoverage('visual-showcase-v1', 'step.allUePositions', 'producer-backed');
assertCoverage('visual-showcase-v1', 'step.allUeServingHistory', 'producer-backed');
assertCoverage('visual-showcase-v1', 'step.selectedAction', 'producer-backed');
assertCoverage('visual-showcase-v1', 'step.reward', 'producer-backed');
assertCoverage('visual-showcase-v1', 'step.policyDiagnostics', 'producer-backed');
assertCoverage('visual-showcase-v1', 'step.activeBeamSchedule', 'source-gap');
assertCoverage('visual-showcase-v1', 'step.nextBeamSchedule', 'source-gap');
assertCoverage('visual-showcase-v1', 'step.energyEfficiencyTerms', 'partial-producer-backed');
assertCurrentPathsInclude('visual-showcase-v1', 'step.handoverEvent', 'timeline[].handoverState.kind');

for (const source of sources) {
  assertNoScheduleAliasCoverage(source, 'step.activeBeamSchedule');
  assertNoScheduleAliasCoverage(source, 'step.nextBeamSchedule');
}

assert.equal(
  getBestCurrentTrainingSceneTraceCoverage('step.activeBeamSchedule').status,
  'source-gap',
  'no current source covers active beam schedule truth',
);
assert.equal(
  getBestCurrentTrainingSceneTraceCoverage('step.nextBeamSchedule').status,
  'source-gap',
  'no current source covers next beam schedule truth',
);
assert.equal(
  getBestCurrentTrainingSceneTraceCoverage('step.allUePositions').source,
  'visual-showcase-v1',
  'visual-showcase-v1 is current best source for all-UE positions',
);
assert.equal(
  getBestCurrentTrainingSceneTraceCoverage('step.focusUe').status,
  'display-derived',
  'focus UE remains display-derived until producer focus selection exists',
);
assert.equal(
  getBestCurrentTrainingSceneTraceCoverage('comparison.alignedTimebase').status,
  'source-gap',
  'comparison alignment remains a source gap',
);

const phase03Counts = countCurrentTrainingSceneTraceCoverageByStatus('phase03a-replay-bundle');
assert.ok(phase03Counts['source-gap'] > phase03Counts['producer-backed'], 'phase03 bundle is not scene-complete');
const visualShowcaseCounts = countCurrentTrainingSceneTraceCoverageByStatus('visual-showcase-v1');
assert.ok(
  visualShowcaseCounts['producer-backed'] > phase03Counts['producer-backed'],
  'visual-showcase-v1 currently covers more scene replay fields than phase03 bundle',
);

const inventorySource = read('src/modqn/training-scene-trace/inventory.ts');
assert.ok(
  inventorySource.includes("'phase03a-replay-bundle'"),
  'inventory names phase03 replay bundle source',
);
assert.ok(
  inventorySource.includes("'user-trained-manifest'"),
  'inventory names user-trained manifest source',
);
assert.ok(
  inventorySource.includes("'visual-showcase-v1'"),
  'inventory names visual-showcase-v1 source',
);
assert.ok(
  inventorySource.includes('selectedServing.beamIndex is only a display identity alias'),
  'inventory keeps selectedServing display-alias caveat',
);

const sdd = read('docs/modqn-training-scene-replay-sdd.md');
assert.ok(
  sdd.includes('src/modqn/training-scene-trace/inventory.ts'),
  'training scene SDD points to the current coverage inventory',
);

console.log(JSON.stringify({
  result: 'PASS',
  requirementCount: MODQN_TRAINING_SCENE_TRACE_REQUIREMENTS.length,
  sources: Object.fromEntries(sources.map(source => [
    source,
    countCurrentTrainingSceneTraceCoverageByStatus(source),
  ])),
}, null, 2));
