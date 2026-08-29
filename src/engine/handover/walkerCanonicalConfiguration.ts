import type { CanonicalEeConfig } from '../../analysis/canonicalEe';
import { CANONICAL_DEFAULT_RICIAN_K_DB } from '../../simulator/canonicalChannelAdapter';
import { BOLTZMANN_CONSTANT_W_PER_HZ_K } from '../../simulator/canonicalSevenCellScenario';
import type { SimulatorParameters } from '../../simulator/types';
import { buildCanonicalForecastConfigHash } from './canonicalForecastEeEvaluator';
import type { WalkerScenarioCanonicalChannel } from './walkerForecastFrameProvider';

export const WALKER_CANONICAL_CONFIGURATION_PROVENANCE_VERSION =
  'walker-canonical-configuration-provenance-v1' as const;
export const MAX_WALKER_CANONICAL_BEAM_COUNT = 4_096;

export type WalkerSwitchEnergyConfiguration =
  | Readonly<{
      mode: 'configured';
      valueJ: number;
      sourceId: string;
    }>
  | Readonly<{
      mode: 'zero-energy-diagnostic';
      valueJ: 0;
      sourceId: string;
    }>;

export interface WalkerCanonicalConfigurationInput {
  readonly parameters: SimulatorParameters;
  readonly beamCount: number;
  readonly forecastSampleStepSec: number;
  readonly switchEnergy: WalkerSwitchEnergyConfiguration;
}

export interface WalkerCanonicalConfiguration {
  readonly canonicalConfig: CanonicalEeConfig;
  readonly canonicalChannel: WalkerScenarioCanonicalChannel;
  readonly canonicalConfigHash: string;
  readonly canonicalConfigurationProvenanceId: string;
  readonly switchEnergy: WalkerSwitchEnergyConfiguration;
  readonly derived: Readonly<{
    readonly beamBandwidthHz: number;
    readonly systemNoiseTemperatureK: number;
    readonly noisePowerW: number;
  }>;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`);
  }
  return value;
}

function nonNegative(value: unknown, label: string): number {
  const result = finite(value, label);
  if (result < 0) throw new RangeError(`${label} must be non-negative`);
  return result;
}

function positive(value: unknown, label: string): number {
  const result = finite(value, label);
  if (result <= 0) throw new RangeError(`${label} must be greater than zero`);
  return result;
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be non-empty`);
  }
  return value;
}

function validateSwitchEnergy(
  input: WalkerSwitchEnergyConfiguration,
): WalkerSwitchEnergyConfiguration {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Walker switch energy configuration must be an object');
  }
  const sourceId = nonEmpty(input.sourceId, 'Walker switch energy sourceId');
  if (input.mode === 'configured') {
    const valueJ = positive(input.valueJ, 'Walker configured switch energy');
    return Object.freeze({ mode: 'configured', valueJ, sourceId });
  }
  if (input.mode === 'zero-energy-diagnostic') {
    if (input.valueJ !== 0) {
      throw new RangeError('Walker zero-energy diagnostic must use exactly 0 J');
    }
    return Object.freeze({ mode: 'zero-energy-diagnostic', valueJ: 0, sourceId });
  }
  throw new TypeError('Walker switch energy mode is invalid');
}

function validateFormalOnlyParameters(parameters: SimulatorParameters): void {
  if (parameters.channelGainScale !== 1) {
    throw new RangeError('Walker canonical configuration requires legacy channelGainScale = 1');
  }
  if (parameters.scintillationScaleDb !== 0) {
    throw new RangeError('Walker canonical configuration excludes legacy scintillationScaleDb');
  }
  if (parameters.shadowFadingMarginDb !== 0) {
    throw new RangeError('Walker canonical configuration excludes legacy shadowFadingMarginDb');
  }
}

/**
 * Convert the homepage's formal controls into the exact Family-B configuration
 * and channel bundle consumed by Walker forecast frames. No geometry, serving
 * assignment, forecast, ranking, or decision is performed here.
 */
export function buildWalkerCanonicalConfiguration(
  input: WalkerCanonicalConfigurationInput,
): WalkerCanonicalConfiguration {
  if (input === null || typeof input !== 'object') {
    throw new TypeError('Walker canonical configuration input must be an object');
  }
  const parameters = input.parameters;
  if (parameters === null || typeof parameters !== 'object') {
    throw new TypeError('Walker canonical parameters must be an object');
  }
  validateFormalOnlyParameters(parameters);

  if (
    !Number.isSafeInteger(input.beamCount)
    || input.beamCount <= 0
    || input.beamCount > MAX_WALKER_CANONICAL_BEAM_COUNT
  ) {
    throw new RangeError(
      `Walker canonical beamCount must be a positive safe integer no greater than ${MAX_WALKER_CANONICAL_BEAM_COUNT}`,
    );
  }
  const forecastSampleStepSec = positive(
    input.forecastSampleStepSec,
    'Walker canonical forecastSampleStepSec',
  );
  const frequencyReuse = positive(parameters.frequencyReuse, 'Walker canonical frequencyReuse');
  if (!Number.isSafeInteger(frequencyReuse)) {
    throw new RangeError('Walker canonical frequencyReuse must be a positive safe integer');
  }
  const systemBandwidthHz = positive(parameters.systemBandwidthHz, 'Walker canonical systemBandwidthHz');
  const antennaNoiseTemperatureK = positive(
    parameters.antennaNoiseTemperatureK,
    'Walker canonical antennaNoiseTemperatureK',
  );
  const noiseReferenceTemperatureK = positive(
    parameters.noiseReferenceTemperatureK,
    'Walker canonical noiseReferenceTemperatureK',
  );
  const noiseFigureDb = nonNegative(parameters.noiseFigureDb, 'Walker canonical noiseFigureDb');
  const beamBandwidthHz = systemBandwidthHz / frequencyReuse;
  const systemNoiseTemperatureK = antennaNoiseTemperatureK
    + noiseReferenceTemperatureK * (10 ** (noiseFigureDb / 10) - 1);
  const noisePowerW = BOLTZMANN_CONSTANT_W_PER_HZ_K
    * systemNoiseTemperatureK
    * beamBandwidthHz;
  positive(beamBandwidthHz, 'Walker canonical derived beamBandwidthHz');
  positive(systemNoiseTemperatureK, 'Walker canonical derived systemNoiseTemperatureK');
  positive(noisePowerW, 'Walker canonical derived noisePowerW');

  const etaMax = positive(parameters.etaMax, 'Walker canonical etaMax');
  if (etaMax > 1) throw new RangeError('Walker canonical etaMax must not exceed one');
  const switchEnergy = validateSwitchEnergy(input.switchEnergy);
  const zeroVector = Object.freeze(Array.from({ length: input.beamCount }, () => 0));
  const canonicalConfig: CanonicalEeConfig = Object.freeze({
    noisePowerW,
    beamBandwidthHz,
    minimumRateBps: nonNegative(parameters.minimumRateBps, 'Walker canonical minimumRateBps'),
    beamPowerCapW: positive(parameters.beamPowerCapW, 'Walker canonical beamPowerCapW'),
    satellitePowerCapW: positive(parameters.satellitePowerCapW, 'Walker canonical satellitePowerCapW'),
    g0Linear: positive(parameters.g0Linear, 'Walker canonical g0Linear'),
    // SimulatorParameters stores full HPBW; Family-B consumes the one-sided
    // half-power angle at this explicit existing simulator boundary.
    theta3dbRad: positive(parameters.theta3dbRad, 'Walker canonical theta3dbRad') / 2,
    rfcPowerW: nonNegative(parameters.rfcPowerW, 'Walker canonical rfcPowerW'),
    basebandPerSatelliteW: nonNegative(
      parameters.basebandPerSatelliteW,
      'Walker canonical basebandPerSatelliteW',
    ),
    frameDurationS: forecastSampleStepSec,
    backoffDb: nonNegative(parameters.backoffDb, 'Walker canonical backoffDb'),
    etaMax,
    trainingEnergyJByBeam: zeroVector,
    trainingIndicatorByBeam: zeroVector,
    switchEnergyJ: switchEnergy.valueJ,
    switchIndicatorByBeam: zeroVector,
  });
  const canonicalChannel: WalkerScenarioCanonicalChannel = Object.freeze({
    receiveGainModel: 'fixed-boresight-gain-v1',
    carrierFrequencyGHz: positive(
      parameters.carrierFrequencyGHz,
      'Walker canonical carrierFrequencyGHz',
    ),
    atmosphericCoefficientDbPerKm: nonNegative(
      parameters.atmosphericZenithLossDb,
      'Walker canonical atmosphericCoefficientDbPerKm',
    ),
    ricianKDb: CANONICAL_DEFAULT_RICIAN_K_DB,
    receiveGainDbi: finite(parameters.receiveGainDbi, 'Walker canonical receiveGainDbi'),
  });
  const canonicalConfigHash = buildCanonicalForecastConfigHash(canonicalConfig);
  const canonicalConfigurationProvenanceId =
    `${WALKER_CANONICAL_CONFIGURATION_PROVENANCE_VERSION}:${JSON.stringify([
      canonicalConfigHash,
      switchEnergy.mode,
      switchEnergy.valueJ,
      switchEnergy.sourceId,
    ])}`;

  return Object.freeze({
    canonicalConfig,
    canonicalChannel,
    canonicalConfigHash,
    canonicalConfigurationProvenanceId,
    switchEnergy,
    derived: Object.freeze({
      beamBandwidthHz,
      systemNoiseTemperatureK,
      noisePowerW,
    }),
  });
}
