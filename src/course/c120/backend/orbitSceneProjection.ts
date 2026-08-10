import type { C120SceneState } from '../contract';
import type { C120OrbitLookPoint } from './orbitPropagation';

/**
 * Display-only coordinate convention for the C-120 NTPU visual leaf.
 *
 * The producer's look angles are topocentric ENU angles: azimuth is measured
 * clockwise from north, elevation is above the local horizon, and range is
 * slant range in kilometres.  The Three.js scene uses `[east, up, -north]`
 * world axes, so north is the camera-facing negative-Z direction and up is
 * positive-Y.  The observer is the origin.  `beamPosition` is a horizontal
 * ground-footprint proxy at the same azimuth (not an additional measurement),
 * while `satellitePosition` is the bounded visual slant vector.
 *
 * This adapter does not propagate an orbit, calculate a measurement, or feed
 * an energy/link-budget model.  It only makes validated look-angle samples
 * usable by C120SceneState geometry.
 */
export const C120_NTPU_VISUAL_CONVENTION =
  'topocentric ENU (azimuth clockwise from north) -> Three.js [east, up, -north]; observer at origin; beam is a horizontal ground-footprint proxy; range uses bounded display scaling' as const;

/** Default classroom visibility mask, matching the C120 pass/search default. */
export const C120_DEFAULT_MINIMUM_ELEVATION_DEG = 10;

/** Browser-bound visual traces stay small even if an upstream search is broad. */
export const C120_MAX_VISUAL_TRAJECTORY_POINTS = 1_024;

/**
 * Deliberately broad upper bound for a LEO topocentric slant range.  It keeps
 * the adapter fail-closed for malformed/unbounded values while covering the
 * several-thousand-kilometre ranges that can occur near a LEO horizon.
 */
export const C120_MAX_SCENE_RANGE_KM = 50_000;

/** Maximum visual radius in world units; raw kilometres never become units. */
export const C120_MAX_VISUAL_RANGE_WU = 240;

/** Softening scale for the bounded monotonic display-radius mapping. */
export const C120_RANGE_SOFTENING_KM = 1_800;

export interface C120OrbitSceneProjectionOptions {
  /** Samples at or above this elevation are marked visible. */
  readonly minimumElevationDeg?: number;
}

/** A preserved look-angle sample plus its C120SceneState geometry. */
export interface C120OrbitSceneFrame extends C120OrbitLookPoint {
  readonly scene: C120SceneState;
}

/**
 * Immutable visual trajectory for one ordered NTPU pass.
 *
 * Every `point` remains in producer order and retains its original UTC,
 * azimuth, elevation, and range values exactly.  `scene` is derived solely
 * from those values and the declared visibility mask.
 */
export interface C120NTPUVisualTrajectory {
  readonly convention: typeof C120_NTPU_VISUAL_CONVENTION;
  readonly minimumElevationDeg: number;
  readonly points: readonly C120OrbitSceneFrame[];
}

type MutableSceneTuple = [number, number, number];
type PlainRecord = Record<string, unknown>;

function fail(message: string): never {
  throw new TypeError(`C120 orbit scene projection rejected input: ${message}`);
}

function isPlainRecord(value: unknown): value is PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fail(`${label} must be finite numeric data`);
  }
  return value;
}

function parseUtc(value: unknown, label: string): number {
  if (typeof value !== 'string' || value.trim() === '' || !value.endsWith('Z')) {
    return fail(`${label} must be a non-empty UTC timestamp ending in Z`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return fail(`${label} must be parseable UTC`);
  return parsed;
}

function validateLookPoint(value: unknown, index: number): C120OrbitLookPoint & { readonly atMs: number } {
  const label = `points[${index}]`;
  if (!isPlainRecord(value)) return fail(`${label} must be a plain object`);
  const expectedKeys = ['utc', 'azimuthDeg', 'elevationDeg', 'rangeKm'];
  const actualKeys = Object.keys(value).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify([...expectedKeys].sort())) {
    return fail(`${label} must contain exactly utc, azimuthDeg, elevationDeg, and rangeKm`);
  }

  const utc = value.utc;
  const atMs = parseUtc(utc, `${label}.utc`);
  const azimuthDeg = finiteNumber(value.azimuthDeg, `${label}.azimuthDeg`);
  const elevationDeg = finiteNumber(value.elevationDeg, `${label}.elevationDeg`);
  const rangeKm = finiteNumber(value.rangeKm, `${label}.rangeKm`);
  if (azimuthDeg < 0 || azimuthDeg >= 360) {
    return fail(`${label}.azimuthDeg must be in [0, 360)`);
  }
  if (elevationDeg < -90 || elevationDeg > 90) {
    return fail(`${label}.elevationDeg must be in [-90, 90]`);
  }
  if (rangeKm <= 0 || rangeKm > C120_MAX_SCENE_RANGE_KM) {
    return fail(`${label}.rangeKm must be in (0, ${C120_MAX_SCENE_RANGE_KM}] km`);
  }

  return { utc: utc as string, azimuthDeg, elevationDeg, rangeKm, atMs };
}

function validateOptions(options: C120OrbitSceneProjectionOptions): number {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    return fail('options must be a plain object');
  }
  const prototype = Object.getPrototypeOf(options);
  if (prototype !== Object.prototype && prototype !== null) return fail('options must be a plain object');
  const minimumElevationDeg = options.minimumElevationDeg ?? C120_DEFAULT_MINIMUM_ELEVATION_DEG;
  finiteNumber(minimumElevationDeg, 'options.minimumElevationDeg');
  if (minimumElevationDeg < -90 || minimumElevationDeg > 90) {
    return fail('options.minimumElevationDeg must be in [-90, 90]');
  }
  return minimumElevationDeg;
}

/**
 * Map one positive slant range in kilometres to a bounded display radius.
 * The mapping is monotonic, finite, and asymptotically approaches the visual
 * cap; it intentionally has no physical-unit interpretation.
 */
function visualRadiusForRange(rangeKm: number): number {
  const radius = C120_MAX_VISUAL_RANGE_WU * rangeKm / (rangeKm + C120_RANGE_SOFTENING_KM);
  if (!Number.isFinite(radius) || radius < 0 || radius > C120_MAX_VISUAL_RANGE_WU) {
    return fail('derived visual range is non-finite or outside the display bound');
  }
  return radius;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  if (Array.isArray(value)) {
    value.forEach(child => deepFreeze(child));
  } else {
    Object.values(value as PlainRecord).forEach(child => deepFreeze(child));
  }
  return value;
}

function sceneForLookPoint(
  point: C120OrbitLookPoint,
  minimumElevationDeg: number,
): C120SceneState {
  const azimuthRad = point.azimuthDeg * Math.PI / 180;
  const elevationRad = point.elevationDeg * Math.PI / 180;
  const horizontalDirection = Math.cos(elevationRad);
  const east = Math.sin(azimuthRad) * horizontalDirection;
  const north = Math.cos(azimuthRad) * horizontalDirection;
  const up = Math.sin(elevationRad);
  const visualRange = visualRadiusForRange(point.rangeKm);
  const horizontalRadius = visualRange * horizontalDirection;

  // ENU -> Three.js world: east -> +X, up -> +Y, north -> -Z.
  const satellitePosition: MutableSceneTuple = [
    east * visualRange,
    up * visualRange,
    -north * visualRange,
  ];
  // A beam is a display-only ground footprint proxy, not a second look point.
  const beamPosition: MutableSceneTuple = [
    Math.sin(azimuthRad) * horizontalRadius,
    0,
    -Math.cos(azimuthRad) * horizontalRadius,
  ];
  const observerPosition: MutableSceneTuple = [0, 0, 0];
  const vectors = [satellitePosition, beamPosition, observerPosition];
  if (vectors.some(vector => vector.some(component => !Number.isFinite(component)))) {
    return fail('derived scene position is non-finite');
  }

  return {
    satellitePosition,
    beamPosition,
    observerPosition,
    visible: point.elevationDeg >= minimumElevationDeg,
    azimuthDeg: point.azimuthDeg,
    elevationDeg: point.elevationDeg,
    rangeKm: point.rangeKm,
  };
}

/**
 * Pure, deterministic, fail-closed projection of ordered orbit look points.
 * The input is copied; neither it nor any of its point objects is mutated or
 * frozen by this function.
 */
export function projectC120OrbitScene(
  points: readonly C120OrbitLookPoint[],
  options: C120OrbitSceneProjectionOptions = {},
): C120NTPUVisualTrajectory {
  if (!Array.isArray(points) || points.length === 0) return fail('points must be a non-empty array');
  if (points.length > C120_MAX_VISUAL_TRAJECTORY_POINTS) {
    return fail(`points must not exceed ${C120_MAX_VISUAL_TRAJECTORY_POINTS} samples`);
  }
  const minimumElevationDeg = validateOptions(options);
  const validated = points.map((value, index) => validateLookPoint(value, index));
  for (let index = 1; index < validated.length; index += 1) {
    const previous = validated[index - 1];
    const current = validated[index];
    if (current.atMs <= previous.atMs) {
      return fail(`points must be strictly ordered by increasing UTC; duplicate or out-of-order point at index ${index}`);
    }
  }

  const trajectory: C120NTPUVisualTrajectory = {
    convention: C120_NTPU_VISUAL_CONVENTION,
    minimumElevationDeg,
    points: validated.map(({ atMs: _atMs, ...point }) => ({
      ...point,
      scene: sceneForLookPoint(point, minimumElevationDeg),
    })),
  };
  return deepFreeze(trajectory);
}

/** Descriptive aliases for callers that name the target visual leaf. */
export const projectC120OrbitToNTPU = projectC120OrbitScene;
export const createC120NTPUVisualTrajectory = projectC120OrbitScene;
