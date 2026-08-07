import type { PowerTrainBreakdown } from './energyModel';

/**
 * T3 is an algebra isolation exercise.  It deliberately does not carry a
 * transmit-power field: the controlled comparison fixes U=1 and SINR=0 dB,
 * then exposes only the B/K allocation and the resulting rate.  The source
 * label makes the deterministic producer boundary visible in the worksheet.
 */
export interface TeachingT3FixedComparisonReadout {
  readonly sourceKind: 'deterministic-fixture';
  readonly assignedBeamLoad: 1;
  readonly sinrDb: 0;
  readonly bandwidthMHz: number | null;
  readonly frequencyReuse: number | null;
  readonly allocatedBandwidthMHz: number | null;
  readonly throughputMbps: number | null;
  readonly dataMbit: number | null;
  readonly serviceStatus: 'served';
  readonly serviceIdentity: 't3-fixed-u1-sinr0';
  readonly producerStatus: 'valid' | 'pending';
  readonly absenceReason: string | null;
}

/**
 * The single teaching energy/EE read model handed to the right-hand panel.
 *
 * Assembled once in `App.tsx` from the live `SimState` plus the energy tuning
 * controls, so the left controls, the scene and the right readout all describe
 * the same instant. Panels render this; they never recompute it.
 *
 * Every field is nullable on purpose: a missing term renders as
 * `TEACHING_ABSENT_DASH`, never as `0`. The converse also holds — a field that
 * is genuinely `0` (no handover happened; the cost knob is 0) is a measurement
 * of this model and renders as `0`, not as a dash.
 */
export interface TeachingEnergyReadout {
  /** RF / PA / circuit / total split. `null` when the power train fails closed. */
  readonly powerTrain: PowerTrainBreakdown | null;
  /** Shannon teaching throughput derived from the serving SINR. */
  readonly throughputMbps: number | null;
  /** Σ throughput·Δt since the ledger last reset. */
  readonly cumulativeDataMbit: number;
  /** Σ totalPower·Δt since the ledger last reset — the RADIO term only. */
  readonly cumulativeEnergyJ: number;
  /** Seconds of simulation actually integrated (excludes skipped/reset steps). */
  readonly elapsedSec: number;
  /**
   * Σ Mbit / E_total — the only legitimate run-level EE, where
   * `E_total = Σ P_total·Δt + E_HO`. `null` until the denominator is > 0.
   */
  readonly runEeMbitPerJ: number | null;
  /**
   * `E_HO = handoverCount × energyPerHandoverJ`, in joules.
   *
   * `null` means the term could not be computed (broken cost knob or broken
   * tally) and must render as an em dash. `0` is a real value — no handover
   * occurred inside the accumulation window, or the cost knob is set to 0 — and
   * may be displayed as a number.
   */
  readonly handoverEnergyJ: number | null;
  /**
   * Handover events credited to the current accumulation window. Optional so
   * that producers written before handover energy existed still type-check;
   * `undefined` means "this producer does not report it", which renders as an
   * em dash, not as 0.
   */
  readonly handoverCount?: number | null;
  /**
   * `Σ P_total·Δt + E_HO`, in joules — the Run EE denominator, exposed so the
   * UI can show `radio energy + handover energy = total energy` as a visible
   * sum instead of asserting it. Optional for the same reason as
   * `handoverCount`; `null` means the sum could not be trusted.
   */
  readonly totalEnergyJ?: number | null;
  /**
   * Share of accumulated samples whose serving SINR fell below
   * `lowSinrThresholdDb`, in percentage points.
   *
   * This is the third of the course contract's four qualified-saving gates:
   * `candidate.lowSinrRatioPct <= baseline.lowSinrRatioPct + 5 pp`. It exists so
   * that "we cut energy" cannot be bought by quietly letting link quality fall
   * over — energy and data volume alone do not catch that.
   *
   * `null` means no sample in the window carried a usable SINR and must render
   * as an em dash. A measured `0` (every sample was above threshold) is a real
   * value and renders as `0`.
   */
  readonly lowSinrRatioPct?: number | null;
  /**
   * The threshold the ratio was computed against, in dB, so the panel can show
   * what "low" meant instead of asserting it. `COURSE-DEFINED`, not a 3GPP
   * value.
   */
  readonly lowSinrThresholdDb?: number | null;
  /** Fixed-U/SINR B/K fixture used by T3; never a live transmit-power claim. */
  readonly t3FixedComparison: TeachingT3FixedComparisonReadout;
}
