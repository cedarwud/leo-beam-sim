/**
 * Path loss model per HOBS Eq.(1)-(2).
 * L = L_fs + L_g + L_sc + L_sf
 *
 * Source: PAP-2024-HOBS, ITU-R P.676-13
 */

/** Free-space path loss in dB. L_fs = 20log(f_c) + 20log(d) - 147.55 */
export function computeFsplDb(rangeKm: number, frequencyGHz: number): number {
  return 92.45 + 20 * Math.log10(Math.max(rangeKm, 0.001)) + 20 * Math.log10(frequencyGHz);
}

/** Atmospheric gas absorption (elevation-dependent approximation). */
function atmosphericLossDb(elevationDeg: number): number {
  // ITU-R P.676: ~0.1 dB at zenith for Ka-band, increases at low elevation
  const zenithLoss = 0.1;
  const sinEl = Math.sin(Math.max(elevationDeg, 5) * Math.PI / 180);
  return zenithLoss / Math.max(sinEl, 0.087); // capped at ~5° min
}

/** Tropospheric scintillation (elevation-dependent). */
function scintillationLossDb(elevationDeg: number): number {
  // Typical Ka-band scintillation: ~0.5 dB at 10° elevation, less at higher angles
  const sinEl = Math.sin(Math.max(elevationDeg, 5) * Math.PI / 180);
  return 0.05 / Math.max(sinEl, 0.087);
}

/** Shadow fading (deterministic mean for link budget; no random draw). */
function shadowFadingLossDb(): number {
  // Log-normal mean in dB domain = 0; use a representative margin
  return 2.0; // typical Ka-band shadow fading margin
}

/**
 * Compute composite path loss in dB.
 */
export function computePathLossDb(
  rangeKm: number,
  frequencyGHz: number,
  elevationDeg: number,
  components: string[],
): number {
  let loss = computeFsplDb(rangeKm, frequencyGHz);

  for (const comp of components) {
    switch (comp) {
      case 'atmospheric':
        loss += atmosphericLossDb(elevationDeg);
        break;
      case 'scintillation':
        loss += scintillationLossDb(elevationDeg);
        break;
      case 'shadow-fading':
        loss += shadowFadingLossDb();
        break;
      // 'fspl' is already included as base
    }
  }

  return loss;
}
