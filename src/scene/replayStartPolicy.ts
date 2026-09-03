/**
 * Homepage replay-start policy.
 *
 * This is intentionally a small, pure boundary between the playback reset
 * recipe and any optional warm-start experiment.  The live homepage must open
 * at the requested replay origin; a diagnostic surface may opt into the
 * bounded warm-start explicitly.  Keeping the decision here prevents a
 * second reset path from silently re-introducing a hidden time jump.
 */
export interface InitialReplayWarmupInput {
  /** A real cell-truth model is required before a warm-start can be considered. */
  readonly cellTruthAvailable: boolean;
  /** Explicit opt-in owned by the caller; false for the homepage. */
  readonly enabled: boolean;
  /** The one-shot warm-start has already been consumed for this mount. */
  readonly alreadyWarmed: boolean;
  /** Requested bounded warm-up duration, in simulation seconds. */
  readonly requestedWarmupSec?: number;
}

/**
 * Resolve the one-shot initial warm-up duration.
 *
 * Invalid, negative, repeated, unavailable, or non-opted-in warm-ups all
 * resolve to zero.  Zero is a meaningful result: it tells the reset recipe to
 * publish the exact replay-origin frame without advancing simulation time.
 */
export function resolveInitialReplayWarmupSec({
  cellTruthAvailable,
  enabled,
  alreadyWarmed,
  requestedWarmupSec,
}: InitialReplayWarmupInput): number {
  if (!cellTruthAvailable || !enabled || alreadyWarmed) return 0;
  if (requestedWarmupSec === undefined || !Number.isFinite(requestedWarmupSec)) return 0;
  return Math.max(0, requestedWarmupSec);
}
