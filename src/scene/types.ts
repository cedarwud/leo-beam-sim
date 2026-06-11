import * as THREE from 'three';
import type { BeamCodeRole } from '../constants/beamRoleTokens';
import type { TopocentricPoint } from '../engine/orbit';
import type { ActiveBeamAssignment, LinkSample } from '../engine/signal/types';
import type { HandoverEvent, IntraSwitchPreview } from '../engine/handover/types';
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

export type { BeamTarget, VisualBeamTarget } from './beamTargetTypes';

export type PresentationMode = 'research-default' | 'candidate-rich' | 'demo-readability';
export type BeamDensity = 'event-only' | 'event-plus-1' | 'all';
export type CinematicMode = 'off' | 'spotlight' | 'director';
export type DirectorFocusKind = 'intra' | 'inter';
export type DirectorFocusPhase = 'idle' | 'acquiring' | 'focused' | 'restoring';
export type CameraPreset = 'zenith' | 'oblique' | 'chase' | 'paper-faithful-closeup';
export type UeDistributionScope = 'beam-footprint' | 'service-area';

export interface ReplayConfig {
  epochUtcMs: number;
  startOffsetSec: number;
  loop: boolean;
  windowLengthSec?: number;
  seekTargetSec?: number;
  seekRequestKey?: string;
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

/**
 * Handover-cinema candidate-beam highlight command (S1). The two beams of the
 * focused live-walker handover the cinema is framing; drives the lane-owned
 * `CandidateBeamHighlight` scene layer (gated by the render plan, sinr-live
 * only). It carries geometry-only beam identity — never SINR/decision truth —
 * so it stays display-only (governance Rule#6).
 */
export interface RuntimeCandidateHighlightCommand {
  eventId?: string;
  sourceOwner?: 'live-walker' | 'sinr-live-cell-truth';
  sourceTimeSec?: number;
  kind: DirectorFocusKind;
  fromSatId: string;
  /** Steered beam id; null on cell-truth events (cell ids are the identity there, S4-2). */
  fromBeamId: number | null;
  toSatId: string;
  toBeamId: number | null;
  ueId?: string | null;
  fromCellId?: number | null;
  toCellId?: number | null;
  fromFrequencyIndex?: number | null;
  toFrequencyIndex?: number | null;
  fromOffAxisDeg?: number | null;
  toOffAxisDeg?: number | null;
}

export interface RuntimeConfig {
  appMode: AppExperienceMode;
  presentationMode: PresentationMode;
  replay: ReplayConfig;
  signalResetKey?: string;
  handoverResetKey?: string;
  beamDensity: BeamDensity;
  beamCalloutsEnabled?: boolean;
  effectsEnabled: RuntimeEffectsEnabled;
  cinematicMode: CinematicMode;
  cameraCommand?: RuntimeCameraCommand;
  directorFocusCommand?: RuntimeDirectorFocusCommand;
  candidateHighlight?: RuntimeCandidateHighlightCommand | null;
  reducedMotion: boolean;
  viewport: RuntimeViewport;
  ueCount?: number;
  cellServingCount?: number;
  ueDistributionMode?: UeDistributionMode;
  uePrimaryAnchorMode?: UePrimaryAnchorMode;
  ueDistributionScope?: UeDistributionScope;
  ueDistributionRadiusKm?: number;
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
  physicalServing: SignalSourceState;
  panelPrimary: PanelPrimaryState;
  panelComparison: PanelComparisonState;
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
