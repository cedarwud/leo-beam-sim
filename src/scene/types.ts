import * as THREE from 'three';
import type { BeamCodeRole } from '../constants/beamRoleTokens';
import type { TopocentricPoint } from '../engine/orbit';
import type {
  ActiveBeamAssignment,
  AngleAwareFormulaFrame,
  LinkSample,
} from '../engine/signal/types';
import type { HandoverEvent, IntraSwitchPreview } from '../engine/handover/types';
import type { HandoverDecisionFrame } from '../engine/handover/candidateDecisionContract';
import type { AcceptedHandoverPresentationSnapshot } from './acceptedHandoverPresentationSnapshot';
import type { BeamFrequencyIndexResolution } from '../utils/beamFrequency';
import type { CoreLayoutFrequencyReuse, ReuseGroupSource } from './beam-layout';
import type { UeDistributionMode, UePrimaryAnchorMode } from '../engine/ue/multiUeState';
import type { UeMobilityMode, UeMobilityParams } from '../engine/ue/multiUeMobility';
import type { AppExperienceMode } from '../app/appExperienceMode';
import type { GlyphKind } from '../contracts/glyphTypes';
import type { VisualBeamTarget } from './beamTargetTypes';
import type {
  ModqnVisualLayerFlags,
  ModqnVisualLayerPreset,
} from './modqnVisualLayers';
import type { ModqnCellServiceReadout } from './modqnServiceMap';
import type { SinrLiveCellFrame } from './sinrLiveCellModel';
import type { PaperEnergyEfficiency } from '../utils/paperEnergyEfficiency';
import type { CanonicalEeInputErrorCode } from '../teaching/canonicalEnergyEfficiency';
import type {
  BeamshiftCanonicalEeInputErrorCode,
  BeamshiftCanonicalUeStatus,
} from '../teaching/beamshiftCanonicalEe';
import type { HomepageBeamMetricsProjection } from '../homepage/controller/contracts';

export type { BeamTarget, VisualBeamTarget } from './beamTargetTypes';

export type PresentationMode = 'research-default' | 'candidate-rich' | 'demo-readability';
export type BeamDensity = 'event-only' | 'event-plus-1' | 'all';
export type CinematicMode = 'off' | 'spotlight' | 'director';
export type DirectorFocusKind = 'intra' | 'inter';
export type DirectorFocusPhase = 'idle' | 'acquiring' | 'focused' | 'restoring';
export type CameraPreset = 'zenith' | 'oblique' | 'chase' | 'paper-faithful-closeup';
export type UeDistributionScope = 'beam-footprint' | 'service-area';

export type CanonicalEeSnapshotStatus = 'pending' | 'valid' | 'zero-activity' | 'invalid';

export type CanonicalEeErrorCode =
  | 'MISSING_RATED_MAX_RF_OUTPUT'
  | 'INVALID_CANONICAL_CONFIG'
  | BeamshiftCanonicalEeInputErrorCode
  | CanonicalEeInputErrorCode;

export interface CanonicalEeUserContribution {
  readonly ueId: string;
  /** Producer-backed status; optional only for older direct card fixtures. */
  readonly status?: BeamshiftCanonicalUeStatus;
  /** Producer-backed serving identity; null means the field is unavailable. */
  readonly satId?: string | null;
  readonly cellId?: number | null;
  /** Typed serving beam/cell identity; null means no service identity. */
  readonly beamIdentity?: string | null;
  /** Assigned active-beam load U used by the producer's bandwidth split. */
  readonly assignedBeamLoad?: number;
  readonly allocatedBandwidthMHz?: number;
  readonly sinrDb?: number | null;
  readonly rateMbps?: number;
  /** Additive r_{1,u}; this is not a user's physical transmit power. */
  readonly contributionMbitPerJ: number;
}

/** Publisher-to-UI projection of the canonical partial-payload producer boundary. */
export interface CanonicalEeSnapshot {
  readonly status: CanonicalEeSnapshotStatus;
  readonly sumIdentity: boolean | null;
  readonly systemPowerW: number | null;
  readonly eeInstMbitPerJ: number | null;
  readonly contributionSumMbitPerJ: number | null;
  /** Absent until at least one positive-duration sample is integrated. */
  readonly eeEvalMbitPerJ: number | null;
  readonly evaluationSampleCount: number;
  /** Last producer frame represented by the instantaneous readout. */
  readonly frameSimTimeSec: number | null;
  /** Actual RF output and governed rated cap, kept as separate fields. */
  readonly actualRfOutputW: number | null;
  readonly ratedRfOutputW: number | null;
  /** Ratio-of-sums totals and the explicit accumulated window boundary. */
  readonly evaluationDataMbit: number | null;
  readonly evaluationEnergyJ: number | null;
  readonly evaluationWindowStartSec: number | null;
  readonly evaluationWindowEndSec: number | null;
  /** Primary serving beam identity for the visible canonical sample. */
  readonly servingBeamIdentity: string | null;
  readonly perUserContributions: readonly CanonicalEeUserContribution[] | null;
  readonly errorCode: CanonicalEeErrorCode | null;
}

export function createPendingCanonicalEeSnapshot(): CanonicalEeSnapshot {
  return {
    status: 'pending',
    sumIdentity: null,
    systemPowerW: null,
    eeInstMbitPerJ: null,
    contributionSumMbitPerJ: null,
    eeEvalMbitPerJ: null,
    evaluationSampleCount: 0,
    frameSimTimeSec: null,
    actualRfOutputW: null,
    ratedRfOutputW: null,
    evaluationDataMbit: null,
    evaluationEnergyJ: null,
    evaluationWindowStartSec: null,
    evaluationWindowEndSec: null,
    servingBeamIdentity: null,
    perUserContributions: null,
    errorCode: null,
  };
}

export interface ReplayConfig {
  epochUtcMs: number;
  startOffsetSec: number;
  loop: boolean;
  windowLengthSec?: number;
  seekTargetSec?: number;
  seekRequestKey?: string;
  /** Homepage Director only: rebuild the same source history before landing. */
  sourceHistoryReplay?: boolean;
}

export interface RuntimeEffectsEnabled {
  spineParticles: boolean;
  orbitTrail: boolean;
  servingRipple: boolean;
  pendingRipple: boolean;
}

export interface RuntimeViewport {
  width: number;
  height: number;
}

export interface RuntimeCameraCommand {
  preset: CameraPreset;
  issuedAtMs: number;
}

export interface DirectorFocusFraming {
  readonly fromSatId?: string | null;
  readonly toSatId?: string | null;
}

export interface RuntimeDirectorFocusCommand {
  kind: DirectorFocusKind;
  /** Only the scene-relevant transitions are commanded; idle/focused are App-owned states. */
  phase: 'acquiring' | 'restoring';
  issuedAtMs: number;
  framing?: DirectorFocusFraming;
}

export interface RuntimeConfig {
  appMode: AppExperienceMode;
  presentationMode: PresentationMode;
  replay: ReplayConfig;
  /** Explicit measurement-window reset; parameters remain unchanged. */
  measurementResetEpoch?: number;
  signalResetKey?: string;
  handoverResetKey?: string;
  beamDensity: BeamDensity;
  effectsEnabled: RuntimeEffectsEnabled;
  cinematicMode: CinematicMode;
  cameraCommand?: RuntimeCameraCommand;
  directorFocusCommand?: RuntimeDirectorFocusCommand;
  reducedMotion: boolean;
  viewport: RuntimeViewport;
  ueCount?: number;
  cellServingCount?: number;
  /** Per-satellite beam budgets for the live cell-truth scheduler. */
  beamCountBySatellite?: Readonly<Record<string, number>>;
  /** Role budgets follow whichever identities currently serve/contend. */
  servingBeamCount?: number;
  candidateBeamCount?: number;
  /** Homepage-only absolute candidate EE floor, expressed in Kbit/J in the UI. */
  eeThresholdKbitPerJoule?: number;
  /**
   * The handover lecture currently running, or null. While a lecture is armed
   * the scene may only paint that lecture's own transition: a live event
   * intruding mid-lecture shows the viewer a handover of the wrong kind.
   */
  teachingLectureKind?: 'intra' | 'inter' | null;
  /** Presentation-scene scheduling switch; false keeps each sat's cell window fixed. */
  beamHoppingEnabled?: boolean;
  /**
   * Cell whose UE the left panel / right rail / serving highlight follow.
   * `null` keeps the historical first UE.
   *
   * NOT viewpoint-only any more. This used to read "Viewpoint only — it does not
   * change anyone's serving or handover decision", and that claim was false in
   * the direction that mattered: under the shipped `seven-cell-asymmetric`
   * distribution every UE except the observer anchor is pinned to an absolute
   * cell centre, so the focused UE was always a STATIC one, and a static UE under
   * earth-fixed cells essentially never changes serving beam. Focusing any cell
   * therefore guaranteed zero intra handovers — the one thing the focus feature
   * exists to show.
   *
   * Focus now also decides WHO WALKS `profile.ueMobility`'s ground track (see the
   * protagonist-drift block in `stepRuntimeFrame`). One mover at a time: the
   * focused UE moves, everyone else stands still, and on a focus change the new
   * protagonist takes over the walk while the old one keeps the ground it
   * reached. Because that UE now crosses beam boundaries, focus DOES change its
   * serving and handover outcomes.
   *
   * What is still true — and is the invariant to protect — is that focus changes
   * nothing about HOW any link is computed, and changes no OTHER UE's decisions:
   * SINR, power, throughput, EE and the handover policy are identical for all
   * UEs whatever is focused, and every non-protagonist UE's serving story is
   * byte-identical to the unfocused run.
   */
  focusCellId?: number | null;
  ueDistributionMode?: UeDistributionMode;
  uePrimaryAnchorMode?: UePrimaryAnchorMode;
  ueDistributionScope?: UeDistributionScope;
  ueDistributionRadiusKm?: number;
  /** Demo intra-handover jog: ENU offset (km) applied to the PRIMARY UE only, so a
   *  button press slides it into an adjacent same-sat beam cell and the engine does
   *  a real intra handover. Both default 0 (no jog). */
  primaryJogEastKm?: number;
  primaryJogNorthKm?: number;
  /** One-shot explicit live demo cue; not a source-backed trajectory event. */
  manualHandoverRequestId?: number;
  manualHandoverKind?: 'intra' | 'inter';
  manualHandoverOrigin?: 'button' | 'scheduled';
  manualHandoverStartedAtMs?: number;
  manualHandoverSourceSatId?: string;
  manualHandoverSourceCellId?: number;
  manualHandoverTargetSatId?: string;
  manualHandoverTargetCellId?: number;
  manualHandoverServingSinrDb?: number;
  manualHandoverCandidateSinrDb?: number;
  ueMobilityMode?: UeMobilityMode;
  ueMobilityParams?: UeMobilityParams;
  enableUeTrails?: boolean;
  modqnVisualLayerPreset?: ModqnVisualLayerPreset;
  modqnVisualLayers?: ModqnVisualLayerFlags;
  // S-FLAG-2: producer-readiness gate for the MODQN service-allocation overlay
  // family (parked OFF by default; App threads
  // `MODQN_SERVICE_ALLOCATION_PRODUCER_READY` OR the `?modqnServiceAllocation=1`
  // override). Consumed only by the `modqn-live-cell-preview` lane render plan.
  modqnServiceAllocationEnabled?: boolean;
}

export interface LinkBudgetTerms {
  signalDbm: number;
  intraInterferenceDbm: number;
  interInterferenceDbm: number;
  noiseDbm: number;
  denominatorDbm: number;
  txPowerDbm: number;
  pathLossDb: number;
  beamGainDb: number;
  steeringLossDb: number;
  receiverGainDbi: number;
}

export type SignalTruthStatus = 'live' | 'latched' | 'recent-ho' | 'derived' | 'none';

export interface SignalSourceState {
  satId: string | null;
  beamId: number | null;
  sinrDb: number | null;
  elevationDeg: number | null;
  rangeKm: number | null;
  status: SignalTruthStatus;
}

export interface PanelPrimaryState extends SignalSourceState {
  role: 'serving' | 'ho-source' | 'none';
}

export interface PanelComparisonState extends SignalSourceState {
  role: 'pending' | 'candidate' | 'ho-target' | 'none';
}

/**
 * Display-only evidence for the explicit same-satellite intra teaching story.
 * The candidate is measured by the cell model at the primary UE position, but
 * this snapshot never participates in serving selection or handover timing.
 */
export interface IntraHandoverPresentation {
  readonly ueId: string;
  readonly sourceSatId: string;
  readonly sourceCellId: number;
  readonly targetCellId: number;
  readonly servingSinrDb: number;
  readonly candidateSinrDb: number;
  /** Candidate minus serving, in dB. */
  readonly deltaSinrDb: number;
  /** Same-frame angle-aware EE for the source link, when published. */
  readonly servingEnergyEfficiencyBitsPerJoule?: number | null;
  /** Same-frame angle-aware EE for the selected alternate link, when published. */
  readonly candidateEnergyEfficiencyBitsPerJoule?: number | null;
  /** Explains whether this display pair is backed by the active EE authority. */
  readonly eeDecisionBasis?: 'instantaneous-ee-max' | 'sinr-compatibility-fallback' | 'unavailable';
  readonly elevationDeg: number | null;
  readonly rangeKm: number | null;
}

export type VisualFrequencyDiagnosticsSource =
  | BeamFrequencyIndexResolution['frequencyIndexSource']
  | 'not-visible';

export interface VisualFrequencyDiagnosticsEntry {
  satId: string | null;
  beamId: number | null;
  frequencyIndex: number | null;
  frequencyIndexSource: VisualFrequencyDiagnosticsSource;
  runtimeFrequencyReuse: number | null;
  coreLayoutFrequencyReuse: number | null;
}

export interface VisualFrequencyDiagnosticsState {
  primary: VisualFrequencyDiagnosticsEntry;
  comparison: VisualFrequencyDiagnosticsEntry;
}

export interface IntraHandoverEvent {
  satId: string;
  fromBeamId: number;
  toBeamId: number;
  triggeredAtSec: number;
  expiresAtSec: number;
}

export interface IntraHandoverEventWithWallClock extends IntraHandoverEvent {
  wallClockStartMs: number;
  wallClockExpiresMs: number;
}

export interface InterHandoverEvent {
  fromSatId: string;
  fromBeamId: number;
  toSatId: string;
  toBeamId: number;
  triggeredAtSec: number;
  expiresAtSec: number;
}

export interface InterHandoverEventWithWallClock extends InterHandoverEvent {
  wallClockStartMs: number;
  wallClockExpiresMs: number;
}

export interface VizIntraHandoverEvent extends IntraHandoverEventWithWallClock {
  fromGroundX: number;
  fromGroundZ: number;
  toGroundX: number;
  toGroundZ: number;
}

export interface SimState {
  profileId?: string;
  /**
   * The UE every panel-facing surface follows this frame (see
   * SinrLiveCellFrame.primaryUeId). Republished here so the Director's handover
   * rail can filter its event index to the FOCUSED UE instead of the hardcoded
   * `live-ue-0`, which is what pinned Show Intra / Show Inter to cell 0.
   */
  primaryUeId?: string | null;
  formulaFamilyLabel?: string;
  satelliteVisualIdentityById: Record<string, SatelliteVisualIdentity>;
  perUePositions?: ReadonlyArray<{
    id: string;
    servingSatId: string | null;
    /**
     * Steered serving beam id (steered lanes only). On the sinr-live cell lane
     * this is ALWAYS null — there is no steered beam under the cell model; the
     * serving unit is the typed `servingCellId` (S4-2 pun retirement).
     */
    servingBeamId: number | null;
    /**
     * Earth-fixed cell id serving this UE (sinr-live cell truth only; null on
     * steered lanes). Typed S4-2 replacement for the retired
     * `servingBeamId := cellId` pun.
     */
    servingCellId: number | null;
    sinrDb: number | null;
  }>;
  modqnCellServiceReadout?: ModqnCellServiceReadout;
  /**
   * Live cell-truth paper-style EE. This is intentionally separate from the
   * R1 reward-surface link metric: it prices each live (sat, earth-fixed-cell)
   * group with the profile's load-dependent (3.37) power surface.
   */
  livePaperEnergyEfficiency?: PaperEnergyEfficiency | null;
  /**
   * Temporary Ch5-aligned display projection. It reuses the same live U/γ/cell
   * truth but substitutes the profile-backed full-500-MHz comparison point;
   * it never drives serving, SINR, or scene geometry.
   */
  ch5DemoPaperEnergyEfficiency?: PaperEnergyEfficiency | null;
  /** Live ADR-003 projection; absent on producer-backed replay lanes. */
  canonicalEe?: CanonicalEeSnapshot | null;
  /** Homepage-only per-beam live metric projection; absent on every other route. */
  homepageBeamMetrics?: HomepageBeamMetricsProjection | null;
  /** Active C1-C9 selected-link frame shared by the legacy UI surfaces. */
  angleAwareFormulaFrame?: AngleAwareFormulaFrame | null;
  /**
   * Immutable multi-candidate decision frame for the primary UE. Optional
   * until the sinr-live authority transaction is enabled; consumers must not
   * synthesize a second decision from legacy scalar comparison fields.
   */
  handoverDecisionFrame?: HandoverDecisionFrame | null;
  /**
   * One immutable presentation publication shared by the central scene and
   * right rail. Consumers must not rebuild a candidate plan from the legacy
   * handoverDecisionFrame field.
   */
  acceptedHandoverPresentation?: AcceptedHandoverPresentationSnapshot | null;
  physicalServing: SignalSourceState;
  panelPrimary: PanelPrimaryState;
  panelComparison: PanelComparisonState;
  /** Same-satellite candidate snapshot used only by the explicit intra story. */
  intraHandoverPresentation?: IntraHandoverPresentation | null;
  visualFrequencyDiagnostics?: VisualFrequencyDiagnosticsState;
  /** Backward-compatible right-panel primary fields; prefer the explicit contract fields above. */
  servingSatId: string | null;
  servingBeamId: number | null;
  /**
   * Earth-fixed cell id serving the PRIMARY UE on the sinr-live cell lane (S5-2b);
   * null on steered/MODQN lanes (no cell model). The typed cell unit the InfoPanel
   * shows when `servingBeamId` is null — the top-level analogue of the per-UE
   * `servingCellId` (S4-2 pun retirement). The ACTIVE SERVING label sat is the
   * cell-truth primary serving sat, matching the cones (no steered divergence).
   */
  servingCellId: number | null;
  servingElevationDeg: number | null;
  servingRangeKm: number | null;
  pendingTargetSatId: string | null;
  pendingTargetBeamId: number | null;
  pendingTargetSinrDb: number | null;
  comparisonSatId: string | null;
  comparisonBeamId: number | null;
  comparisonElevationDeg: number | null;
  comparisonRangeKm: number | null;
  comparisonSinrDb: number | null;
  comparisonKind: 'pending' | 'candidate' | 'recent-ho' | null;
  sinrDeltaDb: number | null;
  recentHoSourceSatId: string | null;
  recentHoTargetSatId: string | null;
  recentHoSourceBeamId: number | null;
  recentHoTargetBeamId: number | null;
  recentHoDeltaDb: number | null;
  lastHoEvent: HandoverEvent | null;
  simTimeSec: number;
  sinrDb: number;
  physicalServingBudget: LinkBudgetTerms | null;
  servingBudget: LinkBudgetTerms | null;
  handoverOffsetDb: number;
  handoverTriggerProgressSec: number;
  handoverTriggerSec: number;
  hoCount: number;
  intraHoCount: number;
  lastHoReason: string;
  beamHopEnabled: boolean;
  beamHopSlotIndex: number;
  beamHopSlotSec: number;
  /** Display-only active beam counts from the SINR-live cell frame. */
  beamDisplayServingActiveCount?: number;
  beamDisplayCandidateActiveCount?: number;
  servingBeamActiveThisSlot: boolean | null;
  servingSatActiveBeamIds: number[];
  pendingTargetActiveBeamIds: number[];
  intraHandoverEvent?: IntraHandoverEventWithWallClock | null;
}

export interface VisibleSat {
  id: string;
  shellId: string;
  altitudeKm: number;
  world: THREE.Vector3;
  topo: TopocentricPoint;
  latDeg: number;
  lonDeg: number;
  satelliteTintColor?: string;
  satelliteGlyph?: GlyphKind;
  satelliteVisualIndex?: number;
}

export interface SatelliteVisualIdentity {
  satelliteTintColor: string;
  satelliteGlyph: GlyphKind;
  satelliteVisualIndex: number;
}

export interface BeamCellState {
  beamId: number;
  offsetEastKm: number;
  offsetNorthKm: number;
  scanAngleDeg: number;
  coreLayoutSatId?: string;
  coreBeamId?: string;
  coreLocalBeamIndex?: number;
  reuseGroup?: number;
  runtimeFrequencyReuse?: number;
  coreLayoutFrequencyReuse?: CoreLayoutFrequencyReuse;
  reuseGroupSource?: ReuseGroupSource;
}

export interface SatBeamHopState {
  satId: string;
  slotIndex: number;
  frameSlotIndex: number;
  activeBeamIds: number[];
  candidateBeamIds: number[];
}

export interface SimFrame {
  satellites: VisibleSat[];
  linkSamples: LinkSample[];
  activeAssignments: ActiveBeamAssignment[];
  displayAssignments: ActiveBeamAssignment[];
  beamCellsBySatId: Map<string, BeamCellState[]>;
  steeringBeamCellsBySatId: Map<string, BeamCellState[]>;
  linkRangeKmBySatId: Map<string, number>;
  beamHopSlotIndex: number;
  beamHopSlotStartSec: number;
  beamHopSlotSec: number;
  beamHopEnabled: boolean;
  beamHopStatesBySatId: Map<string, SatBeamHopState>;
  serving: { satId: string | null; beamId: number | null; sinrDb: number };
  pendingTargetSatId: string | null;
  pendingTargetBeamId: number | null;
  pendingTargetSinrDb: number | null;
  recentHoSourceBeamId: number | null;
  recentHoTargetBeamId: number | null;
  recentHoSourceSinrDb: number | null;
  recentHoTargetSinrDb: number | null;
  recentHoDeltaDb: number | null;
  lastHoEvent: HandoverEvent | null;
  handoverTriggerProgressSec: number;
  hoCount: number;
  intraHoCount: number;
  lastHoReason: string;
  simTimeSec: number;
  recentHoSourceSatId: string | null;
  recentHoTargetSatId: string | null;
  intraHandoverEvent: IntraHandoverEvent | null;
  intraHandoverPreview: IntraSwitchPreview | null;
  intraHandoverWallClockStartMs: number | null;
  intraHandoverWallClockExpiresMs: number | null;
  interHandoverEvent: InterHandoverEvent | null;
  interHandoverWallClockStartMs: number | null;
  interHandoverWallClockExpiresMs: number | null;
  ueGroundX: number;
  ueGroundZ: number;
  perUePositions: ReadonlyArray<{
    id: string;
    groundX: number;
    groundZ: number;
    eastKm: number;
    northKm: number;
    sinrDb: number | null;
    servingSatId: string | null;
    servingBeamId: number | null;
    pendingTargetSatId: string | null;
    pendingTargetBeamId: number | null;
    triggerProgressSec: number;
  }>;
  /**
   * S-cells-2 (ADDITIVE): earth-fixed cell truth for the SINR-live lane only.
   * Populated by `attachSinrLiveCellFrame` (src/scene/sinrLiveCellRuntime.ts)
   * after `stepRuntimeFrame` when the `useEarthFixedCellTruth` gate is on
   * (sceneLane === 'sinr-live'); `undefined` on the other three lanes. Render
   * does NOT read it until S-cells-3 — see the SDD/governance lane lock.
   */
  sinrLiveCells?: SinrLiveCellFrame;
  /**
   * The sole canonical primary-UE handover decision for scene and publisher
   * joins. The nested cell frame deliberately does not carry a second copy.
   */
  handoverDecisionFrame?: HandoverDecisionFrame | null;
  /** Angle-aware frame for non-cell lanes; the live cell lane owns its nested frame. */
  angleAwareFormulaFrame?: AngleAwareFormulaFrame | null;
}

export type EventRole = BeamCodeRole;

export interface SinrLabel {
  position: THREE.Vector3;
  sinrDb: number;
  isServing: boolean;
}

export interface AmbientRing extends BeamFrequencyIndexResolution {
  satelliteId: string;
  beamId: number;
  groundX: number;
  groundZ: number;
  footprintRadiusKm: number;
}

export interface VizFrame {
  displaySats: VisibleSat[];
  /**
   * S5-2 cone-apex map: EVERY satellite's projected render-world position (all
   * shells, BEFORE the top-12 `displaySats` slice), keyed by satId. The sinr-live
   * cell-cone render uses this as the cone APEX source so a cell-serving sat
   * beyond the top-12 display cap still gets a cone — the connected-sat-has-beam
   * must-hold (display cap applied at DRAW, never at TRUTH; consolidation S5).
   * `displaySats` stays the top-12 slice, so satellite tint / cell schedule /
   * markers / MODQN-lane cones are unchanged (no geometry-trace churn).
   *
   * NOT separately captured by validate:s0:geometry-trace (its serialiser snapshots
   * `displaySats`, not this map) — intentionally exempt: each entry is the SAME
   * `s.world` projection as `displaySats` (a superset of the same projected
   * `satellites`, before the cap slice), so its correctness is co-proven by the
   * trace's `displaySats` / `truth.satellites` coverage PLUS the cone render gates
   * (validate:phase-c:sinr-live-cells:render cone-base==truth-cell-centre + the
   * connected-sat-has-beam must-hold over the real cone set). A projection bug here
   * would also corrupt `displaySats` (trace-caught) or drop a serving sat's cone
   * (must-hold-caught).
   */
  coneApexWorldById: Map<string, { x: number; y: number; z: number }>;
  eventSatIds: Set<string>;
  eventRoles: Map<string, EventRole>;
  beamSatIds: Set<string>;
  satBeams: Map<string, VisualBeamTarget[]>;
  ambientRings: AmbientRing[];
  visualFrequencyByBeamKey: Map<string, BeamFrequencyIndexResolution>;
  sinrLabels: SinrLabel[];
  footprintRadiusWorld: number;
  intraHandoverEvent: VizIntraHandoverEvent | null;
}
