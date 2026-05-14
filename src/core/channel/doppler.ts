/**
 * Doppler shift computation for LEO NTN channels.
 *
 * LEO satellites at 550-600 km produce Doppler shifts up to:
 *   - ±24 kHz at S-band (2 GHz)
 *   - ±336 kHz at Ka-band (28 GHz)
 *
 * The Doppler shift affects carrier frequency offset. While modern receivers
 * compensate Doppler to a large extent, residual Doppler and Doppler rate
 * affect SINR (inter-carrier interference in OFDM) and can serve as
 * handover trigger indicators.
 *
 * Formula: f_d = (v_rel / c) · f_c
 *   where v_rel = radial velocity (satellite-UE), c = speed of light
 *
 * Paper sources:
 *   - PAP-2024-BEAM-MGMT-SPECTRUM, PAP-2025-MADQN-HO, PAP-2025-RSMA
 *   - 3GPP TR 38.821 §6.1: Doppler considerations for NTN
 *
 * Governance:
 *   - SDD: sdd/ntn-sim-core-sdd.md §9.2
 *   - This file must not import React, Three.js, or scene code.
 */

/** Speed of light in km/s. */
const C_KM_S = 299792.458;

/**
 * Compute Doppler shift in Hz from relative velocity and carrier frequency.
 *
 * @param relativeVelocityKmS — radial velocity between satellite and UE in km/s
 *   (positive = approaching, negative = receding)
 * @param frequencyGhz — carrier frequency in GHz
 * @returns Doppler shift in Hz (positive = frequency increase)
 *
 * @tier paper-backed
 * @source 3GPP TR 38.821 §6.1
 */
export function computeDopplerShiftHz(
  relativeVelocityKmS: number,
  frequencyGhz: number,
): number {
  const frequencyHz = frequencyGhz * 1e9;
  return (relativeVelocityKmS / C_KM_S) * frequencyHz;
}

/**
 * Estimate radial velocity from elevation angle and orbital velocity.
 *
 * For a circular LEO orbit, the maximum radial velocity occurs at low
 * elevation (satellite near horizon) and is zero at zenith.
 *
 * Approximation: v_rad ≈ v_orbital · cos(elevation + 90° correction)
 * More precisely: v_rad = v_orbital · cos(γ) where γ is the angle
 * between velocity vector and LOS direction.
 *
 * Simplified: v_rad ≈ v_orbital · cos(elevation) · sign(approaching)
 * This is a first-order approximation; exact calculation requires
 * satellite position time derivatives.
 *
 * @param orbitalVelocityKmS — orbital velocity in km/s (~7.5 for 550km LEO)
 * @param elevationDeg — elevation angle in degrees
 * @param isApproaching — true if satellite is rising (approaching), false if setting
 * @returns estimated radial velocity in km/s
 *
 * @tier assumption-backed (simplified geometry)
 */
export function estimateRadialVelocityKmS(
  orbitalVelocityKmS: number,
  elevationDeg: number,
  isApproaching: boolean,
): number {
  // At zenith (90°), radial velocity ≈ 0 (perpendicular motion)
  // At horizon (0°), radial velocity ≈ ±v_orbital (maximum)
  const elRad = elevationDeg * Math.PI / 180;
  const magnitude = orbitalVelocityKmS * Math.cos(elRad);
  return isApproaching ? magnitude : -magnitude;
}

/**
 * Compute SINR degradation from Doppler in dB.
 *
 * In OFDM systems, Doppler causes inter-carrier interference (ICI).
 * The SINR degradation depends on the normalized Doppler spread:
 *   ε = f_d / Δf (subcarrier spacing)
 *
 * For small ε: SINR_loss ≈ -10·log10(1 - (π·ε)²/3) ≈ (π²/3)·ε²·4.34 dB
 *
 * @param dopplerHz — Doppler shift in Hz
 * @param subcarrierSpacingKhz — OFDM subcarrier spacing in kHz (15/30/60/120)
 * @returns SINR degradation in dB (positive = loss)
 *
 * @tier paper-backed
 * @source PAP-2024-BEAM-MGMT-SPECTRUM
 */
export function dopplerSinrDegradationDb(
  dopplerHz: number,
  subcarrierSpacingKhz: number = 30,
): number {
  const deltaF = subcarrierSpacingKhz * 1000;
  const epsilon = Math.abs(dopplerHz) / deltaF;
  if (epsilon < 1e-6) return 0;
  // ICI power approximation for small ε
  const iciTerm = (Math.PI * epsilon) ** 2 / 3;
  if (iciTerm >= 1) return 30; // cap at 30 dB for extreme cases
  return -10 * Math.log10(1 - iciTerm);
}
