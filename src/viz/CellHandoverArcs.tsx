import type { JSX } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { CellReassignment } from '../scene/useCellSchedule';
import type { WorldPoint } from './CellFootprints';

export interface CellHandoverArcsProps {
  readonly reassignments: readonly CellReassignment[];
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
  readonly visible?: boolean;
}

interface ArcRenderItem {
  readonly reassignment: CellReassignment;
  readonly color: string;
  readonly points: readonly [number, number, number][];
}

export const INTER_ARC_COLOR = '#a855f7';
export const INTRA_ARC_COLOR = '#76ead7';

const ARC_LIFT_FACTOR = 0.35;
const INTER_ARC_SEGMENTS = 48;
const INTRA_ARC_SEGMENTS = 24;
const INTRA_ARC_HALF_SPAN = 9;
const INTRA_ARC_HEIGHT = 18;
const INTRA_ARC_Y = 1.1;

export function CellHandoverArcs({
  reassignments,
  satelliteWorldById,
  visible = true,
}: CellHandoverArcsProps): JSX.Element | null {
  if (!visible) return null;

  const arcs: ArcRenderItem[] = reassignments.flatMap(reassignment => {
    if (reassignment.kind === 'inter') {
      const from = satelliteWorldById.get(reassignment.fromSatId);
      const to = satelliteWorldById.get(reassignment.toSatId);
      if (!from || !to) return [];
      return [{
        reassignment,
        color: INTER_ARC_COLOR,
        points: buildInterArcPoints(from, to),
      }];
    }

    const servingSat = satelliteWorldById.get(reassignment.toSatId);
    if (!servingSat) return [];
    return [{
      reassignment,
      color: INTRA_ARC_COLOR,
      points: buildIntraArcPoints(reassignment.worldX, reassignment.worldZ),
    }];
  });
  const interCount = arcs.filter(arc => arc.reassignment.kind === 'inter').length;
  const intraCount = arcs.filter(arc => arc.reassignment.kind === 'intra').length;

  return (
    <group
      name="cell-handover-arcs"
      userData={{
        count: arcs.length,
        interCount,
        intraCount,
      }}
    >
      {arcs.map(arc => (
        <group
          key={`${arc.reassignment.cellId}-${arc.reassignment.fromSatId}-${arc.reassignment.toSatId}`}
          name={`cell-ho-arc-${arc.reassignment.cellId}`}
          userData={{
            cellId: arc.reassignment.cellId,
            kind: arc.reassignment.kind,
            fromSatId: arc.reassignment.fromSatId,
            toSatId: arc.reassignment.toSatId,
            color: arc.color,
          }}
        >
          <Line
            points={arc.points}
            color={arc.color}
            lineWidth={arc.reassignment.kind === 'inter' ? 2.2 : 2}
            transparent
            opacity={arc.reassignment.kind === 'inter' ? 0.78 : 0.82}
            depthWrite={false}
            renderOrder={23}
            userData={{
              cellId: arc.reassignment.cellId,
              kind: arc.reassignment.kind,
              color: arc.color,
            }}
          />
        </group>
      ))}
    </group>
  );
}

function buildInterArcPoints(from: WorldPoint, to: WorldPoint): readonly [number, number, number][] {
  const curve = buildArcCurve(
    new THREE.Vector3(from.x, from.y, from.z),
    new THREE.Vector3(to.x, to.y, to.z),
  );

  return Array.from({ length: INTER_ARC_SEGMENTS + 1 }, (_, index) => {
    const point = curve.getPoint(index / INTER_ARC_SEGMENTS);
    return [point.x, point.y, point.z];
  });
}

function buildIntraArcPoints(worldX: number, worldZ: number): readonly [number, number, number][] {
  const from = new THREE.Vector3(worldX - INTRA_ARC_HALF_SPAN, INTRA_ARC_Y, worldZ);
  const mid = new THREE.Vector3(worldX, INTRA_ARC_Y + INTRA_ARC_HEIGHT, worldZ);
  const to = new THREE.Vector3(worldX + INTRA_ARC_HALF_SPAN, INTRA_ARC_Y, worldZ);
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);

  return Array.from({ length: INTRA_ARC_SEGMENTS + 1 }, (_, index) => {
    const point = curve.getPoint(index / INTRA_ARC_SEGMENTS);
    return [point.x, point.y, point.z];
  });
}

function buildArcCurve(from: THREE.Vector3, to: THREE.Vector3): THREE.QuadraticBezierCurve3 {
  const mid = from.clone().lerp(to, 0.5);
  const distance = from.distanceTo(to);
  mid.y += distance * ARC_LIFT_FACTOR;
  return new THREE.QuadraticBezierCurve3(from, mid, to);
}
