/**
 * SINR-live earth-fixed cell-truth beam cones — S-cells-3 RENDER (+ S-cells-3b
 * geometry/colour fix).
 *
 * Authority: `docs/sinr-live-earth-fixed-cells-mini-sdd.md` §5.5 + the LOCKED
 * decisions A1 (no S0 unanchor) + B3 (hybrid serving truth). This is the visible
 * "UE off-centre" milestone: the SINR-live lane stops gluing a steered beam onto
 * the UE and instead draws one cone per SERVED earth-fixed cell — apex at the
 * serving satellite, base a FLAT elliptical footprint on the ground at the resolved
 * beam centre.
 * UE markers stay at their true positions, so a UE sits visibly off-centre inside
 * its cell footprint = the real off-axis angle.
 *
 * GEOMETRY (S-cells-3b): the cone is OBLIQUE — apex at the (off-nadir) satellite,
 * base ring lying FLAT on the ground plane (y = 0) around the resolved beam centre.
 * This is the physically faithful beam shape: the footprint a slanted beam paints
 * on the ground is a flat ellipse, not a cross-section disc tilted perpendicular
 * to the beam axis (which is what a right `coneGeometry` would draw). THREE's `coneGeometry`
 * cannot do an oblique cone, so we build the side surface directly (apex → ground
 * ring fan). `meshBasicMaterial` is unlit, so no normals are needed.
 *
 * COLOUR: the live lane uses the resolver item's stable (satellite, beam) identity
 * colour. A satellite owns one hue family and beam IDs select nearby lightness
 * shades, so an intra handover is a shade transition while an inter handover is a
 * family transition. The mount still resolves role/state opacity and animation;
 * `colorAuthority="item-identity"` prevents transient serving/candidate roles from
 * recolouring the geometry. The geographic frequency-reuse palette remains retired
 * from this lane (kept in `sinrLiveConeStyle` for a future frequency-plan mode).
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
import {
  SINR_LIVE_CANDIDATE_FAN_MAX_CONES,
  SINR_LIVE_CONE_BASE_ALPHA_FACTOR,
  SINR_LIVE_CONE_BLENDING,
  SINR_LIVE_CONE_PULSE_PEAK_OPACITY,
  SINR_LIVE_CONE_SEGMENTS,
  resolveSinrLiveConeElevationDimFactor,
  resolveSinrLiveConeRoleStyle,
  type SinrLiveConePalette,
  type SinrLiveConeRole,
} from '../constants/sinrLiveConeStyle';
import { colorForServingBeam } from '../constants/servingColour';
import {
  homepageSatelliteBeamColor,
  homepageEeVisualOpacity,
  HOMEPAGE_SATELLITE_CONTEXT_RENDER_OPACITY_FACTOR,
} from '../homepage/controller/homepageSatelliteVisualIdentity';
import {
  cellFrequencyIndex,
  cellLinkBudgetBeamId,
  type SinrLiveCellFrame,
  type SinrLiveCellHandoverEvent,
} from '../scene/sinrLiveCellModel';
import {
  resolveBeamBaseCenter,
  buildObliqueBeamConePositions,
} from '../appearance/coneGeometryContract';
import {
  handoverRoleForSide,
  resolveHandoverSide,
} from '../appearance/handoverAppearanceModifiers';
export { buildObliqueBeamConePositions } from '../appearance/coneGeometryContract';
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
  /** Same scale used to map local ENU km to scene world units. */
  readonly worldUnitsPerKm?: number;
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
  /** Exact link-budget identity; variants can share a geographic cell. */
  readonly beamId?: number;
  /** Stable geographic frequency colour index (`cellId mod reuse`) — kept for
   *  telemetry/userData + the retained frequency-plan colour mode; NOT the render
   *  colour (that is the serving-identity `color` below). */
  readonly frequencyIndex: number;
  /** Serving-identity colour keyed by the link-budget BEAM id, derived from the
   *  cell when the beam does not carry one (`colorForServingBeam(satId, beamId ?? cellLinkBudgetBeamId(cellId))`,
   *  matching `coneItemBeamId` in `src/appearance/paintConeItems.ts` on purpose).
   *  Role overrides (hero/candidate) apply at the mount. */
  readonly color: string;
  /** Always true on this render path — only SERVING beams draw a cone. */
  readonly serving: boolean;
  /** Cone apex = serving satellite world position. */
  readonly apex: THREE.Vector3;
  /** Cone base centre = the resolved beam footprint centre on the ground plane (y = 0). */
  readonly baseCenter: THREE.Vector3;
  readonly baseRadiusWorld: number;
  /**
   * Optional PER-ITEM opacity override (G2c live-pulse). When present, the mesh
   * uses it instead of the group's shared `opacity`, so a single mount can render
   * cones at independent brightness (each handover pulse fades by its own age).
   * Omitted on the ambient layer (it uses one group opacity).
   */
  readonly opacity?: number;
  /**
   * Optional STABLE React key (G2c live-pulse). The pulse layer can carry the same
   * `(cellId, satId)` twice in one frame (old + new of distinct events), so it sets
   * a per-event/side key here. The ambient layer includes the exact beam id in its
   * fallback key, which keeps normal and same-cell variant beams distinct — never
   * an array index, which would remount every cone when the serving set reorders on
   * a beam hop and defeat the persistent-mesh in-place buffer update.
   */
  readonly renderKey?: string;
  /**
   * Optional handover KIND (C2 / Bug H). The PULSE resolver tags each cone with the
   * truth `event.kind` so the render can paint intra vs inter distinctly
   * (`beamDisplaySpec.pulseIntraColor / pulseInterColor`). Omitted on every
   * non-pulse layer (ambient / non-serving) → those keep the serving-identity
   * colour. A read-out of the model's own classification, no truth.
   */
  readonly kind?: 'intra' | 'inter';
  /**
   * EXPLICIT appearance role (2026-08-06 consolidation). Set by a resolver that already
   * knows what a cone MEANS and cannot be re-derived at the mount from (satId, cellId)
   * alone — today: the candidate resolver, which emits ONE `candidatePrimary` cone (your
   * next link, on YOUR cell) plus a bounded `candidateFan` of that same satellite's other
   * beams. When present it WINS over the mount's layer-based derivation
   * ({@link resolveSinrLiveConeRole}); when absent the layer derives the role. Never a
   * truth field — it selects colour/opacity only (Rule#6).
   */
  readonly role?: SinrLiveConeRole;
  /** True for display-substrate beams that have no UE/SINR truth row. */
  readonly displayOnly?: boolean;
}

/**
 * Resolve the exact link identity carried by a cone.  The earth-fixed cell
 * lane normally derives `cellId + 1`, while the homepage intra story may carry
 * a reserved same-cell variant beam id.  Keeping this fallback at the render
 * seam makes legacy fixtures source-compatible without collapsing real pairs.
 */
function renderItemBeamId(cone: Pick<SinrLiveCellBeamConeRenderItem, 'cellId' | 'beamId'>): number {
  return cone.beamId ?? cellLinkBudgetBeamId(cone.cellId);
}

function renderItemIdentityKey(
  cone: Pick<SinrLiveCellBeamConeRenderItem, 'satId' | 'cellId' | 'beamId'>,
): string {
  return `${cone.satId}-${cone.cellId}-${renderItemBeamId(cone)}`;
}

function dedupeRenderItemsByIdentity(
  items: readonly SinrLiveCellBeamConeRenderItem[],
): SinrLiveCellBeamConeRenderItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const identityKey = renderItemIdentityKey(item);
    if (seen.has(identityKey)) return false;
    seen.add(identityKey);
    return true;
  });
}

function renderItemStableKey(cone: SinrLiveCellBeamConeRenderItem): string {
  return renderItemIdentityKey(cone);
}

/**
 * Selects the presentation colour authority without changing cone geometry,
 * opacity, role, or scientific state. The live homepage uses the item's
 * publisher-owned satellite/beam identity colour so a satellite does not
 * change hue when it becomes serving; `semantic-role` remains available to
 * isolated legacy/teaching fixtures that explicitly need the old role palette.
 */
export type SinrLiveConeColorAuthority = 'semantic-role' | 'item-identity';

/**
 * Canonical homepage per-beam metric join.  The live-cell render item exposes
 * a public cell ID, while the homepage controller's accepted metric map uses
 * the link-budget beam ID (`cellId + 1`).
 */
export function homepageBeamEeKey(satelliteId: string, beamId: number): string {
  return `${satelliteId}:${beamId}`;
}

export function resolveSinrLiveConeDisplayStyle(
  role: SinrLiveConeRole,
  palette: SinrLiveConePalette | undefined,
  cone: SinrLiveCellBeamConeRenderItem,
  colorAuthority: SinrLiveConeColorAuthority = 'semantic-role',
): ReturnType<typeof resolveSinrLiveConeRoleStyle> {
  const semantic = resolveSinrLiveConeRoleStyle(role, palette, cone);
  if (colorAuthority !== 'item-identity' || cone.color.trim().length === 0) return semantic;
  return {
    ...semantic,
    color: cone.color,
  };
}


/**
 * Which cone LAYER a mount is (the five `<SinrLiveCellBeamCones/>` mounts in MainScene).
 * The layer plus the hero identity is enough to DERIVE every cone's role, so a mount
 * declares what it is once instead of threading a different colour trio each time.
 */
export type SinrLiveConeMountLayer = 'serving' | 'candidate' | 'nonServing' | 'pulse' | 'triggered';

/**
 * PURE role derivation — the explicit replacement for the retired implicit hero signal.
 *
 * The hero used to be recognised as "`cone.opacity === undefined` AND satId+cellId match",
 * which silently coupled the protagonist's colour to whether its layer happened to carry a
 * per-item alpha, and — worse — collapsed "another beam of YOUR satellite" and "some other
 * satellite's beam" into ONE grey role. That collapse is precisely why the serving fan read
 * green: the fan of the satellite serving you was painted the hueless context colour.
 *
 * Precedence: an item's EXPLICIT `role` wins (the candidate resolver knows more than the
 * mount); otherwise the mount's layer decides, and on the serving layer the hero identity
 * splits it three ways (hero / servingFan / background).
 */
export function resolveSinrLiveConeRole(input: {
  readonly layer: SinrLiveConeMountLayer;
  readonly satId: string;
  readonly cellId: number;
  readonly itemRole?: SinrLiveConeRole;
  readonly heroSatId?: string | null;
  readonly heroCellId?: number | null;
  readonly heroBeamId?: number | null;
  readonly beamId?: number | null;
}): SinrLiveConeRole {
  if (input.itemRole !== undefined) return input.itemRole;
  switch (input.layer) {
    case 'pulse':
      return 'pulse';
    case 'triggered':
      return 'triggered';
    case 'nonServing':
      return 'nonServing';
    case 'candidate':
      return 'candidatePrimary';
    case 'serving': {
      if (input.heroSatId == null || input.satId !== input.heroSatId) return 'background';
      return input.heroCellId != null
        && input.cellId === input.heroCellId
        && (input.heroBeamId == null || input.beamId == null || input.beamId === input.heroBeamId)
        ? 'hero'
        : 'servingFan';
    }
  }
}

/**
 * Preserve the server-baseline spotlight hierarchy: primary and event cones
 * remain legible through scene fog, while contextual fans stay atmospheric.
 */
export function resolveSinrLiveConeFog(role: SinrLiveConeRole): boolean {
  if (resolveHandoverSide({ role }) !== null) return false;
  switch (role) {
    case 'hero':
    case 'candidatePrimary':
    case 'pulse':
    // The side was already resolved above. These cases keep the role union
    // exhaustive without re-deciding which side the role represents.
    case 'handoverSource':
    case 'handoverTarget':
    case 'triggered':
      return false;
    case 'servingFan':
    case 'candidateFan':
    case 'background':
    case 'nonServing':
      return true;
  }
}

/**
 * Decide whether the display-only shallow-cone de-emphasis applies to a role.
 *
 * The primary candidate is a semantic counterpart to the primary serving beam:
 * it must remain recognisably blue even when its real TLE geometry is near the
 * horizon.  Candidate fan/context cones retain the shallow fade.  This changes
 * only rendered opacity; it does not alter the candidate identity, frame, or
 * serving/handover truth.
 */
export function shouldDimSinrLiveConeRole(
  role: SinrLiveConeRole,
  dimShallowCones: boolean | undefined,
  heroExemptFromElevationDim: boolean | undefined,
): boolean {
  if (!dimShallowCones) return false;
  if (role === 'candidatePrimary') return false;
  if (role === 'hero') return heroExemptFromElevationDim === false;
  if (role === 'pulse' || resolveHandoverSide({ role }) !== null || role === 'triggered') return false;
  return true;
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
 * shows every connected sat's beam via the shared SINR_LIVE_CONE_BLENDING token), so this
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
 * skipped. Deterministic in beam order. Colour = serving-identity colour
 * keyed by the link-budget BEAM id, derived from the cell when the beam does
 * not carry one (`colorForServingBeam(satId, beamId ?? cellLinkBudgetBeamId(cellId))`,
 * matching `coneItemBeamId` in `src/appearance/paintConeItems.ts` on purpose).
 */
export function resolveSinrLiveCellBeamConeItems(
  props: SinrLiveCellBeamConesProps,
): readonly SinrLiveCellBeamConeRenderItem[] {
  const { cellFrame, placementByCellId, satelliteWorldById, focusSatIds } = props;
  if (!cellFrame) return [];
  const narrow = focusSatIds && focusSatIds.size > 0 ? focusSatIds : null;

  const items: SinrLiveCellBeamConeRenderItem[] = [];
  const seenBeamIdentities = new Set<string>();
  for (const beam of cellFrame.illuminatedBeams) {
    if (!beam.serving) continue; // draw only SERVING beams (the serving sat → its served cell)
    if (narrow && !narrow.has(beam.satId)) continue; // optional cinema narrowing
    const beamId = beam.beamId ?? cellLinkBudgetBeamId(beam.cellId);
    const identityKey = renderItemIdentityKey({
      satId: beam.satId,
      cellId: beam.cellId,
      beamId,
    });
    if (seenBeamIdentities.has(identityKey)) continue;
    const placement = placementByCellId.get(beam.cellId);
    const satWorld = satelliteWorldById.get(beam.satId);
    if (!placement || !satWorld) continue; // serving sat not rendered → can't place a cone
    if (placement.radiusWorld <= 0) continue;

    const apex = new THREE.Vector3(satWorld.x, satWorld.y, satWorld.z);
    const baseCenter = resolveBeamBaseCenter(placement);
    if (apex.distanceTo(baseCenter) <= 1e-6) continue;

    seenBeamIdentities.add(identityKey);
    items.push({
      cellId: beam.cellId,
      satId: beam.satId,
      beamId,
      frequencyIndex: beam.frequencyIndex,
      // Serving-identity colour (SDD §3.2): the SAME (satId, cellId) hash the UE
      // mosaic uses, so this serving cone is the SAME colour as the UE dots it
      // serves — beam↔UE matchable by colour (kills Bug E). `cellId` is the
      // serving unit on the cell lane (== the UE mosaic's `cellId`-as-beamId).
      color: colorForServingBeam(beam.satId, beamId).markerColor,
      serving: true,
      apex,
      baseCenter,
      baseRadiusWorld: placement.radiusWorld,
    });
  }
  return items;
}

/**
 * Tier-2 OPT-IN non-serving cone resolver (the beam-display show/dim switch). One
 * dim cone per NON-serving illuminated beam — the co-channel / secondary beams the
 * serving resolver drops at `if (!beam.serving) continue`. SEPARATE from
 * resolveSinrLiveCellBeamConeItems ON PURPOSE: that function is contractually
 * serving-only (validate:s0:connected-sat-has-beam's must-hold oracle + the
 * validate:s4:serving-equivalence hard deepEqual + the render test all assert it),
 * so non-serving cones must NOT come from relaxing its filter. This is a pure DISPLAY
 * read-out of the model's non-serving `illuminatedBeams` (Rule#6): it changes no
 * serving / SINR / handover truth and is never fed into the serving must-hold
 * oracles. Items carry `serving: false`; the caller mounts them in a SEPARATE group
 * at the dim `nonServing` opacity behind the serving field, gated by
 * `BeamDisplaySpec.showNonServingCones` (default OFF). `(cellId, satId)` is unique
 * within the non-serving set (one illuminating beam per sat per cell), so the default
 * content-stable key holds. Deterministic in beam order; same placement/apex guards
 * as the serving resolver.
 */
export function resolveSinrLiveNonServingConeItems(
  props: SinrLiveCellBeamConesProps,
): readonly SinrLiveCellBeamConeRenderItem[] {
  const { cellFrame, placementByCellId, satelliteWorldById, focusSatIds } = props;
  if (!cellFrame) return [];
  const narrow = focusSatIds && focusSatIds.size > 0 ? focusSatIds : null;

  const items: SinrLiveCellBeamConeRenderItem[] = [];
  for (const beam of cellFrame.illuminatedBeams) {
    if (beam.serving) continue; // serving beams own the always-on field; this is the non-serving complement
    if (narrow && !narrow.has(beam.satId)) continue;
    const placement = placementByCellId.get(beam.cellId);
    const satWorld = satelliteWorldById.get(beam.satId);
    if (!placement || !satWorld) continue;
    if (placement.radiusWorld <= 0) continue;

    const apex = new THREE.Vector3(satWorld.x, satWorld.y, satWorld.z);
    const baseCenter = resolveBeamBaseCenter(placement);
    if (apex.distanceTo(baseCenter) <= 1e-6) continue;
    const beamId = beam.beamId ?? cellLinkBudgetBeamId(beam.cellId);

    items.push({
      cellId: beam.cellId,
      satId: beam.satId,
      beamId,
      frequencyIndex: beam.frequencyIndex,
      // Serving-identity colour (SDD §3.2) keyed on (satId, cellId) — same authority
      // as the serving cones + UE mosaic, so the whole field is one colour scheme
      // (the freq-reuse palette is retired from the live render).
      color: colorForServingBeam(beam.satId, beamId).markerColor,
      serving: false,
      apex,
      baseCenter,
      baseRadiusWorld: placement.radiusWorld,
    });
  }
  return items;
}

function buildCellConeItem(input: {
  readonly satId: string;
  readonly cellId: number | null | undefined;
  readonly beamId?: number | null;
  readonly frequencyIndex: number | null | undefined;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
}): SinrLiveCellBeamConeRenderItem | null {
  if (input.cellId == null) return null;
  const placement = input.placementByCellId.get(input.cellId);
  const satWorld = input.satelliteWorldById.get(input.satId);
  if (!placement || !satWorld || placement.radiusWorld <= 0) return null;

  const apex = new THREE.Vector3(satWorld.x, satWorld.y, satWorld.z);
  const baseCenter = resolveBeamBaseCenter(placement);
  if (apex.distanceTo(baseCenter) <= 1e-6) return null;
  const frequencyIndex = input.frequencyIndex ?? input.cellId;
  const beamId = input.beamId ?? cellLinkBudgetBeamId(input.cellId);
  return {
    cellId: input.cellId,
    satId: input.satId,
    beamId,
    frequencyIndex,
    // Serving-identity colour (SDD §3.2): the pulse cone reads as the SAME ambient
    // serving cone for (satId, cellId) flaring, not a different hue — it matches the
    // UE mosaic colour. The per-kind intra/inter pulse hue (and the hero serving GREEN)
    // is layered on at the mount via resolveSinrLiveConeRenderColor, never here.
    // Preserve the legacy cell-lane colour for ordinary beams while allowing
    // an explicit same-cell variant to select its real beam shade.  The
    // homepage identity mount uses `beamId` below for the EE-driven colour.
    color: colorForServingBeam(input.satId, beamId).markerColor,
    serving: true,
    apex,
    baseCenter,
    baseRadiusWorld: placement.radiusWorld,
  };
}

/**
 * Complete a bounded display fan from the fixed display substrate.
 *
 * The live cell model intentionally owns only the seven UE/SINR cells. The
 * homepage can nevertheless present a 19-beam satellite layout, so this helper
 * adds deterministic, unserved display-only cells after the model-backed items
 * have been resolved. It never creates a serving record, SINR sample, candidate,
 * or handover event; it only gives the renderer the requested geometric fan.
 */
export function resolveBudgetedSinrLiveBeamConeItems(input: {
  readonly existingItems: readonly SinrLiveCellBeamConeRenderItem[];
  readonly satId: string | null | undefined;
  readonly maxCones: number;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
  readonly frequencyReuse: number;
  readonly role: 'servingFan' | 'candidateFan';
  readonly renderKeyPrefix: string;
  readonly preferredCellId?: number | null;
  /** Exact focused physical beam; keeps an intra-selected B2..B7 ahead of B1. */
  readonly preferredBeamId?: number | null;
}): readonly SinrLiveCellBeamConeRenderItem[] {
  const maxCones = Number.isFinite(input.maxCones)
    ? Math.max(0, Math.floor(input.maxCones))
    : 0;
  if (input.satId === null || input.satId === undefined || maxCones === 0) return [];

  const existing = dedupeRenderItemsByIdentity(input.existingItems);
  const preferred = input.preferredBeamId === null || input.preferredBeamId === undefined
    ? []
    : existing.filter(item => renderItemBeamId(item) === input.preferredBeamId);
  const ordered = [
    ...preferred,
    ...(input.preferredCellId === null || input.preferredCellId === undefined
      ? existing
      : [
        ...existing.filter(item => item.cellId === input.preferredCellId),
        ...existing.filter(item => item.cellId !== input.preferredCellId),
      ]),
  ].filter((item, index, items) => items.findIndex(candidate => renderItemIdentityKey(candidate) === renderItemIdentityKey(item)) === index);
  const items = ordered.slice(0, maxCones);
  if (items.length >= maxCones) return items;

  const usedBeamIdentities = new Set(items.map(renderItemIdentityKey));
  const substrateCellIds = [...input.placementByCellId.keys()].sort((left, right) => left - right);
  for (const cellId of substrateCellIds) {
    if (items.length >= maxCones) break;
    const cone = buildCellConeItem({
      satId: input.satId,
      cellId,
      frequencyIndex: cellFrequencyIndex(cellId, input.frequencyReuse),
      placementByCellId: input.placementByCellId,
      satelliteWorldById: input.satelliteWorldById,
    });
    if (!cone) continue;
    const identityKey = renderItemIdentityKey(cone);
    if (usedBeamIdentities.has(identityKey)) continue;
    usedBeamIdentities.add(identityKey);
    items.push({
      ...cone,
      role: input.role,
      displayOnly: true,
      renderKey: `${input.renderKeyPrefix}-${input.satId}-${cellId}-${renderItemBeamId(cone)}`,
    });
  }
  return items;
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
   * The profile's frequency-reuse factor (`profile.beams.frequencyReuse`). Feeds the
   * pulse cone's telemetry `frequencyIndex` field (`cellFrequencyIndex(cellId, reuse)`,
   * the same index the ambient cone records). The RENDER colour is the serving-identity
   * colour (keyed on satId+cellId), so a pulse already reads as the ambient cone
   * flaring; this factor no longer drives the hue.
   */
  readonly frequencyReuse: number;
  readonly peakOpacity?: number;
  /**
   * PER-CONE-SIDE focus gate (2026-08-06 — the "random blue beams flashing on satellites
   * that are otherwise dark, nowhere near the target UE" fix). Measured on the default
   * profile (candidate-rich, 100 UEs, 240 s): of 104 pulse cones drawn, **52 (exactly
   * 50%, and 100% of the `from` sides) sat on a satellite outside the focus set**, and
   * only 5 of the 65 events that reached the resolver belonged to the protagonist.
   *
   * Why the caller's EVENT filter could not catch it: an event is admitted if EITHER end
   * touches a focus sat, but an INTER handover's two ends are by definition two DIFFERENT
   * satellites — so admitting it on its `to` end still emitted a cone on the `from`
   * satellite, which draws nothing else and belongs to one of the other 99 UEs. Every
   * measured off-focus cone was of exactly that shape.
   *
   * The gate is per SIDE, not per event: a side draws when its own satellite is in focus,
   * or when the event belongs to the protagonist (whose inter handover SHOULD show both
   * ends — that is the handover story). `null`/omitted focus set = no gate (unchanged
   * behaviour for callers that do not focus). Display-only (Rule#6): the model's events
   * are untouched; this only decides which of them paint.
   */
  readonly focusSatIds?: ReadonlySet<string> | null;
  readonly protagonistUeId?: string | null;
  /**
   * Homepage-only presentation anchor for the protagonist's intra episode.
   * The event still carries its source/target cell identities for truth and
   * rail joins; only the two rendered ground bases share the same cell anchor.
   */
  readonly protagonistIntraBaseCenterOverride?: THREE.Vector3;
}

/**
 * G2c ambient live-handover PULSE resolver: turn the model's per-frame real
 * handovers into bright, age-faded cones on the old (handed-off) AND new (acquired)
 * cells of each event — the "handovers are happening" pulse on the faint ambient
 * field, with NO seek and NO camera move (decoupled from the director cinema). It
 * is a pure DISPLAY read-out of `recentHandoverEvents` (the same transitions the
 * model already classified + counted, Rule#6) — it fabricates no handover. Reuses
 * the same oblique-cone geometry the ambient + cinema-pair cones use
 * (`buildCellConeItem`), carrying a per-item age-faded `opacity`. Colour is the
 * serving-identity colour (via `buildCellConeItem` → `colorForServingBeam`) so a
 * pulse reads as the SAME cone flaring, just brighter. An event past the
 * retention horizon, with a non-rendered sat, or an unplaced cell draws nothing.
 */
export function resolveSinrLiveHandoverPulseConeItems(
  input: SinrLiveHandoverPulseConeInput,
): readonly SinrLiveCellBeamConeRenderItem[] {
  const { recentHandoverEvents, simTimeSec, retentionSec, placementByCellId, satelliteWorldById, frequencyReuse } = input;
  if (!recentHandoverEvents || recentHandoverEvents.length === 0) return [];
  const peak = input.peakOpacity ?? SINR_LIVE_CONE_PULSE_PEAK_OPACITY;
  const focusSatIds = input.focusSatIds ?? null;
  const protagonistUeId = input.protagonistUeId ?? null;
  const protagonistIntraBaseCenterOverride = input.protagonistIntraBaseCenterOverride;
  /** A cone side draws when its OWN sat is in focus, or the event is the protagonist's. */
  const sideDraws = (event: SinrLiveCellHandoverEvent, satId: string): boolean =>
    focusSatIds === null
    || (protagonistUeId !== null && event.ueId === protagonistUeId)
    || focusSatIds.has(satId);

  const items: SinrLiveCellBeamConeRenderItem[] = [];
  for (const event of recentHandoverEvents) {
    const opacity = sinrLiveHandoverPulseOpacity(simTimeSec - event.sourceTimeSec, retentionSec, peak);
    if (opacity <= 0) continue;
    // Per-event/side stable key: a UE can hand over more than once within the
    // retention window, so disambiguate by (ueId, sourceTimeSec, side) — never an
    // array index (which would remount cones on reorder).
    const eventKey = `${event.ueId}-${event.sourceTimeSec}`;
    const sameCellAnchor = event.kind === 'intra'
      && protagonistIntraBaseCenterOverride !== undefined
      && protagonistUeId !== null
      && event.ueId === protagonistUeId;
    const placeIntraSide = (
      item: SinrLiveCellBeamConeRenderItem,
      radiusScale: number,
    ): SinrLiveCellBeamConeRenderItem => sameCellAnchor
      ? {
        ...item,
        baseCenter: protagonistIntraBaseCenterOverride!.clone(),
        baseRadiusWorld: item.baseRadiusWorld * radiusScale,
      }
      : item;
    // The NEW (acquired) cell always exists on a real HO; the OLD (handed-off) cell
    // exists for inter/intra (a cold attach is never emitted as a handover). Each
    // carries the cell's frequency-reuse index for telemetry; the render colour is
    // the serving-identity colour (via buildCellConeItem), so a pulse reads as the
    // ambient cone for that (satId, cellId) flaring rather than a different hue.
    const to = sideDraws(event, event.toSatId)
      ? buildCellConeItem({
        satId: event.toSatId,
        cellId: event.toCellId,
        beamId: event.toBeamId,
        frequencyIndex: cellFrequencyIndex(event.toCellId, frequencyReuse),
        placementByCellId,
        satelliteWorldById,
      })
      : null;
    if (to) items.push({
      ...placeIntraSide(to, 1),
      opacity,
      renderKey: `${eventKey}-to`,
      kind: event.kind,
      role: handoverRoleForSide('target'),
    });
    if (event.fromSatId !== null && event.fromCellId !== null && sideDraws(event, event.fromSatId)) {
      const from = buildCellConeItem({
        satId: event.fromSatId,
        cellId: event.fromCellId,
        beamId: event.fromBeamId,
        frequencyIndex: cellFrequencyIndex(event.fromCellId, frequencyReuse),
        placementByCellId,
        satelliteWorldById,
      });
      if (from) items.push({
        ...placeIntraSide(from, 0.86),
        opacity,
        renderKey: `${eventKey}-from`,
        kind: event.kind,
        role: handoverRoleForSide('source'),
      });
    }
  }
  return items;
}

/**
 * beam-stage ① #5 — the TRIGGERED intra flash (distinct from the ambient pulse).
 *
 * Builds the OLD (handed-off) + NEW (acquired) cell cones for ONE latched handover
 * event, with INDEPENDENT wall-clock opacities and a FROM/TO COLOUR SPLIT: the old cell
 * paints `fromColor` (warm — handed off) and the new cell paints `toColor` (cool —
 * acquired), so the audience reads the handover DIRECTION (warm→cool) instead of the
 * ambient pulse's single serving-identity hue.
 *
 * `fromOpacity` / `toOpacity` are SEPARATE (2026-08-06). They used to be one shared
 * `opacity`, which forced both cones to appear and disappear together — the scene the
 * owner rejected: 「現在是2個同時連線，然後就結束了」. A handover is a SEQUENCE (serve →
 * candidate appears → both held while TTT runs → old link released), and that sequence
 * is only expressible if each cone owns its own alpha. A cone whose opacity is ≤ 0 is
 * NOT emitted at all, so "the new beam has not arrived yet" is an absent cone rather
 * than an invisible one.
 *
 * Pure (no clock / no React) — the caller drives the wall-clock latch + the per-phase
 * envelope and passes the resolved opacities, so the `:render` model gate can
 * VALUE-assert the from/to colour split + the independent opacity passthrough.
 * Returns [] when the event's cells/sats are unplaced/unrendered (honest skip).
 */
export function resolveTriggeredIntraConeItems(input: {
  readonly event: SinrLiveCellHandoverEvent | null;
  /** Alpha of the OLD (handed-off) cone. ≤ 0 → the old cone is not emitted. */
  readonly fromOpacity: number;
  /** Alpha of the NEW (acquiring) cone. ≤ 0 → the new cone is not emitted. */
  readonly toOpacity: number;
  readonly fromColor: string;
  readonly toColor: string;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
  readonly frequencyReuse: number;
  /** Manual demo only: make both transition cones terminate at the primary UE. */
  readonly baseCenterOverride?: THREE.Vector3;
  /** Slightly nest the two manual cones so both colours remain visible at one target. */
  readonly fromBaseRadiusScale?: number;
  readonly toBaseRadiusScale?: number;
}): readonly SinrLiveCellBeamConeRenderItem[] {
  const {
    event,
    fromOpacity,
    toOpacity,
    fromColor,
    toColor,
    placementByCellId,
    satelliteWorldById,
    frequencyReuse,
    baseCenterOverride,
    fromBaseRadiusScale = 1,
    toBaseRadiusScale = 1,
  } = input;
  if (!event) return [];
  if (fromOpacity <= 0 && toOpacity <= 0) return [];
  const items: SinrLiveCellBeamConeRenderItem[] = [];
  const eventKey = `${event.ueId}-${event.sourceTimeSec}`;
  const placeAtManualTarget = (item: SinrLiveCellBeamConeRenderItem, radiusScale: number) => (
    baseCenterOverride === undefined
      ? item
      : {
        ...item,
        baseCenter: baseCenterOverride.clone(),
        baseRadiusWorld: item.baseRadiusWorld * radiusScale,
      }
  );
  const to = toOpacity > 0
    ? buildCellConeItem({
      satId: event.toSatId,
      cellId: event.toCellId,
      beamId: event.toBeamId,
      frequencyIndex: cellFrequencyIndex(event.toCellId, frequencyReuse),
      placementByCellId,
      satelliteWorldById,
    })
    : null;
  if (to) items.push({ ...placeAtManualTarget(to, toBaseRadiusScale), color: toColor, opacity: toOpacity, renderKey: `${eventKey}-trig-to`, kind: event.kind });
  if (fromOpacity > 0 && event.fromSatId !== null && event.fromCellId !== null) {
    const from = buildCellConeItem({
      satId: event.fromSatId,
      cellId: event.fromCellId,
      beamId: event.fromBeamId,
      frequencyIndex: cellFrequencyIndex(event.fromCellId, frequencyReuse),
      placementByCellId,
      satelliteWorldById,
    });
    if (from) items.push({ ...placeAtManualTarget(from, fromBaseRadiusScale), color: fromColor, opacity: fromOpacity, renderKey: `${eventKey}-trig-from`, kind: event.kind });
  }
  return items;
}

/**
 * Focused handover-cinema pair: resolve the exact old and new cell cones from
 * the indexed event, rather than reusing the current `pendingTargetSatId` fan.
 *
 * The cinema controller supplies this candidate from the live cell-truth index.
 * Cell ids are therefore required for this earth-fixed renderer; a missing id
 * fails closed instead of guessing a cell from a satellite or UE position.
 * Display-only (Rule#6): the helper reads already-classified event identities
 * and changes no serving, SINR, or handover state.
 */
export interface SinrLiveCinemaHandoverCandidate {
  readonly eventId: string;
  readonly ueId: string | null;
  readonly kind: 'intra' | 'inter';
  readonly sourceTimeSec: number;
  readonly fromSatId: string;
  /** Exact source beam; null/undefined keeps legacy cell-derived identity. */
  readonly fromBeamId?: number | null;
  readonly fromCellId: number | null;
  readonly toSatId: string;
  /** Exact target beam; null/undefined keeps legacy cell-derived identity. */
  readonly toBeamId?: number | null;
  readonly toCellId: number | null;
}

export function resolveCinemaHandoverPairConeItems(input: {
  readonly candidate: SinrLiveCinemaHandoverCandidate | null;
  readonly fromOpacity: number;
  readonly toOpacity: number;
  readonly fromColor: string;
  readonly toColor: string;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
  readonly frequencyReuse: number;
  /** Optional teaching anchor: both pair cones terminate at the same primary UE. */
  readonly baseCenterOverride?: THREE.Vector3;
  /** Slightly nest the pair at one UE so both semantic colours remain visible. */
  readonly fromBaseRadiusScale?: number;
  readonly toBaseRadiusScale?: number;
}): readonly SinrLiveCellBeamConeRenderItem[] {
  const { candidate } = input;
  if (
    candidate === null
    || (candidate.fromCellId === null && candidate.toCellId === null)
    || (input.fromOpacity <= 0 && input.toOpacity <= 0)
  ) return [];

  const items: SinrLiveCellBeamConeRenderItem[] = [];
  const eventKey = `cinema-${candidate.eventId}`;
  const placeAtCinemaTarget = (item: SinrLiveCellBeamConeRenderItem, radiusScale: number) => (
    input.baseCenterOverride === undefined
      ? item
      : {
        ...item,
        baseCenter: input.baseCenterOverride.clone(),
        baseRadiusWorld: item.baseRadiusWorld * radiusScale,
      }
  );
  const from = input.fromOpacity > 0
    ? buildCellConeItem({
      satId: candidate.fromSatId,
      cellId: candidate.fromCellId,
      beamId: candidate.fromBeamId,
      frequencyIndex: candidate.fromCellId === null
        ? null
        : cellFrequencyIndex(candidate.fromCellId, input.frequencyReuse),
      placementByCellId: input.placementByCellId,
      satelliteWorldById: input.satelliteWorldById,
    })
    : null;
  if (from) {
    items.push({
      ...placeAtCinemaTarget(from, input.fromBaseRadiusScale ?? 1),
      color: input.fromColor,
      opacity: input.fromOpacity,
      renderKey: `${eventKey}-from`,
      kind: candidate.kind,
      role: 'triggered',
    });
  }

  const to = input.toOpacity > 0
    ? buildCellConeItem({
      satId: candidate.toSatId,
      cellId: candidate.toCellId,
      beamId: candidate.toBeamId,
      frequencyIndex: candidate.toCellId === null
        ? null
        : cellFrequencyIndex(candidate.toCellId, input.frequencyReuse),
      placementByCellId: input.placementByCellId,
      satelliteWorldById: input.satelliteWorldById,
    })
    : null;
  if (to) {
    items.push({
      ...placeAtCinemaTarget(to, input.toBaseRadiusScale ?? 1),
      color: input.toColor,
      opacity: input.toOpacity,
      renderKey: `${eventKey}-to`,
      kind: candidate.kind,
      role: 'triggered',
    });
  }
  return items;
}

/**
 * SEMANTIC candidate cue: the imminent inter-handover target satellite
 * (`pendingTargetSatId`) and the beams it is painting — the "your next link" story.
 *
 * 2026-08-06 — OWNER DECISION, supersedes the original "ONE dim candidate cone (NOT the
 * candidate sat's whole multibeam fan)" design. Verbatim: 「候選波束除了藍色的打在 ue 上
 * 之外，也要有其他波束打在其他地方，不能只有一個波束」. The single-cone design was chosen
 * because a whole extra fan was expected to drown the frame; the owner has now seen it and
 * wants the fan, because one lone cone made the candidate satellite look like it had a
 * single beam — which is not how a multibeam LEO satellite works, and is the opposite of
 * the lesson the scene is meant to teach.
 *
 * The frame is protected by LAYERING, not by omission: cone #1 — the one landing on
 * YOUR cell — keeps the strongest beam-level shade; the rest use the same satellite
 * hue family at a lower alpha, strictly below the serving fan, so the link you are ON
 * always stays the brightest thing on screen.
 *
 * BOUNDED, never a firehose: the fan comes ONLY from `cellFrame.illuminatedBeams` entries
 * whose `satId` IS the one pending-target satellite, capped at `maxFanCones`
 * (default {@link SINR_LIVE_CANDIDATE_FAN_MAX_CONES} = the per-sat beam budget) INCLUDING
 * the primary cone. Raising the cap can never admit a second satellite. Deterministic in
 * beam order; a cell already drawn is never drawn twice.
 *
 * Returns [] when there is no pending target, the target IS the serving sat, or the
 * cell/sat is unplaced / unrendered (honest skip). Display-only (Rule#6) — a geometric
 * read-out of that satellite's own illuminated beams; it alters no serving / handover /
 * SINR truth.
 */
export function resolveCandidateBeamConeItems(input: {
  readonly pendingTargetSatId: string | null | undefined;
  readonly servingSatId: string | null | undefined;
  readonly primaryCellId: number | null | undefined;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
  readonly frequencyReuse: number;
  /** The cell truth the candidate's own fan is read from. Omitted → the primary cone only. */
  readonly cellFrame?: SinrLiveCellFrame | undefined;
  /** Upper bound on cones INCLUDING the primary. Default {@link SINR_LIVE_CANDIDATE_FAN_MAX_CONES}. */
  readonly maxFanCones?: number;
}): readonly SinrLiveCellBeamConeRenderItem[] {
  const { pendingTargetSatId, servingSatId, primaryCellId, placementByCellId, satelliteWorldById, frequencyReuse } = input;
  if (!pendingTargetSatId || pendingTargetSatId === servingSatId || primaryCellId == null) return [];
  const maxCones = input.maxFanCones ?? SINR_LIVE_CANDIDATE_FAN_MAX_CONES;
  if (maxCones <= 0) return [];

  const items: SinrLiveCellBeamConeRenderItem[] = [];
  const drawnCellIds = new Set<number>();
  const primary = buildCellConeItem({
    satId: pendingTargetSatId,
    cellId: primaryCellId,
    frequencyIndex: cellFrequencyIndex(primaryCellId, frequencyReuse),
    placementByCellId,
    satelliteWorldById,
  });
  if (primary) {
    items.push({
      ...primary,
      role: 'candidatePrimary',
      renderKey: `candidate-${pendingTargetSatId}-${primaryCellId}-${renderItemBeamId(primary)}`,
    });
    drawnCellIds.add(primaryCellId);
  }

  for (const beam of input.cellFrame?.illuminatedBeams ?? []) {
    if (items.length >= maxCones) break;
    if (beam.satId !== pendingTargetSatId) continue; // ONE satellite — the bound that matters
    if (drawnCellIds.has(beam.cellId)) continue;
    const cone = buildCellConeItem({
      satId: beam.satId,
      cellId: beam.cellId,
      beamId: beam.beamId,
      frequencyIndex: beam.frequencyIndex,
      placementByCellId,
      satelliteWorldById,
    });
    if (!cone) continue;
    drawnCellIds.add(beam.cellId);
    items.push({
      ...cone,
      role: 'candidateFan',
      renderKey: `candidate-fan-${beam.satId}-${beam.cellId}-${cone.beamId}`,
    });
  }
  return items;
}

/**
 * Inter-cinema presentation fan for the OLD serving satellite. The pair resolver
 * owns the primary source cone; this helper owns only that satellite's other beams
 * and gives them an explicit serving-fan role so they fade with the source side.
 * It reads a display frame supplied by the caller and never changes handover truth.
 */
export function resolveCinemaInterServingFanConeItems(input: {
  readonly candidate: SinrLiveCinemaHandoverCandidate | null;
  readonly opacity: number;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: ReadonlyMap<string, WorldPoint>;
  readonly frequencyReuse: number;
  readonly cellFrame?: SinrLiveCellFrame | undefined;
  readonly maxFanCones?: number;
}): readonly SinrLiveCellBeamConeRenderItem[] {
  const { candidate } = input;
  if (
    candidate === null
    || candidate.kind !== 'inter'
    || candidate.fromCellId === null
    || !Number.isFinite(input.opacity)
    || input.opacity <= 0
  ) return [];

  const sourceItems = resolveCandidateBeamConeItems({
    pendingTargetSatId: candidate.fromSatId,
    servingSatId: candidate.toSatId,
    primaryCellId: candidate.fromCellId,
    placementByCellId: input.placementByCellId,
    satelliteWorldById: input.satelliteWorldById,
    frequencyReuse: input.frequencyReuse,
    cellFrame: input.cellFrame,
    maxFanCones: input.maxFanCones,
  });
  return sourceItems
    .filter(item => item.role === 'candidateFan')
    .map(item => ({
      ...item,
      role: 'servingFan' as const,
      opacity: input.opacity,
      renderKey: `cinema-${candidate.eventId}-from-fan-${item.cellId}-${renderItemBeamId(item)}`,
    }));
}

export function resolveSinrLiveCellBeamConeRenderCount(props: SinrLiveCellBeamConesProps): number {
  return resolveSinrLiveCellBeamConeItems(props).length;
}

export function resolveSinrLiveCellBeamConeSatelliteCount(props: SinrLiveCellBeamConesProps): number {
  return new Set(resolveSinrLiveCellBeamConeItems(props).map(item => item.satId)).size;
}

/**
 * LEGACY opts-shaped cone RENDER-colour resolution (C2 / Bug H) — RETAINED because
 * `validate:beam:colour-match` and `SinrLiveCellFootprintRings` call it in this shape.
 * Behaviour is byte-identical to before; it is now a thin ADAPTER that maps the old
 * option flags onto a ROLE and delegates the actual decision to
 * {@link resolveSinrLiveConeRoleStyle} (the ONE appearance decision point). Precedence,
 * highest first — unchanged:
 *   1. HERO — the primary serving beam (the protagonist), when `isHero` + `heroColor`.
 *   2. per-KIND pulse colour (`pulseIntraColor` / `pulseInterColor`) when the cone carries
 *      the truth `kind` AND the caller supplied that colour.
 *   3. mount `coneColorOverride` — the candidate mount's BLUE.
 *   4. mount `backgroundColor` — the dim context colour.
 *   5. the cone's serving-identity `color` — the fixture default (vc1c/vc2).
 *
 * NEW code should call {@link resolveSinrLiveConeRoleStyle} with an explicit role instead:
 * this signature cannot express `servingFan` vs `background` (it collapses both to
 * `backgroundColor`), which is the very ambiguity the role split exists to remove.
 * Display-only (Rule#6).
 */
export function resolveSinrLiveConeRenderColor(
  cone: SinrLiveCellBeamConeRenderItem,
  opts: {
    readonly isHero?: boolean;
    readonly heroColor?: string;
    readonly pulseIntraColor?: string;
    readonly pulseInterColor?: string;
    readonly coneColorOverride?: string;
    readonly backgroundColor?: string;
  },
): string {
  if (opts.isHero && opts.heroColor) {
    return resolveSinrLiveConeRoleStyle('hero', { heroColor: opts.heroColor }, cone).color;
  }
  if (cone.kind === 'intra' && opts.pulseIntraColor !== undefined) {
    return resolveSinrLiveConeRoleStyle('pulse', { pulseIntraColor: opts.pulseIntraColor }, cone).color;
  }
  if (cone.kind === 'inter' && opts.pulseInterColor !== undefined) {
    return resolveSinrLiveConeRoleStyle('pulse', { pulseInterColor: opts.pulseInterColor }, cone).color;
  }
  if (opts.coneColorOverride !== undefined) {
    return resolveSinrLiveConeRoleStyle('candidatePrimary', { candidateColor: opts.coneColorOverride }, cone).color;
  }
  if (opts.backgroundColor !== undefined) {
    return resolveSinrLiveConeRoleStyle('background', { backgroundColor: opts.backgroundColor }, cone).color;
  }
  return cone.color;
}

export interface SinrLiveCellBeamConesRenderProps {
  /** Pre-resolved cone items (memoised once by the caller — see `MainScene`). */
  readonly items: readonly SinrLiveCellBeamConeRenderItem[];
  readonly visible?: boolean;
  /**
   * WHICH cone layer this mount is. The single input that replaced the old per-mount
   * colour trio (`heroColor` + `backgroundColor` + `coneColorOverride` + `pulse*Color` +
   * `opacity` + `heroOpacity`): the mount declares what it IS, each cone's ROLE is derived
   * from that ({@link resolveSinrLiveConeRole}), and the role decides colour + opacity in
   * ONE place ({@link resolveSinrLiveConeRoleStyle}). Default `'serving'`.
   */
  readonly layer?: SinrLiveConeMountLayer;
  /**
   * The tunable appearance values (from `beamDisplaySpec`, built ONCE by MainScene and
   * shared by every cone + footprint mount). Every field is optional and falls back to the
   * `sinrLiveConeStyle` token, so an omitted palette renders the locked defaults — which is
   * what the fixture gates rely on.
   */
  readonly palette?: SinrLiveConePalette;
  /** Colour identity only; role opacity and all existing animation stay intact. */
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
  /**
   * Display-only WIDTH multiplier on every cone's RENDERED base radius
   * (`beamDisplaySpec.coneWidthScale`, SDD §3.3). Applied in `ObliqueConeMesh` to
   * the geometry only — the resolver items + userData keep the truth cell radius,
   * so the antenna beamwidth / gain / SINR are untouched (Rule#6). Default 1.
   */
  readonly widthScale?: number;
  /**
   * Display-only de-emphasis (a-cone): when true, each cone's opacity is scaled by
   * {@link resolveSinrLiveConeElevationDimFactor} of its RENDERED apex→base angle,
   * so near-horizontal cones from low-over-the-horizon satellites fade instead of
   * shooting across the field. Opt-in — only the ambient all-serving field passes it
   * (the cinema pair / pulse highlights stay full strength). Default OFF, so the
   * fixture gates that value-assert a fixed cone opacity are unaffected. Truth is
   * unchanged: every serving cone still mounts (s0 counts meshes, not opacity).
   */
  readonly dimShallowCones?: boolean;
  /**
   * Elevation-dim BAND params (from `beamDisplaySpec.elevationDim*`): the apparent-elevation
   * window over which a shallow cone fades (floor → full dim at `elevationDimMinFactor`, ceil
   * → no dim). Threaded into {@link resolveSinrLiveConeElevationDimFactor}; omitted → the
   * resolver's const defaults (behaviour-identical for fixtures). `heroExemptFromElevationDim`
   * (default true) keeps the hero cone full-strength.
   */
  readonly elevationDimFloorDeg?: number;
  readonly elevationDimCeilDeg?: number;
  readonly elevationDimMinFactor?: number;
  readonly heroExemptFromElevationDim?: boolean;
  /** Display-only tilt exaggeration for the legacy teaching scene; 1 = physical projection. */
  readonly ellipseTiltExaggeration?: number;
  /**
   * The focus/centre UE's serving (satId, cellId) — the HERO identity. On the `serving`
   * layer it splits the mount three ways: the matching (sat, cell) is the `hero` (bright,
   * dim-exempt), the SAME satellite's other cells are the `servingFan` (the yellow family),
   * and any OTHER satellite's cones are `background` context. Omitted on the candidate /
   * non-serving / pulse / triggered mounts. Display-only.
   */
  readonly primaryServingSatId?: string | null;
  readonly primaryServingCellId?: number | null;
  readonly primaryServingBeamId?: number | null;
  readonly telemetryCountDatasetKey?: string;
}

/**
 * One oblique cone mesh. The satellite (apex) moves every frame, so the position
 * buffer changes every frame. We own the geometry via a ref and write the buffer
 * imperatively in `useLayoutEffect` (in-place + `needsUpdate` when the length is
 * unchanged), rather than relying on R3F to reconstruct a `<bufferAttribute>` from
 * a new `args` array — that guarantees a persistent cone's apex TRACKS the moving
 * satellite instead of freezing at a stale position.
 */
function ObliqueConeMesh(props: { cone: SinrLiveCellBeamConeRenderItem; opacity: number; fog: boolean; dimShallow?: boolean; dimFloorDeg?: number; dimCeilDeg?: number; dimMinFactor?: number; color?: string; widthScale?: number; ellipseTiltExaggeration?: number }): JSX.Element {
  const { cone, opacity } = props;
  const color = props.color ?? cone.color;
  const geometryRef = useRef<THREE.BufferGeometry>(null);
  // coneWidthScale (display-only, SDD §3.3): scale the RENDERED base radius ONLY.
  // cone.baseRadiusWorld + the mesh userData below stay = the truth cell radius, so
  // this never touches the antenna beamwidth that drives gain → SINR (Rule#6).
  const positions = buildObliqueBeamConePositions(
    cone.apex,
    cone.baseCenter,
    cone.baseRadiusWorld * (props.widthScale ?? 1),
    SINR_LIVE_CONE_SEGMENTS,
    props.ellipseTiltExaggeration ?? 1,
  );
  // a-cone: scale opacity by the cone's RENDERED elevation (apex→base angle). A
  // shallow cone (low-over-horizon serving sat) fades toward invisible; a steep
  // overhead cone is untouched. Geometry-derived → no truth dependency.
  const apparentElevationDeg = (Math.atan2(
    cone.apex.y - cone.baseCenter.y,
    Math.hypot(cone.apex.x - cone.baseCenter.x, cone.apex.z - cone.baseCenter.z),
  ) * 180) / Math.PI;
  const effectiveOpacity = props.dimShallow
    ? opacity * resolveSinrLiveConeElevationDimFactor(apparentElevationDeg, props.dimFloorDeg, props.dimCeilDeg, props.dimMinFactor)
    : opacity;

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
      name={`sinr-live-cell-beam-cone-${cone.satId}-${cone.cellId}-${renderItemBeamId(cone)}`}
      renderOrder={10}
      frustumCulled={false}
      userData={{
        cellId: cone.cellId,
        satId: cone.satId,
        beamId: renderItemBeamId(cone),
        frequencyIndex: cone.frequencyIndex,
        serving: cone.serving,
        baseCenterWorld: [cone.baseCenter.x, cone.baseCenter.y, cone.baseCenter.z],
        baseRadiusWorld: cone.baseRadiusWorld,
        color,
        opacity: effectiveOpacity,
      }}
    >
      <bufferGeometry ref={geometryRef} />
      <meshBasicMaterial
        color={color}
        vertexColors
        transparent
        opacity={effectiveOpacity}
        blending={SINR_LIVE_CONE_BLENDING}
        fog={props.fog}
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
  const layer = props.layer ?? 'serving';
  const palette = props.palette;

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
  }, [
    gl,
    props.telemetryCountDatasetKey,
  ]);

  return (
    <group ref={groupRef} name="sinr-live-cell-beam-cones" userData={{ coneCount: cones.length, layer }}>
      {cones.map(cone => {
        // ONE decision, two steps, both pure + value-asserted: what does this cone MEAN
        // (role), and what does that role LOOK like (colour + opacity). The mount no
        // longer carries a colour/opacity precedence of its own — it declares its layer
        // and the hero identity, and everything else follows from the role table.
        //
        // Key includes the exact beam identity.  A same-cell intra transition can
        // intentionally mount normal and variant beams for one satellite, so a
        // cell/satellite-only key would collapse the pair and trigger React's
        // duplicate-key warning. Pulse / triggered / candidate-fan layers supply
        // their own stable `renderKey`.
        const role = resolveSinrLiveConeRole({
          layer,
          satId: cone.satId,
          cellId: cone.cellId,
          itemRole: cone.role,
          heroSatId: props.primaryServingSatId,
          heroCellId: props.primaryServingCellId,
          heroBeamId: props.primaryServingBeamId,
          beamId: renderItemBeamId(cone),
        });
        const style = resolveSinrLiveConeDisplayStyle(
          role,
          palette,
          cone,
          props.colorAuthority,
        );
        const homepageIdentity = props.homepageVisualIdentity === true
          && props.colorAuthority === 'item-identity';
        const beamId = renderItemBeamId(cone);
        const isPrimaryServing = cone.satId === props.primaryServingSatId
          && cone.cellId === props.primaryServingCellId
          && (props.primaryServingBeamId === null
            || props.primaryServingBeamId === undefined
            || beamId === props.primaryServingBeamId);
        const isPrimaryIdentityBeam = isPrimaryServing
          || role === 'candidatePrimary'
          || resolveHandoverSide({ role }) !== null
          || role === 'triggered';
        const color = homepageIdentity
          ? homepageSatelliteBeamColor(cone.satId, beamId, {
            identityPaletteIndex: props.homepageIdentityPaletteIndexBySatelliteId?.get(cone.satId) ?? null,
            // Candidate/event primary beams keep their identity shade when
            // the decision role changes from candidate to serving. Ambient
            // fan beams remain pale; no second colour authority is introduced.
            isServing: isPrimaryIdentityBeam,
            eeNormalized: props.homepageBeamEeByKey?.get(
              homepageBeamEeKey(cone.satId, beamId),
            ),
          })
          : style.color;
        const homepageEeOpacity = homepageIdentity
          ? homepageEeVisualOpacity(props.homepageBeamEeByKey?.get(
            homepageBeamEeKey(cone.satId, beamId),
          ))
          : 1;
        const renderOpacity = homepageIdentity && !isPrimaryIdentityBeam
          ? style.opacity * HOMEPAGE_SATELLITE_CONTEXT_RENDER_OPACITY_FACTOR * homepageEeOpacity
          : style.opacity * homepageEeOpacity;
        const fog = resolveSinrLiveConeFog(role);
        return (
          <ObliqueConeMesh
            key={cone.renderKey ?? renderItemStableKey(cone)}
            cone={cone}
            color={color}
            opacity={renderOpacity}
            fog={fog}
            // The hero beam is exempt from the near-horizon dim so your own link always
            // pops; every other role fades with a shallow apex→base angle.
            dimShallow={shouldDimSinrLiveConeRole(role, props.dimShallowCones, props.heroExemptFromElevationDim)}
            dimFloorDeg={props.elevationDimFloorDeg}
            dimCeilDeg={props.elevationDimCeilDeg}
            dimMinFactor={props.elevationDimMinFactor}
            widthScale={props.widthScale}
            ellipseTiltExaggeration={props.ellipseTiltExaggeration}
          />
        );
      })}
    </group>
  );
}
