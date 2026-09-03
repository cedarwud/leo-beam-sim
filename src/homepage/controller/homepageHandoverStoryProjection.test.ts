import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateLinkKey,
  createCandidateGateResult,
  createHandoverCommitReceipt,
  createHandoverDecisionFrame,
  createMetricEvidence,
  freezeCandidateOpportunity,
  sameCandidateLinkKey,
  type CandidateDecisionState,
  type CandidateGateResult,
  type CandidateOpportunity,
  type HandoverDecisionFrame,
} from '../../engine/handover/candidateDecisionContract';
import {
  buildAcceptedHandoverPresentationSession,
  createHandoverPresentationPolicyConfigHash,
} from '../../scene/acceptedHandoverPresentationSnapshot';
import type { HomepageAcceptedSnapshot, HomepageBeamMetricsProjection } from './contracts';
import { projectHomepageHandoverStory } from './homepageHandoverStoryProjection';
import { projectHomepageRail } from './railProjection';

const SOURCE_FRAME_ID = 'walker-frame-story-1';

function metric(
  value: number | null,
  unit: string,
  status: 'available' | 'unavailable' = 'available',
  sourceFrameId = SOURCE_FRAME_ID,
) {
  return createMetricEvidence({
    status,
    value: status === 'available' ? value : null,
    unit,
    sourceFrameId: status === 'available' ? sourceFrameId : null,
    reason: status === 'available' ? null : 'fixture metric unavailable',
  });
}

function gate(code: CandidateGateResult['code'], result: CandidateGateResult['result'] = 'pass') {
  return createCandidateGateResult({
    code,
    category: code === 'ee-advantage' ? 'decision-trigger' : 'hard-qos',
    result,
    measured: result === 'pass' ? 1 : null,
    threshold: result === 'pass' ? 0 : null,
    unit: result === 'pass' ? 'ratio' : null,
    reason: result === 'pass' ? null : 'fixture candidate did not pass this gate',
  });
}

function opportunity(
  satelliteId: string,
  beamId: number,
  eeBitsPerJoule: number | null,
  sourceFrameId = SOURCE_FRAME_ID,
): CandidateOpportunity {
  return freezeCandidateOpportunity({
    key: candidateLinkKey(satelliteId, beamId),
    primaryUeId: 'ue-story',
    sourceFrameId,
    beamIdentitySource: 'walker-cell-surrogate',
    geometryClass: 'service-eligible',
    elevation: metric(45, 'deg', 'available', sourceFrameId),
    steering: metric(4, 'deg', 'available', sourceFrameId),
    range: metric(850, 'km', 'available', sourceFrameId),
    sinr: metric(12, 'dB', 'available', sourceFrameId),
    predictedThroughput: metric(100, 'bit/s', 'available', sourceFrameId),
    remainingServiceTime: metric(120, 's', 'available', sourceFrameId),
    instantaneousEe: eeBitsPerJoule === null
      ? metric(null, 'bit/J', 'unavailable', sourceFrameId)
      : metric(eeBitsPerJoule, 'bit/J', 'available', sourceFrameId),
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

function state(
  key: ReturnType<typeof candidateLinkKey>,
  stable: boolean,
  rank: number | null,
): CandidateDecisionState {
  return Object.freeze({
    key,
    hardEligibility: 'eligible',
    triggerStatus: key.satelliteId === 'sat-a' && key.beamId === 1 ? 'not-satisfied' : 'satisfied',
    qualificationSec: stable ? 4 : 0,
    requiredTttSec: 3,
    stable,
    rank: stable ? rank : null,
    rejectionCodes: Object.freeze([]),
  });
}

function decisionFixture(
  pairs: readonly [string, number, number | null][],
  target: ReturnType<typeof candidateLinkKey>,
  mode: HandoverDecisionFrame['mode'] = 'ee-optimization',
): HandoverDecisionFrame {
  const opportunities = pairs.map(([satelliteId, beamId, ee]) => opportunity(satelliteId, beamId, ee));
  return createHandoverDecisionFrame({
    episodeId: 'episode-story',
    sourceFrameId: SOURCE_FRAME_ID,
    epochToken: 'walker:epoch-story',
    simTimeMs: 4_000,
    phase: 'selection-hold',
    serving: candidateLinkKey('sat-a', 1),
    opportunities,
    states: opportunities.map(item => state(
      item.key,
      item.key.satelliteId !== 'sat-a' || item.key.beamId !== 1,
      sameCandidateLinkKey(item.key, target) ? 1 : 2,
    )),
    provisionalLeader: target,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 1,
    selectionHoldRequiredSec: 1.5,
    mode,
    recentCommit: null,
  });
}

function snapshotFor(
  decision: HandoverDecisionFrame,
  configuredBeamCount: 1 | 7 | 19,
  previousSnapshot: HomepageAcceptedSnapshot | null = null,
  instantaneousEeActive = true,
) {
  return buildAcceptedHandoverPresentationSession({
    decision,
    policyConfigHash: createHandoverPresentationPolicyConfigHash(`story-${configuredBeamCount}`),
    pinnedKey: null,
    previousSnapshot,
    instantaneousEeActive,
    displayAllHardEligibleCandidates: true,
    configuredBeamCount,
  }).snapshot;
}

function retainedCommitSnapshot() {
  const serving = candidateLinkKey('sat-b', 2);
  const decision = createHandoverDecisionFrame({
    ...decisionFixture([
      ['sat-a', 1, 200_000],
      ['sat-b', 2, 280_000],
      ['sat-c', 3, 240_000],
    ], serving),
    phase: 'switching',
    serving,
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    recentCommit: createHandoverCommitReceipt({
      episodeId: 'episode-story',
      sourceFrameId: SOURCE_FRAME_ID,
      simTimeMs: 4_000,
      from: candidateLinkKey('sat-a', 1),
      to: serving,
      kind: 'inter-satellite',
      mode: 'ee-optimization',
      reason: 'fixture commit',
      oldLinkEnded: true,
      newLinkStarted: true,
    }),
  });
  return snapshotFor(decision, 7);
}

function continuityCase(kind: 'intra' | 'inter') {
  const configuredCellCount: 1 | 7 = kind === 'intra' ? 1 : 7;
  const source = candidateLinkKey('sat-a', 1);
  const target = kind === 'intra'
    ? candidateLinkKey('sat-a', 4)
    : candidateLinkKey('sat-b', 2);
  const commitFrameId = `${SOURCE_FRAME_ID}-${kind}-commit`;
  const guardFrameId = `${SOURCE_FRAME_ID}-${kind}-guard`;
  const extraOpportunity: [string, number, number] = kind === 'intra'
    ? ['sat-a', 2, 240_000]
    : ['sat-c', 3, 240_000];
  const selectedDecision = createHandoverDecisionFrame({
    ...decisionFixture([
      ['sat-a', 1, 200_000],
      [target.satelliteId, target.beamId, 300_000],
      extraOpportunity,
    ], target),
    phase: 'selection-hold',
    serving: source,
    provisionalLeader: target,
    selectedTarget: target,
    selectedKind: kind === 'intra' ? 'intra-satellite' : 'inter-satellite',
  });
  const selectedSnapshot = snapshotFor(selectedDecision, configuredCellCount);
  const selectedStory = projectHomepageHandoverStory({
    snapshot: selectedSnapshot,
    configuredCellCount,
  });
  assert.ok(selectedStory);

  const switchingDecision = createHandoverDecisionFrame({
    ...selectedDecision,
    phase: 'switching',
  });
  const switchingSnapshot = snapshotFor(
    switchingDecision,
    configuredCellCount,
    selectedSnapshot,
  );
  const switchingStory = projectHomepageHandoverStory({
    snapshot: switchingSnapshot,
    configuredCellCount,
    previousSnapshot: selectedSnapshot,
  });
  assert.ok(switchingStory);

  const commit = createHandoverCommitReceipt({
    episodeId: 'episode-story',
    sourceFrameId: commitFrameId,
    simTimeMs: 5_000,
    from: source,
    to: target,
    kind: kind === 'intra' ? 'intra-satellite' : 'inter-satellite',
    mode: 'ee-optimization',
    reason: 'fixture commit',
    oldLinkEnded: true,
    newLinkStarted: true,
  });
  const committedDecision = createHandoverDecisionFrame({
    ...switchingDecision,
    sourceFrameId: commitFrameId,
    simTimeMs: 5_000,
    phase: 'switching',
    serving: target,
    opportunities: [opportunity(target.satelliteId, target.beamId, 305_000, commitFrameId)],
    states: [state(target, false, null)],
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    recentCommit: commit,
  });
  const committedSnapshot = snapshotFor(
    committedDecision,
    configuredCellCount,
    switchingSnapshot,
  );
  const committedStory = projectHomepageHandoverStory({
    snapshot: committedSnapshot,
    configuredCellCount,
    previousSnapshot: switchingSnapshot,
  });
  assert.ok(committedStory);

  const guardDecision = createHandoverDecisionFrame({
    ...committedDecision,
    sourceFrameId: guardFrameId,
    simTimeMs: 5_100,
    phase: 'guard',
    opportunities: [opportunity(target.satelliteId, target.beamId, 999_000, guardFrameId)],
    recentCommit: null,
  });
  const guardSnapshot = snapshotFor(
    guardDecision,
    configuredCellCount,
    committedSnapshot,
  );
  const guardStory = projectHomepageHandoverStory({
    snapshot: guardSnapshot,
    configuredCellCount,
    previousSnapshot: committedSnapshot,
    previousStory: committedStory,
  });

  return {
    configuredCellCount,
    source,
    target,
    selectedStory,
    switchingStory,
    committedStory,
    guardStory,
    committedSnapshot,
  };
}

test('intra same-cell beam replacement retains evidence and winner through selected, switching, and committed display', () => {
  const result = continuityCase('intra');

  for (const [story, expectedTargetEe] of [
    [result.selectedStory, 300_000],
    [result.switchingStory, 300_000],
    // The commit/guard frames must keep the selection-boundary witness.
    [result.committedStory, 300_000],
    [result.guardStory, 300_000],
  ] as const) {
    assert.ok(story);
    assert.equal(story.kind, 'intra');
    assert.equal(story.sameSatellite, true);
    assert.equal(story.cellCount, 1);
    assert.deepEqual(story.source, result.source);
    assert.deepEqual(story.target, result.target);
    assert.equal(story.sourceEeBitsPerJoule, 200_000);
    assert.equal(story.targetEeBitsPerJoule, expectedTargetEe);
    assert.equal(story.winnerEeBitsPerJoule, expectedTargetEe);
    assert.equal(story.targetIsWinner, true);
    assert.deepEqual(story.winner, result.target);
  }
});

test('inter replacement retains the selected EE-max candidate evidence through selected, switching, and committed display', () => {
  const result = continuityCase('inter');

  for (const [story, expectedTargetEe] of [
    [result.selectedStory, 300_000],
    [result.switchingStory, 300_000],
    // The commit/guard frames must keep the selection-boundary witness.
    [result.committedStory, 300_000],
    [result.guardStory, 300_000],
  ] as const) {
    assert.ok(story);
    assert.equal(story.kind, 'inter');
    assert.equal(story.sameSatellite, false);
    assert.equal(story.cellCount, 7);
    assert.deepEqual(story.source, result.source);
    assert.deepEqual(story.target, result.target);
    assert.equal(story.sourceEeBitsPerJoule, 200_000);
    assert.equal(story.targetEeBitsPerJoule, expectedTargetEe);
    assert.equal(story.winnerEeBitsPerJoule, expectedTargetEe);
    assert.equal(story.targetIsWinner, true);
    assert.deepEqual(story.winner, result.target);
  }
});

test('an explicit current unavailable EE value is not resurrected from prior story evidence', () => {
  const result = continuityCase('inter');
  const unavailableDecision = createHandoverDecisionFrame({
    ...result.committedSnapshot.decision,
    opportunities: [opportunity(
      result.target.satelliteId,
      result.target.beamId,
      null,
      result.committedSnapshot.sourceFrameId,
    )],
  });
  const unavailableSnapshot = snapshotFor(
    unavailableDecision,
    result.configuredCellCount,
    result.committedSnapshot,
  );
  const story = projectHomepageHandoverStory({
    snapshot: unavailableSnapshot,
    configuredCellCount: result.configuredCellCount,
    previousSnapshot: result.committedSnapshot,
    previousStory: result.committedStory,
  });

  assert.ok(story);
  assert.equal(story.sourceEeBitsPerJoule, 200_000);
  assert.equal(story.targetEeBitsPerJoule, null);
  assert.equal(story.winnerEeBitsPerJoule, null);
  assert.equal(story.targetIsWinner, false);
  assert.equal(story.winner, null);
  assert.equal(story.winnerBasis, 'unavailable');
});

test('intra story keeps same satellite, reports one-cell example, and identifies the EE maximum', () => {
  const target = candidateLinkKey('sat-a', 4);
  const snapshot = snapshotFor(decisionFixture([
    ['sat-a', 1, 200_000],
    ['sat-a', 4, 300_000],
    ['sat-a', 2, 240_000],
  ], target), 1);

  const story = projectHomepageHandoverStory({ snapshot, configuredCellCount: 1 });

  assert.ok(story);
  assert.equal(story.kind, 'intra');
  assert.equal(story.sameSatellite, true);
  assert.equal(story.cellCount, 1);
  assert.equal(story.cellExample, 'one-cell');
  assert.equal(story.targetIsWinner, true);
  assert.equal(story.winnerBasis, 'instantaneous-ee-max');
  assert.deepEqual(story.winner, target);
  assert.equal(story.sourceEeBitsPerJoule, 200_000);
  assert.equal(story.targetEeBitsPerJoule, 300_000);
  assert.equal(story.winnerEeBitsPerJoule, 300_000);
  assert.equal(story.qualifiedCandidateCount, 2);
  assert.equal(story.qualifiedCandidateSatelliteCount, 1);
  assert.equal(story.selectionStatus, 'ttt-stable');
});

test('inter story preserves the accepted target and reports the seven-cell example', () => {
  const target = candidateLinkKey('sat-b', 2);
  const snapshot = snapshotFor(decisionFixture([
    ['sat-a', 1, 200_000],
    ['sat-b', 2, 280_000],
    ['sat-c', 3, 240_000],
  ], target), 7);

  const story = projectHomepageHandoverStory({ snapshot, configuredCellCount: 7 });

  assert.ok(story);
  assert.equal(story.kind, 'inter');
  assert.equal(story.sameSatellite, false);
  assert.equal(story.cellCount, 7);
  assert.equal(story.cellExample, 'seven-cell');
  assert.equal(story.targetIsWinner, true);
  assert.equal(story.winnerBasis, 'instantaneous-ee-max');
  assert.deepEqual(story.winner, target);
  assert.equal(story.qualifiedCandidateCount, 2);
  assert.equal(story.qualifiedCandidateSatelliteCount, 2);
});

test('does not recover EE from decision opportunities when accepted transition evidence is unavailable', () => {
  const target = candidateLinkKey('sat-b', 2);
  const baseSnapshot = snapshotFor(decisionFixture([
    ['sat-a', 1, 200_000],
    ['sat-b', 2, 280_000],
  ], target), 7);
  const snapshot = Object.freeze({
    ...baseSnapshot,
    handoverEvidence: null,
  });

  const story = projectHomepageHandoverStory({ snapshot, configuredCellCount: 7 });

  assert.ok(story);
  assert.deepEqual(story.source, candidateLinkKey('sat-a', 1));
  assert.deepEqual(story.target, target);
  assert.equal(story.sourceEeBitsPerJoule, null);
  assert.equal(story.targetEeBitsPerJoule, null);
  assert.equal(story.targetIsWinner, false);
  assert.equal(story.winner, null);
});

test('uses the accepted rank witness without recomputing endpoint EE ordering', () => {
  const target = candidateLinkKey('sat-a', 4);
  const snapshot = snapshotFor(decisionFixture([
    ['sat-a', 1, 300_000],
    ['sat-a', 4, 200_000],
  ], target), 1);

  const story = projectHomepageHandoverStory({ snapshot, configuredCellCount: 1 });

  assert.ok(story);
  assert.equal(story.sourceEeBitsPerJoule, 300_000);
  assert.equal(story.targetEeBitsPerJoule, 200_000);
  assert.equal(story.targetIsWinner, true);
  assert.deepEqual(story.winner, target);
  assert.equal(story.winnerEeBitsPerJoule, 200_000);
});

test('active provisional leader supersedes a retained committed pair during selection hold', () => {
  const serving = candidateLinkKey('sat-b', 2);
  const target = candidateLinkKey('sat-c', 3);
  const decision = createHandoverDecisionFrame({
    ...decisionFixture([
      ['sat-a', 1, 200_000],
      ['sat-b', 2, 280_000],
      ['sat-c', 3, 300_000],
    ], target),
    phase: 'selection-hold',
    serving,
    provisionalLeader: target,
    selectedTarget: null,
    selectedKind: null,
    recentCommit: null,
  });
  const snapshot = snapshotFor(decision, 7, retainedCommitSnapshot());

  const story = projectHomepageHandoverStory({ snapshot, configuredCellCount: 7 });

  assert.ok(story);
  assert.deepEqual(story.source, serving);
  assert.deepEqual(story.target, target);
  assert.equal(story.selectionStatus, 'ttt-stable');
  assert.equal(story.kind, 'inter');
});

test('active selected target supersedes a retained committed pair during switching', () => {
  const serving = candidateLinkKey('sat-b', 2);
  const target = candidateLinkKey('sat-b', 4);
  const decision = createHandoverDecisionFrame({
    ...decisionFixture([
      ['sat-a', 1, 200_000],
      ['sat-b', 2, 280_000],
      ['sat-b', 4, 300_000],
    ], target),
    phase: 'switching',
    serving,
    provisionalLeader: target,
    selectedTarget: target,
    selectedKind: 'intra-satellite',
    recentCommit: null,
  });
  const snapshot = snapshotFor(decision, 1, retainedCommitSnapshot());

  const story = projectHomepageHandoverStory({ snapshot, configuredCellCount: 1 });

  assert.ok(story);
  assert.deepEqual(story.source, serving);
  assert.deepEqual(story.target, target);
  assert.equal(story.selectionStatus, 'selected');
  assert.equal(story.kind, 'intra');
  assert.equal(story.sameSatellite, true);
});

test('does not claim MAX EE when the accepted serving EE evidence is unavailable', () => {
  const target = candidateLinkKey('sat-b', 2);
  const decision = decisionFixture([
    ['sat-a', 1, null],
    ['sat-b', 2, 280_000],
    ['sat-c', 3, 240_000],
  ], target);
  const story = projectHomepageHandoverStory({
    snapshot: snapshotFor(decision, 7),
    configuredCellCount: 7,
  });

  assert.ok(story);
  assert.equal(story.sourceEeBitsPerJoule, null);
  assert.equal(story.targetIsWinner, false);
  assert.equal(story.winner, null);
  assert.equal(story.winnerBasis, 'unavailable');
});

test('does not trust an instantaneous-EE label without the canonical active objective', () => {
  const target = candidateLinkKey('sat-b', 2);
  const decision = decisionFixture([
    ['sat-a', 1, 200_000],
    ['sat-b', 2, 280_000],
  ], target);
  const baseSnapshot = snapshotFor(decision, 7);
  const snapshot = Object.freeze({
    ...baseSnapshot,
    policyMode: 'sinr-compatibility' as const,
    activeTriggerObjective: 'instantaneous-ee-max' as const,
    eeActivationStatus: 'blocked' as const,
  });

  const story = projectHomepageHandoverStory({ snapshot, configuredCellCount: 7 });

  assert.ok(story);
  assert.equal(story.targetIsWinner, false);
  assert.equal(story.winner, null);
  assert.equal(story.winnerBasis, 'unavailable');
});

test('rail rejects beam metrics that do not join the accepted snapshot', () => {
  const snapshot = snapshotFor(decisionFixture([
    ['sat-a', 1, 200_000],
    ['sat-b', 2, 280_000],
  ], candidateLinkKey('sat-b', 2)), 7);
  const staleMetrics: HomepageBeamMetricsProjection = {
    sourceFrameId: 'stale-frame',
    snapshotId: 'stale-snapshot',
    simTimeSec: 4,
    metrics: [],
    availableEeMinBitsPerJoule: null,
    availableEeMaxBitsPerJoule: null,
  };

  const rail = projectHomepageRail(snapshot, { beamMetrics: staleMetrics });

  assert.equal(rail.beamMetrics, null);
});

test('story never claims an instantaneous EE maximum for a compatibility decision', () => {
  const target = candidateLinkKey('sat-b', 2);
  const decision = decisionFixture([
    ['sat-a', 1, 200_000],
    ['sat-b', 2, 280_000],
  ], target, 'sinr-offset');
  const story = projectHomepageHandoverStory({
    snapshot: snapshotFor(decision, 7),
    configuredCellCount: 7,
  });

  assert.ok(story);
  assert.equal(story.targetIsWinner, false);
  assert.equal(story.winner, null);
  assert.equal(story.winnerBasis, 'unavailable');
});

test('initial attach has no handover story pair', () => {
  const decision = createHandoverDecisionFrame({
    ...decisionFixture([
      ['sat-a', 1, 200_000],
      ['sat-b', 2, 280_000],
    ], candidateLinkKey('sat-b', 2)),
    phase: 'initial-attach',
    serving: null,
    provisionalLeader: null,
  });
  const story = projectHomepageHandoverStory({
    snapshot: snapshotFor(decision, 1),
    configuredCellCount: 1,
  });

  assert.equal(story, null);
});

console.log('homepage handover story projection checks pass');
