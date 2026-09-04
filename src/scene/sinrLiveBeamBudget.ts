/**
 * Single precedence rule for the SINR-live display and cell-truth model:
 * role override -> satellite override -> lane fallback.
 *
 * This is a presentation/runtime wiring contract only. It does not change a
 * link budget or a serving decision; it only answers how many illuminated cell
 * entries a given satellite is allowed to expose in the current frame.
 */

export type SinrLiveBeamBudgetRole = 'serving' | 'candidate';

export interface SinrLiveBeamBudgetInput {
  readonly fallbackBeamCount: number;
  readonly satelliteId?: string | null;
  readonly roleBeamCount?: number;
  readonly beamCountBySatellite?: Readonly<Record<string, number>>;
}

/**
 * Homepage semantics: a role value of 1 selects one focused geographic cell;
 * it does not reduce the physical satellite beam-forming budget. The live
 * homepage substrate uses the shipped seven-beam satellite layout.
 */
export const SINR_LIVE_FOCUSED_CELL_PHYSICAL_BEAM_COUNT = 7;

function normalizeBeamCount(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(1, Math.floor(value));
}

export function resolveSinrLivePhysicalRoleBeamCount(value: number | undefined): number | undefined {
  const normalized = normalizeBeamCount(value);
  if (normalized === undefined) return undefined;
  return normalized === 1
    ? SINR_LIVE_FOCUSED_CELL_PHYSICAL_BEAM_COUNT
    : normalized;
}

export function resolveSinrLiveBeamBudget(input: SinrLiveBeamBudgetInput): number {
  const roleOverride = normalizeBeamCount(input.roleBeamCount);
  if (roleOverride !== undefined) return roleOverride;

  const satelliteOverride = input.satelliteId === null || input.satelliteId === undefined
    ? undefined
    : normalizeBeamCount(input.beamCountBySatellite?.[input.satelliteId]);
  if (satelliteOverride !== undefined) return satelliteOverride;

  return input.fallbackBeamCount;
}
