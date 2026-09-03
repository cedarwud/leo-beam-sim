import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateLinkKey,
  createCandidateGateResult,
  createHandoverCommitReceipt,
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
  type CandidateDisplayBudget,
} from '../engine/handover/candidatePresentationPlan';
import { resolveHandoverAuthorityJoin } from './handoverAuthorityJoin';
import { buildMultiCandidateScenePresentation } from './multiCandidateScenePresentation';

const SOURCE_FRAME_ID = 'walker-frame-scene-presentation-1';

function metric(value: number, unit = 'unit') {
  return createMetricEvidence({
    status: 'available',
    value,
    unit,
    sourceFrameId: SOURCE_FRAME_ID,
    reason: null,
  });
}

function gate(code: CandidateGateResult['code']): CandidateGateResult {
  return createCandidateGateResult({
    code,
    category: code === 'ee-advantage' ? 'decision-trigger' : 'hard-qos',
    result: code === 'ee-advantage' ? 'unavailable' : 'pass',
    measured: code === 'ee-advantage' ? null : 1,
    threshold: code === 'ee-advantage' ? null : 0,
    unit: code === 'ee-advantage' ? null : 'unit',
    reason: code === 'ee-advantage' ? 'fixture does not calculate EE' : null,
  });
}

function opportunity(satelliteId: string, beamId: number): CandidateOpportunity {
  const gateCodes: readonly CandidateGateResult['code'][] = [
    'elevation',
    'steering',
    'scheduled-illumination',
    'sinr',
    'throughput',
    'remaining-service-time',
    'ee-advantage',
  ];
  return freezeCandidateOpportunity({
    key: candidateLinkKey(satelliteId, beamId),
    primaryUeId: 'ue-ntpu',
    sourceFrameId: SOURCE_FRAME_ID,
    beamIdentitySource: 'walker-cell-surrogate',
    geometryClass: 'service-eligible',
    elevation: metric(55, 'deg'),
    steering: metric(3, 'deg'),
    range: metric(850, 'km'),
    sinr: metric(12, 'dB'),
    predictedThroughput: metric(100, 'bit/s'),
    remainingServiceTime: metric(120, 's'),
    forecastEe: null,
    gates: gateCodes.map(gate),
  });
}

function state(
  key: ReturnType<typeof candidateLinkKey>,
  options: { readonly stable?: boolean; readonly rank?: number | null } = {},
): CandidateDecisionState {
  const stable = options.stable ?? true;
  return {
    key,
    hardEligibility: 'eligible',
    triggerStatus: 'satisfied',
    qualificationSec: stable ? 4 : 0,
    requiredTttSec: 3,
    stable,
    rank: stable ? (options.rank ?? 1) : null,
    rejectionCodes: [],
  };
}

function decision(
  serving: ReturnType<typeof candidateLinkKey> | null,
  keys: readonly ReturnType<typeof candidateLinkKey>[],
  options: {
    readonly episodeId?: string;
    readonly simTimeMs?: number;
    readonly recentCommit?: HandoverDecisionFrame['recentCommit'];
    readonly phase?: HandoverDecisionFrame['phase'];
    readonly selectedTarget?: ReturnType<typeof candidateLinkKey> | null;
    readonly selectedKind?: HandoverDecisionFrame['selectedKind'];
  } = {},
): HandoverDecisionFrame {
  const opportunities = keys.map(key => opportunity(key.satelliteId, key.beamId));
  return createHandoverDecisionFrame({
    episodeId: options.episodeId ?? 'scene-presentation-episode',
    sourceFrameId: SOURCE_FRAME_ID,
    simTimeMs: options.simTimeMs ?? 10_000,
    phase: options.phase ?? 'evaluating',
    serving,
    opportunities,
    states: opportunities.map((item, index) => state(item.key, {
      stable: true,
      rank: index + 1,
    })),
    provisionalLeader: serving === null ? null : keys.find(key => !sameKey(key, serving)) ?? null,
    selectedTarget: options.selectedTarget ?? null,
    selectedKind: options.selectedKind ?? null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1,
    mode: 'sinr-offset',
    recentCommit: options.recentCommit ?? null,
  });
}

function sameKey(
  left: ReturnType<typeof candidateLinkKey>,
  right: ReturnType<typeof candidateLinkKey>,
): boolean {
  return left.satelliteId === right.satelliteId && left.beamId === right.beamId;
}

function budget(overrides: Partial<CandidateDisplayBudget> = {}): CandidateDisplayBudget {
  return { ...DEFAULT_CANDIDATE_DISPLAY_BUDGET, ...overrides };
}

test('maps cross-satellite candidates by exact satellite-beam identity', () => {
  const serving = candidateLinkKey('sat-serving', 1);
  const plan = buildCandidatePresentationPlan(
    decision(serving, [
      serving,
      candidateLinkKey('sat-alpha', 2),
      candidateLinkKey('sat-beta', 4),
    ]),
  );
  const scene = buildMultiCandidateScenePresentation(plan);

  assert.deepEqual(
    scene.instructions.map(item => `${item.key.satelliteId}/${item.key.beamId}`),
    ['sat-serving/1', 'sat-alpha/2', 'sat-beta/4'],
  );
  assert.equal(scene.instructions.filter(item => item.isServing).length, 1);
  assert.equal(scene.instructions.filter(item => item.isCandidate).length, 2);
  assert.equal(scene.activeDataLinkCount, 1);
  assert.equal(scene.solidDataLinkCount, 1);
  assert.ok(scene.instructions.every(item => item.joinKey.length > 0));
  assert.ok(scene.instructions.every(item => item.sceneJoinKey === item.joinKey));
  assert.ok(scene.instructions.every(item => item.railJoinKey === item.joinKey));
});

test('keeps same-satellite multi-beam links distinct while sharing satellite identity', () => {
  const serving = candidateLinkKey('sat-one', 1);
  const plan = buildCandidatePresentationPlan(
    decision(serving, [serving, candidateLinkKey('sat-one', 2), candidateLinkKey('sat-one', 3)]),
  );
  const scene = buildMultiCandidateScenePresentation(plan);
  const links = scene.instructions.filter(item => item.satelliteId === 'sat-one');

  assert.equal(links.length, 3);
  assert.equal(new Set(links.map(item => `${item.key.satelliteId}|${item.key.beamId}`)).size, 3);
  assert.equal(new Set(links.map(item => item.satelliteIdentity.cssColor)).size, 1);
  assert.equal(new Set(links.map(item => item.beamIdentity?.cssColor)).size, 3);
  assert.ok(links.every(item => item.satelliteIdentity.cssColor === item.satelliteIdentity.threeColor));
  assert.ok(links.every(item => item.beamIdentity?.cssColor === item.beamIdentity?.threeColor));
});

test('maps overflow and pinning without exceeding the cone budget', () => {
  const serving = candidateLinkKey('sat-serving', 1);
  const keys = [
    serving,
    candidateLinkKey('sat-alpha', 1),
    candidateLinkKey('sat-beta', 1),
    candidateLinkKey('sat-gamma', 1),
    candidateLinkKey('sat-overflow', 1),
  ];
  const decisionFrame = decision(serving, keys);
  const baselinePlan = buildCandidatePresentationPlan(decisionFrame, budget({ maxConeVolumes: 3 }));
  const baselineScene = buildMultiCandidateScenePresentation(baselinePlan);
  assert.ok(baselinePlan.overflowCandidatePairCount > 0);
  assert.ok(!baselineScene.instructions.some(item => item.satelliteId === 'sat-overflow'));
  assert.ok(baselineScene.coneVolumeCount <= baselinePlan.budget.maxConeVolumes);

  const pinnedPlan = buildCandidatePresentationPlan(decisionFrame, budget({ maxConeVolumes: 3 }), {
    pinnedKey: candidateLinkKey('sat-overflow', 1),
    previousIdentityAllocation: baselinePlan.identityAllocation,
  });
  const pinnedScene = buildMultiCandidateScenePresentation(pinnedPlan);
  const pinned = pinnedScene.instructions.find(item => item.satelliteId === 'sat-overflow');
  assert.ok(pinned);
  assert.equal(pinned?.isPinned, true);
  assert.equal(pinned?.cone.style, 'wireframe');
  assert.equal(pinned?.link.style, 'measurement-dashed');
  assert.ok(pinnedScene.coneVolumeCount <= pinnedPlan.budget.maxConeVolumes);
  assert.equal(pinnedScene.activeDataLinkCount, 1);
});

test('preserves satellite and beam identity after commit', () => {
  const from = candidateLinkKey('sat-source', 3);
  const to = candidateLinkKey('sat-target', 8);
  const before = buildCandidatePresentationPlan(
    decision(from, [from, to], { episodeId: 'commit-identity-episode', simTimeMs: 10_000 }),
  );
  const beforeScene = buildMultiCandidateScenePresentation(before);
  const receipt = createHandoverCommitReceipt({
    episodeId: 'commit-identity-episode',
    sourceFrameId: SOURCE_FRAME_ID,
    simTimeMs: 11_000,
    from,
    to,
    kind: 'inter-satellite',
    mode: 'sinr-offset',
    reason: 'fixture commit',
    oldLinkEnded: true,
    newLinkStarted: true,
  });
  const after = buildCandidatePresentationPlan(
    decision(to, [from, to], {
      episodeId: 'commit-identity-episode',
      simTimeMs: 11_000,
      phase: 'guard',
      recentCommit: receipt,
    }),
    DEFAULT_CANDIDATE_DISPLAY_BUDGET,
    { previousIdentityAllocation: before.identityAllocation },
  );
  const afterScene = buildMultiCandidateScenePresentation(after);
  const beforeTarget = beforeScene.instructions.find(item => sameKey(item.key, to));
  const afterTarget = afterScene.instructions.find(item => sameKey(item.key, to));
  assert.ok(beforeTarget);
  assert.ok(afterTarget);
  assert.equal(afterTarget?.role, 'committed-serving');
  assert.equal(afterTarget?.satelliteIdentity.cssColor, beforeTarget?.satelliteIdentity.cssColor);
  assert.equal(afterTarget?.satelliteIdentity.threeColor, beforeTarget?.satelliteIdentity.threeColor);
  assert.equal(afterTarget?.beamIdentity?.cssColor, beforeTarget?.beamIdentity?.cssColor);
  assert.equal(afterTarget?.beamIdentity?.threeColor, beforeTarget?.beamIdentity?.threeColor);
  assert.equal(afterScene.activeDataLinkCount, 1);
});

test('never emits a solid data link for a candidate', () => {
  const serving = candidateLinkKey('sat-serving', 1);
  const plan = buildCandidatePresentationPlan(
    decision(serving, [serving, candidateLinkKey('sat-candidate', 2)]),
  );
  const scene = buildMultiCandidateScenePresentation(plan);

  assert.ok(scene.instructions.filter(item => item.isCandidate).every(item => !item.link.isSolidData));
  assert.ok(scene.instructions.filter(item => item.isCandidate).every(item => item.link.style !== 'solid-data'));
  assert.ok(scene.instructions.filter(item => item.isCandidate).every(item => item.link.isMeasurementOnly));
  assert.equal(scene.activeDataLinkCount, 1);
  assert.equal(scene.solidDataLinkCount, 1);
});

test('intra transition keeps same-satellite source and target as distinct role-mapped pairs', () => {
  const source = candidateLinkKey('sat-one', 1);
  const target = candidateLinkKey('sat-one', 2);
  const otherBeam = candidateLinkKey('sat-one', 3);
  const plan = buildCandidatePresentationPlan(
    decision(source, [source, target, otherBeam], {
      phase: 'switching',
      selectedTarget: target,
      selectedKind: 'intra-satellite',
    }),
  );
  const scene = buildMultiCandidateScenePresentation(plan);
  const transitionPairs = scene.instructions
    .filter(item => item.transitionRole !== null)
    .map(item => item.pairKey);

  assert.deepEqual(transitionPairs, [
    `${source.satelliteId}|${source.beamId}`,
    `${target.satelliteId}|${target.beamId}`,
  ]);
  const sourceInstruction = scene.instructions.find(item => item.pairKey === `${source.satelliteId}|${source.beamId}`);
  const targetInstruction = scene.instructions.find(item => item.pairKey === `${target.satelliteId}|${target.beamId}`);
  assert.equal(sourceInstruction?.transitionRole, 'source');
  assert.equal(targetInstruction?.transitionRole, 'target');
  assert.equal(sourceInstruction?.cone.style, 'restrained-translucent');
  assert.equal(targetInstruction?.cone.style, 'low-alpha');
  assert.notEqual(sourceInstruction?.cone.style, targetInstruction?.cone.style);
  assert.equal(targetInstruction?.footprint.style, 'double-line');
  assert.equal(targetInstruction?.link.style, 'measurement-dashed');
  assert.equal(sourceInstruction?.identity.satellite.cssColor, targetInstruction?.identity.satellite.cssColor);
  assert.notEqual(sourceInstruction?.identity.beam?.cssColor, targetInstruction?.identity.beam?.cssColor);
  assert.equal(scene.instructions.find(item => item.pairKey === `${otherBeam.satelliteId}|${otherBeam.beamId}`)?.transitionRole, null);
  assert.equal(scene.instructions.filter(item => item.isServing).length, 1);
  assert.equal(scene.solidDataLinkCount, 1);
});

test('inter transition isolates serving and accepted target while retaining qualified evidence fan-out', () => {
  const serving = candidateLinkKey('sat-serving', 1);
  const acceptedTarget = candidateLinkKey('sat-target', 1);
  const otherCandidate = candidateLinkKey('sat-other', 1);
  const plan = buildCandidatePresentationPlan(
    decision(serving, [serving, acceptedTarget, otherCandidate], {
      phase: 'switching',
      selectedTarget: acceptedTarget,
      selectedKind: 'inter-satellite',
    }),
  );
  const scene = buildMultiCandidateScenePresentation(plan);
  const transition = scene.instructions.filter(item => item.transitionRole !== null);

  assert.deepEqual(
    transition.map(item => item.pairKey),
    [
      `${serving.satelliteId}|${serving.beamId}`,
      `${acceptedTarget.satelliteId}|${acceptedTarget.beamId}`,
    ],
  );
  assert.equal(scene.instructions.find(item => item.pairKey === `${acceptedTarget.satelliteId}|${acceptedTarget.beamId}`)?.link.style, 'measurement-dashed');
  assert.equal(scene.instructions.find(item => item.pairKey === `${acceptedTarget.satelliteId}|${acceptedTarget.beamId}`)?.transitionRole, 'target');
  assert.equal(scene.instructions.find(item => item.pairKey === `${otherCandidate.satelliteId}|${otherCandidate.beamId}`)?.transitionRole, null);
  assert.equal(scene.instructions.find(item => item.pairKey === `${otherCandidate.satelliteId}|${otherCandidate.beamId}`)?.cone.style, 'wireframe');
  assert.equal(scene.candidates.length, 2);
  assert.equal(scene.solidDataLinkCount, 1);
});

test('ignores an authority join from another accepted episode', () => {
  const source = candidateLinkKey('sat-one', 1);
  const target = candidateLinkKey('sat-one', 2);
  const plan = buildCandidatePresentationPlan(
    decision(source, [source, target], {
      phase: 'switching',
      selectedTarget: target,
      selectedKind: 'intra-satellite',
    }),
  );
  const foreignJoin = resolveHandoverAuthorityJoin(
    decision(source, [source, target], {
      episodeId: 'foreign-scene-presentation-episode',
      phase: 'switching',
      selectedTarget: target,
      selectedKind: 'intra-satellite',
    }),
  );
  const scene = buildMultiCandidateScenePresentation(plan, foreignJoin);

  assert.ok(scene.instructions.every(item => item.transitionRole === null));
  assert.equal(scene.solidDataLinkCount, 1);
  assert.equal(scene.instructions.find(item => item.pairKey === `${target.satelliteId}|${target.beamId}`)?.cone.style, 'low-alpha');
});

test('full comparison scene preserves every eligible beam join from the accepted frame', () => {
  const serving = candidateLinkKey('sat-serving', 1);
  const candidates = [
    ...Array.from({ length: 7 }, (_, index) => candidateLinkKey('sat-alpha', index + 1)),
    ...Array.from({ length: 7 }, (_, index) => candidateLinkKey('sat-beta', index + 1)),
  ];
  const plan = buildCandidatePresentationPlan(
    decision(serving, [serving, ...candidates]),
    DEFAULT_CANDIDATE_DISPLAY_BUDGET,
    { displayAllHardEligibleCandidates: true, configuredBeamCount: 7 },
  );
  const scene = buildMultiCandidateScenePresentation(plan);

  assert.equal(scene.candidates.length, 14);
  assert.equal(scene.instructions.filter(item => item.isServing).length, 1);
  assert.ok(scene.instructions.every(item => item.sourceFrameId === SOURCE_FRAME_ID));
  assert.equal(new Set(scene.candidates.map(item => item.satelliteId)).size, 2);
  assert.equal(scene.solidDataLinkCount, 1);
});

test('initial attach has zero solid data links and still maps candidate cones', () => {
  const plan = buildCandidatePresentationPlan(
    decision(null, [
      candidateLinkKey('sat-alpha', 1),
      candidateLinkKey('sat-beta', 2),
    ], { phase: 'initial-attach' }),
  );
  const scene = buildMultiCandidateScenePresentation(plan);

  assert.equal(scene.activeDataLinkCount, 0);
  assert.equal(scene.solidDataLinkCount, 0);
  assert.ok(scene.instructions.every(item => item.isCandidate));
  assert.ok(scene.instructions.every(item => !item.link.isSolidData));
  assert.ok(scene.coneVolumeCount <= plan.budget.maxConeVolumes);
});
