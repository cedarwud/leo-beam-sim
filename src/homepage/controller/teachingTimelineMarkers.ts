import type { HandoverRailEvent } from '../../ui/HandoverEventRail';
import type { TimelineEventMarker } from '../../ui/TimelineBar';

export interface HomepageTeachingTimelineMarkerOptions {
  /** The source-axis duration used to reject events outside the active run. */
  readonly durationSec: number;
  /** Retained for the homepage call-site contract; complete pairs may span it. */
  readonly teachingWindowSec?: number;
  /** Keep the marker track readable by selecting a bounded number per kind. */
  readonly maxMarkersPerKind?: number;
}

const DEFAULT_MAX_MARKERS_PER_KIND = 1;

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function sourceTimeSec(event: HandoverRailEvent): number {
  return isFiniteNumber(event.sourceTimeSec ?? NaN)
    ? event.sourceTimeSec as number
    : event.timeSec;
}

function clickTargetSec(event: HandoverRailEvent, sourceTime: number, durationSec: number): number {
  const candidate = isFiniteNumber(event.clickTargetSec ?? NaN)
    ? event.clickTargetSec as number
    : sourceTime;
  return Math.min(Math.max(candidate, 0), durationSec);
}

function kindLabel(kind: HandoverRailEvent['kind']): string {
  return kind === 'intra' ? 'INTRA' : 'INTER';
}

function continuesFromIntra(
  intra: HandoverRailEvent,
  inter: HandoverRailEvent,
): boolean {
  // Legacy hand-authored rail fixtures may omit satellite ids. Keep those
  // fixtures usable, while the live homepage requires the inter event to start
  // on the satellite that won the preceding intra transition.
  return intra.toSatId === undefined
    || intra.toSatId === null
    || inter.fromSatId === undefined
    || inter.fromSatId === null
    || inter.fromSatId === intra.toSatId;
}

function toTimelineMarker(event: HandoverRailEvent, durationSec: number): TimelineEventMarker {
  const sourceTime = sourceTimeSec(event);
  const targetTime = clickTargetSec(event, sourceTime, durationSec);
  const kind = kindLabel(event.kind);
  return {
    id: `teaching-${event.kind}-${event.id}`,
    kind: event.kind,
    sourceTimeSec: sourceTime,
    clickTargetSec: targetTime,
    ariaLabel: `Seek to ${kind} handover at ${sourceTime.toFixed(3)} seconds from ${event.fromLabel} to ${event.toLabel} (source event ${event.id})`,
    title: `${kind} teaching event · source ${sourceTime.toFixed(3)} seconds · source event ${event.id} · ${event.fromLabel} → ${event.toLabel}`,
  };
}

/**
 * Selects a small, deterministic teaching set from the source-backed event
 * rail. This is presentation policy only: the event rail remains the sole
 * producer of source time, kind, and seek target, while the transport owns the
 * actual seek. No handover decision or second clock is created here.
 */
export function selectHomepageTeachingTimelineMarkers(
  events: readonly HandoverRailEvent[],
  options: HomepageTeachingTimelineMarkerOptions,
): readonly TimelineEventMarker[] {
  const durationSec = Math.max(0, isFiniteNumber(options.durationSec) ? options.durationSec : 0);
  if (durationSec <= 0) return [];

  const maxMarkersPerKind = Math.max(
    1,
    Math.floor(isFiniteNumber(options.maxMarkersPerKind ?? NaN)
      ? options.maxMarkersPerKind as number
      : DEFAULT_MAX_MARKERS_PER_KIND),
  );
  const validEvents = events
    .map(event => ({ event, sourceTime: sourceTimeSec(event) }))
    .filter(({ sourceTime }) => isFiniteNumber(sourceTime) && sourceTime >= 0 && sourceTime <= durationSec)
    .sort((a, b) => (
      a.sourceTime - b.sourceTime
      || a.event.kind.localeCompare(b.event.kind)
      || a.event.id.localeCompare(b.event.id)
    ));

  const selected: HandoverRailEvent[] = [];

  // When the source contains a complete teaching pair, keep the two markers
  // together: an earlier inter from the same two-hour run must not be paired
  // with a later intra merely because each kind was selected independently.
  // This is presentation-only; the source event index still owns event order
  // and the transport still owns the seek.
  let completePair: readonly [HandoverRailEvent, HandoverRailEvent] | null = null;
  for (let intraIndex = 0; intraIndex < validEvents.length && completePair === null; intraIndex += 1) {
    const intra = validEvents[intraIndex]!;
    if (intra.event.kind !== 'intra') continue;
    for (let interIndex = intraIndex + 1; interIndex < validEvents.length; interIndex += 1) {
      const inter = validEvents[interIndex]!;
      if (inter.sourceTime <= intra.sourceTime || inter.event.kind !== 'inter') continue;
      if (!continuesFromIntra(intra.event, inter.event)) continue;
      completePair = [intra.event, inter.event];
      break;
    }
  }
  // A partial track would advertise an event that the natural demo-window
  // selector cannot select. Fail closed until both source-indexed kinds exist.
  if (completePair !== null) {
    selected.push(...completePair.slice(0, maxMarkersPerKind * 2));
  }

  return selected
    .sort((a, b) => sourceTimeSec(a) - sourceTimeSec(b) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))
    .map(event => toTimelineMarker(event, durationSec));
}
