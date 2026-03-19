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
  if (maxBeams <= 0) return [];

  const beams: BeamOffsetKm[] = [];
  let id = 1;

  beams.push({ beamId: id++, dEastKm: 0, dNorthKm: 0 });
  for (let ring = 1; beams.length < maxBeams; ring++) {
    const ringBeams = 6 * ring;
    for (let i = 0; i < ringBeams && beams.length < maxBeams; i++) {
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
