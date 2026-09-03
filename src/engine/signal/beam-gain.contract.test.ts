import assert from 'node:assert/strict';
import { computeBeamGainDb } from './beam-gain';

// The public contract carries the full 3 dB beamwidth. At one-sided half
// width, the HOBS J1/J3 pattern therefore evaluates its fixed 2.07123
// argument and reaches the expected approximately -3 dB point.
const gainAtHalfPowerAngle = computeBeamGainDb(1, 2, 'bessel-j1-j3');
assert.ok(
  Math.abs(gainAtHalfPowerAngle - (-3.0102964099077334)) < 1e-12,
  `full-width J1/J3 mapping must use theta_3dB / 2 (got ${gainAtHalfPowerAngle})`,
);
assert.equal(computeBeamGainDb(0, 2, 'bessel-j1-j3'), 0);
console.log('Beam-gain contract uses full theta_3dB with the one-sided half-power denominator.');
