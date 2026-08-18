import { readFile } from 'node:fs/promises';
import { loadTleSnapshotSelection, loadTleWebArchiveCatalog } from '../../src/simulator/archive';
import { buildTleRunBundle } from '../../src/tle/run';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const instant = '2026-07-27T12:00:00.000Z';
const catalog = await loadTleWebArchiveCatalog(
  '/tle-archive/starlink/catalog.json',
  fetchFromPublic,
);
const selection = await loadTleSnapshotSelection(catalog, instant, fetchFromPublic);
console.log(`selected=${selection.snapshot.metadata.archiveDate} path=${selection.snapshot.metadata.path}`);
const run = await buildTleRunBundle({
  selection,
  t0Utc: instant,
  yieldEveryAnchors: 241,
});
console.log(`PASS satellites=${run.satelliteCount} anchors=${run.anchorCount}`);
