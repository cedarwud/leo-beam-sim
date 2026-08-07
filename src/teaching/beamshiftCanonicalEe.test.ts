#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type {
  CellServingRecord,
  IlluminatedCellBeam,
  SinrLiveCellFrame,
  UeCellServingRecord,
} from '../scene/sinrLiveCellModel';
import type { LinkSample } from '../engine/signal/types';
import {
  CanonicalEeInputError,
  computeInstantaneousEe,
} from './canonicalEnergyEfficiency';
import {
  BEAMSHIFT_CANONICAL_EE_SCOPE,
  BEAMSHIFT_CANONICAL_POWER_ASSUMPTIONS,
  BeamshiftCanonicalEeAccumulator,
  BeamshiftCanonicalEeInputError,
  computeBeamshiftCanonicalEe,
  type BeamshiftCanonicalEeInput,
} from './beamshiftCanonicalEe';

function close(actual: number, expected: number, tolerance = 1e-12): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(actual), Math.abs(expected)),
    `expected ${actual} to be close to ${expected}`,
  );
}

const EXPECTED_RATED_MAX_PA_ETA =
  BEAMSHIFT_CANONICAL_POWER_ASSUMPTIONS.paEtaMax
  * Math.sqrt(1 / (1 * 10 ** (BEAMSHIFT_CANONICAL_POWER_ASSUMPTIONS.paBackoffDb / 10)));

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
  txPowerDbm?: number,
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
    servingLinkSample: servingSatId !== null
      && cellId !== null
      && sinrDb !== null
      && txPowerDbm !== undefined
      ? linkSample(servingSatId, cellId, sinrDb, txPowerDbm)
      : null,
    handoverKind: 'none',
  };
}

function frame(
  cells: readonly CellServingRecord[],
  ues: readonly UeCellServingRecord[],
  simTimeSec = 1,
  additionalIlluminatedBeams: readonly IlluminatedCellBeam[] = [],
): SinrLiveCellFrame {
  const servingSats = cells
    .map(record => record.servingSatId)
    .filter((satId): satId is string => satId !== null);
  return {
    simTimeSec,
    cells,
    ues,
    illuminatedBeams: [
      ...cells
      .filter(record => record.servingSatId !== null)
      .map(record => ({
        satId: record.servingSatId!,
        cellId: record.cellId,
        frequencyIndex: record.frequencyIndex,
        serving: true,
      })),
      ...additionalIlluminatedBeams,
    ],
    servedCellCount: servingSats.length,
    servedUeCount: ues.filter(record => record.servingSatId !== null).length,
    servingSatCount: new Set(servingSats).size,
    intraHandoverCount: 0,
    interHandoverCount: 0,
    cumulativeIntraHandoverCount: 0,
    cumulativeInterHandoverCount: 0,
    recentHandoverEvents: [],
  };
}

function input(
  liveFrame: SinrLiveCellFrame,
  overrides: Partial<Omit<BeamshiftCanonicalEeInput, 'frame'>> = {},
): BeamshiftCanonicalEeInput {
  return {
    frame: liveFrame,
    bandwidthMHz: 30,
    frequencyReuse: 3,
    rfOutputPowerDbm: 30,
    ratedMaxRfOutputW: 1,
    ...overrides,
  };
}

function assertProducerError(
  code: BeamshiftCanonicalEeInputError['code'],
  operation: () => unknown,
): void {
  assert.throws(operation, error => {
    assert.ok(error instanceof BeamshiftCanonicalEeInputError);
    assert.strictEqual(error.code, code);
    return true;
  });
}

test('one live served beam produces the ADR-003 numeric breakdown and per-user contribution', () => {
  const result = computeBeamshiftCanonicalEe(input(frame(
    [cell(0, 'sat-a')],
    [ue('ue-1', 'sat-a', 0, 0, 30)],
  )));

  const expectedRateMbps = 10; // (30 MHz / 3) * log2(1 + 1)
  const expectedBeamPowerW = 0.338 + 0.2 + 1 / EXPECTED_RATED_MAX_PA_ETA;
  assert.strictEqual(result.scope, BEAMSHIFT_CANONICAL_EE_SCOPE);
  assert.strictEqual(result.status, 'valid');
  assert.strictEqual(result.activeBeamCount, 1);
  assert.strictEqual(result.activeSatelliteCount, 1);
  close(result.beams[0]!.downlinkPowerW, 1);
  close(result.beams[0]!.ratedMaxRfOutputW, 1);
  close(result.beams[0]!.paEfficiency, EXPECTED_RATED_MAX_PA_ETA);
  close(result.beams[0]!.rfcPowerW, 0.338);
  close(result.beams[0]!.basebandShareW, 0.2);
  close(result.beams[0]!.paInputPowerW, 1 / EXPECTED_RATED_MAX_PA_ETA);
  assert.strictEqual(result.beams[0]!.eventPowerW, 0);
  close(result.systemPowerW, expectedBeamPowerW);
  close(result.users[0]!.rateMbps, expectedRateMbps);
  close(result.users[0]!.contributionMbitPerJ, expectedRateMbps / expectedBeamPowerW);
  close(result.eeInstMbitPerJ, expectedRateMbps / expectedBeamPowerW);
  assert.strictEqual(result.sumIdentity, true);
});

test('two satellites and multiple active beams distribute P_BB once per active satellite', () => {
  const result = computeBeamshiftCanonicalEe(input(frame(
    [cell(0, 'sat-a'), cell(1, 'sat-a'), cell(2, 'sat-b')],
    [],
  )));

  assert.strictEqual(result.activeBeamCount, 3);
  assert.strictEqual(result.activeSatelliteCount, 2);
  const satABeams = result.beams.filter(beam => beam.satId === 'sat-a');
  const satBBeam = result.beams.find(beam => beam.satId === 'sat-b')!;
  assert.deepStrictEqual(satABeams.map(beam => beam.activeBeamCountForSatellite), [2, 2]);
  satABeams.forEach(beam => close(beam.basebandShareW, 0.1));
  close(satBBeam.basebandShareW, 0.2);
  close(result.beams.reduce((sum, beam) => sum + beam.basebandShareW, 0), 0.4);
  close(
    result.systemPowerW,
    3 * (BEAMSHIFT_CANONICAL_POWER_ASSUMPTIONS.pRfcWPerActiveBeam + 1 / EXPECTED_RATED_MAX_PA_ETA) + 0.4,
  );
  assert.strictEqual(result.status, 'valid');
  assert.strictEqual(result.eeInstMbitPerJ, 0);
});

test('cell and UE input permutations yield identical ordered output', () => {
  const cells = [cell(0, 'sat-b'), cell(1, 'sat-a')];
  const users = [
    ue('ue-b', 'sat-b', 0, -3, 30),
    ue('ue-a', 'sat-a', 1, 2, 30),
  ];
  const first = computeBeamshiftCanonicalEe(input(frame(cells, users)));
  const permuted = computeBeamshiftCanonicalEe(input(frame([...cells].reverse(), [...users].reverse())));

  assert.deepStrictEqual(permuted, first);
  assert.deepStrictEqual(first.beams.map(beam => beam.beamKey), ['sat-a#cell1', 'sat-b#cell0']);
  assert.deepStrictEqual(first.users.map(record => record.ueId), ['ue-a', 'ue-b']);
});

test('sum of all r_1,u contributions equals EE_inst', () => {
  const result = computeBeamshiftCanonicalEe(input(frame(
    [cell(0, 'sat-a')],
    [
      ue('ue-1', 'sat-a', 0, -5, 30),
      ue('ue-2', 'sat-a', 0, 7, 30),
      ue('ue-3', 'sat-a', 0, null),
    ],
  )));
  const contributionSum = result.users.reduce(
    (sum, record) => sum + record.contributionMbitPerJ,
    0,
  );

  close(contributionSum, result.eeInstMbitPerJ);
  close(result.contributionSumMbitPerJ, result.eeInstMbitPerJ);
  assert.strictEqual(result.sumIdentity, true);
  assert.strictEqual(result.users.find(record => record.ueId === 'ue-3')!.status, 'outage');
});

test('assigned load comes from the same active-beam group used to split B/K, including outage share', () => {
  const twoFinite = computeBeamshiftCanonicalEe(input(frame(
    [cell(0, 'sat-a')],
    [
      ue('ue-1', 'sat-a', 0, 0, 30),
      ue('ue-2', 'sat-a', 0, 0, 30),
    ],
  )));
  assert.strictEqual(twoFinite.allocatedBandwidthMHz, 10);
  assert.deepStrictEqual(
    twoFinite.users.map(user => [user.ueId, user.assignedBeamLoad, user.allocatedBandwidthMHz, user.rateMbps]),
    [['ue-1', 2, 5, 5], ['ue-2', 2, 5, 5]],
  );
  assert.strictEqual(twoFinite.totalThroughputMbps, 10);

  const oneOutage = computeBeamshiftCanonicalEe(input(frame(
    [cell(0, 'sat-a')],
    [
      ue('ue-1', 'sat-a', 0, 0, 30),
      ue('ue-2', 'sat-a', 0, null),
    ],
  )));
  assert.deepStrictEqual(
    oneOutage.users.map(user => [user.ueId, user.status, user.assignedBeamLoad, user.allocatedBandwidthMHz, user.rateMbps]),
    [['ue-1', 'served', 2, 5, 5], ['ue-2', 'outage', 2, 5, 0]],
  );
  assert.strictEqual(oneOutage.totalThroughputMbps, 5);

  const unserved = computeBeamshiftCanonicalEe(input(frame(
    [cell(0, null)],
    [ue('ue-3', null, null, null)],
  )));
  assert.deepStrictEqual(
    unserved.users.map(user => [user.status, user.assignedBeamLoad, user.allocatedBandwidthMHz, user.rateMbps]),
    [['unserved', 0, 0, 0]],
  );
});

test('active domain charges zero-load beams and ignores serving-false probes', () => {
  const baseline = computeBeamshiftCanonicalEe(input(frame(
    [cell(0, 'sat-a'), cell(1, 'sat-a')],
    [ue('ue-1', 'sat-a', 0, 0, 30)],
  )));
  const withProbe = computeBeamshiftCanonicalEe(input(frame(
    [cell(0, 'sat-a'), cell(1, 'sat-a')],
    [ue('ue-1', 'sat-a', 0, 0, 30)],
    1,
    [{ satId: 'sat-probe', cellId: 0, frequencyIndex: 0, serving: false }],
  )));

  assert.strictEqual(baseline.activeBeamCount, 2);
  assert.ok(baseline.beams.find(beam => beam.beamKey === 'sat-a#cell1')!.totalPowerW > 0);
  assert.strictEqual(baseline.beams.find(beam => beam.beamKey === 'sat-a#cell1')!.downlinkPowerW, 1);
  assert.strictEqual(withProbe.activeBeamCount, baseline.activeBeamCount);
  assert.deepStrictEqual(withProbe.beams, baseline.beams);
  assert.strictEqual(withProbe.systemPowerW, baseline.systemPowerW);
});

test('serving illuminated keys must exactly match active cell keys', () => {
  const baseCells = [cell(0, 'sat-a')];
  const extraServing = frame(baseCells, [], 1, [
    { satId: 'sat-b', cellId: 0, frequencyIndex: 0, serving: true },
  ]);
  assertProducerError('ACTIVE_KEY_MISMATCH', () => computeBeamshiftCanonicalEe(input(extraServing)));

  const missingServing = frame(baseCells, []);
  const missingFrame: SinrLiveCellFrame = { ...missingServing, illuminatedBeams: [] };
  assertProducerError('ACTIVE_KEY_MISMATCH', () => computeBeamshiftCanonicalEe(input(missingFrame)));

  const duplicateServing = frame(baseCells, [], 1, [
    { satId: 'sat-a', cellId: 0, frequencyIndex: 0, serving: true },
  ]);
  assertProducerError('DUPLICATE_ACTIVE_KEY', () => computeBeamshiftCanonicalEe(input(duplicateServing)));
});

test('UE assignment and serving-link identity drift fail closed', () => {
  assertProducerError(
    'INCONSISTENT_SERVING_ASSIGNMENT',
    () => computeBeamshiftCanonicalEe(input(frame(
      [cell(0, null)],
      [ue('ue-1', null, 0, 0)],
    ))),
  );
  assertProducerError(
    'MISSING_ACTIVE_BEAM',
    () => computeBeamshiftCanonicalEe(input(frame(
      [cell(0, 'sat-a')],
      [ue('ue-1', 'sat-b', 0, 0, 30)],
    ))),
  );

  const source = ue('ue-1', 'sat-a', 0, 0, 30);
  const sinrMismatch: UeCellServingRecord = {
    ...source,
    servingLinkSample: { ...source.servingLinkSample!, sinrDb: 1 },
  };
  assertProducerError(
    'LIVE_SINR_MISMATCH',
    () => computeBeamshiftCanonicalEe(input(frame([cell(0, 'sat-a')], [sinrMismatch]))),
  );
});

test('PA uses the governed rated maximum and supports below-cap and zero P_DL', () => {
  const belowRated = computeBeamshiftCanonicalEe(input(
    frame([cell(0, 'sat-a')], []),
    { rfOutputPowerDbm: 24, ratedMaxRfOutputW: 1 },
  ));
  assert.ok(belowRated.beams[0]!.downlinkPowerW < belowRated.beams[0]!.ratedMaxRfOutputW);
  assert.ok(belowRated.beams[0]!.paEfficiency < EXPECTED_RATED_MAX_PA_ETA);
  close(
    belowRated.beams[0]!.paInputPowerW,
    belowRated.beams[0]!.downlinkPowerW / belowRated.beams[0]!.paEfficiency,
  );

  const zeroOutput = computeBeamshiftCanonicalEe(input(
    frame([cell(0, 'sat-a')], []),
    { rfOutputPowerDbm: Number.NEGATIVE_INFINITY, ratedMaxRfOutputW: 1 },
  ));
  assert.strictEqual(zeroOutput.beams[0]!.downlinkPowerW, 0);
  assert.strictEqual(zeroOutput.beams[0]!.paEfficiency, 0);
  assert.strictEqual(zeroOutput.beams[0]!.paInputPowerW, 0);
  assert.strictEqual(zeroOutput.totalThroughputMbps, 0);
  assert.ok(zeroOutput.systemPowerW > 0);

  assertProducerError(
    'RF_OUTPUT_OVER_RATED_MAX',
    () => computeBeamshiftCanonicalEe(input(
      frame([cell(0, 'sat-a')], []),
      { rfOutputPowerDbm: 31, ratedMaxRfOutputW: 1 },
    )),
  );
  assertProducerError(
    'INVALID_RATED_MAX_RF_OUTPUT',
    () => computeBeamshiftCanonicalEe(input(
      frame([cell(0, 'sat-a')], []),
      { ratedMaxRfOutputW: 0 },
    )),
  );
});

test('negative/non-finite producer inputs and +Infinity live SINR fail closed', () => {
  const validFrame = frame([cell(0, 'sat-a')], [ue('ue-1', 'sat-a', 0, 0, 30)]);
  for (const bandwidthMHz of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assertProducerError(
      'INVALID_BANDWIDTH',
      () => computeBeamshiftCanonicalEe(input(validFrame, { bandwidthMHz })),
    );
  }
  for (const frequencyReuse of [0, -1, 1.5, Number.POSITIVE_INFINITY]) {
    assertProducerError(
      'INVALID_FREQUENCY_REUSE',
      () => computeBeamshiftCanonicalEe(input(validFrame, { frequencyReuse })),
    );
  }
  assertProducerError(
    'INVALID_RF_OUTPUT_POWER',
    () => computeBeamshiftCanonicalEe(input(validFrame, { rfOutputPowerDbm: Number.NaN })),
  );
  assertProducerError(
    'NON_FINITE_SINR',
    () => computeBeamshiftCanonicalEe(input(frame(
      [cell(0, 'sat-a')],
      [ue('ue-1', 'sat-a', 0, Number.POSITIVE_INFINITY)],
    ))),
  );
  assertProducerError(
    'LIVE_POWER_MISMATCH',
    () => computeBeamshiftCanonicalEe(input(frame(
      [cell(0, 'sat-a')],
      [ue('ue-1', 'sat-a', 0, 0, 29)],
    ))),
  );
});

test('delegated canonical seam rejects negative/non-finite rate or power and positive-rate zero-power', () => {
  for (const ratesMbps of [[-1], [Number.NaN], [Number.POSITIVE_INFINITY]]) {
    assert.throws(
      () => computeInstantaneousEe({ ratesMbps, systemPowerW: 1 }),
      CanonicalEeInputError,
    );
  }
  for (const systemPowerW of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => computeInstantaneousEe({ ratesMbps: [1], systemPowerW }),
      CanonicalEeInputError,
    );
  }
  assert.throws(
    () => computeInstantaneousEe({ ratesMbps: [1], systemPowerW: 0 }),
    (error: unknown) => error instanceof CanonicalEeInputError
      && error.code === 'POSITIVE_RATE_ZERO_POWER',
  );
});

test('no active served beam is an explicit zero-activity frame', () => {
  const result = computeBeamshiftCanonicalEe(input(frame(
    [cell(0, null)],
    [ue('ue-1', null, 0, null)],
  )));

  assert.strictEqual(result.status, 'zero-activity');
  assert.strictEqual(result.activeBeamCount, 0);
  assert.strictEqual(result.systemPowerW, 0);
  assert.strictEqual(result.totalThroughputMbps, 0);
  assert.strictEqual(result.eeInstMbitPerJ, 0);
  assert.strictEqual(result.users[0]!.contributionMbitPerJ, 0);
  assert.strictEqual(result.sumIdentity, true);
});

test('accumulator reports ratio-of-sums, not mean instantaneous EE', () => {
  const accumulator = new BeamshiftCanonicalEeAccumulator();
  const step1 = accumulator.append(input(frame(
    [cell(0, 'sat-a')],
    [ue('ue-1', 'sat-a', 0, 0, 30)],
    1,
  )), 1);
  const step2 = accumulator.append(input(frame(
    [cell(0, 'sat-a'), cell(1, 'sat-a')],
    [ue('ue-1', 'sat-a', 0, 0, 30)],
    2,
  )), 3);

  const expectedDataMbit = step1.instantaneous.totalThroughputMbps
    + 3 * step2.instantaneous.totalThroughputMbps;
  const expectedEnergyJ = step1.instantaneous.systemPowerW
    + 3 * step2.instantaneous.systemPowerW;
  const meanInstantaneous = (
    step1.instantaneous.eeInstMbitPerJ + step2.instantaneous.eeInstMbitPerJ
  ) / 2;
  close(step2.evaluation.totalDataMbit, expectedDataMbit);
  close(step2.evaluation.totalEnergyJ, expectedEnergyJ);
  close(step2.evaluation.eeEvalMbitPerJ, expectedDataMbit / expectedEnergyJ);
  assert.notStrictEqual(step2.evaluation.eeEvalMbitPerJ, meanInstantaneous);
  assert.strictEqual(step2.evaluation.status, 'valid');
});

test('seek and reset clear totals; stale frames fail closed after seek', () => {
  const accumulator = new BeamshiftCanonicalEeAccumulator();
  const sample = (time: number) => input(frame(
    [cell(0, 'sat-a')],
    [ue('ue-1', 'sat-a', 0, 0, 30)],
    time,
  ));

  accumulator.append(sample(1), 1);
  const afterSeek = accumulator.seek(10);
  assert.deepStrictEqual(
    {
      status: afterSeek.status,
      sampleCount: afterSeek.sampleCount,
      totalDataMbit: afterSeek.totalDataMbit,
      totalEnergyJ: afterSeek.totalEnergyJ,
    },
    { status: 'zero-activity', sampleCount: 0, totalDataMbit: 0, totalEnergyJ: 0 },
  );
  assertProducerError('OUT_OF_ORDER_FRAME', () => accumulator.append(sample(9), 1));
  assert.strictEqual(accumulator.append(sample(10), 1).evaluation.sampleCount, 1);
  const afterReset = accumulator.reset();
  assert.strictEqual(afterReset.status, 'zero-activity');
  assert.strictEqual(afterReset.sampleCount, 0);
  assert.strictEqual(afterReset.lastFrameSimTimeSec, null);
});

test('accumulator rejects invalid duration/equal/backward frames without changing state', () => {
  const accumulator = new BeamshiftCanonicalEeAccumulator();
  const sample = (time: number) => input(frame(
    [cell(0, 'sat-a')],
    [ue('ue-1', 'sat-a', 0, 0, 30)],
    time,
  ));

  accumulator.append(sample(1), 1);
  const beforeDurationReject = accumulator.snapshot();
  for (const durationSec of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assertProducerError('INVALID_DURATION', () => accumulator.append(sample(2), durationSec));
    assert.deepStrictEqual(accumulator.snapshot(), beforeDurationReject);
  }

  for (const time of [1, 0]) {
    assertProducerError('OUT_OF_ORDER_FRAME', () => accumulator.append(sample(time), 1));
    assert.deepStrictEqual(accumulator.snapshot(), beforeDurationReject);
  }

  const mismatchedIllumination = frame(
    [cell(0, 'sat-a')],
    [ue('ue-1', 'sat-a', 0, 0, 30)],
    2,
    [{ satId: 'sat-extra', cellId: 0, frequencyIndex: 0, serving: true }],
  );
  assertProducerError(
    'ACTIVE_KEY_MISMATCH',
    () => accumulator.append(input(mismatchedIllumination), 1),
  );
  assert.deepStrictEqual(accumulator.snapshot(), beforeDurationReject);

  const accepted = accumulator.append(sample(2), 1);
  assert.strictEqual(accepted.evaluation.sampleCount, 2);
  assert.strictEqual(accepted.evaluation.lastFrameSimTimeSec, 2);
});
