/**
 * Pure comparison domain for the classroom baseline/candidate experiment.
 *
 * This module consumes already-frozen arm snapshots. It deliberately does not
 * import the simulator, ledger, renderer, or any producer: a future UI bridge
 * must supply the two snapshots and this module only compares them.
 */

export const CLASSROOM_BASELINE_TX_POWER_DBM = 24 as const;
export const CLASSROOM_CANDIDATE_TX_POWER_DBM = 23 as const;

export type ClassroomEnergyComparisonArmRole = 'baseline' | 'candidate';

/** A read-only snapshot supplied by the future classroom UI integration. */
export type ClassroomEnergyComparisonArm = Readonly<{
  readonly role: ClassroomEnergyComparisonArmRole;
  readonly txPowerDbm: number;
  readonly windowStartSimTimeSec: number;
  readonly windowEndSimTimeSec: number;
  readonly elapsedSec: number;
  readonly comparisonContextKey: string;
  readonly cumulativeDataMbit: number;
  readonly totalEnergyJ: number;
  readonly lowSinrRatioPct: number;
  readonly runEeMbitPerJ: number;
  readonly lowSinrThresholdDb: number;
  readonly handoverCount: number;
}>;

/** The sole authority for the classroom qualification thresholds. */
export type ClassroomEnergyComparisonThresholds = Readonly<{
  /** Candidate data must retain at least this fraction of baseline data. */
  readonly minDataRetentionRatio: number;
  /** Candidate low-SINR ratio may increase by at most this many percentage points. */
  readonly maxLowSinrDeltaPp: number;
  /** Candidate Run-EE must be at least this fraction of baseline Run-EE. */
  readonly minRunEeRatio: number;
  /** The gate is strict: energy saving must be greater than this value. */
  readonly minEnergySavingPct: number;
}>;

export const COURSE_ENERGY_COMPARISON_THRESHOLDS: ClassroomEnergyComparisonThresholds =
  Object.freeze({
    minDataRetentionRatio: 0.95,
    maxLowSinrDeltaPp: 5,
    minRunEeRatio: 1,
    minEnergySavingPct: 0,
  });

/** Alias kept descriptive for callers that use the classroom vocabulary. */
export const CLASSROOM_ENERGY_COMPARISON_THRESHOLDS = COURSE_ENERGY_COMPARISON_THRESHOLDS;

export type ClassroomEnergyComparisonGate = boolean | null;

export type ClassroomEnergyComparisonGates = Readonly<{
  readonly dataRetention: ClassroomEnergyComparisonGate;
  readonly lowSinr: ClassroomEnergyComparisonGate;
  readonly runEe: ClassroomEnergyComparisonGate;
  readonly energySaving: ClassroomEnergyComparisonGate;
}>;

export type ClassroomEnergyComparisonReasonCode =
  | 'INVALID_INPUT'
  | 'MISSING_VALUE'
  | 'NON_FINITE_VALUE'
  | 'NEGATIVE_VALUE'
  | 'INVALID_CONTEXT_KEY'
  | 'BASELINE_ROLE_MISMATCH'
  | 'CANDIDATE_ROLE_MISMATCH'
  | 'BASELINE_TX_POWER_MISMATCH'
  | 'CANDIDATE_TX_POWER_MISMATCH'
  | 'BASELINE_DATA_DENOMINATOR_NOT_POSITIVE'
  | 'BASELINE_ENERGY_DENOMINATOR_NOT_POSITIVE'
  | 'BASELINE_RUN_EE_DENOMINATOR_NOT_POSITIVE'
  | 'CONTEXT_KEY_MISMATCH'
  | 'LOW_SINR_THRESHOLD_MISMATCH'
  | 'WINDOW_START_MISMATCH'
  | 'WINDOW_END_MISMATCH'
  | 'WINDOW_DURATION_MISMATCH'
  | 'DERIVED_VALUE_NON_FINITE';

export type ClassroomEnergyComparisonResult = Readonly<{
  readonly comparable: boolean;
  readonly dataRetentionRatio: number | null;
  readonly energySavingPct: number | null;
  readonly lowSinrDeltaPp: number | null;
  readonly runEeRatio: number | null;
  readonly gates: ClassroomEnergyComparisonGates;
  /** Data-retention and low-SINR gates only; intentionally separate from `qualified`. */
  readonly serviceQualified: boolean | null;
  /** Logical AND of all four gates. */
  readonly qualified: boolean | null;
  /** First stable reason code, or null for a comparable pair. */
  readonly reasonCode: ClassroomEnergyComparisonReasonCode | null;
  /** All stable reason codes, in deterministic validation order. */
  readonly reasonCodes: readonly ClassroomEnergyComparisonReasonCode[];
}>;

type RawArm = Record<string, unknown>;
type NumericArmField =
  | 'txPowerDbm'
  | 'windowStartSimTimeSec'
  | 'windowEndSimTimeSec'
  | 'elapsedSec'
  | 'cumulativeDataMbit'
  | 'totalEnergyJ'
  | 'lowSinrRatioPct'
  | 'runEeMbitPerJ'
  | 'lowSinrThresholdDb'
  | 'handoverCount';

const NUMERIC_ARM_FIELDS: readonly NumericArmField[] = [
  'txPowerDbm',
  'windowStartSimTimeSec',
  'windowEndSimTimeSec',
  'elapsedSec',
  'cumulativeDataMbit',
  'totalEnergyJ',
  'lowSinrRatioPct',
  'runEeMbitPerJ',
  'lowSinrThresholdDb',
  'handoverCount',
];

const NON_NEGATIVE_ARM_FIELDS: readonly NumericArmField[] = [
  'elapsedSec',
  'cumulativeDataMbit',
  'totalEnergyJ',
  'lowSinrRatioPct',
  'runEeMbitPerJ',
  'handoverCount',
];

const WITHHELD_GATES: ClassroomEnergyComparisonGates = Object.freeze({
  dataRetention: null,
  lowSinr: null,
  runEe: null,
  energySaving: null,
});

const EMPTY_REASON_CODES: readonly ClassroomEnergyComparisonReasonCode[] = Object.freeze([]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function asRawArm(value: unknown): RawArm | null {
  return typeof value === 'object' && value !== null ? value as RawArm : null;
}

function addReason(
  reasons: ClassroomEnergyComparisonReasonCode[],
  reason: ClassroomEnergyComparisonReasonCode,
): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function validateArm(
  value: unknown,
  expectedRole: ClassroomEnergyComparisonArmRole,
  expectedTxPowerDbm: number,
  roleMismatchReason: ClassroomEnergyComparisonReasonCode,
  txPowerMismatchReason: ClassroomEnergyComparisonReasonCode,
): { readonly arm: ClassroomEnergyComparisonArm | null; readonly reasonCodes: readonly ClassroomEnergyComparisonReasonCode[] } {
  const rawArm = asRawArm(value);
  if (rawArm === null) {
    return { arm: null, reasonCodes: ['INVALID_INPUT'] };
  }

  const reasons: ClassroomEnergyComparisonReasonCode[] = [];

  for (const field of NUMERIC_ARM_FIELDS) {
    const fieldValue = rawArm[field];
    if (fieldValue === undefined || fieldValue === null) {
      addReason(reasons, 'MISSING_VALUE');
      continue;
    }
    if (!isFiniteNumber(fieldValue)) {
      addReason(reasons, 'NON_FINITE_VALUE');
      continue;
    }
    if (NON_NEGATIVE_ARM_FIELDS.includes(field) && fieldValue < 0) {
      addReason(reasons, 'NEGATIVE_VALUE');
    }
  }

  if (rawArm.role !== expectedRole) addReason(reasons, roleMismatchReason);

  const txPowerDbm = rawArm.txPowerDbm;
  if (isFiniteNumber(txPowerDbm) && txPowerDbm !== expectedTxPowerDbm) {
    addReason(reasons, txPowerMismatchReason);
  }

  const comparisonContextKey = rawArm.comparisonContextKey;
  if (typeof comparisonContextKey !== 'string' || comparisonContextKey.length === 0) {
    addReason(reasons, 'INVALID_CONTEXT_KEY');
  }

  if (reasons.length > 0) return { arm: null, reasonCodes: reasons };
  return {
    arm: rawArm as unknown as ClassroomEnergyComparisonArm,
    reasonCodes: EMPTY_REASON_CODES,
  };
}

function withUniqueReasons(
  reasons: readonly ClassroomEnergyComparisonReasonCode[],
): readonly ClassroomEnergyComparisonReasonCode[] {
  return Object.freeze([...new Set(reasons)]);
}

function withheldResult(
  reasons: readonly ClassroomEnergyComparisonReasonCode[],
): ClassroomEnergyComparisonResult {
  const reasonCodes = withUniqueReasons(reasons.length > 0 ? reasons : ['INVALID_INPUT']);
  return Object.freeze({
    comparable: false,
    dataRetentionRatio: null,
    energySavingPct: null,
    lowSinrDeltaPp: null,
    runEeRatio: null,
    gates: WITHHELD_GATES,
    serviceQualified: null,
    qualified: null,
    reasonCode: reasonCodes[0] ?? 'INVALID_INPUT',
    reasonCodes,
  });
}

/**
 * Compares the frozen 24 dBm baseline arm with the frozen 23 dBm candidate arm.
 * All identity/configuration/window comparisons are exact (`===`); this API
 * intentionally exposes no implicit numeric tolerance.
 */
export function compareClassroomEnergyArms(
  baseline: ClassroomEnergyComparisonArm,
  candidate: ClassroomEnergyComparisonArm,
): ClassroomEnergyComparisonResult {
  const baselineValidation = validateArm(
    baseline,
    'baseline',
    CLASSROOM_BASELINE_TX_POWER_DBM,
    'BASELINE_ROLE_MISMATCH',
    'BASELINE_TX_POWER_MISMATCH',
  );
  const candidateValidation = validateArm(
    candidate,
    'candidate',
    CLASSROOM_CANDIDATE_TX_POWER_DBM,
    'CANDIDATE_ROLE_MISMATCH',
    'CANDIDATE_TX_POWER_MISMATCH',
  );

  const armReasons = [...baselineValidation.reasonCodes, ...candidateValidation.reasonCodes];
  if (baselineValidation.arm === null || candidateValidation.arm === null) {
    return withheldResult(armReasons);
  }

  const baselineArm = baselineValidation.arm;
  const candidateArm = candidateValidation.arm;
  const reasons: ClassroomEnergyComparisonReasonCode[] = [];

  if (baselineArm.cumulativeDataMbit <= 0) {
    addReason(reasons, 'BASELINE_DATA_DENOMINATOR_NOT_POSITIVE');
  }
  if (baselineArm.totalEnergyJ <= 0) {
    addReason(reasons, 'BASELINE_ENERGY_DENOMINATOR_NOT_POSITIVE');
  }
  if (baselineArm.runEeMbitPerJ <= 0) {
    addReason(reasons, 'BASELINE_RUN_EE_DENOMINATOR_NOT_POSITIVE');
  }
  if (baselineArm.comparisonContextKey !== candidateArm.comparisonContextKey) {
    addReason(reasons, 'CONTEXT_KEY_MISMATCH');
  }
  if (baselineArm.lowSinrThresholdDb !== candidateArm.lowSinrThresholdDb) {
    addReason(reasons, 'LOW_SINR_THRESHOLD_MISMATCH');
  }
  if (baselineArm.windowStartSimTimeSec !== candidateArm.windowStartSimTimeSec) {
    addReason(reasons, 'WINDOW_START_MISMATCH');
  }
  if (baselineArm.windowEndSimTimeSec !== candidateArm.windowEndSimTimeSec) {
    addReason(reasons, 'WINDOW_END_MISMATCH');
  }
  if (baselineArm.elapsedSec !== candidateArm.elapsedSec) {
    addReason(reasons, 'WINDOW_DURATION_MISMATCH');
  }

  if (reasons.length > 0) return withheldResult(reasons);

  const dataRetentionRatio = candidateArm.cumulativeDataMbit / baselineArm.cumulativeDataMbit;
  const energySavingPct =
    ((baselineArm.totalEnergyJ - candidateArm.totalEnergyJ) / baselineArm.totalEnergyJ) * 100;
  const lowSinrDeltaPp = candidateArm.lowSinrRatioPct - baselineArm.lowSinrRatioPct;
  const runEeRatio = candidateArm.runEeMbitPerJ / baselineArm.runEeMbitPerJ;

  if (![dataRetentionRatio, energySavingPct, lowSinrDeltaPp, runEeRatio].every(Number.isFinite)) {
    return withheldResult(['DERIVED_VALUE_NON_FINITE']);
  }

  const gates: ClassroomEnergyComparisonGates = Object.freeze({
    dataRetention:
      dataRetentionRatio >= CLASSROOM_ENERGY_COMPARISON_THRESHOLDS.minDataRetentionRatio,
    lowSinr: lowSinrDeltaPp <= CLASSROOM_ENERGY_COMPARISON_THRESHOLDS.maxLowSinrDeltaPp,
    runEe: runEeRatio >= CLASSROOM_ENERGY_COMPARISON_THRESHOLDS.minRunEeRatio,
    energySaving: energySavingPct > CLASSROOM_ENERGY_COMPARISON_THRESHOLDS.minEnergySavingPct,
  });
  const serviceQualified = gates.dataRetention === true && gates.lowSinr === true;
  const qualified =
    serviceQualified && gates.runEe === true && gates.energySaving === true;

  return Object.freeze({
    comparable: true,
    dataRetentionRatio,
    energySavingPct,
    lowSinrDeltaPp,
    runEeRatio,
    gates,
    serviceQualified,
    qualified,
    reasonCode: null,
    reasonCodes: EMPTY_REASON_CODES,
  });
}

