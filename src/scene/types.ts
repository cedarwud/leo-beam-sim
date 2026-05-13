import * as THREE from 'three';
import type { BeamCodeRole } from '../constants/beamRoleTokens';
import type { TopocentricPoint } from '../engine/orbit';
import type { ActiveBeamAssignment, LinkSample } from '../engine/signal/types';
import type { BeamTarget } from '../viz/SatelliteBeams';
import type { GlyphKind } from '../viz/glyphs';
import type { BeamFrequencyIndexResolution } from '../utils/beamFrequency';
import type { CoreLayoutFrequencyReuse, ReuseGroupSource } from './beam-layout';

export type PresentationMode = 'research-default' | 'candidate-rich' | 'demo-readability';
export type BeamDensity = 'event-only' | 'event-plus-1' | 'all';
export type CinematicMode = 'off' | 'spotlight';
export type CameraPreset = 'zenith' | 'oblique' | 'chase';

export interface ReplayConfig {
  epochUtcMs: number;
  startOffsetSec: number;
  loop: boolean;
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

export interface RuntimeConfig {
  presentationMode: PresentationMode;
  replay: ReplayConfig;
  signalResetKey?: string;
  handoverResetKey?: string;
  beamDensity: BeamDensity;
  effectsEnabled: RuntimeEffectsEnabled;
  cinematicMode: CinematicMode;
  cameraCommand?: RuntimeCameraCommand;
  reducedMotion: boolean;
  viewport: RuntimeViewport;
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

export interface SimState {
  profileId?: string;
  formulaFamilyLabel?: string;
  satelliteVisualIdentityById: Record<string, SatelliteVisualIdentity>;
  physicalServing: SignalSourceState;
  panelPrimary: PanelPrimaryState;
  panelComparison: PanelComparisonState;
  visualFrequencyDiagnostics?: VisualFrequencyDiagnosticsState;
  /** Backward-compatible right-panel primary fields; prefer the explicit contract fields above. */
  servingSatId: string | null;
  servingBeamId: number | null;
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
  sinrDb: number;
  physicalServingBudget: LinkBudgetTerms | null;
  servingBudget: LinkBudgetTerms | null;
  handoverOffsetDb: number;
  handoverTriggerProgressSec: number;
  handoverTriggerSec: number;
  hoCount: number;
  lastHoReason: string;
  beamHopEnabled: boolean;
  beamHopSlotIndex: number;
  beamHopSlotSec: number;
  servingBeamActiveThisSlot: boolean | null;
  servingSatActiveBeamIds: number[];
  pendingTargetActiveBeamIds: number[];
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
  handoverTriggerProgressSec: number;
  hoCount: number;
  lastHoReason: string;
  simTimeSec: number;
  recentHoSourceSatId: string | null;
  recentHoTargetSatId: string | null;
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

export type VisualBeamTarget = BeamTarget & BeamFrequencyIndexResolution;

export interface VizFrame {
  displaySats: VisibleSat[];
  eventSatIds: Set<string>;
  eventRoles: Map<string, EventRole>;
  beamSatIds: Set<string>;
  satBeams: Map<string, VisualBeamTarget[]>;
  ambientRings: AmbientRing[];
  visualFrequencyByBeamKey: Map<string, BeamFrequencyIndexResolution>;
  sinrLabels: SinrLabel[];
  footprintRadiusWorld: number;
}
