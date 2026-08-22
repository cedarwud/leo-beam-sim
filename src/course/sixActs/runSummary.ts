/**
 * Run-summary telemetry for the six-acts classroom slice.
 *
 * The proposal's review round found this missing outright: nothing in `src/`
 * computed `LOW_SINR_RATIO`, exported run energy / delivered data, or bridged
 * replay-rate samples to the platform's 1 Hz cadence. This module is the single
 * producer of all three, and it is deliberately headless so Act 5's sweep and
 * Act 6's upload consume the same numbers.
 *
 * Symbols follow the 2026-08-17 ACTIVE SYMBOL AUTHORITY: `R` is the per-link
 * rate, `P^N` the system power input, `η` the energy efficiency. Nothing here
 * reintroduces a deleted symbol (no `γ_req`, no required-power inversion, no
 * `P_max` cap).
 *
 * See docs/sdd/SIX-ACTS-P0-VERTICAL-SLICE-SDD.md (M2).
 */

import {
  CanonicalEeInputError,
  computeEvaluationEeFromTotals,
  computeInstantaneousEe,
} from '../../teaching';
import type { SixActsTaughtConstant } from './taughtConstants';

export type SixActsRunSummaryErrorCode =
  | 'EMPTY_RUN'
  | 'NON_MONOTONIC_SAMPLE'
  | 'INVALID_DURATION'
  | 'INVALID_THRESHOLD'
  | 'INVALID_SINR'
  | 'ATTACHMENT_INCONSISTENT';

/** A typed domain failure; a classroom number is never laundered from one. */
export class SixActsRunSummaryError extends RangeError {
  readonly code: SixActsRunSummaryErrorCode;

  constructor(code: SixActsRunSummaryErrorCode, message: string) {
    super(message);
    this.name = 'SixActsRunSummaryError';
    this.code = code;
  }
}

function fail(code: SixActsRunSummaryErrorCode, message: string): never {
  throw new SixActsRunSummaryError(code, message);
}

/**
 * One runtime step, at whatever dt the replay actually advanced by.
 *
 * `servingSatelliteId === null` means the UE is unattached — an outage, not a
 * missing measurement. Act 5's second-order trap is exactly this state, so it
 * is modelled explicitly instead of being dropped.
 */
export interface SixActsRuntimeSample {
  /** Absolute UTC milliseconds for this step. */
  readonly instantMs: number;
  /** Step duration in seconds; must be finite and positive. */
  readonly durationSec: number;
  readonly servingSatelliteId: string | null;
  /** Serving SINR in dB, or null while unattached. */
  readonly servingSinrDb: number | null;
  readonly bestCandidateSatelliteId: string | null;
  readonly bestCandidateSinrDb: number | null;
  /** Per-UE rates R in Mbit/s for this step. */
  readonly ratesMbps: readonly number[];
  /** The resolved system power P^N in W for the same step. */
  readonly systemPowerW: number;
}

export interface SixActsRunSummaryInput {
  readonly samples: readonly SixActsRuntimeSample[];
  /**
   * The `LOW_SINR_RATIO` threshold, as a LABELLED constant rather than a bare
   * number.
   *
   * Ruling 2026-08-22: the engine's attach threshold may be taught, but only as
   * "the rule this engine applies" — never as a paper or standard value. Taking
   * the whole record makes that badge travel with the number, so a screen
   * cannot show the value without its provenance. `getSixActsAttachThreshold()`
   * is the intended argument; anything else must state its own provenance.
   */
  readonly lowSinrThreshold: SixActsTaughtConstant;
  readonly runId: string;
  readonly strategyId: string;
  readonly scenarioId: string;
}

export interface SixActsRunSummary {
  readonly runId: string;
  readonly strategyId: string;
  readonly scenarioId: string;
  /** Σ_t P^N Δt, in J. */
  readonly totalEnergyJ: number;
  /** Σ_t Σ_u R Δt, in Mbit. */
  readonly deliveredDataMbit: number;
  /** Ratio-of-sums EE in Mbit/J — never a mean of per-step EE. */
  readonly runEeMbitPerJ: number;
  /** Exact low-SINR fraction in [0, 1]. */
  readonly lowSinrFraction: number;
  /** The platform field: an unsigned integer percent in [0, 100]. */
  readonly lowSinrRatioPercent: number;
  /** The numeric threshold, for arithmetic. */
  readonly lowSinrThresholdDb: number;
  /** The same threshold with its provenance, for anything that displays it. */
  readonly lowSinrThreshold: SixActsTaughtConstant;
  /** Committed serving changes between two attached states. */
  readonly numHandovers: number;
  readonly sampleCount: number;
  readonly durationSec: number;
  /** Steps spent unattached, and their wall time. */
  readonly outageSampleCount: number;
  readonly outageDurationSec: number;
  readonly startInstantMs: number;
  readonly endInstantMs: number;
}

function validateSample(sample: SixActsRuntimeSample, index: number): void {
  if (!Number.isFinite(sample.durationSec) || sample.durationSec <= 0) {
    fail('INVALID_DURATION', `sample ${index} durationSec must be finite and positive seconds`);
  }
  if (!Number.isFinite(sample.instantMs)) {
    fail('NON_MONOTONIC_SAMPLE', `sample ${index} instantMs must be finite`);
  }
  const attached = sample.servingSatelliteId !== null;
  if (attached !== (sample.servingSinrDb !== null)) {
    fail(
      'ATTACHMENT_INCONSISTENT',
      `sample ${index} must carry a serving SINR exactly when it is attached`,
    );
  }
  if (sample.servingSinrDb !== null && !Number.isFinite(sample.servingSinrDb)) {
    fail('INVALID_SINR', `sample ${index} serving SINR must be finite dB`);
  }
  if (sample.bestCandidateSinrDb !== null && !Number.isFinite(sample.bestCandidateSinrDb)) {
    fail('INVALID_SINR', `sample ${index} candidate SINR must be finite dB`);
  }
}

/**
 * Aggregates one run.
 *
 * `numHandovers` counts a change of serving satellite between two ATTACHED
 * steps. An attach or a drop is not a handover — the engine's inter-handover
 * rule is relative and never fires on re-attachment, so counting them would
 * manufacture the "low power causes more handovers" story the review round
 * established is false in this engine.
 *
 * `LOW_SINR_RATIO` counts an unattached step as failing. Dropping outage steps
 * would launder away the very effect Act 5 is teaching.
 */
export function summarizeSixActsRun(input: SixActsRunSummaryInput): SixActsRunSummary {
  const { samples } = input;
  if (samples.length === 0) {
    fail('EMPTY_RUN', 'a run summary needs at least one sample');
  }
  const threshold = input.lowSinrThreshold;
  if (threshold === undefined || threshold === null || !Number.isFinite(threshold.value)) {
    fail('INVALID_THRESHOLD', 'the low-SINR threshold must be a labelled constant with a finite value');
  }
  if (threshold.captionZhHant.trim() === '') {
    fail('INVALID_THRESHOLD', 'a taught threshold must carry the caption shown beside it');
  }
  if (threshold.provenance === 'PAPER' && threshold.sourceRef === null) {
    fail('INVALID_THRESHOLD', 'a PAPER-class constant must name its source');
  }

  let totalEnergyJ = 0;
  let deliveredDataMbit = 0;
  let durationSec = 0;
  let lowSinrSampleCount = 0;
  let outageSampleCount = 0;
  let outageDurationSec = 0;
  let numHandovers = 0;
  let previousAttachedId: string | null = null;
  let previousInstantMs: number | null = null;

  samples.forEach((sample, index) => {
    validateSample(sample, index);
    if (previousInstantMs !== null && sample.instantMs <= previousInstantMs) {
      fail('NON_MONOTONIC_SAMPLE', `sample ${index} does not advance past ${previousInstantMs} ms`);
    }
    previousInstantMs = sample.instantMs;

    const instantaneous = computeInstantaneousEe({
      ratesMbps: sample.ratesMbps,
      systemPowerW: sample.systemPowerW,
    });
    deliveredDataMbit += instantaneous.totalThroughputMbps * sample.durationSec;
    totalEnergyJ += instantaneous.systemPowerW * sample.durationSec;
    durationSec += sample.durationSec;

    if (sample.servingSatelliteId === null) {
      outageSampleCount += 1;
      outageDurationSec += sample.durationSec;
      lowSinrSampleCount += 1;
      // A drop breaks the chain: the next attach is not a handover.
      previousAttachedId = null;
      return;
    }

    if ((sample.servingSinrDb as number) < threshold.value) {
      lowSinrSampleCount += 1;
    }
    if (previousAttachedId !== null && previousAttachedId !== sample.servingSatelliteId) {
      numHandovers += 1;
    }
    previousAttachedId = sample.servingSatelliteId;
  });

  const evaluation = computeEvaluationEeFromTotals({
    totalDataMbit: deliveredDataMbit,
    totalEnergyJ,
  });
  const lowSinrFraction = lowSinrSampleCount / samples.length;

  return Object.freeze({
    runId: input.runId,
    strategyId: input.strategyId,
    scenarioId: input.scenarioId,
    totalEnergyJ: evaluation.totalEnergyJ,
    deliveredDataMbit: evaluation.totalDataMbit,
    runEeMbitPerJ: evaluation.eeEvalMbitPerJ,
    lowSinrFraction,
    lowSinrRatioPercent: Math.round(lowSinrFraction * 100),
    lowSinrThresholdDb: threshold.value,
    lowSinrThreshold: threshold,
    numHandovers,
    sampleCount: samples.length,
    durationSec,
    outageSampleCount,
    outageDurationSec,
    startInstantMs: samples[0].instantMs,
    endInstantMs: samples[samples.length - 1].instantMs,
  });
}

/** One second of run history, in the shape the platform's 1 Hz fields want. */
export interface SixActsOneHzSample {
  /** Start of the whole second, in UTC milliseconds. */
  readonly secondEpochMs: number;
  readonly attached: boolean;
  /** Serving SINR at the end of the second, or null while unattached. */
  readonly currentSinrDb: number | null;
  readonly bestCandidateSinrDb: number | null;
  /** candidate − serving, or null when either side is missing. */
  readonly sinrGainDb: number | null;
  /** 1 when a handover committed anywhere inside the second. */
  readonly handoverEvent: 0 | 1;
  /** How many runtime steps fell in this second. */
  readonly sourceSampleCount: number;
}

/**
 * Resamples runtime steps onto the platform's 1 Hz grid.
 *
 * Two rules, both load-bearing:
 *   - level quantities are LAST-WINS inside the second (the value a viewer of
 *     the chart would have seen at the tick);
 *   - `handoverEvent` is an OR across the second. A handover that commits
 *     between two ticks is still a handover; last-wins would erase it.
 *
 * Seconds with no runtime step are not invented — the grid is sparse by design,
 * and the ledger reports the gap rather than interpolating over it.
 */
export function resampleSixActsRunToOneHz(
  samples: readonly SixActsRuntimeSample[],
): readonly SixActsOneHzSample[] {
  const buckets = new Map<number, {
    attached: boolean;
    currentSinrDb: number | null;
    bestCandidateSinrDb: number | null;
    handoverEvent: 0 | 1;
    sourceSampleCount: number;
  }>();
  const order: number[] = [];
  let previousAttachedId: string | null = null;
  let previousInstantMs: number | null = null;

  samples.forEach((sample, index) => {
    validateSample(sample, index);
    if (previousInstantMs !== null && sample.instantMs <= previousInstantMs) {
      fail('NON_MONOTONIC_SAMPLE', `sample ${index} does not advance past ${previousInstantMs} ms`);
    }
    previousInstantMs = sample.instantMs;

    const secondEpochMs = Math.floor(sample.instantMs / 1000) * 1000;
    let bucket = buckets.get(secondEpochMs);
    if (bucket === undefined) {
      bucket = {
        attached: false,
        currentSinrDb: null,
        bestCandidateSinrDb: null,
        handoverEvent: 0,
        sourceSampleCount: 0,
      };
      buckets.set(secondEpochMs, bucket);
      order.push(secondEpochMs);
    }

    const attached = sample.servingSatelliteId !== null;
    if (attached && previousAttachedId !== null && previousAttachedId !== sample.servingSatelliteId) {
      bucket.handoverEvent = 1;
    }
    previousAttachedId = attached ? sample.servingSatelliteId : null;

    bucket.attached = attached;
    bucket.currentSinrDb = sample.servingSinrDb;
    bucket.bestCandidateSinrDb = sample.bestCandidateSinrDb;
    bucket.sourceSampleCount += 1;
  });

  return Object.freeze(order.map(secondEpochMs => {
    const bucket = buckets.get(secondEpochMs)!;
    const gain = bucket.currentSinrDb === null || bucket.bestCandidateSinrDb === null
      ? null
      : bucket.bestCandidateSinrDb - bucket.currentSinrDb;
    return Object.freeze({
      secondEpochMs,
      attached: bucket.attached,
      currentSinrDb: bucket.currentSinrDb,
      bestCandidateSinrDb: bucket.bestCandidateSinrDb,
      sinrGainDb: gain,
      handoverEvent: bucket.handoverEvent,
      sourceSampleCount: bucket.sourceSampleCount,
    });
  }));
}

export { CanonicalEeInputError };
