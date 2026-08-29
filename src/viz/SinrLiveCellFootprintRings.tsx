/**
 * SINR-live cell-truth footprint HEXES — the ab861c4 THREE-LAYER restore (2026-06-22).
 *
 * Per SERVING earth-fixed cell, draws the rich layered hexagon the legacy
 * `EarthFixedCells` drew before it was flattened to two same-colour outline bands:
 *   1. a faint additive FILL-glow (a hexagon disc) — lifts the cell off the terrain
 *      without a hard panel (the rings dominate; the old look had no solid fill),
 *   2. an outer BORDER ring (a thin crisp rim hex), and
 *   3. a bright inner ROLE ring (the brightest element) —
 * all at the SAME cell-truth base centre / footprint radius as the serving cone
 * (`SinrLiveCellBeamConeRenderItem`: base centre, footprint radius), so every beam reads
 * as a distinct 3-layer hex with its UEs scattered OFF-CENTRE inside it (the off-axis
 * story the flat outline alone did not make legible).
 *
 * COLOUR (owner choice B, 2026-06-22): every layer renders the cell's SEMANTIC role
 * colour — hero serving YELLOW / candidate BLUE / context GREY — resolved by the SAME
 * `resolveSinrLiveConeRenderColor` the cone mount uses, from the hero/override/background
 * inputs passed as props (defaults = `beamDisplaySpec.*`). So the footprint hex MATCHES
 * its cone (no per-sat rainbow), and this file holds ZERO colour literal (the
 * beam-display-spec purity gate's enforce state for it). The resolver item's
 * serving-identity `color` survives as per-cell DATA / userData, not the rendered hue.
 *
 * This REPLACES the legacy steered `AmbientFootprintRings` (which sat at the STEERED
 * beam ground positions — a different geometry from the earth-fixed cell centres, so it
 * was misaligned with the cones + the UE serving membership) and the persistent grey
 * `SinrLiveCellGrid` (removed in W4 — the map shows cells ONLY when served).
 *
 * Display-only (Rule#6): a pure outline of the serving cone bases — it fabricates no
 * SINR / serving / handover truth, reading only the geometry + identity already on each
 * item. It is a dumb renderer: lane gating lives in `MainScene` (mounted only with the
 * serving cones, `showSinrLiveCellBeams`), so this component imports no lane state.
 */
import { useEffect, useLayoutEffect, useRef, type JSX } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  SINR_LIVE_FOOTPRINT_FILL_OPACITY,
  SINR_LIVE_FOOTPRINT_INNER_BAND_INNER_FACTOR,
  SINR_LIVE_FOOTPRINT_INNER_BAND_OPACITY,
  SINR_LIVE_FOOTPRINT_INNER_BAND_OUTER_FACTOR,
  SINR_LIVE_FOOTPRINT_RING_INNER_FACTOR,
  SINR_LIVE_FOOTPRINT_RING_OPACITY,
  SINR_LIVE_FOOTPRINT_RING_OUTER_FACTOR,
  SINR_LIVE_FOOTPRINT_RING_Y_LIFT,
  type SinrLiveConePalette,
} from '../constants/sinrLiveConeStyle';
import { satelliteTint } from '../constants/beamRoleTokens';
import {
  resolveSinrLiveConeRole,
  resolveSinrLiveConeDisplayStyle,
  type SinrLiveCellBeamConeRenderItem,
  type SinrLiveConeColorAuthority,
  type SinrLiveConeMountLayer,
} from './SinrLiveCellBeamCones';

export interface SinrLiveCellFootprintRingsProps {
  /** The SERVING cone items (one hex per item). Empty off the cell-truth lanes. */
  readonly items: readonly SinrLiveCellBeamConeRenderItem[];
  /** Presentation-only visibility gate; geometry and cell truth remain untouched. */
  readonly visible?: boolean;
  /** Mirror the cone `coneWidthScale` so the hex tracks the rendered footprint. */
  readonly widthScale?: number;
  /**
   * SEMANTIC colour inputs — the SAME layer + palette the cone mount is given, so the
   * footprint hex resolves the IDENTICAL role colour as the cone it sits under (2026-08-06:
   * previously it took its own `heroColor`/`backgroundColor`/`coneColorOverride` trio, which
   * could — and after the serving-fan split WOULD — drift from the cone's colour). All
   * optional: with none passed, every role falls back to its `sinrLiveConeStyle` token.
   */
  readonly layer?: SinrLiveConeMountLayer;
  readonly palette?: SinrLiveConePalette;
  /** Must match the cone mount so the ground Cell and beam keep one identity. */
  readonly colorAuthority?: SinrLiveConeColorAuthority;
  readonly primaryServingSatId?: string | null;
  readonly primaryServingCellId?: number | null;
  /** Optional canvas dataset key for the rendered-hex count (validator proof). */
  readonly telemetryCountDatasetKey?: string;
}

export function SinrLiveCellFootprintRings(props: SinrLiveCellFootprintRingsProps): JSX.Element | null {
  const gl = useThree(state => state.gl);
  const groupRef = useRef<THREE.Group>(null);
  const { items, palette } = props;
  const layer = props.layer ?? 'serving';
  const widthScale = props.widthScale ?? 1;
  const primaryServingSatId = props.primaryServingSatId ?? null;
  const primaryServingCellId = props.primaryServingCellId ?? null;

  // MESH-derived telemetry: publish the count of footprint hexes that actually drew, so
  // a validator can prove the footprints rendered (mirrors the cone layer).
  useLayoutEffect(() => {
    const key = props.telemetryCountDatasetKey;
    if (!key) return;
    if (props.visible === false || items.length === 0) {
      gl.domElement.dataset[key] = '0';
      return;
    }
    const group = groupRef.current;
    if (!group) return;
    let count = 0;
    group.traverse(obj => {
      // Count served CELLS (per-item groups), not meshes — each cell now draws three
      // layer meshes, but this telemetry means "footprints rendered" (= served cells).
      if (obj.userData?.footprintItem === true && obj.visible) count += 1;
    });
    gl.domElement.dataset[key] = String(count);
  });

  useEffect(() => () => {
    if (props.telemetryCountDatasetKey) delete gl.domElement.dataset[props.telemetryCountDatasetKey];
  }, [gl, items.length, props.telemetryCountDatasetKey, props.visible]);

  if (props.visible === false || items.length === 0) return null;

  return (
    <group ref={groupRef} name="sinr-live-cell-footprint-rings" userData={{ ringCount: items.length }}>
      {items.map(item => {
        const radius = item.baseRadiusWorld * widthScale;
        if (!(radius > 0)) return null;
        // ab861c4 TWO-TONE: the outer BORDER ring = the per-sat WHITE/pale tint
        // (`satelliteTint`, palette is white-dominant) so it reads as a crisp white outline;
        // the inner ROLE ring + the faint fill = the cell's SEMANTIC role colour (hero
        // serving YELLOW / candidate BLUE / context GREY), resolved EXACTLY as the cone mount
        // does. So the hex matches its cone in role colour but keeps the white rim distinct.
        const borderColor = satelliteTint(item.satId);
        const roleColor = resolveSinrLiveConeDisplayStyle(
          resolveSinrLiveConeRole({
            layer,
            satId: item.satId,
            cellId: item.cellId,
            itemRole: item.role,
            heroSatId: primaryServingSatId,
            heroCellId: primaryServingCellId,
          }),
          palette,
          item,
          props.colorAuthority,
        ).color;
        // ab861c4 3-layer hex: a faint additive FILL-glow under a WHITE outer BORDER ring
        // (proud rim 0.96→1.04r) and a bright role-colour inner ring (tight 0.78→0.84r).
        return (
          <group
            key={item.renderKey ?? `${item.cellId}-${item.satId}`}
            name={`sinr-live-cell-footprint-${item.cellId}`}
            position={[item.baseCenter.x, item.baseCenter.y + SINR_LIVE_FOOTPRINT_RING_Y_LIFT, item.baseCenter.z]}
            rotation={[-Math.PI / 2, 0, Math.PI / 6]}
            userData={{ footprintItem: true, cellId: item.cellId, satId: item.satId, color: roleColor, borderColor }}
          >
            <mesh name={`sinr-live-cell-footprint-fill-${item.cellId}`} renderOrder={8} frustumCulled={false}>
              <circleGeometry args={[radius, 6]} />
              <meshBasicMaterial
                color={roleColor}
                transparent
                opacity={SINR_LIVE_FOOTPRINT_FILL_OPACITY}
                side={THREE.DoubleSide}
                depthWrite={false}
                toneMapped={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
            <mesh name={`sinr-live-cell-footprint-ring-${item.cellId}`} renderOrder={11} frustumCulled={false}>
              <ringGeometry args={[radius * SINR_LIVE_FOOTPRINT_RING_INNER_FACTOR, radius * SINR_LIVE_FOOTPRINT_RING_OUTER_FACTOR, 6]} />
              <meshBasicMaterial
                color={borderColor}
                transparent
                opacity={SINR_LIVE_FOOTPRINT_RING_OPACITY}
                side={THREE.DoubleSide}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            <mesh name={`sinr-live-cell-footprint-ring-inner-${item.cellId}`} renderOrder={13} frustumCulled={false}>
              <ringGeometry args={[radius * SINR_LIVE_FOOTPRINT_INNER_BAND_INNER_FACTOR, radius * SINR_LIVE_FOOTPRINT_INNER_BAND_OUTER_FACTOR, 6]} />
              <meshBasicMaterial
                color={roleColor}
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
// was REMOVED in W4 2026-06-20: the restored look shows cells ONLY when served (the
// 3-layer footprint hex above), with no always-on background grid.
// sinrLiveCellPlacementById stays in MainScene — the cone resolvers still use it.
