/**
 * Homepage-only geometry ownership.
 *
 * The playback, decision, and accepted-snapshot owners remain upstream. This
 * module only decides which already-resolved renderer layer may paint on the
 * homepage for the current presentation state. It never selects a candidate,
 * changes a phase, or creates a second clock.
 */

export type HomepageSceneGeometryOwner =
  | 'legacy'
  | 'steady'
  | 'candidate-review'
  | 'natural-pulse'
  | 'handover-pair'
  | 'authority-pair';

export interface HomepageSceneGeometryPolicyInput {
  readonly homepageVisualIdentity: boolean;
  /** Accepted multi-candidate review is still additive to the serving fan. */
  readonly candidateReviewActive: boolean;
  /** The accepted authority transition owns the pair during switching. */
  readonly authorityTransitionActive: boolean;
  /** The shared presentation owner has a drawable event on stage. */
  readonly presentationActive: boolean;
  readonly presentationSource: 'walker' | 'tle' | 'manual' | 'cinema' | null;
  readonly presentationKind: 'intra' | 'inter' | null;
  readonly presentationMode: 'idle' | 'presenting' | 'cooldown';
  /** Compatibility fallback when the normalized pair is unavailable. */
  readonly naturalPulseAvailable: boolean;
}

export interface HomepageSceneGeometryPolicy {
  readonly owner: HomepageSceneGeometryOwner;
  /** The established serving-satellite fan remains visible through the handover story. */
  readonly renderServingField: boolean;
  /** The legacy single prepared-candidate cone is not a homepage carrier. */
  readonly renderCandidateField: boolean;
  /** A legacy natural pulse is the sole fallback owner when no pair is active. */
  readonly renderNaturalPulse: boolean;
  /** Manual intra uses the established two-cone triggered carrier. */
  readonly renderTriggeredIntra: boolean;
  /** Natural/cinema/inter/manual-inter pair carrier. */
  readonly renderCinemaPair: boolean;
  /** Accepted-snapshot authority pair carrier. */
  readonly renderAuthorityPair: boolean;
}

const LEGACY_POLICY: HomepageSceneGeometryPolicy = Object.freeze({
  owner: 'legacy',
  renderServingField: true,
  renderCandidateField: true,
  renderNaturalPulse: true,
  renderTriggeredIntra: true,
  renderCinemaPair: true,
  renderAuthorityPair: true,
});

/**
 * Resolve one display owner for homepage beam geometry.
 *
 * Priority is deliberate and mirrors the existing accepted-presentation
 * ownership chain: accepted authority transition > drawable handover pair >
 * accepted candidate review > compatibility pulse > steady field. The output
 * is a pure render gate; the configured serving fan remains mounted while the
 * existing pair owner supplies the handover source/target geometry. All
 * metrics, identities, and event envelopes are still supplied by their
 * existing owners.
 */
export function resolveHomepageSceneGeometryPolicy(
  input: HomepageSceneGeometryPolicyInput,
): HomepageSceneGeometryPolicy {
  if (!input.homepageVisualIdentity) return LEGACY_POLICY;

  const presentationPairActive = input.presentationActive
    && input.presentationKind !== null;
  if (input.authorityTransitionActive && presentationPairActive) {
    return Object.freeze({
      owner: 'authority-pair',
      renderServingField: true,
      renderCandidateField: false,
      renderNaturalPulse: false,
      renderTriggeredIntra: false,
      renderCinemaPair: false,
      renderAuthorityPair: true,
    });
  }

  if (presentationPairActive) {
    const manualIntra = input.presentationSource === 'manual'
      && input.presentationKind === 'intra';
    return Object.freeze({
      owner: 'handover-pair',
      renderServingField: true,
      renderCandidateField: false,
      renderNaturalPulse: false,
      renderTriggeredIntra: manualIntra,
      renderCinemaPair: !manualIntra,
      renderAuthorityPair: false,
    });
  }

  if (input.candidateReviewActive) {
    return Object.freeze({
      owner: 'candidate-review',
      renderServingField: true,
      renderCandidateField: false,
      renderNaturalPulse: false,
      renderTriggeredIntra: false,
      renderCinemaPair: false,
      renderAuthorityPair: false,
    });
  }

  const naturalPulse = input.naturalPulseAvailable
    && input.presentationMode === 'idle';
  if (naturalPulse) {
    return Object.freeze({
      owner: 'natural-pulse',
      renderServingField: false,
      renderCandidateField: false,
      renderNaturalPulse: true,
      renderTriggeredIntra: false,
      renderCinemaPair: false,
      renderAuthorityPair: false,
    });
  }

  return Object.freeze({
    owner: 'steady',
    renderServingField: true,
    renderCandidateField: false,
    renderNaturalPulse: false,
    renderTriggeredIntra: false,
    renderCinemaPair: false,
    renderAuthorityPair: false,
  });
}
