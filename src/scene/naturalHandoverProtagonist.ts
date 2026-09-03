export type NaturalHandoverSimulationSource = 'live' | 'archived-tle';

export interface NaturalHandoverProtagonistInput {
  readonly simSource: NaturalHandoverSimulationSource;
  /** Canonical cell-truth primary identity, when the selected source publishes one. */
  readonly canonicalPrimaryUeId?: string | null;
  /** Existing renderer fallback, retained for source lanes without a canonical identity. */
  readonly sceneFrameFirstUeId?: string | null;
}

/**
 * Resolve the one UE identity used by natural handover presentation consumers.
 *
 * Archived-TLE carries a canonical primary in its accepted cell-truth frame;
 * Walker keeps the renderer's historical first-UE behavior exactly.
 */
export function resolveNaturalHandoverProtagonistId(
  input: NaturalHandoverProtagonistInput,
): string | null {
  if (input.simSource === 'archived-tle') {
    return input.canonicalPrimaryUeId ?? input.sceneFrameFirstUeId ?? null;
  }
  return input.sceneFrameFirstUeId ?? null;
}
