import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateLinkKey,
  createCandidateGateResult,
  createMetricEvidence,
  type CandidateGateResult,
  type CandidateLinkKey,
  type MetricEvidence,
} from '../../engine/handover/candidateDecisionContract';
import { produceCandidateOpportunitySet } from '../../engine/handover/candidateOpportunityProducer';
import { HandoverDecisionEngine } from '../../engine/handover/handoverDecisionEngine';
import { SinrOffsetPolicy } from '../../engine/handover/handoverSelectionPolicy';
import {
  createHomepageHandoverDecisionController,
  stepHomepageHandoverDecision,
  type HomepageHandoverDecisionController,
  type HomepageHandoverDecisionInput,
  type HomepageHandoverSourceIdentity,
} from './handoverDecision';

const PRIMARY_UE = 'ue-primary';
const EPOCH = 'walker-epoch-fixture';
const SERVING = candidateLinkKey('SAT-A', 1);

function metric(
  sourceFrameId: string,
  value: number,
  unit: string,
): MetricEvidence {
  return createMetricEvidence({
    status: 'available',
    value,
    unit,
    sourceFrameId,
    reason: null,
  });
}

function scheduledGate(result: CandidateGateResult['result']): CandidateGateResult {
  return createCandidateGateResult({
    code: 'scheduled-illumination',
    category: 'hard-qos',
    result,
    measured: result === 'unavailable' ? null : result === 'pass' ? 1 : 0,
    threshold: result === 'unavailable' ? null : 1,
    unit: result === 'unavailable' ? null : 'boolean',
    reason: result === 'pass' ? null : `scheduled illumination ${result}`,
  });
}

function setFor(
  sourceFrameId: string,
  links: readonly {
    readonly key: CandidateLinkKey;
    readonly sinrDb: number;
    readonly scheduled?: CandidateGateResult['result'];
  }[],
) {
  return produceCandidateOpportunitySet({
    primaryUeId: PRIMARY_UE,
    sourceFrameId,
    thresholds: {
      minimumElevationDeg: 10,
      maximumSteeringDeg: 20,
      minimumSinrDb: 0,
      minimumThroughputBps: 1,
      minimumRemainingServiceTimeSec: 1,
    },
    measurements: links.map(link => ({
      key: link.key,
      primaryUeId: PRIMARY_UE,
      sourceFrameId,
      beamIdentitySource: 'walker-cell-surrogate' as const,
      elevation: metric(sourceFrameId, 45, 'deg'),
      steering: metric(sourceFrameId, 5, 'deg'),
      range: metric(sourceFrameId, 800, 'km'),
      sinr: metric(sourceFrameId, link.sinrDb, 'dB'),
      predictedThroughput: metric(sourceFrameId, 100, 'bit/s'),
      remainingServiceTime: metric(sourceFrameId, 100, 's'),
      scheduledIllumination: scheduledGate(link.scheduled ?? 'pass'),
    })),
  });
}

function source(
  sourceFrameId: string,
  simTimeMs: number,
  dtSec: number,
): HomepageHandoverSourceIdentity {
  return {
    sourceFrameId,
    epochToken: EPOCH,
    simTimeMs,
    dtSec,
    discontinuity: 'none',
  };
}

function engine(options: {
  readonly initialServing?: CandidateLinkKey | null;
  readonly interTttSec?: number;
  readonly intraTttSec?: number;
  readonly selectionHoldSec?: number;
} = {}): HandoverDecisionEngine {
  return new HandoverDecisionEngine({
    episodeId: 'homepage-decision-fixture',
    initialServing: options.initialServing === undefined ? SERVING : options.initialServing,
    policy: new SinrOffsetPolicy({
      initialTttSec: 0,
      interTttSec: options.interTttSec ?? 2,
      intraTttSec: options.intraTttSec ?? 1,
      interOffsetDb: 3,
      intraOffsetDb: 0,
    }),
    selectionHoldSec: options.selectionHoldSec ?? 1,
    guardSec: 0,
    candidateAbsenceToleranceSec: 0,
  });
}

function step(
  controller: HomepageHandoverDecisionController,
  sourceFrameId: string,
  simTimeMs: number,
  dtSec: number,
  links: readonly {
    readonly key: CandidateLinkKey;
    readonly sinrDb: number;
    readonly scheduled?: CandidateGateResult['result'];
  }[],
) {
  const input: HomepageHandoverDecisionInput = {
    opportunitySet: setFor(sourceFrameId, links),
    sourceIdentity: source(sourceFrameId, simTimeMs, dtSec),
  };
  return controller.step(input);
}

function stateFor(
  decision: NonNullable<ReturnType<typeof step>['decision']>,
  key: CandidateLinkKey,
): NonNullable<ReturnType<typeof step>['decision']>['states'][number] {
  const state = decision.states.find(item => item.key.satelliteId === key.satelliteId && item.key.beamId === key.beamId);
  assert.ok(state, `expected decision state for ${key.satelliteId}|${key.beamId}`);
  return state;
}

test('candidate qualification and TTT are delegated to the canonical engine', () => {
  const target = candidateLinkKey('SAT-B', 1);
  const controller = createHomepageHandoverDecisionController(engine({ interTttSec: 2 }));
  const links = [
    { key: SERVING, sinrDb: 10 },
    { key: target, sinrDb: 16 },
  ];

  const first = step(controller, 'decision-0', 0, 0, links);
  const firstState = stateFor(first.decision!, target);
  assert.equal(firstState.hardEligibility, 'eligible');
  assert.equal(firstState.triggerStatus, 'satisfied');
  assert.equal(firstState.qualificationSec, 0);
  assert.equal(firstState.stable, false);
  assert.equal(first.phase, 'qualifying');

  const duringTtt = step(controller, 'decision-1', 1_000, 1, links);
  const tttState = stateFor(duringTtt.decision!, target);
  assert.equal(tttState.qualificationSec, 1);
  assert.equal(tttState.requiredTttSec, 2);
  assert.equal(tttState.stable, false);
  assert.equal(duringTtt.decision?.recentCommit, null);

  const tttStable = step(controller, 'decision-2', 2_000, 1, links);
  const stableState = stateFor(tttStable.decision!, target);
  assert.equal(stableState.qualificationSec, 2);
  assert.equal(stableState.stable, true);
  assert.equal(tttStable.phase, 'switching');
  assert.deepEqual(tttStable.decision?.selectedTarget, target);
  assert.equal(tttStable.decision?.recentCommit, null);
});

test('a failed candidate gate remains unqualified and does not advance its TTT', () => {
  const target = candidateLinkKey('SAT-B', 1);
  const controller = createHomepageHandoverDecisionController(engine({ interTttSec: 1 }));
  const decision = step(controller, 'rejected-0', 0, 0, [
    { key: SERVING, sinrDb: 10 },
    { key: target, sinrDb: 16, scheduled: 'fail' },
  ]);
  const state = stateFor(decision.decision!, target);
  assert.equal(state.hardEligibility, 'ineligible');
  assert.equal(state.triggerStatus, 'not-satisfied');
  assert.equal(state.qualificationSec, 0);
  assert.equal(state.stable, false);
  assert.equal(decision.decision?.selectedTarget, null);
});

test('one canonical procedure classifies and commits an inter-satellite target', () => {
  const target = candidateLinkKey('SAT-B', 1);
  const canonicalEngine = engine({ interTttSec: 1, selectionHoldSec: 1 });
  const links = [
    { key: SERVING, sinrDb: 10 },
    { key: target, sinrDb: 16 },
  ];

  const selected = stepHomepageHandoverDecision(canonicalEngine, {
    opportunitySet: setFor('inter-1', links),
    sourceIdentity: source('inter-1', 1_000, 1),
  });
  assert.equal(selected.decision?.selectedKind, 'inter-satellite');
  assert.deepEqual(selected.decision?.selectedTarget, target);
  assert.equal(selected.decision?.recentCommit, null);

  const committed = stepHomepageHandoverDecision(canonicalEngine, {
    opportunitySet: setFor('inter-2', links),
    sourceIdentity: source('inter-2', 2_000, 1),
  });
  assert.equal(committed.phase, 'switching');
  assert.deepEqual(committed.decision?.serving, target);
  assert.equal(committed.decision?.recentCommit?.kind, 'inter-satellite');
  assert.deepEqual(committed.decision?.recentCommit?.from, SERVING);
  assert.deepEqual(committed.decision?.recentCommit?.to, target);
  assert.equal(committed.decision?.recentCommit?.oldLinkEnded, true);
  assert.equal(committed.decision?.recentCommit?.newLinkStarted, true);
  assert.equal(committed.sourceFrameId, 'inter-2');
  assert.equal(committed.epochToken, EPOCH);
});

test('the same canonical procedure classifies and commits an intra-satellite beam switch', () => {
  const target = candidateLinkKey('SAT-A', 2);
  const controller = createHomepageHandoverDecisionController(
    engine({ intraTttSec: 1, selectionHoldSec: 1 }),
  );
  const links = [
    { key: SERVING, sinrDb: 10 },
    { key: target, sinrDb: 15 },
  ];

  const selected = step(controller, 'intra-1', 1_000, 1, links);
  assert.equal(selected.decision?.selectedKind, 'intra-satellite');
  assert.deepEqual(selected.decision?.selectedTarget, target);
  assert.equal(selected.decision?.recentCommit, null);

  const committed = step(controller, 'intra-2', 2_000, 1, links);
  assert.equal(committed.decision?.recentCommit?.kind, 'intra-satellite');
  assert.deepEqual(committed.decision?.recentCommit?.from, SERVING);
  assert.deepEqual(committed.decision?.recentCommit?.to, target);
  assert.deepEqual(committed.decision?.serving, target);
});

test('rejects a candidate commit result without epoch identity at the homepage boundary', () => {
  const target = candidateLinkKey('SAT-B', 1);
  const canonicalEngine = engine({ interTttSec: 1, selectionHoldSec: 0 });
  const links = [
    { key: SERVING, sinrDb: 10 },
    { key: target, sinrDb: 16 },
  ];

  canonicalEngine.step(setFor('missing-epoch-0', links), source('missing-epoch-0', 0, 0));
  canonicalEngine.step(setFor('missing-epoch-1', links), source('missing-epoch-1', 1_000, 1));

  // Simulate an older compatibility producer omitting the optional shared
  // frame field. The homepage contract must not accept its commit receipt.
  const malformedDelegate = {
    step: (...args: Parameters<HandoverDecisionEngine['step']>) => {
      const decision = canonicalEngine.step(...args);
      assert.deepEqual(decision.recentCommit?.to, target);
      const { epochToken: ignoredEpochToken, ...withoutEpoch } = decision;
      void ignoredEpochToken;
      return withoutEpoch;
    },
  };

  assert.throws(() => stepHomepageHandoverDecision(malformedDelegate, {
    opportunitySet: setFor('missing-epoch-2', links),
    sourceIdentity: source('missing-epoch-2', 2_000, 1),
  }), /epoch token/);
});

console.log('homepage handover decision boundary checks pass');
