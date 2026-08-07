import type { ModqnReplayEnvelope } from '../modqn/replay-bundle';
import type { SceneSourceMode } from './appPersistence';
import type { SceneLane } from './sceneLane';

export type TimelineSurfaceSourceOwner =
  | 'live-walker'
  | 'sinr-live-cell-truth'
  | 'modqn-producer-trace'
  | 'artifact-replay';
export type TimelineSurfaceHorizonKind = 'live-walker-window' | 'producer-trace' | 'artifact-scenario';
export type TimelineSurfaceClaimKind =
  | 'live-truth'
  | 'profile-derived-forecast'
  | 'overlay-demo'
  | 'producer-proof'
  | 'artifact-proof';
export type TimelineSurfaceAxisKind = 'source-time' | 'display-stretched';

export interface ModqnProducerTraceRange {
  readonly startSec: number;
  readonly endSec: number;
  readonly durationSec: number;
  readonly rangeLabel: string;
}

export interface TimelineSurfaceDescriptor {
  readonly sourceLabel: string;
  readonly sourceOwner: TimelineSurfaceSourceOwner;
  readonly horizonKind: TimelineSurfaceHorizonKind;
  readonly horizonLabel: string;
  readonly horizonSec: number;
  readonly claimKind: TimelineSurfaceClaimKind;
  readonly durationSec: number;
  readonly currentTimeSec: number;
  readonly sourceStartSec?: number;
  readonly sourceEndSec?: number;
  readonly sourceGapReasons: readonly string[];
  readonly axisKind: TimelineSurfaceAxisKind;
  readonly axisLabel: string;
  readonly axisDurationSec: number;
  readonly axisCurrentTimeSec: number;
}

export interface TimelineRailDescriptor {
  readonly timeline: TimelineSurfaceDescriptor;
  readonly rail: TimelineSurfaceDescriptor;
}

export const LEGACY_PRODUCER_TRACE_SOURCE_GAP =
  'Source gap: this bundle exports only a 10-second producer trace. It does not export a 2-hour Walker handover timeline.';

const ARTIFACT_EVENT_INDEX_SOURCE_GAP =
  'Source gap: loaded artifact has no validated handover event index.';

export function clampTimelineTime(targetSec: number, durationSec: number): number {
  const safeDurationSec = Number.isFinite(durationSec) ? Math.max(0, durationSec) : 0;
  if (!Number.isFinite(targetSec)) return 0;
  return Math.min(Math.max(targetSec, 0), safeDurationSec);
}

function formatShortSeconds(value: number): string {
  if (!Number.isFinite(value)) return '0s';
  return Number.isInteger(value) ? `${value}s` : `${value.toFixed(1)}s`;
}

function formatDurationLabel(durationSec: number): string {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return '0s';
  if (durationSec >= 3600 && durationSec % 3600 === 0) return `${durationSec / 3600} h`;
  if (durationSec >= 60 && durationSec % 60 === 0) return `${durationSec / 60} min`;
  return formatShortSeconds(durationSec);
}

function formatSourceRangeLabel(startSec: number, endSec: number): string {
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= 0) return '0s';
  if (startSec > 0 && startSec !== endSec) {
    return `${formatShortSeconds(startSec)}-${formatShortSeconds(endSec)}`;
  }
  return formatShortSeconds(endSec);
}

export function getModqnProducerTraceRange(envelope: ModqnReplayEnvelope | null): ModqnProducerTraceRange | null {
  if (envelope === null) return null;

  let startSec = Infinity;
  let endSec = -Infinity;
  for (const slot of envelope.replaySlots) {
    for (const row of slot.rows) {
      const timeSec = row.producerTruth.timestamps.timeSec;
      if (!Number.isFinite(timeSec)) continue;
      startSec = Math.min(startSec, timeSec);
      endSec = Math.max(endSec, timeSec);
    }
  }

  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec < 0) return null;
  return {
    startSec,
    endSec,
    durationSec: endSec,
    rangeLabel: formatSourceRangeLabel(startSec, endSec),
  };
}

function getModqnProducerTraceLabel(
  range: ModqnProducerTraceRange | null,
  bundleProvenanceKind: 'paper-faithful' | 'user-trained',
): string {
  const prefix = bundleProvenanceKind === 'paper-faithful'
    ? 'Legacy producer trace'
    : 'Producer trace';
  return `${prefix} ${range?.rangeLabel ?? 'source rows'} - not live`;
}

export function resolveTimelineRailDescriptor(input: {
  readonly sceneLane: SceneLane;
  readonly sceneSource: SceneSourceMode;
  readonly liveDurationSec: number;
  readonly liveCurrentTimeSec: number;
  readonly artifactDurationSec: number;
  readonly artifactCurrentTimeSec: number;
  readonly artifactHandoverEventCount: number;
  readonly producerTraceRange: ModqnProducerTraceRange | null;
  readonly producerTraceCurrentTimeSec: number;
  readonly producerTraceDisplayDurationSec: number;
  readonly producerTraceDisplayCurrentTimeSec: number;
  readonly bundleProvenanceKind: 'paper-faithful' | 'user-trained';
  readonly liveWalkerHandoverEventIndexSourceGapReasons?: readonly string[];
}): TimelineRailDescriptor {
  const liveTimeline: TimelineSurfaceDescriptor = {
    sourceLabel: input.sceneLane === 'modqn-live-cell-preview'
      ? 'MODQN overlay on live timeline - demo'
      : 'Live timeline',
    sourceOwner: 'live-walker',
    horizonKind: 'live-walker-window',
    horizonLabel: input.sceneLane === 'modqn-live-cell-preview'
      ? `Live timeline ${formatDurationLabel(input.liveDurationSec)} with MODQN overlay`
      : `Live timeline ${formatDurationLabel(input.liveDurationSec)}`,
    horizonSec: input.liveDurationSec,
    claimKind: input.sceneLane === 'modqn-live-cell-preview' ? 'overlay-demo' : 'live-truth',
    durationSec: input.liveDurationSec,
    currentTimeSec: input.liveCurrentTimeSec,
    sourceStartSec: 0,
    sourceEndSec: input.liveDurationSec,
    sourceGapReasons: [],
    axisKind: 'source-time',
    axisLabel: 'source time axis',
    axisDurationSec: input.liveDurationSec,
    axisCurrentTimeSec: input.liveCurrentTimeSec,
  };
  const liveRail: TimelineSurfaceDescriptor = {
    ...liveTimeline,
    sourceLabel: input.sceneLane === 'modqn-live-cell-preview'
      ? 'live event index - MODQN overlay'
      : 'sinrLiveCells event index - cell truth',
    sourceOwner: input.sceneLane === 'modqn-live-cell-preview'
      ? 'live-walker'
      : 'sinr-live-cell-truth',
    horizonLabel: input.sceneLane === 'modqn-live-cell-preview'
      ? `live event index ${formatDurationLabel(input.liveDurationSec)} with MODQN overlay`
      : `sinrLiveCells cell-truth trajectory on ${formatDurationLabel(input.liveDurationSec)} window`,
    claimKind: input.sceneLane === 'modqn-live-cell-preview'
      ? 'overlay-demo'
      : 'live-truth',
    sourceGapReasons: input.liveWalkerHandoverEventIndexSourceGapReasons ?? [],
  };

  const artifactTimeline: TimelineSurfaceDescriptor = {
    sourceLabel: 'artifact replay',
    sourceOwner: 'artifact-replay',
    horizonKind: 'artifact-scenario',
    horizonLabel: 'Artifact replay - visual-showcase-v1',
    horizonSec: input.artifactDurationSec,
    claimKind: 'artifact-proof',
    durationSec: input.artifactDurationSec,
    currentTimeSec: input.artifactCurrentTimeSec,
    sourceStartSec: 0,
    sourceEndSec: input.artifactDurationSec,
    sourceGapReasons: [],
    axisKind: 'source-time',
    axisLabel: 'source time axis',
    axisDurationSec: input.artifactDurationSec,
    axisCurrentTimeSec: input.artifactCurrentTimeSec,
  };
  const artifactRail: TimelineSurfaceDescriptor = {
    ...artifactTimeline,
    sourceLabel: input.artifactHandoverEventCount > 0
      ? 'artifact event index'
      : 'artifact event index - source gap',
    sourceGapReasons: input.artifactHandoverEventCount > 0
      ? []
      : [ARTIFACT_EVENT_INDEX_SOURCE_GAP],
  };

  const producerLabel = getModqnProducerTraceLabel(
    input.producerTraceRange,
    input.bundleProvenanceKind,
  );
  const producerDurationSec = input.producerTraceRange?.durationSec ?? 0;
  const producerAxisDurationSec = input.producerTraceRange === null
    ? 0
    : input.producerTraceDisplayDurationSec;
  const producerAxisCurrentTimeSec = clampTimelineTime(
    input.producerTraceDisplayCurrentTimeSec,
    producerAxisDurationSec,
  );
  const producerTrace: TimelineSurfaceDescriptor = {
    sourceLabel: producerLabel,
    sourceOwner: 'modqn-producer-trace',
    horizonKind: 'producer-trace',
    horizonLabel: input.producerTraceRange
      ? `${producerLabel} - rail display ${formatDurationLabel(producerAxisDurationSec)}`
      : 'producer rows unavailable',
    horizonSec: producerDurationSec,
    claimKind: input.sceneLane === 'modqn-replay-proof' ? 'producer-proof' : 'overlay-demo',
    durationSec: producerDurationSec,
    currentTimeSec: clampTimelineTime(input.producerTraceCurrentTimeSec, producerDurationSec),
    sourceStartSec: input.producerTraceRange?.startSec,
    sourceEndSec: input.producerTraceRange?.endSec,
    sourceGapReasons: input.bundleProvenanceKind === 'paper-faithful'
      ? [LEGACY_PRODUCER_TRACE_SOURCE_GAP]
      : ['Source gap: producer replay exports only its own trace horizon; it is not a live-timeline forecast.'],
    axisKind: 'display-stretched',
    axisLabel: 'rail readability display axis',
    axisDurationSec: producerAxisDurationSec,
    axisCurrentTimeSec: producerAxisCurrentTimeSec,
  };
  const producerSourceTimeline: TimelineSurfaceDescriptor = {
    ...producerTrace,
    sourceLabel: producerLabel,
    horizonLabel: input.producerTraceRange
      ? `${producerLabel} - source time`
      : 'producer rows unavailable',
    durationSec: producerDurationSec,
    currentTimeSec: clampTimelineTime(input.producerTraceCurrentTimeSec, producerDurationSec),
    axisKind: 'source-time',
    axisLabel: 'source time axis',
    axisDurationSec: producerDurationSec,
    axisCurrentTimeSec: clampTimelineTime(input.producerTraceCurrentTimeSec, producerDurationSec),
  };

  if (input.sceneSource === 'artifact-replay') {
    return { timeline: artifactTimeline, rail: artifactRail };
  }
  if (input.sceneLane === 'modqn-replay-proof') {
    return { timeline: producerSourceTimeline, rail: producerTrace };
  }
  if (input.sceneLane === 'modqn-live-cell-preview') {
    return { timeline: liveTimeline, rail: liveRail };
  }
  return { timeline: liveTimeline, rail: liveRail };
}
