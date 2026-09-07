import type { Profile } from '../profiles/types';
import type { ArchivedTleSevenCellPlacement } from './archivedTleSevenCellPlacement';
import {
  buildSinrLiveCellLayout,
  resolveSinrLiveSceneCellCount,
} from './sinrLiveCellRuntime';
import type { SinrLiveCellPlacement } from '../viz/SinrLiveCellBeamCones';

export interface SinrLiveCellPlacementInput {
  readonly enabled: boolean;
  readonly hasCanonicalScenario: boolean;
  readonly archivedTlePlacement?: ArchivedTleSevenCellPlacement;
  readonly profile: Profile;
  readonly servingBeamCount?: number;
  readonly worldUnitsPerKm: number;
}

/** Build the one ground-cell placement map shared by every SINR-live render layer. */
export function resolveSinrLiveCellPlacementById(
  input: SinrLiveCellPlacementInput,
): ReadonlyMap<number, SinrLiveCellPlacement> {
  if (!input.enabled) return new Map();

  if (input.hasCanonicalScenario && input.archivedTlePlacement !== undefined) {
    return new Map(input.archivedTlePlacement.cells.map(cell => [cell.canonicalCellId, {
      cellId: cell.canonicalCellId,
      worldX: cell.centerKm[0] * input.worldUnitsPerKm,
      worldZ: -cell.centerKm[1] * input.worldUnitsPerKm,
      radiusWorld: cell.radiusKm * input.worldUnitsPerKm,
      worldUnitsPerKm: input.worldUnitsPerKm,
    }]));
  }

  const activeLayout = buildSinrLiveCellLayout(
    input.profile,
    resolveSinrLiveSceneCellCount(input.servingBeamCount),
  );
  return new Map(activeLayout.centers.map(center => [center.cellId, {
    cellId: center.cellId,
    worldX: center.localXKm * input.worldUnitsPerKm,
    worldZ: -center.localYKm * input.worldUnitsPerKm,
    radiusWorld: activeLayout.cellRadiusKm * input.worldUnitsPerKm,
    worldUnitsPerKm: input.worldUnitsPerKm,
  }]));
}
