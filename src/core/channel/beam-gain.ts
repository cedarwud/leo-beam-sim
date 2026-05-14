/**
 * Beam gain models for NTN multi-beam antennas.
 *
 * Tier: paper-backed / standard-backed / debug-only (per model)
 */

import { EARTH_RADIUS_KM } from '@/core/common/constants';
import type { BeamGainInput } from './types';

// Guard for EARTH_RADIUS_KM if import fails or is undefined
const R_E = EARTH_RADIUS_KM || 6371;

/**
 * First-kind Bessel function J1(x) approximation.
 */
function besselJ1(x: number): number {
  const ax = Math.abs(x);
  if (ax < 1e-12) return 0; // Pure boresight

  if (ax < 3.0) {
    const y = x * x;
    return x * (0.5 + y * (-0.56249985 + y * (0.21093573 + y * (-0.03954289 + y * (0.00443319 + y * (-0.00031761 + y * 0.00001109))))));
  }

  const z = 3.0 / ax;
  const zz = z * z;
  const theta = ax - 2.356194491 + z * (0.183105 + zz * (-0.02457 + zz * (0.00753 + zz * (-0.00908))));
  const p0 = 1.0 + zz * (-0.001098628627 + zz * (0.00002734510407 + zz * (-0.000002073370639)));
  const q0 = z * (-0.01562499995 + zz * (0.0001430488765 + zz * (-0.000006911147651)));

  const result = Math.sqrt(0.636619772 / ax) * (Math.cos(theta) * p0 - Math.sin(theta) * q0);
  return x < 0 ? -result : result;
}

/**
 * First-kind Bessel function J0(x) approximation.
 *
 * Coefficients follow the same Cephes-style split used by the J1 helper so we
 * can evaluate the HOBS J1+J3 antenna pattern without introducing a new
 * runtime dependency.
 */
function besselJ0(x: number): number {
  const ax = Math.abs(x);

  if (ax < 8.0) {
    const y = x * x;
    const ans1 = 57568490574.0
      + y * (-13362590354.0
      + y * (651619640.7
      + y * (-11214424.18
      + y * (77392.33017
      + y * (-184.9052456)))));
    const ans2 = 57568490411.0
      + y * (1029532985.0
      + y * (9494680.718
      + y * (59272.64853
      + y * (267.8532712
      + y * 1.0))));
    return ans1 / ans2;
  }

  const z = 8.0 / ax;
  const y = z * z;
  const xx = ax - 0.785398164;
  const ans1 = 1.0
    + y * (-0.1098628627e-2
    + y * (0.2734510407e-4
    + y * (-0.2073370639e-5
    + y * 0.2093887211e-6)));
  const ans2 = -0.1562499995e-1
    + y * (0.1430488765e-3
    + y * (-0.6911147651e-5
    + y * (0.7621095161e-6
    - y * 0.934945152e-7)));
  return Math.sqrt(0.636619772 / ax) *
    (Math.cos(xx) * ans1 - z * Math.sin(xx) * ans2);
}

function besselJ3(x: number): number {
  const ax = Math.abs(x);
  if (ax < 8.0) {
    const halfX = x / 2;
    let term = (halfX * halfX * halfX) / 6;
    let sum = term;

    // Power-series form is numerically stable near boresight, where the
    // recurrence relation suffers from cancellation and can explode the HOBS
    // J1+J3 pattern by tens of dB.
    for (let m = 0; m < 20; m += 1) {
      term *= -((halfX * halfX) / ((m + 1) * (m + 4)));
      sum += term;
      if (Math.abs(term) < 1e-16) break;
    }
    return sum;
  }

  const j0 = besselJ0(x);
  const j1 = besselJ1(x);
  const j2 = (2 * j1 / x) - j0;
  return (4 * j2 / x) - j1;
}

function resolveTheta3dbRad(input: Pick<BeamGainInput, 'beamDiameterKm' | 'altitudeKm' | 'slantRangeKm'>): number {
  const { beamDiameterKm, altitudeKm, slantRangeKm } = input;
  const rangeForTheta = slantRangeKm ?? altitudeKm;
  return Math.atan(beamDiameterKm / (2 * rangeForTheta));
}

export function computeBeamGain(input: BeamGainInput): number {
  const { offAxisAngleDeg, model, peakGainDbi, beamDiameterKm, altitudeKm, slantRangeKm } = input;

  if (model === 'flat-debug') return peakGainDbi;

  const theta3dbRad = model === 'bessel-j1j3'
    ? Math.atan(beamDiameterKm / (2 * altitudeKm))
    : resolveTheta3dbRad({ beamDiameterKm, altitudeKm, slantRangeKm });
  const theta3dbDeg = theta3dbRad * (180 / Math.PI);

  if (model === 'rpsat-3gpp' || model === 'itu-r') {
    const SLA_MAX = 30;
    const ratio = offAxisAngleDeg / (theta3dbDeg || 0.001);
    const reduction = Math.min(12 * ratio * ratio, SLA_MAX);
    return -reduction;
  }

  if (model === 'bessel-j1') {
    const offAxisRad = offAxisAngleDeg * (Math.PI / 180);
    const sinTheta = Math.sin(offAxisRad);
    const sinTheta3db = Math.sin(theta3dbRad);

    if (Math.abs(sinTheta) < 1e-12) return 0;

    const u = 2.07123 * sinTheta / (sinTheta3db || 0.001);
    const safeU = Math.abs(u) > 1e-12 ? u : (u < 0 ? -1e-12 : 1e-12);
    const j1u = besselJ1(u);
    const pattern = (2 * j1u / safeU) ** 2;
    return pattern > 1e-30 ? 10 * Math.log10(pattern) : -300;
  }

  if (model === 'bessel-j1j3') {
    const offAxisRad = offAxisAngleDeg * (Math.PI / 180);
    const sinTheta = Math.sin(offAxisRad);
    const sinTheta3db = Math.sin(theta3dbRad);

    if (Math.abs(sinTheta) < 1e-12) return 0;

    const u = 2.07123 * sinTheta / (sinTheta3db || 0.001);
    const safeU = Math.abs(u) > 1e-12 ? u : (u < 0 ? -1e-12 : 1e-12);
    const j1u = besselJ1(u);
    const j3u = besselJ3(u);
    const pattern = (j1u / (2 * safeU) + 36 * j3u / (safeU ** 3)) ** 2;
    return pattern > 1e-30 ? 10 * Math.log10(pattern) : -300;
  }

  return 0;
}

/**
 * Compute the off-axis angle in degrees.
 * Fixed: HAversine sqrt guard to prevent NaN.
 */
export function computeOffAxisAngle(
  beamCenterLatDeg: number,
  beamCenterLonDeg: number,
  ueLatDeg: number,
  ueLonDeg: number,
  altitudeKm: number,
): number {
  if (isNaN(beamCenterLatDeg) || isNaN(ueLatDeg)) return 0;

  const toRad = Math.PI / 180;
  const lat1 = beamCenterLatDeg * toRad;
  const lat2 = ueLatDeg * toRad;
  const dLat = (ueLatDeg - beamCenterLatDeg) * toRad;
  const dLon = (ueLonDeg - beamCenterLonDeg) * toRad;

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  // Parity Fix: Clamp 'a' to [0, 1] before sqrt to prevent NaN from float errors
  const centralAngleRad = 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, a))));

  // Law of cosines at satellite
  const offAxisRad = Math.atan2(
    R_E * Math.sin(centralAngleRad),
    R_E + altitudeKm - R_E * Math.cos(centralAngleRad),
  );

  const res = offAxisRad * (180 / Math.PI);
  return isNaN(res) ? 0 : res;
}
