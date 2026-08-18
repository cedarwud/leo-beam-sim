import assert from 'node:assert/strict';

import {
  buildTleRunBundle,
  createTleRunBundleSnapshot,
  hydrateTleRunBundle,
  isTleRunError,
  TLE_RUN_ANCHOR_COUNT,
  type TleRunSelection,
} from './index';
import { TLE_SOURCE_KIND, parseTleEpoch } from '../index';

const line1 = '1 44057U 19010A   26015.11930051  .00000099  00000+0  22629-3 0  9996';
const line2 = '2 44057  87.9018 259.2641 0001826  72.2132 287.9198 13.16594815331428';
const selection: TleRunSelection = {
  catalog: { archiveId: 'snapshot-test-archive' },
  snapshot: { sha256: 'c'.repeat(64) },
  manifest: {
    archiveId: 'snapshot-test-archive',
    maxPropagationAgeMs: 7 * 24 * 60 * 60 * 1_000,
    entries: [{
      satelliteId: 'ONEWEB-0012',
      satelliteName: 'ONEWEB-0012',
      epochUtc: parseTleEpoch(line1).epochUtc,
      line1,
      line2,
      sourcePath: 'archive/snapshot-test.tle',
      sourceKind: TLE_SOURCE_KIND,
    }],
  },
};

const t0Utc = '2026-01-16T12:00:00.000Z';
const original = await buildTleRunBundle({ selection, t0Utc, yieldEveryAnchors: TLE_RUN_ANCHOR_COUNT });
assert.equal(original.computationMetrics.mode, 'full-reference');
assert.equal(original.computationMetrics.inputRecords, 1);
assert.equal(original.computationMetrics.fineSamples, TLE_RUN_ANCHOR_COUNT);
const snapshot = createTleRunBundleSnapshot(original);
assert.equal(snapshot.schema, 'tle-run-bundle-snapshot-v1');
assert.equal(snapshot.geometryRunId, original.runId);
assert.ok(snapshot.positionsTemeKm instanceof Float64Array);
assert.ok(snapshot.velocitiesTemeKmPerSec instanceof Float64Array);
assert.equal(snapshot.positionsTemeKm.length, TLE_RUN_ANCHOR_COUNT * original.satelliteCount * 3);

const hydrated = hydrateTleRunBundle(snapshot);
assert.equal(hydrated.runId, original.runId);
assert.equal(hydrated.archiveId, original.archiveId);
assert.equal(hydrated.publicationSha256, original.publicationSha256);
assert.deepEqual(hydrated.computationMetrics, original.computationMetrics);
assert.equal(hydrated.getAnchorUtc(0), original.getAnchorUtc(0));
assert.equal(hydrated.getAnchorUtc(TLE_RUN_ANCHOR_COUNT - 1), original.getAnchorUtc(TLE_RUN_ANCHOR_COUNT - 1));
for (const anchorIndex of [0, TLE_RUN_ANCHOR_COUNT - 1]) {
  const left = original.readStateByIndex(anchorIndex, 0);
  const right = hydrated.readStateByIndex(anchorIndex, 0);
  assert.deepEqual(right.positionTemeKm, left.positionTemeKm);
  assert.deepEqual(right.velocityTemeKmPerSec, left.velocityTemeKmPerSec);
  assert.deepEqual(hydrated.materializeFrame(anchorIndex), original.materializeFrame(anchorIndex));
}

// Hydration owns private storage, so a transport envelope cannot mutate an
// accepted run after publication.
const firstX = hydrated.readStateByIndex(0, 0).positionTemeKm.x;
snapshot.positionsTemeKm[0] = firstX + 100;
assert.equal(hydrated.readStateByIndex(0, 0).positionTemeKm.x, firstX);

const wrongGeometryIdentity = { ...snapshot, geometryRunId: `${snapshot.geometryRunId}-wrong` };
assert.throws(
  () => hydrateTleRunBundle(wrongGeometryIdentity),
  error => isTleRunError(error) && error.code === 'INVALID_SELECTION',
);
const wrongScalarShape = { ...snapshot, positionsTemeKm: new Float64Array(snapshot.positionsTemeKm.length - 3) };
assert.throws(
  () => hydrateTleRunBundle(wrongScalarShape),
  error => isTleRunError(error) && error.code === 'INVALID_SELECTION',
);
const wrongComputationMetrics = {
  ...snapshot,
  computationMetrics: {
    ...snapshot.computationMetrics,
    totalSamples: snapshot.computationMetrics.totalSamples + 1,
  },
};
assert.throws(
  () => hydrateTleRunBundle(wrongComputationMetrics),
  error => isTleRunError(error) && error.code === 'INVALID_SELECTION',
);

// Exercise the actual Worker boundary: structured clone preserves the typed
// arrays while transfer gives ownership to the receiving side.
const transferSource = createTleRunBundleSnapshot(original);
const transferred = structuredClone(transferSource, {
  transfer: [transferSource.positionsTemeKm.buffer, transferSource.velocitiesTemeKmPerSec.buffer],
});
assert.ok(transferred.positionsTemeKm instanceof Float64Array);
assert.equal(transferSource.positionsTemeKm.byteLength, 0);
const hydratedTransferred = hydrateTleRunBundle(transferred);
assert.deepEqual(
  hydratedTransferred.readStateByIndex(TLE_RUN_ANCHOR_COUNT - 1, 0),
  original.readStateByIndex(TLE_RUN_ANCHOR_COUNT - 1, 0),
);

console.log('TLE RunBundle typed-array snapshot/hydrate parity passed');
