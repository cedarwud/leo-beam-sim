/**
 * SINR-live cell-truth footprint HEXES — beam-stage ① #3 (legible circles) + W4
 * double-layer hex (restores the 49db65d look).
 *
 * Draws a DOUBLE-LAYER hexagon (an outer rim band + an inner concentric band) per
 * SERVING earth-fixed cell, from the SAME cell-truth items the serving cones render
 * (`SinrLiveCellBeamConeRenderItem`: base centre, footprint radius, serving-identity
 * colour). So every beam reads as a distinct nested hex and the audience sees the UEs
 * scattered OFF-CENTRE inside it (the off-axis story the cone fill alone did not make
 * legible). Cell-truth-aligned by construction — one double-hex per serving cone item,
 * at the cone's `baseCenter` / `baseRadiusWorld` / `color` — so both bands, the beam
 * cone, and its UE dots share one position + hue. This also REPLACES the persistent
 * grey `SinrLiveCellGrid` (the always-on 37-cell background grid), removed in W4 so the
 * map shows cells ONLY when served.
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
  SINR_LIVE_FOOTPRINT_INNER_BAND_INNER_FACTOR,
  SINR_LIVE_FOOTPRINT_INNER_BAND_OPACITY,
  SINR_LIVE_FOOTPRINT_INNER_BAND_OUTER_FACTOR,
  SINR_LIVE_FOOTPRINT_RING_INNER_FACTOR,
  SINR_LIVE_FOOTPRINT_RING_OPACITY,
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
      // Count served CELLS (per-item groups), not meshes — each cell now draws two
      // band meshes, but this telemetry means "footprints rendered" (= served cells).
      if (obj.userData?.footprintItem === true && obj.visible) count += 1;
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
        // W4 double-layer hex: an OUTER rim band + an INNER concentric band, both in
        // the cell's serving-identity colour (colour-match: cone == UE == both hexes).
        return (
          <group
            key={item.renderKey ?? `${item.cellId}-${item.satId}`}
            name={`sinr-live-cell-footprint-${item.cellId}`}
            position={[item.baseCenter.x, item.baseCenter.y + SINR_LIVE_FOOTPRINT_RING_Y_LIFT, item.baseCenter.z]}
            rotation={[-Math.PI / 2, 0, Math.PI / 6]}
            userData={{ footprintItem: true, cellId: item.cellId, satId: item.satId, color: item.color }}
          >
            <mesh name={`sinr-live-cell-footprint-ring-${item.cellId}`} renderOrder={11} frustumCulled={false}>
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
            <mesh name={`sinr-live-cell-footprint-ring-inner-${item.cellId}`} renderOrder={11} frustumCulled={false}>
              <ringGeometry args={[radius * SINR_LIVE_FOOTPRINT_INNER_BAND_INNER_FACTOR, radius * SINR_LIVE_FOOTPRINT_INNER_BAND_OUTER_FACTOR, 6]} />
              <meshBasicMaterial
                color={item.color}
                transparent
                opacity={SINR_LIVE_FOOTPRINT_INNER_BAND_OPACITY}
                side={THREE.DoubleSide}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// SinrLiveCellGrid (the persistent grey 37-cell background hex grid, added f0adf3c)
// was REMOVED in W4 2026-06-20: the restored 49db65d look shows cells ONLY when
// served (the double-layer footprint hex above), with no always-on background grid.
// sinrLiveCellPlacementById stays in MainScene — the cone resolvers still use it.
