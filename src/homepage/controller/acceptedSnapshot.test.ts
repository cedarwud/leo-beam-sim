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
  type HandoverDecisionFrame,
} from '../../engine/handover/candidateDecisionContract';
import type { HomepageHandoverDecisionBoundary } from './contracts';
import {
  buildHomepageAcceptedSnapshot,
  buildHomepageAcceptedSnapshotSession,
  createHandoverPresentationPolicyConfigHash,
} from './acceptedSnapshot';

const SOURCE_FRAME_ID = 'walker-homepage-frame-1';
const EPOCH_TOKEN = 'walker:homepage-epoch-1';
const POLICY_CONFIG_HASH = createHandoverPresentationPolicyConfigHash(
  'homepage-worker-c|offset=3|ttt=3',
);

function metric(
  value: number,
  unit: string,
  sourceFrameId = SOURCE_FRAME_ID,
) {
  return createMetricEvidence({
    status: 'available',
    value,
    unit,
    sourceFrameId,
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
    reason: code === 'ee-advantage' ? 'compatibility fixture has no forecast' : null,
  });
}

function opportunity(
  satelliteId: string,
  beamId: number,
  sourceFrameId = SOURCE_FRAME_ID,
) {
  return freezeCandidateOpportunity({
    key: candidateLinkKey(satelliteId, beamId),
    primaryUeId: 'ue-homepage',
    sourceFrameId,
    beamIdentitySource: 'walker-cell-surrogate',
    geometryClass: 'service-eligible',
    elevation: metric(45, 'deg', sourceFrameId),
    steering: metric(4, 'deg', sourceFrameId),
    range: metric(850, 'km', sourceFrameId),
    sinr: metric(12, 'dB', sourceFrameId),
    predictedThroughput: metric(100, 'bit/s', sourceFrameId),
    remainingServiceTime: metric(120, 's', sourceFrameId),
    forecastEe: null,
    gates: [
      gate('elevation'),
      gate('steering'),
      gate('scheduled-illumination'),
      gate('sinr'),
      gate('throughput'),
      gate('remaining-service-time'),
      gate('ee-advantage'),
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

function decisionFixture(): HandoverDecisionFrame {
  const pairs = [
    ['sat-home', 1],
    ['sat-alt-a', 1],
    ['sat-alt-b', 2],
  ] as const;

  return createHandoverDecisionFrame({
    episodeId: 'episode-homepage-worker-c',
    sourceFrameId: SOURCE_FRAME_ID,
    epochToken: EPOCH_TOKEN,
    simTimeMs: 1_000,
    phase: 'qualifying',
    serving: candidateLinkKey('sat-home', 1),
    opportunities: pairs.map(([satelliteId, beamId]) => opportunity(satelliteId, beamId)),
    states: pairs.map(([satelliteId, beamId], index) => state(satelliteId, beamId, index + 1)),
    provisionalLeader: candidateLinkKey('sat-alt-a', 1),
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1.5,
    mode: 'sinr-offset',
    recentCommit: null,
  });
}

function boundary(
  decision: HandoverDecisionFrame | null = decisionFixture(),
): HomepageHandoverDecisionBoundary {
  return Object.freeze({
    sourceFrameId: decision?.sourceFrameId ?? SOURCE_FRAME_ID,
    epochToken: decision?.epochToken ?? EPOCH_TOKEN,
    simTimeMs: decision?.simTimeMs ?? 1_000,
    phase: decision?.phase ?? 'qualifying',
    decision,
  });
}

function input(overrides: Partial<{
  decisionBoundary: HomepageHandoverDecisionBoundary;
  policyConfigHash: string;
}> = {}) {
  return {
    decisionBoundary: overrides.decisionBoundary ?? boundary(),
    policyConfigHash: overrides.policyConfigHash ?? POLICY_CONFIG_HASH,
  };
}

test('delegates to one deeply frozen canonical session', () => {
  const session = buildHomepageAcceptedSnapshotSession(input());
  assert.notEqual(session, null);
  if (session === null) return;

  const snapshot = session.snapshot;
  const nestedValues: readonly object[] = [
    session,
    session.interaction,
    snapshot,
    snapshot.counts,
    snapshot.decision,
    snapshot.decision.opportunities,
    snapshot.decision.opportunities[0]!,
    snapshot.decision.opportunities[0]!.gates,
    snapshot.plan,
    snapshot.plan.identityAllocation,
    snapshot.plan.groups,
    snapshot.plan.groups[0]!,
    snapshot.plan.groups[0]!.beamRoster,
    snapshot.plan.displayedLinks,
    snapshot.plan.displayedLinks[0]!,
    snapshot.plan.displayedLinks[0]!.key,
  ];

  assert.ok(nestedValues.every(value => Object.isFrozen(value)));
});

test('keeps one immutable scene/rail snapshot identity with deterministic re-publication', () => {
  const request = input();
  const first = buildHomepageAcceptedSnapshotSession(request);
  const second = buildHomepageAcceptedSnapshotSession(request);

  assert.notEqual(first, null);
  assert.notEqual(second, null);
  if (first === null || second === null) return;

  assert.equal(first.snapshot.decision, request.decisionBoundary.decision);
  assert.equal(first.snapshot.plan.decision, first.snapshot.decision);
  assert.equal(first.interaction.basedOnSnapshotId, first.snapshot.snapshotId);
  assert.equal(second.snapshot.snapshotId, first.snapshot.snapshotId);
  assert.notEqual(second.snapshot, first.snapshot);
  assert.throws(
    () => Object.defineProperty(first.snapshot, 'phase', { value: 'monitoring' }),
    TypeError,
  );
  assert.equal(first.snapshot.phase, 'qualifying');
});

test('propagates source identity, policy hash, phase, and the existing join identity', () => {
  const snapshot = buildHomepageAcceptedSnapshot(input());
  assert.notEqual(snapshot, null);
  if (snapshot === null) return;

  assert.equal(snapshot.sourceFrameId, SOURCE_FRAME_ID);
  assert.equal(snapshot.policyConfigHash, POLICY_CONFIG_HASH);
  assert.equal(snapshot.phase, 'qualifying');
  assert.equal(snapshot.decision.sourceFrameId, SOURCE_FRAME_ID);
  assert.equal(snapshot.plan.decision, snapshot.decision);

  assert.ok(snapshot.plan.displayedLinks.length >= 2);
  for (const link of snapshot.plan.displayedLinks) {
    assert.equal(link.sourceFrameId, SOURCE_FRAME_ID);
    assert.equal(link.joinKey, link.sceneJoinKey);
    assert.equal(link.joinKey, link.railJoinKey);
    assert.equal(link.key.satelliteId, link.satelliteId);
    assert.equal(link.key.beamId, link.beamId);
  }
});

test('marks the homepage EE decision as instantaneous while keeping the shared snapshot owner', () => {
  const decision = createHandoverDecisionFrame({
    ...decisionFixture(),
    mode: 'ee-optimization',
  });
  const snapshot = buildHomepageAcceptedSnapshot(input({
    decisionBoundary: boundary(decision),
  }));
  assert.notEqual(snapshot, null);
  assert.equal(snapshot?.policyMode, 'instantaneous-ee-optimization');
  assert.equal(snapshot?.activeTriggerObjective, 'instantaneous-ee-max');
  assert.equal(snapshot?.eeActivationStatus, 'active');
});

test('returns no accepted snapshot when the homepage decision boundary is empty', () => {
  assert.equal(buildHomepageAcceptedSnapshot(input({
    decisionBoundary: boundary(null),
  })), null);
  assert.equal(buildHomepageAcceptedSnapshotSession(input({
    decisionBoundary: boundary(null),
  })), null);
});

test('rejects mismatched boundary identity and prior policy identity', () => {
  const decision = decisionFixture();

  assert.throws(
    () => buildHomepageAcceptedSnapshot(input({
      decisionBoundary: {
        ...boundary(decision),
        sourceFrameId: 'stale-frame',
      },
    })),
    /decision\/sourceFrameId mismatch/,
  );

  assert.throws(
    () => buildHomepageAcceptedSnapshot(input({
      decisionBoundary: {
        ...boundary(decision),
        phase: 'monitoring',
      },
    })),
    /decision\/phase mismatch/,
  );

  const accepted = buildHomepageAcceptedSnapshot(input());
  assert.notEqual(accepted, null);
  if (accepted === null) return;
  assert.throws(
    () => buildHomepageAcceptedSnapshot({
      ...input(),
      policyConfigHash: createHandoverPresentationPolicyConfigHash('different-policy'),
      previousSnapshot: accepted,
    }),
    /previous snapshot\/policyConfigHash mismatch/,
  );
});

test('rejects a nested candidate opportunity from another source frame', () => {
  const decision = Object.freeze({
    ...decisionFixture(),
    opportunities: Object.freeze([
      opportunity('sat-home', 1, 'stale-frame'),
      opportunity('sat-alt-a', 1),
      opportunity('sat-alt-b', 2),
    ]),
  }) as HandoverDecisionFrame;

  assert.throws(
    () => buildHomepageAcceptedSnapshot(input({
      decisionBoundary: boundary(decision),
    })),
    /sourceFrameId|source frame/i,
  );
});

test('rejects an empty policy identity even when no decision is present', () => {
  assert.throws(
    () => buildHomepageAcceptedSnapshot({
      decisionBoundary: boundary(null),
      policyConfigHash: '',
    }),
    /policyConfigHash/,
  );
});

console.log('homepage accepted snapshot adapter checks pass');
