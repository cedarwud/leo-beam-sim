/**
 * coordToWorld — pure helper to project an artifact-side coordinate triple
 * into scene-world space.
 *
 * Rationale (SDD §3 Q7 C5 / §4 D10 / OQ-2 closure):
 *   The frozen `visual-showcase-v1` contract supports two coordinate frames:
 *     1) `'ecef-km'`               — standard ECEF in km.
 *     2) `'eci-km-no-earth-rotation-proxy'` — ECI coords stored in the
 *        `positionEcefKm` field as a proxy. **By design, no Earth-rotation
 *        compensation is applied.** Re-applying rotation would invent
 *        geometry truth (R1 violation): the producer chose this proxy
 *        explicitly to avoid embedding a particular epoch's rotation matrix.
 *
 *   Any other coordinate kind is rejected at load time.
 *
 * Render-axis convention:
 *   leo-beam-sim's scene uses a Three.js right-handed Y-up basis. For the
 *   coarse "static frame" P1a+b deliverable we project both ECEF-km and the
 *   ECI proxy into world space using the identity mapping `(x, y, z) →
 *   (x, y, z)`. P3 (playback) will revisit the camera/world mapping; doing
 *   anything more here would couple the adapter to render-frame conventions
 *   prematurely. The key invariant — no Earth-rotation compensation for the
 *   ECI proxy — is the load-bearing guarantee, and the identity mapping
 *   trivially satisfies it.
 *
 * Constraints:
 *   - No imports from `core/channel`, `core/beam`, `HandoverManager`,
 *     `computeLinkBudget`, `buildLinkContext`, `runtimeFrameStep`.
 *   - No three.js imports (so the function stays JSON-serialisable for D6).
 *   - No call to anything that could re-derive truth.
 *
 * TODO P2: harmonise world-axis mapping with the live adapter. Live still
 * exposes `VisibleSat.world` (THREE.Vector3 derived by `runtimeFrameStep`
 * from the orbit propagator + camera convention), which liveSimToScene
 * forwards as `worldPos = [world.x, world.y, world.z]`. Replay uses
 * `coordToWorld(positionEcefKm, kind)` directly. Both render via
 * `NormalizedSceneFrame.satellites[].worldPos` now, but the axis convention
 * has not been unified — a P2 axis-mapping pass is needed before multi-UE
 * replay rendering ships.
 */

import type { VisualShowcaseCoordinateFrameKind } from '../scene/visual-showcase-contract';

/** World-space coordinate triple in scene-units (km). */
export type WorldCoord = [number, number, number];

/**
 * Project a producer-side coordinate triple into world space.
 *
 * @param positionEcefKm   the raw triple from the artifact (either ECEF-km
 *                         or, for the ECI proxy, ECI-km stored in this slot).
 * @param coordinateFrameKind  the producer-declared frame kind.
 * @returns world-space `(x, y, z)` triple in km.
 * @throws if `coordinateFrameKind` is not one of the supported frames.
 */
export function coordToWorld(
  positionEcefKm: readonly [number, number, number],
  coordinateFrameKind: VisualShowcaseCoordinateFrameKind,
): WorldCoord {
  switch (coordinateFrameKind) {
    case 'eci-km-no-earth-rotation-proxy': {
      // R1 binding: NO Earth-rotation compensation. Identity mapping.
      // The artifact is the proxy by design (OQ-2 / D10).
      return [positionEcefKm[0], positionEcefKm[1], positionEcefKm[2]];
    }
    case 'ecef-km': {
      // Standard ECEF in km. For P1a+b we project with the identity mapping;
      // P3 will revisit the world-axis convention (see file-level comment).
      return [positionEcefKm[0], positionEcefKm[1], positionEcefKm[2]];
    }
    default: {
      // Exhaustiveness check — any new contract value will surface here as a
      // type error at compile time.
      const _exhaustive: never = coordinateFrameKind;
      throw new Error(
        `[coordToWorld] unsupported coordinateFrameKind: ${String(_exhaustive)}. ` +
          `Only 'ecef-km' and 'eci-km-no-earth-rotation-proxy' are supported.`,
      );
    }
  }
}
