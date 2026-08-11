import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  loadTleSnapshotPair,
  loadTleWebArchiveCatalog,
  parseTleWebArchiveCatalog,
} from './archive';
import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
  deriveTaipeiLinkGeometry,
} from './analysis';
import { DEFAULT_SIMULATOR_PARAMETERS } from './types';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const catalog = await loadTleWebArchiveCatalog(
  '/tle-archive/oneweb/catalog.json',
  fetchFromPublic,
);

assert.equal(catalog.schemaVersion, 'tle-web-archive-v1');
assert.equal(catalog.snapshotCount, catalog.snapshots.length);
assert.equal(catalog.snapshots[0]?.identityCount, catalog.snapshots[0]?.recordCount);

// The archive filename date is not an epoch boundary.  At this instant the
// 20260808 file contains valid epochs even though the request is still on
// 20260807 UTC; the loader must include it in the epoch-covering candidates.
const boundaryPair = await loadTleSnapshotPair(
  catalog,
  '2026-08-07T23:59:59.000Z',
  fetchFromPublic,
);
assert.ok(boundaryPair.snapshots.some(snapshot => snapshot.metadata.archiveDate === '20260808'));
assert.equal(boundaryPair.current.metadata.archiveDate, '20260808');
assert.ok(boundaryPair.manifest.entries.length >= 651);

const state = createSimulatorTleState(boundaryPair, '2026-08-07T23:59:59.000Z');
assert.ok(state.propagationFrame.satellites.length >= 651);
assert.ok(state.trajectory.length >= 10);
assert.ok(state.selectedSatelliteId.length > 0);
assert.ok(state.selectedSnapshot.sourcePath.endsWith('.tle'));

const analysisFrame = buildSimulationAnalysisFrame(state, DEFAULT_SIMULATOR_PARAMETERS);
assert.ok(Object.isFrozen(analysisFrame));
assert.equal(analysisFrame.links[0]?.actualPowerW, analysisFrame.power.pDlActualBW[0]);
assert.equal(analysisFrame.links[0]?.sinrLinear, analysisFrame.throughput.sinrU[0]);
assert.equal(analysisFrame.ee.aggregation, 'ratio-of-sums');
assert.ok(analysisFrame.provenance.selectedTlePath.startsWith('/tle-archive/oneweb/'));

const overhead = deriveTaipeiLinkGeometry(
  { x: 0, y: 0, z: 7_500 },
  '2026-08-07T23:59:59.000Z',
);
assert.ok(overhead.offAxisAngleRad >= 0 && overhead.offAxisAngleRad <= Math.PI);
assert.ok(Number.isFinite(overhead.elevationDeg));

assert.throws(() => parseTleWebArchiveCatalog({
  ...catalog,
  snapshots: [{ ...catalog.snapshots[0]!, path: '/outside/evil.tle' }],
  snapshotCount: 1,
  firstArchiveDate: catalog.snapshots[0]!.archiveDate,
  lastArchiveDate: catalog.snapshots[0]!.archiveDate,
}), /bind to its archiveDate|path/);

console.log('simulator tests passed');
