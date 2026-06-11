/**
 * SINR-live earth-fixed cell model — S-cells-1 PURE MODEL CONTRACT spike.
 *
 * Authority: `docs/sinr-live-earth-fixed-cells-mini-sdd.md` (CQ3 root fix).
 * Decisions locked: **A1** (no S0 unanchor) + **B3** (hybrid serving truth).
 *
 * This module is a PURE MODEL. It mutates no runtime state, imports no React /
 * Three.js / `viz/`-`app/` symbol, and — critically (codex BLOCK-5) — does NOT
 * touch `buildLinkContext` / `stepRuntimeFrame`. It is the contract the later
 * runtime switch (S-cells-2) will consume; here it exists only to be unit-tested
 * and probed for real off-axis distribution + nearest-cell coverage + sane
 * intra/inter counts.
 *
 * What it produces, per frame, for the SINR-live lane:
 *   1. UE → nearest earth-fixed cell membership (§5.1).
 *   2. per-cell serving sat by SINR + the existing sinr-offset `HandoverManager`
 *      policy — NOT the round-robin `cellScheduler` (codex BLOCK-3 / B3 / §5.1).
 *   3. the four separated identities (§5.2 / codex BLOCK-4):
 *        - cell      = earth-fixed cell id (geography)
 *        - beam      = sat × cell (`cellBeamIdentity`)
 *        - frequency = `cellId mod reuseFactor` (STABLE per cell, geographic —
 *          never a rotating per-slot beamIndex)
 *        - handover  = a change in a UE's SERVING (intra = serving SAT unchanged
 *          + serving CELL changes; inter = serving SAT changes)
 *   4. per-(sat,cell) scan angle (sat-nadir → fixed cell centre), per-cell slant
 *      range + elevation, and per-UE off-axis (dist UE → cell centre) (§5.3).
 *   5. intra/inter classification from the UE's serving transition (§5.2).
 *
 * SINR is computed by reusing the validated `computeLinkBudget` (CLAUDE.md §4/§5:
 * reuse, do not rewrite). We point each lit beam at its FIXED cell centre and
 * measure at the true UE position, so the UE sits genuinely off-axis — this is
 * the CQ3 fix at the truth layer (the steered-lattice `anchorToUe` re-snaps the
 * beam onto the UE and hides the real ~27.6 km off-axis).
 *
 * NOT MODQN/paper proof: this is leo's OWN live SINR-offset surface at 550 km,
 * not the producer's 780 km / 2° baseline and not MODQN decisions (§7).
 */

import { computeOffAxisDeg } from '../engine/signal/beam-gain';
import { computeLinkBudget } from '../engine/signal/link-budget';
import { computeTr38811SlantRangeKm } from '../engine/signal/slant-range';
import type {
  ActiveBeamAssignment,
  LinkSample,
  SatelliteSnapshot,
  UEPosition,
} from '../engine/signal/types';
import {
  DEFAULT_MIN_ELEVATION_DEG,
  elevationAngleRad,
  type CellCenter,
  type CellLayout,
} from '../engine/cells/cellLayout';
import { HandoverManager } from '../engine/handover/handover-manager';
import type { Profile } from '../profiles/types';
import { EARTH_KM_PER_DEG } from '../engine/orbit/earth-constants';

/**
 * Minimal satellite shape this pure model reads. The runtime's `VisibleSat`
 * structurally satisfies it, so callers (S-cells-2 runtime, probe) pass
 * `VisibleSat[]` directly — keeping the model free of the `scene/types` hub
 * (and its THREE.js / app-symbol imports), which is what makes the "pure model,
 * imports no React/Three.js" claim literally true.
 */
export interface CellModelSat {
  readonly id: string;
  readonly shellId: string;
  readonly altitudeKm: number;
  readonly latDeg: number;
  readonly lonDeg: number;
  readonly topo: { readonly azimuthDeg: number; readonly elevationDeg: number };
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * `computeLinkBudget` groups co-channel interference by `getBeamFrequencyIndex`
 * = `(beamId - 1) mod reuse`. Encoding the link-budget beamId as `cellId + 1`
 * makes that grouping evaluate to exactly `cellId mod reuse` — so the SINR's
 * interference partition equals the REPORTED frequency identity (§5.2). The
 * model's public surface always speaks in `cellId`; this offset is an internal
 * link-budget encoding detail, asserted equivalent in the model validator.
 */
const CELL_BEAM_ID_OFFSET = 1;

export type ServingTransitionKind = 'none' | 'intra' | 'inter' | 'attach' | 'drop';

export interface UeInput {
  readonly id: string;
  /** True position, observer-relative ENU km (east, north). */
  readonly eastKm: number;
  readonly northKm: number;
}

/** Per-(sat, cell) geometry — §5.3, measured to the FIXED cell centre. */
export interface CellScanGeometry {
  readonly satId: string;
  readonly cellId: number;
  /** Angle from the satellite nadir to the fixed cell centre (deg). */
  readonly scanAngleDeg: number;
  /** Per-(sat, cell) slant range (km), from per-cell elevation — not one sat range. */
  readonly slantRangeKm: number;
  /** Per-cell link elevation (deg). */
  readonly elevationDeg: number;
  /** Ground distance from the satellite nadir to the cell centre (km). */
  readonly nadirToCellKm: number;
}

export interface CellCandidate extends CellScanGeometry {
  /** Boresight SINR (dB) the candidate sat would deliver at the cell centre. */
  readonly sinrDb: number;
}

export interface CellServingRecord {
  readonly cellId: number;
  /** null when no candidate clears the attach threshold (idle cell — honest). */
  readonly servingSatId: string | null;
  /** `satId#cell{cellId}` beam identity; null when unserved. */
  readonly beamIdentity: string | null;
  /** Stable geographic frequency colour: `cellId mod reuse`. */
  readonly frequencyIndex: number;
  /** Smoothed serving SINR at the cell centre (dB); null when unserved. */
  readonly servingSinrDb: number | null;
  readonly candidateCount: number;
}

export interface UeCellServingRecord {
  readonly ueId: string;
  /** Nearest-cell membership; null only when the layout has no cells. */
  readonly cellId: number | null;
  /** Ground distance UE → its cell centre (km) = the off-axis lever. */
  readonly cellDistanceKm: number;
  /** Off-axis angle UE → cell centre at the serving sat altitude (deg). */
  readonly offAxisDeg: number;
  readonly servingSatId: string | null;
  readonly beamIdentity: string | null;
  readonly frequencyIndex: number | null;
  /**
   * UE SINR at its TRUE off-axis position (dB). null when unserved, AND null
   * when the UE has a serving cell but sits beyond the beam-gain floor
   * (`computeBeamGainDb` ≤ floor → the beam is skipped): a served-by-assignment
   * UE with no decodable signal. Such a UE is still counted in
   * {@link SinrLiveCellFrame.servedUeCount} (served = has a serving cell,
   * mirroring the S2 aggregate's served-by-assignment count) but is excluded
   * from any SINR mean. Empirically never fires in the real 37/61-cell lane
   * config (nearest-cell off-axis p95 ≈ 2°); reachable only with a sparse
   * layout / very distant UE.
   */
  readonly sinrDb: number | null;
  readonly handoverKind: ServingTransitionKind;
}

/**
 * A satellite's beam illuminating a cell this slot — one per post-beam-hopping
 * lit (sat, cell) pair. This is the "where the beams POINT" surface (S-cells-4b):
 * the render draws the focused satellite's illuminated beams as cones, not only
 * the cells that ended up SERVED. `serving` marks the beam whose sat is the
 * cell's CHOSEN serving sat (SINR + HandoverManager) — a cell can be illuminated
 * by several sats but served by at most one. A cell NOT lit this slot (idle) has
 * no illuminated beam → no cone (honest under K<N hopping).
 */
export interface IlluminatedCellBeam {
  readonly satId: string;
  readonly cellId: number;
  /** Stable geographic frequency colour (`cellId mod reuse`). */
  readonly frequencyIndex: number;
  /** True when this sat is the cell's chosen serving sat (not merely illuminating). */
  readonly serving: boolean;
}

export interface SinrLiveCellFrame {
  readonly simTimeSec: number;
  readonly cells: readonly CellServingRecord[];
  readonly ues: readonly UeCellServingRecord[];
  /** Lit (sat, cell) beams this slot (post beam-hopping) — the cone render surface. */
  readonly illuminatedBeams: readonly IlluminatedCellBeam[];
  readonly servedCellCount: number;
  /** UEs with a serving cell (served-by-assignment, mirrors the S2 aggregate);
   *  may include a UE whose own off-axis SINR is null — see {@link UeCellServingRecord.sinrDb}. */
  readonly servedUeCount: number;
  /** Distinct serving sats across all lit cells this frame. */
  readonly servingSatCount: number;
  readonly intraHandoverCount: number;
  readonly interHandoverCount: number;
}

/**
 * The cell-truth serving record for the PRIMARY UE (the observer anchor at
 * `perUePositions[0]`). The single source consumed by BOTH the
 * connected-sat invariant (`collectConnectedClaims`, the rendered-beam oracle)
 * AND the InfoPanel publisher (`buildPublishedPrimaryServing`, S5-2b) so the
 * panel's ACTIVE SERVING label, the cones, and the must-hold invariant all read
 * ONE primary oracle — no drift. The primary UE sits at index 0 of
 * `perUePositions`; match it into the cell UE records by id (fall back to the
 * first cell UE only when there is no primary id at all, mirroring the original
 * inline resolution byte-for-byte).
 */
export function resolvePrimaryCellServingRecord(
  cellFrame: SinrLiveCellFrame,
  perUePositions: ReadonlyArray<{ id: string }>,
): UeCellServingRecord | null {
  const primaryUeId = perUePositions[0]?.id;
  if (primaryUeId === undefined) return cellFrame.ues[0] ?? null;
  return cellFrame.ues.find(ue => ue.ueId === primaryUeId) ?? null;
}

/** The primary UE's cell-truth serving satId (null when unserved / absent). */
export function resolvePrimaryCellServingSatId(
  cellFrame: SinrLiveCellFrame,
  perUePositions: ReadonlyArray<{ id: string }>,
): string | null {
  return resolvePrimaryCellServingRecord(cellFrame, perUePositions)?.servingSatId ?? null;
}

export interface SinrLiveCellStepInput {
  readonly visibleSats: readonly CellModelSat[];
  readonly ues: readonly UeInput[];
  readonly simTimeSec: number;
  readonly dtSec: number;
}

export interface SinrLiveCellModelConfig {
  readonly profile: Profile;
  readonly cellLayout: CellLayout;
  readonly observer: { readonly latDeg: number; readonly lonDeg: number };
  readonly minElevationDeg?: number;
  readonly epochUtcMs: number;
  /**
   * Max cells one satellite may ILLUMINATE per hopping slot (its beam budget).
   * A real multibeam satellite forms a fixed number of simultaneous beams (leo =
   * 7), so it cannot light every cell it can geometrically reach. When a sat has
   * more candidate cells than this, only `beamsPerSat` are lit this slot and the
   * window ROTATES over slots (beam hopping); the rest are idle this slot. Default
   * `Infinity` = no cap (the pure-model default; the runtime passes 7). Illumination
   * gating is a SCHEDULING decision — the SERVING sat of a lit cell is still chosen
   * by SINR + the `HandoverManager` (B3 / codex BLOCK-3), never round-robin.
   */
  readonly beamsPerSat?: number;
  /** Beam-hopping slot duration (s); the lit window advances each slot. Default 2.5. */
  readonly hopSlotSec?: number;
  /**
   * Override the link-budget antenna 3 dB beamwidth (rad). The cell SIZE
   * (`cellLayout.cellRadiusKm`) and the antenna GAIN must come from the SAME
   * beamwidth (one physical antenna); the runtime sizes both together. Default
   * `undefined` = use the profile antenna.
   */
  readonly beamwidthOverrideRad?: number;
  /**
   * Override the antenna PEAK boresight gain (dBi) — S-cells-4a. This is a
   * SINR-live-only TRUTH-INPUT override (the shared `profile.antenna.maxGainDbi`
   * is left UNTOUCHED so the steered lane + baseline-KPI windows stay
   * byte-identical). It must be SELF-CONSISTENT with {@link beamwidthOverrideRad}:
   * `|maxGainDbi − consistentPeakGainDbi(θ, efficiency)| < 0.5 dB` (the profile's
   * 40 dBi @ 3.3° implies >100 % efficiency — a real bug this override fixes for
   * the showcase lane). Default `undefined` = use the profile antenna's gain.
   */
  readonly maxGainDbiOverrideDbi?: number;
  /**
   * Override the antenna max steering angle (deg) — S-cells-4a. SINR-live-only.
   * The profile's 12° lets only 1–3 of the ~46 above-mask sats reach the 200×90
   * service area (coverage dropouts); ~50° lets 6–8 serve continuously. Gates BOTH
   * the per-cell candidate list (steering reach to the cell centre) and the
   * link-budget scan-loss ceiling, so the two stay consistent. Default `undefined`
   * = use the profile antenna's steering limit.
   */
  readonly maxSteeringAngleOverrideDeg?: number;
  /**
   * Override the scan loss at max steering (dB) — S-cells-4a. SINR-live-only.
   * Paired with {@link maxSteeringAngleOverrideDeg} (wider steering → slightly
   * higher edge-of-scan loss). Default `undefined` = use the profile antenna's
   * scan loss.
   */
  readonly scanLossAtMaxSteeringOverrideDb?: number;
}

// ---------------------------------------------------------------------------
// Pure identity + geometry helpers (individually unit-tested).
// ---------------------------------------------------------------------------

/** Stable geographic frequency colour for a cell — §5.2. NOT a beamIndex. */
export function cellFrequencyIndex(cellId: number, frequencyReuse: number): number {
  const reuse = Number.isFinite(frequencyReuse) ? Math.max(1, Math.floor(frequencyReuse)) : 1;
  const id = Math.max(0, Math.floor(cellId));
  return id % reuse;
}

/** Internal link-budget beamId encoding (see {@link CELL_BEAM_ID_OFFSET}). */
export function cellLinkBudgetBeamId(cellId: number): number {
  return Math.max(0, Math.floor(cellId)) + CELL_BEAM_ID_OFFSET;
}

/** Recover a cellId from the internal link-budget beamId. */
export function cellIdFromLinkBudgetBeamId(beamId: number): number {
  return Math.max(0, Math.floor(beamId) - CELL_BEAM_ID_OFFSET);
}

/** Beam identity = sat × cell (§5.2). */
export function cellBeamIdentity(satId: string, cellId: number): string {
  return `${satId}#cell${Math.max(0, Math.floor(cellId))}`;
}

/** UE → nearest earth-fixed cell by local-ENU distance (§5.1). */
export function assignUeToNearestCell(
  ue: Pick<UeInput, 'eastKm' | 'northKm'>,
  cellLayout: CellLayout,
): { cellId: number | null; distanceKm: number } {
  let bestCellId: number | null = null;
  let bestDistanceKm = Infinity;
  for (const cell of cellLayout.centers) {
    const distanceKm = Math.hypot(ue.eastKm - cell.localXKm, ue.northKm - cell.localYKm);
    if (distanceKm < bestDistanceKm) {
      bestDistanceKm = distanceKm;
      bestCellId = cell.cellId;
    }
  }
  return { cellId: bestCellId, distanceKm: bestCellId === null ? Infinity : bestDistanceKm };
}

/**
 * Satellite nadir ground offset in observer-relative ENU km. Same convention as
 * `runtimeFrameStep.ts:280` so cell-local coords and nadir share one frame.
 */
export function satNadirOffsetKm(
  sat: Pick<CellModelSat, 'latDeg' | 'lonDeg'>,
  observer: { latDeg: number; lonDeg: number },
): { eastKm: number; northKm: number } {
  const cosObsLat = Math.cos(observer.latDeg * DEG_TO_RAD);
  return {
    eastKm: (sat.lonDeg - observer.lonDeg) * EARTH_KM_PER_DEG * cosObsLat,
    northKm: (sat.latDeg - observer.latDeg) * EARTH_KM_PER_DEG,
  };
}

/** Per-(sat, cell) geometry to the FIXED cell centre (§5.3). */
export function computeCellScanGeometry(
  sat: Pick<CellModelSat, 'id' | 'latDeg' | 'lonDeg' | 'altitudeKm'>,
  cell: CellCenter,
  observer: { latDeg: number; lonDeg: number },
): CellScanGeometry {
  const nadir = satNadirOffsetKm(sat, observer);
  const nadirToCellKm = Math.hypot(cell.localXKm - nadir.eastKm, cell.localYKm - nadir.northKm);
  const scanAngleDeg = (Math.atan(nadirToCellKm / Math.max(sat.altitudeKm, 1e-6)) * 180) / Math.PI;
  const elevationDeg = (elevationAngleRad(
    sat.latDeg,
    sat.lonDeg,
    sat.altitudeKm,
    cell.latDeg,
    cell.lonDeg,
  ) * 180) / Math.PI;
  const slantRangeKm = computeTr38811SlantRangeKm(elevationDeg, sat.altitudeKm);
  return { satId: sat.id, cellId: cell.cellId, scanAngleDeg, slantRangeKm, elevationDeg, nadirToCellKm };
}

/**
 * Candidate serving sats for a cell — visible above the elevation mask AND
 * steerable to the cell centre (scan angle within the array limit). §5.1.
 */
export function listCellCandidateSats(
  cell: CellCenter,
  sats: readonly CellModelSat[],
  observer: { latDeg: number; lonDeg: number },
  maxSteeringAngleDeg: number,
  minElevationDeg: number,
): CellScanGeometry[] {
  const out: CellScanGeometry[] = [];
  for (const sat of sats) {
    const geom = computeCellScanGeometry(sat, cell, observer);
    if (geom.elevationDeg < minElevationDeg) continue;
    if (geom.scanAngleDeg > maxSteeringAngleDeg + 1e-6) continue;
    out.push(geom);
  }
  return out;
}

/**
 * Classify a UE serving transition (§5.2 / codex BLOCK-4). intra-HO = serving
 * SAT unchanged + serving CELL changes (UE crossed a boundary into a cell the
 * same sat serves); inter-HO = serving SAT changes. Cold attach / service drop
 * are distinct and are NOT counted as handovers.
 */
export function classifyServingTransition(
  prev: { satId: string | null; cellId: number | null } | null,
  next: { satId: string | null; cellId: number | null },
): ServingTransitionKind {
  const prevServed = prev != null && prev.satId !== null;
  const nextServed = next.satId !== null;
  if (!prevServed && !nextServed) return 'none';
  if (!prevServed && nextServed) return 'attach';
  if (prevServed && !nextServed) return 'drop';
  // both served
  if (prev!.satId !== next.satId) return 'inter';
  if (prev!.cellId !== next.cellId) return 'intra';
  return 'none';
}

// ---------------------------------------------------------------------------
// Stateful per-frame driver.
// ---------------------------------------------------------------------------

interface CellSnapshotBeam {
  readonly cellId: number;
  readonly satId: string;
  readonly snapshot: SatelliteSnapshot;
}

/**
 * Pointing a single beam of `sat` at `cell`'s fixed centre. One snapshot per
 * (sat, cell) lit beam so per-cell slant range / elevation drive path loss
 * independently (§5.3), while the shared satId keeps `computeLinkBudget`'s
 * intra/inter interference classification correct.
 */
function buildCellBeamSnapshot(
  sat: CellModelSat,
  cell: CellCenter,
  geom: CellScanGeometry,
): SatelliteSnapshot {
  return {
    id: sat.id,
    shellId: sat.shellId,
    altitudeKm: sat.altitudeKm,
    ecefKm: [0, 0, 0],
    rangeKm: geom.slantRangeKm,
    elevationDeg: geom.elevationDeg,
    azimuthDeg: sat.topo.azimuthDeg,
    beamCellsKm: [
      {
        beamId: cellLinkBudgetBeamId(cell.cellId),
        offsetEastKm: cell.localXKm,
        offsetNorthKm: cell.localYKm,
        scanAngleDeg: geom.scanAngleDeg,
      },
    ],
  };
}

export class SinrLiveCellModel {
  private readonly profile: Profile;
  private readonly cellLayout: CellLayout;
  private readonly cellById: Map<number, CellCenter>;
  private readonly observer: { latDeg: number; lonDeg: number };
  private readonly minElevationDeg: number;
  private readonly epochUtcMs: number;
  private readonly beamsPerSat: number;
  private readonly hopSlotSec: number;
  private readonly antenna: Profile['antenna'];
  private readonly cellManagers = new Map<number, HandoverManager>();
  private prevUeServing = new Map<string, { satId: string | null; cellId: number | null }>();

  constructor(config: SinrLiveCellModelConfig) {
    this.profile = config.profile;
    this.cellLayout = config.cellLayout;
    this.cellById = new Map(config.cellLayout.centers.map(cell => [cell.cellId, cell]));
    this.observer = config.observer;
    this.minElevationDeg = config.minElevationDeg ?? DEFAULT_MIN_ELEVATION_DEG;
    this.epochUtcMs = config.epochUtcMs;
    this.beamsPerSat = config.beamsPerSat ?? Infinity;
    this.hopSlotSec = config.hopSlotSec && config.hopSlotSec > 0 ? config.hopSlotSec : 2.5;
    // SINR-live-only antenna overrides (S-cells-4a): beamwidth / peak gain /
    // steering / scan loss are layered over the profile antenna WITHOUT mutating
    // `profile.antenna` (the shared SINR oracle for the steered lane + baseline
    // KPI stays byte-identical). When no override is supplied the spread is a
    // value-identical shallow copy → the pure-model default is unchanged.
    this.antenna = {
      ...config.profile.antenna,
      ...(config.beamwidthOverrideRad != null ? { beamwidth3dBRad: config.beamwidthOverrideRad } : {}),
      ...(config.maxGainDbiOverrideDbi != null ? { maxGainDbi: config.maxGainDbiOverrideDbi } : {}),
      ...(config.maxSteeringAngleOverrideDeg != null
        ? { maxSteeringAngleDeg: config.maxSteeringAngleOverrideDeg }
        : {}),
      ...(config.scanLossAtMaxSteeringOverrideDb != null
        ? { scanLossAtMaxSteeringDb: config.scanLossAtMaxSteeringOverrideDb }
        : {}),
    };
  }

  private managerForCell(cellId: number): HandoverManager {
    let manager = this.cellManagers.get(cellId);
    if (!manager) {
      manager = new HandoverManager(this.profile.handover);
      this.cellManagers.set(cellId, manager);
    }
    return manager;
  }

  private linkBudgetOptions(activeAssignments: ActiveBeamAssignment[], simTimeSec: number) {
    return {
      formulaFamily: this.profile.formulaFamily,
      channel: this.profile.channel,
      antenna: this.antenna,
      ueAntenna: this.profile.ueAntenna,
      beams: this.profile.beams,
      activeAssignments,
      simTimeSec,
    } satisfies Parameters<typeof computeLinkBudget>[2];
  }

  reset(): void {
    for (const manager of this.cellManagers.values()) manager.reset();
    this.prevUeServing = new Map();
  }

  /**
   * S4-1 (deferred D5 from S3-2): clock-REBASE every per-cell HandoverManager by a
   * sim-time jump (loop/window wrap, timeline seek) instead of destroying it, so a
   * served cell keeps its serving link + eventLog across the jump rather than
   * cold-re-acquiring under the strict re-attach threshold — the cell flavour of the
   * served-N/N flicker (S3 plan §1.6; the steered fix was S3-2). Without it the
   * per-cell managers keep a stale FUTURE guardUntilMs after a backward jump, which
   * suppresses inter-HO (the ping-pong guard never expires) for the rest of the loop.
   *
   * Pure fan-out: `HandoverManager.rebase` offsets ONLY the two clock-absolute fields
   * (guardUntilMs/pendingSinceMs), clamps a backward jump to sim-start, and keeps
   * state (serving) + eventLog + smoothedSinr + the serving epoch — so no clamp logic
   * is needed here. The model's OWN fields are not clock-absolute (epochUtcMs is
   * immutable; simTimeMs and the beam-hop slotIndex are recomputed fresh each step from
   * the rebased simTimeSec; the hopping continuity lock reads each manager's post-rebase
   * serving, which is correct because the managers carry the serving state).
   *
   * `prevUeServing` is CLEARED (like reset): it drives ONLY the per-UE intra/inter
   * serving-transition classification, and a sim-time jump is a TELEPORT, not a
   * handover. Keeping the pre-jump entry across a satellite-set-changing seek/wrap
   * would classify the re-acquired UE as a PHANTOM inter-HO at the seam (a Rule#2
   * fabricated handover event). The served-continuity benefit lives in the per-cell
   * HandoverManagers (eventLog → −3 dB relax), NOT in prevUeServing, so clearing it
   * loses no continuity while keeping the seam classification truthful.
   */
  rebase(deltaMs: number): void {
    for (const manager of this.cellManagers.values()) manager.rebase(deltaMs);
    this.prevUeServing = new Map();
  }

  /**
   * Beam hopping (§5.3 / "K<N" in the SDD) with SERVING CONTINUITY. Each satellite
   * forms only `beamsPerSat` beams, so it can light at most that many cells. But a
   * beam that is currently SERVING a cell must NOT hop off it — a connected UE has
   * to stay covered (else its serving blinks every hop slot). So per satellite:
   *   1. LOCK the cells it is already serving (continuity; up to the beam budget) —
   *      these beams stay put;
   *   2. HOP the SPARE budget over its remaining (unserved) reachable cells,
   *      rotating the window per slot so new cells get discovered/served over time.
   * Mutates `candidatesByCell` in place — a (sat, cell) pair the sat is not
   * illuminating this slot is removed, so downstream serving + per-UE SINR see only
   * lit beams; a cell left with no candidate falls to idle. At the lane's scale
   * (~3–4 served cells per sat « 7-beam budget) every served cell stays locked AND
   * spare beams still cycle the rest. Deterministic (prev-serving + cellId order +
   * slot index); NOT random and NOT a serving decision (serving is still SINR +
   * HandoverManager over whatever stays lit).
   */
  private applyBeamHoppingCap(
    candidatesByCell: Map<number, CellScanGeometry[]>,
    simTimeSec: number,
  ): void {
    if (!Number.isFinite(this.beamsPerSat)) return; // no cap (pure-model default)
    const beams = Math.max(1, Math.floor(this.beamsPerSat));

    // Candidate cells per satellite.
    const cellsBySat = new Map<string, number[]>();
    for (const [cellId, geoms] of candidatesByCell) {
      for (const geom of geoms) {
        const list = cellsBySat.get(geom.satId);
        if (list) list.push(cellId);
        else cellsBySat.set(geom.satId, [cellId]);
      }
    }

    const slotIndex = Math.max(0, Math.floor((Number.isFinite(simTimeSec) ? simTimeSec : 0) / this.hopSlotSec));
    const illuminated = new Set<string>();
    for (const [satId, cellIds] of cellsBySat) {
      const sorted = [...new Set(cellIds)].sort((a, b) => a - b);
      if (sorted.length <= beams) {
        for (const cellId of sorted) illuminated.add(`${satId}#${cellId}`);
        continue;
      }
      // 1. Continuity: keep the cells this sat is ALREADY serving (prev frame),
      //    so a connected beam never hops off its UE. cellManagers holds the
      //    pre-update (previous) serving at this point in step().
      const locked = sorted.filter(cellId => this.cellManagers.get(cellId)?.state.satId === satId).slice(0, beams);
      const lockedSet = new Set(locked);
      for (const cellId of locked) illuminated.add(`${satId}#${cellId}`);
      // 2. Hop the SPARE budget over the remaining (unserved) reachable cells,
      //    rotating per slot so new cells are discovered/served over time.
      const spare = beams - locked.length;
      if (spare > 0) {
        const others = sorted.filter(cellId => !lockedSet.has(cellId));
        if (others.length > 0) {
          const start = (slotIndex * spare) % others.length;
          for (let k = 0; k < spare; k += 1) {
            illuminated.add(`${satId}#${others[(start + k) % others.length]}`);
          }
        }
      }
    }

    for (const [cellId, geoms] of candidatesByCell) {
      candidatesByCell.set(cellId, geoms.filter(geom => illuminated.has(`${geom.satId}#${cellId}`)));
    }
  }

  step(input: SinrLiveCellStepInput): SinrLiveCellFrame {
    const { visibleSats, ues, simTimeSec, dtSec } = input;
    const simTimeMs = this.epochUtcMs + simTimeSec * 1000;
    const linkSats = visibleSats.filter(sat => sat.topo.elevationDeg >= this.minElevationDeg);
    const satById = new Map(linkSats.map(sat => [sat.id, sat]));
    // Use the EFFECTIVE (possibly overridden) steering limit so the candidate
    // list matches the link-budget scan-loss ceiling (S-cells-4a).
    const maxSteer = this.antenna.maxSteeringAngleDeg;
    const reuse = this.profile.beams.frequencyReuse;

    // 1. Per-cell candidate sats + geometry.
    const candidatesByCell = new Map<number, CellScanGeometry[]>();
    for (const cell of this.cellLayout.centers) {
      candidatesByCell.set(
        cell.cellId,
        listCellCandidateSats(cell, linkSats, this.observer, maxSteer, this.minElevationDeg),
      );
    }

    // 1b. Beam-hopping cap: a satellite forms only `beamsPerSat` simultaneous
    //     beams, so it can illuminate at most that many cells this slot; the lit
    //     window rotates over slots. This GATES which (sat, cell) pairs are even
    //     candidates — the serving sat of a lit cell is still chosen by SINR + the
    //     HandoverManager below (B3 / BLOCK-3), and an un-illuminated cell falls to
    //     idle (honest). No-op when `beamsPerSat` is Infinity (pure-model default).
    this.applyBeamHoppingCap(candidatesByCell, simTimeSec);

    // 2. Pre-decision lit field from each cell's PREVIOUS serving (mirrors the
    //    runtime pre/post two-pass). One lit beam per cell that still has a
    //    valid serving sat among this frame's candidates.
    const preLitByCell = new Map<number, CellSnapshotBeam>();
    for (const cell of this.cellLayout.centers) {
      const manager = this.managerForCell(cell.cellId);
      const servingSatId = manager.state.satId;
      if (servingSatId === null) continue;
      const geom = candidatesByCell
        .get(cell.cellId)
        ?.find(candidate => candidate.satId === servingSatId);
      const sat = satById.get(servingSatId);
      if (!geom || !sat) continue;
      preLitByCell.set(cell.cellId, {
        cellId: cell.cellId,
        satId: servingSatId,
        snapshot: buildCellBeamSnapshot(sat, cell, geom),
      });
    }

    // 3. Per-cell serving decision via SINR + HandoverManager (NOT round-robin).
    const cellRecords: CellServingRecord[] = [];
    const finalServingByCell = new Map<number, string>();
    for (const cell of this.cellLayout.centers) {
      const candidates = candidatesByCell.get(cell.cellId) ?? [];
      const manager = this.managerForCell(cell.cellId);
      const frequencyIndex = cellFrequencyIndex(cell.cellId, reuse);

      // Drop a stale serving whose sat is no longer a candidate (mirrors
      // runtimeFrameStep.ts:699 hoManager.clearServing()).
      if (
        manager.state.satId !== null
        && !candidates.some(candidate => candidate.satId === manager.state.satId)
      ) {
        manager.clearServing();
      }

      // Candidate SINR at the cell centre. Interference field = OTHER lit cells
      // (D != C); cell C is NOT lit here so a cell never self-interferes. Each
      // candidate beam is measured but kept out of activeAssignments.
      const candidateSamples = this.measureCellCandidates(cell, candidates, satById, preLitByCell, simTimeSec);
      manager.update(candidateSamples, dtSec, simTimeMs);

      const servingSatId = manager.state.satId;
      if (servingSatId !== null) finalServingByCell.set(cell.cellId, servingSatId);
      cellRecords.push({
        cellId: cell.cellId,
        servingSatId,
        beamIdentity: servingSatId === null ? null : cellBeamIdentity(servingSatId, cell.cellId),
        frequencyIndex,
        servingSinrDb: servingSatId === null ? null : manager.state.sinrDb,
        candidateCount: candidates.length,
      });
    }

    // 4. Post-decision final lit field for per-UE SINR at true off-axis.
    const finalLit: SatelliteSnapshot[] = [];
    const finalActive: ActiveBeamAssignment[] = [];
    for (const [cellId, satId] of finalServingByCell) {
      const cell = this.cellById.get(cellId);
      const sat = satById.get(satId);
      if (!cell || !sat) continue;
      const geom = candidatesByCell.get(cellId)?.find(candidate => candidate.satId === satId);
      if (!geom) continue;
      finalLit.push(buildCellBeamSnapshot(sat, cell, geom));
      finalActive.push({ satId, beamId: cellLinkBudgetBeamId(cellId) });
    }
    const finalOptions = this.linkBudgetOptions(finalActive, simTimeSec);

    // 4b. Illuminated beams: every post-hopping lit (sat, cell) pair — "where the
    //     beams point" (S-cells-4b). The render draws the FOCUSED sat's beams from
    //     this (not only served cells); a sat that illuminates a cell it does not
    //     end up serving still casts a beam there. `serving` marks the cell's
    //     chosen serving sat. Deterministic in cell → candidate order.
    const illuminatedBeams: IlluminatedCellBeam[] = [];
    for (const cell of this.cellLayout.centers) {
      const geoms = candidatesByCell.get(cell.cellId);
      if (!geoms || geoms.length === 0) continue;
      const frequencyIndex = cellFrequencyIndex(cell.cellId, reuse);
      const servingSatId = finalServingByCell.get(cell.cellId) ?? null;
      for (const geom of geoms) {
        illuminatedBeams.push({
          satId: geom.satId,
          cellId: cell.cellId,
          frequencyIndex,
          serving: geom.satId === servingSatId,
        });
      }
    }

    // 5. Per-UE membership, serving (inherited from cell), off-axis SINR, and
    //    intra/inter classification from the UE's serving transition.
    const ueRecords: UeCellServingRecord[] = [];
    const nextUeServing = new Map<string, { satId: string | null; cellId: number | null }>();
    let intraHandoverCount = 0;
    let interHandoverCount = 0;
    for (const ue of ues) {
      const membership = assignUeToNearestCell(ue, this.cellLayout);
      const cellId = membership.cellId;
      const cell = cellId === null ? undefined : this.cellById.get(cellId);
      const servingSatId = cellId === null ? null : finalServingByCell.get(cellId) ?? null;
      const sat = servingSatId === null ? undefined : satById.get(servingSatId);

      const offAxisDeg = cell && sat
        ? computeOffAxisDeg(
          Math.hypot(ue.eastKm - cell.localXKm, ue.northKm - cell.localYKm),
          sat.altitudeKm,
        )
        : 0;

      let sinrDb: number | null = null;
      if (cell && sat && servingSatId !== null) {
        const uePos: UEPosition = {
          latDeg: 0, // unused by computeLinkBudget (reads offsets only)
          lonDeg: 0,
          offsetEastKm: ue.eastKm,
          offsetNorthKm: ue.northKm,
        };
        const samples = computeLinkBudget(uePos, finalLit, finalOptions);
        const beamId = cellLinkBudgetBeamId(cell.cellId);
        sinrDb = samples.find(s => s.satId === servingSatId && s.beamId === beamId)?.sinrDb ?? null;
      }

      const next = { satId: servingSatId, cellId };
      const kind = classifyServingTransition(this.prevUeServing.get(ue.id) ?? null, next);
      if (kind === 'intra') intraHandoverCount += 1;
      else if (kind === 'inter') interHandoverCount += 1;
      nextUeServing.set(ue.id, next);

      ueRecords.push({
        ueId: ue.id,
        cellId,
        cellDistanceKm: membership.distanceKm === Infinity ? 0 : membership.distanceKm,
        offAxisDeg,
        servingSatId,
        beamIdentity: servingSatId === null || cellId === null
          ? null
          : cellBeamIdentity(servingSatId, cellId),
        frequencyIndex: cellId === null
          ? null
          : cellFrequencyIndex(cellId, this.profile.beams.frequencyReuse),
        sinrDb,
        handoverKind: kind,
      });
    }
    this.prevUeServing = nextUeServing;

    return {
      simTimeSec,
      cells: cellRecords,
      ues: ueRecords,
      illuminatedBeams,
      servedCellCount: finalServingByCell.size,
      servedUeCount: ueRecords.filter(ue => ue.servingSatId !== null).length,
      servingSatCount: new Set(finalServingByCell.values()).size,
      intraHandoverCount,
      interHandoverCount,
    };
  }

  /**
   * Measure each candidate (sat, cell C) boresight SINR at C's centre. The
   * active interference field is every OTHER lit cell (D != C); cell C itself is
   * excluded so it never self-interferes. Candidate beams are added to the
   * snapshot list but kept out of `activeAssignments`, so they are measured but
   * do not interfere with one another. Returns one `LinkSample` per candidate
   * (satId = candidate sat, beamId = `cellLinkBudgetBeamId(C)`), ready for the
   * cell's `HandoverManager.update`.
   */
  private measureCellCandidates(
    cell: CellCenter,
    candidates: readonly CellScanGeometry[],
    satById: Map<string, CellModelSat>,
    preLitByCell: Map<number, CellSnapshotBeam>,
    simTimeSec: number,
  ): LinkSample[] {
    if (candidates.length === 0) return [];
    const beamId = cellLinkBudgetBeamId(cell.cellId);

    const interferers: SatelliteSnapshot[] = [];
    const activeAssignments: ActiveBeamAssignment[] = [];
    for (const [litCellId, lit] of preLitByCell) {
      if (litCellId === cell.cellId) continue; // exclude C: no self-interference
      interferers.push(lit.snapshot);
      activeAssignments.push({ satId: lit.satId, beamId: cellLinkBudgetBeamId(litCellId) });
    }

    const probes: SatelliteSnapshot[] = [];
    for (const geom of candidates) {
      const sat = satById.get(geom.satId);
      if (!sat) continue;
      probes.push(buildCellBeamSnapshot(sat, cell, geom));
    }

    const options = this.linkBudgetOptions(activeAssignments, simTimeSec);
    const measurePoint: UEPosition = {
      latDeg: 0,
      lonDeg: 0,
      offsetEastKm: cell.localXKm,
      offsetNorthKm: cell.localYKm,
    };
    const samples = computeLinkBudget(measurePoint, [...interferers, ...probes], options);
    // Keep only the candidate-probe samples for THIS cell (unique beamId).
    return samples.filter(sample => sample.beamId === beamId);
  }
}
