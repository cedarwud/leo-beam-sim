/**
 * SINR-live earth-fixed cell-truth beam cones — S-cells-3 RENDER.
 *
 * Authority: `docs/sinr-live-earth-fixed-cells-mini-sdd.md` §5.5 + the LOCKED
 * decisions A1 (no S0 unanchor) + B3 (hybrid serving truth). This is the visible
 * "UE off-centre" milestone: the SINR-live lane stops gluing a steered beam onto
 * the UE and instead draws one cone per SERVED earth-fixed cell — apex at the
 * serving satellite, base at the FIXED cell centre, axis = sat→cell tilt (the
 * real "波束變型"). UE markers stay at their true positions, so a UE sits visibly
 * off-centre inside its cell footprint = the real off-axis angle.
 *
 * Serving truth = `frame.sinrLiveCells` (S-cells-1/2: per-cell serving sat by
 * SINR + the sinr-offset `HandoverManager`). It is **NOT** the round-robin
 * `useCellSchedule` / `cellScheduler` (codex BLOCK-3) — that display oracle stays
 * MODQN-lane-only (`CellBeamCones.tsx`) and is untouched here. This component
 * never imports it.
 *
 * Lane ownership: mounted by `MainScene` only under the `showSinrLiveCellBeams`
 * render-plan flag (sinr-live + live-sim). It is a DISTINCT layer from the MODQN
 * `showCellOverlay` cones — the two never co-mount.
 *
 * NOT MODQN/paper proof — leo's OWN live SINR-offset surface at 550 km (§7).
 */
import type { JSX } from 'react';
import * as THREE from 'three';
import type { SinrLiveCellFrame } from '../scene/sinrLiveCellModel';
import type { WorldPoint } from './CellFootprints';

/**
 * A fixed earth-fixed cell's ground placement in scene-world coords. Built by
 * `MainScene` from the SAME `buildSinrLiveCellLayout(profile)` the runtime cell
 * truth uses, so `cellId` matches `frame.sinrLiveCells.cells[].cellId`, and from
 * the SAME `worldUnitsPerKm` the UE markers use (east → +X, north → −Z), so a
 * cone base and its UE markers share one frame.
 */
export interface SinrLiveCellPlacement {
  readonly cellId: number;
  readonly worldX: number;
  readonly worldZ: number;
  readonly radiusWorld: number;
}

export interface SinrLiveCellBeamConesProps {
  /** The cell truth for this frame; `undefined` off the sinr-live lane (no cones). */
  readonly cellFrame: SinrLiveCellFrame | undefined;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
  readonly satelliteTintById: ReadonlyMap<string, string>;
  readonly visible?: boolean;
}

export interface SinrLiveCellBeamConeRenderItem {
  readonly cellId: number;
  readonly satId: string;
  /** Stable geographic frequency colour (`cellId mod reuse`) for legend parity. */
  readonly frequencyIndex: number;
  readonly color: string;
  /** Cone apex = serving satellite world position. */
  readonly apex: THREE.Vector3;
  /** Cone base = FIXED cell centre on the ground plane (y = 0). */
  readonly baseCenter: THREE.Vector3;
  readonly midpoint: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly heightWorld: number;
  readonly baseRadiusWorld: number;
}

const CONE_SEGMENTS = 24;
/** Raised vs the faint 0.1 MODQN overlay (SDD §5.5) — this is the lane's primary beam render. */
const SINR_LIVE_CELL_CONE_OPACITY = 0.16;
const FALLBACK_CONE_COLOR = '#7dd3fc';
const LOCAL_BASE = new THREE.Vector3(0, -1, 0);

/**
 * Pure resolver: one cone per SERVED cell, apex = serving sat, base = fixed cell
 * centre. Idle cells (`servingSatId === null`) draw no cone (honest under K<N).
 * A served cell whose serving sat is not currently RENDERED (capped out of
 * `satelliteWorldById`) or whose placement is missing is skipped — we cannot
 * place a cone without the sat's world position. Deterministic in cell order.
 */
export function resolveSinrLiveCellBeamConeItems(
  props: Omit<SinrLiveCellBeamConesProps, 'visible'>,
): readonly SinrLiveCellBeamConeRenderItem[] {
  const { cellFrame, placementByCellId, satelliteWorldById, satelliteTintById } = props;
  if (!cellFrame) return [];

  const items: SinrLiveCellBeamConeRenderItem[] = [];
  for (const cell of cellFrame.cells) {
    if (cell.servingSatId === null) continue; // idle cell — no cone (honest)
    const placement = placementByCellId.get(cell.cellId);
    const satWorld = satelliteWorldById.get(cell.servingSatId);
    if (!placement || !satWorld) continue; // serving sat not rendered → can't place a cone
    if (placement.radiusWorld <= 0) continue;

    const apex = new THREE.Vector3(satWorld.x, satWorld.y, satWorld.z);
    const baseCenter = new THREE.Vector3(placement.worldX, 0, placement.worldZ);
    const heightWorld = apex.distanceTo(baseCenter);
    if (heightWorld <= 1e-6) continue;

    const axisSatToCell = baseCenter.clone().sub(apex).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(LOCAL_BASE, axisSatToCell);
    const midpoint = apex.clone().lerp(baseCenter, 0.5);

    items.push({
      cellId: cell.cellId,
      satId: cell.servingSatId,
      frequencyIndex: cell.frequencyIndex,
      color: satelliteTintById.get(cell.servingSatId) ?? FALLBACK_CONE_COLOR,
      apex,
      baseCenter,
      midpoint,
      quaternion,
      heightWorld,
      baseRadiusWorld: placement.radiusWorld,
    });
  }
  return items;
}

export function resolveSinrLiveCellBeamConeRenderCount(
  props: Omit<SinrLiveCellBeamConesProps, 'visible'>,
): number {
  return resolveSinrLiveCellBeamConeItems(props).length;
}

export function resolveSinrLiveCellBeamConeSatelliteCount(
  props: Omit<SinrLiveCellBeamConesProps, 'visible'>,
): number {
  return new Set(resolveSinrLiveCellBeamConeItems(props).map(item => item.satId)).size;
}

export interface SinrLiveCellBeamConesRenderProps {
  /** Pre-resolved cone items (memoised once by the caller — see `MainScene`). */
  readonly items: readonly SinrLiveCellBeamConeRenderItem[];
  readonly visible?: boolean;
}

export function SinrLiveCellBeamCones(props: SinrLiveCellBeamConesRenderProps): JSX.Element | null {
  if (props.visible === false) return null;

  const cones = props.items;

  return (
    <group name="sinr-live-cell-beam-cones" userData={{ coneCount: cones.length }}>
      {cones.map(cone => (
        <group
          key={`${cone.cellId}-${cone.satId}`}
          name={`sinr-live-cell-beam-cone-${cone.cellId}`}
          userData={{
            cellId: cone.cellId,
            satId: cone.satId,
            frequencyIndex: cone.frequencyIndex,
            apexWorld: [cone.apex.x, cone.apex.y, cone.apex.z],
            baseCenterWorld: [cone.baseCenter.x, cone.baseCenter.y, cone.baseCenter.z],
            baseRadiusWorld: cone.baseRadiusWorld,
            heightWorld: cone.heightWorld,
            color: cone.color,
          }}
        >
          <mesh
            position={[cone.midpoint.x, cone.midpoint.y, cone.midpoint.z]}
            quaternion={cone.quaternion}
            renderOrder={10}
            frustumCulled={false}
          >
            <coneGeometry args={[cone.baseRadiusWorld, cone.heightWorld, CONE_SEGMENTS, 1, true]} />
            <meshBasicMaterial
              color={cone.color}
              transparent
              opacity={SINR_LIVE_CELL_CONE_OPACITY}
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
