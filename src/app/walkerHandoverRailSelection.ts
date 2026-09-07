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
    readonly modqn: readonly HandoverRailEvent[];
  };
}

export function selectWalkerHandoverRailEvents(
  input: WalkerHandoverRailSelectionInput,
): readonly HandoverRailEvent[] {
  if (input.scene.sceneSource === 'artifact-replay') return input.events.artifact;
  if (
    input.scene.sceneLane === 'sinr-live'
    || input.scene.sceneLane === 'modqn-live-cell-preview'
  ) return input.events.liveWalker;
  if (input.scene.sceneLane === 'modqn-replay-proof') return input.events.modqn;
  return input.events.liveObserved;
}
