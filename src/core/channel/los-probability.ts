/**
 * 3GPP TR 38.811 LOS probability lookup.
 *
 * Source: Table 6.6.1-1 (LOS probability by environment and elevation angle)
 *
 * The standard specifies nearest-reference-angle lookup over 10°..90° in 10° steps.
 * This file keeps that rule explicit instead of smoothing the table.
 */

import type { DeploymentEnvironment } from './types';

const ELEVATIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90] as const;

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

const SUBURBAN_RURAL_LOS_PROB = [
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
  return Math.max(ELEVATIONS[0], Math.min(ELEVATIONS[ELEVATIONS.length - 1], elevationDeg));
}

function nearestReferenceIndex(elevationDeg: number): number {
  const clamped = clampElevationDeg(elevationDeg);
  const rounded = Math.round(clamped / 10) * 10;
  const idx = ELEVATIONS.findIndex((value) => value === rounded);
  return idx >= 0 ? idx : 0;
}

function probabilityTableForEnvironment(
  environment: DeploymentEnvironment,
): readonly number[] {
  if (environment === 'dense-urban') {
    return DENSE_URBAN_LOS_PROB;
  }
  return SUBURBAN_RURAL_LOS_PROB;
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
  environment: DeploymentEnvironment,
): number {
  const table = probabilityTableForEnvironment(environment);
  return table[nearestReferenceIndex(elevationDeg)];
}

export function sampleLosStateTr38811(
  elevationDeg: number,
  environment: DeploymentEnvironment,
  seedKey: string,
): boolean {
  return hashStringToUnitInterval(seedKey) < getLosProbabilityTr38811(elevationDeg, environment);
}
