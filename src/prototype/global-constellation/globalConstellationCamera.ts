import type { GlobalConstellationCameraPose } from './globalConstellationDirector';

/** World-space error required before a director pose can be called settled. */
export const GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD = 0.003;

/** Consecutive render frames required inside the error boundary. */
export const GLOBAL_CONSTELLATION_CAMERA_SETTLE_REQUIRED_FRAMES = 12;

/** Stable time is measured after the camera-settled boundary, never before it. */
export const GLOBAL_CONSTELLATION_STABLE_HOLD_MS = 6_250;

export interface GlobalConstellationCameraTelemetry {
  readonly pose: GlobalConstellationCameraPose;
  readonly settled: boolean;
  readonly positionErrorWorld: number;
  readonly targetErrorWorld: number;
  readonly settledFrames: number;
}

export function cameraTelemetryIsSettled(
  positionErrorWorld: number,
  targetErrorWorld: number,
  settledFrames: number,
): boolean {
  return positionErrorWorld <= GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD
    && targetErrorWorld <= GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD
    && settledFrames >= GLOBAL_CONSTELLATION_CAMERA_SETTLE_REQUIRED_FRAMES;
}
