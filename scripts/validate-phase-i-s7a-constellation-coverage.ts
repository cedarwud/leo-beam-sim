import assert from 'node:assert/strict';
import profileJson from '../src/profiles/modqn-4sat-7beam-paper-faithful.json' with { type: 'json' };
import { elevationAngleRad } from '../src/engine/cells/cellLayout.ts';
import type { CellAssignment } from '../src/engine/cells/cellScheduler.ts';
import {
  computeTopocentricPoint,
  createObserverContext,
  generateWalkerConstellation,
  propagateOrbitElement,
} from '../src/engine/orbit';
import type { OrbitElement } from '../src/engine/orbit/types';
import type { Profile } from '../src/profiles/types';
import { MODQN_BEAMS_PER_SERVING_SATELLITE } from '../src/modqn/servingCount.ts';
import {
  DEFAULT_SERVING_COUNT,
  DISPLAY_CELL_SCHEDULE_MAX_ACTIVE_CELLS_PER_SLOT,
  computeCellScheduleViz,
} from '../src/scene/useCellSchedule.ts';

const profile = profileJson as Profile;

const MU_EARTH_KM3_S2 = 398600.4418;
const EARTH_RADIUS_KM = 6378.137;
const TWO_PI = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EPOCH_UTC_MS = Date.UTC(2025, 0, 1, 0, 0, 0);
const SAMPLE_INTERVAL_SEC = 60;
const MIN_ELEVATION_DEG = 15;
const CENTER_LAT_DEG = 40;
const CENTER_LON_DEG = 116;
const ALTITUDE_KM = 780;
const BEAMWIDTH_3DB_RAD = 2 * DEG_TO_RAD;
const WORLD_UNITS_PER_KM = 2;
const EXPECTED_POOL_SIZE = 384;
const SERVING_COUNTS = [2, 4, DEFAULT_SERVING_COUNT] as const;

const PASSED: string[] = [];
const FAILED: string[] = [];

interface RealGeoFixtureSatellite {
  readonly id: string;
  readonly latDeg: number;
  readonly lonDeg: number;
  readonly altitudeKm: number;
}

interface ServingDiagnostics {
  readonly servingCount: number;
  readonly visibleCount: number;
  readonly activeCount: number;
  readonly idleCount: number;
  readonly distinctAssignedSatCount: number;
  readonly assignedSatIds: readonly string[];
  readonly expectedTopSatIds: readonly string[];
  readonly snapshot: string;
}

function expect(condition: boolean, label: string): void {
  if (condition) {
    PASSED.push(label);
    console.log(`PASS ${String(PASSED.length).padStart(2, '0')}: ${label}`);
  } else {
    FAILED.push(label);
  }
}

function near(actual: number, expected: number, tolerance: number): boolean {
  return Math.abs(actual - expected) <= tolerance;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function finiteNumber(value: number): boolean {
  return Number.isFinite(value) && !Number.isNaN(value);
}

function serializeElements(elements: readonly OrbitElement[]): string {
  return JSON.stringify(elements.map(element => ({
    id: element.id,
    shellId: element.shellId,
    altitudeKm: element.altitudeKm,
    epochUtcMs: element.epochUtcMs,
    eccentricity: element.eccentricity,
    inclinationRad: element.inclinationRad,
    raanRad: element.raanRad,
    argPerigeeRad: element.argPerigeeRad,
    meanAnomalyRad: element.meanAnomalyRad,
    meanMotionRevPerDay: element.meanMotionRevPerDay,
  })));
}

function orbitalPeriodSec(altitudeKm: number): number {
  const semiMajorAxisKm = EARTH_RADIUS_KM + altitudeKm;
  return TWO_PI * Math.sqrt((semiMajorAxisKm ** 3) / MU_EARTH_KM3_S2);
}

function normalizedPlaneIndex(element: OrbitElement): number | null {
  const match = /-P(\d+)-S\d+$/.exec(element.id);
  return match ? Number.parseInt(match[1], 10) : null;
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function isSubset(subset: readonly string[], superset: readonly string[]): boolean {
  const supersetIds = new Set(superset);
  return subset.every(value => supersetIds.has(value));
}

function assignmentSnapshot(assignments: readonly CellAssignment[]): string {
  return JSON.stringify(assignments.map(assignment => ({
    cellId: assignment.cellId,
    satId: assignment.satId,
    satVisualIndex: assignment.satVisualIndex,
    beamIndex: assignment.beamIndex,
  })));
}

function topByCenterElevation(
  satellites: readonly RealGeoFixtureSatellite[],
  servingCount: number,
): readonly string[] {
  return satellites
    .map((satellite, visualIndex) => ({
      satellite,
      visualIndex,
      elevationRad: elevationAngleRad(
        satellite.latDeg,
        satellite.lonDeg,
        satellite.altitudeKm,
        CENTER_LAT_DEG,
        CENTER_LON_DEG,
      ),
    }))
    .filter(candidate => candidate.elevationRad > MIN_ELEVATION_DEG * DEG_TO_RAD)
    .sort((a, b) => (
      (b.elevationRad - a.elevationRad)
      || (a.visualIndex - b.visualIndex)
      || a.satellite.id.localeCompare(b.satellite.id)
    ))
    .slice(0, servingCount)
    .map(candidate => candidate.satellite.id);
}

function buildRealGeoFixture(): readonly RealGeoFixtureSatellite[] {
  const offsets: readonly [number, number][] = [
    [0, 0],
    [0.08, 0],
    [0, 0.08],
    [-0.08, 0],
    [0, -0.08],
    [0.16, 0],
    [0, 0.16],
    [-0.16, 0],
    [0, -0.16],
    [0.24, 0.08],
    [-0.24, -0.08],
    [0.08, -0.24],
  ];

  return offsets.map(([latOffsetDeg, lonOffsetDeg], index) => ({
    id: `fixture-sat-${String(index).padStart(2, '0')}`,
    latDeg: CENTER_LAT_DEG + latOffsetDeg,
    lonDeg: CENTER_LON_DEG + lonOffsetDeg,
    altitudeKm: ALTITUDE_KM,
  }));
}

function servingDiagnostics(servingCount: number, satellites: readonly RealGeoFixtureSatellite[]): ServingDiagnostics {
  const schedule = computeCellScheduleViz({
    simTimeSec: 0,
    altitudeKm: ALTITUDE_KM,
    beamwidth3dBRad: BEAMWIDTH_3DB_RAD,
    centerLatDeg: CENTER_LAT_DEG,
    centerLonDeg: CENTER_LON_DEG,
    worldUnitsPerKm: WORLD_UNITS_PER_KM,
    satellites,
    servingCount,
  });
  const assignedSatIds = sortedUnique(schedule.slot.assignments.map(assignment => assignment.satId));

  return {
    servingCount: schedule.servingCount,
    visibleCount: schedule.visibleCount,
    activeCount: schedule.slot.assignments.length,
    idleCount: schedule.slot.idleCellIds.length,
    distinctAssignedSatCount: assignedSatIds.length,
    assignedSatIds,
    expectedTopSatIds: topByCenterElevation(satellites, servingCount),
    snapshot: assignmentSnapshot(schedule.slot.assignments),
  };
}

const shell = profile.orbit.shells[0];
assert.ok(shell, 'profile has a primary shell');

const elements = generateWalkerConstellation({
  shells: [shell],
  epochUtcMs: EPOCH_UTC_MS,
  observerLatDeg: profile.orbit.observerLatDeg,
  observerLonDeg: profile.orbit.observerLonDeg,
  phaseSeed: profile.orbit.constellationSeed,
});
const secondGeneration = generateWalkerConstellation({
  shells: [shell],
  epochUtcMs: EPOCH_UTC_MS,
  observerLatDeg: profile.orbit.observerLatDeg,
  observerLonDeg: profile.orbit.observerLonDeg,
  phaseSeed: profile.orbit.constellationSeed,
});

expect(profile.orbit.observerLatDeg === CENTER_LAT_DEG, 'service center latitude is 40 deg');
expect(profile.orbit.observerLonDeg === CENTER_LON_DEG, 'service center longitude is 116 deg');
expect(shell.altitudeKm === ALTITUDE_KM, 'shell altitude remains 780 km');
expect(shell.inclinationDeg === 53, 'shell inclination is 53 deg');
expect(shell.planes === 24, 'profile declares 24 Walker planes');
expect(shell.satsPerPlane === 16, 'profile declares 16 satellites per plane');
expect(shell.planes * shell.satsPerPlane === EXPECTED_POOL_SIZE, 'profile pool P is 384 satellites');
expect(elements.length === EXPECTED_POOL_SIZE, 'constellation generation returns exactly 384 satellites');
expect(!('serviceAreaPassTargetsSec' in shell), 'profile omits serviceAreaPassTargetsSec for natural Walker path');
expect(shell.phasePerturbation === false, 'profile disables extra phase perturbation');
expect(profile.paper.includes('constellation pool P=384 Walker 53'), 'profile description documents P=384 Walker 53 deg');
expect(profile.paper.includes('serving cap L'), 'profile description documents serving cap L');
expect(
  elements.every(element => near(element.inclinationRad, 53 * DEG_TO_RAD, 1e-6)),
  'all generated satellites have 53 deg inclination',
);
expect(
  elements.every(element => element.altitudeKm === ALTITUDE_KM),
  'all generated elements preserve 780 km altitude',
);
expect(
  elements.every(element => finiteNumber(element.meanMotionRevPerDay) && element.meanMotionRevPerDay > 0),
  'all generated elements have finite positive mean motion',
);
expect(
  new Set(elements.map(element => element.id)).size === elements.length,
  'generated satellite IDs are unique',
);

const raanByPlane = new Map<number, number>();
for (const element of elements) {
  const planeIndex = normalizedPlaneIndex(element);
  if (planeIndex !== null && !raanByPlane.has(planeIndex)) {
    raanByPlane.set(planeIndex, element.raanRad);
  }
}
const distinctRaans = new Set([...raanByPlane.values()].map(raan => raan.toFixed(12)));
expect(raanByPlane.size === 24, 'generated IDs cover 24 planes');
expect(distinctRaans.size === 24, 'the 24 Walker planes have distinct RAAN values');
expect(
  serializeElements(elements) === serializeElements(secondGeneration),
  'two constellation generations with the same epoch are deterministic',
);

const observer = createObserverContext(CENTER_LAT_DEG, CENTER_LON_DEG);
const periodSec = orbitalPeriodSec(shell.altitudeKm);
expect(finiteNumber(periodSec) && periodSec > 0, 'computed orbital period is finite and positive');
expect(near(periodSec, 6027.14, 1), 'computed orbital period is about 100.5 min for 780 km');

let sampleCount = 0;
let coveredSamples = 0;
let interHoSamples = 0;
let currentGapSec = 0;
let maxCoverageGapSec = 0;
let visibleSatSum = 0;
let maxVisibleSats = 0;
let minVisibleSats = Number.POSITIVE_INFINITY;
let peakSampleSec = 0;
let allPropagatedPositionsFinite = true;
let allElevationValuesInRange = true;

for (let sampleSec = 0; sampleSec <= periodSec + 1e-9; sampleSec += SAMPLE_INTERVAL_SEC) {
  const atUtcMs = EPOCH_UTC_MS + sampleSec * 1000;
  let visibleCount = 0;

  for (const element of elements) {
    const point = propagateOrbitElement(element, atUtcMs);
    const topo = computeTopocentricPoint(observer, point.ecefKm);
    const positionValues = [
      point.latDeg,
      point.lonDeg,
      point.altKm,
      ...point.ecefKm,
      topo.elevationDeg,
      topo.azimuthDeg,
      topo.rangeKm,
    ];

    if (!positionValues.every(finiteNumber)) {
      allPropagatedPositionsFinite = false;
    }
    if (topo.elevationDeg < -90 || topo.elevationDeg > 90) {
      allElevationValuesInRange = false;
    }
    if (topo.elevationDeg > MIN_ELEVATION_DEG) {
      visibleCount += 1;
    }
  }

  sampleCount += 1;
  visibleSatSum += visibleCount;
  minVisibleSats = Math.min(minVisibleSats, visibleCount);
  if (visibleCount > maxVisibleSats) {
    maxVisibleSats = visibleCount;
    peakSampleSec = sampleSec;
  }
  if (visibleCount >= 1) {
    coveredSamples += 1;
    maxCoverageGapSec = Math.max(maxCoverageGapSec, currentGapSec);
    currentGapSec = 0;
  } else {
    currentGapSec += SAMPLE_INTERVAL_SEC;
  }
  if (visibleCount >= 2) {
    interHoSamples += 1;
  }
}

maxCoverageGapSec = Math.max(maxCoverageGapSec, currentGapSec);

const coverageFraction = coveredSamples / sampleCount;
const interHoFraction = interHoSamples / sampleCount;
const meanVisibleSats = visibleSatSum / sampleCount;

expect(sampleCount >= 90, 'sample count covers one orbital period at 60 sec cadence');
expect(allPropagatedPositionsFinite, 'no propagated position/topocentric value is NaN or infinite');
expect(allElevationValuesInRange, 'all elevation values stay within [-90, 90] deg');
expect(coveredSamples === sampleCount, `coverage is 100% (actual ${formatPercent(coverageFraction)})`);
expect(interHoFraction >= 0.90, `inter-HO feasibility >= 90% (actual ${formatPercent(interHoFraction)})`);
expect(meanVisibleSats >= DEFAULT_SERVING_COUNT, `mean visible sats >= ${DEFAULT_SERVING_COUNT} (actual ${meanVisibleSats.toFixed(3)})`);
expect(maxCoverageGapSec === 0, `max coverage gap is 0 sec (actual ${maxCoverageGapSec})`);
expect(minVisibleSats >= 1, `minimum visible count is at least 1 (actual ${minVisibleSats})`);
expect(maxVisibleSats >= DEFAULT_SERVING_COUNT, `max visible sats reaches serving default L=8 (actual ${maxVisibleSats})`);

const fixtureSatellites = buildRealGeoFixture();
const fixtureElevations = fixtureSatellites.map(satellite => elevationAngleRad(
  satellite.latDeg,
  satellite.lonDeg,
  satellite.altitudeKm,
  CENTER_LAT_DEG,
  CENTER_LON_DEG,
) / DEG_TO_RAD);
const allFixtureSatsVisible = fixtureElevations.every(elevationDeg => elevationDeg > MIN_ELEVATION_DEG);
expect(fixtureSatellites.length === 12, 'real-geo fixture contains 12 candidate satellites');
expect(allFixtureSatsVisible, 'all real-geo fixture satellites are visible to the service center');

const diagnostics = new Map(SERVING_COUNTS.map(servingCount => [
  servingCount,
  servingDiagnostics(servingCount, fixtureSatellites),
]));

for (const servingCount of SERVING_COUNTS) {
  const diag = diagnostics.get(servingCount);
  assert.ok(diag, `missing diagnostics for L=${servingCount}`);
  expect(diag.servingCount === servingCount, `L=${servingCount} schedule reports resolved servingCount=${servingCount}`);
  expect(diag.visibleCount === fixtureSatellites.length, `L=${servingCount} reports visibleCount=12 before cap`);
  const expectedDisplayActive = Math.min(
    37,
    servingCount * MODQN_BEAMS_PER_SERVING_SATELLITE,
    DISPLAY_CELL_SCHEDULE_MAX_ACTIVE_CELLS_PER_SLOT,
  );
  expect(diag.activeCount === expectedDisplayActive, `L=${servingCount} applies display-only active-cell cap`);
  expect(diag.idleCount === 37 - expectedDisplayActive, `L=${servingCount} reports display idle cells`);
  expect(isSubset(diag.assignedSatIds, diag.expectedTopSatIds), `L=${servingCount} assignments use only the top-L elevation set`);
}

const l2 = diagnostics.get(2);
const l4 = diagnostics.get(4);
const l8 = diagnostics.get(DEFAULT_SERVING_COUNT);
assert.ok(l2 && l4 && l8, 'missing serving diagnostics');

expect(isSubset(l2.expectedTopSatIds, l4.expectedTopSatIds), 'top-2 serving set is nested inside top-4');
expect(isSubset(l4.expectedTopSatIds, l8.expectedTopSatIds), 'top-4 serving set is nested inside top-8');
expect(
  l4.assignedSatIds.length === 4 && isSubset(l4.expectedTopSatIds, l4.assignedSatIds),
  'L=4 assigns all four highest-elevation satellites',
);
expect(
  l8.distinctAssignedSatCount > l4.distinctAssignedSatCount,
  'inter-HO opportunity grows: L=8 uses more distinct serving satellites than L=4',
);
expect(
  l2.expectedTopSatIds.join(',') === topByCenterElevation(fixtureSatellites, 2).join(','),
  'L=2 top-L selection is sorted by elevation desc',
);
expect(
  l4.expectedTopSatIds.join(',') === topByCenterElevation(fixtureSatellites, 4).join(','),
  'L=4 top-L selection is sorted by elevation desc',
);
expect(
  l8.expectedTopSatIds.join(',') === topByCenterElevation(fixtureSatellites, DEFAULT_SERVING_COUNT).join(','),
  'L=8 top-L selection is sorted by elevation desc',
);

for (const servingCount of SERVING_COUNTS) {
  const repeated = servingDiagnostics(servingCount, fixtureSatellites);
  const diag = diagnostics.get(servingCount);
  assert.ok(diag, `missing diagnostics for L=${servingCount}`);
  expect(repeated.snapshot === diag.snapshot, `L=${servingCount} schedule is deterministic for same input`);
}

console.log('DIAGNOSTICS validate-phase-i-s7a-constellation-coverage');
console.log(`  periodSec=${periodSec.toFixed(2)} sampleIntervalSec=${SAMPLE_INTERVAL_SEC} samples=${sampleCount}`);
console.log(`  coverage=${formatPercent(coverageFraction)} (${coveredSamples}/${sampleCount} samples >=1 sat above ${MIN_ELEVATION_DEG} deg)`);
console.log(`  interHOFeasibility=${formatPercent(interHoFraction)} (${interHoSamples}/${sampleCount} samples >=2 sats above ${MIN_ELEVATION_DEG} deg)`);
console.log(`  maxCoverageGapSec=${maxCoverageGapSec}`);
console.log(`  meanVisibleSats=${meanVisibleSats.toFixed(3)} minVisibleSats=${minVisibleSats} maxVisibleSats=${maxVisibleSats}`);
console.log(`  peakSampleSec=${peakSampleSec.toFixed(0)}`);
console.log(`  raanDeg[first6]=[${[...raanByPlane.values()].slice(0, 6).map(raan => (raan * RAD_TO_DEG).toFixed(1)).join(', ')}]`);
for (const servingCount of SERVING_COUNTS) {
  const diag = diagnostics.get(servingCount);
  assert.ok(diag, `missing diagnostics for L=${servingCount}`);
  console.log(
    `  L=${servingCount} active=${diag.activeCount} idle=${diag.idleCount}`
    + ` visible=${diag.visibleCount} distinctAssignedSats=${diag.distinctAssignedSatCount}`
    + ` assigned=[${diag.assignedSatIds.join(', ')}]`,
  );
}

if (FAILED.length > 0) {
  console.error(`validate-phase-i-s7a-constellation-coverage: FAIL (${PASSED.length}/${FAILED.length} assertions)`);
  for (const failure of FAILED) {
    console.error(`  - ${failure}`);
  }
} else {
  console.log(`validate-phase-i-s7a-constellation-coverage: PASS (${PASSED.length}/0 assertions)`);
}

assert.equal(FAILED.length, 0, `${FAILED.length} assertions failed`);
