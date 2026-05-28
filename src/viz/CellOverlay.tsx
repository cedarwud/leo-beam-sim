import type { JSX } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { CellScheduleViz } from '../scene/useCellSchedule';
import {
  CellFootprintEllipse,
  type WorldPoint,
} from './CellFootprints';

export interface CellOverlayProps {
  readonly schedule: CellScheduleViz;
  readonly satelliteTintById: ReadonlyMap<string, string>;
  readonly satelliteWorldById?: ReadonlyMap<string, WorldPoint>;
  readonly visible?: boolean;
  /** Render the per-cell elliptical footprint rings. Default true. */
  readonly showFootprints?: boolean;
}

const CELL_OVERLAY_Y = 0.5;
const ACTIVE_FALLBACK_COLOR = '#93c5fd';
const IDLE_LINE_COLOR = '#6b7280';
const IDLE_FILL_COLOR = '#334155';
const ACTIVE_FILL_OPACITY = 0.22;
const ACTIVE_LINE_OPACITY = 0.9;
const IDLE_FILL_OPACITY = 0.04;
const IDLE_LINE_OPACITY = 0.25;

export function CellOverlay(props: CellOverlayProps): JSX.Element | null {
  if (props.visible === false) return null;

  return (
    <group
      name="cell-overlay"
      userData={{
        slotIndex: props.schedule.slotIndex,
        activeCount: props.schedule.slot.assignments.length,
        idleCount: props.schedule.slot.idleCellIds.length,
      }}
    >
      {props.schedule.placements.map(placement => {
        const assignment = props.schedule.assignmentByCellId.get(placement.cellId);
        const active = assignment !== undefined;
        const color = assignment
          ? props.satelliteTintById.get(assignment.satId) ?? ACTIVE_FALLBACK_COLOR
          : IDLE_LINE_COLOR;
        const fillColor = active ? color : IDLE_FILL_COLOR;
        const fillOpacity = active ? ACTIVE_FILL_OPACITY : IDLE_FILL_OPACITY;
        const lineOpacity = active ? ACTIVE_LINE_OPACITY : IDLE_LINE_OPACITY;
        const points = createHexBorderPoints(placement.radiusWorld);
        const shape = createHexShape(placement.radiusWorld);

        return (
          <group
            key={placement.cellId}
            name={`cell-${placement.cellId}`}
            position={[placement.worldX, CELL_OVERLAY_Y, placement.worldZ]}
            userData={{
              cellId: placement.cellId,
              active,
              satId: assignment?.satId ?? null,
              lineColor: color,
              fillColor,
              fillOpacity,
              lineOpacity,
            }}
          >
            <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={9}>
              <shapeGeometry args={[shape]} />
              <meshBasicMaterial
                color={fillColor}
                transparent
                opacity={fillOpacity}
                side={THREE.DoubleSide}
                depthWrite={false}
                toneMapped={false}
                blending={THREE.NormalBlending}
              />
            </mesh>
            <Line
              points={points}
              color={color}
              lineWidth={active ? 2.6 : 1.4}
              transparent
              opacity={lineOpacity}
              depthWrite={false}
              renderOrder={12}
            />
            {assignment && props.showFootprints !== false && (
              <CellFootprintEllipse
                cellId={placement.cellId}
                cellWorld={{ x: placement.worldX, z: placement.worldZ }}
                radiusWorld={placement.radiusWorld}
                satelliteWorld={props.satelliteWorldById?.get(assignment.satId)}
                color={color}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}

function createHexBorderPoints(radius: number): [number, number, number][] {
  const points: [number, number, number][] = [];
  for (let index = 0; index <= 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2 - Math.PI / 2;
    points.push([Math.cos(angle) * radius, 0, Math.sin(angle) * radius]);
  }
  return points;
}

function createHexShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let index = 0; index <= 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}
