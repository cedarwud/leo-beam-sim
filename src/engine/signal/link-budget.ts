/**
 * SINR link budget per HOBS Eq.(4)-(6).
 *
 * γ = P·H·G^T·G^R / (I^a + I^b + σ²)
 *
 * Source: PAP-2024-HOBS
 */

import type { Profile } from '../../profiles/types';
import type { LinkSample, SatelliteSnapshot, UEPosition } from './types';
import { computeBeamGainDb, computeOffAxisDeg, BEAM_GAIN_FLOOR_DB } from './beam-gain';
import { computePathLossDb } from './path-loss';

function dbmToMw(dbm: number): number {
  return Math.pow(10, dbm / 10);
}

interface BeamEntry {
  sample: LinkSample;
  signalMw: number;
}

/**
 * Compute SINR for all visible beams relative to UE.
 */
export function computeLinkBudget(
  ue: UEPosition,
  satellites: SatelliteSnapshot[],
  config: {
    channel: Profile['channel'];
    antenna: Profile['antenna'];
    beams: Profile['beams'];
    orbit: { altitudeKm: number };
  },
): LinkSample[] {
  const { channel, antenna, beams: beamConfig, orbit } = config;

  // Noise power: N = N0 * BW
  const bandwidthHz = channel.bandwidthMHz * 1e6;
  const noiseDbm = channel.noisePsdDbmHz + 10 * Math.log10(bandwidthHz);
  const noiseMw = dbmToMw(noiseDbm);

  const beamwidth3dBDeg = (antenna.beamwidth3dBRad * 180) / Math.PI;
  const entries: BeamEntry[] = [];

  for (const sat of satellites) {
    for (const beam of sat.beamCellsKm) {
      // Distance from UE to beam center on ground
      const dEast = ue.offsetEastKm - beam.offsetEastKm;
      const dNorth = ue.offsetNorthKm - beam.offsetNorthKm;
      const distKm = Math.hypot(dEast, dNorth);

      const offAxisDeg = computeOffAxisDeg(distKm, orbit.altitudeKm);
      const beamGainDb = computeBeamGainDb(offAxisDeg, beamwidth3dBDeg, antenna.model);
      if (beamGainDb <= BEAM_GAIN_FLOOR_DB) continue;

      const pathLossDb = computePathLossDb(
        sat.rangeKm,
        channel.frequencyGHz,
        sat.elevationDeg,
        channel.pathLossComponents,
      );

      // RSRP = Pt + Gt(max) + beamGain + Gr - pathLoss
      // Assume UE antenna gain ≈ 0 dBi for simplicity
      const rsrpDbm = channel.maxTxPowerDbm + antenna.maxGainDbi + beamGainDb - pathLossDb;

      entries.push({
        sample: { satId: sat.id, beamId: beam.beamId, rsrpDbm, sinrDb: -Infinity },
        signalMw: dbmToMw(rsrpDbm),
      });
    }
  }

  if (entries.length === 0) return [];



  // Compute SINR: signal / (co-frequency interference + noise)
  // With frequencyReuse=1, all beams interfere with each other
  const reuseGroups = beamConfig.frequencyReuse;

  return entries.map((entry, idx) => {
    let interferenceMw = 0;
    for (let j = 0; j < entries.length; j++) {
      if (j === idx) continue;
      // Same frequency reuse group → interfering
      if (reuseGroups <= 1 || (entries[j].sample.beamId % reuseGroups) === (entry.sample.beamId % reuseGroups)) {
        interferenceMw += entries[j].signalMw;
      }
    }
    const sinrDb = 10 * Math.log10(Math.max(entry.signalMw / (interferenceMw + noiseMw), 1e-12));
    return { ...entry.sample, sinrDb };
  });
}
