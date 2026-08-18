import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../../simulator/archive';
import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
} from '../../simulator/analysis';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CATALOG_URLS,
} from '../../simulator/types';
import {
  adaptSimulationAnalysisFrameToVisualLabGlobalScene,
  VISUAL_LAB_GLOBAL_CONTEXT_LIMIT,
} from './visualLabGlobalSceneAdapter';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const instantUtc = '2026-08-08T12:00:00.000Z';
const onewebCatalog = await loadTleWebArchiveCatalog(SIMULATOR_CATALOG_URLS.oneweb, fetchFromPublic);
const onewebSelection = await loadTleSnapshotSelection(onewebCatalog, instantUtc, fetchFromPublic);
const onewebState = createSimulatorTleState(onewebSelection, instantUtc);
const onewebFrame = buildSimulationAnalysisFrame(onewebState, DEFAULT_SIMULATOR_PARAMETERS);
const onewebGlobal = adaptSimulationAnalysisFrameToVisualLabGlobalScene(onewebFrame);

assert.equal(onewebGlobal.isMock, false);
assert.equal(onewebGlobal.frameId, onewebFrame.frameId);
assert.equal(onewebGlobal.tleFrameId, onewebFrame.tleFrameId);
assert.equal(onewebGlobal.instantUtc, onewebFrame.instantUtc);
assert.equal(onewebGlobal.requestedInstantUtc, onewebFrame.tleState.requestedInstantUtc);
assert.equal(onewebGlobal.acceptedInstantUtc, onewebFrame.tleState.requestedInstantUtc);
assert.equal(onewebGlobal.requestedConstellation, 'oneweb');
assert.equal(onewebGlobal.acceptedConstellation, 'oneweb');
assert.equal(onewebGlobal.archiveId, onewebFrame.provenance.archiveId);
assert.equal(onewebGlobal.selectedTleEpochUtc, onewebFrame.provenance.selectedTleEpochUtc);
assert.equal(onewebGlobal.constellation, 'oneweb');
assert.equal(onewebGlobal.selectedSatelliteId, onewebFrame.selectedSatelliteId);
assert.equal(onewebGlobal.selected.satelliteId, onewebFrame.selectedSatelliteId);
assert.equal(onewebGlobal.selected.role, 'serving');
assert.equal(onewebGlobal.selected.positionTemeKm.x, onewebFrame.tleState.selectedSatellite.positionTemeKm.x);
assert.equal(onewebGlobal.observer.id, 'NTPU');
assert.equal(onewebGlobal.satellites.length, onewebFrame.tleState.propagationFrame.satellites.length);
assert.ok(onewebGlobal.ntpuVisibleSatelliteCount > 0);
assert.ok(onewebGlobal.visibleContextSatellites.length <= VISUAL_LAB_GLOBAL_CONTEXT_LIMIT);
assert.equal(onewebGlobal.selectedTrajectory.length, onewebFrame.tleState.trajectory.length);
assert.ok(onewebGlobal.selectedTrajectory.length > 1);
assert.equal(onewebGlobal.selectedTrajectory[0]?.instantUtc, onewebFrame.tleState.trajectory[0]?.instantUtc);
if (onewebGlobal.candidate !== null) {
  assert.equal(onewebGlobal.candidate.role, 'candidate');
  assert.equal(onewebGlobal.candidate.visibleFromNtpu, true);
  assert.equal(onewebGlobal.candidate.positionTemeKm.x, onewebFrame.tleState.candidateSatellite?.positionTemeKm.x);
  assert.ok(onewebGlobal.candidateTrajectory.length > 1);
  assert.equal(onewebGlobal.candidateTrajectory[0]?.instantUtc, onewebGlobal.selectedTrajectory[0]?.instantUtc);
}
for (const satellite of [onewebGlobal.selected, ...onewebGlobal.visibleContextSatellites]) {
  assert.ok(satellite.positionWorld.every(Number.isFinite));
}
assert.equal(Object.isFrozen(onewebGlobal), true);
assert.throws(
  () => adaptSimulationAnalysisFrameToVisualLabGlobalScene(onewebFrame, {
    sourceIdentity: {
      requestedConstellation: 'oneweb',
      requestedInstantUtc: instantUtc,
      acceptedConstellation: 'starlink',
      acceptedInstantUtc: instantUtc,
    },
  }),
  /accepted constellation does not match the frame/,
);

const starlinkCatalog = await loadTleWebArchiveCatalog(SIMULATOR_CATALOG_URLS.starlink, fetchFromPublic);
const starlinkSelection = await loadTleSnapshotSelection(starlinkCatalog, instantUtc, fetchFromPublic);
const starlinkState = createSimulatorTleState(starlinkSelection, instantUtc);
const starlinkFrame = buildSimulationAnalysisFrame(starlinkState, DEFAULT_SIMULATOR_PARAMETERS);
const starlinkGlobal = adaptSimulationAnalysisFrameToVisualLabGlobalScene(starlinkFrame);
assert.equal(starlinkGlobal.constellation, 'starlink');
assert.notEqual(starlinkGlobal.tleFrameId, onewebGlobal.tleFrameId);
assert.notEqual(starlinkGlobal.selectedSatelliteId, onewebGlobal.selectedSatelliteId);

const sceneSource = readFileSync('src/prototype/visual-lab-g0/VisualLabScene.tsx', 'utf8');
assert.doesNotMatch(sceneSource, /OrbitalFamily|orbitalPosition/);
assert.doesNotMatch(sceneSource, /planeCount|satellitesPerPlane|inclination/);
assert.doesNotMatch(sceneSource, /MOCK CONSTELLATION/);
const globalSceneSource = readFileSync('src/prototype/visual-lab-g0/VisualLabGlobalScene.tsx', 'utf8');
assert.match(globalSceneSource, /frame === null && artifact === null \? <EmptyGlobalState/);
assert.match(globalSceneSource, /Loading archived TLE \/ SGP4 scene|正在載入封存 TLE \/ SGP4 場景/);
assert.doesNotMatch(globalSceneSource, /OrbitalFamily|orbitalPosition|planeCount|satellitesPerPlane|inclination/);

console.log('visual-lab global archived-TLE scene adapter passed');
