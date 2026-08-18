import * as THREE from 'three';

export type VisualLabBeamPoint = readonly [number, number, number];

export interface VisualLabBeamConeTransform {
  readonly midpoint: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly length: number;
}

/**
 * Three.js ConeGeometry places its apex on local +Y and its base on local -Y.
 * Keep that apex at the satellite (`from`) while the broad footprint lands on
 * the ground target (`to`).
 */
export function buildVisualLabBeamConeTransform(
  from: VisualLabBeamPoint,
  to: VisualLabBeamPoint,
): VisualLabBeamConeTransform {
  const satellite = new THREE.Vector3(...from);
  const target = new THREE.Vector3(...to);
  const satelliteToTarget = target.clone().sub(satellite);
  const length = satelliteToTarget.length();
  if (!Number.isFinite(length) || length <= Number.EPSILON) {
    throw new RangeError('visual-lab beam endpoints must be finite and distinct');
  }
  return Object.freeze({
    midpoint: satellite.clone().add(target).multiplyScalar(.5),
    quaternion: new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, -1, 0),
      satelliteToTarget.normalize(),
    ),
    length,
  });
}
