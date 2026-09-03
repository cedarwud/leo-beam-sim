import assert from 'node:assert/strict';
import test from 'node:test';

import type { LiveWalkerHandoverEvent } from '../../scene/liveWalkerHandoverEventIndex';
import {
  evaluateHomepageAcceptanceAlignment,
  evaluateHomepageDecisionEeAlignment,
} from './homepageAcceptanceAlignment';
import {
  candidateLinkKey,
  type CandidateDecisionState,
  type CandidateOpportunity,
  type HandoverDecisionFrame,
} from '../../engine/handover/candidateDecisionContract';

function decisionFixture(
  targetEe: number | null,
  otherEe: number | null,
  targetRank: number | null = 1,
): HandoverDecisionFrame {
  const target = candidateLinkKey('sat-next', 1);
  const other = candidateLinkKey('sat-other', 1);
  const opportunity = (key: typeof target, ee: number | null): CandidateOpportunity => ({
    key,
    instantaneousEe: ee === null
      ? { status: 'unavailable', value: null, unit: 'bit/J', sourceFrameId: null, reason: 'test unavailable' }
      : { status: 'available', value: ee, unit: 'bit/J', sourceFrameId: 'frame-1', reason: null },
  } as CandidateOpportunity);
  const state = (key: typeof target, rank: number | null): CandidateDecisionState => ({
    key,
    hardEligibility: 'eligible',
    triggerStatus: 'satisfied',
    qualificationSec: 3,
    requiredTttSec: 3,
    stable: rank !== null,
    rank,
    rejectionCodes: [],
  });
  return {
    mode: 'ee-optimization',
    opportunities: [opportunity(target, targetEe), opportunity(other, otherEe)],
    states: [state(target, targetRank), state(other, targetRank === 1 ? 2 : 1)],
  } as unknown as HandoverDecisionFrame;
}

function event(overrides: Partial<LiveWalkerHandoverEvent> = {}): LiveWalkerHandoverEvent {
  const kind = overrides.kind ?? 'intra';
  return {
    id: `event-${kind}`,
    sourceTimeSec: kind === 'intra' ? 308 : 356,
    kind,
    fromSatId: 'sat-serving',
    fromBeamId: kind === 'intra' ? 1 : 421,
    toSatId: kind === 'intra' ? 'sat-serving' : 'sat-next',
    toBeamId: kind === 'intra' ? 421 : 1,
    ueId: 'live-ue-0',
    fromCellId: 0,
    toCellId: 0,
    fromSinrDb: -2,
    toSinrDb: 1,
    deltaDb: 3,
    sourceStartSec: kind === 'intra' ? 298 : 346,
    sourceEndSec: kind === 'intra' ? 328 : 376,
    clickTargetSec: kind === 'intra' ? 308 : 356,
    primaryUeId: 'live-ue-0',
    count: 1,
    ...overrides,
  };
}

test('accepts the canonical same-cell beam switch followed by cross-satellite handover', () => {
  const alignment = evaluateHomepageAcceptanceAlignment(event(), event({ kind: 'inter' }));

  assert.equal(alignment.aligned, true);
  assert.deepEqual(alignment.failedChecks, []);
  assert.ok(Object.isFrozen(alignment));
  assert.ok(Object.isFrozen(alignment.checks));
  assert.ok(Object.isFrozen(alignment.failedChecks));
});

test('rejects a cell-changing row as intra even when satellite and time order look valid', () => {
  const alignment = evaluateHomepageAcceptanceAlignment(
    event({ fromCellId: 0, toCellId: 1 }),
    event({ kind: 'inter' }),
  );

  assert.equal(alignment.aligned, false);
  assert.deepEqual(alignment.failedChecks, ['intra-same-geographic-cell']);
});

test('rejects an unchanged beam and a cross-UE pair', () => {
  const alignment = evaluateHomepageAcceptanceAlignment(
    event({ fromBeamId: 1, toBeamId: 1, ueId: 'live-ue-1' }),
    event({ kind: 'inter', ueId: 'live-ue-2', primaryUeId: 'live-ue-2' }),
  );

  assert.equal(alignment.aligned, false);
  assert.deepEqual(alignment.failedChecks, ['intra-distinct-beam', 'same-primary-ue']);
});

test('rejects an inter row that stays on the serving satellite or precedes intra', () => {
  const alignment = evaluateHomepageAcceptanceAlignment(
    event({ sourceTimeSec: 308 }),
    event({
      kind: 'inter',
      sourceTimeSec: 300,
      sourceStartSec: 290,
      sourceEndSec: 320,
      fromSatId: 'sat-serving',
      toSatId: 'sat-serving',
    }),
  );

  assert.equal(alignment.aligned, false);
  assert.deepEqual(alignment.failedChecks, ['inter-cross-satellite', 'source-order']);
});

test('rejects a demo pair whose inter event starts on a different service satellite', () => {
  const alignment = evaluateHomepageAcceptanceAlignment(
    event({ fromSatId: 'sat-serving-after-intra', toSatId: 'sat-serving-after-intra' }),
    event({ kind: 'inter', fromSatId: 'unrelated-satellite', toSatId: 'sat-next' }),
  );

  assert.equal(alignment.aligned, false);
  assert.deepEqual(alignment.failedChecks, ['inter-follows-intra']);
});

test('accepts the canonical decision target only when it is the stable same-frame EE maximum', () => {
  const target = candidateLinkKey('sat-next', 1);
  const alignment = evaluateHomepageDecisionEeAlignment(
    decisionFixture(120, 80),
    target,
  );

  assert.equal(alignment.aligned, true);
  assert.deepEqual(alignment.failedChecks, []);
  assert.ok(Object.isFrozen(alignment));
  assert.ok(Object.isFrozen(alignment.checks));
});

test('rejects a decision witness whose rank-one target is lower EE than another stable candidate', () => {
  const alignment = evaluateHomepageDecisionEeAlignment(
    decisionFixture(80, 120),
    candidateLinkKey('sat-next', 1),
  );

  assert.equal(alignment.aligned, false);
  assert.deepEqual(alignment.failedChecks, ['decision-ee-max']);
});

test('rejects missing stable-frame EE evidence instead of inventing a winner', () => {
  const alignment = evaluateHomepageDecisionEeAlignment(
    decisionFixture(null, 120),
    candidateLinkKey('sat-next', 1),
  );

  assert.equal(alignment.aligned, false);
  assert.deepEqual(alignment.failedChecks, ['decision-ee-evidence', 'decision-ee-max']);
});

test('requires an intra replacement beam to improve on the serving beam EE', () => {
  const source = candidateLinkKey('sat-serving', 1);
  const target = candidateLinkKey('sat-serving', 421);
  const decision = {
    ...decisionFixture(120, 80),
    serving: source,
    selectedKind: 'intra-satellite',
    opportunities: [
      {
        ...decisionFixture(120, 80).opportunities[0],
        key: source,
        instantaneousEe: { status: 'available', value: 140, unit: 'bit/J', sourceFrameId: 'frame-1', reason: null },
      },
      {
        ...decisionFixture(120, 80).opportunities[0],
        key: target,
        instantaneousEe: { status: 'available', value: 120, unit: 'bit/J', sourceFrameId: 'frame-1', reason: null },
      },
    ],
    states: [
      { ...decisionFixture(120, 80).states[0], key: source, rank: 2, stable: true },
      { ...decisionFixture(120, 80).states[0], key: target, rank: 1, stable: true },
    ],
  } as unknown as HandoverDecisionFrame;

  const alignment = evaluateHomepageDecisionEeAlignment(decision, target);

  assert.equal(alignment.aligned, false);
  assert.deepEqual(alignment.failedChecks, ['decision-ee-max', 'decision-target-ee-improves-source']);
});
