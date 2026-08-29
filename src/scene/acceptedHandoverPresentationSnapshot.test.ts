import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateLinkKey,
  createCandidateGateResult,
  createHandoverDecisionFrame,
  createHandoverCommitReceipt,
  createMetricEvidence,
  freezeCandidateOpportunity,
  type CandidateDecisionState,
  type CandidateGateResult,
  type HandoverDecisionFrame,
} from '../engine/handover/candidateDecisionContract';
import {
  buildAcceptedHandoverPresentationSession,
  createHandoverPresentationPolicyConfigHash,
} from './acceptedHandoverPresentationSnapshot';
import { buildCandidateSceneRenderReceipt } from './candidateSceneRenderReceipt';
import type { MultiCandidateBeamSceneRenderPlan } from '../viz/MultiCandidateBeamScene';

function metric(sourceFrameId: string, value: number, unit: string) {
  return createMetricEvidence({
    status: 'available',
    value,
    unit,
    sourceFrameId,
    reason: null,
  });
}

function gate(
  code: CandidateGateResult['code'],
  result: CandidateGateResult['result'] = 'pass',
) {
  return createCandidateGateResult({
    code,
    category: code === 'ee-advantage' ? 'decision-trigger' : 'hard-qos',
    result,
    measured: result === 'unavailable' ? null : 1,
    threshold: result === 'unavailable' ? null : 0,
    unit: result === 'unavailable' ? null : 'unit',
    reason: result === 'pass' ? null : `${code} is unavailable in the compatibility fixture`,
  });
}

function opportunity(sourceFrameId: string, satelliteId: string, beamId: number) {
  return freezeCandidateOpportunity({
    key: candidateLinkKey(satelliteId, beamId),
    primaryUeId: 'ue-ntpu',
    sourceFrameId,
    beamIdentitySource: 'walker-cell-surrogate',
    geometryClass: 'service-eligible',
    elevation: metric(sourceFrameId, 45, 'deg'),
    steering: metric(sourceFrameId, 4, 'deg'),
    range: metric(sourceFrameId, 850, 'km'),
    sinr: metric(sourceFrameId, 12, 'dB'),
    predictedThroughput: metric(sourceFrameId, 100, 'bit/s'),
    remainingServiceTime: metric(sourceFrameId, 120, 's'),
    forecastEe: null,
    gates: [
      gate('elevation'),
      gate('steering'),
      gate('scheduled-illumination'),
      gate('sinr'),
      gate('throughput'),
      gate('remaining-service-time'),
      gate('ee-advantage', 'unavailable'),
    ],
  });
}

function state(satelliteId: string, beamId: number, rank: number): CandidateDecisionState {
  return {
    key: candidateLinkKey(satelliteId, beamId),
    hardEligibility: 'eligible',
    triggerStatus: 'satisfied',
    qualificationSec: 4,
    requiredTttSec: 3,
    stable: true,
    rank,
    rejectionCodes: [],
  };
}

function decisionFixture(
  sourceFrameId = 'walker-frame-1',
  includeEpochToken = true,
  simTimeMs = sourceFrameId === 'walker-frame-1' ? 1_000 : 2_000,
): HandoverDecisionFrame {
  const pairs = [
    ['sat-a', 1],
    ['sat-a', 2],
    ['sat-b', 1],
    ['sat-b', 2],
    ['sat-c', 1],
  ] as const;
  return createHandoverDecisionFrame({
    episodeId: 'episode-accepted-snapshot',
    sourceFrameId,
    epochToken: includeEpochToken ? 'walker:epoch-1' : undefined,
    simTimeMs,
    phase: 'qualifying',
    serving: candidateLinkKey('sat-a', 1),
    opportunities: pairs.map(([satelliteId, beamId]) => opportunity(sourceFrameId, satelliteId, beamId)),
    states: pairs.map(([satelliteId, beamId], index) => state(satelliteId, beamId, index + 1)),
    provisionalLeader: candidateLinkKey('sat-b', 1),
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1.5,
    mode: 'sinr-offset',
    recentCommit: null,
  });
}

const policyConfigHash = createHandoverPresentationPolicyConfigHash('profile-a|offset=3|ttt=3');

test('builds one deterministic frozen snapshot with exactly one shared plan', () => {
  const decision = decisionFixture();
  const first = buildAcceptedHandoverPresentationSession({
    decision,
    policyConfigHash,
    pinnedKey: null,
  });
  const second = buildAcceptedHandoverPresentationSession({
    decision,
    policyConfigHash,
    pinnedKey: null,
  });

  assert.equal(first.snapshot.snapshotId, second.snapshot.snapshotId);
  assert.equal(first.snapshot.decision, decision);
  assert.equal(first.snapshot.plan.decision, decision);
  assert.equal(first.snapshot.activeDataLinkCount, 1);
  assert.equal(first.snapshot.serving?.key.satelliteId, 'sat-a');
  assert.equal(first.snapshot.servingOrigin, 'bootstrap-serving-seed');
  assert.equal(first.snapshot.counts.observed, 4);
  assert.equal(first.snapshot.counts.displayed + first.snapshot.counts.overflow, 4);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.snapshot));
  assert.ok(Object.isFrozen(first.snapshot.plan));
  assert.ok(first.snapshot.plan.displayedLinks.every(link => (
    link.joinKey === link.sceneJoinKey && link.joinKey === link.railJoinKey
  )));
});

test('pinning changes publication identity without changing the scientific frame', () => {
  const decision = decisionFixture();
  const baseline = buildAcceptedHandoverPresentationSession({ decision, policyConfigHash, pinnedKey: null });
  const pinned = buildAcceptedHandoverPresentationSession({
    decision,
    policyConfigHash,
    pinnedKey: candidateLinkKey('sat-c', 1),
    previousSnapshot: baseline.snapshot,
  });

  assert.notEqual(pinned.snapshot.snapshotId, baseline.snapshot.snapshotId);
  assert.equal(pinned.snapshot.decision, baseline.snapshot.decision);
  assert.deepEqual(pinned.interaction.pinnedKey, candidateLinkKey('sat-c', 1));
  assert.equal(pinned.interaction.basedOnSnapshotId, pinned.snapshot.snapshotId);
  assert.equal(
    pinned.snapshot.plan.groups.find(group => group.satelliteId === 'sat-a')?.satelliteIdentity.cssColor,
    baseline.snapshot.plan.groups.find(group => group.satelliteId === 'sat-a')?.satelliteIdentity.cssColor,
  );
});

test('preserves episode identity and serving origin across the next accepted source frame', () => {
  const first = buildAcceptedHandoverPresentationSession({
    decision: decisionFixture(),
    policyConfigHash,
    pinnedKey: null,
  });
  const next = buildAcceptedHandoverPresentationSession({
    decision: decisionFixture('walker-frame-2'),
    policyConfigHash,
    pinnedKey: null,
    previousSnapshot: first.snapshot,
  });

  assert.notEqual(next.snapshot.snapshotId, first.snapshot.snapshotId);
  assert.equal(next.snapshot.servingOrigin, first.snapshot.servingOrigin);
  for (const group of next.snapshot.plan.groups) {
    const previous = first.snapshot.plan.groups.find(candidate => candidate.satelliteId === group.satelliteId);
    if (previous !== undefined) assert.equal(group.satelliteIdentity.cssColor, previous.satelliteIdentity.cssColor);
  }
});

test('retains the authoritative commit only while its target remains the current service', () => {
  const base = decisionFixture();
  const target = candidateLinkKey('sat-b', 1);
  const receipt = createHandoverCommitReceipt({
    episodeId: base.episodeId,
    sourceFrameId: base.sourceFrameId,
    simTimeMs: base.simTimeMs,
    from: base.serving,
    to: target,
    kind: 'inter-satellite',
    mode: 'sinr-offset',
    reason: 'accepted snapshot retention fixture',
    oldLinkEnded: true,
    newLinkStarted: true,
  });
  const committedDecision = createHandoverDecisionFrame({
    ...base,
    phase: 'guard',
    serving: target,
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    recentCommit: receipt,
  });
  const committed = buildAcceptedHandoverPresentationSession({
    decision: committedDecision,
    policyConfigHash,
    pinnedKey: null,
  });
  assert.deepEqual(committed.snapshot.commit, receipt);

  const nextBase = decisionFixture('walker-frame-2');
  const nextDecision = createHandoverDecisionFrame({
    ...nextBase,
    phase: 'monitoring',
    serving: target,
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    recentCommit: null,
  });
  const retained = buildAcceptedHandoverPresentationSession({
    decision: nextDecision,
    policyConfigHash,
    pinnedKey: null,
    previousSnapshot: committed.snapshot,
  });
  assert.equal(retained.snapshot.commit, committed.snapshot.commit);

  const rewoundBase = decisionFixture('walker-frame-rewound', true, 500);
  const rewoundDecision = createHandoverDecisionFrame({
    ...rewoundBase,
    serving: target,
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
  });
  const rewound = buildAcceptedHandoverPresentationSession({
    decision: rewoundDecision,
    policyConfigHash,
    pinnedKey: null,
    previousSnapshot: retained.snapshot,
  });
  assert.equal(rewound.snapshot.commit, null);

  const changedService = buildAcceptedHandoverPresentationSession({
    decision: decisionFixture('walker-frame-3', true, 3_000),
    policyConfigHash,
    pinnedKey: null,
    previousSnapshot: retained.snapshot,
  });
  assert.equal(changedService.snapshot.commit, null);
});

test('fails closed when the decision epoch identity is absent', () => {
  assert.throws(
    () => buildAcceptedHandoverPresentationSession({
      decision: decisionFixture('walker-frame-1', false),
      policyConfigHash,
      pinnedKey: null,
    }),
    /decision\.epochToken must be non-empty/,
  );
});

test('acknowledges actual scene joins against the accepted snapshot identity', () => {
  const session = buildAcceptedHandoverPresentationSession({
    decision: decisionFixture(),
    policyConfigHash,
    pinnedKey: null,
  });
  const mapped = session.snapshot.plan.displayedLinks.slice(0, 2);
  const renderPlan = {
    instructions: mapped.map(link => ({ sceneJoinKey: link.sceneJoinKey })),
    unmappedPairs: [{
      satelliteId: 'sat-c',
      beamId: 1,
      sourceFrameId: session.snapshot.sourceFrameId,
      reason: 'missing-satellite-world',
    }],
    solidDataLinkCount: 1,
  } as unknown as MultiCandidateBeamSceneRenderPlan;

  const receipt = buildCandidateSceneRenderReceipt({
    snapshot: session.snapshot,
    renderPlan,
    eventCueCount: 1,
  });

  assert.equal(receipt.snapshotId, session.snapshot.snapshotId);
  assert.equal(receipt.sourceFrameId, session.snapshot.sourceFrameId);
  assert.deepEqual(receipt.renderedSceneJoinKeys, mapped.map(link => link.sceneJoinKey));
  assert.deepEqual(receipt.unmappedPairs, [{
    key: candidateLinkKey('sat-c', 1),
    reason: 'missing-satellite-world',
  }]);
  assert.equal(receipt.solidDataLinkCount, 1);
  assert.equal(receipt.eventCueCount, 1);
  assert.ok(Object.isFrozen(receipt));
});

test('rejects a scene receipt from a different accepted source frame', () => {
  const session = buildAcceptedHandoverPresentationSession({
    decision: decisionFixture(),
    policyConfigHash,
    pinnedKey: null,
  });
  const renderPlan = {
    instructions: [],
    unmappedPairs: [{
      satelliteId: 'sat-c',
      beamId: 1,
      sourceFrameId: 'stale-frame',
      reason: 'missing-satellite-world',
    }],
    solidDataLinkCount: 1,
  } as unknown as MultiCandidateBeamSceneRenderPlan;

  assert.throws(
    () => buildCandidateSceneRenderReceipt({
      snapshot: session.snapshot,
      renderPlan,
      eventCueCount: 0,
    }),
    /does not match accepted source/,
  );
});
