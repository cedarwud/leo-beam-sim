export type Tr38811LosEnvironment = 'dense-urban' | 'suburban';

const ELEVATIONS_DEG = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;

const DENSE_URBAN_LOS_PROB = [
  0.282,
  0.331,
  0.398,
  0.468,
  0.537,
  0.612,
  0.738,
  0.82,
  0.981,
] as const;

const SUBURBAN_LOS_PROB = [
  0.782,
  0.869,
  0.919,
  0.929,
  0.935,
  0.94,
  0.949,
  0.952,
  0.998,
] as const;

function clampElevationDeg(elevationDeg: number): number {
  return Math.max(ELEVATIONS_DEG[0], Math.min(ELEVATIONS_DEG[ELEVATIONS_DEG.length - 1], elevationDeg));
}

function nearestReferenceIndex(elevationDeg: number): number {
  const roundedElevationDeg = Math.round(clampElevationDeg(elevationDeg) / 10) * 10;
  const idx = ELEVATIONS_DEG.findIndex(value => value === roundedElevationDeg);
  return idx >= 0 ? idx : 0;
}

function probabilityTableForEnvironment(
  environment: Tr38811LosEnvironment,
): readonly number[] {
  if (environment === 'dense-urban') {
    return DENSE_URBAN_LOS_PROB;
  }
  return SUBURBAN_LOS_PROB;
}

function hashStringToUnitInterval(seedKey: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seedKey.length; i++) {
    hash ^= seedKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x100000000;
}

export function getLosProbabilityTr38811(
  elevationDeg: number,
  environment: Tr38811LosEnvironment,
): number {
  return probabilityTableForEnvironment(environment)[nearestReferenceIndex(elevationDeg)];
}

export function sampleLosStateTr38811(
  elevationDeg: number,
  environment: Tr38811LosEnvironment,
  seedKey: string,
): boolean {
  return hashStringToUnitInterval(seedKey) < getLosProbabilityTr38811(elevationDeg, environment);
}
