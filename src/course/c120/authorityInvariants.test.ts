import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assertC120Scenario,
  C120ContractError,
  replayInputId,
  type C120AuthoritativeReplay,
  type C120Scenario,
} from './contract';
import { C120_FIXTURE_PROVIDER, C120_STUB_PROVIDER } from './fixtures';
import { resolveC120Replay } from './replay';
import {
  addC120ReplayRecord,
  createC120Session,
  makeC120WorkbookInput,
  setC120MissionContract,
} from './session';

function allReplays(scenario: C120Scenario): readonly C120AuthoritativeReplay[] {
  return [
    ...scenario.labA.replays,
    ...scenario.labB.replays,
    ...scenario.labC.replays,
    ...scenario.clinic.replays,
  ];
}

function outcomeKey(replay: C120AuthoritativeReplay): string {
  const { outcome } = replay;
  return JSON.stringify({
    servicePass: outcome.servicePass,
    deadlinePass: outcome.deadlinePass,
    freshnessStatus: outcome.freshnessStatus,
    consumedEnergyJ: outcome.consumedEnergyJ,
    deliveredBits: outcome.deliveredBits,
    energyEfficiencyBitsPerJ: outcome.energyEfficiencyBitsPerJ,
  });
}

function expectContractError(action: () => unknown, label: string): void {
  assert.throws(action, error => error instanceof C120ContractError, label);
}

function comparableMissionId(scenario: C120Scenario): string {
  const comparable = scenario.missionContracts.find(contract => contract.comparisonStatus === 'COMPARABLE');
  assert.ok(comparable, 'fixture must declare one comparable mission contract');
  return comparable.id;
}

function clinicInput(replay: C120AuthoritativeReplay) {
  if (replay.input.surface !== 'clinic') throw new C120ContractError(`${replay.replayId} is not a clinic replay`);
  return replay.input;
}

test('one scenario identity and comparable mission bind TLE, A/B/C, clinic, and workbook', () => {
  const provider = C120_FIXTURE_PROVIDER;
  const scenario = provider.getScenario();
  const scenarioId = scenario.manifest.scenario.scenarioId;
  const missionId = comparableMissionId(scenario);
  const replays = allReplays(scenario);

  assert.equal(scenario.tle.identity.scenarioId, scenarioId);
  assert.equal(scenario.tle.identity.surface, 'tle');
  assert.ok(replays.length >= 2);
  for (const replay of replays) {
    assert.equal(replay.identity.scenarioId, scenarioId, replay.replayId);
    assert.equal(replay.input.missionContractId, missionId, replay.replayId);
    assert.equal(replay.replayInputId, replayInputId(replay.input), replay.replayId);
    for (const frame of replay.frames) {
      assert.equal(frame.identity.scenarioId, scenarioId, `${replay.replayId}/${frame.frameIndex}`);
      assert.equal(frame.identity.replayInputId, replay.replayInputId, `${replay.replayId}/${frame.frameIndex}`);
    }
  }

  const session = createC120Session(provider, { sessionId: 'authority-identity' });
  const workbook = provider.buildWorkbook(makeC120WorkbookInput(session, provider));
  assert.equal(workbook.identity.scenarioId, scenarioId);
  assert.equal(workbook.scenarioId, scenarioId);
  assert.equal(workbook.tle.identity.scenarioId, scenarioId);
  assert.equal(workbook.missionContract, null);
});

test('Lab A hidden conditions change qualifying candidates and the provider-owned winner', () => {
  const scenario = C120_FIXTURE_PROVIDER.getScenario();
  const highIdleCost = scenario.labA.replays.filter(replay => (
    replay.input.surface === 'lab-a' && replay.input.hiddenConditionId === 'high-idle-cost'
  ));
  const tightServiceWindow = scenario.labA.replays.filter(replay => (
    replay.input.surface === 'lab-a' && replay.input.hiddenConditionId === 'tight-service-window'
  ));

  assert.equal(highIdleCost.length, 3);
  assert.equal(tightServiceWindow.length, 3);

  const qualifyingCandidates = (replays: readonly C120AuthoritativeReplay[]) => replays
    .filter(replay => replay.outcome.servicePass)
    .map(replay => replay.input.surface === 'lab-a' ? replay.input.candidateId : '')
    .sort();
  assert.deepEqual(qualifyingCandidates(highIdleCost), ['balanced', 'pace']);
  assert.deepEqual(qualifyingCandidates(tightServiceWindow), ['pace']);

  // The fixture does not carry a separate winner field.  The teaching winner
  // is therefore the lowest-consumption candidate among those that qualify.
  const winner = (replays: readonly C120AuthoritativeReplay[]) => replays
    .filter(replay => replay.outcome.servicePass)
    .sort((left, right) => left.outcome.consumedEnergyJ - right.outcome.consumedEnergyJ)[0];
  assert.equal(winner(highIdleCost)?.replayId, 'lab-a-balanced-replay');
  assert.equal(winner(tightServiceWindow)?.replayId, 'lab-a-pace-tight-window-replay');
  assert.notEqual(outcomeKey(winner(highIdleCost)!), outcomeKey(winner(tightServiceWindow)!));
});

test('Lab B visible threshold, hold, and lower-block triples resolve to distinct outcomes', () => {
  const scenario = C120_FIXTURE_PROVIDER.getScenario();
  const expectedTriples = [
    ['threshold-low', 'one-step', 'lower-same'],
    ['threshold-steady', 'two-steps', 'lower-one-band'],
    ['threshold-high', 'two-steps', 'lower-two-bands'],
  ] as const;

  const selected = expectedTriples.map(([thresholdId, holdCountId, lowerThresholdId]) => {
    const replay = scenario.labB.replays.find(candidate => (
      candidate.input.surface === 'lab-b'
      && candidate.input.thresholdId === thresholdId
      && candidate.input.holdCountId === holdCountId
      && candidate.input.lowerThresholdId === lowerThresholdId
    ));
    assert.ok(replay, `${thresholdId}/${holdCountId}/${lowerThresholdId} must have an authoritative replay`);
    assert.strictEqual(resolveC120Replay(scenario, replay.input), replay);
    return replay;
  });

  assert.deepEqual(selected.map(replay => replay.replayId), [
    'lab-b-switch-now-replay',
    'lab-b-stable-two-replay',
    'lab-b-hysteresis-replay',
  ]);
  assert.equal(new Set(selected.map(outcomeKey)).size, selected.length);
  assert.deepEqual(selected.map(replay => replay.outcome.servicePass), [false, true, true]);
  assert.deepEqual(selected.map(replay => replay.outcome.freshnessStatus), ['expired', 'fresh', 'fresh']);
});

test('Lab C candidate and revision schedules change replay outcome and preserve provider-owned card ledgers', () => {
  const scenario = C120_FIXTURE_PROVIDER.getScenario();
  const baseline = scenario.labC.replays.find(replay => replay.replayId === 'lab-c-immediate-baseline-replay');
  const candidate = scenario.labC.replays.find(replay => replay.replayId === 'lab-c-batched-replay');
  const revision = scenario.labC.replays.find(replay => replay.replayId === 'lab-c-revision-replay');
  assert.ok(baseline && candidate && revision);

  assert.notEqual(baseline.replayInputId, candidate.replayInputId);
  assert.notEqual(candidate.replayInputId, revision.replayInputId);
  assert.notEqual(outcomeKey(baseline), outcomeKey(candidate));
  assert.notEqual(outcomeKey(candidate), outcomeKey(revision));
  assert.equal(candidate.input.surface, 'lab-c');
  assert.equal(candidate.input.revisionOrdinal, 0);
  assert.equal(revision.input.surface, 'lab-c');
  assert.equal(revision.input.revisionOrdinal, 1);

  for (const replay of [baseline, candidate, revision]) {
    const resolved = resolveC120Replay(scenario, replay.input);
    assert.strictEqual(resolved, replay);
    assert.strictEqual(resolved.cardLedger, replay.cardLedger);
    assert.ok(replay.cardLedger.length > 0, `${replay.replayId} must expose card evidence`);
    assert.equal(new Set(replay.cardLedger.map(card => card.cardId)).size, replay.cardLedger.length);
    const lastCard = replay.cardLedger[replay.cardLedger.length - 1]!;
    assert.deepEqual(
      {
        servicePass: lastCard.servicePass,
        freshnessStatus: lastCard.freshnessStatus,
        consumedEnergyJ: lastCard.consumedEnergyJ,
        budgetRemainingJ: lastCard.budgetRemainingJ,
        deliveredBits: lastCard.deliveredBits,
        energyEfficiencyBitsPerJ: lastCard.energyEfficiencyBitsPerJ,
      },
      {
        servicePass: replay.outcome.servicePass,
        freshnessStatus: replay.outcome.freshnessStatus,
        consumedEnergyJ: replay.outcome.consumedEnergyJ,
        budgetRemainingJ: replay.outcome.budgetRemainingJ,
        deliveredBits: replay.outcome.deliveredBits,
        energyEfficiencyBitsPerJ: replay.outcome.energyEfficiencyBitsPerJ,
      },
      `${replay.replayId} final card must agree with provider outcome`,
    );
  }
});

test('clinic P/Q action changes replay, and feature-set change is visible in the input', () => {
  const scenario = C120_FIXTURE_PROVIDER.getScenario();
  const protect = scenario.clinic.replays.find(replay => (
    replay.input.surface === 'clinic'
    && replay.input.actionId === 'protect-service'
    && replay.input.featureSetId === 'decision-time-only'
  ));
  const chaseDecisionTime = scenario.clinic.replays.find(replay => (
    replay.input.surface === 'clinic'
    && replay.input.actionId === 'chase-score'
    && replay.input.featureSetId === 'decision-time-only'
  ));
  const chasePostAction = scenario.clinic.replays.find(replay => (
    replay.input.surface === 'clinic'
    && replay.input.actionId === 'chase-score'
    && replay.input.featureSetId === 'post-action-mixed'
  ));
  assert.ok(protect && chaseDecisionTime && chasePostAction);

  assert.notEqual(protect.replayInputId, chaseDecisionTime.replayInputId);
  assert.notEqual(outcomeKey(protect), outcomeKey(chaseDecisionTime));
  assert.notEqual(chaseDecisionTime.replayInputId, chasePostAction.replayInputId);
  assert.notEqual(outcomeKey(chaseDecisionTime), outcomeKey(chasePostAction));
  assert.equal(clinicInput(chaseDecisionTime).featureSetId, 'decision-time-only');
  assert.equal(clinicInput(chasePostAction).featureSetId, 'post-action-mixed');
});

test('identity, unit, and mission mismatches fail closed', () => {
  const provider = C120_FIXTURE_PROVIDER;
  const scenario = provider.getScenario();
  const validReplay = scenario.labA.replays[0]!;

  const wrongScenarioId = {
    ...scenario,
    manifest: {
      ...scenario.manifest,
      scenario: { ...scenario.manifest.scenario, scenarioId: 'tampered-scenario-id' },
    },
  };
  expectContractError(() => assertC120Scenario(wrongScenarioId, provider), 'scenario identity mismatch');
  expectContractError(() => assertC120Scenario(scenario, C120_STUB_PROVIDER), 'provider identity mismatch');

  const wrongUnits = {
    ...scenario,
    manifest: {
      ...scenario.manifest,
      scenario: {
        ...scenario.manifest.scenario,
        units: { ...scenario.manifest.scenario.units, consumedEnergy: 'mJ' },
      },
    },
  };
  expectContractError(() => assertC120Scenario(wrongUnits, provider), 'unit mismatch');

  expectContractError(
    () => resolveC120Replay(scenario, { ...validReplay.input, missionContractId: 'mission-different-deadline' }),
    'replay mission mismatch',
  );

  let session = createC120Session(provider, { sessionId: 'authority-mission' });
  session = setC120MissionContract(session, 'mission-fixed-service-boundary', provider);
  session = addC120ReplayRecord(session, provider, validReplay.input);
  expectContractError(
    () => setC120MissionContract(session, 'mission-different-deadline', provider),
    'session mission cannot change after replay',
  );
  expectContractError(
    () => provider.buildWorkbook({
      ...makeC120WorkbookInput(session, provider),
      missionContractId: 'mission-different-deadline',
    }),
    'workbook mission mismatch',
  );
});
