import type {
  CandidateLinkKey,
  HandoverPhase,
} from '../engine/handover/candidateDecisionContract';
import type { AuthorityHandoverTransition } from './handoverAuthorityJoin';
import {
  isDrawableHandoverPresentationEvent,
  type HandoverPresentationEvent,
  type HandoverPresentationOwner,
  type HandoverPresentationView,
} from './handoverPresentationOwner';

/** Render-only names for the existing decision phases. */
export type HandoverEventCueLifecyclePhase =
  | 'preselection'
  | 'ttt'
  | 'selection-hold'
  | 'switching'
  | 'commit-continuation';

export interface HandoverEventCuePolicyInput {
  /** The accepted transition identity; no transition is created here. */
  readonly transition: AuthorityHandoverTransition | null | undefined;
  /** Existing decision-engine phase, not a presentation-owned phase. */
  readonly phase: HandoverPhase | null | undefined;
  /** Existing presentation owner and its current visible event. */
  readonly presentationOwner: HandoverPresentationOwner | null | undefined;
  readonly presentationView: Pick<HandoverPresentationView, 'active' | 'event'> | null | undefined;
}

export interface HandoverEventCuePolicy {
  /** True only when the existing event can be painted for this exact pair. */
  readonly drawable: boolean;
  readonly lifecyclePhase: HandoverEventCueLifecyclePhase | null;
  /** The one accepted pair to pass to the existing cue renderer. */
  readonly transition: AuthorityHandoverTransition | null;
  readonly presentationOwner: HandoverPresentationOwner | null;
}

const HIDDEN_POLICY: HandoverEventCuePolicy = Object.freeze({
  drawable: false,
  lifecyclePhase: null,
  transition: null,
  presentationOwner: null,
});

function isCandidateLinkKey(value: CandidateLinkKey | null | undefined): value is CandidateLinkKey {
  return typeof value === 'object'
    && value !== null
    && typeof value.satelliteId === 'string'
    && value.satelliteId.trim().length > 0
    && Number.isInteger(value.beamId)
    && value.beamId >= 0;
}

function sameCandidateLink(left: CandidateLinkKey, right: CandidateLinkKey): boolean {
  return left.satelliteId === right.satelliteId && left.beamId === right.beamId;
}

function isAcceptedTransition(
  transition: AuthorityHandoverTransition | null | undefined,
): transition is AuthorityHandoverTransition {
  if (typeof transition !== 'object' || transition === null) return false;
  if (
    typeof transition.eventId !== 'string'
    || transition.eventId.trim().length === 0
    || typeof transition.episodeId !== 'string'
    || transition.episodeId.trim().length === 0
    || typeof transition.sourceFrameId !== 'string'
    || transition.sourceFrameId.trim().length === 0
    || !Number.isFinite(transition.simTimeMs)
    || transition.simTimeMs < 0
    || (transition.boundary !== 'selected' && transition.boundary !== 'committed')
    || !isCandidateLinkKey(transition.from)
    || !isCandidateLinkKey(transition.to)
    || sameCandidateLink(transition.from, transition.to)
  ) return false;

  const derivedKind = transition.from.satelliteId === transition.to.satelliteId ? 'intra' : 'inter';
  return transition.kind === derivedKind;
}

function lifecyclePhaseFor(
  phase: HandoverPhase | null | undefined,
  transition: AuthorityHandoverTransition,
): HandoverEventCueLifecyclePhase | null {
  switch (phase) {
    case 'monitoring':
    case 'evaluating':
      return 'preselection';
    case 'qualifying':
      return 'ttt';
    case 'selection-hold':
      return 'selection-hold';
    case 'switching':
      return 'switching';
    case 'guard':
      return transition.boundary === 'committed' ? 'commit-continuation' : null;
    default:
      return null;
  }
}

function isPresentationOwner(value: HandoverPresentationOwner | null | undefined): value is HandoverPresentationOwner {
  return value === 'natural' || value === 'manual' || value === 'cinema';
}

function presentationMatchesTransition(
  view: Pick<HandoverPresentationView, 'active' | 'event'> | null | undefined,
  transition: AuthorityHandoverTransition,
): view is Pick<HandoverPresentationView, 'active' | 'event'> {
  if (view?.active !== true) return false;
  const event = view.event;
  if (
    typeof event !== 'object'
    || event === null
    || typeof event.eventId !== 'string'
    || typeof event.from !== 'object'
    || event.from === null
    || typeof event.to !== 'object'
    || event.to === null
    || typeof event.from.satId !== 'string'
    || typeof event.to.satId !== 'string'
    || typeof event.from.beamId !== 'number'
    || typeof event.to.beamId !== 'number'
    || !Number.isInteger(event.from.beamId)
    || !Number.isInteger(event.to.beamId)
  ) return false;

  if (!isDrawableHandoverPresentationEvent(event as HandoverPresentationEvent)) return false;
  // Cinema keeps a local namespace (`cinema:<source-event-id>`) while the
  // accepted transition retains the source event id. Both names refer to the
  // same immutable pair; accept the namespace wrapper without weakening the
  // endpoint/kind checks above. A different source event still fails closed.
  const sameEventIdentity = event.eventId === transition.eventId
    || event.eventId === `cinema:${transition.eventId}`;
  return sameEventIdentity
    && event.kind === transition.kind
    && event.from.satId === transition.from.satelliteId
    && event.from.beamId === transition.from.beamId
    && event.to.satId === transition.to.satelliteId
    && event.to.beamId === transition.to.beamId;
}

/**
 * Admit the existing handover event cue for one accepted transition.
 *
 * This adapter does not select a transition or advance presentation time. It
 * only joins the accepted transition identity to the already-owned drawable
 * event, while allowing that exact pair to remain visible through the
 * decision lifecycle and committed guard continuation.
 */
export function resolveHandoverEventCuePolicy(
  input: HandoverEventCuePolicyInput,
): HandoverEventCuePolicy {
  const transition = input?.transition;
  if (!isAcceptedTransition(transition)) return HIDDEN_POLICY;

  const lifecyclePhase = lifecyclePhaseFor(input.phase, transition);
  if (lifecyclePhase === null) return HIDDEN_POLICY;
  if (!isPresentationOwner(input.presentationOwner)) return HIDDEN_POLICY;
  if (!presentationMatchesTransition(input.presentationView, transition)) return HIDDEN_POLICY;

  return Object.freeze({
    drawable: true,
    lifecyclePhase,
    // Preserve the accepted transition object and its exact source/target pair.
    transition,
    presentationOwner: input.presentationOwner,
  });
}
