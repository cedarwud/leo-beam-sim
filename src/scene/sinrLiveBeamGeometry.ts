/**
 * Shared display geometry for the legacy SINR-live beam.
 *
 * The beam cross-section is circular around the boresight. Its intersection
 * with the ground plane becomes an ellipse when the boresight is oblique. This
 * module is deliberately display-only: it consumes the already-resolved apex,
 * ground centre, and footprint radius and never changes SINR or power.
 */

export interface SinrLiveBeamWorldPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SinrLiveBeamFootprintEllipse {
  readonly longAxisWorld: number;
  readonly shortAxisWorld: number;
  /** Direction of the long axis in the ground x/z plane. */
  readonly longAxisAzimuthRad: number;
  /** Physical apex-to-footprint elevation before any presentation exaggeration. */
  readonly elevationDeg: number;
  /** Elevation used for the displayed projection after the optional tilt exaggeration. */
  readonly renderElevationDeg: number;
}

const MIN_RENDER_ELEVATION_DEG = 15;
const MAX_RENDER_TILT_DEG = 45;

export function computeSinrLiveBeamFootprintEllipse(input: {
  readonly apex: SinrLiveBeamWorldPoint;
  readonly baseCenter: SinrLiveBeamWorldPoint;
  readonly radiusWorld: number;
  /**
   * Display-only tilt exaggeration for the teaching scene. `1` is the physical
   * projection; values above `1` make a small real tilt legible without changing
   * the beam axis, theta, or any signal calculation.
   */
  readonly tiltExaggeration?: number;
}): SinrLiveBeamFootprintEllipse {
  const shortAxisWorld = Math.max(0, input.radiusWorld);
  const horizontalDistance = Math.hypot(
    input.apex.x - input.baseCenter.x,
    input.apex.z - input.baseCenter.z,
  );
  const elevationRad = Math.atan2(
    input.apex.y - input.baseCenter.y,
    Math.max(horizontalDistance, 1e-9),
  );
  const elevationDeg = (elevationRad * 180) / Math.PI;
  const safeTiltExaggeration = Number.isFinite(input.tiltExaggeration)
    ? Math.max(1, input.tiltExaggeration ?? 1)
    : 1;
  const physicalTiltDeg = Math.min(
    MAX_RENDER_TILT_DEG,
    Math.max(0, 90 - elevationDeg),
  );
  const renderTiltDeg = Math.min(
    MAX_RENDER_TILT_DEG,
    physicalTiltDeg * safeTiltExaggeration,
  );
  const renderElevationDeg = 90 - renderTiltDeg;
  const clampedSinElevation = Math.max(
    Math.sin((renderElevationDeg * Math.PI) / 180),
    Math.sin((MIN_RENDER_ELEVATION_DEG * Math.PI) / 180),
  );

  return {
    shortAxisWorld,
    longAxisWorld: shortAxisWorld / clampedSinElevation,
    longAxisAzimuthRad: Math.atan2(
      input.apex.z - input.baseCenter.z,
      input.apex.x - input.baseCenter.x,
    ),
    elevationDeg,
    renderElevationDeg,
  };
}
