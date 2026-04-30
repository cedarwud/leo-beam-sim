import assert from 'node:assert/strict';
import { computeLinkBudget } from '../src/engine/signal/link-budget.ts';
import type { ActiveBeamAssignment, SatelliteSnapshot, UEPosition } from '../src/engine/signal/types.ts';
import { profileList } from '../src/profiles/index.ts';
import type { Profile } from '../src/profiles/types.ts';
import {
  applySignalTuning,
  createSignalTuningState,
  hasSignalTuningOverrides,
} from '../src/signalTuning.ts';

const RECEIVER_GAIN_OVERRIDE_DB = 7.5;
const EPSILON_DB = 1e-9;

const ue: UEPosition = {
  latDeg: 40,
  lonDeg: 116,
  offsetEastKm: 0,
  offsetNorthKm: 0,
};

const snapshots: SatelliteSnapshot[] = [
  {
    id: 'sat-a',
    shellId: 'shell-a',
    altitudeKm: 550,
    ecefKm: [0, 0, 0],
    rangeKm: 900,
    elevationDeg: 55,
    azimuthDeg: 40,
    beamCellsKm: [
      { beamId: 1, offsetEastKm: 0, offsetNorthKm: 0, scanAngleDeg: 0 },
      { beamId: 4, offsetEastKm: 8, offsetNorthKm: 0, scanAngleDeg: 2 },
    ],
  },
  {
    id: 'sat-b',
    shellId: 'shell-b',
    altitudeKm: 550,
    ecefKm: [0, 0, 0],
    rangeKm: 940,
    elevationDeg: 50,
    azimuthDeg: 150,
    beamCellsKm: [
      { beamId: 1, offsetEastKm: -7, offsetNorthKm: 3, scanAngleDeg: 3 },
    ],
  },
];

const activeAssignments: ActiveBeamAssignment[] = [
  { satId: 'sat-a', beamId: 1 },
  { satId: 'sat-a', beamId: 4 },
  { satId: 'sat-b', beamId: 1 },
];

function withReceiverGain(profile: Profile, receiverGainDbi: number): Profile {
  return {
    ...profile,
    ueAntenna: {
      ...profile.ueAntenna,
      maxGainDbi: receiverGainDbi,
    },
  };
}

function computeSamples(profile: Profile) {
  return computeLinkBudget(ue, snapshots, {
    formulaFamily: profile.formulaFamily,
    channel: profile.channel,
    antenna: profile.antenna,
    ueAntenna: profile.ueAntenna,
    beams: profile.beams,
    activeAssignments,
    simTimeSec: 120,
  });
}

function findSample(samples: ReturnType<typeof computeSamples>, satId: string, beamId: number) {
  const sample = samples.find(entry => entry.satId === satId && entry.beamId === beamId);
  assert.ok(sample, `expected ${satId}:${beamId} sample`);
  return sample;
}

function assertClose(actual: number, expected: number, message: string): void {
  assert.ok(
    Math.abs(actual - expected) <= EPSILON_DB,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

function assertDefaultProfiles(): void {
  for (const profile of profileList) {
    assert.equal(
      profile.ueAntenna.maxGainDbi,
      0,
      `${profile.id} must default ueAntenna.maxGainDbi to 0 dBi`,
    );

    const baseTuning = createSignalTuningState(profile);
    assert.equal(
      baseTuning.ueAntennaMaxGainDbi,
      0,
      `${profile.id} tuning state must start from 0 dBi receiver gain`,
    );

    assert.equal(
      hasSignalTuningOverrides(profile, baseTuning),
      false,
      `${profile.id} default receiver gain must not create a runtime override`,
    );

    const tunedProfile = applySignalTuning(profile, {
      ...baseTuning,
      ueAntennaMaxGainDbi: RECEIVER_GAIN_OVERRIDE_DB,
    });
    assert.equal(
      tunedProfile.ueAntenna.maxGainDbi,
      RECEIVER_GAIN_OVERRIDE_DB,
      `${profile.id} tuning must apply ueAntenna.maxGainDbi`,
    );
  }
}

function assertReceiverGainNumeratorOnly(): void {
  const profile = profileList.find(entry => entry.id === 'hobs-2024-paper-default');
  assert.ok(profile, 'expected hobs-2024-paper-default profile');

  const baselineProfile = withReceiverGain(profile, 0);
  const overrideProfile = withReceiverGain(profile, RECEIVER_GAIN_OVERRIDE_DB);
  const baseline = findSample(computeSamples(baselineProfile), 'sat-a', 1);
  const override = findSample(computeSamples(overrideProfile), 'sat-a', 1);

  const expectedBaselineSignalDbm =
    baseline.txPowerDbm
    + baselineProfile.antenna.maxGainDbi
    + baseline.beamGainDb
    - baseline.steeringLossDb
    - baseline.pathLossDb;

  assertClose(baseline.receiverGainDbi, 0, 'default receiver gain');
  assertClose(baseline.signalDbm, expectedBaselineSignalDbm, 'default signal preserves pre-Phase-4B behavior');
  assertClose(override.receiverGainDbi, RECEIVER_GAIN_OVERRIDE_DB, 'override receiver gain');
  assertClose(
    override.signalDbm - baseline.signalDbm,
    RECEIVER_GAIN_OVERRIDE_DB,
    'G^R-only override must shift signalDbm / numerator by X dB',
  );
  assertClose(
    override.rsrpDbm - baseline.rsrpDbm,
    RECEIVER_GAIN_OVERRIDE_DB,
    'G^R-only override must shift RSRP by X dB',
  );
  assertClose(
    override.sinrDb - baseline.sinrDb,
    RECEIVER_GAIN_OVERRIDE_DB,
    'G^R-only override must shift SINR by X dB when denominator is unchanged',
  );
  assertClose(
    override.intraInterferenceDbm,
    baseline.intraInterferenceDbm,
    'same-satellite interference must not be directly changed by G^R',
  );
  assertClose(
    override.interInterferenceDbm,
    baseline.interInterferenceDbm,
    'other-satellite interference must not be directly changed by G^R',
  );
  assertClose(override.noiseDbm, baseline.noiseDbm, 'thermal noise must not be changed by G^R');
  assertClose(
    override.denominatorDbm,
    baseline.denominatorDbm,
    'denominator aggregate must not be directly changed by G^R',
  );

  console.log(JSON.stringify({
    profileId: profile.id,
    receiverGainOverrideDb: RECEIVER_GAIN_OVERRIDE_DB,
    baseline: {
      signalDbm: baseline.signalDbm,
      intraInterferenceDbm: baseline.intraInterferenceDbm,
      interInterferenceDbm: baseline.interInterferenceDbm,
      noiseDbm: baseline.noiseDbm,
      denominatorDbm: baseline.denominatorDbm,
    },
    override: {
      signalDbm: override.signalDbm,
      intraInterferenceDbm: override.intraInterferenceDbm,
      interInterferenceDbm: override.interInterferenceDbm,
      noiseDbm: override.noiseDbm,
      denominatorDbm: override.denominatorDbm,
    },
  }, null, 2));
}

function run(): void {
  assertDefaultProfiles();
  assertReceiverGainNumeratorOnly();
  console.log('Phase 4B receiver gain validation passed.');
}

run();
