#!/usr/bin/env node
/**
 * Focused regression for the profile-level P_t default.
 *
 * The profile field is intentionally omitted in one fixture so this proves the
 * runtime fallback, not a UI placeholder. Existing explicit profile values
 * must continue to flow through tuning, link budget, and DPC unchanged.
 */
import { computeLinkBudget } from '../engine/signal/link-budget';
import { updateBeamPowerControlStates } from '../engine/signal/power-control';
import { loadProfile } from './index';
import {
  DEFAULT_MAX_TX_POWER_DBM,
  type Profile,
} from './types';
import { createSignalTuningState } from '../signalTuning';
import type { SatelliteSnapshot, UEPosition } from '../engine/signal/types';

let passed = 0;

function check(label: string, condition: boolean): void {
  if (!condition) throw new Error(`FAIL: ${label}`);
  passed += 1;
  console.log(`  ok ${label}`);
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  check(`${label} (expected ${String(expected)}, got ${String(actual)})`, actual === expected);
}

const explicitProfile = loadProfile('hobs-2024-candidate-rich');
const { maxTxPowerDbm: _explicitPower, ...channelWithoutPower } = explicitProfile.channel;
const profileWithoutPower: Profile = {
  ...explicitProfile,
  channel: channelWithoutPower,
};

check('fixture truly omits channel.maxTxPowerDbm', !('maxTxPowerDbm' in profileWithoutPower.channel));

const ue: UEPosition = {
  latDeg: 0,
  lonDeg: 0,
  offsetEastKm: 0,
  offsetNorthKm: 0,
};
const sat: SatelliteSnapshot = {
  id: 'sat-default-probe',
  shellId: 'shell-probe',
  altitudeKm: 550,
  ecefKm: [0, 0, 6921],
  rangeKm: 550,
  elevationDeg: 90,
  azimuthDeg: 0,
  beamCellsKm: [{ beamId: 1, offsetEastKm: 0, offsetNorthKm: 0, scanAngleDeg: 0 }],
};

function sampleFor(profile: Profile) {
  const sample = computeLinkBudget(ue, [sat], {
    formulaFamily: profile.formulaFamily,
    channel: profile.channel,
    antenna: profile.antenna,
    ueAntenna: profile.ueAntenna,
    beams: profile.beams,
    activeAssignments: [{ satId: sat.id, beamId: 1 }],
    simTimeSec: 0,
  }).find(candidate => candidate.satId === sat.id && candidate.beamId === 1);
  if (!sample) throw new Error('probe beam produced no link sample');
  return sample;
}

function dpcInitialState(profile: Profile, sample: ReturnType<typeof sampleFor>) {
  const states = updateBeamPowerControlStates(
    [sample],
    new Map(),
    {
      mode: 'dpc',
      updatePeriodSec: 1,
      stepDb: 0,
      minTxPowerDbm: 0,
      sinrThresholdDb: -100,
    },
    profile.channel,
  );
  const state = states.get(`${sat.id}:1`);
  if (!state) throw new Error('DPC probe produced no state');
  return state;
}

const missingTuning = createSignalTuningState(profileWithoutPower);
const missingSample = sampleFor(profileWithoutPower);
const missingDpcState = dpcInitialState(profileWithoutPower, missingSample);

assertEqual(DEFAULT_MAX_TX_POWER_DBM, 20, 'authoritative fallback is 20 dBm');
assertEqual(missingTuning.maxTxPowerDbm, DEFAULT_MAX_TX_POWER_DBM, 'signal tuning resolves omitted P_t');
assertEqual(missingSample.txPowerDbm, DEFAULT_MAX_TX_POWER_DBM, 'link budget uses omitted P_t fallback');
assertEqual(missingDpcState.txPowerDbm, DEFAULT_MAX_TX_POWER_DBM, 'DPC uses omitted P_t fallback');

const explicitPower = explicitProfile.channel.maxTxPowerDbm;
if (explicitPower === undefined) throw new Error('candidate-rich fixture lost its explicit P_t');
const explicitTuning = createSignalTuningState(explicitProfile);
const explicitSample = sampleFor(explicitProfile);
const explicitDpcState = dpcInitialState(explicitProfile, explicitSample);

assertEqual(explicitTuning.maxTxPowerDbm, explicitPower, 'signal tuning preserves explicit P_t');
assertEqual(explicitSample.txPowerDbm, explicitPower, 'link budget preserves explicit P_t');
assertEqual(explicitDpcState.txPowerDbm, explicitPower, 'DPC preserves explicit P_t');

console.log(`\n${passed} checks passed.`);
