/** Fixed-cell geography and per-(satellite, cell) scan geometry. */

import { computeTr38811SlantRangeKm } from '../engine/signal/slant-range';
import {
  elevationAngleRad,
  localKmToLatLon,
  type CellCenter,
  type CellLayout,
} from '../engine/cells/cellLayout';
import { EARTH_KM_PER_DEG } from '../engine/orbit/earth-constants';
import type {
  CellModelSat,
  CellScanGeometry,
  UeInput,
} from './sinrLiveCellModel';

const DEG_TO_RAD = Math.PI / 180;
const INTRA_CELL_BEAM_OFFSET_FRACTION = 0.2;

/**
 * Deterministic alternate boresight inside the same geographic cell. The
 * offset points toward the fixed service-area origin, not toward the UE.
 */
export function resolveIntraCellBeamCenter(
  cell: CellCenter,
  cellRadiusKm: number,
  observer: { readonly latDeg: number; readonly lonDeg: number },
  variantIndex = 1,
): CellCenter {
  const radius = Number.isFinite(cellRadiusKm) && cellRadiusKm > 0 ? cellRadiusKm : 0;
  const distanceToOrigin = Math.hypot(cell.localXKm, cell.localYKm);
  const baseDirection = distanceToOrigin > 1e-9
    ? { east: -cell.localXKm / distanceToOrigin, north: -cell.localYKm / distanceToOrigin }
    : { east: 1, north: 0 };
  const baseAngle = Math.atan2(baseDirection.north, baseDirection.east);
  const variantAngle = baseAngle + (Math.max(1, Math.floor(variantIndex)) - 1) * (Math.PI / 3);
  const direction = { east: Math.cos(variantAngle), north: Math.sin(variantAngle) };
  const localXKm = cell.localXKm + direction.east * radius * INTRA_CELL_BEAM_OFFSET_FRACTION;
  const localYKm = cell.localYKm + direction.north * radius * INTRA_CELL_BEAM_OFFSET_FRACTION;
  const latLon = localKmToLatLon(observer.latDeg, observer.lonDeg, localXKm, localYKm);
  return {
    ...cell,
    latDeg: latLon.latDeg,
    lonDeg: latLon.lonDeg,
    localXKm,
    localYKm,
  };
}

/** UE → nearest earth-fixed cell by local-ENU distance (§5.1). */
export function assignUeToNearestCell(
  ue: Pick<UeInput, 'eastKm' | 'northKm'>,
  cellLayout: CellLayout,
): { cellId: number | null; distanceKm: number } {
  let bestCellId: number | null = null;
  let bestDistanceKm = Infinity;
  for (const cell of cellLayout.centers) {
    const distanceKm = Math.hypot(ue.eastKm - cell.localXKm, ue.northKm - cell.localYKm);
    if (distanceKm < bestDistanceKm) {
      bestDistanceKm = distanceKm;
      bestCellId = cell.cellId;
    }
  }
  return { cellId: bestCellId, distanceKm: bestCellId === null ? Infinity : bestDistanceKm };
}

/** Satellite nadir ground offset in observer-relative ENU km. */
export function satNadirOffsetKm(
  sat: Pick<CellModelSat, 'latDeg' | 'lonDeg'>,
  observer: { latDeg: number; lonDeg: number },
): { eastKm: number; northKm: number } {
  const cosObsLat = Math.cos(observer.latDeg * DEG_TO_RAD);
  return {
    eastKm: (sat.lonDeg - observer.lonDeg) * EARTH_KM_PER_DEG * cosObsLat,
    northKm: (sat.latDeg - observer.latDeg) * EARTH_KM_PER_DEG,
  };
}

/** Per-(sat, cell) geometry to the fixed cell centre (§5.3). */
export function computeCellScanGeometry(
  sat: Pick<CellModelSat, 'id' | 'latDeg' | 'lonDeg' | 'altitudeKm'>,
  cell: CellCenter,
  observer: { latDeg: number; lonDeg: number },
): CellScanGeometry {
  const nadir = satNadirOffsetKm(sat, observer);
  const nadirToCellKm = Math.hypot(cell.localXKm - nadir.eastKm, cell.localYKm - nadir.northKm);
  const scanAngleDeg = (Math.atan(nadirToCellKm / Math.max(sat.altitudeKm, 1e-6)) * 180) / Math.PI;
  const elevationDeg = (elevationAngleRad(
    sat.latDeg,
    sat.lonDeg,
    sat.altitudeKm,
    cell.latDeg,
    cell.lonDeg,
  ) * 180) / Math.PI;
  const slantRangeKm = computeTr38811SlantRangeKm(elevationDeg, sat.altitudeKm);
  return { satId: sat.id, cellId: cell.cellId, scanAngleDeg, slantRangeKm, elevationDeg, nadirToCellKm };
}

/** Candidate serving sats visible above the elevation mask and steerable to the cell. */
export function listCellCandidateSats(
  cell: CellCenter,
  sats: readonly CellModelSat[],
  observer: { latDeg: number; lonDeg: number },
  maxSteeringAngleDeg: number,
  minElevationDeg: number,
): CellScanGeometry[] {
  const out: CellScanGeometry[] = [];
  for (const sat of sats) {
    const geom = computeCellScanGeometry(sat, cell, observer);
    if (geom.elevationDeg < minElevationDeg) continue;
    if (geom.scanAngleDeg > maxSteeringAngleDeg + 1e-6) continue;
    out.push(geom);
  }
  return out;
}
