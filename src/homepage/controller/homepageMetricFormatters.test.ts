import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatHomepageEe,
  HOMEPAGE_EE_DISPLAY_UNIT,
} from './homepageMetricFormatters';

test('uses one fixed Kbit/J scale for every finite homepage EE value', () => {
  assert.equal(HOMEPAGE_EE_DISPLAY_UNIT, 'Kbit/J');
  assert.equal(formatHomepageEe(7_800), '7.80 Kbit/J');
  assert.equal(formatHomepageEe(50), '0.05 Kbit/J');
  assert.equal(formatHomepageEe(1_200_000), '1200.00 Kbit/J');
});

test('keeps unavailable EE explicit without inventing a value', () => {
  assert.equal(formatHomepageEe(null), '—');
  assert.equal(formatHomepageEe(Number.NaN), '—');
  assert.equal(formatHomepageEe(Number.POSITIVE_INFINITY), '—');
});

