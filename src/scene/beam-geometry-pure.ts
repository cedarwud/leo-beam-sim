/**
 * Pure beam-geometry math, R1-safe.
 *
 * This module contains ONLY the altitude/beamwidth → footprint/spacing
 * formula used by both `SceneGeometry` (live + replay) and `beam-layout.ts`
 * (live). It carries no dependency on `core/channel`, `core/beam`,
 * `HandoverManager`, `computeLinkBudget`, `buildLinkContext`, or
 * `runtimeFrameStep`.
 *
 * Why a separate file:
 *   `src/scene/beam-layout.ts` top-level-imports `../core/beam/layout`
 *   for `generateHexagonalBeamLayout` (live-only). ESM eagerly evaluates
 *   that import on any load of `beam-layout.ts`, which means a replay-side
 *   consumer pulling `computeBeamGeometry` from `beam-layout.ts` would
 *   transitively evaluate `core/beam/layout` — violating R1 (the P1e b2
 *   runtime side-effect probe fails on this exact transitive evaluation).
 *
 *   Extracting `computeBeamGeometry` here gives the replay path a clean
 *   shortest-path import that never touches the live engine.
 *
 * SDD anchors: §4 D4, §9 P1 exit criterion (b) negative-path enforcement.
 */

interface EcefKm {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface BeamGeometry {
  /** Beam half-power footprint radius on the ground, km. */
  footprintRadiusKm: number;
  /** Hexagonal beam-center spacing on the ground, km. */
  spacingKm: number;
}

/**
 * Display constants. Carried here (instead of in `beam-layout.ts`) so
 * replay-side consumers can read them without triggering the eager ESM
 * evaluation of `beam-layout.ts`'s top-level `import { … } from
 * '../core/beam/layout'` — the same leak chain that motivated extracting
 * `computeBeamGeometry`.
 *
 * `FOOTPRINT_RADIUS_WORLD`: world-space pixel/unit radius the renderer
 * assigns to the primary beam footprint. Together with the resolved
 * shell's `footprintRadiusKm`, it yields the km → world-units scale used
 * for UE / satellite ground projection.
 *
 * `MAX_BEAMS_PER_SATELLITE`: upper bound the renderer enforces on
 * per-satellite beam counts (paper convention).
 */
export const FOOTPRINT_RADIUS_WORLD = 56;
export const MAX_BEAMS_PER_SATELLITE = 7;
export const FOOTPRINT_LONG_AXIS_MAX_MULT = 10;

const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Convert shell altitude + 3 dB beamwidth (rad) → ground footprint geometry.
 * Pure trigonometry; no SINR, no handover, no channel side-effects.
 */
export function computeBeamGeometry(
  altitudeKm: number,
  beamwidth3dBRad: number,
): BeamGeometry {
  const halfBeamRad = beamwidth3dBRad / 2;
  // Paper beam footprint formula per modqn-training-truth-visualization-sdd
  // §5: radius_km = altitude_km * tan(theta3dB / 2). For the paper-faithful
  // profile (780 km, theta3dB = 2 deg) this yields ~13.6 km / ~581 km^2.
  const footprintRadiusKm = altitudeKm * Math.tan(halfBeamRad);
  const spacingKm = footprintRadiusKm * Math.sqrt(3);
  return { footprintRadiusKm, spacingKm };
}

/**
 * SDD §4.3: slant range satellite → cell center, spherical Earth
 * (R_E = 6371 km). This is geometry-only; Phase I does not change backend SNR.
 */
export function slantRangeKm(
  satLatDeg: number,
  satLonDeg: number,
  satAltitudeKm: number,
  cellLatDeg: number,
  cellLonDeg: number,
): number {
  assertFinite(satLatDeg, 'satLatDeg');
  assertFinite(satLonDeg, 'satLonDeg');
  assertPositiveFinite(satAltitudeKm, 'satAltitudeKm');
  assertFinite(cellLatDeg, 'cellLatDeg');
  assertFinite(cellLonDeg, 'cellLonDeg');

  const satellite = geodeticToEcefKm(satLatDeg, satLonDeg, satAltitudeKm);
  const cell = geodeticToEcefKm(cellLatDeg, cellLonDeg, 0);
  return vectorNorm(subtract(cell, satellite));
}

/**
 * SDD §4.3: off-axis angle between the cell-pointing beam boresight
 * (satellite → cell center) and satellite → user line-of-sight.
 */
export function offAxisAngleRad(
  satLatDeg: number,
  satLonDeg: number,
  satAltitudeKm: number,
  cellLatDeg: number,
  cellLonDeg: number,
  userLatDeg: number,
  userLonDeg: number,
): number {
  assertFinite(satLatDeg, 'satLatDeg');
  assertFinite(satLonDeg, 'satLonDeg');
  assertPositiveFinite(satAltitudeKm, 'satAltitudeKm');
  assertFinite(cellLatDeg, 'cellLatDeg');
  assertFinite(cellLonDeg, 'cellLonDeg');
  assertFinite(userLatDeg, 'userLatDeg');
  assertFinite(userLonDeg, 'userLonDeg');

  const satellite = geodeticToEcefKm(satLatDeg, satLonDeg, satAltitudeKm);
  const cell = geodeticToEcefKm(cellLatDeg, cellLonDeg, 0);
  const user = geodeticToEcefKm(userLatDeg, userLonDeg, 0);
  const boresight = subtract(cell, satellite);
  const userLineOfSight = subtract(user, satellite);
  const denominator = vectorNorm(boresight) * vectorNorm(userLineOfSight);

  if (denominator <= 0) {
    throw new Error('offAxisAngleRad requires non-degenerate satellite, cell, and user geometry');
  }

  return Math.acos(clamp(dot(boresight, userLineOfSight) / denominator, -1, 1));
}

function geodeticToEcefKm(latDeg: number, lonDeg: number, altitudeKm: number): EcefKm {
  const radiusKm = EARTH_RADIUS_KM + altitudeKm;
  const latRad = latDeg * DEG_TO_RAD;
  const lonRad = lonDeg * DEG_TO_RAD;
  const cosLat = Math.cos(latRad);

  return {
    x: radiusKm * cosLat * Math.cos(lonRad),
    y: radiusKm * cosLat * Math.sin(lonRad),
    z: radiusKm * Math.sin(latRad),
  };
}

function subtract(a: EcefKm, b: EcefKm): EcefKm {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
    z: a.z - b.z,
  };
}

function dot(a: EcefKm, b: EcefKm): number {
  return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}

function vectorNorm(vector: EcefKm): number {
  return Math.sqrt(dot(vector, vector));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite; got ${value}`);
  }
}

function assertPositiveFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be positive; got ${value}`);
  }
}
