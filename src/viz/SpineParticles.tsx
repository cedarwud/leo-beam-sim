import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { beamVisualRoleForEventRole } from '../constants/beamRoleTokens';
import type { BeamTarget } from '../scene/beamTargetTypes';
import type { VisibleSat } from '../scene/types';

export const SPINE_PARTICLES_PER_BEAM = 3;
export const SPINE_PARTICLE_CYCLE_SEC = 2.8;
export const SPINE_PARTICLE_RADIUS_WORLD = 4.2;
export const SPINE_PARTICLE_MIN_OPACITY = 0.28;
export const SPINE_PARTICLE_MAX_OPACITY = 0.86;

export interface SpineParticlePlan {
  id: string;
  satelliteId: string;
  beamId: number;
  particleIndex: number;
  color: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  phaseOffset: number;
}

export function isSpineParticleBeam(
  beam: Pick<BeamTarget, 'showBeam' | 'isScheduledActive' | 'isServing' | 'role'>,
): boolean {
  if (!beam.showBeam || !beam.isScheduledActive) return false;
  if (beam.isServing) return true;
  return beamVisualRoleForEventRole(beam.role) !== null;
}

export function normalizeSpineParticleProgress(elapsedSec: number, phaseOffset: number): number {
  const raw = elapsedSec / SPINE_PARTICLE_CYCLE_SEC + phaseOffset;
  return ((raw % 1) + 1) % 1;
}

export function resolveSpineParticleOpacity(progress: number): number {
  const envelope = Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI);
  return SPINE_PARTICLE_MIN_OPACITY + (SPINE_PARTICLE_MAX_OPACITY - SPINE_PARTICLE_MIN_OPACITY) * envelope;
}

export function resolveSpineParticlePosition(plan: SpineParticlePlan, elapsedSec: number): THREE.Vector3 {
  const progress = normalizeSpineParticleProgress(elapsedSec, plan.phaseOffset);
  return plan.start.clone().lerp(plan.end, progress);
}

export function resolveSpineParticlePlans(input: {
  satellites: Pick<VisibleSat, 'id' | 'world'>[];
  satBeams: Map<string, BeamTarget[]>;
  enabled?: boolean;
  paused?: boolean;
  reducedMotion?: boolean;
  particlesPerBeam?: number;
}): SpineParticlePlan[] {
  if (input.enabled === false || input.paused || input.reducedMotion) return [];

  const particlesPerBeam = Math.max(2, Math.min(4, Math.floor(input.particlesPerBeam ?? SPINE_PARTICLES_PER_BEAM)));

  return input.satellites.flatMap(satellite => {
    const beams = input.satBeams.get(satellite.id) ?? [];

    return beams.flatMap(beam => {
      if (!isSpineParticleBeam(beam)) return [];

      const start = satellite.world.clone();
      const end = new THREE.Vector3(beam.groundX, 5, beam.groundZ);

      return Array.from({ length: particlesPerBeam }, (_, particleIndex) => ({
        id: `${satellite.id}:B${beam.beamId}:P${particleIndex}`,
        satelliteId: satellite.id,
        beamId: beam.beamId,
        particleIndex,
        color: beam.satelliteTintColor,
        start,
        end,
        phaseOffset: particleIndex / particlesPerBeam,
      }));
    });
  });
}

export function SpineParticles({
  satellites,
  satBeams,
  plans,
  enabled = true,
  paused = false,
  reducedMotion = false,
}: {
  satellites: VisibleSat[];
  satBeams: Map<string, BeamTarget[]>;
  /** Exact authority-owned active link. When present, legacy satBeams are ignored. */
  plans?: readonly SpineParticlePlan[];
  enabled?: boolean;
  paused?: boolean;
  reducedMotion?: boolean;
}) {
  const particleRefs = useRef<Array<THREE.Mesh | null>>([]);
  const materialRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const particleGeometry = useMemo(
    () => new THREE.SphereGeometry(SPINE_PARTICLE_RADIUS_WORLD, 8, 6),
    [],
  );
  const particles = useMemo(
    () => {
      if (!enabled || paused || reducedMotion) return [];
      return plans === undefined
        ? resolveSpineParticlePlans({ satellites, satBeams, enabled, paused, reducedMotion })
        : [...plans];
    },
    [enabled, paused, plans, reducedMotion, satBeams, satellites],
  );

  useFrame(({ clock }) => {
    if (!enabled || paused || reducedMotion) return;

    const elapsedSec = clock.getElapsedTime();
    particles.forEach((particle, index) => {
      const mesh = particleRefs.current[index];
      if (!mesh) return;

      const progress = normalizeSpineParticleProgress(elapsedSec, particle.phaseOffset);
      const opacity = resolveSpineParticleOpacity(progress);
      mesh.position.copy(particle.start).lerp(particle.end, progress);
      mesh.scale.setScalar(0.78 + opacity * 0.34);

      const material = materialRefs.current[index];
      if (material) material.opacity = opacity;
    });
  });

  if (particles.length === 0) return null;

  return (
    <group>
      {particles.map((particle, index) => {
        const initialPosition = resolveSpineParticlePosition(particle, 0);
        const initialProgress = normalizeSpineParticleProgress(0, particle.phaseOffset);

        return (
          <mesh
            key={particle.id}
            ref={node => {
              particleRefs.current[index] = node;
            }}
            geometry={particleGeometry}
            position={initialPosition}
            renderOrder={34}
            frustumCulled={false}
          >
            <meshBasicMaterial
              ref={node => {
                materialRefs.current[index] = node;
              }}
              color={particle.color}
              transparent
              opacity={resolveSpineParticleOpacity(initialProgress)}
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
              blending={THREE.NormalBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
}
