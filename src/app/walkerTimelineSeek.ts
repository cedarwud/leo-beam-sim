import { clampTimelineTime, type TimelineSurfaceAxisKind } from './timelineRailAuthority';
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
    readonly durationSec: number;
    readonly axisKind: TimelineSurfaceAxisKind;
    readonly axisDurationSec: number;
  };
  readonly rail: {
    readonly axisDurationSec: number;
  };
  readonly live: {
    readonly windowStartSec: number;
    readonly durationSec: number;
  };
}

export type WalkerTimelineSeekResolution =
  | { readonly kind: 'archived-tle'; readonly targetSec: number }
  | { readonly kind: 'artifact-replay'; readonly targetSec: number }
  | { readonly kind: 'display-stretched'; readonly targetSec: number }
  | { readonly kind: 'modqn-replay-proof'; readonly targetSec: number }
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

  if (input.timeline.axisKind === 'display-stretched') {
    return {
      kind: 'display-stretched',
      targetSec: clampTimelineTime(targetSec, input.timeline.axisDurationSec),
    };
  }

  if (input.scene.lane === 'modqn-replay-proof') {
    const visualTargetSec = input.timeline.durationSec > 0 && input.rail.axisDurationSec > 0
      ? (targetSec / input.timeline.durationSec) * input.rail.axisDurationSec
      : targetSec;
    return {
      kind: 'modqn-replay-proof',
      targetSec: clampTimelineTime(visualTargetSec, input.rail.axisDurationSec),
    };
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
