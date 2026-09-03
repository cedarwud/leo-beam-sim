#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TLE_FIELDS,
  TLE_LINE_LENGTH,
  decodeTleFields,
  deriveTleFacts,
  getTleColumnWalkSubtitle,
  tleChecksum,
  tleFieldAtColumn,
} from './tleFields';

// STARLINK-1008, from public/tle-archive/starlink/starlink_20260824.tle.
const LINE1 = '1 44714U 19074B   26236.60522982  .00078599  00000+0  89669-3 0  9992';
const LINE2 = '2 44714  53.1483  98.4192 0004695  79.4604 280.6939 15.61546781374862';

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
  // The negative exponent sign contributes one to the checksum.
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

  assert.strictEqual(byId.get('l2-catalog'), '44714');
  // Right-justified in its column, padding included: the highlighter shows the
  // raw columns, so the decoder must not quietly trim them.
  assert.strictEqual(byId.get('l2-inclination'), ' 53.1483');
  assert.strictEqual(byId.get('l2-meanmotion')?.trim(), '15.61546781');
  assert.strictEqual(byId.get('l2-checksum'), '2');
});

test('hovering a column names the field under it', () => {
  assert.strictEqual(tleFieldAtColumn(8, 2)?.id, 'l2-inclination');
  assert.strictEqual(tleFieldAtColumn(68, 1)?.id, 'l1-checksum');
  assert.strictEqual(tleFieldAtColumn(1, 1), null);
});

test('the period is derived from mean motion, not written down', () => {
  const facts = deriveTleFacts(LINE1, LINE2);

  assert.ok(Math.abs(facts.meanMotionRevPerDay - 15.61546781) < 1e-8);
  // 1440 / 15.615... = 92.2 min, the period shown in Act 2.
  assert.ok(Math.abs(facts.orbitalPeriodMin - 92.22) < 0.01, `got ${facts.orbitalPeriodMin}`);
  assert.ok(Math.abs(facts.inclinationDeg - 53.1483) < 1e-6);
});

test('the epoch decodes to a real UTC instant', () => {
  const facts = deriveTleFacts(LINE1, LINE2);

  assert.strictEqual(facts.epochYear, 2026);
  assert.ok(Math.abs(facts.epochDayOfYear - 236.60522982) < 1e-8);
  assert.match(facts.epochUtc, /^2026-08-24T14:31:/);
});

test('an unusable line is a typed failure, not a silent NaN', () => {
  assert.throws(() => deriveTleFacts(LINE1, `${LINE2.slice(0, 52)}           ${LINE2.slice(63)}`), RangeError);
});

test('column-walk subtitles expose five narrated fields from one data-driven helper', () => {
  const facts = deriveTleFacts(LINE1, LINE2);
  const fieldIds = ['l1-epoch', 'l1-checksum', 'l2-inclination', 'l2-meanmotion', 'l2-checksum'];
  const subtitles = fieldIds.map(fieldId => getTleColumnWalkSubtitle(fieldId, LINE1, LINE2, facts));

  assert.deepEqual(subtitles.map(subtitle => subtitle.fieldId), fieldIds);
  assert.deepEqual(subtitles.map(subtitle => subtitle.rawValue), [
    '26236.60522982',
    '2',
    '53.1483',
    '15.61546781',
    '2',
  ]);
  assert.deepEqual(subtitles.map(subtitle => subtitle.lineColumnZhHant), [
    '第 1 行 · 第 19–32 欄',
    '第 1 行 · 第 69 欄',
    '第 2 行 · 第 9–16 欄',
    '第 2 行 · 第 53–63 欄',
    '第 2 行 · 第 69 欄',
  ]);
  assert.match(subtitles[0]!.keyPointZhHant, /SGP4/);
  assert.match(subtitles[1]!.keyPointZhHant, /mod 10/);
  assert.match(subtitles[1]!.keyPointZhHant, /fail-closed/);
  assert.match(subtitles[1]!.keyPointZhHant, /完整 TLE/);
  assert.match(subtitles[2]!.keyPointZhHant, /地面軌跡/);
  assert.match(subtitles[3]!.keyPointZhHant, /1440 ÷ 15\.61546781 = 92\.2/);
  assert.match(subtitles[4]!.keyPointZhHant, /fail-closed/);
  assert.notStrictEqual(subtitles[0]!.keyPointZhHant, subtitles[4]!.keyPointZhHant);
});
