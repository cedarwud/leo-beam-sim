import * as THREE from 'three';
import type { BeamCodeRole } from '../constants/beamRoleTokens';
import type { TopocentricPoint } from '../engine/orbit';
import type { ActiveBeamAssignment, LinkSample } from '../engine/signal/types';
import type { BeamTarget } from '../viz/SatelliteBeams';

export type PresentationMode = 'research-default' | 'candidate-rich' | 'demo-readability';

export interface ReplayConfig {
  epochUtcMs: number;
  startOffsetSec: number;
  loop: boolean;
}

export interface RuntimeConfig {
  presentationMode: PresentationMode;
  replay: ReplayConfig;
  signalResetKey?: string;
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

export interface SimState {
  profileId?: string;
  formulaFamilyLabel?: string;
  physicalServing: SignalSourceState;
  panelPrimary: PanelPrimaryState;
  panelComparison: PanelComparisonState;
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
}

export interface BeamCellState {
  beamId: number;
  offsetEastKm: number;
  offsetNorthKm: number;
  scanAngleDeg: number;
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

export interface VizFrame {
  displaySats: VisibleSat[];
  eventSatIds: Set<string>;
  eventRoles: Map<string, EventRole>;
  beamSatIds: Set<string>;
  satBeams: Map<string, BeamTarget[]>;
  sinrLabels: SinrLabel[];
  footprintRadiusWorld: number;
}
