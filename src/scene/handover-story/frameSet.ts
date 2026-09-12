import type { HandoverStoryFrame } from './contracts';

export type HandoverStoryFrameSource =
  | 'teaching'
  | 'presentation'
  | 'accepted'
  | 'replay'
  | 'none';

export interface HandoverStoryFrameSetInput {
  readonly accepted: HandoverStoryFrame | null;
  readonly presentation: HandoverStoryFrame | null;
  readonly teaching: HandoverStoryFrame | null;
  readonly replay: HandoverStoryFrame | null;
}

export interface HandoverStoryFrameSet {
  readonly accepted: HandoverStoryFrame | null;
  readonly presentation: HandoverStoryFrame | null;
  readonly teaching: HandoverStoryFrame | null;
  readonly replay: HandoverStoryFrame | null;
  readonly active: HandoverStoryFrame | null;
  readonly activeSource: HandoverStoryFrameSource;
  readonly availableSources: readonly Exclude<HandoverStoryFrameSource, 'none'>[];
}

/**
 * Preserve existing visual ownership while all sources use one frame vocabulary.
 * This selects among already-active stories; it does not create or advance one.
 */
export function resolveHandoverStoryFrameSet(
  input: HandoverStoryFrameSetInput,
): HandoverStoryFrameSet {
  const availableSources = Object.freeze([
    ...(input.accepted === null ? [] : ['accepted'] as const),
    ...(input.presentation === null ? [] : ['presentation'] as const),
    ...(input.teaching === null ? [] : ['teaching'] as const),
    ...(input.replay === null ? [] : ['replay'] as const),
  ]);
  const active = input.teaching ?? input.presentation ?? input.accepted ?? input.replay;
  const activeSource: HandoverStoryFrameSource = input.teaching !== null
    ? 'teaching'
    : input.presentation !== null
      ? 'presentation'
      : input.accepted !== null
        ? 'accepted'
        : input.replay !== null ? 'replay' : 'none';

  return Object.freeze({
    accepted: input.accepted,
    presentation: input.presentation,
    teaching: input.teaching,
    replay: input.replay,
    active,
    activeSource,
    availableSources,
  });
}
