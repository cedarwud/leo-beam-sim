import type { JSX } from 'react';
import * as THREE from 'three';
import type { CellAssignment } from '../engine/cells/cellScheduler';
import type { CellScheduleViz } from '../scene/useCellSchedule';
import type { WorldPoint } from './CellFootprints';

export interface CellBeamConesProps {
  readonly schedule: CellScheduleViz;
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
  readonly satelliteTintById: ReadonlyMap<string, string>;
  readonly visible?: boolean;
}

export interface CellBeamConeRenderItem {
  readonly assignment: CellAssignment;
  readonly color: string;
  readonly apex: THREE.Vector3;
  readonly baseCenter: THREE.Vector3;
  readonly midpoint: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly heightWorld: number;
  readonly baseRadiusWorld: number;
}

const CONE_SEGMENTS = 40;
const CONE_OPACITY = 0.22;
const FALLBACK_CONE_COLOR = '#93c5fd';
const LOCAL_APEX = new THREE.Vector3(0, 1, 0);
const LOCAL_BASE = new THREE.Vector3(0, -1, 0);

export function CellBeamCones(props: CellBeamConesProps): JSX.Element | null {
  if (props.visible === false) return null;

  const cones = resolveCellBeamConeItems(props);

  return (
    <group
      name="cell-beam-cones"
      userData={{
        coneCount: cones.length,
      }}
    >
      {cones.map(cone => (
        <group
          key={`${cone.assignment.cellId}-${cone.assignment.satId}-${cone.assignment.beamIndex}`}
          name={`cell-beam-cone-${cone.assignment.cellId}`}
          userData={{
            cellId: cone.assignment.cellId,
            satId: cone.assignment.satId,
            satVisualIndex: cone.assignment.satVisualIndex,
            baseRadiusWorld: cone.baseRadiusWorld,
            heightWorld: cone.heightWorld,
          }}
        >
          <mesh
            position={[cone.midpoint.x, cone.midpoint.y, cone.midpoint.z]}
            quaternion={cone.quaternion}
            renderOrder={10}
            frustumCulled={false}
            userData={{
              cellId: cone.assignment.cellId,
              satId: cone.assignment.satId,
              beamIndex: cone.assignment.beamIndex,
              apexWorld: [cone.apex.x, cone.apex.y, cone.apex.z],
              baseCenterWorld: [cone.baseCenter.x, cone.baseCenter.y, cone.baseCenter.z],
              baseRadiusWorld: cone.baseRadiusWorld,
              heightWorld: cone.heightWorld,
              color: cone.color,
            }}
          >
            <coneGeometry args={[cone.baseRadiusWorld, cone.heightWorld, CONE_SEGMENTS, 1, true]} />
            <meshBasicMaterial
              color={cone.color}
              transparent
              opacity={CONE_OPACITY}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function resolveCellBeamConeItems({
  schedule,
  satelliteWorldById,
  satelliteTintById,
}: Omit<CellBeamConesProps, 'visible'>): readonly CellBeamConeRenderItem[] {
  const placementByCellId = new Map(schedule.placements.map(placement => [placement.cellId, placement]));

  return schedule.slot.assignments.flatMap(assignment => {
    const satelliteWorld = satelliteWorldById.get(assignment.satId);
    const placement = placementByCellId.get(assignment.cellId);
    if (!satelliteWorld || !placement) return [];

    const apex = new THREE.Vector3(satelliteWorld.x, satelliteWorld.y, satelliteWorld.z);
    const baseCenter = new THREE.Vector3(placement.worldX, 0, placement.worldZ);
    const heightWorld = apex.distanceTo(baseCenter);
    if (heightWorld <= 1e-6 || placement.radiusWorld <= 0) return [];

    const axisSatToCell = baseCenter.clone().sub(apex).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(LOCAL_BASE, axisSatToCell);
    const midpoint = apex.clone().lerp(baseCenter, 0.5);

    return [{
      assignment,
      color: satelliteTintById.get(assignment.satId) ?? FALLBACK_CONE_COLOR,
      apex,
      baseCenter,
      midpoint,
      quaternion,
      heightWorld,
      baseRadiusWorld: placement.radiusWorld,
    }];
  });
}

export function computeConeApexFromTransform(
  midpoint: THREE.Vector3,
  quaternion: THREE.Quaternion,
  heightWorld: number,
): THREE.Vector3 {
  return LOCAL_APEX.clone().multiplyScalar(heightWorld / 2).applyQuaternion(quaternion).add(midpoint);
}

export function computeConeBaseCenterFromTransform(
  midpoint: THREE.Vector3,
  quaternion: THREE.Quaternion,
  heightWorld: number,
): THREE.Vector3 {
  return LOCAL_BASE.clone().multiplyScalar(heightWorld / 2).applyQuaternion(quaternion).add(midpoint);
}
