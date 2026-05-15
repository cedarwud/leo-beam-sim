// MODQN ω-Handover S4 — omega-heuristic decision override.
//
// SDD §4.4: heuristic-mode disclosure rule item 3 — the scoring function MUST
// be named `computeHeuristicNotPaperScore` (this exact name). The bundle
// parser MUST never produce `omega-heuristic` mode; this file is only
// consulted at runtime when the user explicitly picks the mode via the
// sidebar selector. See SDD §3.4 for the score-function spec and §6.1 row
// "omega-heuristic" for the mode-behavior contract.
//
// References:
//   * docs/modqn-omega-handover-sdd.md §3.4  ω-heuristic score form
//   * docs/modqn-omega-handover-sdd.md §4.4  binding disclosure rules
//   * docs/modqn-omega-handover-sdd.md §6.1  mode-behavior matrix
//   * docs/modqn-omega-handover-sdd.md §9.5  S4 acceptance
//
// This function is NOT paper MODQN. It is a closed-form scalar score over
// live candidates parameterized by user-chosen ω. The selected beam still
// flows through HandoverManager for trigger-time and ping-pong-guard timing
// (SDD §3.4); only the argmax choice is overridden.
import type { HandoverDecisionOverrideInput } from './handover-manager';
import type { RuntimeOmegaState } from '../../ui/useModqnHandoverState';

export interface HeuristicScoreInput {
  /** User-chosen ω vector this tick (from the sidebar Apply state). */
  readonly omega: RuntimeOmegaState;
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
 * SDD §4.4 heuristic-mode disclosure rule item 3.
 *
 * This function is NOT paper MODQN. It is a closed-form scalar score over
 * live candidates parameterized by user-chosen ω. Used only when
 * `handoverMode === 'omega-heuristic'`. The bundle parser must never produce
 * this mode (item 3).
 *
 * Score formula (SDD §3.4 / §6.1 row "omega-heuristic"):
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
 * caller (useSimulation override callback) maps that into the
 * `HandoverDecisionOverride` contract; trigger-time, dwell, and ping-pong-
 * guard timing remain engine-side and untouched.
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
 *   * Empty candidates → returns `null` so the caller defers to sinr-offset
 *     (matches reScalarize's null-on-empty convention).
 *   * Single candidate → returns that candidate. Score is the throughput
 *     term only (no normalization division-by-zero because max == self).
 *
 * SINR linearization:
 *   `sinrLinear(a) = 10^(sinrDb(a) / 10)`. We use the engine-smoothed
 *   `sinrDb` directly from the LinkSample (the smoothing already happens
 *   inside HandoverManager.smoothCandidates before the override is
 *   consulted; this matches the SDD §3.4 "score over current beams"
 *   semantics).
 *
 * Returns `null` when no candidates are available (SDD §5.3 / CLAUDE.md §5:
 * do not synthesize beams; defer to sinr-offset).
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
