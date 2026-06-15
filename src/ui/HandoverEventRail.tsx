import { useState, type CSSProperties } from 'react';
import { formatTimelineTime } from './TimelineBar';

export type HandoverRailEventKind = 'intra' | 'inter';
export type HandoverRailEventSource =
  | 'artifact-replay'
  | 'modqn-replay'
  | 'live-observed'
  | 'live-walker'
  | 'sinr-live-cell-truth';
export type HandoverRailSourceOwner =
  | 'artifact-replay'
  | 'modqn-producer-trace'
  | 'live-walker'
  | 'sinr-live-cell-truth';
export type HandoverRailHorizonKind = 'artifact-scenario' | 'producer-trace' | 'live-walker-window';
export type HandoverRailClaimKind =
  | 'artifact-proof'
  | 'producer-proof'
  | 'overlay-demo'
  | 'live-truth'
  | 'profile-derived-forecast';
export type HandoverRailAxisKind = 'source-time' | 'display-stretched';
export const HANDOVER_RAIL_FOCUS_SOURCE_LEAD_SEC = 10;
export const HANDOVER_RAIL_FOCUS_SOURCE_TRAIL_SEC = 20;
export const HANDOVER_RAIL_FOCUS_DISPLAY_SEC = 60;
// Display-only declutter: the track is binned into at most this many source-time
// buckets per lane so a dense window (hundreds of live-Walker events across a 2 h
// horizon) renders as distinct lines instead of an overlapping smear.
export const HANDOVER_RAIL_TARGET_MARKER_BUCKETS = 30;

export interface HandoverRailEvent {
  readonly id: string;
  readonly timeSec: number;
  readonly sourceTimeSec?: number;
  readonly clickTargetSec?: number;
  readonly displayTimeSec?: number;
  readonly kind: HandoverRailEventKind;
  readonly title: string;
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly fromSatId?: string | null;
  readonly toSatId?: string | null;
  readonly detail?: string;
  readonly source: HandoverRailEventSource;
  readonly count?: number;
}

export interface HandoverEventRailProps {
  readonly events: readonly HandoverRailEvent[];
  readonly currentTimeSec: number;
  readonly durationSec: number;
  readonly onSeek: (targetTimeSec: number) => void;
  readonly disabled?: boolean;
  readonly sourceLabel: string;
  readonly sourceOwner: HandoverRailSourceOwner;
  readonly horizonKind: HandoverRailHorizonKind;
  readonly horizonLabel: string;
  readonly claimKind: HandoverRailClaimKind;
  readonly sourceStartSec?: number;
  readonly sourceEndSec?: number;
  readonly sourceGapReasons?: readonly string[];
  readonly axisKind?: HandoverRailAxisKind;
  readonly axisLabel?: string;
  readonly axisDurationSec?: number;
  readonly axisCurrentTimeSec?: number;
  readonly axisPlaying?: boolean;
  readonly axisPlaybackRate?: number;
  readonly initialFocusedEventId?: string;
}

export interface HandoverRailSlowMotionFocus {
  readonly eventId: string;
  readonly sourceStartSec: number;
  readonly sourceEndSec: number;
  readonly sourceDurationSec: number;
  readonly sourceCurrentSec: number;
  readonly displayDurationSec: number;
  readonly displayCurrentSec: number;
  readonly clickTargetSec: number;
  readonly axisKind: 'display-stretched';
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function clampTime(value: number, durationSec: number): number {
  if (!isFiniteNumber(value)) return 0;
  return Math.min(Math.max(value, 0), durationSec);
}

function kindLabel(kind: HandoverRailEventKind): string {
  return kind === 'inter' ? 'INTER' : 'INTRA';
}

// Retained for the source-labeling contract (governance/story-layer source-pins)
// even though the source-ordered list that displayed them was retired.
function sourceLabel(source: HandoverRailEventSource): string {
  if (source === 'artifact-replay') return 'artifact';
  if (source === 'modqn-replay') return 'producer trace';
  if (source === 'sinr-live-cell-truth') return 'SINR cell truth';
  if (source === 'live-walker') return 'live Walker';
  return 'observed';
}

function emptyRailMessage(
  railSourceLabel: string,
  durationSec: number,
  sourceGapReasons: readonly string[],
): string {
  if (sourceGapReasons.length > 0) return sourceGapReasons[0] ?? '';
  if (durationSec <= 0) return 'Waiting for source-backed timeline data.';
  if (railSourceLabel.includes('sinrLiveCells') || railSourceLabel.includes('SINR cell')) {
    return 'sinrLiveCells trajectory has no handover events in this source window.';
  }
  if (railSourceLabel.includes('live Walker')) {
    return 'Source-backed live Walker index has no primary-UE handover events in this window.';
  }
  if (railSourceLabel === 'live observed') return 'Pure live SINR mode only exposes events after they occur.';
  if (railSourceLabel === 'artifact replay') return 'The loaded artifact has no validated handover event index.';
  return 'The current producer bundle has no handover rows on this timeline.';
}

function eventSort(a: HandoverRailEvent, b: HandoverRailEvent): number {
  return eventSourceTimeSec(a) - eventSourceTimeSec(b) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id);
}

interface HandoverEventMapCluster {
  readonly id: string;
  readonly timeSec: number;
  readonly clickTargetSec: number;
  readonly axisTimeSec: number;
  readonly kind: HandoverRailEventKind;
  readonly title: string;
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly source: HandoverRailEventSource;
  readonly count: number;
  readonly eventCount: number;
}

interface MutableHandoverEventMapCluster {
  id: string;
  timeSec: number;
  clickTargetSec: number;
  axisTimeSec: number;
  kind: HandoverRailEventKind;
  title: string;
  fromLabels: Set<string>;
  toLabels: Set<string>;
  source: HandoverRailEventSource;
  count: number;
  eventCount: number;
}

function eventRowCount(event: HandoverRailEvent): number {
  return event.count && event.count > 0 ? event.count : 1;
}

export function eventSourceTimeSec(event: HandoverRailEvent): number {
  return isFiniteNumber(event.sourceTimeSec ?? NaN) ? event.sourceTimeSec as number : event.timeSec;
}

function eventClickTargetSec(event: HandoverRailEvent): number {
  return isFiniteNumber(event.clickTargetSec ?? NaN) ? event.clickTargetSec as number : eventSourceTimeSec(event);
}

function eventAxisTimeSec(event: HandoverRailEvent): number {
  return isFiniteNumber(event.displayTimeSec ?? NaN) ? event.displayTimeSec as number : eventSourceTimeSec(event);
}

export function deriveHandoverRailSlowMotionFocus(input: {
  readonly eventId: string;
  readonly eventTimeSec: number;
  readonly clickTargetSec: number;
  readonly currentTimeSec: number;
  readonly durationSec: number;
  readonly sourceLeadSec?: number;
  readonly sourceTrailSec?: number;
  readonly displayDurationSec?: number;
}): HandoverRailSlowMotionFocus | null {
  const safeDurationSec = Math.max(0, isFiniteNumber(input.durationSec) ? input.durationSec : 0);
  if (safeDurationSec <= 0 || !isFiniteNumber(input.eventTimeSec)) return null;

  const sourceLeadSec = Math.max(0, input.sourceLeadSec ?? HANDOVER_RAIL_FOCUS_SOURCE_LEAD_SEC);
  const sourceTrailSec = Math.max(0, input.sourceTrailSec ?? HANDOVER_RAIL_FOCUS_SOURCE_TRAIL_SEC);
  const displayDurationSec = Math.max(1, input.displayDurationSec ?? HANDOVER_RAIL_FOCUS_DISPLAY_SEC);
  const sourceStartSec = clampTime(input.eventTimeSec - sourceLeadSec, safeDurationSec);
  const sourceEndSec = clampTime(input.eventTimeSec + sourceTrailSec, safeDurationSec);
  const sourceDurationSec = Math.max(0, sourceEndSec - sourceStartSec);
  if (sourceDurationSec <= 0) return null;

  const sourceCurrentSec = clampTime(input.currentTimeSec, safeDurationSec);
  const sourceProgress = clampTime(sourceCurrentSec - sourceStartSec, sourceDurationSec) / sourceDurationSec;
  return {
    eventId: input.eventId,
    sourceStartSec,
    sourceEndSec,
    sourceDurationSec,
    sourceCurrentSec,
    displayDurationSec,
    displayCurrentSec: sourceProgress * displayDurationSec,
    clickTargetSec: clampTime(input.clickTargetSec, safeDurationSec),
    axisKind: 'display-stretched',
  };
}

function summarizeClusterLabels(labels: ReadonlySet<string>, pluralLabel: string): string {
  const values = [...labels].filter(Boolean);
  if (values.length === 0) return 'unknown';
  if (values.length === 1) return values[0] ?? 'unknown';
  return `${values.length} ${pluralLabel}`;
}

function buildEventMapClusters(
  events: readonly HandoverRailEvent[],
  binWidthSec: number,
): readonly HandoverEventMapCluster[] {
  const safeBinWidthSec = isFiniteNumber(binWidthSec) && binWidthSec > 0 ? binWidthSec : 0;
  const clusters = new Map<string, MutableHandoverEventMapCluster>();
  // `events` arrive pre-sorted by source time (see sortedEvents at the call site),
  // so the first event seen for a bucket is its earliest. Display-only proximity
  // binning (Rule#6): events that land in the same source-time bucket (per kind)
  // collapse into one marker so a dense 2 h window reads as two lanes of distinct
  // lines, not an unreadable smear. The bucket KEY only groups — the cluster
  // id/time come from the bucket's earliest event's exact source time, so a lone
  // event keeps a stable time-based id (20.000s -> cluster-20_000_intra) and
  // click-to-seek still targets a real event. binWidthSec<=0 = exact-time
  // clustering (already-sparse windows where every event is its own line).
  for (const event of events) {
    const sourceTimeSec = eventSourceTimeSec(event);
    const representativeKey = `${sourceTimeSec.toFixed(3)}:${event.kind}`;
    const bucketKey = safeBinWidthSec > 0
      ? `${Math.floor(sourceTimeSec / safeBinWidthSec)}:${event.kind}`
      : representativeKey;
    const existing = clusters.get(bucketKey);
    if (existing) {
      existing.fromLabels.add(event.fromLabel);
      existing.toLabels.add(event.toLabel);
      existing.count += eventRowCount(event);
      existing.eventCount += 1;
      existing.title = `${kindLabel(event.kind)} handover cluster`;
      continue;
    }
    clusters.set(bucketKey, {
      id: `cluster-${representativeKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      timeSec: sourceTimeSec,
      clickTargetSec: eventClickTargetSec(event),
      axisTimeSec: eventAxisTimeSec(event),
      kind: event.kind,
      title: event.title,
      fromLabels: new Set([event.fromLabel]),
      toLabels: new Set([event.toLabel]),
      source: event.source,
      count: eventRowCount(event),
      eventCount: 1,
    });
  }

  return [...clusters.values()]
    .map(cluster => ({
      id: cluster.id,
      timeSec: cluster.timeSec,
      clickTargetSec: cluster.clickTargetSec,
      axisTimeSec: cluster.axisTimeSec,
      kind: cluster.kind,
      title: cluster.eventCount > 1 || cluster.count > 1
        ? `${kindLabel(cluster.kind)} handover cluster`
        : cluster.title,
      fromLabel: summarizeClusterLabels(cluster.fromLabels, 'sources'),
      toLabel: summarizeClusterLabels(cluster.toLabels, 'targets'),
      source: cluster.source,
      count: cluster.count,
      eventCount: cluster.eventCount,
    }))
    .sort((a, b) => a.timeSec - b.timeSec || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}

function markerCountLabel(count: number): string {
  if (count > 99) return '99+';
  return String(count);
}

export function HandoverEventRail({
  events,
  currentTimeSec,
  durationSec,
  onSeek,
  disabled = false,
  sourceLabel: railSourceLabel,
  sourceOwner,
  horizonKind,
  horizonLabel,
  claimKind,
  sourceStartSec,
  sourceEndSec,
  sourceGapReasons = [],
  axisKind = 'source-time',
  axisLabel,
  axisDurationSec,
  axisCurrentTimeSec,
  axisPlaying = false,
  axisPlaybackRate = 1,
  initialFocusedEventId,
}: HandoverEventRailProps) {
  const [focusedEventId, setFocusedEventId] = useState<string | null>(initialFocusedEventId ?? null);
  const safeDurationSec = Math.max(0, isFiniteNumber(durationSec) ? durationSec : 0);
  const safeCurrentTimeSec = clampTime(currentTimeSec, safeDurationSec);
  const safeAxisDurationSec = Math.max(
    0,
    isFiniteNumber(axisDurationSec ?? NaN) ? axisDurationSec as number : safeDurationSec,
  );
  const safeAxisCurrentTimeSec = clampTime(
    isFiniteNumber(axisCurrentTimeSec ?? NaN) ? axisCurrentTimeSec as number : safeCurrentTimeSec,
    safeAxisDurationSec,
  );
  const safeSourceStartSec = isFiniteNumber(sourceStartSec ?? NaN) ? sourceStartSec : undefined;
  const safeSourceEndSec = isFiniteNumber(sourceEndSec ?? NaN) ? sourceEndSec : undefined;
  const sortedEvents = [...events]
    .filter(event => {
      const sourceTimeSec = eventSourceTimeSec(event);
      return isFiniteNumber(sourceTimeSec) && sourceTimeSec >= 0 && sourceTimeSec <= safeDurationSec;
    })
    .sort(eventSort);
  const intraCount = sortedEvents.filter(event => event.kind === 'intra').reduce((sum, event) => sum + (event.count ?? 1), 0);
  const interCount = sortedEvents.filter(event => event.kind === 'inter').reduce((sum, event) => sum + (event.count ?? 1), 0);
  // Only declutter when the window is genuinely dense: with at most one event per
  // target bucket every event already renders as its own line, so we keep the
  // exact-time, all-events-distinct behavior (binWidthSec=0). Past that the track
  // would smear, so we bin into source-time buckets per lane.
  const eventMapClusters = buildEventMapClusters(
    sortedEvents,
    safeDurationSec > 0 && sortedEvents.length > HANDOVER_RAIL_TARGET_MARKER_BUCKETS
      ? safeDurationSec / HANDOVER_RAIL_TARGET_MARKER_BUCKETS
      : 0,
  );
  const progressPercent = safeAxisDurationSec > 0 ? (safeAxisCurrentTimeSec / safeAxisDurationSec) * 100 : 0;
  const canSeek = !disabled && safeDurationSec > 0;
  const slowMotionFocusEnabled =
    (sourceOwner === 'live-walker' || sourceOwner === 'sinr-live-cell-truth')
    && horizonKind === 'live-walker-window';
  const resolvedAxisLabel = axisLabel ?? (axisKind === 'display-stretched' ? 'display-stretched axis' : 'source time axis');
  const animateAxisCursor = axisKind === 'display-stretched' && axisPlaying && safeAxisDurationSec > 0;
  const safeAxisPlaybackRate = isFiniteNumber(axisPlaybackRate) && axisPlaybackRate > 0 ? axisPlaybackRate : 1;
  const animationDurationSec = safeAxisDurationSec / safeAxisPlaybackRate;
  const headline = eventMapClusters.length > 0
    ? `${eventMapClusters.length} marker${eventMapClusters.length === 1 ? '' : 's'}`
    : 'No HO index';
  const focusedCluster = eventMapClusters.find(cluster => cluster.id === focusedEventId) ?? null;
  const slowMotionFocus = slowMotionFocusEnabled && focusedCluster !== null
    ? deriveHandoverRailSlowMotionFocus({
      eventId: focusedCluster.id,
      eventTimeSec: focusedCluster.timeSec,
      clickTargetSec: focusedCluster.clickTargetSec,
      currentTimeSec: safeCurrentTimeSec,
      durationSec: safeDurationSec,
    })
    : null;
  const focusProgressPercent = slowMotionFocus !== null
    ? (slowMotionFocus.displayCurrentSec / slowMotionFocus.displayDurationSec) * 100
    : 0;

  const seekTo = (targetTimeSec: number) => {
    if (!canSeek) return;
    onSeek(clampTime(targetTimeSec, safeDurationSec));
  };

  const selectClusterAndSeek = (cluster: HandoverEventMapCluster) => {
    if (!canSeek) return;
    if (slowMotionFocusEnabled) setFocusedEventId(cluster.id);
    seekTo(cluster.clickTargetSec);
  };

  return (
    <section
      className="leo-handover-event-rail"
      aria-label="Handover event rail"
      data-testid="handover-event-rail"
      data-source={railSourceLabel}
      data-source-owner={sourceOwner}
      data-horizon-kind={horizonKind}
      data-horizon-sec={safeDurationSec.toFixed(3)}
      data-claim-kind={claimKind}
      data-source-start-sec={safeSourceStartSec === undefined ? '' : safeSourceStartSec.toFixed(3)}
      data-source-end-sec={safeSourceEndSec === undefined ? '' : safeSourceEndSec.toFixed(3)}
      data-source-gap-count={String(sourceGapReasons.length)}
      data-event-count={String(sortedEvents.length)}
      data-intra-count={String(intraCount)}
      data-inter-count={String(interCount)}
      data-map-layout="fixed-event-map"
      data-map-order="source-time"
      data-marker-cluster-count={String(eventMapClusters.length)}
      data-cursor-mode="independent"
      data-axis-kind={axisKind}
      data-axis-sec={safeAxisDurationSec.toFixed(3)}
      data-axis-current-sec={safeAxisCurrentTimeSec.toFixed(3)}
      data-axis-label={resolvedAxisLabel}
      data-axis-playing={animateAxisCursor ? 'true' : 'false'}
      data-axis-playback-rate={safeAxisPlaybackRate.toFixed(3)}
      data-focus-enabled={slowMotionFocusEnabled ? 'true' : 'false'}
      data-focus-open={slowMotionFocus !== null ? 'true' : 'false'}
      data-focus-event-id={slowMotionFocus?.eventId ?? ''}
      data-focus-axis-kind={slowMotionFocus?.axisKind ?? ''}
      data-focus-source-start-sec={slowMotionFocus?.sourceStartSec.toFixed(3) ?? ''}
      data-focus-source-end-sec={slowMotionFocus?.sourceEndSec.toFixed(3) ?? ''}
      data-focus-display-sec={slowMotionFocus?.displayDurationSec.toFixed(3) ?? ''}
      data-focus-click-target-sec={slowMotionFocus?.clickTargetSec.toFixed(3) ?? ''}
    >
      <div className="leo-handover-event-rail__header">
        <div>
          <span className="leo-handover-event-rail__eyebrow">Handover map</span>
          <strong>{headline}</strong>
        </div>
        <span className="leo-handover-event-rail__source">{railSourceLabel}</span>
      </div>
      <div className="leo-handover-event-rail__metadata" aria-label="Handover rail source and horizon">
        <span>{horizonLabel}</span>
        <span>{claimKind}</span>
        <span>{resolvedAxisLabel}</span>
      </div>
      {sourceGapReasons.length > 0 ? (
        <div className="leo-handover-event-rail__source-gap" data-testid="handover-event-rail-source-gap">
          {sourceGapReasons[0]}
        </div>
      ) : null}

      <div className="leo-handover-event-rail__summary" aria-label="Handover counts">
        <span data-kind="intra">
          <strong>{intraCount}</strong>
          <small>INTRA</small>
        </span>
        <span data-kind="inter">
          <strong>{interCount}</strong>
          <small>INTER</small>
        </span>
        <span>
          <strong>{formatTimelineTime(safeAxisCurrentTimeSec)}</strong>
          <small>{axisKind === 'display-stretched' ? 'display' : 'cursor'}</small>
        </span>
      </div>

      <div
        className="leo-handover-event-rail__track"
        aria-label="Fixed handover event map on source timeline"
        data-testid="handover-event-map-track"
      >
        <div className="leo-handover-event-rail__lane" data-kind="intra" aria-hidden="true" />
        <div className="leo-handover-event-rail__lane" data-kind="inter" aria-hidden="true" />
        <span
          className="leo-handover-event-rail__cursor"
          data-axis-playing={animateAxisCursor ? 'true' : 'false'}
          style={{
            '--handover-rail-current': `${progressPercent}%`,
            '--handover-rail-axis-duration': `${animationDurationSec}s`,
            '--handover-rail-axis-delay': `${-(safeAxisCurrentTimeSec / safeAxisPlaybackRate)}s`,
          } as CSSProperties}
          aria-hidden="true"
        />
        {eventMapClusters.map(cluster => {
          const leftPercent = safeAxisDurationSec > 0 ? (cluster.axisTimeSec / safeAxisDurationSec) * 100 : 0;
          const active = Math.abs(cluster.axisTimeSec - safeAxisCurrentTimeSec) <= 1.5;
          const edge = leftPercent < 2.5 ? 'start' : leftPercent > 97.5 ? 'end' : 'middle';
          const clustered = cluster.count > 1 || cluster.eventCount > 1;
          return (
            <button
              key={cluster.id}
              className="leo-handover-event-rail__marker"
              type="button"
              data-testid={`handover-event-marker-${cluster.id}`}
              data-kind={cluster.kind}
              data-active={active ? 'true' : 'false'}
              data-selected={focusedCluster?.id === cluster.id ? 'true' : 'false'}
              data-edge={edge}
              data-count={String(cluster.count)}
              data-clustered={clustered ? 'true' : 'false'}
              data-source-time-sec={cluster.timeSec.toFixed(3)}
              data-click-target-sec={cluster.clickTargetSec.toFixed(3)}
              data-axis-time-sec={cluster.axisTimeSec.toFixed(3)}
              style={{ '--handover-rail-left': `${leftPercent}%` } as CSSProperties}
              disabled={!canSeek}
              title={`${formatTimelineTime(cluster.axisTimeSec)} ${kindLabel(cluster.kind)}: ${cluster.fromLabel} to ${cluster.toLabel}${clustered ? ` (${cluster.count} rows)` : ''}`}
              aria-label={`Seek to ${kindLabel(cluster.kind)} handover marker at ${formatTimelineTime(cluster.axisTimeSec)} from ${cluster.fromLabel} to ${cluster.toLabel}${clustered ? `, ${cluster.count} source rows` : ''}`}
              onClick={() => selectClusterAndSeek(cluster)}
            >
              {clustered ? (
                <span className="leo-handover-event-rail__marker-count">{markerCountLabel(cluster.count)}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="leo-handover-event-rail__axis" aria-hidden="true">
        <span>0:00</span>
        <span>{formatTimelineTime(safeAxisDurationSec / 2)}</span>
        <span>{formatTimelineTime(safeAxisDurationSec)}</span>
      </div>

      {slowMotionFocus !== null && focusedCluster !== null ? (
        <div
          className="leo-handover-event-rail__focus-panel"
          data-testid="handover-event-slow-focus"
          data-kind={focusedCluster.kind}
          data-source-owner={sourceOwner}
          data-horizon-kind={horizonKind}
          data-axis-kind={slowMotionFocus.axisKind}
          data-source-time-sec={focusedCluster.timeSec.toFixed(3)}
          data-source-start-sec={slowMotionFocus.sourceStartSec.toFixed(3)}
          data-source-end-sec={slowMotionFocus.sourceEndSec.toFixed(3)}
          data-source-duration-sec={slowMotionFocus.sourceDurationSec.toFixed(3)}
          data-display-sec={slowMotionFocus.displayDurationSec.toFixed(3)}
          data-display-current-sec={slowMotionFocus.displayCurrentSec.toFixed(3)}
          data-click-target-sec={slowMotionFocus.clickTargetSec.toFixed(3)}
        >
          <div className="leo-handover-event-rail__focus-header">
            <span>Slow-motion focus</span>
            <strong>{kindLabel(focusedCluster.kind)} · {formatTimelineTime(focusedCluster.timeSec)}</strong>
          </div>
          <div className="leo-handover-event-rail__focus-grid" aria-label="Selected handover focus timing">
            <span>
              <small>source window</small>
              <strong>{formatTimelineTime(slowMotionFocus.sourceStartSec)}-{formatTimelineTime(slowMotionFocus.sourceEndSec)}</strong>
            </span>
            <span>
              <small>display lens</small>
              <strong>{formatTimelineTime(slowMotionFocus.displayDurationSec)}</strong>
            </span>
          </div>
          <div
            className="leo-handover-event-rail__focus-bar"
            aria-hidden="true"
            data-axis-kind={slowMotionFocus.axisKind}
          >
            <span
              className="leo-handover-event-rail__focus-playhead"
              style={{ '--handover-rail-focus-current': `${focusProgressPercent}%` } as CSSProperties}
            />
          </div>
          <button
            className="leo-handover-event-rail__focus"
            type="button"
            data-kind={focusedCluster.kind}
            data-temporal={Math.abs(focusedCluster.timeSec - safeCurrentTimeSec) <= 1.5 ? 'current' : 'selected'}
            data-testid="handover-event-slow-focus-seek"
            disabled={!canSeek}
            onClick={() => seekTo(slowMotionFocus.clickTargetSec)}
          >
            <span className="leo-handover-event-rail__focus-pin">{kindLabel(focusedCluster.kind)}</span>
            <span className="leo-handover-event-rail__focus-main">
              <strong>{focusedCluster.fromLabel} -&gt; {focusedCluster.toLabel}</strong>
              <small>source {formatTimelineTime(focusedCluster.timeSec)} · target {formatTimelineTime(slowMotionFocus.clickTargetSec)}</small>
            </span>
            <span className="leo-handover-event-rail__focus-delta">
              {formatTimelineTime(slowMotionFocus.displayCurrentSec)}
            </span>
          </button>
        </div>
      ) : null}

    </section>
  );
}
