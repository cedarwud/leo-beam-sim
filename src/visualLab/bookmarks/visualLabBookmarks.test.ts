import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  bookmarkToCandidate,
  parseVisualLabBookmarksArtifact,
  rankVisualLabBookmarkCandidates,
  visualLabBookmarkDescriptorDistance,
} from './index';

const raw = JSON.parse(
  await readFile('public/homepage-first-frame/visual-lab-bookmarks.json', 'utf8'),
) as unknown;
const artifact = parseVisualLabBookmarksArtifact(raw);

assert.equal(artifact.schema, 'visual-lab-bookmarks-v1');
assert.equal(artifact.timeZone, 'Asia/Taipei');
assert.equal(artifact.sourceCatalogs.length, 2);
assert.deepEqual(
  artifact.sourceCatalogs.map(catalog => catalog.constellation).sort(),
  ['oneweb', 'starlink'],
);
assert.equal(artifact.bookmarks.length, 6);
assert.ok(Object.isFrozen(artifact));
assert.ok(Object.isFrozen(artifact.bookmarks));

for (const bookmark of artifact.bookmarks) {
  assert.match(bookmark.source.path, new RegExp(`^/tle-archive/${bookmark.constellation}/.*\\.tle$`));
  assert.equal(bookmark.source.sourceKind, 'ARCHIVED_TLE');
  assert.equal(bookmark.source.propagationModel, 'SGP4');
  assert.equal(bookmark.instantTaipei.length, 23);
  assert.ok(bookmark.descriptors.visibleSatelliteCount > 0);
  assert.ok(bookmark.descriptors.selectedElevationDeg >= 0);
  assert.ok(bookmark.descriptors.selectedRangeKm > 0);
  assert.ok(bookmark.copy.label.en.includes('visible'));
  assert.ok(bookmark.copy.caption.en.includes('SGP4'));
  assert.ok(Object.isFrozen(bookmark.source));
}

const ranked = rankVisualLabBookmarkCandidates(
  artifact.bookmarks.map(bookmarkToCandidate),
  artifact.selectionPolicy.selectedPerConstellation,
);
assert.deepEqual(
  ranked.map(item => `${item.candidate.constellation}:${item.selectionRank}:${item.selectionRole}`),
  [
    'oneweb:1:max-visible-count-seed',
    'oneweb:2:descriptor-contrast',
    'oneweb:3:descriptor-contrast',
    'starlink:1:max-visible-count-seed',
    'starlink:2:descriptor-contrast',
    'starlink:3:descriptor-contrast',
  ],
);
assert.equal(
  visualLabBookmarkDescriptorDistance(
    artifact.bookmarks[0]!.descriptors,
    artifact.bookmarks[0]!.descriptors,
  ),
  0,
);
assert.ok(
  visualLabBookmarkDescriptorDistance(
    artifact.bookmarks[0]!.descriptors,
    artifact.bookmarks[1]!.descriptors,
  ) > 0.01,
);

interface MutableBookmarkFields {
  instantTaipei: string;
  source: { path: string };
  copy: { caption: { en: string } };
  selectionRole: string;
}

interface MutableArtifactFields {
  bookmarks: MutableBookmarkFields[];
}

function cloneArtifact(): MutableArtifactFields {
  return JSON.parse(JSON.stringify(raw)) as MutableArtifactFields;
}

const wrongTimeZone = cloneArtifact();
wrongTimeZone.bookmarks[0]!.instantTaipei = '2026-01-01T00:00:00.000';
assert.throws(
  () => parseVisualLabBookmarksArtifact(wrongTimeZone),
  /instantTaipei disagrees with instantUtc/,
);

const wrongPath = cloneArtifact();
wrongPath.bookmarks[0]!.source.path = '/tle-archive/starlink/starlink_20260331.tle';
assert.throws(
  () => parseVisualLabBookmarksArtifact(wrongPath),
  /does not bind to archiveDate and constellation/,
);

const unsupportedCopy = cloneArtifact();
unsupportedCopy.bookmarks[0]!.copy.caption.en = 'synthetic throughput result';
assert.throws(
  () => parseVisualLabBookmarksArtifact(unsupportedCopy),
  /unsupported result or energy claim term/,
);

const wrongRole = cloneArtifact();
wrongRole.bookmarks[0]!.selectionRole = 'descriptor-contrast';
assert.throws(
  () => parseVisualLabBookmarksArtifact(wrongRole),
  /rank and selectionRole disagree/,
);

assert.throws(
  () => rankVisualLabBookmarkCandidates(artifact.bookmarks.slice(0, 2).map(bookmarkToCandidate), 3),
  /cannot select 3 oneweb bookmarks/,
);

console.log('Visual Lab archived-TLE bookmark parser, provenance, ranking, and fail-closed tests passed.');
