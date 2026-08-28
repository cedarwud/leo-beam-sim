import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateLinkKey,
  createCandidateGateResult,
  createHandoverDecisionFrame,
  createMetricEvidence,
  freezeCandidateOpportunity,
  type CandidateDecisionState,
  type CandidateGateResult,
  type CandidateOpportunity,
  type HandoverDecisionFrame,
} from '../engine/handover/candidateDecisionContract';
import {
  buildCandidatePresentationPlan,
  DEFAULT_CANDIDATE_DISPLAY_BUDGET,
} from '../engine/handover/candidatePresentationPlan';
import { buildMultiCandidateScenePresentation } from '../scene/multiCandidateScenePresentation';
import type { SinrLiveCellPlacement } from './SinrLiveCellBeamCones';
import {
  MULTI_CANDIDATE_WIREFRAME_RIB_COUNT,
  buildSparseMultiCandidateConeRibs,
  groupMultiCandidateSatelliteIdentities,
  resolveMultiCandidateBeamScene,
  type MultiCandidateBeamSceneResolverInput,
} from './MultiCandidateBeamScene';

const SOURCE_FRAME_ID = 'walker-frame-multi-candidate-scene-1';

function metric(value: number, unit = 'unit') {
  return createMetricEvidence({
    status: 'available',
    value,
    unit,
    sourceFrameId: SOURCE_FRAME_ID,
    reason: null,
  });
}

function gate(code: CandidateGateResult['code'], result: CandidateGateResult['result'] = 'pass') {
  return createCandidateGateResult({
    code,
    category: code === 'ee-advantage' ? 'decision-trigger' : 'hard-qos',
    result,
    measured: result === 'pass' ? 1 : null,
    threshold: result === 'pass' ? 0 : null,
    unit: result === 'pass' ? 'unit' : null,
    reason: result === 'pass' ? null : `${code} fixture result`,
  });
}

function opportunity(satelliteId: string, beamId: number, eligible = true): CandidateOpportunity {
  const hardGateCodes: readonly CandidateGateResult['code'][] = [
    'elevation',
    'steering',
    'scheduled-illumination',
    'sinr',
    'throughput',
    'remaining-service-time',
  ];
  return freezeCandidateOpportunity({
    key: candidateLinkKey(satelliteId, beamId),
    primaryUeId: 'ue-ntpu',
    sourceFrameId: SOURCE_FRAME_ID,
    beamIdentitySource: 'walker-cell-surrogate',
    geometryClass: eligible ? 'service-eligible' : 'geometrically-reachable',
    elevation: metric(55, 'deg'),
    steering: metric(3, 'deg'),
    range: metric(850, 'km'),
    sinr: eligible ? metric(12, 'dB') : metric(-8, 'dB'),
    predictedThroughput: metric(100, 'bit/s'),
    remainingServiceTime: metric(120, 's'),
    forecastEe: null,
    gates: [
      ...hardGateCodes.map(code => gate(code, eligible ? 'pass' : code === 'sinr' ? 'fail' : 'pass')),
      gate('ee-advantage', 'unavailable'),
    ],
  });
}

function state(
  key: ReturnType<typeof candidateLinkKey>,
  options: {
    readonly stable?: boolean;
    readonly rank?: number | null;
    readonly hardEligibility?: CandidateDecisionState['hardEligibility'];
    readonly triggerStatus?: CandidateDecisionState['triggerStatus'];
  } = {},
): CandidateDecisionState {
  const stable = options.stable ?? true;
  return {
    key,
    hardEligibility: options.hardEligibility ?? 'eligible',
    triggerStatus: options.triggerStatus ?? 'satisfied',
    qualificationSec: stable ? 4 : 0,
    requiredTttSec: 3,
    stable,
    rank: stable ? (options.rank ?? 1) : null,
    rejectionCodes: options.hardEligibility === 'ineligible' ? ['sinr'] : [],
  };
}

function decision(
  serving: ReturnType<typeof candidateLinkKey> | null,
  keys: readonly ReturnType<typeof candidateLinkKey>[],
  states: readonly CandidateDecisionState[] = keys.map((key, index) => state(key, { rank: index + 1 })),
  options: {
    readonly provisionalLeader?: ReturnType<typeof candidateLinkKey> | null;
    readonly selectedTarget?: ReturnType<typeof candidateLinkKey> | null;
    readonly selectedKind?: HandoverDecisionFrame['selectedKind'];
    readonly phase?: HandoverDecisionFrame['phase'];
  } = {},
): HandoverDecisionFrame {
  return createHandoverDecisionFrame({
    episodeId: 'multi-candidate-scene-episode',
    sourceFrameId: SOURCE_FRAME_ID,
    simTimeMs: 10_000,
    phase: options.phase ?? 'evaluating',
    serving,
    opportunities: keys.map(key => opportunity(key.satelliteId, key.beamId)),
    states,
    provisionalLeader: options.provisionalLeader ?? null,
    selectedTarget: options.selectedTarget ?? null,
    selectedKind: options.selectedKind ?? null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1,
    mode: 'sinr-offset',
    recentCommit: null,
  });
}

function sceneInput(
  presentation: ReturnType<typeof buildMultiCandidateScenePresentation>,
  options: Partial<Omit<MultiCandidateBeamSceneResolverInput, 'presentation'>> = {},
): MultiCandidateBeamSceneResolverInput {
  const placements: readonly SinrLiveCellPlacement[] = [
    { cellId: 0, worldX: 0, worldZ: 0, radiusWorld: 10 },
    { cellId: 1, worldX: 24, worldZ: 4, radiusWorld: 11 },
    { cellId: 2, worldX: -22, worldZ: 5, radiusWorld: 9 },
    { cellId: 3, worldX: 4, worldZ: -22, radiusWorld: 8 },
    { cellId: 4, worldX: 25, worldZ: -20, radiusWorld: 7 },
  ];
  return {
    presentation,
    placementByCellId: new Map(placements.map(placement => [placement.cellId, placement])),
    satelliteWorldById: new Map([
      ['sat-serving', { x: 0, y: 100, z: 0 }],
      ['sat-alpha', { x: 40, y: 110, z: -10 }],
      ['sat-beta', { x: -40, y: 120, z: 12 }],
      ['sat-one', { x: 0, y: 100, z: 0 }],
      ['sat-observed', { x: 18, y: 105, z: 4 }],
      ['sat-qualified', { x: -28, y: 115, z: 6 }],
      ['sat-leader', { x: 36, y: 125, z: 10 }],
      ['sat-selected', { x: -34, y: 118, z: -8 }],
    ]),
    primaryUeWorld: { x: 2, y: 0.12, z: 1 },
    widthScale: 1,
    reducedMotion: true,
    ...options,
  };
}

test('resolves an exact surrogate cell footprint on the ground and an oblique cone', () => {
  const serving = candidateLinkKey('sat-serving', 1);
  const candidate = candidateLinkKey('sat-alpha', 2);
  const decisionFrame = decision(serving, [serving, candidate]);
  const presentation = buildMultiCandidateScenePresentation(
    buildCandidatePresentationPlan(decisionFrame),
  );
  const resolved = resolveMultiCandidateBeamScene(sceneInput(presentation, { widthScale: 1.5 }));
  const servingInstruction = resolved.instructions.find(item => item.pairKey === 'sat-serving|1');
  const candidateInstruction = resolved.instructions.find(item => item.pairKey === 'sat-alpha|2');

  assert.ok(servingInstruction);
  assert.ok(candidateInstruction);
  assert.equal(candidateInstruction?.cellId, 1, 'beam 2 must recover surrogate cell 1');
  assert.deepEqual(candidateInstruction?.baseCenter, [24, 0, 4]);
  assert.equal(candidateInstruction?.cone.baseRadiusWorld, 16.5);
  assert.equal(candidateInstruction?.cone.visible, true);
  assert.equal(candidateInstruction?.cone.volume, 1);
  assert.ok(candidateInstruction?.footprint.points.every(point => point[1] === 0.12));
  assert.deepEqual(candidateInstruction?.apex, [40, 110, -10]);
  assert.equal(servingInstruction?.link.style, 'solid-data');
  assert.equal(candidateInstruction?.link.style, 'none');
  assert.equal(candidateInstruction?.link.isSolidData, false);
  assert.equal(resolved.coneVolumeCount, 2);
  assert.equal(resolved.solidDataLinkCount, 1);
  assert.equal(resolved.telemetry.renderedSatelliteCount, 2);
});

test('maps observed, qualified, leader, and selected roles to the S5 visual grammar', () => {
  const serving = candidateLinkKey('sat-serving', 1);
  const observed = candidateLinkKey('sat-observed', 2);
  const qualified = candidateLinkKey('sat-qualified', 3);
  const leader = candidateLinkKey('sat-leader', 4);
  const selected = candidateLinkKey('sat-selected', 5);
  const decisionFrame = decision(
    serving,
    [serving, observed, qualified, leader, selected],
    [
      state(serving, { rank: 99 }),
      state(observed, {
        stable: false,
        hardEligibility: 'ineligible',
        triggerStatus: 'not-satisfied',
      }),
      state(qualified, { stable: false }),
      state(leader, { stable: true, rank: 1 }),
      state(selected, { stable: true, rank: 2 }),
    ],
    {
      provisionalLeader: leader,
      selectedTarget: selected,
      selectedKind: 'inter-satellite',
    },
  );
  const presentation = buildMultiCandidateScenePresentation(
    buildCandidatePresentationPlan(decisionFrame, {
      ...DEFAULT_CANDIDATE_DISPLAY_BUDGET,
      maxSatelliteGroups: 5,
      maxConeVolumes: 5,
    }),
  );
  const resolved = resolveMultiCandidateBeamScene(sceneInput(presentation));
  const byPair = new Map(resolved.instructions.map(item => [item.pairKey, item]));

  const observedRender = byPair.get('sat-observed|2');
  const qualifiedRender = byPair.get('sat-qualified|3');
  const leaderRender = byPair.get('sat-leader|4');
  const selectedRender = byPair.get('sat-selected|5');
  assert.equal(observedRender?.role, 'observed');
  assert.equal(observedRender?.cone.visible, false);
  assert.equal(observedRender?.cone.volume, 0);
  assert.equal(observedRender?.footprint.style, 'dotted');
  assert.equal(observedRender?.link.style, 'none');
  assert.equal(
    groupMultiCandidateSatelliteIdentities(resolved.instructions)
      .some(group => group.satelliteId === 'sat-observed'),
    false,
  );
  assert.equal(qualifiedRender?.role, 'qualified');
  assert.equal(qualifiedRender?.cone.style, 'wireframe');
  assert.equal(qualifiedRender?.footprint.style, 'dashed');
  assert.equal(qualifiedRender?.link.style, 'none');
  assert.equal(leaderRender?.role, 'provisional-leader');
  assert.equal(leaderRender?.cone.style, 'wireframe');
  assert.equal(leaderRender?.footprint.outlineCount, 2);
  assert.equal(leaderRender?.link.isMeasurementOnly, true);
  assert.equal(leaderRender?.label?.text, 'sat-leader / B4');
  assert.equal(selectedRender?.role, 'selected-target');
  assert.equal(selectedRender?.cone.style, 'low-alpha');
  assert.equal(selectedRender?.footprint.outlineCount, 2);
  assert.equal(selectedRender?.link.isSolidData, false);
  assert.equal(selectedRender?.label?.text, 'sat-selected / B5');
  assert.ok(resolved.instructions.filter(item => item.isCandidate).every(item => !item.link.isSolidData));
  assert.equal(resolved.solidDataLinkCount, 1);
});

test('makes a pinned observed pair inspectable without creating a second data link', () => {
  const serving = candidateLinkKey('sat-serving', 1);
  const observed = candidateLinkKey('sat-observed', 2);
  const decisionFrame = decision(
    serving,
    [serving, observed],
    [
      state(serving, { rank: 99 }),
      state(observed, {
        stable: false,
        hardEligibility: 'ineligible',
        triggerStatus: 'not-satisfied',
      }),
    ],
  );
  const presentation = buildMultiCandidateScenePresentation(
    buildCandidatePresentationPlan(
      decisionFrame,
      DEFAULT_CANDIDATE_DISPLAY_BUDGET,
      { pinnedKey: observed },
    ),
  );
  const resolved = resolveMultiCandidateBeamScene(sceneInput(presentation));
  const pinned = resolved.instructions.find(item => item.pairKey === 'sat-observed|2');

  assert.ok(pinned);
  assert.equal(pinned.isPinned, true);
  assert.equal(pinned.role, 'observed');
  assert.equal(pinned.cone.style, 'wireframe');
  assert.equal(pinned.cone.visible, true);
  assert.equal(pinned.cone.volume, 1);
  assert.ok(pinned.cone.opacity > 0);
  assert.equal(pinned.link.style, 'measurement-dashed');
  assert.equal(pinned.link.dashed, true);
  assert.equal(pinned.link.isMeasurementOnly, true);
  assert.equal(pinned.link.isSolidData, false);
  assert.ok(pinned.link.opacity > 0);
  assert.equal(resolved.coneVolumeCount, 2);
  assert.equal(resolved.solidDataLinkCount, 1);
});

test('replaces dense triangle wireframe with a bounded sparse rib set', () => {
  const serving = candidateLinkKey('sat-serving', 1);
  const qualified = candidateLinkKey('sat-qualified', 2);
  const presentation = buildMultiCandidateScenePresentation(
    buildCandidatePresentationPlan(
      decision(serving, [serving, qualified], [
        state(serving),
        state(qualified, { stable: true }),
      ]),
      DEFAULT_CANDIDATE_DISPLAY_BUDGET,
    ),
  );
  const resolved = resolveMultiCandidateBeamScene(sceneInput(presentation));
  const instruction = resolved.instructions.find(item => item.pairKey === 'sat-qualified|2');

  assert.ok(instruction);
  assert.equal(instruction.cone.wireframe, true);
  const ribs = buildSparseMultiCandidateConeRibs(instruction);
  assert.equal(ribs.length, MULTI_CANDIDATE_WIREFRAME_RIB_COUNT);
  assert.ok(ribs.every(([apex]) => apex === instruction.apex));
  assert.equal(new Set(ribs.map(([, base]) => base)).size, ribs.length);
  assert.throws(
    () => buildSparseMultiCandidateConeRibs(instruction, 0),
    /wireframe rib count must be a positive integer/,
  );
});

test('keeps same-satellite beam pairs separate and within the presentation budget', () => {
  const serving = candidateLinkKey('sat-one', 1);
  const beamTwo = candidateLinkKey('sat-one', 2);
  const beamThree = candidateLinkKey('sat-one', 3);
  const decisionFrame = decision(serving, [serving, beamTwo, beamThree]);
  const presentation = buildMultiCandidateScenePresentation(
    buildCandidatePresentationPlan(decisionFrame, { maxSatelliteGroups: 3, maxCandidatePairs: 6, maxConeVolumes: 3 }),
  );
  const resolved = resolveMultiCandidateBeamScene(sceneInput(presentation));
  const links = resolved.instructions.filter(item => item.satelliteId === 'sat-one');

  assert.deepEqual(links.map(item => item.pairKey), ['sat-one|1', 'sat-one|2', 'sat-one|3']);
  assert.equal(new Set(links.map(item => item.beamId)).size, 3);
  assert.equal(new Set(links.map(item => item.identity.satellite.cssColor)).size, 1);
  assert.equal(new Set(links.map(item => item.identity.beam?.cssColor)).size, 3);
  const identityGroup = groupMultiCandidateSatelliteIdentities(resolved.instructions)
    .find(group => group.satelliteId === 'sat-one');
  assert.ok(identityGroup);
  assert.deepEqual(identityGroup.beamIds, [1, 2, 3]);
  assert.deepEqual(identityGroup.pairKeys, ['sat-one|1', 'sat-one|2', 'sat-one|3']);
  assert.deepEqual(identityGroup.sceneJoinKeys, links.map(item => item.sceneJoinKey));
  assert.deepEqual(identityGroup.railJoinKeys, links.map(item => item.railJoinKey));
  assert.ok(resolved.coneVolumeCount <= presentation.budget.maxConeVolumes);
  assert.equal(resolved.instructions[0]?.sceneJoinKey, presentation.instructions[0]?.sceneJoinKey);
});

test('skips an undisplayable pair without inventing geometry or exceeding the budget', () => {
  const serving = candidateLinkKey('sat-serving', 1);
  const missing = candidateLinkKey('sat-missing', 2);
  const presentation = buildMultiCandidateScenePresentation(
    buildCandidatePresentationPlan(decision(serving, [serving, missing]), { maxSatelliteGroups: 3, maxCandidatePairs: 6, maxConeVolumes: 2 }),
  );
  const resolved = resolveMultiCandidateBeamScene(sceneInput(presentation, {
    satelliteWorldById: new Map([['sat-serving', { x: 0, y: 100, z: 0 }]]),
  }));

  assert.deepEqual(resolved.instructions.map(item => item.pairKey), ['sat-serving|1']);
  assert.equal(resolved.coneVolumeCount, 1);
  assert.equal(resolved.solidDataLinkCount, 1);
});

test('fails closed when a renderer input exceeds the satellite-group budget', () => {
  const serving = candidateLinkKey('sat-serving', 1);
  const candidate = candidateLinkKey('sat-alpha', 2);
  const presentation = buildMultiCandidateScenePresentation(
    buildCandidatePresentationPlan(
      decision(serving, [serving, candidate]),
      { maxSatelliteGroups: 2, maxCandidatePairs: 6, maxConeVolumes: 2 },
    ),
  );
  const overBudgetPresentation = {
    ...presentation,
    budget: { ...presentation.budget, maxSatelliteGroups: 1 },
  };

  assert.throws(
    () => resolveMultiCandidateBeamScene(sceneInput(overBudgetPresentation)),
    /visible satellite budget exceeded/,
  );
});
