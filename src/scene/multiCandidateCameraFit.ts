export type MultiCandidateCameraPoint = readonly [number, number, number];

export interface MultiCandidateCameraFitInput {
  readonly points: readonly MultiCandidateCameraPoint[];
  /** Ground endpoint of the primary link used only to choose a readable azimuth. */
  readonly focusGroundPoint?: MultiCandidateCameraPoint;
  /** Satellite endpoint of the primary link used only to choose a readable azimuth. */
  readonly focusElevatedPoint?: MultiCandidateCameraPoint;
  readonly currentPosition: MultiCandidateCameraPoint;
  readonly currentTarget: MultiCandidateCameraPoint;
  readonly verticalFovDeg: number;
  readonly aspect: number;
  readonly padding?: number;
  readonly minDistance?: number;
  readonly maxDistance?: number;
}

export interface MultiCandidateCameraFit {
  readonly target: MultiCandidateCameraPoint;
  readonly position: MultiCandidateCameraPoint;
  readonly radius: number;
  readonly distance: number;
}

export interface MultiCandidateCameraSafeFrameInput {
  readonly points: readonly MultiCandidateCameraPoint[];
  readonly position: MultiCandidateCameraPoint;
  readonly target: MultiCandidateCameraPoint;
  readonly verticalFovDeg: number;
  readonly aspect: number;
  /** Normalised-device-coordinate limit. One is the canvas edge. */
  readonly horizontalLimit?: number;
  /** Normalised-device-coordinate limit. One is the canvas edge. */
  readonly verticalLimit?: number;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
}

function normalize(vector: MultiCandidateCameraPoint): MultiCandidateCameraPoint {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length <= 1e-9) return [0, 0.58, 0.815];
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function dot(a: MultiCandidateCameraPoint, b: MultiCandidateCameraPoint): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: MultiCandidateCameraPoint, b: MultiCandidateCameraPoint): MultiCandidateCameraPoint {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function safeFrameLimit(value: number | undefined, fallback: number, label: string): number {
  const limit = finite(value ?? fallback, label);
  if (!(limit > 0 && limit <= 1)) {
    throw new RangeError(`${label} must be within (0, 1]`);
  }
  return limit;
}

/**
 * True while the presentation's focus points remain inside a padded camera
 * frame. This is intentionally separate from the fit itself: the spacecraft
 * may travel visibly through the shot, and the director only asks for a new
 * composition when that motion approaches an edge.
 */
export function areMultiCandidateFocusPointsWithinSafeFrame(
  input: MultiCandidateCameraSafeFrameInput,
): boolean {
  if (input.points.length === 0) return false;
  const verticalFovRad = finite(input.verticalFovDeg, 'verticalFovDeg') * Math.PI / 180;
  const aspect = finite(input.aspect, 'aspect');
  if (!(verticalFovRad > 0 && verticalFovRad < Math.PI) || !(aspect > 0)) {
    throw new RangeError('camera fov and aspect must be positive');
  }
  const horizontalLimit = safeFrameLimit(input.horizontalLimit, 0.82, 'horizontalLimit');
  const verticalLimit = safeFrameLimit(input.verticalLimit, 0.84, 'verticalLimit');
  const forwardVector: MultiCandidateCameraPoint = [
    finite(input.target[0], 'target.x') - finite(input.position[0], 'position.x'),
    finite(input.target[1], 'target.y') - finite(input.position[1], 'position.y'),
    finite(input.target[2], 'target.z') - finite(input.position[2], 'position.z'),
  ];
  const forwardLength = Math.hypot(...forwardVector);
  if (forwardLength <= 1e-9) return false;
  const forward: MultiCandidateCameraPoint = [
    forwardVector[0] / forwardLength,
    forwardVector[1] / forwardLength,
    forwardVector[2] / forwardLength,
  ];
  let rightVector = cross(forward, [0, 1, 0]);
  if (Math.hypot(...rightVector) <= 1e-9) rightVector = cross(forward, [0, 0, 1]);
  const right = normalize(rightVector);
  const up = normalize(cross(right, forward));
  const verticalTan = Math.tan(verticalFovRad / 2);
  const horizontalTan = verticalTan * aspect;

  return input.points.every((point, index) => {
    const delta: MultiCandidateCameraPoint = [
      finite(point[0], `points[${index}].x`) - input.position[0],
      finite(point[1], `points[${index}].y`) - input.position[1],
      finite(point[2], `points[${index}].z`) - input.position[2],
    ];
    const depth = dot(delta, forward);
    if (depth <= 1e-6) return false;
    const projectedX = dot(delta, right) / (depth * horizontalTan);
    const projectedY = dot(delta, up) / (depth * verticalTan);
    return Math.abs(projectedX) <= horizontalLimit && Math.abs(projectedY) <= verticalLimit;
  });
}

function resolveFitDirection(
  points: readonly MultiCandidateCameraPoint[],
  target: MultiCandidateCameraPoint,
  currentDirection: MultiCandidateCameraPoint,
  focusGroundPoint?: MultiCandidateCameraPoint,
  focusElevatedPoint?: MultiCandidateCameraPoint,
): MultiCandidateCameraPoint {
  const minY = Math.min(...points.map(point => point[1]));
  const maxY = Math.max(...points.map(point => point[1]));
  const groundBandY = minY + Math.max(8, (maxY - minY) * 0.08);
  const groundPoints = points.filter(point => point[1] <= groundBandY);
  const groundCenter = groundPoints.length === 0
    ? target
    : [
      groundPoints.reduce((sum, point) => sum + point[0], 0) / groundPoints.length,
      groundPoints.reduce((sum, point) => sum + point[1], 0) / groundPoints.length,
      groundPoints.reduce((sum, point) => sum + point[2], 0) / groundPoints.length,
    ] as const;
  const highestPoint = focusElevatedPoint
    ?? points.reduce((highest, point) => point[1] > highest[1] ? point : highest);
  const directionGroundPoint = focusGroundPoint ?? groundCenter;
  const elevatedGroundVector: MultiCandidateCameraPoint = [
    highestPoint[0] - directionGroundPoint[0],
    0,
    highestPoint[2] - directionGroundPoint[2],
  ];
  const currentHorizontal: MultiCandidateCameraPoint = [currentDirection[0], 0, currentDirection[2]];
  const horizontalDirection = Math.hypot(elevatedGroundVector[0], elevatedGroundVector[2]) > 1e-6
    ? normalize(elevatedGroundVector)
    : normalize(currentHorizontal);
  // Keep an oblique, ground-readable view.  Aligning the horizontal component
  // with the elevated satellite prevents real cross-track displacement from
  // consuming the narrow centre viewport as empty lateral space.
  const vertical = Math.min(0.66, Math.max(0.48, Math.abs(currentDirection[1])));
  const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));
  return normalize([
    -horizontalDirection[0] * horizontal,
    vertical,
    -horizontalDirection[2] * horizontal,
  ]);
}

/**
 * Fit the real UE, footprint, and satellite points into the actual horizontal
 * and vertical camera axes. The azimuth follows the ground-to-satellite span,
 * so a narrow centre viewport does not push the spacecraft off-screen. This is
 * presentation-only and never changes scientific geometry.
 */
export function resolveMultiCandidateCameraFit(
  input: MultiCandidateCameraFitInput,
): MultiCandidateCameraFit | null {
  if (input.points.length === 0) return null;
  const points = input.points.map((point, index) => [
    finite(point[0], `points[${index}].x`),
    finite(point[1], `points[${index}].y`),
    finite(point[2], `points[${index}].z`),
  ] as const);
  const focusGroundPoint = input.focusGroundPoint === undefined
    ? undefined
    : [
      finite(input.focusGroundPoint[0], 'focusGroundPoint.x'),
      finite(input.focusGroundPoint[1], 'focusGroundPoint.y'),
      finite(input.focusGroundPoint[2], 'focusGroundPoint.z'),
    ] as const;
  const focusElevatedPoint = input.focusElevatedPoint === undefined
    ? undefined
    : [
      finite(input.focusElevatedPoint[0], 'focusElevatedPoint.x'),
      finite(input.focusElevatedPoint[1], 'focusElevatedPoint.y'),
      finite(input.focusElevatedPoint[2], 'focusElevatedPoint.z'),
    ] as const;
  const min: [number, number, number] = [...points[0]!] as [number, number, number];
  const max: [number, number, number] = [...points[0]!] as [number, number, number];
  for (const point of points.slice(1)) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis]!, point[axis]!);
      max[axis] = Math.max(max[axis]!, point[axis]!);
    }
  }
  const boundsCenter: MultiCandidateCameraPoint = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  const target: MultiCandidateCameraPoint = focusGroundPoint !== undefined
    && focusElevatedPoint !== undefined
    ? [
      (focusGroundPoint[0] + focusElevatedPoint[0]) / 2,
      boundsCenter[1],
      (focusGroundPoint[2] + focusElevatedPoint[2]) / 2,
    ]
    : boundsCenter;
  const radius = Math.max(
    1,
    ...points.map(point => Math.hypot(
      point[0] - target[0],
      point[1] - target[1],
      point[2] - target[2],
    )),
  );
  const verticalFovRad = finite(input.verticalFovDeg, 'verticalFovDeg') * Math.PI / 180;
  const aspect = finite(input.aspect, 'aspect');
  if (!(verticalFovRad > 0 && verticalFovRad < Math.PI) || !(aspect > 0)) {
    throw new RangeError('camera fov and aspect must be positive');
  }
  const horizontalFovRad = 2 * Math.atan(Math.tan(verticalFovRad / 2) * aspect);
  const padding = Math.max(1, input.padding ?? 1.1);
  const minDistance = Math.max(1, input.minDistance ?? 50);
  const maxDistance = Math.max(minDistance, input.maxDistance ?? 2850);
  const currentDirection = normalize([
    finite(input.currentPosition[0], 'currentPosition.x') - finite(input.currentTarget[0], 'currentTarget.x'),
    finite(input.currentPosition[1], 'currentPosition.y') - finite(input.currentTarget[1], 'currentTarget.y'),
    finite(input.currentPosition[2], 'currentPosition.z') - finite(input.currentTarget[2], 'currentTarget.z'),
  ]);
  const direction = resolveFitDirection(
    points,
    target,
    currentDirection,
    focusGroundPoint,
    focusElevatedPoint,
  );
  const forward: MultiCandidateCameraPoint = [-direction[0], -direction[1], -direction[2]];
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = normalize(cross(right, forward));
  const horizontalTan = Math.tan(horizontalFovRad / 2);
  const verticalTan = Math.tan(verticalFovRad / 2);
  const requestedDistance = Math.max(...points.flatMap(point => {
    const delta: MultiCandidateCameraPoint = [
      point[0] - target[0],
      point[1] - target[1],
      point[2] - target[2],
    ];
    const depthOffset = dot(delta, direction);
    return [
      depthOffset + Math.abs(dot(delta, right)) * padding / horizontalTan,
      depthOffset + Math.abs(dot(delta, up)) * padding / verticalTan,
    ];
  }));
  const distance = Math.min(maxDistance, Math.max(minDistance, requestedDistance));
  const position: MultiCandidateCameraPoint = [
    target[0] + direction[0] * distance,
    target[1] + direction[1] * distance,
    target[2] + direction[2] * distance,
  ];
  return Object.freeze({ target, position, radius, distance });
}
