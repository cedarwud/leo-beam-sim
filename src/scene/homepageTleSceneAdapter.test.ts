import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  loadTleSnapshotSelection,
  loadTleWebArchiveCatalog,
} from '../simulator/archive';
import {
  buildSimulationAnalysisFrame,
  createSimulatorTleState,
} from '../simulator/analysis';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CATALOG_URLS,
} from '../simulator/types';
import {
  adaptSimulationAnalysisFrameToHomepageTleScene,
  HOMEPAGE_TLE_DEFAULT_CONTEXT_LIMIT,
  HOMEPAGE_TLE_OBSERVER,
} from './homepageTleSceneAdapter';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

function assertFinitePosition(position: readonly [number, number, number], label: string): void {
  for (const coordinate of position) {
    assert.equal(Number.isFinite(coordinate), true, `${label} must be finite`);
  }
}

const catalog = await loadTleWebArchiveCatalog(
  SIMULATOR_CATALOG_URLS.oneweb,
  fetchFromPublic,
);
const instantA = '2026-08-08T12:00:00.000Z';
const selectionA = await loadTleSnapshotSelection(catalog, instantA, fetchFromPublic);
const stateA = createSimulatorTleState(selectionA, instantA);
const frameA = buildSimulationAnalysisFrame(stateA, DEFAULT_SIMULATOR_PARAMETERS);
const sceneA = adaptSimulationAnalysisFrameToHomepageTleScene(frameA);

assert.deepEqual(HOMEPAGE_TLE_OBSERVER, {
  id: 'ntpu-wgs84-v1',
  label: 'NTPU',
  latitudeDeg: 24.9441667,
  longitudeDeg: 121.3713889,
  heightKm: 0.05,
});
assert.equal(sceneA.frameId, frameA.frameId);
assert.equal(sceneA.tleFrameId, frameA.tleFrameId);
assert.equal(sceneA.identity.frameId, frameA.frameId);
assert.equal(sceneA.identity.tleFrameId, frameA.tleFrameId);
assert.equal(sceneA.identity.requestedInstantUtc, frameA.instantUtc);
assert.equal(sceneA.identity.constellation, 'oneweb');
assert.equal(sceneA.identity.selectedSatelliteId, stateA.selectedSatelliteId);
assert.equal(sceneA.selected.satelliteId, stateA.selectedSatelliteId);
assert.deepEqual(sceneA.selected.positionTemeKm, stateA.selectedSatellite.positionTemeKm);
assert.equal(sceneA.selected.role, 'selected');
assert.equal(sceneA.selected.sourcePath, stateA.selectedSatellite.sourcePath);
assert.ok(sceneA.candidate, 'the accepted OneWeb frame should expose a candidate');
assert.equal(sceneA.candidate?.role, 'candidate');
assert.equal(sceneA.candidate?.satelliteId, stateA.candidateSatellite?.satelliteId);
assert.equal(sceneA.candidate?.look.visible, true);
assert.equal(sceneA.earthSphere, false);
assert.equal(sceneA.handoverDecision, 'not-in-frame');
assert.equal(sceneA.telemetry.propagatedSatelliteCount, stateA.propagationFrame.satellites.length);
assert.equal(sceneA.telemetry.selectedTrajectoryPointCount, stateA.trajectory.length);
assert.ok(sceneA.contextSatellites.length <= HOMEPAGE_TLE_DEFAULT_CONTEXT_LIMIT);
assert.equal(sceneA.satellites[0]?.satelliteId, sceneA.selected.satelliteId);
assert.equal(sceneA.satellites[1]?.satelliteId, sceneA.candidate?.satelliteId);
assert.equal(Object.isFrozen(sceneA), true);

for (const satellite of sceneA.satellites) {
  assertFinitePosition(satellite.worldPosition, `${satellite.satelliteId} worldPosition`);
  for (const coordinate of [satellite.positionTemeKm.x, satellite.positionTemeKm.y, satellite.positionTemeKm.z]) {
    assert.equal(Number.isFinite(coordinate), true, `${satellite.satelliteId} TEME must be finite`);
  }
}
for (const point of sceneA.selectedTrajectory) {
  assertFinitePosition(point.worldPosition, `trajectory ${point.instantUtc} worldPosition`);
  assert.equal(Number.isFinite(point.look.rangeKm), true);
}
assert.deepEqual(
  sceneA.selectedTrajectory[0]?.positionTemeKm,
  stateA.trajectory[0]?.positionTemeKm,
  'the selected path keeps the source TEME state beside its display projection',
);

const noContext = adaptSimulationAnalysisFrameToHomepageTleScene(frameA, { contextLimit: 0 });
assert.equal(noContext.contextSatellites.length, 0);
assert.equal(noContext.satellites.length, sceneA.candidate === null ? 1 : 2);

const instantB = '2026-08-08T12:05:00.000Z';
const selectionB = await loadTleSnapshotSelection(catalog, instantB, fetchFromPublic);
const stateB = createSimulatorTleState(selectionB, instantB);
const frameB = buildSimulationAnalysisFrame(stateB, DEFAULT_SIMULATOR_PARAMETERS);
const sceneB = adaptSimulationAnalysisFrameToHomepageTleScene(frameB);
assert.notEqual(sceneB.frameId, sceneA.frameId);
assert.notEqual(sceneB.tleFrameId, sceneA.tleFrameId);
assert.notDeepEqual(
  sceneB.selected.positionTemeKm,
  sceneA.selected.positionTemeKm,
  'a changed requested instant must propagate a new TEME state',
);
assert.notDeepEqual(
  sceneB.selected.worldPosition,
  sceneA.selected.worldPosition,
  'a changed requested instant must move the projected campus satellite',
);

console.log('homepage TLE scene adapter tests passed');
