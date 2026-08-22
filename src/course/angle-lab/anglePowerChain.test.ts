#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ANGLE_LAB_DEFAULT_THETA_3DB_DEG,
  ANGLE_LAB_SEGMENT_START_POWER_W,
  angleLabAngleForDrop,
  angleLabGainDb,
  angleLabStep,
  angleLabSweep,
} from './anglePowerChain';

const THETA_3DB = ANGLE_LAB_DEFAULT_THETA_3DB_DEG;

test('the canonical pattern is the engine HOBS pattern, not a stand-in', () => {
  // At theta = theta_3dB it must be down 3 dB: that is what the symbol MEANS,
  // and it is why the classroom task lands on the slider's own label.
  assert.ok(Math.abs(angleLabGainDb(THETA_3DB, THETA_3DB, 'canonical') + 3) < 0.02);
  assert.strictEqual(angleLabGainDb(0, THETA_3DB, 'canonical'), 0);
});

test('theta_3dB really enters the numbers', () => {
  // A wider beam must be down LESS at the same angle. If the control only
  // resized a footprint this would not move.
  const narrow = angleLabGainDb(3, 2, 'canonical');
  const wide = angleLabGainDb(3, 6, 'canonical');
  assert.ok(wide > narrow, `${wide} should exceed ${narrow}`);
});

test('the drop-3-dB task lands on theta_3dB', () => {
  const found = angleLabAngleForDrop(3, THETA_3DB, 'canonical');
  assert.ok(Math.abs(found - THETA_3DB) < 0.02, `got ${found}`);
});

test('a segment starts at 2 W', () => {
  const first = angleLabStep({
    thetaDeg: 0,
    previousThetaDeg: null,
    previousPowerW: null,
    theta3dbDeg: THETA_3DB,
    mode: 'canonical',
    ratedCapW: 1.65,
  });
  assert.strictEqual(first.powerW, ANGLE_LAB_SEGMENT_START_POWER_W);
});

test('power climbs by exactly the ratio the gain fell', () => {
  const step = angleLabStep({
    thetaDeg: THETA_3DB,
    previousThetaDeg: 0,
    previousPowerW: 2,
    theta3dbDeg: THETA_3DB,
    mode: 'canonical',
    ratedCapW: 1.65,
  });
  // Gain fell 3 dB, so power must roughly double.
  assert.ok(Math.abs(step.powerW - 4) < 0.05, `got ${step.powerW}`);
});

test('the sweep is the recursion, and it is monotonic in power', () => {
  const sweep = angleLabSweep({
    maxThetaDeg: 6,
    stepDeg: 0.5,
    theta3dbDeg: THETA_3DB,
    mode: 'canonical',
    ratedCapW: 1.65,
  });

  assert.strictEqual(sweep[0].powerW, ANGLE_LAB_SEGMENT_START_POWER_W);
  for (let index = 1; index < sweep.length; index += 1) {
    assert.ok(sweep[index].powerW >= sweep[index - 1].powerW);
    assert.ok(sweep[index].gainDb <= sweep[index - 1].gainDb);
  }
});

test('exceeding the rated cap is reported, not clamped away', () => {
  const sweep = angleLabSweep({
    maxThetaDeg: 6,
    stepDeg: 0.5,
    theta3dbDeg: THETA_3DB,
    mode: 'canonical',
    ratedCapW: 1.65,
  });
  const over = sweep.filter(step => step.overRatedCap);

  assert.ok(over.length > 0);
  // The demand really is above the cap; the number is not silently pinned to it.
  assert.ok(over[over.length - 1].powerW > 1.65);
});

test('DEMO mode is smooth and CANONICAL shows the side lobes', () => {
  const demoDeep = angleLabGainDb(9, THETA_3DB, 'demo');
  const canonicalDeep = angleLabGainDb(9, THETA_3DB, 'canonical');

  // Far off boresight the real pattern has collapsed far below the smooth one:
  // that gap is the answer to "why does a small offset cost so much".
  assert.ok(canonicalDeep < demoDeep - 5, `${canonicalDeep} vs ${demoDeep}`);
  assert.ok(Math.abs(angleLabGainDb(THETA_3DB, THETA_3DB, 'demo') + 3) < 1e-9);
});

test('a beam that has lost the user says so instead of printing a power', () => {
  const step = angleLabStep({
    thetaDeg: 30,
    previousThetaDeg: 0,
    previousPowerW: 2,
    theta3dbDeg: THETA_3DB,
    mode: 'canonical',
    ratedCapW: 1.65,
  });

  // The recursion still yields a number, but it describes a link that is gone.
  assert.strictEqual(step.atGainFloor, true);
  assert.ok(step.powerW > 1000);
});

test('inside the beam the floor flag stays clear', () => {
  const step = angleLabStep({
    thetaDeg: THETA_3DB,
    previousThetaDeg: 0,
    previousPowerW: 2,
    theta3dbDeg: THETA_3DB,
    mode: 'canonical',
    ratedCapW: 1.65,
  });
  assert.strictEqual(step.atGainFloor, false);
});
