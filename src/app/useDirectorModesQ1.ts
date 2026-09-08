import { useMemo } from 'react';
import { type HandoverRailEvent } from '../ui/HandoverEventRail';
import { type ShowcaseReplayController } from '../showcase/ShowcaseReplayController';
import { type SceneSourceMode } from './appPersistence';
import { type SceneLane } from './sceneLane';
import { type LiveWalkerHandoverEvent } from '../scene/liveWalkerHandoverEventIndex';
import { type TimelineRailDescriptor } from './timelineRailAuthority';

export interface UseDirectorModesParameters {
  artifactHandoverRailEvents: readonly HandoverRailEvent[];
  handoverRailEvents: readonly HandoverRailEvent[];
  isWalkerSceneActive: boolean;
  liveWalkerDirectorHandoverEventsForButtons: readonly LiveWalkerHandoverEvent[];
  liveWalkerHandoverEventIndexBuilding: boolean;
  replayController: ShowcaseReplayController | null;
  sceneLane: SceneLane;
  sceneSource: SceneSourceMode;
  showcaseError: string | null;
  showcaseLoading: boolean;
  timelineRailDescriptor: TimelineRailDescriptor;
}

export interface UseDirectorModesResult {
  directorFocusEnabled: boolean;
  directorInterEnabled: boolean;
  directorCinematicEnabled: boolean;
  directorCinematicInterEnabled: boolean;
  directorCinematicIntraEnabled: boolean;
}

export function useDirectorModes({ artifactHandoverRailEvents, handoverRailEvents, isWalkerSceneActive, liveWalkerDirectorHandoverEventsForButtons, liveWalkerHandoverEventIndexBuilding, replayController, sceneLane, sceneSource, showcaseError, showcaseLoading, timelineRailDescriptor }: UseDirectorModesParameters): UseDirectorModesResult {
  const directorFocusEnabled = useMemo(
      () =>
        sceneSource === 'live-sim'
        && isWalkerSceneActive
        && sceneLane === 'sinr-live'
        && (
          timelineRailDescriptor.rail.sourceOwner === 'live-walker'
          || timelineRailDescriptor.rail.sourceOwner === 'sinr-live-cell-truth'
        )
        && timelineRailDescriptor.rail.horizonKind === 'live-walker-window',
      [
        sceneSource,
        isWalkerSceneActive,
        sceneLane,
        timelineRailDescriptor.rail.sourceOwner,
        timelineRailDescriptor.rail.horizonKind,
      ],
    );
  const directorInterEnabled = useMemo(
      () => directorFocusEnabled
        && !liveWalkerHandoverEventIndexBuilding
        && handoverRailEvents.some(event => event.kind === 'inter')
        && liveWalkerDirectorHandoverEventsForButtons.some(event => event.kind === 'inter'),
      [directorFocusEnabled, handoverRailEvents, liveWalkerDirectorHandoverEventsForButtons, liveWalkerHandoverEventIndexBuilding],
    );
  const directorCinematicEnabled = useMemo(
      () =>
        sceneSource === 'artifact-replay'
        && replayController !== null
        && !showcaseLoading
        && showcaseError === null,
      [sceneSource, replayController, showcaseLoading, showcaseError],
    );
  const directorCinematicInterEnabled = useMemo(
      () => directorCinematicEnabled
        && replayController !== null
        && artifactHandoverRailEvents.some(event => event.kind === 'inter'),
      [artifactHandoverRailEvents, directorCinematicEnabled, replayController],
    );
  const directorCinematicIntraEnabled = useMemo(
      () => directorCinematicEnabled
        && replayController !== null
        && artifactHandoverRailEvents.some(event => event.kind === 'intra'),
      [artifactHandoverRailEvents, directorCinematicEnabled, replayController],
    );
  return { directorFocusEnabled, directorInterEnabled, directorCinematicEnabled, directorCinematicInterEnabled, directorCinematicIntraEnabled };
}
