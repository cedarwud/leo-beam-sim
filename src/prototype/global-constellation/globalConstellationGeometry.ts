import {
  act1NtpuApexWorld,
  act1NtpuZenithWorld,
} from './act1NtpuGeometry';

export type GlobalConstellationWorldPoint = readonly [number, number, number];

export interface NtpuMarkerGeometry {
  readonly anchorWorld: GlobalConstellationWorldPoint;
  readonly glyphScale: number;
  readonly labelOffsetLocal: GlobalConstellationWorldPoint;
}

/**
 * The marker's world anchor is separate from its local glyph scale.  Callers
 * must position the outer group at `anchorWorld`; no world-space position is
 * ever multiplied by `glyphScale`.
 */
export function ntpuMarkerGeometry(active: boolean): NtpuMarkerGeometry {
  return {
    anchorWorld: [...act1NtpuApexWorld()],
    glyphScale: active ? 1.42 : 0.82,
    labelOffsetLocal: [0, active ? 0.16 : 0.1, 0],
  };
}

function cross(a: GlobalConstellationWorldPoint, b: GlobalConstellationWorldPoint): GlobalConstellationWorldPoint {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(point: GlobalConstellationWorldPoint): GlobalConstellationWorldPoint {
  const length = Math.hypot(...point) || 1;
  return [point[0] / length, point[1] / length, point[2] / length];
}

function add(
  left: GlobalConstellationWorldPoint,
  right: GlobalConstellationWorldPoint,
): GlobalConstellationWorldPoint {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function subtract(
  left: GlobalConstellationWorldPoint,
  right: GlobalConstellationWorldPoint,
): GlobalConstellationWorldPoint {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function scale(point: GlobalConstellationWorldPoint, amount: number): GlobalConstellationWorldPoint {
  return [point[0] * amount, point[1] * amount, point[2] * amount];
}

function dot(left: GlobalConstellationWorldPoint, right: GlobalConstellationWorldPoint): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

export interface NtpuVisibilityMask {
  /** One entry per archived satellite position. */
  readonly mask: Uint8Array;
  readonly visibleCount: number;
  readonly minimumElevationDeg: number;
}

/**
 * Re-evaluate one archived Earth-fixed frame against an explicit NTPU elevation
 * mask.  The compact artifact retains its original horizon mask as provenance;
 * Act 1 derives the stricter classroom mask from the same positions instead of
 * relabelling that 0 degree mask.
 *
 * In the local topocentric frame, U is the line-of-sight component along the
 * WGS84 geodetic normal and sqrt(E^2 + N^2) is its tangent-plane magnitude:
 * alpha = atan2(U, sqrt(E^2 + N^2)).
 */
export function ntpuVisibilityMask(
  positionsWorld: readonly number[],
  minimumElevationDeg: number,
): NtpuVisibilityMask {
  if (positionsWorld.length % 3 !== 0) {
    throw new RangeError('NTPU visibility positions must contain complete xyz triples');
  }
  if (!Number.isFinite(minimumElevationDeg)
    || minimumElevationDeg < -90
    || minimumElevationDeg > 90) {
    throw new RangeError('NTPU minimum elevation must be finite and within [-90, 90] degrees');
  }

  const centerWorld = [...act1NtpuApexWorld()] as GlobalConstellationWorldPoint;
  const zenithWorld = normalize([...act1NtpuZenithWorld()] as GlobalConstellationWorldPoint);
  const mask = new Uint8Array(positionsWorld.length / 3);
  let visibleCount = 0;

  for (let satelliteIndex = 0; satelliteIndex < mask.length; satelliteIndex += 1) {
    const offset = satelliteIndex * 3;
    const satelliteWorld = [
      positionsWorld[offset],
      positionsWorld[offset + 1],
      positionsWorld[offset + 2],
    ] as GlobalConstellationWorldPoint;
    if (!satelliteWorld.every(Number.isFinite)) continue;

    const lineOfSight = subtract(satelliteWorld, centerWorld);
    const lineOfSightLengthSquared = dot(lineOfSight, lineOfSight);
    if (lineOfSightLengthSquared <= 0) continue;
    const up = dot(lineOfSight, zenithWorld);
    const horizontal = Math.sqrt(Math.max(0, lineOfSightLengthSquared - up * up));
    const elevationDeg = (Math.atan2(up, horizontal) * 180) / Math.PI;
    if (elevationDeg < minimumElevationDeg) continue;
    mask[satelliteIndex] = 1;
    visibleCount += 1;
  }

  return { mask, visibleCount, minimumElevationDeg };
}

export interface NtpuElevationGeometry {
  readonly satelliteIndex: number;
  readonly satelliteWorld: GlobalConstellationWorldPoint;
  readonly lineOfSightDirectionWorld: GlobalConstellationWorldPoint;
  readonly centerWorld: GlobalConstellationWorldPoint;
  readonly zenithWorld: GlobalConstellationWorldPoint;
  readonly horizonDirectionWorld: GlobalConstellationWorldPoint;
  /** Exact angle drawn by the construction. */
  readonly elevationDeg: number;
  /** Actual archived elevation of the satellite used only to choose azimuth. */
  readonly referenceSatelliteElevationDeg: number;
  readonly horizonSegmentWorld: readonly [GlobalConstellationWorldPoint, GlobalConstellationWorldPoint];
  readonly zenithSegmentWorld: readonly [GlobalConstellationWorldPoint, GlobalConstellationWorldPoint];
  readonly angleArcWorld: readonly GlobalConstellationWorldPoint[];
  readonly angleLabelWorld: GlobalConstellationWorldPoint;
}

export interface NtpuTeachingCameraPose {
  readonly position: GlobalConstellationWorldPoint;
  readonly target: GlobalConstellationWorldPoint;
  readonly up: GlobalConstellationWorldPoint;
}

/**
 * Put the elevation construction into a readable, right-facing teaching view.
 *
 * The archived satellite still owns the local azimuth. The camera moves to
 * the side of that azimuth plane instead of rotating the scientific geometry
 * for presentation. Looking from the negative plane normal makes the
 * positive horizon ray (and therefore the 10 deg boundary satellite) project
 * to screen-right. A modest surface elevation keeps NTPU on the visible face
 * of Earth while preserving most of the small 10 deg angle on screen.
 */
export function ntpuTeachingCameraPose(
  geometry: NtpuElevationGeometry,
  distanceWorld: number,
  surfaceElevationDeg = 40,
): NtpuTeachingCameraPose {
  if (!Number.isFinite(distanceWorld) || distanceWorld <= 0) {
    throw new RangeError('NTPU teaching camera distance must be finite and positive');
  }
  if (!Number.isFinite(surfaceElevationDeg)
    || surfaceElevationDeg < 0
    || surfaceElevationDeg >= 90) {
    throw new RangeError('NTPU teaching camera elevation must be within [0, 90) degrees');
  }

  const zenith = normalize(geometry.zenithWorld);
  const planeNormal = normalize(cross(zenith, geometry.horizonDirectionWorld));
  const sideDirection = scale(planeNormal, -1);
  const elevationRad = surfaceElevationDeg * Math.PI / 180;
  const cameraDirection = normalize(add(
    scale(sideDirection, Math.cos(elevationRad)),
    scale(zenith, Math.sin(elevationRad)),
  ));

  return {
    position: add(geometry.centerWorld, scale(cameraDirection, distanceWorld)),
    target: [...geometry.centerWorld],
    up: zenith,
  };
}

/**
 * Build a local elevation construction from one satellite that is genuinely
 * visible in the archived artifact. The selected point supplies a real local
 * azimuth. Callers may lock the drawn ray to an exact teaching threshold while
 * retaining that source-backed orientation; the diagram then represents the
 * decision boundary rather than pretending to be the satellite's exact range.
 */
export function ntpuElevationGeometry(
  positionsWorld: readonly number[],
  visibility: ArrayLike<number>,
  preferredElevationDeg = 30,
  diagramElevationDeg?: number,
): NtpuElevationGeometry | null {
  const centerWorld = [...act1NtpuApexWorld()] as GlobalConstellationWorldPoint;
  const zenithWorld = normalize([...act1NtpuZenithWorld()] as GlobalConstellationWorldPoint);
  let selected: {
    readonly satelliteIndex: number;
    readonly satelliteWorld: GlobalConstellationWorldPoint;
    readonly lineOfSightUnit: GlobalConstellationWorldPoint;
    readonly elevationRad: number;
    readonly score: number;
  } | null = null;

  for (let satelliteIndex = 0; satelliteIndex < visibility.length; satelliteIndex += 1) {
    if (visibility[satelliteIndex] !== 1) continue;
    const offset = satelliteIndex * 3;
    const satelliteWorld = [
      positionsWorld[offset],
      positionsWorld[offset + 1],
      positionsWorld[offset + 2],
    ] as GlobalConstellationWorldPoint;
    if (!satelliteWorld.every(Number.isFinite)) continue;
    const lineOfSight = subtract(satelliteWorld, centerWorld);
    const lineOfSightLength = Math.hypot(...lineOfSight);
    if (lineOfSightLength <= 0) continue;
    const lineOfSightUnit = scale(lineOfSight, 1 / lineOfSightLength);
    const elevationRad = Math.asin(Math.max(-1, Math.min(1, dot(lineOfSightUnit, zenithWorld))));
    if (elevationRad < 0) continue;
    const score = Math.abs((elevationRad * 180) / Math.PI - preferredElevationDeg);
    if (selected === null || score < selected.score) {
      selected = { satelliteIndex, satelliteWorld, lineOfSightUnit, elevationRad, score };
    }
  }

  if (selected === null) return null;
  const verticalComponent = scale(zenithWorld, dot(selected.lineOfSightUnit, zenithWorld));
  const horizonDirectionWorld = normalize(subtract(selected.lineOfSightUnit, verticalComponent));
  const constructionElevationRad = diagramElevationDeg === undefined
    ? selected.elevationRad
    : Math.max(-90, Math.min(90, diagramElevationDeg)) * Math.PI / 180;
  const constructionDirectionWorld = normalize(add(
    scale(horizonDirectionWorld, Math.cos(constructionElevationRad)),
    scale(zenithWorld, Math.sin(constructionElevationRad)),
  ));
  const horizonSegmentWorld = [
    add(centerWorld, scale(horizonDirectionWorld, -1.18)),
    add(centerWorld, scale(horizonDirectionWorld, 1.52)),
  ] as const;
  const zenithSegmentWorld = [centerWorld, add(centerWorld, scale(zenithWorld, 1.42))] as const;
  const arcRadius = 0.62;
  const angleArcWorld = Array.from({ length: 25 }, (_, index) => {
    const angle = constructionElevationRad * (index / 24);
    return add(centerWorld, add(
      scale(horizonDirectionWorld, Math.cos(angle) * arcRadius),
      scale(zenithWorld, Math.sin(angle) * arcRadius),
    ));
  });
  const labelAngle = constructionElevationRad / 2;
  const angleLabelWorld = add(centerWorld, add(
    scale(horizonDirectionWorld, Math.cos(labelAngle) * 0.92),
    scale(zenithWorld, Math.sin(labelAngle) * 0.92),
  ));

  return {
    satelliteIndex: selected.satelliteIndex,
    satelliteWorld: selected.satelliteWorld,
    lineOfSightDirectionWorld: constructionDirectionWorld,
    centerWorld,
    zenithWorld,
    horizonDirectionWorld,
    elevationDeg: (constructionElevationRad * 180) / Math.PI,
    referenceSatelliteElevationDeg: (selected.elevationRad * 180) / Math.PI,
    horizonSegmentWorld,
    zenithSegmentWorld,
    angleArcWorld,
    angleLabelWorld,
  };
}

function reticlePoint(
  center: GlobalConstellationWorldPoint,
  tangent: GlobalConstellationWorldPoint,
  bitangent: GlobalConstellationWorldPoint,
  radius: number,
  angle: number,
): GlobalConstellationWorldPoint {
  return [
    center[0] + (tangent[0] * Math.cos(angle) + bitangent[0] * Math.sin(angle)) * radius,
    center[1] + (tangent[1] * Math.cos(angle) + bitangent[1] * Math.sin(angle)) * radius,
    center[2] + (tangent[2] * Math.cos(angle) + bitangent[2] * Math.sin(angle)) * radius,
  ];
}

export interface NtpuSurfaceReticleGeometry {
  readonly centerWorld: GlobalConstellationWorldPoint;
  readonly radiusWorld: number;
  readonly segmentsWorld: readonly (readonly GlobalConstellationWorldPoint[])[];
}

/**
 * Four short surface-tangent brackets are a local reading aid, not an orbit,
 * link, angle, or selected-satellite result.  There is deliberately no axis
 * or target endpoint in this geometry contract.
 */
export function ntpuSurfaceReticleGeometry(): NtpuSurfaceReticleGeometry {
  const centerWorld = [...act1NtpuApexWorld()] as GlobalConstellationWorldPoint;
  const zenith = normalize([...act1NtpuZenithWorld()] as GlobalConstellationWorldPoint);
  const tangent = normalize(cross([0, 1, 0], zenith));
  const bitangent = normalize(cross(zenith, tangent));
  const radiusWorld = 0.11;
  const segmentsWorld = Array.from({ length: 4 }, (_, segmentIndex) => {
    const start = segmentIndex * (Math.PI / 2) + 0.18;
    const end = (segmentIndex + 1) * (Math.PI / 2) - 0.18;
    return Array.from({ length: 5 }, (_, pointIndex) => reticlePoint(
      centerWorld,
      tangent,
      bitangent,
      radiusWorld,
      start + (end - start) * (pointIndex / 4),
    ));
  });
  return { centerWorld, radiusWorld, segmentsWorld };
}
