/**
 * Route-neutral model and helpers for the reusable teaching-animation transport.
 */

export const TEACHING_PLAYBACK_SPEEDS = Object.freeze([0.5, 1, 1.5, 2, 3, 4, 8] as const);

export type PlaybackSpeed = (typeof TEACHING_PLAYBACK_SPEEDS)[number];

export const DEFAULT_TRANSPORT_STEP_SECONDS = 5;
export const DEFAULT_TRANSPORT_AUTO_HIDE_DELAY_MS = 2500;

/**
 * Formats a duration or elapsed time in seconds as mm:ss.t.
 *
 * The transport clock advances continuously, so whole-second formatting can
 * show the same value for two distinct checkpoints. Round to the same one
 * decimal place exposed by the scrubber; rounding also avoids binary floating
 * point values such as 45.9 being rendered as 00:45.8.
 */
export function formatCourseTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const totalTenths = Math.round(seconds * 10);
  const total = Math.floor(totalTenths / 10);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  const tenths = totalTenths % 10;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

/**
 * Clamps a proposed course time into [0, durationSec].
 */
export function clampCourseTime(timeSec: number, durationSec: number): number {
  if (!Number.isFinite(timeSec) || timeSec < 0) return 0;
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  return Math.min(durationSec, Math.max(0, timeSec));
}
