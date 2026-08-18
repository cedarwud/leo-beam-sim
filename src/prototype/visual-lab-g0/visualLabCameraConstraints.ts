import * as THREE from 'three';

import type { VisualLabView } from './VisualLabScene';

export interface VisualLabOrbitControlLimits {
  readonly minPolarAngle: number;
  readonly maxPolarAngle: number;
}

export function visualLabOrbitControlLimits(view: VisualLabView): VisualLabOrbitControlLimits {
  return Object.freeze({
    minPolarAngle: 0,
    maxPolarAngle: view === 'earth' ? Math.PI : Math.PI / 2,
  });
}

/** Keep directed local-scene camera poses above the same horizontal plane. */
export function constrainVisualLabCameraPose(
  view: VisualLabView,
  position: THREE.Vector3,
  target: THREE.Vector3,
): THREE.Vector3 {
  if (view === 'earth' || position.y >= target.y) return position.clone();
  return new THREE.Vector3(position.x, target.y, position.z);
}
