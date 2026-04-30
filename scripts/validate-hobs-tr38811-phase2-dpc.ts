import assert from 'node:assert/strict';
import { computeLinkBudget } from '../src/engine/signal/link-budget.ts';
import {
  buildBeamPowerOverrideDbmByKey,
  updateBeamPowerControlStates,
} from '../src/engine/signal/power-control.ts';
import { computeTr38811SlantRangeKm } from '../src/engine/signal/slant-range.ts';
import type { ActiveBeamAssignment, SatelliteSnapshot, UEPosition } from '../src/engine/signal/types.ts';
import { loadProfile } from '../src/profiles/index.ts';

const RESEARCH_PROFILE_ID = 'hobs-2024-tr38811-research';
const LEGACY_PROFILE_ID = 'hobs-2024-paper-default';

function roundValue(value: number): number {
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
        { beamId: 4, offsetEastKm: 40, offsetNorthKm: 0, scanAngleDeg: 4 },
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

function buildResearchFixtureAssignments(): ActiveBeamAssignment[] {
  return [
    { satId: 'sat-a', beamId: 1 },
    { satId: 'sat-a', beamId: 4 },
    { satId: 'sat-b', beamId: 1 },
    { satId: 'sat-z', beamId: 1 },
  ];
}

function computeFixtureSamples(
  profileId: string,
  beamPowerOverrideDbmByKey?: ReadonlyMap<string, number>,
) {
  const profile = loadProfile(profileId);
  const ue: UEPosition = {
    latDeg: profile.orbit.observerLatDeg,
    lonDeg: profile.orbit.observerLonDeg,
    offsetEastKm: 0,
    offsetNorthKm: 0,
  };

  return computeLinkBudget(ue, buildResearchFixtureSnapshots(), {
    formulaFamily: profile.formulaFamily,
    channel: profile.channel,
    antenna: profile.antenna,
    ueAntenna: profile.ueAntenna,
    beams: profile.beams,
    activeAssignments: buildResearchFixtureAssignments(),
    simTimeSec: 60.2,
    beamPowerOverrideDbmByKey,
  }).sort((a, b) => a.satId.localeCompare(b.satId) || a.beamId - b.beamId);
}

function serializeSamples(samples: ReturnType<typeof computeFixtureSamples>) {
  return samples.map(sample => ({
    satId: sample.satId,
    beamId: sample.beamId,
    rsrpDbm: roundValue(sample.rsrpDbm),
    sinrDb: roundValue(sample.sinrDb),
  }));
}

function runDpcSequence() {
  const researchProfile = loadProfile(RESEARCH_PROFILE_ID);
  const powerControl = researchProfile.channel.beamPowerControl;
  assert.ok(powerControl, 'research profile should enable beamPowerControl');
  assert.equal(powerControl.mode, 'dpc');

  const baselineSamples = computeFixtureSamples(RESEARCH_PROFILE_ID);
  const afterFirstBucket = updateBeamPowerControlStates(
    baselineSamples,
    new Map(),
    powerControl,
    researchProfile.channel,
  );
  const afterSecondBucket = updateBeamPowerControlStates(
    baselineSamples,
    afterFirstBucket,
    powerControl,
    researchProfile.channel,
  );
  const beamPowerOverrideDbmByKey = buildBeamPowerOverrideDbmByKey(afterSecondBucket);
  const dpcSamples = computeFixtureSamples(RESEARCH_PROFILE_ID, beamPowerOverrideDbmByKey);

  return {
    baselineSamples,
    dpcSamples,
    beamPowerOverrideDbmByKey,
  };
}

function run(): void {
  const researchProfile = loadProfile(RESEARCH_PROFILE_ID);
  const legacyProfile = loadProfile(LEGACY_PROFILE_ID);
  assert.equal(researchProfile.formulaFamily, 'hobs-tr38811');
  assert.equal(legacyProfile.formulaFamily, 'hobs-legacy');
  assert.equal(legacyProfile.channel.beamPowerControl, undefined);

  const firstRun = runDpcSequence();
  const secondRun = runDpcSequence();

  const firstBaselineSerialized = serializeSamples(firstRun.baselineSamples);
  const firstDpcSerialized = serializeSamples(firstRun.dpcSamples);
  const secondBaselineSerialized = serializeSamples(secondRun.baselineSamples);
  const secondDpcSerialized = serializeSamples(secondRun.dpcSamples);
  const firstOverridesSerialized = [...firstRun.beamPowerOverrideDbmByKey.entries()]
    .map(([key, value]) => [key, roundValue(value)] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const secondOverridesSerialized = [...secondRun.beamPowerOverrideDbmByKey.entries()]
    .map(([key, value]) => [key, roundValue(value)] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));

  assert.deepEqual(secondBaselineSerialized, firstBaselineSerialized);
  assert.deepEqual(secondDpcSerialized, firstDpcSerialized);
  assert.deepEqual(secondOverridesSerialized, firstOverridesSerialized);

  const baselineServing = firstBaselineSerialized.find(sample => sample.satId === 'sat-a' && sample.beamId === 1);
  const baselinePeer = firstBaselineSerialized.find(sample => sample.satId === 'sat-a' && sample.beamId === 4);
  const dpcServing = firstDpcSerialized.find(sample => sample.satId === 'sat-a' && sample.beamId === 1);
  const dpcPeer = firstDpcSerialized.find(sample => sample.satId === 'sat-a' && sample.beamId === 4);
  assert.ok(baselineServing && baselinePeer && dpcServing && dpcPeer, 'expected fixture samples missing');

  const servingOverride = firstRun.beamPowerOverrideDbmByKey.get('sat-a:1');
  const weakOverride = firstRun.beamPowerOverrideDbmByKey.get('sat-z:1');
  assert.equal(roundValue(servingOverride ?? NaN), 49.5);
  assert.equal(roundValue(weakOverride ?? NaN), 50);
  assert.equal(roundValue(baselineServing.rsrpDbm - dpcServing.rsrpDbm), 0.5);
  assert.ok(dpcPeer.sinrDb > baselinePeer.sinrDb, 'reduced peer interference should improve sat-a:4 SINR');

  console.log('HOBS + TR 38.811 Phase 2 DPC validation passed.');
  console.log(JSON.stringify({
    profileId: researchProfile.id,
    formulaFamily: researchProfile.formulaFamily,
    overridesAfterTwoBuckets: Object.fromEntries(firstOverridesSerialized),
    baselineSamples: firstBaselineSerialized,
    dpcSamples: firstDpcSerialized,
  }, null, 2));
}

run();
