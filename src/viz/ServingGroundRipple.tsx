import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BEAM_ROLE_TOKENS } from '../constants/beamRoleTokens';
import type { BeamTarget } from '../scene/beamTargetTypes';

export type GroundRippleRole = 'serving' | 'pending';

export const GROUND_RIPPLE_RING_COUNT = 2;
export const SERVING_RIPPLE_CYCLE_SEC = 2.0;
export const SERVING_RIPPLE_EXPAND_SEC = 1.6;
export const SERVING_RIPPLE_RADIUS_MULTIPLIER = 1.6;
export const SERVING_RIPPLE_MAX_OPACITY = 0.42;
export const PENDING_RIPPLE_CYCLE_SEC = 3.0;
export const PENDING_RIPPLE_EXPAND_SEC = 2.4;
export const PENDING_RIPPLE_RADIUS_MULTIPLIER = 1.12;
export const PENDING_RIPPLE_MAX_OPACITY = 0.26;
export const GROUND_RIPPLE_SEGMENTS = 96;

export interface GroundRippleSpec {
  role: GroundRippleRole;
  color: string;
  cycleSec: number;
  expandSec: number;
  radiusMultiplier: number;
  maxOpacity: number;
}

export interface GroundRippleTarget extends GroundRippleSpec {
  id: string;
  satelliteId: string;
  beamId: number;
  groundX: number;
  groundZ: number;
  footprintRadius: number;
}

export interface GroundRippleEnvelope {
  progress: number;
  radius: number;
  opacity: number;
  visible: boolean;
}

export function groundRippleSpec(role: GroundRippleRole): GroundRippleSpec {
  if (role === 'pending') {
    return {
      role,
      color: BEAM_ROLE_TOKENS.pending.color,
      cycleSec: PENDING_RIPPLE_CYCLE_SEC,
      expandSec: PENDING_RIPPLE_EXPAND_SEC,
      radiusMultiplier: PENDING_RIPPLE_RADIUS_MULTIPLIER,
      maxOpacity: PENDING_RIPPLE_MAX_OPACITY,
    };
  }

  return {
    role,
    color: BEAM_ROLE_TOKENS.serving.color,
    cycleSec: SERVING_RIPPLE_CYCLE_SEC,
    expandSec: SERVING_RIPPLE_EXPAND_SEC,
    radiusMultiplier: SERVING_RIPPLE_RADIUS_MULTIPLIER,
    maxOpacity: SERVING_RIPPLE_MAX_OPACITY,
  };
}

export function normalizeGroundRippleProgress(
  elapsedSec: number,
  cycleSec: number,
  phaseOffset = 0,
): number {
  const raw = elapsedSec / cycleSec + phaseOffset;
  return ((raw % 1) + 1) % 1;
}

export function resolveGroundRippleEnvelope(
  target: Pick<GroundRippleTarget, 'cycleSec' | 'expandSec' | 'footprintRadius' | 'radiusMultiplier' | 'maxOpacity'>,
  elapsedSec: number,
  phaseOffset = 0,
): GroundRippleEnvelope {
  const progress = normalizeGroundRippleProgress(elapsedSec, target.cycleSec, phaseOffset);
  const activeFraction = Math.min(1, Math.max(0.01, target.expandSec / target.cycleSec));

  if (progress > activeFraction) {
    return {
      progress,
      radius: target.footprintRadius * target.radiusMultiplier,
      opacity: 0,
      visible: false,
    };
  }

  const localProgress = Math.max(0, Math.min(1, progress / activeFraction));
  const radius = target.footprintRadius * target.radiusMultiplier * localProgress;
  const opacity = target.maxOpacity * (1 - localProgress);

  return {
    progress,
    radius,
    opacity,
    visible: opacity > 0.001 && radius > 0.001,
  };
}

export function isServingRippleBeam(beam: Pick<BeamTarget, 'showBeam' | 'isServing' | 'isScheduledActive'>): boolean {
  return beam.showBeam && beam.isServing && beam.isScheduledActive;
}

export function isPendingRippleBeam(beam: Pick<BeamTarget, 'showBeam' | 'role' | 'isScheduledActive'>): boolean {
  return beam.showBeam && beam.role === 'prepared' && beam.isScheduledActive;
}

export function resolveGroundRippleTargets(input: {
  satBeams: Map<string, BeamTarget[]>;
  footprintRadius: number;
  /** Route-scoped episode identity colour; role motion remains unchanged. */
  identityColorBySatelliteId?: ReadonlyMap<string, string>;
  servingEnabled?: boolean;
  pendingEnabled?: boolean;
  paused?: boolean;
  reducedMotion?: boolean;
  recentHoActive?: boolean;
}): GroundRippleTarget[] {
  if (input.paused || input.reducedMotion || input.recentHoActive) return [];

  const targets: GroundRippleTarget[] = [];

  for (const [satelliteId, beams] of input.satBeams.entries()) {
    for (const beam of beams) {
      const role: GroundRippleRole | null =
        input.servingEnabled !== false && isServingRippleBeam(beam)
          ? 'serving'
          : input.pendingEnabled !== false && isPendingRippleBeam(beam)
            ? 'pending'
            : null;
      if (!role) continue;

      const roleSpec = groundRippleSpec(role);

      targets.push({
        ...roleSpec,
        color: input.identityColorBySatelliteId?.get(satelliteId) ?? roleSpec.color,
        id: `${role}-ripple-${satelliteId}-B${beam.beamId}`,
        satelliteId,
        beamId: beam.beamId,
        groundX: beam.groundX,
        groundZ: beam.groundZ,
        footprintRadius: input.footprintRadius,
      });
    }
  }

  return targets;
}

export function createGroundRippleInstances(targets: GroundRippleTarget[]): Array<GroundRippleTarget & {
  instanceId: string;
  phaseOffset: number;
}> {
  return targets.flatMap(target => (
    Array.from({ length: GROUND_RIPPLE_RING_COUNT }, (_, ringIndex) => ({
      ...target,
      instanceId: `${target.id}-${ringIndex}`,
      phaseOffset: ringIndex / GROUND_RIPPLE_RING_COUNT,
    }))
  ));
}

export function ServingGroundRipple({
  satBeams,
  footprintRadius,
  servingEnabled = true,
  pendingEnabled = true,
  identityColorBySatelliteId,
  paused = false,
  reducedMotion = false,
  recentHoActive = false,
}: {
  satBeams: Map<string, BeamTarget[]>;
  footprintRadius: number;
  servingEnabled?: boolean;
  pendingEnabled?: boolean;
  identityColorBySatelliteId?: ReadonlyMap<string, string>;
  paused?: boolean;
  reducedMotion?: boolean;
  recentHoActive?: boolean;
}) {
  const meshRefs = useRef<Array<THREE.Mesh | null>>([]);
  const materialRefs = useRef<Array<THREE.MeshBasicMaterial | null>>([]);
  const rippleGeometry = useMemo(
    () => new THREE.RingGeometry(0.965, 1, GROUND_RIPPLE_SEGMENTS),
    [],
  );
  const targets = useMemo(
    () => resolveGroundRippleTargets({
      satBeams,
      footprintRadius,
      servingEnabled,
      pendingEnabled,
      identityColorBySatelliteId,
      paused,
      reducedMotion,
      recentHoActive,
    }),
    [
      footprintRadius,
      identityColorBySatelliteId,
      paused,
      pendingEnabled,
      recentHoActive,
      reducedMotion,
      satBeams,
      servingEnabled,
    ],
  );
  const instances = useMemo(() => createGroundRippleInstances(targets), [targets]);

  useFrame(({ clock }) => {
    if (paused || reducedMotion || recentHoActive) return;

    const elapsedSec = clock.getElapsedTime();
    instances.forEach((instance, index) => {
      const mesh = meshRefs.current[index];
      if (!mesh) return;

      const envelope = resolveGroundRippleEnvelope(instance, elapsedSec, instance.phaseOffset);
      mesh.visible = envelope.visible;
      mesh.position.set(instance.groundX, 2.35, instance.groundZ);
      mesh.scale.setScalar(Math.max(0.001, envelope.radius));

      const material = materialRefs.current[index];
      if (material) material.opacity = envelope.opacity;
    });
  });

  useEffect(() => () => {
    rippleGeometry.dispose();
  }, [rippleGeometry]);

  if (instances.length === 0) return null;

  return (
    <group>
      {instances.map((instance, index) => {
        const envelope = resolveGroundRippleEnvelope(instance, 0, instance.phaseOffset);

        return (
          <mesh
            key={instance.instanceId}
            ref={node => {
              meshRefs.current[index] = node;
            }}
            geometry={rippleGeometry}
            position={[instance.groundX, 2.35, instance.groundZ]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={Math.max(0.001, envelope.radius)}
            visible={envelope.visible}
            renderOrder={17}
            frustumCulled={false}
          >
            <meshBasicMaterial
              ref={node => {
                materialRefs.current[index] = node;
              }}
              color={instance.color}
              transparent
              opacity={envelope.opacity}
              depthTest={false}
              depthWrite={false}
              toneMapped={false}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
}
