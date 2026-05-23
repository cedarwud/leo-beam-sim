/**
 * Test: coordToWorld helper.
 *
 * Verifies:
 *   - ECEF→world identity mapping (sanity)
 *   - ECI-proxy returns input unchanged (R1 binding: no Earth-rotation
 *     compensation)
 *   - Unknown coordinate kind throws (load-blocking gate)
 */

import assert from 'node:assert/strict';
import { coordToWorld } from '../src/showcase/coordToWorld';

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

console.log('validate-modqn-visual-showcase-p1ab-coord-to-world');

test('ecef-km identity mapping', () => {
  const out = coordToWorld([1, 2, 3], 'ecef-km');
  assert.deepEqual(out, [1, 2, 3]);
});

test('ecef-km handles negative coordinates', () => {
  const out = coordToWorld([-2399.3035920809903, 4919.301371958657, 4602.240463608234], 'ecef-km');
  assert.deepEqual(out, [-2399.3035920809903, 4919.301371958657, 4602.240463608234]);
});

test('eci-km-no-earth-rotation-proxy returns input unchanged (R1)', () => {
  const input: [number, number, number] = [-2399.3, 4919.3, 4602.2];
  const out = coordToWorld(input, 'eci-km-no-earth-rotation-proxy');
  // CRITICAL: no Earth-rotation compensation. Output must equal input.
  assert.strictEqual(out[0], input[0]);
  assert.strictEqual(out[1], input[1]);
  assert.strictEqual(out[2], input[2]);
});

test('unknown coordinate kind throws', () => {
  assert.throws(
    () => coordToWorld([0, 0, 0], 'made-up-frame' as never),
    /unsupported coordinateFrameKind/,
  );
});

console.log('OK');
