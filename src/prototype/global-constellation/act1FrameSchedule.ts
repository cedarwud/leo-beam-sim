/**
 * Act 1 frame schedule.
 *
 * Split out of the worker so it can be tested without a `self`: importing the
 * worker module registers a message handler at load time, which node cannot do.
 */

export const ACT1_FRAME_SPAN_SEC = 90 * 60;
export const ACT1_FRAME_STEP_SEC = 60;

/**
 * Offsets ordered from the centre outwards.
 *
 * The lecturer scrubs around the archived instant first, so that range must be
 * ready first; the timeline then widens as the outer frames land instead of
 * gating the whole act on the last one.
 */
export function act1FrameOffsets(spanSec: number, stepSec: number): readonly number[] {
  const offsets: number[] = [0];
  for (let offset = stepSec; offset <= spanSec; offset += stepSec) {
    offsets.push(offset, -offset);
  }
  return offsets;
}
