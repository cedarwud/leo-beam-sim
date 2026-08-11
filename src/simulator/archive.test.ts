import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadTleSnapshotWindow, loadTleWebArchiveCatalog, parseTleWebArchiveCatalog } from './archive';
import { resolveTleSnapshot } from '../tle/resolver';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const catalog = await loadTleWebArchiveCatalog('/tle-archive/oneweb/catalog.json', fetchFromPublic);
const boundary = await loadTleSnapshotWindow(catalog, '2026-08-07T23:59:59.000Z', fetchFromPublic);

// The filename date is not the TLE epoch boundary. The next-dated file must
// be loaded because its minEpochUtc is still before this requested instant.
assert.ok(boundary.snapshots.some(snapshot => snapshot.metadata.archiveDate === '20260808'));
assert.ok(boundary.snapshots.some(snapshot => snapshot.metadata.minEpochUtc <= '2026-08-07T23:59:59.000Z'));

const boundaryInstant = '2026-08-07T23:59:59.000Z';
const nextDatedEntry = boundary.current.entries.find(entry => Date.parse(entry.epochUtc) <= Date.parse(boundaryInstant));
assert.ok(nextDatedEntry, 'the next-dated snapshot should contain at least one usable prior epoch');
const boundaryResolved = resolveTleSnapshot(boundary.manifest, boundaryInstant, nextDatedEntry!.satelliteId);
assert.equal(boundaryResolved.sourcePath, '/tle-archive/oneweb/oneweb_20260808.tle');

// A later instant can resolve an epoch from that next-dated file rather than
// silently assuming that archiveDate is the element epoch.
const later = await loadTleSnapshotWindow(catalog, '2026-08-08T03:00:00.000Z', fetchFromPublic);
const satelliteId = later.current.entries[0]!.satelliteId;
const resolved = resolveTleSnapshot(later.manifest, '2026-08-08T03:00:00.000Z', satelliteId);
assert.equal(resolved.sourcePath, '/tle-archive/oneweb/oneweb_20260808.tle');

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
