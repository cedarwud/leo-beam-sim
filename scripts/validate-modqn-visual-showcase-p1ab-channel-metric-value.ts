/**
 * Test: ChannelMetricValue branded type.
 *
 * Verifies:
 *   - The branded type prevents passing a bare `number` to a function
 *     expecting `ChannelMetricValue` (compile-time guarantee, asserted via
 *     `@ts-expect-error` below).
 *   - `makeChannelMetricValue` produces a value carrying the declared kind.
 */

import assert from 'node:assert/strict';
import {
  makeChannelMetricValue,
  type ChannelMetricValue,
} from '../src/scene/ChannelMetricValue';

function test(label: string, fn: () => void): void {
  try {
    fn();
    console.log(`  PASS  ${label}`);
  } catch (err) {
    console.error(`  FAIL  ${label}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('validate-modqn-visual-showcase-p1ab-channel-metric-value');

// Compile-time assertion: a bare `number` MUST NOT satisfy ChannelMetricValue.
// If this stops being an error (e.g. the brand is dropped), the line below
// will fail to compile because of the `@ts-expect-error` directive.
function acceptsChannelMetricValue(v: ChannelMetricValue): number {
  return v.dB;
}

// @ts-expect-error — bare numbers are not ChannelMetricValue (brand check).
acceptsChannelMetricValue(42);

// @ts-expect-error — bare object literal lacks the brand.
acceptsChannelMetricValue({ kind: 'snr-no-interference', dB: 42 });

test('makeChannelMetricValue carries kind + dB', () => {
  const v = makeChannelMetricValue('snr-no-interference', 12.5);
  assert.strictEqual(v.kind, 'snr-no-interference');
  assert.strictEqual(v.dB, 12.5);
});

test('acceptsChannelMetricValue accepts a branded value at runtime', () => {
  const v = makeChannelMetricValue('snr-no-interference', 3);
  assert.strictEqual(acceptsChannelMetricValue(v), 3);
});

console.log('OK');
