import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  loadTleSnapshot,
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
  parseTleWebArchiveCatalog,
} from './archive';
import { resolveTleSnapshot } from '../tle/resolver';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

let observedCatalogCacheMode: RequestCache | undefined;
await loadTleWebArchiveCatalog('/tle-archive/oneweb/catalog.json', async (path, init) => {
  observedCatalogCacheMode = init?.cache;
  return new Response(await readFile(`public${String(path)}`), { status: 200 });
});
assert.equal(observedCatalogCacheMode, 'no-cache', 'mutable catalog indexes must revalidate');

const catalog = await loadTleWebArchiveCatalog('/tle-archive/oneweb/catalog.json', fetchFromPublic);
assert.equal(catalog.constellation, 'oneweb');

const starlinkCatalog = await loadTleWebArchiveCatalog('/tle-archive/starlink/catalog.json', fetchFromPublic);
assert.equal(starlinkCatalog.constellation, 'starlink');
assert.equal(starlinkCatalog.snapshotCount, 364);
assert.equal(starlinkCatalog.sourceSnapshotCount, 365);
assert.equal(starlinkCatalog.excludedSnapshots?.length, 1);
const starlinkLatestMetadata = starlinkCatalog.snapshots[starlinkCatalog.snapshots.length - 1]!;
const starlinkLatest = await loadTleSnapshot(starlinkLatestMetadata, fetchFromPublic);
assert.equal(starlinkLatest.entries.length, starlinkLatestMetadata.recordCount);
assert.ok(starlinkLatest.entries.length > catalog.snapshots[catalog.snapshots.length - 1]!.recordCount);

const boundary = await loadTleSnapshotSelection(catalog, '2026-08-07T23:59:59.000Z', fetchFromPublic);

// Prefer the newest atomic publication whose complete epoch range is already
// prior to the requested instant; do not mix it with a later revision.
assert.equal(boundary.snapshot.metadata.archiveDate, '20260807');
assert.ok(boundary.snapshot.metadata.maxEpochUtc <= '2026-08-07T23:59:59.000Z');

const boundaryInstant = '2026-08-07T23:59:59.000Z';
const nextDatedEntry = boundary.manifest.entries.find(entry => Date.parse(entry.epochUtc) <= Date.parse(boundaryInstant));
assert.ok(nextDatedEntry, 'the selected snapshot should contain at least one usable prior epoch');
const boundaryResolved = resolveTleSnapshot(boundary.manifest, boundaryInstant, nextDatedEntry!.satelliteId);
assert.equal(boundaryResolved.sourcePath, boundary.snapshot.metadata.path);

// Once the next publication's complete epoch range is prior, it becomes the
// selected atomic source.
const later = await loadTleSnapshotSelection(catalog, '2026-08-08T12:00:00.000Z', fetchFromPublic);
const satelliteId = later.manifest.entries[0]!.satelliteId;
const resolved = resolveTleSnapshot(later.manifest, '2026-08-08T12:00:00.000Z', satelliteId);
assert.equal(resolved.sourcePath, '/tle-archive/oneweb/oneweb_20260808.tle');

// Every newly published daily snapshot remains selectable; the latest default
// date is not a one-off special case.
for (const currentCatalog of [catalog, starlinkCatalog]) {
  for (const metadata of currentCatalog.snapshots.filter(snapshot => snapshot.archiveDate >= '20260809')) {
    const selectableInstant = new Date(Date.parse(metadata.maxEpochUtc) + 1).toISOString();
    const selected = await loadTleSnapshotSelection(currentCatalog, selectableInstant, fetchFromPublic);
    assert.equal(selected.snapshot.metadata.archiveDate, metadata.archiveDate);
  }
}

const malformedBounds = {
  ...catalog,
  snapshots: catalog.snapshots.map((snapshot, index) => index === 0
    ? { ...snapshot, minEpochUtc: snapshot.maxEpochUtc, maxEpochUtc: snapshot.minEpochUtc }
    : snapshot),
};
assert.throws(() => parseTleWebArchiveCatalog(malformedBounds), /minEpochUtc must not be after maxEpochUtc/);

const malformedPath = {
  ...catalog,
  snapshots: catalog.snapshots.map((snapshot, index) => index === 0
    ? { ...snapshot, path: '/outside/oneweb_20250727.tle' }
    : snapshot),
};
assert.throws(() => parseTleWebArchiveCatalog(malformedPath), /bind to its archiveDate/);

console.log('archive tests passed');
