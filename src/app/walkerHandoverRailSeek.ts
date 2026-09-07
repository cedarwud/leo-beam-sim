import { clampTimelineTime } from './timelineRailAuthority';
import type { SceneLane } from './sceneLane';

export interface WalkerHandoverRailSeekInput {
  readonly sceneLane: SceneLane;
  readonly directorFocusEnabled: boolean;
  readonly targetSec: number;
  readonly railDurationSec: number;
  readonly liveTimelineWindowStartSec: number;
  readonly timelineDurationSec: number;
}

export type WalkerHandoverRailSeekResolution =
  | { readonly kind: 'timeline'; readonly targetSec: number }
  | {
      readonly kind: 'director-live';
      readonly sourceTargetSec: number;
      readonly visualTargetSec: number;
    };

/**
 * Resolve a handover-rail click before the component performs transport I/O.
 * Timeline-owned routes delegate their raw target to the main seek resolver;
 * Director focus owns the live-window clamp and visual elapsed-time mapping.
 */
export function resolveWalkerHandoverRailSeek(
  input: WalkerHandoverRailSeekInput,
): WalkerHandoverRailSeekResolution {
  if (input.sceneLane === 'sinr-live' || !input.directorFocusEnabled) {
    return { kind: 'timeline', targetSec: input.targetSec };
  }

  const sourceTargetSec = clampTimelineTime(input.targetSec, input.railDurationSec);
  return {
    kind: 'director-live',
    sourceTargetSec,
    visualTargetSec: clampTimelineTime(
      sourceTargetSec - input.liveTimelineWindowStartSec,
      input.timelineDurationSec,
    ),
  };
}
