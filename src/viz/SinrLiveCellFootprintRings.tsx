/**
 * SINR-live cell-truth footprint RINGS — beam-stage ① #3 (legible circles).
 *
 * Draws one crisp ground ring per SERVING earth-fixed cell, from the SAME cell-truth
 * items the serving cones render (`SinrLiveCellBeamConeRenderItem`: base centre,
 * footprint radius, serving-identity colour). So every beam reads as a distinct
 * CIRCLE and the audience sees the UEs scattered OFF-CENTRE inside it (the off-axis
 * story the cone fill alone did not make legible). Cell-truth-aligned by construction
 * — one ring per serving cone item, at the cone's `baseCenter` / `baseRadiusWorld` /
 * `color` — so the ring, its beam cone, and its UE dots share one position + hue.
 *
 * This REPLACES the legacy steered `AmbientFootprintRings`, whose rings sat at the
 * STEERED beam ground positions (`viz.ambientRings`) — a DIFFERENT geometry from the
 * earth-fixed cell centres, so they were misaligned with the cones + the UE serving
 * membership (and the lattice-phase ① shift only widened that gap).
 *
 * Display-only (Rule#6): a pure outline of the serving cone bases — it fabricates no
 * SINR / serving / handover truth, reading only the geometry already on each item.
 * It is a dumb renderer: lane gating lives in `MainScene` (mounted only with the
 * serving cones, `showSinrLiveCellBeams`), so this component imports no lane state.
 */
import { useEffect, useLayoutEffect, useRef, type JSX } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  SINR_LIVE_FOOTPRINT_RING_INNER_FACTOR,
  SINR_LIVE_FOOTPRINT_RING_OPACITY,
  SINR_LIVE_FOOTPRINT_RING_SEGMENTS,
  SINR_LIVE_FOOTPRINT_RING_Y_LIFT,
} from '../constants/sinrLiveConeStyle';
import type { SinrLiveCellBeamConeRenderItem } from './SinrLiveCellBeamCones';

export interface SinrLiveCellFootprintRingsProps {
  /** The SERVING cone items (one ring per item). Empty off the cell-truth lanes. */
  readonly items: readonly SinrLiveCellBeamConeRenderItem[];
  /** Mirror the cone `coneWidthScale` so the ring tracks the rendered footprint. */
  readonly widthScale?: number;
  /** Optional canvas dataset key for the rendered-ring mesh count (validator proof). */
  readonly telemetryCountDatasetKey?: string;
}

export function SinrLiveCellFootprintRings(props: SinrLiveCellFootprintRingsProps): JSX.Element | null {
  const gl = useThree(state => state.gl);
  const groupRef = useRef<THREE.Group>(null);
  const { items } = props;
  const widthScale = props.widthScale ?? 1;

  // MESH-derived telemetry: publish the count of ring meshes that actually drew, so
  // a validator can prove the footprint circles rendered (mirrors the cone layer).
  useLayoutEffect(() => {
    const key = props.telemetryCountDatasetKey;
    if (!key) return;
    const group = groupRef.current;
    if (!group) return;
    let count = 0;
    group.traverse(obj => {
      if ((obj as THREE.Mesh).isMesh && obj.visible) count += 1;
    });
    gl.domElement.dataset[key] = String(count);
  });

  useEffect(() => () => {
    if (props.telemetryCountDatasetKey) delete gl.domElement.dataset[props.telemetryCountDatasetKey];
  }, [gl, props.telemetryCountDatasetKey]);

  if (items.length === 0) return null;

  return (
    <group ref={groupRef} name="sinr-live-cell-footprint-rings" userData={{ ringCount: items.length }}>
      {items.map(item => {
        const radius = item.baseRadiusWorld * widthScale;
        if (!(radius > 0)) return null;
        return (
          <mesh
            key={item.renderKey ?? `${item.cellId}-${item.satId}`}
            name={`sinr-live-cell-footprint-ring-${item.cellId}`}
            position={[item.baseCenter.x, item.baseCenter.y + SINR_LIVE_FOOTPRINT_RING_Y_LIFT, item.baseCenter.z]}
            rotation={[-Math.PI / 2, 0, Math.PI / 6]}
            renderOrder={11}
            frustumCulled={false}
            userData={{ cellId: item.cellId, satId: item.satId, color: item.color }}
          >
            <ringGeometry args={[radius * SINR_LIVE_FOOTPRINT_RING_INNER_FACTOR, radius, 6]} />
            <meshBasicMaterial
              color={item.color}
              transparent
              opacity={SINR_LIVE_FOOTPRINT_RING_OPACITY}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
