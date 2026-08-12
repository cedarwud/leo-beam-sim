/**
 * ADR-003 energy-efficiency aggregation used by the retained canonical
 * Walker producer.
 *
 * Units are deliberately explicit:
 *   - `ratesMbps`: R_u in Mbit/s
 *   - `systemPowerW`: the selected instantaneous system-power input in W
 *   - `contributionsMbitPerJ` / `eeInstMbitPerJ`: Mbit/J
 *   - `durationSec`: seconds
 *   - `totalDataMbit` / `totalEnergyJ`: Mbit / J
 *
 * This module owns the EE aggregation seam, not the physical source of power.
 * Callers must supply one already-resolved canonical `P_sys` for the same
 * frame as the rate vector. No classroom power-chain input belongs here.
 */

export const CANONICAL_EE_UNITS = {
  rate: 'Mbit/s',
  power: 'W',
  duration: 's',
  energy: 'J',
  efficiency: 'Mbit/J',
} as const;

export type CanonicalEeInputErrorCode =
  | 'INVALID_RATE_VECTOR'
  | 'NEGATIVE_RATE'
  | 'NON_FINITE_RATE'
  | 'NEGATIVE_POWER'
  | 'NON_FINITE_POWER'
  | 'POSITIVE_RATE_ZERO_POWER'
  | 'INVALID_DURATION'
  | 'NON_FINITE_TOTAL'
  | 'SUM_IDENTITY_FAILED';

/** A typed domain failure; callers must not launder it into a numeric zero. */
export class CanonicalEeInputError extends RangeError {
  readonly code: CanonicalEeInputErrorCode;

  constructor(code: CanonicalEeInputErrorCode, message: string) {
    super(message);
    this.name = 'CanonicalEeInputError';
    this.code = code;
  }
}

export interface InstantaneousPowerComponent {
  /** Human-readable provenance for diagnostics; it does not change the math. */
  readonly label: string;
  /** Component power in W. Negative and non-finite inputs are invalid. */
  readonly powerW: number;
}

/**
 * The one additive boundary used to construct the instantaneous power input.
 * This is deliberately generic: it does not map a teaching circuit knob to
 * ADR `P_RFC`, `P_BB`, or `P_sys`.
 */
export function sumInstantaneousPowerW(
  components: readonly InstantaneousPowerComponent[],
): number {
  let totalPowerW = 0;

  for (const component of components) {
    if (!Number.isFinite(component.powerW)) {
      throw new CanonicalEeInputError(
        'NON_FINITE_POWER',
        `${component.label} must be finite power in W`,
      );
    }
    if (component.powerW < 0) {
      throw new CanonicalEeInputError(
        'NEGATIVE_POWER',
        `${component.label} must be non-negative power in W`,
      );
    }
    totalPowerW += component.powerW;
  }

  if (!Number.isFinite(totalPowerW)) {
    throw new CanonicalEeInputError(
      'NON_FINITE_POWER',
      'the instantaneous power sum must be finite in W',
    );
  }

  return totalPowerW;
}

export interface InstantaneousEeInput {
  /** Per-user throughput values R_u in Mbit/s. */
  readonly ratesMbps: readonly number[];
  /** One instantaneous system-power input in W. */
  readonly systemPowerW: number;
}

export type InstantaneousEeStatus = 'valid' | 'zero-activity';

export interface InstantaneousEeResult {
  readonly status: InstantaneousEeStatus;
  /** Σ_u R_u in Mbit/s. */
  readonly totalThroughputMbps: number;
  /** The exact power input used by every contribution, in W. */
  readonly systemPowerW: number;
  /** r_{1,u} = R_u / P_sys, in Mbit/J. */
  readonly contributionsMbitPerJ: readonly number[];
  /** Σ_u r_{1,u}, in Mbit/J. */
  readonly contributionSumMbitPerJ: number;
  /** EE_inst = Σ_u R_u / P_sys, in Mbit/J. */
  readonly eeInstMbitPerJ: number;
  /** True only after the additive sum identity has been checked. */
  readonly sumIdentity: true;
}

function invalidRate(code: 'NEGATIVE_RATE' | 'NON_FINITE_RATE', value: number): never {
  throw new CanonicalEeInputError(code, `throughput ${String(value)} must be valid Mbit/s`);
}

function validateRates(ratesMbps: readonly number[]): number {
  if (!Array.isArray(ratesMbps)) {
    throw new CanonicalEeInputError(
      'INVALID_RATE_VECTOR',
      'ratesMbps must be an array of per-user throughput values',
    );
  }

  let totalThroughputMbps = 0;
  for (const rateMbps of ratesMbps) {
    if (!Number.isFinite(rateMbps)) invalidRate('NON_FINITE_RATE', rateMbps);
    if (rateMbps < 0) invalidRate('NEGATIVE_RATE', rateMbps);
    totalThroughputMbps += rateMbps;
  }

  if (!Number.isFinite(totalThroughputMbps)) {
    throw new CanonicalEeInputError(
      'NON_FINITE_RATE',
      'the summed throughput must be finite in Mbit/s',
    );
  }
  return totalThroughputMbps;
}

function validateSystemPower(systemPowerW: number): void {
  if (!Number.isFinite(systemPowerW)) {
    throw new CanonicalEeInputError(
      'NON_FINITE_POWER',
      'systemPowerW must be finite power in W',
    );
  }
  if (systemPowerW < 0) {
    throw new CanonicalEeInputError(
      'NEGATIVE_POWER',
      'systemPowerW must be non-negative power in W',
    );
  }
}

function assertSumIdentity(
  contributionSumMbitPerJ: number,
  eeInstMbitPerJ: number,
): void {
  if (!Number.isFinite(contributionSumMbitPerJ) || !Number.isFinite(eeInstMbitPerJ)) {
    throw new CanonicalEeInputError(
      'SUM_IDENTITY_FAILED',
      'the contribution sum and instantaneous EE must be finite',
    );
  }

  const tolerance = 1e-12 * Math.max(
    1,
    Math.abs(contributionSumMbitPerJ),
    Math.abs(eeInstMbitPerJ),
  );
  if (Math.abs(contributionSumMbitPerJ - eeInstMbitPerJ) > tolerance) {
    throw new CanonicalEeInputError(
      'SUM_IDENTITY_FAILED',
      'Σ_u r_{1,u} must equal EE_inst',
    );
  }
}

/**
 * Computes the instantaneous additive EE seam.
 *
 * Zero throughput with zero power is a named zero-activity result. Positive
 * throughput with zero power is invalid and throws; no epsilon denominator is
 * introduced. Positive power always checks Σ_u r_{1,u} = EE_inst.
 */
export function computeInstantaneousEe(input: InstantaneousEeInput): InstantaneousEeResult {
  const totalThroughputMbps = validateRates(input.ratesMbps);
  validateSystemPower(input.systemPowerW);

  if (input.systemPowerW === 0) {
    if (totalThroughputMbps > 0) {
      throw new CanonicalEeInputError(
        'POSITIVE_RATE_ZERO_POWER',
        'positive throughput cannot be evaluated with zero system power',
      );
    }

    return {
      status: 'zero-activity',
      totalThroughputMbps,
      systemPowerW: input.systemPowerW,
      contributionsMbitPerJ: input.ratesMbps.map(() => 0),
      contributionSumMbitPerJ: 0,
      eeInstMbitPerJ: 0,
      sumIdentity: true,
    };
  }

  const contributionsMbitPerJ = input.ratesMbps.map(rateMbps => rateMbps / input.systemPowerW);
  const contributionSumMbitPerJ = contributionsMbitPerJ.reduce(
    (sum, contribution) => sum + contribution,
    0,
  );
  const eeInstMbitPerJ = totalThroughputMbps / input.systemPowerW;
  assertSumIdentity(contributionSumMbitPerJ, eeInstMbitPerJ);

  return {
    status: 'valid',
    totalThroughputMbps,
    systemPowerW: input.systemPowerW,
    contributionsMbitPerJ,
    contributionSumMbitPerJ,
    eeInstMbitPerJ,
    sumIdentity: true,
  };
}

export interface EvaluationEeStep {
  /** Per-user throughput values R_u in Mbit/s for this step. */
  readonly ratesMbps: readonly number[];
  /** The same instantaneous system-power input used by the step, in W. */
  readonly systemPowerW: number;
  /** Step duration in seconds. */
  readonly durationSec: number;
}

export interface EvaluationEeTotals {
  /** Σ_t Σ_u R_u Δt in Mbit. */
  readonly totalDataMbit: number;
  /** Σ_t P_sys Δt in J. */
  readonly totalEnergyJ: number;
}

export interface EvaluationEeResult extends EvaluationEeTotals {
  readonly status: InstantaneousEeStatus;
  /** EE_eval = (Σ_t Σ_u R_u Δt) / (Σ_t P_sys Δt), in Mbit/J. */
  readonly eeEvalMbitPerJ: number;
}

/**
 * Evaluates already-aggregated canonical ratio-of-sums totals while preserving
 * the same fail-closed domain rules as the instantaneous path.
 */
export function computeEvaluationEeFromTotals(totals: EvaluationEeTotals): EvaluationEeResult {
  if (!Number.isFinite(totals.totalDataMbit)) {
    throw new CanonicalEeInputError(
      'NON_FINITE_TOTAL',
      'totalDataMbit must be finite and non-negative',
    );
  }
  if (totals.totalDataMbit < 0) {
    throw new CanonicalEeInputError(
      'NEGATIVE_RATE',
      'totalDataMbit must be non-negative',
    );
  }
  if (!Number.isFinite(totals.totalEnergyJ)) {
    throw new CanonicalEeInputError(
      'NON_FINITE_TOTAL',
      'totalEnergyJ must be finite and non-negative',
    );
  }
  if (totals.totalEnergyJ < 0) {
    throw new CanonicalEeInputError(
      'NEGATIVE_POWER',
      'totalEnergyJ must be non-negative',
    );
  }

  if (totals.totalEnergyJ === 0) {
    if (totals.totalDataMbit > 0) {
      throw new CanonicalEeInputError(
        'POSITIVE_RATE_ZERO_POWER',
        'positive delivered data cannot be evaluated with zero energy',
      );
    }
    return {
      status: 'zero-activity',
      totalDataMbit: 0,
      totalEnergyJ: 0,
      eeEvalMbitPerJ: 0,
    };
  }

  const eeEvalMbitPerJ = totals.totalDataMbit / totals.totalEnergyJ;
  if (!Number.isFinite(eeEvalMbitPerJ)) {
    throw new CanonicalEeInputError(
      'NON_FINITE_TOTAL',
      'EE_eval must be finite in Mbit/J',
    );
  }

  return {
    status: 'valid',
    totalDataMbit: totals.totalDataMbit,
    totalEnergyJ: totals.totalEnergyJ,
    eeEvalMbitPerJ,
  };
}

/**
 * Computes cross-step ratio-of-sums EE. Every step first passes the
 * instantaneous domain and sum-identity checks, then its rate and power are
 * integrated with the same duration before the final ratio is formed.
 */
export function computeEvaluationEe(
  steps: readonly EvaluationEeStep[],
): EvaluationEeResult {
  let totalDataMbit = 0;
  let totalEnergyJ = 0;

  for (const step of steps) {
    if (!Number.isFinite(step.durationSec) || step.durationSec <= 0) {
      throw new CanonicalEeInputError(
        'INVALID_DURATION',
        'durationSec must be finite and positive seconds',
      );
    }

    const instantaneous = computeInstantaneousEe({
      ratesMbps: step.ratesMbps,
      systemPowerW: step.systemPowerW,
    });
    totalDataMbit += instantaneous.totalThroughputMbps * step.durationSec;
    totalEnergyJ += instantaneous.systemPowerW * step.durationSec;
  }

  if (!Number.isFinite(totalDataMbit) || !Number.isFinite(totalEnergyJ)) {
    throw new CanonicalEeInputError(
      'NON_FINITE_TOTAL',
      'cross-step data and energy totals must be finite',
    );
  }

  return computeEvaluationEeFromTotals({ totalDataMbit, totalEnergyJ });
}
