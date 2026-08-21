#!/usr/bin/env node
import assert from 'node:assert/strict';
import { loadProfile } from '../../profiles';
import {
  ANGLE_AWARE_SEGMENT_START_POWER_W,
  angleAwareBeamKey,
  angleAwareLinkKey,
  computeAngleAwareEnergyEfficiency,
  computeAngleAwareThroughputBps,
  dbToLinear,
  resolveAngleAwarePowerState,
} from './angle-aware-ee';
import { computeLinkBudget } from './link-budget';
import type { AngleAwarePowerState, SatelliteSnapshot } from './types';

const profile = loadProfile('hobs-2024-candidate-rich');

function check(label: string, fn: () => void): void {
  fn();
  console.log(`  ok ${label}`);
}

check('C5 and C8 use the documented units', () => {
  const rate = computeAngleAwareThroughputBps(10e6, 2, 3);
  assert.ok(rate > 0);
  assert.equal(computeAngleAwareEnergyEfficiency(rate, 5), rate / 5);
});

check('each new served segment starts at 2 W', () => {
  const first = resolveAngleAwarePowerState(undefined, 4, 0.2, 1);
  assert.equal(first.powerW, ANGLE_AWARE_SEGMENT_START_POWER_W);
  assert.equal(first.segmentStartPowerW, ANGLE_AWARE_SEGMENT_START_POWER_W);
});

check('continuous served link uses the previous-step power and gain ratio', () => {
  const first = resolveAngleAwarePowerState(undefined, 4, 0.2, 1);
  const second = resolveAngleAwarePowerState(first, 5, 0.4, 0.5);
  assert.equal(second.powerW, 4);
  assert.equal(second.segmentStartPowerW, 2);
  const repeated = resolveAngleAwarePowerState(first, 4, 0.4, 0.5);
  assert.equal(repeated.powerW, first.powerW, 'same-timestamp evaluation should reuse prior power');
});

check('a link with no previous state restarts at 2 W after a continuity break', () => {
  const first = resolveAngleAwarePowerState(undefined, 4, 0.2, 1);
  const continued = resolveAngleAwarePowerState(first, 5, 0.4, 0.5);
  const restarted = resolveAngleAwarePowerState(undefined, 6, 0.4, 0.5);
  assert.equal(continued.powerW, 4);
  assert.equal(restarted.powerW, ANGLE_AWARE_SEGMENT_START_POWER_W);
});

check('angle-aware link budget exposes C1-C8 terms and total interference', () => {
  const sat: SatelliteSnapshot = {
    id: 'sat-test',
    shellId: 'shell-test',
    altitudeKm: 550,
    ecefKm: [0, 0, 0],
    rangeKm: 550,
    elevationDeg: 90,
    azimuthDeg: 0,
    beamCellsKm: [
      { beamId: 1, offsetEastKm: 0, offsetNorthKm: 0, scanAngleDeg: 0 },
      { beamId: 2, offsetEastKm: 8, offsetNorthKm: 0, scanAngleDeg: 0 },
    ],
  };
  const samples = computeLinkBudget(
    { id: 'ue-test', latDeg: 0, lonDeg: 0, offsetEastKm: 0, offsetNorthKm: 0 },
    [sat],
    {
      formulaFamily: profile.formulaFamily,
      channel: profile.channel,
      antenna: profile.antenna,
      ueAntenna: profile.ueAntenna,
      beams: profile.beams,
      activeAssignments: [
        { satId: sat.id, beamId: 1 },
        { satId: sat.id, beamId: 2 },
      ],
      simTimeSec: 0,
      angleAware: {
        previousStates: new Map<string, AngleAwarePowerState>(),
        conversionEfficiency: profile.antenna.efficiency,
        fixedPowerW: 0,
        beamLoadByKey: new Map([[angleAwareBeamKey(sat.id, 1), 1]]),
      },
    },
  );
  const serving = samples.find(sample => sample.beamId === 1);
  assert.ok(serving?.angleAware);
  const terms = serving.angleAware;
  assert.ok(terms.gammaLinear >= 0);
  assert.ok(terms.interferenceW >= 0);
  assert.ok(terms.noiseW > 0);
  assert.equal(
    terms.desiredSignalW,
    terms.powerW * terms.channelGainLinear * terms.transmitGainLinear,
  );
  assert.equal(
    terms.transmitGainLinear,
    dbToLinear(profile.antenna.maxGainDbi + serving.beamGainDb),
  );
  assert.equal(terms.powerW, ANGLE_AWARE_SEGMENT_START_POWER_W);
  assert.equal(terms.segmentStartPowerW, ANGLE_AWARE_SEGMENT_START_POWER_W);

  const previousStates = new Map<string, AngleAwarePowerState>([
    [angleAwareLinkKey('ue-test', sat.id, 1), {
      timeSec: terms.timeSec,
      thetaRad: terms.thetaRad,
      transmitGainLinear: terms.transmitGainLinear,
      powerW: terms.powerW,
      segmentStartTimeSec: terms.segmentStartTimeSec,
      segmentStartThetaRad: terms.segmentStartThetaRad,
      segmentStartTransmitGainLinear: terms.segmentStartTransmitGainLinear,
      segmentStartPowerW: terms.segmentStartPowerW,
    }],
  ]);
  const next = computeLinkBudget(
    { id: 'ue-test', latDeg: 0, lonDeg: 0, offsetEastKm: 4, offsetNorthKm: 0 },
    [sat],
    {
      formulaFamily: profile.formulaFamily,
      channel: profile.channel,
      antenna: profile.antenna,
      ueAntenna: profile.ueAntenna,
      beams: profile.beams,
      activeAssignments: [
        { satId: sat.id, beamId: 1 },
        { satId: sat.id, beamId: 2 },
      ],
      simTimeSec: 1,
      angleAware: {
        previousStates,
        conversionEfficiency: profile.antenna.efficiency,
        fixedPowerW: 0,
      },
    },
  ).find(sample => sample.beamId === 1)?.angleAware;
  assert.ok(next);
  assert.equal(next.previousPowerW, terms.powerW);
  assert.notEqual(next.powerW, terms.powerW);
  assert.notEqual(next.systemPowerW, terms.systemPowerW);
  assert.notEqual(next.energyEfficiencyBitsPerJoule, terms.energyEfficiencyBitsPerJoule);
  assert.equal(previousStates.size, 1, 'link-budget probes must not mutate the previous published-frame map');

  const restarted = computeLinkBudget(
    { id: 'ue-test', latDeg: 0, lonDeg: 0, offsetEastKm: 4, offsetNorthKm: 0 },
    [sat],
    {
      formulaFamily: profile.formulaFamily,
      channel: profile.channel,
      antenna: profile.antenna,
      ueAntenna: profile.ueAntenna,
      beams: profile.beams,
      activeAssignments: [
        { satId: sat.id, beamId: 1 },
        { satId: sat.id, beamId: 2 },
      ],
      simTimeSec: 2,
      angleAware: {
        previousStates: new Map(),
        conversionEfficiency: profile.antenna.efficiency,
        fixedPowerW: 0,
      },
    },
  ).find(sample => sample.beamId === 1)?.angleAware;
  assert.ok(restarted);
  assert.equal(restarted.powerW, ANGLE_AWARE_SEGMENT_START_POWER_W);
});

check('angle-aware live geometry uses each UE slant range and elevation', () => {
  const sat: SatelliteSnapshot = {
    id: 'geo-sat',
    shellId: 'shell-test',
    altitudeKm: 550,
    latDeg: 0,
    lonDeg: 0,
    ecefKm: [0, 0, 0],
    rangeKm: 550,
    elevationDeg: 90,
    azimuthDeg: 0,
    beamCellsKm: [{
      beamId: 1,
      offsetEastKm: 0,
      offsetNorthKm: 0,
      scanAngleDeg: 0,
      beamCenterLatDeg: 0,
      beamCenterLonDeg: 0,
    }],
  };
  const baseConfig = {
    formulaFamily: profile.formulaFamily,
    channel: profile.channel,
    antenna: profile.antenna,
    ueAntenna: profile.ueAntenna,
    beams: profile.beams,
    activeAssignments: [{ satId: sat.id, beamId: 1 }],
    simTimeSec: 0,
    angleAware: {
      previousStates: new Map<string, AngleAwarePowerState>(),
      conversionEfficiency: profile.antenna.efficiency,
      fixedPowerW: 0,
    },
  };
  const centre = computeLinkBudget(
    { id: 'centre', latDeg: 0, lonDeg: 0, offsetEastKm: 0, offsetNorthKm: 0 },
    [sat],
    baseConfig,
  )[0];
  const edge = computeLinkBudget(
    { id: 'edge', latDeg: 0, lonDeg: 0.06, offsetEastKm: 6.68, offsetNorthKm: 0 },
    [sat],
    baseConfig,
  )[0];

  assert.ok(centre?.angleAware);
  assert.ok(edge?.angleAware);
  assert.ok(edge.angleAware.distanceM > centre.angleAware.distanceM, 'UE-specific slant range is retained');
  assert.ok(edge.pathLossDb > centre.pathLossDb, 'UE-specific slant range changes path loss');
  assert.ok(edge.angleAware.thetaRad > centre.angleAware.thetaRad, 'UE-specific geometry changes theta');
});

console.log('Angle-aware EE helpers and link-budget projection pass C1-C8 checks.');
