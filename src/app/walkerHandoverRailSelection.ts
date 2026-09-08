import type { HandoverRailEvent } from '../ui/HandoverEventRail';
import type { SceneSourceMode } from './appPersistence';
import type { SceneLane } from './sceneLane';

export interface WalkerHandoverRailSelectionInput {
  readonly scene: {
    readonly sceneSource: SceneSourceMode;
    readonly sceneLane: SceneLane;
  };
  readonly events: {
    readonly artifact: readonly HandoverRailEvent[];
    readonly liveObserved: readonly HandoverRailEvent[];
    readonly liveWalker: readonly HandoverRailEvent[];
  };
}

export function selectWalkerHandoverRailEvents(
  input: WalkerHandoverRailSelectionInput,
): readonly HandoverRailEvent[] {
  if (input.scene.sceneSource === 'artifact-replay') return input.events.artifact;
  if (input.scene.sceneLane === 'sinr-live') return input.events.liveWalker;
  return input.events.liveObserved;
}
