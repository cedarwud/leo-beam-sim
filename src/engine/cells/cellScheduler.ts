import {
  DEFAULT_MIN_ELEVATION_DEG,
  elevationAngleRad,
} from './cellLayout';
import type { CellCenter, CellLayout } from './cellLayout';

export interface SatellitePose {
  /** Satellite ID, deterministic, e.g. "sat-0" .. "sat-3". */
  readonly satId: string;
  /** Visual index 0..3 (used for color tint downstream). */
  readonly visualIndex: number;
  readonly latDeg: number;
  readonly lonDeg: number;
  readonly altitudeKm: number;
}

export interface CellAssignment {
  /** Cell ID from CellLayout. */
  readonly cellId: number;
  /** Serving satellite for this slot. */
  readonly satId: string;
  /** Satellite visual index (for color). */
  readonly satVisualIndex: number;
  /** Beam slot index 0..6 on that satellite. */
  readonly beamIndex: number;
}

export interface CellScheduleSlot {
  /** Slot index, monotonic 0, 1, 2, ... */
  readonly slotIndex: number;
  /** Exactly K assignments when visibility allows; degraded slots may have fewer. Sorted by satVisualIndex then beamIndex. */
  readonly assignments: readonly CellAssignment[];
  /** Idle cells = layout.count - assignments.length. Sorted ascending cellId. */
  readonly idleCellIds: readonly number[];
}

export interface SchedulerConfig {
  readonly layout: CellLayout;
  readonly satellites: readonly SatellitePose[];
  readonly beamsPerSatellite: number;
  readonly minElevationDeg?: number;
  /** Optional override; if undefined and beamsPerSatellite=7 & sats=4 -> K=28. */
  readonly maxActivePerSlot?: number;
}

interface CandidateSatellite {
  readonly satellite: SatellitePose;
  readonly elevationRad: number;
}

export const DEFAULT_BEAMS_PER_SATELLITE = 7;

const DEG_TO_RAD = Math.PI / 180;

/** Compute K active = sats.length * beamsPerSatellite (bounded by layout.count). */
export function maxActivePerSlot(config: SchedulerConfig): number {
  validateSchedulerConfig(config);

  const beamCapacity = config.satellites.length * config.beamsPerSatellite;
  const requestedCapacity = config.maxActivePerSlot ?? beamCapacity;

  if (!Number.isInteger(requestedCapacity) || requestedCapacity <= 0) {
    throw new Error(`maxActivePerSlot must be a positive integer; got ${requestedCapacity}`);
  }

  return Math.min(config.layout.count, beamCapacity, requestedCapacity);
}

/** Compute one slot's deterministic assignments. */
export function computeSlotSchedule(
  config: SchedulerConfig,
  slotIndex: number,
): CellScheduleSlot {
  validateSchedulerConfig(config);
  validateSlotIndex(slotIndex);

  const layout = config.layout;
  const activeLimit = maxActivePerSlot(config);
  const minElevationRad = (config.minElevationDeg ?? DEFAULT_MIN_ELEVATION_DEG) * DEG_TO_RAD;
  const satellites = normalizedSatellites(config.satellites);
  const chosenCells = rotatedCells(layout, slotIndex, activeLimit);
  const usedBeamKeys = new Set<string>();
  const usedCellIds = new Set<number>();
  const assignments: CellAssignment[] = [];

  for (const cell of chosenCells) {
    const assignment = assignCellToFirstAvailableBeam(
      cell,
      satellites,
      config.beamsPerSatellite,
      minElevationRad,
      usedBeamKeys,
    );

    if (assignment) {
      assignments.push(assignment);
      usedCellIds.add(assignment.cellId);
    }
  }

  assignments.sort(compareAssignments);

  return {
    slotIndex,
    assignments,
    idleCellIds: layout.centers
      .map(cell => cell.cellId)
      .filter(cellId => !usedCellIds.has(cellId))
      .sort((a, b) => a - b),
  };
}

/** Compute multiple consecutive slots. */
export function computeScheduleHorizon(
  config: SchedulerConfig,
  startSlotIndex: number,
  slotCount: number,
): readonly CellScheduleSlot[] {
  validateSlotIndex(startSlotIndex);
  if (!Number.isInteger(slotCount) || slotCount < 0) {
    throw new Error(`slotCount must be a non-negative integer; got ${slotCount}`);
  }

  return Array.from({ length: slotCount }, (_, offset) => (
    computeSlotSchedule(config, startSlotIndex + offset)
  ));
}

function rotatedCells(layout: CellLayout, slotIndex: number, activeLimit: number): readonly CellCenter[] {
  if (layout.count === 0 || activeLimit === 0) {
    return [];
  }

  const startIndex = (slotIndex * activeLimit) % layout.count;
  return Array.from({ length: activeLimit }, (_, offset) => {
    const cell = layout.centers[(startIndex + offset) % layout.count];
    if (!cell) {
      throw new Error(`layout missing center at index ${(startIndex + offset) % layout.count}`);
    }
    return cell;
  });
}

function assignCellToFirstAvailableBeam(
  cell: CellCenter,
  satellites: readonly SatellitePose[],
  beamsPerSatellite: number,
  minElevationRad: number,
  usedBeamKeys: Set<string>,
): CellAssignment | null {
  const candidates = visibleSatelliteCandidates(cell, satellites, minElevationRad);

  for (const candidate of candidates) {
    for (let beamIndex = 0; beamIndex < beamsPerSatellite; beamIndex += 1) {
      const key = beamKey(candidate.satellite.satId, beamIndex);
      if (!usedBeamKeys.has(key)) {
        usedBeamKeys.add(key);
        return {
          cellId: cell.cellId,
          satId: candidate.satellite.satId,
          satVisualIndex: candidate.satellite.visualIndex,
          beamIndex,
        };
      }
    }
  }

  return null;
}

function visibleSatelliteCandidates(
  cell: CellCenter,
  satellites: readonly SatellitePose[],
  minElevationRad: number,
): readonly CandidateSatellite[] {
  return satellites
    .map((satellite): CandidateSatellite => ({
      satellite,
      elevationRad: elevationAngleRad(
        satellite.latDeg,
        satellite.lonDeg,
        satellite.altitudeKm,
        cell.latDeg,
        cell.lonDeg,
      ),
    }))
    .filter(candidate => candidate.elevationRad > minElevationRad)
    .sort(compareCandidateSatellites);
}

function compareCandidateSatellites(a: CandidateSatellite, b: CandidateSatellite): number {
  return (b.elevationRad - a.elevationRad)
    || (a.satellite.visualIndex - b.satellite.visualIndex)
    || a.satellite.satId.localeCompare(b.satellite.satId);
}

function compareAssignments(a: CellAssignment, b: CellAssignment): number {
  return (a.satVisualIndex - b.satVisualIndex)
    || (a.beamIndex - b.beamIndex)
    || (a.cellId - b.cellId)
    || a.satId.localeCompare(b.satId);
}

function normalizedSatellites(satellites: readonly SatellitePose[]): readonly SatellitePose[] {
  return [...satellites].sort((a, b) => (
    a.satId.localeCompare(b.satId)
      || (a.visualIndex - b.visualIndex)
      || (a.latDeg - b.latDeg)
      || (a.lonDeg - b.lonDeg)
      || (a.altitudeKm - b.altitudeKm)
  ));
}

function beamKey(satId: string, beamIndex: number): string {
  return `${satId}:${beamIndex}`;
}

function validateSchedulerConfig(config: SchedulerConfig): void {
  if (config.layout.count !== config.layout.centers.length) {
    throw new Error(`layout count ${config.layout.count} does not match centers length ${config.layout.centers.length}`);
  }
  if (!Number.isInteger(config.layout.count) || config.layout.count <= 0) {
    throw new Error(`layout.count must be a positive integer; got ${config.layout.count}`);
  }
  if (!Number.isInteger(config.beamsPerSatellite) || config.beamsPerSatellite <= 0) {
    throw new Error(`beamsPerSatellite must be a positive integer; got ${config.beamsPerSatellite}`);
  }
  if (!Number.isFinite(config.minElevationDeg ?? DEFAULT_MIN_ELEVATION_DEG)) {
    throw new Error(`minElevationDeg must be finite; got ${config.minElevationDeg}`);
  }
  if (config.satellites.length === 0) {
    throw new Error('at least one satellite is required');
  }

  const satIds = new Set<string>();
  const cellIds = new Set<number>();
  for (const cell of config.layout.centers) {
    validateInteger(cell.cellId, 'cellId');
    if (cellIds.has(cell.cellId)) {
      throw new Error(`duplicate cellId ${cell.cellId}`);
    }
    cellIds.add(cell.cellId);
    validateFinite(cell.latDeg, `cell ${cell.cellId} latDeg`);
    validateFinite(cell.lonDeg, `cell ${cell.cellId} lonDeg`);
  }

  for (const satellite of config.satellites) {
    if (satellite.satId.length === 0) {
      throw new Error('satellite satId must be non-empty');
    }
    if (satIds.has(satellite.satId)) {
      throw new Error(`duplicate satellite satId ${satellite.satId}`);
    }
    satIds.add(satellite.satId);
    validateInteger(satellite.visualIndex, `${satellite.satId} visualIndex`);
    validateFinite(satellite.latDeg, `${satellite.satId} latDeg`);
    validateFinite(satellite.lonDeg, `${satellite.satId} lonDeg`);
    validatePositiveFinite(satellite.altitudeKm, `${satellite.satId} altitudeKm`);
  }
}

function validateSlotIndex(slotIndex: number): void {
  if (!Number.isInteger(slotIndex) || slotIndex < 0) {
    throw new Error(`slotIndex must be a non-negative integer; got ${slotIndex}`);
  }
}

function validateInteger(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer; got ${value}`);
  }
}

function validateFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite; got ${value}`);
  }
}

function validatePositiveFinite(value: number, label: string): void {
  validateFinite(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be positive; got ${value}`);
  }
}
