const EARTH_RADIUS_KM = 6378.137;

/**
 * 3GPP TR 38.811 Eq. (6.6-3): slant range as a function of elevation angle.
 * `alpha` is the link elevation, not the HOBS beam off-axis angle.
 */
export function computeTr38811SlantRangeKm(
  elevationDeg: number,
  altitudeKm: number,
  earthRadiusKm: number = EARTH_RADIUS_KM,
): number {
  const alphaRad = (elevationDeg * Math.PI) / 180;
  const sinAlpha = Math.sin(alphaRad);

  const rangeKm = Math.sqrt(
    (earthRadiusKm * earthRadiusKm * sinAlpha * sinAlpha)
      + (altitudeKm * altitudeKm)
      + (2 * altitudeKm * earthRadiusKm),
  ) - (earthRadiusKm * sinAlpha);

  return Math.max(0, rangeKm);
}
