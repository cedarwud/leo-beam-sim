import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeTextFileAtomically } from './lib/writeTextFileAtomically';
import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
  simulatorTaipeiDateTimeToUtc,
} from '../src/simulator/analysis';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../src/simulator/archive';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CATALOG_URLS,
} from '../src/simulator/types';
import {
  compactHomepageFirstFrameTleState,
  createHomepageFirstFrameCacheKey,
  HOMEPAGE_FIRST_FRAME_ARTIFACT_SCHEMA,
  parseHomepageFirstFrameArtifact,
} from '../src/ui/signal-tuning/homepageFirstFrameCache';
import {
  LATEST_TLE_REFERENCE_ARTIFACT_DATE,
  LATEST_TLE_REFERENCE_TAIPEI_LOCAL,
} from '../src/tle/latestTleDefaults';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactPath = join(repoRoot, `public/homepage-first-frame/starlink-${LATEST_TLE_REFERENCE_ARTIFACT_DATE}.json`);
const requestedTaipeiDateTime = LATEST_TLE_REFERENCE_TAIPEI_LOCAL;
const requestedInstantUtc = simulatorTaipeiDateTimeToUtc(requestedTaipeiDateTime);

const fetchFromPublic = async (input: RequestInfo | URL): Promise<Response> => {
  const relativePath = String(input).replace(/^\/+/, '');
  return new Response(await readFile(join(repoRoot, 'public', relativePath)), { status: 200 });
};

const catalog = await loadTleWebArchiveCatalog(
  SIMULATOR_CATALOG_URLS.starlink,
  fetchFromPublic,
);
const selection = await loadTleSnapshotSelection(catalog, requestedInstantUtc, fetchFromPublic);
const tleState = createSimulatorTleState(selection, requestedInstantUtc);
const frame = buildSimulationAnalysisFrame(tleState, DEFAULT_SIMULATOR_PARAMETERS);
const key = createHomepageFirstFrameCacheKey(
  requestedInstantUtc,
  requestedInstantUtc,
  catalog,
  selection,
  DEFAULT_SIMULATOR_PARAMETERS,
);
const artifact = {
  schema: HOMEPAGE_FIRST_FRAME_ARTIFACT_SCHEMA,
  key,
  tleState: compactHomepageFirstFrameTleState(frame),
};
const serialized = `${JSON.stringify(artifact, null, 2)}\n`;

const parsedState = parseHomepageFirstFrameArtifact(artifact, {
  requestedInstantUtc,
  appliedInstantUtc: requestedInstantUtc,
  catalog,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
});
if (parsedState === null) throw new Error('generated homepage first-frame artifact failed its own validation');
const rebuilt = buildSimulationAnalysisFrame(parsedState, DEFAULT_SIMULATOR_PARAMETERS);
if (rebuilt.frameId !== frame.frameId) throw new Error('generated homepage first-frame artifact did not round-trip to the same frame');
if (!rebuilt.links.every(link => Number.isFinite(link.beforeSatelliteCapPowerW))) {
  throw new Error('generated homepage first-frame artifact rebuilt a serving link without beforeSatelliteCapPowerW');
}
if (rebuilt.candidateLink !== null && !Number.isFinite(rebuilt.candidateLink.beforeSatelliteCapPowerW)) {
  throw new Error('generated homepage first-frame artifact rebuilt a candidate link without beforeSatelliteCapPowerW');
}

if (process.argv.includes('--check')) {
  const current = await readFile(artifactPath, 'utf8');
  if (current !== serialized) throw new Error(`${artifactPath} is stale; run the generator without --check`);
  console.log(`homepage first-frame artifact is current (${Buffer.byteLength(serialized)} bytes)`);
} else {
  await writeTextFileAtomically(artifactPath, serialized);
  console.log(`wrote ${artifactPath} (${Buffer.byteLength(serialized)} bytes)`);
}
