import assert from 'node:assert/strict';
import test from 'node:test';

import { computeCanonicalEe } from '../../analysis/canonicalEe';
import { candidateLinkKey, type CandidateAssignmentDelta } from './candidateDecisionContract';
import { buildCanonicalForecastEeEvidence } from './canonicalForecastEeEvaluator';
import {
  buildWalkerCanonicalForecast,
  buildWalkerCanonicalForecastSamples,
  WalkerCanonicalForecastBuildError,
  type WalkerCanonicalForecastPolicy,
} from './walkerCanonicalForecastBuilder';
import {
  WALKER_FORECAST_GEOMETRY_MODELS,
  buildWalkerForecastFrames,
  type WalkerForecastAnchor,
  type WalkerForecastFrame,
  type WalkerScenarioState,
} from './walkerForecastFrameProvider';

const EPOCH_UTC_MS = Date.UTC(2026, 7, 29, 0, 0, 0);
const ANCHOR_UTC_MS = EPOCH_UTC_MS + 10_000;
const SAT_A = 'builder-shell-P0-S0';
const SAT_B = 'builder-shell-P0-S1';
const FROM = candidateLinkKey(SAT_A, 0);
const TO = candidateLinkKey(SAT_B, 1);
const ACTION: CandidateAssignmentDelta = {
  primaryUeId: 'ue-primary',
  from: FROM,
  to: TO,
  affectedUeIds: ['ue-primary'],
  affectedBeamKeys: [FROM, TO],
};
const POLICY: WalkerCanonicalForecastPolicy = {
  policyConfigHash: 'homepage-ee-handover-v1:builder-fixture',
  switchEventAccountingMode: 'target-once-at-horizon-start',
  activationState: 'validation-only',
};

function scenario(): WalkerScenarioState {
  return {
    profileId: 'walker-builder-test-v1',
    constellationSeed: 7,
    shells: [{
      id: 'builder-shell',
      altitudeKm: 550,
      inclinationDeg: 53,
      planes: 1,
      satsPerPlane: 2,
      phasePerturbation: false,
    }],
    observer: { latDeg: 25.1519, lonDeg: 121.7811 },
    antenna: { model: 'bessel-j1-j3', maxGainDbi: 38 },
    channel: { profileChannelId: 'builder-channel-fixture' },
    canonicalChannel: {
      receiveGainModel: 'fixed-boresight-gain-v1',
      carrierFrequencyGHz: 20,
      atmosphericCoefficientDbPerKm: 0.05,
      ricianKDb: 20,
      receiveGainDbi: 35,
    },
    beamConfiguration: { perSatellite: 2, maxActivePerSat: 1, frequencyReuse: 1 },
    beamHopping: {
      enabled: false,
      slotSec: 2.5,
      maxActiveBeamsPerSlot: 1,
      scheduler: 'round-robin',
      frameLengthSlots: 2,
      phaseSlotIndex: 0,
    },
    geometryModels: WALKER_FORECAST_GEOMETRY_MODELS,
    canonicalConfig: {
      noisePowerW: 1e-9,
      beamBandwidthHz: 10e6,
      minimumRateBps: 100_000,
      beamPowerCapW: [2, 2],
      satellitePowerCapW: 4,
      g0Linear: 10_000,
      theta3dbRad: 0.03,
      rfcPowerW: 0.338,
      basebandPerSatelliteW: 0.2,
      frameDurationS: 2.5,
      backoffDb: 5,
      etaMax: 0.35,
      trainingEnergyJByBeam: [0, 0],
      trainingIndicatorByBeam: [0, 0],
      switchEnergyJ: 0.12,
      switchIndicatorByBeam: [0, 0],
    },
    protagonistUeId: 'ue-primary',
    ues: [
      { ueId: 'ue-primary', eastKm: 0, northKm: 0, motionSource: 'frozen-former-protagonist' },
      { ueId: 'ue-other', eastKm: 1, northKm: 0.5, motionSource: 'frozen-former-protagonist' },
    ],
    beams: [
      {
        key: FROM,
        cellId: 0,
        axis: {
          axisSource: 'earth-fixed-target',
          targetLatDeg: 25.1519,
          targetLonDeg: 121.7811,
        },
        scheduled: true,
        active: true,
        load: 1,
        reuseColorIndex: 0,
        scheduleSlotIndex: 0,
      },
      {
        key: TO,
        cellId: 1,
        axis: {
          axisSource: 'earth-fixed-target',
          targetLatDeg: 25.1564,
          targetLonDeg: 121.791,
        },
        scheduled: true,
        active: true,
        load: 1,
        reuseColorIndex: 0,
        scheduleSlotIndex: 1,
      },
    ],
    servingBeamIndexByUe: [0, 1],
    laggedInterferenceWByUe: [1e-10, 2e-10],
    forecastHorizonSec: 17.5,
    forecastSampleStepSec: 2.5,
  };
}

function frames(state: WalkerScenarioState = scenario()): readonly WalkerForecastFrame[] {
  const anchor: WalkerForecastAnchor = {
    sourceFrameId: 'walker-builder-accepted-frame',
    epochToken: 'walker-builder-epoch',
    epochUtcMs: EPOCH_UTC_MS,
    simTimeMs: ANCHOR_UTC_MS,
    immutableScenarioState: state,
    policyConfigHash: POLICY.policyConfigHash,
  };
  return buildWalkerForecastFrames(anchor, Array.from(
    { length: 7 },
    (_, index) => ANCHOR_UTC_MS + index * 2_500,
  ));
}

test('builds matched causal baseline/candidate samples and valid ratio-of-sums evidence', () => {
  const walkerFrames = frames();
  const built = buildWalkerCanonicalForecast(walkerFrames, ACTION, POLICY);
  assert.equal(built.samples.length, 7);
  assert.equal(built.samples[0]!.startSimTimeMs, ANCHOR_UTC_MS);
  assert.equal(built.samples[0]!.durationSec, 2.5);
  assert.equal(built.samples[0]!.policyConfigHash, POLICY.policyConfigHash);
  assert.deepEqual(built.samples[0]!.baselineInput.config.switchIndicatorByBeam, [0, 0]);
  assert.deepEqual(built.samples[0]!.candidateInput.config.switchIndicatorByBeam, [0, 1]);
  assert.deepEqual(built.samples[1]!.candidateInput.config.switchIndicatorByBeam, [0, 0]);
  built.samples.slice(1).forEach(sample => {
    assert.deepEqual(sample.baselineInput.config.switchIndicatorByBeam, [0, 0]);
    assert.deepEqual(sample.candidateInput.config.switchIndicatorByBeam, [0, 0]);
  });
  assert.deepEqual(built.samples[0]!.baselineInput.frame.servingBeamU, [0, 1]);
  assert.deepEqual(built.samples[0]!.candidateInput.frame.servingBeamU, [1, 1]);
  assert.deepEqual(built.samples[0]!.baselineInput.frame.beamLoadB, [1, 1]);
  assert.deepEqual(built.samples[0]!.candidateInput.frame.beamLoadB, [0, 2]);
  assert.deepEqual(
    built.samples[0]!.baselineInput.frame.thetaRadUb,
    built.samples[0]!.candidateInput.frame.thetaRadUb,
  );
  assert.deepEqual(
    built.samples[0]!.baselineInput.frame.propagationGainUb,
    built.samples[0]!.candidateInput.frame.propagationGainUb,
  );

  const firstBaseline = computeCanonicalEe(built.samples[0]!.baselineInput);
  const firstCandidate = computeCanonicalEe(built.samples[0]!.candidateInput);
  assert.deepEqual(
    built.samples[1]!.baselineInput.frame.laggedInterferenceUW,
    firstBaseline.throughput.interferenceUW,
  );
  assert.deepEqual(
    built.samples[1]!.candidateInput.frame.laggedInterferenceUW,
    firstCandidate.throughput.interferenceUW,
  );

  const evidence = buildCanonicalForecastEeEvidence({
    action: ACTION,
    samples: built.samples,
    digests: built.digests,
  });
  assert.equal(evidence.status, 'valid');
  assert.equal(evidence.horizonSec, 17.5);
  assert.ok(evidence.eeBitPerJ !== null && evidence.eeBitPerJ > 0);
  assert.ok(evidence.baselineDeliveredBits !== null && evidence.baselineDeliveredBits > 0);
  assert.ok(evidence.baselineConsumedJoules !== null && evidence.baselineConsumedJoules > 0);
  assert.ok(evidence.baselineEeBitPerJ !== null && evidence.baselineEeBitPerJ > 0);
  assert.ok(evidence.relativeDelta !== null && Number.isFinite(evidence.relativeDelta));
  assert.equal(evidence.provenance?.policyConfigHash, POLICY.policyConfigHash);
  assert.equal(evidence.provenance?.switchTargetBeamIndex, 1);
  assert.equal(evidence.provenance?.switchBoundarySimTimeMs, ANCHOR_UTC_MS);
  assert.equal(Object.isFrozen(built.samples), true);
});

test('is deterministic and never mutates the Walker frame sequence', () => {
  const walkerFrames = frames();
  const before = JSON.stringify(walkerFrames);
  const first = buildWalkerCanonicalForecast(walkerFrames, ACTION, POLICY);
  const second = buildWalkerCanonicalForecast(walkerFrames, ACTION, POLICY);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(walkerFrames), before);
});

test('normalizes equivalent no-switch source config before canonical hashing', () => {
  const base = scenario();
  const { switchIndicatorByBeam: _omitted, ...canonicalConfig } = base.canonicalConfig;
  const walkerFrames = frames({ ...base, canonicalConfig });
  assert.deepEqual(walkerFrames[0]!.canonicalConfig.switchIndicatorByBeam, [0, 0]);
  const built = buildWalkerCanonicalForecast(walkerFrames, ACTION, POLICY);
  const evidence = buildCanonicalForecastEeEvidence({
    action: ACTION,
    samples: built.samples,
    digests: built.digests,
  });
  assert.equal(evidence.status, 'valid', evidence.reason ?? 'unexpected invalid evidence');
});

test('fails closed for public activation, policy drift, initial attach, and expanded unmapped actions', () => {
  const walkerFrames = frames();
  assert.throws(
    () => buildWalkerCanonicalForecastSamples(walkerFrames, ACTION, {
      ...POLICY,
      activationState: 'active',
    } as unknown as WalkerCanonicalForecastPolicy),
    /cannot activate/,
  );
  assert.throws(
    () => buildWalkerCanonicalForecastSamples(walkerFrames, ACTION, {
      ...POLICY,
      policyConfigHash: 'wrong-policy',
    }),
    /does not match/,
  );
  assert.throws(
    () => buildWalkerCanonicalForecastSamples(walkerFrames, {
      ...ACTION,
      from: null,
      affectedBeamKeys: [TO],
    }, POLICY),
    /established serving beam/,
  );
  assert.throws(
    () => buildWalkerCanonicalForecastSamples(walkerFrames, {
      ...ACTION,
      affectedUeIds: ['ue-primary', 'ue-other'],
    }, POLICY),
    /one explicitly mapped/,
  );
});

test('rejects index remapping and any active beam outside the future schedule', () => {
  const walkerFrames = frames();
  const remapped = [walkerFrames[0]!, {
    ...walkerFrames[1]!,
    beams: [...walkerFrames[1]!.beams].reverse(),
  }];
  assert.throws(
    () => buildWalkerCanonicalForecastSamples(remapped, ACTION, POLICY),
    /index mappings must remain stable/,
  );

  const unscheduled = [walkerFrames[0]!, {
    ...walkerFrames[1]!,
    beams: walkerFrames[1]!.beams.map((beam, index) => index === 1
      ? { ...beam, scheduled: false }
      : beam),
  }];
  assert.throws(
    () => buildWalkerCanonicalForecastSamples(unscheduled, ACTION, POLICY),
    (error: unknown) => error instanceof WalkerCanonicalForecastBuildError
      && /active outside/.test(error.message),
  );
});

test('rejects an intra-satellite counterfactual that exceeds the active-beam budget', () => {
  const base = scenario();
  const intraTarget = candidateLinkKey(SAT_A, 1);
  const capacityScenario: WalkerScenarioState = {
    ...base,
    beams: [
      { ...base.beams[0]!, load: 2 },
      {
        ...base.beams[1]!,
        key: intraTarget,
        active: false,
        load: 0,
      },
    ],
    servingBeamIndexByUe: [0, 0],
  };
  const anchor: WalkerForecastAnchor = {
    sourceFrameId: 'walker-builder-capacity-frame',
    epochToken: 'walker-builder-capacity-epoch',
    epochUtcMs: EPOCH_UTC_MS,
    simTimeMs: ANCHOR_UTC_MS,
    immutableScenarioState: capacityScenario,
    policyConfigHash: POLICY.policyConfigHash,
  };
  const capacityFrames = buildWalkerForecastFrames(anchor, Array.from(
    { length: 7 },
    (_, index) => ANCHOR_UTC_MS + index * 2_500,
  ));
  assert.throws(
    () => buildWalkerCanonicalForecastSamples(capacityFrames, {
      primaryUeId: 'ue-primary',
      from: FROM,
      to: intraTarget,
      affectedUeIds: ['ue-primary'],
      affectedBeamKeys: [FROM, intraTarget],
    }, POLICY),
    /above the declared limit 1/,
  );
});
