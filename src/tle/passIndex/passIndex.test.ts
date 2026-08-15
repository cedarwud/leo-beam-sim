import assert from 'node:assert/strict';

import {
  buildTimeChunkedCandidateIndex,
  createPassIndexKey,
  type PassIndexBuildConfig,
} from './index';

const config: PassIndexBuildConfig = Object.freeze({
  durationS: 1_200,
  exactStepS: 30,
  coarseStepS: 120,
  chunkDurationS: 600,
  endpointPaddingS: 120,
  horizonElevationDeg: 0,
  coarseGuardElevationDeg: -20,
});

const index = buildTimeChunkedCandidateIndex({
  satelliteIds: ['sat-c', 'sat-b', 'sat-a', 'sat-u', 'sat-bad-proof'],
  config,
  classify: (satelliteId, chunk) => {
    if (satelliteId === 'sat-u') return { kind: 'uncertain', reason: 'synthetic uncertainty control' };
    if (satelliteId === 'sat-a') return chunk.chunkIndex === 0
      ? { kind: 'candidate', reason: 'envelope intersects chunk' }
      : { kind: 'excluded', proof: { revision: 'synthetic-proof-v1', basis: 'disjoint envelope' } };
    if (satelliteId === 'sat-b') return { kind: 'candidate', reason: 'envelope intersects chunk' };
    if (satelliteId === 'sat-bad-proof') {
      return { kind: 'excluded', proof: { revision: '', basis: '' } };
    }
    return { kind: 'excluded', proof: { revision: 'synthetic-proof-v1', basis: 'disjoint envelope' } };
  },
});

assert.equal(index.schemaVersion, 'tle-pass-index-v1');
assert.equal(index.sourceSatelliteCount, 5);
assert.deepEqual(index.candidateUnionIds, ['sat-a', 'sat-b', 'sat-bad-proof', 'sat-u']);
assert.deepEqual(index.uncertainIds, ['sat-bad-proof', 'sat-u']);
assert.deepEqual(index.excludedIds, ['sat-c']);
assert.deepEqual(index.chunks[0]?.candidateIds, ['sat-a', 'sat-b', 'sat-bad-proof', 'sat-u']);
assert.deepEqual(index.chunks[1]?.candidateIds, ['sat-b', 'sat-bad-proof', 'sat-u']);
assert.deepEqual(index.chunks[0]?.exclusions, [{
  satelliteId: 'sat-c',
  proof: { revision: 'synthetic-proof-v1', basis: 'disjoint envelope' },
}]);
assert.match(index.chunks[0]?.uncertainties[0]?.reason ?? '', /fail-open classification/);
assert.equal(index.chunks[0]?.startAnchorIndexInclusive, 0);
assert.equal(index.chunks[0]?.endAnchorIndexExclusive, 20);
assert.equal(index.chunks[1]?.startAnchorIndexInclusive, 20);
assert.equal(index.chunks[1]?.endAnchorIndexExclusive, 41);
assert.equal(index.chunks[0]?.paddedStartS, -120);
assert.equal(index.chunks[1]?.paddedEndS, 1_320);
assert.equal(index.candidateMembershipCount, 7);
assert.equal(index.classificationAttemptCount, 10);
assert.ok(Object.isFrozen(index));
assert.ok(Object.isFrozen(index.chunks[0]?.candidateIds));

const thrown = buildTimeChunkedCandidateIndex({
  satelliteIds: ['sat-throws'],
  config,
  classify: () => { throw new Error('classifier unavailable'); },
});
assert.deepEqual(thrown.chunks[0]?.candidateIds, ['sat-throws']);
assert.deepEqual(thrown.excludedIds, []);
assert.match(thrown.chunks[0]?.uncertainties[0]?.reason ?? '', /classifier unavailable/);

assert.throws(() => buildTimeChunkedCandidateIndex({
  satelliteIds: ['duplicate', 'duplicate'],
  config,
  classify: () => ({ kind: 'candidate', reason: 'test' }),
}), /unique/);

const manyIds = Array.from({ length: 1_025 }, (_unused, indexValue) => `sat-${indexValue.toString().padStart(4, '0')}`);
const uncapped = buildTimeChunkedCandidateIndex({
  satelliteIds: manyIds,
  config,
  classify: () => ({ kind: 'candidate', reason: 'test' }),
});
assert.equal(uncapped.candidateUnionIds.length, manyIds.length);
assert.equal(uncapped.chunks[0]?.candidateIds.length, manyIds.length);

assert.throws(() => buildTimeChunkedCandidateIndex({
  satelliteIds: ['sat-a'],
  config: { ...config, coarseGuardElevationDeg: 1 },
  classify: () => ({ kind: 'candidate', reason: 'test' }),
}), /must not exceed/);
assert.throws(() => buildTimeChunkedCandidateIndex({
  satelliteIds: ['sat-a'],
  config: { ...config, exactStepS: 30.5 },
  classify: () => ({ kind: 'candidate', reason: 'test' }),
}), /safe integer/);

const identity = {
  archiveId: 'starlink-test',
  publicationSha256: 'a'.repeat(64),
  resolvedSnapshotDigest: 'b'.repeat(64),
  requestedT0Utc: '2026-08-08T12:00:00.000Z',
  observer: { id: 'ntpu-wgs84-v1', latitudeDeg: 24.9441667, longitudeDeg: 121.3713889, heightKm: 0.05 },
  visibilityPolicyRevision: 'horizon-v1',
  coarseIndexRevision: 'coarse-v1',
  exactSgp4Revision: 'satellite-js-6.0.2',
  config,
} as const;
const key = await createPassIndexKey(identity);
const sameKey = await createPassIndexKey(identity);
const changedKey = await createPassIndexKey({
  ...identity,
  requestedT0Utc: '2026-08-08T12:00:30.000Z',
});
assert.match(key, /^tle-pass-index:[0-9a-f]{64}$/);
assert.equal(key, sameKey);
assert.notEqual(key, changedKey);
await assert.rejects(() => createPassIndexKey({
  ...identity,
  observer: { ...identity.observer, latitudeDeg: 91 },
}), /latitudeDeg/);
await assert.rejects(() => createPassIndexKey({
  ...identity,
  requestedT0Utc: '2026-08-08 12:00:00',
}), /ending in Z/);

console.log('pass-index admission and identity tests passed');
