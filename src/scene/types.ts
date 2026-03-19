import * as THREE from 'three';
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
}

export interface SimState {
  servingSatId: string | null;
  servingBeamId: number | null;
  pendingTargetSatId: string | null;
  pendingTargetBeamId: number | null;
  pendingTargetSinrDb: number | null;
  comparisonSatId: string | null;
  comparisonBeamId: number | null;
  comparisonSinrDb: number | null;
  comparisonKind: 'pending' | 'candidate' | 'recent-ho' | null;
  sinrDeltaDb: number | null;
  recentHoSourceSatId: string | null;
  recentHoTargetSatId: string | null;
  sinrDb: number;
  handoverOffsetDb: number;
  handoverTriggerProgressSec: number;
  handoverTriggerSec: number;
  hoCount: number;
  lastHoReason: string;
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

export interface SimFrame {
  satellites: VisibleSat[];
  linkSamples: LinkSample[];
  activeAssignments: ActiveBeamAssignment[];
  displayAssignments: ActiveBeamAssignment[];
  beamCellsBySatId: Map<string, {
    beamId: number;
    offsetEastKm: number;
    offsetNorthKm: number;
    scanAngleDeg: number;
  }[]>;
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

export type EventRole = 'serving' | 'secondary' | 'prepared' | 'post-ho';

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
