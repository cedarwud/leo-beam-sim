import {
  buildArtifactHandoverRailEvents,
} from './handoverRailBuilders';
import {
  createArchivedTleRunTimelineDescriptor,
  resolveTimelineRailDescriptor,
  clampTimelineTime,
  type TimelineRailDescriptor,
  type TimelineSurfaceDescriptor,
} from './timelineRailAuthority';
import {
  liveWalkerHandoverEventIndexToRailEvents,
  selectDirectorHandoverEvents,
} from './liveWalkerHandoverRailAdapter';
import { buildNonOverlappingIntraPresentationSlots } from '../scene/handoverPresentationSchedule';
import type {
  LiveWalkerHandoverEvent,
  LiveWalkerHandoverEventIndex,
} from '../scene/liveWalkerHandoverEventIndex';
import {
  resolveLiveWalkerEventIndexSourceGapReasons,
} from './liveWalkerEventIndexSourceGap';
import type { HandoverRailEvent } from '../ui/HandoverEventRail';
import type { TimelineEventMarker } from '../ui/TimelineBar';
import type { VisualShowcaseArtifact } from '../scene/visual-showcase-contract';
import {
  selectHomepageTeachingTimelineMarkers,
} from '../homepage/controller/teachingTimelineMarkers';
import {
  selectHomepageDemoWindow,
  type HomepageDemoWindow,
} from '../homepage/controller/homepageDemoWindow';
import type { SceneSourceMode } from './appPersistence';
import type { SceneLane } from './sceneLane';

export interface AppTimelineCoreInput {
  readonly [key: string]: unknown;
  readonly sceneLane: SceneLane;
  readonly sceneSource: SceneSourceMode;
  readonly isRootHomepage: boolean;
  readonly isWalkerSceneActive: boolean;
  readonly isArchivedTleSceneActive: boolean;
  readonly demoStartOffsetSec: number;
  readonly liveDurationSec: number;
  readonly liveSimTimeSec: number;
  readonly artifactCurrentTimeSec: number;
  readonly showcaseArtifact: VisualShowcaseArtifact | null;
  readonly liveWalkerHandoverEventIndex: LiveWalkerHandoverEventIndex | null;
  readonly liveWalkerHandoverEventIndexBuilding: boolean;
  readonly focusedUeId: string | null | undefined;
  readonly archivedTleRunReady: boolean;
  readonly archivedTleDurationSec: number;
  readonly archivedTleCurrentTimeSec: number;
  readonly archivedTleStepSec: number;
}

export interface AppTimelineCoreProjection {
  readonly [key: string]: unknown;
  readonly artifactHandoverRailEvents: readonly HandoverRailEvent[];
  readonly liveWalkerHandoverRailEvents: readonly HandoverRailEvent[];
  readonly liveWalkerDirectorHandoverRailEvents: readonly HandoverRailEvent[];
  readonly automaticIntraPresentationSlots: ReturnType<typeof buildNonOverlappingIntraPresentationSlots>;
  readonly liveTimelineWindowStartSec: number;
  readonly liveTimelineElapsedSec: number;
  readonly liveWalkerHandoverEventIndexSourceGapReasons: readonly string[];
  readonly timelineRailDescriptor: TimelineRailDescriptor;
  readonly archivedTleTimelineDescriptor: TimelineSurfaceDescriptor;
  readonly activeTimelineDescriptor: TimelineSurfaceDescriptor;
  readonly timelineDurationSec: number;
  readonly timelineCurrentTimeSec: number;
}

/**
 * Derive the replay, event-index, and timeline descriptors from named inputs.
 * This module owns no cursor, ref, clock, or React state; it only projects
 * already-published producer and simulation data for display adapters.
 */
export function deriveAppTimelineCore(
  input: AppTimelineCoreInput,
): AppTimelineCoreProjection {
  const artifactHandoverRailEvents = buildArtifactHandoverRailEvents(input.showcaseArtifact);
  const liveWalkerHandoverRailEvents = liveWalkerHandoverEventIndexToRailEvents(
    input.liveWalkerHandoverEventIndex,
  );
  const liveWalkerDirectorHandoverRailEvents = input.liveWalkerHandoverEventIndex === null
    ? []
    : liveWalkerHandoverEventIndexToRailEvents({
      ...input.liveWalkerHandoverEventIndex,
      events: selectDirectorHandoverEvents(
        input.liveWalkerHandoverEventIndex,
        input.liveWalkerHandoverEventIndex.events,
        input.focusedUeId,
      ),
    });
  const automaticIntraPresentationSlots = (
    !input.isWalkerSceneActive
    || input.sceneSource !== 'live-sim'
    || input.sceneLane !== 'sinr-live'
    || input.isRootHomepage
    || input.liveWalkerHandoverEventIndex === null
    || (input.isRootHomepage && liveWalkerDirectorHandoverRailEvents.some(event => event.kind === 'intra'))
  )
    ? []
    : buildNonOverlappingIntraPresentationSlots({
      interEventTimesSec: liveWalkerDirectorHandoverRailEvents
        .filter(event => event.kind === 'inter')
        .map(event => event.sourceTimeSec ?? event.timeSec),
      startSec: input.demoStartOffsetSec + 60,
      endSec: input.liveDurationSec,
    });
  const liveTimelineWindowStartSec = input.demoStartOffsetSec;
  const liveTimelineElapsedSec = clampTimelineTime(
    input.liveSimTimeSec - liveTimelineWindowStartSec,
    input.liveDurationSec,
  );
  const liveWalkerHandoverEventIndexSourceGapReasons = resolveLiveWalkerEventIndexSourceGapReasons({
    sceneSource: input.sceneSource,
    isWalkerSceneActive: input.isWalkerSceneActive,
    sceneLane: input.sceneLane,
    indexBuilding: input.liveWalkerHandoverEventIndexBuilding,
    indexSourceGapReasons: input.liveWalkerHandoverEventIndex?.sourceGapReasons ?? null,
  });
  const timelineRailDescriptor = resolveTimelineRailDescriptor({
    sceneLane: input.sceneLane,
    sceneSource: input.sceneSource,
    liveDurationSec: input.liveDurationSec,
    liveCurrentTimeSec: liveTimelineElapsedSec,
    artifactDurationSec: input.showcaseArtifact?.scenario.durationSec ?? 0,
    artifactCurrentTimeSec: input.artifactCurrentTimeSec,
    artifactHandoverEventCount: artifactHandoverRailEvents.length,
    liveWalkerHandoverEventIndexSourceGapReasons,
  });
  const archivedTleTimelineDescriptor = createArchivedTleRunTimelineDescriptor({
    runReady: input.archivedTleRunReady,
    durationSec: input.archivedTleDurationSec,
    currentTimeSec: input.archivedTleCurrentTimeSec,
    stepSec: input.archivedTleStepSec,
  });
  const activeTimelineDescriptor = input.isArchivedTleSceneActive
    ? archivedTleTimelineDescriptor
    : timelineRailDescriptor.timeline;

  return {
    artifactHandoverRailEvents,
    liveWalkerHandoverRailEvents,
    liveWalkerDirectorHandoverRailEvents,
    automaticIntraPresentationSlots,
    liveTimelineWindowStartSec,
    liveTimelineElapsedSec,
    liveWalkerHandoverEventIndexSourceGapReasons,
    timelineRailDescriptor,
    archivedTleTimelineDescriptor,
    activeTimelineDescriptor,
    timelineDurationSec: activeTimelineDescriptor.durationSec,
    timelineCurrentTimeSec: activeTimelineDescriptor.currentTimeSec,
  };
}

export interface AppTimelineRailProjectionInput {
  readonly sceneLane: SceneLane;
  readonly sceneSource: SceneSourceMode;
  readonly isRootHomepage: boolean;
  readonly isWalkerSceneActive: boolean;
  readonly isArchivedTleSceneActive: boolean;
  readonly timelineDurationSec: number;
  readonly liveWalkerHandoverEventIndexBuilding: boolean;
  readonly liveWalkerHandoverEventIndex: LiveWalkerHandoverEventIndex | null;
  readonly focusedUeId: string | null | undefined;
  readonly liveObservedHandoverRailEvents: readonly HandoverRailEvent[];
  readonly core: AppTimelineCoreProjection;
}

export interface AppTimelineRailProjection {
  readonly handoverRailEvents: readonly HandoverRailEvent[];
  readonly homepageTimelineEventMarkers: readonly TimelineEventMarker[];
  readonly homepageDemoWindow: HomepageDemoWindow | null;
  readonly homepageDirectorHandoverRailEvents: readonly HandoverRailEvent[];
  readonly homepageIndexedStoryRoute: boolean;
  readonly liveWalkerDirectorHandoverEventsForButtons: readonly LiveWalkerHandoverEvent[];
}

/** Select the event source owned by the active scene lane. */
export function selectAppHandoverRailEvents(
  input: Pick<AppTimelineRailProjectionInput, 'sceneSource' | 'sceneLane' | 'isArchivedTleSceneActive' | 'core' | 'liveObservedHandoverRailEvents'>,
): readonly HandoverRailEvent[] {
  if (input.sceneSource === 'artifact-replay') return input.core.artifactHandoverRailEvents;
  if (input.isArchivedTleSceneActive) return [];
  if (input.sceneLane === 'sinr-live') return input.core.liveWalkerHandoverRailEvents;
  return input.liveObservedHandoverRailEvents;
}

/** Derive homepage teaching markers and the stable source-backed demo window. */
export function deriveHomepageTimelineProjection(
  input: Pick<AppTimelineRailProjectionInput, 'sceneSource' | 'isRootHomepage' | 'isWalkerSceneActive' | 'sceneLane' | 'timelineDurationSec' | 'liveWalkerHandoverEventIndexBuilding' | 'liveWalkerHandoverEventIndex' | 'focusedUeId' | 'core'>,
): Pick<AppTimelineRailProjection, 'homepageTimelineEventMarkers' | 'homepageDemoWindow' | 'homepageDirectorHandoverRailEvents' | 'homepageIndexedStoryRoute' | 'liveWalkerDirectorHandoverEventsForButtons'> {
  const homepageTimelineEventMarkers = !input.isRootHomepage
    || input.sceneSource !== 'live-sim'
    || !input.isWalkerSceneActive
    || input.sceneLane !== 'sinr-live'
    ? []
    : selectHomepageTeachingTimelineMarkers(input.core.liveWalkerDirectorHandoverRailEvents, {
      durationSec: input.timelineDurationSec,
      teachingWindowSec: 60,
      maxMarkersPerKind: 1,
    });
  const homepageDemoWindow = !input.isRootHomepage
    || input.sceneSource !== 'live-sim'
    || !input.isWalkerSceneActive
    || input.sceneLane !== 'sinr-live'
    || input.liveWalkerHandoverEventIndexBuilding
    || input.liveWalkerHandoverEventIndex === null
    ? null
    : selectHomepageDemoWindow(
      selectDirectorHandoverEvents(
        input.liveWalkerHandoverEventIndex,
        input.liveWalkerHandoverEventIndex.events,
        input.focusedUeId,
      ),
      0,
      input.liveWalkerHandoverEventIndex.durationSec,
    );
  const homepageDirectorHandoverRailEvents = homepageDemoWindow === null
    || !input.isRootHomepage
    || input.liveWalkerHandoverEventIndex === null
    ? input.core.liveWalkerDirectorHandoverRailEvents
    : liveWalkerHandoverEventIndexToRailEvents({
      ...input.liveWalkerHandoverEventIndex,
      events: homepageDemoWindow.events,
    });
  const homepageIndexedStoryRoute = input.isRootHomepage
    && input.sceneSource === 'live-sim'
    && input.isWalkerSceneActive
    && input.sceneLane === 'sinr-live';
  const liveWalkerDirectorHandoverEventsForButtons = homepageIndexedStoryRoute
    ? homepageDemoWindow?.events ?? []
    : input.liveWalkerHandoverEventIndex === null
      ? []
      : selectDirectorHandoverEvents(
        input.liveWalkerHandoverEventIndex,
        input.liveWalkerHandoverEventIndex.events,
        input.focusedUeId,
      );

  return {
    homepageTimelineEventMarkers,
    homepageDemoWindow,
    homepageDirectorHandoverRailEvents,
    homepageIndexedStoryRoute,
    liveWalkerDirectorHandoverEventsForButtons,
  };
}

export function deriveAppTimelineRailProjection(
  input: AppTimelineRailProjectionInput,
): AppTimelineRailProjection {
  const homepage = deriveHomepageTimelineProjection(input);
  return {
    handoverRailEvents: selectAppHandoverRailEvents(input),
    ...homepage,
  };
}

export function deriveAppTimelineDisabled(input: {
  readonly isWalkerSceneActive: boolean;
  readonly manualHandoverRequested: boolean;
  readonly isArchivedTleSceneActive: boolean;
  readonly archivedTleRunReady: boolean;
  readonly sceneSource: SceneSourceMode;
  readonly replayControllerReady: boolean;
  readonly showcaseLoading: boolean;
  readonly showcaseError: string | null;
  readonly timelineDurationSec: number;
}): boolean {
  if (input.isWalkerSceneActive && input.manualHandoverRequested) return true;
  if (input.isArchivedTleSceneActive) return !input.archivedTleRunReady;
  if (input.sceneSource === 'artifact-replay') {
    return !input.replayControllerReady || input.showcaseLoading || input.showcaseError !== null;
  }
  return input.timelineDurationSec <= 0;
}
