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
import {
  SINR_LIVE_CONE_AMBIENT_OPACITY,
  SINR_LIVE_CONE_BASE_ALPHA_FACTOR,
  SINR_LIVE_CONE_BLENDING,
  SINR_LIVE_CONE_PULSE_PEAK_OPACITY,
  SINR_LIVE_CONE_SEGMENTS,
} from '../constants/sinrLiveConeStyle';
import { cellFrequencyIndex, type SinrLiveCellFrame, type SinrLiveCellHandoverEvent } from '../scene/sinrLiveCellModel';
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
  /**
   * Optional PER-ITEM opacity override (G2c live-pulse). When present, the mesh
   * uses it instead of the group's shared `opacity`, so a single mount can render
   * cones at independent brightness (each handover pulse fades by its own age).
   * Omitted on the ambient/pair layers (they use one group opacity).
   */
  readonly opacity?: number;
  /**
   * Optional STABLE React key (G2c live-pulse). The pulse layer can carry the same
   * `(cellId, satId)` twice in one frame (old + new of distinct events), so it sets
   * a per-event/side key here. The ambient + cinema-pair layers OMIT it so they keep
   * the content-stable `${cellId}-${satId}` key (one serving sat per cell) — never an
   * array index, which would remount every cone when the serving set reorders on a
   * beam hop and defeat the persistent-mesh in-place buffer update.
   */
  readonly renderKey?: string;
}

/**
 * Build the OBLIQUE beam-cone side surface as a triangle soup: apex (satellite)
 * fanned to a flat ground ring (y = `baseCenter.y`, i.e. 0) of `radius` around the
 * cell centre. Returns a packed position `Float32Array` (3 verts × `segments`
 * triangles). `meshBasicMaterial` is unlit → no normals needed. Segment count +
 * cone opacity + blending live in `constants/sinrLiveConeStyle.ts` (S5-2 D-TOKEN).
 */
export function buildObliqueBeamConePositions(
  apex: THREE.Vector3,
  baseCenter: THREE.Vector3,
  radius: number,
  segments: number = SINR_LIVE_CONE_SEGMENTS,
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
 * G1-CONE-STYLE: per-vertex RGBA colours for the apex→base alpha fade. RGB is left
 * WHITE (1,1,1) so the mesh's `frequencyReuseColor` material colour is the only hue
 * source (vertex RGB × material colour = material colour); only ALPHA is graded —
 * 1.0 at the apex vertex of each triangle, {@link SINR_LIVE_CONE_BASE_ALPHA_FACTOR}
 * at the two ground-ring vertices. Mirrors {@link buildObliqueBeamConePositions}'
 * `[apex, baseA, baseB]` packing (4 components × 3 verts × `segments`). Static for a
 * given `segments`/`baseAlpha` (independent of geometry), so it is built once and
 * shared across every cone mesh.
 */
export function buildObliqueBeamConeVertexColors(
  segments: number = SINR_LIVE_CONE_SEGMENTS,
  baseAlpha: number = SINR_LIVE_CONE_BASE_ALPHA_FACTOR,
): Float32Array {
  const out = new Float32Array(segments * 12);
  for (let i = 0; i < segments; i += 1) {
    const o = i * 12;
    // apex vertex — full alpha
    out[o] = 1; out[o + 1] = 1; out[o + 2] = 1; out[o + 3] = 1;
    // base ring vertex A — faded alpha
    out[o + 4] = 1; out[o + 5] = 1; out[o + 6] = 1; out[o + 7] = baseAlpha;
    // base ring vertex B — faded alpha
    out[o + 8] = 1; out[o + 9] = 1; out[o + 10] = 1; out[o + 11] = baseAlpha;
  }
  return out;
}

/** Built once — the apex→base alpha gradient is identical for every cone. */
const CONE_VERTEX_COLORS = buildObliqueBeamConeVertexColors();

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

/**
 * G2c live-pulse fade: a handover-pulse cone's opacity as a function of its age
 * (`simTimeSec − event.sourceTimeSec`). Peak at age 0 (the frame it fires), linear
 * decay to 0 at the retention horizon, and 0 outside `[0, retentionSec]`. Pure so
 * the `:model` gate can VALUE-assert the curve (peak / midpoint / horizon). The
 * fade — not a fixed brightness — is what makes a fired handover read as a pulse.
 */
export function sinrLiveHandoverPulseOpacity(
  ageSec: number,
  retentionSec: number,
  peakOpacity: number = SINR_LIVE_CONE_PULSE_PEAK_OPACITY,
): number {
  // Finite guard FIRST: a NaN age (NaN simTimeSec) compares false to every bound,
  // so without this it would fall through to `peak * (1 - NaN)` = NaN and slip past
  // the resolver's `opacity <= 0` skip into a NaN material opacity. The model guards
  // simTimeSec finiteness elsewhere; mirror it here so the curve stays clamped to 0
  // outside its domain, exactly as documented.
  if (!Number.isFinite(ageSec) || !Number.isFinite(retentionSec) || retentionSec <= 0 || ageSec < 0 || ageSec > retentionSec) return 0;
  return peakOpacity * (1 - ageSec / retentionSec);
}

export interface SinrLiveHandoverPulseConeInput {
  /** This frame's recent real handovers (`frame.sinrLiveCells.recentHandoverEvents`). */
  readonly recentHandoverEvents: readonly SinrLiveCellHandoverEvent[] | undefined;
  /** This frame's sim-time; per-event age = `simTimeSec − event.sourceTimeSec`. */
  readonly simTimeSec: number;
  /** Retention window the model rolls the events over (fade reaches 0 here). */
  readonly retentionSec: number;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
  /**
   * The profile's frequency-reuse factor (`profile.beams.frequencyReuse`). The pulse
   * cone must take the cell's REAL frequency colour `cellFrequencyIndex(cellId, reuse)`
   * — the SAME index the ambient cone uses — so a pulse reads as that cone flaring,
   * not a different hue (the raw `cellId` would mis-map under the 6-colour palette).
   */
  readonly frequencyReuse: number;
  readonly peakOpacity?: number;
}

/**
 * G2c ambient live-handover PULSE resolver: turn the model's per-frame real
 * handovers into bright, age-faded cones on the old (handed-off) AND new (acquired)
 * cells of each event — the "handovers are happening" pulse on the faint ambient
 * field, with NO seek and NO camera move (decoupled from the director cinema). It
 * is a pure DISPLAY read-out of `recentHandoverEvents` (the same transitions the
 * model already classified + counted, Rule#6) — it fabricates no handover. Reuses
 * the same oblique-cone geometry the ambient + cinema-pair cones use
 * (`buildPairConeItem`), carrying a per-item age-faded `opacity`. Colour stays the
 * geographic frequency-reuse palette (via `buildPairConeItem`'s `cellId` fallback)
 * so a pulse reads as the SAME cone flaring, just brighter. An event past the
 * retention horizon, with a non-rendered sat, or an unplaced cell draws nothing.
 */
export function resolveSinrLiveHandoverPulseConeItems(
  input: SinrLiveHandoverPulseConeInput,
): readonly SinrLiveCellBeamConeRenderItem[] {
  const { recentHandoverEvents, simTimeSec, retentionSec, placementByCellId, satelliteWorldById, frequencyReuse } = input;
  if (!recentHandoverEvents || recentHandoverEvents.length === 0) return [];
  const peak = input.peakOpacity ?? SINR_LIVE_CONE_PULSE_PEAK_OPACITY;

  const items: SinrLiveCellBeamConeRenderItem[] = [];
  for (const event of recentHandoverEvents) {
    const opacity = sinrLiveHandoverPulseOpacity(simTimeSec - event.sourceTimeSec, retentionSec, peak);
    if (opacity <= 0) continue;
    // Per-event/side stable key: a UE can hand over more than once within the
    // retention window, so disambiguate by (ueId, sourceTimeSec, side) — never an
    // array index (which would remount cones on reorder).
    const eventKey = `${event.ueId}-${event.sourceTimeSec}`;
    // The NEW (acquired) cell always exists on a real HO; the OLD (handed-off) cell
    // exists for inter/intra (a cold attach is never emitted as a handover). Colour
    // each by the cell's REAL frequency-reuse index (matching the ambient cone), so a
    // pulse reads as that cone flaring rather than a different hue.
    const to = buildPairConeItem({
      satId: event.toSatId,
      cellId: event.toCellId,
      frequencyIndex: cellFrequencyIndex(event.toCellId, frequencyReuse),
      placementByCellId,
      satelliteWorldById,
    });
    if (to) items.push({ ...to, opacity, renderKey: `${eventKey}-to` });
    if (event.fromSatId !== null && event.fromCellId !== null) {
      const from = buildPairConeItem({
        satId: event.fromSatId,
        cellId: event.fromCellId,
        frequencyIndex: cellFrequencyIndex(event.fromCellId, frequencyReuse),
        placementByCellId,
        satelliteWorldById,
      });
      if (from) items.push({ ...from, opacity, renderKey: `${eventKey}-from` });
    }
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
  /**
   * Cone opacity (S5-2 hybrid, D-STYLE A): the ambient all-serving layer uses the
   * default {@link SINR_LIVE_CONE_AMBIENT_OPACITY}; the focused cinema handover
   * pair passes {@link SINR_LIVE_CONE_PAIR_OPACITY} so it reads BRIGHT over the
   * faint ambient field. Defaulted, not required, so the ambient mount stays terse.
   */
  readonly opacity?: number;
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
function ObliqueConeMesh(props: { cone: SinrLiveCellBeamConeRenderItem; opacity: number }): JSX.Element {
  const { cone, opacity } = props;
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
    // G1-CONE-STYLE: the apex→base alpha gradient is a static RGBA vertex-colour
    // buffer (identical for every cone), set once. The material's vertexColors
    // multiplies it, so the apex stays at the per-cone opacity and the ground ring
    // fades — only alpha varies (RGB is white), so the hue is untouched.
    if (!geometry.getAttribute('color')) {
      geometry.setAttribute('color', new THREE.BufferAttribute(CONE_VERTEX_COLORS, 4));
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
        opacity,
      }}
    >
      <bufferGeometry ref={geometryRef} />
      <meshBasicMaterial
        color={cone.color}
        vertexColors
        transparent
        opacity={opacity}
        blending={SINR_LIVE_CONE_BLENDING}
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
  const opacity = props.opacity ?? SINR_LIVE_CONE_AMBIENT_OPACITY;

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
    <group ref={groupRef} name="sinr-live-cell-beam-cones" userData={{ coneCount: cones.length, opacity }}>
      {cones.map(cone => (
        // G2c: a per-item `opacity` (the live-pulse age-fade) overrides the group
        // opacity so one mount can render cones at independent brightness. Key is the
        // content-stable `${cellId}-${satId}` for the ambient/pair layers (so a cone
        // reconciles in place across a beam-hop reorder — keeps the persistent-mesh
        // in-place buffer update); the pulse layer, which can carry the same
        // (cell, sat) twice in one frame, supplies its own stable `renderKey`.
        <ObliqueConeMesh
          key={cone.renderKey ?? `${cone.cellId}-${cone.satId}`}
          cone={cone}
          opacity={cone.opacity ?? opacity}
        />
      ))}
    </group>
  );
}
