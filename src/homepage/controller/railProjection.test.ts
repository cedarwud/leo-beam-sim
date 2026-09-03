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
  type HandoverDecisionFrame,
} from '../../engine/handover/candidateDecisionContract';
import {
  buildAcceptedHandoverPresentationSession,
  createHandoverPresentationPolicyConfigHash,
} from '../../scene/acceptedHandoverPresentationSnapshot';
import { projectHomepageRail } from './railProjection';

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
): CandidateGateResult {
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
  sourceFrameId: string,
  satelliteId: string,
  beamId: number,
  eeBitsPerJoule = beamId === 1 ? 300_000 : 200_000,
) {
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
    instantaneousEe: metric(sourceFrameId, eeBitsPerJoule, 'bit/J'),
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
    ['sat-a', 1],
    ['sat-a', 2],
    ['sat-b', 1],
    ['sat-b', 2],
    ['sat-c', 1],
    ['sat-c', 2],
    ['sat-d', 1],
    ['sat-d', 2],
  ] as const;
  const sourceFrameId = 'walker-frame-rail-1';

  return createHandoverDecisionFrame({
    episodeId: 'episode-rail-projection',
    sourceFrameId,
    epochToken: 'walker:epoch-rail',
    simTimeMs: 1_000,
    phase: 'qualifying',
    serving: candidateLinkKey('sat-a', 1),
    opportunities: pairs.map(([satelliteId, beamId]) => (
      opportunity(sourceFrameId, satelliteId, beamId)
    )),
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

function acceptedSnapshot() {
  return buildAcceptedHandoverPresentationSession({
    decision: decisionFixture(),
    policyConfigHash: createHandoverPresentationPolicyConfigHash('rail-projection-fixture'),
    pinnedKey: null,
    displayAllHardEligibleCandidates: false,
  }).snapshot;
}

function acceptedSnapshotForDecision(decision: HandoverDecisionFrame) {
  return buildAcceptedHandoverPresentationSession({
    decision,
    policyConfigHash: createHandoverPresentationPolicyConfigHash('rail-projection-fixture'),
    pinnedKey: null,
    instantaneousEeActive: true,
    displayAllHardEligibleCandidates: false,
  }).snapshot;
}

test('preserves accepted identity and the same snapshot-owned references', () => {
  const snapshot = acceptedSnapshot();
  const rail = projectHomepageRail(snapshot);

  assert.equal(rail.snapshotId, snapshot.snapshotId);
  assert.equal(rail.sourceFrameId, snapshot.sourceFrameId);
  assert.equal(rail.phase, snapshot.phase);
  assert.equal(rail.decision, snapshot.decision);
  assert.equal(rail.policyConfigHash, snapshot.policyConfigHash);
  assert.equal(rail.serving, snapshot.serving);
  assert.equal(rail.candidates, snapshot.candidates);
  assert.equal(rail.overflowKeys, snapshot.overflowKeys);
  assert.equal(rail.counts, snapshot.counts);
  assert.equal(rail.activeDataLinkCount, snapshot.activeDataLinkCount);
  assert.ok(Object.isFrozen(rail));
});

test('preserves accepted displayed and overflow counts without recalculating them', () => {
  const snapshot = acceptedSnapshot();
  const rail = projectHomepageRail(snapshot);

  assert.equal(rail.counts.observed, 7);
  assert.equal(rail.counts.displayed + rail.counts.overflow, rail.counts.observed);
  assert.equal(rail.counts.overflow, snapshot.overflowKeys.length);
  assert.ok(rail.counts.overflow > 0, 'fixture should exercise the overflow path');
});

test('keeps every displayed serving/candidate link joined to the same source frame', () => {
  const rail = projectHomepageRail(acceptedSnapshot());
  const links = [rail.serving, ...rail.candidates];

  assert.ok(rail.serving !== null);
  assert.ok(links.every(link => link !== null));
  for (const link of links) {
    assert.equal(link?.sourceFrameId, rail.sourceFrameId);
    assert.equal(link?.joinKey, link?.sceneJoinKey);
    assert.equal(link?.joinKey, link?.railJoinKey);
  }
});

test('retains exactly one active data link, owned by serving', () => {
  const rail = projectHomepageRail(acceptedSnapshot());
  const links = [rail.serving, ...rail.candidates].filter(
    (link): link is NonNullable<typeof link> => link !== null,
  );
  const activeLinks = links.filter(link => link.visual.isActiveDataLink);

  assert.equal(rail.activeDataLinkCount, 1);
  assert.equal(activeLinks.length, 1);
  assert.equal(activeLinks[0], rail.serving);
  assert.ok(rail.candidates.every(link => !link.visual.isActiveDataLink));
});

test('retains the accepted EE-max story through a commit when prior evidence is temporarily omitted', () => {
  const source = candidateLinkKey('sat-a', 1);
  const target = candidateLinkKey('sat-b', 1);
  const beforeSourceFrameId = 'walker-frame-rail-before-commit';
  const afterSourceFrameId = 'walker-frame-rail-after-commit';
  const beforeDecision = createHandoverDecisionFrame({
    episodeId: 'episode-rail-commit',
    sourceFrameId: beforeSourceFrameId,
    epochToken: 'walker:epoch-rail-commit',
    simTimeMs: 1_000,
    phase: 'selection-hold',
    serving: source,
    opportunities: [
      opportunity(beforeSourceFrameId, 'sat-a', 1, 200_000),
      opportunity(beforeSourceFrameId, 'sat-b', 1, 300_000),
      opportunity(beforeSourceFrameId, 'sat-c', 2, 250_000),
    ],
    states: [
      state('sat-a', 1, 2),
      state('sat-b', 1, 1),
      state('sat-c', 2, 3),
    ],
    provisionalLeader: target,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 1,
    selectionHoldRequiredSec: 1.5,
    mode: 'ee-optimization',
    recentCommit: null,
  });
  const beforeSnapshot = acceptedSnapshotForDecision(beforeDecision);
  const beforeRail = projectHomepageRail(beforeSnapshot);

  const commit = createHandoverCommitReceipt({
    episodeId: 'episode-rail-commit',
    sourceFrameId: afterSourceFrameId,
    simTimeMs: 2_000,
    from: source,
    to: target,
    kind: 'inter-satellite',
    mode: 'ee-optimization',
    reason: 'fixture commit',
    oldLinkEnded: true,
    newLinkStarted: true,
  });
  const afterDecision = createHandoverDecisionFrame({
    episodeId: 'episode-rail-commit',
    sourceFrameId: afterSourceFrameId,
    epochToken: 'walker:epoch-rail-commit',
    simTimeMs: 2_000,
    phase: 'switching',
    // The current decision has only the new serving link. The immutable prior
    // snapshot is therefore the only permitted display source for the
    // candidate roster while this accepted transition receipt is visible.
    serving: target,
    opportunities: [opportunity(afterSourceFrameId, 'sat-b', 1, 300_000)],
    states: [state('sat-b', 1, 1)],
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 1.5,
    mode: 'ee-optimization',
    recentCommit: commit,
  });
  const afterSnapshot = acceptedSnapshotForDecision(afterDecision);
  const rail = projectHomepageRail(afterSnapshot, {
    previousSnapshot: beforeSnapshot,
    previousStory: beforeRail.handoverStory,
  });

  assert.ok(beforeRail.handoverStory);
  assert.ok(rail.handoverStory);
  assert.equal(rail.handoverStory.snapshotId, afterSnapshot.snapshotId);
  assert.equal(rail.handoverStory.sourceFrameId, afterSnapshot.sourceFrameId);
  assert.deepEqual(rail.handoverStory.source, source);
  assert.deepEqual(rail.handoverStory.target, target);
  assert.equal(rail.handoverStory.selectionStatus, 'committed');
  assert.equal(rail.handoverStory.targetIsWinner, true);
  assert.equal(rail.handoverStory.winnerBasis, 'instantaneous-ee-max');
  assert.deepEqual(rail.handoverStory.winner, target);
  assert.equal(rail.handoverStory.sourceEeBitsPerJoule, 200_000);
  assert.equal(rail.handoverStory.targetEeBitsPerJoule, 300_000);
  assert.equal(rail.handoverStory.winnerEeBitsPerJoule, 300_000);
  assert.equal(rail.candidates.length, 0, 'current accepted snapshot has no candidate link after commit');
  assert.equal(rail.visibleCandidates?.length, beforeSnapshot.candidates.length);
  assert.equal(rail.candidateRosterRetained, true);
  assert.equal(rail.candidateRosterSourceFrameId, beforeSnapshot.sourceFrameId);
  assert.equal(rail.handoverStory.qualifiedCandidateSatelliteCount, 2);
});

console.log('homepage rail projection checks pass');
