import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { loadTleSnapshotSelection, loadTleWebArchiveCatalog } from '../../simulator/archive';
import { buildSimulationAnalysisFrame, createSimulatorTleState } from '../../simulator/analysis';
import { buildArchivedTleSevenCellPlacement } from '../../scene/archivedTleSevenCellPlacement';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CATALOG_URLS,
  type SimulationAnalysisFrame,
} from '../../simulator/types';
import {
  adaptSimulationAnalysisFrameToVisualLabLocalScene,
  mapVisualLabLocalTopocentricToWorld,
  VISUAL_LAB_LOCAL_DEFAULT_GROUND_WORLD_UNITS_PER_KM,
  VISUAL_LAB_LOCAL_TOPOCENTRIC_MAX_RADIUS_WORLD,
  VISUAL_LAB_LOCAL_TOPOCENTRIC_WORLD_UNITS_PER_KM,
  VISUAL_LAB_LOCAL_RENDER_SCHEMA,
} from './visualLabLocalSceneAdapter';

const fetchFromPublic = async (path: RequestInfo | URL): Promise<Response> => (
  new Response(await readFile(`public${String(path)}`), { status: 200 })
);

const catalog = await loadTleWebArchiveCatalog(
  SIMULATOR_CATALOG_URLS.oneweb,
  fetchFromPublic,
);
const instantA = '2026-08-08T12:00:00.000Z';
const selectionA = await loadTleSnapshotSelection(catalog, instantA, fetchFromPublic);
const stateA = createSimulatorTleState(selectionA, instantA);
const frameA = buildSimulationAnalysisFrame(stateA, DEFAULT_SIMULATOR_PARAMETERS);
const planA = adaptSimulationAnalysisFrameToVisualLabLocalScene(frameA);

assert.equal(planA.schemaVersion, 'visual-lab-local-scene-v1');
assert.equal(planA.isMock, false);
assert.equal(planA.source.frameId, frameA.frameId);
assert.equal(planA.source.tleFrameId, frameA.tleFrameId);
assert.equal(planA.source.constellation, frameA.provenance.constellation);
assert.equal(planA.source.archiveId, frameA.provenance.archiveId);
assert.equal(planA.source.selectedSatelliteId, frameA.selectedSatelliteId);
assert.equal(planA.source.candidateSatelliteId, stateA.candidateSatellite?.satelliteId ?? null);
assert.equal(planA.observer.id, 'NTPU');
assert.equal(planA.observer.latitudeDeg, 24.9441667);
assert.equal(planA.observer.longitudeDeg, 121.3713889);
assert.equal(planA.interpolation.mode, 'single-accepted-frame');
assert.equal(planA.interpolation.source, 'accepted-frame');
assert.equal(planA.serving.availability, 'available');
assert.equal(planA.serving.satelliteId, frameA.selectedSatelliteId);
assert.deepEqual(planA.serving.positionTemeKm, stateA.selectedSatellite.positionTemeKm);
assert.equal(planA.serving.look.elevationDeg, planA.serving.topocentric.elevationDeg);
assert.equal(planA.serving.look.azimuthDeg, planA.serving.topocentric.azimuthDeg);
assert.ok(planA.serving.look.rangeKm > 0);
assert.ok(planA.serving.positionWorld.every(Number.isFinite));
assert.ok(VISUAL_LAB_LOCAL_TOPOCENTRIC_WORLD_UNITS_PER_KM > 0);
assert.ok(VISUAL_LAB_LOCAL_TOPOCENTRIC_MAX_RADIUS_WORLD > 0);
assert.ok(planA.serving.positionWorld.every(value => Math.abs(value) <= VISUAL_LAB_LOCAL_TOPOCENTRIC_MAX_RADIUS_WORLD));
assert.ok(planA.serving.topocentric.eastKm !== 0 || planA.serving.topocentric.northKm !== 0);
assert.equal(planA.trajectory.serving.availability, 'available');
assert.equal(planA.trajectory.serving.satelliteId, frameA.selectedSatelliteId);
assert.equal(planA.trajectory.serving.source.kind, 'frame.tleState.trajectory');
assert.equal(planA.trajectory.serving.source.frameId, frameA.frameId);
assert.equal(planA.trajectory.serving.points.length, stateA.trajectory.length);
assert.equal(planA.trajectory.candidate.availability, 'unavailable');
assert.equal(planA.trajectory.context.length, 0);
assert.equal(planA.context.limit, 24);
assert.ok(planA.context.satellites.length <= 24);
assert.equal(planA.context.availability, planA.context.satellites.length > 0 ? 'available' : 'unavailable');
assert.equal(planA.substrate.availability, 'available');
assert.equal(planA.substrate.cells.length, frameA.scenario.cells.length);
assert.equal(planA.substrate.users.length, frameA.scenario.users.length);
const expectedDisplayPlacement = buildArchivedTleSevenCellPlacement({
  cells: frameA.scenario.cells,
  sourceCellRadiusKm: frameA.scenario.topology.cellRadiusKm,
});
assert.equal(planA.substrate.cellRadiusKm, expectedDisplayPlacement.cells[0]?.radiusKm);
assert.equal(planA.substrate.worldUnitsPerKm, VISUAL_LAB_LOCAL_DEFAULT_GROUND_WORLD_UNITS_PER_KM);
assert.deepEqual(planA.substrate.cells[0]?.centerKm, frameA.scenario.cells[0]?.centerKm);
assert.deepEqual(planA.substrate.users[0]?.positionKm, frameA.scenario.users[0]?.positionKm);
assert.equal(planA.representative.availability, 'available');
if (planA.representative.availability === 'available') {
  const link = frameA.links[0]!;
  assert.equal(planA.representative.user.index, link.userIndex);
  assert.equal(planA.representative.user.userId, link.userId);
  assert.equal(planA.representative.cell.index, link.beamId);
  assert.equal(planA.representative.servingBeam.beamId, link.beamId);
  assert.equal(planA.representative.servingBeam.satelliteId, link.satelliteId);
  assert.deepEqual(
    planA.representative.user.positionWorld,
    planA.substrate.users.find(user => user.index === link.userIndex)?.positionWorld,
  );
}
assert.equal(planA.activeBeamTargets.availability, 'available');
assert.equal(planA.activeBeamTargets.source, 'frame.inputs.frame.beamActiveB + frame.scenario.cells');
assert.equal(
  planA.activeBeamTargets.targets.length,
  frameA.inputs.frame.beamActiveB.filter(Boolean).length,
);
assert.deepEqual(
  planA.activeBeamTargets.targets.map(target => target.beamId),
  frameA.inputs.frame.beamActiveB.flatMap((active, beamId) => active ? [beamId] : []),
);
assert.ok(planA.activeBeamTargets.targets.every(target => target.satelliteId === frameA.selectedSatelliteId));
assert.equal(
  planA.candidateBeamLayout.availability,
  frameA.candidateScenario === null ? 'unavailable' : 'available',
);
assert.equal(planA.candidateBeamLayout.contributesToServingInterference, false);
if (frameA.candidateScenario !== null && frameA.candidateLink !== null) {
  assert.equal(planA.candidateBeamLayout.layoutCount, frameA.candidateScenario.beamLayout.beamCount);
  assert.equal(planA.candidateBeamLayout.selectedBeamId, frameA.candidateLink.beamId);
  assert.deepEqual(
    planA.candidateBeamLayout.targets.map(target => target.beamId),
    frameA.candidateScenario.beamActiveB.flatMap((active, beamId) => active ? [beamId] : []),
  );
}
assert.equal(planA.render.schemaVersion, VISUAL_LAB_LOCAL_RENDER_SCHEMA);
assert.equal(planA.render.sourceFrameId, frameA.frameId);
assert.equal(planA.render.sourceTleFrameId, frameA.tleFrameId);
assert.equal(planA.render.beam.theta3dbRad, frameA.parameters.theta3dbRad);
assert.equal(planA.render.beam.offAxisAngleRad, frameA.links[0]?.offAxisAngleRad);
assert.equal(planA.render.beam.actualPowerW, frameA.links[0]?.actualPowerW);
assert.equal(planA.render.interference.interferenceW, frameA.links[0]?.interferenceW);
assert.equal(planA.render.interference.noiseW, frameA.links[0]?.noiseW);
assert.equal(planA.render.energy.systemPowerW, frameA.power.systemPowerW);
assert.equal(planA.render.energy.totalRateBps, frameA.throughput.totalRateBps);
assert.equal(planA.render.energy.instantaneousEeBitsPerJ, frameA.ee.instantaneousBitsPerJ);
assert.ok(planA.render.energy.dataFlowIntensity >= 0 && planA.render.energy.dataFlowIntensity <= 1);
assert.ok(planA.render.energy.efficiencyIntensity >= 0 && planA.render.energy.efficiencyIntensity <= 1);
assert.equal(planA.render.reuse.groups, frameA.parameters.frequencyReuse);
assert.equal(planA.render.reuse.groupByCell.length, frameA.scenario.cells.length);
assert.ok(planA.render.beam.coneWidthScale > 0);
assert.ok(planA.render.beam.intensity >= 0 && planA.render.beam.intensity <= 1);
assert.ok(planA.render.interference.intensity >= 0 && planA.render.interference.intensity <= 1);
assert.equal(Object.isFrozen(planA), true);
assert.equal(Object.isFrozen(planA.serving), true);
assert.equal(Object.isFrozen(planA.substrate.cells), true);
assert.equal(Object.isFrozen(planA.render), true);
assert.equal(Object.isFrozen(planA.render.beam), true);
assert.equal(Object.isFrozen(planA.render.interference), true);
assert.equal(Object.isFrozen(planA.render.energy), true);
assert.equal(Object.isFrozen(planA.render.reuse), true);

for (const point of planA.trajectory.serving.points) {
  assert.ok(point.positionWorld.every(Number.isFinite));
  assert.ok(point.positionWorld.every(value => Math.abs(value) <= VISUAL_LAB_LOCAL_TOPOCENTRIC_MAX_RADIUS_WORLD));
  assert.ok(Number.isFinite(point.topocentric.elevationDeg));
}

// The near-scene projection must consume source range and ENU height.  A
// matched look direction at a higher shell remains farther/higher; it is not
// collapsed to the homepage's fixed sky-dome radius.
const starlinkLikeTopocentric = {
  eastKm: 550 * Math.cos(Math.PI / 4),
  northKm: 0,
  upKm: 550 * Math.sin(Math.PI / 4),
  rangeKm: 550,
} as const;
const onewebLikeTopocentric = {
  eastKm: 1_200 * Math.cos(Math.PI / 4),
  northKm: 0,
  upKm: 1_200 * Math.sin(Math.PI / 4),
  rangeKm: 1_200,
} as const;
const starlinkLikeWorld = mapVisualLabLocalTopocentricToWorld(starlinkLikeTopocentric);
const onewebLikeWorld = mapVisualLabLocalTopocentricToWorld(onewebLikeTopocentric);
assert.ok(Math.hypot(...onewebLikeWorld) > Math.hypot(...starlinkLikeWorld));
assert.ok(onewebLikeWorld[1] > starlinkLikeWorld[1]);
assert.ok(onewebLikeWorld[0] > starlinkLikeWorld[0]);
assert.notDeepEqual(onewebLikeWorld, starlinkLikeWorld);

// Local vertical is apparent ENU up, not an orbital-altitude label: at the
// same range, changing elevation changes the displayed Y coordinate.
const lowElevationWorld = mapVisualLabLocalTopocentricToWorld({
  eastKm: 1_200 * Math.cos(Math.PI / 6),
  northKm: 0,
  upKm: 1_200 * Math.sin(Math.PI / 6),
  rangeKm: 1_200,
});
const highElevationWorld = mapVisualLabLocalTopocentricToWorld({
  eastKm: 1_200 * Math.cos(Math.PI / 3),
  northKm: 0,
  upKm: 1_200 * Math.sin(Math.PI / 3),
  rangeKm: 1_200,
});
assert.ok(highElevationWorld[1] > lowElevationWorld[1]);

// The common ENU scale is shared across axes/constellations and remains
// finite/bounded even for a far, above-horizon context state.
const farTopocentric = {
  eastKm: 100_000,
  northKm: -100_000,
  upKm: 100_000,
  rangeKm: Math.sqrt(3) * 100_000,
} as const;
const farWorld = mapVisualLabLocalTopocentricToWorld(farTopocentric);
assert.ok(farWorld.every(Number.isFinite));
assert.ok(Math.hypot(...farWorld) <= VISUAL_LAB_LOCAL_TOPOCENTRIC_MAX_RADIUS_WORLD + 1e-9);
assert.ok(Math.abs(farWorld[0]) <= VISUAL_LAB_LOCAL_TOPOCENTRIC_MAX_RADIUS_WORLD);
assert.ok(Math.abs(farWorld[1]) <= VISUAL_LAB_LOCAL_TOPOCENTRIC_MAX_RADIUS_WORLD);
assert.ok(Math.abs(farWorld[2]) <= VISUAL_LAB_LOCAL_TOPOCENTRIC_MAX_RADIUS_WORLD);

// No mock/synthetic fallback is accepted by this lane: the plan carries the
// real archived source identity and unmodified accepted SGP4 state.
assert.equal(planA.isMock, false);
assert.equal(planA.source.sourceKind, 'ARCHIVED_TLE');
assert.equal(planA.source.propagationModel, 'SGP4');
assert.deepEqual(planA.serving.positionTemeKm, stateA.selectedSatellite.positionTemeKm);

// Display state must remain causally tied to the accepted canonical frame:
// theta changes the beam cone, the cap changes its visible boundary, and
// frequency reuse changes the projected palette grouping.  These are display
// projections only; the adapter does not rebuild any scientific quantity.
const thetaFrame = buildSimulationAnalysisFrame(stateA, {
  ...DEFAULT_SIMULATOR_PARAMETERS,
  theta3dbRad: DEFAULT_SIMULATOR_PARAMETERS.theta3dbRad * 1.6,
});
const thetaPlan = adaptSimulationAnalysisFrameToVisualLabLocalScene(thetaFrame);
assert.notEqual(thetaPlan.render.beam.coneWidthScale, planA.render.beam.coneWidthScale);
assert.equal(thetaPlan.render.sourceFrameId, thetaFrame.frameId);

const capFrame = buildSimulationAnalysisFrame(stateA, {
  ...DEFAULT_SIMULATOR_PARAMETERS,
  beamPowerCapW: DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW * .55,
});
const capPlan = adaptSimulationAnalysisFrameToVisualLabLocalScene(capFrame);
assert.notEqual(capPlan.render.beam.powerCapW, planA.render.beam.powerCapW);
assert.notEqual(capPlan.render.beam.capBoundaryScale, planA.render.beam.capBoundaryScale);

const reuseFrame = buildSimulationAnalysisFrame(stateA, {
  ...DEFAULT_SIMULATOR_PARAMETERS,
  frequencyReuse: 5,
});
const reusePlan = adaptSimulationAnalysisFrameToVisualLabLocalScene(reuseFrame);
assert.equal(reusePlan.render.reuse.groups, 5);
assert.notDeepEqual(reusePlan.render.reuse.groupByCell, planA.render.reuse.groupByCell);

// No candidate is represented as unavailable.  The adapter must not turn the
// serving satellite into a second candidate or emit a synthetic position.
const candidateId = stateA.candidateSatellite?.satelliteId ?? null;
assert.ok(candidateId !== null);
const noCandidateFrame: SimulationAnalysisFrame = {
  ...frameA,
  tleState: { ...frameA.tleState, candidateSatellite: null },
  candidateLink: null,
  candidateComparison: {
    role: 'single-link-comparison',
    activeBeamOwnership: false,
    contributesToServingInterference: false,
    status: 'unavailable',
    satelliteId: null,
    candidateIdentityMatch: null,
    reason: 'same-instant candidate satellite is unavailable',
  },
};
const noCandidatePlan = adaptSimulationAnalysisFrameToVisualLabLocalScene(noCandidateFrame);
assert.equal(noCandidatePlan.candidate.availability, 'unavailable');
assert.equal(noCandidatePlan.candidate.satelliteId, null);
assert.equal(noCandidatePlan.satellites.some(item => item.satelliteId === noCandidatePlan.serving.satelliteId), true);
assert.equal(noCandidatePlan.satellites.length, 1 + noCandidatePlan.context.satellites.length);
assert.equal(noCandidatePlan.representative.availability, 'available');
assert.equal(noCandidatePlan.activeBeamTargets.availability, 'available');
assert.equal(noCandidatePlan.candidateBeamLayout.availability, 'unavailable');

// Serving and candidate satellites may use different complete-ring layouts.
// The candidate projection remains counterfactual, but both accepted layouts
// are now independently available to the renderer.
const heterogeneousFrame = buildSimulationAnalysisFrame(
  stateA,
  DEFAULT_SIMULATOR_PARAMETERS,
  undefined,
  {
    beamLayoutCount: 19,
    perSatelliteBeamLayoutCount: { [candidateId]: 1 },
  },
);
const heterogeneousPlan = adaptSimulationAnalysisFrameToVisualLabLocalScene(heterogeneousFrame);
assert.equal(heterogeneousPlan.substrate.cells.length, 19);
assert.equal(heterogeneousPlan.configuredBeamTargets.targets.length, 19);
assert.equal(
  heterogeneousPlan.configuredBeamTargets.targets.filter(target => target.isLoaded).length,
  heterogeneousPlan.activeBeamTargets.targets.length,
);
assert.equal(heterogeneousPlan.candidateBeamLayout.layoutCount, 1);
assert.equal(heterogeneousPlan.candidateBeamLayout.targets.length, 1);
assert.equal(heterogeneousPlan.candidateBeamLayout.displayTargets.length, 1);
assert.equal(heterogeneousPlan.candidateBeamLayout.targets[0]?.satelliteId, candidateId);

// Preserve a known candidate identity but fail closed when the accepted
// propagation frame does not retain its state.
const missingCandidateFrame: SimulationAnalysisFrame = {
  ...frameA,
  tleState: {
    ...frameA.tleState,
    propagationFrame: {
      ...frameA.tleState.propagationFrame,
      satellites: frameA.tleState.propagationFrame.satellites
        .filter(satellite => satellite.satelliteId !== candidateId),
    },
  },
};
const missingCandidatePlan = adaptSimulationAnalysisFrameToVisualLabLocalScene(missingCandidateFrame);
assert.equal(missingCandidatePlan.candidate.availability, 'unavailable');
assert.equal(missingCandidatePlan.candidate.satelliteId, candidateId);
assert.match(missingCandidatePlan.candidate.reason, /propagated state is absent/);

const noContextPlan = adaptSimulationAnalysisFrameToVisualLabLocalScene(frameA, { contextLimit: 0 });
assert.equal(noContextPlan.context.availability, 'unavailable');
assert.equal(noContextPlan.context.satellites.length, 0);
assert.equal(noContextPlan.context.reason, 'contextLimit is zero');

// A committed handover still needs the accepted pre-switch satellite pose for
// the presentation-only crossfade.  It is lifecycle evidence, not optional
// scene context, so contextLimit must never prune it.
const priorServingState = frameA.tleState.propagationFrame.satellites.find(satellite => (
  satellite.satelliteId !== frameA.selectedSatelliteId
  && satellite.satelliteId !== frameA.candidateComparison.satelliteId
));
assert.ok(priorServingState);
const committedHandoverFrame: SimulationAnalysisFrame = {
  ...frameA,
  handover: {
    anchorIndex: 1,
    instantUtc: frameA.instantUtc,
    offsetDb: 3,
    tttSec: 30,
    progressSec: 30,
    ratio: 1,
    cumulativeCount: 1,
    state: 'handover',
    event: 'inter-handover',
    reason: 'accepted test fixture commits a source-backed serving change',
    servingSatelliteId: frameA.selectedSatelliteId,
    candidateSatelliteId: frameA.candidateComparison.satelliteId,
    servingVisible: true,
    candidateVisible: true,
    servingSinrDb: frameA.links[0]?.sinrDb ?? null,
    candidateSinrDb: frameA.candidateLink?.sinrDb ?? null,
    deltaDb: 3,
    eventFromSatelliteId: priorServingState.satelliteId,
    eventToSatelliteId: frameA.selectedSatelliteId,
  },
};
const committedNoContextPlan = adaptSimulationAnalysisFrameToVisualLabLocalScene(
  committedHandoverFrame,
  { contextLimit: 0 },
);
assert.equal(committedNoContextPlan.context.satellites.length, 0);
assert.equal(
  committedNoContextPlan.satellites.some(satellite => satellite.satelliteId === priorServingState.satelliteId),
  true,
  'accepted eventFromSatelliteId survives context pruning for the crossfade',
);

// The optional next frame is already a completed accepted frame.  The adapter
// only uses the shared display interpolation helper; it never propagates here.
const instantB = '2026-08-08T12:00:05.000Z';
const selectionB = await loadTleSnapshotSelection(catalog, instantB, fetchFromPublic);
const stateB = createSimulatorTleState(selectionB, instantB);
const frameB = buildSimulationAnalysisFrame(stateB, DEFAULT_SIMULATOR_PARAMETERS);
const interpolatedPlan = adaptSimulationAnalysisFrameToVisualLabLocalScene(frameA, {
  visualNextFrame: frameB,
  visualOffsetSec: 2,
});
assert.equal(interpolatedPlan.interpolation.mode, 'between-accepted-frames');
assert.equal(interpolatedPlan.interpolation.source, 'homepageTleVisualInterpolation');
assert.equal(interpolatedPlan.interpolation.currentFrameId, frameA.frameId);
assert.equal(interpolatedPlan.interpolation.nextFrameId, frameB.frameId);
assert.equal(interpolatedPlan.interpolation.visualOffsetSec, 2);
assert.equal(interpolatedPlan.instantUtc, '2026-08-08T12:00:02.000Z');
assert.equal(interpolatedPlan.trajectory.serving.source.visualPoseInterpolation, true);

console.log('visual-lab local archived-TLE scene adapter passed');
