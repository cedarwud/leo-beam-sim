export interface BeamGeometry {
  footprintRadiusKm: number;
  spacingKm: number;
}

export interface BeamOffsetKm {
  beamId: number;
  dEastKm: number;
  dNorthKm: number;
}

export const FOOTPRINT_RADIUS_WORLD = 56;

export function computeBeamGeometry(
  altitudeKm: number,
  beamwidth3dBRad: number,
): BeamGeometry {
  const halfBeamRad = beamwidth3dBRad / 2;
  const footprintRadiusKm = altitudeKm * Math.tan(halfBeamRad);
  const spacingKm = footprintRadiusKm * Math.sqrt(3);
  return { footprintRadiusKm, spacingKm };
}

export function generateBeamOffsetsKm(
  spacingKm: number,
  maxBeams: number,
): BeamOffsetKm[] {
  const beams: BeamOffsetKm[] = [];
  let id = 1;

  beams.push({ beamId: id++, dEastKm: 0, dNorthKm: 0 });

  if (beams.length < maxBeams) {
    for (let i = 0; i < 6 && beams.length < maxBeams; i++) {
      const angle = (i / 6) * Math.PI * 2;
      beams.push({
        beamId: id++,
        dEastKm: Math.cos(angle) * spacingKm,
        dNorthKm: Math.sin(angle) * spacingKm,
      });
    }
  }

  if (beams.length < maxBeams) {
    for (let i = 0; i < 12 && beams.length < maxBeams; i++) {
      const angle = (i / 12) * Math.PI * 2;
      beams.push({
        beamId: id++,
        dEastKm: Math.cos(angle) * spacingKm * 2,
        dNorthKm: Math.sin(angle) * spacingKm * 2,
      });
    }
  }

  return beams;
}
