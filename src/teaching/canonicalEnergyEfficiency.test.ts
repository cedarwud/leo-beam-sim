#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CanonicalEeInputError,
  computeEvaluationEe,
  computeEvaluationEeFromTotals,
  computeInstantaneousEe,
  sumInstantaneousPowerW,
} from './canonicalEnergyEfficiency';

function assertDomainError(code: CanonicalEeInputError['code'], operation: () => unknown): void {
  assert.throws(operation, error => {
    assert.ok(error instanceof CanonicalEeInputError);
    assert.strictEqual(error.code, code);
    return true;
  });
}

test('sumInstantaneousPowerW is the single additive input for canonical system power', () => {
  assert.strictEqual(
    sumInstantaneousPowerW([
      { label: 'teaching PA input', powerW: 1.25 },
      { label: 'teaching circuit knob', powerW: 3 },
    ]),
    4.25,
  );
});

test('instantaneous EE returns per-user additive contributions and checks their sum identity', () => {
  const result = computeInstantaneousEe({ ratesMbps: [6, 4], systemPowerW: 5 });

  assert.strictEqual(result.status, 'valid');
  assert.deepStrictEqual(result.contributionsMbitPerJ, [1.2, 0.8]);
  assert.strictEqual(result.totalThroughputMbps, 10);
  assert.strictEqual(result.eeInstMbitPerJ, 2);
  assert.strictEqual(result.contributionSumMbitPerJ, 2);
  assert.strictEqual(result.sumIdentity, true);
});

test('zero throughput and zero power is an explicit zero-activity result', () => {
  const result = computeInstantaneousEe({ ratesMbps: [0, 0], systemPowerW: 0 });

  assert.strictEqual(result.status, 'zero-activity');
  assert.deepStrictEqual(result.contributionsMbitPerJ, [0, 0]);
  assert.strictEqual(result.eeInstMbitPerJ, 0);
  assert.strictEqual(result.contributionSumMbitPerJ, 0);
  assert.strictEqual(result.sumIdentity, true);
});

test('positive power with zero throughput is valid zero EE, not an invalid zero-activity reading', () => {
  const result = computeInstantaneousEe({ ratesMbps: [0, 0], systemPowerW: 2 });

  assert.strictEqual(result.status, 'valid');
  assert.strictEqual(result.eeInstMbitPerJ, 0);
  assert.strictEqual(result.sumIdentity, true);
});

test('negative or non-finite throughput fails closed', () => {
  for (const [ratesMbps, code] of [
    [[-1], 'NEGATIVE_RATE'],
    [[Number.NaN], 'NON_FINITE_RATE'],
    [[Number.POSITIVE_INFINITY], 'NON_FINITE_RATE'],
    [[Number.NEGATIVE_INFINITY], 'NON_FINITE_RATE'],
  ] as const) {
    assertDomainError(
      code,
      () => computeInstantaneousEe({ ratesMbps, systemPowerW: 1 }),
    );
  }
});

test('negative or non-finite power fails closed', () => {
  for (const [systemPowerW, code] of [
    [-1, 'NEGATIVE_POWER'],
    [Number.NaN, 'NON_FINITE_POWER'],
    [Number.POSITIVE_INFINITY, 'NON_FINITE_POWER'],
    [Number.NEGATIVE_INFINITY, 'NON_FINITE_POWER'],
  ] as const) {
    assertDomainError(
      code,
      () => computeInstantaneousEe({ ratesMbps: [1], systemPowerW }),
    );
  }
});

test('positive throughput with zero power fails closed instead of using epsilon', () => {
  assertDomainError(
    'POSITIVE_RATE_ZERO_POWER',
    () => computeInstantaneousEe({ ratesMbps: [1, 0], systemPowerW: 0 }),
  );
});

test('cross-step EE is ratio-of-sums with explicit seconds, not mean instantaneous EE', () => {
  const result = computeEvaluationEe([
    { ratesMbps: [10], systemPowerW: 2, durationSec: 1 },
    { ratesMbps: [2], systemPowerW: 8, durationSec: 3 },
  ]);

  assert.strictEqual(result.status, 'valid');
  assert.strictEqual(result.totalDataMbit, 16);
  assert.strictEqual(result.totalEnergyJ, 26);
  assert.strictEqual(result.eeEvalMbitPerJ, 8 / 13);
});

test('cross-step all-zero activity remains explicit zero', () => {
  const result = computeEvaluationEe([
    { ratesMbps: [0], systemPowerW: 0, durationSec: 1 },
    { ratesMbps: [0, 0], systemPowerW: 0, durationSec: 2 },
  ]);

  assert.strictEqual(result.status, 'zero-activity');
  assert.strictEqual(result.totalDataMbit, 0);
  assert.strictEqual(result.totalEnergyJ, 0);
  assert.strictEqual(result.eeEvalMbitPerJ, 0);
});

test('total-based evaluation preserves the same fail-closed and zero branches', () => {
  assert.strictEqual(
    computeEvaluationEeFromTotals({ totalDataMbit: 0, totalEnergyJ: 0 }).status,
    'zero-activity',
  );
  assert.strictEqual(
    computeEvaluationEeFromTotals({ totalDataMbit: 0, totalEnergyJ: 4 }).eeEvalMbitPerJ,
    0,
  );
  assertDomainError(
    'POSITIVE_RATE_ZERO_POWER',
    () => computeEvaluationEeFromTotals({ totalDataMbit: 1, totalEnergyJ: 0 }),
  );
});

test('power component aggregation rejects negative and non-finite inputs', () => {
  assertDomainError(
    'NEGATIVE_POWER',
    () => sumInstantaneousPowerW([{ label: 'broken', powerW: -0.1 }]),
  );
  assertDomainError(
    'NON_FINITE_POWER',
    () => sumInstantaneousPowerW([{ label: 'broken', powerW: Number.NaN }]),
  );
});
