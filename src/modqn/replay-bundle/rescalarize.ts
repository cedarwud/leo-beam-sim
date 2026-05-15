// MODQN ω-Handover S3 — re-scalarization helper.
//
// Pure function. Given the current bundle row's `topCandidates` and the user's
// active ω vector, returns the argmax beam under the re-weighted Q-sum.
//
// SDD §3.3 re-scalarization contract:
//   Q_scalar(a) = ω_t · Q1(a) + ω_h · Q2(a) + ω_l · Q3(a)
//   where Q1/Q2/Q3 map to objectiveQ throughput/handover/loadBalance values.
//
// Fallback rule (SDD §5.3):
//   "If user omega prefers a beam NOT in candidates → still use best (wasFallback = true)"
//   Since we only hold the top-K list, we detect fallback as: all candidates
//   lack objectiveQ (we can't score them) → return topCandidates[0] as the
//   recorded winner with wasFallback=true. If at least one candidate has
//   objectiveQ, we run argmax normally and wasFallback=false.
//
// Returns null when `topCandidates` is absent/empty — the caller defers to
// sinr-offset (do NOT synthesise Q-values per SDD §5.3).
import type { RuntimeOmegaState } from '../../ui/useModqnHandoverState';
import type { ModqnPolicyCandidate } from './types';

export interface ReScalarizeResult {
  /** Engine-facing beam identity (numeric beamId = localBeamIndex). */
  readonly satId: string;
  readonly beamId: number;
  /**
   * True when the user's ω could not be applied (all candidates lack
   * objectiveQ) and the system fell back to the producer's recorded top-1.
   * Per SDD §5.3 and acceptance criterion §9.4 item 6.
   */
  readonly wasFallback: boolean;
}

/** Extract Q-value component, accepting both consumer and producer spellings. */
function extractQ(
  candidate: ModqnPolicyCandidate,
  consumerKey: string,
  producerKey: string,
): number {
  if (candidate.objectiveQ === undefined) return 0;
  const cv = candidate.objectiveQ[consumerKey];
  if (typeof cv === 'number') return cv;
  const pv = candidate.objectiveQ[producerKey];
  return typeof pv === 'number' ? pv : 0;
}

/**
 * Re-scalarize the recorded top-K candidates under `omega` and return the
 * argmax beam identity.
 *
 * Returns `null` if `topCandidates` is empty/absent so the caller can defer
 * to sinr-offset (no Q-value synthesis per SDD §5.3 / CLAUDE.md §5).
 */
export function reScalarize(
  topCandidates: readonly ModqnPolicyCandidate[] | undefined,
  omega: RuntimeOmegaState,
): ReScalarizeResult | null {
  if (!topCandidates || topCandidates.length === 0) return null;

  // If NO candidate has objectiveQ we cannot score — fall back to producer's
  // top-1 and flag wasFallback so the diagnostics row increments.
  const anyHasQ = topCandidates.some(c => c.objectiveQ !== undefined);
  if (!anyHasQ) {
    const fallback = topCandidates[0];
    return {
      satId: fallback.satId,
      beamId: fallback.localBeamIndex,
      wasFallback: true,
    };
  }

  // Run argmax over the scoreable candidates.
  let best = topCandidates[0];
  let bestScore = omega.throughput * extractQ(best, 'throughput', 'r1Throughput')
    + omega.handover * extractQ(best, 'handover', 'r2Handover')
    + omega.loadBalance * extractQ(best, 'loadBalance', 'r3LoadBalance');

  for (let i = 1; i < topCandidates.length; i++) {
    const c = topCandidates[i];
    const score = omega.throughput * extractQ(c, 'throughput', 'r1Throughput')
      + omega.handover * extractQ(c, 'handover', 'r2Handover')
      + omega.loadBalance * extractQ(c, 'loadBalance', 'r3LoadBalance');
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return {
    satId: best.satId,
    beamId: best.localBeamIndex,
    wasFallback: false,
  };
}
