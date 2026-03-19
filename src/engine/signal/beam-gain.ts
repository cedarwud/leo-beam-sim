/**
 * Beam antenna gain (Bessel J1/J3 pattern).
 * Source: PAP-2024-HOBS Eq.(3), ITU-R S.672-4
 */

import type { GainModel } from '../../profiles/types';

const GAIN_FLOOR_DB = -20;
const ALPHA_3DB_BESSEL_J1 = 1.6137411963697343;
const BESSEL_J1_J3_BORESIGHT_ENVELOPE = 1.75;
const ALPHA_3DB_BESSEL_J1_J3 = 1.835239914925094;

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
  const alphaScale = gainModel === 'bessel-j1' ? ALPHA_3DB_BESSEL_J1 : ALPHA_3DB_BESSEL_J1_J3;
  const alpha = alphaScale * sinTheta / Math.max(sin3dB, 1e-12);

  if (alpha < 1e-9) return 0;

  // Taylor-series Bessel functions diverge for large alpha (>~10).
  // Beyond ~3× the 3dB beamwidth the gain is well below the floor.
  if (alpha > 10) return GAIN_FLOOR_DB;

  let normalizedPattern: number;
  if (gainModel === 'bessel-j1') {
    const envelope = 2 * besselJ1(alpha) / alpha;
    normalizedPattern = envelope * envelope;
  } else {
    const term1 = 2 * besselJ1(alpha) / alpha;
    const term2 = 36 * besselJ3(alpha) / (alpha * alpha * alpha);
    const envelope = (term1 + term2) / BESSEL_J1_J3_BORESIGHT_ENVELOPE;
    normalizedPattern = envelope * envelope;
  }

  const gainDb = 10 * Math.log10(Math.max(normalizedPattern, 1e-12));
  return Math.max(gainDb, GAIN_FLOOR_DB);
}

export function computeOffAxisDeg(ueDistanceKm: number, altitudeKm: number): number {
  if (altitudeKm <= 0 || ueDistanceKm <= 0) return 0;
  return (Math.atan(ueDistanceKm / altitudeKm) * 180) / Math.PI;
}

export const BEAM_GAIN_FLOOR_DB = GAIN_FLOOR_DB;
