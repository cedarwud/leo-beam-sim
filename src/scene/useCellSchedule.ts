import { useMemo } from 'react';
import {
  buildCellLayout,
  DEFAULT_MIN_ELEVATION_DEG,
  elevationAngleRad,
  type CellCenter,
  type CellLayout,
} from '../engine/cells/cellLayout';
import {
  DEFAULT_BEAMS_PER_SATELLITE,
  computeSlotSchedule,
  type CellAssignment,
  type CellScheduleSlot,
  type SatellitePose,
} from '../engine/cells/cellScheduler';

/** Cosmetic viz slot pacing (seconds). NOT the backend training slot (SDD §5.5.1 0.5s). */
export const CELL_SCHEDULE_VIZ_SLOT_SEC = 2.5;
export const DEFAULT_SERVING_COUNT = 8;
export const PAPER_ACTIVE_BEAMS_PER_SLOT = 28;

const MAX_SYNTHETIC_SATELLITES = 4;
const DEG_TO_RAD = Math.PI / 180;
const SYNTHETIC_POSE_OFFSETS_DEG: readonly [number, number][] = [
  [0, 0],
  [0.1, 0],
  [0, 0.1],
  [0.1, 0.1],
];

export interface CellWorldPlacement {
  readonly cellId: number;
  readonly center: CellCenter;
  /** Scene world coords on the ground plane (y = 0). */
  readonly worldX: number;
  readonly worldZ: number;
  /** Cell radius in world units. */
  readonly radiusWorld: number;
}

export type CellHandoverKind = 'intra' | 'inter';

export interface CellReassignment {
  readonly cellId: number;
  readonly kind: CellHandoverKind;
  readonly fromSatId: string;
  readonly fromBeamIndex: number;
  readonly toSatId: string;
  readonly toBeamIndex: number;
  /** Cell world position (ground plane) for arc anchoring. */
  readonly worldX: number;
  readonly worldZ: number;
}

export interface CellScheduleViz {
  readonly layout: CellLayout;
  readonly slotIndex: number;
  readonly slot: CellScheduleSlot;
  readonly previousSlot: CellScheduleSlot;
  readonly nextSlot: CellScheduleSlot;
  readonly placements: readonly CellWorldPlacement[];
  /** Map cellId -> assignment for the current slot (active cells only). */
  readonly assignmentByCellId: ReadonlyMap<number, CellAssignment>;
  /** Map cellId -> assignment for the previous slot (active cells only). */
  readonly previousAssignmentByCellId: ReadonlyMap<number, CellAssignment>;
  /** Map cellId -> assignment for the next slot (active cells only). */
  readonly nextAssignmentByCellId: ReadonlyMap<number, CellAssignment>;
  readonly cellReassignments: readonly CellReassignment[];
  /** Resolved serving-count cap L used by this schedule. */
  readonly servingCount: number;
  /** Visible satellites before applying the serving-count cap. */
  readonly visibleCount: number;
}

export interface UseCellScheduleInput {
  readonly simTimeSec: number;
  readonly altitudeKm: number;
  readonly beamwidth3dBRad: number;
  readonly centerLatDeg: number;
  readonly centerLonDeg: number;
  readonly worldUnitsPerKm: number;
  /** Display satellites for tint + count (id + visual index from array order). */
  readonly satellites: ReadonlyArray<{
    id: string;
    latDeg?: number;
    lonDeg?: number;
    altitudeKm?: number;
  }>;
  readonly slotSec?: number;
  readonly beamsPerSatellite?: number;
  /** Serving-count cap: use only the top-L satellites by elevation to the area. Default 8. */
  readonly servingCount?: number;
}

interface ComputeCellScheduleVizFromLayoutInput extends UseCellScheduleInput {
  readonly layout: CellLayout;
  readonly slotIndex: number;
}

interface SchedulerSatelliteSelection {
  readonly satellites: readonly SatellitePose[];
  readonly servingCount: number;
  readonly visibleCount: number;
}

export function computeCellScheduleViz(input: UseCellScheduleInput): CellScheduleViz {
  const slotSec = resolveSlotSec(input.slotSec);
  const slotIndex = resolveSlotIndex(input.simTimeSec, slotSec);
  const layout = buildCellLayout({
    centerLatDeg: input.centerLatDeg,
    centerLonDeg: input.centerLonDeg,
    altitudeKm: input.altitudeKm,
    beamwidth3dBRad: input.beamwidth3dBRad,
  });

  return computeCellScheduleVizFromLayout({ ...input, layout, slotIndex });
}

export function useCellSchedule(input: UseCellScheduleInput): CellScheduleViz {
  const slotSec = resolveSlotSec(input.slotSec);
  const slotIndex = resolveSlotIndex(input.simTimeSec, slotSec);
  const previousSlotIndex = Math.max(0, slotIndex - 1);
  const nextSlotIndex = slotIndex + 1;
  const layout = useMemo(
    () => buildCellLayout({
      centerLatDeg: input.centerLatDeg,
      centerLonDeg: input.centerLonDeg,
      altitudeKm: input.altitudeKm,
      beamwidth3dBRad: input.beamwidth3dBRad,
    }),
    [
      input.altitudeKm,
      input.beamwidth3dBRad,
      input.centerLatDeg,
      input.centerLonDeg,
    ],
  );
  const satelliteKey = input.satellites
    .map(satellite => [
      satellite.id,
      satellite.latDeg ?? '',
      satellite.lonDeg ?? '',
      satellite.altitudeKm ?? '',
    ].join(':'))
    .join('\u001f');
  const servingCount = resolveServingCount(input.servingCount);

  return useMemo(
    () => computeCellScheduleVizFromLayout({ ...input, layout, slotIndex }),
    [
      input.beamsPerSatellite,
      input.centerLatDeg,
      input.centerLonDeg,
      servingCount,
      input.worldUnitsPerKm,
      layout,
      nextSlotIndex,
      previousSlotIndex,
      satelliteKey,
      slotIndex,
    ],
  );
}

function computeCellScheduleVizFromLayout(input: ComputeCellScheduleVizFromLayoutInput): CellScheduleViz {
  const placements = input.layout.centers.map((center): CellWorldPlacement => ({
    cellId: center.cellId,
    center,
    worldX: center.localXKm * input.worldUnitsPerKm,
    // UE projection convention: east -> +X, north -> -Z. This keeps the
    // Phase I viz mock aligned with live UE markers while real-orbit scheduler
    // positions remain deferred to Phase III per SDD §7.
    worldZ: -center.localYKm * input.worldUnitsPerKm,
    radiusWorld: input.layout.cellRadiusKm * input.worldUnitsPerKm,
  }));

  const selection = buildSchedulerSatelliteSelection(input);
  if (selection.satellites.length === 0) {
    const slot = emptyCellScheduleSlot(input.layout, input.slotIndex);
    const previousSlot = emptyCellScheduleSlot(input.layout, Math.max(0, input.slotIndex - 1));
    const nextSlot = emptyCellScheduleSlot(input.layout, input.slotIndex + 1);
    return buildVizResult(input.layout, input.slotIndex, slot, previousSlot, nextSlot, placements, selection);
  }

  const schedulerConfig = {
    layout: input.layout,
    satellites: selection.satellites,
    beamsPerSatellite: input.beamsPerSatellite ?? DEFAULT_BEAMS_PER_SATELLITE,
    minElevationDeg: DEFAULT_MIN_ELEVATION_DEG,
    maxActivePerSlot: PAPER_ACTIVE_BEAMS_PER_SLOT,
  };
  const previousSlotIndex = Math.max(0, input.slotIndex - 1);
  const nextSlotIndex = input.slotIndex + 1;
  const slot = computeSlotSchedule(schedulerConfig, input.slotIndex);
  const previousSlot = computeSlotSchedule(schedulerConfig, previousSlotIndex);
  const nextSlot = computeSlotSchedule(schedulerConfig, nextSlotIndex);

  return buildVizResult(input.layout, input.slotIndex, slot, previousSlot, nextSlot, placements, selection);
}

function buildVizResult(
  layout: CellLayout,
  slotIndex: number,
  slot: CellScheduleSlot,
  previousSlot: CellScheduleSlot,
  nextSlot: CellScheduleSlot,
  placements: readonly CellWorldPlacement[],
  selection: Pick<SchedulerSatelliteSelection, 'servingCount' | 'visibleCount'>,
): CellScheduleViz {
  const assignmentByCellId = assignmentMap(slot);
  const previousAssignmentByCellId = assignmentMap(previousSlot);
  const nextAssignmentByCellId = assignmentMap(nextSlot);

  return {
    layout,
    slotIndex,
    slot,
    previousSlot,
    nextSlot,
    placements,
    assignmentByCellId,
    previousAssignmentByCellId,
    nextAssignmentByCellId,
    cellReassignments: computeCellReassignments(placements, assignmentByCellId, previousAssignmentByCellId),
    servingCount: selection.servingCount,
    visibleCount: selection.visibleCount,
  };
}

function assignmentMap(slot: CellScheduleSlot): ReadonlyMap<number, CellAssignment> {
  return new Map(slot.assignments.map(assignment => [assignment.cellId, assignment]));
}

function computeCellReassignments(
  placements: readonly CellWorldPlacement[],
  assignmentByCellId: ReadonlyMap<number, CellAssignment>,
  previousAssignmentByCellId: ReadonlyMap<number, CellAssignment>,
): readonly CellReassignment[] {
  const placementByCellId = new Map(placements.map(placement => [placement.cellId, placement]));
  const reassignments: CellReassignment[] = [];

  for (const [cellId, to] of assignmentByCellId.entries()) {
    const from = previousAssignmentByCellId.get(cellId);
    if (!from) {
      // Idle->active is scheduler on/off, not a user handover under SDD §4.6.
      continue;
    }

    let kind: CellHandoverKind | null = null;
    if (from.satId !== to.satId) {
      kind = 'inter';
    } else if (from.beamIndex !== to.beamIndex) {
      kind = 'intra';
    }

    if (!kind) continue;

    const placement = placementByCellId.get(cellId);
    if (!placement) continue;

    reassignments.push({
      cellId,
      kind,
      fromSatId: from.satId,
      fromBeamIndex: from.beamIndex,
      toSatId: to.satId,
      toBeamIndex: to.beamIndex,
      worldX: placement.worldX,
      worldZ: placement.worldZ,
    });
  }

  // Active->idle cells are absent from the current assignment map and are
  // intentionally skipped: they are schedule off-events, not handovers.
  return reassignments.sort((a, b) => a.cellId - b.cellId);
}

function buildSchedulerSatelliteSelection(input: UseCellScheduleInput): SchedulerSatelliteSelection {
  const servingCount = resolveServingCount(input.servingCount);
  const allSatellitesHaveGeo = input.satellites.length > 0
    && input.satellites.every(satellite => (
      Number.isFinite(satellite.latDeg)
      && Number.isFinite(satellite.lonDeg)
      && Number.isFinite(satellite.altitudeKm)
    ));

  if (allSatellitesHaveGeo) {
    // SDD §4.2.1: derive the serving set from real rendered satellite geo,
    // then cap to top-L by service-area-center elevation.
    const visibleSatellites = input.satellites
      .map((satellite, visualIndex) => ({
        satellite,
        visualIndex,
        elevationRad: satellite.id.length > 0
          ? elevationAngleRad(
            satellite.latDeg as number,
            satellite.lonDeg as number,
            satellite.altitudeKm as number,
            input.centerLatDeg,
            input.centerLonDeg,
          )
          : Number.NEGATIVE_INFINITY,
      }))
      .filter(candidate => candidate.satellite.id.length > 0)
      .filter(candidate => candidate.elevationRad > DEFAULT_MIN_ELEVATION_DEG * DEG_TO_RAD)
      .sort((a, b) => (
        (b.elevationRad - a.elevationRad)
        || (a.visualIndex - b.visualIndex)
        || a.satellite.id.localeCompare(b.satellite.id)
      ));

    return {
      servingCount,
      visibleCount: visibleSatellites.length,
      satellites: visibleSatellites
        .slice(0, servingCount)
        .map(({ satellite, visualIndex }): SatellitePose => ({
          satId: satellite.id,
          visualIndex,
          latDeg: satellite.latDeg as number,
          lonDeg: satellite.lonDeg as number,
          altitudeKm: satellite.altitudeKm as number,
        })),
    };
  }

  return buildSyntheticVisibleSatelliteSelection(input, servingCount);
}

function buildSyntheticVisibleSatelliteSelection(
  input: UseCellScheduleInput,
  servingCount: number,
): SchedulerSatelliteSelection {
  // Backward-compatible I-S4/I-S5a path: fixtures that pass ids only keep the
  // synthetic all-visible four-satellite 28/9 hop pattern.
  const visibleSatellites = input.satellites
    .slice(0, MAX_SYNTHETIC_SATELLITES)
    .filter(satellite => satellite.id.length > 0);
  const satellites = visibleSatellites
    .slice(0, servingCount)
    .map((satellite, visualIndex): SatellitePose => {
      const [latOffsetDeg, lonOffsetDeg] = SYNTHETIC_POSE_OFFSETS_DEG[visualIndex] ?? [0, 0];
      return {
        satId: satellite.id,
        visualIndex,
        latDeg: input.centerLatDeg + latOffsetDeg,
        lonDeg: input.centerLonDeg + lonOffsetDeg,
        altitudeKm: input.altitudeKm,
      };
    });

  return {
    satellites,
    servingCount,
    visibleCount: visibleSatellites.length,
  };
}

function emptyCellScheduleSlot(layout: CellLayout, slotIndex: number): CellScheduleSlot {
  return {
    slotIndex,
    assignments: [],
    idleCellIds: layout.centers.map(cell => cell.cellId).sort((a, b) => a - b),
  };
}

function resolveSlotSec(slotSec: number | undefined): number {
  return Number.isFinite(slotSec) && slotSec !== undefined && slotSec > 0
    ? slotSec
    : CELL_SCHEDULE_VIZ_SLOT_SEC;
}

function resolveSlotIndex(simTimeSec: number, slotSec: number): number {
  const tSec = Number.isFinite(simTimeSec) ? simTimeSec : 0;
  return Math.max(0, Math.floor(tSec / slotSec));
}

function resolveServingCount(servingCount: number | undefined): number {
  const resolved = servingCount ?? DEFAULT_SERVING_COUNT;
  if (!Number.isInteger(resolved) || resolved <= 0) {
    throw new Error(`servingCount must be a positive integer; got ${resolved}`);
  }
  return resolved;
}
