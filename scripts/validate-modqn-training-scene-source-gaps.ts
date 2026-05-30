#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MODQN_REPLAY_FORBIDDEN_BEAM_HOPPING_TRUTH_FIELDS,
  MODQN_REPLAY_SOURCE_GAP_FIELDS,
  MODQN_REPLAY_SOURCE_GAP_SURFACES,
  createCurrentModqnReplayProofSourceGaps,
  isForbiddenBeamHoppingTruthAlias,
  sourceGapCountByPolicy,
} from '../src/modqn/replay-source-gaps';

function read(path: string): string {
  return fs.readFileSync(path, 'utf8');
}

function assertIncludes<T>(values: readonly T[], value: T, message: string): void {
  assert.ok(values.includes(value), message);
}

function assertNotIncludes(source: string, token: string, message: string): void {
  assert.ok(!source.includes(token), message);
}

console.log('validate-modqn-training-scene-source-gaps');

const requiredFields = [
  'beamHopping.activeSchedule',
  'beamHopping.nextSchedule',
  'entities.ues.positionTrace',
  'entities.satellites.trajectory',
  'entities.beams.footprints',
  'timeline.allUeServingHistory',
  'timeline.frequencyReuseGroups',
  'metrics.angleAwareTerms',
  'metrics.energyEfficiencyTerms',
  'metrics.reward',
  'diagnostics.policy',
  'provenance.claimBoundary',
] as const;

for (const field of requiredFields) {
  assertIncludes(MODQN_REPLAY_SOURCE_GAP_FIELDS, field, `source-gap field is registered: ${field}`);
}

for (const surface of [
  'viewport',
  'focus-panel',
  'angle-energy-panel',
  'timeline',
  'comparison',
  'evidence-panel',
  'canvas-telemetry',
] as const) {
  assertIncludes(MODQN_REPLAY_SOURCE_GAP_SURFACES, surface, `source-gap surface is registered: ${surface}`);
}

for (const field of [
  'selectedServing',
  'previousServing',
  'actionValidityMask',
  'decisionActionValidityMask',
] as const) {
  assertIncludes(
    MODQN_REPLAY_FORBIDDEN_BEAM_HOPPING_TRUTH_FIELDS,
    field,
    `forbidden beam-hopping truth alias is registered: ${field}`,
  );
  assert.ok(isForbiddenBeamHoppingTruthAlias(field), `alias helper rejects beam-hopping inference from ${field}`);
}

const currentGaps = createCurrentModqnReplayProofSourceGaps();
assert.ok(currentGaps.length >= 7, 'current replay proof gaps include the SDD-minimum source-gap set');
assert.equal(
  sourceGapCountByPolicy(currentGaps, 'fail-closed'),
  currentGaps.length,
  'current replay proof source gaps all fail closed',
);

const activeScheduleGap = currentGaps.find(gap => gap.field === 'beamHopping.activeSchedule');
assert.ok(activeScheduleGap, 'current replay proof includes active schedule source gap');
assert.equal(activeScheduleGap?.claimImpact, 'no-beam-hopping-animation');
assert.equal(activeScheduleGap?.owner, 'modqn-paper-reproduction');

const nextScheduleGap = currentGaps.find(gap => gap.field === 'beamHopping.nextSchedule');
assert.ok(nextScheduleGap, 'current replay proof includes next schedule source gap');
assert.equal(nextScheduleGap?.claimImpact, 'no-next-beam-preview');
assert.equal(nextScheduleGap?.owner, 'modqn-paper-reproduction');

const sourceGapModel = read('src/modqn/replay-source-gaps/sourceGaps.ts');
assertNotIncludes(
  sourceGapModel,
  "requiredProducerField: 'selectedServing",
  'selectedServing must not be a required producer field for schedule truth',
);
assertNotIncludes(
  sourceGapModel,
  "requiredProducerField: 'previousServing",
  'previousServing must not be a required producer field for schedule truth',
);
assertNotIncludes(
  sourceGapModel,
  "requiredProducerField: 'decisionActionValidityMask",
  'decisionActionValidityMask must not be a required producer field for schedule truth',
);
assertNotIncludes(
  sourceGapModel,
  "requiredProducerField: 'actionValidityMask",
  'actionValidityMask must not be a required producer field for schedule truth',
);

const sceneVisuals = read('src/scene/modqnReplaySceneVisuals.ts');
assert.ok(
  sceneVisuals.includes('No active-beam mask or beam hopping schedule is exported'),
  'replay scene truth audit keeps active schedule as missing producer truth',
);
assert.ok(
  sceneVisuals.includes('Do not animate beam hopping'),
  'replay scene truth audit fail-closes beam hopping animation',
);

const replayTelemetry = read('src/scene/modqn-replay-visuals/useReplaySceneTelemetry.tsx');
assert.ok(
  replayTelemetry.includes("data-handover-story-fake-beam-hopping', '0'"),
  'replay telemetry explicitly rejects fake beam hopping',
);

const sdd = read('docs/modqn-training-scene-replay-sdd.md');
assert.ok(
  sdd.includes('Do not infer beam hopping from `selectedServing`, `previousServing`'),
  'training scene replay SDD keeps serving/mask inference ban visible',
);

console.log(`PASS: ${currentGaps.length} current replay proof source gaps validated`);
