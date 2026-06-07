/**
 * SINR-live earth-fixed cell-truth beam cones — S-cells-3 RENDER (+ S-cells-3b
 * geometry/colour fix).
 *
 * Authority: `docs/sinr-live-earth-fixed-cells-mini-sdd.md` §5.5 + the LOCKED
 * decisions A1 (no S0 unanchor) + B3 (hybrid serving truth). This is the visible
 * "UE off-centre" milestone: the SINR-live lane stops gluing a steered beam onto
 * the UE and instead draws one cone per SERVED earth-fixed cell — apex at the
 * serving satellite, base a FLAT footprint disc on the ground at the cell centre.
 * UE markers stay at their true positions, so a UE sits visibly off-centre inside
 * its cell footprint = the real off-axis angle.
 *
 * GEOMETRY (S-cells-3b): the cone is OBLIQUE — apex at the (off-nadir) satellite,
 * base ring lying FLAT on the ground plane (y = 0) around the cell centre. This is
 * the physically faithful beam shape: the footprint a slanted beam paints on the
 * ground is a flat disc, not a cross-section disc tilted perpendicular to the beam
 * axis (which is what a right `coneGeometry` would draw). THREE's `coneGeometry`
 * cannot do an oblique cone, so we build the side surface directly (apex → ground
 * ring fan). `meshBasicMaterial` is unlit, so no normals are needed.
 *
 * COLOUR (S-cells-3b): by FREQUENCY-REUSE colour (`cellId mod reuse`, via
 * `frequencyReuseColor`), the same legend `EarthFixedCells` uses — NOT the serving
 * satellite tint (which collapses to one colour when a single satellite is
 * overhead). Adjacent cells get distinct reuse colours.
 *
 * Serving truth = `frame.sinrLiveCells` (S-cells-1/2: per-cell serving sat by
 * SINR + the sinr-offset `HandoverManager`). It is **NOT** the round-robin
 * `useCellSchedule` / `cellScheduler` (codex BLOCK-3) — that display oracle stays
 * MODQN-lane-only (`CellBeamCones.tsx`) and is untouched here. This component
 * never imports it.
 *
 * NOT MODQN/paper proof — leo's OWN live SINR-offset surface at 550 km (§7).
 */
import { useLayoutEffect, useRef, type JSX } from 'react';
import * as THREE from 'three';
import { frequencyReuseColor } from '../constants/beamRoleTokens';
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
  /**
   * Focus-subset (S-cells-4b): draw only these satellites' illuminated beams —
   * the focused / current-handover satellite, ~2–7 clean cones. `null`/empty →
   * the resolver falls back to the single most-illuminating satellite so the lane
   * always shows a bounded beam fan. The SERVICE BREADTH (all served UEs) is
   * carried by the UE mosaic, NOT by drawing a cone per served cell — drawing the
   * focus subset is a legitimate display filter, the serving TRUTH is unchanged
   * (CLAUDE.md Rule#6).
   */
  readonly focusSatIds?: ReadonlySet<string> | null;
}

export interface SinrLiveCellBeamConeRenderItem {
  readonly cellId: number;
  readonly satId: string;
  /** Stable geographic frequency colour index (`cellId mod reuse`). */
  readonly frequencyIndex: number;
  /** Frequency-reuse colour (legend parity with `EarthFixedCells`). */
  readonly color: string;
  /** True when this sat is the cell's chosen serving sat (brighter cone); false = illuminating only. */
  readonly serving: boolean;
  /** Cone apex = illuminating satellite world position. */
  readonly apex: THREE.Vector3;
  /** Cone base centre = FIXED cell centre on the ground plane (y = 0). */
  readonly baseCenter: THREE.Vector3;
  readonly baseRadiusWorld: number;
}

/** Segments around the flat ground footprint ring. */
const OBLIQUE_CONE_SEGMENTS = 32;
/** A SERVING beam (its sat is the cell's chosen serving sat) — the lane's primary beam render. */
const SINR_LIVE_CELL_SERVING_CONE_OPACITY = 0.32;
/** A beam that illuminates a cell it does NOT serve — fainter, to read as "lit, not connected". */
const SINR_LIVE_CELL_ILLUMINATED_CONE_OPACITY = 0.2;

/**
 * Build the OBLIQUE beam-cone side surface as a triangle soup: apex (satellite)
 * fanned to a flat ground ring (y = `baseCenter.y`, i.e. 0) of `radius` around the
 * cell centre. Returns a packed position `Float32Array` (3 verts × `segments`
 * triangles). `meshBasicMaterial` is unlit → no normals needed.
 */
export function buildObliqueBeamConePositions(
  apex: THREE.Vector3,
  baseCenter: THREE.Vector3,
  radius: number,
  segments: number = OBLIQUE_CONE_SEGMENTS,
): Float32Array {
  const out = new Float32Array(segments * 9);
  for (let i = 0; i < segments; i += 1) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const o = i * 9;
    out[o] = apex.x;
    out[o + 1] = apex.y;
    out[o + 2] = apex.z;
    out[o + 3] = baseCenter.x + radius * Math.cos(a0);
    out[o + 4] = baseCenter.y;
    out[o + 5] = baseCenter.z + radius * Math.sin(a0);
    out[o + 6] = baseCenter.x + radius * Math.cos(a1);
    out[o + 7] = baseCenter.y;
    out[o + 8] = baseCenter.z + radius * Math.sin(a1);
  }
  return out;
}

/**
 * Resolve the FOCUS satellite set: if `focusSatIds` names satellites that
 * actually illuminate a beam this slot, use those; otherwise fall back to the
 * single most-illuminating satellite (deterministic tie-break by satId ascending),
 * so the lane always shows a bounded beam fan even when no UE-driven focus is
 * available. Mirrors the modqn `resolveFocusSatelliteId` idea.
 */
export function resolveSinrLiveConeFocusSatIds(
  beams: readonly { readonly satId: string }[],
  focusSatIds: ReadonlySet<string> | null | undefined,
): ReadonlySet<string> {
  if (focusSatIds && focusSatIds.size > 0) {
    const present = new Set<string>();
    for (const beam of beams) if (focusSatIds.has(beam.satId)) present.add(beam.satId);
    if (present.size > 0) return present;
  }
  const countBySat = new Map<string, number>();
  for (const beam of beams) countBySat.set(beam.satId, (countBySat.get(beam.satId) ?? 0) + 1);
  let bestSatId: string | null = null;
  let bestCount = -1;
  for (const [satId, count] of countBySat) {
    if (count > bestCount || (count === bestCount && (bestSatId === null || satId < bestSatId))) {
      bestSatId = satId;
      bestCount = count;
    }
  }
  return bestSatId === null ? new Set<string>() : new Set([bestSatId]);
}

/**
 * Pure resolver: one cone per ILLUMINATED beam of the FOCUS satellite(s) — apex =
 * illuminating sat, base = fixed cell centre on the ground. This draws "where the
 * focus sat's beams point" (the ~7 hopping beams), NOT only the cells that ended
 * up served — a serving beam is brighter, a merely-illuminating beam fainter. The
 * focus subset keeps the scene to ~2–7 clean cones (Rule#6 display filter; serving
 * truth unchanged). A beam whose sat is not RENDERED (capped out of
 * `satelliteWorldById`) or whose cell placement is missing is skipped. Idle cells
 * (not lit this slot) have no illuminated beam → no cone (honest under K<N).
 * Deterministic in beam order. Colour = frequency-reuse colour (NOT serving-sat tint).
 */
export function resolveSinrLiveCellBeamConeItems(
  props: SinrLiveCellBeamConesProps,
): readonly SinrLiveCellBeamConeRenderItem[] {
  const { cellFrame, placementByCellId, satelliteWorldById, focusSatIds } = props;
  if (!cellFrame) return [];
  const beams = cellFrame.illuminatedBeams;
  if (beams.length === 0) return [];

  const focus = resolveSinrLiveConeFocusSatIds(beams, focusSatIds);
  if (focus.size === 0) return [];

  const items: SinrLiveCellBeamConeRenderItem[] = [];
  for (const beam of beams) {
    if (!focus.has(beam.satId)) continue; // focus-subset: only the focused sat's beams
    const placement = placementByCellId.get(beam.cellId);
    const satWorld = satelliteWorldById.get(beam.satId);
    if (!placement || !satWorld) continue; // illuminating sat not rendered → can't place a cone
    if (placement.radiusWorld <= 0) continue;

    const apex = new THREE.Vector3(satWorld.x, satWorld.y, satWorld.z);
    const baseCenter = new THREE.Vector3(placement.worldX, 0, placement.worldZ);
    if (apex.distanceTo(baseCenter) <= 1e-6) continue;

    items.push({
      cellId: beam.cellId,
      satId: beam.satId,
      frequencyIndex: beam.frequencyIndex,
      color: frequencyReuseColor(beam.frequencyIndex),
      serving: beam.serving,
      apex,
      baseCenter,
      baseRadiusWorld: placement.radiusWorld,
    });
  }
  return items;
}

export function resolveSinrLiveCellBeamConeRenderCount(props: SinrLiveCellBeamConesProps): number {
  return resolveSinrLiveCellBeamConeItems(props).length;
}

export function resolveSinrLiveCellBeamConeSatelliteCount(props: SinrLiveCellBeamConesProps): number {
  return new Set(resolveSinrLiveCellBeamConeItems(props).map(item => item.satId)).size;
}

export interface SinrLiveCellBeamConesRenderProps {
  /** Pre-resolved cone items (memoised once by the caller — see `MainScene`). */
  readonly items: readonly SinrLiveCellBeamConeRenderItem[];
  readonly visible?: boolean;
}

/**
 * One oblique cone mesh. The satellite (apex) moves every frame, so the position
 * buffer changes every frame. We own the geometry via a ref and write the buffer
 * imperatively in `useLayoutEffect` (in-place + `needsUpdate` when the length is
 * unchanged), rather than relying on R3F to reconstruct a `<bufferAttribute>` from
 * a new `args` array — that guarantees a persistent cone's apex TRACKS the moving
 * satellite instead of freezing at a stale position.
 */
function ObliqueConeMesh(props: { cone: SinrLiveCellBeamConeRenderItem }): JSX.Element {
  const { cone } = props;
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  const positions = buildObliqueBeamConePositions(cone.apex, cone.baseCenter, cone.baseRadiusWorld);

  useLayoutEffect(() => {
    const geometry = geometryRef.current;
    if (!geometry) return;
    const existing = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (existing && existing.array.length === positions.length) {
      (existing.array as Float32Array).set(positions);
      existing.needsUpdate = true;
    } else {
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    }
    geometry.computeBoundingSphere();
  }, [positions]);

  return (
    <mesh
      name={`sinr-live-cell-beam-cone-${cone.cellId}`}
      renderOrder={10}
      frustumCulled={false}
      userData={{
        cellId: cone.cellId,
        satId: cone.satId,
        frequencyIndex: cone.frequencyIndex,
        serving: cone.serving,
        baseCenterWorld: [cone.baseCenter.x, cone.baseCenter.y, cone.baseCenter.z],
        baseRadiusWorld: cone.baseRadiusWorld,
        color: cone.color,
      }}
    >
      <bufferGeometry ref={geometryRef} />
      <meshBasicMaterial
        color={cone.color}
        transparent
        opacity={cone.serving ? SINR_LIVE_CELL_SERVING_CONE_OPACITY : SINR_LIVE_CELL_ILLUMINATED_CONE_OPACITY}
        blending={THREE.NormalBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

export function SinrLiveCellBeamCones(props: SinrLiveCellBeamConesRenderProps): JSX.Element | null {
  if (props.visible === false) return null;

  const cones = props.items;

  return (
    <group name="sinr-live-cell-beam-cones" userData={{ coneCount: cones.length }}>
      {cones.map(cone => (
        <ObliqueConeMesh key={`${cone.cellId}-${cone.satId}`} cone={cone} />
      ))}
    </group>
  );
}
