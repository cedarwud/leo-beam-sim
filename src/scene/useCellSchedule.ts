import { useMemo } from 'react';
import {
  buildCellLayout,
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

const MAX_SYNTHETIC_SATELLITES = 4;
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

export interface CellScheduleViz {
  readonly layout: CellLayout;
  readonly slotIndex: number;
  readonly slot: CellScheduleSlot;
  readonly placements: readonly CellWorldPlacement[];
  /** Map cellId -> assignment for the current slot (active cells only). */
  readonly assignmentByCellId: ReadonlyMap<number, CellAssignment>;
}

export interface UseCellScheduleInput {
  readonly simTimeSec: number;
  readonly altitudeKm: number;
  readonly beamwidth3dBRad: number;
  readonly centerLatDeg: number;
  readonly centerLonDeg: number;
  readonly worldUnitsPerKm: number;
  /** Display satellites for tint + count (id + visual index from array order). */
  readonly satellites: ReadonlyArray<{ id: string }>;
  readonly slotSec?: number;
  readonly beamsPerSatellite?: number;
}

interface ComputeCellScheduleVizFromLayoutInput extends UseCellScheduleInput {
  readonly layout: CellLayout;
  readonly slotIndex: number;
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
  const satelliteIds = input.satellites
    .slice(0, MAX_SYNTHETIC_SATELLITES)
    .map(satellite => satellite.id)
    .join('\u001f');

  return useMemo(
    () => computeCellScheduleVizFromLayout({ ...input, layout, slotIndex }),
    [
      input.beamsPerSatellite,
      input.centerLatDeg,
      input.centerLonDeg,
      input.worldUnitsPerKm,
      layout,
      satelliteIds,
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

  const satellites = buildSyntheticVisibleSatellitePoses(input);
  if (satellites.length === 0) {
    const slot = emptyCellScheduleSlot(input.layout, input.slotIndex);
    return buildVizResult(input.layout, input.slotIndex, slot, placements);
  }

  const slot = computeSlotSchedule({
    layout: input.layout,
    satellites,
    beamsPerSatellite: input.beamsPerSatellite ?? DEFAULT_BEAMS_PER_SATELLITE,
  }, input.slotIndex);

  return buildVizResult(input.layout, input.slotIndex, slot, placements);
}

function buildVizResult(
  layout: CellLayout,
  slotIndex: number,
  slot: CellScheduleSlot,
  placements: readonly CellWorldPlacement[],
): CellScheduleViz {
  return {
    layout,
    slotIndex,
    slot,
    placements,
    assignmentByCellId: new Map(slot.assignments.map(assignment => [assignment.cellId, assignment])),
  };
}

function buildSyntheticVisibleSatellitePoses(input: UseCellScheduleInput): readonly SatellitePose[] {
  // Phase I is a viz mock (SDD §7): use synthetic all-visible scheduler poses
  // for a stable 28/9 hop pattern. Rendered tint still uses real display sat
  // IDs; real-orbit lat/lon scheduler input is deferred to Phase III.
  return input.satellites
    .slice(0, MAX_SYNTHETIC_SATELLITES)
    .filter(satellite => satellite.id.length > 0)
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
