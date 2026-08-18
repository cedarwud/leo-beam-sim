#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CANONICAL_EE_CONTRACT_VERSION,
  CANONICAL_EE_CONFORMANCE_FIXTURES,
  CANONICAL_EE_EVALUATION_FIXTURE,
  CanonicalEeAccumulator,
  CanonicalEeInputError,
  DEFAULT_EPSILON_NUM,
  computeAdditiveSystemEe,
  computeCanonicalEe,
  computeCanonicalEvaluation,
} from './index';
import { selectCanonicalHDiagnostics } from './producer';

const RTOL = 1e-12;
const ATOL = 1e-15;

function close(actual: number, expected: number, label: string): void {
  const tolerance = ATOL + RTOL * Math.abs(expected);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
}

function closeVector(actual: readonly number[], expected: readonly number[], label: string): void {
  assert.equal(actual.length, expected.length, `${label} length`);
  actual.forEach((value, index) => close(value, expected[index]!, `${label}[${index}]`));
}

function closeMatrix(actual: readonly (readonly number[])[], expected: readonly (readonly number[])[], label: string): void {
  assert.equal(actual.length, expected.length, `${label} row count`);
  actual.forEach((row, index) => closeVector(row, expected[index]!, `${label}[${index}]`));
}

test('replays the frozen Python angle-aware closure vectors', () => {
  for (const fixture of CANONICAL_EE_CONFORMANCE_FIXTURES) {
    const result = computeCanonicalEe(fixture.input);
    assert.equal(result.contractVersion, CANONICAL_EE_CONTRACT_VERSION, fixture.id);
    closeVector(result.transmitGainUb[0] ?? [], fixture.expected.transmitGainUb[0] ?? [], `${fixture.id}.gain[0]`);
    if (result.transmitGainUb.length > 1) {
      closeVector(result.transmitGainUb[1] ?? [], fixture.expected.transmitGainUb[1] ?? [], `${fixture.id}.gain[1]`);
    }
    const pythonExpectedCompositeGainUb = fixture.input.frame.propagationGainUb.map((row, user) => (
      row.map((propagationGain, beam) => (
        propagationGain
        * fixture.expected.transmitGainUb[user]![beam]!
        * fixture.input.frame.receiveGainUb[user]![beam]!
      ))
    ));
    closeMatrix(
      result.compositeGainUb,
      pythonExpectedCompositeGainUb,
      `${fixture.id}.raw h from Python transmit-gain vector`,
    );
    result.compositeGainUb.forEach((row, user) => row.forEach((_rawH, beam) => {
      const diagnostics = selectCanonicalHDiagnostics(result, user, beam);
      close(diagnostics.rawH, pythonExpectedCompositeGainUb[user]![beam]!, `${fixture.id}.raw h[${user}][${beam}]`);
      close(
        diagnostics.hDiv,
        Math.max(pythonExpectedCompositeGainUb[user]![beam]!, DEFAULT_EPSILON_NUM),
        `${fixture.id}.h^div[${user}][${beam}]`,
      );
    }));
    closeMatrix(result.receivedPowerUbW, fixture.expected.receivedPowerUbW, `${fixture.id}.received power`);
    closeVector(result.gammaReqB, fixture.expected.gammaReqB, `${fixture.id}.gamma`);
    closeVector(result.pReqUW, fixture.expected.pReqUW, `${fixture.id}.p_req_u`);
    closeVector(result.pReqBW, fixture.expected.pReqBW, `${fixture.id}.p_req_b`);
    closeVector(result.pDlBeforeSatelliteCapBW, fixture.expected.pDlBeforeSatelliteCapBW, `${fixture.id}.p_dl_pre_sat`);
    closeVector(result.pDlActualBW, fixture.expected.pDlActualBW, `${fixture.id}.p_dl_actual`);
    closeVector(result.satelliteScaleB, fixture.expected.satelliteScaleB, `${fixture.id}.satellite scale`);
    closeVector(result.interferenceUW, fixture.expected.interferenceUW, `${fixture.id}.interference`);
    result.interferenceUW.forEach((total, user) => {
      assert.ok(
        Math.abs(total - (
          result.intraSatelliteInterferenceUW[user]!
          + result.interSatelliteInterferenceUW[user]!
        )) <= 1e-15,
        `${fixture.id}.interference decomposition mismatch for user ${user}`,
      );
    });
    closeVector(result.sinrU, fixture.expected.sinrU, `${fixture.id}.sinr`);
    closeVector(result.rateUBps, fixture.expected.rateUBps, `${fixture.id}.rate`);
    closeVector(result.etaPaB, fixture.expected.etaPaB, `${fixture.id}.eta`);
    closeVector(result.power.pPaBW, fixture.expected.pPaBW, `${fixture.id}.PA power`);
    closeVector(result.power.pRfcBW, fixture.expected.pRfcBW, `${fixture.id}.RFC power`);
    closeVector(result.power.pBbBW, fixture.expected.pBbBW, `${fixture.id}.BB power`);
    closeVector(result.power.pEventBW, fixture.expected.pEventBW, `${fixture.id}.event power`);
    closeVector(result.pTotBW, fixture.expected.pTotBW, `${fixture.id}.p_tot`);
    close(result.throughput.totalRateBps, fixture.expected.totalRateBps, `${fixture.id}.total rate`);
    close(result.power.systemPowerW, fixture.expected.systemPowerW, `${fixture.id}.system power`);
    close(result.ee.systemEeBitsPerJ, fixture.expected.systemEeBitsPerJ, `${fixture.id}.system EE`);
    closeVector(result.r1UBitsPerJ, fixture.expected.r1UBitsPerJ, `${fixture.id}.r1`);
    assert.deepEqual(result.throughput.qosMetU, fixture.expected.qosMetU, `${fixture.id}.QoS`);
    assert.deepEqual(result.throughput.powerLimitedU, fixture.expected.powerLimitedU, `${fixture.id}.power limited`);
    assert.equal(result.ee.sumIdentity, true, `${fixture.id}.sum identity`);
  }
});

test('applies beam caps before proportional satellite-cap scaling and shares BB power', () => {
  const result = computeCanonicalEe({
    config: {
      noisePowerW: 1e-9,
      beamBandwidthHz: 1e6,
      minimumRateBps: 100e6,
      beamPowerCapW: [1, 1],
      satellitePowerCapW: 1,
      g0Linear: 1,
      theta3dbRad: 0.05,
      rfcPowerW: 0.1,
      basebandPerSatelliteW: 0.2,
      frameDurationS: 1,
    },
    frame: {
      thetaRadUb: [[0, 0], [0, 0]],
      propagationGainUb: [[1, 1], [1, 1]],
      receiveGainUb: [[1, 1], [1, 1]],
      servingBeamU: [0, 1],
      beamActiveB: [true, true],
      beamLoadB: [1, 1],
      beamSatelliteB: [0, 0],
      beamColorB: [0, 1],
      laggedInterferenceUW: [0, 0],
    },
  });
  close(result.pDlBeforeSatelliteCapBW.reduce((sum, value) => sum + value, 0), 2, 'beam-capped total');
  close(result.pDlActualBW.reduce((sum, value) => sum + value, 0), 1, 'satellite-capped total');
  close(result.satelliteScaleB[0]!, 0.5, 'satellite scale 0');
  close(result.satelliteScaleB[1]!, 0.5, 'satellite scale 1');
  close(result.power.pBbBW[0]!, 0.1, 'BB beam 0 share');
  close(result.power.pBbBW[1]!, 0.1, 'BB beam 1 share');
  assert.deepEqual(result.power.pDlActualBW, result.throughput.signalUW.map(() => result.power.pDlActualBW[0]));
});

test('uses event-energy inputs as a ledger term and keeps derived outputs immutable', () => {
  const input = CANONICAL_EE_CONFORMANCE_FIXTURES[0]!.input;
  const result = computeCanonicalEe({
    config: {
      ...input.config,
      trainingEnergyJByBeam: [2],
      trainingIndicatorByBeam: [1],
      switchEnergyJ: 1,
      switchIndicatorByBeam: [1],
    },
    frame: input.frame,
  });
  close(result.power.pEventBW[0]!, 3, 'event power');
  close(result.power.pTotBW[0]!, 3.5988735882771666, 'event-inclusive system power');
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.power.pDlActualBW));
});

test('zero activity is explicit while positive throughput with zero power fails closed', () => {
  const zero = computeAdditiveSystemEe([0, 0], 0);
  assert.equal(zero.zeroOverZero, true);
  assert.deepEqual(zero.r1UBitsPerJ, [0, 0]);
  assert.throws(
    () => computeAdditiveSystemEe([1, 0], 0),
    (error: unknown) => error instanceof CanonicalEeInputError && error.code === 'POSITIVE_RATE_ZERO_POWER',
  );
  assert.throws(
    () => computeCanonicalEvaluation([
      { totalRateBps: 1, systemPowerW: 0, durationSec: 1 },
    ]),
    (error: unknown) => error instanceof CanonicalEeInputError && error.code === 'POSITIVE_RATE_ZERO_POWER',
  );
});

test('raw h=0 uses the division floor only for p_req and keeps signal/rate at zero', () => {
  const input = CANONICAL_EE_CONFORMANCE_FIXTURES[0]!.input;
  const result = computeCanonicalEe({
    ...input,
    frame: {
      ...input.frame,
      propagationGainUb: [[0]],
    },
  });
  assert.equal(result.compositeGainUb[0]![0], 0);
  assert.ok(result.pReqUW[0]! > 0, 'required power remains finite and positive through epsilon_h');
  assert.equal(result.throughput.signalUW[0], 0);
  assert.equal(result.throughput.sinrU[0], 0);
  assert.equal(result.throughput.rateUBps[0], 0);
  assert.equal(result.throughput.totalRateBps, 0);
});

test('public H diagnostics expose raw h and h^div without changing the signal path', () => {
  const input = CANONICAL_EE_CONFORMANCE_FIXTURES[0]!.input;
  const reference = computeCanonicalEe(input);
  const referenceH = selectCanonicalHDiagnostics(reference, 0, 0);

  assert.ok(Object.isFrozen(referenceH));
  assert.equal(referenceH.rawH, reference.compositeGainUb[0]![0]);
  close(referenceH.hDiv, referenceH.rawH, 'non-zero h^div');
  close(
    reference.pReqUW[0]!,
    reference.gammaReqB[0]!
      * (reference.inputs.frame.laggedInterferenceUW[0]!
        + reference.inputs.config.noisePowerW)
      / referenceH.hDiv,
    'requested-power denominator',
  );
  close(
    reference.receivedPowerUbW[0]![0]!,
    referenceH.rawH * reference.power.pDlActualBW[0]!,
    'raw h signal path',
  );

  const zero = computeCanonicalEe({
    ...input,
    frame: {
      ...input.frame,
      propagationGainUb: [[0]],
    },
  });
  const zeroH = selectCanonicalHDiagnostics(zero, 0, 0);

  assert.equal(zeroH.rawH, 0);
  assert.equal(zeroH.hDiv, DEFAULT_EPSILON_NUM);
  close(
    zero.pReqUW[0]!,
    71.77346253629314,
    'Python canonical zero-h requested power',
  );
  assert.equal(zero.throughput.signalUW[0], 0);
  assert.equal(zero.throughput.rateUBps[0], 0);
});

test('evaluation and accumulator use unequal-duration ratio-of-sums', () => {
  const expected = CANONICAL_EE_EVALUATION_FIXTURE;
  const direct = computeCanonicalEvaluation([
    { totalRateBps: expected.stepThroughputsBps[0]!, systemPowerW: expected.stepConsumedPowerW[0]!, durationSec: expected.stepDurationSec[0]! },
    { totalRateBps: expected.stepThroughputsBps[1]!, systemPowerW: expected.stepConsumedPowerW[1]!, durationSec: expected.stepDurationSec[1]! },
  ]);
  close(direct.deliveredBits, expected.expectedDeliveredBits, 'direct bits');
  close(direct.consumedEnergyJ, expected.expectedConsumedEnergyJ, 'direct energy');
  close(direct.energyEfficiencyBitsPerJ, expected.expectedEnergyEfficiencyBitsPerJ, 'direct EE');
  assert.ok(Object.isFrozen(direct), 'standalone evaluation must be immutable');
  const accumulator = new CanonicalEeAccumulator();
  const [first, second] = CANONICAL_EE_CONFORMANCE_FIXTURES;
  accumulator.append(computeCanonicalEe(first!.input), 1);
  accumulator.append(computeCanonicalEe(second!.input), 3);
  const snapshot = accumulator.snapshot();
  assert.equal(snapshot.sampleCount, 2);
  close(snapshot.energyEfficiencyBitsPerJ, (
    first!.expected.totalRateBps + 3 * second!.expected.totalRateBps
  ) / (
    first!.expected.systemPowerW + 3 * second!.expected.systemPowerW
  ), 'accumulator ratio of sums');
});

test('rejects invalid geometry, inconsistent load, and non-positive durations', () => {
  const input = CANONICAL_EE_CONFORMANCE_FIXTURES[0]!.input;
  assert.throws(
    () => computeCanonicalEe({
      ...input,
      frame: { ...input.frame, beamLoadB: [2] },
    }),
    (error: unknown) => error instanceof CanonicalEeInputError && error.code === 'INVALID_INPUT',
  );
  assert.throws(
    () => computeCanonicalEe({
      ...input,
      frame: { ...input.frame, servingBeamU: [1] },
    }),
    (error: unknown) => error instanceof CanonicalEeInputError,
  );
  assert.throws(
    () => computeCanonicalEvaluation([{ totalRateBps: 1, systemPowerW: 1, durationSec: 0 }]),
    (error: unknown) => error instanceof CanonicalEeInputError && error.code === 'INVALID_DURATION',
  );
});
