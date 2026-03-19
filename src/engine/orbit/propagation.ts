import { degToRad, normalizeAngleRad, radToDeg } from './math';
import type { OrbitElement, OrbitPoint } from './types';

const MU_EARTH_KM3_S2 = 398600.4418;
const EARTH_A_KM = 6378.137;
const EARTH_F = 1 / 298.257223563;
const EARTH_B_KM = EARTH_A_KM * (1 - EARTH_F);
const TWO_PI = Math.PI * 2;
const DAY_SEC = 86400;

function solveEccentricAnomaly(meanAnomalyRad: number, eccentricity: number): number {
  let E = meanAnomalyRad;
  for (let i = 0; i < 8; i++) {
    const f = E - eccentricity * Math.sin(E) - meanAnomalyRad;
    const fPrime = 1 - eccentricity * Math.cos(E);
    E -= f / Math.max(fPrime, 1e-9);
  }
  return E;
}

function gmstRad(utcMs: number): number {
  const jd = utcMs / 86400000 + 2440587.5;
  const centuries = (jd - 2451545.0) / 36525.0;
  const gmstDeg =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * centuries * centuries -
    (centuries * centuries * centuries) / 38710000;
  return normalizeAngleRad(degToRad(gmstDeg));
}

function ecefToGeodetic(ecefKm: [number, number, number]): {
  latDeg: number;
  lonDeg: number;
  altKm: number;
} {
  const [x, y, z] = ecefKm;
  const e2 = 1 - (EARTH_B_KM * EARTH_B_KM) / (EARTH_A_KM * EARTH_A_KM);
  const p = Math.hypot(x, y);
  const lonRad = Math.atan2(y, x);

  let latRad = Math.atan2(z, p * (1 - e2));
  let altKm = 0;

  for (let i = 0; i < 6; i++) {
    const sinLat = Math.sin(latRad);
    const n = EARTH_A_KM / Math.sqrt(1 - e2 * sinLat * sinLat);
    altKm = p / Math.max(Math.cos(latRad), 1e-9) - n;
    latRad = Math.atan2(z, p * (1 - (e2 * n) / Math.max(n + altKm, 1e-9)));
  }

  return { latDeg: radToDeg(latRad), lonDeg: radToDeg(lonRad), altKm };
}

export function propagateOrbitElement(
  element: OrbitElement,
  atUtcMs: number,
): OrbitPoint {
  const meanMotionRadPerSec = (element.meanMotionRevPerDay * TWO_PI) / DAY_SEC;
  const semiMajorAxisKm = Math.cbrt(
    MU_EARTH_KM3_S2 / (meanMotionRadPerSec * meanMotionRadPerSec),
  );
  const deltaSec = (atUtcMs - element.epochUtcMs) / 1000;
  const meanAnomalyRad = normalizeAngleRad(
    element.meanAnomalyRad + meanMotionRadPerSec * deltaSec,
  );
  const E = solveEccentricAnomaly(meanAnomalyRad, element.eccentricity);

  const trueAnomaly =
    2 * Math.atan2(
      Math.sqrt(1 + element.eccentricity) * Math.sin(E / 2),
      Math.sqrt(1 - element.eccentricity) * Math.cos(E / 2),
    );

  const radiusKm = semiMajorAxisKm * (1 - element.eccentricity * Math.cos(E));
  const u = element.argPerigeeRad + trueAnomaly;

  const cosO = Math.cos(element.raanRad);
  const sinO = Math.sin(element.raanRad);
  const cosI = Math.cos(element.inclinationRad);
  const sinI = Math.sin(element.inclinationRad);
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);

  const xEci = radiusKm * (cosO * cosU - sinO * sinU * cosI);
  const yEci = radiusKm * (sinO * cosU + cosO * sinU * cosI);
  const zEci = radiusKm * (sinU * sinI);

  const theta = gmstRad(atUtcMs);
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  const xEcef = cosT * xEci + sinT * yEci;
  const yEcef = -sinT * xEci + cosT * yEci;
  const zEcef = zEci;

  const geo = ecefToGeodetic([xEcef, yEcef, zEcef]);

  return {
    ecefKm: [xEcef, yEcef, zEcef],
    latDeg: geo.latDeg,
    lonDeg: geo.lonDeg,
    altKm: geo.altKm,
  };
}
