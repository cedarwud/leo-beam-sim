import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generateWalkerConstellation,
  projectGeodeticToLocalEnuKm,
  propagateOrbitElement,
} from '../orbit';
import { mobilityStep, type UePerMobilityState } from '../ue/multiUeMobility';
import { candidateLinkKey } from './candidateDecisionContract';
import {
  WALKER_FORECAST_GEOMETRY_MODELS,
  WalkerForecastValidationError,
  buildWalkerForecastFrames,
  createWalkerForecastAnchor,
  type WalkerForecastAnchor,
  type WalkerScenarioState,
} from './walkerForecastFrameProvider';
import { resolveWalkerForecastAnchorAvailability } from './walkerForecastAnchorAvailability';

const EPOCH_UTC_MS = Date.UTC(2026, 7, 29, 0, 0, 0);
const ANCHOR_UTC_MS = EPOCH_UTC_MS + 10_000;
const SAT_A = 'test-shell-P0-S0';
const SAT_B = 'test-shell-P0-S1';

function scenario(): WalkerScenarioState {
  return {
    profileId: 'walker-forecast-test-v1',
    profileVersion: '1',
    constellationSeed: 7,
    shells: [{
      id: 'test-shell',
      altitudeKm: 550,
      inclinationDeg: 53,
      planes: 1,
      satsPerPlane: 2,
      phasePerturbation: false,
    }],
    observer: { latDeg: 25.1519, lonDeg: 121.7811, altKm: 0.02 },
    antenna: { model: 'bessel-j1-j3', maxGainDbi: 38 },
    channel: { carrierFrequencyGHz: 20, atmosphericCoefficientDbPerKm: 0.05 },
    canonicalChannel: {
      receiveGainModel: 'fixed-boresight-gain-v1',
      carrierFrequencyGHz: 20,
      atmosphericCoefficientDbPerKm: 0.05,
      ricianKDb: 20,
      receiveGainDbi: 35,
    },
    beamConfiguration: { perSatellite: 2, maxActivePerSat: 1, frequencyReuse: 2 },
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
      {
        ueId: 'ue-primary',
        eastKm: 0,
        northKm: 0,
        motionSource: 'frozen-former-protagonist',
      },
      {
        ueId: 'ue-secondary',
        eastKm: 5,
        northKm: 1,
        motionSource: 'frozen-former-protagonist',
      },
    ],
    beams: [
      {
        key: candidateLinkKey(SAT_A, 0),
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
        key: candidateLinkKey(SAT_B, 1),
        cellId: 1,
        axis: {
          axisSource: 'earth-fixed-target',
          targetLatDeg: 25.1564,
          targetLonDeg: 121.791,
        },
        scheduled: true,
        active: true,
        load: 1,
        reuseColorIndex: 1,
        scheduleSlotIndex: 1,
      },
    ],
    servingBeamIndexByUe: [0, 1],
    laggedInterferenceWByUe: [1e-10, 2e-10],
    forecastHorizonSec: 17.5,
    forecastSampleStepSec: 2.5,
  };
}

function anchor(state: WalkerScenarioState = scenario()): WalkerForecastAnchor {
  return {
    sourceFrameId: 'walker-frame-accepted-1',
    epochToken: 'walker-epoch-20260829',
    epochUtcMs: EPOCH_UTC_MS,
    simTimeMs: ANCHOR_UTC_MS,
    immutableScenarioState: state,
    policyConfigHash: 'homepage-ee-handover-v1:fixture-policy',
  };
}

const SAMPLE_TIMES = Object.freeze(Array.from(
  { length: 7 },
  (_, index) => ANCHOR_UTC_MS + index * 2_500,
));

test('captures a detached immutable anchor or a typed unavailable result, never a partial anchor', () => {
  const input = anchor();
  const captured = resolveWalkerForecastAnchorAvailability({ status: 'available', anchor: input });
  assert.equal(captured.status, 'available');
  if (captured.status !== 'available') return;
  assert.notEqual(captured.anchor, input);
  assert.notEqual(captured.anchor.immutableScenarioState, input.immutableScenarioState);
  assert.equal(Object.isFrozen(captured), true);
  assert.equal(Object.isFrozen(captured.anchor), true);
  assert.equal(Object.isFrozen(captured.anchor.immutableScenarioState.ues), true);

  const unavailable = resolveWalkerForecastAnchorAvailability({
    status: 'unavailable',
    code: 'beam-axis-missing',
    sourceFrameId: input.sourceFrameId,
    absoluteUtcMs: input.simTimeMs,
    detail: 'accepted frame does not expose a physical beam axis',
  });
  assert.deepEqual(unavailable, {
    status: 'unavailable',
    code: 'beam-axis-missing',
    sourceFrameId: input.sourceFrameId,
    absoluteUtcMs: input.simTimeMs,
    detail: 'accepted frame does not expose a physical beam axis',
  });
  assert.equal(Object.isFrozen(unavailable), true);
  assert.equal('anchor' in unavailable, false);
});

test('demotes invalid complete anchor facts and unsupported hopping to typed unavailable', () => {
  const invalid = resolveWalkerForecastAnchorAvailability({
    status: 'available',
    anchor: { ...anchor(), simTimeMs: Number.MAX_SAFE_INTEGER + 1 },
  });
  assert.equal(invalid.status, 'unavailable');
  if (invalid.status !== 'unavailable') return;
  assert.equal(invalid.code, 'invalid-anchor-facts');
  assert.equal(invalid.sourceFrameId, 'walker-frame-accepted-1');
  assert.equal(invalid.absoluteUtcMs, null);
  assert.match(invalid.detail, /safe integer/);

  const base = scenario();
  const hopping = resolveWalkerForecastAnchorAvailability({
    status: 'available',
    anchor: anchor({
      ...base,
      beamHopping: { ...base.beamHopping, enabled: true },
    }),
  });
  assert.equal(hopping.status, 'unavailable');
  if (hopping.status !== 'unavailable') return;
  assert.equal(hopping.code, 'unsupported-beam-hopping');
  assert.match(hopping.detail, /beam-hopping forecast semantics are not implemented/);

  assert.throws(() => resolveWalkerForecastAnchorAvailability({
    status: 'unavailable',
    code: 'source-frame-missing',
    sourceFrameId: '',
    absoluteUtcMs: null,
    detail: 'missing source frame',
  }), /sourceFrameId/);
  assert.throws(() => resolveWalkerForecastAnchorAvailability({
    status: 'unavailable',
    code: 'absolute-time-missing',
    sourceFrameId: null,
    absoluteUtcMs: Number.MAX_SAFE_INTEGER + 1,
    detail: 'invalid time',
  }), /absoluteUtcMs/);
});

test('strict anchor construction remains available to offline callers', () => {
  const created = createWalkerForecastAnchor(anchor());
  assert.equal(Object.isFrozen(created), true);
  assert.throws(
    () => createWalkerForecastAnchor({ ...anchor(), sourceFrameId: '' }),
    (error: unknown) => error instanceof WalkerForecastValidationError
      && error.code === 'INVALID_ANCHOR',
  );
  assert.throws(
    () => createWalkerForecastAnchor({ ...anchor(), epochUtcMs: -1, simTimeMs: -1 }),
    /must be non-negative/,
  );
});

test('builds deterministic immutable future frames from direct Walker propagation', () => {
  const input = anchor();
  const inputBefore = JSON.stringify(input);
  const first = buildWalkerForecastFrames(input, SAMPLE_TIMES);
  const second = buildWalkerForecastFrames(input, SAMPLE_TIMES);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(input), inputBefore, 'the provider must not mutate its accepted anchor');
  assert.equal(first.length, 7);
  assert.equal(first[0]?.absoluteUtcMs, ANCHOR_UTC_MS);
  assert.equal(first[1]?.absoluteUtcMs, ANCHOR_UTC_MS + 2_500);
  assert.equal(first[0]?.policyConfigHash, input.policyConfigHash);
  assert.ok(first[0]?.sourceFrameId.includes(String(ANCHOR_UTC_MS)));
  assert.notDeepEqual(
    first[0]?.satellites[0]?.orbitPoint.ecefKm,
    first[1]?.satellites[0]?.orbitPoint.ecefKm,
    'direct propagation must advance the satellite state',
  );

  const element = generateWalkerConstellation({
    shells: [...input.immutableScenarioState.shells],
    epochUtcMs: input.epochUtcMs,
    observerLatDeg: input.immutableScenarioState.observer.latDeg,
    observerLonDeg: input.immutableScenarioState.observer.lonDeg,
    phaseSeed: input.immutableScenarioState.constellationSeed,
  }).find(value => value.id === SAT_A);
  assert.ok(element);
  assert.deepEqual(
    first[0]?.satellites.find(value => value.satelliteId === SAT_A)?.orbitPoint,
    propagateOrbitElement(element, ANCHOR_UTC_MS),
  );
  assert.ok(Number.isFinite(first[0]?.satellites[0]?.topocentric.elevationDeg));
  assert.ok(Math.abs(Math.hypot(...first[0]!.beams[0]!.axis.axisEcefUnit) - 1) < 1e-9);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first[0]!.satellites[0]!.orbitPoint.ecefKm), true);
  assert.equal(JSON.stringify(first).includes('groundX'), false, 'render coordinates must not leak into forecast frames');
  assert.throws(() => {
    (first[0]!.satellites[0]!.orbitPoint.ecefKm as number[])[0] = 0;
  }, TypeError);
});

test('constellationSeed deterministically changes phase-perturbed Walker geometry', () => {
  const base = scenario();
  const seededScenario = (constellationSeed: number): WalkerScenarioState => ({
    ...base,
    constellationSeed,
    shells: base.shells.map(shell => ({ ...shell, phasePerturbation: true })),
  });
  const first = buildWalkerForecastFrames(anchor(seededScenario(0)), SAMPLE_TIMES);
  const second = buildWalkerForecastFrames(anchor(seededScenario(1)), SAMPLE_TIMES);
  assert.notDeepEqual(
    first[0]!.satellites[0]!.orbitPoint.ecefKm,
    second[0]!.satellites[0]!.orbitPoint.ecefKm,
  );
  assert.notEqual(first[0]!.scenarioStateHash, second[0]!.scenarioStateHash);
});

test('fails closed for relative, off-grid, incomplete, and out-of-horizon sample requests', () => {
  const input = anchor();
  const cases: readonly (readonly number[])[] = [
    SAMPLE_TIMES.map((value, index) => index === 0 ? 0 : value),
    [ANCHOR_UTC_MS],
    SAMPLE_TIMES.map((value, index) => index === 1 ? ANCHOR_UTC_MS + 2_000 : value),
    SAMPLE_TIMES.map((value, index) => index === 6 ? ANCHOR_UTC_MS + 17_500 : value),
  ];
  for (const sampleTimes of cases) {
    assert.throws(
      () => buildWalkerForecastFrames(input, sampleTimes),
      (error: unknown) => error instanceof WalkerForecastValidationError
        && error.code === 'INVALID_REQUEST_TIME',
    );
  }
  assert.throws(
    () => buildWalkerForecastFrames({
      ...input,
      simTimeMs: Number.MAX_SAFE_INTEGER + 1,
    }, SAMPLE_TIMES),
    (error: unknown) => error instanceof WalkerForecastValidationError
      && error.code === 'INVALID_ANCHOR'
      && /safe integer/.test(error.message),
  );
});

test('rejects geometry-model hash drift and malformed sampled-axis provenance', () => {
  const base = scenario();
  assert.throws(
    () => buildWalkerForecastFrames(anchor({
      ...base,
      geometryModels: { ...base.geometryModels, geometryModelHash: 'invented-geometry' },
    }), SAMPLE_TIMES),
    /geometryModelHash/,
  );

  const sampledBeam = {
    ...base.beams[1]!,
    axis: {
      axisSource: 'accepted-sampled-axis' as const,
      axisEcefUnit: [0, 0, -1] as const,
      axisSourceFrameId: 'walker-frame-accepted-1',
      axisSampleBucketId: 'bucket-4',
    },
  };
  const sampledAxis = sampledBeam.axis;
  const singleSampleScenario: WalkerScenarioState = {
    ...base,
    forecastHorizonSec: 2.5,
    beams: [base.beams[0]!, sampledBeam],
  };
  assert.equal(
    buildWalkerForecastFrames(anchor(singleSampleScenario), [ANCHOR_UTC_MS])[0]!.beams[1]!.axis.axisSource,
    'accepted-sampled-axis',
  );
  for (const axis of [
    { ...sampledAxis, axisEcefUnit: [0, 0, -2] as const },
    { ...sampledAxis, axisSourceFrameId: '' },
    { ...sampledAxis, axisSampleBucketId: '' },
  ]) {
    assert.throws(() => buildWalkerForecastFrames(anchor({
      ...singleSampleScenario,
      beams: [base.beams[0]!, { ...sampledBeam, axis }],
    }), [ANCHOR_UTC_MS]));
  }
  assert.throws(() => buildWalkerForecastFrames(anchor({
    ...singleSampleScenario,
    beams: [base.beams[0]!, {
      ...sampledBeam,
      axis: { ...sampledAxis, axisSourceFrameId: 'another-accepted-frame' },
    }],
  }), [ANCHOR_UTC_MS]), /must match anchor.sourceFrameId/);
  assert.throws(
    () => buildWalkerForecastFrames(anchor({
      ...base,
      beams: [base.beams[0]!, sampledBeam],
    }), SAMPLE_TIMES),
    /cannot be extrapolated across a multi-sample forecast/,
  );
});

test('rejects a hopping slot budget larger than the physical active-beam budget', () => {
  const base = scenario();
  assert.throws(
    () => buildWalkerForecastFrames(anchor({
      ...base,
      beamHopping: {
        ...base.beamHopping,
        enabled: true,
        maxActiveBeamsPerSlot: 2,
      },
    }), SAMPLE_TIMES),
    /cannot exceed beamConfiguration.maxActivePerSat/,
  );
});

test('fails closed instead of treating frozen anchor loads as a hopping forecast', () => {
  const base = scenario();
  assert.throws(
    () => buildWalkerForecastFrames(anchor({
      ...base,
      beamHopping: { ...base.beamHopping, enabled: true },
    }), SAMPLE_TIMES),
    (error: unknown) => error instanceof WalkerForecastValidationError
      && error.code === 'UNSUPPORTED_BEAM_HOPPING'
      && /beam-hopping forecast semantics are not implemented/.test(error.message),
  );
});

test('requires protagonist waypoint replay to be continuous with the accepted anchor position', () => {
  const base = scenario();
  const waypoints = [
    { timeSec: 0, latDeg: base.observer.latDeg, lonDeg: base.observer.lonDeg },
    { timeSec: 20, latDeg: base.observer.latDeg + 0.02, lonDeg: base.observer.lonDeg + 0.04 },
  ];
  const expectedGeo = {
    latDeg: base.observer.latDeg + 0.01,
    lonDeg: base.observer.lonDeg + 0.02,
  };
  const expectedLocal = projectGeodeticToLocalEnuKm(base.observer, expectedGeo);
  const waypointScenario = (eastKm: number, northKm: number): WalkerScenarioState => ({
    ...base,
    ues: [{
      ...base.ues[0]!,
      eastKm,
      northKm,
      motionSource: 'protagonist-waypoints',
      waypoints,
    }, base.ues[1]!],
  });
  assert.throws(
    () => buildWalkerForecastFrames(anchor(waypointScenario(0, 0)), SAMPLE_TIMES),
    /must match waypoint replay/,
  );
  const frames = buildWalkerForecastFrames(
    anchor(waypointScenario(expectedLocal.eastKm, expectedLocal.northKm)),
    SAMPLE_TIMES,
  );
  assert.ok(Math.abs(frames[0]!.ues[0]!.eastKm - expectedLocal.eastKm) < 1e-9);
  assert.ok(Math.abs(frames[0]!.ues[0]!.northKm - expectedLocal.northKm) < 1e-9);
});

test('advances a secondary mobility cursor sequentially from the accepted anchor', () => {
  const base = scenario();
  const mobilityState: UePerMobilityState = {
    ueIndex: 1,
    rngState: 12345,
    lastDirectionRad: 0,
    waypointIndex: 0,
    waypoints: [],
    manhattanHeading: 'east',
    manhattanInitialized: false,
    currentPosition: {
      id: 'ue-secondary',
      eastKm: 5,
      northKm: 1,
      groundX: 5,
      groundZ: -1,
    },
    originEastKm: 0,
    originNorthKm: 0,
    ueWorldScale: 1,
  };
  const mobile: WalkerScenarioState = {
    ...base,
    ues: [base.ues[0]!, {
      ueId: 'ue-secondary',
      eastKm: 5,
      northKm: 1,
      motionSource: 'secondary-integrator',
      mobilityMode: 'random-walk',
      mobilityParams: { speedKmPerSec: 0.5, waypointCount: 4, manhattanGridSpacingKm: 5 },
      mobilityState,
      footprintRadiusKm: 100,
    }],
  };
  const frames = buildWalkerForecastFrames(anchor(mobile), SAMPLE_TIMES);
  const expected = mobilityStep(
    mobilityState.currentPosition!,
    mobilityState,
    'random-walk',
    mobile.ues[1]!.mobilityParams!,
    2.5,
    100,
  );
  assert.equal(frames[0]!.ues[1]!.eastKm, 5, 'the boundary sample must not advance motion early');
  assert.equal(frames[0]!.ues[1]!.northKm, 1);
  assert.equal(frames[1]!.ues[1]!.eastKm, expected.position.eastKm);
  assert.equal(frames[1]!.ues[1]!.northKm, expected.position.northKm);
  assert.notEqual(frames[0]!.ues[1]!.motionStateDigest, frames[1]!.ues[1]!.motionStateDigest);
});
