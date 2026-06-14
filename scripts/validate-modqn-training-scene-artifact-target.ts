#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MODQN_REPLAY_FORBIDDEN_BEAM_HOPPING_TRUTH_FIELDS,
} from '../src/modqn/replay-source-gaps';
import {
  MODQN_TRAINING_SCENE_ARTIFACT_TARGET_DECISION,
  MODQN_TRAINING_SCENE_DISPLAY_ARTIFACT_SCHEMA_VERSION,
  MODQN_TRAINING_SCENE_TRACE_REQUIRED_SECTIONS,
  MODQN_TRAINING_SCENE_TRACE_SCHEMA_VERSION,
  getModqnTrainingSceneTraceBlockedFields,
  getModqnTrainingSceneTraceHandoffChecklist,
} from '../src/modqn/training-scene-trace';

function read(path: string): string {
  return fs.readFileSync(path, 'utf8');
}

function assertIncludes(source: string, token: string, label: string): void {
  assert.ok(source.includes(token), `${label}: expected ${token}`);
}

console.log('validate-modqn-training-scene-artifact-target');

assert.equal(MODQN_TRAINING_SCENE_TRACE_SCHEMA_VERSION, 'modqn-training-scene-trace-v1');
assert.equal(MODQN_TRAINING_SCENE_DISPLAY_ARTIFACT_SCHEMA_VERSION, 'visual-showcase-v1');

const decision = MODQN_TRAINING_SCENE_ARTIFACT_TARGET_DECISION;
assert.equal(decision.status, 'accepted');
assert.equal(decision.producerTraceSchema, MODQN_TRAINING_SCENE_TRACE_SCHEMA_VERSION);
assert.equal(decision.displayArtifactSchema, MODQN_TRAINING_SCENE_DISPLAY_ARTIFACT_SCHEMA_VERSION);
assert.equal(decision.producerTraceRole, 'producer-training-trace');
assert.equal(decision.displayArtifactRole, 'display-replay-artifact');
assert.equal(decision.sourceTruthOwner, 'modqn-paper-reproduction');
assert.equal(decision.validationOracle, 'ntn-sim-core');
assert.equal(decision.consumerRole, 'leo-beam-sim-read-only-renderer');
assert.equal(decision.visualShowcasePolicy, 'derive-after-producer-trace-validation');
assert.ok(
  decision.rejectedAlternatives.some(item => item.target === 'extend-visual-showcase-v1-directly'),
  'direct visual-showcase extension is a rejected first-step alternative',
);
assert.ok(
  decision.rejectedAlternatives.some(item => item.target === 'infer-training-trace-in-leo-beam-sim'),
  'leo-side trace inference is rejected',
);
assert.ok(
  decision.rejectedAlternatives.some(item => item.target === 'reuse-phase03a-replay-bundle-as-scene-trace'),
  'phase03a replay bundle reuse as scene trace is rejected',
);

assert.deepEqual(MODQN_TRAINING_SCENE_TRACE_REQUIRED_SECTIONS, [
  'schemaVersion',
  'run',
  'provenance',
  'environment',
  'entities',
  'timeline',
  'sourceGaps',
  'comparison',
]);

const checklist = getModqnTrainingSceneTraceHandoffChecklist();
assert.equal(checklist.length, 41, 'handoff checklist mirrors the 41-field trace contract');
assert.ok(
  checklist.some(item => item.field === 'step.activeBeamSchedule'),
  'handoff checklist includes active beam schedule',
);
assert.ok(
  checklist.some(item => item.field === 'step.queueState'),
  'handoff checklist includes per-UE queue state',
);
assert.ok(
  checklist.some(item => item.field === 'step.nextBeamSchedule'),
  'handoff checklist includes next beam schedule',
);
assert.ok(
  checklist.some(item => item.field === 'comparison.alignedTimebase'),
  'handoff checklist includes comparison alignment',
);

for (const field of ['step.activeBeamSchedule', 'step.nextBeamSchedule'] as const) {
  const item = checklist.find(requirement => requirement.field === field);
  assert.ok(item, `${field} exists`);
  const paths = item.requiredProducerPaths.join('\n');
  for (const forbidden of MODQN_REPLAY_FORBIDDEN_BEAM_HOPPING_TRUTH_FIELDS) {
    assert.ok(!paths.includes(forbidden), `${field} must not use ${forbidden} as producer truth`);
  }
}

const blockedFields = getModqnTrainingSceneTraceBlockedFields();
assert.ok(blockedFields.length >= 35, 'most trace fields remain fail-closed without producer truth');
assert.ok(
  blockedFields.every(item => item.sourceGapWhenAbsent),
  'blocked field helper only returns fields that source-gap when absent',
);

const adr = read('docs/decisions/ADR-002-modqn-training-scene-trace-artifact-target.md');
assertIncludes(adr, 'modqn-training-scene-trace-v1', 'ADR names selected trace schema');
assertIncludes(adr, 'visual-showcase-v1', 'ADR names display artifact schema');
assertIncludes(adr, 'selectedServing', 'ADR keeps selectedServing boundary visible');
assertIncludes(adr, 'decisionActionValidityMask', 'ADR keeps mask boundary visible');
assertIncludes(adr, 'validate:modqn:training-scene-artifact-target', 'ADR names validator');

const sdd = read('docs/modqn-training-scene-replay-sdd.md');
assertIncludes(sdd, 'ADR-002', 'SDD links ADR-002 decision');
assertIncludes(sdd, 'src/modqn/training-scene-trace/artifactTarget.ts', 'SDD links typed target decision');
assertIncludes(sdd, 'modqn-training-scene-trace-v1', 'SDD names selected trace schema');
assertIncludes(sdd, 'visual-showcase-v1', 'SDD keeps visual-showcase role visible');

const packageJson = read('package.json');
assertIncludes(
  packageJson,
  'validate:modqn:training-scene-artifact-target',
  'package exposes artifact target validator',
);

console.log(JSON.stringify({
  result: 'PASS',
  producerTraceSchema: decision.producerTraceSchema,
  displayArtifactSchema: decision.displayArtifactSchema,
  requiredSectionCount: MODQN_TRAINING_SCENE_TRACE_REQUIRED_SECTIONS.length,
  handoffFieldCount: checklist.length,
}, null, 2));
