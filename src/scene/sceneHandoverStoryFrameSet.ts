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
