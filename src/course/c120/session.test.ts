#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  C120_CONSTRUCTED_RESPONSE_KEYS,
  C120ContractError,
  C120_SEGMENTS,
  type C120ConstructedResponses,
} from './contract';
import { C120_FIXTURE_PROVIDER, C120_STUB_PROVIDER } from './fixtures';
import {
  C120_SESSION_SCHEMA_VERSION,
  addC120ReplayRecord,
  completeC120Segment,
  createC120Session,
  getC120SessionStorageKey,
  makeC120WorkbookInput,
  resetC120Session,
  restoreC120Session,
  serializeC120Session,
  setC120CheckpointOrdinal,
  setC120ClinicState,
  setC120ConstructedResponse,
  setC120ConstructedResponses,
  setC120MissionContract,
  setC120TransferState,
  type C120Session,
} from './session';

function expectContractError(action: () => unknown, label: string): void {
  assert.throws(action, error => error instanceof C120ContractError, label);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function completedSession(session: C120Session): C120Session {
  return C120_SEGMENTS.reduce(
    (current, segment) => completeC120Segment(current, segment.id),
    session,
  );
}

const fixture = C120_FIXTURE_PROVIDER;
const scenario = fixture.getScenario();

{
  const fresh = createC120Session(fixture, { sessionId: 'c120-recovery-round-trip' });
  assert.equal(fresh.schemaVersion, C120_SESSION_SCHEMA_VERSION);
  assert.equal(fresh.identity.scenarioId, scenario.manifest.scenario.scenarioId);
  assert.equal(fresh.identity.providerId, fixture.providerId);
  assert.equal(fresh.identity.fixtureId, scenario.manifest.scenario.fixtureId);
  assert.equal(fresh.identity.sourceMode, scenario.manifest.scenario.sourceMode);
  assert.deepEqual(fresh.identity.units, scenario.manifest.scenario.units);
  assert.equal(fresh.identity.claimBoundary, scenario.manifest.scenario.claimBoundary);
  assert.deepEqual(fresh.completedSegments, []);
  assert.deepEqual(fresh.replayRecords, []);
  assert.equal(fresh.labC.slots.length, 6);
  assert.equal(fresh.labC.slots[0], 'fixed-contact');
  assert.equal(fresh.labC.slots[3], 'fixed-outage');
  assert.equal(fresh.labC.revisionOrdinal, 0);
  assert.equal(fresh.clinic.actionId, null);
  assert.deepEqual(fresh.transfer, {
    domainId: null,
    retrievalAnswerId: null,
    retrievalPowerEnergyId: null,
    retrievalDynamicPolicyId: null,
    retrievalPredictionSavingId: null,
    transferWhatIfId: null,
    powerTimePathwayId: null,
  });

  let session = setC120CheckpointOrdinal(fresh, 3);
  session = setC120MissionContract(session, 'mission-fixed-service-boundary', fixture);
  session = setC120ConstructedResponse(session, 'openingClause', 'The claim must name its boundary.');
  const labAReplay = scenario.labA.replays[0]!;
  session = addC120ReplayRecord(session, fixture, labAReplay.input);
  const clinicReplay = scenario.clinic.replays[0]!;
  session = addC120ReplayRecord(session, fixture, clinicReplay);
  session = setC120ClinicState(session, {
    actionId: 'protect-service',
    featureSetId: 'decision-time-only',
    selectedFeatureIds: ['quality-now', 'freshness-now', 'timestamp'],
  });
  session = setC120TransferState(session, {
    domainId: 'iot-energy',
    retrievalAnswerId: 'competition-answer-1',
    retrievalPowerEnergyId: 'read-both',
    retrievalDynamicPolicyId: 'state-changes-action',
    retrievalPredictionSavingId: 'separate-evidence',
    transferWhatIfId: 'revise-held-out',
    powerTimePathwayId: 'active-idle',
  });
  session = completeC120Segment(session, 'claim-detective');
  session = completeC120Segment(session, 'tle-anchor');

  const serialized = serializeC120Session(session, fixture);
  const restored = restoreC120Session(serialized, fixture);
  assert.deepEqual(restored, session, 'valid local session must recover exactly');
  assert.notStrictEqual(restored.replayRecords[0], labAReplay, 'replay record must be copied');
  assert.deepEqual(restored.replayRecords[0]?.outcome, labAReplay.outcome);
}

{
  const session = createC120Session(fixture, { sessionId: 'c120-tamper-boundary' });
  const serialized = serializeC120Session(session, fixture);

  const dirtySchema = JSON.parse(serialized) as Record<string, any>;
  dirtySchema.schemaVersion = 'c120-old-session-v0';
  expectContractError(
    () => restoreC120Session(JSON.stringify(dirtySchema), fixture),
    'unknown session schema must not silently migrate',
  );

  const dirtyIdentity = JSON.parse(serialized) as Record<string, any>;
  dirtyIdentity.identity.scenarioId = 'c120-dirty-scenario';
  expectContractError(
    () => restoreC120Session(JSON.stringify(dirtyIdentity), fixture),
    'dirty scenario identity must fail closed',
  );

  const dirtyUnits = JSON.parse(serialized) as Record<string, any>;
  dirtyUnits.identity.units.power = 'kW';
  expectContractError(
    () => restoreC120Session(JSON.stringify(dirtyUnits), fixture),
    'dirty units must fail closed',
  );

  const dirtySourceMode = JSON.parse(serialized) as Record<string, any>;
  dirtySourceMode.identity.sourceMode = 'fallback';
  expectContractError(
    () => restoreC120Session(JSON.stringify(dirtySourceMode), fixture),
    'dirty source mode must fail closed',
  );
}

{
  const session = createC120Session(fixture, { sessionId: 'c120-response-ceiling' });
  expectContractError(
    () => setC120ConstructedResponse(session, 'not-a-frozen-key' as never, 'bad'),
    'unknown constructed response key must fail closed',
  );

  const nineResponses = {
    ...Object.fromEntries(C120_CONSTRUCTED_RESPONSE_KEYS.map(key => [key, `response:${key}`])),
    overflow: 'the ninth response',
  } as unknown as C120ConstructedResponses;
  expectContractError(
    () => setC120ConstructedResponses(session, nineResponses),
    'more than eight constructed responses must fail closed',
  );
}

{
  const session = addC120ReplayRecord(
    setC120MissionContract(
      createC120Session(fixture, { sessionId: 'c120-replay-tamper' }),
      'mission-fixed-service-boundary',
      fixture,
    ),
    fixture,
    scenario.labA.replays[0]!.input,
  );
  const tampered = JSON.parse(serializeC120Session(session, fixture)) as Record<string, any>;
  tampered.replayRecords[0].outcome.consumedEnergyJ += 1;
  expectContractError(
    () => restoreC120Session(JSON.stringify(tampered), fixture),
    'tampered provider-owned replay outcome must fail closed',
  );
}

{
  const fresh = createC120Session(fixture, { sessionId: 'c120-workbook-status' });
  assert.equal(makeC120WorkbookInput(fresh, fixture).status, 'INCOMPLETE');

  const complete = completedSession(fresh);
  const workbookInput = makeC120WorkbookInput(complete, fixture);
  assert.equal(workbookInput.status, 'COMPLETE');
  assert.deepEqual(workbookInput.completedSegments, C120_SEGMENTS.map(segment => segment.id));
  assert.equal(workbookInput.sourceMode, scenario.manifest.scenario.sourceMode);
  fixture.buildWorkbook(workbookInput);
}

{
  const fixtureSession = createC120Session(fixture, { sessionId: 'c120-provider-boundary' });
  const serialized = serializeC120Session(fixtureSession, fixture);
  expectContractError(
    () => restoreC120Session(serialized, C120_STUB_PROVIDER),
    'fixture session must not restore into another provider',
  );

  const fixtureKey = getC120SessionStorageKey(fixture);
  const stubKey = getC120SessionStorageKey(C120_STUB_PROVIDER);
  assert.notEqual(fixtureKey, stubKey);
  assert.match(fixtureKey, new RegExp(fixture.providerId));
  assert.match(fixtureKey, new RegExp(scenario.manifest.scenario.scenarioId));

  const reset = resetC120Session(fixture, { sessionId: 'c120-reset' });
  assert.equal(reset.sessionId, 'c120-reset');
  assert.equal(reset.identity.providerId, fixture.providerId);
  assert.deepEqual(reset.completedSegments, []);
  assert.deepEqual(reset.constructedResponses, {});
  assert.deepEqual(reset.replayRecords, []);
}

{
  const session = setC120MissionContract(
    createC120Session(fixture, { sessionId: 'c120-lab-c-ui-state' }),
    'mission-fixed-service-boundary',
    fixture,
  );
  const labCReplay = scenario.labC.replays.find(replay => (
    replay.input.surface === 'lab-c' && replay.input.revisionOrdinal === 1
  ));
  assert.ok(labCReplay);
  const withReplay = addC120ReplayRecord(session, fixture, labCReplay.input);
  assert.equal(withReplay.labC.slots.length, 6);
  assert.equal(withReplay.labC.revisionOrdinal, 1);
  assert.notEqual(withReplay.labC.withheldEvent, 'none');
  assert.equal(withReplay.labC.replayInputId, labCReplay.replayInputId);
  assert.equal(withReplay.clinic.actionId, null);
}

console.log('C-120 session contract tests passed');
