export interface ArchivedTlePlaybackCursorInput {
  readonly currentTimeSec: number;
  readonly deltaSec: number;
  /** The transport speed explicitly selected in the timeline UI. */
  readonly selectedSpeed: number;
  readonly durationSec: number;
}

export interface ArchivedTlePlaybackStart {
  readonly currentTimeSec: number;
  readonly restarted: boolean;
}

/**
 * Resolve the cursor used when the archived-TLE transport is started.
 *
 * The completed run is intentionally paused at its last published anchor. A
 * subsequent Play is a replay request, not a request to remain pinned at the
 * end; reset the cursor to the run origin before scheduling the next RAF.
 */
export function resolveArchivedTlePlaybackStart(
  currentTimeSec: number,
  durationSec: number,
): ArchivedTlePlaybackStart {
  const duration = Number.isFinite(durationSec) ? Math.max(0, durationSec) : 0;
  const current = Number.isFinite(currentTimeSec)
    ? Math.min(Math.max(0, currentTimeSec), duration)
    : 0;
  if (duration > 0 && current >= duration) return { currentTimeSec: 0, restarted: true };
  return { currentTimeSec: current, restarted: false };
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
