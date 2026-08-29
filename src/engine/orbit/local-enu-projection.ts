import { EARTH_KM_PER_DEG } from './earth-constants';

export interface GeodeticCoordinate {
  readonly latDeg: number;
  readonly lonDeg: number;
}

export interface LocalEnuCoordinateKm {
  readonly eastKm: number;
  readonly northKm: number;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

function validateLatitude(latDeg: number, label: string): number {
  finite(latDeg, label);
  if (latDeg < -90 || latDeg > 90) throw new RangeError(`${label} must be inside [-90, 90]`);
  return latDeg;
}

/** Normalize a longitude or longitude delta to the closed [-180, 180] range. */
export function normalizeLongitudeDeg(lonDeg: number): number {
  finite(lonDeg, 'longitude');
  let normalized = lonDeg;
  while (normalized > 180) normalized -= 360;
  while (normalized < -180) normalized += 360;
  return normalized;
}

/**
 * Existing Walker local-ground approximation: 111.32 km/degree with the
 * observer latitude supplying the east-west cosine correction.
 */
export function projectGeodeticToLocalEnuKm(
  observer: GeodeticCoordinate,
  point: GeodeticCoordinate,
): LocalEnuCoordinateKm {
  const observerLatDeg = validateLatitude(observer.latDeg, 'observer.latDeg');
  const observerLonDeg = normalizeLongitudeDeg(observer.lonDeg);
  const pointLatDeg = validateLatitude(point.latDeg, 'point.latDeg');
  const pointLonDeg = normalizeLongitudeDeg(point.lonDeg);
  const cosObserverLat = Math.max(Math.abs(Math.cos(observerLatDeg * Math.PI / 180)), 1e-6);
  return Object.freeze({
    eastKm: normalizeLongitudeDeg(pointLonDeg - observerLonDeg) * EARTH_KM_PER_DEG * cosObserverLat,
    northKm: (pointLatDeg - observerLatDeg) * EARTH_KM_PER_DEG,
  });
}

/** Inverse of projectGeodeticToLocalEnuKm under the same flat local model. */
export function projectLocalEnuKmToGeodetic(
  observer: GeodeticCoordinate,
  point: LocalEnuCoordinateKm,
): GeodeticCoordinate {
  const observerLatDeg = validateLatitude(observer.latDeg, 'observer.latDeg');
  const observerLonDeg = normalizeLongitudeDeg(observer.lonDeg);
  const eastKm = finite(point.eastKm, 'point.eastKm');
  const northKm = finite(point.northKm, 'point.northKm');
  const cosObserverLat = Math.max(Math.abs(Math.cos(observerLatDeg * Math.PI / 180)), 1e-6);
  const latDeg = observerLatDeg + northKm / EARTH_KM_PER_DEG;
  validateLatitude(latDeg, 'projected latDeg');
  return Object.freeze({
    latDeg,
    lonDeg: normalizeLongitudeDeg(observerLonDeg + eastKm / (EARTH_KM_PER_DEG * cosObserverLat)),
  });
}
