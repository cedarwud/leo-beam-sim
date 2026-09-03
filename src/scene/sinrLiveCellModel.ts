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
 *          + serving CELL or BEAM changes; inter = serving SAT changes)
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

import { computeGeometricOffAxisDeg } from '../engine/signal/beam-gain';
import {
  ANGLE_AWARE_BACKOFF_DB,
  ANGLE_AWARE_BEAM_POWER_CAP_W,
  ANGLE_AWARE_EE_CONTRACT_VERSION,
  ANGLE_AWARE_FIXED_BASEBAND_POWER_W,
  ANGLE_AWARE_FIXED_RF_CHAIN_POWER_W,
  ANGLE_AWARE_MAX_EFFICIENCY,
  angleAwareLinkKey,
  resolveAngleAwareConversionEfficiency,
} from '../engine/signal/angle-aware-ee';
import {
  computeBoresightAxisEcefKm,
  resolveBeamPointing,
  type EcefVectorKm,
} from '../engine/signal/beam-pointing';
import { computeLinkBudget } from '../engine/signal/link-budget';
import { computeTr38811SlantRangeKm } from '../engine/signal/slant-range';
import type { Profile } from '../profiles/types';
import type {
  ActiveBeamAssignment,
  AngleAwareFormulaFrame,
  AngleAwarePowerState,
  LinkSample,
  SatelliteSnapshot,
  UEPosition,
} from '../engine/signal/types';
import {
  DEFAULT_MIN_ELEVATION_DEG,
  elevationAngleRad,
  localKmToLatLon,
  type CellCenter,
  type CellLayout,
} from '../engine/cells/cellLayout';
import { HandoverManager } from '../engine/handover/handover-manager';
import {
  candidateLinkKey,
  createHandoverDecisionFrame,
  sameCandidateLinkKey,
  type CandidateGateResult,
  type CandidateLinkKey,
  type HandoverDecisionFrame,
  type MetricEvidence,
} from '../engine/handover/candidateDecisionContract';
import {
  produceCandidateOpportunitySet,
  type CandidateLinkMeasurement,
  type CandidateOpportunitySet,
} from '../engine/handover/candidateOpportunityProducer';
import {
  createWalkerAcceptedFrameIdentity,
  type WalkerAcceptedFrameIdentity,
} from '../engine/handover/walkerAcceptedFrameIdentity';
import { HandoverDecisionEngine } from '../engine/handover/handoverDecisionEngine';
import { InstantaneousEePolicy } from '../engine/handover/handoverSelectionPolicy';
import {
  applyPrimaryServingAssignmentTransaction,
  type PrimaryServingAssignmentState,
  type PrimaryUeAssignment,
} from '../engine/handover/primaryServingTransaction';
import { selectServiceContinuityFallback } from '../engine/handover/serviceContinuityFallback';
import { EARTH_KM_PER_DEG } from '../engine/orbit/earth-constants';
import { resolveSinrLiveBeamBudget } from './sinrLiveBeamBudget';

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

/**
 * Reserved link-budget id range for the one deterministic same-cell beam
 * variant used by the homepage authority lane. 420 is greater than every
 * supported earth-fixed layout id and is divisible by each runtime tuning
 * option (1..7), so the variant keeps the same frequency-reuse partition as
 * its geographic cell while remaining a distinct `(satelliteId, beamId)` key.
 */
const INTRA_CELL_BEAM_ID_STRIDE = 420;
const INTRA_CELL_BEAM_VARIANT_INDEX = 1;
const INTRA_CELL_BEAM_OFFSET_FRACTION = 0.4;

export type ServingTransitionKind = 'none' | 'intra' | 'inter' | 'attach' | 'drop';

export type SinrLiveBeamPointingMode = 'earth-fixed-cell' | 'sampled-steering';

/**
 * How long (sim-seconds) a fired handover is retained in
 * {@link SinrLiveCellFrame.recentHandoverEvents} for the ambient live-handover
 * pulse to fade it out. A display-RETENTION horizon, not a truth parameter: it
 * only bounds how long a real, already-classified event stays exposed for decay;
 * the render picks its own fade ≤ this. Sized a touch above the render fade so a
 * pulse never clips mid-fade.
 */
export const SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC = 4;

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
  /**
   * Active Walker beam-surrogate id. This is intentionally independent from
   * geographic `cellId`: a UE keeps its membership cell while intra/inter
   * evaluation may select another `(satelliteId, beamId)` pair.
   */
  readonly servingBeamId?: number | null;
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
  /**
   * The exact primary-UE/cell-serving LinkSample used to produce `sinrDb`.
   * The runtime model always populates this when the serving cell has a
   * decodable sample; optional keeps older pure-fixture records source-safe.
   */
  readonly servingLinkSample?: LinkSample | null;
  readonly handoverKind: ServingTransitionKind;
  /** W7: the comparison contender for THIS UE's serving cell (same cellId, runner-up
   *  sat) + its boresight SINR, plus the cell's pending HO target + trigger progress —
   *  threaded from the cell record so the duel comparison column works for the
   *  protagonist UE. Optional (only the live model sets them). */
  readonly comparisonSatId?: string | null;
  readonly comparisonSinrDb?: number | null;
  readonly pendingTargetSatId?: string | null;
  readonly triggerProgressSec?: number;
  /**
   * Display-only same-satellite beam candidate for the primary UE. This is
   * measured at the UE position with the live link budget and is never fed
   * back into the serving HandoverManager.
   */
  readonly intraCandidateCellId?: number | null;
  readonly intraCandidateSinrDb?: number | null;
  readonly intraCandidateLinkSample?: LinkSample | null;
}

/**
 * A satellite's beam illuminating a cell this slot — one per post-beam-hopping
 * lit (sat, cell) pair, plus an explicitly identified selected same-cell
 * variant in the homepage authority lane. This is the "where the beams POINT" surface (S-cells-4b):
 * the render draws the focused satellite's illuminated beams as cones, not only
 * the cells that ended up SERVED. `serving` marks the beam whose sat is the
 * cell's CHOSEN serving sat (SINR + HandoverManager) — a cell can be illuminated
 * by several sats but served by at most one. A cell NOT lit this slot (idle) has
 * no illuminated beam → no cone (honest under K<N hopping).
 */
export interface IlluminatedCellBeam {
  readonly satId: string;
  readonly cellId: number;
  /** Explicit only for the homepage's selected same-cell beam variant. */
  readonly beamId?: number;
  /** Stable geographic frequency colour (`cellId mod reuse`). */
  readonly frequencyIndex: number;
  /** True when this sat is the cell's chosen serving sat (not merely illuminating). */
  readonly serving: boolean;
}

/**
 * A real per-UE serving handover the model classified (§5.2). Carries the
 * old→new (sat, cell) pair + the sim-time it fired, so the ambient live-handover
 * pulse render (G2) can light the involved cells and decay them by age. It is a
 * pure READ-OUT of the transitions already classified at
 * {@link classifyServingTransition} (the same ones counted in
 * intra/interHandoverCount) — exposing them changes no serving truth (Rule#6). A
 * cold attach / service drop is NOT a handover and is excluded.
 */
export interface SinrLiveCellHandoverEvent {
  readonly ueId: string;
  readonly kind: 'intra' | 'inter';
  /** Sim-time the transition fired; display-decay age = frame.simTimeSec − this. */
  readonly sourceTimeSec: number;
  /** Previous serving (the cell the UE handed OFF). For an inter-HO this sat differs from `toSatId`. */
  readonly fromSatId: string | null;
  readonly fromCellId: number | null;
  /** Exact previous serving beam when the source publishes one. */
  readonly fromBeamId?: number | null;
  /** New serving (the cell the UE handed ONTO) — always served on a real HO. */
  readonly toSatId: string;
  readonly toCellId: number;
  /** Exact new serving beam, including the same-cell intra variant. */
  readonly toBeamId?: number | null;
  /** Optional display evidence for an explicitly presented pair. */
  readonly fromSinrDb?: number | null;
  readonly toSinrDb?: number | null;
  /** `toSinrDb - fromSinrDb`; never used by serving selection. */
  readonly deltaDb?: number | null;
}

/**
 * Provenance for the small H-14 candidate measurement seam. This is an
 * instantaneous primary-UE display probe only; it is deliberately not a
 * forecast/counterfactual policy result.
 */
export const SINR_LIVE_CANDIDATE_PROBE_PROVENANCE =
  'primary-ue-same-frame-angle-aware-display-only' as const;
export type SinrLiveCandidateProbeProvenance = typeof SINR_LIVE_CANDIDATE_PROBE_PROVENANCE;
export type SinrLiveCandidateProbeEeBasis = 'candidate-probe';
export type SinrLiveCandidateProbeStatus = 'available' | 'unavailable';

export interface SinrLiveCandidateProbeEvidence {
  readonly key: CandidateLinkKey;
  readonly primaryUeId: string;
  readonly sourceFrameId: string;
  readonly simTimeSec: number;
  readonly provenance: SinrLiveCandidateProbeProvenance;
  readonly eeBasis: SinrLiveCandidateProbeEeBasis;
  readonly status: SinrLiveCandidateProbeStatus;
  /** Null is the fail-closed representation of missing/non-finite evidence. */
  readonly sample: LinkSample | null;
  readonly reason: string | null;
}

/**
 * Same-frame primary-UE readout for the configured beams visible in the
 * homepage rail.  This is a measurement surface only: it never enters the
 * candidate opportunity set, the decision engine, TTT, or the serving
 * transaction.  Keeping it on the cell frame means every rail row can use the
 * same LinkSample/angle-aware EE contract instead of mixing a primary-UE value
 * with a background-UE aggregate.
 */
export const SINR_LIVE_PRIMARY_BEAM_METRIC_PROVENANCE =
  'primary-ue-same-frame-angle-aware-beam-metric-display-only' as const;
export type SinrLivePrimaryBeamMetricProvenance =
  typeof SINR_LIVE_PRIMARY_BEAM_METRIC_PROVENANCE;
export type SinrLivePrimaryBeamMetricStatus = 'available' | 'unavailable';

export interface SinrLivePrimaryBeamMetricEvidence {
  readonly key: CandidateLinkKey;
  readonly primaryUeId: string;
  readonly sourceFrameId: string;
  readonly simTimeSec: number;
  readonly provenance: SinrLivePrimaryBeamMetricProvenance;
  readonly status: SinrLivePrimaryBeamMetricStatus;
  /** Null is the fail-closed representation of a gain-floor/non-finite sample. */
  readonly sample: LinkSample | null;
  readonly reason: string | null;
}

export interface SinrLiveCellFrame {
  readonly simTimeSec: number;
  /** Accepted Walker source-frame identity shared by all same-frame joins. */
  readonly sourceFrameId?: string;
  readonly cells: readonly CellServingRecord[];
  readonly ues: readonly UeCellServingRecord[];
  /**
   * The UE every panel-facing "primary" surface follows this frame. Normally
   * `ues[0]`; when the scene carries a `focusCellId` it is the UE that cell was
   * PINNED to at focus-change time (`SinrLiveCellModel.setFocusCell`) — pinned by
   * id, so it names the same UE for the whole focus instead of being re-picked
   * per frame and drifting to a neighbour as soon as UEs move. Published on the
   * frame so the left rail, the right rail, the cones and the connected-sat
   * invariant all resolve the SAME protagonist — resolving it independently from
   * `perUePositions[0]` would leave those surfaces describing two different UEs.
   *
   * Optional so fixture/adapter-built frames stay valid; consumers fall back to
   * `perUePositions[0]` exactly as before when it is absent.
   */
  readonly primaryUeId?: string | null;
  /**
   * Complete candidate truth for the primary UE. In measurement-only fixtures
   * it remains additive; behind the explicit homepage multi-candidate gate it
   * feeds the sole primary decision engine and atomic assignment transaction.
   * Forecast EE and remaining-service evidence stay unavailable until their
   * separate activation gates pass.
   */
  readonly primaryCandidateOpportunities?: CandidateOpportunitySet | null;
  /**
   * Same-frame, primary-UE, angle-aware LinkSample probes for the already
   * admitted candidate identities. These are display-only evidence: they are
   * never passed to HandoverDecision/TTT/commit and never added to
   * activeAssignments, so a candidate cannot become an interferer.
   */
  readonly primaryCandidateProbeEvidence?: readonly SinrLiveCandidateProbeEvidence[] | null;
  /**
   * Same-frame primary-UE measurements for the homepage's visible beam roster.
   * These are display-only and do not create candidate/serving identities.
   */
  readonly primaryBeamMetricEvidence?: readonly SinrLivePrimaryBeamMetricEvidence[] | null;
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
  /**
   * Monotonic running totals of intra/interHandoverCount since the current
   * continuity epoch (reset on reset/rebase). The throttle-proof count source for
   * the always-on ticker HUD: a cumulative total survives any publish cadence (the
   * throttle batches increments) where the sim-time {@link recentHandoverEvents}
   * WINDOW empties between publishes at high playback speed. Display read-out of the
   * already-classified transitions (Rule#6); the serving decision is unchanged.
   */
  readonly cumulativeIntraHandoverCount: number;
  readonly cumulativeInterHandoverCount: number;
  /** Selected-link C1-C9 terms shared by the legacy left rail, right rail and scene publisher. */
  readonly angleAwareFormulaFrame?: AngleAwareFormulaFrame | null;
  /**
   * Real handovers that fired within the last
   * {@link SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC} of sim-time (this frame's plus
   * the recent rolling window), newest last. The ambient live-handover pulse (G2)
   * reads these + each event's `sourceTimeSec` to light the involved cells and fade
   * them by age — so handovers stay visible across the throttled frame publish
   * instead of flickering for one frame. Cleared on reset/rebase (a teleport is not
   * a handover). Display read-out of truth; the serving decision is unchanged.
   */
  readonly recentHandoverEvents: readonly SinrLiveCellHandoverEvent[];
}

/**
 * The cell-truth serving record for the PRIMARY UE (the observer anchor at
 * `perUePositions[0]`, or the frame's focused `primaryUeId`). The single source consumed by BOTH the
 * connected-sat invariant (`collectConnectedClaims`, the rendered-beam oracle)
 * AND the InfoPanel publisher (`buildPublishedPrimaryServing`, S5-2b) so the
 * panel's ACTIVE SERVING label, the cones, and the must-hold invariant all read
 * ONE primary oracle — no drift. Match it into the cell UE records by id
 * (fall back to `perUePositions[0]` only when there is no primary id at all,
 * mirroring the original inline resolution byte-for-byte).
 */
export function resolvePrimaryCellServingRecord(
  cellFrame: SinrLiveCellFrame,
  perUePositions: ReadonlyArray<{ id: string }>,
): UeCellServingRecord | null {
  // The frame's own primary id wins: it already accounts for a focused cell.
  // `perUePositions[0]` stays as the fallback for frames built before the field
  // existed, preserving the original byte-for-byte resolution.
  const primaryUeId = cellFrame.primaryUeId ?? perUePositions[0]?.id;
  if (primaryUeId === undefined || primaryUeId === null) return cellFrame.ues[0] ?? null;
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
  /** Enable the additive S1 primary-UE candidate set. Off for legacy pure fixtures. */
  readonly candidateOpportunityMeasurementEnabled?: boolean;
  /**
   * Enable the authoritative primary-UE multi-candidate decision lane. This
   * remains separate from candidate measurement so legacy fixtures can inspect
   * opportunities without changing service.
   */
  readonly multiCandidateDecisionEnabled?: boolean;
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
  /** Optional per-satellite beam budgets; entries override `beamsPerSat`. */
  readonly beamsPerSatById?: Readonly<Record<string, number>>;
  /** Optional primary-UE role budgets; identity is resolved from this model's managers. */
  readonly servingBeamsPerSat?: number;
  readonly candidateBeamsPerSat?: number;
  /**
   * Which cell the panel-facing "primary" surfaces should follow. `null` /
   * omitted keeps the historical `ues[0]` protagonist. See `resolvePrimaryUe`:
   * this is a viewpoint selector, never a serving override, and the UE it
   * resolves to is pinned by id rather than re-picked every frame.
   */
  readonly focusCellId?: number | null;
  /** False freezes the spare-beam window; true advances it by hop slot. */
  readonly beamHoppingEnabled?: boolean;
  /**
   * `earth-fixed-cell` keeps perfect electronic pointing at the assigned cell.
   * `sampled-steering` holds the ECEF boresight between presentation steering
   * updates; it is enabled only by the legacy `/` presentation and makes the
   * projected ellipse and the angle-aware power response share one finite
   * steering behaviour.
   */
  readonly beamPointingMode?: SinrLiveBeamPointingMode;
  readonly beamPointingUpdateSec?: number;
  /** Beam-hopping slot duration (s); the lit window advances each slot. Default 2.5. */
  readonly hopSlotSec?: number;
  /**
   * Presentation coverage guard for the fixed seven-cell substrate. This is
   * not an antenna parameter and is never passed to `computeLinkBudget`; it
   * only keeps the demo substrate populated when a profile's narrow steering
   * control would otherwise make every fixed cell unreachable. The profile
   * antenna still owns scan loss and every reported formula term.
   */
  readonly coverageSteeringAngleDeg?: number;
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
   * The candidate-rich profile uses a 40° steering envelope so the measured
   * Walker population contains multiple simultaneous alternatives; the 50°
   * presentation guard only keeps the fixed seven-cell substrate populated.
   * This override gates BOTH the per-cell candidate list (steering reach to the
   * cell centre) and the link-budget scan-loss ceiling, so the two stay
   * consistent. Default `undefined` = use the profile antenna's steering limit.
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

/** Link-budget beam id for the deterministic alternate beam in one cell. */
export function intraCellLinkBudgetBeamId(cellId: number): number {
  const id = Math.max(0, Math.floor(cellId));
  if (id >= INTRA_CELL_BEAM_ID_STRIDE) {
    throw new RangeError(`cellId ${id} cannot be encoded as an intra-cell beam variant`);
  }
  return cellLinkBudgetBeamId(id) + INTRA_CELL_BEAM_VARIANT_INDEX * INTRA_CELL_BEAM_ID_STRIDE;
}

/** Decode the geographic cell and reserved same-cell variant from a link id. */
export function decodeCellLinkBudgetBeamId(beamId: number): {
  readonly cellId: number;
  readonly variantIndex: number;
} {
  const encoded = Math.max(0, Math.floor(beamId) - CELL_BEAM_ID_OFFSET);
  return {
    cellId: encoded % INTRA_CELL_BEAM_ID_STRIDE,
    variantIndex: Math.floor(encoded / INTRA_CELL_BEAM_ID_STRIDE),
  };
}

/** Recover a cellId from the internal link-budget beamId. */
export function cellIdFromLinkBudgetBeamId(beamId: number): number {
  return decodeCellLinkBudgetBeamId(beamId).cellId;
}

/** Beam identity = sat × cell (§5.2). */
export function cellBeamIdentity(satId: string, cellId: number): string {
  return `${satId}#cell${Math.max(0, Math.floor(cellId))}`;
}

/** Distinguish the selected physical beam while retaining its cell identity. */
export function cellBeamIdentityForLink(
  satId: string,
  beamId: number,
): string {
  const decoded = decodeCellLinkBudgetBeamId(beamId);
  return decoded.variantIndex === 0
    ? cellBeamIdentity(satId, decoded.cellId)
    : `${cellBeamIdentity(satId, decoded.cellId)}#variant${decoded.variantIndex}`;
}

/**
 * Deterministic alternate boresight inside the same geographic cell. The
 * offset points toward the fixed service-area origin, not toward the UE, so
 * the candidate remains a real geometry choice rather than a presentation
 * flag or a UE-following cheat.
 */
export function resolveIntraCellBeamCenter(
  cell: CellCenter,
  cellRadiusKm: number,
  observer: { readonly latDeg: number; readonly lonDeg: number },
): CellCenter {
  const radius = Number.isFinite(cellRadiusKm) && cellRadiusKm > 0 ? cellRadiusKm : 0;
  const distanceToOrigin = Math.hypot(cell.localXKm, cell.localYKm);
  const direction = distanceToOrigin > 1e-9
    ? { east: -cell.localXKm / distanceToOrigin, north: -cell.localYKm / distanceToOrigin }
    : { east: 1, north: 0 };
  const localXKm = cell.localXKm + direction.east * radius * INTRA_CELL_BEAM_OFFSET_FRACTION;
  const localYKm = cell.localYKm + direction.north * radius * INTRA_CELL_BEAM_OFFSET_FRACTION;
  const latLon = localKmToLatLon(observer.latDeg, observer.lonDeg, localXKm, localYKm);
  return {
    ...cell,
    latDeg: latLon.latDeg,
    lonDeg: latLon.lonDeg,
    localXKm,
    localYKm,
  };
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
 * SAT unchanged + serving CELL or BEAM changes (including a same-cell beam
 * switch); inter-HO = serving SAT changes. Cold attach / service drop are
 * distinct and are NOT counted as handovers.
 */
export function classifyServingTransition(
  prev: { satId: string | null; cellId: number | null; beamId?: number | null } | null,
  next: { satId: string | null; cellId: number | null; beamId?: number | null },
): ServingTransitionKind {
  const prevServed = prev != null && prev.satId !== null;
  const nextServed = next.satId !== null;
  if (!prevServed && !nextServed) return 'none';
  if (!prevServed && nextServed) return 'attach';
  if (prevServed && !nextServed) return 'drop';
  // both served
  if (prev!.satId !== next.satId) return 'inter';
  if (
    prev!.cellId !== next.cellId
    || (
      prev!.beamId !== null
      && prev!.beamId !== undefined
      && next.beamId !== null
      && next.beamId !== undefined
      && prev!.beamId !== next.beamId
    )
  ) return 'intra';
  return 'none';
}

/** Presentation-scene scheduler clock: fixed mode never advances the window. */
export function resolveBeamWindowSlotIndex(
  beamHoppingEnabled: boolean,
  simTimeSec: number,
  hopSlotSec: number,
): number {
  if (!beamHoppingEnabled) return 0;
  const safeTimeSec = Number.isFinite(simTimeSec) ? Math.max(0, simTimeSec) : 0;
  const safeSlotSec = Number.isFinite(hopSlotSec) && hopSlotSec > 0 ? hopSlotSec : 2.5;
  return Math.floor(safeTimeSec / safeSlotSec);
}

// ---------------------------------------------------------------------------
// Stateful per-frame driver.
// ---------------------------------------------------------------------------

interface CellSnapshotBeam {
  readonly cellId: number;
  readonly satId: string;
  readonly snapshot: SatelliteSnapshot;
}

interface ResolvedCellBeamPointing {
  readonly axisEcefKm: EcefVectorKm;
  readonly centerLatDeg: number;
  readonly centerLonDeg: number;
  readonly centerEastKm: number;
  readonly centerNorthKm: number;
  readonly scanAngleDeg: number;
}

interface CellBeamMeasurement {
  readonly cell: CellCenter;
  readonly geometry: CellScanGeometry;
  readonly pointing: ResolvedCellBeamPointing;
  readonly beamId: number;
}

/** Readable confirmation interval after candidate TTT in SINR compatibility mode. */
export const SINR_LIVE_SELECTION_HOLD_SEC = 1;

interface PrimaryServingAssignment {
  readonly primaryUeId: string;
  /** Geographic membership remains a separate fact from the selected beam. */
  readonly membershipCellId: number | null;
  readonly key: CandidateLinkKey;
}

interface PrimaryCommitMeasurement {
  readonly sample: LinkSample;
  readonly lit: readonly SatelliteSnapshot[];
  readonly active: readonly ActiveBeamAssignment[];
  readonly beamLoadByKey: ReadonlyMap<string, number>;
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
  pointing: ResolvedCellBeamPointing,
  beamId = cellLinkBudgetBeamId(cell.cellId),
): SatelliteSnapshot {
  return {
    id: sat.id,
    shellId: sat.shellId,
    altitudeKm: sat.altitudeKm,
    latDeg: sat.latDeg,
    lonDeg: sat.lonDeg,
    ecefKm: [0, 0, 0],
    rangeKm: geom.slantRangeKm,
    elevationDeg: geom.elevationDeg,
    azimuthDeg: sat.topo.azimuthDeg,
    beamCellsKm: [
      {
        beamId,
        offsetEastKm: cell.localXKm,
        offsetNorthKm: cell.localYKm,
        scanAngleDeg: pointing.scanAngleDeg,
        beamCenterLatDeg: pointing.centerLatDeg,
        beamCenterLonDeg: pointing.centerLonDeg,
        beamAxisEcefKm: pointing.axisEcefKm,
      },
    ],
  };
}

function hasFiniteAngleAwarePrimaryTerms(
  sample: LinkSample,
  primaryUeId: string,
  key: CandidateLinkKey,
  simTimeSec: number,
): boolean {
  const terms = sample.angleAware;
  if (
    sample.ueId !== primaryUeId
    || sample.satId !== key.satelliteId
    || sample.beamId !== key.beamId
    || !Number.isFinite(sample.sinrDb)
    || terms === undefined
    || terms.timeSec !== simTimeSec
  ) return false;

  const finiteTerms = [
    terms.timeSec,
    terms.thetaRad,
    terms.distanceM,
    terms.powerW,
    terms.transmitGainLinear,
    terms.channelGainLinear,
    terms.desiredSignalW,
    terms.interferenceW,
    terms.noiseW,
    terms.gammaLinear,
    terms.gammaDb,
    terms.bandwidthHz,
    terms.beamLoad,
    terms.throughputBps,
    terms.conversionEfficiency,
    terms.powerConsumptionW,
    terms.systemPowerW,
    terms.energyEfficiencyBitsPerJoule,
  ];
  return finiteTerms.every(value => Number.isFinite(value))
    && terms.distanceM > 0
    && terms.powerW > 0
    && terms.transmitGainLinear > 0
    && terms.channelGainLinear > 0
    && terms.desiredSignalW >= 0
    && terms.interferenceW >= 0
    && terms.noiseW > 0
    && terms.gammaLinear >= 0
    && terms.bandwidthHz > 0
    && terms.beamLoad > 0
    && terms.throughputBps >= 0
    && terms.conversionEfficiency > 0
    && terms.powerConsumptionW > 0
    && terms.systemPowerW > 0
    && terms.energyEfficiencyBitsPerJoule >= 0;
}

function freezeCandidateProbeSample(sample: LinkSample): LinkSample {
  const angleAware = sample.angleAware === undefined
    ? undefined
    : Object.freeze({ ...sample.angleAware });
  return Object.freeze({
    ...sample,
    ...(angleAware === undefined ? {} : { angleAware }),
  });
}

function freezeCandidateProbeEvidence(
  evidence: Omit<SinrLiveCandidateProbeEvidence, 'key' | 'sample'> & {
    readonly key: CandidateLinkKey;
    readonly sample: LinkSample | null;
  },
): SinrLiveCandidateProbeEvidence {
  return Object.freeze({
    ...evidence,
    key: candidateLinkKey(evidence.key.satelliteId, evidence.key.beamId),
    sample: evidence.sample === null ? null : freezeCandidateProbeSample(evidence.sample),
  });
}

function freezePrimaryBeamMetricEvidence(
  evidence: Omit<SinrLivePrimaryBeamMetricEvidence, 'key' | 'sample'> & {
    readonly key: CandidateLinkKey;
    readonly sample: LinkSample | null;
  },
): SinrLivePrimaryBeamMetricEvidence {
  return Object.freeze({
    ...evidence,
    key: candidateLinkKey(evidence.key.satelliteId, evidence.key.beamId),
    sample: evidence.sample === null ? null : freezeCandidateProbeSample(evidence.sample),
  });
}

/**
 * Stable identity for the inputs that define an angle-aware power recurrence.
 * React recreates equivalent profile/runtime objects during ordinary control
 * updates; that must not be mistaken for a signal change and reset every live
 * link to the segment-start power. Real tuning/topology changes still produce a
 * different key and intentionally re-anchor the recurrence.
 */
function angleAwareRuntimeContinuityKey(input: {
  readonly profile: Profile;
  readonly beamsPerSat: number;
  readonly beamsPerSatById: Readonly<Record<string, number>>;
  readonly servingBeamsPerSat?: number;
  readonly candidateBeamsPerSat?: number;
  readonly beamHoppingEnabled: boolean;
}): string {
  return JSON.stringify({
    profile: input.profile,
    beamsPerSat: input.beamsPerSat,
    beamsPerSatById: Object.entries(input.beamsPerSatById).sort(([left], [right]) => (
      left < right ? -1 : left > right ? 1 : 0
    )),
    servingBeamsPerSat: input.servingBeamsPerSat,
    candidateBeamsPerSat: input.candidateBeamsPerSat,
    beamHoppingEnabled: input.beamHoppingEnabled,
  });
}

export class SinrLiveCellModel {
  private profile: Profile;
  private readonly cellLayout: CellLayout;
  private readonly cellById: Map<number, CellCenter>;
  private readonly observer: { latDeg: number; lonDeg: number };
  private readonly minElevationDeg: number;
  private readonly epochUtcMs: number;
  private readonly candidateOpportunityMeasurementEnabled: boolean;
  private readonly multiCandidateDecisionEnabled: boolean;
  private beamsPerSat: number;
  private beamsPerSatById: Readonly<Record<string, number>>;
  private servingBeamsPerSat?: number;
  private candidateBeamsPerSat?: number;
  private beamHoppingEnabled: boolean;
  private readonly hopSlotSec: number;
  private readonly beamPointingMode: SinrLiveBeamPointingMode;
  private readonly beamPointingUpdateSec: number;
  private readonly beamPointingAnchors = new Map<string, { bucket: number; axisEcefKm: EcefVectorKm }>();
  private readonly beamwidthOverrideRad?: number;
  private readonly maxGainDbiOverrideDbi?: number;
  private readonly maxSteeringAngleOverrideDeg?: number;
  private readonly scanLossAtMaxSteeringOverrideDb?: number;
  private readonly coverageSteeringAngleDeg?: number;
  private focusCellId: number | null;
  /**
   * The protagonist UE id pinned at the last focus change — the entire "sticky by
   * id" contract described on {@link resolvePrimaryUe}. `null` means nothing is
   * pinned (no focused cell, or the focused cell held no UE when we last looked),
   * which is what makes the next frame resolve again instead of freezing.
   */
  private pinnedPrimaryUeId: string | null = null;
  /**
   * UE-population size the pin was taken against. `live-ue-N` ids are POSITIONAL,
   * so a UE-count change rebuilds the whole field and the same id can name a
   * different UE standing somewhere else entirely — which is not the UE anyone
   * pinned. A size mismatch therefore invalidates the pin even when the id still
   * resolves. Always 0 while {@link pinnedPrimaryUeId} is null.
   */
  private pinnedPrimaryUePopulationSize = 0;
  /**
   * The UE population the most recent {@link step} ran with, so a focus change can
   * resolve its protagonist THEN — at focus-change time, where that resolution
   * belongs — instead of deferring it to the next frame. Empty until the first
   * step: focusing a cell before any UE exists simply leaves the pin unset for
   * {@link resolvePrimaryUe} to take on the first frame that carries a population.
   */
  private lastSteppedUes: readonly UeInput[] = [];
  private antenna: Profile['antenna'];
  private angleAwareRuntimeContinuityKey: string;
  private readonly cellManagers = new Map<number, HandoverManager>();
  /** Previous published-frame power state for currently served (u,s,v) links only. */
  private readonly angleAwarePowerStates = new Map<string, AngleAwarePowerState>();
  /**
   * Display-only continuity for the homepage's visible primary-UE beam roster.
   * This is deliberately separate from the serving-state map: a counterfactual
   * beam must not become a decision input merely because the rail rendered it.
   * It uses the same sim-time and angle-aware recurrence, but never enters
   * candidate measurement, TTT, commit, interference, or serving state.
   */
  private readonly primaryBeamMetricPowerStates = new Map<string, AngleAwarePowerState>();
  private prevUeServing = new Map<string, {
    satId: string | null;
    cellId: number | null;
    beamId: number | null;
  }>();
  // Rolling log of handovers fired within the last retention window (sim-time),
  // for the ambient live-handover pulse to fade by age. Pruned each step; cleared
  // on reset/rebase (a teleport is not a handover — mirrors prevUeServing).
  private recentHandovers: SinrLiveCellHandoverEvent[] = [];
  // Monotonic running totals of the per-frame intra/interHandoverCount since the
  // current continuity epoch began. Unlike `recentHandovers` (a sim-time WINDOW
  // that empties between throttled publishes at high playback speed), a cumulative
  // total survives any publish cadence — the throttle batches increments instead of
  // dropping events — so the always-on ticker HUD never under-counts the live
  // handover stream. Reset on reset/rebase alongside `recentHandovers`/`prevUeServing`
  // (a teleport is not a handover; a backward seek must not re-count a replayed
  // window twice). Display read-out of truth (Rule#6); the serving decision is unchanged.
  private cumulativeIntraHandoverCount = 0;
  private cumulativeInterHandoverCount = 0;
  // W7b: display-only time-to-trigger accumulator for the PRIMARY cell's duel contender.
  // The cell HandoverManager only counts trigger time on POST-hopping LIT candidates, which
  // the primary cell rarely has (its lit set is usually just the serving sat) → its trigger
  // ~never moves; this drives the duel countdown from the DISPLAYED contender's
  // offset-crossing instead (the engine's inter-HO rule, applied to the shown contender).
  // NOT a decision input — the serving truth + s0 golden are unchanged.
  private primaryContenderTriggerSec = 0;
  private prevPrimaryContenderSatId: string | null = null;
  /** Sole primary-UE serving assignment for the multi-candidate lane. */
  private primaryServingAssignment: PrimaryServingAssignment | null = null;
  private primaryDecisionEngine: HandoverDecisionEngine | null = null;
  private lastHandoverDecisionFrame: HandoverDecisionFrame | null = null;
  private primaryLastCommit: HandoverDecisionFrame['recentCommit'] = null;

  constructor(config: SinrLiveCellModelConfig) {
    this.profile = config.profile;
    this.cellLayout = config.cellLayout;
    this.cellById = new Map(config.cellLayout.centers.map(cell => [cell.cellId, cell]));
    this.observer = config.observer;
    this.minElevationDeg = config.minElevationDeg ?? DEFAULT_MIN_ELEVATION_DEG;
    this.epochUtcMs = config.epochUtcMs;
    this.candidateOpportunityMeasurementEnabled = config.candidateOpportunityMeasurementEnabled ?? false;
    this.multiCandidateDecisionEnabled = config.multiCandidateDecisionEnabled ?? false;
    this.beamsPerSat = config.beamsPerSat ?? Infinity;
    this.beamsPerSatById = config.beamsPerSatById ?? {};
    this.servingBeamsPerSat = config.servingBeamsPerSat;
    this.candidateBeamsPerSat = config.candidateBeamsPerSat;
    this.beamHoppingEnabled = config.beamHoppingEnabled ?? true;
    this.focusCellId = config.focusCellId ?? null;
    this.hopSlotSec = config.hopSlotSec && config.hopSlotSec > 0 ? config.hopSlotSec : 2.5;
    this.beamPointingMode = config.beamPointingMode ?? 'earth-fixed-cell';
    this.beamPointingUpdateSec = config.beamPointingUpdateSec && config.beamPointingUpdateSec > 0
      ? config.beamPointingUpdateSec
      : 1;
    this.coverageSteeringAngleDeg = config.coverageSteeringAngleDeg;
    this.beamwidthOverrideRad = config.beamwidthOverrideRad;
    this.maxGainDbiOverrideDbi = config.maxGainDbiOverrideDbi;
    this.maxSteeringAngleOverrideDeg = config.maxSteeringAngleOverrideDeg;
    this.scanLossAtMaxSteeringOverrideDb = config.scanLossAtMaxSteeringOverrideDb;
    if (this.multiCandidateDecisionEnabled && !this.candidateOpportunityMeasurementEnabled) {
      throw new Error('multi-candidate decision requires candidate opportunity measurement');
    }
    // SINR-live-only antenna overrides (S-cells-4a): beamwidth / peak gain /
    // steering / scan loss are layered over the profile antenna WITHOUT mutating
    // `profile.antenna` (the shared SINR oracle for the steered lane + baseline
    // KPI stays byte-identical). When no override is supplied the spread is a
    // value-identical shallow copy → the pure-model default is unchanged.
    this.antenna = this.resolveAntenna(config.profile);
    this.angleAwareRuntimeContinuityKey = angleAwareRuntimeContinuityKey({
      profile: this.profile,
      beamsPerSat: this.beamsPerSat,
      beamsPerSatById: this.beamsPerSatById,
      servingBeamsPerSat: this.servingBeamsPerSat,
      candidateBeamsPerSat: this.candidateBeamsPerSat,
      beamHoppingEnabled: this.beamHoppingEnabled,
    });
  }

  private createPrimaryDecisionEngine(initialServing: CandidateLinkKey | null): HandoverDecisionEngine {
    return new HandoverDecisionEngine({
      episodeId: `walker-primary:${this.epochUtcMs}`,
      initialServing,
      policy: new InstantaneousEePolicy({
        initialTttSec: this.profile.handover.triggerTimeSec,
        interTttSec: this.profile.handover.triggerTimeSec,
        // A same-satellite beam switch is the short intra procedure described
        // by the profile.  Reusing the inter-satellite trigger here made the
        // primary decision lane wait 3.5 s for a beam change even though the
        // canonical handover policy explicitly provides a 0.75 s intra dwell;
        // most measured intra opportunities expired before they could commit.
        intraTttSec: this.profile.handover.intraSwitchTimeSec,
        // The homepage asks for the largest current EE. Keep the comparison
        // strict; no lower-EE target may win through a tie tolerance.
        eeToleranceRelative: 0,
      }),
      selectionHoldSec: SINR_LIVE_SELECTION_HOLD_SEC,
      guardSec: this.profile.handover.pingPongGuardSec,
      candidateAbsenceToleranceSec: 0,
      minimumDistinctCandidateSatellites: this.profile.handover.minimumDistinctCandidateSatellites,
    });
  }

  private clearPrimaryDecisionState(): void {
    this.primaryServingAssignment = null;
    this.primaryDecisionEngine = null;
    this.lastHandoverDecisionFrame = null;
    this.primaryLastCommit = null;
  }

  /** The single immutable frame consumed by the scene and publisher join. */
  getHandoverDecisionFrame(): HandoverDecisionFrame | null {
    return this.lastHandoverDecisionFrame;
  }

  private resolveAntenna(profile: Profile): Profile['antenna'] {
    return {
      ...profile.antenna,
      ...(this.beamwidthOverrideRad != null ? { beamwidth3dBRad: this.beamwidthOverrideRad } : {}),
      ...(this.maxGainDbiOverrideDbi != null ? { maxGainDbi: this.maxGainDbiOverrideDbi } : {}),
      ...(this.maxSteeringAngleOverrideDeg != null
        ? { maxSteeringAngleDeg: this.maxSteeringAngleOverrideDeg }
        : {}),
      ...(this.scanLossAtMaxSteeringOverrideDb != null
        ? { scanLossAtMaxSteeringDb: this.scanLossAtMaxSteeringOverrideDb }
        : {}),
    };
  }

  /**
   * Which UE the panel-facing "primary" surfaces follow.
   *
   * Default is `ues[0]`, the historical protagonist. When `focusCellId` is set
   * the caller is asking to watch a DIFFERENT cell, so the protagonist becomes
   * that cell's most representative UE — the one nearest its centre.
   *
   * That cell→UE question is asked ONCE, at focus-change time
   * ({@link setFocusCell}), and the answer is pinned as a UE **id**; every later
   * frame merely looks the pinned id up in the current population. Re-resolving
   * per frame is MOBILITY-UNSAFE: as soon as UEs move (`ueMobilityMode` other
   * than `'static'`), "nearest the focused cell's centre" changes hands whenever
   * anyone crosses a cell boundary, so the protagonist role would silently jump
   * to a different UE mid-shot — and the InfoPanel ACTIVE SERVING label, the beam
   * cones and the connected-sat invariant would start describing whoever they
   * happened to sample. That drift is precisely what the one published
   * {@link SinrLiveCellFrame.primaryUeId} exists to prevent. Pinning by id keeps
   * ONE protagonist for the whole focus: the beams and the cell boundaries sweep
   * over the UE we are watching instead of swapping who we are watching. (With
   * static UEs a pin and a per-frame pick agree frame-for-frame, so this is a
   * behavioural no-op until mobility is switched on.)
   *
   * A pin is never returned stale. It is dropped and re-resolved when it can no
   * longer name a real UE of THIS population — the id is absent, or the
   * population SIZE changed (the UE-count slider rebuilds the field, and the ids
   * are positional, so the surviving id names a different UE in a different
   * place). Re-resolving there is also what the per-frame code did, so the
   * slider behaves exactly as before.
   *
   * This selects a VIEWPOINT only. Serving and handover stay per-UE and SINR-
   * driven for all 100 UEs, so switching focus reports a different UE's serving
   * story rather than changing anyone's serving decision. If the focused cell
   * holds no UE, fall back to the default rather than blanking the panel — and
   * pin nothing, so a UE that later walks into the focused cell is picked up
   * instead of the fallback silently becoming permanent.
   */
  private resolvePrimaryUe(ues: readonly UeInput[]): UeInput | undefined {
    if (this.focusCellId === null || this.focusCellId === undefined) return ues[0];
    if (this.pinnedPrimaryUeId !== null && ues.length === this.pinnedPrimaryUePopulationSize) {
      const pinned = ues.find(ue => ue.id === this.pinnedPrimaryUeId);
      if (pinned !== undefined) return pinned;
    }
    // Nothing usable is pinned: either the focus change landed before any UE
    // existed, or the pinned id no longer names a UE of this population. Ask the
    // cell→UE question again now and re-pin the answer.
    return this.pinPrimaryUeForFocusCell(ues) ?? ues[0];
  }

  /**
   * The focused cell's representative UE — the one nearest its centre — within a
   * given population. A pure lookup: it reads no pinned state and writes none, so
   * the focus-change pin and every re-pin ask the question exactly one way.
   * `undefined` = no focused cell, or the focused cell holds no UE.
   */
  private findFocusCellRepresentativeUe(ues: readonly UeInput[]): UeInput | undefined {
    if (this.focusCellId === null || this.focusCellId === undefined) return undefined;
    let best: UeInput | undefined;
    let bestDistanceKm = Infinity;
    for (const ue of ues) {
      const membership = assignUeToNearestCell(ue, this.cellLayout);
      if (membership.cellId !== this.focusCellId) continue;
      if (membership.distanceKm < bestDistanceKm) {
        bestDistanceKm = membership.distanceKm;
        best = ue;
      }
    }
    return best;
  }

  /**
   * Resolve the focused cell's protagonist within `ues` and PIN its id, together
   * with the population size the pin was taken against.
   *
   * Resolving to nothing — an empty focused cell, or an empty population because
   * focus was set before the first step — CLEARS the pin instead of pinning the
   * `ues[0]` fallback. Pinning the fallback would freeze the panel onto the
   * default UE for as long as the focus lasts, so a UE arriving in the focused
   * cell later would never be picked up; leaving the pin clear makes the next
   * frame retry, which under static UEs is the same answer every time.
   */
  private pinPrimaryUeForFocusCell(ues: readonly UeInput[]): UeInput | undefined {
    const representative = this.findFocusCellRepresentativeUe(ues);
    this.pinnedPrimaryUeId = representative?.id ?? null;
    this.pinnedPrimaryUePopulationSize = representative === undefined ? 0 : ues.length;
    return representative;
  }

  private uePosition(ue: UeInput): UEPosition {
    const latLon = localKmToLatLon(
      this.observer.latDeg,
      this.observer.lonDeg,
      ue.eastKm,
      ue.northKm,
    );
    return {
      id: ue.id,
      latDeg: latLon.latDeg,
      lonDeg: latLon.lonDeg,
      offsetEastKm: ue.eastKm,
      offsetNorthKm: ue.northKm,
    };
  }

  private resolveCellBeamPointing(
    sat: CellModelSat,
    cell: CellCenter,
    simTimeSec: number,
    pointingKey?: string,
  ): ResolvedCellBeamPointing {
    const exactAxis = computeBoresightAxisEcefKm({
      satLatDeg: sat.latDeg,
      satLonDeg: sat.lonDeg,
      satAltitudeKm: sat.altitudeKm,
      targetLatDeg: cell.latDeg,
      targetLonDeg: cell.lonDeg,
    });
    let axisEcefKm = exactAxis;
    if (this.beamPointingMode === 'sampled-steering') {
      const safeTimeSec = Number.isFinite(simTimeSec) ? simTimeSec : 0;
      const bucket = Math.floor(safeTimeSec / this.beamPointingUpdateSec);
      const key = `${sat.id}:${pointingKey ?? cell.cellId}`;
      const previous = this.beamPointingAnchors.get(key);
      if (previous?.bucket === bucket) {
        axisEcefKm = previous.axisEcefKm;
      } else {
        this.beamPointingAnchors.set(key, { bucket, axisEcefKm: exactAxis });
      }
    }

    const pointing = resolveBeamPointing({
      satLatDeg: sat.latDeg,
      satLonDeg: sat.lonDeg,
      satAltitudeKm: sat.altitudeKm,
      targetLatDeg: cell.latDeg,
      targetLonDeg: cell.lonDeg,
      observerLatDeg: this.observer.latDeg,
      observerLonDeg: this.observer.lonDeg,
      axisEcefKm,
    });
    const nadir = satNadirOffsetKm(sat, this.observer);
    const scanAngleDeg = (Math.atan(
      Math.hypot(
        pointing.ground.eastKm - nadir.eastKm,
        pointing.ground.northKm - nadir.northKm,
      ) / Math.max(sat.altitudeKm, 1e-6),
    ) * 180) / Math.PI;
    return {
      axisEcefKm: pointing.axisEcefKm,
      centerLatDeg: pointing.ground.latDeg,
      centerLonDeg: pointing.ground.lonDeg,
      centerEastKm: pointing.ground.eastKm,
      centerNorthKm: pointing.ground.northKm,
      scanAngleDeg,
    };
  }

  private resolveCandidateBeamForKey(
    key: CandidateLinkKey,
    candidatesByCell: ReadonlyMap<number, readonly CellScanGeometry[]>,
    satById: ReadonlyMap<string, CellModelSat>,
    simTimeSec: number,
  ): CellBeamMeasurement | null {
    const decoded = decodeCellLinkBudgetBeamId(key.beamId);
    if (decoded.variantIndex > INTRA_CELL_BEAM_VARIANT_INDEX) return null;
    const cell = this.cellById.get(decoded.cellId);
    const satellite = satById.get(key.satelliteId);
    const baseGeometry = candidatesByCell.get(decoded.cellId)?.find(candidate => (
      candidate.satId === key.satelliteId
    ));
    if (cell === undefined || satellite === undefined || baseGeometry === undefined) return null;
    if (decoded.variantIndex === 0) {
      return {
        cell,
        geometry: baseGeometry,
        pointing: this.resolveCellBeamPointing(satellite, cell, simTimeSec),
        beamId: key.beamId,
      };
    }

    const variantCell = resolveIntraCellBeamCenter(
      cell,
      this.cellLayout.cellRadiusKm,
      this.observer,
    );
    const variantGeometry = computeCellScanGeometry(satellite, variantCell, this.observer);
    return {
      cell: variantCell,
      geometry: variantGeometry,
      pointing: this.resolveCellBeamPointing(
        satellite,
        variantCell,
        simTimeSec,
        `beam${key.beamId}`,
      ),
      beamId: key.beamId,
    };
  }

  private resolveIntraCellCandidateBeam(
    cell: CellCenter,
    satellite: CellModelSat,
    simTimeSec: number,
  ): CellBeamMeasurement {
    const variantCell = resolveIntraCellBeamCenter(
      cell,
      this.cellLayout.cellRadiusKm,
      this.observer,
    );
    const variantGeometry = computeCellScanGeometry(satellite, variantCell, this.observer);
    const beamId = intraCellLinkBudgetBeamId(cell.cellId);
    return {
      cell: variantCell,
      geometry: variantGeometry,
      pointing: this.resolveCellBeamPointing(
        satellite,
        variantCell,
        simTimeSec,
        `beam${beamId}`,
      ),
      beamId,
    };
  }

  /**
   * Refresh profile-backed link-budget inputs without destroying cell-serving
   * continuity. Signal tuning is a next-frame recompute, not a new replay epoch:
   * the per-cell HandoverManagers, `prevUeServing`, recent pulse window and
   * cumulative counters must all survive the update.
   *
   * The caller must recreate this model when the handover policy, cell layout,
   * observer/epoch, or another structural runtime identity changes. The optional
   * beam budget is supplied by the runtime resolver so topology tuning follows
   * the same clamp/fail-closed policy as a newly-created model.
   */
  updateRuntimeProfile(
    profile: Profile,
    beamsPerSat = this.beamsPerSat,
    beamsPerSatById = this.beamsPerSatById,
    servingBeamsPerSat = this.servingBeamsPerSat,
    candidateBeamsPerSat = this.candidateBeamsPerSat,
    beamHoppingEnabled = this.beamHoppingEnabled,
  ): void {
    const nextAngleAwareRuntimeContinuityKey = angleAwareRuntimeContinuityKey({
      profile,
      beamsPerSat,
      beamsPerSatById,
      servingBeamsPerSat,
      candidateBeamsPerSat,
      beamHoppingEnabled,
    });
    const angleAwareInputsChanged = nextAngleAwareRuntimeContinuityKey
      !== this.angleAwareRuntimeContinuityKey;
    const handoverChanged = profile.handover.sinrThresholdDb !== this.profile.handover.sinrThresholdDb
      || profile.handover.offsetDb !== this.profile.handover.offsetDb
      || profile.handover.triggerTimeSec !== this.profile.handover.triggerTimeSec
      || profile.handover.intraSwitchTimeSec !== this.profile.handover.intraSwitchTimeSec
      || profile.handover.pingPongGuardSec !== this.profile.handover.pingPongGuardSec;
    this.profile = profile;
    this.beamsPerSat = beamsPerSat;
    this.beamsPerSatById = beamsPerSatById;
    this.servingBeamsPerSat = servingBeamsPerSat;
    this.candidateBeamsPerSat = candidateBeamsPerSat;
    this.beamHoppingEnabled = beamHoppingEnabled;
    this.antenna = this.resolveAntenna(profile);
    this.angleAwareRuntimeContinuityKey = nextAngleAwareRuntimeContinuityKey;
    // A signal-profile change starts a new formula continuity segment for C2/C3.
    // Handover continuity remains owned by the managers above; the angle-aware
    // power state is re-anchored to the new scenario parameters.
    if (angleAwareInputsChanged) {
      this.angleAwarePowerStates.clear();
      this.primaryBeamMetricPowerStates.clear();
    }
    if (handoverChanged && this.multiCandidateDecisionEnabled) {
      this.primaryDecisionEngine = this.createPrimaryDecisionEngine(
        this.primaryServingAssignment?.key ?? null,
      );
      this.lastHandoverDecisionFrame = null;
      this.primaryLastCommit = null;
    }
  }

  /**
   * Point the panel-facing "primary" surfaces at a different cell.
   *
   * Deliberately NOT part of `updateRuntimeProfile`, and deliberately not a
   * constructor argument: both of those would disturb continuity that the focus
   * change has no business touching. Rebuilding the model resets every cell's
   * HandoverManager, which cold-attaches all UEs and fires a burst of spurious
   * handovers; `updateRuntimeProfile` clears `angleAwarePowerStates`, which
   * would snap every link's recurrence back to the p_max / 2 segment start.
   *
   * A focus change is a viewpoint change, so it touches neither. Serving,
   * handover and power continuity for all UEs — including the newly focused one,
   * whose history has been maintained all along — carry straight through.
   *
   * This is also the ONE place the cell→UE question is asked. The protagonist is
   * pinned here by UE **id**, against the population the last frame ran with, and
   * every later frame reuses that id until the focus changes again — so the
   * InfoPanel ACTIVE SERVING label, the beam cones and the connected-sat
   * invariant keep describing the SAME UE even once UEs are moving across cell
   * boundaries (the full argument is on {@link resolvePrimaryUe}). Re-focusing
   * the cell that is already focused is a no-op, NOT a re-resolution: nothing
   * about the viewpoint changed, so the protagonist must not be re-picked out
   * from under the shot. Focusing before the first step leaves the pin unset —
   * there is no population to resolve against yet — and the first populated frame
   * takes it. Clearing focus to `null` drops the pin and returns the historical
   * `ues[0]` protagonist.
   */
  setFocusCell(cellId: number | null): void {
    if (cellId === this.focusCellId) return;
    this.focusCellId = cellId;
    // A new inspected cell may pin a different protagonist. Keep every
    // background cell manager intact, but start a fresh primary decision
    // episode so no candidate timer transfers between UEs.
    this.clearPrimaryDecisionState();
    if (cellId === null) {
      this.pinnedPrimaryUeId = null;
      this.pinnedPrimaryUePopulationSize = 0;
      return;
    }
    this.pinPrimaryUeForFocusCell(this.lastSteppedUes);
  }

  /**
   * The pinned protagonist id, published so the REST of the runtime can consume
   * this model's decision instead of re-deriving its own.
   *
   * This is the id half of {@link SinrLiveCellFrame.primaryUeId}, readable
   * BEFORE the frame is built. `stepRuntimeFrame` runs first — it owns the main
   * `S3HandoverManager`, the scene ground anchor and the mobility primary — and
   * without this it had to re-run the cell→UE scan by index every frame, which
   * let it name a different UE than the panels were showing. The pin is taken at
   * focus-change time and only re-taken when it stops naming a real UE, so
   * reading it one frame "late" is not a race: it is the same answer this frame
   * and every frame until the focus changes again.
   *
   * `null` = nothing focused (the historical `ues[0]` protagonist), or the focus
   * changed before any UE population existed, in which case the caller's own
   * nearest-to-focus-cell fallback answers for the first frame.
   */
  getPinnedPrimaryUeId(): string | null {
    if (this.focusCellId === null || this.focusCellId === undefined) return null;
    return this.pinnedPrimaryUeId;
  }

  private managerForCell(cellId: number): HandoverManager {
    let manager = this.cellManagers.get(cellId);
    if (!manager) {
      manager = new HandoverManager(this.profile.handover, {
        enforceSharedHandoverInterval: true,
      });
      this.cellManagers.set(cellId, manager);
    }
    return manager;
  }

  private linkBudgetOptions(
    activeAssignments: ActiveBeamAssignment[],
    simTimeSec: number,
    includeAngleAwarePower = true,
  ): Parameters<typeof computeLinkBudget>[2] {
    const baseOptions = {
      formulaFamily: this.profile.formulaFamily,
      channel: this.profile.channel,
      antenna: this.antenna,
      ueAntenna: this.profile.ueAntenna,
      beams: this.profile.beams,
      activeAssignments,
      simTimeSec,
    } satisfies Omit<Parameters<typeof computeLinkBudget>[2], 'angleAware'>;
    if (!includeAngleAwarePower) return baseOptions;
    return {
      ...baseOptions,
      angleAware: {
        previousStates: this.angleAwarePowerStates,
        conversionEfficiency: ANGLE_AWARE_MAX_EFFICIENCY,
        fixedPowerW: activeAssignments.length * ANGLE_AWARE_FIXED_RF_CHAIN_POWER_W
          + new Set(activeAssignments.map(assignment => assignment.satId)).size
            * ANGLE_AWARE_FIXED_BASEBAND_POWER_W,
        beamPowerCapW: ANGLE_AWARE_BEAM_POWER_CAP_W,
        backoffDb: ANGLE_AWARE_BACKOFF_DB,
        maxEfficiency: ANGLE_AWARE_MAX_EFFICIENCY,
      },
    };
  }

  reset(): void {
    for (const manager of this.cellManagers.values()) manager.reset();
    this.prevUeServing = new Map();
    this.recentHandovers = [];
    this.beamPointingAnchors.clear();
    this.angleAwarePowerStates.clear();
    this.primaryBeamMetricPowerStates.clear();
    this.cumulativeIntraHandoverCount = 0;
    this.cumulativeInterHandoverCount = 0;
    this.clearPrimaryDecisionState();
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
    this.recentHandovers = [];
    this.beamPointingAnchors.clear();
    this.angleAwarePowerStates.clear();
    this.primaryBeamMetricPowerStates.clear();
    // The cumulative ticker totals rebase to ZERO with the window: a backward seek
    // replays an already-counted span, so keeping the pre-seek totals would
    // DOUBLE-COUNT the replayed handovers. A seek opens a fresh continuity epoch —
    // the same reason prevUeServing/recentHandovers clear here.
    this.cumulativeIntraHandoverCount = 0;
    this.cumulativeInterHandoverCount = 0;
    if (this.primaryDecisionEngine !== null) {
      this.primaryDecisionEngine.reset(this.primaryServingAssignment?.key ?? null);
    }
    this.lastHandoverDecisionFrame = null;
    this.primaryLastCommit = null;
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
    primaryCellId: number | null,
  ): void {
    const hasFiniteBudget = Number.isFinite(this.beamsPerSat)
      || Object.values(this.beamsPerSatById).some(value => Number.isFinite(value));
    if (!hasFiniteBudget) return; // no cap (pure-model default)

    // Candidate cells per satellite.
    const cellsBySat = new Map<string, number[]>();
    for (const [cellId, geoms] of candidatesByCell) {
      for (const geom of geoms) {
        const list = cellsBySat.get(geom.satId);
        if (list) list.push(cellId);
        else cellsBySat.set(geom.satId, [cellId]);
      }
    }

    const slotIndex = resolveBeamWindowSlotIndex(
      this.beamHoppingEnabled,
      simTimeSec,
      this.hopSlotSec,
    );
    // The homepage multi-candidate lane owns the primary UE decision.  Do not
    // let the legacy per-cell manager's `pendingTarget` decide which satellite
    // receives the candidate beam budget: that silently collapses the measured
    // set back to one pre-selected target.  Keep the old manager as the source
    // for legacy/background lanes only, while every geometrically reachable
    // satellite keeps the primary cell lit for the multi-candidate measurement.
    const primaryManager = primaryCellId === null ? undefined : this.cellManagers.get(primaryCellId);
    const primaryServingSatId = this.multiCandidateDecisionEnabled
      // The authority assignment owns every later target choice.  During the
      // very first frame it is not seeded until after this scheduling pass, so
      // retain the manager's already-serving satellite as a startup origin;
      // this keeps a one-beam service alive while alternatives are measured.
      ? this.primaryServingAssignment?.key.satelliteId ?? primaryManager?.state.satId ?? null
      : primaryManager?.state.satId ?? null;
    const primaryCandidateCellId = this.multiCandidateDecisionEnabled ? primaryCellId : null;
    const illuminated = new Set<string>();
    for (const [satId, cellIds] of cellsBySat) {
      const sorted = [...new Set(cellIds)].sort((a, b) => a - b);
      const primaryCellIsReachable = primaryCandidateCellId !== null
        && sorted.includes(primaryCandidateCellId);
      const role = satId === primaryServingSatId
        ? 'serving'
        : primaryCellIsReachable
          ? 'candidate'
          : undefined;
      const rawBeamBudget = resolveSinrLiveBeamBudget({
        fallbackBeamCount: this.beamsPerSat,
        satelliteId: satId,
        roleBeamCount: role === 'serving'
          ? this.servingBeamsPerSat
          : role === 'candidate'
            ? this.candidateBeamsPerSat
            : undefined,
        beamCountBySatellite: this.beamsPerSatById,
      });
      if (!Number.isFinite(rawBeamBudget)) {
        for (const cellId of sorted) illuminated.add(`${satId}#${cellId}`);
        continue;
      }
      const beams = Math.max(1, Math.floor(rawBeamBudget));
      if (sorted.length <= beams) {
        for (const cellId of sorted) illuminated.add(`${satId}#${cellId}`);
        continue;
      }
      // 1. Continuity: keep the cells this sat is ALREADY serving (prev frame),
      //    so a connected beam never hops off its UE. cellManagers holds the
      //    pre-update (previous) serving at this point in step().
      const primaryServingCellId = this.primaryServingAssignment?.key.satelliteId === satId
        ? cellIdFromLinkBudgetBeamId(this.primaryServingAssignment.key.beamId)
        : null;
      const locked = [
        ...(primaryServingCellId !== null && sorted.includes(primaryServingCellId)
          ? [primaryServingCellId]
          : []),
        ...sorted.filter(cellId => this.cellManagers.get(cellId)?.state.satId === satId),
        // A multi-candidate primary frame keeps the primary cell measurable on
        // every reachable alternative satellite, but only after that
        // satellite's own serving continuity cells have been reserved.  A
        // one-beam satellite therefore never drops an established service just
        // to expose a comparison measurement; the candidate appears as soon as
        // a spare slot is available.
        ...(primaryCellIsReachable && satId !== primaryServingSatId
          ? [primaryCandidateCellId!]
          : []),
      ].filter((cellId, index, values) => values.indexOf(cellId) === index).slice(0, beams);
      const lockedSet = new Set(locked);
      for (const cellId of locked) illuminated.add(`${satId}#${cellId}`);
      // 2. Hop the SPARE budget over the remaining (unserved) reachable cells,
      //    rotating per slot so new cells are discovered/served over time.
      const spare = beams - locked.length;
      if (spare > 0) {
        const others = sorted.filter(cellId => !lockedSet.has(cellId));
        if (others.length > 0) {
          // COVERAGE DE-PHASING (the "screen has no beams" root fix). Every
          // qualifying sat's ground reach (~655 km at 50° scan) dwarfs the cell
          // field (~±83 km), so `sorted` — and therefore `others` — is the SAME
          // 37-cell list for most sats. Without a per-sat term, `start` depends
          // only on (slotIndex, spare), so on any COLD START (page reload at a
          // persisted timeline position, or a seek that takes the cell-model
          // reset() branch) every sat has locked=[] / spare=beams and they all
          // light the IDENTICAL contiguous window `(slotIndex*beams) mod 37` —
          // measured: 6–13 of the ~9–19 qualifying sats on one 7-cell window,
          // 7/37 cells served, and a cell outside the window (e.g. the
          // protagonist's) starved for 16–25 hop slots (40–62 s).
          // `satPhase` spreads those windows deterministically across the ring.
          // DETERMINISTIC BY CONSTRUCTION: a pure FNV-style hash of the satId
          // string — no Math.random(), no Date/performance clock, no mutable
          // state. The same (satId, slotIndex, others) always yields the same
          // window, so replays/goldens stay reproducible.
          // Scheduling only: the beam budget is still `beams`, `locked`
          // (continuity) is untouched and still takes priority, and the SERVING
          // sat of a lit cell is still chosen by SINR + HandoverManager.
          const satPhase = [...satId].reduce((hash, ch) => (hash * 31 + ch.charCodeAt(0)) >>> 0, 0);
          const start = (slotIndex * spare + satPhase) % others.length;
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

  private snapshotForCandidateKey(
    key: CandidateLinkKey,
    candidatesByCell: ReadonlyMap<number, readonly CellScanGeometry[]>,
    satById: ReadonlyMap<string, CellModelSat>,
    simTimeSec: number,
  ): SatelliteSnapshot | null {
    const beam = this.resolveCandidateBeamForKey(key, candidatesByCell, satById, simTimeSec);
    if (beam === null) return null;
    const sat = satById.get(key.satelliteId);
    if (sat === undefined) return null;
    return buildCellBeamSnapshot(
      sat,
      beam.cell,
      beam.geometry,
      beam.pointing,
      beam.beamId,
    );
  }

  /**
   * Add one selected primary pair to the active RF field without duplicating a
   * beam that is already active for background UEs. This changes no geographic
   * cell membership and implies exactly one primary data link.
   */
  private includePrimaryServingPair(
    assignment: PrimaryServingAssignment | null,
    candidatesByCell: ReadonlyMap<number, readonly CellScanGeometry[]>,
    satById: ReadonlyMap<string, CellModelSat>,
    simTimeSec: number,
    lit: SatelliteSnapshot[],
    active: ActiveBeamAssignment[],
  ): boolean {
    if (assignment === null) return false;
    const alreadyActive = active.some(item => (
      item.satId === assignment.key.satelliteId && item.beamId === assignment.key.beamId
    ));
    if (alreadyActive) return true;
    const snapshot = this.snapshotForCandidateKey(
      assignment.key,
      candidatesByCell,
      satById,
      simTimeSec,
    );
    if (snapshot === null) return false;
    lit.push(snapshot);
    active.push({ satId: assignment.key.satelliteId, beamId: assignment.key.beamId });
    return true;
  }

  step(input: SinrLiveCellStepInput): SinrLiveCellFrame {
    const { visibleSats, ues, simTimeSec, dtSec } = input;
    // Remember the population so a focus change arriving between frames can pin
    // its protagonist at focus-change time (see `setFocusCell`).
    this.lastSteppedUes = ues;
    const runtimeSimTimeMs = this.epochUtcMs + simTimeSec * 1000;
    const acceptedFrameIdentity = createWalkerAcceptedFrameIdentity(this.epochUtcMs, simTimeSec);
    const linkSats = visibleSats.filter(sat => sat.topo.elevationDeg >= this.minElevationDeg);
    const satById = new Map(linkSats.map(sat => [sat.id, sat]));
    // Use the EFFECTIVE (possibly overridden) steering limit so the candidate
    // list matches the link-budget scan-loss ceiling (S-cells-4a).
    // The fixed presentation cells must remain populated even when the
    // profile's narrow steering control is below the scene's coverage guard.
    // The guard affects candidate visibility only; link-budget scan loss below
    // still uses `this.antenna.maxSteeringAngleDeg`, so the left control changes
    // the selected-link SINR and all published formula values.
    const maxSteer = Math.max(
      this.antenna.maxSteeringAngleDeg,
      this.coverageSteeringAngleDeg ?? 0,
    );
    const reuse = this.profile.beams.frequencyReuse;

    // 1. Per-cell candidate sats + geometry.
    const candidatesByCell = new Map<number, CellScanGeometry[]>();
    for (const cell of this.cellLayout.centers) {
      candidatesByCell.set(
        cell.cellId,
        listCellCandidateSats(cell, linkSats, this.observer, maxSteer, this.minElevationDeg),
      );
    }

    const allCandidatesByCell = new Map<number, CellScanGeometry[]>(
      [...candidatesByCell.entries()].map(([cellId, geometries]) => [cellId, [...geometries]]),
    );

    // 1b. Beam-hopping cap: a satellite forms only `beamsPerSat` simultaneous
    //     beams, so it can illuminate at most that many cells this slot; the lit
    //     window rotates over slots. This GATES which (sat, cell) pairs are even
    //     candidates — the serving sat of a lit cell is still chosen by SINR + the
    //     HandoverManager below (B3 / BLOCK-3), and an un-illuminated cell falls to
    //     idle (honest). No-op when `beamsPerSat` is Infinity (pure-model default).
    const primaryUe = this.resolvePrimaryUe(ues);
    const primaryCellId = primaryUe === undefined
      ? null
      : assignUeToNearestCell(primaryUe, this.cellLayout).cellId;
    this.applyBeamHoppingCap(candidatesByCell, simTimeSec, primaryCellId);

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
        snapshot: buildCellBeamSnapshot(
          sat,
          cell,
          geom,
          this.resolveCellBeamPointing(sat, cell, simTimeSec),
        ),
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
      manager.update(candidateSamples, dtSec, runtimeSimTimeMs);

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

    // W7: comparison contender for the protagonist UE's cell = the best VISIBLE (pre-hopping)
    // non-serving sat (the real "who could you switch to"). The per-cell handover DECISION
    // runs on the post-hopping LIT beams (often just the serving sat → no decision-time
    // runner-up), so measure the visible candidates DISPLAY-ONLY here — NOT fed to any
    // HandoverManager, so the serving decision + the s0 golden stay unchanged. W7b: the
    // time-to-trigger + PENDING TARGET role are driven from THIS contender (below), not the
    // cell manager (whose trigger ~never moves for the primary cell — its lit set is usually
    // just the serving sat). One extra link-budget per frame (the primary cell only).
    const primaryUeId = primaryUe?.id ?? null;
    let primaryComparison: {
      comparisonSatId: string | null;
      comparisonSinrDb: number | null;
      pendingTargetSatId: string | null;
      triggerProgressSec: number;
    } | null = null;
    if (primaryUe !== undefined) {
      const primaryCellId = assignUeToNearestCell(primaryUe, this.cellLayout).cellId;
      const primaryCell = primaryCellId === null ? undefined : this.cellById.get(primaryCellId);
      const primaryServingSat = primaryCellId === null ? null : finalServingByCell.get(primaryCellId) ?? null;
      if (primaryCell && primaryCellId !== null && primaryServingSat !== null) {
        const primaryManager = this.managerForCell(primaryCellId);
        const servingBoresight = primaryManager.state.sinrDb; // the cell decision basis
        const visibleCandidates = listCellCandidateSats(primaryCell, linkSats, this.observer, maxSteer, this.minElevationDeg);
        const samples = this.measureCellCandidates(primaryCell, visibleCandidates, satById, preLitByCell, simTimeSec);
        const pick = samples
          .filter(sample => sample.satId !== primaryServingSat)
          .reduce<LinkSample | null>((best, s) => (best === null || s.sinrDb > best.sinrDb ? s : best), null);
        const comparisonSatId = pick?.satId ?? null;
        const comparisonSinrDb = pick?.sinrDb ?? null;
        // W7b display-only countdown: accumulate while THIS contender beats serving by the
        // offset (the engine's exact inter-HO criterion, candidate.sinr − offset > serving),
        // reset when it stops or the contender changes, capped at the trigger-time threshold.
        // PENDING TARGET role = the contender is in this countdown.
        const offsetDb = this.profile.handover.offsetDb;
        const triggerCapSec = this.profile.handover.triggerTimeSec;
        const contenderBeatsOffset = comparisonSatId !== null
          && comparisonSinrDb !== null
          && Number.isFinite(servingBoresight)
          && comparisonSinrDb - offsetDb > servingBoresight;
        if (contenderBeatsOffset && comparisonSatId === this.prevPrimaryContenderSatId) {
          this.primaryContenderTriggerSec = Math.min(this.primaryContenderTriggerSec + dtSec, triggerCapSec);
        } else {
          this.primaryContenderTriggerSec = contenderBeatsOffset ? Math.min(dtSec, triggerCapSec) : 0;
        }
        this.prevPrimaryContenderSatId = contenderBeatsOffset ? comparisonSatId : null;
        primaryComparison = {
          comparisonSatId,
          comparisonSinrDb,
          pendingTargetSatId: contenderBeatsOffset ? comparisonSatId : null,
          triggerProgressSec: this.primaryContenderTriggerSec,
        };
      } else {
        this.primaryContenderTriggerSec = 0;
        this.prevPrimaryContenderSatId = null;
      }
    } else {
      this.primaryContenderTriggerSec = 0;
      this.prevPrimaryContenderSatId = null;
    }

    // 4. Build the background UE-assignment RF field, then layer the sole
    //    primary-UE assignment on top. In the gated multi-candidate lane a
    //    per-cell manager may still remember the primary UE's old geographic
    //    cell after an intra/inter commit; treating every manager row as an
    //    active link would leave the old and new primary beams active together.
    //    Rebuild background service from NON-primary UE assignments instead.
    //    The old pair remains only when another UE is actually assigned to it.
    const backgroundLit: SatelliteSnapshot[] = [];
    const backgroundActive: ActiveBeamAssignment[] = [];
    const backgroundPairs = new Map<string, CandidateLinkKey>();
    if (this.multiCandidateDecisionEnabled) {
      for (const ue of ues) {
        if (ue.id === primaryUe?.id) continue;
        const membershipCellId = assignUeToNearestCell(ue, this.cellLayout).cellId;
        const satId = membershipCellId === null
          ? null
          : finalServingByCell.get(membershipCellId) ?? null;
        if (satId === null || membershipCellId === null) continue;
        const key = candidateLinkKey(satId, cellLinkBudgetBeamId(membershipCellId));
        backgroundPairs.set(`${key.satelliteId}:${key.beamId}`, key);
      }
    } else {
      for (const [cellId, satId] of finalServingByCell) {
        const key = candidateLinkKey(satId, cellLinkBudgetBeamId(cellId));
        backgroundPairs.set(`${key.satelliteId}:${key.beamId}`, key);
      }
    }
    for (const key of backgroundPairs.values()) {
      const cellId = cellIdFromLinkBudgetBeamId(key.beamId);
      const satId = key.satelliteId;
      const cell = this.cellById.get(cellId);
      const sat = satById.get(satId);
      if (!cell || !sat) continue;
      const geom = candidatesByCell.get(cellId)?.find(candidate => candidate.satId === satId);
      if (!geom) continue;
      backgroundLit.push(buildCellBeamSnapshot(
        sat,
        cell,
        geom,
        this.resolveCellBeamPointing(sat, cell, simTimeSec),
      ));
      backgroundActive.push({ satId, beamId: cellLinkBudgetBeamId(cellId) });
    }
    const finalLit = [...backgroundLit];
    const finalActive = [...backgroundActive];

    const primaryUeMembership = primaryUe === undefined
      ? null
      : assignUeToNearestCell(primaryUe, this.cellLayout);
    if (this.multiCandidateDecisionEnabled) {
      if (primaryUe === undefined) {
        this.clearPrimaryDecisionState();
      } else {
        if (this.primaryServingAssignment?.primaryUeId !== primaryUe.id) {
          this.clearPrimaryDecisionState();
        }
        const membershipCellId = primaryUeMembership?.cellId ?? null;
        if (this.primaryServingAssignment === null && membershipCellId !== null) {
          const seedSatId = finalServingByCell.get(membershipCellId) ?? null;
          if (seedSatId !== null) {
            this.primaryServingAssignment = Object.freeze({
              primaryUeId: primaryUe.id,
              membershipCellId,
              key: candidateLinkKey(seedSatId, cellLinkBudgetBeamId(membershipCellId)),
            });
          }
        } else if (this.primaryServingAssignment !== null) {
          this.primaryServingAssignment = Object.freeze({
            ...this.primaryServingAssignment,
            membershipCellId,
          });
        }
        if (this.primaryDecisionEngine === null) {
          this.primaryDecisionEngine = this.createPrimaryDecisionEngine(
            this.primaryServingAssignment?.key ?? null,
          );
        }
        this.includePrimaryServingPair(
          this.primaryServingAssignment,
          candidatesByCell,
          satById,
          simTimeSec,
          finalLit,
          finalActive,
        );
      }
    } else {
      this.lastHandoverDecisionFrame = null;
    }

    const candidateSourceFrameId = acceptedFrameIdentity.sourceFrameId;
    let primaryCandidateOpportunities = primaryUe === undefined || !this.candidateOpportunityMeasurementEnabled
      ? null
      : this.measurePrimaryCandidateOpportunitySet(
        primaryUe,
        allCandidatesByCell,
        candidatesByCell,
        satById,
        finalLit,
        finalActive,
        simTimeSec,
        acceptedFrameIdentity,
      );

    const assignmentRows = (primaryAssignment: PrimaryServingAssignment | null): PrimaryUeAssignment[] => (
      ues.map(ue => {
        const membershipCellId = assignUeToNearestCell(ue, this.cellLayout).cellId;
        const backgroundSatId = membershipCellId === null
          ? null
          : finalServingByCell.get(membershipCellId) ?? null;
        const servingLink = ue.id === primaryUe?.id && this.multiCandidateDecisionEnabled
          ? primaryAssignment?.key ?? null
          : backgroundSatId === null || membershipCellId === null
            ? null
            : candidateLinkKey(backgroundSatId, cellLinkBudgetBeamId(membershipCellId));
        return Object.freeze({ ueId: ue.id, membershipCellId, servingLink });
      })
    );
    const loadForAssignments = (assignments: readonly PrimaryUeAssignment[]): ReadonlyMap<string, number> => {
      const load = new Map<string, number>();
      for (const assignment of assignments) {
        if (assignment.servingLink === null) continue;
        const key = `${assignment.servingLink.satelliteId}:${assignment.servingLink.beamId}`;
        load.set(key, (load.get(key) ?? 0) + 1);
      }
      return load;
    };

    if (
      this.multiCandidateDecisionEnabled
      && primaryUe !== undefined
      && primaryCandidateOpportunities !== null
      && this.primaryDecisionEngine !== null
    ) {
      const epochToken = acceptedFrameIdentity.epochToken;
      const decisionClock = {
        simTimeMs: runtimeSimTimeMs,
        dtSec: Number.isFinite(dtSec) && dtSec > 0 ? dtSec : 0,
        sourceFrameId: candidateSourceFrameId,
        epochToken,
        discontinuity: 'none' as const,
      };
      const decisionEngineSnapshot = this.primaryDecisionEngine.snapshot();
      let decisionFrame = this.primaryDecisionEngine.step(
        primaryCandidateOpportunities,
        decisionClock,
      );
      const servingPairMissing = this.primaryServingAssignment !== null
        && !primaryCandidateOpportunities.opportunities.some(opportunity => sameCandidateLinkKey(
          opportunity.key,
          this.primaryServingAssignment!.key,
        ));
      let continuityFallback = false;
      let engineReceipt = decisionFrame.recentCommit;
      if (engineReceipt === null && servingPairMissing && this.primaryServingAssignment !== null) {
        engineReceipt = selectServiceContinuityFallback({
          serving: this.primaryServingAssignment.key,
          opportunitySet: primaryCandidateOpportunities,
          // The distinct-satellite floor belongs to normal candidate selection.
          // This path is only entered after the committed serving pair vanished;
          // applying that floor here would turn a measured, safe replacement
          // into a detach whenever only one compatible link remains.
          clock: {
            episodeId: decisionFrame.episodeId,
            sourceFrameId: decisionFrame.sourceFrameId,
            simTimeMs: decisionFrame.simTimeMs,
          },
        });
        continuityFallback = engineReceipt !== null;

        if (engineReceipt === null) {
          // The source pair disappeared and no measured pair can safely take
          // over. Publish an explicit detached/initial-attach state rather than
          // carrying a satellite-beam identity that no longer exists.
          this.primaryServingAssignment = null;
          this.primaryLastCommit = null;
          this.primaryDecisionEngine.restore(decisionEngineSnapshot);
          this.primaryDecisionEngine.reset(null);
          const detachedFrame = this.primaryDecisionEngine.step(primaryCandidateOpportunities, {
            ...decisionClock,
            dtSec: 0,
          });
          decisionFrame = createHandoverDecisionFrame({
            ...detachedFrame,
            mode: 'service-continuity-protection',
          });
        }
      }
      if (engineReceipt !== null) {
        const beforeAssignment = this.primaryServingAssignment;
        const beforeRows = assignmentRows(beforeAssignment);
        const beforeState: PrimaryServingAssignmentState<ReadonlyMap<string, number>> = {
          episodeId: decisionFrame.episodeId,
          sourceFrameId: decisionFrame.sourceFrameId,
          epochToken,
          primaryUeId: primaryUe.id,
          assignments: beforeRows,
          load: loadForAssignments(beforeRows),
          lastCommit: this.primaryLastCommit,
        };
        const transaction = applyPrimaryServingAssignmentTransaction<
          ReadonlyMap<string, number>,
          PrimaryCommitMeasurement
        >({
          state: beforeState,
          engineCommitReceipt: engineReceipt,
          epochToken,
          loadReducer: ({ assignments }) => loadForAssignments(assignments),
          measureFinal: finalState => {
            const primaryRow = finalState.assignments.find(row => row.ueId === primaryUe.id);
            if (primaryRow?.servingLink === null || primaryRow?.servingLink === undefined) return null;
            const projectedAssignment: PrimaryServingAssignment = Object.freeze({
              primaryUeId: primaryUe.id,
              membershipCellId: primaryRow.membershipCellId,
              key: primaryRow.servingLink,
            });
            // Rebuild from the background field, not the pre-commit primary
            // field. Otherwise the old and new primary beams would both remain
            // active during remeasurement and falsely resemble DAPS.
            const projectedLit = [...backgroundLit];
            const projectedActive = [...backgroundActive];
            if (!this.includePrimaryServingPair(
              projectedAssignment,
              candidatesByCell,
              satById,
              simTimeSec,
              projectedLit,
              projectedActive,
            )) return null;
            const optionsBase = this.linkBudgetOptions(projectedActive, simTimeSec);
            const angleAware = optionsBase.angleAware;
            if (angleAware === undefined) return null;
            const options = {
              ...optionsBase,
              angleAware: { ...angleAware, beamLoadByKey: finalState.load },
            };
            const sample = computeLinkBudget(this.uePosition(primaryUe), projectedLit, options)
              .find(item => sameCandidateLinkKey(
                candidateLinkKey(item.satId, item.beamId),
                primaryRow.servingLink!,
              ));
            return sample === undefined
              ? null
              : Object.freeze({
                sample,
                lit: Object.freeze(projectedLit),
                active: Object.freeze(projectedActive),
                beamLoadByKey: finalState.load,
              });
          },
          isMeasurementUsable: measurement => Number.isFinite(measurement.sample.sinrDb),
        });

        if (transaction.ok && transaction.evidence !== null) {
          const primaryRow = transaction.state.assignments.find(row => row.ueId === primaryUe.id)!;
          this.primaryServingAssignment = Object.freeze({
            primaryUeId: primaryUe.id,
            membershipCellId: primaryRow.membershipCellId,
            key: primaryRow.servingLink!,
          });
          this.primaryLastCommit = engineReceipt;
          finalLit.splice(0, finalLit.length, ...transaction.evidence.lit);
          finalActive.splice(0, finalActive.length, ...transaction.evidence.active);
          if (continuityFallback) {
            // A safety switch intentionally bypasses TTT/hold because its old
            // source is gone. Synchronize the normal engine to the accepted
            // transaction only after final RF measurement succeeds.
            this.primaryDecisionEngine.acceptServiceContinuityCommit(engineReceipt);
          }
          // Re-evaluate the complete opportunity/state frame against the same
          // post-transaction assignment, load, and RF field that will produce
          // the primary serving sample below. Calling the engine at dt=0 keeps
          // the accepted guard/episode intact while preventing one published
          // frame from combining pre-switch candidate SINR with post-switch
          // serving SINR under the same source-frame identity.
          primaryCandidateOpportunities = this.measurePrimaryCandidateOpportunitySet(
            primaryUe,
            allCandidatesByCell,
            candidatesByCell,
            satById,
            finalLit,
            finalActive,
            simTimeSec,
            acceptedFrameIdentity,
          );
          const reconciledFrame = this.primaryDecisionEngine.step(primaryCandidateOpportunities, {
            ...decisionClock,
            dtSec: 0,
          });
          decisionFrame = createHandoverDecisionFrame({
            ...reconciledFrame,
            phase: 'switching',
            mode: engineReceipt.mode,
            recentCommit: engineReceipt,
            // Preserve the pre-transaction candidate-floor witness. The
            // post-commit remeasurement may no longer contain the source-frame
            // alternatives, but the handover was admitted only after this
            // frame's selection floor had passed.
            selectionGate: decisionFrame.selectionGate,
          });
        } else {
          // The engine's receipt remains private until the RF transaction has
          // remeasured the target. Restore the exact pre-step checkpoint: a
          // cold reset would discard every independent TTT clock, leader hold,
          // guard, source clock, and episode identity. Publish the attempted
          // selection without a receipt; the still-active source remains the
          // sole serving link and the next frame may retry deterministically.
          this.primaryDecisionEngine.restore(decisionEngineSnapshot);
          if (continuityFallback) {
            // The old pair is absent and the proposed safety target failed its
            // post-assignment measurement. Neither may be published as active.
            this.primaryServingAssignment = null;
            this.primaryLastCommit = null;
            this.primaryDecisionEngine.reset(null);
            const detachedFrame = this.primaryDecisionEngine.step(primaryCandidateOpportunities, {
              ...decisionClock,
              dtSec: 0,
            });
            decisionFrame = createHandoverDecisionFrame({
              ...detachedFrame,
              mode: 'service-continuity-protection',
            });
          } else {
            decisionFrame = createHandoverDecisionFrame({
              ...decisionFrame,
              phase: 'switching',
              serving: beforeAssignment?.key ?? null,
              provisionalLeader: engineReceipt.to,
              selectedTarget: engineReceipt.to,
              selectedKind: engineReceipt.kind,
              selectionHoldSec: decisionEngineSnapshot.selectionHoldSec,
              recentCommit: null,
            });
          }
        }
      }
      this.lastHandoverDecisionFrame = decisionFrame;
    }

    const finalAssignmentRows = assignmentRows(this.primaryServingAssignment);
    const beamLoadByKey = loadForAssignments(finalAssignmentRows);
    const finalOptionsBase = this.linkBudgetOptions(finalActive, simTimeSec);
    const finalAngleAware = finalOptionsBase.angleAware;
    if (finalAngleAware === undefined) {
      throw new Error('angle-aware link-budget options are required for the selected frame');
    }
    const finalOptions = {
      ...finalOptionsBase,
      angleAware: {
        ...finalAngleAware,
        beamLoadByKey,
      },
    };

    const primaryCandidateProbeEvidence = primaryUe === undefined
      ? null
      : this.measurePrimaryCandidateProbeEvidence(
        primaryUe,
        primaryCandidateOpportunities,
        allCandidatesByCell,
        satById,
        finalLit,
        finalActive,
        finalOptions,
        simTimeSec,
        acceptedFrameIdentity,
      );

    // Legacy display-only same-satellite candidate for the primary UE. The
    // authoritative same-cell variant is measured above and enters the single
    // primary decision engine; this older adjacent-cell probe remains a
    // separate read-only surface for the existing seven-cell teaching view.
    const primaryIntraCandidate = primaryUe === undefined || primaryUeMembership === null
      ? null
      : this.measureIntraCandidate(
        primaryUe,
        this.primaryServingAssignment === null
          ? primaryUeMembership.cellId
          : cellIdFromLinkBudgetBeamId(this.primaryServingAssignment.key.beamId),
        this.primaryServingAssignment?.key.satelliteId
          ?? (primaryUeMembership.cellId === null
            ? null
            : finalServingByCell.get(primaryUeMembership.cellId) ?? null),
        allCandidatesByCell,
        satById,
        finalLit,
        finalActive,
        finalOptions,
        simTimeSec,
      );

    // 4b. Illuminated beams: every post-hopping lit (sat, cell) pair — "where the
    //     beams point" (S-cells-4b). The render draws the FOCUSED sat's beams from
    //     this (not only served cells); a sat that illuminates a cell it does not
    //     end up serving still casts a beam there. `serving` marks the cell's
    //     chosen serving sat. Deterministic in cell → candidate order.
    const illuminatedBeams: IlluminatedCellBeam[] = [];
    const authoritativeServingPairs = this.multiCandidateDecisionEnabled
      ? new Set(finalActive.map(item => `${item.satId}:${item.beamId}`))
      : null;
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
          serving: authoritativeServingPairs === null
            ? geom.satId === servingSatId
            : authoritativeServingPairs.has(`${geom.satId}:${cellLinkBudgetBeamId(cell.cellId)}`),
        });
      }
    }
    if (this.multiCandidateDecisionEnabled && authoritativeServingPairs !== null) {
      const primaryKey = this.primaryServingAssignment?.key;
      if (primaryKey !== undefined
        && decodeCellLinkBudgetBeamId(primaryKey.beamId).variantIndex === INTRA_CELL_BEAM_VARIANT_INDEX
        && authoritativeServingPairs.has(`${primaryKey.satelliteId}:${primaryKey.beamId}`)) {
        const cellId = cellIdFromLinkBudgetBeamId(primaryKey.beamId);
        illuminatedBeams.push({
          satId: primaryKey.satelliteId,
          cellId,
          beamId: primaryKey.beamId,
          frequencyIndex: cellFrequencyIndex(cellId, reuse),
          serving: true,
        });
      }
    }

    // 5. Per-UE geographic membership plus its independently selected serving
    //    pair. Background UEs still inherit the cell manager; the primary UE
    //    consumes only the authoritative assignment transaction above.
    let ueRecords: UeCellServingRecord[] = [];
    const nextUeServing = new Map<string, {
      satId: string | null;
      cellId: number | null;
      beamId: number | null;
    }>();
    let intraHandoverCount = 0;
    let interHandoverCount = 0;
    const firedHandovers: SinrLiveCellHandoverEvent[] = [];
    const ueById = new Map(ues.map(ue => [ue.id, ue] as const));
    for (const ue of ues) {
      const membership = assignUeToNearestCell(ue, this.cellLayout);
      const cellId = membership.cellId;
      const primaryServingKey = ue.id === primaryUeId
        ? this.primaryServingAssignment?.key ?? null
        : null;
      const isAuthoritativePrimary = ue.id === primaryUeId && this.multiCandidateDecisionEnabled;
      const servingSatId = isAuthoritativePrimary
        ? primaryServingKey?.satelliteId ?? null
        : cellId === null ? null : finalServingByCell.get(cellId) ?? null;
      const servingBeamId = isAuthoritativePrimary
        ? primaryServingKey?.beamId ?? null
        : servingSatId === null || cellId === null ? null : cellLinkBudgetBeamId(cellId);
      const servingCellId = servingBeamId === null
        ? null
        : cellIdFromLinkBudgetBeamId(servingBeamId);
      const servingCell = servingCellId === null ? undefined : this.cellById.get(servingCellId);
      const sat = servingSatId === null ? undefined : satById.get(servingSatId);

      const uePos = this.uePosition(ue);
      let offAxisDeg = servingCell && sat
        ? computeGeometricOffAxisDeg({
          satLatDeg: sat.latDeg,
          satLonDeg: sat.lonDeg,
          satAltitudeKm: sat.altitudeKm,
          beamCenterLatDeg: servingCell.latDeg,
          beamCenterLonDeg: servingCell.lonDeg,
          userLatDeg: uePos.latDeg,
          userLonDeg: uePos.lonDeg,
        })
        : 0;

      let sinrDb: number | null = null;
      let servingLinkSample: LinkSample | null = null;
      if (servingCell && sat && servingSatId !== null && servingBeamId !== null) {
        const samples = computeLinkBudget(uePos, finalLit, finalOptions);
        servingLinkSample = samples.find(
          sample => sample.satId === servingSatId && sample.beamId === servingBeamId,
        ) ?? null;
        sinrDb = servingLinkSample?.sinrDb ?? null;
        if (servingLinkSample?.angleAware !== undefined) {
          offAxisDeg = (servingLinkSample.angleAware.thetaRad * 180) / Math.PI;
        }
      }

      const next = { satId: servingSatId, cellId: servingCellId, beamId: servingBeamId };
      const prevServing = this.prevUeServing.get(ue.id) ?? null;
      const kind = classifyServingTransition(prevServing, next);
      if (kind === 'intra') intraHandoverCount += 1;
      else if (kind === 'inter') interHandoverCount += 1;
      // Emit the real handover for the ambient live-pulse (inter/intra only; a
      // cold attach / drop is not a handover). next is served on a real HO, so
      // its sat/cell are non-null.
      if ((kind === 'intra' || kind === 'inter') && servingSatId !== null && servingCellId !== null) {
        firedHandovers.push({
          ueId: ue.id,
          kind,
          sourceTimeSec: simTimeSec,
          fromSatId: prevServing?.satId ?? null,
          fromCellId: prevServing?.cellId ?? null,
          fromBeamId: prevServing?.beamId ?? null,
          toSatId: servingSatId,
          toCellId: servingCellId,
          toBeamId: servingBeamId,
        });
      }
      nextUeServing.set(ue.id, next);

      // W7: thread the protagonist UE's comparison contender (computed above for the
      // primary cell only) into its record; other UEs carry no comparison (the duel only
      // ever shows the primary UE).
      const ueComparison = ue.id === primaryUeId ? primaryComparison : null;

      ueRecords.push({
        ueId: ue.id,
        cellId,
        cellDistanceKm: membership.distanceKm === Infinity ? 0 : membership.distanceKm,
        offAxisDeg,
        servingSatId,
        servingBeamId,
        beamIdentity: servingSatId === null || servingCellId === null
          ? null
          : cellBeamIdentityForLink(servingSatId, servingBeamId!),
        frequencyIndex: cellId === null
          ? null
          : cellFrequencyIndex(cellId, this.profile.beams.frequencyReuse),
        sinrDb,
        servingLinkSample,
        handoverKind: kind,
        comparisonSatId: ueComparison?.comparisonSatId ?? null,
        comparisonSinrDb: ueComparison?.comparisonSinrDb ?? null,
        pendingTargetSatId: ueComparison?.pendingTargetSatId ?? null,
        triggerProgressSec: ueComparison?.triggerProgressSec ?? 0,
        intraCandidateCellId: ue.id === primaryUeId ? primaryIntraCandidate?.cellId ?? null : null,
        intraCandidateSinrDb: ue.id === primaryUeId ? primaryIntraCandidate?.sample.sinrDb ?? null : null,
        intraCandidateLinkSample: ue.id === primaryUeId ? primaryIntraCandidate?.sample ?? null : null,
      });
    }
    // C7 is a system-level sum over active physical beams. The link budget
    // computes each link before all UEs have been visited, so normalize beam
    // max RF power, P^p, P^N, and eta once here and publish that same frame to
    // the left rail, scene, and right rail.
    const fixedPowerW = finalOptions.angleAware?.fixedPowerW ?? 0;
    const beamPowerByKey = new Map<string, number>();
    for (const record of ueRecords) {
      const terms = record.servingLinkSample?.angleAware;
      const beamId = record.servingLinkSample?.beamId ?? record.servingBeamId;
      if (terms === undefined || record.servingSatId === null || beamId === null || beamId === undefined) continue;
      const key = `${record.servingSatId}:${beamId}`;
      beamPowerByKey.set(key, Math.max(beamPowerByKey.get(key) ?? 0, terms.powerW));
    }
    const beamSupplyPowerByKey = new Map<string, number>();
    for (const [key, beamPowerW] of beamPowerByKey) {
      const efficiency = resolveAngleAwareConversionEfficiency(
        beamPowerW,
        finalOptions.angleAware?.maxEfficiency,
        finalOptions.angleAware?.beamPowerCapW,
        finalOptions.angleAware?.backoffDb,
      );
      beamSupplyPowerByKey.set(key, beamPowerW / efficiency);
    }
    const systemPowerW = Math.max(fixedPowerW, 0) + Array.from(beamSupplyPowerByKey.values())
      .reduce((sum, power) => sum + power, 0);
    // The first pass above is needed to discover the maximum p_(s,v) across
    // users sharing a physical beam. Re-evaluate every selected link with
    // that accepted-frame projection so its I_(u,s,v), γ_(u,s,v), R_(u,s,v),
    // and η_(u,s,v) use the same beam maximum and U_(s,v) as the system-power
    // terms. The wanted numerator remains each link's own p_(u,s,v).
    const canonicalFinalOptions = {
      ...finalOptions,
      angleAware: {
        ...finalAngleAware,
        beamPowerByKey,
      },
    };
    ueRecords = ueRecords.map(record => {
      const sample = record.servingLinkSample;
      const terms = sample?.angleAware;
      if (sample === null || sample === undefined || terms === undefined) return record;
      const beamId = sample.beamId ?? record.servingBeamId;
      const beamKey = record.servingSatId === null || beamId === null || beamId === undefined
        ? null
        : `${record.servingSatId}:${beamId}`;
      const beamPowerW = beamKey === null
        ? terms.powerW
        : beamPowerByKey.get(beamKey) ?? terms.powerW;
      const beamSupplyPowerW = beamKey === null
        ? terms.powerConsumptionW
        : beamSupplyPowerByKey.get(beamKey) ?? terms.powerConsumptionW;
      const ue = ueById.get(record.ueId);
      const canonicalSample = ue === undefined
        ? sample
        : computeLinkBudget(this.uePosition(ue), finalLit, canonicalFinalOptions).find(
          candidate => candidate.satId === record.servingSatId && candidate.beamId === beamId,
        ) ?? sample;
      const canonicalTerms = canonicalSample.angleAware ?? terms;
      const conversionEfficiency = beamPowerW > 0
        ? beamPowerW / Math.max(beamSupplyPowerW, 1e-30)
        : canonicalTerms.conversionEfficiency;
      const normalizedTerms = {
        ...canonicalTerms,
        beamPowerW,
        beamSupplyPowerW,
        conversionEfficiency,
        powerConsumptionW: beamSupplyPowerW,
        contractVersion: ANGLE_AWARE_EE_CONTRACT_VERSION,
        systemPowerW,
        energyEfficiencyBitsPerJoule: canonicalTerms.throughputBps / Math.max(systemPowerW, 1e-30),
      };
      return {
        ...record,
        sinrDb: canonicalSample.sinrDb,
        servingLinkSample: {
          ...canonicalSample,
          angleAware: normalizedTerms,
        },
      };
    });
    // The homepage rail reads the same primary-UE angle-aware contract for the
    // serving beam, candidate beams, and configured same-satellite context
    // beams.  This sampler is display-only: its continuity map never enters
    // the decision engine or the active RF field.
    const primaryBeamMetricSatelliteIds = new Set<string>();
    for (const snapshot of finalLit) primaryBeamMetricSatelliteIds.add(snapshot.id);
    if (this.primaryServingAssignment !== null) {
      primaryBeamMetricSatelliteIds.add(this.primaryServingAssignment.key.satelliteId);
    }
    for (const opportunity of primaryCandidateOpportunities?.opportunities ?? []) {
      primaryBeamMetricSatelliteIds.add(opportunity.key.satelliteId);
    }
    const primaryBeamMetricEvidence = primaryUe === undefined
      ? null
      : this.measurePrimaryBeamMetricEvidence(
        primaryUe,
        primaryBeamMetricSatelliteIds,
        primaryCandidateOpportunities,
        allCandidatesByCell,
        satById,
        finalLit,
        finalActive,
        canonicalFinalOptions,
        simTimeSec,
        acceptedFrameIdentity,
      );
    const primaryRecord = ueRecords.find(record => record.ueId === primaryUeId) ?? ueRecords[0];
    const angleAwareFormulaFrame = primaryRecord?.servingLinkSample?.angleAware
      && primaryRecord.servingSatId !== null
      && primaryRecord.servingBeamId !== null
      ? {
        ueId: primaryRecord.ueId,
        satId: primaryRecord.servingSatId,
        beamId: primaryRecord.servingLinkSample.beamId,
        timeSec: simTimeSec,
        selected: 1 as const,
        terms: primaryRecord.servingLinkSample.angleAware,
      }
      : null;

    // Roll the currently served link identities into the next previous-step
    // state. Candidate/counterfactual probes never mutate this map.
    //
    // A serving identity and a per-UE LinkSample are deliberately separate
    // facts: the cell manager may still hold the same (u,s,v) serving link for
    // one frame while the final measurement is temporarily unavailable (for
    // example, a beam-gain floor filters the sample during a presentation
    // geometry update). That is not a handover or a new segment, so preserve
    // the prior state for that exact key. A real drop or serving identity
    // change has no matching current key and is therefore removed here; its
    // next attachment starts from the p^0 segment-start condition.
    const nextAngleAwarePowerStates = new Map<string, AngleAwarePowerState>();
    for (const record of ueRecords) {
      const sample = record.servingLinkSample;
      if (
        record.servingBeamId === null
        || record.servingBeamId === undefined
        || record.servingSatId === null
      ) {
        continue;
      }
      const beamId = sample?.beamId ?? record.servingBeamId;
      const key = angleAwareLinkKey(record.ueId, record.servingSatId, beamId);
      const terms = sample?.angleAware;
      if (terms !== undefined) {
        nextAngleAwarePowerStates.set(key, {
          timeSec: terms.timeSec,
          thetaRad: terms.thetaRad,
          transmitGainLinear: terms.transmitGainLinear,
          powerW: terms.powerW,
          segmentStartTimeSec: terms.segmentStartTimeSec,
          segmentStartThetaRad: terms.segmentStartThetaRad,
          segmentStartTransmitGainLinear: terms.segmentStartTransmitGainLinear,
          segmentStartPowerW: terms.segmentStartPowerW,
        });
        continue;
      }

      const previousState = this.angleAwarePowerStates.get(key);
      if (previousState !== undefined) nextAngleAwarePowerStates.set(key, previousState);
    }
    this.angleAwarePowerStates.clear();
    for (const [key, state] of nextAngleAwarePowerStates) {
      this.angleAwarePowerStates.set(key, state);
    }

    this.prevUeServing = nextUeServing;
    // Accumulate this frame's classified handovers into the monotonic epoch totals
    // (the throttle-proof source for the ticker HUD — see the field declaration).
    this.cumulativeIntraHandoverCount += intraHandoverCount;
    this.cumulativeInterHandoverCount += interHandoverCount;

    // Roll the recent-handover log forward: append this frame's events, drop any
    // older than the retention window (and any whose age is negative — a defensive
    // guard; a real sim-time jump clears the log via reset/rebase). Newest last.
    this.recentHandovers = [...this.recentHandovers, ...firedHandovers].filter(event => {
      const ageSec = simTimeSec - event.sourceTimeSec;
      return ageSec >= 0 && ageSec <= SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC;
    });

    return {
      simTimeSec,
      sourceFrameId: acceptedFrameIdentity.sourceFrameId,
      cells: cellRecords,
      ues: ueRecords,
      primaryUeId,
      primaryCandidateOpportunities,
      primaryCandidateProbeEvidence,
      primaryBeamMetricEvidence,
      illuminatedBeams,
      servedCellCount: finalServingByCell.size,
      servedUeCount: ueRecords.filter(ue => ue.servingSatId !== null).length,
      servingSatCount: new Set(finalServingByCell.values()).size,
      intraHandoverCount,
      interHandoverCount,
      cumulativeIntraHandoverCount: this.cumulativeIntraHandoverCount,
      cumulativeInterHandoverCount: this.cumulativeInterHandoverCount,
      angleAwareFormulaFrame,
      recentHandoverEvents: this.recentHandovers,
    };
  }

  /**
   * S1 candidate measurement at the primary UE's real position. Candidate
   * probes share one frame and one active interference field; they are never
   * inserted into activeAssignments and therefore cannot create service or
   * interfere with one another. The decision engine may consume the returned
   * set only when its separate homepage authority gate is enabled.
   */
  private measurePrimaryCandidateOpportunitySet(
    ue: UeInput,
    allCandidatesByCell: ReadonlyMap<number, readonly CellScanGeometry[]>,
    scheduledCandidatesByCell: ReadonlyMap<number, readonly CellScanGeometry[]>,
    satById: ReadonlyMap<string, CellModelSat>,
    finalLit: readonly SatelliteSnapshot[],
    finalActive: readonly ActiveBeamAssignment[],
    simTimeSec: number,
    acceptedFrameIdentity: WalkerAcceptedFrameIdentity,
  ): CandidateOpportunitySet {
    const sourceFrameId = acceptedFrameIdentity.sourceFrameId;
    const pairKey = (satId: string, beamId: number) => `${satId}:${beamId}`;
    const scheduledKeys = new Set<string>();
    for (const [cellId, geometries] of scheduledCandidatesByCell) {
      const beamId = cellLinkBudgetBeamId(cellId);
      for (const geometry of geometries) scheduledKeys.add(pairKey(geometry.satId, beamId));
    }

    const snapshotsByKey = new Map<string, SatelliteSnapshot>();
    for (const snapshot of finalLit) {
      for (const beam of snapshot.beamCellsKm) {
        snapshotsByKey.set(pairKey(snapshot.id, beam.beamId), snapshot);
      }
    }

    // A primary-UE decision is a handover between beams that can serve the
    // primary UE's current geographic cell.  The surrounding cell fan-out is
    // still rendered by the cell-truth scene, but it must not leak into this
    // decision set: a same-satellite beam belonging to another geographic cell
    // would otherwise be misclassified as an intra-satellite target merely
    // because the generic decision kind compares satellite ids.
    const primaryCellId = assignUeToNearestCell(ue, this.cellLayout).cellId;
    const measuredPairs: CellBeamMeasurement[] = [];
    for (const [cellId, geometries] of allCandidatesByCell) {
      if (primaryCellId === null || cellId !== primaryCellId) continue;
      const cell = this.cellById.get(cellId);
      if (cell === undefined) continue;
      for (const geometry of geometries) {
        const satellite = satById.get(geometry.satId);
        if (satellite === undefined) continue;
        const pointing = this.resolveCellBeamPointing(satellite, cell, simTimeSec);
        const beamId = cellLinkBudgetBeamId(cellId);
        measuredPairs.push({ cell, geometry, pointing, beamId });
        const key = pairKey(geometry.satId, beamId);
        if (!snapshotsByKey.has(key)) {
          snapshotsByKey.set(key, buildCellBeamSnapshot(satellite, cell, geometry, pointing, beamId));
        }
      }
    }

    // The homepage authority lane needs one real alternate beam on the
    // CURRENT serving satellite, including for a one-cell layout where no
    // second geographic cell exists. It remains in the same cellId and source
    // frame, but gets a distinct beam key and a distinct fixed boresight
    // geometry. Do not add variants for every inter-satellite contender: that
    // would turn a normal inter candidate into a different-satellite beam
    // variant and would no longer model one same-satellite intra decision.
    const primaryCell = primaryCellId === null ? undefined : this.cellById.get(primaryCellId);
    const primaryServingKey = this.primaryServingAssignment?.key;
    const primaryServingSatId = primaryServingKey?.satelliteId ?? null;
    if (this.multiCandidateDecisionEnabled
      && primaryCell !== undefined
      && primaryCellId !== null
      && primaryServingSatId !== null) {
      for (const geometry of allCandidatesByCell.get(primaryCellId) ?? []) {
        if (geometry.satId !== primaryServingSatId) continue;
        const satellite = satById.get(geometry.satId);
        if (satellite === undefined) continue;
        const variant = this.resolveIntraCellCandidateBeam(
          primaryCell,
          satellite,
          simTimeSec,
        );
        measuredPairs.push(variant);
        const normalKey = pairKey(geometry.satId, cellLinkBudgetBeamId(primaryCellId));
        const variantKey = pairKey(geometry.satId, variant.beamId);
        if (scheduledKeys.has(normalKey)) scheduledKeys.add(variantKey);
        if (!snapshotsByKey.has(variantKey)) {
          snapshotsByKey.set(
            variantKey,
            buildCellBeamSnapshot(
              satellite,
              variant.cell,
              variant.geometry,
              variant.pointing,
              variant.beamId,
            ),
          );
        }
      }
    }

    const uePosition = this.uePosition(ue);
    const sinrMeasurementContext = Object.freeze({
      purpose: 'sinr-offset-admission' as const,
      powerModel: 'profile-rated-rf' as const,
      profileId: this.profile.id,
      epochToken: acceptedFrameIdentity.epochToken,
      ratedTransmitPowerDbm: this.profile.channel.maxTxPowerDbm ?? null,
      activeInterferenceKeys: Object.freeze([...new Set(finalActive.map(
        assignment => `${assignment.satId}|${assignment.beamId}`,
      ))].sort()),
    });
    const samples = computeLinkBudget(
      uePosition,
      [...snapshotsByKey.values()],
      // The active compatibility policy is an RF-admission comparison, matching
      // `measureCellCandidates`: every pair in this opportunity set (including
      // the current serving pair) is measured at the profile-rated power against
      // one common active-interference field. Candidate probes remain x(t)=0 and
      // never become interferers. A committed link still starts its published
      // angle-aware recurrence at p_max / 2 in the final serving pass below.
      //
      // This seam is deliberately NOT forecast-EE evidence. EE activation still
      // requires the SDD's per-target replacement counterfactual with explicit
      // power recurrence, load, interference, and equal-horizon ratio-of-sums.
      this.linkBudgetOptions([...finalActive], simTimeSec, false),
    );
    const sampleByKey = new Map(samples.map(sample => [pairKey(sample.satId, sample.beamId), sample]));
    // The decision and the rail must consume the same same-frame EE evidence.
    // Candidate snapshots stay outside activeAssignments, so they are measured
    // without becoming interferers while the denominator still reflects the
    // current active field.
    const angleAwareSamples = computeLinkBudget(
      uePosition,
      [...snapshotsByKey.values()],
      this.linkBudgetOptions([...finalActive], simTimeSec),
    );
    const angleAwareSampleByKey = new Map(
      angleAwareSamples.map(sample => [pairKey(sample.satId, sample.beamId), sample]),
    );
    const availableMetric = (value: number, unit: string): MetricEvidence => ({
      status: 'available',
      value,
      unit,
      sourceFrameId,
      reason: null,
      measuredAtSimTimeMs: acceptedFrameIdentity.absoluteUtcMs,
    });
    const unavailableMetric = (unit: string, reason: string): MetricEvidence => ({
      status: 'unavailable',
      value: null,
      unit,
      sourceFrameId: null,
      reason,
      measuredAtSimTimeMs: acceptedFrameIdentity.absoluteUtcMs,
    });

    const measurements: CandidateLinkMeasurement[] = measuredPairs.map(({ geometry, pointing, beamId }) => {
      const key = pairKey(geometry.satId, beamId);
      const satellite = satById.get(geometry.satId)!;
      const elevationDeg = (elevationAngleRad(
        satellite.latDeg,
        satellite.lonDeg,
        satellite.altitudeKm,
        uePosition.latDeg,
        uePosition.lonDeg,
      ) * 180) / Math.PI;
      const sample = sampleByKey.get(key);
      const angleAware = angleAwareSampleByKey.get(key)?.angleAware;
      const scheduledAndIlluminated = scheduledKeys.has(key);
      const scheduledGate: CandidateGateResult = {
        code: 'scheduled-illumination',
        category: 'hard-qos',
        result: scheduledAndIlluminated ? 'pass' : 'fail',
        measured: scheduledAndIlluminated ? 1 : 0,
        threshold: 1,
        unit: 'boolean',
        reason: scheduledAndIlluminated ? null : 'beam is outside the current hopping slot',
      };
      return {
        key: candidateLinkKey(geometry.satId, beamId),
        primaryUeId: ue.id,
        sourceFrameId,
        beamIdentitySource: 'walker-cell-surrogate',
        sinrMeasurementContext,
        elevation: availableMetric(elevationDeg, 'deg'),
        steering: availableMetric(pointing.scanAngleDeg, 'deg'),
        range: availableMetric(
          computeTr38811SlantRangeKm(elevationDeg, satellite.altitudeKm),
          'km',
        ),
        sinr: sample !== undefined && Number.isFinite(sample.sinrDb)
          ? availableMetric(sample.sinrDb, 'dB')
          : unavailableMetric('dB', 'candidate beam is below the link-budget gain floor'),
        predictedThroughput: unavailableMetric(
          'bit/s',
          'candidate-specific throughput counterfactual is not implemented in S1',
        ),
        remainingServiceTime: unavailableMetric(
          's',
          'Walker remaining-service prediction is not implemented in S1',
        ),
        instantaneousEe: angleAware !== undefined && Number.isFinite(angleAware.energyEfficiencyBitsPerJoule)
          ? availableMetric(angleAware.energyEfficiencyBitsPerJoule, 'bit/J')
          : unavailableMetric(
            'bit/J',
            'same-frame angle-aware EE is unavailable for this candidate beam',
          ),
        scheduledIllumination: scheduledGate,
      };
    });

    return produceCandidateOpportunitySet({
      primaryUeId: ue.id,
      sourceFrameId,
      thresholds: {
        minimumElevationDeg: this.minElevationDeg,
        maximumSteeringDeg: this.antenna.maxSteeringAngleDeg,
        minimumSinrDb: this.profile.handover.sinrThresholdDb,
        minimumThroughputBps: null,
        minimumRemainingServiceTimeSec: null,
      },
      measurements,
    });
  }

  /**
   * H-14: measure the already-admitted primary candidate identities at the
   * primary UE's true position through the final angle-aware link-budget path.
   *
   * This is intentionally a display-only instantaneous probe. The candidate
   * snapshots are added to the read-only measurement list, while
   * `activeAssignments` remains the final serving field. Therefore candidates
   * neither enter HandoverDecision/TTT/commit nor contribute interference or
   * a second clock. Forecast-EE remains a separate, unavailable contract.
   */
  private measurePrimaryCandidateProbeEvidence(
    ue: UeInput,
    opportunitySet: CandidateOpportunitySet | null,
    allCandidatesByCell: ReadonlyMap<number, readonly CellScanGeometry[]>,
    satById: ReadonlyMap<string, CellModelSat>,
    finalLit: readonly SatelliteSnapshot[],
    finalActive: readonly ActiveBeamAssignment[],
    options: Parameters<typeof computeLinkBudget>[2],
    simTimeSec: number,
    acceptedFrameIdentity: WalkerAcceptedFrameIdentity,
  ): readonly SinrLiveCandidateProbeEvidence[] | null {
    if (opportunitySet === null) return null;

    const pairKey = (satelliteId: string, beamId: number): string => `${satelliteId}:${beamId}`;
    const snapshotsByKey = new Map<string, SatelliteSnapshot>();
    for (const snapshot of finalLit) {
      for (const beam of snapshot.beamCellsKm) {
        snapshotsByKey.set(pairKey(snapshot.id, beam.beamId), snapshot);
      }
    }

    const geometryByKey = new Map<string, CellBeamMeasurement>();
    for (const opportunity of opportunitySet.opportunities) {
      const beam = this.resolveCandidateBeamForKey(
        opportunity.key,
        allCandidatesByCell,
        satById,
        simTimeSec,
      );
      const satellite = satById.get(opportunity.key.satelliteId);
      if (beam === null || satellite === undefined) continue;
      const key = pairKey(opportunity.key.satelliteId, opportunity.key.beamId);
      geometryByKey.set(key, beam);
      if (!snapshotsByKey.has(key)) {
        snapshotsByKey.set(
          key,
          buildCellBeamSnapshot(
            satellite,
            beam.cell,
            beam.geometry,
            beam.pointing,
            beam.beamId,
          ),
        );
      }
    }

    const samples = computeLinkBudget(
      this.uePosition(ue),
      [...snapshotsByKey.values()],
      {
        ...options,
        // Candidate probe snapshots are deliberately absent from this list.
        // `computeLinkBudget` therefore excludes them from the interference
        // and angle-aware system-power reductions.
        activeAssignments: [...finalActive],
        simTimeSec,
      },
    );
    const sampleByKey = new Map(
      samples.map(sample => [pairKey(sample.satId, sample.beamId), sample]),
    );

    const evidence = opportunitySet.opportunities.map(opportunity => {
      const key = candidateLinkKey(opportunity.key.satelliteId, opportunity.key.beamId);
      const pair = pairKey(key.satelliteId, key.beamId);
      const sample = sampleByKey.get(pair) ?? null;
      const hasGeometry = geometryByKey.has(pair);
      const usable = sample !== null && hasFiniteAngleAwarePrimaryTerms(sample, ue.id, key, simTimeSec);
      const reason = !hasGeometry
        ? 'candidate display-only angle-aware probe geometry is unavailable for this source frame'
        : sample === null
          ? 'candidate display-only angle-aware LinkSample is unavailable for this source frame'
          : !usable
            ? 'candidate display-only angle-aware LinkSample has non-finite Power, Throughput, SINR, or instantaneous EE'
            : null;
      return freezeCandidateProbeEvidence({
        key,
        primaryUeId: ue.id,
        sourceFrameId: acceptedFrameIdentity.sourceFrameId,
        simTimeSec,
        provenance: SINR_LIVE_CANDIDATE_PROBE_PROVENANCE,
        eeBasis: 'candidate-probe',
        status: usable ? 'available' : 'unavailable',
        sample: usable ? sample : null,
        reason,
      });
    });
    return Object.freeze(evidence);
  }

  /**
   * Measure the configured homepage beam roster for the primary UE.
   *
   * The old rail assembled its non-primary rows from background-UE aggregates.
   * That made a row's numerator, power denominator, and time continuity depend
   * on which unrelated UE happened to occupy the beam, and it restarted every
   * non-active beam at `p_max / 2` whenever beam hopping omitted a sample. This
   * display-only surface keeps the physical source of truth singular: every
   * visible beam is measured at the same UE, in the same frame, by the same
   * `computeLinkBudget` + angle-aware EE path.
   *
   * `primaryBeamMetricPowerStates` is intentionally not the serving state. It
   * prevents a displayed counterfactual from changing HandoverDecision, TTT,
   * commit, or interference. It is still the same simulation clock and is
   * cleared with the model's continuity epoch/configuration.
   */
  private measurePrimaryBeamMetricEvidence(
    ue: UeInput,
    displaySatelliteIds: ReadonlySet<string>,
    opportunitySet: CandidateOpportunitySet | null,
    allCandidatesByCell: ReadonlyMap<number, readonly CellScanGeometry[]>,
    satById: ReadonlyMap<string, CellModelSat>,
    finalLit: readonly SatelliteSnapshot[],
    finalActive: readonly ActiveBeamAssignment[],
    options: Parameters<typeof computeLinkBudget>[2],
    simTimeSec: number,
    acceptedFrameIdentity: WalkerAcceptedFrameIdentity,
  ): readonly SinrLivePrimaryBeamMetricEvidence[] {
    const pairKey = (satelliteId: string, beamId: number): string => `${satelliteId}:${beamId}`;
    const snapshotsByKey = new Map<string, SatelliteSnapshot>();
    const geometryByKey = new Map<string, CellBeamMeasurement>();
    const requiredKeys = new Set<string>();

    for (const opportunity of opportunitySet?.opportunities ?? []) {
      requiredKeys.add(pairKey(opportunity.key.satelliteId, opportunity.key.beamId));
    }
    if (this.primaryServingAssignment !== null) {
      requiredKeys.add(pairKey(
        this.primaryServingAssignment.key.satelliteId,
        this.primaryServingAssignment.key.beamId,
      ));
    }
    for (const assignment of finalActive) {
      requiredKeys.add(pairKey(assignment.satId, assignment.beamId));
    }

    // Keep the already accepted active snapshots as the first identity source.
    // The geometry map below fills in configured/counterfactual rows without
    // replacing an active snapshot with a second representation.
    for (const snapshot of finalLit) {
      if (!displaySatelliteIds.has(snapshot.id)) continue;
      for (const beam of snapshot.beamCellsKm) {
        snapshotsByKey.set(pairKey(snapshot.id, beam.beamId), snapshot);
      }
    }

    const addResolvedGeometry = (key: CandidateLinkKey): void => {
      if (!displaySatelliteIds.has(key.satelliteId) || !satById.has(key.satelliteId)) return;
      const pair = pairKey(key.satelliteId, key.beamId);
      const resolved = this.resolveCandidateBeamForKey(
        key,
        allCandidatesByCell,
        satById,
        simTimeSec,
      );
      if (resolved === null) return;
      geometryByKey.set(pair, resolved);
      if (!snapshotsByKey.has(pair)) {
        const satellite = satById.get(key.satelliteId);
        if (satellite === undefined) return;
        snapshotsByKey.set(
          pair,
          buildCellBeamSnapshot(
            satellite,
            resolved.cell,
            resolved.geometry,
            resolved.pointing,
            resolved.beamId,
          ),
        );
      }
    };

    // Select the configured number of ordinary geographic beams per satellite,
    // but always retain source/candidate/active identities even if a sparse
    // fixture orders them after the display budget.
    const sortedCellIds = [...allCandidatesByCell.keys()].sort((left, right) => left - right);
    for (const satelliteId of displaySatelliteIds) {
      if (!satById.has(satelliteId)) continue;
      const roleBeamCount = this.primaryServingAssignment?.key.satelliteId === satelliteId
        ? this.servingBeamsPerSat
        : this.candidateBeamsPerSat;
      const beamBudget = resolveSinrLiveBeamBudget({
        fallbackBeamCount: this.beamsPerSat,
        satelliteId,
        roleBeamCount,
        beamCountBySatellite: this.beamsPerSatById,
      });
      const maxBeamCount = Number.isFinite(beamBudget)
        ? Math.max(1, Math.floor(beamBudget))
        : Number.POSITIVE_INFINITY;
      let selectedCount = 0;
      for (const cellId of sortedCellIds) {
        const geometry = allCandidatesByCell.get(cellId)?.find(
          candidate => candidate.satId === satelliteId,
        );
        if (geometry === undefined) continue;
        const beamId = cellLinkBudgetBeamId(cellId);
        const pair = pairKey(satelliteId, beamId);
        const required = requiredKeys.has(pair);
        if (!required && selectedCount >= maxBeamCount) continue;
        selectedCount += 1;
        addResolvedGeometry(candidateLinkKey(satelliteId, beamId));
      }
    }

    // Include any required variant/roster identity that is not represented by
    // an ordinary cell id. This keeps the same-cell intra beam visible in a
    // one-cell layout as well as in the seven-cell layout.
    for (const pair of requiredKeys) {
      const separator = pair.lastIndexOf(':');
      if (separator <= 0) continue;
      const satelliteId = pair.slice(0, separator);
      const beamId = Number(pair.slice(separator + 1));
      if (!Number.isInteger(beamId)) continue;
      addResolvedGeometry(candidateLinkKey(satelliteId, beamId));
    }

    if (
      [...this.primaryBeamMetricPowerStates.values()].some(
        state => Number.isFinite(state.timeSec) && state.timeSec > simTimeSec + 1e-9,
      )
    ) {
      // Defensive protection for a caller that seeks without first invoking
      // the model rebase hook. Never carry a future display segment backward.
      this.primaryBeamMetricPowerStates.clear();
    }

    // Active rows use the exact previous active state that produced the
    // canonical serving sample. Non-active rows use their own display-only
    // continuation state. Thus the source row remains numerically identical
    // to the accepted serving path while idle/counterfactual rows no longer
    // restart at the segment midpoint each frame.
    const displayPreviousStates = new Map(this.primaryBeamMetricPowerStates);
    for (const [key, state] of options.angleAware?.previousStates ?? []) {
      displayPreviousStates.set(key, state);
    }
    const displayOptions = options.angleAware === undefined
      ? options
      : {
        ...options,
        angleAware: {
          ...options.angleAware,
          previousStates: displayPreviousStates,
        },
      };
    const samples = computeLinkBudget(
      this.uePosition(ue),
      [...snapshotsByKey.values()],
      {
        ...displayOptions,
        activeAssignments: [...finalActive],
        simTimeSec,
      },
    );
    const sampleByKey = new Map(
      samples.map(sample => [pairKey(sample.satId, sample.beamId), sample]),
    );

    const nextDisplayStates = new Map(this.primaryBeamMetricPowerStates);
    for (const sample of samples) {
      const terms = sample.angleAware;
      if (sample.ueId !== ue.id || terms === undefined) continue;
      nextDisplayStates.set(angleAwareLinkKey(ue.id, sample.satId, sample.beamId), {
        timeSec: terms.timeSec,
        thetaRad: terms.thetaRad,
        transmitGainLinear: terms.transmitGainLinear,
        powerW: terms.powerW,
        segmentStartTimeSec: terms.segmentStartTimeSec,
        segmentStartThetaRad: terms.segmentStartThetaRad,
        segmentStartTransmitGainLinear: terms.segmentStartTransmitGainLinear,
        segmentStartPowerW: terms.segmentStartPowerW,
      });
    }
    this.primaryBeamMetricPowerStates.clear();
    for (const [key, state] of nextDisplayStates) {
      this.primaryBeamMetricPowerStates.set(key, state);
    }

    const evidenceKeys = new Set<string>([
      ...snapshotsByKey.keys(),
      ...geometryByKey.keys(),
    ]);
    const evidence = [...evidenceKeys]
      .map(pair => {
        const separator = pair.lastIndexOf(':');
        if (separator <= 0) return null;
        const satelliteId = pair.slice(0, separator);
        const beamId = Number(pair.slice(separator + 1));
        if (!Number.isInteger(beamId)) return null;
        const key = candidateLinkKey(satelliteId, beamId);
        const sample = sampleByKey.get(pair) ?? null;
        const hasGeometry = geometryByKey.has(pair) || snapshotsByKey.has(pair);
        const usable = sample !== null
          && hasGeometry
          && hasFiniteAngleAwarePrimaryTerms(sample, ue.id, key, simTimeSec);
        const reason = !hasGeometry
          ? 'primary-beam display geometry is unavailable for this source frame'
          : sample === null
            ? 'primary-beam display LinkSample is unavailable for this source frame'
            : !usable
              ? 'primary-beam display LinkSample has non-finite Power, Throughput, SINR, or instantaneous EE'
              : null;
        return freezePrimaryBeamMetricEvidence({
          key,
          primaryUeId: ue.id,
          sourceFrameId: acceptedFrameIdentity.sourceFrameId,
          simTimeSec,
          provenance: SINR_LIVE_PRIMARY_BEAM_METRIC_PROVENANCE,
          status: usable ? 'available' : 'unavailable',
          sample: usable ? sample : null,
          reason,
        });
      })
      .filter((item): item is SinrLivePrimaryBeamMetricEvidence => item !== null)
      .sort((left, right) => (
        left.key.satelliteId.localeCompare(right.key.satelliteId)
        || left.key.beamId - right.key.beamId
      ));
    return Object.freeze(evidence);
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
      probes.push(buildCellBeamSnapshot(
        sat,
        cell,
        geom,
        this.resolveCellBeamPointing(sat, cell, simTimeSec),
      ));
    }

    // Candidate links have x(t)=0 until the handover manager accepts one. The
    // p_max / 2 segment-start recurrence therefore belongs only to the selected
    // served link, not to this admission/counterfactual measurement. Applying
    // it here would reject otherwise valid candidates before any link can be
    // selected, leaving the cell lane with no serving beam.
    const options = this.linkBudgetOptions(activeAssignments, simTimeSec, false);
    const measurePoint: UEPosition = {
      id: `cell:${cell.cellId}`,
      latDeg: cell.latDeg,
      lonDeg: cell.lonDeg,
      offsetEastKm: cell.localXKm,
      offsetNorthKm: cell.localYKm,
    };
    const samples = computeLinkBudget(measurePoint, [...interferers, ...probes], options);
    // Keep only the candidate-probe samples for THIS cell (unique beamId).
    return samples.filter(sample => sample.beamId === beamId);
  }

  /**
   * Measure the best alternate beam on the current serving satellite at the
   * primary UE's actual position. The target beam is a currently illuminated
   * `(sat, cell)` pair, so its SINR includes the same active serving field and
   * the same interference-aware link-budget path as the displayed serving
   * value. This is presentation evidence only; it never changes a manager.
   */
  private measureIntraCandidate(
    ue: UeInput,
    sourceCellId: number | null,
    servingSatId: string | null,
    candidatesByCell: ReadonlyMap<number, readonly CellScanGeometry[]>,
    satById: ReadonlyMap<string, CellModelSat>,
    finalLit: readonly SatelliteSnapshot[],
    finalActive: readonly ActiveBeamAssignment[],
    options: Parameters<typeof computeLinkBudget>[2],
    simTimeSec: number,
  ): { cellId: number; sample: LinkSample } | null {
    if (sourceCellId === null || servingSatId === null) return null;
    const uePos = this.uePosition(ue);
    const candidates: Array<{ cellId: number; sample: LinkSample }> = [];
    for (const [targetCellId, geoms] of candidatesByCell) {
      if (targetCellId === sourceCellId) continue;
      const geom = geoms.find(candidate => candidate.satId === servingSatId);
      const targetCell = this.cellById.get(targetCellId);
      const sat = satById.get(servingSatId);
      if (!geom || !targetCell || !sat) continue;
      const targetBeamId = cellLinkBudgetBeamId(targetCellId);
      const targetKey = `${servingSatId}:${targetBeamId}`;
      const targetAlreadyActive = finalActive.some(assignment => `${assignment.satId}:${assignment.beamId}` === targetKey);
      const snapshots = targetAlreadyActive
        ? [...finalLit]
        : [...finalLit, buildCellBeamSnapshot(
          sat,
          targetCell,
          geom,
          this.resolveCellBeamPointing(sat, targetCell, simTimeSec),
        )];
      const sample = computeLinkBudget(uePos, snapshots, {
        ...options,
        activeAssignments: [...finalActive],
        simTimeSec,
      }).find(entry => entry.satId === servingSatId && entry.beamId === targetBeamId);
      if (sample !== undefined && Number.isFinite(sample.sinrDb)) {
        candidates.push({ cellId: targetCellId, sample });
      }
    }
    // The homepage handover authority is instantaneous EE.  Keep SINR only as
    // a deterministic compatibility fallback when an older LinkSample does
    // not carry angle-aware terms; otherwise a SINR sort can publish a beam
    // that is visibly different from the EE decision winner.
    candidates.sort((a, b) => {
      const leftEe = a.sample.angleAware?.energyEfficiencyBitsPerJoule;
      const rightEe = b.sample.angleAware?.energyEfficiencyBitsPerJoule;
      const leftHasEe = typeof leftEe === 'number' && Number.isFinite(leftEe) && leftEe >= 0;
      const rightHasEe = typeof rightEe === 'number' && Number.isFinite(rightEe) && rightEe >= 0;
      if (leftHasEe && rightHasEe && leftEe !== rightEe) return rightEe - leftEe;
      if (leftHasEe && !rightHasEe) return -1;
      if (!leftHasEe && rightHasEe) return 1;
      return b.sample.sinrDb - a.sample.sinrDb || a.cellId - b.cellId;
    });
    return candidates[0] ?? null;
  }
}
