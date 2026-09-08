import type { SceneSourceMode } from './appPersistence';
import type { SceneLane } from './sceneLane';

export interface LiveWalkerEventIndexSourceGapInput {
  readonly sceneSource: SceneSourceMode;
  readonly isWalkerSceneActive: boolean;
  readonly sceneLane: SceneLane;
  readonly indexBuilding: boolean;
  readonly indexSourceGapReasons: readonly string[] | null;
}

const LIVE_WALKER_EVENT_INDEX_LANES: readonly SceneLane[] = [
  'sinr-live',
];

function isLiveWalkerEventIndexSurface(
  input: LiveWalkerEventIndexSourceGapInput,
): boolean {
  return input.sceneSource === 'live-sim'
    && input.isWalkerSceneActive
    && LIVE_WALKER_EVENT_INDEX_LANES.includes(input.sceneLane);
}

/** Resolve display-only source gaps for the live Walker event index surface. */
export function resolveLiveWalkerEventIndexSourceGapReasons(
  input: LiveWalkerEventIndexSourceGapInput,
): readonly string[] {
  if (isLiveWalkerEventIndexSurface(input) && input.indexBuilding) {
    return ['Source gap: rebuilding the live handover index for the current parameters.'];
  }
  if (isLiveWalkerEventIndexSurface(input) && input.indexSourceGapReasons === null) {
    return ['Source gap: live-scene handover event index is not ready.'];
  }
  return input.indexSourceGapReasons ?? [];
}
