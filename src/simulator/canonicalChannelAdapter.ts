import { computeFsplDb } from '../engine/signal/path-loss';

/**
 * Channel terms used by the Family-B closure.
 *
 * The formal path is
 *
 *   G^LS = 10^(-(L_FS + L_atm)/10),
 *   h = G^T G^R G^LS g.
 *
 * `g` is represented deterministically by its normalised mean power (one) in
 * this browser frame.  The Rician K factor is still carried in the terms so
 * the approximation is explicit and can be replaced by a seeded draw at a
 * runtime boundary that owns stochastic state.
 */

export const CANONICAL_DEFAULT_CARRIER_FREQUENCY_GHZ = 20;
export const CANONICAL_DEFAULT_SATELLITE_ALTITUDE_KM = 780;
export const CANONICAL_DEFAULT_ATMOSPHERIC_COEFFICIENT_DB_PER_KM = 0.05;
export const CANONICAL_DEFAULT_RICIAN_K_DB = 20;
export const CANONICAL_DEFAULT_RECEIVE_GAIN_DBI = 35;
export const CANONICAL_DEFAULT_RECEIVE_GAIN_MIN_DBI = -10;
export const CANONICAL_DEFAULT_RECEIVE_ENVELOPE_A_DBI = 32;
export const CANONICAL_DEFAULT_RECEIVE_ENVELOPE_B_DBI = 25;

/** Formal path components; scintillation and shadow fading are not included. */
export const CANONICAL_PATH_LOSS_COMPONENTS = Object.freeze([
  'fspl',
  'atmospheric',
] as const);

/** Legacy compatibility snapshot; only its atmospheric value is formal. */
export const CANONICAL_DEFAULT_CHANNEL_LOSS_OVERRIDES = Object.freeze({
  atmosphericZenithLossDb: CANONICAL_DEFAULT_ATMOSPHERIC_COEFFICIENT_DB_PER_KM,
  scintillationScaleDb: 0,
  shadowFadingMarginDb: 0,
});

/**
 * Compatibility shape for the pre-formal adapter callers.  The old
 * `atmosphericZenithLossDb` name is interpreted as χ_atm when the new
 * coefficient field is absent; scintillation, shadow, and channel scale are
 * deliberately ignored by the formal path.
 */
export interface CanonicalChannelParameters {
  readonly carrierFrequencyGHz: number;
  readonly atmosphericCoefficientDbPerKm?: number;
  readonly atmosphericZenithLossDb?: number;
  readonly satelliteAltitudeKm?: number;
  readonly ricianKDb?: number;
  readonly scintillationScaleDb?: number;
  readonly shadowFadingMarginDb?: number;
  readonly channelGainScale?: number;
  /** Serving-direction receive gain G_R,max, in dBi. */
  readonly receiveGainDbi: number;
}

export interface CanonicalChannelTerms {
  /** Free-space path loss L_FS, in dB. */
  readonly freeSpacePathLossDb: number;
  /** Atmospheric loss L_atm = 3 d χ_atm / (10 h_s), in dB. */
  readonly atmosphericLossDb: number;
  /** L_FS + L_atm, in dB. */
  readonly pathLossDb: number;
  /** G^LS = 10^(-L/10), before the deterministic Rician factor. */
  readonly largeScaleGain: number;
  /** Normalised Rician power representative g; E[g] = 1. */
  readonly ricianGain: number;
  /** Rician factor used for the deterministic normalisation. */
  readonly ricianKDb: number;
  /** G^LS * g, the propagation/fading factor passed to the producer. */
  readonly propagationGain: number;
  /** Receive-envelope value in dBi for this link. */
  readonly receiveGainDbi: number;
  /** G^R, in linear units. */
  readonly receiveGainLinear: number;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function positive(value: number, label: string): number {
  finite(value, label);
  if (value <= 0) throw new RangeError(`${label} must be positive`);
  return value;
}

function nonNegative(value: number, label: string): number {
  finite(value, label);
  if (value < 0) throw new RangeError(`${label} must be non-negative`);
  return value;
}

function resolveAtmosphericCoefficient(parameters: CanonicalChannelParameters): number {
  const coefficient = parameters.atmosphericCoefficientDbPerKm
    ?? parameters.atmosphericZenithLossDb
    ?? CANONICAL_DEFAULT_ATMOSPHERIC_COEFFICIENT_DB_PER_KM;
  return nonNegative(coefficient, 'atmosphericCoefficientDbPerKm');
}

function resolveAltitude(parameters: CanonicalChannelParameters): number {
  return positive(
    parameters.satelliteAltitudeKm ?? CANONICAL_DEFAULT_SATELLITE_ALTITUDE_KM,
    'satelliteAltitudeKm',
  );
}

/** Eq. (3.9): atmospheric loss in dB for distance in km and altitude in km. */
export function atmosphericLossDb(
  distanceKm: number,
  atmosphericCoefficientDbPerKm = CANONICAL_DEFAULT_ATMOSPHERIC_COEFFICIENT_DB_PER_KM,
  satelliteAltitudeKm = CANONICAL_DEFAULT_SATELLITE_ALTITUDE_KM,
): number {
  const distance = positive(distanceKm, 'distanceKm');
  const coefficient = nonNegative(atmosphericCoefficientDbPerKm, 'atmosphericCoefficientDbPerKm');
  const altitude = positive(satelliteAltitudeKm, 'satelliteAltitudeKm');
  return (3 * distance * coefficient) / (10 * altitude);
}

/**
 * Deterministic normalised Rician power gain.
 *
 * For K = s²/(2σ²), the normalised LOS and diffuse powers are K/(K+1) and
 * 1/(K+1). Their sum is one, which is the deterministic E[g]=1 representative
 * required by Eq. (3.10) when this UI frame has no stochastic RNG state.
 */
export function normalizedRicianPowerGain(ricianKDb: number): number {
  const kDb = nonNegative(ricianKDb, 'ricianKDb');
  const kLinear = 10 ** (kDb / 10);
  const gain = kLinear / (kLinear + 1) + 1 / (kLinear + 1);
  if (!Number.isFinite(gain) || gain <= 0) {
    throw new RangeError('normalised Rician gain must be finite and positive');
  }
  return gain;
}

/** Convert a dBi receiver gain to the linear G^R used by the producer. */
export function receiveGainDbiToLinear(receiveGainDbi: number): number {
  finite(receiveGainDbi, 'receiveGainDbi');
  const linear = 10 ** (receiveGainDbi / 10);
  if (!Number.isFinite(linear) || linear <= 0) {
    throw new RangeError('receiveGainDbi produces a non-finite linear gain');
  }
  return linear;
}

/**
 * Eq. (3.9a) receive envelope.  `separationDeg=0` is the serving direction;
 * non-serving links follow A_R - B_R log10(delta/1°), clipped to the declared
 * floor and the serving gain.
 */
export function receiveGainDbiForSeparation(
  separationDeg: number,
  servingGainDbi = CANONICAL_DEFAULT_RECEIVE_GAIN_DBI,
): number {
  const separation = nonNegative(separationDeg, 'receiveSeparationDeg');
  const serving = finite(servingGainDbi, 'servingGainDbi');
  if (separation === 0) return serving;
  const envelope = CANONICAL_DEFAULT_RECEIVE_ENVELOPE_A_DBI
    - CANONICAL_DEFAULT_RECEIVE_ENVELOPE_B_DBI * Math.log10(separation);
  return Math.min(
    serving,
    Math.max(CANONICAL_DEFAULT_RECEIVE_GAIN_MIN_DBI, envelope),
  );
}

function pathLossFor(
  distanceKm: number,
  frequencyGHz: number,
  parameters: CanonicalChannelParameters,
): { readonly freeSpacePathLossDb: number; readonly atmosphericLossDb: number; readonly pathLossDb: number } {
  const distance = positive(distanceKm, 'distanceKm');
  const frequency = positive(frequencyGHz, 'carrierFrequencyGHz');
  const freeSpacePathLossDb = 92.45 + 20 * Math.log10(distance) + 20 * Math.log10(frequency);
  // Keep the shared FSPL implementation as a numerical cross-check while the
  // atmospheric term follows thesis Eq. (3.9), not the old zenith/sin(elev)
  // approximation.
  const sharedFsplDb = computeFsplDb(distance, frequency);
  if (Math.abs(sharedFsplDb - freeSpacePathLossDb) > 1e-10) {
    throw new Error('FSPL implementation drifted from the thesis kilometre/GHz form');
  }
  const atmosphericLossDbValue = atmosphericLossDb(
    distance,
    resolveAtmosphericCoefficient(parameters),
    resolveAltitude(parameters),
  );
  return {
    freeSpacePathLossDb,
    atmosphericLossDb: atmosphericLossDbValue,
    pathLossDb: freeSpacePathLossDb + atmosphericLossDbValue,
  };
}

/**
 * Build G^LS, deterministic g, and G^R from TLE-derived link geometry plus
 * explicit channel inputs.  The optional fourth argument is the receiver
 * direction separation in degrees; it defaults to the serving direction used
 * by the current single-satellite seven-cell scenario.
 */
export function deriveCanonicalChannelTerms(
  distanceKm: number,
  elevationDeg: number,
  parameters: CanonicalChannelParameters,
  receiveSeparationDeg = 0,
): CanonicalChannelTerms {
  finite(elevationDeg, 'elevationDeg');
  const path = pathLossFor(distanceKm, parameters.carrierFrequencyGHz, parameters);
  const largeScaleGain = 10 ** (-path.pathLossDb / 10);
  const ricianKDb = parameters.ricianKDb ?? CANONICAL_DEFAULT_RICIAN_K_DB;
  const ricianGain = normalizedRicianPowerGain(ricianKDb);
  const propagationGain = largeScaleGain * ricianGain;
  const receiveDbi = receiveGainDbiForSeparation(receiveSeparationDeg, parameters.receiveGainDbi);
  const receiveGainLinear = receiveGainDbiToLinear(receiveDbi);
  if (!Number.isFinite(propagationGain) || propagationGain <= 0) {
    throw new RangeError('propagationGain must be finite and positive');
  }
  return Object.freeze({
    freeSpacePathLossDb: path.freeSpacePathLossDb,
    atmosphericLossDb: path.atmosphericLossDb,
    pathLossDb: path.pathLossDb,
    largeScaleGain,
    ricianGain,
    ricianKDb,
    propagationGain,
    receiveGainDbi: receiveDbi,
    receiveGainLinear,
  });
}
