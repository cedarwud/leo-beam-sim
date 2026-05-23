import type { VisualShowcaseArtifact } from '../scene/visual-showcase-contract';
import type { NormalizedSceneFrame, WorldPos } from '../scene/NormalizedSceneFrame';
import { showcaseArtifactToScene } from './showcaseArtifactToScene';

function lerp(a: number, b: number, alpha: number): number {
  return a * (1 - alpha) + b * alpha;
}

function lerpWorldPos(a: WorldPos, b: WorldPos, alpha: number): WorldPos {
  return [
    lerp(a[0], b[0], alpha),
    lerp(a[1], b[1], alpha),
    lerp(a[2], b[2], alpha),
  ];
}

/**
 * Projects a validated artifact into NormalizedSceneFrame and interpolates dynamic
 * entity coordinates (Satellites and UEs) strictly in world space between the two
 * enclosing timeline frames.
 *
 * SDD §9 P3 binding:
 *   Inter-frame position interpolation occurs in world space, after `coordToWorld`
 *   has projected the raw `positionEcefKm` triple into world space. We NEVER
 *   re-interpolate raw `positionEcefKm` and then re-project — re-applying the
 *   ECI-proxy assumption to a synthesised intermediate `positionEcefKm` would
 *   invent geometry truth between samples (R1 violation, SDD §10 OQ-2 closure
 *   for the `eci-km-no-earth-rotation-proxy` frame).
 *
 *   For UEs the world-space lerp is also strictly required because the
 *   `(latDeg, lonDeg) -> worldPos` projection is non-linear in geo coords
 *   (cos(refLat) East-North conversion); lerping in geo and re-projecting would
 *   give a different intermediate worldPos than lerping the projected worldPos
 *   pair. The validator at scripts/validate-modqn-visual-showcase-p3-
 *   interpolation-space.ts asserts this distinction.
 *
 * All non-positional state fields are preserved from the preceding discrete frame (f0)
 * to satisfy the "no truth recompute between samples" constraint (no role,
 * handover kind, SINR, or decision re-derivation occurs here).
 */
export function showcaseArtifactToSceneInterpolated(
  artifact: VisualShowcaseArtifact,
  tSec: number,
): NormalizedSceneFrame {
  const timesSec = artifact.timebase.timesSec ?? artifact.timeline.map((f) => f.tSec);
  const len = timesSec.length;

  if (len === 0) {
    throw new Error('[showcaseArtifactToSceneInterpolated] timeline is empty');
  }

  // Handle boundary cases — defence-in-depth: typescript would warn on
  // timesSec[0] being possibly undefined, but len === 0 was checked above so
  // index 0 and len - 1 are always defined.
  const t0Min = timesSec[0];
  const tMax = timesSec[len - 1];
  if (t0Min === undefined || tMax === undefined) {
    throw new Error('[showcaseArtifactToSceneInterpolated] timeline times malformed');
  }
  if (tSec <= t0Min) {
    return showcaseArtifactToScene(artifact, 0);
  }
  if (tSec >= tMax) {
    return showcaseArtifactToScene(artifact, len - 1);
  }

  // Find bounding frames i and i + 1
  let i = 0;
  for (let idx = 0; idx < len - 1; idx++) {
    const ta = timesSec[idx];
    const tb = timesSec[idx + 1];
    if (ta === undefined || tb === undefined) continue;
    if (ta <= tSec && tSec < tb) {
      i = idx;
      break;
    }
  }

  const t0 = timesSec[i];
  const t1 = timesSec[i + 1];
  if (t0 === undefined || t1 === undefined) {
    throw new Error(
      `[showcaseArtifactToSceneInterpolated] bracket index i=${i} out of range`,
    );
  }
  const span = t1 - t0;
  const alpha = span > 0 ? (tSec - t0) / span : 0;

  const f0 = showcaseArtifactToScene(artifact, i);
  const f1 = showcaseArtifactToScene(artifact, i + 1);

  const interpolated: NormalizedSceneFrame = {
    ...f0,
    tSec,
    satellites: f0.satellites.map((sat0) => {
      const sat1 = f1.satellites.find((s) => s.id === sat0.id);
      if (!sat1) return sat0;
      // NormalizedSatellite.{latDeg, lonDeg, altitudeKm} are optional —
      // the live adapter populates them, the replay adapter usually does too,
      // but defensively guard each axis so that a partially-populated upstream
      // frame falls through to the f0 value instead of crashing.
      const latDeg =
        sat0.latDeg !== undefined && sat1.latDeg !== undefined
          ? lerp(sat0.latDeg, sat1.latDeg, alpha)
          : sat0.latDeg;
      const lonDeg =
        sat0.lonDeg !== undefined && sat1.lonDeg !== undefined
          ? lerp(sat0.lonDeg, sat1.lonDeg, alpha)
          : sat0.lonDeg;
      const altitudeKm =
        sat0.altitudeKm !== undefined && sat1.altitudeKm !== undefined
          ? lerp(sat0.altitudeKm, sat1.altitudeKm, alpha)
          : sat0.altitudeKm;
      return {
        ...sat0,
        worldPos: lerpWorldPos(sat0.worldPos, sat1.worldPos, alpha),
        latDeg,
        lonDeg,
        altitudeKm,
      };
    }),
    ues: f0.ues.map((ue0) => {
      const ue1 = f1.ues.find((u) => u.id === ue0.id);
      if (!ue1) return ue0;
      // NormalizedUe.worldPos is optional in the contract; the replay adapter
      // populates it via projectUeWorldPos but guard defensively. Without both
      // ends we leave worldPos unchanged (no lerp).
      const worldPos =
        ue0.worldPos !== undefined && ue1.worldPos !== undefined
          ? lerpWorldPos(ue0.worldPos, ue1.worldPos, alpha)
          : ue0.worldPos;
      const altKm =
        ue0.geo.altKm !== undefined && ue1.geo.altKm !== undefined
          ? lerp(ue0.geo.altKm, ue1.geo.altKm, alpha)
          : ue0.geo.altKm;
      return {
        ...ue0,
        worldPos,
        geo: {
          latDeg: lerp(ue0.geo.latDeg, ue1.geo.latDeg, alpha),
          lonDeg: lerp(ue0.geo.lonDeg, ue1.geo.lonDeg, alpha),
          altKm,
        },
      };
    }),
  };

  return interpolated;
}
