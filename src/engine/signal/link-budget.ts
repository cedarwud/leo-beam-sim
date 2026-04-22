/**
 * SINR link budget per HOBS Eq.(4)-(6).
 *
 * γ = P·H·G^T·G^R / (I^a + I^b + σ²)
 *
 * Source: PAP-2024-HOBS
 */

import type { Profile } from '../../profiles/types';
import type {
  ActiveBeamAssignment,
  BeamPowerOverrideDbmByKey,
  LinkSample,
  SatelliteSnapshot,
  UEPosition,
} from './types';
import { computeBeamGainDb, computeOffAxisDeg, BEAM_GAIN_FLOOR_DB } from './beam-gain';
import { computePathLossDb } from './path-loss';
import { sampleLosStateTr38811 } from './los-probability';

function dbmToMw(dbm: number): number {
  return Math.pow(10, dbm / 10);
}

const TR38811_ENVIRONMENT = 'suburban';
const TR38811_NLOS_CLUTTER_LOSS_DB = 20;

interface BeamEntry {
  sample: LinkSample;
  signalMw: number;
}

function computeSteeringLossDb(
  scanAngleDeg: number,
  maxSteeringAngleDeg: number,
  scanLossAtMaxSteeringDb: number,
): number {
  if (
    scanAngleDeg <= 0
    || maxSteeringAngleDeg <= 0
    || scanLossAtMaxSteeringDb <= 0
  ) {
    return 0;
  }

  const ratio = Math.min(scanAngleDeg / maxSteeringAngleDeg, 1);
  // Approximate phased-array scan loss: gentle near boresight, harsher near the steering limit.
  return scanLossAtMaxSteeringDb * ratio * ratio;
}

/**
 * Compute SINR for all visible beams relative to UE.
 */
export function computeLinkBudget(
  ue: UEPosition,
  satellites: SatelliteSnapshot[],
  config: {
    formulaFamily: Profile['formulaFamily'];
    channel: Profile['channel'];
    antenna: Profile['antenna'];
    beams: Profile['beams'];
    activeAssignments: ActiveBeamAssignment[];
    simTimeSec: number;
    beamPowerOverrideDbmByKey?: BeamPowerOverrideDbmByKey;
  },
): LinkSample[] {
  const {
    formulaFamily,
    channel,
    antenna,
    beams: beamConfig,
    activeAssignments,
    simTimeSec,
    beamPowerOverrideDbmByKey,
  } = config;
  const usesTr38811Path = formulaFamily === 'hobs-tr38811';

  // Noise power: N = N0 * BW
  const bandwidthHz = channel.bandwidthMHz * 1e6;
  const noiseDbm = channel.noisePsdDbmHz + 10 * Math.log10(bandwidthHz);
  const noiseMw = dbmToMw(noiseDbm);

  const beamwidth3dBDeg = (antenna.beamwidth3dBRad * 180) / Math.PI;
  const entries: BeamEntry[] = [];
  const activeBeamKeys = new Set(
    activeAssignments.map(assignment => `${assignment.satId}:${assignment.beamId}`),
  );

  for (const sat of satellites) {
    for (const beam of sat.beamCellsKm) {
      // Distance from UE to beam center on ground
      const dEast = ue.offsetEastKm - beam.offsetEastKm;
      const dNorth = ue.offsetNorthKm - beam.offsetNorthKm;
      const distKm = Math.hypot(dEast, dNorth);

      const offAxisDeg = computeOffAxisDeg(distKm, sat.altitudeKm);
      const beamGainDb = computeBeamGainDb(offAxisDeg, beamwidth3dBDeg, antenna.model);
      if (beamGainDb <= BEAM_GAIN_FLOOR_DB) continue;
      const steeringLossDb = computeSteeringLossDb(
        beam.scanAngleDeg,
        antenna.maxSteeringAngleDeg,
        antenna.scanLossAtMaxSteeringDb,
      );
      const losSeedKey = `${sat.id}|${beam.beamId}|${Math.floor(simTimeSec)}`;
      const isLos = usesTr38811Path
        ? sampleLosStateTr38811(sat.elevationDeg, TR38811_ENVIRONMENT, losSeedKey)
        : true;

      const pathLossDb = computePathLossDb(
        sat.rangeKm,
        channel.frequencyGHz,
        sat.elevationDeg,
        channel.pathLossComponents,
        {
          isLos,
          nlosClutterLossDb: TR38811_NLOS_CLUTTER_LOSS_DB,
        },
      );
      const txPowerDbm = beamPowerOverrideDbmByKey?.get(`${sat.id}:${beam.beamId}`)
        ?? channel.maxTxPowerDbm;

      // RSRP = Pt + Gt(max) + beamGain + Gr - pathLoss
      // Assume UE antenna gain ≈ 0 dBi for simplicity
      const rsrpDbm =
        txPowerDbm
        + antenna.maxGainDbi
        + beamGainDb
        - steeringLossDb
        - pathLossDb;

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
    const servingSignalMw = entry.signalMw;
    let intraSatInterferenceMw = 0;
    let interSatInterferenceMw = 0;

    for (let j = 0; j < entries.length; j++) {
      if (j === idx) continue;
      const otherKey = `${entries[j].sample.satId}:${entries[j].sample.beamId}`;
      if (!activeBeamKeys.has(otherKey)) continue;
      // Same frequency reuse group → interfering
      if (reuseGroups <= 1 || (entries[j].sample.beamId % reuseGroups) === (entry.sample.beamId % reuseGroups)) {
        if (entries[j].sample.satId === entry.sample.satId) {
          intraSatInterferenceMw += entries[j].signalMw;
        } else {
          interSatInterferenceMw += entries[j].signalMw;
        }
      }
    }

    const interferenceMw = intraSatInterferenceMw + interSatInterferenceMw;
    const sinrDb = 10 * Math.log10(Math.max(servingSignalMw / (interferenceMw + noiseMw), 1e-12));
    return { ...entry.sample, sinrDb };
  });
}
