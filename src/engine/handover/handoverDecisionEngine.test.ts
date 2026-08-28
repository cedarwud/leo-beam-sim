import assert from 'node:assert/strict';
import test from 'node:test';

import {
  candidateLinkKey,
  candidateLinkKeyString,
  createCandidateGateResult,
  createHandoverCommitReceipt,
  createMetricEvidence,
  freezeCandidateOpportunity,
  type CandidateDecisionState,
  type CandidateLinkKey,
  type CandidateOpportunity,
  type DecisionClockContext,
} from './candidateDecisionContract';
import type { CandidateOpportunitySet } from './candidateOpportunityProducer';
import {
  HandoverDecisionEngine,
  type HandoverDecisionEngineSnapshot,
} from './handoverDecisionEngine';
import { SinrOffsetPolicy } from './handoverSelectionPolicy';

const UE = 'ue-primary';
const SERVING = candidateLinkKey('SAT-A', 1);

function opportunity(
  sourceFrameId: string,
  key: CandidateLinkKey,
  sinrDb: number,
  scheduled = true,
): CandidateOpportunity {
  const available = (value: number, unit: string) => createMetricEvidence({
    status: 'available', value, unit, sourceFrameId, reason: null,
  });
  const unavailable = (unit: string, reason: string) => createMetricEvidence({
    status: 'unavailable', value: null, unit, sourceFrameId: null, reason,
  });
  const gate = (
    code: CandidateOpportunity['gates'][number]['code'],
    result: CandidateOpportunity['gates'][number]['result'],
  ) => createCandidateGateResult(code === 'scheduled-illumination' ? {
    code,
    category: 'hard-qos',
    result,
    measured: result === 'unavailable' ? null : result === 'pass' ? 1 : 0,
    threshold: result === 'unavailable' ? null : 1,
    unit: result === 'unavailable' ? null : 'boolean',
    reason: result === 'pass' ? null : `${code} ${result}`,
  } : {
    code,
    category: code === 'ee-advantage' ? 'decision-trigger' : 'hard-qos',
    result,
    measured: result === 'unavailable' ? null : result === 'pass' ? 1 : 0,
    threshold: result === 'unavailable' ? null : 0,
    unit: result === 'unavailable' ? null : 'unit',
    reason: result === 'pass' ? null : `${code} ${result}`,
  });
  return freezeCandidateOpportunity({
    key,
    primaryUeId: UE,
    sourceFrameId,
    beamIdentitySource: 'walker-cell-surrogate',
    geometryClass: scheduled ? 'scheduled-and-illuminated' : 'steering-valid',
    elevation: available(45, 'deg'),
    steering: available(3, 'deg'),
    range: available(800, 'km'),
    sinr: available(sinrDb, 'dB'),
    predictedThroughput: unavailable('bit/s', 'compatibility fixture does not forecast throughput'),
    remainingServiceTime: unavailable('s', 'compatibility fixture does not forecast service time'),
    forecastEe: null,
    gates: [
      gate('elevation', 'pass'),
      gate('steering', 'pass'),
      gate('scheduled-illumination', scheduled ? 'pass' : 'fail'),
      gate('sinr', 'pass'),
      gate('throughput', 'unavailable'),
      gate('remaining-service-time', 'unavailable'),
      gate('ee-advantage', 'unavailable'),
    ],
  });
}

function set(
  sourceFrameId: string,
  values: readonly { readonly key: CandidateLinkKey; readonly sinrDb: number; readonly scheduled?: boolean }[],
): CandidateOpportunitySet {
  const opportunities = values.map(value => opportunity(
    sourceFrameId,
    value.key,
    value.sinrDb,
    value.scheduled ?? true,
  ));
  const scheduledCount = values.filter(value => value.scheduled ?? true).length;
  return Object.freeze({
    primaryUeId: UE,
    sourceFrameId,
    opportunities: Object.freeze(opportunities),
    counts: Object.freeze({
      observed: opportunities.length,
      geometricallyReachable: opportunities.length,
      steeringValid: opportunities.length,
      scheduledAndIlluminated: scheduledCount,
      serviceEligible: 0,
    }),
  });
}

function clock(
  sourceFrameId: string,
  simTimeMs: number,
  dtSec: number,
  options: {
    readonly discontinuity?: DecisionClockContext['discontinuity'];
    readonly epochToken?: string;
  } = {},
): DecisionClockContext {
  return {
    sourceFrameId,
    simTimeMs,
    dtSec,
    epochToken: options.epochToken ?? 'epoch-a',
    discontinuity: options.discontinuity ?? 'none',
  };
}

function state(frame: { readonly states: readonly CandidateDecisionState[] }, key: CandidateLinkKey) {
  const result = frame.states.find(item => candidateLinkKeyString(item.key) === candidateLinkKeyString(key));
  assert.ok(result, `missing state ${candidateLinkKeyString(key)}`);
  return result;
}

function policy(tttSec = 2) {
  return new SinrOffsetPolicy({
    initialTttSec: 0,
    interTttSec: tttSec,
    intraTttSec: tttSec,
    interOffsetDb: 0,
    intraOffsetDb: 0,
  });
}

function engine(options: {
  readonly initialServing?: CandidateLinkKey | null;
  readonly tttSec?: number;
  readonly selectionHoldSec?: number;
  readonly guardSec?: number;
  readonly absenceToleranceSec?: number;
} = {}) {
  return new HandoverDecisionEngine({
    episodeId: 'decision-fixture',
    policy: policy(options.tttSec ?? 2),
    selectionHoldSec: options.selectionHoldSec ?? 2,
    guardSec: options.guardSec ?? 2,
    candidateAbsenceToleranceSec: options.absenceToleranceSec ?? 0,
    initialServing: options.initialServing === undefined ? SERVING : options.initialServing,
  });
}

test('independent pair TTT survives leader changes and commits exactly one inter target', () => {
  const subject = engine();
  const intra = candidateLinkKey('SAT-A', 2);
  const interOne = candidateLinkKey('SAT-B', 1);
  const interTwo = candidateLinkKey('SAT-B', 2);
  const values = (leader: 'one' | 'two') => [
    { key: SERVING, sinrDb: 10 },
    { key: intra, sinrDb: 13 },
    { key: interOne, sinrDb: leader === 'one' ? 17 : 15 },
    { key: interTwo, sinrDb: leader === 'two' ? 16 : 14 },
  ];

  const first = subject.step(set('f1', values('one')), clock('f1', 1_000, 1));
  assert.equal(first.phase, 'qualifying');
  assert.equal(state(first, interOne).qualificationSec, 1);
  assert.equal(state(first, interTwo).qualificationSec, 1);

  const second = subject.step(set('f2', values('two')), clock('f2', 2_000, 1));
  assert.equal(second.phase, 'selection-hold');
  assert.deepEqual(second.provisionalLeader, interTwo);
  assert.equal(state(second, interOne).qualificationSec, 2);
  assert.equal(state(second, interTwo).qualificationSec, 2);

  const third = subject.step(set('f3', values('one')), clock('f3', 3_000, 1));
  assert.equal(third.phase, 'selection-hold');
  assert.deepEqual(third.provisionalLeader, interOne);
  assert.equal(third.selectionHoldSec, 1);
  assert.equal(state(third, interOne).qualificationSec, 3);
  assert.equal(state(third, interTwo).qualificationSec, 3);

  const selected = subject.step(set('f4', values('one')), clock('f4', 4_000, 1));
  assert.equal(selected.phase, 'switching');
  assert.deepEqual(selected.selectedTarget, interOne);
  assert.equal(selected.recentCommit, null);
  assert.deepEqual(selected.serving, SERVING);

  const committed = subject.step(set('f5', values('one')), clock('f5', 5_000, 1));
  assert.equal(committed.phase, 'switching');
  assert.deepEqual(committed.serving, interOne);
  assert.equal(committed.recentCommit?.kind, 'inter-satellite');
  assert.deepEqual(committed.recentCommit?.from, SERVING);
  assert.deepEqual(committed.recentCommit?.to, interOne);
  assert.equal(committed.recentCommit?.oldLinkEnded, true);
  assert.equal(committed.recentCommit?.newLinkStarted, true);

  const guarded = subject.step(set('f6', values('one')), clock('f6', 6_000, 1));
  assert.equal(guarded.phase, 'guard');
  assert.equal(guarded.recentCommit, null);
  assert.deepEqual(guarded.serving, interOne);
  assert.equal(guarded.states.filter(item => item.stable).length, 0);
});

test('the same TTT, hold, selected, and atomic-commit phases handle an intra target', () => {
  const subject = engine({ tttSec: 1, selectionHoldSec: 1, guardSec: 1 });
  const intra = candidateLinkKey('SAT-A', 2);
  const values = [
    { key: SERVING, sinrDb: 10 },
    { key: intra, sinrDb: 15 },
    { key: candidateLinkKey('SAT-B', 1), sinrDb: 12 },
  ];

  const selected = subject.step(set('i1', values), clock('i1', 1_000, 1));
  assert.equal(selected.phase, 'switching');
  assert.deepEqual(selected.selectedTarget, intra);
  assert.equal(selected.selectedKind, 'intra-satellite');
  assert.equal(selected.recentCommit, null);

  const committed = subject.step(set('i2', values), clock('i2', 2_000, 1));
  assert.equal(committed.recentCommit?.kind, 'intra-satellite');
  assert.deepEqual(committed.serving, intra);
  assert.deepEqual(committed.recentCommit?.from, SERVING);
  assert.deepEqual(committed.recentCommit?.to, intra);
});

test('initial attach is selected and committed without fabricating an inter handover', () => {
  const subject = engine({ initialServing: null, tttSec: 0, selectionHoldSec: 0, guardSec: 0 });
  const target = candidateLinkKey('SAT-B', 1);
  const values = [{ key: target, sinrDb: 8 }];

  const selected = subject.step(set('a0', values), clock('a0', 0, 0));
  assert.equal(selected.phase, 'switching');
  assert.equal(selected.selectedKind, 'initial-attach');
  assert.equal(selected.serving, null);
  assert.equal(selected.recentCommit, null);

  const committed = subject.step(set('a1', values), clock('a1', 1_000, 1));
  assert.equal(committed.recentCommit?.kind, 'initial-attach');
  assert.equal(committed.recentCommit?.oldLinkEnded, false);
  assert.deepEqual(committed.serving, target);
});

test('paused time does not advance TTT and clock discontinuities reset timers but preserve serving', () => {
  const subject = engine({ tttSec: 3, selectionHoldSec: 2 });
  const target = candidateLinkKey('SAT-B', 1);
  const values = [
    { key: SERVING, sinrDb: 10 },
    { key: target, sinrDb: 15 },
  ];

  const first = subject.step(set('c1', values), clock('c1', 1_000, 1));
  assert.equal(state(first, target).qualificationSec, 1);
  const paused = subject.step(set('c-pause', values), clock('c-pause', 1_000, 0));
  assert.equal(state(paused, target).qualificationSec, 1);

  const seek = subject.step(
    set('c-seek', values),
    clock('c-seek', 500, 0, { discontinuity: 'seek' }),
  );
  assert.equal(state(seek, target).qualificationSec, 0);
  assert.deepEqual(seek.serving, SERVING);
  assert.equal(first.episodeId, 'decision-fixture');
  assert.equal(seek.episodeId, 'decision-fixture/1');

  const resumed = subject.step(set('c2', values), clock('c2', 1_500, 1));
  assert.equal(state(resumed, target).qualificationSec, 1);
  const epochChange = subject.step(
    set('c-epoch', values),
    clock('c-epoch', 2_500, 1, { discontinuity: 'epoch-change', epochToken: 'epoch-b' }),
  );
  assert.equal(state(epochChange, target).qualificationSec, 0);
  assert.deepEqual(epochChange.serving, SERVING);
  assert.equal(epochChange.episodeId, 'decision-fixture/2');
});

test('brief candidate absence preserves only that pair timer within the configured tolerance', () => {
  const subject = engine({ tttSec: 3, selectionHoldSec: 2, absenceToleranceSec: 1 });
  const retained = candidateLinkKey('SAT-B', 1);
  const other = candidateLinkKey('SAT-C', 1);
  const both = [
    { key: SERVING, sinrDb: 10 },
    { key: retained, sinrDb: 16 },
    { key: other, sinrDb: 15 },
  ];
  subject.step(set('m1', both), clock('m1', 1_000, 1));
  subject.step(set('m2', [both[0]!, both[2]!]), clock('m2', 1_500, 0.5));
  const returned = subject.step(set('m3', both), clock('m3', 2_000, 0.5));

  assert.equal(state(returned, retained).qualificationSec, 1.5);
  assert.equal(state(returned, other).qualificationSec, 2);
});

test('a failed trigger resets only that pair while another qualified pair keeps its TTT', () => {
  const subject = engine({ tttSec: 3, selectionHoldSec: 2 });
  const failedThenRecovered = candidateLinkKey('SAT-B', 1);
  const uninterrupted = candidateLinkKey('SAT-C', 1);
  const serving = { key: SERVING, sinrDb: 10 };

  subject.step(set('r1', [
    serving,
    { key: failedThenRecovered, sinrDb: 16 },
    { key: uninterrupted, sinrDb: 15 },
  ]), clock('r1', 1_000, 1));
  const failed = subject.step(set('r2', [
    serving,
    { key: failedThenRecovered, sinrDb: 16, scheduled: false },
    { key: uninterrupted, sinrDb: 15 },
  ]), clock('r2', 2_000, 1));

  assert.equal(state(failed, failedThenRecovered).qualificationSec, 0);
  assert.equal(state(failed, uninterrupted).qualificationSec, 2);

  const recovered = subject.step(set('r3', [
    serving,
    { key: failedThenRecovered, sinrDb: 16 },
    { key: uninterrupted, sinrDb: 15 },
  ]), clock('r3', 3_000, 1));
  assert.equal(state(recovered, failedThenRecovered).qualificationSec, 1);
  assert.equal(state(recovered, uninterrupted).qualificationSec, 3);
});

test('an armed target cannot commit after another stable pair becomes the leader', () => {
  const subject = engine({ tttSec: 1, selectionHoldSec: 1, guardSec: 1 });
  const firstLeader = candidateLinkKey('SAT-B', 1);
  const replacementLeader = candidateLinkKey('SAT-C', 1);
  const serving = { key: SERVING, sinrDb: 10 };

  const armed = subject.step(set('l1', [
    serving,
    { key: firstLeader, sinrDb: 17 },
    { key: replacementLeader, sinrDb: 16 },
  ]), clock('l1', 1_000, 1));
  assert.deepEqual(armed.selectedTarget, firstLeader);
  assert.equal(armed.recentCommit, null);

  const displaced = subject.step(set('l2', [
    serving,
    { key: firstLeader, sinrDb: 16 },
    { key: replacementLeader, sinrDb: 18 },
  ]), clock('l2', 2_000, 1));
  assert.equal(displaced.recentCommit, null);
  assert.deepEqual(displaced.serving, SERVING);
  assert.deepEqual(displaced.selectedTarget, replacementLeader);

  const committed = subject.step(set('l3', [
    serving,
    { key: firstLeader, sinrDb: 16 },
    { key: replacementLeader, sinrDb: 18 },
  ]), clock('l3', 3_000, 1));
  assert.deepEqual(committed.recentCommit?.to, replacementLeader);
  assert.deepEqual(committed.serving, replacementLeader);
});

test('candidate absence beyond tolerance discards that pair timer before it returns', () => {
  const subject = engine({ tttSec: 3, selectionHoldSec: 2, absenceToleranceSec: 0.5 });
  const target = candidateLinkKey('SAT-B', 1);
  const serving = { key: SERVING, sinrDb: 10 };

  subject.step(set('x1', [serving, { key: target, sinrDb: 16 }]), clock('x1', 1_000, 1));
  subject.step(set('x2', [serving]), clock('x2', 2_000, 1));
  const returned = subject.step(
    set('x3', [serving, { key: target, sinrDb: 16 }]),
    clock('x3', 3_000, 1),
  );

  assert.equal(state(returned, target).qualificationSec, 1);
});

test('a sparse post-guard frame credits only time after the guard expires', () => {
  const subject = engine({ tttSec: 2, selectionHoldSec: 1, guardSec: 2 });
  const firstTarget = candidateLinkKey('SAT-B', 1);
  const beforeCommit = [
    { key: SERVING, sinrDb: 10 },
    { key: firstTarget, sinrDb: 16 },
  ];

  subject.step(set('g1', beforeCommit), clock('g1', 1_000, 1));
  subject.step(set('g2', beforeCommit), clock('g2', 2_000, 1));
  const committed = subject.step(set('g3', beforeCommit), clock('g3', 3_000, 1));
  assert.deepEqual(committed.serving, firstTarget);
  assert.deepEqual(committed.recentCommit?.to, firstTarget);

  // Guard covers t=3..5. There is no intermediate frame; t=6 must credit
  // only the one active second after t=5, not the full three-second delta.
  const afterGuard = subject.step(set('g6', [
    { key: firstTarget, sinrDb: 10 },
    { key: SERVING, sinrDb: 16 },
  ]), clock('g6', 6_000, 3));
  assert.equal(afterGuard.phase, 'qualifying');
  assert.equal(state(afterGuard, SERVING).qualificationSec, 1);
  assert.equal(afterGuard.recentCommit, null);
});

test('snapshot and restore rewind an emitted commit and reproduce the same next frame', () => {
  const options = { tttSec: 1, selectionHoldSec: 1, guardSec: 2 } as const;
  const target = candidateLinkKey('SAT-B', 1);
  const values = [
    { key: SERVING, sinrDb: 10 },
    { key: target, sinrDb: 16 },
  ];
  const firstSet = set('snapshot-before', values);
  const commitSet = set('snapshot-commit', values);
  const firstClock = clock('snapshot-before', 1_000, 1);
  const commitClock = clock('snapshot-commit', 2_000, 1);

  const subject = engine(options);
  subject.step(firstSet, firstClock);
  const checkpoint = subject.snapshot();

  assert.deepEqual(checkpoint.serving, SERVING);
  assert.equal(checkpoint.timers.length, 1);
  assert.equal(checkpoint.timers[0]?.qualificationSec, 1);
  assert.deepEqual(checkpoint.provisionalLeader, target);
  assert.deepEqual(checkpoint.armedTarget, target);
  assert.equal(checkpoint.selectionHoldSec, 1);
  assert.equal(checkpoint.previousSimTimeMs, 1_000);
  assert.equal(Object.isFrozen(checkpoint), true);
  assert.equal(Object.isFrozen(checkpoint.timers), true);
  assert.equal(Object.isFrozen(checkpoint.timers[0]), true);

  const reference = engine(options);
  reference.step(firstSet, firstClock);
  const expected = reference.step(commitSet, commitClock);

  const mutated = subject.step(commitSet, commitClock);
  assert.equal(mutated.recentCommit?.kind, 'inter-satellite');
  assert.deepEqual(mutated.serving, target);

  subject.restore(checkpoint);
  const replayed = subject.step(commitSet, commitClock);

  assert.deepEqual(replayed, expected);
  assert.deepEqual(subject.snapshot(), reference.snapshot());
});

test('restore clones timer maps and key records instead of retaining checkpoint aliases', () => {
  const target = candidateLinkKey('SAT-B', 1);
  const subject = engine({ tttSec: 3 });
  subject.step(set('alias-before', [
    { key: SERVING, sinrDb: 10 },
    { key: target, sinrDb: 16 },
  ]), clock('alias-before', 1_000, 1));
  const original = subject.snapshot();
  const external = JSON.parse(JSON.stringify(original)) as HandoverDecisionEngineSnapshot & {
    readonly [key: string]: unknown;
  };

  subject.restore(external);
  const restored = subject.snapshot();
  assert.notStrictEqual(restored, external);
  assert.notStrictEqual(restored.timers, external.timers);
  assert.notStrictEqual(restored.timers[0], external.timers[0]);
  assert.notStrictEqual(restored.timers[0]?.key, external.timers[0]?.key);

  const mutableExternal = external as any;
  mutableExternal.serving.beamId = 99;
  mutableExternal.timers[0].qualificationSec = 99;
  mutableExternal.timers[0].key.beamId = 99;
  mutableExternal.timers.push({
    key: { satelliteId: 'SAT-X', beamId: 4 },
    qualificationSec: 99,
    absentSec: 0,
  });

  assert.deepEqual(subject.snapshot(), original);
  assert.deepEqual(subject.servingLink, SERVING);
});

test('snapshot and restore preserve the policy mode boundary for EE evaluations', () => {
  const target = candidateLinkKey('SAT-B', 1);
  const eePolicy = {
    evaluate(input: { readonly alternatives: readonly CandidateOpportunity[] }) {
      return {
        mode: 'ee-optimization' as const,
        assessments: input.alternatives.map(candidate => ({
          key: candidate.key,
          hardEligibility: 'eligible' as const,
          triggerStatus: 'satisfied' as const,
          requiredTttSec: 1,
          rejectionCodes: [],
        })),
      };
    },
  };
  const options = {
    episodeId: 'ee-snapshot-fixture',
    policy: eePolicy,
    selectionHoldSec: 1,
    guardSec: 1,
    initialServing: SERVING,
  } as const;
  const values = [
    { key: SERVING, sinrDb: 10 },
    { key: target, sinrDb: 16 },
  ];
  const firstSet = set('ee-snapshot-before', values);
  const nextSet = set('ee-snapshot-next', values);
  const firstClock = clock('ee-snapshot-before', 1_000, 1);
  const nextClock = clock('ee-snapshot-next', 2_000, 1);
  const subject = new HandoverDecisionEngine(options);
  subject.step(firstSet, firstClock);
  const checkpoint = subject.snapshot();
  const changed = subject.step(nextSet, nextClock);
  assert.equal(changed.mode, 'ee-optimization');

  subject.restore(checkpoint);
  const restored = subject.step(nextSet, nextClock);
  assert.equal(restored.mode, 'ee-optimization');
  assert.deepEqual(restored.states, changed.states);
  assert.equal(restored.recentCommit?.reason.includes('forecast EE'), true);
});

test('an accepted service-continuity transaction preserves the episode and enters guard', () => {
  const target = candidateLinkKey('SAT-B', 1);
  const alternative = candidateLinkKey('SAT-C', 2);
  const subject = engine({ tttSec: 1, selectionHoldSec: 1, guardSec: 2 });
  const missingServingFrame = subject.step(set('continuity-frame', [
    { key: target, sinrDb: 20 },
    { key: alternative, sinrDb: 18 },
  ]), clock('continuity-frame', 1_000, 1));
  const receipt = createHandoverCommitReceipt({
    episodeId: missingServingFrame.episodeId,
    sourceFrameId: missingServingFrame.sourceFrameId,
    simTimeMs: missingServingFrame.simTimeMs,
    from: SERVING,
    to: target,
    kind: 'inter-satellite',
    mode: 'service-continuity-protection',
    reason: 'serving pair disappeared and the replacement passed final measurement',
    oldLinkEnded: true,
    newLinkStarted: true,
  });

  subject.acceptServiceContinuityCommit(receipt);
  assert.deepEqual(subject.servingLink, target);
  assert.equal(subject.snapshot().currentEpisodeId, missingServingFrame.episodeId);

  const guarded = subject.step(set('continuity-guard', [
    { key: target, sinrDb: 12 },
    { key: alternative, sinrDb: 30 },
  ]), clock('continuity-guard', 1_500, 0.5));
  assert.equal(guarded.phase, 'guard');
  assert.equal(guarded.recentCommit, null);
  assert.equal(state(guarded, alternative).qualificationSec, 0);

  const beforeRejectedDuplicate = subject.snapshot();
  assert.throws(
    () => subject.acceptServiceContinuityCommit(receipt),
    /latest stepped simulation frame|source does not match/,
  );
  assert.deepEqual(subject.snapshot(), beforeRejectedDuplicate);
});
