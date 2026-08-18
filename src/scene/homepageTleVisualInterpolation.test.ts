import assert from 'node:assert/strict';
import {
  projectHomepageTleLook,
  type HomepageTleSceneFrame,
  type HomepageTleSceneSatellite,
} from './homepageTleSceneAdapter';
import {
  interpolateHomepageTleSceneFrame,
  interpolateHomepageTleSceneSatellite,
} from './homepageTleVisualInterpolation';

const startUtc = '2026-08-08T12:00:00.000Z';
const endUtc = '2026-08-08T12:00:30.000Z';

function satellite(
  satelliteId: string,
  role: HomepageTleSceneSatellite['role'],
  offset: number,
): HomepageTleSceneSatellite {
  return {
    satelliteId,
    satelliteName: `${satelliteId} name`,
    role,
    worldPosition: [10 + offset, 20 + offset, 30 + offset],
    positionTemeKm: { x: 100 + offset, y: 200 + offset, z: 300 + offset },
    velocityTemeKmPerSec: { x: 2 / 3, y: 2 / 3, z: 2 / 3 },
    look: {
      azimuthDeg: offset === 0 ? 350 : 10,
      elevationDeg: 10 + offset / 10,
      rangeKm: 1_000 + offset,
      visible: true,
    },
    tleEpochUtc: '2026-08-08T00:00:00.000Z',
    sourcePath: `public/${satelliteId}.json`,
  };
}

function sceneFrame(
  instantUtc: string,
  frameSuffix: string,
  selected: HomepageTleSceneSatellite,
  candidate: HomepageTleSceneSatellite | null,
  contextSatellites: readonly HomepageTleSceneSatellite[],
): HomepageTleSceneFrame {
  const satellites = [selected, ...(candidate === null ? [] : [candidate]), ...contextSatellites];
  return {
    frameId: `frame-${frameSuffix}`,
    tleFrameId: `tle-${frameSuffix}`,
    instantUtc,
    constellation: 'oneweb',
    identity: {
      frameId: `frame-${frameSuffix}`,
      tleFrameId: `tle-${frameSuffix}`,
      requestedInstantUtc: instantUtc,
      instantTaipei: '2026-08-08T20:00:00.000',
      constellation: 'oneweb',
      archiveDate: '2026-08-08',
      selectedSatelliteId: selected.satelliteId,
      candidateSatelliteId: candidate?.satelliteId ?? null,
      sourceKind: 'ARCHIVED_TLE',
      propagationModel: 'SGP4',
    },
    selected,
    candidate,
    contextSatellites,
    satellites,
    selectedTrajectory: [],
    telemetry: {
      propagatedSatelliteCount: satellites.length,
      renderedSatelliteCount: satellites.length,
      visibleContextSatelliteCount: contextSatellites.length,
      selectedTrajectoryPointCount: 0,
      selectedElevationDeg: selected.look.elevationDeg,
      selectedAzimuthDeg: selected.look.azimuthDeg,
      selectedRangeKm: selected.look.rangeKm,
      candidateElevationDeg: candidate?.look.elevationDeg ?? null,
    },
    earthSphere: false,
    handoverDecision: 'not-in-frame',
  };
}

const previous = satellite('sat-1', 'selected', 0);
const next = satellite('sat-1', 'selected', 20);

const atStart = interpolateHomepageTleSceneSatellite(
  previous,
  next,
  0,
  startUtc,
  endUtc,
);
assert.deepEqual(atStart, previous, '0 seconds must use the previous anchor exactly');

const atMidpoint = interpolateHomepageTleSceneSatellite(
  previous,
  next,
  15,
  startUtc,
  endUtc,
);
assert.deepEqual(atMidpoint.positionTemeKm, { x: 110, y: 210, z: 310 });
for (const velocity of Object.values(atMidpoint.velocityTemeKmPerSec)) {
  assert.ok(Math.abs(velocity - 2 / 3) < 1e-12, 'Hermite midpoint velocity stays continuous');
}
const expectedMidpointProjection = projectHomepageTleLook(
  atMidpoint.positionTemeKm,
  '2026-08-08T12:00:15.000Z',
);
assert.deepEqual(atMidpoint.worldPosition, expectedMidpointProjection.worldPosition);
assert.deepEqual(atMidpoint.look, expectedMidpointProjection.look);
assert.equal(atMidpoint.satelliteId, 'sat-1');
assert.equal(atMidpoint.role, 'selected');

const atEnd = interpolateHomepageTleSceneSatellite(
  previous,
  next,
  30,
  startUtc,
  endUtc,
);
assert.deepEqual(atEnd, next, '30 seconds must use the next anchor exactly');

const currentCandidate = satellite('sat-2', 'candidate', 0);
const nextCandidate = satellite('sat-2', 'candidate', 20);
const currentContext = satellite('sat-context', 'context', 0);
const currentOnlyContext = satellite('sat-current-only', 'context', 0);
const nextContext = satellite('sat-context', 'context', 20);
const nextOnlyContext = satellite('sat-next-only', 'context', 20);
const currentFrame = sceneFrame(
  startUtc,
  'a',
  previous,
  currentCandidate,
  [currentContext, currentOnlyContext],
);
const nextFrame = sceneFrame(
  endUtc,
  'b',
  next,
  nextCandidate,
  [nextContext, nextOnlyContext],
);

const frameAtStart = interpolateHomepageTleSceneFrame(currentFrame, nextFrame, 0);
assert.deepEqual(frameAtStart, currentFrame);

const frameAtMidpoint = interpolateHomepageTleSceneFrame(currentFrame, nextFrame, 15);
assert.equal(frameAtMidpoint.instantUtc, '2026-08-08T12:00:15.000Z');
assert.equal(frameAtMidpoint.identity.requestedInstantUtc, frameAtMidpoint.instantUtc);
assert.deepEqual(frameAtMidpoint.selected.worldPosition, expectedMidpointProjection.worldPosition);
assert.equal(frameAtMidpoint.selected.role, 'selected');
assert.deepEqual(frameAtMidpoint.candidate?.worldPosition, expectedMidpointProjection.worldPosition);
assert.equal(frameAtMidpoint.candidate?.role, 'candidate');
assert.deepEqual(
  frameAtMidpoint.contextSatellites.map(item => item.satelliteId),
  ['sat-context', 'sat-current-only'],
  'context output remains bounded to current visible identities until the next endpoint',
);
assert.equal(frameAtMidpoint.satellites.length, 4);
assert.ok(frameAtMidpoint.satellites.every(item => (
  item.role === 'selected' || item.role === 'candidate' || item.role === 'context'
)));
assert.equal(frameAtMidpoint.telemetry.renderedSatelliteCount, 4);
assert.equal(frameAtMidpoint.telemetry.visibleContextSatelliteCount, 2);

const frameAtEnd = interpolateHomepageTleSceneFrame(currentFrame, nextFrame, 30);
assert.deepEqual(frameAtEnd, nextFrame);

console.log('homepage TLE visual interpolation tests passed');
