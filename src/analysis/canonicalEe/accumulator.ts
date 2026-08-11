import {
  CanonicalEeInputError,
  type CanonicalEeEvaluation,
  type CanonicalEeEvaluationSample,
  type CanonicalEeResult,
} from './types';

function fail(code: ConstructorParameters<typeof CanonicalEeInputError>[0], message: string): never {
  throw new CanonicalEeInputError(code, message);
}

function finiteNonNegative(value: number, name: string): number {
  if (!Number.isFinite(value)) fail('INVALID_AGGREGATE', `${name} must be finite`);
  if (value < 0) fail('INVALID_AGGREGATE', `${name} must be non-negative`);
  return value;
}

function positiveDuration(value: number): number {
  if (!Number.isFinite(value) || value <= 0) fail('INVALID_DURATION', 'durationSec must be finite and positive');
  return value;
}

function freezeEvaluation(value: CanonicalEeEvaluation): CanonicalEeEvaluation {
  return Object.freeze(value);
}

/** Canonical ratio-of-sums over explicit frame durations. */
export function computeCanonicalEvaluation(
  samples: readonly CanonicalEeEvaluationSample[],
): CanonicalEeEvaluation {
  if (!Array.isArray(samples)) fail('INVALID_AGGREGATE', 'samples must be an array');
  let deliveredBits = 0;
  let consumedEnergyJ = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (sample === null || typeof sample !== 'object') fail('INVALID_AGGREGATE', `samples[${index}] must be an object`);
    const totalRateBps = finiteNonNegative(sample.totalRateBps, `samples[${index}].totalRateBps`);
    const systemPowerW = finiteNonNegative(sample.systemPowerW, `samples[${index}].systemPowerW`);
    const durationSec = positiveDuration(sample.durationSec);
    deliveredBits += totalRateBps * durationSec;
    consumedEnergyJ += systemPowerW * durationSec;
    if (!Number.isFinite(deliveredBits) || !Number.isFinite(consumedEnergyJ)) {
      fail('INVALID_AGGREGATE', 'delivered bits and consumed energy must remain finite');
    }
  }
  if (consumedEnergyJ === 0) {
    if (deliveredBits > 0) fail('POSITIVE_RATE_ZERO_POWER', 'positive delivered bits with zero consumed energy is invalid');
    return freezeEvaluation({
      status: 'zero-activity',
      deliveredBits: 0,
      consumedEnergyJ: 0,
      energyEfficiencyBitsPerJ: 0,
      zeroOverZero: true,
    });
  }
  return freezeEvaluation({
    status: 'valid',
    deliveredBits,
    consumedEnergyJ,
    energyEfficiencyBitsPerJ: deliveredBits / consumedEnergyJ,
    zeroOverZero: false,
  });
}

export function computeCanonicalEvaluationFromTotals(
  deliveredBits: number,
  consumedEnergyJ: number,
): CanonicalEeEvaluation {
  finiteNonNegative(deliveredBits, 'deliveredBits');
  finiteNonNegative(consumedEnergyJ, 'consumedEnergyJ');
  return computeCanonicalEvaluation([{
    totalRateBps: deliveredBits,
    systemPowerW: consumedEnergyJ,
    durationSec: 1,
  }]);
}

/**
 * Stateful ratio-of-sums accumulator. `append` accepts a derived producer
 * result and never recomputes a rate or power formula; it only adds
 * delivered bits and consumed joules for the supplied duration.
 */
export class CanonicalEeAccumulator {
  private deliveredBits = 0;
  private consumedEnergyJ = 0;
  private sampleCount = 0;

  snapshot(): CanonicalEeEvaluation & { readonly sampleCount: number } {
    const evaluation = computeCanonicalEvaluationFromTotals(this.deliveredBits, this.consumedEnergyJ);
    return Object.freeze({ ...evaluation, sampleCount: this.sampleCount });
  }

  reset(): CanonicalEeEvaluation & { readonly sampleCount: number } {
    this.deliveredBits = 0;
    this.consumedEnergyJ = 0;
    this.sampleCount = 0;
    return this.snapshot();
  }

  append(
    frame: CanonicalEeResult,
    durationSec: number = frame.inputs.config.frameDurationS,
  ): CanonicalEeEvaluation & { readonly sampleCount: number } {
    positiveDuration(durationSec);
    const rate = finiteNonNegative(frame.throughput.totalRateBps, 'frame.throughput.totalRateBps');
    const power = finiteNonNegative(frame.power.systemPowerW, 'frame.power.systemPowerW');
    const nextBits = this.deliveredBits + rate * durationSec;
    const nextEnergy = this.consumedEnergyJ + power * durationSec;
    if (!Number.isFinite(nextBits) || !Number.isFinite(nextEnergy)) fail('INVALID_AGGREGATE', 'accumulator totals must remain finite');
    // Validate before mutating so a positive-rate/zero-energy sequence cannot
    // leave a partially accepted state behind.
    const next = computeCanonicalEvaluationFromTotals(nextBits, nextEnergy);
    this.deliveredBits = nextBits;
    this.consumedEnergyJ = nextEnergy;
    this.sampleCount += 1;
    return Object.freeze({ ...next, sampleCount: this.sampleCount });
  }
}

/** Short aliases for adapters that use the SDD's evaluation naming. */
export const evaluationEnergyEfficiency = computeCanonicalEvaluation;
export const evaluationEnergyEfficiencyFromTotals = computeCanonicalEvaluationFromTotals;
export const CanonicalEeRatioOfSumsAccumulator = CanonicalEeAccumulator;
