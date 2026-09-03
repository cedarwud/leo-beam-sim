import type {
  CandidateDecisionState,
  HandoverDecisionFrame,
} from '../engine/handover/candidateDecisionContract';

function countDistinctEligibleAlternateSatellites(
  decisionFrame: HandoverDecisionFrame,
): number {
  const servingSatId = decisionFrame.serving?.satelliteId ?? null;
  const states = decisionFrame.states;
  if (!Array.isArray(states)) return 0;

  const alternateEligibleSatIds = new Set<string>();
  for (const state of states) {
    if (!isTriggerQualifiedState(state)) continue;
    const satId = state.key?.satelliteId;
    if (typeof satId === 'string' && satId.length > 0 && (servingSatId === null || satId !== servingSatId)) {
      alternateEligibleSatIds.add(satId);
    }
  }
  return alternateEligibleSatIds.size;
}

function isTriggerQualifiedState(state: CandidateDecisionState | null | undefined): boolean {
  return state?.hardEligibility === 'eligible' && state.triggerStatus === 'satisfied';
}

/**
 * A same-spacecraft beam is still a real handover candidate.  It does not
 * increase the inter-satellite count above, but it must open the same
 * pre-selection presentation lane so an intra-satellite beam switch cannot
 * jump directly from the ambient field to the switching envelope.
 */
function hasEligibleIntraBeamCandidate(
  decisionFrame: HandoverDecisionFrame,
): boolean {
  const serving = decisionFrame.serving;
  if (serving === null || !Array.isArray(decisionFrame.states)) return false;
  return decisionFrame.states.some(state => (
    isTriggerQualifiedState(state)
    && state.key?.satelliteId === serving.satelliteId
    && state.key?.beamId !== serving.beamId
  ));
}

/**
 * Pure predicate for the homepage multi-candidate warm-start lane.
 *
 * For multiCandidateDecisionEnabled only, cold-start run-through must stop at
 * the first REAL HandoverDecisionFrame that is:
 *  1. Non-null / real decision frame
 *  2. Pre-selection (selectedTarget is null AND provisionalLeader is null)
 *  3. Phase is the pre-selection evaluation/qualification interval
 *  4. Has hardEligibility eligible pairs from at least TWO distinct ALTERNATE
 *     satellite IDs excluding the current serving satellite.
 */
export function isMultiCandidateWarmStartDecisionFrame(
  decisionFrame: HandoverDecisionFrame | null | undefined,
): boolean {
  if (!decisionFrame) return false;
  if (decisionFrame.phase !== 'evaluating' && decisionFrame.phase !== 'qualifying') return false;
  if (decisionFrame.selectedTarget !== null) return false;
  if (decisionFrame.provisionalLeader !== null) return false;

  return countDistinctEligibleAlternateSatellites(decisionFrame) >= 2;
}

/**
 * Display-only pre-selection interval shared by the accepted snapshot,
 * publisher and centre-stage latch.  It deliberately includes a provisional
 * leader: the rail still needs to show the remaining eligible alternatives
 * while the leader is being confirmed, and the scene must not blink back to
 * the ambient field for that single transition frame.
 */
export function isMultiCandidatePreSelectionDecisionFrame(
  decisionFrame: HandoverDecisionFrame | null | undefined,
): decisionFrame is HandoverDecisionFrame {
  if (!decisionFrame) return false;
  if (
    decisionFrame.phase !== 'evaluating'
    && decisionFrame.phase !== 'qualifying'
    && decisionFrame.phase !== 'selection-hold'
  ) return false;
  return decisionFrame.selectedTarget === null;
}

/**
 * Display-only focus signal.  It keeps the real comparison readable from the
 * first qualification frame through the selection-hold phase.  Inter-handover
 * frames with two distinct alternate spacecrafts get the multi-spacecraft
 * comparison; an intra-handover frame with a same-spacecraft alternate beam
 * also enters this lane.  In both cases this is only a presentation gate — it
 * never changes gates, TTT clocks, ranking, or the commit decision.
 */
export function isMultiCandidateComparisonFocusDecisionFrame(
  decisionFrame: HandoverDecisionFrame | null | undefined,
): boolean {
  if (!isMultiCandidatePreSelectionDecisionFrame(decisionFrame)) return false;
  return countDistinctEligibleAlternateSatellites(decisionFrame) >= 2
    || hasEligibleIntraBeamCandidate(decisionFrame);
}

/**
 * Whether the decision stream itself is in the candidate-to-switch interval
 * that should use the readable handover playback cap. This is intentionally
 * broader than the multi-spacecraft comparison threshold: a real single
 * qualifying candidate is still a handover story and must not flash through
 * the scene at the user's fast ambient rate.
 *
 * `guard` is deliberately excluded.  It is an engine-side ping-pong guard and
 * can last far longer than the visible handover animation; treating it as a
 * presentation phase made every subsequent speed preset appear ineffective
 * (the scene stayed at 0.5x long after the switch had completed).  The visible
 * handover owner still caps the actual source→target animation while its
 * drawable latch is active.
 */
export function isMultiCandidatePlaybackSlowDecisionFrame(
  decisionFrame: HandoverDecisionFrame | null | undefined,
): boolean {
  if (!decisionFrame) return false;
  if (decisionFrame.phase === 'switching') return true;
  if (!isMultiCandidatePreSelectionDecisionFrame(decisionFrame)) return false;
  return decisionFrame.provisionalLeader !== null
    || decisionFrame.states.some(state => isTriggerQualifiedState(state));
}

/**
 * Structural frame wrapper for isMultiCandidateWarmStartDecisionFrame.
 */
export function isMultiCandidateWarmStartFrame(
  frame: { readonly handoverDecisionFrame?: HandoverDecisionFrame | null } | null | undefined,
): boolean {
  return isMultiCandidateWarmStartDecisionFrame(frame?.handoverDecisionFrame);
}
