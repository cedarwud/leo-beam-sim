/**
 * Frequency Reuse Factor (FRF) semantics and co-channel interference set (P5 fix).
 *
 * FRF defines which beams share the same frequency resources:
 *   - FRF=1: full reuse, all beams co-channel → maximum interference, maximum capacity
 *   - FRF=3: 3-color hexagonal, every 3rd beam co-channel → moderate interference
 *   - FRF=7: 7-color hexagonal, every 7th beam co-channel → minimal interference
 *
 * In SINR computation (engine.ts Phase 3), only beams in the SAME reuse group
 * as the serving beam contribute co-channel interference.
 *
 * Paper sources:
 *   - PAP-2026-BHFREQREUSE: SFR (Soft Frequency Reuse) geometry
 *   - PAP-2022-SINR-ELEVATION: FRF option 1 definition
 *   - 3GPP TR 38.821: NTN frequency reuse patterns
 *
 * Governance:
 *   - SDD: sdd/ntn-sim-core-sdd.md §8
 *   - This file must not import React, Three.js, or scene code.
 */

/**
 * Get the co-channel beam indices for a given serving beam in a hex layout.
 *
 * @param servingBeamIndex — index of the serving beam
 * @param totalBeams — total number of beams in the layout
 * @param frf — frequency reuse factor (1, 3, or 7)
 * @param reuseGroups — array mapping beam index → reuse group (from layout.ts)
 * @returns indices of co-channel interfering beams (same reuse group, excluding serving)
 */
export function getCoChannelBeams(
  servingBeamIndex: number,
  totalBeams: number,
  frf: number,
  reuseGroups: number[],
): number[] {
  if (frf === 1) {
    // All beams are co-channel
    return Array.from({ length: totalBeams }, (_, i) => i).filter(i => i !== servingBeamIndex);
  }

  const servingGroup = reuseGroups[servingBeamIndex];
  const coChannel: number[] = [];
  for (let i = 0; i < totalBeams; i++) {
    if (i !== servingBeamIndex && reuseGroups[i] === servingGroup) {
      coChannel.push(i);
    }
  }
  return coChannel;
}

/**
 * Compute the number of co-channel beams per reuse group.
 *
 * For a regular hex layout:
 *   - FRF=1, 19 beams: 18 co-channel interferers
 *   - FRF=3, 19 beams: ~6 co-channel interferers per group
 *   - FRF=7, 19 beams: ~2 co-channel interferers per group
 */
export function expectedCoChannelCount(totalBeams: number, frf: number): number {
  if (frf <= 0) return 0;
  return Math.max(0, Math.floor(totalBeams / frf) - 1);
}
