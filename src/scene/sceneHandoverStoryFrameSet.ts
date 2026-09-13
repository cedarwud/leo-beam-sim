import type { AcceptedHandoverPresentationSnapshot } from './acceptedHandoverPresentationSnapshot';
import type { HandoverPresentationView } from './handoverPresentationOwner';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import {
  resolveAcceptedHandoverStoryFrame,
  resolveHandoverStoryFrameSet,
  resolvePresentationHandoverStoryFrame,
  resolveReplayHandoverStoryFrame,
  resolveTeachingHandoverStoryFrame,
  type HandoverStoryFrame,
  type HandoverStoryFrameSet,
  type HandoverTeachingFrameInput,
  type HandoverTeachingSceneStory,
} from './handoverStoryFrame';
import {
  resolveHandoverSurfaceBinding,
  type HandoverSurfaceBinding,
  type HandoverSurfaceBindingSet,
} from './handoverSurfaceBinding';

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

/** One source-normalization entry point shared by the App shell and audit callers. */
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

  return resolveHandoverStoryFrameSet({ accepted, presentation, teaching, replay });
}

export type SceneHandoverStoryLane = 'live' | 'archived-tle' | 'artifact-replay';

export interface BoundSceneHandoverStoryFrameSetInput {
  readonly lane: SceneHandoverStoryLane;
  /** The only scene-local story allowed after R7: presentation animation. */
  readonly localPresentation: HandoverStoryFrame | null;
  /** Mandatory App-owned R4 authority for accepted, teaching, and replay truth. */
  readonly sharedBindings: HandoverSurfaceBindingSet;
}

/**
 * Preserve exact shell-owned accepted/teaching/replay frames. A live/TLE lane
 * may add one scene-local presentation animation, but no scene sink may rebuild
 * a missing shell source from raw simulation or replay input.
 */
export function resolveBoundSceneHandoverStoryFrameSet(
  input: BoundSceneHandoverStoryFrameSetInput,
): HandoverStoryFrameSet {
  const shared = input.sharedBindings;
  if (input.lane === 'artifact-replay') {
    return resolveHandoverStoryFrameSet({
      accepted: null,
      presentation: null,
      teaching: null,
      replay: shared.replay?.frame ?? null,
    });
  }
  return resolveHandoverStoryFrameSet({
    accepted: shared.accepted?.frame ?? null,
    presentation: input.localPresentation ?? shared.presentation?.frame ?? null,
    teaching: shared.teaching?.frame ?? null,
    replay: null,
  });
}
function activeBinding(
  teaching: HandoverSurfaceBinding | null,
  presentation: HandoverSurfaceBinding | null,
  accepted: HandoverSurfaceBinding | null,
  replay: HandoverSurfaceBinding | null,
): readonly [HandoverSurfaceBinding | null, HandoverStoryFrameSet['activeSource']] {
  if (teaching !== null) return [teaching, 'teaching'];
  if (presentation !== null) return [presentation, 'presentation'];
  if (accepted !== null) return [accepted, 'accepted'];
  if (replay !== null) return [replay, 'replay'];
  return [null, 'none'];
}

/**
 * Compose the scene binding set without recreating any shell-owned binding.
 * Only a local presentation binding may be newly composed.
 */
export function resolveBoundSceneHandoverSurfaceBindingSet(
  input: BoundSceneHandoverStoryFrameSetInput,
): HandoverSurfaceBindingSet {
  const shared = input.sharedBindings;
  const accepted = input.lane === 'artifact-replay' ? null : shared.accepted;
  const teaching = input.lane === 'artifact-replay' ? null : shared.teaching;
  const replay = input.lane === 'artifact-replay' ? shared.replay : null;
  const presentation = input.lane === 'artifact-replay'
    ? null
    : input.localPresentation === null
      ? shared.presentation
      : resolveHandoverSurfaceBinding('presentation', input.localPresentation);
  const [active, activeSource] = activeBinding(
    teaching,
    presentation,
    accepted,
    replay,
  );
  return Object.freeze({
    accepted,
    presentation,
    teaching,
    replay,
    active,
    activeSource,
  });
}
