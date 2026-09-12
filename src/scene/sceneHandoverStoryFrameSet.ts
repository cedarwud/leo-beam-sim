import type { AcceptedHandoverPresentationSnapshot } from './acceptedHandoverPresentationSnapshot';
import type { HandoverPresentationView } from './handoverPresentationOwner';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import {
  resolveAcceptedHandoverStoryFrame,
  resolveHandoverStoryFrameSet,
  resolvePresentationHandoverStoryFrame,
  resolveReplayHandoverStoryFrame,
  resolveTeachingHandoverStoryFrame,
  type HandoverStoryFrameSet,
  type HandoverTeachingFrameInput,
  type HandoverTeachingSceneStory,
} from './handoverStoryFrame';
import type { HandoverSurfaceBindingSet } from './handoverSurfaceBinding';

export interface SceneHandoverStoryFrameSetInput {
  readonly acceptedSnapshot?: AcceptedHandoverPresentationSnapshot | null;
  readonly acceptedProducer?: 'walker' | 'tle';
  readonly resolveAcceptedCellId?: (beamId: number) => number | null;
  readonly presentationView?: HandoverPresentationView | null;
  readonly teachingStory?: HandoverTeachingSceneStory | null;
  readonly teachingFrame?: HandoverTeachingFrameInput | null;
  readonly replayFrame?: NormalizedSceneFrame | null;
}

const NO_CELL_MAPPING = (): null => null;

/** One source-normalization entry point shared by production and audit callers. */
export function resolveSceneHandoverStoryFrameSet(
  input: SceneHandoverStoryFrameSetInput,
): HandoverStoryFrameSet {
  const accepted = resolveAcceptedHandoverStoryFrame({
    snapshot: input.acceptedSnapshot ?? null,
    producer: input.acceptedProducer ?? 'walker',
    resolveCellId: input.resolveAcceptedCellId ?? NO_CELL_MAPPING,
  });
  const presentation = input.presentationView == null
    ? null
    : resolvePresentationHandoverStoryFrame({ view: input.presentationView });
  const teaching = resolveTeachingHandoverStoryFrame({
    story: input.teachingStory ?? null,
    frame: input.teachingFrame ?? null,
  });
  const replay = resolveReplayHandoverStoryFrame({
    frame: input.replayFrame ?? null,
  });

  return resolveHandoverStoryFrameSet({
    accepted,
    presentation,
    teaching,
    replay,
  });
}

export type SceneHandoverStoryLane = 'live' | 'archived-tle' | 'artifact-replay';

export interface BoundSceneHandoverStoryFrameSetInput {
  readonly lane: SceneHandoverStoryLane;
  readonly local: HandoverStoryFrameSet;
  readonly sharedBindings: HandoverSurfaceBindingSet | null;
}

/**
 * Preserve exact shell-owned frames while keeping source lanes exclusive.
 * The scene-local presentation clock may augment a live/TLE lane, but accepted
 * or teaching state can never outrank an artifact-replay frame.
 */
export function resolveBoundSceneHandoverStoryFrameSet(
  input: BoundSceneHandoverStoryFrameSetInput,
): HandoverStoryFrameSet {
  const shared = input.sharedBindings;
  const sharedAuthorityPresent = shared !== null;
  if (input.lane === 'artifact-replay') {
    return resolveHandoverStoryFrameSet({
      accepted: null,
      presentation: null,
      teaching: null,
      replay: sharedAuthorityPresent
        ? shared.replay?.frame ?? null
        : input.local.replay,
    });
  }
  return resolveHandoverStoryFrameSet({
    accepted: sharedAuthorityPresent
      ? shared.accepted?.frame ?? null
      : input.local.accepted,
    presentation: input.local.presentation ?? shared?.presentation?.frame ?? null,
    teaching: sharedAuthorityPresent
      ? shared.teaching?.frame ?? null
      : input.local.teaching,
    replay: null,
  });
}
