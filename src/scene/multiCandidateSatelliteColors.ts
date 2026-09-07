export interface AcceptedSatelliteColorSeed {
  readonly satelliteId: string;
  readonly cssColor: string;
}

export interface CandidateSatelliteColorSeed {
  readonly satelliteId: string;
  readonly satelliteColor: string;
}

export interface MultiCandidateSatelliteColorsInput {
  readonly acceptedSatelliteIdentities: readonly AcceptedSatelliteColorSeed[];
  readonly candidateSatelliteIdentities: readonly CandidateSatelliteColorSeed[];
  readonly ambientSatelliteIds: readonly string[];
  readonly resolveSceneSatelliteColor: (satelliteId: string, fallback: string) => string;
  readonly resolveAmbientFallbackColor: (satelliteId: string) => string;
}

/** Build the episode-stable satellite colour map with accepted identity precedence. */
export function resolveMultiCandidateSatelliteColors(
  input: MultiCandidateSatelliteColorsInput,
): Map<string, string> {
  const colors = new Map<string, string>();
  const setIfAbsent = (satelliteId: string, color: string | undefined): void => {
    if (color !== undefined && !colors.has(satelliteId)) colors.set(satelliteId, color);
  };

  for (const identity of input.acceptedSatelliteIdentities) {
    setIfAbsent(
      identity.satelliteId,
      input.resolveSceneSatelliteColor(identity.satelliteId, identity.cssColor),
    );
  }
  for (const identity of input.candidateSatelliteIdentities) {
    setIfAbsent(
      identity.satelliteId,
      input.resolveSceneSatelliteColor(identity.satelliteId, identity.satelliteColor),
    );
  }
  for (const satelliteId of input.ambientSatelliteIds) {
    setIfAbsent(satelliteId, input.resolveAmbientFallbackColor(satelliteId));
  }

  return colors;
}
