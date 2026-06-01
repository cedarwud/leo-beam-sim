export const MODQN_SERVING_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const;

export type ModqnServingCount = typeof MODQN_SERVING_COUNT_OPTIONS[number];

export const MODQN_PAPER_BASELINE_SERVING_COUNT = 4 satisfies ModqnServingCount;
export const MODQN_PAPER_SWEEP_MAX_SERVING_COUNT = 8 satisfies ModqnServingCount;
export const MODQN_DEFAULT_SERVING_COUNT = MODQN_PAPER_SWEEP_MAX_SERVING_COUNT;
export const MODQN_BEAMS_PER_SERVING_SATELLITE = 7;

const LEGACY_EXPERIMENTAL_SERVING_COUNT = 12;

export function isModqnServingCountOption(value: unknown): value is ModqnServingCount {
  return typeof value === 'number'
    && MODQN_SERVING_COUNT_OPTIONS.includes(value as ModqnServingCount);
}

export function normalizePersistedModqnServingCount(value: unknown): ModqnServingCount | null {
  if (isModqnServingCountOption(value)) return value;
  if (value === LEGACY_EXPERIMENTAL_SERVING_COUNT) {
    return MODQN_PAPER_SWEEP_MAX_SERVING_COUNT;
  }
  return null;
}

export function normalizeRuntimeModqnServingCount(
  value: number | null | undefined,
): ModqnServingCount | undefined {
  return normalizePersistedModqnServingCount(value) ?? undefined;
}
