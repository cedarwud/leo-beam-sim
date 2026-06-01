import type { JSX } from 'react';
import * as THREE from 'three';
import type { CellAssignment } from '../engine/cells/cellScheduler';
import type { ModqnBeamConeScope } from '../scene/modqnVisualLayers';
import type { CellScheduleViz } from '../scene/useCellSchedule';
import type { WorldPoint } from './CellFootprints';

export interface CellBeamConesProps {
  readonly schedule: CellScheduleViz;
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
  readonly satelliteTintById: ReadonlyMap<string, string>;
  readonly visible?: boolean;
  readonly focusedUe?: {
    readonly servingSatelliteId: string;
    readonly servingBeamId: string;
    readonly targetSatelliteId: string | null;
    readonly targetBeamId: string | null;
    readonly worldPos?: readonly [number, number, number];
  } | null;
  readonly beamConeScope?: ModqnBeamConeScope;
  readonly appMode?: string;
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

const CONE_SEGMENTS = 24;
const DEFAULT_CONE_OPACITY = 0.1;
const FOCUS_CONE_OPACITY = 0.12;
const SERVICE_ALLOCATION_CONE_OPACITY = 0.13;
const FALLBACK_CONE_COLOR = '#93c5fd';
const LOCAL_APEX = new THREE.Vector3(0, 1, 0);
const LOCAL_BASE = new THREE.Vector3(0, -1, 0);

export function CellBeamCones(props: CellBeamConesProps): JSX.Element | null {
  if (props.visible === false) return null;

  const cones = resolveCellBeamConeItems(props);
  const coneOpacity = resolveCellBeamConeOpacity(props.beamConeScope);

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
              opacity: coneOpacity,
              beamConeScope: props.beamConeScope ?? 'auto',
            }}
          >
            <coneGeometry args={[cone.baseRadiusWorld, cone.heightWorld, CONE_SEGMENTS, 1, true]} />
            <meshBasicMaterial
              color={cone.color}
              transparent
              opacity={coneOpacity}
              blending={THREE.NormalBlending}
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

/**
 * Pick one focus satellite for the modqn-demo cell lane: the focused UE's
 * serving satellite if it is actually in the current schedule, else the
 * satellite serving the most cells this slot (deterministic tie-break by
 * satId ascending). Returns null when there are no assignments.
 */
export function resolveFocusSatelliteId(
  assignments: readonly CellAssignment[],
  focusedUe?: CellBeamConesProps['focusedUe'],
): string | null {
  if (assignments.length === 0) return null;

  const countBySatId = new Map<string, number>();
  for (const assignment of assignments) {
    countBySatId.set(assignment.satId, (countBySatId.get(assignment.satId) ?? 0) + 1);
  }

  const preferred = focusedUe?.servingSatelliteId;
  if (preferred && countBySatId.has(preferred)) return preferred;

  let bestSatId: string | null = null;
  let bestCount = -1;
  for (const [satId, count] of countBySatId) {
    if (count > bestCount || (count === bestCount && (bestSatId === null || satId < bestSatId))) {
      bestSatId = satId;
      bestCount = count;
    }
  }
  return bestSatId;
}

export function resolveCellBeamConeItems({
  schedule,
  satelliteWorldById,
  satelliteTintById,
  focusedUe,
  beamConeScope,
  appMode,
}: Omit<CellBeamConesProps, 'visible'>): readonly CellBeamConeRenderItem[] {
  const resolvedScope = beamConeScope ?? (appMode === 'modqn-demo' ? 'focus-satellite' : 'all-serving-satellites');
  if (resolvedScope === 'none') return [];

  const placementByCellId = new Map(schedule.placements.map(placement => [placement.cellId, placement]));

  // Focus scope is for explain mode: it keeps the handover story readable by
  // showing one satellite's beams. Service/debug scopes show the multi-sat
  // allocation explicitly.
  const focusSatId = resolvedScope === 'focus-satellite'
    ? resolveFocusSatelliteId(schedule.slot.assignments, focusedUe)
    : null;

  return schedule.slot.assignments.flatMap(assignment => {
    if (focusSatId !== null && assignment.satId !== focusSatId) return [];

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

export function resolveCellBeamConeRenderCount(input: Omit<CellBeamConesProps, 'visible'>): number {
  return resolveCellBeamConeItems(input).length;
}

export function resolveCellBeamConeSatelliteCount(input: Omit<CellBeamConesProps, 'visible'>): number {
  return new Set(resolveCellBeamConeItems(input).map(item => item.assignment.satId)).size;
}

export function resolveCellBeamConeOpacity(scope?: ModqnBeamConeScope): number {
  if (scope === 'all-serving-satellites') return SERVICE_ALLOCATION_CONE_OPACITY;
  if (scope === 'focus-satellite') return FOCUS_CONE_OPACITY;
  return DEFAULT_CONE_OPACITY;
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
