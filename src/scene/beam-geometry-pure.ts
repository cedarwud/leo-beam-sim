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

export interface BeamGeometry {
  /** Beam half-power footprint radius on the ground, km. */
  footprintRadiusKm: number;
  /** Hexagonal beam-center spacing on the ground, km. */
  spacingKm: number;
}

/**
 * Convert shell altitude + 3 dB beamwidth (rad) → ground footprint geometry.
 * Pure trigonometry; no SINR, no handover, no channel side-effects.
 */
export function computeBeamGeometry(
  altitudeKm: number,
  beamwidth3dBRad: number,
): BeamGeometry {
  const halfBeamRad = beamwidth3dBRad / 2;
  const footprintRadiusKm = altitudeKm * Math.tan(halfBeamRad);
  const spacingKm = footprintRadiusKm * Math.sqrt(3);
  return { footprintRadiusKm, spacingKm };
}
