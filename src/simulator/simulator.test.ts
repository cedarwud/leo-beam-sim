import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
  parseTleWebArchiveCatalog,
} from './archive';
import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
  deriveTaipeiLinkGeometry,
} from './analysis';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CATALOG_URLS,
  SIMULATOR_TABS,
} from './types';

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
assert.deepEqual(SIMULATOR_TABS.map(tab => tab.id), ['sinr', 'ee', 'power', 'throughput']);

const entrySource = await readFile('src/main.tsx', 'utf8');
assert.match(
  entrySource,
  /window\.location\.pathname === '\/'[\s\S]*window\.location\.pathname === '\/simulator'/,
  'the formal simulator must own both the bare product entry and /simulator',
);
assert.match(entrySource, /window\.location\.pathname === '\/legacy'/);
assert.match(entrySource, /query\.get\('app'\) === 'legacy'/);

// Select one complete prior publication rather than merging overlapping daily
// revisions into a synthetic manifest.
const boundarySelection = await loadTleSnapshotSelection(
  catalog,
  '2026-08-07T23:59:59.000Z',
  fetchFromPublic,
);
assert.equal(boundarySelection.snapshot.metadata.archiveDate, '20260807');
assert.ok(boundarySelection.manifest.entries.length > 0);
assert.ok(boundarySelection.manifest.entries.length <= boundarySelection.snapshot.entries.length);

const state = createSimulatorTleState(boundarySelection, '2026-08-07T23:59:59.000Z');
assert.equal(state.propagationFrame.satellites.length, boundarySelection.manifest.entries.length);
assert.ok(state.trajectory.length >= 10);
assert.ok(state.selectedSatelliteId.length > 0);
assert.ok(state.selectedSnapshot.sourcePath.endsWith('.tle'));

const analysisFrame = buildSimulationAnalysisFrame(state, DEFAULT_SIMULATOR_PARAMETERS);
assert.ok(Object.isFrozen(analysisFrame));
assert.equal(analysisFrame.links[0]?.actualPowerW, analysisFrame.power.pDlActualBW[0]);
assert.equal(analysisFrame.links[0]?.sinrLinear, analysisFrame.throughput.sinrU[0]);
assert.equal(analysisFrame.ee.aggregation, 'ratio-of-sums');
assert.ok(analysisFrame.provenance.selectedTlePath.startsWith('/tle-archive/oneweb/'));
assert.equal(analysisFrame.provenance.constellation, 'oneweb');
assert.equal(analysisFrame.provenance.archiveCatalogUrl, SIMULATOR_CATALOG_URLS.oneweb);

const starlinkCatalog = await loadTleWebArchiveCatalog(
  SIMULATOR_CATALOG_URLS.starlink,
  fetchFromPublic,
);
const starlinkSelection = await loadTleSnapshotSelection(
  starlinkCatalog,
  '2026-08-08T03:00:00.000Z',
  fetchFromPublic,
);
assert.ok(starlinkSelection.manifest.entries.length > 5_000);
const starlinkState = createSimulatorTleState(starlinkSelection, '2026-08-08T03:00:00.000Z');
assert.equal(starlinkState.propagationFrame.satellites.length, starlinkSelection.manifest.entries.length);
const starlinkFrame = buildSimulationAnalysisFrame(starlinkState, DEFAULT_SIMULATOR_PARAMETERS);
assert.equal(starlinkFrame.provenance.constellation, 'starlink');
assert.equal(starlinkFrame.provenance.archiveCatalogUrl, SIMULATOR_CATALOG_URLS.starlink);
assert.ok(starlinkFrame.provenance.selectedTlePath.startsWith('/tle-archive/starlink/'));
assert.notEqual(starlinkFrame.tleFrameId, analysisFrame.tleFrameId);

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
