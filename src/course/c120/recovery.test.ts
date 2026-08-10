#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { C120_FIXTURE_PROVIDER, C120_STUB_PROVIDER } from './fixtures';
import { createInitialC120InteractionState } from './learningState';
import {
  createInitialC120Telemetry,
  incrementC120ActiveSecond,
  makeC120RecoveryBundle,
  recordC120FirstAnswers,
  recordC120InvalidAction,
  recordC120Scaffold,
  restoreC120RecoveryBundle,
  setC120ActiveTimingPaused,
  serializeC120RecoveryBundle,
  validateC120Telemetry,
} from './recovery';
import {
  createC120Session,
  makeC120WorkbookInput,
} from './session';

test('incomplete workbook bundle reopens with strict learner evidence and telemetry', () => {
  const provider = C120_FIXTURE_PROVIDER;
  const session = createC120Session(provider, { sessionId: 'c120-recovery-test' });
  const interaction = createInitialC120InteractionState();
  let telemetry = createInitialC120Telemetry();
  telemetry = incrementC120ActiveSecond(telemetry, 'claim-detective');
  telemetry = recordC120FirstAnswers(telemetry, [['missionContractId', 'first-contract']]);
  telemetry = recordC120InvalidAction(telemetry, 'claim-detective', 'missing-classification');
  telemetry = recordC120Scaffold(telemetry, 'claim:unit-hint');
  const workbook = provider.buildWorkbook(makeC120WorkbookInput(session, provider));
  const bundle = makeC120RecoveryBundle(provider, workbook, session, interaction, telemetry, 'claim-detective');
  const serialized = serializeC120RecoveryBundle(bundle);
  const restored = restoreC120RecoveryBundle(serialized, provider);

  assert.equal(restored.workbook.status, 'INCOMPLETE');
  assert.equal(restored.session.sessionId, session.sessionId);
  assert.equal(restored.activeSegment, 'claim-detective');
  assert.equal(restored.telemetry.activeSecondsBySegment['claim-detective'], 1);
  assert.equal(restored.telemetry.firstAnswers.missionContractId, 'first-contract');
  assert.equal(restored.telemetry.invalidActions[0]?.count, 1);
  assert.equal(restored.telemetry.importCount, 1);
  assert.equal(restored.telemetry.artifactCompletionBySegment['claim-detective'], false);
  assert.equal(restored.telemetry.causalRubric.status, 'AUTO-MARKERS / NOT HUMAN-SCORED');
});

test('recovery bundle fails closed on provider identity, units, and unknown fields', () => {
  const provider = C120_FIXTURE_PROVIDER;
  const session = createC120Session(provider, { sessionId: 'c120-recovery-tamper' });
  const workbook = provider.buildWorkbook(makeC120WorkbookInput(session, provider));
  const bundle = makeC120RecoveryBundle(
    provider,
    workbook,
    session,
    createInitialC120InteractionState(),
    createInitialC120Telemetry(),
    'claim-detective',
  );
  const serialized = serializeC120RecoveryBundle(bundle);
  assert.throws(() => restoreC120RecoveryBundle(serialized, C120_STUB_PROVIDER), /identity does not match/);

  const tamperedUnits = JSON.parse(serialized) as Record<string, any>;
  tamperedUnits.identity.units.power = 'kW';
  assert.throws(() => restoreC120RecoveryBundle(JSON.stringify(tamperedUnits), provider), /identity does not match/);

  const unknown = JSON.parse(serialized) as Record<string, unknown>;
  unknown.extra = true;
  assert.throws(() => restoreC120RecoveryBundle(JSON.stringify(unknown), provider), /unknown or missing fields/);

  const mismatchedWorkbook = JSON.parse(serialized) as Record<string, any>;
  mismatchedWorkbook.workbook.checkpointOrdinal = 99;
  assert.throws(
    () => restoreC120RecoveryBundle(JSON.stringify(mismatchedWorkbook), provider),
    /workbook does not exactly match/,
  );
});

test('telemetry schema rejects missing segment timers and invalid counts', () => {
  const telemetry = createInitialC120Telemetry();
  const missing = JSON.parse(JSON.stringify(telemetry)) as Record<string, any>;
  delete missing.activeSecondsBySegment.clinic;
  assert.throws(() => validateC120Telemetry(missing), /unknown or missing fields/);
  assert.throws(
    () => validateC120Telemetry({ ...telemetry, instructorRescueCount: -1 }),
    /non-negative integer/,
  );
});

test('active timing pauses without incrementing and resumes explicitly', () => {
  const fresh = createInitialC120Telemetry();
  const paused = setC120ActiveTimingPaused(fresh, true);
  const pausedTick = incrementC120ActiveSecond(paused, 'claim-detective');
  assert.equal(paused.activeTimingPaused, true);
  assert.equal(pausedTick.activeTimingPaused, true);
  assert.equal(pausedTick.activeSecondsBySegment['claim-detective'], 0);

  const resumed = setC120ActiveTimingPaused(pausedTick, false);
  const resumedTick = incrementC120ActiveSecond(resumed, 'claim-detective');
  assert.equal(resumed.activeTimingPaused, false);
  assert.equal(resumedTick.activeSecondsBySegment['claim-detective'], 1);
});

test('active timing pause is strict and missing or wrong-type payloads fail closed', () => {
  const telemetry = createInitialC120Telemetry();
  const missing = JSON.parse(JSON.stringify(telemetry)) as Record<string, unknown>;
  delete missing.activeTimingPaused;
  assert.throws(() => validateC120Telemetry(missing), /unknown or missing fields/);
  assert.throws(
    () => validateC120Telemetry({ ...telemetry, activeTimingPaused: 'paused' }),
    /activeTimingPaused must be boolean/,
  );
  assert.throws(
    () => setC120ActiveTimingPaused(telemetry, 'paused' as unknown as boolean),
    /active timing pause state must be boolean/,
  );
});

test('paused active timing survives strict recovery export and import', () => {
  const provider = C120_FIXTURE_PROVIDER;
  const session = createC120Session(provider, { sessionId: 'c120-paused-timing-roundtrip' });
  const pausedTelemetry = setC120ActiveTimingPaused(createInitialC120Telemetry(), true);
  const workbook = provider.buildWorkbook(makeC120WorkbookInput(session, provider));
  const bundle = makeC120RecoveryBundle(
    provider,
    workbook,
    session,
    createInitialC120InteractionState(),
    pausedTelemetry,
    'claim-detective',
  );
  const restored = restoreC120RecoveryBundle(serializeC120RecoveryBundle(bundle), provider);
  assert.equal(restored.telemetry.activeTimingPaused, true);
  assert.equal(restored.telemetry.activeSecondsBySegment['claim-detective'], 0);
  assert.equal(restored.telemetry.importCount, 1);
});

console.log('C-120 recovery-bundle tests passed');
