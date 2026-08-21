/**
 * Beam antenna gain (Bessel J1/J3 pattern).
 * Source: PAP-2024-HOBS Eq.(3)
 */

import type { GainModel } from '../../profiles/types';

const GAIN_FLOOR_DB = -40;
const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;
const ALPHA_3DB_BESSEL_J1 = 1.6137411963697343;
/**
 * HOBS Eq.(3) angle argument: mu(theta) = 2.07123 · sin(theta) / sin(theta_3dB).
 *
 * The same 2.07123 appears verbatim in PAP-2024-HOBS Eq.(3), in the 2024-06
 * mega-constellation handover paper and in sensors-22-09304: it is the standard
 * multibeam-satellite reference argument, not a fitted constant.
 *
 * Until 2026-08-21 this file evaluated `2*J1(a)/a` — the 2 on the wrong side of
 * the fraction — and then divided the envelope by a 1.75 "boresight" constant to
 * push the peak back to 1, with the argument scale re-solved to 1.8352 so the
 * -3 dB point still landed on theta_3dB. That was two corrections stacked on one
 * transcription slip; neither constant appears in any paper, ITU-R text, or the
 * vendored `src/core/channel/beam-gain.ts`. HOBS Eq.(3) as written is already
 * unity at boresight (1/4 + 3/4) and needs no renormalization.
 */
const MU_3DB_BESSEL_J1_J3 = 2.07123;

function besselJ1(x: number): number {
  const halfX = x / 2;
  let term = halfX;
  let sum = term;
  for (let k = 1; k <= 12; k++) {
    term *= -(halfX * halfX) / (k * (k + 1));
    sum += term;
    if (Math.abs(term) < 1e-15 * Math.abs(sum)) break;
  }
  return sum;
}

function besselJ3(x: number): number {
  const halfX = x / 2;
  let term = (halfX * halfX * halfX) / 6;
  let sum = term;
  for (let k = 1; k <= 12; k++) {
    term *= -(halfX * halfX) / (k * (k + 3));
    sum += term;
    if (Math.abs(term) < 1e-15 * Math.abs(sum)) break;
  }
  return sum;
}

export function computeBeamGainDb(
  offAxisDeg: number,
  beamwidth3dBDeg: number,
  gainModel: GainModel,
): number {
  if (gainModel === 'flat') return 0;
  if (offAxisDeg <= 0 || beamwidth3dBDeg <= 0) return 0;

  const sinTheta = Math.sin((offAxisDeg * Math.PI) / 180);
  const sin3dB = Math.sin((beamwidth3dBDeg * Math.PI) / 180);
  const alphaScale = gainModel === 'bessel-j1' ? ALPHA_3DB_BESSEL_J1 : MU_3DB_BESSEL_J1_J3;
  const alpha = alphaScale * sinTheta / Math.max(sin3dB, 1e-12);

  if (alpha < 1e-9) return 0;

  // Taylor-series Bessel functions diverge for large alpha (>~10).
  // Beyond ~3× the 3dB beamwidth the gain is well below the floor.
  if (alpha > 10) return GAIN_FLOOR_DB;

  let normalizedPattern: number;
  if (gainModel === 'bessel-j1') {
    // Uniform circular aperture [2·J1(u)/u]^2, already unity at boresight. This
    // branch is a sensitivity-only model kept for older deep links; it is not on
    // the public formula surface and keeps its own -3 dB argument scale.
    const envelope = 2 * besselJ1(alpha) / alpha;
    normalizedPattern = envelope * envelope;
  } else {
    // HOBS Eq.(3): [ J1(mu)/(2·mu) + 36·J3(mu)/mu^3 ]^2.
    const term1 = besselJ1(alpha) / (2 * alpha);
    const term2 = 36 * besselJ3(alpha) / (alpha * alpha * alpha);
    const envelope = term1 + term2;
    normalizedPattern = envelope * envelope;
  }

  const gainDb = 10 * Math.log10(Math.max(normalizedPattern, 1e-12));
  return Math.max(gainDb, GAIN_FLOOR_DB);
}

export function computeOffAxisDeg(ueDistanceKm: number, altitudeKm: number): number {
  if (altitudeKm <= 0 || ueDistanceKm <= 0) return 0;
  return (Math.atan(ueDistanceKm / altitudeKm) * 180) / Math.PI;
}

/**
 * Exact off-axis angle between a fixed-cell beam boresight and a UE line of
 * sight. The flat distance/altitude approximation above is retained for older
 * callers, while angle-aware live frames use this moving-satellite geometry
 * whenever the snapshot carries geodetic beam metadata.
 */
export function computeGeometricOffAxisDeg(input: {
  readonly satLatDeg: number;
  readonly satLonDeg: number;
  readonly satAltitudeKm: number;
  readonly beamCenterLatDeg: number;
  readonly beamCenterLonDeg: number;
  readonly userLatDeg: number;
  readonly userLonDeg: number;
  /** Optional held/sample boresight direction in ECEF coordinates. */
  readonly beamAxisEcefKm?: readonly [number, number, number];
}): number {
  const satellite = geodeticToEcefKm(input.satLatDeg, input.satLonDeg, input.satAltitudeKm);
  const beamCenter = geodeticToEcefKm(input.beamCenterLatDeg, input.beamCenterLonDeg, 0);
  const user = geodeticToEcefKm(input.userLatDeg, input.userLonDeg, 0);
  const boresight = input.beamAxisEcefKm === undefined
    ? subtract(beamCenter, satellite)
    : {
      x: input.beamAxisEcefKm[0],
      y: input.beamAxisEcefKm[1],
      z: input.beamAxisEcefKm[2],
    };
  const userLineOfSight = subtract(user, satellite);
  const denominator = vectorNorm(boresight) * vectorNorm(userLineOfSight);
  if (denominator <= 0) return 0;
  return Math.acos(clamp(dot(boresight, userLineOfSight) / denominator, -1, 1)) / DEG_TO_RAD;
}

export interface GeometricLinkGeometry {
  /** Exact spherical-Earth slant range from the UE to the satellite (km). */
  readonly slantRangeKm: number;
  /** UE-local elevation angle of the satellite (deg). */
  readonly elevationDeg: number;
}

/**
 * Exact per-UE link geometry for the angle-aware live path.
 *
 * A `SatelliteSnapshot.rangeKm` is a beam/cell-level fallback used by older
 * callers. The live cell model must not reuse that value for every UE: users
 * at different positions have different slant ranges and elevation angles,
 * which feed the path-loss/LOS terms of H and therefore the same SINR → rate →
 * EE chain. This helper is geometry only; it does not change any formula.
 */
export function computeGeometricLinkGeometry(input: {
  readonly satLatDeg: number;
  readonly satLonDeg: number;
  readonly satAltitudeKm: number;
  readonly userLatDeg: number;
  readonly userLonDeg: number;
}): GeometricLinkGeometry {
  const satellite = geodeticToEcefKm(input.satLatDeg, input.satLonDeg, input.satAltitudeKm);
  const user = geodeticToEcefKm(input.userLatDeg, input.userLonDeg, 0);
  const satelliteToUser = subtract(satellite, user);
  const slantRangeKm = vectorNorm(satelliteToUser);
  if (slantRangeKm <= 0) return { slantRangeKm: 0, elevationDeg: 0 };

  const userRadial = unit(user);
  const sinElevation = dot(satelliteToUser, userRadial) / slantRangeKm;
  return {
    slantRangeKm,
    elevationDeg: Math.asin(clamp(sinElevation, -1, 1)) / DEG_TO_RAD,
  };
}

interface EcefKm {
  readonly x: number;
  readonly y: number;
  readonly z: number;
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

function subtract(a: EcefKm, b: EcefKm): EcefKm {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: EcefKm, b: EcefKm): number {
  return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}

function vectorNorm(vector: EcefKm): number {
  return Math.sqrt(dot(vector, vector));
}

function unit(vector: EcefKm): EcefKm {
  const length = vectorNorm(vector);
  if (length <= 0) return { x: 0, y: 0, z: 0 };
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Solid-angle constant for the peak-gain ↔ beamwidth relation: 4π steradians
 * expressed in square degrees ((180/π)² · 4π). Peak gain `G ≈ k·efficiency / θ²`.
 */
export const FULL_SPHERE_SQ_DEG = (180 / Math.PI) * (180 / Math.PI) * 4 * Math.PI;

/**
 * The peak boresight gain (dBi) a `beamwidth3dBRad` antenna of a given aperture
 * `efficiency` can deliver:  `G_dBi = 10·log10(efficiency · 41253 / θ_deg²)`.
 *
 * Peak gain and 3 dB beamwidth are NOT independent knobs for one aperture — a
 * wider beam spreads the same power over more solid angle, so it MUST have lower
 * peak gain. The link-budget projection keeps the existing profile controls but
 * exposes the product as `G^T(θ) = G0 · F(θ)` while retaining the same received
 * power. The SINR-live lane derives its peak-gain override from this function
 * and locks `|maxGainDbi − consistentPeakGainDbi| < 0.5 dB` so the showcase
 * antenna stays self-consistent. Returns `NaN` for a non-positive beamwidth or
 * efficiency.
 */
export function consistentPeakGainDbi(beamwidth3dBRad: number, efficiency: number): number {
  const thetaDeg = (beamwidth3dBRad * 180) / Math.PI;
  if (!(thetaDeg > 0) || !(efficiency > 0)) return Number.NaN;
  return 10 * Math.log10((efficiency * FULL_SPHERE_SQ_DEG) / (thetaDeg * thetaDeg));
}

export const BEAM_GAIN_FLOOR_DB = GAIN_FLOOR_DB;
