#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertC120Replay,
  assertC120Scenario,
  assertC120SurfaceIdentity,
  assertC120Workbook,
  C120_CLAIM_BOUNDARY,
  C120_CLAIM_LEVELS,
  C120ContractError,
  C120_CONSTRUCTED_RESPONSE_KEYS,
  C120_SEGMENTS,
  C120_UNITS,
  evidenceChanged,
  replayInputId,
  type C120CourseDataProvider,
  type C120ConstructedResponses,
  type C120Scenario,
  type C120WorkbookInput,
  type C120WorkbookReplayRecord,
} from './contract';
import {
  C120_FIXTURE_PROVIDER,
  C120_STUB_PROVIDER,
} from './fixtures';
import {
  parseC120ReplayInput,
  resolveC120Replay,
  resolveClinicReplay,
  resolveLabAReplay,
  resolveLabBReplay,
  resolveLabCReplay,
} from './replay';

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectContractError(action: () => unknown, label: string): void {
  assert.throws(action, error => error instanceof C120ContractError, label);
}

function allReplays(scenario: C120Scenario) {
  return [
    ...scenario.labA.replays,
    ...scenario.labB.replays,
    ...scenario.labC.replays,
    ...scenario.clinic.replays,
  ];
}

function workbookInputFor(scenario: C120Scenario, providerId: string): C120WorkbookInput {
  const replayRecords: C120WorkbookReplayRecord[] = allReplays(scenario).map(replay => ({
    input: cloneJson(replay.input),
    replayId: replay.replayId,
    replayInputId: replay.replayInputId,
    outcome: cloneJson(replay.outcome),
  }));
  const constructedResponses = Object.fromEntries(
    C120_CONSTRUCTED_RESPONSE_KEYS.map(key => [key, `gate0:${key}`]),
  ) as C120ConstructedResponses;
  return {
    scenarioId: scenario.manifest.scenario.scenarioId,
    sessionId: `gate0-${providerId}`,
    status: 'COMPLETE',
    checkpointOrdinal: 1,
    sourceMode: scenario.manifest.scenario.sourceMode,
    completedSegments: C120_SEGMENTS.map(segment => segment.id),
    constructedResponses,
    missionContractId: scenario.missionContracts[0]?.id ?? null,
    replayRecords,
    hintProvenance: ['gate0:bounded-hints'],
    transfer: {
      domainId: 'iot-energy',
      retrievalAnswerId: 'gate0:retrieval',
      retrievalPowerEnergyId: 'read-both',
      retrievalDynamicPolicyId: 'state-changes-action',
      retrievalPredictionSavingId: 'separate-evidence',
      transferWhatIfId: 'revise-held-out',
      powerTimePathwayId: 'active-idle',
    },
  };
}

function assertConsequentialAlternatives(label: string, replays: readonly { outcome: Parameters<typeof evidenceChanged>[0] }[]): void {
  assert.ok(replays.length >= 2, `${label} needs at least two alternatives`);
  const changed = replays.some((candidate, index) => (
    replays.slice(index + 1).some(other => evidenceChanged(candidate.outcome, other.outcome))
  ));
  assert.equal(changed, true, `${label} alternatives must change service or energy evidence`);
}

function assertIdentityCoherence(provider: C120CourseDataProvider, scenario: C120Scenario, workbook: ReturnType<C120CourseDataProvider['buildWorkbook']>): void {
  const expected = scenario.manifest.scenario;
  assert.equal(scenario.manifest.scenario.scenarioId, expected.scenarioId);
  assert.equal(scenario.tle.identity.scenarioId, expected.scenarioId);
  assert.equal(scenario.tle.identity.claimBoundary, C120_CLAIM_BOUNDARY);
  assert.deepEqual(scenario.tle.identity.claimLevels, C120_CLAIM_LEVELS);
  assert.deepEqual(scenario.tle.identity.units, C120_UNITS);
  assertC120SurfaceIdentity(scenario.tle.identity, expected, 'tle');
  assertC120SurfaceIdentity(workbook.identity, expected, 'workbook');
  assert.equal(workbook.scenarioId, expected.scenarioId);
  assert.equal(workbook.claimBoundary, C120_CLAIM_BOUNDARY);
  assert.deepEqual(workbook.provenance, {
    providerKind: provider.kind,
    providerId: provider.providerId,
    fixtureId: expected.fixtureId,
    fixtureVersion: expected.fixtureVersion,
    deterministicReplay: true,
    browserScientificFormula: false,
  });

  for (const [surface, replays] of [
    ['lab-a', scenario.labA.replays],
    ['lab-b', scenario.labB.replays],
    ['lab-c', scenario.labC.replays],
    ['clinic', scenario.clinic.replays],
  ] as const) {
    for (const replay of replays) {
      assert.equal(replay.identity.scenarioId, expected.scenarioId);
      assert.equal(replay.identity.claimBoundary, C120_CLAIM_BOUNDARY);
      assert.deepEqual(replay.identity.claimLevels, C120_CLAIM_LEVELS);
      assert.deepEqual(replay.identity.units, C120_UNITS);
      assert.equal(replay.replayInputId, replayInputId(replay.input));
      assertC120Replay(replay, expected, surface, `${surface}:${replay.replayId}`);
      const frameIds = new Set<string>();
      replay.frames.forEach((frame, index) => {
        assertC120SurfaceIdentity(frame.identity, expected, surface, `${surface}:${replay.replayId}.frame`);
        assert.equal(frame.identity.replayId, replay.replayId);
        assert.equal(frame.identity.replayInputId, replay.replayInputId);
        assert.equal(frame.frameIndex, index);
        assert.equal(frame.identity.frameId, `${replay.replayId}:frame-${index}`);
        assert.equal(frameIds.has(frame.identity.frameId), false);
        frameIds.add(frame.identity.frameId);
      });
    }
  }
}

function exerciseProvider(provider: C120CourseDataProvider) {
  const scenario = provider.getScenario();
  assertC120Scenario(scenario, provider);
  const input = workbookInputFor(scenario, provider.providerId);
  const workbook = provider.buildWorkbook(input);
  assertC120Workbook(workbook, scenario.manifest.scenario);
  assert.equal(workbook.constructedResponseCount, 8);
  assert.equal(workbook.replayRecords.length, allReplays(scenario).length);
  assert.deepEqual(
    workbook.replayRecords.map(record => record.replayId),
    input.replayRecords.map(record => record.replayId),
  );
  assertIdentityCoherence(provider, scenario, workbook);
  return { scenario, input, workbook };
}

function assertAuthoritativeAgency(scenario: C120Scenario): void {
  assertConsequentialAlternatives('Lab A', scenario.labA.replays);
  assertConsequentialAlternatives('Lab B', scenario.labB.replays);
  assertConsequentialAlternatives('Lab C', scenario.labC.replays);
  assertConsequentialAlternatives('clinic', scenario.clinic.replays);

  const labAIds = new Set(scenario.labA.replays.map(replay => replay.input.surface === 'lab-a' && replay.input.candidateId));
  assert.deepEqual([...labAIds].sort(), ['balanced', 'burst-to-sleep', 'pace']);
  const labBIds = new Set(scenario.labB.replays.map(replay => replay.input.surface === 'lab-b' && replay.input.frozenRuleId));
  assert.deepEqual([...labBIds].sort(), ['hysteresis', 'stable-two', 'switch-now']);
  const clinicIds = new Set(scenario.clinic.replays.map(replay => replay.input.surface === 'clinic' && replay.input.actionId));
  assert.deepEqual([...clinicIds].sort(), ['chase-score', 'protect-service']);

  const labCInputs = scenario.labC.replays.map(replay => replay.input);
  assert.ok(labCInputs.every(input => input.surface === 'lab-c' && input.slots.length === 6));
  assert.ok(labCInputs.some(input => input.surface === 'lab-c' && input.revisionOrdinal === 1));
  assert.ok(labCInputs.some(input => input.surface === 'lab-c' && input.withheldEvent !== 'none'));
  assert.ok(labCInputs.every(input => input.surface !== 'lab-c' || (
    input.slots[0] === 'fixed-contact' && input.slots[3] === 'fixed-outage'
  )));

  for (const replay of scenario.labA.replays) assert.strictEqual(resolveLabAReplay(scenario, replay.input), replay);
  for (const replay of scenario.labB.replays) assert.strictEqual(resolveLabBReplay(scenario, replay.input), replay);
  for (const replay of scenario.labC.replays) assert.strictEqual(resolveLabCReplay(scenario, replay.input), replay);
  for (const replay of scenario.clinic.replays) assert.strictEqual(resolveClinicReplay(scenario, replay.input), replay);
}

function assertFailClosed(provider: C120CourseDataProvider, scenario: C120Scenario, validInput: C120WorkbookInput): void {
  const mutatedScenarioId = {
    ...scenario,
    manifest: {
      ...scenario.manifest,
      scenario: { ...scenario.manifest.scenario, scenarioId: 'mutated-scenario-id' },
    },
  };
  expectContractError(() => assertC120Scenario(mutatedScenarioId, provider), 'mutated scenario_id');
  expectContractError(
    () => provider.buildWorkbook({ ...validInput, scenarioId: 'mutated-scenario-id' }),
    'workbook scenario_id mutation',
  );

  const mutatedUnits = {
    ...scenario,
    manifest: {
      ...scenario.manifest,
      scenario: {
        ...scenario.manifest.scenario,
        units: { ...scenario.manifest.scenario.units, consumedEnergy: 'mJ' },
      },
    },
  };
  expectContractError(() => assertC120Scenario(mutatedUnits, provider), 'mutated units');

  const mutatedClaimBoundary = {
    ...scenario,
    manifest: {
      ...scenario.manifest,
      claimBoundary: 'UNVERIFIED CLAIM BOUNDARY',
    },
  };
  expectContractError(() => assertC120Scenario(mutatedClaimBoundary, provider), 'mutated claim boundary');

  const firstReplay = scenario.labA.replays[0];
  assert.ok(firstReplay);
  const firstFrame = firstReplay.frames[0];
  assert.ok(firstFrame);
  const mutatedFrameIdentity = {
    ...firstFrame,
    identity: { ...firstFrame.identity, replayId: 'mutated-frame-replay-id' },
  };
  const mutatedFrameReplay = {
    ...firstReplay,
    frames: [mutatedFrameIdentity, ...firstReplay.frames.slice(1)],
  };
  const mutatedFrameScenario = {
    ...scenario,
    labA: { ...scenario.labA, replays: [mutatedFrameReplay, ...scenario.labA.replays.slice(1)] },
  };
  expectContractError(() => assertC120Scenario(mutatedFrameScenario, provider), 'mutated frame identity');

  expectContractError(
    () => resolveC120Replay(scenario, { surface: 'lab-a', candidateId: 'unknown', hiddenConditionId: 'high-idle-cost' }),
    'unknown replay input',
  );
  expectContractError(
    () => resolveC120Replay(scenario, { surface: 'lab-a', candidateId: 'pace', hiddenConditionId: 'high-idle-cost', extra: true }),
    'replay input with unknown field',
  );
  expectContractError(() => parseC120ReplayInput({ surface: 'unknown' }), 'unknown replay surface');

  const tooManyResponses = {
    ...validInput,
    constructedResponses: {
      ...validInput.constructedResponses,
      extraResponse: 'must fail closed',
    },
  } as unknown as C120WorkbookInput;
  expectContractError(() => provider.buildWorkbook(tooManyResponses), 'workbook response ceiling');

  const badOutcome = {
    ...validInput,
    replayRecords: validInput.replayRecords.map((record, index) => index === 0
      ? { ...record, outcome: { ...record.outcome, consumedEnergyJ: record.outcome.consumedEnergyJ + 1 } }
      : record),
  };
  expectContractError(() => provider.buildWorkbook(badOutcome), 'workbook provider-owned outcome');
}

function assertControllerBoundaryPendingSafe(): void {
  const root = process.cwd();
  const candidates = [
    'src/course/C120CourseRoute.tsx',
    'src/course/C120CourseScene.tsx',
    'src/course/c120/C120CourseRoute.tsx',
    'src/course/c120/C120CourseScene.tsx',
  ].map(relativePath => join(root, relativePath));
  const present = candidates.filter(path => existsSync(path));
  if (present.length === 0) {
    console.log('GATE-0 controller import boundary: PENDING (controller-owned C120 route/scene files are not present yet)');
    return;
  }

  const importText = present.map(path => readFileSync(path, 'utf8').split('\n').filter(line => (
    /^\s*import\b/.test(line) || /^\s*export\s+.+\s+from\s+['"]/.test(line)
  )).join('\n')).join('\n');
  assert.doesNotMatch(importText, /\bApp(?:\.tsx?)?\b|\bMainScene(?:\.tsx?)?\b/);
  assert.doesNotMatch(importText, /(?:^|['"/])(?:C90|c90)[^'"\s]*/);
  assert.doesNotMatch(importText, /(?:course\/contract|course\/session|from\s+['"](?:\.\.?\/)+(?:contract|session)(?:\.tsx?)?['"])/);
  assert.doesNotMatch(importText, /(?:teaching\/energyModel|utils\/(?:energyEfficiency|paperEnergyEfficiency)|engine\/signal\/link-budget)/);
  console.log(`GATE-0 controller import boundary: PASS (${present.length} route/scene file(s) checked)`);
}

function runGate0(): void {
  const fixture = exerciseProvider(C120_FIXTURE_PROVIDER);
  const stub = exerciseProvider(C120_STUB_PROVIDER);

  assert.equal(fixture.scenario.manifest.scenario.scenarioId, stub.scenario.manifest.scenario.scenarioId);
  assert.notEqual(fixture.scenario.manifest.scenario.providerId, stub.scenario.manifest.scenario.providerId);
  assert.equal(fixture.scenario.manifest.scenario.providerKind, 'fixture');
  assert.equal(stub.scenario.manifest.scenario.providerKind, 'stub');
  assert.deepEqual(
    fixture.scenario.manifest.segments,
    stub.scenario.manifest.segments,
    'provider replacement must preserve the same course interface',
  );
  assert.deepEqual(
    fixture.scenario.labA.replays.map(replay => replay.replayInputId),
    stub.scenario.labA.replays.map(replay => replay.replayInputId),
  );
  assert.deepEqual(
    fixture.scenario.labB.replays.map(replay => replay.replayInputId),
    stub.scenario.labB.replays.map(replay => replay.replayInputId),
  );
  assert.deepEqual(
    fixture.scenario.labC.replays.map(replay => replay.replayInputId),
    stub.scenario.labC.replays.map(replay => replay.replayInputId),
  );
  assert.deepEqual(
    fixture.scenario.clinic.replays.map(replay => replay.replayInputId),
    stub.scenario.clinic.replays.map(replay => replay.replayInputId),
  );

  assertAuthoritativeAgency(fixture.scenario);
  assertAuthoritativeAgency(stub.scenario);
  assertFailClosed(C120_FIXTURE_PROVIDER, fixture.scenario, fixture.input);
  assertFailClosed(C120_STUB_PROVIDER, stub.scenario, stub.input);
  assertControllerBoundaryPendingSafe();
  console.log('C120-IMP-00 Gate 0: PASS (fixture/stub provider replacement, identity, agency, workbook and fail-closed checks)');
}

runGate0();
