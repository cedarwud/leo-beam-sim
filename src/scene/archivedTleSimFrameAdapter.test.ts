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
  adaptSimulationAnalysisFrameToArchivedTleSimFrame,
} from './archivedTleSimFrameAdapter';
import { buildArchivedTleSevenCellPlacement } from './archivedTleSevenCellPlacement';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const catalog = await loadTleWebArchiveCatalog(
  SIMULATOR_CATALOG_URLS.oneweb,
  fetchFromPublic,
);
const instantUtc = '2026-08-08T12:00:00.000Z';
const selection = await loadTleSnapshotSelection(catalog, instantUtc, fetchFromPublic);
const tleState = createSimulatorTleState(selection, instantUtc);
const baseFrame = buildSimulationAnalysisFrame(tleState, DEFAULT_SIMULATOR_PARAMETERS);

// The production analysis frame currently publishes one representative link;
// this fixture expands the same source-backed link shape to exercise the
// adapter's per-user lookup without asking the adapter to recompute SINR.
const links = baseFrame.scenario.users.map((user, index) => ({
  ...baseFrame.links[0]!,
  userId: `ue-${index + 1}`,
  sinrDb: -12 + index * 0.25,
}));
const frame = { ...baseFrame, links };
const adapted = adaptSimulationAnalysisFrameToArchivedTleSimFrame(frame);
const placement = buildArchivedTleSevenCellPlacement({
  cells: frame.scenario.cells,
  sourceCellRadiusKm: frame.scenario.topology.cellRadiusKm,
});

assert.equal(adapted.satellites.length >= 1, true);
assert.equal(adapted.satellites.some(satellite => satellite.id === frame.selectedSatelliteId), true);
assert.equal(adapted.serving.satId, frame.selectedSatelliteId);
assert.equal(adapted.serving.beamId, 0);
assert.equal(adapted.beamHopEnabled, false);
assert.equal(adapted.beamHopStatesBySatId.get(frame.selectedSatelliteId)?.activeBeamIds.length, 7);
assert.equal(adapted.perUePositions.length, 100);
assert.equal(adapted.sinrLiveCells?.cells.length, 7);
assert.equal(adapted.sinrLiveCells?.ues.length, 100);
assert.equal(adapted.sinrLiveCells?.illuminatedBeams.length, 7);
assert.equal(adapted.sinrLiveCells?.servingSatCount, 1);
assert.equal(adapted.sinrLiveCells?.intraHandoverCount, 0);
assert.equal(adapted.sinrLiveCells?.interHandoverCount, 0);
assert.deepEqual(adapted.sinrLiveCells?.recentHandoverEvents, []);

for (const cell of adapted.sinrLiveCells?.cells ?? []) {
  assert.equal(cell.servingSatId, frame.selectedSatelliteId);
}
for (const beam of adapted.sinrLiveCells?.illuminatedBeams ?? []) {
  assert.equal(beam.satId, frame.selectedSatelliteId);
  assert.equal(beam.serving, true);
}
for (const user of frame.scenario.users) {
  const ueId = `ue-${user.index + 1}`;
  const position = adapted.perUePositions.find(candidate => candidate.id === ueId);
  const displayCell = placement.cellByCanonicalId.get(user.cellIndex)!;
  const canonicalCell = frame.scenario.cells.find(cell => cell.index === user.cellIndex)!;
  const localEastKm = user.positionKm[0] - canonicalCell.centerKm[0];
  const localNorthKm = user.positionKm[1] - canonicalCell.centerKm[1];
  assert.ok(position, `${ueId} must be projected`);
  assert.equal(position?.eastKm, displayCell.centerKm[0] + localEastKm * placement.fitScale);
  assert.equal(position?.northKm, displayCell.centerKm[1] + localNorthKm * placement.fitScale);
  assert.equal(
    adapted.sinrLiveCells?.ues.find(candidate => candidate.ueId === ueId)?.sinrDb,
    10 * Math.log10(Math.max(frame.canonical.throughput.sinrU[user.index] ?? 0, 1e-30)),
    `${ueId} SINR must be read directly from the immutable canonical per-UE ledger`,
  );
}

for (const cell of frame.scenario.cells) {
  const displayCell = placement.cellByCanonicalId.get(cell.index)!;
  const beam = adapted.beamCellsBySatId.get(frame.selectedSatelliteId)?.find(
    candidate => candidate.beamId === cell.index,
  );
  assert.equal(beam?.offsetEastKm, displayCell.centerKm[0], `beam ${cell.index} uses display east target`);
  assert.equal(beam?.offsetNorthKm, displayCell.centerKm[1], `beam ${cell.index} uses display north target`);
}

const selectedSource = frame.tleState.propagationFrame.satellites.find(
  satellite => satellite.satelliteId === frame.selectedSatelliteId,
);
assert.ok(selectedSource);
const adaptedSelected = adapted.satellites.find(
  satellite => satellite.id === frame.selectedSatelliteId,
);
assert.ok(adaptedSelected);
assert.notEqual(adaptedSelected?.world.x, 0);
assert.notEqual(adaptedSelected?.world.y, 0);
assert.equal(Number.isFinite(adaptedSelected?.latDeg), true);
assert.equal(Number.isFinite(adaptedSelected?.lonDeg), true);
assert.equal(Number.isFinite(adaptedSelected?.altitudeKm), true);

const movedFrame = {
  ...frame,
  instantUtc: '2026-08-08T12:05:00.000Z',
  tleState: {
    ...frame.tleState,
    requestedInstantUtc: '2026-08-08T12:05:00.000Z',
    selectedSatellite: {
      ...frame.tleState.selectedSatellite,
      requestedInstantUtc: '2026-08-08T12:05:00.000Z',
      positionTemeKm: {
        x: frame.tleState.selectedSatellite.positionTemeKm.x + 10,
        y: frame.tleState.selectedSatellite.positionTemeKm.y + 5,
        z: frame.tleState.selectedSatellite.positionTemeKm.z + 2,
      },
    },
    propagationFrame: {
      ...frame.tleState.propagationFrame,
      requestedInstantUtc: '2026-08-08T12:05:00.000Z',
      satellites: frame.tleState.propagationFrame.satellites.map(satellite => (
        satellite.satelliteId === frame.selectedSatelliteId
          ? {
            ...satellite,
            requestedInstantUtc: '2026-08-08T12:05:00.000Z',
            positionTemeKm: {
              x: satellite.positionTemeKm.x + 10,
              y: satellite.positionTemeKm.y + 5,
              z: satellite.positionTemeKm.z + 2,
            },
          }
          : satellite
      )),
    },
  },
};
const movedAdapted = adaptSimulationAnalysisFrameToArchivedTleSimFrame(movedFrame);
const movedSelected = movedAdapted.satellites.find(
  satellite => satellite.id === frame.selectedSatelliteId,
);
assert.ok(movedSelected);
assert.notDeepEqual(
  [movedSelected?.world.x, movedSelected?.world.y, movedSelected?.world.z],
  [adaptedSelected?.world.x, adaptedSelected?.world.y, adaptedSelected?.world.z],
  'a changed TEME state must move the archived-TLE world projection',
);

const baseAdapted = adaptSimulationAnalysisFrameToArchivedTleSimFrame(baseFrame);
for (const user of baseFrame.scenario.users) {
  const servingBeam = baseFrame.inputs.frame.servingBeamU[user.index] ?? -1;
  const sinrLinear = baseFrame.canonical.throughput.sinrU[user.index] ?? 0;
  const expectedSinrDb = servingBeam < 0
    ? null
    : 10 * Math.log10(Math.max(sinrLinear, 1e-30));
  assert.equal(
    baseAdapted.perUePositions[user.index]?.sinrDb,
    expectedSinrDb,
    `production ${user.index} SINR must come from the canonical per-UE ledger`,
  );
}

const halfway = adaptSimulationAnalysisFrameToArchivedTleSimFrame(frame, {
  nextFrame: movedFrame,
  visualOffsetSec: 150,
});
const halfwaySelected = halfway.satellites.find(
  satellite => satellite.id === frame.selectedSatelliteId,
);
assert.ok(halfwaySelected);
assert.notDeepEqual(
  [halfwaySelected.world.x, halfwaySelected.world.y, halfwaySelected.world.z],
  [adaptedSelected?.world.x, adaptedSelected?.world.y, adaptedSelected?.world.z],
  'a completed adjacent anchor must produce continuous in-between TLE motion',
);
assert.notDeepEqual(
  [halfwaySelected.world.x, halfwaySelected.world.y, halfwaySelected.world.z],
  [movedSelected?.world.x, movedSelected?.world.y, movedSelected?.world.z],
  'the halfway TLE state must not jump directly to the next anchor',
);

console.log('archived TLE SimFrame adapter contract tests passed');
