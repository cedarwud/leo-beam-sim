import { EARTH_KM_PER_DEG } from '../orbit/earth-constants';

export interface CellCenter {
  /** Deterministic cell ID 0..N-1, stable across runs. */
  readonly cellId: number;
  /** Earth-fixed lat/lon (WGS84-equivalent, spherical-Earth OK). */
  readonly latDeg: number;
  readonly lonDeg: number;
  /** Local ENU coords relative to service area center (km). x = east, y = north. */
  readonly localXKm: number;
  readonly localYKm: number;
}

export interface CellLayout {
  readonly count: number;
  readonly centers: readonly CellCenter[];
  readonly serviceArea: {
    readonly centerLatDeg: number;
    readonly centerLonDeg: number;
    readonly widthKm: number;
    readonly heightKm: number;
  };
  readonly cellRadiusKm: number;
  readonly altitudeKm: number;
  readonly beamwidth3dBRad: number;
}

export interface CellLayoutConfig {
  readonly centerLatDeg: number;
  readonly centerLonDeg: number;
  readonly altitudeKm: number;
  readonly beamwidth3dBRad: number;
  /** Optional override; default 37. */
  readonly cellCount?: number;
  /**
   * Optional lattice PHASE offset in CELL RADII (east, north). Shifts EVERY cell
   * centre by `cellRadius · offset` (so the offset is scale-free w.r.t. the beam
   * footprint). It lets a caller move a fixed ground point off a cell centre —
   * the SINR-live lane uses it so the ENU origin (= the observer-anchored
   * protagonist UE) sits OFF cell-0's centre instead of dead-centre (beam-stage
   * ① fix). Default = no shift, so every other caller (the MODQN/producer
   * `useCellSchedule` round-robin geometry) is byte-identical.
   */
  readonly phaseOffsetRadii?: { readonly east: number; readonly north: number };
}

interface AxialCoordinate {
  readonly q: number;
  readonly r: number;
}

interface EcefKm {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const SERVICE_AREA_WIDTH_KM = 200;
export const SERVICE_AREA_HEIGHT_KM = 90;
export const DEFAULT_CELL_COUNT = 37;
export const DEFAULT_MIN_ELEVATION_DEG = 15;

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEG = EARTH_KM_PER_DEG;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Compute deterministic Earth-fixed hex cells for SDD §4.1.
 *
 * The cell radius follows the same pure beam footprint formula used by
 * `computeBeamGeometry`: r_cell = altitude_km * tan(theta_3dB / 2).
 * Centers are generated as pointy-top axial hexes in expanding rings, with
 * IDs assigned ring-then-CCW from east.
 */
export function buildCellLayout(config: CellLayoutConfig): CellLayout {
  assertFinite(config.centerLatDeg, 'centerLatDeg');
  assertFinite(config.centerLonDeg, 'centerLonDeg');
  assertPositiveFinite(config.altitudeKm, 'altitudeKm');
  assertPositiveFinite(config.beamwidth3dBRad, 'beamwidth3dBRad');

  const count = config.cellCount ?? DEFAULT_CELL_COUNT;
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`cellCount must be a positive integer; got ${count}`);
  }

  const cellRadiusKm = config.altitudeKm * Math.tan(config.beamwidth3dBRad / 2);
  // Lattice phase offset (km), scaled from the cell-radius-relative config. Zero
  // when unset → byte-identical to the pre-phase layout for every default caller.
  const phaseXKm = cellRadiusKm * (config.phaseOffsetRadii?.east ?? 0);
  const phaseYKm = cellRadiusKm * (config.phaseOffsetRadii?.north ?? 0);
  const coordinates = generateAxialCoordinates(count);
  const centers = coordinates.map((coordinate, index): CellCenter => {
    const local = axialToLocalKm(coordinate, cellRadiusKm);
    const localXKm = local.localXKm + phaseXKm;
    const localYKm = local.localYKm + phaseYKm;
    const latLon = localKmToLatLon(
      config.centerLatDeg,
      config.centerLonDeg,
      localXKm,
      localYKm,
    );

    return {
      cellId: index,
      latDeg: latLon.latDeg,
      lonDeg: latLon.lonDeg,
      localXKm,
      localYKm,
    };
  });

  return {
    count,
    centers,
    serviceArea: {
      centerLatDeg: config.centerLatDeg,
      centerLonDeg: config.centerLonDeg,
      widthKm: SERVICE_AREA_WIDTH_KM,
      heightKm: SERVICE_AREA_HEIGHT_KM,
    },
    cellRadiusKm,
    altitudeKm: config.altitudeKm,
    beamwidth3dBRad: config.beamwidth3dBRad,
  };
}

/**
 * Convert satellite geodetic position plus a surface cell center into an
 * elevation angle. SDD §4.4 uses this as the scheduler visibility constraint:
 * cells assigned to a satellite must be above the configured elevation mask.
 */
export function elevationAngleRad(
  satLatDeg: number,
  satLonDeg: number,
  satAltitudeKm: number,
  cellLatDeg: number,
  cellLonDeg: number,
): number {
  assertFinite(satLatDeg, 'satLatDeg');
  assertFinite(satLonDeg, 'satLonDeg');
  assertPositiveFinite(satAltitudeKm, 'satAltitudeKm');
  assertFinite(cellLatDeg, 'cellLatDeg');
  assertFinite(cellLonDeg, 'cellLonDeg');

  const satellite = geodeticToEcefKm(satLatDeg, satLonDeg, satAltitudeKm);
  const cell = geodeticToEcefKm(cellLatDeg, cellLonDeg, 0);
  const up = geodeticUnitUp(cellLatDeg, cellLonDeg);
  const lineOfSight = {
    x: satellite.x - cell.x,
    y: satellite.y - cell.y,
    z: satellite.z - cell.z,
  };
  const rangeKm = vectorNorm(lineOfSight);
  const sinElevation = dot(lineOfSight, up) / rangeKm;

  return Math.asin(clamp(sinElevation, -1, 1));
}

/** Visibility check: elevation > minElevationDeg (default 15°). */
export function isCellVisibleFromSatellite(
  satLatDeg: number,
  satLonDeg: number,
  satAltitudeKm: number,
  cell: Pick<CellCenter, 'latDeg' | 'lonDeg'>,
  minElevationDeg = DEFAULT_MIN_ELEVATION_DEG,
): boolean {
  assertFinite(minElevationDeg, 'minElevationDeg');
  const elevation = elevationAngleRad(
    satLatDeg,
    satLonDeg,
    satAltitudeKm,
    cell.latDeg,
    cell.lonDeg,
  );

  return elevation > minElevationDeg * DEG_TO_RAD;
}

/** Local ENU (km) -> lat/lon offset, spherical Earth / flat local patch. */
export function localKmToLatLon(
  centerLatDeg: number,
  centerLonDeg: number,
  eastKm: number,
  northKm: number,
): { latDeg: number; lonDeg: number } {
  assertFinite(centerLatDeg, 'centerLatDeg');
  assertFinite(centerLonDeg, 'centerLonDeg');
  assertFinite(eastKm, 'eastKm');
  assertFinite(northKm, 'northKm');

  const cosLat = Math.cos(centerLatDeg * DEG_TO_RAD);
  if (Math.abs(cosLat) < 1e-12) {
    throw new Error('localKmToLatLon cannot resolve longitude at the poles');
  }

  return {
    latDeg: centerLatDeg + (northKm / KM_PER_DEG),
    lonDeg: centerLonDeg + (eastKm / (KM_PER_DEG * cosLat)),
  };
}

function generateAxialCoordinates(count: number): AxialCoordinate[] {
  const coordinates: AxialCoordinate[] = [{ q: 0, r: 0 }];

  for (let ring = 1; coordinates.length < count; ring += 1) {
    for (const coordinate of generateRingAxialCoordinates(ring)) {
      coordinates.push(coordinate);
      if (coordinates.length === count) {
        break;
      }
    }
  }

  if (count === 37) {
    const filtered = coordinates.filter(coord => coord.r !== 3 && coord.r !== -3);
    const corners: AxialCoordinate[] = [
      // Northeast (top-right)
      { q: 3, r: 1 },
      { q: 2, r: 2 },
      // Northwest (top-left)
      { q: -4, r: 1 },
      { q: -4, r: 2 },
      // Southeast (bottom-right)
      { q: 4, r: -1 },
      { q: 4, r: -2 },
      // Southwest (bottom-left)
      { q: -3, r: -1 },
      { q: -2, r: -2 },
    ];
    return [...filtered, ...corners];
  }

  return coordinates;
}

function generateRingAxialCoordinates(ring: number): AxialCoordinate[] {
  const coordinates: AxialCoordinate[] = [];
  const directions: readonly AxialCoordinate[] = [
    { q: -1, r: 1 },
    { q: -1, r: 0 },
    { q: 0, r: -1 },
    { q: 1, r: -1 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
  ];
  let q = ring;
  let r = 0;

  for (const direction of directions) {
    for (let step = 0; step < ring; step += 1) {
      coordinates.push({ q, r });
      q += direction.q;
      r += direction.r;
    }
  }

  return coordinates;
}

function axialToLocalKm(
  coordinate: AxialCoordinate,
  cellRadiusKm: number,
): { localXKm: number; localYKm: number } {
  return {
    localXKm: cellRadiusKm * Math.sqrt(3) * (coordinate.q + (coordinate.r / 2)),
    localYKm: cellRadiusKm * 1.5 * coordinate.r,
  };
}

function geodeticToEcefKm(latDeg: number, lonDeg: number, altitudeKm: number): EcefKm {
  const radiusKm = EARTH_RADIUS_KM + altitudeKm;
  const latRad = latDeg * DEG_TO_RAD;
  const lonRad = lonDeg * DEG_TO_RAD;
  const cosLat = Math.cos(latRad);

  return {
    x: radiusKm * cosLat * Math.cos(lonRad),
    y: radiusKm * cosLat * Math.sin(lonRad),
    z: radiusKm * Math.sin(latRad),
  };
}

function geodeticUnitUp(latDeg: number, lonDeg: number): EcefKm {
  const latRad = latDeg * DEG_TO_RAD;
  const lonRad = lonDeg * DEG_TO_RAD;
  const cosLat = Math.cos(latRad);

  return {
    x: cosLat * Math.cos(lonRad),
    y: cosLat * Math.sin(lonRad),
    z: Math.sin(latRad),
  };
}

function dot(a: EcefKm, b: EcefKm): number {
  return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}

function vectorNorm(vector: EcefKm): number {
  return Math.sqrt(dot(vector, vector));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be finite; got ${value}`);
  }
}

function assertPositiveFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be positive; got ${value}`);
  }
}
