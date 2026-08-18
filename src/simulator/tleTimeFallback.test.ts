import assert from 'node:assert/strict';
import {
  nearestTleTimeFallbackCandidates,
  type TleTimeFallbackCandidate,
} from './tleTimeFallback';
import type { TleWebArchiveCatalog, TleWebArchiveSnapshot } from './types';

function snapshot(archiveDate: string, maxEpochUtc: string): TleWebArchiveSnapshot {
  return {
    archiveDate,
    path: `/tle-archive/starlink/starlink_${archiveDate}.tle`,
    byteLength: 1,
    recordCount: 1,
    identityCount: 1,
    minEpochUtc: maxEpochUtc,
    maxEpochUtc,
    sha256: '0'.repeat(64),
  };
}

const catalog: TleWebArchiveCatalog = {
  schemaVersion: 'tle-web-archive-v1',
  archiveId: 'fallback-order-test',
  constellation: 'starlink',
  sourceKind: 'ARCHIVED_TLE',
  propagationModel: 'SGP4',
  firstArchiveDate: '20260726',
  lastArchiveDate: '20260728',
  snapshotCount: 3,
  maxPropagationAgeMs: 48 * 60 * 60 * 1_000,
  snapshots: [
    snapshot('20260726', '2026-07-27T11:30:00.000Z'),
    snapshot('20260727', '2026-07-27T12:30:00.000Z'),
    snapshot('20260728', '2026-07-28T12:00:00.000Z'),
  ],
};

const candidates: readonly TleTimeFallbackCandidate[] = nearestTleTimeFallbackCandidates(
  catalog,
  '2026-07-27T12:00:00.000Z',
);
assert.deepEqual(
  candidates.map(candidate => [candidate.instantUtc, candidate.offsetSeconds]),
  [
    ['2026-07-27T11:30:00.000Z', -1_800],
    ['2026-07-27T12:30:00.000Z', 1_800],
    ['2026-07-28T12:00:00.000Z', 86_400],
  ],
  'nearest boundary wins and an equal-distance tie prefers the earlier instant',
);

assert.deepEqual(
  nearestTleTimeFallbackCandidates(catalog, '2026-07-27T12:30:00.000Z', 1)
    .map(candidate => candidate.instantUtc),
  ['2026-07-27T11:30:00.000Z'],
  'the exact instant is excluded and the attempt limit is enforced',
);

assert.throws(
  () => nearestTleTimeFallbackCandidates(catalog, '2026-07-27T12:00:00.000Z', -1),
  /non-negative integer/,
);

console.log('tleTimeFallback.test.ts: all assertions passed');
