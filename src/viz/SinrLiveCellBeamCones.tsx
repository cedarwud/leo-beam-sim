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
 * COLOUR (S-cells-4b-fix2): by FREQUENCY-REUSE colour (`cellId mod reuse`, via
 * `frequencyReuseColor`) — so a satellite's beam fan shows the multi-colour
 * multibeam frequency-reuse pattern (adjacent cells use different frequencies),
 * NOT a single per-satellite tint. (The brief satellite-tint attempt made every
 * satellite's fan mono; the "weird tone" it was meant to cure was actually the
 * idle illuminating-only ghost cones — those are gone here, so the frequency
 * palette reads cleanly. Satellite identity is still legible: a satellite's cones
 * all converge at its apex.)
 *
 * Serving truth = `frame.sinrLiveCells` (S-cells-1/2: per-cell serving sat by
 * SINR + the sinr-offset `HandoverManager`). It is **NOT** the round-robin
 * `useCellSchedule` / `cellScheduler` (codex BLOCK-3) — that display oracle stays
 * MODQN-lane-only (`CellBeamCones.tsx`) and is untouched here. This component
 * never imports it.
 *
 * NOT MODQN/paper proof — leo's OWN live SINR-offset surface at 550 km (§7).
 */
import { useEffect, useLayoutEffect, useRef, type JSX } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { frequencyReuseColor } from '../constants/beamRoleTokens';
import type { SinrLiveCellFrame } from '../scene/sinrLiveCellModel';
import type { RuntimeCandidateHighlightCommand } from '../scene/types';
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
   * Optional focus narrowing (S-cells-4b-fix): when provided + non-empty, draw only
   * these satellites' SERVING beams (e.g. the cinema's handover pair). When omitted /
   * null / empty the lane draws EVERY serving satellite's serving beams — so a sat
   * that is serving always shows its beam (the regression this replaces hid the
   * serving sat behind a "most-illuminating" fallback). Narrowing is a legitimate
   * display filter; the serving TRUTH is unchanged (CLAUDE.md Rule#6).
   */
  readonly focusSatIds?: ReadonlySet<string> | null;
}

export interface SinrLiveCellBeamConeRenderItem {
  readonly cellId: number;
  readonly satId: string;
  /** Stable geographic frequency colour index (`cellId mod reuse`). */
  readonly frequencyIndex: number;
  /** Frequency-reuse colour (the multibeam frequency pattern; NOT a per-sat tint). */
  readonly color: string;
  /** Always true on this render path — only SERVING beams draw a cone. */
  readonly serving: boolean;
  /** Cone apex = serving satellite world position. */
  readonly apex: THREE.Vector3;
  /** Cone base centre = FIXED cell centre on the ground plane (y = 0). */
  readonly baseCenter: THREE.Vector3;
  readonly baseRadiusWorld: number;
}

/** Segments around the flat ground footprint ring. */
const OBLIQUE_CONE_SEGMENTS = 32;
/**
 * Cone opacity for NORMAL blending. Additive blending could not show EVERY serving
 * satellite without washing out (it accumulates: at all-sats, 0.06 was too faint
 * yet 0.08 already blew out — no usable middle). NormalBlending alpha-composites
 * each cone to a BOUNDED, uniform translucency (overlaps darken but never white
 * out), so all connected sats can show a beam at one moderate, readable opacity.
 */
const SINR_LIVE_CELL_CONE_OPACITY = 0.22;

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
 * Focus subset: pick the top `maxSats` satellites by SERVED-CELL count
 * (deterministic; tie-break satId ascending) + a force-included `preferredSatId`
 * (the primary UE's serving sat) — real serving sats, NOT the old "most-illuminating"
 * fallback that drew the wrong sat. The ambient lane currently passes a HIGH cap (it
 * shows every connected sat's beam via NormalBlending without washout), so this
 * narrowing is reserved for the CINEMA (c2) to spotlight the handover pair. Continuity
 * keeps the chosen set stable frame-to-frame. Breadth of who-is-served stays in the
 * UE mosaic (Rule#6 display filter; serving truth unchanged).
 */
export function resolveTopServingFocusSatIds(
  cellFrame: SinrLiveCellFrame | undefined,
  maxSats: number,
  preferredSatId: string | null,
): ReadonlySet<string> {
  if (!cellFrame || maxSats <= 0) return new Set<string>();
  const servedCountBySat = new Map<string, number>();
  for (const cell of cellFrame.cells) {
    if (cell.servingSatId === null) continue;
    servedCountBySat.set(cell.servingSatId, (servedCountBySat.get(cell.servingSatId) ?? 0) + 1);
  }
  if (servedCountBySat.size === 0) return new Set<string>();
  const ranked = [...servedCountBySat.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([satId]) => satId);
  const chosen: string[] = [];
  if (preferredSatId !== null && servedCountBySat.has(preferredSatId)) chosen.push(preferredSatId);
  for (const satId of ranked) {
    if (chosen.length >= maxSats) break;
    if (!chosen.includes(satId)) chosen.push(satId);
  }
  return new Set(chosen);
}

/**
 * Pure resolver: one cone per SERVING beam — apex = the serving satellite, base =
 * the FIXED served-cell centre on the ground. EVERY serving satellite draws its
 * serving beams, so a satellite that is serving always shows its beam (no
 * "serving sat with no beam" — the regression this replaces narrowed to one
 * fallback sat and drew idle/illuminating-only cones). Idle cells (not served this
 * slot) draw no cone (honest under K<N hopping). `focusSatIds`, when provided +
 * non-empty, narrows to those satellites (e.g. the cinema handover pair) — a
 * legitimate display filter, the serving truth is unchanged. A serving sat not
 * RENDERED (absent from `satelliteWorldById`) or a cell with no placement is
 * skipped. Deterministic in beam order. Colour = serving-satellite tint (matches
 * the satellite marker).
 */
export function resolveSinrLiveCellBeamConeItems(
  props: SinrLiveCellBeamConesProps,
): readonly SinrLiveCellBeamConeRenderItem[] {
  const { cellFrame, placementByCellId, satelliteWorldById, focusSatIds } = props;
  if (!cellFrame) return [];
  const narrow = focusSatIds && focusSatIds.size > 0 ? focusSatIds : null;

  const items: SinrLiveCellBeamConeRenderItem[] = [];
  for (const beam of cellFrame.illuminatedBeams) {
    if (!beam.serving) continue; // draw only SERVING beams (the serving sat → its served cell)
    if (narrow && !narrow.has(beam.satId)) continue; // optional cinema narrowing
    const placement = placementByCellId.get(beam.cellId);
    const satWorld = satelliteWorldById.get(beam.satId);
    if (!placement || !satWorld) continue; // serving sat not rendered → can't place a cone
    if (placement.radiusWorld <= 0) continue;

    const apex = new THREE.Vector3(satWorld.x, satWorld.y, satWorld.z);
    const baseCenter = new THREE.Vector3(placement.worldX, 0, placement.worldZ);
    if (apex.distanceTo(baseCenter) <= 1e-6) continue;

    items.push({
      cellId: beam.cellId,
      satId: beam.satId,
      frequencyIndex: beam.frequencyIndex,
      color: frequencyReuseColor(beam.frequencyIndex),
      serving: true,
      apex,
      baseCenter,
      baseRadiusWorld: placement.radiusWorld,
    });
  }
  return items;
}

function buildPairConeItem(input: {
  readonly satId: string;
  readonly cellId: number | null | undefined;
  readonly frequencyIndex: number | null | undefined;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
}): SinrLiveCellBeamConeRenderItem | null {
  if (input.cellId == null) return null;
  const placement = input.placementByCellId.get(input.cellId);
  const satWorld = input.satelliteWorldById.get(input.satId);
  if (!placement || !satWorld || placement.radiusWorld <= 0) return null;

  const apex = new THREE.Vector3(satWorld.x, satWorld.y, satWorld.z);
  const baseCenter = new THREE.Vector3(placement.worldX, 0, placement.worldZ);
  if (apex.distanceTo(baseCenter) <= 1e-6) return null;
  const frequencyIndex = input.frequencyIndex ?? input.cellId;
  return {
    cellId: input.cellId,
    satId: input.satId,
    frequencyIndex,
    color: frequencyReuseColor(frequencyIndex),
    serving: true,
    apex,
    baseCenter,
    baseRadiusWorld: placement.radiusWorld,
  };
}

/**
 * D4 S3a focused cinema resolver: draw ONLY the old/new cell-truth pair named by
 * the focused handover event. This does not unpark the ambient cell-cone layer;
 * it is a bounded, focus-scoped display of event-owned `sinrLiveCells` geometry.
 */
export function resolveSinrLiveCellHandoverPairConeItems(input: {
  readonly candidate: RuntimeCandidateHighlightCommand | null | undefined;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
}): readonly SinrLiveCellBeamConeRenderItem[] {
  const { candidate } = input;
  if (!candidate || candidate.sourceOwner !== 'sinr-live-cell-truth') return [];
  const from = buildPairConeItem({
    satId: candidate.fromSatId,
    cellId: candidate.fromCellId,
    frequencyIndex: candidate.fromFrequencyIndex,
    placementByCellId: input.placementByCellId,
    satelliteWorldById: input.satelliteWorldById,
  });
  const to = buildPairConeItem({
    satId: candidate.toSatId,
    cellId: candidate.toCellId,
    frequencyIndex: candidate.toFrequencyIndex,
    placementByCellId: input.placementByCellId,
    satelliteWorldById: input.satelliteWorldById,
  });
  return [from, to].filter((item): item is SinrLiveCellBeamConeRenderItem => item !== null);
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
  readonly telemetryCountDatasetKey?: string;
  readonly telemetrySourceOwnerDatasetKey?: string;
  readonly telemetrySourceOwner?: string;
  readonly telemetryEventIdDatasetKey?: string;
  readonly telemetryEventId?: string;
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
        opacity={SINR_LIVE_CELL_CONE_OPACITY}
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

  const gl = useThree(state => state.gl);
  const groupRef = useRef<THREE.Group>(null);
  const cones = props.items;

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
    if (props.telemetrySourceOwnerDatasetKey) {
      gl.domElement.dataset[props.telemetrySourceOwnerDatasetKey] = props.telemetrySourceOwner ?? '';
    }
    if (props.telemetryEventIdDatasetKey) {
      gl.domElement.dataset[props.telemetryEventIdDatasetKey] = props.telemetryEventId ?? '';
    }
  });

  useEffect(() => () => {
    if (props.telemetryCountDatasetKey) delete gl.domElement.dataset[props.telemetryCountDatasetKey];
    if (props.telemetrySourceOwnerDatasetKey) delete gl.domElement.dataset[props.telemetrySourceOwnerDatasetKey];
    if (props.telemetryEventIdDatasetKey) delete gl.domElement.dataset[props.telemetryEventIdDatasetKey];
  }, [
    gl,
    props.telemetryCountDatasetKey,
    props.telemetrySourceOwnerDatasetKey,
    props.telemetryEventIdDatasetKey,
  ]);

  return (
    <group ref={groupRef} name="sinr-live-cell-beam-cones" userData={{ coneCount: cones.length }}>
      {cones.map(cone => (
        <ObliqueConeMesh key={`${cone.cellId}-${cone.satId}`} cone={cone} />
      ))}
    </group>
  );
}
