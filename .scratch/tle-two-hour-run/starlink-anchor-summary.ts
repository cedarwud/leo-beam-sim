import { readFile } from 'node:fs/promises';

import { buildTleRunBundle } from '../../src/tle/run';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../../src/simulator/archive';
import { deriveObserverLinkGeometry } from '../../src/simulator/observer';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);
const t0Utc = '2026-08-08T12:00:00.000Z';
const catalog = await loadTleWebArchiveCatalog('/tle-archive/starlink/catalog.json', fetchFromPublic);
const selection = await loadTleSnapshotSelection(catalog, t0Utc, fetchFromPublic);
const run = await buildTleRunBundle({ selection, t0Utc, yieldEveryAnchors: 241 });

for (const anchorIndex of [0, 1, 30, 60, 120, 180, 240]) {
  const visible = run.satellites.flatMap((satellite, satelliteIndex) => {
    const state = run.readStateByIndex(anchorIndex, satelliteIndex);
    const geometry = deriveObserverLinkGeometry(state.positionTemeKm, state.requestedInstantUtc);
    return geometry.visible ? [{ satelliteId: satellite.satelliteId, elevationDeg: geometry.elevationDeg }] : [];
  }).sort((left, right) => right.elevationDeg - left.elevationDeg);
  console.log(JSON.stringify({
    anchorIndex,
    instantUtc: run.getAnchorUtc(anchorIndex),
    visibleCount: visible.length,
    top: visible.slice(0, 5),
  }));
}
