export interface BeamGeometry {
  footprintRadiusKm: number;
  spacingKm: number;
}

export interface BeamOffsetKm {
  beamId: number;
  dEastKm: number;
  dNorthKm: number;
}

export const MAX_BEAMS_PER_SATELLITE = 7;
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
  const beamLimit = Math.min(Math.floor(maxBeams), MAX_BEAMS_PER_SATELLITE);
  if (beamLimit <= 0) return [];

  const beams: BeamOffsetKm[] = [];
  let id = 1;

  beams.push({ beamId: id++, dEastKm: 0, dNorthKm: 0 });
  for (let ring = 1; beams.length < beamLimit; ring++) {
    const ringBeams = 6 * ring;
    for (let i = 0; i < ringBeams && beams.length < beamLimit; i++) {
      const angle = (i / ringBeams) * Math.PI * 2;
      beams.push({
        beamId: id++,
        dEastKm: Math.cos(angle) * spacingKm * ring,
        dNorthKm: Math.sin(angle) * spacingKm * ring,
      });
    }
  }

  return beams;
}
