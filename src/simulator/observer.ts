import {
  degreesToRadians,
  ecfToEci,
  ecfToLookAngles,
  eciToEcf,
  geodeticToEcf,
  gstime,
  radiansToDegrees,
  type EciVec3,
} from 'satellite.js';
import type { Vector3 } from '../tle/types';

/** Authoritative WGS84 observer used by the NTPU archived-TLE run. */
export const NTPU_TLE_OBSERVER = Object.freeze({
  id: 'ntpu-wgs84-v1',
  label: 'NTPU',
  latitudeDeg: 24.9441667,
  longitudeDeg: 121.3713889,
  heightKm: 0.05,
});

export type TleObserver = typeof NTPU_TLE_OBSERVER;

export interface ObserverLinkGeometry {
  readonly azimuthDeg: number;
  readonly elevationDeg: number;
  readonly rangeKm: number;
  readonly offAxisAngleRad: number;
  readonly visible: boolean;
  readonly groundPositionTemeKm: Vector3;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
}

function vector(value: { readonly x: number; readonly y: number; readonly z: number }): Vector3 {
  return Object.freeze({
    x: finite(value.x, 'x'),
    y: finite(value.y, 'y'),
    z: finite(value.z, 'z'),
  });
}

function subtract(
  left: { readonly x: number; readonly y: number; readonly z: number },
  right: { readonly x: number; readonly y: number; readonly z: number },
): Vector3 {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
    z: left.z - right.z,
  };
}

function dot(left: Vector3, right: Vector3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function unit(value: Vector3): Vector3 {
  const length = Math.hypot(value.x, value.y, value.z);
  if (!Number.isFinite(length) || length <= 0) throw new Error('observer geometry vector must be non-zero');
  return { x: value.x / length, y: value.y / length, z: value.z / length };
}

function normalizeAzimuth(value: number): number {
  return ((value % 360) + 360) % 360;
}

/**
 * Convert an SGP4 TEME position into one authoritative NTPU topocentric view.
 * The same result feeds pass selection, campus projection, and canonical link
 * geometry so those consumers cannot silently drift to different observers.
 */
export function deriveObserverLinkGeometry(
  positionTemeKm: Vector3,
  instantUtc: string,
  observer: TleObserver = NTPU_TLE_OBSERVER,
): ObserverLinkGeometry {
  const instantMs = Date.parse(instantUtc);
  if (!Number.isFinite(instantMs)) throw new Error(`invalid observer instantUtc: ${instantUtc}`);

  const observerGeodetic = {
    latitude: degreesToRadians(observer.latitudeDeg),
    longitude: degreesToRadians(observer.longitudeDeg),
    height: observer.heightKm,
  };
  const gmst = gstime(new Date(instantMs));
  const satelliteEcf = eciToEcf(positionTemeKm as EciVec3<number>, gmst);
  const groundEcf = geodeticToEcf(observerGeodetic);
  const look = ecfToLookAngles(observerGeodetic, satelliteEcf);
  const satelliteToGround = unit(subtract(groundEcf, satelliteEcf));
  const satelliteNadir = unit({
    x: -satelliteEcf.x,
    y: -satelliteEcf.y,
    z: -satelliteEcf.z,
  });
  const offAxisAngleRad = Math.acos(Math.min(1, Math.max(-1, dot(satelliteNadir, satelliteToGround))));
  const elevationDeg = finite(radiansToDegrees(look.elevation), 'elevationDeg');
  const rangeKm = finite(look.rangeSat, 'rangeKm');
  if (rangeKm <= 0) throw new Error('rangeKm must be positive');

  return Object.freeze({
    azimuthDeg: normalizeAzimuth(finite(radiansToDegrees(look.azimuth), 'azimuthDeg')),
    elevationDeg,
    rangeKm,
    offAxisAngleRad,
    visible: elevationDeg >= 0,
    groundPositionTemeKm: vector(ecfToEci(groundEcf, gmst)),
  });
}
