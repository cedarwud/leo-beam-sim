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
import { getBeamFrequencyIndex } from '../../utils/beamFrequency';

function dbmToMw(dbm: number): number {
  return Math.pow(10, dbm / 10);
}

function mwToDbm(mw: number): number {
  if (mw <= 0) return -Infinity;
  return 10 * Math.log10(mw);
}

const TR38811_ENVIRONMENT = 'suburban';
const TR38811_NLOS_CLUTTER_LOSS_DB = 20;

interface BeamEntry {
  sample: LinkSample;
  signalMw: number;
  interferenceMw: number;
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
    ueAntenna: Profile['ueAntenna'];
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
    ueAntenna,
    beams: beamConfig,
    activeAssignments,
    simTimeSec,
    beamPowerOverrideDbmByKey,
  } = config;
  const usesTr38811Path = formulaFamily === 'hobs-tr38811';
  const receiverGainDbi = ueAntenna.maxGainDbi;

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

      const linkSignalBeforeReceiverGainDbm =
        txPowerDbm
        + antenna.maxGainDbi
        + beamGainDb
        - steeringLossDb
        - pathLossDb;
      // Phase 4B keeps G^R as a numerator-only research override, so it
      // shifts desired signal power without rewriting interference terms.
      const rsrpDbm = linkSignalBeforeReceiverGainDbm + receiverGainDbi;

      entries.push({
        sample: {
          satId: sat.id,
          beamId: beam.beamId,
          rsrpDbm,
          sinrDb: -Infinity,
          signalDbm: rsrpDbm,
          intraInterferenceDbm: -Infinity,
          interInterferenceDbm: -Infinity,
          noiseDbm,
          denominatorDbm: noiseDbm,
          txPowerDbm,
          pathLossDb,
          beamGainDb,
          steeringLossDb,
          receiverGainDbi,
        },
        signalMw: dbmToMw(rsrpDbm),
        interferenceMw: dbmToMw(linkSignalBeforeReceiverGainDbm),
      });
    }
  }

  if (entries.length === 0) return [];

  // Compute SINR: signal / (co-frequency interference + noise).
  // Beam colors and interference use the same F1..Fn reuse index:
  // B1 -> F1, B2 -> F2, ..., wrapping after the configured reuse count.
  const reuseGroups = beamConfig.frequencyReuse;

  return entries.map((entry, idx) => {
    const servingSignalMw = entry.signalMw;
    let intraSatInterferenceMw = 0;
    let interSatInterferenceMw = 0;
    const entryFrequencyIndex = getBeamFrequencyIndex(entry.sample.beamId, reuseGroups);

    for (let j = 0; j < entries.length; j++) {
      if (j === idx) continue;
      const otherKey = `${entries[j].sample.satId}:${entries[j].sample.beamId}`;
      if (!activeBeamKeys.has(otherKey)) continue;
      const otherFrequencyIndex = getBeamFrequencyIndex(entries[j].sample.beamId, reuseGroups);
      // Same frequency reuse group -> interfering.
      if (reuseGroups <= 1 || otherFrequencyIndex === entryFrequencyIndex) {
        if (entries[j].sample.satId === entry.sample.satId) {
          intraSatInterferenceMw += entries[j].interferenceMw;
        } else {
          interSatInterferenceMw += entries[j].interferenceMw;
        }
      }
    }

    const interferenceMw = intraSatInterferenceMw + interSatInterferenceMw;
    const denominatorMw = interferenceMw + noiseMw;
    const sinrDb = 10 * Math.log10(Math.max(servingSignalMw / denominatorMw, 1e-12));
    return {
      ...entry.sample,
      sinrDb,
      intraInterferenceDbm: mwToDbm(intraSatInterferenceMw),
      interInterferenceDbm: mwToDbm(interSatInterferenceMw),
      noiseDbm,
      denominatorDbm: mwToDbm(denominatorMw),
    };
  });
}
