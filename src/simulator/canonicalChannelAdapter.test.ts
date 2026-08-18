#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  CANONICAL_DEFAULT_ATMOSPHERIC_COEFFICIENT_DB_PER_KM,
  CANONICAL_DEFAULT_CARRIER_FREQUENCY_GHZ,
  CANONICAL_DEFAULT_RECEIVE_GAIN_DBI,
  CANONICAL_DEFAULT_RICIAN_K_DB,
  CANONICAL_DEFAULT_SATELLITE_ALTITUDE_KM,
  atmosphericLossDb,
  deriveCanonicalChannelTerms,
  normalizedRicianPowerGain,
  receiveGainDbiForSeparation,
  receiveGainDbiToLinear,
  type CanonicalChannelParameters,
} from './canonicalChannelAdapter';
import { computeFsplDb } from '../engine/signal/path-loss';

const defaults: CanonicalChannelParameters = {
  carrierFrequencyGHz: CANONICAL_DEFAULT_CARRIER_FREQUENCY_GHZ,
  atmosphericCoefficientDbPerKm: CANONICAL_DEFAULT_ATMOSPHERIC_COEFFICIENT_DB_PER_KM,
  satelliteAltitudeKm: CANONICAL_DEFAULT_SATELLITE_ALTITUDE_KM,
  ricianKDb: CANONICAL_DEFAULT_RICIAN_K_DB,
  receiveGainDbi: CANONICAL_DEFAULT_RECEIVE_GAIN_DBI,
};

function close(actual: number, expected: number, tolerance: number, label: string): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`,
  );
}

const distanceKm = 1_000;
const elevationDeg = 30;
const reference = deriveCanonicalChannelTerms(distanceKm, elevationDeg, defaults);
const expectedFsplDb = 92.45
  + 20 * Math.log10(distanceKm)
  + 20 * Math.log10(CANONICAL_DEFAULT_CARRIER_FREQUENCY_GHZ);
const expectedAtmosphericDb = 3
  * distanceKm
  * CANONICAL_DEFAULT_ATMOSPHERIC_COEFFICIENT_DB_PER_KM
  / (10 * CANONICAL_DEFAULT_SATELLITE_ALTITUDE_KM);
const expectedPathLossDb = expectedFsplDb + expectedAtmosphericDb;

close(reference.freeSpacePathLossDb, expectedFsplDb, 1e-12, 'Eq. (3.8) FSPL');
close(reference.freeSpacePathLossDb, computeFsplDb(distanceKm, 20), 1e-12, 'shared FSPL parity');
close(reference.atmosphericLossDb, expectedAtmosphericDb, 1e-12, 'Eq. (3.9) atmospheric loss');
close(reference.pathLossDb, expectedPathLossDb, 1e-12, 'total large-scale path loss');
close(reference.largeScaleGain, 10 ** (-expectedPathLossDb / 10), 1e-30, 'G^LS');
close(reference.ricianGain, 1, 1e-15, 'deterministic normalised Rician g');
assert.equal(reference.ricianKDb, CANONICAL_DEFAULT_RICIAN_K_DB);
close(reference.propagationGain, reference.largeScaleGain * reference.ricianGain, 1e-30, 'G^LS*g');

// Eq. (3.9) depends on range and altitude, not elevation or the retired
// zenith/sin(elevation) approximation.
close(
  deriveCanonicalChannelTerms(distanceKm, 5, defaults).pathLossDb,
  deriveCanonicalChannelTerms(distanceKm, 80, defaults).pathLossDb,
  1e-12,
  'atmospheric loss is elevation-independent in Eq. (3.9)',
);
close(
  atmosphericLossDb(2_000, CANONICAL_DEFAULT_ATMOSPHERIC_COEFFICIENT_DB_PER_KM),
  expectedAtmosphericDb * 2,
  1e-12,
  'atmospheric loss scales with range',
);

const doubledFrequency = deriveCanonicalChannelTerms(distanceKm, elevationDeg, {
  ...defaults,
  carrierFrequencyGHz: defaults.carrierFrequencyGHz! * 2,
});
close(
  doubledFrequency.pathLossDb - reference.pathLossDb,
  20 * Math.log10(2),
  1e-12,
  'frequency doubling loss',
);
close(
  doubledFrequency.propagationGain / reference.propagationGain,
  0.25,
  1e-12,
  'frequency doubling linear gain ratio',
);

// The formal path excludes the old scintillation, shadow, and s_H controls.
const legacyExtensionsChanged = deriveCanonicalChannelTerms(distanceKm, elevationDeg, {
  ...defaults,
  scintillationScaleDb: 99,
  shadowFadingMarginDb: 99,
  channelGainScale: 99,
});
close(legacyExtensionsChanged.pathLossDb, reference.pathLossDb, 1e-12, 'legacy loss terms excluded');
close(legacyExtensionsChanged.propagationGain, reference.propagationGain, 1e-30, 'legacy scale excluded');

// Eq. (3.9a): serving direction is 35 dBi and the non-serving envelope is
// clipped to [-10, 35] dBi with A_R=32 and B_R=25.
assert.equal(receiveGainDbiForSeparation(0), 35);
assert.equal(receiveGainDbiForSeparation(1), 32);
assert.equal(receiveGainDbiForSeparation(10), 7);
assert.equal(receiveGainDbiForSeparation(100), -10);
close(
  receiveGainDbiToLinear(reference.receiveGainDbi),
  10 ** (35 / 10),
  1e-12,
  'serving receive envelope conversion',
);
const nonServing = deriveCanonicalChannelTerms(distanceKm, elevationDeg, defaults, 1);
assert.equal(nonServing.receiveGainDbi, 32);
close(nonServing.receiveGainLinear, 10 ** (32 / 10), 1e-12, 'non-serving receive envelope conversion');

// The normalised deterministic representative is the mean power for every
// finite K_R; K_R remains an explicit model input rather than a hidden factor.
for (const kDb of [0, 20, 30]) close(normalizedRicianPowerGain(kDb), 1, 1e-15, `normalised Rician K=${kDb} dB`);

assert.throws(
  () => deriveCanonicalChannelTerms(0, elevationDeg, defaults),
  /distanceKm must be positive/,
);
assert.throws(
  () => deriveCanonicalChannelTerms(distanceKm, elevationDeg, { ...defaults, ricianKDb: -1 }),
  /ricianKDb must be non-negative/,
);

console.log('canonical channel adapter matches thesis FSPL, atmospheric, receive-envelope, and Rician contracts.');
