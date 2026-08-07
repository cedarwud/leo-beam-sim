#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadProfile } from '../profiles';
import { resolveMaxTxPowerDbm, type Profile } from '../profiles/types';
import type { LinkSample } from '../engine/signal/types';
import {
  CanonicalEePublisherSession,
  resolveCanonicalEeInput,
  type CanonicalEeInputResolution,
} from './useSimStatePublisher';
import { computeBeamshiftCanonicalEe } from '../teaching/beamshiftCanonicalEe';
import type {
  CellServingRecord,
  IlluminatedCellBeam,
  SinrLiveCellFrame,
  UeCellServingRecord,
} from './sinrLiveCellModel';

function cell(cellId: number, servingSatId: string | null): CellServingRecord {
  return {
    cellId,
    servingSatId,
    beamIdentity: servingSatId === null ? null : `${servingSatId}#cell${cellId}`,
    frequencyIndex: cellId % 3,
    servingSinrDb: servingSatId === null ? null : 0,
    candidateCount: servingSatId === null ? 0 : 1,
  };
}

function linkSample(satId: string, cellId: number, sinrDb: number, txPowerDbm: number): LinkSample {
  return {
    satId,
    beamId: cellId + 1,
    rsrpDbm: -90,
    sinrDb,
    signalDbm: -90,
    intraInterferenceDbm: -120,
    interInterferenceDbm: -120,
    noiseDbm: -120,
    denominatorDbm: -115,
    txPowerDbm,
    pathLossDb: 180,
    beamGainDb: 0,
    steeringLossDb: 0,
    receiverGainDbi: 0,
  };
}

function ue(
  ueId: string,
  servingSatId: string | null,
  cellId: number | null,
  sinrDb: number | null,
  txPowerDbm = 30,
): UeCellServingRecord {
  return {
    ueId,
    cellId,
    cellDistanceKm: 0,
    offAxisDeg: 0,
    servingSatId,
    beamIdentity: servingSatId === null || cellId === null
      ? null
      : `${servingSatId}#cell${cellId}`,
    frequencyIndex: cellId === null ? null : cellId % 3,
    sinrDb,
    servingLinkSample: servingSatId !== null && cellId !== null && sinrDb !== null
      ? linkSample(servingSatId, cellId, sinrDb, txPowerDbm)
      : null,
    handoverKind: 'none',
  };
}

function frame(
  simTimeSec: number,
  cells: readonly CellServingRecord[] = [cell(0, 'sat-a')],
  ues: readonly UeCellServingRecord[] = [],
  extraIlluminatedBeams: readonly IlluminatedCellBeam[] = [],
): SinrLiveCellFrame {
  const servingCells = cells.filter(cellRecord => cellRecord.servingSatId !== null);
  const servingSats = servingCells.map(cellRecord => cellRecord.servingSatId!);
  return {
    simTimeSec,
    cells,
    ues,
    illuminatedBeams: [
      ...servingCells.map(cellRecord => ({
        satId: cellRecord.servingSatId!,
        cellId: cellRecord.cellId,
        frequencyIndex: cellRecord.frequencyIndex,
        serving: true,
      })),
      ...extraIlluminatedBeams,
    ],
    servedCellCount: servingCells.length,
    servedUeCount: ues.filter(ueRecord => ueRecord.servingSatId !== null).length,
    servingSatCount: new Set(servingSats).size,
    intraHandoverCount: 0,
    interHandoverCount: 0,
    cumulativeIntraHandoverCount: 0,
    cumulativeInterHandoverCount: 0,
    recentHandoverEvents: [],
  };
}

function resolution(
  liveFrame: SinrLiveCellFrame,
  configIdentity = 'canonical-config-a',
  overrides: Partial<NonNullable<CanonicalEeInputResolution['input']>> = {},
): CanonicalEeInputResolution {
  return {
    input: {
      frame: liveFrame,
      bandwidthMHz: 30,
      frequencyReuse: 3,
      rfOutputPowerDbm: 30,
      ratedMaxRfOutputW: 1,
      ...overrides,
    },
    configIdentity,
    errorCode: null,
  };
}

function activeFrame(time: number): SinrLiveCellFrame {
  return frame(time, [cell(0, 'sat-a')], [ue('ue-1', 'sat-a', 0, 0)]);
}

test('publisher resolves the untouched full live frame and governed profile values', () => {
  const profile = loadProfile('hobs-2024-candidate-rich');
  const liveFrame = activeFrame(10);
  const resolved = resolveCanonicalEeInput(liveFrame, profile);

  assert.ok(resolved.input);
  assert.strictEqual(resolved.input.frame, liveFrame, 'producer receives the full frame by reference');
  assert.strictEqual(resolved.input.frame.cells, liveFrame.cells);
  assert.strictEqual(resolved.input.frame.ues, liveFrame.ues);
  assert.strictEqual(resolved.input.frame.illuminatedBeams, liveFrame.illuminatedBeams);
  assert.strictEqual(resolved.input.rfOutputPowerDbm, resolveMaxTxPowerDbm(profile.channel));
  assert.strictEqual(
    resolved.input.ratedMaxRfOutputW,
    10 ** ((resolveMaxTxPowerDbm(profile.channel) - 30) / 10),
  );
  assert.equal(resolved.errorCode, null);
});

test('baseline, positive dt, equal time, backward time, small seek, config, and reset are distinct gates', () => {
  const session = new CanonicalEePublisherSession();

  const baseline = session.advance(resolution(activeFrame(1)), 'seek-a');
  assert.equal(baseline.evaluationSampleCount, 0);
  assert.equal(baseline.eeEvalMbitPerJ, null);

  const positive = session.advance(resolution(activeFrame(2)), 'seek-a');
  assert.equal(positive.evaluationSampleCount, 1);
  assert.notEqual(positive.eeEvalMbitPerJ, null);
  const equal = session.advance(resolution(activeFrame(2)), 'seek-a');
  assert.strictEqual(equal, positive, 'equal timestamp does not recompute or append');

  const backward = session.advance(resolution(activeFrame(1.5)), 'seek-a');
  assert.equal(backward.evaluationSampleCount, 0);
  assert.equal(backward.eeEvalMbitPerJ, null);

  const seekBaseline = session.advance(resolution(activeFrame(4)), 'seek-b');
  assert.equal(seekBaseline.evaluationSampleCount, 0, 'explicit replay seek re-anchors');
  const seekPositive = session.advance(resolution(activeFrame(4.25)), 'seek-b');
  assert.equal(seekPositive.evaluationSampleCount, 1, 'small forward seek interval is appendable after baseline');

  const configBaseline = session.advance(resolution(activeFrame(5), 'canonical-config-b'), 'seek-b');
  assert.equal(configBaseline.evaluationSampleCount, 0, 'canonical config identity resets the window');
  session.resetWindow();
  const explicitResetBaseline = session.advance(resolution(activeFrame(6), 'canonical-config-b'), 'seek-b');
  assert.equal(explicitResetBaseline.evaluationSampleCount, 0, 'explicit measurement reset re-anchors');
});

test('typed producer errors publish invalid and never integrate the invalid interval', () => {
  const session = new CanonicalEePublisherSession();
  session.advance(resolution(activeFrame(1)), 'seek-a');

  const invalidFrame = activeFrame(2);
  const invalidResolution = resolution(
    invalidFrame,
    'canonical-config-a',
    {
      frame: {
        ...invalidFrame,
        illuminatedBeams: [
          ...invalidFrame.illuminatedBeams,
          { satId: 'sat-extra', cellId: 0, frequencyIndex: 0, serving: true },
        ],
      },
    },
  );
  const invalid = session.advance(invalidResolution, 'seek-a');
  assert.equal(invalid.status, 'invalid');
  assert.equal(invalid.errorCode, 'ACTIVE_KEY_MISMATCH');
  assert.equal(invalid.evaluationSampleCount, 0);
  assert.equal(invalid.eeEvalMbitPerJ, null);

  const recovery = session.advance(resolution(activeFrame(3)), 'seek-a');
  assert.equal(recovery.status, 'valid');
  assert.equal(recovery.evaluationSampleCount, 0, 'frame after invalid interval is baseline only');
  assert.equal(recovery.eeEvalMbitPerJ, null);
});

test('missing rated cap stays pending and no teaching 3 W surface enters the producer input', () => {
  const profile = loadProfile('hobs-2024-candidate-rich');
  const profileWithoutRatedCap: Profile = {
    ...profile,
    channel: { ...profile.channel, maxTxPowerDbm: undefined },
  };
  const resolved = resolveCanonicalEeInput(activeFrame(1), profileWithoutRatedCap);
  assert.equal(resolved.input, null);
  assert.equal(resolved.errorCode, 'MISSING_RATED_MAX_RF_OUTPUT');

  const session = new CanonicalEePublisherSession();
  const pending = session.advance(resolved);
  assert.equal(pending.status, 'pending');
  assert.equal(pending.errorCode, 'MISSING_RATED_MAX_RF_OUTPUT');

  const valid = session.advance(resolution(activeFrame(1)));
  assert.equal(valid.status, 'valid');
  assert.notEqual(valid.systemPowerW, 3, 'canonical power comes from producer PA/RFC/baseband assumptions, not teaching P_total');
});

test('publisher preserves every producer per-user field without recomputation', () => {
  const liveFrame = frame(
    1,
    [cell(0, 'sat-a')],
    [
      ue('ue-served', 'sat-a', 0, 4),
      ue('ue-outage', 'sat-a', 0, null),
      ue('ue-unserved', null, null, null),
    ],
  );
  const resolved = resolution(liveFrame);
  const expected = computeBeamshiftCanonicalEe(resolved.input!);
  const measured = new CanonicalEePublisherSession().advance(resolved);

  assert.deepEqual(
    measured.perUserContributions,
    expected.users.map(user => ({
      ueId: user.ueId,
      status: user.status,
      satId: user.satId,
      cellId: user.cellId,
      assignedBeamLoad: user.assignedBeamLoad,
      allocatedBandwidthMHz: user.allocatedBandwidthMHz,
      sinrDb: user.sinrDb,
      rateMbps: user.rateMbps,
      contributionMbitPerJ: user.contributionMbitPerJ,
    })),
  );
});

test('producer status, identity, per-user contributions, and zero activity are preserved', () => {
  const session = new CanonicalEePublisherSession();
  const measured = session.advance(resolution(frame(
    1,
    [cell(0, 'sat-a')],
    [
      ue('ue-served', 'sat-a', 0, 0),
      ue('ue-outage', 'sat-a', 0, null),
    ],
  )));
  assert.equal(measured.status, 'valid');
  assert.equal(measured.sumIdentity, true);
  assert.deepEqual(
    measured.perUserContributions?.map(user => user.ueId),
    ['ue-outage', 'ue-served'],
  );
  assert.equal(measured.perUserContributions?.find(user => user.ueId === 'ue-outage')?.contributionMbitPerJ, 0);
  assert.equal(measured.eeEvalMbitPerJ, null, 'evaluation remains absent before positive dt');

  const zeroActivity = new CanonicalEePublisherSession().advance(
    resolution(frame(1, [cell(0, null)], [ue('ue-idle', null, null, null)])),
  );
  assert.equal(zeroActivity.status, 'zero-activity');
  assert.equal(zeroActivity.sumIdentity, true);
  assert.equal(zeroActivity.systemPowerW, 0);
  assert.equal(zeroActivity.eeInstMbitPerJ, 0);
  assert.equal(zeroActivity.perUserContributions?.[0]?.contributionMbitPerJ, 0);
});

console.log('canonical publisher session integration gates passed.');
