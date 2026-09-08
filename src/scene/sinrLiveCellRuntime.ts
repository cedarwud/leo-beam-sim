/**
 * SINR-live earth-fixed cell-truth RUNTIME adapter — S-cells-2 (ADDITIVE).
 *
 * Authority: `docs/sinr-live-earth-fixed-cells-mini-sdd.md` §5/§6 + the LOCKED
 * decision **S-cells-2-A** (`.agent-memory/project_cinema_quality_2026-06-07`):
 * the cell truth is layered ADDITIVELY on the live frame — `runtimeFrameStep.ts`
 * (`stepRuntimeFrame` / `buildLinkContext`) stays FROZEN and is NOT rewritten.
 * This supersedes SDD §6 S-cells-2's literal "wire into buildLinkContext".
 *
 * What this module does, and ONLY this:
 *   - builds the SINR-live cell layout from the live profile (§4),
 *   - constructs the pure `SinrLiveCellModel` (S-cells-1) when, and only when,
 *     the caller's lane gate `useEarthFixedCellTruth` is on (sinr-live only),
 *   - after each `stepRuntimeFrame`, attaches the model's per-frame cell output
 *     and, only behind the explicit homepage gate, its sole primary decision
 *     frame onto `frame.sinrLiveCells` / `frame.handoverDecisionFrame`.
 *
 * It is pure (no React / Three.js / `viz/`-`app/` symbol) and deliberately
 * imports neither `scene/types` nor `runtimeFrameStep` — it speaks to the frame
 * through the minimal {@link CellTruthFrame} shape, which `SimFrame` structurally
 * satisfies. That keeps the runtime validator (and this module) free of the
 * THREE-importing scene-type hub, mirroring the S-cells-1 `CellModelSat` trick.
 *
 * ADDITIVE invariant (the whole point of S-cells-2-A): when the gate is OFF the
 * factory returns `null`, {@link attachSinrLiveCellFrame} is a no-op, and the
 * frame is byte-identical to today — every existing field
 * (serving / beamCellsBySatId / perUePositions / …) is untouched, so the other
 * three scene lanes and the current sinr-live render see zero drift. The
 * visible scene does NOT change in S-cells-2; render reads this field in
 * S-cells-3.
 *
 * Leo's OWN live SINR-offset surface at 550 km (§7).
 */

import {
  buildCellLayout,
  DEFAULT_MIN_ELEVATION_DEG,
  localKmToLatLon,
  type CellCenter,
  type CellLayout,
} from '../engine/cells/cellLayout';
import { DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE } from '../engine/handover/eeThreshold';
import {
  isSupportedBeamLayoutCount,
  type SupportedBeamLayoutCount,
} from '../core/beam/completeHexPresets';
import type { Profile } from '../profiles/types';
import type { HandoverDecisionFrame } from '../engine/handover/candidateDecisionContract';
import {
  SinrLiveCellModel,
  type CellModelSat,
  type SinrLiveBeamPointingMode,
  type SinrLiveCellFrame,
  type UeInput,
} from './sinrLiveCellModel';
import {
  resolveSinrLivePhysicalRoleBeamCount,
  SINR_LIVE_FOCUSED_CELL_PHYSICAL_BEAM_COUNT,
} from './sinrLiveBeamBudget';

/**
 * Default number of earth-fixed cells the SINR-live lane tiles. The serving
 * satellite control can select the supported 1/7/19 scene-cell layouts through
 * `resolveSinrLiveSceneCellCount`; seven remains the historical default.
 */
export const SINR_LIVE_CELL_COUNT = 7;
/** Maximum scene-cell layout used by the supported 1/7/19 controls. */
export const SINR_LIVE_BEAM_DISPLAY_CELL_COUNT = 19;
/** Historical substrate retained only for archived-TLE display projection. */
export const SINR_LIVE_ARCHIVED_DISPLAY_CELL_COUNT = 37;

/**
 * Keep the homepage's Walker ground-cell presentation on the established
 * Starlink scale.  The synthetic OneWeb preset intentionally keeps a higher
 * shell altitude for satellite motion and visibility, but reusing that
 * altitude in the fixed seven-cell ground lattice would scale every hex from
 * about 16 km to 35 km and cover the whole teaching floor.  This is a
 * presentation substrate bound; it does not change the profile shell altitude,
 * antenna beamwidth, UE inputs, or link-budget calculations.
 */
export const SINR_LIVE_WALKER_PRESENTATION_CELL_ALTITUDE_KM = 550;

export function resolveSinrLiveCellLayoutAltitudeKm(profile: Pick<Profile, 'orbit'>): number {
  const shell = profile.orbit.shells[0];
  if (shell?.id.startsWith('oneweb-')) return SINR_LIVE_WALKER_PRESENTATION_CELL_ALTITUDE_KM;
  return shell?.altitudeKm ?? SINR_LIVE_WALKER_PRESENTATION_CELL_ALTITUDE_KM;
}

/**
 * The serving-satellite layout control also selects the live scene cell field:
 * one serving beam exposes one cell, the default seven exposes seven, and the
 * 19-beam presentation exposes the complete 19-cell layout. Invalid or absent
 * values keep the historical seven-cell default.
 */
export function resolveSinrLiveSceneCellCount(
  servingBeamCount?: number,
): SupportedBeamLayoutCount {
  return typeof servingBeamCount === 'number' && isSupportedBeamLayoutCount(servingBeamCount)
    ? servingBeamCount
    : SINR_LIVE_CELL_COUNT;
}

/**
 * Resolve the physical beam budget behind the homepage's focused-cell control.
 * The role count remains 1 for cell-layout/focus semantics, while the physical
 * satellite continues to expose seven beams for intra-cell alternatives.
 */
export function resolveSinrLivePhysicalBeamBudget(
  profile: Profile,
  sceneCellCount?: number,
): number {
  const normalizedSceneCellCount = typeof sceneCellCount === 'number'
    && isSupportedBeamLayoutCount(sceneCellCount)
    ? sceneCellCount
    : undefined;
  if (normalizedSceneCellCount === 1) return SINR_LIVE_FOCUSED_CELL_PHYSICAL_BEAM_COUNT;
  return normalizedSceneCellCount ?? resolveSinrLiveBeamsPerSat(profile);
}

/**
 * Lattice PHASE offset (in cell radii) for the SINR-live earth-fixed grid — the
 * beam-stage ① stage-geometry fix (`docs/beam-stage-overhaul-sdd.md` §3①).
 *
 * The protagonist UE is observer-anchored at ENU (0,0); the unphased lattice puts
 * cell-0's centre ALSO at (0,0), so the protagonist sat dead-centre in its beam
 * (the "波束一定打在 UE 正中央" complaint). Shifting EVERY cell centre east by
 * `0.55 · cellRadius` moves the origin to `0.55 · r` WEST of its cell centre:
 * visibly off-centre, yet safely inside cell 0 (0.55 < the 0.866·r apothem, so the
 * nearest-cell membership is unambiguous — not on an edge/vertex). 0.55 is the
 * owner-chosen "moderate" magnitude (0.5–0.6 r) — dramatic enough to read, gentle
 * enough that the grid translation barely changes 200×90 coverage.
 *
 * Applied ONLY through {@link buildSinrLiveCellLayout}, so it phases the SINR-live
 * cell TRUTH and the cones/markers that render from it — and, since both the
 * the sinr-live lane renders via the shared `showSinrBeamRender` path. The
 * scheduler geometry never passes a phase, so it is byte-identical.
 */
export const SINR_LIVE_CELL_PHASE_OFFSET_RADII = { east: 0.15, north: 0.30 } as const;

/**
 * Homepage live-Walker ground geometry. The canonical/TLE topology remains in
 * `topology/dispersedSevenCellTopology.ts`; these coordinates are deliberately
 * local to the live presentation so the homepage can show the compact regular
 * seven-cell teaching cluster without changing the canonical experiment substrate.
 *
 * The renderer paints a 1.04-radius outer rim around each hex, so open the
 * regular axial ring by 15% of one cell radius. UE generation receives these
 * exact centres, so the UE population, beam bases, labels, and cell borders
 * cannot drift apart.
 */
export const SINR_LIVE_CELL_RING_SPACING = 1.15;
export const SINR_LIVE_SEVEN_CELL_AXIAL_COORDINATES = Object.freeze([
  Object.freeze({ id: 0 as const, q: 0, r: 0 }),
  Object.freeze({ id: 1 as const, q: -SINR_LIVE_CELL_RING_SPACING, r: SINR_LIVE_CELL_RING_SPACING }),
  Object.freeze({ id: 2 as const, q: -SINR_LIVE_CELL_RING_SPACING, r: 0 }),
  Object.freeze({ id: 3 as const, q: 0, r: -SINR_LIVE_CELL_RING_SPACING }),
  Object.freeze({ id: 4 as const, q: SINR_LIVE_CELL_RING_SPACING, r: -SINR_LIVE_CELL_RING_SPACING }),
  Object.freeze({ id: 5 as const, q: 0, r: SINR_LIVE_CELL_RING_SPACING }),
  Object.freeze({ id: 6 as const, q: SINR_LIVE_CELL_RING_SPACING, r: 0 }),
] as const);

/**
 * The live 19-cell layout keeps the seven established cells above as IDs 0–6,
 * then deliberately places IDs 7–18 over a wider, asymmetric ground footprint.
 * These positions are expressed in cell-radius units rather than kilometres,
 * so changing shell altitude still scales the scene with the same physical cell
 * radius. When the serving-satellite control is 19, all 19 are live UE/SINR
 * cells; the default seven-cell mode still uses only IDs 0–6.
 *
 * This is intentionally NOT the shared radius-two substrate.  A complete
 * radius-two disk is too compact for the homepage's 200 × 90 km visual area;
 * at a 19-beam budget it reads as one solid block in the middle of the scene.
 */
export const SINR_LIVE_NINETEEN_SCENE_CELL_POSITIONS = Object.freeze([
  Object.freeze({ id: 7 as const, eastRadii: -4.85, northRadii: 1.30 }),
  Object.freeze({ id: 8 as const, eastRadii: -4.15, northRadii: 2.75 }),
  Object.freeze({ id: 9 as const, eastRadii: -4.65, northRadii: -0.85 }),
  Object.freeze({ id: 10 as const, eastRadii: -3.55, northRadii: -2.55 }),
  Object.freeze({ id: 11 as const, eastRadii: -0.55, northRadii: 3.85 }),
  Object.freeze({ id: 12 as const, eastRadii: -2.35, northRadii: -1.05 }),
  Object.freeze({ id: 13 as const, eastRadii: 0.85, northRadii: 2.55 }),
  Object.freeze({ id: 14 as const, eastRadii: -0.10, northRadii: -3.05 }),
  Object.freeze({ id: 15 as const, eastRadii: 2.95, northRadii: -1.15 }),
  Object.freeze({ id: 16 as const, eastRadii: 3.25, northRadii: 2.35 }),
  Object.freeze({ id: 17 as const, eastRadii: 5.05, northRadii: 1.40 }),
  Object.freeze({ id: 18 as const, eastRadii: 4.45, northRadii: -0.90 }),
] as const);
/** @deprecated Use the scene-cell name; retained for older probes. */
export const SINR_LIVE_NINETEEN_DISPLAY_CELL_POSITIONS = SINR_LIVE_NINETEEN_SCENE_CELL_POSITIONS;

/**
 * Fallback beamwidth retained for older callers. The live legacy route reads
 * `profile.antenna.beamwidth3dBRad` directly so the left beamwidth control
 * changes both the fixed-cell geometry and the selected-link formula.
 */
export const SINR_LIVE_CELL_BEAMWIDTH_RAD = 0.058;

/**
 * Historical constants retained for archived validation/probe imports. They do
 * not override the active profile-backed antenna on `/`.
 */
export const SINR_LIVE_CELL_ANTENNA_EFFICIENCY = 0.6;

/**
 * Historical showcase value retained for archived probes. The active route
 * reads `profile.antenna.maxGainDbi`.
 */
export const SINR_LIVE_CELL_MAX_GAIN_DBI = 33.5;

/**
 * Presentation coverage guard (deg). It keeps the selected 1/7/19 scene cells
 * populated; the profile max-steering value remains the link-budget parameter
 * and still changes scan loss/SINR on the legacy route.
 */
export const SINR_LIVE_CELL_MAX_STEERING_DEG = 50;

/** Historical showcase scan-loss value retained for archived probe imports. */
export const SINR_LIVE_CELL_SCAN_LOSS_DB = 4.5;

/**
 * DEFAULT beams (simultaneous lit cells) per satellite — leo multibeam = 7. Beam
 * hopping caps to this.
 *
 * This is now the FALLBACK, not the lane's fixed truth: the EFFECTIVE value is
 * resolved per live profile by {@link resolveSinrLiveBeamsPerSat}. It stays
 * exported (and stays 7) because it is the value every profile in `src/profiles`
 * carries, so the model/runtime/serving-equivalence gates that pin against it are
 * unchanged on the shipped profiles.
 */
export const SINR_LIVE_BEAMS_PER_SAT = 7;

/**
 * Hard upper bound on the resolved beams-per-satellite (see
 * {@link resolveSinrLiveBeamsPerSat}).
 *
 * Pinned to the historical default scene-cell count: the global profile fallback
 * remains seven. The serving-satellite role override can select the supported
 * 19-cell scene and supplies its own serving budget.
 */
export const SINR_LIVE_MAX_BEAMS_PER_SAT = SINR_LIVE_CELL_COUNT;

/**
 * Configured per-satellite capacity for the presentation surface. The global
 * profile capacity remains separate from the serving-satellite role override;
 * the latter selects the live scene-cell layout as well as its illuminated
 * serving budget, without fabricating a serving decision or link-budget term.
 */
export function resolveSinrLiveBeamCapacityPerSat(profile: Profile): number {
  const raw = profile.beams?.maxActivePerSat ?? profile.beams?.perSatellite;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return SINR_LIVE_BEAMS_PER_SAT;
  const floored = Math.floor(raw);
  return Number.isFinite(floored) ? Math.max(1, floored) : SINR_LIVE_BEAMS_PER_SAT;
}

/**
 * Resolve how many cells one satellite may light per hop slot on the SINR-live
 * cell lane, from the LIVE profile — which is what makes the Topology tab's
 * "Beam count per satellite" control (7 / 19 / 37) actually reach this lane.
 * `applySceneTopology` writes the user's choice into BOTH `beams.perSatellite`
 * and `beams.maxActivePerSat`; this lane's quantity is "simultaneously lit
 * cells", i.e. `maxActivePerSat`, with `perSatellite` as the fallback for
 * profiles that omit it.
 *
 * FAIL CLOSED: a missing / non-numeric / non-finite (NaN, ±Infinity) value
 * returns {@link SINR_LIVE_BEAMS_PER_SAT} (7) rather than propagating garbage
 * into the hop scheduler. A finite non-integer is floored (a fractional beam
 * count is a magnitude, not a hard error). The result is then clamped to
 * `[1, SINR_LIVE_MAX_BEAMS_PER_SAT]`, so it is always a usable integer ≥ 1 and
 * can never exceed the cell tiling.
 */
export function resolveSinrLiveBeamsPerSat(profile: Profile): number {
  return Math.min(
    SINR_LIVE_MAX_BEAMS_PER_SAT,
    resolveSinrLiveBeamCapacityPerSat(profile),
  );
}

/** Beam-hopping slot duration (s): the lit cell window advances each slot. */
export const SINR_LIVE_HOP_SLOT_SEC = 2.5;

/**
 * Legacy `/` presentation steering hold (s). This is intentionally longer than
 * the beam-hopping slot: the display keeps one ECEF boresight while the moving
 * satellite travels, so theta and the previous-step power recurrence have a
 * readable response before the next electronic re-pointing.
 */
export const SINR_LIVE_PRESENTATION_STEERING_HOLD_SEC = 6;

/**
 * Elevation mask for the cell truth. Pinned to the cell-layout default (15°),
 * which equals the runtime `MIN_ELEVATION_DEG` (15°) — both are locked equal by
 * the validate:s3:one-reset imported-constant VALUE asserts (S3-3, replacing the
 * retired QUAR-S3-STEP literal triple-pin) so the cell candidate visibility matches
 * the runtime `linkSats` filter without importing the THREE-heavy runtime module.
 */
export const SINR_LIVE_CELL_MIN_ELEVATION_DEG = DEFAULT_MIN_ELEVATION_DEG;

/**
 * Minimal mutable frame shape {@link attachSinrLiveCellFrame} reads and writes.
 * `SimFrame` structurally satisfies it (its `satellites` / `perUePositions`
 * carry these fields plus more, and its `sinrLiveCells?` is the writable optional
 * declared in `scene/types.ts`). Declaring it here — rather than importing
 * `SimFrame` — keeps this module and its validator off the THREE-importing
 * scene-type hub.
 */
export interface CellTruthFrame {
  readonly satellites: readonly CellModelSat[];
  readonly perUePositions: ReadonlyArray<{
    readonly id: string;
    readonly eastKm: number;
    readonly northKm: number;
  }>;
  readonly simTimeSec: number;
  sinrLiveCells?: SinrLiveCellFrame;
  handoverDecisionFrame?: HandoverDecisionFrame | null;
}

function buildLiveCellCenter(
  layout: CellLayout,
  id: number,
  eastRadii: number,
  northRadii: number,
): CellCenter {
  const phaseXKm = layout.cellRadiusKm * SINR_LIVE_CELL_PHASE_OFFSET_RADII.east;
  const phaseYKm = layout.cellRadiusKm * SINR_LIVE_CELL_PHASE_OFFSET_RADII.north;
  const localXKm = layout.cellRadiusKm * eastRadii + phaseXKm;
  const localYKm = layout.cellRadiusKm * northRadii + phaseYKm;
  const latLon = localKmToLatLon(
    layout.serviceArea.centerLatDeg,
    layout.serviceArea.centerLonDeg,
    localXKm,
    localYKm,
  );
  return {
    cellId: id,
    latDeg: latLon.latDeg,
    lonDeg: latLon.lonDeg,
    localXKm,
    localYKm,
  };
}

/** Map a local axial arrangement onto the profile-derived cell footprint. */
function applyLiveAxialTopology(
  layout: CellLayout,
  coordinates: readonly { readonly id: number; readonly q: number; readonly r: number }[],
): CellLayout {
  const centers = coordinates.map(({ id, q, r }) => buildLiveCellCenter(
    layout,
    id,
    Math.sqrt(3) * (q + r / 2),
    1.5 * r,
  ));
  return {
    ...layout,
    count: centers.length,
    centers,
  };
}

export function buildSinrLiveCellLayout(
  profile: Profile,
  cellCount = SINR_LIVE_CELL_COUNT,
): CellLayout {
  const layout = buildCellLayout({
    centerLatDeg: profile.orbit.observerLatDeg,
    centerLonDeg: profile.orbit.observerLonDeg,
    altitudeKm: resolveSinrLiveCellLayoutAltitudeKm(profile),
    // The antenna beamwidth remains profile-backed.  OneWeb's higher shell is
    // retained by the Walker trajectory/model; only this homepage ground-cell
    // presentation substrate stays on the established compact scale.
    beamwidth3dBRad: profile.antenna.beamwidth3dBRad,
    cellCount,
    // Phase the lattice off the ENU origin so the protagonist UE is off-centre
    // (beam-stage ①). One knob for the live SINR lane.
    phaseOffsetRadii: SINR_LIVE_CELL_PHASE_OFFSET_RADII,
  });
  if (cellCount === SINR_LIVE_SEVEN_CELL_AXIAL_COORDINATES.length) {
    return applyLiveAxialTopology(layout, SINR_LIVE_SEVEN_CELL_AXIAL_COORDINATES);
  }
  if (cellCount === SINR_LIVE_BEAM_DISPLAY_CELL_COUNT) {
    const activeCenters = applyLiveAxialTopology(
      layout,
      SINR_LIVE_SEVEN_CELL_AXIAL_COORDINATES,
    ).centers;
    const extendedCenters = SINR_LIVE_NINETEEN_SCENE_CELL_POSITIONS.map(position => (
      buildLiveCellCenter(layout, position.id, position.eastRadii, position.northRadii)
    ));
    return {
      ...layout,
      count: activeCenters.length + extendedCenters.length,
      centers: [...activeCenters, ...extendedCenters],
    };
  }
  return layout;
}

/**
 * Construct the cell-truth model for the SINR-live lane, or `null` when the lane
 * gate is off (the other three lanes) — the additive no-op gate. A null return
 * is what guarantees the other lanes stay byte-identical (S-cells-2-A).
 */
export function createSinrLiveCellModel(
  profile: Profile,
  useEarthFixedCellTruth: boolean,
  epochUtcMs: number,
  beamCountBySatellite: Readonly<Record<string, number>> = {},
  servingBeamCount?: number,
  candidateBeamCount?: number,
  beamHoppingEnabled = true,
  beamPointingMode: SinrLiveBeamPointingMode = 'earth-fixed-cell',
  multiCandidateDecisionEnabled = false,
  eeThresholdKbitPerJoule = DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE,
): SinrLiveCellModel | null {
  if (!useEarthFixedCellTruth) return null;
  const sceneCellCount = resolveSinrLiveSceneCellCount(servingBeamCount);
  const cellLayout = buildSinrLiveCellLayout(
    profile,
    sceneCellCount,
  );
  if (cellLayout.centers.length === 0) return null;
  // Once the serving-satellite control is present, it is the live scene's
  // global beam fallback as well as the serving-role override. This keeps
  // unscoped satellites and a candidate without an explicit override on the
  // same 1/7/19 budget; direct pure-model callers without that control retain
  // the historical profile fallback.
  const fallbackBeamsPerSat = servingBeamCount === undefined
    ? resolveSinrLiveBeamsPerSat(profile)
    : multiCandidateDecisionEnabled
      ? resolveSinrLivePhysicalBeamBudget(profile, sceneCellCount)
      : sceneCellCount;
  const physicalServingBeamCount = multiCandidateDecisionEnabled
    ? resolveSinrLivePhysicalRoleBeamCount(servingBeamCount)
    : servingBeamCount;
  const physicalCandidateBeamCount = multiCandidateDecisionEnabled
    ? resolveSinrLivePhysicalRoleBeamCount(candidateBeamCount)
    : candidateBeamCount;
  return new SinrLiveCellModel({
    profile,
    cellLayout,
    observer: { latDeg: profile.orbit.observerLatDeg, lonDeg: profile.orbit.observerLonDeg },
    minElevationDeg: SINR_LIVE_CELL_MIN_ELEVATION_DEG,
    epochUtcMs,
    candidateOpportunityMeasurementEnabled: multiCandidateDecisionEnabled,
    multiCandidateDecisionEnabled,
    // Beam hopping: each satellite lights ≤N cells/slot, rotating; link-budget
    // beamwidth matches the cell layout (one antenna). N comes from the LIVE
    // profile (`resolveSinrLiveBeamsPerSat`), so the Topology tab's beam-count
    // control reaches this lane; it falls back to SINR_LIVE_BEAMS_PER_SAT (7),
    // which is what every shipped profile carries.
    beamsPerSat: fallbackBeamsPerSat,
    beamsPerSatById: beamCountBySatellite,
    servingBeamsPerSat: physicalServingBeamCount,
    candidateBeamsPerSat: physicalCandidateBeamCount,
    eeThresholdKbitPerJoule,
    beamHoppingEnabled,
    hopSlotSec: SINR_LIVE_HOP_SLOT_SEC,
    beamPointingMode,
    beamPointingUpdateSec: beamPointingMode === 'sampled-steering'
      ? SINR_LIVE_PRESENTATION_STEERING_HOLD_SEC
      : SINR_LIVE_HOP_SLOT_SEC,
    // Keep the selected scene cells populated. This guard is separate from the
    // profile antenna, so it cannot make displayed G^T(θ), scan loss, or SINR
    // values lie about the user's controls.
    coverageSteeringAngleDeg: SINR_LIVE_CELL_MAX_STEERING_DEG,
  });
}

/** Map a live frame into the pure model's UE input (true ENU positions). */
function uesFromFrame(frame: CellTruthFrame): UeInput[] {
  return frame.perUePositions.map(ue => ({ id: ue.id, eastKm: ue.eastKm, northKm: ue.northKm }));
}

/**
 * ADDITIVE attach: when `model` is non-null (sinr-live), run one cell-model step
 * over the frame's satellites + UE positions and hang the result on
 * `frame.sinrLiveCells`. The optional authoritative primary decision is joined
 * at the top-level `frame.handoverDecisionFrame`; the nested cell frame never
 * carries a shadow copy. When `model` is null this remains a byte-identical
 * no-op for every other lane.
 */
export function attachSinrLiveCellFrame(
  frame: CellTruthFrame,
  model: SinrLiveCellModel | null,
  dtSec: number,
): void {
  if (model === null) return;
  frame.sinrLiveCells = model.step({
    visibleSats: frame.satellites,
    ues: uesFromFrame(frame),
    simTimeSec: frame.simTimeSec,
    dtSec: Number.isFinite(dtSec) && dtSec > 0 ? dtSec : 0,
  });
  frame.handoverDecisionFrame = model.getHandoverDecisionFrame();
}
