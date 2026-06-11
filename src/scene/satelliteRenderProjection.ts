import * as THREE from 'three';
import type { SatelliteWorldFrameKind } from './NormalizedSceneFrame';

/**
 * S1 coordinate authority — the single satellite render-world projection.
 *
 * Selects the projection by the adapter-declared `worldFrame` TYPE, replacing
 * the former `mag > 1000` heuristic in `useBeamViz` that guessed the coordinate
 * frame from the value's magnitude (a band-aid for the live adapter tagging its
 * dome-world coordinates as `'ecef-km'`).
 *
 *  - `'live-enu'` — live sky-dome az/el world-units; scaled up to the visual
 *    altitude via `satPosScaleFactor` (= `visualSatelliteAltitude /
 *    SKY_DOME_V_RADIUS`). Magnitude is IGNORED: a live coordinate is scaled the
 *    same way regardless of its length.
 *  - `'replay-worldpos'` — replay/artifact `coordToWorld(positionEcefKm)`
 *    (ecef-km, magnitude ~6878) normalised onto the dome shell at the visual
 *    altitude. Magnitude is IGNORED here too (S1b typed fold): a replay
 *    coordinate normalises regardless of its length, where the legacy
 *    magnitude guess below would have scaled a ≤ 1000 coordinate instead. The
 *    fold is held byte-identical for the real replay artifacts (every replay
 *    sat is genuinely ecef-magnitude ≫ 1000) and guarded by the replay golden
 *    trace (`validate:s1b:replay-geometry-trace`, Verdict 3).
 *  - absent — legacy/untagged: guess the frame from the coordinate magnitude.
 *    Retained only for satellites no adapter has tagged yet; both tagged
 *    branches above retire the guess for their lane.
 *
 * Output is value-identical to the prior inline `useBeamViz` block for both the
 * live and replay lanes, so the live geometry-trace golden and the replay
 * golden trace both diff clean (no re-baseline).
 */
export function projectSatelliteRenderWorld(
  worldPos: readonly [number, number, number],
  worldFrame: SatelliteWorldFrameKind | undefined,
  visualSatelliteAltitude: number,
  satPosScaleFactor: number,
): THREE.Vector3 {
  const rawPos = new THREE.Vector3(worldPos[0], worldPos[1], worldPos[2]);
  if (worldFrame === 'live-enu') {
    return rawPos.multiplyScalar(satPosScaleFactor);
  }
  if (worldFrame === 'replay-worldpos') {
    return rawPos.normalize().multiplyScalar(visualSatelliteAltitude);
  }
  // Legacy/untagged: guess the frame from the coordinate magnitude.
  const mag = rawPos.length();
  return mag > 1000
    ? rawPos.normalize().multiplyScalar(visualSatelliteAltitude)
    : rawPos.multiplyScalar(satPosScaleFactor);
}
