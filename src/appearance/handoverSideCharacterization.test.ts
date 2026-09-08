/**
 * Characterization of the handover-side seam before source/target convergence.
 *
 * Pure: no React, no canvas, no clock. The expected sides are literals copied
 * from today's running behavior, not values computed by the resolver under test.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveHandoverSide } from './handoverAppearanceModifiers';

test('handover side resolution stays role-first across role and render-key shapes', () => {
  const cases: readonly [
    label: string,
    input: { readonly role?: string; readonly renderKey?: string },
    expected: 'source' | 'target' | null,
  ][] = [
    ['no role and no render key', {}, null],
    ['ordinary role with no render key', { role: 'servingFan' }, null],
    ['ordinary role with unrelated key', { role: 'triggered', renderKey: 'event-7' }, null],
    ['ordinary role with source suffix', { role: 'triggered', renderKey: 'event-7-from' }, 'source'],
    ['ordinary role with target suffix', { role: 'triggered', renderKey: 'event-7-to' }, 'target'],
    ['ordinary role with triggered source suffix', { role: 'triggered', renderKey: 'event-7-trig-from' }, 'source'],
    ['ordinary role with triggered target suffix', { role: 'triggered', renderKey: 'event-7-trig-to' }, 'target'],
    ['source role without render key', { role: 'handoverSource' }, 'source'],
    ['target role without render key', { role: 'handoverTarget' }, 'target'],
    ['source role wins over target suffix', { role: 'handoverSource', renderKey: 'event-7-to' }, 'source'],
    ['target role wins over source suffix', { role: 'handoverTarget', renderKey: 'event-7-from' }, 'target'],
    ['suffix must be at the end', { role: 'triggered', renderKey: 'event-7-from-extra' }, null],
    ['bare from is not a suffix', { role: 'triggered', renderKey: 'from' }, null],
    ['bare to is not a suffix', { role: 'triggered', renderKey: 'to' }, null],
  ];

  for (const [label, input, expected] of cases) {
    assert.equal(resolveHandoverSide(input), expected, label);
  }
});
