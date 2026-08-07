#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLASSROOM_ENERGY_COMPARISON_THRESHOLDS,
  compareClassroomEnergyArms,
  type ClassroomEnergyComparisonArm,
} from './energyComparison';

const BASELINE: ClassroomEnergyComparisonArm = Object.freeze({
  role: 'baseline',
  txPowerDbm: 50,
  windowStartSimTimeSec: 100,
  windowEndSimTimeSec: 160,
  elapsedSec: 60,
  comparisonContextKey: 't4-t5-frozen-window-v1',
  cumulativeDataMbit: 100,
  totalEnergyJ: 100,
  lowSinrRatioPct: 10,
  runEeMbitPerJ: 1,
  lowSinrThresholdDb: 14,
  handoverCount: 2,
  servingLoad: 1,
  servingSinrDb: 10,
  throughputMbps: 69,
  serviceStatus: 'served',
  serviceIdentity: 'sat-a/cell-0',
  producerStatus: 'valid',
  absenceReason: null,
});

const CANDIDATE: ClassroomEnergyComparisonArm = Object.freeze({
  role: 'candidate',
  txPowerDbm: 35,
  windowStartSimTimeSec: 100,
  windowEndSimTimeSec: 160,
  elapsedSec: 60,
  comparisonContextKey: 't4-t5-frozen-window-v1',
  cumulativeDataMbit: 96,
  totalEnergyJ: 90,
  lowSinrRatioPct: 12,
  runEeMbitPerJ: 1.1,
  lowSinrThresholdDb: 14,
  handoverCount: 3,
  servingLoad: 1,
  servingSinrDb: 9,
  throughputMbps: 66,
  serviceStatus: 'served',
  serviceIdentity: 'sat-a/cell-0',
  producerStatus: 'valid',
  absenceReason: null,
});

function candidateWith(patch: Partial<ClassroomEnergyComparisonArm>): ClassroomEnergyComparisonArm {
  return Object.freeze({ ...CANDIDATE, ...patch });
}

test('qualified 50 dBm baseline and 35 dBm candidate pair passes all gates', () => {
  const result = compareClassroomEnergyArms(BASELINE, CANDIDATE);

  assert.strictEqual(result.comparable, true);
  assert.strictEqual(result.dataRetentionRatio, 0.96);
  assert.strictEqual(result.energySavingPct, 10);
  assert.strictEqual(result.lowSinrDeltaPp, 2);
  assert.strictEqual(result.runEeRatio, 1.1);
  assert.deepStrictEqual(result.gates, {
    dataRetention: true,
    lowSinr: true,
    runEe: true,
    energySaving: true,
  });
  assert.strictEqual(result.serviceQualified, true);
  assert.strictEqual(result.qualified, true);
  assert.deepStrictEqual(result.reasonCodes, []);
});

test('positive raw energy saving does not qualify when the service gates fail', () => {
  const result = compareClassroomEnergyArms(
    BASELINE,
    candidateWith({ cumulativeDataMbit: 80, lowSinrRatioPct: 20, totalEnergyJ: 90 }),
  );

  assert.strictEqual(result.comparable, true);
  assert.strictEqual(result.energySavingPct, 10);
  assert.strictEqual(result.gates.energySaving, true);
  assert.strictEqual(result.gates.dataRetention, false);
  assert.strictEqual(result.gates.lowSinr, false);
  assert.strictEqual(result.serviceQualified, false);
  assert.strictEqual(result.qualified, false);
});

test('context mismatch withholds every derived value and gate', () => {
  const result = compareClassroomEnergyArms(
    BASELINE,
    candidateWith({ comparisonContextKey: 'different-window' }),
  );

  assert.strictEqual(result.comparable, false);
  assert.strictEqual(result.dataRetentionRatio, null);
  assert.strictEqual(result.energySavingPct, null);
  assert.strictEqual(result.lowSinrDeltaPp, null);
  assert.strictEqual(result.runEeRatio, null);
  assert.deepStrictEqual(result.gates, {
    dataRetention: null,
    lowSinr: null,
    runEe: null,
    energySaving: null,
  });
  assert.strictEqual(result.serviceQualified, null);
  assert.strictEqual(result.qualified, null);
  assert.ok(result.reasonCodes.includes('CONTEXT_KEY_MISMATCH'));
});

test('window start, end, or duration mismatch withholds the comparison', () => {
  for (const [field, reasonCode] of [
    ['windowStartSimTimeSec', 'WINDOW_START_MISMATCH'],
    ['windowEndSimTimeSec', 'WINDOW_END_MISMATCH'],
    ['elapsedSec', 'WINDOW_DURATION_MISMATCH'],
  ] as const) {
    const result = compareClassroomEnergyArms(
      BASELINE,
      candidateWith({ [field]: CANDIDATE[field] + 1 }),
    );

    assert.strictEqual(result.comparable, false, field);
    assert.strictEqual(result.dataRetentionRatio, null, field);
    assert.strictEqual(result.qualified, null, field);
    assert.ok(result.reasonCodes.includes(reasonCode), field);
  }
});

test('missing and non-finite arm values fail closed with withheld outputs', () => {
  const missing: Partial<Record<keyof ClassroomEnergyComparisonArm, unknown>> = {
    ...CANDIDATE,
  };
  delete missing.totalEnergyJ;
  const missingResult = compareClassroomEnergyArms(
    BASELINE,
    missing as unknown as ClassroomEnergyComparisonArm,
  );
  assert.strictEqual(missingResult.comparable, false);
  assert.strictEqual(missingResult.energySavingPct, null);
  assert.strictEqual(missingResult.qualified, null);
  assert.ok(missingResult.reasonCodes.includes('MISSING_VALUE'));

  const nonFiniteResult = compareClassroomEnergyArms(
    BASELINE,
    candidateWith({ lowSinrRatioPct: Number.NaN }),
  );
  assert.strictEqual(nonFiniteResult.comparable, false);
  assert.strictEqual(nonFiniteResult.lowSinrDeltaPp, null);
  assert.strictEqual(nonFiniteResult.qualified, null);
  assert.ok(nonFiniteResult.reasonCodes.includes('NON_FINITE_VALUE'));
});

test('service gates can pass while energy-saving and Run-EE gates fail', () => {
  const result = compareClassroomEnergyArms(
    BASELINE,
    candidateWith({
      cumulativeDataMbit: 100,
      lowSinrRatioPct: 10,
      totalEnergyJ: 110,
      runEeMbitPerJ: 0.9,
    }),
  );

  assert.strictEqual(result.comparable, true);
  assert.strictEqual(result.serviceQualified, true);
  assert.strictEqual(result.gates.dataRetention, true);
  assert.strictEqual(result.gates.lowSinr, true);
  assert.strictEqual(result.gates.energySaving, false);
  assert.strictEqual(result.gates.runEe, false);
  assert.strictEqual(result.qualified, false);
});

test('handover-count differences are observations and do not change the verdict', () => {
  const withoutHandovers = compareClassroomEnergyArms(
    Object.freeze({ ...BASELINE, handoverCount: 0 }),
    Object.freeze({ ...CANDIDATE, handoverCount: 0 }),
  );
  const withManyHandovers = compareClassroomEnergyArms(
    Object.freeze({ ...BASELINE, handoverCount: 100 }),
    Object.freeze({ ...CANDIDATE, handoverCount: 200 }),
  );

  assert.strictEqual(withoutHandovers.qualified, true);
  assert.strictEqual(withManyHandovers.qualified, true);
  assert.deepStrictEqual(withManyHandovers.gates, withoutHandovers.gates);
  assert.strictEqual(withManyHandovers.energySavingPct, withoutHandovers.energySavingPct);
  assert.strictEqual(withManyHandovers.runEeRatio, withoutHandovers.runEeRatio);
});

test('course thresholds are frozen and use the single stated authority', () => {
  assert.deepStrictEqual(CLASSROOM_ENERGY_COMPARISON_THRESHOLDS, {
    minDataRetentionRatio: 0.95,
    maxLowSinrDeltaPp: 5,
    minRunEeRatio: 1,
    minEnergySavingPct: 0,
  });
  assert.ok(Object.isFrozen(CLASSROOM_ENERGY_COMPARISON_THRESHOLDS));
});
