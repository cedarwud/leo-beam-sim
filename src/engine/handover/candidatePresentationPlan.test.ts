import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateLinkKey,
  createCandidateGateResult,
  createMetricEvidence,
  createHandoverDecisionFrame,
  freezeCandidateOpportunity,
  sameCandidateLinkKey,
  type CandidateDecisionState,
  type CandidateGateResult,
  type CandidateOpportunity,
  type HandoverDecisionFrame,
} from './candidateDecisionContract';
import {
  buildCandidatePresentationPlan,
  DEFAULT_CANDIDATE_DISPLAY_BUDGET,
  type CandidateDisplayBudget,
} from './candidatePresentationPlan';

const SOURCE_FRAME_ID = 'walker-frame-0001';
const EPISODE_ID = 'episode-presentation-fixture';

function metric(value: number, unit = 'unit') {
  return createMetricEvidence({
    status: 'available',
    value,
    unit,
    sourceFrameId: SOURCE_FRAME_ID,
    reason: null,
  });
}

function gate(
  code: CandidateGateResult['code'],
  result: CandidateGateResult['result'] = 'pass',
): CandidateGateResult {
  const isEe = code === 'ee-advantage';
  return createCandidateGateResult({
    code,
    category: isEe ? 'decision-trigger' : 'hard-qos',
    result,
    measured: result === 'pass' ? 1 : null,
    threshold: result === 'pass' ? 0 : null,
    unit: result === 'pass' ? 'unit' : null,
    reason: result === 'pass' ? null : `${code} did not pass in fixture`,
  });
}

function opportunity(
  satelliteId: string,
  beamId: number,
  options: { readonly hardPass?: boolean } = {},
): CandidateOpportunity {
  const hardPass = options.hardPass ?? true;
  const hardGates: readonly CandidateGateResult['code'][] = [
    'elevation',
    'steering',
    'scheduled-illumination',
    'sinr',
    'throughput',
    'remaining-service-time',
  ];
  const gates = hardGates.map(code => gate(code, hardPass ? 'pass' : code === 'sinr' ? 'fail' : 'pass'));
  return freezeCandidateOpportunity({
    key: candidateLinkKey(satelliteId, beamId),
    primaryUeId: 'ue-ntpu',
    sourceFrameId: SOURCE_FRAME_ID,
    beamIdentitySource: 'walker-cell-surrogate',
    geometryClass: hardPass ? 'service-eligible' : 'scheduled-and-illuminated',
    elevation: metric(45, 'deg'),
    steering: metric(4, 'deg'),
    range: metric(850, 'km'),
    sinr: hardPass ? metric(12, 'dB') : metric(-4, 'dB'),
    predictedThroughput: metric(hardPass ? 100 : 0, 'bit/s'),
    remainingServiceTime: metric(120, 's'),
    forecastEe: null,
    gates: [
      ...gates,
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
  const stable = options.stable ?? false;
  const hardEligibility = options.hardEligibility ?? 'eligible';
  const triggerStatus = options.triggerStatus ?? 'satisfied';
  return {
    key,
    hardEligibility,
    triggerStatus,
    qualificationSec: stable ? 4 : 1,
    requiredTttSec: 3,
    stable,
    rank: stable ? (options.rank ?? 1) : null,
    rejectionCodes: hardEligibility === 'ineligible' ? ['sinr'] : [],
  };
}

function decisionFixture(): HandoverDecisionFrame {
  const serving = candidateLinkKey('sat-a', 1);
  const opportunities = [
    opportunity('sat-a', 1),
    opportunity('sat-a', 2),
    opportunity('sat-a', 3),
    opportunity('sat-b', 1),
    opportunity('sat-b', 2),
    opportunity('sat-c', 1),
    opportunity('sat-d', 1),
  ];
  return createHandoverDecisionFrame({
    episodeId: EPISODE_ID,
    sourceFrameId: SOURCE_FRAME_ID,
    simTimeMs: 10_000,
    phase: 'selection-hold',
    serving,
    opportunities,
    states: [
      state(serving, { stable: true, rank: 99 }),
      state(candidateLinkKey('sat-a', 2), { stable: true, rank: 3 }),
      state(candidateLinkKey('sat-a', 3), { stable: false }),
      state(candidateLinkKey('sat-b', 1), { stable: true, rank: 1 }),
      state(candidateLinkKey('sat-b', 2), { stable: true, rank: 2 }),
      state(candidateLinkKey('sat-c', 1), { stable: false }),
      state(candidateLinkKey('sat-d', 1), {
        stable: false,
        hardEligibility: 'ineligible',
        triggerStatus: 'not-satisfied',
      }),
    ],
    provisionalLeader: candidateLinkKey('sat-b', 1),
    selectedTarget: candidateLinkKey('sat-b', 1),
    selectedKind: 'inter-satellite',
    selectionHoldSec: 0.5,
    selectionHoldRequiredSec: 1.5,
    mode: 'sinr-offset',
    recentCommit: null,
  });
}

function budget(overrides: Partial<CandidateDisplayBudget> = {}): CandidateDisplayBudget {
  return {
    ...DEFAULT_CANDIDATE_DISPLAY_BUDGET,
    ...overrides,
  };
}

test('groups mixed intra/inter pairs, preserves priority, and exposes one active link', () => {
  const decision = decisionFixture();
  const decisionSnapshot = JSON.stringify(decision);
  const plan = buildCandidatePresentationPlan(decision, DEFAULT_CANDIDATE_DISPLAY_BUDGET);

  assert.equal(plan.decision, decision);
  assert.equal(plan.scientificOpportunityCount, 7);
  assert.equal(plan.scientificCandidatePairCount, 6);
  assert.deepEqual(plan.scientificCandidateKeys.map(key => `${key.satelliteId}/${key.beamId}`), [
    'sat-a/2', 'sat-a/3', 'sat-b/1', 'sat-b/2', 'sat-c/1', 'sat-d/1',
  ]);
  assert.equal(plan.groups.length, 3);
  assert.deepEqual(plan.groups.map(group => group.satelliteId), ['sat-a', 'sat-b', 'sat-c']);
  assert.deepEqual(plan.groups.map(group => group.displayedCandidatePairCount), [2, 2, 1]);
  assert.equal(plan.hiddenCandidatePairCount, 1);
  assert.equal(plan.hiddenSatelliteGroupCount, 1);
  assert.equal(plan.overflow.hiddenCandidatePairCount, 1);
  assert.equal(plan.overflow.hiddenSatelliteGroupCount, 1);
  assert.equal(plan.activeDataLinkCount, 1);

  const serving = plan.displayedLinks.find(link => link.isServing);
  assert.ok(serving);
  assert.equal(serving.role, 'serving');
  assert.equal(serving.visual.dataLinkStyle, 'solid-data');
  assert.equal(serving.visual.isMeasurementOnly, false);
  assert.equal(serving.visual.isActiveDataLink, true);
  assert.equal(serving.displayKey, 'sat-a / B1 / C1');
  const candidates = plan.displayedLinks.filter(link => link.isCandidate);
  assert.equal(candidates.length, 5);
  assert.ok(candidates.every(link => link.visual.isMeasurementOnly));
  assert.ok(candidates.every(link => !link.visual.isActiveDataLink));
  assert.ok(candidates.every(link => link.displayKey.includes(` / B${link.beamId} / C${link.beamId}`)));
  assert.equal(candidates.find(link => link.key.satelliteId === 'sat-b' && link.beamId === 1)?.role, 'selected-target');
  assert.equal(candidates.find(link => link.key.satelliteId === 'sat-a' && link.beamId === 2)?.role, 'qualified');
  assert.equal(
    candidates.find(link => link.key.satelliteId === 'sat-a' && link.beamId === 2)?.visual.dataLinkStyle,
    'measurement-dashed',
  );
  assert.equal(candidates.find(link => link.key.satelliteId === 'sat-d') ?? null, null);

  const satABeams = plan.groups[0]!.links.filter(link => link.isCandidate);
  assert.equal(satABeams[0]!.satelliteIdentity.cssColor, satABeams[1]!.satelliteIdentity.cssColor);
  assert.notEqual(satABeams[0]!.beamIdentity?.cssColor, satABeams[1]!.beamIdentity?.cssColor);
  assert.equal(satABeams[0]!.sceneJoinKey, satABeams[0]!.railJoinKey);
  assert.equal(JSON.stringify(decision), decisionSnapshot);
});

test('evaluating reveals observed alternatives as ground-cell cues without raising a line cage', () => {
  const baseline = decisionFixture();
  const observedStates = baseline.states.map(candidate => ({
    ...candidate,
    hardEligibility: candidate.key.satelliteId === baseline.serving?.satelliteId
      && candidate.key.beamId === baseline.serving.beamId
      ? candidate.hardEligibility
      : 'ineligible' as const,
    triggerStatus: 'not-satisfied' as const,
    qualificationSec: 0,
    stable: false,
    rank: null,
  }));
  const evaluating = createHandoverDecisionFrame({
    ...baseline,
    phase: 'evaluating',
    states: observedStates,
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
  });
  const evaluatingPlan = buildCandidatePresentationPlan(evaluating);
  const observed = evaluatingPlan.displayedLinks.filter(link => link.role === 'observed');

  assert.ok(observed.length >= 2);
  assert.ok(observed.every(link => link.visual.coneStyle === 'hidden'));
  assert.ok(observed.every(link => link.visual.dataLinkStyle === 'none'));
  assert.ok(observed.every(link => link.visual.isMeasurementOnly));
  assert.equal(evaluatingPlan.activeDataLinkCount, 1);

  const monitoring = createHandoverDecisionFrame({
    ...evaluating,
    phase: 'monitoring',
  });
  const monitoringObserved = buildCandidatePresentationPlan(monitoring)
    .displayedLinks.filter(link => link.role === 'observed');
  assert.ok(monitoringObserved.every(link => link.visual.coneStyle === 'hidden'));
  assert.ok(monitoringObserved.every(link => link.visual.dataLinkStyle === 'none'));
});

test('hard-eligible pairs remain visible before their active trigger is satisfied', () => {
  const baseline = decisionFixture();
  const target = candidateLinkKey('sat-c', 1);
  const decision = createHandoverDecisionFrame({
    ...baseline,
    phase: 'evaluating',
    states: baseline.states.map(candidate => sameCandidateLinkKey(candidate.key, target)
      ? {
          ...candidate,
          hardEligibility: 'eligible' as const,
          triggerStatus: 'not-satisfied' as const,
          qualificationSec: 0,
          stable: false,
          rank: null,
        }
      : candidate),
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
  });
  const link = buildCandidatePresentationPlan(decision).displayedLinks.find(candidate => (
    sameCandidateLinkKey(candidate.key, target)
  ));

  assert.ok(link);
  assert.equal(link.role, 'hard-eligible');
  assert.equal(link.visual.coneStyle, 'wireframe');
  assert.equal(link.visual.dataLinkStyle, 'measurement-dashed');
  assert.equal(link.visual.isMeasurementOnly, true);
  assert.equal(link.visual.isActiveDataLink, false);
});

test('reserves distinct eligible satellite identities before observed decoration when caps permit', () => {
  const serving = candidateLinkKey('sat-serving', 1);
  const eligibleA = candidateLinkKey('sat-eligible-a', 2);
  const eligibleB = candidateLinkKey('sat-eligible-b', 3);
  const observed = candidateLinkKey('sat-observed', 4);
  const keys = [serving, eligibleA, eligibleB, observed];
  const opportunities = keys.map(key => opportunity(key.satelliteId, key.beamId));
  const decision = createHandoverDecisionFrame({
    episodeId: 'eligible-satellite-reservation-episode',
    sourceFrameId: SOURCE_FRAME_ID,
    simTimeMs: 12_000,
    phase: 'evaluating',
    serving,
    opportunities,
    states: [
      state(serving, { stable: true, rank: 99 }),
      state(eligibleA, { stable: true, rank: 1 }),
      state(eligibleB, { stable: false, rank: null }),
      state(observed, {
        stable: false,
        hardEligibility: 'ineligible',
        triggerStatus: 'not-satisfied',
      }),
    ],
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1,
    mode: 'sinr-offset',
    recentCommit: null,
  });

  const plan = buildCandidatePresentationPlan(decision, budget({
    maxSatelliteGroups: 3,
    maxCandidatePairs: 2,
    maxConeVolumes: 3,
  }));
  const displayedCandidates = plan.displayedLinks.filter(link => link.isCandidate);

  assert.deepEqual(
    displayedCandidates.map(link => link.satelliteId).sort(),
    ['sat-eligible-a', 'sat-eligible-b'],
  );
  assert.ok(displayedCandidates.every(link => (
    link.role === 'qualified' || link.role === 'hard-eligible'
      ? link.visual.dataLinkStyle === 'measurement-dashed'
      : true
  )));
  assert.equal(plan.activeDataLinkCount, 1);
});

test('enforces the seven-cone scene cap independently of scientific candidates', () => {
  const serving = candidateLinkKey('sat-a', 1);
  const candidateKeys = [
    ...[2, 3, 4].map(beamId => candidateLinkKey('sat-a', beamId)),
    ...[1, 2, 3].map(beamId => candidateLinkKey('sat-b', beamId)),
    ...[1, 2, 3].map(beamId => candidateLinkKey('sat-c', beamId)),
  ];
  const opportunities = [opportunity('sat-a', 1), ...candidateKeys.map(key => opportunity(key.satelliteId, key.beamId))];
  const states = opportunities.map((item, index) => state(item.key, {
    stable: index > 0,
    rank: index > 0 ? index : 99,
  }));
  const decision = createHandoverDecisionFrame({
    episodeId: 'seven-volume-episode',
    sourceFrameId: SOURCE_FRAME_ID,
    simTimeMs: 20_000,
    phase: 'evaluating',
    serving,
    opportunities,
    states,
    provisionalLeader: candidateKeys[0]!,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1,
    mode: 'sinr-offset',
    recentCommit: null,
  });
  const plan = buildCandidatePresentationPlan(decision, budget({ maxCandidatePairs: 20, maxConeVolumes: 7 }));

  assert.equal(plan.scientificCandidatePairCount, 9);
  assert.equal(plan.displayedCandidatePairCount, 6);
  assert.equal(plan.displayedLinks.length, 7);
  assert.ok(plan.displayedLinks.length <= 7);
  assert.ok(plan.groups.every(group => group.links.filter(link => link.isCandidate).length <= 2));
  assert.equal(plan.activeDataLinkCount, 1);
});

test('pinning a hidden pair swaps only the bounded display subset and reports the swap', () => {
  const decision = decisionFixture();
  const baseline = buildCandidatePresentationPlan(decision, DEFAULT_CANDIDATE_DISPLAY_BUDGET);
  const pinnedKey = candidateLinkKey('sat-d', 1);
  const pinned = buildCandidatePresentationPlan(decision, DEFAULT_CANDIDATE_DISPLAY_BUDGET, {
    pinnedKey,
    previousIdentityAllocation: baseline.identityAllocation,
  });

  assert.equal(pinned.decision, decision);
  assert.equal(baseline.pinnedKey, null);
  assert.deepEqual(pinned.pinnedKey, pinnedKey);
  assert.ok(pinned.pinSwap);
  assert.equal(pinned.pinSwap?.wasHiddenBeforePin, true);
  assert.equal(pinned.pinSwap?.isVisibleAfterPin, true);
  assert.ok(pinned.pinSwap?.evictedKey);
  const pinnedLink = pinned.displayedLinks.find(link => link.isPinned && link.key.satelliteId === 'sat-d');
  assert.ok(pinnedLink);
  assert.equal(pinnedLink.visual.coneStyle, 'wireframe');
  assert.equal(pinnedLink.visual.dataLinkStyle, 'measurement-dashed');
  assert.ok(!pinned.displayedLinks.some(link => link.key.satelliteId === pinned.pinSwap?.evictedKey?.satelliteId
    && link.beamId === pinned.pinSwap?.evictedKey?.beamId));
  assert.equal(pinned.activeDataLinkCount, 1);
  const retainedSatelliteIds = baseline.groups
    .map(group => group.satelliteId)
    .filter(satelliteId => pinned.groups.some(group => group.satelliteId === satelliteId));
  for (const satelliteId of retainedSatelliteIds) {
    assert.equal(
      pinned.identityAllocation.identitiesBySatelliteId[satelliteId]?.cssColor,
      baseline.identityAllocation.identitiesBySatelliteId[satelliteId]?.cssColor,
    );
  }
  const evictedSatelliteId = pinned.pinSwap?.evictedKey?.satelliteId;
  if (evictedSatelliteId !== undefined
    && !pinned.groups.some(group => group.satelliteId === evictedSatelliteId)) {
    assert.equal(pinned.identityAllocation.assignments[evictedSatelliteId], undefined);
  }
  assert.deepEqual(decision.serving, candidateLinkKey('sat-a', 1));
  assert.equal(decision.opportunities.length, 7);
});

test('initial attach has no active data link while retaining bounded candidate groups', () => {
  const keys = [
    candidateLinkKey('sat-a', 1),
    candidateLinkKey('sat-b', 1),
    candidateLinkKey('sat-c', 1),
    candidateLinkKey('sat-d', 1),
  ];
  const opportunities = keys.map(key => opportunity(key.satelliteId, key.beamId));
  const decision = createHandoverDecisionFrame({
    episodeId: 'initial-attach-episode',
    sourceFrameId: SOURCE_FRAME_ID,
    simTimeMs: 30_000,
    phase: 'initial-attach',
    serving: null,
    opportunities,
    states: opportunities.map(item => state(item.key, { stable: false })),
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1,
    mode: 'sinr-offset',
    recentCommit: null,
  });
  const plan = buildCandidatePresentationPlan(decision, DEFAULT_CANDIDATE_DISPLAY_BUDGET);

  assert.equal(plan.activeDataLinkCount, 0);
  assert.equal(plan.groups.length, 3);
  assert.equal(plan.displayedCandidatePairCount, 3);
  assert.ok(plan.displayedLinks.every(link => link.isCandidate));
  assert.ok(plan.displayedLinks.every(link => link.visual.dataLinkStyle !== 'solid-data'));
  assert.equal(plan.hiddenCandidatePairCount, 1);
  assert.equal(plan.hiddenSatelliteGroupCount, 1);
});

test('more than eight same-satellite beams remain scientific candidates while only two are displayed', () => {
  const serving = candidateLinkKey('sat-many-beams', 1);
  const candidateKeys = Array.from(
    { length: 10 },
    (_, index) => candidateLinkKey('sat-many-beams', index + 2),
  );
  const opportunities = [
    opportunity(serving.satelliteId, serving.beamId),
    ...candidateKeys.map(key => opportunity(key.satelliteId, key.beamId)),
  ];
  const decision = createHandoverDecisionFrame({
    episodeId: 'many-beam-presentation-episode',
    sourceFrameId: SOURCE_FRAME_ID,
    simTimeMs: 40_000,
    phase: 'evaluating',
    serving,
    opportunities,
    states: opportunities.map((item, index) => state(item.key, {
      stable: index > 0,
      rank: index > 0 ? index : 99,
    })),
    provisionalLeader: candidateKeys[0]!,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1,
    mode: 'sinr-offset',
    recentCommit: null,
  });
  const plan = buildCandidatePresentationPlan(decision);

  assert.equal(plan.scientificCandidatePairCount, 10);
  assert.equal(plan.displayedCandidatePairCount, 2);
  assert.equal(plan.hiddenCandidatePairCount, 8);
  assert.equal(plan.groups[0]?.links.filter(link => link.isCandidate).length, 2);
  assert.equal(
    Object.keys(plan.identityAllocation.beamAssignmentsBySatelliteId['sat-many-beams'] ?? {}).length,
    3,
  );
});

test('hidden scientific satellites cannot exhaust colours used by the bounded display set', () => {
  const serving = candidateLinkKey('sat-serving', 1);
  const hiddenSatelliteIds = Array.from(
    { length: 10 },
    (_, index) => `sat-${String.fromCharCode('a'.charCodeAt(0) + index)}`,
  );
  const candidateKeys = [
    ...hiddenSatelliteIds.map(satelliteId => candidateLinkKey(satelliteId, 1)),
    candidateLinkKey('sat-y', 1),
    candidateLinkKey('sat-z', 1),
  ];
  const opportunities = [
    opportunity(serving.satelliteId, serving.beamId),
    ...candidateKeys.map(key => opportunity(key.satelliteId, key.beamId)),
  ];
  const decision = createHandoverDecisionFrame({
    episodeId: 'display-palette-pressure-episode',
    sourceFrameId: SOURCE_FRAME_ID,
    simTimeMs: 50_000,
    phase: 'selection-hold',
    serving,
    opportunities,
    states: opportunities.map(item => state(item.key, {
      stable: true,
      rank: item.key.satelliteId === 'sat-z'
        ? 1
        : item.key.satelliteId === 'sat-y'
          ? 2
          : 20 + candidateKeys.findIndex(key => key.satelliteId === item.key.satelliteId),
    })),
    provisionalLeader: candidateLinkKey('sat-z', 1),
    selectedTarget: candidateLinkKey('sat-z', 1),
    selectedKind: 'inter-satellite',
    selectionHoldSec: 1,
    selectionHoldRequiredSec: 1,
    mode: 'sinr-offset',
    recentCommit: null,
  });

  const plan = buildCandidatePresentationPlan(decision);
  const displayedIdentities = plan.groups.map(group => group.satelliteIdentity);

  assert.deepEqual(plan.groups.map(group => group.satelliteId), [
    'sat-serving',
    'sat-z',
    'sat-y',
  ]);
  assert.equal(new Set(displayedIdentities.map(identity => identity.cssColor)).size, plan.groups.length);
  assert.ok(displayedIdentities.every(identity => !identity.isOverflow));
  assert.deepEqual(
    Object.keys(plan.identityAllocation.assignments).sort(),
    plan.groups.map(group => group.satelliteId).sort(),
  );
  assert.equal(plan.scientificSatelliteGroupCount, 13);
});
