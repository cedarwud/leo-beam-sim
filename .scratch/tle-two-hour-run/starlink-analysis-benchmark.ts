import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

import { buildTleRunBundle } from '../../src/tle/run';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../../src/simulator/archive';
import { buildTleAnalysisRun } from '../../src/simulator/tleAnalysisRun';
import { DEFAULT_SIMULATOR_PARAMETERS } from '../../src/simulator/types';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const t0Utc = '2026-08-08T12:00:00.000Z';
const catalogStart = performance.now();
const catalog = await loadTleWebArchiveCatalog(
  '/tle-archive/starlink/catalog.json',
  fetchFromPublic,
);
const selection = await loadTleSnapshotSelection(catalog, t0Utc, fetchFromPublic);
const catalogEnd = performance.now();
const geometryRun = await buildTleRunBundle({
  selection,
  t0Utc,
  yieldEveryAnchors: 4,
});
const geometryEnd = performance.now();
const analysisRun = buildTleAnalysisRun({
  selection,
  geometryRun,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
});
const analysisEnd = performance.now();
const firstFrame = analysisRun.getFrame(0);
const frameEnd = performance.now();

console.log(JSON.stringify({
  satelliteCount: geometryRun.satelliteCount,
  anchorCount: geometryRun.anchorCount,
  passCount: analysisRun.passPlan.passes.length,
  selectedPassCount: analysisRun.passPlan.selectedPassIds.length,
  fallbackAnchorCount: analysisRun.anchorSelections.filter(
    anchor => anchor.selectionKind === 'visible-geometry-fallback',
  ).length,
  unavailableAnchorCount: analysisRun.anchorSelections.filter(
    anchor => anchor.selectionKind === 'unavailable',
  ).length,
  candidateAnchorCount: analysisRun.anchorSelections.filter(
    anchor => anchor.candidateSatelliteId !== null,
  ).length,
  firstSelectedSatelliteId: firstFrame?.selectedSatelliteId ?? null,
  loadMs: catalogEnd - catalogStart,
  geometryMs: geometryEnd - catalogEnd,
  analysisMs: analysisEnd - geometryEnd,
  firstFrameMs: frameEnd - analysisEnd,
}, null, 2));
