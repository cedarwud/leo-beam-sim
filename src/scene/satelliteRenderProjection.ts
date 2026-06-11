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
 *  - `'replay-worldpos'` / absent — replay/artifact `coordToWorld(positionEcefKm)`
 *    (ecef-km, magnitude ~6878) normalised onto the dome shell at the visual
 *    altitude. Held byte-identical to the legacy path (incl. the residual
 *    magnitude check) until the replay typed fold lands in S1b with a replay
 *    golden trace.
 *
 * Output is value-identical to the prior inline `useBeamViz` block, so the
 * live geometry-trace golden diffs clean (no re-baseline).
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
  const mag = rawPos.length();
  return mag > 1000
    ? rawPos.normalize().multiplyScalar(visualSatelliteAltitude)
    : rawPos.multiplyScalar(satPosScaleFactor);
}
