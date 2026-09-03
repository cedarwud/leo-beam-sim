import { TLE_JOURNEY_STATIONS, type TleJourneyStationId } from './tleJourneyStations';

export const TLE_JOURNEY_BEAT_COUNT = TLE_JOURNEY_STATIONS.length;
export const TLE_JOURNEY_RAW_RECORD_DURATION_SEC = 10;
export const TLE_JOURNEY_COLUMN_EXPLANATION_DURATION_SEC = 8;
export const TLE_JOURNEY_COLUMN_EXPLANATION_COUNT = 5;
export const TLE_JOURNEY_DEFAULT_BEAT_DURATION_SEC = 24;
export const TLE_JOURNEY_SGP4_INITIAL_HOLD_SEC = 6;
export const TLE_JOURNEY_SGP4_AUTOPLAY_CHECKPOINT_COUNT = 4;
export const TLE_JOURNEY_SGP4_SWEEP_DURATION_SEC =
  TLE_JOURNEY_DEFAULT_BEAT_DURATION_SEC - TLE_JOURNEY_SGP4_INITIAL_HOLD_SEC;
export const TLE_JOURNEY_SGP4_CHECKPOINT_HOLD_SEC =
  TLE_JOURNEY_SGP4_SWEEP_DURATION_SEC / TLE_JOURNEY_SGP4_AUTOPLAY_CHECKPOINT_COUNT;

/**
 * Beat 1 is a concise source introduction. Beat 2 pauses for five separately
 * narrated TLE fields at eight seconds each. The remaining three visual beats keep
 * their established 24-second inspection window.
 */
export const TLE_JOURNEY_BEAT_DURATIONS_SEC: readonly number[] = Object.freeze([
  TLE_JOURNEY_RAW_RECORD_DURATION_SEC,
  TLE_JOURNEY_COLUMN_EXPLANATION_DURATION_SEC * TLE_JOURNEY_COLUMN_EXPLANATION_COUNT,
  TLE_JOURNEY_DEFAULT_BEAT_DURATION_SEC,
  TLE_JOURNEY_DEFAULT_BEAT_DURATION_SEC,
  TLE_JOURNEY_DEFAULT_BEAT_DURATION_SEC,
]);

if (TLE_JOURNEY_BEAT_DURATIONS_SEC.length !== TLE_JOURNEY_BEAT_COUNT) {
  throw new Error('TLE Journey beat durations must match the station count');
}

export const TLE_JOURNEY_BEAT_START_TIMES_SEC: readonly number[] = Object.freeze(
  TLE_JOURNEY_BEAT_DURATIONS_SEC.map((_, index) => (
    TLE_JOURNEY_BEAT_DURATIONS_SEC.slice(0, index).reduce((sum, duration) => sum + duration, 0)
  )),
);
export const TLE_JOURNEY_DURATION_SEC = TLE_JOURNEY_BEAT_DURATIONS_SEC.reduce(
  (sum, duration) => sum + duration,
  0,
);

export interface TleJourneyClockFrame {
  readonly courseTimeSec: number;
  readonly stationIndex: number;
  readonly stationId: TleJourneyStationId;
  readonly beatElapsedSec: number;
  readonly beatProgress: number;
}

/**
 * Clamp any transport input to the finite five-beat teaching course.
 * Invalid values fail closed to the first frame so seek/replay cannot publish
 * NaN into the scene director.
 */
export function clampTleJourneyCourseTime(courseTimeSec: number): number {
  if (!Number.isFinite(courseTimeSec) || courseTimeSec < 0) return 0;
  return Math.min(TLE_JOURNEY_DURATION_SEC, courseTimeSec);
}

/**
 * Resolve the one shared course clock into a station and beat-local progress.
 * Exact beat boundaries belong to the next station, except the terminal frame
 * frame which remains the final station at progress 1.
 */
export function courseTimeToTleJourneyBeat(courseTimeSec: number): TleJourneyClockFrame {
  const clampedTime = clampTleJourneyCourseTime(courseTimeSec);
  let stationIndex = 0;
  for (let index = 1; index < TLE_JOURNEY_BEAT_START_TIMES_SEC.length; index += 1) {
    if ((TLE_JOURNEY_BEAT_START_TIMES_SEC[index] ?? Number.POSITIVE_INFINITY) > clampedTime) break;
    stationIndex = index;
  }
  const station = TLE_JOURNEY_STATIONS[stationIndex] ?? TLE_JOURNEY_STATIONS[0]!;
  const beatDurationSec = TLE_JOURNEY_BEAT_DURATIONS_SEC[stationIndex] ?? TLE_JOURNEY_DEFAULT_BEAT_DURATION_SEC;
  const beatStartSec = TLE_JOURNEY_BEAT_START_TIMES_SEC[stationIndex] ?? 0;
  const beatElapsedSec = stationIndex === TLE_JOURNEY_STATIONS.length - 1 && clampedTime >= TLE_JOURNEY_DURATION_SEC
    ? beatDurationSec
    : Math.max(0, Math.min(beatDurationSec, clampedTime - beatStartSec));

  return Object.freeze({
    courseTimeSec: clampedTime,
    stationIndex,
    stationId: station.id,
    beatElapsedSec,
    beatProgress: beatElapsedSec / beatDurationSec,
  });
}

/** Convert a station index and local elapsed time into one total course time. */
export function tleJourneyBeatToCourseTime(stationIndex: number, beatElapsedSec = 0): number {
  const safeIndex = Math.max(0, Math.min(TLE_JOURNEY_STATIONS.length - 1, Math.trunc(stationIndex)));
  const beatDurationSec = TLE_JOURNEY_BEAT_DURATIONS_SEC[safeIndex] ?? TLE_JOURNEY_DEFAULT_BEAT_DURATION_SEC;
  const safeElapsed = Number.isFinite(beatElapsedSec)
    ? Math.max(0, Math.min(beatDurationSec, beatElapsedSec))
    : 0;
  const beatStartSec = TLE_JOURNEY_BEAT_START_TIMES_SEC[safeIndex] ?? 0;
  return clampTleJourneyCourseTime(beatStartSec + safeElapsed);
}

/** Convert an exact station id into the first frame of that station. */
export function tleJourneyStationToCourseTime(stationId: TleJourneyStationId): number {
  const index = TLE_JOURNEY_STATIONS.findIndex(station => station.id === stationId);
  return tleJourneyBeatToCourseTime(index < 0 ? 0 : index);
}

/** Hold the first SGP4/Epoch frame before sweeping through one orbit. */
export function tleJourneySgp4SweepProgress(beatElapsedSec: number): number {
  const elapsed = Number.isFinite(beatElapsedSec) ? beatElapsedSec : 0;
  return Math.max(0, Math.min(1, (elapsed - TLE_JOURNEY_SGP4_INITIAL_HOLD_SEC) / TLE_JOURNEY_SGP4_SWEEP_DURATION_SEC));
}

/**
 * Autoplay is a teaching time-lapse, not a real-time telemetry feed.  Hold four
 * representative orbital instants long enough to read instead of publishing a
 * different TEME vector on every animation frame.  Paused/manual inspection
 * remains continuous through the Δt slider in the route.
 */
export function tleJourneySgp4StagedSweepProgress(beatElapsedSec: number): number {
  const continuousProgress = tleJourneySgp4SweepProgress(beatElapsedSec);
  if (continuousProgress <= 0) return 0;
  const checkpointIndex = Math.min(
    TLE_JOURNEY_SGP4_AUTOPLAY_CHECKPOINT_COUNT - 1,
    Math.floor(continuousProgress * TLE_JOURNEY_SGP4_AUTOPLAY_CHECKPOINT_COUNT),
  );
  return checkpointIndex / (TLE_JOURNEY_SGP4_AUTOPLAY_CHECKPOINT_COUNT - 1);
}

/** Apply a real-time delta and a learner-selected transport multiplier. */
export function advanceTleJourneyCourseTime(
  courseTimeSec: number,
  elapsedSec: number,
  playbackSpeed: number,
): number {
  const safeElapsed = Number.isFinite(elapsedSec) && elapsedSec > 0 ? elapsedSec : 0;
  const safeSpeed = Number.isFinite(playbackSpeed) && playbackSpeed > 0 ? playbackSpeed : 1;
  return clampTleJourneyCourseTime(courseTimeSec + safeElapsed * safeSpeed);
}
