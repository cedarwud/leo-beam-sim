/**
 * Free-Space Path Loss (FSPL) computation.
 *
 * Tier: standard-backed
 * Source: ITU-R P.525 / Friis transmission equation (textbook)
 *
 * Formula: FSPL(dB) = 32.45 + 20·log10(f_MHz) + 20·log10(d_km)
 *
 * This file must not import React, Three.js, or scene code.
 */

/**
 * Compute Free-Space Path Loss in dB.
 *
 * @tier standard-backed
 * @source ITU-R P.525 / Friis transmission equation
 *
 * @param distanceKm  — slant range in km (must be > 0)
 * @param frequencyGhz — carrier frequency in GHz (must be > 0)
 * @returns FSPL in dB (positive value representing loss)
 */
export function computeFspl(distanceKm: number, frequencyGhz: number): number {
  const frequencyMhz = frequencyGhz * 1000;
  return 32.45 + 20 * Math.log10(frequencyMhz) + 20 * Math.log10(distanceKm);
}
