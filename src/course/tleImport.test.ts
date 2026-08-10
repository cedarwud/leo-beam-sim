#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { C90_FIXTURE_PROVIDER } from './fixtures/e1-fixture';
import { matchImportedTle, parseImportedTle } from './tleImport';

const sources = C90_FIXTURE_PROVIDER.getTleJourney().sources;
const courseSource = sources.find(source => source.role === 'course-compatible');
if (courseSource === undefined) throw new Error('test fixture requires a course-compatible source');

test('single 3LE import matches the exact precomputed source', () => {
  const match = matchImportedTle([courseSource.line0, courseSource.line1, courseSource.line2].join('\n'), sources);
  assert.equal(match.source.sourceId, courseSource.sourceId);
  assert.equal(match.importedRecordCount, 1);
});

test('full-group style import can find a matching precomputed record', () => {
  const older = sources[0];
  assert.ok(older);
  const text = [older.line0, older.line1, older.line2, courseSource.line0, courseSource.line1, courseSource.line2].join('\n');
  assert.equal(matchImportedTle(text, sources).source.sourceId, older.sourceId);
  assert.equal(parseImportedTle(text).length, 2);
});

test('malformed and unknown records fail closed', () => {
  assert.throws(() => parseImportedTle('not a TLE'), /no checksum-valid/);
  const unknownLine1 = courseSource.line1.replace(courseSource.line1.slice(2, 7), '99999');
  assert.throws(() => matchImportedTle(`${unknownLine1}\n${courseSource.line2}`, sources), /checksum|identity/);
  assert.throws(
    () => matchImportedTle(`${sources[0]?.line0}\n${sources[0]?.line1}\n${sources[0]?.line2}`, [courseSource]),
    /no exact precomputed trajectory bundle/,
  );
});
