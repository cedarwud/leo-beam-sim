import type { LiveWalkerHandoverEvent } from '../../scene/liveWalkerHandoverEventIndex';
import { evaluateHomepageAcceptanceAlignment } from './homepageAcceptanceAlignment';

/**
 * One source-time teaching window. `events[0]` is the intra event and
 * `events[1]` is its later inter event; the tuple is frozen at runtime.
 *
 * This is a window selector, not a second decision/snapshot/clock. It only
 * packages references to existing source events and their existing seek
 * targets. It does not calculate EE, candidate eligibility, phase, or time.
 */
export interface HomepageDemoWindow {
  readonly events: readonly [LiveWalkerHandoverEvent, LiveWalkerHandoverEvent];
  /** Pure geometry/order gate that admitted this source pair. */
  readonly alignment: ReturnType<typeof evaluateHomepageAcceptanceAlignment>;
  /** The clamped source-time lead-in/seek target of the first event. */
  readonly leadInSec: number;
  /** The clamped source-time end/seek target of the last event. */
  readonly endSec: number;
  readonly firstEventId: string;
  readonly lastEventId: string;
}

interface TimedEvent {
  readonly event: LiveWalkerHandoverEvent;
  readonly sourceTimeSec: number;
  readonly sourceStartSec: number;
  readonly sourceEndSec: number;
}

/**
 * The homepage buttons are a teaching shortcut, not a cinema shot.  Keep the
 * seek inside the event's existing source window, but start close enough to the
 * indexed event that the first candidate/TTT state becomes visible quickly.
 * This is a source-window calculation only; it creates no event or decision.
 */
export const HOMEPAGE_QUICK_JUMP_LEAD_IN_SEC = 3;

export function resolveHomepageQuickJumpSourceSec(
  event: Pick<LiveWalkerHandoverEvent, 'sourceTimeSec' | 'sourceStartSec' | 'sourceEndSec'>,
): number | null {
  if (
    !Number.isFinite(event.sourceTimeSec)
    || !Number.isFinite(event.sourceStartSec)
    || !Number.isFinite(event.sourceEndSec)
  ) return null;
  const sourceSec = Math.max(
    event.sourceStartSec,
    event.sourceTimeSec - HOMEPAGE_QUICK_JUMP_LEAD_IN_SEC,
  );
  return Math.min(event.sourceEndSec, sourceSec);
}

function clampToDuration(value: number, durationSec: number): number {
  return Math.min(Math.max(value, 0), durationSec);
}

function safeDurationSec(durationSec: number): number {
  return Number.isFinite(durationSec) ? Math.max(0, durationSec) : 0;
}

function safeCurrentTimeSec(simTimeSec: number, durationSec: number): number {
  return Number.isFinite(simTimeSec)
    ? clampToDuration(simTimeSec, durationSec)
    : 0;
}

/**
 * A primary-only Walker event has no optional `ueId`; in that case its required
 * `primaryUeId` is the stable identity. Cell-truth rows carry `ueId`, which
 * takes precedence so an aggregate index cannot silently cross UEs.
 */
function eventUeId(event: LiveWalkerHandoverEvent): string {
  return event.ueId ?? event.primaryUeId;
}

function sameUe(left: LiveWalkerHandoverEvent, right: LiveWalkerHandoverEvent): boolean {
  return eventUeId(left) === eventUeId(right);
}

/**
 * Preserve the source ordering supplied by the event index. Sorting here
 * would hide a broken source sequence and would make an invalid pair appear
 * natural. Events outside the active duration are ignored for this window;
 * selected events themselves must remain inside the duration.
 */
function readOrderedEvents(
  events: readonly LiveWalkerHandoverEvent[],
  durationSec: number,
): readonly TimedEvent[] | null {
  const inDuration: TimedEvent[] = [];
  let previousSourceTimeSec = Number.NEGATIVE_INFINITY;

  for (const event of events) {
    const sourceTimeSec = event.sourceTimeSec;
    if (!Number.isFinite(sourceTimeSec) || sourceTimeSec < previousSourceTimeSec) return null;
    previousSourceTimeSec = sourceTimeSec;

    if (sourceTimeSec < 0 || sourceTimeSec > durationSec) continue;
    if (!Number.isFinite(event.sourceStartSec) || !Number.isFinite(event.sourceEndSec)) return null;

    inDuration.push({
      event,
      sourceTimeSec,
      sourceStartSec: event.sourceStartSec,
      sourceEndSec: event.sourceEndSec,
    });
  }

  return inDuration;
}

function buildWindow(
  intra: TimedEvent,
  inter: TimedEvent,
  currentTimeSec: number,
  durationSec: number,
): HomepageDemoWindow | null {
  const alignment = evaluateHomepageAcceptanceAlignment(intra.event, inter.event);
  if (!alignment.aligned || !sameUe(intra.event, inter.event)) return null;

  // These are already source-owned window boundaries.  In particular,
  // `clickTargetSec` is the event instant and would skip the candidate/TTT
  // lead-in if it were used as the demo jump target.
  const leadInSec = clampToDuration(intra.sourceStartSec, durationSec);
  const endSec = clampToDuration(inter.sourceEndSec, durationSec);

  // The clamped window must contain both real source events. This rejects a
  // reversed/partial source window instead of stretching the interval or
  // inventing another boundary.
  if (
    leadInSec > intra.sourceTimeSec
    || intra.sourceEndSec < intra.sourceTimeSec
    || inter.sourceStartSec > inter.sourceTimeSec
    || endSec < inter.sourceTimeSec
    || endSec <= leadInSec
    || endSec < currentTimeSec
  ) return null;

  const eventPair = Object.freeze([intra.event, inter.event] as const);
  return Object.freeze({
    events: eventPair,
    alignment,
    leadInSec,
    endSec,
    firstEventId: intra.event.id,
    lastEventId: inter.event.id,
  });
}

/**
 * Select the first complete natural window that is not already behind the
 * current simulation cursor. The source event list must already be ordered;
 * this function deliberately never sorts, rewrites, or creates an event.
 */
export function selectHomepageDemoWindow(
  events: readonly LiveWalkerHandoverEvent[],
  simTimeSec: number,
  durationSec: number,
): HomepageDemoWindow | null {
  const safeDuration = safeDurationSec(durationSec);
  if (safeDuration <= 0) return null;

  const orderedEvents = readOrderedEvents(events, safeDuration);
  if (orderedEvents === null || orderedEvents.length < 2) return null;

  const currentTimeSec = safeCurrentTimeSec(simTimeSec, safeDuration);
  for (let intraIndex = 0; intraIndex < orderedEvents.length; intraIndex += 1) {
    const intra = orderedEvents[intraIndex]!;
    if (intra.event.kind !== 'intra') continue;

    // Pair with the first later inter that continues this protagonist's
    // already-ordered service chain. Other protagonists can appear in an
    // aggregate source index; they are not a reason to discard this
    // protagonist's source-backed window or fabricate a cross-UE teaching
    // story. A later inter is deliberately still considered when an earlier
    // row is a different-satellite event, so Demo cannot jump from an intra on
    // A to an unrelated inter that starts on B.
    for (let interIndex = intraIndex + 1; interIndex < orderedEvents.length; interIndex += 1) {
      const inter = orderedEvents[interIndex]!;
      if (inter.event.kind !== 'inter' || inter.sourceTimeSec <= intra.sourceTimeSec) continue;

      if (!sameUe(intra.event, inter.event)) continue;
      const alignment = evaluateHomepageAcceptanceAlignment(intra.event, inter.event);
      if (!alignment.aligned) {
        // A disconnected inter row is not the continuation of this intra
        // story, so keep looking for the next same-UE inter. Once a continuous
        // row exists but its source window is already behind the cursor (or is
        // otherwise malformed), preserve the original selector semantics and
        // move to the next intra instead of stretching this pair indefinitely.
        if (alignment.failedChecks.includes('inter-follows-intra')) continue;
        break;
      }
      const window = buildWindow(intra, inter, currentTimeSec, safeDuration);
      if (window !== null) return window;
      break;
    }
  }

  return null;
}
