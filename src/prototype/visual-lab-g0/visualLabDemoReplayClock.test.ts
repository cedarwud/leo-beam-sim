import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceVisualLabDemoReplay } from './visualLabDemoReplayClock';

test('advances the demo state immutably while preserving its handover kind', () => {
  const current = Object.freeze({ kind: 'inter-handover' as const, elapsedMs: 1_000 });
  const next = advanceVisualLabDemoReplay(current, 250);

  assert.deepEqual(next, { kind: 'inter-handover', elapsedMs: 1_250 });
  assert.notStrictEqual(next, current);
  assert.equal(current.elapsedMs, 1_000);
});

test('returns null when the compact demo reaches its duration', () => {
  const current = { kind: 'intra-handover' as const, elapsedMs: 11_900 };

  assert.equal(advanceVisualLabDemoReplay(current, 100), null);
  assert.equal(advanceVisualLabDemoReplay(current, 200, 12_000), null);
});

test('normalizes invalid clock inputs without leaking NaN into replay state', () => {
  const current = { kind: 'intra-handover' as const, elapsedMs: Number.NaN };

  assert.deepEqual(advanceVisualLabDemoReplay(current, Number.NaN), {
    kind: 'intra-handover',
    elapsedMs: 0,
  });
  assert.deepEqual(advanceVisualLabDemoReplay(current, Number.POSITIVE_INFINITY), {
    kind: 'intra-handover',
    elapsedMs: 0,
  });
});
