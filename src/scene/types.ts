import * as THREE from 'three';
import type { TopocentricPoint } from '../engine/orbit';
import type { LinkSample } from '../engine/signal/types';
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
  sinrDb: number;
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
  serving: { satId: string | null; beamId: number | null; sinrDb: number };
  hoCount: number;
  lastHoReason: string;
  simTimeSec: number;
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
