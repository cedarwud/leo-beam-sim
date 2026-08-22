#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TLE_FIELDS,
  TLE_LINE_LENGTH,
  decodeTleFields,
  deriveTleFacts,
  tleChecksum,
  tleFieldAtColumn,
} from './tleFields';

// ONEWEB-0314, from public/tle-archive/oneweb/oneweb_20260812.tle.
const LINE1 = '1 49100U 21075AB  26223.89537308 -.00000237  00000+0 -64275-3 0  9997';
const LINE2 = '2 49100  87.9193 354.7822 0001578  89.4957 270.6355 13.17649174240903';

test('the pinned teaching record is a well-formed TLE', () => {
  assert.strictEqual(LINE1.length, TLE_LINE_LENGTH);
  assert.strictEqual(LINE2.length, TLE_LINE_LENGTH);
  assert.strictEqual(tleChecksum(LINE1).valid, true);
  assert.strictEqual(tleChecksum(LINE2).valid, true);
});

test('breaking one digit is caught by the checksum', () => {
  // The station-2 exercise: change a digit, watch the last column disagree.
  const broken = `${LINE2.slice(0, 10)}9${LINE2.slice(11)}`;
  const result = tleChecksum(broken);

  assert.strictEqual(result.valid, false);
  assert.notStrictEqual(result.expected, result.actual);
});

test('a minus sign counts as one, which is what makes line 1 pass', () => {
  // Line 1 carries two minus signs; ignoring them would fail a valid record.
  assert.strictEqual(tleChecksum(LINE1).valid, true);
  assert.ok(LINE1.includes('-'));
});

test('fields cover the documented columns without overlapping', () => {
  for (const lineNumber of [1, 2] as const) {
    const fields = TLE_FIELDS.filter(field => field.line === lineNumber)
      .slice()
      .sort((left, right) => left.startColumn - right.startColumn);
    let previousEnd = 0;
    for (const field of fields) {
      assert.ok(field.startColumn > previousEnd, `${field.id} overlaps column ${previousEnd}`);
      assert.ok(field.endColumn >= field.startColumn);
      assert.ok(field.endColumn <= TLE_LINE_LENGTH);
      previousEnd = field.endColumn;
    }
  }
});

test('decoding lifts the raw characters out of the right columns', () => {
  const line2 = decodeTleFields(LINE2, 2);
  const byId = new Map(line2.map(field => [field.id, field.raw]));

  assert.strictEqual(byId.get('l2-catalog'), '49100');
  // Right-justified in its column, padding included: the highlighter shows the
  // raw columns, so the decoder must not quietly trim them.
  assert.strictEqual(byId.get('l2-inclination'), ' 87.9193');
  assert.strictEqual(byId.get('l2-meanmotion')?.trim(), '13.17649174');
  assert.strictEqual(byId.get('l2-checksum'), '3');
});

test('hovering a column names the field under it', () => {
  assert.strictEqual(tleFieldAtColumn(8, 2)?.id, 'l2-inclination');
  assert.strictEqual(tleFieldAtColumn(68, 1)?.id, 'l1-checksum');
  assert.strictEqual(tleFieldAtColumn(1, 1), null);
});

test('the period is derived from mean motion, not written down', () => {
  const facts = deriveTleFacts(LINE1, LINE2);

  assert.ok(Math.abs(facts.meanMotionRevPerDay - 13.17649174) < 1e-8);
  // 1440 / 13.176... = 109.3 min, the "about 109 minutes" the lecture says.
  assert.ok(Math.abs(facts.orbitalPeriodMin - 109.28) < 0.01, `got ${facts.orbitalPeriodMin}`);
  assert.ok(Math.abs(facts.inclinationDeg - 87.9193) < 1e-6);
});

test('the epoch decodes to a real UTC instant', () => {
  const facts = deriveTleFacts(LINE1, LINE2);

  assert.strictEqual(facts.epochYear, 2026);
  assert.ok(Math.abs(facts.epochDayOfYear - 223.89537308) < 1e-8);
  assert.match(facts.epochUtc, /^2026-08-11T21:29:/);
});

test('an unusable line is a typed failure, not a silent NaN', () => {
  assert.throws(() => deriveTleFacts(LINE1, `${LINE2.slice(0, 52)}           ${LINE2.slice(63)}`), RangeError);
});
