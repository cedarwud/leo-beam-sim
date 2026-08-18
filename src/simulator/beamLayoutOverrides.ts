import {
  assertSupportedBeamLayoutCount,
  type SupportedBeamLayoutCount,
} from '../core/beam/completeHexPresets';

/** Normalized per-satellite complete-ring choices used by frame producers. */
export type PerSatelliteBeamLayoutCount = Readonly<Record<string, SupportedBeamLayoutCount>>;

const EMPTY_OVERRIDES: PerSatelliteBeamLayoutCount = Object.freeze({});

function compareSatelliteIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Normalize and freeze the one override map shared by analysis and session
 * adapters.  Stable satellite IDs are trimmed, duplicate normalized IDs are
 * rejected, and insertion order is canonicalized for identity hashing.
 */
export function normalizePerSatelliteBeamLayoutCount(
  input: Readonly<Record<string, number>> | undefined,
): PerSatelliteBeamLayoutCount {
  if (input === undefined) return EMPTY_OVERRIDES;
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('perSatelliteBeamLayoutCount must be an object');
  }
  const entries = Object.entries(input)
    .map(([rawSatelliteId, rawBeamCount]) => {
      const satelliteId = rawSatelliteId.trim();
      if (satelliteId.length === 0) throw new RangeError('satellite override ID must be non-empty');
      return [satelliteId, assertSupportedBeamLayoutCount(rawBeamCount)] as const;
    })
    .sort((left, right) => compareSatelliteIds(left[0], right[0]));
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index]![0] === entries[index - 1]![0]) {
      throw new RangeError(`duplicate satellite override ID: ${entries[index]![0]}`);
    }
  }
  return Object.freeze(Object.fromEntries(entries) as PerSatelliteBeamLayoutCount);
}

/** Resolve a satellite-specific choice, falling back to the global preset. */
export function resolveBeamLayoutCountForSatellite(
  globalBeamLayoutCount: SupportedBeamLayoutCount | undefined,
  overrides: PerSatelliteBeamLayoutCount,
  satelliteId: string,
): SupportedBeamLayoutCount | undefined {
  const normalizedSatelliteId = satelliteId.trim();
  if (normalizedSatelliteId.length === 0) throw new RangeError('satelliteId must be non-empty');
  return overrides[normalizedSatelliteId] ?? globalBeamLayoutCount;
}
