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
 * COLOUR: the inner layer follows the cone's resolved colour. In the live lane
 * that is the stable (satellite, beam) identity, so an intra handover keeps one
 * hue family while changing shade. The outer rim uses the satellite's base hue
 * to make that family legible without reintroducing role colours.
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
import { colorForServingSatellite } from '../constants/servingColour';
import {
  HOMEPAGE_SATELLITE_CONTEXT_RENDER_OPACITY_FACTOR,
  homepageEeVisualOpacity,
  homepageSatelliteColorForBeam,
} from '../homepage/controller/homepageSatelliteVisualIdentity';
import {
  homepageBeamEeKey,
  resolveSinrLiveConeRole,
  resolveSinrLiveConeDisplayStyle,
  type SinrLiveCellBeamConeRenderItem,
  type SinrLiveConeColorAuthority,
  type SinrLiveConeMountLayer,
} from './SinrLiveCellBeamCones';
import { resolveHandoverSide } from '../appearance/handoverAppearanceModifiers';
import { cellLinkBudgetBeamId } from '../scene/sinrLiveCellModel';

export interface SinrLiveCellFootprintRingsProps {
  /** The SERVING cone items (one hex per item). Empty off the cell-truth lanes. */
  readonly items: readonly SinrLiveCellBeamConeRenderItem[];
  /** Presentation-only visibility gate; geometry and cell truth remain untouched. */
  readonly visible?: boolean;
  /** Mirror the cone `coneWidthScale` so the hex tracks the rendered footprint. */
  readonly widthScale?: number;
  /**
   * The SAME layer + palette as the cone mount, so the footprint resolves the
   * identical opacity/style role. With `colorAuthority="item-identity"` the
   * cone's stable satellite/beam colour is retained instead of a role swatch.
   */
  readonly layer?: SinrLiveConeMountLayer;
  readonly palette?: SinrLiveConePalette;
  /** Must match the cone mount so the ground Cell and beam keep one identity. */
  readonly colorAuthority?: SinrLiveConeColorAuthority;
  /** Root-only identity projection; omitted consumers keep the existing palette. */
  readonly homepageVisualIdentity?: boolean;
  /**
   * Optional frame-local EE normalization keyed exactly as `${satId}:${beamId}`.
   * The homepage integration owner in `MainScene` will provide this map; leaving
   * it omitted preserves the existing deterministic beam-slot colour fallback.
   */
  readonly homepageBeamEeByKey?: ReadonlyMap<string, number | null>;
  /** Episode-stable palette slots published by the accepted snapshot. */
  readonly homepageIdentityPaletteIndexBySatelliteId?: ReadonlyMap<string, number | null>;
  readonly primaryServingSatId?: string | null;
  readonly primaryServingCellId?: number | null;
  readonly primaryServingBeamId?: number | null;
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
  const primaryServingBeamId = props.primaryServingBeamId ?? null;

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
        const beamId = item.beamId ?? cellLinkBudgetBeamId(item.cellId);
        // Keep a crisp rim in the satellite's base hue; the inner ring/fill may
        // use a beam-level lightness shade, which is what makes intra switching
        // visible without assigning a role colour to the cell.
        const resolvedRoleColor = resolveSinrLiveConeDisplayStyle(
          resolveSinrLiveConeRole({
            layer,
            satId: item.satId,
            cellId: item.cellId,
            itemRole: item.role,
            heroSatId: primaryServingSatId,
            heroCellId: primaryServingCellId,
            heroBeamId: primaryServingBeamId,
            beamId,
          }),
          palette,
          item,
          props.colorAuthority,
        ).color;
        const homepageIdentity = props.homepageVisualIdentity === true
          && props.colorAuthority === 'item-identity';
        const isPrimaryServing = item.satId === primaryServingSatId
          && item.cellId === primaryServingCellId
          && (primaryServingBeamId === null || beamId === primaryServingBeamId);
        const itemRole = resolveSinrLiveConeRole({
          layer,
          satId: item.satId,
          cellId: item.cellId,
          itemRole: item.role,
          heroSatId: primaryServingSatId,
          heroCellId: primaryServingCellId,
          heroBeamId: primaryServingBeamId,
          beamId,
        });
        const isPrimaryIdentityBeam = isPrimaryServing
          || itemRole === 'candidatePrimary'
          || resolveHandoverSide({ role: itemRole }) !== null
          || itemRole === 'triggered';
        const homepageBeamColor = homepageIdentity
          ? homepageSatelliteColorForBeam(item.satId, beamId, {
            identityPaletteIndex: props.homepageIdentityPaletteIndexBySatelliteId?.get(item.satId) ?? null,
            isServing: isPrimaryIdentityBeam,
            eeNormalized: props.homepageBeamEeByKey?.get(
              homepageBeamEeKey(item.satId, beamId),
            ),
          })
          : null;
        const borderColor = homepageBeamColor?.color
          ?? colorForServingSatellite(item.satId).markerColor;
        const roleColor = homepageBeamColor?.color ?? resolvedRoleColor;
        const homepageEeOpacity = homepageIdentity
          ? homepageEeVisualOpacity(props.homepageBeamEeByKey?.get(
            homepageBeamEeKey(item.satId, beamId),
          ))
          : 1;
        const renderOpacityFactor = homepageIdentity && !isPrimaryIdentityBeam
          ? HOMEPAGE_SATELLITE_CONTEXT_RENDER_OPACITY_FACTOR
          : 1;
        const finalOpacityFactor = renderOpacityFactor * homepageEeOpacity;
        // Three-layer hex: faint identity fill, a crisp satellite-hue rim
        // (proud 0.96→1.04r), and a bright beam-level inner ring (tight
        // 0.78→0.84r).
        return (
          <group
            key={item.renderKey ?? `${item.cellId}-${item.satId}-${beamId}`}
            name={`sinr-live-cell-footprint-${item.cellId}-${beamId}`}
            position={[item.baseCenter.x, item.baseCenter.y + SINR_LIVE_FOOTPRINT_RING_Y_LIFT, item.baseCenter.z]}
            rotation={[-Math.PI / 2, 0, Math.PI / 6]}
            userData={{ footprintItem: true, cellId: item.cellId, satId: item.satId, beamId, color: roleColor, borderColor }}
          >
            <mesh name={`sinr-live-cell-footprint-fill-${item.cellId}`} renderOrder={8} frustumCulled={false}>
              <circleGeometry args={[radius, 6]} />
              <meshBasicMaterial
                color={roleColor}
                transparent
                opacity={SINR_LIVE_FOOTPRINT_FILL_OPACITY * finalOpacityFactor}
                side={THREE.DoubleSide}
                depthWrite={false}
                toneMapped={false}
                // Repeated same-satellite beams must not add RGB until the
                // family clips toward white. The homepage keeps the existing
                // fill carrier but composites it normally; other consumers
                // retain the established additive treatment.
                blending={homepageIdentity ? THREE.NormalBlending : THREE.AdditiveBlending}
              />
            </mesh>
            <mesh name={`sinr-live-cell-footprint-ring-${item.cellId}`} renderOrder={11} frustumCulled={false}>
              <ringGeometry args={[radius * SINR_LIVE_FOOTPRINT_RING_INNER_FACTOR, radius * SINR_LIVE_FOOTPRINT_RING_OUTER_FACTOR, 6]} />
              <meshBasicMaterial
                color={borderColor}
                transparent
                opacity={SINR_LIVE_FOOTPRINT_RING_OPACITY * finalOpacityFactor}
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
                opacity={SINR_LIVE_FOOTPRINT_INNER_BAND_OPACITY * finalOpacityFactor}
                side={THREE.DoubleSide}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            {homepageIdentity && resolveHandoverSide({ role: itemRole }) === 'target' ? (
              <mesh
                name={`sinr-live-cell-footprint-target-highlight-${item.cellId}-${beamId}`}
                renderOrder={16}
                frustumCulled={false}
                userData={{ targetHighlight: true, cellId: item.cellId, satId: item.satId, beamId }}
              >
                <ringGeometry args={[radius * 1.075, radius * 1.13, 6]} />
                <meshBasicMaterial
                  color={roleColor}
                  transparent
                  opacity={Math.min(1, 0.94 * finalOpacityFactor)}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
            ) : null}
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
