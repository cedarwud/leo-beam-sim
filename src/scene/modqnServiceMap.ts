import type { NormalizedUe } from './NormalizedSceneFrame';
import type { CellScheduleViz, CellWorldPlacement } from './useCellSchedule';

export interface ModqnUeServiceProjection {
  readonly ueId: string;
  readonly cellId: number | null;
  readonly satId: string | null;
  readonly beamIndex: number | null;
  readonly markerColor: string;
  readonly markerEmissive: string;
  readonly serviceState: 'served' | 'idle' | 'unknown';
}

export interface ModqnServiceMap {
  readonly ueById: ReadonlyMap<string, ModqnUeServiceProjection>;
  readonly ueCountByCellId: ReadonlyMap<number, number>;
  readonly ueCountBySatId: ReadonlyMap<string, number>;
  readonly activeCellCountBySatId: ReadonlyMap<string, number>;
  readonly satelliteSummaries: readonly ModqnSatelliteServiceSummary[];
  readonly servedUeCount: number;
  readonly idleUeCount: number;
}

export interface ModqnSatelliteServiceSummary {
  readonly satId: string;
  readonly satVisualIndex: number;
  readonly markerColor: string;
  readonly activeCellCount: number;
  readonly activeBeamIds: readonly number[];
  readonly servedUeCount: number;
}

export interface ModqnCellServiceReadout {
  readonly source: 'profile-derived-demo';
  readonly claimKind: 'overlay-demo';
  readonly slotIndex: number;
  readonly slotSec: number;
  readonly nextSlotIndex: number;
  readonly servingCount: number;
  readonly visibleSatelliteCount: number;
  readonly cellCount: number;
  readonly activeCellCount: number;
  readonly idleCellCount: number;
  readonly nextActiveCellCount: number;
  readonly nextIdleCellCount: number;
  readonly nextChangedCellCount: number;
  readonly servedUeCount: number;
  readonly idleUeCount: number;
  readonly satelliteSummaries: readonly ModqnSatelliteServiceSummary[];
}

export const EMPTY_MODQN_SERVICE_MAP: ModqnServiceMap = {
  ueById: new Map(),
  ueCountByCellId: new Map(),
  ueCountBySatId: new Map(),
  activeCellCountBySatId: new Map(),
  satelliteSummaries: [],
  servedUeCount: 0,
  idleUeCount: 0,
};

const IDLE_MARKER_COLOR = '#64748b';
const IDLE_MARKER_EMISSIVE = '#334155';
const UNKNOWN_MARKER_COLOR = '#94a3b8';
const UNKNOWN_MARKER_EMISSIVE = '#475569';

export function deriveModqnServiceMap({
  ues,
  schedule,
  satelliteTintById,
}: {
  readonly ues: readonly NormalizedUe[];
  readonly schedule: CellScheduleViz;
  readonly satelliteTintById: ReadonlyMap<string, string>;
}): ModqnServiceMap {
  if (schedule.placements.length === 0) return EMPTY_MODQN_SERVICE_MAP;

  const ueById = new Map<string, ModqnUeServiceProjection>();
  const ueCountByCellId = new Map<number, number>();
  const ueCountBySatId = new Map<string, number>();
  const activeCellCountBySatId = new Map<string, number>();
  const summaryDraftBySatId = new Map<string, ModqnSatelliteServiceSummary>();
  let servedUeCount = 0;
  let idleUeCount = 0;

  for (const assignment of schedule.slot.assignments) {
    const markerColor = satelliteTintById.get(assignment.satId) ?? UNKNOWN_MARKER_COLOR;
    activeCellCountBySatId.set(
      assignment.satId,
      (activeCellCountBySatId.get(assignment.satId) ?? 0) + 1,
    );
    summaryDraftBySatId.set(assignment.satId, {
      satId: assignment.satId,
      satVisualIndex: assignment.satVisualIndex,
      markerColor,
      activeCellCount: activeCellCountBySatId.get(assignment.satId) ?? 0,
      activeBeamIds: appendUniqueSortedBeamId(
        summaryDraftBySatId.get(assignment.satId)?.activeBeamIds ?? [],
        assignment.beamIndex,
      ),
      servedUeCount: ueCountBySatId.get(assignment.satId) ?? 0,
    });
  }

  for (const ue of ues) {
    const nearest = findNearestPlacement(ue, schedule.placements);
    if (!nearest) {
      ueById.set(ue.id, {
        ueId: ue.id,
        cellId: null,
        satId: null,
        beamIndex: null,
        markerColor: UNKNOWN_MARKER_COLOR,
        markerEmissive: UNKNOWN_MARKER_EMISSIVE,
        serviceState: 'unknown',
      });
      continue;
    }

    const assignment = schedule.assignmentByCellId.get(nearest.cellId);
    if (!assignment) {
      idleUeCount += 1;
      ueById.set(ue.id, {
        ueId: ue.id,
        cellId: nearest.cellId,
        satId: null,
        beamIndex: null,
        markerColor: IDLE_MARKER_COLOR,
        markerEmissive: IDLE_MARKER_EMISSIVE,
        serviceState: 'idle',
      });
      continue;
    }

    servedUeCount += 1;
    ueCountByCellId.set(nearest.cellId, (ueCountByCellId.get(nearest.cellId) ?? 0) + 1);
    ueCountBySatId.set(assignment.satId, (ueCountBySatId.get(assignment.satId) ?? 0) + 1);
    const markerColor = satelliteTintById.get(assignment.satId) ?? UNKNOWN_MARKER_COLOR;
    summaryDraftBySatId.set(assignment.satId, {
      satId: assignment.satId,
      satVisualIndex: assignment.satVisualIndex,
      markerColor,
      activeCellCount: activeCellCountBySatId.get(assignment.satId) ?? 0,
      activeBeamIds: summaryDraftBySatId.get(assignment.satId)?.activeBeamIds ?? [],
      servedUeCount: ueCountBySatId.get(assignment.satId) ?? 0,
    });
    ueById.set(ue.id, {
      ueId: ue.id,
      cellId: nearest.cellId,
      satId: assignment.satId,
      beamIndex: assignment.beamIndex,
      markerColor,
      markerEmissive: markerColor,
      serviceState: 'served',
    });
  }

  return {
    ueById,
    ueCountByCellId,
    ueCountBySatId,
    activeCellCountBySatId,
    satelliteSummaries: [...summaryDraftBySatId.values()].sort(compareSatelliteSummaries),
    servedUeCount,
    idleUeCount,
  };
}

export function buildModqnCellServiceReadout({
  schedule,
  serviceMap,
  slotSec,
}: {
  readonly schedule: CellScheduleViz;
  readonly serviceMap: ModqnServiceMap;
  readonly slotSec: number;
}): ModqnCellServiceReadout {
  return {
    source: 'profile-derived-demo',
    claimKind: 'overlay-demo',
    slotIndex: schedule.slotIndex,
    slotSec,
    nextSlotIndex: schedule.nextSlot.slotIndex,
    servingCount: schedule.servingCount,
    visibleSatelliteCount: schedule.visibleCount,
    cellCount: schedule.layout.count,
    activeCellCount: schedule.slot.assignments.length,
    idleCellCount: schedule.slot.idleCellIds.length,
    nextActiveCellCount: schedule.nextSlot.assignments.length,
    nextIdleCellCount: schedule.nextSlot.idleCellIds.length,
    nextChangedCellCount: countNextSlotCellChanges(schedule),
    servedUeCount: serviceMap.servedUeCount,
    idleUeCount: serviceMap.idleUeCount,
    satelliteSummaries: serviceMap.satelliteSummaries,
  };
}

function appendUniqueSortedBeamId(
  beamIds: readonly number[],
  beamId: number,
): readonly number[] {
  if (beamIds.includes(beamId)) return beamIds;
  return [...beamIds, beamId].sort((a, b) => a - b);
}

function countNextSlotCellChanges(schedule: CellScheduleViz): number {
  let changedCount = 0;
  for (const cell of schedule.layout.centers) {
    const current = schedule.assignmentByCellId.get(cell.cellId);
    const next = schedule.nextAssignmentByCellId.get(cell.cellId);
    if (current === undefined || next === undefined) {
      if (current !== next) changedCount += 1;
      continue;
    }
    if (current.satId !== next.satId || current.beamIndex !== next.beamIndex) {
      changedCount += 1;
    }
  }
  return changedCount;
}

function compareSatelliteSummaries(
  a: ModqnSatelliteServiceSummary,
  b: ModqnSatelliteServiceSummary,
): number {
  return (a.satVisualIndex - b.satVisualIndex)
    || a.satId.localeCompare(b.satId);
}

function findNearestPlacement(
  ue: NormalizedUe,
  placements: readonly CellWorldPlacement[],
): CellWorldPlacement | null {
  const worldPos = ue.worldPos;
  if (!worldPos) return null;

  let nearest: CellWorldPlacement | null = null;
  let nearestDistanceSq = Number.POSITIVE_INFINITY;

  for (const placement of placements) {
    const dx = worldPos[0] - placement.worldX;
    const dz = worldPos[2] - placement.worldZ;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq < nearestDistanceSq) {
      nearest = placement;
      nearestDistanceSq = distanceSq;
    }
  }

  return nearest;
}
