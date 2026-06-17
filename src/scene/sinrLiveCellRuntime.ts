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
 *   - after each `stepRuntimeFrame`, attaches the model's per-frame output onto
 *     the live frame as the NEW optional field `frame.sinrLiveCells`.
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
 * NOT MODQN/paper proof — leo's OWN live SINR-offset surface at 550 km (§7).
 */

import { buildCellLayout, DEFAULT_MIN_ELEVATION_DEG, type CellLayout } from '../engine/cells/cellLayout';
import type { Profile } from '../profiles/types';
import {
  SinrLiveCellModel,
  type CellModelSat,
  type SinrLiveCellFrame,
  type UeInput,
} from './sinrLiveCellModel';

/**
 * Number of earth-fixed cells the SINR-live lane tiles. 37 (the producer hex
 * count) gives ~92/100 nearest-cell coverage of the 200×90 km / 100-UE
 * population at 550 km with a realistic 3.3° beam (S-cells-4 sweep). Cell SIZE
 * is fixed by the beam 3 dB width (`altitude·tan(θ/2)`), so cellCount only
 * widens the tiling, never shrinks the off-axis story. With the focus-scoped
 * cone render (S-cells-4b) on-screen clutter is bounded regardless, so this is
 * a coverage/served-continuity knob, not a clutter knob (19 vs 37 confirmed on
 * :3001 in S-cells-4e).
 */
export const SINR_LIVE_CELL_COUNT = 37;

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
 * sinr-live and modqn-live-cell-preview lanes render via the shared
 * `showSinrBeamRender` path, BOTH inherit it from this one knob. The MODQN/producer
 * `useCellSchedule` geometry never passes a phase, so it is byte-identical.
 */
export const SINR_LIVE_CELL_PHASE_OFFSET_RADII = { east: 0.55, north: 0 } as const;

/**
 * Link-budget / cell-layout 3 dB beamwidth for the SINR-live lane (rad ≈ 3.32°).
 * This now equals the profile antenna beamwidth — a realistic LEO value between
 * Starlink (~1.5–2°) and 3GPP TR 38.821 LEO-600 (~4.4°). Cell SIZE
 * (`altitude·tan(θ/2)`) AND the model's link-budget GAIN are derived from this
 * SAME beamwidth (one physical antenna): {@link SINR_LIVE_CELL_MAX_GAIN_DBI} is
 * `consistentPeakGainDbi(this, efficiency)`, so the antenna can never encode the
 * profile's >100 %-efficiency 40 dBi @ 3.32° bug. Coverage of the whole service
 * area is delivered by STEERING ({@link SINR_LIVE_CELL_MAX_STEERING_DEG}) + the
 * cell tiling, not by widening the lobe.
 */
export const SINR_LIVE_CELL_BEAMWIDTH_RAD = 0.058;

/**
 * Profile aperture efficiency used to derive the self-consistent peak gain.
 * Mirrors `hobs-2024-candidate-rich` antenna efficiency (η = 0.6).
 */
export const SINR_LIVE_CELL_ANTENNA_EFFICIENCY = 0.6;

/**
 * SINR-live-only peak boresight gain (dBi), SELF-CONSISTENT with
 * {@link SINR_LIVE_CELL_BEAMWIDTH_RAD} at {@link SINR_LIVE_CELL_ANTENNA_EFFICIENCY}:
 * `consistentPeakGainDbi(0.058 rad, 0.6) ≈ 33.5 dBi`. This OVERRIDES the profile's
 * physically-impossible 40 dBi @ 3.32° (>100 % efficiency) for the showcase lane
 * ONLY — `profile.antenna.maxGainDbi` is left untouched so the steered lane +
 * baseline-KPI windows stay byte-identical (S-cells-4a is a decoupled
 * sinr-live-only truth-input, not an edit to the shared SINR oracle). The
 * `validate:phase-c:sinr-live-cells:runtime` gate locks
 * `|this − consistentPeakGainDbi| < 0.5 dB`.
 */
export const SINR_LIVE_CELL_MAX_GAIN_DBI = 33.5;

/**
 * SINR-live-only max steering angle (deg). The profile's 12° lets only 1–3 of
 * the ~46 above-mask sats steer to the 200×90 area → coverage dropouts + only
 * 1–2 beams ever served; ~50° lets 6–8 serve continuously. Physically real: the
 * 15° elevation mask admits ~63° off-nadir; 3GPP plans ~60°, Starlink measures
 * 44–51°. Overrides `profile.antenna.maxSteeringAngleDeg` for the showcase lane
 * only (the steered lane + baselines keep 12°).
 */
export const SINR_LIVE_CELL_MAX_STEERING_DEG = 50;

/** SINR-live-only scan loss at max steering (dB); paired with the wider 50° steering. */
export const SINR_LIVE_CELL_SCAN_LOSS_DB = 4.5;

/** Beams (simultaneous lit cells) per satellite — leo multibeam = 7. Beam hopping caps to this. */
export const SINR_LIVE_BEAMS_PER_SAT = 7;

/** Beam-hopping slot duration (s): the lit cell window advances each slot. */
export const SINR_LIVE_HOP_SLOT_SEC = 2.5;

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
}

/** Build the SINR-live cell layout from the live profile (§4). */
export function buildSinrLiveCellLayout(profile: Profile): CellLayout {
  return buildCellLayout({
    centerLatDeg: profile.orbit.observerLatDeg,
    centerLonDeg: profile.orbit.observerLonDeg,
    altitudeKm: profile.orbit.shells[0]?.altitudeKm ?? 550,
    // Cell SIZE uses the SINR-live beamwidth; the model's link-budget GAIN derives
    // from the SAME beamwidth (one antenna) — see SINR_LIVE_CELL_BEAMWIDTH_RAD /
    // SINR_LIVE_CELL_MAX_GAIN_DBI.
    beamwidth3dBRad: SINR_LIVE_CELL_BEAMWIDTH_RAD,
    cellCount: SINR_LIVE_CELL_COUNT,
    // Phase the lattice off the ENU origin so the protagonist UE is off-centre
    // (beam-stage ①). One knob; sinr-live + modqn-live both inherit it.
    phaseOffsetRadii: SINR_LIVE_CELL_PHASE_OFFSET_RADII,
  });
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
): SinrLiveCellModel | null {
  if (!useEarthFixedCellTruth) return null;
  const cellLayout = buildSinrLiveCellLayout(profile);
  if (cellLayout.centers.length === 0) return null;
  return new SinrLiveCellModel({
    profile,
    cellLayout,
    observer: { latDeg: profile.orbit.observerLatDeg, lonDeg: profile.orbit.observerLonDeg },
    minElevationDeg: SINR_LIVE_CELL_MIN_ELEVATION_DEG,
    epochUtcMs,
    // Beam hopping: each satellite lights ≤7 cells/slot, rotating; link-budget
    // beamwidth matches the cell layout (one antenna).
    beamsPerSat: SINR_LIVE_BEAMS_PER_SAT,
    hopSlotSec: SINR_LIVE_HOP_SLOT_SEC,
    // SINR-live-only antenna truth-input overrides (S-cells-4a). They are layered
    // over the profile antenna and never mutate it → the steered lane + baseline
    // KPI are byte-identical. Gain is self-consistent with the beamwidth.
    beamwidthOverrideRad: SINR_LIVE_CELL_BEAMWIDTH_RAD,
    maxGainDbiOverrideDbi: SINR_LIVE_CELL_MAX_GAIN_DBI,
    maxSteeringAngleOverrideDeg: SINR_LIVE_CELL_MAX_STEERING_DEG,
    scanLossAtMaxSteeringOverrideDb: SINR_LIVE_CELL_SCAN_LOSS_DB,
  });
}

/** Map a live frame into the pure model's UE input (true ENU positions). */
function uesFromFrame(frame: CellTruthFrame): UeInput[] {
  return frame.perUePositions.map(ue => ({ id: ue.id, eastKm: ue.eastKm, northKm: ue.northKm }));
}

/**
 * ADDITIVE attach: when `model` is non-null (sinr-live), run one cell-model step
 * over the frame's satellites + UE positions and hang the result on
 * `frame.sinrLiveCells`. When `model` is null (gate off) this is a no-op and the
 * frame is left byte-identical — the load-bearing zero-drift guarantee. Mutates
 * ONLY `frame.sinrLiveCells`; never any existing frame field.
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
}
