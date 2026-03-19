import { clamp, degToRad, radToDeg } from './math';
import type { ObserverContext, TopocentricPoint } from './types';

const EARTH_A_KM = 6378.137;
const EARTH_F = 1 / 298.257223563;
const EARTH_B_KM = EARTH_A_KM * (1 - EARTH_F);

function geodeticToEcef(
  latDeg: number,
  lonDeg: number,
  altKm: number,
): [number, number, number] {
  const latRad = degToRad(latDeg);
  const lonRad = degToRad(lonDeg);
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinLon = Math.sin(lonRad);
  const cosLon = Math.cos(lonRad);
  const e2 = 1 - (EARTH_B_KM * EARTH_B_KM) / (EARTH_A_KM * EARTH_A_KM);
  const n = EARTH_A_KM / Math.sqrt(1 - e2 * sinLat * sinLat);

  return [
    (n + altKm) * cosLat * cosLon,
    (n + altKm) * cosLat * sinLon,
    (n * (1 - e2) + altKm) * sinLat,
  ];
}

export function createObserverContext(
  latDeg: number,
  lonDeg: number,
  altKm = 0,
): ObserverContext {
  const latRad = degToRad(latDeg);
  const lonRad = degToRad(lonDeg);
  return {
    latDeg,
    lonDeg,
    latRad,
    lonRad,
    ecefKm: geodeticToEcef(latDeg, lonDeg, altKm),
    sinLat: Math.sin(latRad),
    cosLat: Math.cos(latRad),
    sinLon: Math.sin(lonRad),
    cosLon: Math.cos(lonRad),
  };
}

export function computeTopocentricPoint(
  observer: ObserverContext,
  satEcefKm: [number, number, number],
): TopocentricPoint {
  const dx = satEcefKm[0] - observer.ecefKm[0];
  const dy = satEcefKm[1] - observer.ecefKm[1];
  const dz = satEcefKm[2] - observer.ecefKm[2];

  const eastKm = -observer.sinLon * dx + observer.cosLon * dy;
  const northKm =
    -observer.sinLat * observer.cosLon * dx -
    observer.sinLat * observer.sinLon * dy +
    observer.cosLat * dz;
  const upKm =
    observer.cosLat * observer.cosLon * dx +
    observer.cosLat * observer.sinLon * dy +
    observer.sinLat * dz;

  const rangeKm = Math.hypot(eastKm, northKm, upKm);
  const elevationRad = Math.asin(clamp(upKm / Math.max(rangeKm, 1e-9), -1, 1));
  let azimuthDeg = radToDeg(Math.atan2(eastKm, northKm));
  if (azimuthDeg < 0) azimuthDeg += 360;

  return { eastKm, northKm, upKm, rangeKm, azimuthDeg, elevationDeg: radToDeg(elevationRad) };
}
