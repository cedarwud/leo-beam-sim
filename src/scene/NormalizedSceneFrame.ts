/**
 * NormalizedSceneFrame — the renderer's only input.
 *
 * Rationale (SDD §3 Q7 / §4 D2):
 *   `NormalizedSceneFrame` is a NEW type, NOT an extension of `SimFrame`.
 *   `SimFrame` is deeply read by `useBeamViz` via `sim.*` field access
 *   (single-UE, live-engine event latches, wallclock fields); extending it in
 *   place would pollute the live hot path with replay-only / N-UE fields.
 *
 *   `liveSimToScene(SimFrame): NormalizedSceneFrame` is a thin pure projection.
 *   `showcaseArtifactToScene(artifact, frameIdx): NormalizedSceneFrame` is the
 *   single seam that reads the raw `visual-showcase-v1` JSON.
 *
 * Truth-ownership boundary (R1/R2):
 *   - This file contains NO numeric computation of SINR, handover decisions,
 *     positions, rewards, or any other producer-owned truth.
 *   - All channel values are wrapped in `ChannelMetricValue` (branded) so a
 *     bare `number` cannot enter the downstream pipeline.
 *   - Coord-frame is preserved on every position; the renderer reads the
 *     world-space (`worldPos`) projection done by `coordToWorld`.
 *
 * Constraints:
 *   - No imports from `core/channel`, `core/beam`, `HandoverManager`,
 *     `computeLinkBudget`, `buildLinkContext`, `runtimeFrameStep`.
 *   - No three.js imports here — keep the type pure data so it can be JSON-
 *     serialised for D6 snapshot tests in P1d.
 *
 * P1c: derivation logic from `SimFrame` lives in
 * `src/showcase/deriveLiveSceneFields.ts` and `src/showcase/liveSimToScene.ts`;
 * from the artifact it lives in `src/showcase/showcaseArtifactToScene.ts`.
 * Both adapters now emit `NormalizedSceneFrame` with bound role / event /
 * progress tokens — the renderer never re-derives intra/inter from ID
 * comparison.
 *
 * TODO P1e: D6 deterministic state-snapshot harness will serialise this type.
 * The two adapters' outputs are diff-checked with `1e-6` float tolerance to
 * catch C1-split regressions.
 */

import type { ChannelMetricValue } from './ChannelMetricValue';
import type { SceneGeometry } from './SceneGeometry';
import type { CoreLayoutFrequencyReuse, ReuseGroupSource } from './beam-layout';
import type { TopocentricPoint } from '../engine/orbit/types';
import type {
  VisualShowcaseChannelMetricKind,
  VisualShowcaseClaimBoundary,
  VisualShowcaseCoordinateFrameKind,
  VisualShowcaseDecisionFrame,
  VisualShowcaseEvidenceStatus,
  VisualShowcaseFieldProvenance,
  VisualShowcaseHandoverPhaseSource,
  VisualShowcaseProvenance,
  VisualShowcaseTruthOwnership,
} from './visual-showcase-contract';

// ---------------------------------------------------------------------------
// EventRole / role tokens — pre-derived in the adapter, NOT in useBeamViz
// ---------------------------------------------------------------------------

/**
 * Role tokens used by the renderer for color / pulse decisions. Pre-derived
 * by the adapter from producer truth (replay) or from `SimFrame` event latches
 * (live). The renderer never re-derives these by ID comparison (Q5 C1 split).
 */
export type EventRole =
  | 'serving'
  | 'prepared'
  | 'post-ho'
  | 'secondary'
  | 'approach'
  | 'inactive';

/** Top-level handover kind from the artifact (or empty for live no-event). */
export type HandoverKind = string;

// ---------------------------------------------------------------------------
// Transition progress (Q7 §3 binding)
// ---------------------------------------------------------------------------

export interface IntraTransitionProgress {
  fromBeamId: string;
  toBeamId: string;
  /** Normalised 0..1 progress through the transition. */
  progress01: number;
  expiresAtSec: number;
  /** Live-only: source-sat ID + wallclock latch + triggered-at for the
   * `VizIntraHandoverEvent` shape. Replay leaves these undefined and the
   * renderer falls back to `progress01` for animation timing. */
  satId?: string;
  triggeredAtSec?: number;
  wallClockStartMs?: number;
  wallClockExpiresMs?: number;
  /** Live-only: distinguishes the pre-switch dwell `preview` from the
   * committed event. `kind === 'preview'` uses `previewProgressSec`/
   * `previewTargetSec` (in seconds) instead of the wallclock latches. */
  kind?: 'committed' | 'preview';
  previewProgressSec?: number;
  previewTargetSec?: number;
}

export interface InterTransitionProgress {
  fromSatId: string;
  fromBeamId: string;
  toSatId: string;
  toBeamId: string;
  progress01: number;
  expiresAtSec: number;
  /** Live-only: distinguishes the pending pre-trigger phase from the
   * committed phase. */
  kind?: 'pending' | 'committed';
  /** Live-only: raw progress / target in seconds (pending phase). */
  pendingProgressSec?: number;
  pendingTargetSec?: number;
  /** Live-only: wallclock latches (committed phase). */
  wallClockStartMs?: number;
  wallClockExpiresMs?: number;
}

export interface TransitionProgress {
  intra?: IntraTransitionProgress;
  inter?: InterTransitionProgress;
}

// ---------------------------------------------------------------------------
// Per-entity binding shapes
// ---------------------------------------------------------------------------

/**
 * World-space coordinate triple (after `coordToWorld`). Units: scene-world km.
 */
export type WorldPos = readonly [number, number, number];

/**
 * S1 coordinate authority — explicit render-frame discriminator for the
 * satellite `worldPos`, set by the adapter that produced it. The renderer
 * (`useBeamViz`) selects its projection by THIS TYPE instead of guessing the
 * frame from the coordinate magnitude (`mag > 1000`):
 *  - `'live-enu'`     — live adapter; `worldPos` is the sky-dome az/el
 *                       projection in small world-units (NOT ecef-km). Scaled
 *                       by `satPosScaleFactor`, magnitude-independent.
 *  - `'replay-worldpos'` — replay/artifact adapter; `worldPos` is
 *                       `coordToWorld(positionEcefKm)` (ecef-km). Normalised
 *                       onto the dome shell at the visual altitude,
 *                       magnitude-independent (S1b).
 *
 * Both real adapters tag explicitly. `worldFrame` ABSENT does NOT mean
 * `'replay-worldpos'`: an untagged `worldPos` falls through to the legacy
 * magnitude guess (`mag > 1000 ? normalize : scale`), which DIVERGES from
 * `'replay-worldpos'` for a coordinate of magnitude ≤ 1000. New adapters must
 * tag their satellites; absent is a legacy fallback only.
 */
export type SatelliteWorldFrameKind = 'live-enu' | 'replay-worldpos';

export interface NormalizedSatellite {
  readonly id: string;
  /** World-space position (post-coordToWorld). */
  readonly worldPos: WorldPos;
  /**
   * Render-frame of {@link worldPos}. Both real adapters set this explicitly
   * (live ⇒ `'live-enu'`, replay ⇒ `'replay-worldpos'`). Absent ⇒ the legacy
   * magnitude guess (NOT `'replay-worldpos'`; see {@link SatelliteWorldFrameKind}).
   */
  readonly worldFrame?: SatelliteWorldFrameKind;
  /** Raw producer-side frame; preserved for provenance / diagnostics. */
  readonly coordFrameKind: VisualShowcaseCoordinateFrameKind;
  /** Producer-declared display role string (e.g. 'serving', 'candidate'). */
  readonly displayRole: string;
  readonly visible: boolean;
  readonly positionProvenance?: VisualShowcaseFieldProvenance;
  /**
   * Live-only display-projection fields. The adapter
   * (`liveSimToScene`) fills these from `VisibleSat`; the renderer reads
   * them for elevation gating and shell-aware footprint computation. Replay
   * adapter leaves these undefined; renderer treats `topo` as informative
   * (not truth) and falls back to defaults when absent.
   */
  readonly shellId?: string;
  readonly altitudeKm?: number;
  readonly topo?: TopocentricPoint;
  readonly latDeg?: number;
  readonly lonDeg?: number;
}

/**
 * Producer-truth UE record. Channel values carried as branded
 * {@link ChannelMetricValue}.
 *
 * R6 binding: live N=1; replay N≤100. Length is NOT 1-locked at this type;
 * the live adapter populates a one-element array.
 */
export interface NormalizedUe {
  readonly id: string;
  /** Producer geo (lat/lon/alt) — preserved for provenance display. */
  readonly geo: { latDeg: number; lonDeg: number; altKm?: number };
  /**
   * World-space ground position (post-coordToWorld). Optional because some
   * pipelines may render UEs from `geo` directly; we keep both.
   */
  readonly worldPos?: WorldPos;
  readonly servingSatelliteId: string;
  readonly servingBeamId: string;
  readonly targetSatelliteId: string | null;
  readonly targetBeamId: string | null;
  /** Branded channel metric (SNR or SINR per `channelMetricKind`). */
  readonly channelMetric: ChannelMetricValue;
  /** Optional per-beam candidate channel map (multi-UE artifact). */
  readonly candidatesByBeamId?: ReadonlyMap<string, ChannelMetricValue>;
  /** Per-UE decision reference (resolved from `decisionFrames[]`). */
  readonly decisionRef?: string;
}

export interface NormalizedBeam {
  readonly id: string;
  readonly satelliteId: string;
  /** World-space cone tip (or center) — display only. */
  readonly worldCenter?: WorldPos;
  readonly halfAngleDeg: number;
  /** Pre-derived role token (serving / prepared / post-ho / …). */
  readonly role: EventRole;
  /** Display-only producer role string (raw value from `beams[].role`). */
  readonly producerRole?: string;
  readonly gainDb?: number | null;
  readonly gainProvenance?: VisualShowcaseFieldProvenance;
  readonly frequencyReuseGroup?: string | null;
  readonly frequencyReuseProvenance?: VisualShowcaseFieldProvenance;
  /**
   * Live-only layout primitives sourced from
   * `SimFrame.steeringBeamCellsBySatId[].BeamCellState`. Used by the renderer
   * to draw scan-angle cones + reuse-group rings; not producer truth.
   * Replay adapter leaves these undefined.
   */
  readonly offsetEastKm?: number;
  readonly offsetNorthKm?: number;
  readonly scanAngleDeg?: number;
  readonly coreLayoutSatId?: string;
  readonly coreBeamId?: string;
  readonly coreLocalBeamIndex?: number;
  readonly reuseGroup?: number;
  readonly runtimeFrequencyReuse?: number;
  readonly coreLayoutFrequencyReuse?: CoreLayoutFrequencyReuse;
  readonly reuseGroupSource?: ReuseGroupSource;
}

export interface NormalizedLink {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly beamId: string;
  readonly role: string;
  readonly channelMetric: ChannelMetricValue;
  /**
   * Live-only link-budget components from `SimFrame.linkSamples[]`. Carried
   * here for the engineering-display surfaces (FormulaTermsReadout,
   * DuelSignalColumn, …) that previously read `LinkSample` directly. Truth
   * boundary: these are live-engine outputs, not producer truth; replay
   * leaves them undefined (artifact `metrics.serving` carries the only
   * authoritative channel value, already wrapped in `channelMetric`).
   */
  readonly rsrpDbm?: number;
  readonly signalDbm?: number;
  readonly intraInterferenceDbm?: number;
  readonly interInterferenceDbm?: number;
  readonly noiseDbm?: number;
  readonly denominatorDbm?: number;
  readonly txPowerDbm?: number;
  readonly pathLossDb?: number;
  readonly beamGainDb?: number;
  readonly steeringLossDb?: number;
  readonly receiverGainDbi?: number;
}

// ---------------------------------------------------------------------------
// Handover state, beam hopping, pending target, recent HO
// ---------------------------------------------------------------------------

export interface NormalizedHandover {
  /**
   * Producer-declared kind (e.g. 'intra-satellite-beam-switch',
   * 'inter-satellite-handover', 'none'). Replay: MUST be non-empty (load
   * blocks on absent kind). Live: derived from HandoverManager output.
   */
  readonly kind: HandoverKind;
  readonly phase: string;
  readonly phaseSource?: VisualShowcaseHandoverPhaseSource;
  readonly sourceHandoverOccurred?: boolean;
  readonly servingSatelliteId: string;
  readonly servingBeamId: string;
  readonly targetSatelliteId?: string | null;
  readonly targetBeamId?: string | null;
  readonly handoverProvenance?: VisualShowcaseFieldProvenance;
}

export interface NormalizedBeamHopping {
  /**
   * Map<satId, { activeBeamIds, hopSlot? }>. Captures the live
   * `beamHopStatesBySatId.activeBeamIds` semantic. Replay: derived from
   * `timeline[].beams[].role === 'serving'`.
   */
  readonly bySatId: ReadonlyMap<string, { activeBeamIds: readonly string[]; hopSlot?: number }>;
  /**
   * Live-only beam-hopping slot length (seconds). Sourced from
   * `SimFrame.beamHopSlotSec`. Replay leaves undefined; the renderer
   * substitutes a sensible default when computing animation timing.
   */
  readonly slotSec?: number;
  /**
   * Live-only beam-hopping slot index (monotonic counter advanced by
   * `runtimeFrameStep`). Required by `computeApproachPreviews` for the
   * forward-looking scheduler. Replay leaves undefined and the approach-
   * preview pipeline returns an empty result.
   */
  readonly slotIndex?: number;
  /**
   * Live-only beam-hopping enabled flag (mirrors `SimFrame.beamHopEnabled`).
   * Replay leaves undefined; renderer treats absence as disabled.
   */
  readonly enabled?: boolean;
  /**
   * Live-only display-assignment map: per-sat set of beam IDs marked as
   * "currently assigned for display" by `runtimeFrameStep`. Distinct from
   * `bySatId.activeBeamIds` (which reflects beam-hopping state) — the
   * display assignment can include preview / overlay beams. Replay path
   * leaves undefined; renderer falls back to `bySatId[].activeBeamIds`.
   */
  readonly displayAssignmentsBySatId?: ReadonlyMap<string, readonly string[]>;
}

export interface NormalizedPendingTarget {
  readonly satId: string;
  readonly beamId: string;
  readonly channelMetric?: ChannelMetricValue;
}

export interface NormalizedRecentHo {
  readonly sourceSatId: string;
  readonly sourceBeamId: string;
  /** Target may be null when only the source is latched (e.g. pre-handover
   * dwell where the renderer flags the source as `secondary` without a
   * confirmed target yet). */
  readonly targetSatId: string | null;
  readonly targetBeamId: string | null;
  readonly sourceChannelMetric?: ChannelMetricValue;
  readonly ageSec: number;
}

// ---------------------------------------------------------------------------
// Metrics (primary / serving / candidates / reward)
// ---------------------------------------------------------------------------

export interface NormalizedMetrics {
  /** Source-declared channel metric kind (drives legend label). */
  readonly channelMetricKind: VisualShowcaseChannelMetricKind;
  /** Primary-UE channel value. */
  readonly primary: ChannelMetricValue;
  /** Serving-link channel value. */
  readonly serving: ChannelMetricValue;
  /** Optional per-beam candidate channels (multi-UE artifact). */
  readonly candidates?: ReadonlyMap<string, ChannelMetricValue>;
  readonly servingSatelliteId: string;
  readonly servingBeamId: string;
  readonly throughputMbps?: number;
  readonly rewardScalar?: number;
  readonly rewardVector?: Readonly<Record<string, number>>;
}

// ---------------------------------------------------------------------------
// Per-UE decisions (replay; live empty)
// ---------------------------------------------------------------------------

export interface NormalizedUeDecision {
  readonly id: string;
  readonly ueId?: string;
  readonly actionIndex: number;
  readonly actionLabel?: string;
  readonly selectedActionScore: number;
  readonly runnerUpActionScore: number | null;
  readonly scoreMargin: number | null;
  readonly mask?: readonly boolean[];
  /** Raw producer record for traceability. */
  readonly source?: VisualShowcaseDecisionFrame;
}

// ---------------------------------------------------------------------------
// Top-level NormalizedSceneFrame
// ---------------------------------------------------------------------------

export interface NormalizedEventRoleMaps {
  /** Per-satellite pre-derived role tokens. */
  readonly bySatId: ReadonlyMap<string, EventRole>;
  /** Per-beam pre-derived role tokens. */
  readonly byBeamId: ReadonlyMap<string, EventRole>;
}

export interface NormalizedSceneFrame {
  /** Source discriminator — drives legend / banner / metric label. */
  readonly sceneSource: 'live-sim' | 'artifact-replay';
  /** Timeline frame index (replay) or live frame counter. */
  readonly frameIndex: number;
  /** Frame timestamp in seconds. */
  readonly tSec: number;

  readonly satellites: readonly NormalizedSatellite[];
  /** R6: live N=1 fixed; replay N ≤ 100. Type does not lock length to 1. */
  readonly ues: readonly NormalizedUe[];
  readonly beams: readonly NormalizedBeam[];
  readonly links: readonly NormalizedLink[];

  readonly eventRoles: NormalizedEventRoleMaps;
  readonly transitionProgress: TransitionProgress;
  readonly beamHopping: NormalizedBeamHopping;
  readonly pendingTarget?: NormalizedPendingTarget;
  readonly recentHo?: NormalizedRecentHo;
  readonly handover: NormalizedHandover;
  readonly metrics: NormalizedMetrics;
  /** Replay-only; live populates an empty array. */
  readonly perUeDecisions: readonly NormalizedUeDecision[];

  /** Branded — REPLAY_GEOMETRY_BRAND for replay, LIVE_GEOMETRY_BRAND for live. */
  readonly geometry: SceneGeometry;

  /**
   * Top-level redundant carrier so the legend driver does not have to dig
   * into `metrics.channelMetricKind`. Matches `metrics.channelMetricKind`.
   */
  readonly channelMetricKind: VisualShowcaseChannelMetricKind;

  /** Producer provenance block (replay). For live, a minimal stub. */
  readonly provenance: VisualShowcaseProvenance | LiveProvenanceStub;
  /** Producer claim boundary (replay). For live, a minimal stub. */
  readonly claimBoundary: VisualShowcaseClaimBoundary | LiveClaimBoundaryStub;
  /** Producer evidence status (replay). For live, a minimal stub. */
  readonly evidenceStatus: VisualShowcaseEvidenceStatus | LiveEvidenceStatusStub;

  /**
   * Producer truth-ownership table (replay only; live: null). Renderer surfaces
   * use it for the provenance panel; never as a tuning input.
   */
  readonly truthOwnership: VisualShowcaseTruthOwnership | null;
}

/**
 * Minimal live-path stubs. They carry the same field shape as the producer
 * blocks so renderer code does not need to branch on `sceneSource` to read a
 * banner string; only the channel-kind label differs.
 *
 * TODO P1e: liveSimToScene fills these from repo build info via UI prop
 * injection once the claim-boundary banner UI component lands. For now the
 * stubs carry static `allowedClaims` / `forbiddenClaims` lists that match
 * the live path's "no MODQN / Multi-Catfish / EE claims" boundary.
 */
export interface LiveProvenanceStub {
  readonly kind: 'live-stub';
  readonly note?: string;
}
export interface LiveClaimBoundaryStub {
  readonly kind: 'live-stub';
  readonly storyKind: 'live-sinr-sim';
  readonly allowedClaims: readonly string[];
  readonly forbiddenClaims: readonly string[];
}
export interface LiveEvidenceStatusStub {
  readonly kind: 'live-stub';
  readonly status: 'live';
  readonly notes: readonly string[];
}
