import { EARTH_KM_PER_DEG } from '../orbit/earth-constants';

export type EcefVectorKm = readonly [number, number, number];

export interface BeamGroundPoint {
  readonly latDeg: number;
  readonly lonDeg: number;
  readonly eastKm: number;
  readonly northKm: number;
}

export interface ResolvedBeamPointing {
  /** Unit boresight direction from the satellite in the ECEF frame. */
  readonly axisEcefKm: EcefVectorKm;
  /** Where that boresight intersects the spherical Earth surface. */
  readonly ground: BeamGroundPoint;
}

const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;

/** Resolve the unit ECEF boresight from a satellite to a ground target. */
export function computeBoresightAxisEcefKm(input: {
  readonly satLatDeg: number;
  readonly satLonDeg: number;
  readonly satAltitudeKm: number;
  readonly targetLatDeg: number;
  readonly targetLonDeg: number;
}): EcefVectorKm {
  const sat = geodeticToEcefKm(input.satLatDeg, input.satLonDeg, input.satAltitudeKm);
  const target = geodeticToEcefKm(input.targetLatDeg, input.targetLonDeg, 0);
  return normalize([target[0] - sat[0], target[1] - sat[1], target[2] - sat[2]]);
}

/**
 * Intersect a satellite-origin ray with the spherical Earth surface.
 * Returns null when the held direction no longer reaches the visible Earth.
 */
export function intersectBeamAxisWithEarth(input: {
  readonly satLatDeg: number;
  readonly satLonDeg: number;
  readonly satAltitudeKm: number;
  readonly axisEcefKm: EcefVectorKm;
  readonly observerLatDeg: number;
  readonly observerLonDeg: number;
}): BeamGroundPoint | null {
  const satellite = geodeticToEcefKm(input.satLatDeg, input.satLonDeg, input.satAltitudeKm);
  const axis = normalize(input.axisEcefKm);
  const b = 2 * dotVector(satellite, axis);
  const c = dotVector(satellite, satellite) - (EARTH_RADIUS_KM * EARTH_RADIUS_KM);
  const discriminant = (b * b) - (4 * c);
  if (discriminant < 0) return null;

  const nearRoot = (-b - Math.sqrt(discriminant)) / 2;
  if (!(nearRoot > 0) || !Number.isFinite(nearRoot)) return null;

  const point: Ecef = {
    x: satellite[0] + nearRoot * axis[0],
    y: satellite[1] + nearRoot * axis[1],
    z: satellite[2] + nearRoot * axis[2],
  };
  const horizontalRadius = Math.hypot(point.x, point.y);
  const latDeg = Math.atan2(point.z, horizontalRadius) / DEG_TO_RAD;
  const lonDeg = Math.atan2(point.y, point.x) / DEG_TO_RAD;
  const cosObserverLat = Math.cos(input.observerLatDeg * DEG_TO_RAD);
  return {
    latDeg,
    lonDeg,
    eastKm: (lonDeg - input.observerLonDeg) * EARTH_KM_PER_DEG * cosObserverLat,
    northKm: (latDeg - input.observerLatDeg) * EARTH_KM_PER_DEG,
  };
}

/** Resolve a current or held axis to one consistent ground footprint centre. */
export function resolveBeamPointing(input: {
  readonly satLatDeg: number;
  readonly satLonDeg: number;
  readonly satAltitudeKm: number;
  readonly targetLatDeg: number;
  readonly targetLonDeg: number;
  readonly observerLatDeg: number;
  readonly observerLonDeg: number;
  readonly axisEcefKm?: EcefVectorKm;
}): ResolvedBeamPointing {
  const axisEcefKm = input.axisEcefKm ?? computeBoresightAxisEcefKm(input);
  const ground = intersectBeamAxisWithEarth({
    satLatDeg: input.satLatDeg,
    satLonDeg: input.satLonDeg,
    satAltitudeKm: input.satAltitudeKm,
    axisEcefKm,
    observerLatDeg: input.observerLatDeg,
    observerLonDeg: input.observerLonDeg,
  });
  if (ground !== null) return { axisEcefKm: normalize(axisEcefKm), ground };

  return {
    axisEcefKm: normalize(axisEcefKm),
    ground: {
      latDeg: input.targetLatDeg,
      lonDeg: input.targetLonDeg,
      eastKm: (input.targetLonDeg - input.observerLonDeg)
        * EARTH_KM_PER_DEG
        * Math.cos(input.observerLatDeg * DEG_TO_RAD),
      northKm: (input.targetLatDeg - input.observerLatDeg) * EARTH_KM_PER_DEG,
    },
  };
}

interface Ecef {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function geodeticToEcefKm(latDeg: number, lonDeg: number, altitudeKm: number): EcefVectorKm {
  const radiusKm = EARTH_RADIUS_KM + altitudeKm;
  const latRad = latDeg * DEG_TO_RAD;
  const lonRad = lonDeg * DEG_TO_RAD;
  const cosLat = Math.cos(latRad);
  return [
    radiusKm * cosLat * Math.cos(lonRad),
    radiusKm * cosLat * Math.sin(lonRad),
    radiusKm * Math.sin(latRad),
  ];
}

function normalize(vector: EcefVectorKm): EcefVectorKm {
  const length = Math.sqrt((vector[0] * vector[0]) + (vector[1] * vector[1]) + (vector[2] * vector[2]));
  if (!(length > 0) || !Number.isFinite(length)) return [0, 0, -1];
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function dotVector(a: EcefVectorKm, b: EcefVectorKm): number {
  return (a[0] * b[0]) + (a[1] * b[1]) + (a[2] * b[2]);
}
