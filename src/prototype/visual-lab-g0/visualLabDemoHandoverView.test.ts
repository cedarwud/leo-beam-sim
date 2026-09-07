import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveVisualLabDemoHandoverView,
  VISUAL_LAB_DEMO_HANDOVER_DURATION_MS,
} from './visualLabDemoHandoverView';

test('demo handover view uses deterministic teaching-phase boundaries', () => {
  assert.equal(VISUAL_LAB_DEMO_HANDOVER_DURATION_MS, 12_000);
  assert.deepEqual(
    [0, 999, 1_000, 2_799, 2_800, 5_199, 5_200, 6_799, 6_800].map((elapsedMs) => (
      deriveVisualLabDemoHandoverView(elapsedMs).phase
    )),
    ['baseline', 'baseline', 'intervention', 'intervention', 'before', 'before', 'decision', 'decision', 'after'],
  );
  assert.equal(deriveVisualLabDemoHandoverView(5_200).beat, 'decision');
  assert.equal(deriveVisualLabDemoHandoverView(6_800).beat, 'after');
});

test('demo handover view clamps negative and non-finite elapsed input', () => {
  const baseline = deriveVisualLabDemoHandoverView(0);
  assert.deepEqual(deriveVisualLabDemoHandoverView(-100), baseline);
  assert.deepEqual(deriveVisualLabDemoHandoverView(Number.NaN), baseline);
  assert.deepEqual(deriveVisualLabDemoHandoverView(Number.POSITIVE_INFINITY), baseline);
});
