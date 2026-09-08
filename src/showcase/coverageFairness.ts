/**
 * coverageFairness — pure, display-only coverage / fairness aggregation for the
 * replay-proof lane (P3 slice-2 B). NO render / three / react import.
 *
 * The recorded producer windows bake per-UE COVERAGE truth (`served` / `starved`
 * from the kpiOverlay step-trace) into every timeline frame. This module only
 * READS those producer booleans and AGGREGATES them into the win-axis numbers the
 * defense/teaching panels display:
 *   - current-frame coverage (served / total)
 *   - per-UE served-fraction over the whole window → mean, worst-off (min), and a
 *     Gini + Lorenz curve of how (un)equally coverage is shared across UEs.
 *
 * Honesty boundary (frontend-change-contract Rule#7 / CLAUDE.md Rule#2):
 *   - It computes NO SINR, NO serving decision, NO coverage TRUTH. `served` /
 *     `starved` are the producer's; this module derives display statistics FROM
 *     them and alters no truth surface. The coverage win-axis narrative (0.26 →
 *     0.997) is the producer's result, surfaced — not invented here.
 *   - Gini/Lorenz are standard descriptive statistics OF the producer per-UE
 *     served-fractions; they add no new truth.
 *
 * Verified (scratchpad probe, controller oracle): over the two H2 scene windows
 * this reproduces a2 mean 0.9968 / min 0.9792 / Gini 0.0025 and b1 mean 0.2600 /
 * min 0.0000 / Gini 0.7400 exactly. The coverage validator pins it.
 */

/** Minimal structural UE shape — both `NormalizedUe` and a raw producer timeline
 *  UE satisfy it, so the same aggregation feeds the panel and the validator. */
export interface CoverageUe {
  readonly id: string;
  readonly served?: boolean;
  readonly starved?: boolean;
}

/** Minimal structural frame shape (a `NormalizedSceneFrame` satisfies it). */
export interface CoverageFrame {
  readonly ues: readonly CoverageUe[];
}

export interface FrameCoverage {
  readonly served: number;
  readonly total: number;
  /** served / total as a 0..100 percentage (0 when total is 0). */
  readonly pct: number;
}

export interface WindowServedFractionStats {
  /** Per-UE served-fraction: served frames / observed frames, keyed by UE id. */
  readonly perUeServedFraction: ReadonlyMap<string, number>;
  /** Mean per-UE served-fraction (the coverage win-axis headline). */
  readonly meanServedFraction: number;
  /** Worst-off UE served-fraction (b1 = 0.000 is the sharpest defense number). */
  readonly minServedFraction: number;
  /** Gini of the per-UE served-fractions (0 = perfectly equal, →1 = concentrated). */
  readonly gini: number;
  /** Lorenz curve points [cumulative population fraction, cumulative served share]. */
  readonly lorenzPoints: readonly (readonly [number, number])[];
  /** Number of UEs contributing (observed at least once with a coverage flag). */
  readonly ueCount: number;
}

/**
 * Producer served truth for one UE, or `undefined` when the window carries
 * neither flag. `served` wins; otherwise `starved` is inverted. Matches
 * `replayFieldColor.ts` precedence so the panel agrees with the red/green field.
 */
export function ueServed(ue: CoverageUe): boolean | undefined {
  if (typeof ue.served === 'boolean') return ue.served;
  if (typeof ue.starved === 'boolean') return !ue.starved;
  return undefined;
}

/** Current-frame coverage: how many UEs the producer serves in THIS frame. */
export function currentFrameCoverage(frame: CoverageFrame): FrameCoverage {
  const ues = frame.ues;
  let served = 0;
  for (const ue of ues) {
    if (ueServed(ue) === true) served += 1;
  }
  const total = ues.length;
  return { served, total, pct: total > 0 ? (served / total) * 100 : 0 };
}

/**
 * Gini coefficient of a value list. Sort ascending, cum = Σ (i+1)·x_i (1-based
 * rank), G = 2·cum / (n·Σx) − (n+1)/n. All-zero (or empty) → 0. Standard formula.
 */
export function giniCoefficient(values: readonly number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  if (sum <= 0) return 0;
  let cum = 0;
  for (let i = 0; i < n; i += 1) cum += (i + 1) * sorted[i];
  return (2 * cum) / (n * sum) - (n + 1) / n;
}

/**
 * Aggregate per-UE served-fraction over a whole window (all timeline frames) and
 * derive the fairness descriptors. Each UE's fraction = (frames served) /
 * (frames observed with a coverage flag); UEs without any coverage flag never
 * contribute (older windows). Pure — reads producer `served` / `starved` only.
 */
export function windowServedFractionStats(
  frames: readonly CoverageFrame[],
): WindowServedFractionStats {
  const servedCount = new Map<string, number>();
  const observedCount = new Map<string, number>();
  for (const frame of frames) {
    for (const ue of frame.ues) {
      const served = ueServed(ue);
      if (served === undefined) continue;
      observedCount.set(ue.id, (observedCount.get(ue.id) ?? 0) + 1);
      if (served) servedCount.set(ue.id, (servedCount.get(ue.id) ?? 0) + 1);
    }
  }
  const perUeServedFraction = new Map<string, number>();
  for (const [id, observed] of observedCount) {
    perUeServedFraction.set(id, observed > 0 ? (servedCount.get(id) ?? 0) / observed : 0);
  }
  const fracs = [...perUeServedFraction.values()];
  const n = fracs.length;
  const sum = fracs.reduce((acc, v) => acc + v, 0);
  const meanServedFraction = n > 0 ? sum / n : 0;
  const minServedFraction = n > 0 ? Math.min(...fracs) : 0;
  const gini = giniCoefficient(fracs);

  // Lorenz curve: sort fractions ascending, plot cumulative population share vs
  // cumulative served share. Starts at the origin; ends at (1,1) when sum>0.
  const sorted = [...fracs].sort((a, b) => a - b);
  const lorenzPoints: (readonly [number, number])[] = [[0, 0]];
  let cumFrac = 0;
  for (let i = 0; i < n; i += 1) {
    cumFrac += sorted[i];
    lorenzPoints.push([(i + 1) / n, sum > 0 ? cumFrac / sum : 0]);
  }

  return {
    perUeServedFraction,
    meanServedFraction,
    minServedFraction,
    gini,
    lorenzPoints,
    ueCount: n,
  };
}
