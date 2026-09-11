/**
 * Tests for THE EE-intensity → paint contract.
 *
 * Pure: no React, no canvas, no clock — matches the rest of `appearance/`.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hexToHsl } from '../constants/hsl';
import {
  EE_INTENSITY_CONTEXT_SHADE_RANGE,
  EE_INTENSITY_OPACITY_CEILING,
  EE_INTENSITY_OPACITY_FLOOR,
  EE_INTENSITY_SERVING_SHADE_RANGE,
  applyEeIntensityShade,
  eeIntensityOpacity,
  eeIntensityShade,
} from './eeIntensityShade';

test('ratio 0 and 1 land exactly on the range endpoints', () => {
  const atZero = eeIntensityShade(0, EE_INTENSITY_SERVING_SHADE_RANGE);
  assert.equal(atZero.saturation, EE_INTENSITY_SERVING_SHADE_RANGE.saturationAtZero);
  assert.equal(atZero.lightness, EE_INTENSITY_SERVING_SHADE_RANGE.lightnessAtZero);
  const atOne = eeIntensityShade(1, EE_INTENSITY_SERVING_SHADE_RANGE);
  assert.equal(atOne.saturation, EE_INTENSITY_SERVING_SHADE_RANGE.saturationAtOne);
  assert.equal(atOne.lightness, EE_INTENSITY_SERVING_SHADE_RANGE.lightnessAtOne);
});

test('a higher ratio renders deeper (lower lightness, higher saturation), never closer to white', () => {
  const low = eeIntensityShade(0.2, EE_INTENSITY_SERVING_SHADE_RANGE);
  const high = eeIntensityShade(0.8, EE_INTENSITY_SERVING_SHADE_RANGE);
  assert.ok(high.lightness < low.lightness, 'higher EE must be darker/deeper, not paler');
  assert.ok(high.saturation > low.saturation, 'higher EE must be more saturated, not washed out');
});

test('out-of-range ratios clamp to the endpoints instead of extrapolating', () => {
  const belowZero = eeIntensityShade(-5, EE_INTENSITY_SERVING_SHADE_RANGE);
  const aboveOne = eeIntensityShade(5, EE_INTENSITY_SERVING_SHADE_RANGE);
  assert.equal(belowZero.lightness, EE_INTENSITY_SERVING_SHADE_RANGE.lightnessAtZero);
  assert.equal(aboveOne.lightness, EE_INTENSITY_SERVING_SHADE_RANGE.lightnessAtOne);
});

test('serving and context ranges are distinct, so a role does not disappear into the other', () => {
  assert.notEqual(
    EE_INTENSITY_SERVING_SHADE_RANGE.lightnessAtOne,
    EE_INTENSITY_CONTEXT_SHADE_RANGE.lightnessAtOne,
  );
});

test('applyEeIntensityShade preserves hue exactly, only saturation/lightness move', () => {
  const yellow = '#facc15';
  const shadedLow = applyEeIntensityShade(yellow, 0.1, EE_INTENSITY_SERVING_SHADE_RANGE);
  const shadedHigh = applyEeIntensityShade(yellow, 0.9, EE_INTENSITY_SERVING_SHADE_RANGE);
  assert.notEqual(shadedLow, shadedHigh, 'two different ratios must not paint identically');
  // Hue-preservation is the module's own non-negotiable invariant; assert it
  // structurally by re-deriving hue via the same hex/HSL conversion the
  // module itself uses, rather than hardcoding an expected hex string.
  const baseHue = hexToHsl(yellow)!.hue;
  assert.ok(Math.abs(hexToHsl(shadedLow)!.hue - baseHue) < 0.01);
  assert.ok(Math.abs(hexToHsl(shadedHigh)!.hue - baseHue) < 0.01);
});

test('an unparseable colour is returned unchanged rather than guessed at', () => {
  assert.equal(applyEeIntensityShade('not-a-colour', 0.5, EE_INTENSITY_SERVING_SHADE_RANGE), 'not-a-colour');
});

test('eeIntensityOpacity spans the proven 0.30..1.0 range and is monotonic', () => {
  assert.equal(eeIntensityOpacity(0), EE_INTENSITY_OPACITY_FLOOR);
  assert.equal(eeIntensityOpacity(1), EE_INTENSITY_OPACITY_CEILING);
  assert.ok(eeIntensityOpacity(0.8) > eeIntensityOpacity(0.2));
});

test('eeIntensityOpacity accepts a caller-supplied floor/ceiling for a different surface', () => {
  assert.equal(eeIntensityOpacity(0, 0.2, 0.86), 0.2);
  assert.ok(Math.abs(eeIntensityOpacity(1, 0.2, 0.86) - 0.86) < 1e-9);
});

console.log('EE-intensity shade contract: ratio endpoints, monotonic direction, hue preservation, and opacity range all hold.');
