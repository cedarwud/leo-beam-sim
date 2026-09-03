import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HOMEPAGE_METRIC_DISPLAY_STABILITY,
  hasContinuousHomepageMetricTimeline,
  stabilizeHomepageMetricValues,
} from './homepageMetricStability';

const previous = {
  sinrDb: -40,
  powerW: 5,
  throughputBps: 100_000,
  energyEfficiencyBitsPerJoule: 20_000,
};

test('limits large same-pair presentation jumps without changing the raw authority', () => {
  const next = stabilizeHomepageMetricValues({
    current: {
      sinrDb: -20,
      powerW: 100,
      throughputBps: 2_000_000,
      energyEfficiencyBitsPerJoule: 400_000,
    },
    previous,
    currentSimTimeSec: 11,
    previousSimTimeSec: 10,
  });

  assert.ok(next.sinrDb > previous.sinrDb && next.sinrDb < -20);
  assert.ok(next.powerW > previous.powerW && next.powerW < 100);
  assert.ok(next.throughputBps > previous.throughputBps && next.throughputBps < 2_000_000);
  assert.ok(next.energyEfficiencyBitsPerJoule > previous.energyEfficiencyBitsPerJoule);
  assert.ok(next.energyEfficiencyBitsPerJoule < 400_000);
  assert.ok(next.powerW <= previous.powerW * Math.exp(HOMEPAGE_METRIC_DISPLAY_STABILITY.maxPositiveLogStep) + 1e-9);
  assert.ok(next.throughputBps <= previous.throughputBps * Math.exp(HOMEPAGE_METRIC_DISPLAY_STABILITY.maxPositiveLogStep) + 1e-9);
  assert.equal(HOMEPAGE_METRIC_DISPLAY_STABILITY.maxSinrStepDb, 0.75);
});

test('does not smear a seek or a new episode across the previous pair', () => {
  const current = {
    sinrDb: -10,
    powerW: 8,
    throughputBps: 800_000,
    energyEfficiencyBitsPerJoule: 100_000,
  };
  assert.deepEqual(stabilizeHomepageMetricValues({
    current,
    previous,
    currentSimTimeSec: 2,
    previousSimTimeSec: 10,
  }), current);
  assert.deepEqual(stabilizeHomepageMetricValues({
    current,
    previous,
    currentSimTimeSec: 100,
    previousSimTimeSec: 10,
  }), current);
});

test('returns current values when there is no prior finite display sample', () => {
  const current = {
    sinrDb: -12,
    powerW: 6,
    throughputBps: 50_000,
    energyEfficiencyBitsPerJoule: 8_000,
  };
  assert.deepEqual(stabilizeHomepageMetricValues({
    current,
    previous: null,
    currentSimTimeSec: 11,
    previousSimTimeSec: 10,
  }), current);
});

test('shares one continuity gate for forward samples and timeline resets', () => {
  assert.equal(hasContinuousHomepageMetricTimeline(11, 10), true);
  assert.equal(hasContinuousHomepageMetricTimeline(10, 10), false);
  assert.equal(hasContinuousHomepageMetricTimeline(2, 10), false);
  assert.equal(
    hasContinuousHomepageMetricTimeline(
      10 + HOMEPAGE_METRIC_DISPLAY_STABILITY.maxContinuityGapSec + 1,
      10,
    ),
    false,
  );
});
