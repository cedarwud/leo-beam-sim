export type GoldenFlowPoint3 = readonly [number, number, number];

export interface GroundBeamGeometryInput {
  readonly source: GoldenFlowPoint3;
  readonly target: GoldenFlowPoint3;
  readonly radius: number;
  readonly groundY?: number;
}

export interface GroundBeamGeometry {
  /** Unit axis direction from the satellite toward the visual beam target. */
  readonly axisDirection: GoldenFlowPoint3;
  /** Axis intersection with the horizontal ground plane. */
  readonly groundAxis: GoldenFlowPoint3;
  /** Length and radius of the display cone after extending it to the ground. */
  readonly coneLength: number;
  readonly coneRadius: number;
  /** Exact horizontal cone/surface intersection, represented as an ellipse. */
  readonly footprintCenter: GoldenFlowPoint3;
  readonly footprintMajorRadius: number;
  readonly footprintMinorRadius: number;
  /** Y rotation of the ellipse major axis in the XZ ground plane. */
  readonly footprintRotationY: number;
}

export interface GroundBoresightInput {
  readonly source: GoldenFlowPoint3;
  readonly terminal: GoldenFlowPoint3;
  readonly offAxisDeg: number;
  readonly groundY?: number;
}

export interface ConstantElevationTerminalInput {
  readonly source: GoldenFlowPoint3;
  /** Ground point where the fixed beam boresight is centred. */
  readonly centeredTerminal: GoldenFlowPoint3;
  /** Requested angle between the fixed boresight and the moved UE ray. */
  readonly offAxisDeg: number;
  readonly groundY?: number;
}

/**
 * Build the open cone side as world-space triangles whose complete lower rim
 * lies on the horizontal ground plane. Three.js ConeGeometry ends on a plane
 * perpendicular to its own axis; for an oblique beam that leaves half of the
 * rim visibly floating. This helper uses the exact ellipse returned above.
 */
export function buildGroundClippedConePositions(
  source: GoldenFlowPoint3,
  ground: GroundBeamGeometry,
  segments = 56,
): Float32Array {
  assertFinitePoint(source, 'source');
  if (!Number.isInteger(segments) || segments < 3) {
    throw new Error('segments must be an integer of at least 3');
  }

  const theta = ground.footprintRotationY;
  const majorDirection: GoldenFlowPoint3 = [Math.cos(theta), 0, Math.sin(theta)];
  const minorDirection: GoldenFlowPoint3 = [-Math.sin(theta), 0, Math.cos(theta)];
  const pointAt = (angle: number): GoldenFlowPoint3 => [
    ground.footprintCenter[0]
      + majorDirection[0] * ground.footprintMajorRadius * Math.cos(angle)
      + minorDirection[0] * ground.footprintMinorRadius * Math.sin(angle),
    ground.footprintCenter[1],
    ground.footprintCenter[2]
      + majorDirection[2] * ground.footprintMajorRadius * Math.cos(angle)
      + minorDirection[2] * ground.footprintMinorRadius * Math.sin(angle),
  ];

  const positions = new Float32Array(segments * 9);
  for (let index = 0; index < segments; index += 1) {
    const offset = index * 9;
    const current = pointAt((index / segments) * Math.PI * 2);
    const next = pointAt(((index + 1) / segments) * Math.PI * 2);
    positions.set(source, offset);
    positions.set(current, offset + 3);
    positions.set(next, offset + 6);
  }
  return positions;
}

const EPSILON = 1e-9;

function assertFinitePoint(point: GoldenFlowPoint3, name: string): void {
  if (point.length !== 3 || point.some(value => !Number.isFinite(value))) {
    throw new Error(`${name} must be a finite 3D point`);
  }
}

function normalize(point: GoldenFlowPoint3): GoldenFlowPoint3 {
  const length = Math.hypot(point[0], point[1], point[2]);
  if (length <= EPSILON) throw new Error('vector must have non-zero length');
  return [point[0] / length, point[1] / length, point[2] / length];
}

function dot(left: GoldenFlowPoint3, right: GoldenFlowPoint3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function cross(left: GoldenFlowPoint3, right: GoldenFlowPoint3): GoldenFlowPoint3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

/**
 * Project a beam boresight to the ground while preserving the requested true
 * 3D off-axis angle at the satellite.  The lateral direction only chooses
 * which side of the terminal the teaching beam moves toward; it does not
 * rescale or visually exaggerate the angle.
 */
export function buildGroundBoresightTarget(input: GroundBoresightInput): GoldenFlowPoint3 {
  const { source, terminal, offAxisDeg, groundY = 0 } = input;
  assertFinitePoint(source, 'source');
  assertFinitePoint(terminal, 'terminal');
  if (!Number.isFinite(offAxisDeg) || offAxisDeg < 0 || offAxisDeg >= 89) {
    throw new Error('offAxisDeg must be finite and in [0, 89)');
  }
  if (!Number.isFinite(groundY)) throw new Error('groundY must be finite');

  const terminalDirection = normalize([
    terminal[0] - source[0],
    terminal[1] - source[1],
    terminal[2] - source[2],
  ]);
  const preferredLateral: GoldenFlowPoint3 = [1, 0, 0];
  const projection = dot(preferredLateral, terminalDirection);
  let lateral: GoldenFlowPoint3 = [
    preferredLateral[0] - terminalDirection[0] * projection,
    preferredLateral[1] - terminalDirection[1] * projection,
    preferredLateral[2] - terminalDirection[2] * projection,
  ];
  if (Math.hypot(...lateral) <= EPSILON) lateral = [0, 0, 1];
  lateral = normalize(lateral);
  const rotationAxis = normalize(cross(terminalDirection, lateral));
  const angleRad = offAxisDeg * Math.PI / 180;
  const cosine = Math.cos(angleRad);
  const sine = Math.sin(angleRad);
  const axisCrossDirection = cross(rotationAxis, terminalDirection);
  const axisProjection = dot(rotationAxis, terminalDirection);
  const boresightDirection: GoldenFlowPoint3 = [
    terminalDirection[0] * cosine
      + axisCrossDirection[0] * sine
      + rotationAxis[0] * axisProjection * (1 - cosine),
    terminalDirection[1] * cosine
      + axisCrossDirection[1] * sine
      + rotationAxis[1] * axisProjection * (1 - cosine),
    terminalDirection[2] * cosine
      + axisCrossDirection[2] * sine
      + rotationAxis[2] * axisProjection * (1 - cosine),
  ];
  if (boresightDirection[1] >= -EPSILON) {
    throw new Error('rotated boresight does not intersect the ground plane');
  }
  const distanceToGround = (groundY - source[1]) / boresightDirection[1];
  if (distanceToGround <= EPSILON) throw new Error('source must be above the ground plane');

  return Object.freeze([
    source[0] + boresightDirection[0] * distanceToGround,
    groundY,
    source[2] + boresightDirection[2] * distanceToGround,
  ]);
}

/**
 * Move a ground UE around the satellite's ground projection while preserving
 * its elevation angle. The beam boresight remains fixed on centeredTerminal;
 * only the UE position changes. This is the controlled Act 3 teaching path:
 * equal ground radius means equal elevation, while the azimuth change creates
 * the requested true 3D off-axis angle at the satellite.
 */
export function buildConstantElevationTerminalPosition(
  input: ConstantElevationTerminalInput,
): GoldenFlowPoint3 {
  const { source, centeredTerminal, offAxisDeg, groundY = 0 } = input;
  assertFinitePoint(source, 'source');
  assertFinitePoint(centeredTerminal, 'centeredTerminal');
  if (!Number.isFinite(offAxisDeg) || offAxisDeg < 0 || offAxisDeg >= 89) {
    throw new Error('offAxisDeg must be finite and in [0, 89)');
  }
  if (!Number.isFinite(groundY)) throw new Error('groundY must be finite');
  if (source[1] <= groundY + EPSILON) throw new Error('source must be above the ground plane');

  const radialX = centeredTerminal[0] - source[0];
  const radialZ = centeredTerminal[2] - source[2];
  const horizontalRadius = Math.hypot(radialX, radialZ);
  if (horizontalRadius <= EPSILON) {
    if (offAxisDeg <= EPSILON) return Object.freeze([centeredTerminal[0], groundY, centeredTerminal[2]]);
    throw new Error('a nadir terminal has no constant-elevation azimuth path');
  }

  const vertical = source[1] - groundY;
  const slantSquared = horizontalRadius ** 2 + vertical ** 2;
  const horizontalFractionSquared = horizontalRadius ** 2 / slantSquared;
  const verticalFractionSquared = vertical ** 2 / slantSquared;
  const requestedCosine = Math.cos(offAxisDeg * Math.PI / 180);
  const azimuthCosine = (requestedCosine - verticalFractionSquared) / horizontalFractionSquared;
  if (azimuthCosine < -1 - 1e-8 || azimuthCosine > 1 + 1e-8) {
    throw new Error('requested off-axis angle is unreachable on this constant-elevation path');
  }
  const azimuthRad = Math.acos(Math.max(-1, Math.min(1, azimuthCosine)));
  const cosine = Math.cos(azimuthRad);
  const sine = Math.sin(azimuthRad);

  // Use the clockwise branch of the equal-elevation circle. In the authored
  // Act 3 side camera this projects toward screen-right, matching the learner
  // gesture and opening the off-axis arc instead of folding it behind the UE.
  return Object.freeze([
    source[0] + radialX * cosine + radialZ * sine,
    groundY,
    source[2] - radialX * sine + radialZ * cosine,
  ]);
}

/**
 * Resolve a display-only cone to the horizontal ground plane.
 *
 * The input radius is the radius at the existing visual target. The cone is
 * extended along that same axis to the ground, then the exact intersection of
 * the resulting cone surface with the horizontal plane is returned as an
 * ellipse. This keeps the scene's teaching vectors untouched while removing
 * the tilted, floating end from the rendered beam.
 */
export function buildGroundBeamGeometry(input: GroundBeamGeometryInput): GroundBeamGeometry {
  const { source, target, radius, groundY = 0 } = input;
  assertFinitePoint(source, 'source');
  assertFinitePoint(target, 'target');
  if (!Number.isFinite(radius) || radius < 0) throw new Error('radius must be a finite non-negative number');
  if (!Number.isFinite(groundY)) throw new Error('groundY must be finite');

  const deltaX = target[0] - source[0];
  const deltaY = target[1] - source[1];
  const deltaZ = target[2] - source[2];
  const targetDistance = Math.hypot(deltaX, deltaY, deltaZ);
  if (targetDistance <= EPSILON) throw new Error('source and target must be distinct');

  const axisDirection: GoldenFlowPoint3 = [
    deltaX / targetDistance,
    deltaY / targetDistance,
    deltaZ / targetDistance,
  ];
  const verticalDirection = axisDirection[1];
  if (verticalDirection >= -EPSILON) {
    throw new Error('beam axis must descend toward the ground plane');
  }

  const groundDistance = (groundY - source[1]) / verticalDirection;
  if (groundDistance <= EPSILON) throw new Error('source must be above the ground plane');

  const groundAxis: GoldenFlowPoint3 = [
    source[0] + axisDirection[0] * groundDistance,
    groundY,
    source[2] + axisDirection[2] * groundDistance,
  ];
  const coneRadius = radius * groundDistance / targetDistance;

  const horizontalDirectionLength = Math.hypot(axisDirection[0], axisDirection[2]);
  const downwardDirection = -verticalDirection;
  const coneSlope = radius / targetDistance;
  // The denominator is the horizontal-plane section of the cone equation. A
  // non-positive value means this display cone does not form a finite ellipse
  // where it meets the requested ground plane.
  const sectionDenominator = downwardDirection ** 2
    - coneSlope ** 2 * horizontalDirectionLength ** 2;
  if (sectionDenominator <= EPSILON) {
    throw new Error('beam cone does not have a finite ground-plane footprint');
  }

  const horizontalDirection: GoldenFlowPoint3 = horizontalDirectionLength <= EPSILON
    ? [0, 0, 0]
    : [
      axisDirection[0] / horizontalDirectionLength,
      0,
      axisDirection[2] / horizontalDirectionLength,
    ];
  const centerShift = coneSlope ** 2 * groundDistance * horizontalDirectionLength / sectionDenominator;
  const footprintCenter: GoldenFlowPoint3 = [
    groundAxis[0] + horizontalDirection[0] * centerShift,
    groundY,
    groundAxis[2] + horizontalDirection[2] * centerShift,
  ];
  const footprintMinorRadius = coneSlope * groundDistance * downwardDirection
    / Math.sqrt(sectionDenominator);
  const footprintMajorRadius = coneSlope * groundDistance * downwardDirection
    / sectionDenominator;

  return Object.freeze({
    axisDirection: Object.freeze(axisDirection),
    groundAxis: Object.freeze(groundAxis),
    coneLength: groundDistance,
    coneRadius,
    footprintCenter: Object.freeze(footprintCenter),
    footprintMajorRadius,
    footprintMinorRadius,
    footprintRotationY: horizontalDirectionLength <= EPSILON
      ? 0
      : Math.atan2(axisDirection[2], axisDirection[0]),
  });
}
