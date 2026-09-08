import type { SceneSourceMode } from './appPersistence';
import type { SceneLane } from './sceneLane';

export type TimelineSurfaceSourceOwner =
  | 'live-walker'
  | 'sinr-live-cell-truth'
  | 'artifact-replay'
  | 'archived-tle-run';
export type TimelineSurfaceHorizonKind =
  | 'live-walker-window'
  | 'producer-trace'
  | 'artifact-scenario'
  | 'archived-tle-window';
export type TimelineSurfaceClaimKind =
  | 'live-truth'
  | 'profile-derived-forecast'
  | 'overlay-demo'
  | 'artifact-proof'
  | 'tle-derived-run';
export type TimelineSurfaceAxisKind = 'source-time';

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

export type LegacyTimelineSurfaceDescriptor = Omit<
  TimelineSurfaceDescriptor,
  'sourceOwner' | 'horizonKind' | 'claimKind'
> & {
  readonly sourceOwner: Exclude<TimelineSurfaceSourceOwner, 'archived-tle-run'>;
  readonly horizonKind: Exclude<TimelineSurfaceHorizonKind, 'archived-tle-window'>;
  readonly claimKind: Exclude<TimelineSurfaceClaimKind, 'tle-derived-run'>;
};

export interface TimelineRailDescriptor {
  readonly timeline: LegacyTimelineSurfaceDescriptor;
  readonly rail: LegacyTimelineSurfaceDescriptor;
}

export interface ArchivedTleRunTimelineInput {
  /** True only after all archived TLE anchors have been calculated and published. */
  readonly runReady: boolean;
  readonly durationSec: number;
  readonly currentTimeSec: number;
  readonly stepSec: number;
}

/**
 * Authority descriptor for the homepage's fully materialized archived-TLE run.
 *
 * This deliberately does not reuse the Walker/live descriptor: the two-hour
 * surface is source-time over a frozen TLE publication and is seekable only
 * after every 30-second SGP4 anchor has been calculated.
 */
export function createArchivedTleRunTimelineDescriptor(
  input: ArchivedTleRunTimelineInput,
): TimelineSurfaceDescriptor {
  const durationSec = Number.isFinite(input.durationSec) && input.durationSec > 0
    ? input.durationSec
    : 7200;
  const currentTimeSec = clampTimelineTime(input.currentTimeSec, durationSec);
  const stepSec = Number.isFinite(input.stepSec) && input.stepSec > 0 ? input.stepSec : 30;
  const sourceGapReasons = input.runReady
    ? []
    : ['The complete archived-TLE run is still computing; the timeline remains locked until all anchors are published.'];
  const sourceLabel = input.runReady
    ? `TLE-derived SGP4 · complete ${formatDurationLabel(durationSec)}`
    : `TLE-derived SGP4 · building ${formatDurationLabel(durationSec)} run`;

  return {
    sourceLabel,
    sourceOwner: 'archived-tle-run',
    horizonKind: 'archived-tle-window',
    horizonLabel: sourceLabel,
    horizonSec: durationSec,
    claimKind: 'tle-derived-run',
    durationSec,
    currentTimeSec,
    sourceStartSec: 0,
    sourceEndSec: durationSec,
    sourceGapReasons,
    axisKind: 'source-time',
    axisLabel: `archived TLE source-time axis (${formatShortSeconds(stepSec)} anchors)`,
    axisDurationSec: durationSec,
    axisCurrentTimeSec: currentTimeSec,
  };
}

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

export function resolveTimelineRailDescriptor(input: {
  readonly [key: string]: unknown;
  readonly sceneLane: SceneLane;
  readonly sceneSource: SceneSourceMode;
  readonly liveDurationSec: number;
  readonly liveCurrentTimeSec: number;
  readonly artifactDurationSec: number;
  readonly artifactCurrentTimeSec: number;
  readonly artifactHandoverEventCount: number;
  readonly liveWalkerHandoverEventIndexSourceGapReasons?: readonly string[];
}): TimelineRailDescriptor {
  const liveTimeline: LegacyTimelineSurfaceDescriptor = {
    sourceLabel: 'Live timeline',
    sourceOwner: 'live-walker',
    horizonKind: 'live-walker-window',
    horizonLabel: `Live timeline ${formatDurationLabel(input.liveDurationSec)}`,
    horizonSec: input.liveDurationSec,
    claimKind: 'live-truth',
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
  const liveRail: LegacyTimelineSurfaceDescriptor = {
    ...liveTimeline,
    sourceLabel: 'sinrLiveCells event index - cell truth',
    sourceOwner: 'sinr-live-cell-truth',
    horizonLabel: `sinrLiveCells cell-truth trajectory on ${formatDurationLabel(input.liveDurationSec)} window`,
    claimKind: 'live-truth',
    sourceGapReasons: input.liveWalkerHandoverEventIndexSourceGapReasons ?? [],
  };

  const artifactTimeline: LegacyTimelineSurfaceDescriptor = {
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
  const artifactRail: LegacyTimelineSurfaceDescriptor = {
    ...artifactTimeline,
    sourceLabel: input.artifactHandoverEventCount > 0
      ? 'artifact event index'
      : 'artifact event index - source gap',
    sourceGapReasons: input.artifactHandoverEventCount > 0
      ? []
      : [ARTIFACT_EVENT_INDEX_SOURCE_GAP],
  };

  if (input.sceneSource === 'artifact-replay') {
    return { timeline: artifactTimeline, rail: artifactRail };
  }
  return { timeline: liveTimeline, rail: liveRail };
}
