export interface OrbitElement {
  id: string;
  epochUtcMs: number;
  eccentricity: number;
  inclinationRad: number;
  raanRad: number;
  argPerigeeRad: number;
  meanAnomalyRad: number;
  meanMotionRevPerDay: number;
}

export interface ObserverContext {
  latDeg: number;
  lonDeg: number;
  latRad: number;
  lonRad: number;
  ecefKm: [number, number, number];
  sinLat: number;
  cosLat: number;
  sinLon: number;
  cosLon: number;
}

export interface OrbitPoint {
  ecefKm: [number, number, number];
  latDeg: number;
  lonDeg: number;
  altKm: number;
}

export interface TopocentricPoint {
  eastKm: number;
  northKm: number;
  upKm: number;
  rangeKm: number;
  azimuthDeg: number;
  elevationDeg: number;
}
