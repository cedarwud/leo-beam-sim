import { clampTimelineTime } from './timelineRailAuthority';
import type { SceneSourceMode } from './appPersistence';
import type { SceneLane } from './sceneLane';

export interface WalkerTimelineSeekInput {
  readonly scene: {
    readonly lane: SceneLane;
    readonly source: SceneSourceMode;
    readonly isLegacyWalkerRoute: boolean;
  };
  readonly targetSec: number;
  readonly timeline: {
    readonly [key: string]: unknown;
    readonly durationSec: number;
  };
  readonly live: {
    readonly windowStartSec: number;
    readonly durationSec: number;
  };
}

export type WalkerTimelineSeekResolution =
  | { readonly kind: 'archived-tle'; readonly targetSec: number }
  | { readonly kind: 'artifact-replay'; readonly targetSec: number }
  | {
      readonly kind: 'live-walker';
      readonly sourceTargetSec: number;
      readonly visualTargetSec: number;
    };

/**
 * Resolve a visible timeline target into the authority-specific seek command.
 * The result contains no controller or React operation: callers perform the
 * reset, publication, or replay seek described by the selected route.
 */
export function resolveWalkerTimelineSeek(
  input: WalkerTimelineSeekInput,
): WalkerTimelineSeekResolution {
  const targetSec = clampTimelineTime(input.targetSec, input.timeline.durationSec);

  if (
    input.scene.lane === 'sinr-live'
    && !input.scene.isLegacyWalkerRoute
  ) {
    return { kind: 'archived-tle', targetSec };
  }

  if (input.scene.source === 'artifact-replay') {
    return { kind: 'artifact-replay', targetSec };
  }

  return {
    kind: 'live-walker',
    sourceTargetSec: Math.min(
      input.live.windowStartSec + targetSec,
      input.live.durationSec,
    ),
    visualTargetSec: targetSec,
  };
}
