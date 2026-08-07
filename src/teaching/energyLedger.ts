/**
 * Teaching energy ledger — the time-integration layer over
 * `src/teaching/energyModel.ts`'s instantaneous power/throughput readings.
 *
 * Run-level EE is only ever `Σ Mbit / Σ J`. This module exists specifically
 * so nobody is tempted to approximate that with a per-sample
 * `mean(throughput / power)`, which is a materially different (and
 * misleading) statistic. See CONTRACT §1 / §4.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE ACCUMULATION WINDOW MEANS
 * ---------------------------------------------------------------------------
 * Every Σ in this module — `cumulativeDataMbit`, `cumulativeEnergyJ`,
 * `elapsedSec`, `handoverCount` — covers exactly one interval:
 *
 *     from the last change of any parameter that affects the energy model,
 *     up to the sample being processed right now.
 *
 * It is NOT "since the app started" and NOT "since the simulation started".
 * The window is deliberately narrow: energy accumulated under a different
 * Tx power, bandwidth, eta_PA or per-handover cost describes a *different
 * experiment*, and carrying it forward would publish a Σ that never happened
 * under any single configuration.
 *
 * The window restarts (state returns to `EMPTY_ENERGY_LEDGER`, or is rebuilt
 * from scratch by the caller) on exactly these conditions:
 *
 *   1. `simTimeSec` is non-finite. No valid timestamp can be established, so
 *      the ledger resets rather than risk NaN-poisoning every later sample.
 *   2. `dt < 0` — the timeline seeked backwards.
 *   3. `dt > 2` — the timeline seeked forward or the run looped/wrapped.
 *      Integrating across a jump would fabricate energy and data that was
 *      never delivered.
 *   4. `dt` is non-finite for any other reason.
 *   5. Any parameter that changes the EE numerator (R) or denominator
 *      (P_total, E_HO) changed. This one is enforced by the *caller*, not by
 *      `advanceEnergyLedger`: the caller compares `getEnergyLedgerResetKey(...)`
 *      against the key it used for the previous sample and, on a mismatch,
 *      hands `EMPTY_ENERGY_LEDGER` back in. The key covers every field of
 *      `SignalTuningState` (see `getEnergyLedgerSignalKey` in
 *      `src/signalTuning.ts`) plus every field of `EnergyTuningState`.
 *
 * Two things that look like resets but are NOT:
 *
 *   - A sample whose `throughputMbps` or `totalPowerW` failed closed to `null`
 *     does not reset the window; it advances the clock only. Nothing is
 *     integrated across that interval — not data, not energy, not `elapsedSec`,
 *     and not handover events (see below) — so the interval is simply excluded
 *     from the window rather than restarting it.
 *   - The upstream cumulative handover counter restarting (going down) only
 *     re-baselines the handover tally; the energy/data Σs are untouched.
 *
 * ---------------------------------------------------------------------------
 * HANDOVER ENERGY
 * ---------------------------------------------------------------------------
 *     E_HO    = handoverCount * energyPerHandoverJ
 *     E_total = Σ P_total·Δt + E_HO
 *     Run EE  = Σ Mbit / E_total
 *
 * `handoverCount` is derived from an upstream counter that is *cumulative and
 * monotonically non-decreasing* (`SimState.hoCount` = `hoManager.eventLog.length`),
 * so the ledger stores a baseline (`lastCumulativeHandoverCount`) and credits
 * only the per-step delta. The baseline is part of the ledger state, so every
 * reset path above drops it too and the next sample re-baselines — a reset can
 * never re-charge handovers that happened before it.
 *
 * Pure functions only: no React, no scene, no App imports.
 */

import {
  DEFAULT_ENERGY_PER_HANDOVER_J,
  resolveEnergyPerHandoverJ,
  type EnergyTuningState,
} from './energyModel';
import {
  CanonicalEeInputError,
  computeEvaluationEeFromTotals,
  computeInstantaneousEe,
  type InstantaneousEeResult,
} from './canonicalEnergyEfficiency';

export interface EnergyLedgerState {
  readonly cumulativeDataMbit: number;
  readonly cumulativeEnergyJ: number;
  readonly elapsedSec: number;
  readonly lastSimTimeSec: number | null;
  /** Handover events credited to *this* accumulation window (a delta tally). */
  readonly handoverCount: number;
  /**
   * Last observed value of the upstream *cumulative* handover counter. `null`
   * means "no baseline yet"; the next valid observation establishes one without
   * crediting anything.
   */
  readonly lastCumulativeHandoverCount: number | null;
  /**
   * Accumulated samples whose serving SINR was BELOW the low-SINR threshold, and
   * the number of samples that carried a usable SINR at all. The ratio of the
   * two is the course contract's `lowSinrRatioPct` — the third of the four
   * qualified-saving gates, which exists to stop "savings" bought by letting
   * service quality collapse.
   *
   * Counted per SAMPLE, not weighted by `dt`, to match the contract's own
   * definition (`lowSinrCount / series.length`). Note that this app's samples
   * are NOT evenly spaced in sim time, so the ratio answers "what fraction of
   * observations were bad", not "what fraction of time was bad". Those coincide
   * only when the publish cadence is uniform.
   */
  readonly lowSinrSampleCount: number;
  readonly sinrSampleCount: number;
}

export const EMPTY_ENERGY_LEDGER: EnergyLedgerState = {
  cumulativeDataMbit: 0,
  cumulativeEnergyJ: 0,
  elapsedSec: 0,
  lastSimTimeSec: null,
  handoverCount: 0,
  lastCumulativeHandoverCount: null,
  lowSinrSampleCount: 0,
  sinrSampleCount: 0,
};

/**
 * Course-contract default for the low-SINR threshold, in dB.
 *
 * `COURSE-DEFINED`, not a 3GPP value: it is a teaching guardrail agreed for
 * `energy-lab-v1` and must be labelled as such wherever it is displayed.
 */
export const DEFAULT_LOW_SINR_THRESHOLD_DB = 14;

/**
 * Fallback bound on a single sample's `dt` when the caller does not supply one.
 * Kept at the historical 2 s so existing callers and tests are unaffected.
 *
 * A caller that drives the ledger from a THROTTLED UI publisher must override
 * this: the sim time between two published frames is `playbackSpeed × the wall
 * gap between publishes`, which at the 5× default already exceeds 2 s. Leaving
 * the constant in place there makes every normal playback step look like a seek
 * and wipe the window before it accumulates anything visible.
 */
export const DEFAULT_MAX_SAMPLE_GAP_SEC = 2;

export interface EnergyLedgerSample {
  readonly simTimeSec: number;
  readonly throughputMbps: number | null;
  readonly totalPowerW: number | null;
  /**
   * The upstream **cumulative** handover count (`SimState.hoCount`), not a
   * per-step increment.
   *
   * Cumulative rather than incremental is not a stylistic choice: the publisher
   * throttles frames, so a per-step increment computed by the caller would drop
   * events that happened between two published frames, and any missed render
   * would silently lose them for good. A cumulative counter differenced against
   * a stored baseline is self-healing — it recovers the full count on the next
   * sample no matter how many frames were skipped.
   *
   * Omitted / `null` / non-finite / negative means "no trustworthy count this
   * step": the tally and the baseline are both held unchanged, so the events
   * are recovered on the next sample that does carry a usable value.
   */
  readonly cumulativeHandoverCount?: number | null;
  /**
   * Largest `dt` (in sim seconds) this sample may legitimately carry before it
   * is treated as a cursor discontinuity. Omitted / non-finite / non-positive
   * falls back to `DEFAULT_MAX_SAMPLE_GAP_SEC`.
   *
   * This is a PROPERTY OF THE SAMPLING CADENCE, not of the physics, so only the
   * caller can compute it: the ledger sees neither the playback speed nor the
   * wall-clock gap between publishes.
   */
  readonly maxSampleGapSec?: number | null;
  /**
   * Serving SINR for this sample, in dB, used only to tally the low-SINR ratio.
   *
   * Omitted / `null` / non-finite means "no trustworthy quality reading this
   * step": neither counter moves, so the ratio stays a statement about samples
   * that actually carried a reading. `-Infinity` is a legitimate no-service
   * state upstream, but it is NOT counted here — an unserved UE is a coverage
   * problem, and folding it into a quality ratio would double-charge it.
   */
  readonly servingSinrDb?: number | null;
  /**
   * Threshold below which a sample counts as low-SINR, in dB. Falls back to
   * `DEFAULT_LOW_SINR_THRESHOLD_DB`. Strict `<`, matching the contract.
   */
  readonly lowSinrThresholdDb?: number | null;
}

type HandoverTally = Pick<EnergyLedgerState, 'handoverCount' | 'lastCumulativeHandoverCount'>;

/**
 * Advances the handover tally against an upstream cumulative counter.
 *
 * `mode`:
 * - `'credit'` — a normally integrated interval; the delta is added.
 * - `'rebaseline'` — an interval that is *not* part of the window (the sample's
 *   physics reading failed closed, so no data/energy/elapsed time was
 *   integrated either). The baseline still moves so the events are not
 *   re-charged later, but nothing is credited: charging E_HO for an interval
 *   that contributed no data and no radio energy would deflate Run EE with
 *   events from outside the accounted window.
 *
 * A *decrease* means the upstream counter itself restarted (a rebuilt
 * `HandoverManager`, or `reset()` clearing `eventLog`). The ledger cannot tell
 * how many of the new counter's events are genuinely new, so it re-baselines
 * and credits nothing — undercounting by at most the events observed in that
 * single step, rather than fabricating a spike.
 */
function stepHandoverTally(
  prev: HandoverTally,
  raw: number | null | undefined,
  mode: 'credit' | 'rebaseline',
): HandoverTally {
  if (raw === null || raw === undefined || !Number.isFinite(raw) || raw < 0) {
    return {
      handoverCount: prev.handoverCount,
      lastCumulativeHandoverCount: prev.lastCumulativeHandoverCount,
    };
  }

  if (prev.lastCumulativeHandoverCount === null || mode === 'rebaseline') {
    return { handoverCount: prev.handoverCount, lastCumulativeHandoverCount: raw };
  }

  const delta = raw - prev.lastCumulativeHandoverCount;
  if (!Number.isFinite(delta) || delta < 0) {
    return { handoverCount: prev.handoverCount, lastCumulativeHandoverCount: raw };
  }

  return {
    handoverCount: prev.handoverCount + delta,
    lastCumulativeHandoverCount: raw,
  };
}

/**
 * Pure accumulator step. `dt` is derived from `simTimeSec - prev.lastSimTimeSec`.
 *
 * Fail-closed rules, in order:
 * 1. A non-finite `simTimeSec` can't establish a valid timestamp at all —
 *    reset to `EMPTY_ENERGY_LEDGER` rather than risk NaN-poisoning the ledger.
 * 2. `prev.lastSimTimeSec === null` (first sample ever, or just reset) only
 *    records the timestamp and the handover baseline; nothing is known to have
 *    elapsed yet, so nothing accumulates.
 * 3. A non-finite `dt`, or `dt < 0` (seek backwards) or `dt` beyond the sample's
 *    `maxSampleGapSec` (seek forward / loop wrap) means the timeline itself is
 *    not trustworthy right now —
 *    reset to `EMPTY_ENERGY_LEDGER`. Never integrate across a jump; that would
 *    fabricate energy/data that was never actually delivered. The handover
 *    baseline resets with it, so post-reset samples cannot re-charge
 *    pre-reset handovers.
 * 4. A `null` (or non-finite) `throughputMbps` / `totalPowerW` means this
 *    particular sample's physics reading was itself untrustworthy (e.g. the
 *    power train or throughput function failed closed to `null` upstream).
 *    Advance the clock and re-baseline handovers only — never accumulate a
 *    fabricated 0 in its place.
 * 5. Otherwise: normal accumulation, handover delta credited.
 */
export function advanceEnergyLedger(
  prev: EnergyLedgerState,
  sample: EnergyLedgerSample,
): EnergyLedgerState {
  const { simTimeSec, throughputMbps, totalPowerW, cumulativeHandoverCount } = sample;

  if (!Number.isFinite(simTimeSec)) {
    return EMPTY_ENERGY_LEDGER;
  }

  const rebaselineSample = (): EnergyLedgerState => ({
    ...prev,
    lastSimTimeSec: simTimeSec,
    ...stepHandoverTally(prev, cumulativeHandoverCount, 'rebaseline'),
  });

  if (prev.lastSimTimeSec === null) {
    return rebaselineSample();
  }

  const dt = simTimeSec - prev.lastSimTimeSec;

  const maxGapSec =
    sample.maxSampleGapSec !== null
    && sample.maxSampleGapSec !== undefined
    && Number.isFinite(sample.maxSampleGapSec)
    && sample.maxSampleGapSec > 0
      ? sample.maxSampleGapSec
      : DEFAULT_MAX_SAMPLE_GAP_SEC;

  if (!Number.isFinite(dt) || dt < 0 || dt > maxGapSec) {
    return EMPTY_ENERGY_LEDGER;
  }

  // The existing App route supplies one teaching throughput and one teaching
  // total-power reading. Route that pair through the canonical instantaneous
  // domain and identity checks before any accumulation occurs, but only after
  // the timestamp continuity gate above has had a chance to clear a seeked
  // window. Null/non-finite samples retain the historical "advance time only"
  // policy; finite negative values and positive-rate/zero-power values fail
  // closed through the typed canonical error instead of reaching the
  // multiplications below.
  let instantaneousEe: InstantaneousEeResult | null = null;
  if (
    throughputMbps !== null
    && totalPowerW !== null
    && Number.isFinite(throughputMbps)
    && Number.isFinite(totalPowerW)
  ) {
    try {
      instantaneousEe = computeInstantaneousEe({
        ratesMbps: [throughputMbps],
        systemPowerW: totalPowerW,
      });
    } catch (error) {
      if (!(error instanceof CanonicalEeInputError)) throw error;
      return rebaselineSample();
    }
  }

  if (
    throughputMbps === null ||
    totalPowerW === null ||
    !Number.isFinite(throughputMbps) ||
    !Number.isFinite(totalPowerW)
  ) {
    return rebaselineSample();
  }

  // The numeric branch above must have produced a validated result. Keep the
  // guard explicit so a future change cannot bypass the canonical seam.
  if (instantaneousEe === null) return rebaselineSample();

  // Quality tally rides on the same accepted-sample path as everything else, so
  // the ratio always describes exactly the window that produced the Sigma above.
  // A finite reading is required: `-Infinity` (no service) and `NaN` (broken
  // upstream expression) both leave both counters untouched.
  const thresholdDb =
    sample.lowSinrThresholdDb !== null
    && sample.lowSinrThresholdDb !== undefined
    && Number.isFinite(sample.lowSinrThresholdDb)
      ? sample.lowSinrThresholdDb
      : DEFAULT_LOW_SINR_THRESHOLD_DB;
  const sinrDb = sample.servingSinrDb;
  const hasSinr = sinrDb !== null && sinrDb !== undefined && Number.isFinite(sinrDb);

  return {
    cumulativeDataMbit: prev.cumulativeDataMbit + instantaneousEe.totalThroughputMbps * dt,
    cumulativeEnergyJ: prev.cumulativeEnergyJ + instantaneousEe.systemPowerW * dt,
    elapsedSec: prev.elapsedSec + dt,
    lastSimTimeSec: simTimeSec,
    lowSinrSampleCount:
      prev.lowSinrSampleCount + (hasSinr && (sinrDb as number) < thresholdDb ? 1 : 0),
    sinrSampleCount: prev.sinrSampleCount + (hasSinr ? 1 : 0),
    ...stepHandoverTally(prev, cumulativeHandoverCount, 'credit'),
  };
}

/**
 * `lowSinrSampleCount / sinrSampleCount x 100`, in percentage points.
 *
 * `null` — rendered as an em dash, never as `0` — when no sample in the window
 * carried a usable SINR. "No reading" and "every reading was good" are opposite
 * claims and must not share a rendering; a fabricated 0 here would let a run
 * with no quality data at all sail through the third gate.
 */
export function computeLowSinrRatioPct(state: EnergyLedgerState): number | null {
  if (!Number.isFinite(state.sinrSampleCount) || state.sinrSampleCount <= 0) return null;
  if (!Number.isFinite(state.lowSinrSampleCount) || state.lowSinrSampleCount < 0) return null;
  return (state.lowSinrSampleCount / state.sinrSampleCount) * 100;
}

/**
 * `E_HO = handoverCount * energyPerHandoverJ`, in joules.
 *
 * Fails closed to `null` on a non-finite/negative cost, a non-finite/negative
 * tally, or a non-finite product. A returned `0` is a *measured* zero — either
 * no handover happened inside the window or the cost knob is explicitly 0 — and
 * is therefore legitimate to display, unlike the `null`.
 */
export function computeHandoverEnergyJ(
  ledger: EnergyLedgerState,
  energyPerHandoverJ: number,
): number | null {
  if (!Number.isFinite(energyPerHandoverJ) || energyPerHandoverJ < 0) return null;

  const { handoverCount } = ledger;
  if (!Number.isFinite(handoverCount) || handoverCount < 0) return null;

  const energyJ = handoverCount * energyPerHandoverJ;
  return Number.isFinite(energyJ) ? energyJ : null;
}

/**
 * `E_total = Σ P_total·Δt + E_HO`, in joules — the quantity the Run EE
 * denominator is built from, and the number a UI should show as the sum of the
 * radio and handover terms.
 *
 * Fails closed to `null` if either term is untrustworthy. `0` is legitimate
 * (a brand-new window has integrated nothing yet), so this does not require a
 * positive result; `computeRunEeMbitPerJ` applies the stricter `> 0` test
 * because it divides by this.
 */
export function computeTotalEnergyJ(
  ledger: EnergyLedgerState,
  energyPerHandoverJ: number,
): number | null {
  const { cumulativeEnergyJ } = ledger;
  if (!Number.isFinite(cumulativeEnergyJ) || cumulativeEnergyJ < 0) return null;

  const handoverEnergyJ = computeHandoverEnergyJ(ledger, energyPerHandoverJ);
  if (handoverEnergyJ === null) return null;

  const totalEnergyJ = cumulativeEnergyJ + handoverEnergyJ;
  return Number.isFinite(totalEnergyJ) ? totalEnergyJ : null;
}

/**
 * The one legitimate run-level EE definition: `Σ Mbit / E_total`, where
 * `E_total = Σ P_total·Δt + E_HO`. A non-positive or non-finite denominator
 * (e.g. a brand-new ledger with 0 J accumulated) fails closed to `null` —
 * never Infinity, never a fabricated 0.
 *
 * An omitted `energyPerHandoverJ` uses the same authoritative default as the
 * tuning resolver. An explicit `0` remains the opt-in radio-only behavior.
 */
export function computeRunEeMbitPerJ(
  ledger: EnergyLedgerState,
  energyPerHandoverJ: number = DEFAULT_ENERGY_PER_HANDOVER_J,
): number | null {
  const totalEnergyJ = computeTotalEnergyJ(ledger, energyPerHandoverJ);
  if (totalEnergyJ === null || totalEnergyJ <= 0) return null;

  const { cumulativeDataMbit } = ledger;
  try {
    const evaluation = computeEvaluationEeFromTotals({
      totalDataMbit: cumulativeDataMbit,
      totalEnergyJ,
    });
    // The legacy teaching readout keeps its historical empty-window `null`,
    // while the canonical API explicitly returns zero for zero activity.
    return evaluation.status === 'zero-activity' ? null : evaluation.eeEvalMbitPerJ;
  } catch (error) {
    if (!(error instanceof CanonicalEeInputError)) throw error;
    return null;
  }
}

/**
 * The composite key that defines the accumulation window: when this string
 * changes, the caller must restart the ledger from `EMPTY_ENERGY_LEDGER`.
 *
 * `signalKey` must come from `getEnergyLedgerSignalKey` in
 * `src/signalTuning.ts` — NOT from `getSignalTuningResetKey`, which is the
 * engine-rebuild key and intentionally covers only the two geometry fields.
 * The two keys are separate on purpose: putting Tx power into the engine key
 * would cold-start the simulation on every drag of the Tx power slider.
 *
 * Centralised here so that adding a knob to `EnergyTuningState` cannot silently
 * leave the ledger accumulating across the change.
 */
export function getEnergyLedgerResetKey(
  signalKey: string,
  tuning: EnergyTuningState,
): string {
  const perHandover = resolveEnergyPerHandoverJ(tuning);
  return [
    signalKey,
    `pa=${tuning.paEfficiency}`,
    `circuit=${tuning.circuitPowerW}`,
    `eho=${perHandover === null ? 'invalid' : perHandover}`,
  ].join('|');
}
