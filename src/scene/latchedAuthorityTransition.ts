import type { AuthorityHandoverTransition } from './handoverAuthorityJoin';

export interface LatchedAuthorityTransitionInput {
  readonly multiCandidateCentralOverlayActive: boolean;
  readonly multiCandidateIdentityTransitionActive: boolean;
  readonly presentationActive: boolean;
  readonly presentationEvent: { readonly eventId: string } | null;
  readonly authorityTransition: AuthorityHandoverTransition | null;
  readonly authorityPresentationCommitObserved: boolean;
}

/** Project the current authority transition into the active presentation episode. */
export function resolveLatchedAuthorityTransition(
  input: LatchedAuthorityTransitionInput,
): AuthorityHandoverTransition | null {
  const transition = input.authorityTransition;
  const event = input.presentationEvent;
  if (
    !(input.multiCandidateCentralOverlayActive || input.multiCandidateIdentityTransitionActive)
    || !input.presentationActive
    || event === null
    || transition === null
    || transition.eventId !== event.eventId
  ) return null;

  const committed = input.authorityPresentationCommitObserved || transition.boundary === 'committed';
  return Object.freeze({
    eventId: transition.eventId,
    episodeId: transition.episodeId,
    sourceFrameId: transition.sourceFrameId,
    simTimeMs: transition.simTimeMs,
    kind: transition.kind,
    boundary: committed ? 'committed' : 'selected',
    from: transition.from,
    to: transition.to,
  });
}
