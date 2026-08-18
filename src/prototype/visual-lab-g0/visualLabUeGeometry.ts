/**
 * Pure geometry helpers for the Visual Lab UE control.
 *
 * The canonical seven-cell scenario derives theta from the same local
 * satellite-to-ground vectors below.  The UI uses these helpers only to
 * choose a draft ground position; the accepted frame remains the authority
 * for the displayed/recorded off-axis angle after Apply.
 */

export type VisualLabGroundPositionKm = readonly [number, number];

export interface VisualLabUeAngleGeometryInput {
  readonly satelliteDistanceKm: number;
  readonly satelliteElevationDeg: number;
  readonly beamCenterKm: VisualLabGroundPositionKm;
  readonly userPositionKm: VisualLabGroundPositionKm;
}

export interface VisualLabUeAnglePositionRequest extends VisualLabUeAngleGeometryInput {
  readonly maxRadiusKm: number;
  readonly direction?: VisualLabGroundPositionKm;
}

const DEGREES_TO_RADIANS = Math.PI / 180;
const EPSILON = 1e-12;

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
}

function positive(value: number, name: string): number {
  finite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be positive`);
  return value;
}

function vectorLength(x: number, y: number, z: number): number {
  return Math.hypot(x, y, z);
}

/**
 * Computes the angle used by canonicalSevenCellScenario.linkGeometry.
 * `beamCenterKm` and `userPositionKm` are local tangent-plane coordinates;
 * no display-only world scale is involved.
 */
export function offAxisAngleRadForVisualLabUe(
  input: VisualLabUeAngleGeometryInput,
): number {
  const distanceKm = positive(input.satelliteDistanceKm, 'satelliteDistanceKm');
  const elevationDeg = finite(input.satelliteElevationDeg, 'satelliteElevationDeg');
  const beamCenterX = finite(input.beamCenterKm[0], 'beamCenterKm[0]');
  const beamCenterY = finite(input.beamCenterKm[1], 'beamCenterKm[1]');
  const userX = finite(input.userPositionKm[0], 'userPositionKm[0]');
  const userY = finite(input.userPositionKm[1], 'userPositionKm[1]');
  const elevationRad = elevationDeg * DEGREES_TO_RADIANS;
  const satellite = {
    x: distanceKm * Math.cos(elevationRad),
    y: 0,
    z: distanceKm * Math.sin(elevationRad),
  };
  // Same vector convention as vectorFromSatellite(): ground coordinates are
  // the local x/y plane and the selected link elevation is the z component.
  const beamAxis = {
    x: satellite.x - beamCenterX,
    y: satellite.y - beamCenterY,
    z: satellite.z,
  };
  const userRay = {
    x: satellite.x - userX,
    y: satellite.y - userY,
    z: satellite.z,
  };
  const beamLength = vectorLength(beamAxis.x, beamAxis.y, beamAxis.z);
  const userLength = vectorLength(userRay.x, userRay.y, userRay.z);
  const denominator = beamLength * userLength;
  if (denominator <= EPSILON) {
    throw new RangeError('off-axis angle requires non-degenerate geometry');
  }
  const rawCosine = (
    beamAxis.x * userRay.x
    + beamAxis.y * userRay.y
    + beamAxis.z * userRay.z
  ) / denominator;
  // At the exact beam centre the two vectors are mathematically identical,
  // but the normalized dot product can land a few ulps below one. Preserve
  // the canonical zero-angle contract instead of exposing that round-off as
  // a visible non-zero off-axis angle.
  const cosine = rawCosine >= 1 - EPSILON
    ? 1
    : Math.max(-1, Math.min(1, rawCosine));
  return Math.acos(cosine);
}

function normalizedDirection(
  beamCenterKm: VisualLabGroundPositionKm,
  userPositionKm: VisualLabGroundPositionKm,
  preferred?: VisualLabGroundPositionKm,
): VisualLabGroundPositionKm {
  const dx = preferred?.[0] ?? userPositionKm[0] - beamCenterKm[0];
  const dy = preferred?.[1] ?? userPositionKm[1] - beamCenterKm[1];
  const length = Math.hypot(dx, dy);
  if (length <= EPSILON) return [1, 0];
  return [dx / length, dy / length];
}

function positionAtRadius(
  center: VisualLabGroundPositionKm,
  direction: VisualLabGroundPositionKm,
  radiusKm: number,
): VisualLabGroundPositionKm {
  return [
    center[0] + direction[0] * radiusKm,
    center[1] + direction[1] * radiusKm,
  ];
}

/**
 * Finds a ground position on a fixed radial line whose computed angle is the
 * requested value.  A sampled bracket followed by bisection avoids claiming
 * a linear angle-to-position approximation and remains stable at the cell
 * centre (zero angle).
 */
export function positionForVisualLabUeOffAxisAngle(
  request: VisualLabUeAnglePositionRequest,
  targetAngleRad: number,
): VisualLabGroundPositionKm {
  const maxRadiusKm = positive(request.maxRadiusKm, 'maxRadiusKm');
  const target = Math.max(0, finite(targetAngleRad, 'targetAngleRad'));
  const direction = normalizedDirection(request.beamCenterKm, request.userPositionKm, request.direction);
  const at = (radiusKm: number): number => offAxisAngleRadForVisualLabUe({
    satelliteDistanceKm: request.satelliteDistanceKm,
    satelliteElevationDeg: request.satelliteElevationDeg,
    beamCenterKm: request.beamCenterKm,
    userPositionKm: positionAtRadius(request.beamCenterKm, direction, radiusKm),
  });
  const maxAngle = at(maxRadiusKm);
  if (target <= EPSILON) return positionAtRadius(request.beamCenterKm, direction, 0);
  if (target >= maxAngle - EPSILON) return positionAtRadius(request.beamCenterKm, direction, maxRadiusKm);

  let lowerRadius = 0;
  let upperRadius = maxRadiusKm;
  let lowerAngle = 0;
  // Find the first monotonic bracket. This guards the solver against a
  // future geometry profile with a non-linear edge while keeping the exact
  // canonical angle function as the only source of truth.
  const samples = 64;
  for (let index = 1; index <= samples; index += 1) {
    const radius = maxRadiusKm * index / samples;
    const angle = at(radius);
    if (angle >= target) {
      upperRadius = radius;
      break;
    }
    lowerRadius = radius;
    lowerAngle = angle;
  }
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const middleRadius = (lowerRadius + upperRadius) / 2;
    const middleAngle = at(middleRadius);
    if (middleAngle < target) {
      lowerRadius = middleRadius;
      lowerAngle = middleAngle;
    } else {
      upperRadius = middleRadius;
    }
  }
  // Keep the variables visibly used as a post-condition guard without
  // replacing the exact bisection result with an approximate correction.
  void lowerAngle;
  return positionAtRadius(request.beamCenterKm, direction, (lowerRadius + upperRadius) / 2);
}

export function degreesFromRadians(value: number): number {
  return finite(value, 'radians') / DEGREES_TO_RADIANS;
}

export function radiansFromDegrees(value: number): number {
  return finite(value, 'degrees') * DEGREES_TO_RADIANS;
}
