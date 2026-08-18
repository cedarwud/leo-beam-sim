export interface ArchivedTlePlaybackCursorInput {
  readonly currentTimeSec: number;
  readonly deltaSec: number;
  /** The transport speed explicitly selected in the timeline UI. */
  readonly selectedSpeed: number;
  readonly durationSec: number;
}

/**
 * Advance the cursor for a fully published archived-TLE run.
 *
 * This seam intentionally accepts only the selected transport speed.  The
 * legacy live Walker's effective speed can be reduced by handover auto-slow or
 * director focus, but those display controls do not own archived-TLE playback.
 */
export function advanceArchivedTlePlaybackCursor(
  input: ArchivedTlePlaybackCursorInput,
): number {
  const durationSec = Number.isFinite(input.durationSec)
    ? Math.max(0, input.durationSec)
    : 0;
  const currentTimeSec = Number.isFinite(input.currentTimeSec)
    ? Math.min(Math.max(0, input.currentTimeSec), durationSec)
    : 0;
  const deltaSec = Number.isFinite(input.deltaSec) ? Math.max(0, input.deltaSec) : 0;
  const selectedSpeed = Number.isFinite(input.selectedSpeed)
    ? Math.max(0, input.selectedSpeed)
    : 0;

  return Math.min(currentTimeSec + (deltaSec * selectedSpeed), durationSec);
}
