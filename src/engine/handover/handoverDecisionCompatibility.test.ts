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
  type CandidateOpportunity,
} from './candidateDecisionContract';
import { projectHandoverDecisionCompatibility } from './handoverDecisionCompatibility';

const SOURCE_FRAME_ID = 'compat-frame';

function opportunity(satelliteId: string, beamId: number, sinrDb: number): CandidateOpportunity {
  const metric = (value: number, unit: string) => createMetricEvidence({
    status: 'available', value, unit, sourceFrameId: SOURCE_FRAME_ID, reason: null,
  });
  const pass = (code: CandidateOpportunity['gates'][number]['code']) => createCandidateGateResult({
    code,
    category: code === 'ee-advantage' ? 'decision-trigger' : 'hard-qos',
    result: 'pass',
    measured: 1,
    threshold: 0,
    unit: 'unit',
    reason: null,
  });
  return freezeCandidateOpportunity({
    key: candidateLinkKey(satelliteId, beamId),
    primaryUeId: 'ue-primary',
    sourceFrameId: SOURCE_FRAME_ID,
    beamIdentitySource: 'walker-cell-surrogate',
    geometryClass: 'service-eligible',
    elevation: metric(45, 'deg'),
    steering: metric(2, 'deg'),
    range: metric(700, 'km'),
    sinr: metric(sinrDb, 'dB'),
    predictedThroughput: metric(100, 'bit/s'),
    remainingServiceTime: metric(120, 's'),
    forecastEe: null,
    gates: [
      pass('elevation'), pass('steering'), pass('scheduled-illumination'),
      pass('sinr'), pass('throughput'), pass('remaining-service-time'),
      createCandidateGateResult({
        code: 'ee-advantage', category: 'decision-trigger', result: 'unavailable',
        measured: null, threshold: null, unit: null, reason: 'EE gate is closed',
      }),
    ],
  });
}

function state(item: CandidateOpportunity, qualificationSec: number, rank: number | null): CandidateDecisionState {
  return Object.freeze({
    key: item.key,
    hardEligibility: 'eligible',
    triggerStatus: rank === null ? 'not-satisfied' : 'satisfied',
    qualificationSec,
    requiredTttSec: 3,
    stable: rank !== null,
    rank,
    rejectionCodes: Object.freeze([]),
  });
}

test('projects the authoritative leader without re-ranking or inventing a commit', () => {
  const serving = opportunity('SAT-A', 1, 5);
  const leader = opportunity('SAT-B', 2, 12);
  const other = opportunity('SAT-C', 3, 20);
  const frame = createHandoverDecisionFrame({
    episodeId: 'compat-episode',
    sourceFrameId: SOURCE_FRAME_ID,
    simTimeMs: 4_000,
    phase: 'selection-hold',
    serving: serving.key,
    opportunities: [serving, leader, other],
    states: [state(serving, 0, null), state(leader, 3, 1), state(other, 3, 2)],
    provisionalLeader: leader.key,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0.5,
    selectionHoldRequiredSec: 1.5,
    mode: 'sinr-offset',
    recentCommit: null,
    epochToken: 'epoch-a',
  });

  const projection = projectHandoverDecisionCompatibility(frame);
  assert.deepEqual(projection.pendingTarget, leader.key);
  assert.equal(projection.comparisonSatId, 'SAT-B');
  assert.equal(projection.pendingTargetSinrDb, 12);
  assert.equal(projection.triggerProgressSec, 3);
  assert.equal(projection.selectionHoldProgressSec, 0.5);
  assert.equal(projection.commitAction, null);
  assert.equal(projection.servingState.satId, 'SAT-A');
});

test('keeps initial attach scientifically distinct in the compatibility projection', () => {
  const target = opportunity('SAT-A', 1, 8);
  const receipt = createHandoverCommitReceipt({
    episodeId: 'attach-episode',
    sourceFrameId: SOURCE_FRAME_ID,
    simTimeMs: 1_000,
    from: null,
    to: target.key,
    kind: 'initial-attach',
    mode: 'sinr-offset',
    reason: 'initial candidate selected after hold',
    oldLinkEnded: false,
    newLinkStarted: true,
  });
  const frame = createHandoverDecisionFrame({
    episodeId: 'attach-episode',
    sourceFrameId: SOURCE_FRAME_ID,
    simTimeMs: 1_000,
    phase: 'switching',
    serving: target.key,
    opportunities: [target],
    states: [state(target, 3, 1)],
    provisionalLeader: null,
    selectedTarget: null,
    selectedKind: null,
    selectionHoldSec: 0,
    selectionHoldRequiredSec: 0,
    mode: 'sinr-offset',
    recentCommit: receipt,
    epochToken: 'epoch-a',
  });

  const projection = projectHandoverDecisionCompatibility(frame);
  assert.equal(projection.commitAction, 'initial-attach');
  assert.equal(projection.scientificKind, 'initial-attach');
  assert.equal(projection.servingState.satId, 'SAT-A');
  assert.equal(projection.servingState.pendingTarget, null);
});
