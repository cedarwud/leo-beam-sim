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
import {
  buildAcceptedHandoverPresentationSession,
  createHandoverPresentationPolicyConfigHash,
} from '../../scene/acceptedHandoverPresentationSnapshot';
import { buildHomepageSceneProjection } from './sceneProjection';

const SOURCE_FRAME_ID = 'homepage-scene-frame-1';

function metric(value: number, unit: string): ReturnType<typeof createMetricEvidence> {
  return createMetricEvidence({
    status: 'available',
    value,
    unit,
    sourceFrameId: SOURCE_FRAME_ID,
    reason: null,
  });
}

function gate(code: CandidateGateResult['code']): CandidateGateResult {
  const unavailable = code === 'ee-advantage';
  return createCandidateGateResult({
    code,
    category: unavailable ? 'decision-trigger' : 'hard-qos',
    result: unavailable ? 'unavailable' : 'pass',
    measured: unavailable ? null : 1,
    threshold: unavailable ? null : 0,
    unit: unavailable ? null : 'unit',
    reason: unavailable ? 'homepage projection fixture has no forecast EE' : null,
  });
}

function opportunity(satelliteId: string, beamId: number) {
  return freezeCandidateOpportunity({
    key: candidateLinkKey(satelliteId, beamId),
    primaryUeId: 'ue-homepage',
    sourceFrameId: SOURCE_FRAME_ID,
    beamIdentitySource: 'walker-cell-surrogate',
    geometryClass: 'service-eligible',
    elevation: metric(45, 'deg'),
    steering: metric(4, 'deg'),
    range: metric(850, 'km'),
    sinr: metric(12, 'dB'),
    predictedThroughput: metric(100, 'bit/s'),
    remainingServiceTime: metric(120, 's'),
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

function state(key: ReturnType<typeof candidateLinkKey>, rank: number): CandidateDecisionState {
  return {
    key,
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
  const serving = candidateLinkKey('sat-serving', 1);
  const candidateA = candidateLinkKey('sat-alpha', 2);
  const candidateB = candidateLinkKey('sat-beta', 3);
  const keys = [serving, candidateA, candidateB];
  return createHandoverDecisionFrame({
    episodeId: 'homepage-scene-episode',
    sourceFrameId: SOURCE_FRAME_ID,
    epochToken: 'walker:homepage-scene-epoch-1',
    simTimeMs: 12_000,
    phase: 'selection-hold',
    serving,
    opportunities: keys.map(key => opportunity(key.satelliteId, key.beamId)),
    states: keys.map((key, index) => state(key, index + 1)),
    provisionalLeader: candidateA,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 1,
    selectionHoldRequiredSec: 2,
    mode: 'sinr-offset',
    recentCommit: null,
  });
}

test('projects accepted snapshot identity and phase onto the existing scene model', () => {
  const decision = decisionFixture();
  const snapshot = buildAcceptedHandoverPresentationSession({
    decision,
    policyConfigHash: createHandoverPresentationPolicyConfigHash('homepage-scene-fixture'),
    pinnedKey: null,
  }).snapshot;

  const projection = buildHomepageSceneProjection(snapshot);

  assert.equal(projection.snapshotId, snapshot.snapshotId);
  assert.equal(projection.sourceFrameId, snapshot.sourceFrameId);
  assert.equal(projection.phase, 'selection-hold');
  assert.equal(projection.presentation?.episodeId, snapshot.episodeId);
  assert.equal(projection.presentation?.sourceFrameId, snapshot.sourceFrameId);
  assert.ok(Object.isFrozen(projection));
  assert.ok(Object.isFrozen(projection.renderedSceneJoinKeys));
});

test('keeps scene joins paired to the accepted presentation instructions', () => {
  const snapshot = buildAcceptedHandoverPresentationSession({
    decision: decisionFixture(),
    policyConfigHash: createHandoverPresentationPolicyConfigHash('homepage-scene-fixture'),
    pinnedKey: null,
  }).snapshot;
  const projection = buildHomepageSceneProjection(snapshot);
  const instructions = projection.presentation?.instructions ?? [];

  assert.equal(projection.renderedSceneJoinKeys.length, instructions.length);
  assert.deepEqual(
    projection.renderedSceneJoinKeys,
    instructions.map(instruction => instruction.key),
  );
  assert.ok(instructions.every(instruction => (
    instruction.joinKey === instruction.sceneJoinKey
    && instruction.joinKey === instruction.railJoinKey
    && instruction.sourceFrameId === projection.sourceFrameId
  )));
  assert.equal(
    new Set(instructions.map(instruction => instruction.pairKey)).size,
    instructions.length,
  );
});

test('preserves existing visual carriers and exactly one solid data link', () => {
  const snapshot = buildAcceptedHandoverPresentationSession({
    decision: decisionFixture(),
    policyConfigHash: createHandoverPresentationPolicyConfigHash('homepage-scene-fixture'),
    pinnedKey: null,
  }).snapshot;
  const projection = buildHomepageSceneProjection(snapshot);
  const presentation = projection.presentation;

  assert.equal(presentation?.activeDataLinkCount, 1);
  assert.equal(presentation?.solidDataLinkCount, 1);
  assert.equal(presentation?.instructions.filter(instruction => instruction.link.isSolidData).length, 1);
  assert.equal(presentation?.serving?.link.style, 'solid-data');
  assert.equal(presentation?.serving?.cone.style, 'restrained-translucent');
  assert.ok(presentation?.candidates.every(instruction => (
    instruction.link.isMeasurementOnly
    && !instruction.link.isSolidData
    && instruction.link.style !== 'solid-data'
  )));

  const servingPlanLink = snapshot.plan.displayedLinks.find(link => link.isServing);
  assert.ok(servingPlanLink);
  assert.equal(presentation?.serving?.satelliteIdentity, servingPlanLink?.satelliteIdentity);
  assert.equal(presentation?.serving?.beamIdentity, servingPlanLink?.beamIdentity);
});
