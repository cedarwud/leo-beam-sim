import type { UePosition } from './multiUeState';

export type UeMobilityMode = 'static' | 'random-walk' | 'waypoints' | 'manhattan';

export interface UeMobilityParams {
  speedKmPerSec: number;
  waypointCount: number;
  manhattanGridSpacingKm: number;
}

export interface UeMobilityWaypoint {
  eastRatio: number;
  northRatio: number;
}

export type ManhattanHeading = 'east' | 'west' | 'north' | 'south';

export interface UePerMobilityState {
  ueIndex: number;
  rngState: number;
  lastDirectionRad: number;
  waypointIndex: number;
  waypoints: readonly UeMobilityWaypoint[];
  manhattanHeading: ManhattanHeading;
  manhattanInitialized: boolean;
  currentPosition: UePosition | null;
  originEastKm?: number;
  originNorthKm?: number;
  ueWorldScale?: number;
}

export const DEFAULT_UE_MOBILITY_PARAMS: UeMobilityParams = {
  speedKmPerSec: 5,
  waypointCount: 4,
  manhattanGridSpacingKm: 5,
};

const TWO_PI = 2 * Math.PI;
const PRIMARY_UE_ID = 'live-ue-0';

function nextMulberry32(state: number): { value: number; state: number } {
  const nextState = (state + 0x6D2B79F5) >>> 0;
  let t = nextState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return {
    value: ((t ^ (t >>> 14)) >>> 0) / 4294967296,
    state: nextState,
  };
}

function seededState(seed: number, index: number): number {
  return (seed + Math.imul(index + 1, 0x9E3779B9)) >>> 0;
}

function buildPosition(
  current: UePosition,
  eastKm: number,
  northKm: number,
  state: UePerMobilityState,
): UePosition {
  const worldScale = state.ueWorldScale ?? resolveWorldScale(current);
  return {
    ...current,
    eastKm,
    northKm,
    groundX: eastKm * worldScale,
    groundZ: -northKm * worldScale,
  };
}

function resolveWorldScale(position: UePosition): number {
  if (Math.abs(position.eastKm) > 1e-9) {
    return position.groundX / position.eastKm;
  }
  if (Math.abs(position.northKm) > 1e-9) {
    return -position.groundZ / position.northKm;
  }
  return 1;
}

function clampToFootprint(
  eastKm: number,
  northKm: number,
  state: UePerMobilityState,
  footprintRadiusKm: number,
): { eastKm: number; northKm: number } {
  const radiusKm = Math.max(0, footprintRadiusKm);
  const originEastKm = state.originEastKm ?? 0;
  const originNorthKm = state.originNorthKm ?? 0;
  const dEastKm = eastKm - originEastKm;
  const dNorthKm = northKm - originNorthKm;
  const distanceKm = Math.hypot(dEastKm, dNorthKm);
  if (radiusKm === 0 || distanceKm <= radiusKm + 1e-9) {
    return { eastKm, northKm };
  }
  const scale = radiusKm / Math.max(distanceKm, 1e-9);
  return {
    eastKm: originEastKm + dEastKm * scale,
    northKm: originNorthKm + dNorthKm * scale,
  };
}

function waypointFromRng(rngState: number): { waypoint: UeMobilityWaypoint; rngState: number } {
  const radial = nextMulberry32(rngState);
  const angular = nextMulberry32(radial.state);
  const r = Math.sqrt(radial.value);
  const theta = angular.value * TWO_PI;
  return {
    waypoint: {
      eastRatio: r * Math.cos(theta),
      northRatio: r * Math.sin(theta),
    },
    rngState: angular.state,
  };
}

function createWaypoints(count: number, rngState: number): { waypoints: UeMobilityWaypoint[]; rngState: number } {
  const waypointCount = Math.max(1, Math.trunc(count));
  const waypoints: UeMobilityWaypoint[] = [];
  let nextState = rngState;
  for (let i = 0; i < waypointCount; i += 1) {
    const result = waypointFromRng(nextState);
    waypoints.push(result.waypoint);
    nextState = result.rngState;
  }
  return { waypoints, rngState: nextState };
}

function headingFromValue(value: number): ManhattanHeading {
  const bucket = Math.min(3, Math.floor(value * 4));
  return bucket === 0 ? 'east' : bucket === 1 ? 'west' : bucket === 2 ? 'north' : 'south';
}

function headingVector(heading: ManhattanHeading): { east: number; north: number } {
  switch (heading) {
    case 'east':
      return { east: 1, north: 0 };
    case 'west':
      return { east: -1, north: 0 };
    case 'north':
      return { east: 0, north: 1 };
    case 'south':
      return { east: 0, north: -1 };
  }
}

function reverseHeading(heading: ManhattanHeading): ManhattanHeading {
  switch (heading) {
    case 'east':
      return 'west';
    case 'west':
      return 'east';
    case 'north':
      return 'south';
    case 'south':
      return 'north';
  }
}

export function createMobilityStates(
  ueCount: number,
  mode: UeMobilityMode,
  params: UeMobilityParams,
  seed: number,
): UePerMobilityState[] {
  const count = Math.max(1, Math.trunc(ueCount));
  return Array.from({ length: count }, (_, index) => {
    let rngState = seededState(seed, index);
    const direction = nextMulberry32(rngState);
    rngState = direction.state;
    const heading = nextMulberry32(rngState);
    rngState = heading.state;
    const waypoints = mode === 'waypoints'
      ? createWaypoints(params.waypointCount, rngState)
      : { waypoints: [] as UeMobilityWaypoint[], rngState };
    rngState = waypoints.rngState;
    return {
      ueIndex: index,
      rngState,
      lastDirectionRad: direction.value * TWO_PI,
      waypointIndex: 0,
      waypoints: waypoints.waypoints,
      manhattanHeading: headingFromValue(heading.value),
      manhattanInitialized: false,
      currentPosition: null,
    };
  });
}

function randomWalkStep(
  currentPosition: UePosition,
  state: UePerMobilityState,
  params: UeMobilityParams,
  deltaSec: number,
  footprintRadiusKm: number,
): { position: UePosition; state: UePerMobilityState } {
  const rng = nextMulberry32(state.rngState);
  const theta = rng.value * TWO_PI;
  const distanceKm = Math.max(0, params.speedKmPerSec) * Math.max(0, deltaSec);
  const eastStepKm = Math.cos(theta) * distanceKm;
  const northStepKm = Math.sin(theta) * distanceKm;
  let candidateEastKm = currentPosition.eastKm + eastStepKm;
  let candidateNorthKm = currentPosition.northKm + northStepKm;
  const originEastKm = state.originEastKm ?? 0;
  const originNorthKm = state.originNorthKm ?? 0;
  if (Math.hypot(candidateEastKm - originEastKm, candidateNorthKm - originNorthKm) > footprintRadiusKm + 1e-9) {
    candidateEastKm = currentPosition.eastKm - eastStepKm;
    candidateNorthKm = currentPosition.northKm - northStepKm;
  }
  const clamped = clampToFootprint(candidateEastKm, candidateNorthKm, state, footprintRadiusKm);
  const position = buildPosition(currentPosition, clamped.eastKm, clamped.northKm, state);
  return {
    position,
    state: { ...state, rngState: rng.state, lastDirectionRad: theta, currentPosition: position },
  };
}

function waypointStep(
  currentPosition: UePosition,
  state: UePerMobilityState,
  params: UeMobilityParams,
  deltaSec: number,
  footprintRadiusKm: number,
): { position: UePosition; state: UePerMobilityState } {
  const waypoints = state.waypoints.length > 0
    ? state.waypoints
    : createWaypoints(params.waypointCount, state.rngState).waypoints;
  const waypointIndex = Math.min(Math.max(0, state.waypointIndex), waypoints.length - 1);
  const target = waypoints[waypointIndex];
  const targetEastKm = (state.originEastKm ?? 0) + target.eastRatio * Math.max(0, footprintRadiusKm);
  const targetNorthKm = (state.originNorthKm ?? 0) + target.northRatio * Math.max(0, footprintRadiusKm);
  const dEastKm = targetEastKm - currentPosition.eastKm;
  const dNorthKm = targetNorthKm - currentPosition.northKm;
  const distanceToTargetKm = Math.hypot(dEastKm, dNorthKm);
  const stepDistanceKm = Math.max(0, params.speedKmPerSec) * Math.max(0, deltaSec);
  const arrived = distanceToTargetKm <= stepDistanceKm + 1e-9;
  const nextEastKm = arrived || distanceToTargetKm <= 1e-9
    ? targetEastKm
    : currentPosition.eastKm + (dEastKm / distanceToTargetKm) * stepDistanceKm;
  const nextNorthKm = arrived || distanceToTargetKm <= 1e-9
    ? targetNorthKm
    : currentPosition.northKm + (dNorthKm / distanceToTargetKm) * stepDistanceKm;
  const clamped = clampToFootprint(nextEastKm, nextNorthKm, state, footprintRadiusKm);
  const position = buildPosition(currentPosition, clamped.eastKm, clamped.northKm, state);
  return {
    position,
    state: {
      ...state,
      waypoints,
      waypointIndex: arrived ? (waypointIndex + 1) % waypoints.length : waypointIndex,
      currentPosition: position,
    },
  };
}

function manhattanStep(
  currentPosition: UePosition,
  state: UePerMobilityState,
  params: UeMobilityParams,
  deltaSec: number,
  footprintRadiusKm: number,
): { position: UePosition; state: UePerMobilityState } {
  const spacingKm = Math.max(1e-6, params.manhattanGridSpacingKm);
  const originEastKm = state.originEastKm ?? 0;
  const originNorthKm = state.originNorthKm ?? 0;
  const baseEastKm = state.manhattanInitialized
    ? currentPosition.eastKm
    : originEastKm + Math.round((currentPosition.eastKm - originEastKm) / spacingKm) * spacingKm;
  const baseNorthKm = state.manhattanInitialized
    ? currentPosition.northKm
    : originNorthKm + Math.round((currentPosition.northKm - originNorthKm) / spacingKm) * spacingKm;
  const distanceKm = Math.max(0, params.speedKmPerSec) * Math.max(0, deltaSec);
  const vector = headingVector(state.manhattanHeading);
  let candidateEastKm = baseEastKm + vector.east * distanceKm;
  let candidateNorthKm = baseNorthKm + vector.north * distanceKm;
  let rngState = state.rngState;
  let heading = state.manhattanHeading;
  const crossedIntersection = distanceKm >= spacingKm;
  if (crossedIntersection) {
    candidateEastKm = originEastKm + Math.round((candidateEastKm - originEastKm) / spacingKm) * spacingKm;
    candidateNorthKm = originNorthKm + Math.round((candidateNorthKm - originNorthKm) / spacingKm) * spacingKm;
    const headingRoll = nextMulberry32(rngState);
    rngState = headingRoll.state;
    heading = headingFromValue(headingRoll.value);
  }
  if (Math.hypot(candidateEastKm - originEastKm, candidateNorthKm - originNorthKm) > footprintRadiusKm + 1e-9) {
    heading = reverseHeading(heading);
    const reverse = headingVector(heading);
    candidateEastKm = baseEastKm + reverse.east * distanceKm;
    candidateNorthKm = baseNorthKm + reverse.north * distanceKm;
  }
  const clamped = clampToFootprint(candidateEastKm, candidateNorthKm, state, footprintRadiusKm);
  const position = buildPosition(currentPosition, clamped.eastKm, clamped.northKm, state);
  return {
    position,
    state: {
      ...state,
      rngState,
      manhattanHeading: heading,
      manhattanInitialized: true,
      currentPosition: position,
    },
  };
}

export function mobilityStep(
  currentPosition: UePosition,
  state: UePerMobilityState,
  mode: UeMobilityMode,
  params: UeMobilityParams,
  deltaSec: number,
  footprintRadiusKm: number,
): { position: UePosition; state: UePerMobilityState } {
  if (mode === 'static' || currentPosition.id === PRIMARY_UE_ID || state.ueIndex === 0) {
    return { position: currentPosition, state };
  }

  switch (mode) {
    case 'random-walk':
      return randomWalkStep(currentPosition, state, params, deltaSec, footprintRadiusKm);
    case 'waypoints':
      return waypointStep(currentPosition, state, params, deltaSec, footprintRadiusKm);
    case 'manhattan':
      return manhattanStep(currentPosition, state, params, deltaSec, footprintRadiusKm);
  }
}
