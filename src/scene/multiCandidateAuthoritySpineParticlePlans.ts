import * as THREE from 'three';

import type { SpineParticlePlan } from '../viz/SpineParticles';

export interface AuthoritySpineParticleServingInput {
  readonly pairKey: string;
  readonly satelliteId: string;
  readonly beamId: number;
  readonly beamColor: string;
  readonly apex: readonly [number, number, number];
}

export interface AuthoritySpineParticlePlansInput {
  readonly enabled: boolean;
  readonly serving: AuthoritySpineParticleServingInput | null | undefined;
  readonly primaryUeWorld: readonly [number, number, number] | undefined;
  readonly particlesPerBeam: number;
}

/** Build the authority-owned particle row from one accepted serving link. */
export function resolveAuthoritySpineParticlePlans(
  input: AuthoritySpineParticlePlansInput,
): readonly SpineParticlePlan[] | undefined {
  if (!input.enabled) return undefined;
  const serving = input.serving;
  if (serving === null || serving === undefined || input.primaryUeWorld === undefined) {
    return [];
  }

  const start = new THREE.Vector3(...serving.apex);
  const end = new THREE.Vector3(...input.primaryUeWorld);
  return Object.freeze(Array.from({ length: input.particlesPerBeam }, (_, particleIndex) => ({
    id: `authority:${serving.pairKey}:P${particleIndex}`,
    satelliteId: serving.satelliteId,
    beamId: serving.beamId,
    particleIndex,
    color: serving.beamColor,
    start: start.clone(),
    end: end.clone(),
    phaseOffset: particleIndex / input.particlesPerBeam,
  })));
}
