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
  'timeline.sourceRowIdentity',
  'timeline.focusUeSelection',
  'timeline.activeCellState',
  'timeline.allUeServingHistory',
  'timeline.handoverPenaltyAttribution',
  'timeline.frequencyReuseGroups',
  'metrics.angleAwareTerms',
  'metrics.energyEfficiencyTerms',
  'metrics.reward',
  'diagnostics.policy',
  'diagnostics.denseQPolicy',
  'traffic.queueRows',
  'comparison.alignedTimebase',
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

const focusUeGap = currentGaps.find(gap => gap.field === 'timeline.focusUeSelection');
assert.ok(focusUeGap, 'current replay proof includes producer focus UE source gap');
assert.equal(focusUeGap?.claimImpact, 'no-producer-focus-ue-selection');

const activeCellGap = currentGaps.find(gap => gap.field === 'timeline.activeCellState');
assert.ok(activeCellGap, 'current replay proof includes active cell state source gap');
assert.equal(activeCellGap?.claimImpact, 'no-active-cell-state');

const penaltyGap = currentGaps.find(gap => gap.field === 'timeline.handoverPenaltyAttribution');
assert.ok(penaltyGap, 'current replay proof includes handover penalty attribution source gap');
assert.equal(penaltyGap?.claimImpact, 'no-handover-penalty-attribution');

const denseQGap = currentGaps.find(gap => gap.field === 'diagnostics.denseQPolicy');
assert.ok(denseQGap, 'current replay proof includes dense-Q policy source gap');
assert.equal(denseQGap?.claimImpact, 'no-dense-q-proof');
assert.equal(denseQGap?.policy, 'fail-closed');

const queueGap = currentGaps.find(gap => gap.field === 'traffic.queueRows');
assert.ok(queueGap, 'current replay proof includes producer queue rows source gap');
assert.equal(queueGap?.claimImpact, 'no-producer-queue-proof');
assert.equal(queueGap?.policy, 'fail-closed');

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

const replayCuePanel = read('src/ui/ModqnReplayCuePanel.tsx');
assert.ok(
  replayCuePanel.includes('createCurrentModqnReplayProofSourceGaps'),
  'MODQN replay cue panel consumes the canonical source-gap model',
);
assert.ok(
  replayCuePanel.includes('const showReplaySourceGaps = proofViewportActive && replaySourceGaps.length > 0'),
  'MODQN replay cue panel gates source-gap list to the proof viewport lane',
);
assert.ok(
  replayCuePanel.includes('data-testid="modqn-replay-source-gap-list"'),
  'MODQN replay cue panel exposes a source-gap list test hook',
);
assert.ok(
  replayCuePanel.includes('data-source-gap-field={gap.field}'),
  'MODQN replay cue panel exposes stable source-gap field ids',
);
assert.ok(
  replayCuePanel.includes('data-source-gap-policy={gap.policy}'),
  'MODQN replay cue panel exposes stable source-gap policy ids',
);
assert.ok(
  replayCuePanel.includes('buildModqnReplayHandoverCinemaGate'),
  'MODQN replay cue panel consumes the D6 handover-cinema readiness gate',
);
assert.ok(
  replayCuePanel.includes('data-testid="modqn-replay-cinema-readiness"'),
  'MODQN replay cue panel exposes stable D6 readiness test hook',
);
for (const field of [
  'timeline.sourceRowIdentity',
  'timeline.focusUeSelection',
  'timeline.activeCellState',
  'timeline.handoverPenaltyAttribution',
  'diagnostics.denseQPolicy',
  'traffic.queueRows',
] as const) {
  assert.ok(replayCuePanel.includes(field), `MODQN replay cue panel labels trace source gap ${field}`);
}

const replayCinemaGate = read('src/modqn/replay-bundle/replayHandoverCinemaGate.ts');
assert.ok(
  replayCinemaGate.includes('buildModqnDenseQProof'),
  'D6 replay handover cinema gate requires the dense-Q proof adapter',
);
for (const field of [
  'timeline.sourceRowIdentity',
  'entities.ues.positionTrace',
  'entities.satellites.trajectory',
  'entities.beams.footprints',
  'metrics.reward',
  'diagnostics.denseQPolicy',
] as const) {
  assert.ok(replayCinemaGate.includes(field), `D6 replay handover cinema gate can emit source gap ${field}`);
}
assertNotIncludes(
  replayCinemaGate,
  'liveWalker',
  'D6 replay handover cinema gate must not read live Walker state',
);
assertNotIncludes(
  replayCinemaGate,
  'sinr',
  'D6 replay handover cinema gate must not read live SINR state',
);
assertNotIncludes(
  replayCinemaGate,
  '../scene',
  'D6 replay handover cinema gate must not depend on renderer fallback state',
);

// The ModqnEvidenceTab source-gap LIST render (and its dedicated browser gate)
// were retired with the wall-of-text Evidence rail. The canonical source-gap
// MODEL contract above is the durable invariant; the proof-level source-gap
// disclosure now lives on the DecisionViz dense-Q card.

const sdd = read('docs/modqn-training-scene-replay-sdd.md');
assert.ok(
  sdd.includes('Do not infer beam hopping from `selectedServing`, `previousServing`'),
  'training scene replay SDD keeps serving/mask inference ban visible',
);

console.log(`PASS: ${currentGaps.length} current replay proof source gaps validated`);
