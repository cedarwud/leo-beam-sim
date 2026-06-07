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
 * Number of earth-fixed cells the SINR-live lane tiles. 61 gives ~99/100
 * nearest-cell coverage of the 200×90 km / 100-UE population on the real
 * candidate-rich trajectory (S-cells-1 probe). Cell SIZE is fixed by the beam
 * 3 dB width (`altitude·tan(θ/2)`), so cellCount only widens the tiling, never
 * shrinks the off-axis story. Served coverage under one-sat-over-area is lower
 * than tile coverage — that, plus idle-cell semantics, is the S-cells-5 tune;
 * this const is its single tuning point.
 */
export const SINR_LIVE_CELL_COUNT = 19;

/**
 * Link-budget / cell-layout 3 dB beamwidth for the SINR-live lane (rad ≈ 7.4°).
 * WIDER than the profile antenna (3.32°) on purpose: cell SIZE is
 * `altitude·tan(beamwidth/2)`, so a wider beam makes FEWER, BIGGER cells tile the
 * whole 200×90 km service area — letting one satellite's {@link SINR_LIVE_BEAMS_PER_SAT}
 * beams cover a meaningful fraction (the rest filled by hopping) instead of leaving
 * most of the map dark. leo's gain model keeps peak gain (`maxGainDbi`) independent
 * of beamwidth, so widening the lobe costs little SINR (only more co-channel overlap,
 * damped by frequency reuse). Cell layout AND the cell model's link budget both use
 * this value (one physical antenna). This + {@link SINR_LIVE_CELL_COUNT} are the
 * coverage tuning point.
 */
export const SINR_LIVE_CELL_BEAMWIDTH_RAD = 0.13;

/** Beams (simultaneous lit cells) per satellite — leo multibeam = 7. Beam hopping caps to this. */
export const SINR_LIVE_BEAMS_PER_SAT = 7;

/** Beam-hopping slot duration (s): the lit cell window advances each slot. */
export const SINR_LIVE_HOP_SLOT_SEC = 2.5;

/**
 * Elevation mask for the cell truth. Pinned to the cell-layout default (15°),
 * which equals the runtime `MIN_ELEVATION_DEG` (15°) — both are locked equal by
 * the scene-lane-governance gate so the cell candidate visibility matches the
 * runtime `linkSats` filter without importing the THREE-heavy runtime module.
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
    // Cell SIZE uses the WIDE sinr-live beamwidth (not the profile antenna) so the
    // 19 cells tile the whole service area; the model's link budget uses the same
    // value (one antenna) — see SINR_LIVE_CELL_BEAMWIDTH_RAD.
    beamwidth3dBRad: SINR_LIVE_CELL_BEAMWIDTH_RAD,
    cellCount: SINR_LIVE_CELL_COUNT,
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
    beamwidthOverrideRad: SINR_LIVE_CELL_BEAMWIDTH_RAD,
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
