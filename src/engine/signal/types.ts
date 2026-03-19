export interface LinkSample {
  satId: string;
  beamId: number;
  rsrpDbm: number;
  sinrDb: number;
}

export interface ActiveBeamAssignment {
  satId: string;
  beamId: number;
}

export interface SatelliteSnapshot {
  id: string;
  shellId: string;
  altitudeKm: number;
  ecefKm: [number, number, number];
  rangeKm: number;
  elevationDeg: number;
  azimuthDeg: number;
  /** Ground-projected beam cell centers in km offset from observer */
  beamCellsKm: {
    beamId: number;
    offsetEastKm: number;
    offsetNorthKm: number;
    scanAngleDeg: number;
  }[];
}

export interface UEPosition {
  latDeg: number;
  lonDeg: number;
  /** Offset from observer in km (east, north) — 0,0 = at observer */
  offsetEastKm: number;
  offsetNorthKm: number;
}
