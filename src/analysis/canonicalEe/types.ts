/**
 * Typed boundary for the frozen Family-B angle-aware EE contract.
 *
 * The input is deliberately split into two objects. `config` contains the
 * model parameters a controller may expose as editable controls; `frame`
 * contains one accepted geometry/channel/assignment state. Every field on the
 * result is derived from those inputs and must be treated as read-only.
 */

export const CANONICAL_EE_CONTRACT_VERSION = 'family-b-thesis-3.13-3.17-v1' as const;

export const CANONICAL_EE_UNITS = Object.freeze({
  angle: 'rad',
  channelGain: 'linear',
  power: 'W',
  rate: 'bit/s',
  energy: 'J',
  efficiency: 'bit/J',
  bandwidth: 'Hz',
  duration: 's',
} as const);

export const DEFAULT_EPSILON_NUM = 1e-12;
export const DEFAULT_BACKOFF_DB = 5;
export const DEFAULT_ETA_MAX = 0.35;
export const DEFAULT_G0_LINEAR = 10_000;
export const DEFAULT_THETA_3DB_RAD = (2 * Math.PI) / 180;

export type NumberVector = readonly number[];
export type BooleanVector = readonly boolean[];
export type NumberMatrix = readonly NumberVector[];

/** Model parameters that are explicitly editable in the formal simulator. */
export interface CanonicalEeConfig {
  /** Thermal/noise power σ², in W. Must be positive. */
  readonly noisePowerW: number;
  /** Per-beam bandwidth B_beam, in Hz. */
  readonly beamBandwidthHz: number;
  /** Service target R_min, in bit/s. */
  readonly minimumRateBps: number;
  /** Per-beam RF output cap P_beam,max, in W. A scalar applies to every beam. */
  readonly beamPowerCapW: number | NumberVector;
  /** Satellite aggregate RF output cap P_sat,max, in W. */
  readonly satellitePowerCapW: number;
  /** Boresight transmit gain G₀, linear. */
  readonly g0Linear: number;
  /** Full half-power beam width θ_3dB, in rad. */
  readonly theta3dbRad: number;
  /** P_RFC per active beam, in W. */
  readonly rfcPowerW: number;
  /** P_BB per satellite, apportioned over its active beams, in W. */
  readonly basebandPerSatelliteW: number;
  /** Frame duration used to convert event energies to power, in s. */
  readonly frameDurationS: number;
  /** PA back-off used by the canonical load-dependent efficiency curve. */
  readonly backoffDb?: number;
  /** Upper bound η_max for the canonical PA curve. */
  readonly etaMax?: number;
  /** Optional training-event energy per beam, in J. */
  readonly trainingEnergyJByBeam?: number | NumberVector;
  /** Optional training-event indicator per beam. */
  readonly trainingIndicatorByBeam?: number | NumberVector;
  /** Optional switching-event energy shared by each indicated beam, in J. */
  readonly switchEnergyJ?: number;
  /** Optional switching-event indicator per beam. */
  readonly switchIndicatorByBeam?: number | NumberVector;
}

/** One accepted geometry/channel/assignment state; all values are linear SI units. */
export interface CanonicalEeFrameInput {
  /** Off-axis angle θ for each user/beam link, shape (U, B), in rad. */
  readonly thetaRadUb: NumberMatrix;
  /** Propagation/fading factor H, shape (U, B), linear and non-negative. */
  readonly propagationGainUb: NumberMatrix;
  /** User receive gain relative to the selected serving direction, shape (U, B). */
  readonly receiveGainUb: NumberMatrix;
  /** Serving beam index per user; -1 means removed by the assignment gate. */
  readonly servingBeamU: readonly number[];
  /** Physical beam activity z_b. */
  readonly beamActiveB: BooleanVector;
  /** TDMA load U_b. Must equal the number of users serving each beam. */
  readonly beamLoadB: NumberVector;
  /** Satellite identity for each beam. */
  readonly beamSatelliteB: readonly number[];
  /** Co-channel colour for each beam. */
  readonly beamColorB: readonly number[];
  /** Previous-step interference estimate Î_u, in W. */
  readonly laggedInterferenceUW: NumberVector;
}

export interface CanonicalEeInput {
  readonly config: CanonicalEeConfig;
  readonly frame: CanonicalEeFrameInput;
}

/** Alias matching the SDD terminology. */
export type CanonicalEeInputs = CanonicalEeInput;

export interface CanonicalEePowerLedger {
  readonly pReqUW: NumberVector;
  readonly pReqBW: NumberVector;
  readonly pDlBeforeSatelliteCapBW: NumberVector;
  readonly satelliteScaleB: NumberVector;
  /** The sole actual RF output used by SINR, PA, and EE. */
  readonly pDlActualBW: NumberVector;
  readonly paEfficiencyB: NumberVector;
  readonly pPaBW: NumberVector;
  readonly pRfcBW: NumberVector;
  readonly pBbBW: NumberVector;
  readonly pEventBW: NumberVector;
  readonly pTotBW: NumberVector;
  readonly systemPowerW: number;
}

export interface CanonicalEeThroughputLedger {
  readonly signalUW: NumberVector;
  readonly interferenceUW: NumberVector;
  readonly sinrU: NumberVector;
  readonly rateUBps: NumberVector;
  readonly totalRateBps: number;
  readonly qosMetU: BooleanVector;
  readonly powerLimitedU: BooleanVector;
}

export interface CanonicalEeLedger {
  readonly r1UBitsPerJ: NumberVector;
  readonly systemEeBitsPerJ: number;
  readonly contributionSumBitsPerJ: number;
  readonly sumIdentity: true;
  readonly sumIdentityErrorBitsPerJ: number;
  readonly zeroOverZero: boolean;
}

/** Complete immutable per-tick canonical result. */
export interface CanonicalEeResult {
  readonly contractVersion: typeof CANONICAL_EE_CONTRACT_VERSION;
  readonly inputs: CanonicalEeInput;
  readonly transmitGainUb: NumberMatrix;
  readonly compositeGainUb: NumberMatrix;
  readonly gammaReqB: NumberVector;
  readonly receivedPowerUbW: NumberMatrix;
  readonly power: CanonicalEePowerLedger;
  readonly throughput: CanonicalEeThroughputLedger;
  readonly ee: CanonicalEeLedger;
  /** Flat aliases mirror the Python golden-vector field names for parity. */
  readonly pReqUW: NumberVector;
  readonly pReqBW: NumberVector;
  readonly pDlBeforeSatelliteCapBW: NumberVector;
  readonly satelliteScaleB: NumberVector;
  readonly pDlActualBW: NumberVector;
  readonly etaPaB: NumberVector;
  readonly pTotBW: NumberVector;
  readonly signalUW: NumberVector;
  readonly interferenceUW: NumberVector;
  readonly sinrU: NumberVector;
  readonly rateUBps: NumberVector;
  readonly r1UBitsPerJ: NumberVector;
}

export type CanonicalEeEvaluationStatus = 'valid' | 'zero-activity';

export interface CanonicalEeEvaluation {
  readonly status: CanonicalEeEvaluationStatus;
  readonly deliveredBits: number;
  readonly consumedEnergyJ: number;
  readonly energyEfficiencyBitsPerJ: number;
  readonly zeroOverZero: boolean;
}

export interface CanonicalEeEvaluationSample {
  readonly totalRateBps: number;
  readonly systemPowerW: number;
  readonly durationSec: number;
}

export type CanonicalEeErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_SHAPE'
  | 'INVALID_PHYSICAL_DOMAIN'
  | 'POSITIVE_RATE_ZERO_POWER'
  | 'INVALID_DURATION'
  | 'INVALID_AGGREGATE';

export class CanonicalEeInputError extends RangeError {
  readonly code: CanonicalEeErrorCode;

  constructor(code: CanonicalEeErrorCode, message: string) {
    super(message);
    this.name = 'CanonicalEeInputError';
    this.code = code;
  }
}
