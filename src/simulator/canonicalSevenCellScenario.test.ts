#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeCanonicalEe } from '../analysis/canonicalEe';
import {
  buildCanonicalSevenCellScenario,
  CANONICAL_SEVEN_CELL_UE_COUNT,
  type CanonicalSevenCellScenarioRequest,
  type CanonicalSevenCellUserPositionOverride,
} from './canonicalSevenCellScenario';
import {
  CANONICAL_DEFAULT_RICIAN_K_DB,
  CANONICAL_DEFAULT_SATELLITE_ALTITUDE_KM,
} from './canonicalChannelAdapter';
import {
  axialHexDistance,
  DISPERSED_SEVEN_CELL_AXIAL_COORDINATES,
  RADIUS_TWO_SUBSTRATE_AXIAL_COORDINATES,
} from '../topology/dispersedSevenCellTopology';
import {
  CANONICAL_GROUND_UE_SUBSTRATE,
  CANONICAL_GROUND_UE_SUBSTRATE_ID,
} from './canonicalGroundUeSubstrate';

const SYSTEM_BANDWIDTH_HZ = 500_000_000;
const ANTENNA_NOISE_TEMPERATURE_K = 150;
const NOISE_FIGURE_DB = 1.2;
const NOISE_REFERENCE_TEMPERATURE_K = 290;

function close(actual: number, expected: number, tolerance: number, label: string): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`,
  );
}

function isInsidePointyHexagon(
  point: readonly [number, number],
  center: readonly [number, number],
  radius: number,
): boolean {
  const dx = Math.abs(point[0] - center[0]);
  const dz = Math.abs(point[1] - center[1]);
  return dx <= (Math.sqrt(3) * radius) / 2
    && dz <= radius
    && (Math.sqrt(3) * dz) + dx <= Math.sqrt(3) * radius + 1e-9;
}

function request(overrides: Partial<CanonicalSevenCellScenarioRequest> = {}): CanonicalSevenCellScenarioRequest {
  return {
    selectedLink: {
      distanceKm: 550,
      elevationDeg: 45,
    },
    beamPowerCapW: 2,
    satellitePowerCapW: 20,
    etaMax: 0.35,
    backoffDb: 5,
    rfcPowerW: 0.338,
    basebandPerSatelliteW: 0.2,
    g0Linear: 1,
    theta3dbRad: 0.2,
    channelGainScale: 1,
    carrierFrequencyGHz: 20,
    atmosphericZenithLossDb: 0.1,
    scintillationScaleDb: 0.05,
    shadowFadingMarginDb: 2,
    receiveGainDbi: 35,
    minimumRateBps: 100_000,
    systemBandwidthHz: SYSTEM_BANDWIDTH_HZ,
    frequencyReuse: 3,
    antennaNoiseTemperatureK: ANTENNA_NOISE_TEMPERATURE_K,
    noiseFigureDb: NOISE_FIGURE_DB,
    noiseReferenceTemperatureK: NOISE_REFERENCE_TEMPERATURE_K,
    ...overrides,
  };
}

test('builds the fixed seven-cell, 100-UE canonical input from TLE link geometry', () => {
  const scenario = buildCanonicalSevenCellScenario(request());
  const { input, metadata } = scenario;

  assert.equal(metadata.cells.length, 7);
  assert.equal(metadata.users.length, 100);
  assert.deepEqual(
    metadata.cells.map(({ index, q, r }) => ({ id: index, q, r })),
    [...DISPERSED_SEVEN_CELL_AXIAL_COORDINATES],
  );
  assert.deepEqual(
    metadata.cells.map(({ index, q, r }) => ({ id: index, q, r })),
    [
      { id: 0, q: 0, r: 0 },
      { id: 1, q: 2, r: 0 },
      { id: 2, q: 0, r: 2 },
      { id: 3, q: -1, r: 2 },
      { id: 4, q: -2, r: 1 },
      { id: 5, q: 0, r: -2 },
      { id: 6, q: 2, r: -2 },
    ],
    'the canonical scenario locks the irregular seven-cell coordinates',
  );
  assert.equal(new Set(metadata.cells.map(cell => `${cell.q}:${cell.r}`)).size, 7);
  for (const cell of metadata.cells) {
    assert.ok(
      RADIUS_TWO_SUBSTRATE_AXIAL_COORDINATES.some(
        substrate => substrate.q === cell.q && substrate.r === cell.r,
      ),
      `cell ${cell.index} belongs to the radius-two substrate`,
    );
  }
  let adjacentActivePairs = 0;
  for (let left = 0; left < metadata.cells.length; left += 1) {
    for (let right = left + 1; right < metadata.cells.length; right += 1) {
      if (axialHexDistance(metadata.cells[left]!, metadata.cells[right]!) === 1) {
        adjacentActivePairs += 1;
      }
    }
  }
  assert.equal(adjacentActivePairs, 1, 'the irregular layout uses one minimal adjacency exception');
  assert.deepEqual(input.frame.beamLoadB, [18, 16, 15, 14, 13, 12, 12]);
  assert.deepEqual(input.frame.beamActiveB, [true, true, true, true, true, true, true]);
  assert.deepEqual(input.frame.beamSatelliteB, [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(
    [...new Set(input.frame.servingBeamU)].sort((left, right) => left - right),
    [0, 1, 2, 3, 4, 5, 6],
    'all serving assignments reference one of the seven fixed beam IDs',
  );
  assert.equal(metadata.interSatelliteInterferenceW, 0);
  assert.deepEqual(input.frame.servingBeamU.slice(0, 19), [
    ...Array.from({ length: 18 }, () => 0),
    1,
  ]);
  assert.equal(input.frame.thetaRadUb.length, 100);
  assert.ok(input.frame.thetaRadUb.every(row => row.length === 7));
  assert.ok(input.frame.propagationGainUb.every(row => row.length === 7));
  assert.ok(input.frame.receiveGainUb.every(row => row.length === 7));
  assert.ok(input.frame.thetaRadUb.flat().every(Number.isFinite));
  assert.ok(input.frame.propagationGainUb.flat().every(value => Number.isFinite(value) && value > 0));
  assert.ok(input.frame.receiveGainUb.flat().every(value => Number.isFinite(value) && value > 0));
  for (const user of metadata.users) {
    const owner = metadata.cells.find(cell => cell.index === user.cellIndex);
    assert.ok(owner, `UE ${user.index} resolves to its owning cell`);
    assert.equal(
      isInsidePointyHexagon(user.positionKm, owner.centerKm, metadata.topology.cellRadiusKm),
      true,
      `UE ${user.index} remains inside cell ${user.cellIndex}`,
    );
  }

  const expectedBeamBandwidthHz = SYSTEM_BANDWIDTH_HZ / 3;
  const expectedSystemNoiseTemperatureK = ANTENNA_NOISE_TEMPERATURE_K
    + NOISE_REFERENCE_TEMPERATURE_K * (10 ** (NOISE_FIGURE_DB / 10) - 1);
  const expectedNoisePowerW = 1.380649e-23 * expectedSystemNoiseTemperatureK * expectedBeamBandwidthHz;
  assert.equal(input.config.beamBandwidthHz, expectedBeamBandwidthHz);
  assert.equal(input.config.noisePowerW, expectedNoisePowerW);
  assert.equal(metadata.derived.systemNoiseTemperatureK, expectedSystemNoiseTemperatureK);
  assert.equal(metadata.derived.noisePowerW, expectedNoisePowerW);

  const firstGeometry = metadata.geometryUb[0]![0]!;
  const firstChannel = metadata.channelTermsUb[0]![0]!;
  close(
    firstChannel.atmosphericLossDb,
    3 * firstGeometry.distanceKm * request().atmosphericZenithLossDb
      / (10 * CANONICAL_DEFAULT_SATELLITE_ALTITUDE_KM),
    1e-12,
    'scenario atmospheric term uses Eq. (3.9)',
  );
  close(firstChannel.ricianGain, 1, 1e-15, 'scenario deterministic Rician gain');
  assert.equal(firstChannel.ricianKDb, CANONICAL_DEFAULT_RICIAN_K_DB);
  assert.equal(firstChannel.receiveGainDbi, 35);
  close(firstChannel.propagationGain, firstChannel.largeScaleGain, 1e-30, 'scenario propagation gain is G^LS*g');

  const canonical = computeCanonicalEe(input);
  assert.equal(canonical.inputs.frame.beamLoadB.reduce((sum, load) => sum + load, 0), 100);
  assert.equal(canonical.throughput.rateUBps.length, 100);
});

test('builds complete 1 and 19 beam layouts while retaining dispersed seven-cell mode at 7', () => {
  for (const beamLayoutCount of [1, 7, 19] as const) {
    const scenario = buildCanonicalSevenCellScenario(request({ beamLayoutCount }));
    const dispersedSeven = beamLayoutCount === 7;
    assert.equal(
      scenario.metadata.scenarioId,
      dispersedSeven ? 'canonical-seven-cell-v1' : 'canonical-complete-hex-layout-v1',
    );
    assert.equal(
      scenario.metadata.ueSubstrateId,
      dispersedSeven ? 'legacy-dispersed-seven-generated-v1' : CANONICAL_GROUND_UE_SUBSTRATE_ID,
    );
    assert.match(scenario.metadata.topology.description, dispersedSeven ? /dispersed-seven-cell/ : /complete-hex-ring/);
    assert.equal(scenario.metadata.beamLayout.beamCount, beamLayoutCount);
    assert.equal(scenario.metadata.beamLayout.ringCount, dispersedSeven ? null : beamLayoutCount === 1 ? 0 : 2);
    assert.equal(scenario.metadata.cells.length, beamLayoutCount);
    assert.equal(scenario.metadata.users.length, CANONICAL_SEVEN_CELL_UE_COUNT);
    assert.equal(scenario.input.frame.beamLoadB.length, beamLayoutCount);
    assert.equal(scenario.input.frame.beamActiveB.length, beamLayoutCount);
    assert.deepEqual(
      scenario.input.frame.beamActiveB,
      scenario.input.frame.beamLoadB.map(load => load > 0),
      'beam activity is derived from the realized positive load',
    );
    assert.equal(scenario.input.frame.beamLoadB.reduce((sum, load) => sum + load, 0), CANONICAL_SEVEN_CELL_UE_COUNT);
    assert.ok(scenario.input.frame.thetaRadUb.every(row => row.length === beamLayoutCount));
    assert.ok(scenario.input.frame.propagationGainUb.every(row => row.length === beamLayoutCount));
    assert.ok(scenario.input.frame.receiveGainUb.every(row => row.length === beamLayoutCount));
    assert.equal(computeCanonicalEe(scenario.input).throughput.rateUBps.length, CANONICAL_SEVEN_CELL_UE_COUNT);
  }
});

test('explicit complete-ring layouts share all fixed ground UE IDs and positions', () => {
  const scenarios = ([1, 19] as const).map(beamLayoutCount => (
    buildCanonicalSevenCellScenario(request({ beamLayoutCount }))
  ));
  const reference = scenarios[0]!;
  const substrateIdentity = reference.metadata.ueSubstrateId;
  for (const scenario of scenarios) {
    assert.equal(scenario.metadata.ueSubstrateId, substrateIdentity);
    assert.deepEqual(
      scenario.metadata.users.map(user => user.userId),
      CANONICAL_GROUND_UE_SUBSTRATE.users.map(user => user.userId),
    );
    assert.deepEqual(
      scenario.metadata.users.map(user => user.positionKm),
      CANONICAL_GROUND_UE_SUBSTRATE.users.map(user => user.positionKm),
    );
  }
  assert.notDeepEqual(
    scenarios[0]!.input.frame.servingBeamU,
    scenarios[1]!.input.frame.servingBeamU,
    'changing the complete-ring layout may change serving beam IDs',
  );
  assert.notDeepEqual(
    scenarios[0]!.input.frame.beamLoadB,
    scenarios[1]!.input.frame.beamLoadB,
    'changing the complete-ring layout may change realized loads',
  );
});

test('complete-ring overrides are applied before angle-aware reassociation and accept another layout cell', () => {
  const baseline = buildCanonicalSevenCellScenario(request({ beamLayoutCount: 19 }));
  const outerBeamCenter = baseline.metadata.cells[7]!.centerKm;
  const moved = buildCanonicalSevenCellScenario(request({
    beamLayoutCount: 19,
    userPositionOverridesKm: [{ userIndex: 0, positionKm: outerBeamCenter }],
  }));

  assert.equal(moved.metadata.users[0]!.userId, baseline.metadata.users[0]!.userId);
  assert.deepEqual(moved.metadata.users[0]!.positionKm, outerBeamCenter);
  assert.equal(moved.metadata.users[0]!.cellIndex, 7);
  assert.notDeepEqual(moved.input.frame.beamLoadB, baseline.input.frame.beamLoadB);
  assert.deepEqual(
    moved.input.frame.beamActiveB,
    moved.input.frame.beamLoadB.map(load => load > 0),
  );
});

test('rejects partial-ring beam counts at the scenario boundary', () => {
  assert.throws(
    () => buildCanonicalSevenCellScenario(request({ beamLayoutCount: 8 as 7 })),
    /one of 1, 7, or 19/,
  );
});

test('assigns axial colors and derives bandwidth/noise for K=1, 3, and 7', () => {
  for (const frequencyReuse of [1, 3, 7]) {
    const scenario = buildCanonicalSevenCellScenario(request({ frequencyReuse }));
    const { input, metadata } = scenario;
    const expectedColors = metadata.cells.map(cell => ((cell.q - cell.r) % frequencyReuse + frequencyReuse) % frequencyReuse);
    assert.deepEqual(input.frame.beamColorB, expectedColors);
    assert.equal(input.config.beamBandwidthHz, SYSTEM_BANDWIDTH_HZ / frequencyReuse);
    assert.ok(input.config.noisePowerW > 0 && Number.isFinite(input.config.noisePowerW));
    assert.ok(metadata.derived.systemNoiseTemperatureK > 0);
    assert.equal(computeCanonicalEe(input).inputs.config.beamBandwidthHz, SYSTEM_BANDWIDTH_HZ / frequencyReuse);
  }
  assert.deepEqual(
    buildCanonicalSevenCellScenario(request({ frequencyReuse: 3 })).metadata.cells.map(cell => cell.color),
    [0, 2, 1, 0, 0, 2, 1],
    'the dispersed layout retains multiple reuse colours at K=3',
  );
});

test('keeps a serving UE closer in angle to its own beam and exposes same-satellite reuse effects', () => {
  // Use a narrow, high-gain experiment profile so the fixed local cell
  // spacing makes the co-channel effect observable rather than numerical
  // noise under the simulator's broad demo defaults.
  const angleAwareRequest = request({ g0Linear: 10_000, theta3dbRad: 0.02 });
  const fullReuse = buildCanonicalSevenCellScenario({ ...angleAwareRequest, frequencyReuse: 1 });
  const sevenColor = buildCanonicalSevenCellScenario({ ...angleAwareRequest, frequencyReuse: 7 });
  const fullReuseResult = computeCanonicalEe(fullReuse.input);
  const sevenColorResult = computeCanonicalEe(sevenColor.input);

  const centerUserAngles = fullReuse.input.frame.thetaRadUb[0]!;
  assert.equal(fullReuse.metadata.users[0]!.cellIndex, 0);
  assert.ok(centerUserAngles[0]! < centerUserAngles[1]!);
  assert.ok(fullReuseResult.throughput.interferenceUW.some(value => value > 0));
  assert.ok(sevenColorResult.throughput.interferenceUW.some(value => value > 0));
  for (let user = 0; user < sevenColor.input.frame.servingBeamU.length; user += 1) {
    const serving = sevenColor.input.frame.servingBeamU[user]!;
    const servingColor = sevenColor.input.frame.beamColorB[serving]!;
    const expected = sevenColorResult.receivedPowerUbW[user]!
      .reduce((sum, received, beam) => (
        sevenColor.input.frame.beamActiveB[beam]
        && sevenColor.input.frame.beamColorB[beam] === servingColor
          ? sum + received
          : sum
      ), 0) - sevenColorResult.receivedPowerUbW[user]![serving]!;
    assert.ok(Math.abs(expected - sevenColorResult.throughput.interferenceUW[user]!) < 1e-28);
  }
  const fullReuseInterference = fullReuseResult.throughput.interferenceUW.reduce((sum, value) => sum + value, 0);
  const sevenColorInterference = sevenColorResult.throughput.interferenceUW.reduce((sum, value) => sum + value, 0);
  assert.ok(fullReuseInterference > sevenColorInterference * 1.5);
  const rateDifference = Math.abs(
    fullReuseResult.throughput.totalRateBps - sevenColorResult.throughput.totalRateBps,
  );
  assert.ok(rateDifference > Math.max(fullReuseResult.throughput.totalRateBps, sevenColorResult.throughput.totalRateBps) * 0.01);
});

test('accepts an optional per-UE lagged interference vector without changing topology', () => {
  const lagged = Array.from({ length: 100 }, (_unused, index) => index * 1e-15);
  const scenario = buildCanonicalSevenCellScenario(request({ laggedInterferenceUW: lagged }));
  assert.deepEqual(scenario.input.frame.laggedInterferenceUW, lagged);
  assert.equal(scenario.input.frame.beamLoadB.reduce((sum, load) => sum + load, 0), 100);
});

test('keeps the default scenario bit-for-bit when no UE position override is supplied', () => {
  const implicitDefault = buildCanonicalSevenCellScenario(request());
  const explicitEmpty = buildCanonicalSevenCellScenario(request({ userPositionOverridesKm: [] }));
  assert.deepEqual(explicitEmpty, implicitDefault);
});

test('moves an existing UE through geometry and canonical outputs without changing assignment or load', () => {
  const baseline = buildCanonicalSevenCellScenario(request());
  const moved = buildCanonicalSevenCellScenario(request({
    userPositionOverridesKm: [{ userIndex: 0, positionKm: [12, 8] }],
  }));
  const baselineCanonical = computeCanonicalEe(baseline.input);
  const movedCanonical = computeCanonicalEe(moved.input);

  assert.equal(moved.metadata.users.length, baseline.metadata.users.length);
  assert.deepEqual(moved.input.frame.servingBeamU, baseline.input.frame.servingBeamU);
  assert.deepEqual(moved.input.frame.beamLoadB, baseline.input.frame.beamLoadB);
  assert.deepEqual(moved.input.frame.beamActiveB, baseline.input.frame.beamActiveB);
  assert.deepEqual(moved.input.frame.beamSatelliteB, baseline.input.frame.beamSatelliteB);
  assert.notDeepEqual(moved.metadata.users[0]?.positionKm, baseline.metadata.users[0]?.positionKm);
  assert.notEqual(moved.input.frame.thetaRadUb[0]?.[0], baseline.input.frame.thetaRadUb[0]?.[0]);
  assert.notEqual(moved.metadata.channelTermsUb[0]?.[0]?.propagationGain, baseline.metadata.channelTermsUb[0]?.[0]?.propagationGain);
  assert.notEqual(movedCanonical.throughput.rateUBps[0], baselineCanonical.throughput.rateUBps[0]);
  assert.notEqual(movedCanonical.throughput.totalRateBps, baselineCanonical.throughput.totalRateBps);
});

test('rejects invalid UE position override indices, shapes, values, and duplicates', () => {
  const invalidOverrides = [
    { userIndex: -1, positionKm: [0, 0] },
    { userIndex: CANONICAL_SEVEN_CELL_UE_COUNT, positionKm: [0, 0] },
    { userIndex: 0.5, positionKm: [0, 0] },
    { userIndex: 0, positionKm: [Number.NaN, 0] },
    { userIndex: 0, positionKm: [0, Number.POSITIVE_INFINITY] },
    { userIndex: 0, positionKm: [100, 100] },
    { userIndex: 0, positionKm: [0] },
    { userIndex: 0, positionKm: [0, 0] },
  ] as const;
  for (const invalid of invalidOverrides.slice(0, -1)) {
    assert.throws(
      () => buildCanonicalSevenCellScenario(request({
        userPositionOverridesKm: [invalid as unknown as CanonicalSevenCellUserPositionOverride],
      })),
      RangeError,
    );
  }
  assert.throws(
    () => buildCanonicalSevenCellScenario(request({
        userPositionOverridesKm: [
        invalidOverrides[7] as unknown as CanonicalSevenCellUserPositionOverride,
        invalidOverrides[7] as unknown as CanonicalSevenCellUserPositionOverride,
      ],
    })),
    /duplicate userIndex/,
  );
});
