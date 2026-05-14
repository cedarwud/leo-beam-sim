import * as THREE from 'three';
import type { TopocentricPoint } from '../engine/orbit';
import type { LinkSample } from '../engine/signal/types';
import type { BeamPowerControlState } from '../engine/signal/power-control';
import type { CoreSceneBeamOffsetKm } from './beam-layout';
import type { CandidateBeamCell } from './beam-scheduler';
import type { BeamCellState, SimFrame } from './types';

export interface ShellBeamLayout {
  footprintRadiusKm: number;
  beamDiameterKm: number;
  beamCount: number;
  frequencyReuse: number;
  maxOffsetRadiusKm: number;
  maxSteeringDistanceKm: number;
  maxCoverageRadiusKm: number;
}

export interface CachedSatState {
  id: string;
  shellId: string;
  altitudeKm: number;
  latDeg: number;
  lonDeg: number;
  ecefKm: [number, number, number];
  elevationDeg: number;
  azimuthDeg: number;
  rangeKm: number;
}

interface LatticeSteeringSolution {
  steeringEastKm: number;
  steeringNorthKm: number;
}

export interface BeamPowerControlRuntime {
  statesByKey: Map<string, BeamPowerControlState>;
  lastBucketIndex: number | null;
  lastBucketSamples: LinkSample[];
}

export function createEmptyBeamPowerControlRuntime(): BeamPowerControlRuntime {
  return {
    statesByKey: new Map(),
    lastBucketIndex: null,
    lastBucketSamples: [],
  };
}

export function createEmptyFrame(simTimeSec: number): SimFrame {
  return {
    satellites: [],
    linkSamples: [],
    activeAssignments: [],
    displayAssignments: [],
    beamCellsBySatId: new Map(),
    steeringBeamCellsBySatId: new Map(),
    linkRangeKmBySatId: new Map(),
    beamHopSlotIndex: -1,
    beamHopSlotStartSec: 0,
    beamHopSlotSec: 0,
    beamHopEnabled: false,
    beamHopStatesBySatId: new Map(),
    serving: { satId: null, beamId: null, sinrDb: -Infinity },
    pendingTargetSatId: null,
    pendingTargetBeamId: null,
    pendingTargetSinrDb: null,
    recentHoSourceBeamId: null,
    recentHoTargetBeamId: null,
    recentHoSourceSinrDb: null,
    recentHoTargetSinrDb: null,
    recentHoDeltaDb: null,
    handoverTriggerProgressSec: 0,
    hoCount: 0,
    lastHoReason: '',
    simTimeSec,
    recentHoSourceSatId: null,
    recentHoTargetSatId: null,
  };
}

export function normalizeReplayOffset(
  startOffsetSec: number,
  maxTimeSec: number,
  loop: boolean,
): number {
  if (maxTimeSec <= 0) return 0;
  if (!loop) return Math.min(Math.max(startOffsetSec, 0), maxTimeSec);
  const wrapped = startOffsetSec % maxTimeSec;
  return wrapped >= 0 ? wrapped : wrapped + maxTimeSec;
}

export function interpolateAngleDeg(a: number, b: number, t: number): number {
  let delta = b - a;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return a + delta * t;
}

export function createWorldPosition(
  azimuthDeg: number,
  elevationDeg: number,
  horizontalRadius: number,
  verticalRadius: number,
): THREE.Vector3 {
  const azRad = (azimuthDeg * Math.PI) / 180;
  const elRad = (elevationDeg * Math.PI) / 180;
  const horiz = horizontalRadius * Math.cos(elRad);

  return new THREE.Vector3(
    horiz * Math.sin(azRad),
    verticalRadius * Math.sin(elRad),
    -horiz * Math.cos(azRad),
  );
}

export function createInterpolatedTopo(
  azimuthDeg: number,
  elevationDeg: number,
  rangeKm: number,
): TopocentricPoint {
  const azRad = (azimuthDeg * Math.PI) / 180;
  const elRad = (elevationDeg * Math.PI) / 180;
  const cosEl = Math.cos(elRad);

  return {
    eastKm: rangeKm * cosEl * Math.sin(azRad),
    northKm: rangeKm * cosEl * Math.cos(azRad),
    upKm: rangeKm * Math.sin(elRad),
    rangeKm,
    azimuthDeg,
    elevationDeg,
  };
}

export function beamAssignmentKey(satId: string, beamId: number): string {
  return `${satId}:${beamId}`;
}

export function toBeamCellState(beam: CandidateBeamCell): BeamCellState {
  return {
    beamId: beam.beamId,
    offsetEastKm: beam.offsetEastKm,
    offsetNorthKm: beam.offsetNorthKm,
    scanAngleDeg: beam.scanAngleDeg,
    coreLayoutSatId: beam.coreLayoutSatId,
    coreBeamId: beam.coreBeamId,
    coreLocalBeamIndex: beam.coreLocalBeamIndex,
    reuseGroup: beam.reuseGroup,
    runtimeFrequencyReuse: beam.runtimeFrequencyReuse,
    coreLayoutFrequencyReuse: beam.coreLayoutFrequencyReuse,
    reuseGroupSource: beam.reuseGroupSource,
  };
}

export function resolveLatticeSteering(
  nadirEastKm: number,
  nadirNorthKm: number,
  layout: ShellBeamLayout,
  offsets: readonly CoreSceneBeamOffsetKm[],
): LatticeSteeringSolution {
  let bestTargetEastKm = -nadirEastKm;
  let bestTargetNorthKm = -nadirNorthKm;
  let bestTargetDistanceKm = Math.hypot(bestTargetEastKm, bestTargetNorthKm);

  for (const beam of offsets) {
    const targetEastKm = -(nadirEastKm + beam.dEastKm);
    const targetNorthKm = -(nadirNorthKm + beam.dNorthKm);
    const targetDistanceKm = Math.hypot(targetEastKm, targetNorthKm);

    if (targetDistanceKm < bestTargetDistanceKm) {
      bestTargetEastKm = targetEastKm;
      bestTargetNorthKm = targetNorthKm;
      bestTargetDistanceKm = targetDistanceKm;
    }
  }

  if (bestTargetDistanceKm <= 1e-6) {
    return { steeringEastKm: 0, steeringNorthKm: 0 };
  }

  const steeringScale = Math.min(layout.maxSteeringDistanceKm, bestTargetDistanceKm) / bestTargetDistanceKm;
  return {
    steeringEastKm: bestTargetEastKm * steeringScale,
    steeringNorthKm: bestTargetNorthKm * steeringScale,
  };
}
