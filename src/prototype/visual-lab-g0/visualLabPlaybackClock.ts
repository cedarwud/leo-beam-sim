/**
 * Presentation clock helpers for the generic Visual Lab timeline.
 *
 * The timeline's requested playback rate remains the user-facing value.  A
 * committed source-backed switch gets a small, temporary presentation-only
 * slowdown so the ownership transfer can be read; guided replay never uses
 * this clock because its own wall-clock script owns playback.
 */

/** Deliberate 0.25x pacing for the five-second committed visual switch. */
export const VISUAL_LAB_COMMITTED_SWITCH_SLOW_MOTION_FACTOR = 0.25 as const;

export interface VisualLabPlaybackClockWindow {
  readonly committedSwitchWindow: boolean;
  readonly guidedReplayActive: boolean;
}

function nonNegativeFinite(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * Resolve the rate applied to the generic timeline for one wall-clock tick.
 * The UI still displays `requestedRate`; the factor is only active inside an
 * accepted committed switch window and never inside guided replay.
 */
export function effectiveVisualLabPlaybackRate(
  requestedRate: number,
  window: VisualLabPlaybackClockWindow,
): number {
  const rate = nonNegativeFinite(requestedRate);
  if (!window.committedSwitchWindow || window.guidedReplayActive) return rate;
  return rate * VISUAL_LAB_COMMITTED_SWITCH_SLOW_MOTION_FACTOR;
}

/** Advance by wall-clock seconds while preserving literal 1x semantics. */
export function advanceVisualLabPlayback(
  elapsedSec: number,
  wallDeltaSec: number,
  requestedRate: number,
  window: VisualLabPlaybackClockWindow,
): number {
  const elapsed = nonNegativeFinite(elapsedSec);
  const wallDelta = nonNegativeFinite(wallDeltaSec);
  return elapsed + wallDelta * effectiveVisualLabPlaybackRate(requestedRate, window);
}
