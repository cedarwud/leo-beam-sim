import { degToRad } from './math';
import type { OrbitElement } from './types';
import type { Shell } from '../../profiles/types';

const TWO_PI = Math.PI * 2;
const DAY_SEC = 86400;
const MU_EARTH_KM3_S2 = 398600.4418;
const EARTH_RADIUS_KM = 6378.137;

/**
 * Generate Walker delta constellation orbital elements.
 * Each shell uses a standard Walker(i, T, P, F=1) pattern and is combined into
 * one synthetic multi-shell constellation.
 */
export function generateWalkerConstellation(config: {
  shells: Shell[];
  epochUtcMs: number;
}): OrbitElement[] {
  const elements: OrbitElement[] = [];

  for (const shell of config.shells) {
    const semiMajorKm = EARTH_RADIUS_KM + shell.altitudeKm;
    const meanMotionRadPerSec = Math.sqrt(MU_EARTH_KM3_S2 / (semiMajorKm ** 3));
    const meanMotionRevPerDay = (meanMotionRadPerSec * DAY_SEC) / TWO_PI;
    const incRad = degToRad(shell.inclinationDeg);
    const totalSats = shell.planes * shell.satsPerPlane;

    for (let p = 0; p < shell.planes; p++) {
      const raanRad = (TWO_PI * p) / shell.planes;
      for (let s = 0; s < shell.satsPerPlane; s++) {
        const meanAnomalyRad =
          (TWO_PI * s) / shell.satsPerPlane + (TWO_PI * p) / Math.max(totalSats, 1);
        elements.push({
          id: `${shell.id}-P${p}-S${s}`,
          shellId: shell.id,
          altitudeKm: shell.altitudeKm,
          epochUtcMs: config.epochUtcMs,
          eccentricity: 0.0001,
          inclinationRad: incRad,
          raanRad,
          argPerigeeRad: 0,
          meanAnomalyRad: meanAnomalyRad % TWO_PI,
          meanMotionRevPerDay,
        });
      }
    }
  }

  return elements;
}
