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

export interface HomepageBeamBudgets {
  readonly servingBeamCount: number;
  readonly candidateBeamCount: number;
  readonly physicalServingBeamCount: number;
  readonly physicalCandidateBeamCount: number;
}

/**
 * The four beam budgets the homepage projection is built from.
 *
 * This existed as four inline `X ?? profile.beams.perSatellite` expressions in
 * `useSimStatePublisher`, with serving and candidate interleaved. Both sides of
 * that seam were tested -- `beamMetrics.test.ts` proves a 7/19 input yields
 * 7/19 rows, `HomepageBeamRail.test.tsx` proves a 7/19 projection renders 26
 * rows -- and the seam itself was not, so swapping serving for candidate in one
 * of the four lines would have left every test green. That is the exact shape
 * of three of the eight regressions in `6b9474e`: the wiring was replaced while
 * the units on either side kept passing.
 *
 * A role value of 1 is the focused-cell selection, not a one-beam satellite, so
 * the PHYSICAL budget stays at the shipped seven-beam layout while the role
 * budget stays 1. Keeping both in one return value is what makes that pairing
 * assertable.
 */
export function resolveHomepageBeamBudgets(input: {
  readonly servingBeamCount?: number;
  readonly candidateBeamCount?: number;
  readonly profileBeamsPerSatellite: number;
}): HomepageBeamBudgets {
  const { servingBeamCount, candidateBeamCount, profileBeamsPerSatellite } = input;
  const serving = servingBeamCount ?? profileBeamsPerSatellite;
  const candidate = candidateBeamCount ?? profileBeamsPerSatellite;
  return {
    servingBeamCount: serving,
    candidateBeamCount: candidate,
    physicalServingBeamCount: resolveSinrLivePhysicalRoleBeamCount(serving) ?? profileBeamsPerSatellite,
    physicalCandidateBeamCount: resolveSinrLivePhysicalRoleBeamCount(candidate) ?? profileBeamsPerSatellite,
  };
}
