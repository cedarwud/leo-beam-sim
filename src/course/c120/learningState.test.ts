#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { C120_FIXTURE_PROVIDER } from './fixtures';
import {
  buildC120IdeaCard,
  createInitialC120InteractionState,
  assessC120ConstructedResponse,
  firstAnswerDelta,
  validateC120InteractionState,
  validateC120InteractionTransition,
  validateC120SegmentEvidence,
} from './learningState';

const scenario = C120_FIXTURE_PROVIDER.getScenario();

test('strict learner state round-trips and rejects unknown or legacy shapes', () => {
  const fresh = createInitialC120InteractionState();
  assert.deepEqual(validateC120InteractionState(fresh), fresh);
  assert.throws(
    () => validateC120InteractionState({ ...fresh, unknown: true }),
    /unknown or missing fields/,
  );
  const legacy = { ...fresh } as Record<string, unknown>;
  delete legacy.tleImportStage;
  assert.throws(() => validateC120InteractionState(legacy), /unknown or missing fields/);
  assert.throws(
    () => validateC120InteractionState({ ...fresh, labCSlots: ['fixed-contact'] }),
    /six-slot C-120 schedule/,
  );
});

test('completion validation gives an actionable first field and accepts completed claim evidence', () => {
  const fresh = createInitialC120InteractionState();
  const first = validateC120SegmentEvidence({
    segment: 'claim-detective',
    state: fresh,
    scenario,
    responses: {},
    activeReplay: null,
    replayRecords: [],
    checkpointOrdinal: 0,
  });
  assert.equal(first?.fieldId, 'c120-claim-rate-is-energy');
  assert.match(first?.message ?? '', /Classify all three claims/);

  const complete = validateC120InteractionState({
    ...fresh,
    claimJudgments: {
      'rate-is-energy': 'reject',
      'system-boundary': 'accept',
      'same-job': 'accept',
    },
    confidence: 'medium',
    missionContractId: scenario.missionContracts.find(item => item.comparisonStatus === 'COMPARABLE')?.id ?? '',
    claimEvidenceRevealed: true,
    claimRejudgment: 'qualify',
  });
  assert.equal(validateC120SegmentEvidence({
    segment: 'claim-detective',
    state: complete,
    scenario,
    responses: { openingClause: 'The fixed service boundary makes this comparison conditional.' },
    activeReplay: null,
    replayRecords: [],
    checkpointOrdinal: 0,
  }), null);
});

test('nonempty text is not enough for an evidence-linked constructed response', () => {
  assert.deepEqual(assessC120ConstructedResponse({ openingClause: 'hello' }, 'openingClause'), {
    ready: false,
    reason: 'too-short',
  });
  assert.equal(assessC120ConstructedResponse({ openingClause: 'This is a sufficiently long answer without any link.' }, 'openingClause').ready, false);
  assert.equal(assessC120ConstructedResponse({
    openingClause: 'The fixed service boundary makes the comparison conditional because the deadline is unchanged.',
  }, 'openingClause').ready, true);
  assert.equal(assessC120ConstructedResponse({
    falsifier: 'I would revise the idea if the service boundary fails under the same replay.',
  }, 'falsifier').ready, true);
});

test('frozen learner decisions fail closed at the transition boundary', () => {
  const fresh = createInitialC120InteractionState();
  const claimPrepared = validateC120InteractionTransition(fresh, {
    ...fresh,
    claimJudgments: { 'rate-is-energy': 'reject', 'system-boundary': 'accept', 'same-job': 'accept' },
    confidence: 'medium',
    missionContractId: 'mission-fixed-service-boundary',
  });
  const claimFrozen = validateC120InteractionTransition(claimPrepared, { ...claimPrepared, claimEvidenceRevealed: true });
  assert.throws(
    () => validateC120InteractionTransition(claimFrozen, { ...claimFrozen, missionContractId: 'mission-different-deadline' }),
    /cannot rewrite frozen missionContractId/,
  );

  const labAPrepared = validateC120InteractionTransition(claimFrozen, {
    ...claimFrozen,
    labAReferenceSeen: true,
    labACandidateId: 'balanced',
    labAMechanismId: 'active-idle-time',
    labAActiveTimePrediction: 'lower',
    labAPrediction: 'lower',
    labAServicePrediction: 'same',
    labABitJPrediction: 'higher',
    labAPredictionConfidence: 'medium',
  });
  const labAFrozen = validateC120InteractionTransition(labAPrepared, { ...labAPrepared, labAPredictionFrozen: true });
  assert.throws(
    () => validateC120InteractionTransition(labAFrozen, { ...labAFrozen, labAPrediction: 'higher' }),
    /Lab A prediction lock/,
  );
  const labARun = validateC120InteractionTransition(labAFrozen, { ...labAFrozen, labACandidateRunDone: true });
  assert.throws(
    () => validateC120InteractionTransition(labARun, { ...labARun, labACandidateRunDone: false }),
    /candidate run cannot be undone/,
  );

  const labBPrepared = validateC120InteractionTransition(labARun, {
    ...labARun,
    labBEntryAnswer: 'wait',
    labBAlternateReviewed: true,
    labBPrediction: 'lower',
    labBServicePrediction: 'same',
    labBActiveTimePrediction: 'lower',
    labBEnergyPrediction: 'lower',
    labBPredictionConfidence: 'medium',
    labBRuleId: 'stable-two',
    labBThresholdId: 'threshold-steady',
    labBHoldCountId: 'two-steps',
    labBLowerThresholdId: 'lower-one-band',
  });
  const labBFrozen = validateC120InteractionTransition(labBPrepared, {
    ...labBPrepared,
    labBPredictionFrozen: true,
    labBRuleFrozen: true,
  });
  assert.throws(
    () => validateC120InteractionTransition(labBFrozen, { ...labBFrozen, labBThresholdId: 'threshold-high' }),
    /frozen Lab B prediction|Lab B prediction\/rule lock/,
  );

  const labCPrepared = validateC120InteractionTransition(labBFrozen, {
    ...labBFrozen,
    labCEntryAnswer: 'slot 2',
    labCPrediction: 'lower',
    labCServicePrediction: 'same',
    labCFreshnessPrediction: 'same',
    labCWakePrediction: 'lower',
    labCActiveTimePrediction: 'lower',
    labCBudgetPrediction: 'higher',
    labCPredictionConfidence: 'medium',
  });
  assert.throws(
    () => validateC120InteractionTransition(labCPrepared, { ...labCPrepared, labCBaselineSeen: true }),
    /baseline result requires a frozen prediction/,
  );
  const labCFrozen = validateC120InteractionTransition(labCPrepared, { ...labCPrepared, labCPredictionFrozen: true });
  assert.throws(
    () => validateC120InteractionTransition(labCFrozen, {
      ...labCFrozen,
      labCFirstRunDone: true,
      labCFirstRunSlots: labCFrozen.labCSlots,
    }),
    /requires a frozen prediction, revealed baseline/,
  );
  const labCBaseline = validateC120InteractionTransition(labCFrozen, { ...labCFrozen, labCBaselineSeen: true });
  assert.throws(
    () => validateC120InteractionTransition(labCBaseline, {
      ...labCBaseline,
      labCSlots: ['fixed-contact', 'send-urgent', 'batch-periodic', 'fixed-outage', 'flush-batch', 'sleep'],
    }),
    /frozen first-run schedule/,
  );

  const clinicPrepared = validateC120InteractionTransition(labCBaseline, {
    ...labCBaseline,
    clinicAvailability: { state: 'available' },
    clinicPrediction: 'protect-service',
    clinicPredictionConfidence: 'high',
    clinicActionId: 'protect-service',
  });
  const clinicFrozen = validateC120InteractionTransition(clinicPrepared, { ...clinicPrepared, clinicActionFrozen: true });
  assert.throws(
    () => validateC120InteractionTransition(clinicFrozen, { ...clinicFrozen, clinicActionId: 'chase-score' }),
    /clinic feature\/action lock/,
  );
});

test('first answers and cumulative idea card remain bounded and semantic', () => {
  const fresh = createInitialC120InteractionState();
  const next = validateC120InteractionState({
    ...fresh,
    missionContractId: scenario.missionContracts[0]?.id ?? '',
    labAPrediction: 'lower',
    labACandidateId: 'pace',
    labBRuleId: 'stable-two',
    transferDomainId: 'smart-farm',
    retrievalAnswerId: 'same-boundary',
    powerTimePathwayId: 'active-idle',
  });
  const answers = firstAnswerDelta(fresh, next);
  assert.ok(answers.some(([key]) => key === 'missionContractId'));
  assert.ok(answers.some(([key]) => key === 'labACandidateId'));
  const fields = buildC120IdeaCard(next, scenario, { falsifier: 'The fixed service gate fails.' });
  assert.equal(fields.length, 8);
  assert.deepEqual(fields.map(field => field.id), [
    'baseline', 'state-data', 'control', 'power-time',
    'boundary-unit', 'service-constraint', 'held-out', 'falsifier',
  ]);
  assert.ok(fields.every(field => field.value.length > 0));
});

console.log('C-120 learner-state tests passed');
