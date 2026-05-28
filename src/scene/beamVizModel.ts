import type { EventRole, PresentationMode, RuntimeViewport, VisibleSat, VisualBeamTarget } from './types';
import type { BeamFrequencyIndexResolution } from '../utils/beamFrequency';
import { resolveBeamFrequencyIndex } from '../utils/beamFrequency';
import type { BeamCellViz } from './beamApproachPreview';
import { beamDistanceToUeKm } from './beamApproachPreview';

export const DEFAULT_MAX_DISPLAY_SATS = 12;
export const DEFAULT_MAX_EVENT_SATS = 8;
export const DEFAULT_MAX_BEAM_SATS = 3;
export const MAX_DISPLAY_SATS_UPPER_BOUND = 32;
export const MAX_EVENT_SATS_UPPER_BOUND = 32;
export const MAX_BEAM_SATS_UPPER_BOUND = 16;

const CENTRAL_CORE_RADIUS_WORLD = 180;
const CENTRAL_FOCUS_RADIUS_WORLD = 500;
const MIN_CENTER_ELEVATION_DEG = 45;
const EVENT_ONLY_CALLOUT_CAP = 4;
const EVENT_PLUS_ONE_DESKTOP_CALLOUT_CAP = 6;
const EVENT_PLUS_ONE_COMPACT_CALLOUT_CAP = 4;
const EVENT_PLUS_ONE_DESKTOP_MIN_WIDTH = 1440;

/**
 * Runtime-tunable display caps. `undefined` fields fall back to the live
 * defaults. Each value is clamped to its perf-tested upper bound; a
 * `console.warn` fires if the caller exceeds the bound.
 */
export interface BeamVizDisplayCaps {
  readonly maxDisplaySats?: number;
  readonly maxEventSats?: number;
  readonly maxBeamSats?: number;
}

export interface ResolvedBeamVizDisplayCaps {
  readonly maxDisplaySats: number;
  readonly maxEventSats: number;
  readonly maxBeamSats: number;
}

export interface ConeBeamEntry {
  key: string;
  satelliteId: string;
  beam: VisualBeamTarget;
  order: number;
}

export type VisibleSatWithIdentity = VisibleSat & Required<
  Pick<VisibleSat, 'satelliteTintColor' | 'satelliteGlyph' | 'satelliteVisualIndex'>
>;

export interface RelevantSatIds {
  readonly servingSatId: string | null;
  readonly servingBeamId: number | null;
  readonly pendingTargetSatId: string | null;
  readonly pendingTargetBeamId: number | null;
  readonly recentHoSourceSatId: string | null;
  readonly recentHoSourceBeamId: number | null;
  readonly recentHoTargetSatId: string | null;
  readonly recentHoTargetBeamId: number | null;
}

function clampCap(name: string, requested: number | undefined, fallback: number, upperBound: number): number {
  if (requested === undefined) return fallback;
  if (!Number.isFinite(requested) || requested < 1) return fallback;
  if (requested > upperBound) {
    // eslint-disable-next-line no-console
    console.warn(
      `[useBeamViz] ${name}=${requested} exceeds tested upper bound ${upperBound}; ` +
        `clamping. Higher values may degrade FPS (O(N²) loops).`,
    );
    return upperBound;
  }
  return Math.floor(requested);
}

export function resolveBeamVizDisplayCaps(displayCaps?: BeamVizDisplayCaps): ResolvedBeamVizDisplayCaps {
  return {
    maxDisplaySats: clampCap(
      'maxDisplaySats',
      displayCaps?.maxDisplaySats,
      DEFAULT_MAX_DISPLAY_SATS,
      MAX_DISPLAY_SATS_UPPER_BOUND,
    ),
    maxEventSats: clampCap(
      'maxEventSats',
      displayCaps?.maxEventSats,
      DEFAULT_MAX_EVENT_SATS,
      MAX_EVENT_SATS_UPPER_BOUND,
    ),
    maxBeamSats: clampCap(
      'maxBeamSats',
      displayCaps?.maxBeamSats,
      DEFAULT_MAX_BEAM_SATS,
      MAX_BEAM_SATS_UPPER_BOUND,
    ),
  };
}

export function isFiniteSinr(sinrDb: number | null | undefined): sinrDb is number {
  return sinrDb !== null && sinrDb !== undefined && Number.isFinite(sinrDb);
}

export function resolveConeBeamCalloutCap(
  density: 'event-only' | 'event-plus-1' | 'all',
  viewport: RuntimeViewport,
): number {
  switch (density) {
    case 'event-only':
      return EVENT_ONLY_CALLOUT_CAP;
    case 'event-plus-1':
      return viewport.width >= EVENT_PLUS_ONE_DESKTOP_MIN_WIDTH
        ? EVENT_PLUS_ONE_DESKTOP_CALLOUT_CAP
        : EVENT_PLUS_ONE_COMPACT_CALLOUT_CAP;
    case 'all':
      return Infinity;
  }
}

function eventRolePriority(role?: EventRole): number {
  switch (role) {
    case 'serving':
    case 'post-ho':
      return 0;
    case 'prepared':
      return 1;
    case 'approach':
      return 2;
    case 'secondary':
      return 3;
    default:
      return 4;
  }
}

export function coneEntryPriority(entry: ConeBeamEntry): number {
  return eventRolePriority(entry.beam.role);
}

export function coneEntryKey(satelliteId: string, beamId: number): string {
  return `${satelliteId}:B${beamId}`;
}

export function resolveVisualFrequency(
  beam: Pick<
    BeamCellViz,
    | 'beamId'
    | 'reuseGroup'
    | 'reuseGroupSource'
    | 'runtimeFrequencyReuse'
    | 'coreLayoutFrequencyReuse'
  >,
  frequencyReuse: number,
): BeamFrequencyIndexResolution {
  return resolveBeamFrequencyIndex({
    beamId: beam.beamId,
    frequencyReuse,
    reuseGroup: beam.reuseGroup,
    reuseGroupSource: beam.reuseGroupSource,
    runtimeFrequencyReuse: beam.runtimeFrequencyReuse,
    coreLayoutFrequencyReuse: beam.coreLayoutFrequencyReuse,
  });
}

export function nearestBeamCell(beamCells: BeamCellViz[]): BeamCellViz | null {
  let nearest: BeamCellViz | null = null;
  let nearestDistanceKm = Infinity;
  for (const beam of beamCells) {
    const distanceKm = beamDistanceToUeKm(beam);
    if (distanceKm < nearestDistanceKm) {
      nearest = beam;
      nearestDistanceKm = distanceKm;
    }
  }
  return nearest;
}

export function scoreCentralPass(sat: VisibleSat): number {
  if (sat.topo.elevationDeg < MIN_CENTER_ELEVATION_DEG) return 0;

  const centerRadiusWorld = Math.hypot(sat.world.x, sat.world.z);
  if (centerRadiusWorld > CENTRAL_FOCUS_RADIUS_WORLD) return 0;

  const radialScore = centerRadiusWorld <= CENTRAL_CORE_RADIUS_WORLD
    ? 55
    : 55 * (
      1 - (centerRadiusWorld - CENTRAL_CORE_RADIUS_WORLD)
        / (CENTRAL_FOCUS_RADIUS_WORLD - CENTRAL_CORE_RADIUS_WORLD)
    );

  const elevationScore = Math.pow(sat.topo.elevationDeg / 90, 4) * 500;

  return radialScore + elevationScore;
}

export function centralBiasWeight(mode: PresentationMode): number {
  switch (mode) {
    case 'research-default':
      return 0.5;
    case 'candidate-rich':
      return 2.0;
    case 'demo-readability':
      return 3.5;
  }
}

export function primaryBeamIdForSat(
  satId: string,
  ids: RelevantSatIds,
  displayAssignmentsBySatId: Map<string, Set<number>>,
  beamCellsBySatId: Map<string, BeamCellViz[]>,
): number | null {
  if (satId === ids.servingSatId) return ids.servingBeamId;
  if (satId === ids.pendingTargetSatId) return ids.pendingTargetBeamId;
  if (satId === ids.recentHoSourceSatId) return ids.recentHoSourceBeamId;
  if (satId === ids.recentHoTargetSatId) return ids.recentHoTargetBeamId;
  const displayBeamIds = displayAssignmentsBySatId.get(satId);
  if (displayBeamIds && displayBeamIds.size > 0) return [...displayBeamIds][0] ?? null;
  const nearestBeam = nearestBeamCell(beamCellsBySatId.get(satId) ?? []);
  return nearestBeam?.beamId ?? null;
}

export function isTransitioningSourceSat(satId: string, ids: RelevantSatIds): boolean {
  return satId === ids.servingSatId
    && ids.pendingTargetSatId !== null
    && ids.pendingTargetSatId !== ids.servingSatId;
}

export function isPreparedTransitionSat(satId: string, ids: RelevantSatIds): boolean {
  return satId === ids.pendingTargetSatId && ids.pendingTargetSatId !== ids.servingSatId;
}

export function isRecentHoSourceSat(satId: string, ids: RelevantSatIds): boolean {
  return satId === ids.recentHoSourceSatId && satId !== ids.servingSatId;
}

