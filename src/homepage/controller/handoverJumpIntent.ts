/**
 * A queued Director button intent for the homepage handover index.
 *
 * This is deliberately not a decision, clock, snapshot, or presentation
 * state.  It only preserves one user command while the existing source-backed
 * event index is being rebuilt after a scene-configuration change.  The
 * existing index and `useHandoverCinema` remain the only authorities for what
 * event is eventually selected and rendered.
 */

import type { LiveWalkerHandoverEvent } from '../../scene/liveWalkerHandoverEventIndex';

export type HomepageHandoverJumpKind = 'intra' | 'inter';

export interface HomepageHandoverJumpIntent {
  readonly kind: HomepageHandoverJumpKind;
}

export interface HomepageHandoverJumpSelection {
  readonly kind: HomepageHandoverJumpKind;
  /** The accepted event reference from the source-backed index. */
  readonly event: LiveWalkerHandoverEvent;
  /** Stable identity for joining the scene selection to the event rail. */
  readonly eventId: string;
}

export function createHomepageHandoverJumpIntent(
  kind: HomepageHandoverJumpKind,
): HomepageHandoverJumpIntent {
  return Object.freeze({ kind });
}

export function resolveHomepageHandoverJumpIntent(
  intent: HomepageHandoverJumpIntent | null,
  input: {
    readonly indexBuilding: boolean;
    readonly matchingEvent: LiveWalkerHandoverEvent | null;
  },
): HomepageHandoverJumpSelection | null {
  if (
    intent === null
    || input.indexBuilding
    || input.matchingEvent === null
    || input.matchingEvent.kind !== intent.kind
  ) return null;
  return Object.freeze({
    kind: intent.kind,
    event: input.matchingEvent,
    eventId: input.matchingEvent.id,
  });
}
