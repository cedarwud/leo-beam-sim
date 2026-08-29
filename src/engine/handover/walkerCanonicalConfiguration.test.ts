import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANONICAL_DEFAULT_ATMOSPHERIC_COEFFICIENT_DB_PER_KM,
  CANONICAL_DEFAULT_CARRIER_FREQUENCY_GHZ,
  CANONICAL_DEFAULT_RECEIVE_GAIN_DBI,
  CANONICAL_DEFAULT_RICIAN_K_DB,
} from '../../simulator/canonicalChannelAdapter';
import {
  BOLTZMANN_CONSTANT_W_PER_HZ_K,
  buildCanonicalSevenCellScenario,
} from '../../simulator/canonicalSevenCellScenario';
import { DEFAULT_SIMULATOR_PARAMETERS } from '../../simulator/types';
import { buildCanonicalForecastConfigHash } from './canonicalForecastEeEvaluator';
import {
  MAX_WALKER_CANONICAL_BEAM_COUNT,
  WALKER_CANONICAL_CONFIGURATION_PROVENANCE_VERSION,
  buildWalkerCanonicalConfiguration,
} from './walkerCanonicalConfiguration';

const SAMPLE_STEP_SEC = 2.5;

test('matches the existing Family-B simulator configuration boundary', () => {
  const built = buildWalkerCanonicalConfiguration({
    parameters: DEFAULT_SIMULATOR_PARAMETERS,
    beamCount: 7,
    forecastSampleStepSec: SAMPLE_STEP_SEC,
    switchEnergy: {
      mode: 'zero-energy-diagnostic',
      valueJ: 0,
      sourceId: 'validation-zero-switch-energy',
    },
  });
  const reference = buildCanonicalSevenCellScenario({
    ...DEFAULT_SIMULATOR_PARAMETERS,
    selectedLink: { distanceKm: 1_000, elevationDeg: 45, satelliteAltitudeKm: 550 },
    frameDurationS: SAMPLE_STEP_SEC,
  });

  assert.deepEqual(built.canonicalConfig, reference.input.config);
  assert.equal(
    built.derived.beamBandwidthHz,
    DEFAULT_SIMULATOR_PARAMETERS.systemBandwidthHz / DEFAULT_SIMULATOR_PARAMETERS.frequencyReuse,
  );
  const expectedTemperatureK = DEFAULT_SIMULATOR_PARAMETERS.antennaNoiseTemperatureK
    + DEFAULT_SIMULATOR_PARAMETERS.noiseReferenceTemperatureK
      * (10 ** (DEFAULT_SIMULATOR_PARAMETERS.noiseFigureDb / 10) - 1);
  assert.equal(built.derived.systemNoiseTemperatureK, expectedTemperatureK);
  assert.equal(
    built.derived.noisePowerW,
    BOLTZMANN_CONSTANT_W_PER_HZ_K * expectedTemperatureK * built.derived.beamBandwidthHz,
  );
  assert.deepEqual(built.canonicalChannel, {
    receiveGainModel: 'fixed-boresight-gain-v1',
    carrierFrequencyGHz: CANONICAL_DEFAULT_CARRIER_FREQUENCY_GHZ,
    atmosphericCoefficientDbPerKm: CANONICAL_DEFAULT_ATMOSPHERIC_COEFFICIENT_DB_PER_KM,
    ricianKDb: CANONICAL_DEFAULT_RICIAN_K_DB,
    receiveGainDbi: CANONICAL_DEFAULT_RECEIVE_GAIN_DBI,
  });
  assert.equal(
    built.canonicalConfigHash,
    buildCanonicalForecastConfigHash(built.canonicalConfig),
  );
  assert.match(
    built.canonicalConfigurationProvenanceId,
    new RegExp(`^${WALKER_CANONICAL_CONFIGURATION_PROVENANCE_VERSION}:`),
  );
  assert.equal(Object.isFrozen(built), true);
  assert.equal(Object.isFrozen(built.canonicalConfig), true);
  assert.equal(Object.isFrozen(built.canonicalConfig.switchIndicatorByBeam), true);
});

test('keeps sourced positive switch energy distinct from the zero-energy diagnostic', () => {
  const built = buildWalkerCanonicalConfiguration({
    parameters: DEFAULT_SIMULATOR_PARAMETERS,
    beamCount: 3,
    forecastSampleStepSec: SAMPLE_STEP_SEC,
    switchEnergy: {
      mode: 'configured',
      valueJ: 0.12,
      sourceId: 'owner-profile:switch-energy-v1',
    },
  });

  assert.equal(built.canonicalConfig.switchEnergyJ, 0.12);
  assert.deepEqual(built.switchEnergy, {
    mode: 'configured',
    valueJ: 0.12,
    sourceId: 'owner-profile:switch-energy-v1',
  });
  assert.deepEqual(built.canonicalConfig.switchIndicatorByBeam, [0, 0, 0]);
  assert.notEqual(
    built.canonicalConfigHash,
    buildWalkerCanonicalConfiguration({
      parameters: DEFAULT_SIMULATOR_PARAMETERS,
      beamCount: 3,
      forecastSampleStepSec: SAMPLE_STEP_SEC,
      switchEnergy: {
        mode: 'zero-energy-diagnostic',
        valueJ: 0,
        sourceId: 'validation-zero-switch-energy',
      },
    }).canonicalConfigHash,
  );
  const sameValueOtherSource = buildWalkerCanonicalConfiguration({
    parameters: DEFAULT_SIMULATOR_PARAMETERS,
    beamCount: 3,
    forecastSampleStepSec: SAMPLE_STEP_SEC,
    switchEnergy: {
      mode: 'configured',
      valueJ: 0.12,
      sourceId: 'another-owner-source:same-value',
    },
  });
  assert.equal(sameValueOtherSource.canonicalConfigHash, built.canonicalConfigHash);
  assert.notEqual(
    sameValueOtherSource.canonicalConfigurationProvenanceId,
    built.canonicalConfigurationProvenanceId,
  );
});

test('fails closed for mislabeled switch energy, legacy channel extensions, and invalid controls', () => {
  assert.throws(() => buildWalkerCanonicalConfiguration({
    parameters: DEFAULT_SIMULATOR_PARAMETERS,
    beamCount: 7,
    forecastSampleStepSec: SAMPLE_STEP_SEC,
    switchEnergy: {
      mode: 'configured',
      valueJ: 0,
      sourceId: 'invalid-zero-configured',
    },
  }), /configured switch energy/);
  assert.throws(() => buildWalkerCanonicalConfiguration({
    parameters: DEFAULT_SIMULATOR_PARAMETERS,
    beamCount: 7,
    forecastSampleStepSec: SAMPLE_STEP_SEC,
    switchEnergy: {
      mode: 'zero-energy-diagnostic',
      valueJ: 0.1 as 0,
      sourceId: 'invalid-nonzero-diagnostic',
    },
  }), /exactly 0 J/);

  for (const parameters of [
    { ...DEFAULT_SIMULATOR_PARAMETERS, channelGainScale: 2 },
    { ...DEFAULT_SIMULATOR_PARAMETERS, scintillationScaleDb: 0.1 },
    { ...DEFAULT_SIMULATOR_PARAMETERS, shadowFadingMarginDb: 1 },
  ]) {
    assert.throws(() => buildWalkerCanonicalConfiguration({
      parameters,
      beamCount: 7,
      forecastSampleStepSec: SAMPLE_STEP_SEC,
      switchEnergy: {
        mode: 'zero-energy-diagnostic',
        valueJ: 0,
        sourceId: 'validation-zero-switch-energy',
      },
    }), /Walker canonical configuration/);
  }
  assert.throws(() => buildWalkerCanonicalConfiguration({
    parameters: { ...DEFAULT_SIMULATOR_PARAMETERS, frequencyReuse: 2.5 },
    beamCount: 7,
    forecastSampleStepSec: SAMPLE_STEP_SEC,
    switchEnergy: {
      mode: 'zero-energy-diagnostic',
      valueJ: 0,
      sourceId: 'validation-zero-switch-energy',
    },
  }), /frequencyReuse/);
  assert.throws(() => buildWalkerCanonicalConfiguration({
    parameters: DEFAULT_SIMULATOR_PARAMETERS,
    beamCount: MAX_WALKER_CANONICAL_BEAM_COUNT + 1,
    forecastSampleStepSec: SAMPLE_STEP_SEC,
    switchEnergy: {
      mode: 'zero-energy-diagnostic',
      valueJ: 0,
      sourceId: 'validation-zero-switch-energy',
    },
  }), /beamCount/);
  assert.throws(() => buildWalkerCanonicalConfiguration({
    parameters: { ...DEFAULT_SIMULATOR_PARAMETERS, antennaNoiseTemperatureK: 0 },
    beamCount: 7,
    forecastSampleStepSec: SAMPLE_STEP_SEC,
    switchEnergy: {
      mode: 'zero-energy-diagnostic',
      valueJ: 0,
      sourceId: 'validation-zero-switch-energy',
    },
  }), /antennaNoiseTemperatureK/);
});
