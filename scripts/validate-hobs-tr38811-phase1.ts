import assert from 'node:assert/strict';
import { computeLinkBudget } from '../src/engine/signal/link-budget.ts';
import { getLosProbabilityTr38811, sampleLosStateTr38811 } from '../src/engine/signal/los-probability.ts';
import { computeTr38811SlantRangeKm } from '../src/engine/signal/slant-range.ts';
import type { ActiveBeamAssignment, SatelliteSnapshot, UEPosition } from '../src/engine/signal/types.ts';
import { loadProfile } from '../src/profiles/index.ts';

const RESEARCH_PROFILE_ID = 'hobs-2024-tr38811-research';
const EARTH_RADIUS_KM = 6378.137;
const LOS_ENVIRONMENT = 'suburban';

function independentSlantRangeKm(elevationDeg: number, altitudeKm: number): number {
  const alphaRad = (elevationDeg * Math.PI) / 180;
  const sinAlpha = Math.sin(alphaRad);
  return Math.sqrt(
    (EARTH_RADIUS_KM * EARTH_RADIUS_KM * sinAlpha * sinAlpha)
      + (altitudeKm * altitudeKm)
      + (2 * altitudeKm * EARTH_RADIUS_KM),
  ) - (EARTH_RADIUS_KM * sinAlpha);
}

function assertClose(actual: number, expected: number, tolerance: number, label: string): void {
  const delta = Math.abs(actual - expected);
  assert.ok(
    delta <= tolerance,
    `${label}: expected ${expected}, got ${actual}, delta=${delta}`,
  );
}

function losSeedKey(satId: string, beamId: number, simTimeSec: number): string {
  return `${satId}|${beamId}|${Math.floor(simTimeSec)}`;
}

function roundSample(value: number): number {
  return Number(value.toFixed(6));
}

function buildResearchFixtureSnapshots(): SatelliteSnapshot[] {
  return [
    {
      id: 'sat-a',
      shellId: 'hobs-baseline',
      altitudeKm: 550,
      ecefKm: [0, 0, 0],
      rangeKm: computeTr38811SlantRangeKm(30, 550),
      elevationDeg: 30,
      azimuthDeg: 0,
      beamCellsKm: [
        { beamId: 1, offsetEastKm: 0, offsetNorthKm: 0, scanAngleDeg: 0 },
        { beamId: 5, offsetEastKm: 40, offsetNorthKm: 0, scanAngleDeg: 4 },
      ],
    },
    {
      id: 'sat-b',
      shellId: 'hobs-baseline',
      altitudeKm: 550,
      ecefKm: [0, 0, 0],
      rangeKm: computeTr38811SlantRangeKm(28, 550),
      elevationDeg: 28,
      azimuthDeg: 110,
      beamCellsKm: [
        { beamId: 1, offsetEastKm: 18, offsetNorthKm: 15, scanAngleDeg: 3 },
      ],
    },
    {
      id: 'sat-z',
      shellId: 'hobs-baseline',
      altitudeKm: 550,
      ecefKm: [0, 0, 0],
      rangeKm: computeTr38811SlantRangeKm(10, 550),
      elevationDeg: 10,
      azimuthDeg: 220,
      beamCellsKm: [
        { beamId: 1, offsetEastKm: -15, offsetNorthKm: -10, scanAngleDeg: 5 },
      ],
    },
  ];
}

function serializeLinkBudgetSamples(simTimeSec: number) {
  const profile = loadProfile(RESEARCH_PROFILE_ID);
  const ue: UEPosition = {
    latDeg: profile.orbit.observerLatDeg,
    lonDeg: profile.orbit.observerLonDeg,
    offsetEastKm: 0,
    offsetNorthKm: 0,
  };
  const activeAssignments: ActiveBeamAssignment[] = [
    { satId: 'sat-a', beamId: 1 },
    { satId: 'sat-a', beamId: 5 },
    { satId: 'sat-b', beamId: 1 },
    { satId: 'sat-z', beamId: 1 },
  ];
  const samples = computeLinkBudget(ue, buildResearchFixtureSnapshots(), {
    formulaFamily: profile.formulaFamily,
    channel: profile.channel,
    antenna: profile.antenna,
    beams: profile.beams,
    activeAssignments,
    simTimeSec,
  });

  return samples
    .map(sample => ({
      satId: sample.satId,
      beamId: sample.beamId,
      rsrpDbm: roundSample(sample.rsrpDbm),
      sinrDb: roundSample(sample.sinrDb),
    }))
    .sort((a, b) => a.satId.localeCompare(b.satId) || a.beamId - b.beamId);
}

function run(): void {
  const profile = loadProfile(RESEARCH_PROFILE_ID);
  assert.equal(profile.formulaFamily, 'hobs-tr38811');

  const slantRangeExpectations = [
    { elevationDeg: 5, expectedKm: 2205.895437 },
    { elevationDeg: 30, expectedKm: 992.869878 },
    { elevationDeg: 90, expectedKm: 550.0 },
  ];

  for (const { elevationDeg, expectedKm } of slantRangeExpectations) {
    const independent = independentSlantRangeKm(elevationDeg, 550);
    const actual = computeTr38811SlantRangeKm(elevationDeg, 550);
    assertClose(actual, independent, 1e-9, `independent d(alpha) check @ ${elevationDeg} deg`);
    assertClose(actual, expectedKm, 1e-6, `fixed d(alpha) check @ ${elevationDeg} deg`);
  }

  assert.equal(getLosProbabilityTr38811(34, LOS_ENVIRONMENT), 0.919);
  assert.equal(getLosProbabilityTr38811(36, LOS_ENVIRONMENT), 0.929);
  assert.equal(sampleLosStateTr38811(10, LOS_ENVIRONMENT, 'sat-a|1|60'), true);
  assert.equal(sampleLosStateTr38811(10, LOS_ENVIRONMENT, 'sat-z|1|60'), false);

  const bucketASeed = losSeedKey('sat-a', 1, 60.2);
  const bucketBSeed = losSeedKey('sat-a', 1, 60.9);
  const nextBucketSeed = losSeedKey('sat-a', 1, 61.2);
  assert.equal(bucketASeed, 'sat-a|1|60');
  assert.equal(bucketBSeed, 'sat-a|1|60');
  assert.equal(nextBucketSeed, 'sat-a|1|61');
  assert.equal(
    sampleLosStateTr38811(10, LOS_ENVIRONMENT, bucketASeed),
    sampleLosStateTr38811(10, LOS_ENVIRONMENT, bucketBSeed),
  );

  const firstSnapshot = serializeLinkBudgetSamples(60.2);
  const sameBucketSnapshot = serializeLinkBudgetSamples(60.8);
  const replayedSnapshot = serializeLinkBudgetSamples(60.2);

  assert.deepEqual(replayedSnapshot, firstSnapshot);
  assert.deepEqual(sameBucketSnapshot, firstSnapshot);

  console.log('HOBS + TR 38.811 Phase 1 validation passed.');
  console.log(JSON.stringify({
    profileId: profile.id,
    formulaFamily: profile.formulaFamily,
    slantRangeExpectations,
    losSeedExamples: {
      bucketASeed,
      bucketBSeed,
      nextBucketSeed,
    },
    snapshotAt60_2: firstSnapshot,
  }, null, 2));
}

run();
