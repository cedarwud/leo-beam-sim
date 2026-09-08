/**
 * artifactSatelliteAzimuths — pure derivation for the FIX-5 Option C honest
 * satellite-direction HUD compass.
 *
 * Render-truth context (docs/showcase-render-truth-fix-backlog.md FIX-5):
 *   The artifact-replay lane consumes the producer's
 *   `eci-km-no-earth-rotation-proxy` satellite geometry. That proxy places the
 *   satellites on a FLAT ring on the ground plane: every `worldPos[1]` (Y) is 0,
 *   the ring radius (~7151 world units) is the REAL LEO orbital radius
 *   (Earth radius 6371 + ~780 km), and the azimuth (compass bearing on the
 *   ground plane) is REAL — only the inclination / elevation dimension was
 *   discarded by the proxy. `MainScene` renders the markers at that 7151-unit
 *   ring with no display scale, so they sit far off-frame laterally and the user
 *   sees "no satellites".
 *
 *   This helper recovers ONLY the truthful azimuth + ring radius from the
 *   already-projected world position. It NEVER synthesises the missing elevation
 *   (that would fabricate geometry the source never owned — the §3 / governance
 *   Rule#6 violation this whole campaign protects against). Option A (a producer
 *   Earth-fixed projection) is blocked by a principled producer source-gap (no
 *   `earthRotationModel`); Option B (leo placing the satellites overhead) would
 *   invent the Y dimension. So Option C surfaces the honest azimuth direction in
 *   a 2D DOM HUD instead.
 *
 * Display-only: reads the post-`coordToWorld` `worldPos` projection; it does not
 * read or alter SINR, handover, reward, or geometry truth. The exported
 * pure function is unit-tested without a React renderer
 * (`artifactSatelliteAzimuths.test.ts`).
 */

import type { NormalizedSatellite } from '../scene/NormalizedSceneFrame';

/** A satellite reduced to its truthful ground-plane bearing + ring radius. */
export interface SatelliteAzimuthMarker {
  readonly id: string;
  /**
   * Compass bearing on the ground plane, `atan2(x, z)` normalised to [0, 360).
   * Bearing 0 = +Z, 90 = +X, 180 = −Z, 270 = −X. This is the REAL azimuth the
   * producer proxy preserved.
   */
  readonly azimuthDeg: number;
  /** Ring radius in world units, `hypot(x, z)` (~7151 = real LEO orbital radius). */
  readonly radiusWorld: number;
}

export interface SatelliteAzimuthDerivation {
  /** One marker per visible satellite with a finite, non-degenerate position. */
  readonly markers: readonly SatelliteAzimuthMarker[];
  /**
   * True only if at least one satellite carries a non-zero elevation (|Y| above
   * the tolerance). The `eci-km-no-earth-rotation-proxy` always flattens Y to 0,
   * so this is false for the current producer artifact — the HUD uses it to keep
   * the "azimuth only, no elevation" honesty claim DATA-DRIVEN rather than a
   * hardcoded assumption (if a future artifact ships real elevation this flips).
   */
  readonly hasElevationData: boolean;
  /**
   * True ONLY when every surfaced satellite is the flattened ECI proxy
   * (`coordFrameKind === 'eci-km-no-earth-rotation-proxy'`) AND no real elevation
   * is present. The azimuth-only / "no elevation" honesty caption is truthful
   * ONLY in this case, so the HUD renders only when this holds. A standard
   * `ecef-km` artifact (real overhead geometry the 3D scene draws correctly), a
   * mixed/unknown frame, or a frame that somehow carries elevation must NOT get
   * the proxy caption — that would overclaim a limitation in the opposite
   * direction (codex FIX-5 P2). False for an empty derivation.
   */
  readonly isFlatEciProxy: boolean;
}

/** The producer frame this HUD is a recovery surface for (flattened, Y=0). */
const FLAT_ECI_PROXY_FRAME = 'eci-km-no-earth-rotation-proxy';
/** Positions below this world-space magnitude are treated as degenerate. */
const RADIUS_EPS = 1e-6;
/** |Y| above this counts as real elevation (the flat proxy keeps Y exactly 0). */
const ELEVATION_EPS = 1e-3;

function normalizeDeg(deg: number): number {
  const wrapped = deg % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Reduce normalized satellites to truthful azimuth markers. Filters to `visible`
 * satellites with a finite, non-degenerate `(x, z)` projection. Never invents
 * elevation; reports whether any real elevation was present so the caller can
 * keep the honesty label accurate.
 */
export function deriveSatelliteAzimuths(
  satellites: readonly NormalizedSatellite[],
): SatelliteAzimuthDerivation {
  const markers: SatelliteAzimuthMarker[] = [];
  let hasElevationData = false;
  let allFlatProxyFrame = true;

  for (const sat of satellites) {
    if (!sat.visible) continue;
    const [x, y, z] = sat.worldPos;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    const radiusWorld = Math.hypot(x, z);
    if (radiusWorld < RADIUS_EPS) continue; // degenerate: bearing undefined at the origin
    if (Math.abs(y) > ELEVATION_EPS) hasElevationData = true;
    if (sat.coordFrameKind !== FLAT_ECI_PROXY_FRAME) allFlatProxyFrame = false;
    markers.push({
      id: sat.id,
      azimuthDeg: normalizeDeg((Math.atan2(x, z) * 180) / Math.PI),
      radiusWorld,
    });
  }

  const isFlatEciProxy = markers.length > 0 && allFlatProxyFrame && !hasElevationData;
  return { markers, hasElevationData, isFlatEciProxy };
}
