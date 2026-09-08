// Optional weighted handover decision override.
//
import type { HandoverDecisionOverrideInput } from './handover-manager';

export interface WeightedDecisionState {
  readonly throughput: number;
  readonly handover: number;
  readonly loadBalance: number;
}

export interface HeuristicScoreInput {
  /** User-chosen weights for this tick. */
  readonly omega: WeightedDecisionState;
  /** Smoothed candidate beams visible this tick (engine pipeline output). */
  readonly candidates: HandoverDecisionOverrideInput['candidates'];
  /** Current serving snapshot — used to detect `isSwitch`. */
  readonly serving: HandoverDecisionOverrideInput['serving'];
}

export interface HeuristicScoreResult {
  /** Engine-facing beam identity (matches the candidate's satId/beamId). */
  readonly satId: string;
  readonly beamId: number;
  /** Raw score the winning candidate achieved under the user's ω. */
  readonly score: number;
}

/**
 * Compute a closed-form weighted score over live candidates.
 *
 * Score formula:
 *
 *     score(a) = ω_throughput · normSINR(a)
 *              − ω_handover   · isSwitch(a)
 *              − ω_loadBalance · normLoad(a)
 *
 *     normSINR(a) = sinrLinear(a) / max_b sinrLinear(b)   in [0, 1]
 *     isSwitch(a) = 1 if a ≠ currentServing else 0
 *     normLoad(a) = 0 (placeholder — see "load metric" note below)
 *
 * The returned `{satId, beamId}` is the argmax over the candidate set. The
 * caller maps that into the `HandoverDecisionOverride` contract; trigger-time,
 * dwell, and ping-pong-guard timing remain engine-side.
 *
 * Load metric note (S4 scope):
 *   LinkSample does NOT carry a per-beam load / busy-count field today
 *   (src/engine/signal/types.ts). The SDD §3.4 formula references
 *   `normLoad(a) = activeUesOnBeam(a) / max_b activeUesOnBeam(b)`, which
 *   requires a profile-wide UE-attachment tally that the live pipeline does
 *   not yet emit. For S4 we treat normLoad(a) := 0 for every candidate so
 *   the load-balance term collapses to 0. This is documented in the
 *   DiagnosticsDrawer row text so screenshots flag the limitation. Adding a
 *   real load metric is a separate slice that touches the engine signal
 *   pipeline and is out of scope here.
 *
 * Empty / single-candidate handling:
 *   * Empty candidates → returns `null` so the caller defers to sinr-offset.
 *   * Single candidate → returns that candidate. Score is the throughput
 *     term only (no normalization division-by-zero because max == self).
 *
 * SINR linearization uses the engine-smoothed `sinrDb` from each LinkSample.
 *
 * Returns `null` when no candidates are available; callers then defer to the
 * built-in SINR-offset policy.
 */
export function computeHeuristicNotPaperScore(
  input: HeuristicScoreInput,
): HeuristicScoreResult | null {
  const { omega, candidates, serving } = input;
  if (!candidates || candidates.length === 0) return null;

  // sinrLinear and per-candidate maxima.
  // Treat -Infinity (no-signal) candidates as 0 linear so they cannot win.
  let maxSinrLinear = 0;
  const sinrLinearByIndex = new Array<number>(candidates.length);
  for (let i = 0; i < candidates.length; i++) {
    const dB = candidates[i].sinrDb;
    const lin = Number.isFinite(dB) ? Math.pow(10, dB / 10) : 0;
    sinrLinearByIndex[i] = lin;
    if (lin > maxSinrLinear) maxSinrLinear = lin;
  }
  const sinrDenom = maxSinrLinear > 0 ? maxSinrLinear : 1;

  // Argmax with the closed-form score.
  let bestIndex = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const normSinr = sinrLinearByIndex[i] / sinrDenom;
    const isSwitch =
      c.satId === serving.satId && c.beamId === serving.beamId ? 0 : 1;
    // normLoad placeholder = 0 (see "Load metric note" in the docblock).
    const normLoad = 0;

    const score =
      omega.throughput * normSinr
      - omega.handover * isSwitch
      - omega.loadBalance * normLoad;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  const winner = candidates[bestIndex];
  return {
    satId: winner.satId,
    beamId: winner.beamId,
    score: bestScore,
  };
}
