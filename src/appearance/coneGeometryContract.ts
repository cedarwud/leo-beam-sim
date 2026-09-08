/**
 * THE cone geometry contract.
 *
 * ## Why this module exists
 *
 * Before this module, cone GEOMETRY suffered the same affliction colour once had:
 * changing 「改波束錐體的寬度、長度與底面橢圓/地面投影幾何」 required opening SIX
 * separate files across `constants/`, `scene/`, `viz/`, and `prototype/`:
 *
 *   - `constants/sinrLiveConeStyle.ts` owned the ground lift constant (preventing z-fighting)
 *   - `scene/multiCandidateSceneDisplayPolicy.ts` owned the multi-candidate width multiplier
 *   - `scene/sinrLiveBeamGeometry.ts` owned the footprint ellipse trigonometry and tilt clamps
 *   - `scene/servingConeGeometry.ts` assembled raw serving cone items from the simulation frame
 *   - `viz/SinrLiveCellBeamCones.tsx` owned the 3D oblique mesh position generator and ground base center placement
 *   - `prototype/visual-lab-g0/VisualLabScene.tsx` inlined its own radius ratios and scale factors in local ternaries
 *
 * When an owner asked to adjust cone width, length, or ground footprint geometry,
 * changes had to be scattered across multiple layers. Call sites substituted their
 * own numbers and branched locally.
 *
 * Following the convergence of the COLOUR axis (`src/appearance/beamAppearanceContract.ts`)
 * and the VISIBILITY axis (`src/appearance/beamVisibilityContract.ts`), this module
 * establishes ONE owning authority for the geometry question:
 *
 *   > "What are the 3D dimensions, ground intersection ellipse, vertex positions,
 *   >  and scale factors for this beam cone?"
 *
 * Downstream components delegate to this contract rather than re-deriving geometry
 * or inlining magic numbers.
 *
 * ## The four axes
 *
 * `src/appearance/beamAppearanceContract.ts` establishes four axes:
 *   1. IDENTITY   — who this is.
 *   2. PROMINENCE — how loud, relative to current focus.
 *   3. SITUATION  — what event it is in.
 *   4. VIEWING    — physics of looking at it.
 *
 * Cone geometry governs the spatial manifestation of the VIEWING axis: the 3D apex-to-ground
 * cone frustum, the slant elevation, the ground ellipse distortion, elevation lift to avoid
 * coplanar z-fighting with the terrain, and display-only width scaling.
 *
 * ## Layering rule
 *
 * `src/appearance/` sits at the bottom, beside `src/constants/`. `scene/`, `viz/`,
 * `homepage/`, and `ui/` import DOWN into it; it imports nothing from them.
 * It imports down into `constants/` (`SINR_LIVE_CONE_SEGMENTS`).
 *
 * Pure by construction: no React, no hooks, no refs, and no module-level mutable state.
 * All decisions are deterministic functions of explicit inputs.
 */
import * as THREE from 'three';
import { SINR_LIVE_CONE_SEGMENTS } from '../constants/sinrLiveConeStyle';

/**
 * Tiny ground elevation lift (world units) so flat ground hexes and footprint
 * rings never z-fight the underlying terrain mesh.
 */
export const SINR_LIVE_FOOTPRINT_RING_Y_LIFT = 0.6;

/**
 * Display-only multiplier on cone width scale applied during multi-candidate
 * scene presentation.
 */
export const MULTI_CANDIDATE_BEAM_WIDTH_MULTIPLIER = 1;

/**
 * Minimum apparent elevation angle (deg) used to clamp the ground footprint
 * ellipse elongation for shallow beams.
 */
export const MIN_RENDER_ELEVATION_DEG = 15;

/**
 * Maximum display tilt angle (deg) allowed for rendered cone projection.
 */
export const MAX_RENDER_TILT_DEG = 45;

/**
 * Visual-Lab shared presentation radius ratios.
 *
 * The canonical beamwidth still controls the relative scale; these ratios
 * keep the default footprint broad enough to read against one full hexagonal
 * cell at the NTPU scale.
 */
export const VISUAL_LAB_SERVICE_PRIMARY_BEAM_RADIUS_RATIO = 0.82;
export const VISUAL_LAB_SERVICE_CONTEXT_BEAM_RADIUS_RATIO = 0.58;
export const VISUAL_LAB_CANDIDATE_PRIMARY_BEAM_RADIUS_RATIO = 0.78;
export const VISUAL_LAB_CANDIDATE_CONTEXT_BEAM_RADIUS_RATIO = 0.55;

/** Visual-Lab target expansion multiplier when intra-handover target is active. */
export const VISUAL_LAB_INTRA_TARGET_RADIUS_SCALE = 1.18;

/** Visual-Lab target pulse cone radius multiplier. */
export const VISUAL_LAB_PULSE_RADIUS_SCALE = 1.12;

/** Reference cell radius in Visual-Lab world units against which ratios are normalized. */
export const VISUAL_LAB_REFERENCE_CELL_RADIUS_WORLD = 0.8;

/** Structural 3D coordinate point. */
export interface SinrLiveBeamWorldPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * Geometry of the beam intersection with the ground plane.
 */
export interface SinrLiveBeamFootprintEllipse {
  readonly shortAxisWorld: number;
  readonly longAxisWorld: number;
  /** Direction of the long axis in the ground x/z plane. */
  readonly longAxisAzimuthRad: number;
  /** Physical apex-to-footprint elevation before presentation exaggeration. */
  readonly elevationDeg: number;
  /** Elevation used for displayed projection after optional tilt exaggeration. */
  readonly renderElevationDeg: number;
}

/** Select the display-only teaching tilt without changing physical geometry. */
export function resolveSinrLiveEllipseTiltExaggeration(sceneLane: string): number {
  return sceneLane === 'sinr-live' ? 3 : 1;
}

/**
 * Computes the ground intersection ellipse long/short axes, azimuth, and render elevation.
 *
 * Pure trigonometric projection: consumes apex, base center, and radius.
 * Never alters SINR, power, or signal physics.
 */
export function computeSinrLiveBeamFootprintEllipse(input: {
  readonly apex: SinrLiveBeamWorldPoint;
  readonly baseCenter: SinrLiveBeamWorldPoint;
  readonly radiusWorld: number;
  /**
   * Display-only tilt exaggeration for the teaching scene. `1` is the physical
   * projection; values above `1` make small tilt legible without changing the beam axis.
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

/**
 * Minimal structural cell placement interface required to resolve the base center.
 */
export interface BeamBasePlacement {
  readonly worldX: number;
  readonly worldZ: number;
  readonly worldUnitsPerKm?: number;
}

/**
 * Places the cone base center on the ground plane at (worldX, 0, worldZ).
 */
export function resolveBeamBaseCenter(placement: BeamBasePlacement): THREE.Vector3 {
  return new THREE.Vector3(
    placement.worldX,
    0,
    placement.worldZ,
  );
}

/**
 * Generates the packed 3D vertex position buffer (3 vertices x segments triangles)
 * for an oblique beam-cone side surface from apex to the ground intersection ellipse.
 */
export function buildObliqueBeamConePositions(
  apex: THREE.Vector3,
  baseCenter: THREE.Vector3,
  radius: number,
  segments: number = SINR_LIVE_CONE_SEGMENTS,
  ellipseTiltExaggeration = 1,
): Float32Array {
  const ellipse = computeSinrLiveBeamFootprintEllipse({
    apex,
    baseCenter,
    radiusWorld: radius,
    tiltExaggeration: ellipseTiltExaggeration,
  });
  const out = new Float32Array(segments * 9);
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const pointOnEllipse = (angle: number): { x: number; z: number } => {
      const localLong = Math.cos(angle) * ellipse.longAxisWorld;
      const localShort = Math.sin(angle) * ellipse.shortAxisWorld;
      return {
        x: localLong * Math.cos(ellipse.longAxisAzimuthRad)
          - localShort * Math.sin(ellipse.longAxisAzimuthRad),
        z: localLong * Math.sin(ellipse.longAxisAzimuthRad)
          + localShort * Math.cos(ellipse.longAxisAzimuthRad),
      };
    };
    const p0 = pointOnEllipse(a0);
    const p1 = pointOnEllipse(a1);
    const o = i * 9;
    out[o] = apex.x;
    out[o + 1] = apex.y;
    out[o + 2] = apex.z;
    out[o + 3] = baseCenter.x + p0.x;
    out[o + 4] = baseCenter.y;
    out[o + 5] = baseCenter.z + p0.z;
    out[o + 6] = baseCenter.x + p1.x;
    out[o + 7] = baseCenter.y;
    out[o + 8] = baseCenter.z + p1.z;
  }
  return out;
}

/**
 * Parameters for resolving a beam cone radius in the Visual-Lab prototype.
 */
export interface VisualLabBeamRadiusInput {
  readonly active: boolean;
  readonly intraTarget?: boolean;
  readonly role?: string;
  readonly cellRadiusWorld: number;
  readonly coneWidthScale?: number;
  readonly beamWidthDraftScale?: number;
}

/**
 * Resolves the displayed beam radius in Visual-Lab from role and scaling inputs.
 * Replaces scattered inline ternaries with a single deterministic rule.
 */
export function resolveVisualLabBeamRadius(input: VisualLabBeamRadiusInput): number {
  const {
    active,
    intraTarget = false,
    role,
    cellRadiusWorld,
    coneWidthScale = 1,
    beamWidthDraftScale = 1,
  } = input;
  const normalizedCellScale = cellRadiusWorld / VISUAL_LAB_REFERENCE_CELL_RADIUS_WORLD;

  if (role === 'candidatePrimary' && !active) {
    return VISUAL_LAB_CANDIDATE_PRIMARY_BEAM_RADIUS_RATIO * normalizedCellScale;
  }
  if (active || intraTarget) {
    const primaryRadius = VISUAL_LAB_SERVICE_PRIMARY_BEAM_RADIUS_RATIO
      * coneWidthScale
      * beamWidthDraftScale;
    const intraScale = intraTarget ? VISUAL_LAB_INTRA_TARGET_RADIUS_SCALE : 1;
    return primaryRadius * normalizedCellScale * intraScale;
  }
  return VISUAL_LAB_SERVICE_CONTEXT_BEAM_RADIUS_RATIO * normalizedCellScale;
}

/**
 * Calculates the apparent elevation angle (deg) between satellite apex and ground base center.
 */
export function computeApparentElevationDeg(
  apex: SinrLiveBeamWorldPoint,
  baseCenter: SinrLiveBeamWorldPoint,
): number {
  const horizontalDistance = Math.hypot(
    apex.x - baseCenter.x,
    apex.z - baseCenter.z,
  );
  return (Math.atan2(
    apex.y - baseCenter.y,
    Math.max(horizontalDistance, 1e-9),
  ) * 180) / Math.PI;
}
