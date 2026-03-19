import { degToRad } from './math';
import type { OrbitElement } from './types';

const TWO_PI = Math.PI * 2;
const DAY_SEC = 86400;
const MU_EARTH_KM3_S2 = 398600.4418;
const EARTH_RADIUS_KM = 6378.137;

/**
 * Generate Walker delta constellation orbital elements.
 * Walker(i, T, P, F=1): T total sats, P planes, phase factor F=1.
 */
export function generateWalkerConstellation(config: {
  altitudeKm: number;
  inclinationDeg: number;
  planes: number;
  satsPerPlane: number;
  epochUtcMs: number;
}): OrbitElement[] {
  const { altitudeKm, inclinationDeg, planes, satsPerPlane, epochUtcMs } = config;
  const semiMajorKm = EARTH_RADIUS_KM + altitudeKm;
  const meanMotionRadPerSec = Math.sqrt(MU_EARTH_KM3_S2 / (semiMajorKm ** 3));
  const meanMotionRevPerDay = (meanMotionRadPerSec * DAY_SEC) / TWO_PI;
  const incRad = degToRad(inclinationDeg);

  const elements: OrbitElement[] = [];

  for (let p = 0; p < planes; p++) {
    const raanRad = (TWO_PI * p) / planes;
    for (let s = 0; s < satsPerPlane; s++) {
      // Walker delta with phase factor F=13 (coprime with typical plane counts).
      // Inter-plane phase offset = F * 2π / T, spreads satellites temporally
      // so adjacent planes don't have synchronized passes.
      const F = 13;
      const meanAnomalyRad = (TWO_PI * s) / satsPerPlane + (TWO_PI * p * F) / (planes * satsPerPlane);
      elements.push({
        id: `P${p}-S${s}`,
        epochUtcMs,
        eccentricity: 0.0001, // near-circular
        inclinationRad: incRad,
        raanRad,
        argPerigeeRad: 0,
        meanAnomalyRad: meanAnomalyRad % TWO_PI,
        meanMotionRevPerDay,
      });
    }
  }

  return elements;
}
