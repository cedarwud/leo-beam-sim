#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SIX_ACTS_BEAM_POWER_CAP_W,
  SixActsPowerSweep,
  SixActsSweepError,
  describeSixActsSweepSegments,
  type SixActsSweepArm,
} from './powerSweep';
import type { SixActsRunSummary } from './runSummary';
import { getSixActsAttachThreshold } from './taughtConstants';

const FRAME_SET = 'frames:oneweb-20260810T150000Z:sha-abc';
const SCENARIO = 'oneweb-20260810T150000Z';

function summary(overrides: Partial<SixActsRunSummary> = {}): SixActsRunSummary {
  return {
    runId: 'run',
    strategyId: 'baseline',
    scenarioId: SCENARIO,
    totalEnergyJ: 100,
    deliveredDataMbit: 200,
    runEeMbitPerJ: 2,
    lowSinrFraction: 0,
    lowSinrRatioPercent: 0,
    lowSinrThresholdDb: -12,
    lowSinrThreshold: getSixActsAttachThreshold(),
    numHandovers: 1,
    sampleCount: 100,
    durationSec: 100,
    outageSampleCount: 0,
    outageDurationSec: 0,
    startInstantMs: 0,
    endInstantMs: 100_000,
    ...overrides,
  };
}

function sweepWith(
  arm: SixActsSweepArm,
  stops: readonly (readonly [number, number])[],
): SixActsPowerSweep {
  const sweep = new SixActsPowerSweep({ frameSetDigest: FRAME_SET, scenarioId: SCENARIO });
  for (const [beamPowerW, runEeMbitPerJ] of stops) {
    sweep.record({
      arm,
      beamPowerW,
      frameSetDigest: FRAME_SET,
      beamPowerCapW: SIX_ACTS_BEAM_POWER_CAP_W,
      summary: summary({ runEeMbitPerJ }),
    });
  }
  return sweep;
}

function assertDomainError(code: SixActsSweepError['code'], operation: () => unknown): void {
  assert.throws(operation, error => {
    assert.ok(error instanceof SixActsSweepError);
    assert.strictEqual(error.code, code);
    return true;
  });
}

test('both arms must sweep the same immutable replay frames', () => {
  const sweep = new SixActsPowerSweep({ frameSetDigest: FRAME_SET, scenarioId: SCENARIO });
  assertDomainError('FRAME_SET_MISMATCH', () => sweep.record({
    arm: 'eco',
    beamPowerW: 1,
    frameSetDigest: 'frames:something-else',
    beamPowerCapW: SIX_ACTS_BEAM_POWER_CAP_W,
    summary: summary(),
  }));
});

test('a point from another scenario is refused', () => {
  const sweep = new SixActsPowerSweep({ frameSetDigest: FRAME_SET, scenarioId: SCENARIO });
  assertDomainError('SCENARIO_MISMATCH', () => sweep.record({
    arm: 'baseline',
    beamPowerW: 1,
    frameSetDigest: FRAME_SET,
    beamPowerCapW: SIX_ACTS_BEAM_POWER_CAP_W,
    summary: summary({ scenarioId: 'starlink-something' }),
  }));
});

test('recording the same stop twice on one arm is refused', () => {
  const sweep = sweepWith('baseline', [[1, 2]]);
  assertDomainError('DUPLICATE_POINT', () => sweep.record({
    arm: 'baseline',
    beamPowerW: 1,
    frameSetDigest: FRAME_SET,
    beamPowerCapW: SIX_ACTS_BEAM_POWER_CAP_W,
    summary: summary(),
  }));
});

test('the two arms share a power stop without colliding', () => {
  const sweep = sweepWith('baseline', [[1, 2]]);
  sweep.record({
    arm: 'eco',
    beamPowerW: 1,
    frameSetDigest: FRAME_SET,
    beamPowerCapW: SIX_ACTS_BEAM_POWER_CAP_W,
    summary: summary(),
  });

  assert.deepStrictEqual(sweep.recordedArms, ['baseline', 'eco']);
  assert.strictEqual(sweep.curveFor('baseline').length, 1);
  assert.strictEqual(sweep.curveFor('eco').length, 1);
});

test('a curve is ordered by swept power, not by recording order', () => {
  const sweep = sweepWith('baseline', [[1.5, 1.5], [0.5, 0.4], [1, 2.2]]);

  assert.deepStrictEqual(
    sweep.curveFor('baseline').map(point => point.beamPowerW),
    [0.5, 1, 1.5],
  );
});

test('a non-positive swept power is refused', () => {
  const sweep = new SixActsPowerSweep({ frameSetDigest: FRAME_SET, scenarioId: SCENARIO });
  assertDomainError('INVALID_POWER', () => sweep.record({
    arm: 'baseline',
    beamPowerW: 0,
    frameSetDigest: FRAME_SET,
    beamPowerCapW: SIX_ACTS_BEAM_POWER_CAP_W,
    summary: summary(),
  }));
});

test('an arm may not express itself as a lower power cap', () => {
  // Ruling 2026-08-22: P_max is hardware (ch5 Table 5-2), not a policy knob.
  const sweep = new SixActsPowerSweep({ frameSetDigest: FRAME_SET, scenarioId: SCENARIO });
  assertDomainError('POWER_CAP_MISMATCH', () => sweep.record({
    arm: 'eco',
    beamPowerW: 0.5,
    frameSetDigest: FRAME_SET,
    beamPowerCapW: SIX_ACTS_BEAM_POWER_CAP_W / 2,
    summary: summary(),
  }));
});

test('a swept power above the rated cap is refused', () => {
  const sweep = new SixActsPowerSweep({ frameSetDigest: FRAME_SET, scenarioId: SCENARIO });
  assertDomainError('POWER_ABOVE_CAP', () => sweep.record({
    arm: 'baseline',
    beamPowerW: SIX_ACTS_BEAM_POWER_CAP_W + 0.01,
    frameSetDigest: FRAME_SET,
    beamPowerCapW: SIX_ACTS_BEAM_POWER_CAP_W,
    summary: summary(),
  }));
});

test('the three-segment reveal is read out of the recorded curve', () => {
  const curve = sweepWith('baseline', [
    [0.1, 0.4],
    [0.25, 1.2],
    [0.5, 2.4],
    [1, 1.8],
    [1.6, 0.9],
  ]).curveFor('baseline');
  const segments = describeSixActsSweepSegments(curve);

  assert.strictEqual(segments.shape, 'peak-inside-range');
  assert.strictEqual(segments.peak?.beamPowerW, 0.5);
  assert.deepStrictEqual(segments.belowPeak.map(point => point.beamPowerW), [0.1, 0.25]);
  assert.deepStrictEqual(segments.abovePeak.map(point => point.beamPowerW), [1, 1.6]);
});

test('a curve with no peak is not given one', () => {
  const rising = describeSixActsSweepSegments(
    sweepWith('baseline', [[0.5, 1], [1, 2], [1.5, 3]]).curveFor('baseline'),
  );
  const falling = describeSixActsSweepSegments(
    sweepWith('eco', [[0.5, 3], [1, 2], [1.5, 1]]).curveFor('eco'),
  );

  assert.strictEqual(rising.shape, 'monotonic-increasing');
  assert.strictEqual(rising.peak, null);
  assert.strictEqual(falling.shape, 'monotonic-decreasing');
  assert.strictEqual(falling.peak, null);
});

test('fewer than three stops claims no shape at all', () => {
  const segments = describeSixActsSweepSegments(
    sweepWith('baseline', [[0.5, 1], [1, 5]]).curveFor('baseline'),
  );

  assert.strictEqual(segments.shape, 'insufficient-points');
  assert.strictEqual(segments.peak, null);
});

test('the curve carries the low-SINR and outage evidence beside EE', () => {
  const sweep = new SixActsPowerSweep({ frameSetDigest: FRAME_SET, scenarioId: SCENARIO });
  sweep.record({
    arm: 'eco',
    beamPowerW: 0.05,
    frameSetDigest: FRAME_SET,
    beamPowerCapW: SIX_ACTS_BEAM_POWER_CAP_W,
    summary: summary({ runEeMbitPerJ: 0.2, lowSinrRatioPercent: 87, outageDurationSec: 42 }),
  });

  const [point] = sweep.curveFor('eco');
  assert.strictEqual(point.lowSinrRatioPercent, 87);
  assert.strictEqual(point.outageDurationSec, 42);
});
