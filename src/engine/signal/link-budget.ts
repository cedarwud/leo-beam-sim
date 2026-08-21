/**
 * Shared link budget. The active legacy homepage projection exposes the
 * simplified angle-aware contract; the unconfigured path remains for older
 * simulator consumers.
 */

import {
  DEFAULT_TR38811_CHANNEL,
  resolveMaxTxPowerDbm,
  type Profile,
} from '../../profiles/types';
import type {
  ActiveBeamAssignment,
  AngleAwarePowerState,
  BeamPowerOverrideDbmByKey,
  LinkSample,
  SatelliteSnapshot,
  UEPosition,
} from './types';
import {
  computeBeamGainDb,
  computeGeometricLinkGeometry,
  computeGeometricOffAxisDeg,
  computeOffAxisDeg,
  BEAM_GAIN_FLOOR_DB,
} from './beam-gain';
import { computePathLossDb } from './path-loss';
import { sampleLosStateTr38811 } from './los-probability';
import { getBeamFrequencyIndex } from '../../utils/beamFrequency';
import {
  angleAwareBeamKey,
  angleAwareLinkKey,
  resolveAngleAwarePowerState,
  computeAngleAwareEnergyEfficiency,
  computeAngleAwareThroughputBps,
  dbToLinear,
  linearToDb,
  wattsToDbm,
} from './angle-aware-ee';

function dbmToMw(dbm: number): number {
  return Math.pow(10, dbm / 10);
}

function mwToDbm(mw: number): number {
  if (mw <= 0) return -Infinity;
  return 10 * Math.log10(mw);
}

interface BeamEntry {
  sample: LinkSample;
  signalMw: number;
  interferenceMw: number;
  angleAwareDraft?: {
    state: AngleAwarePowerState;
    previousState: AngleAwarePowerState | null;
    thetaRad: number;
    transmitGainLinear: number;
    channelGainLinear: number;
    powerW: number;
    distanceM: number;
  };
}

export interface AngleAwareLinkBudgetConfig {
  /** Previous published-frame state, keyed by the public (u,s,v) link identity. */
  previousStates: ReadonlyMap<string, AngleAwarePowerState>;
  /** Positive effective RF-to-supply conversion efficiency xi. */
  conversionEfficiency: number;
  /** P^f(t), a scenario-level fixed overhead. */
  fixedPowerW: number;
  /** Optional U_(s,v)(t) values for C5. Defaults to one. */
  beamLoadByKey?: ReadonlyMap<string, number>;
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
    angleAware?: AngleAwareLinkBudgetConfig;
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
    angleAware,
  } = config;
  const usesTr38811Path = formulaFamily === 'hobs-tr38811';
  const receiverGainDbi = ueAntenna.maxGainDbi;
  const tr38811Environment = channel.tr38811?.environment ?? DEFAULT_TR38811_CHANNEL.environment;
  const tr38811NlosClutterLossDb =
    channel.tr38811?.nlosClutterLossDb ?? DEFAULT_TR38811_CHANNEL.nlosClutterLossDb;
  const maxTxPowerDbm = resolveMaxTxPowerDbm(channel);

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

      const flatOffAxisDeg = computeOffAxisDeg(distKm, sat.altitudeKm);
      const hasGeometricMetadata = Number.isFinite(sat.latDeg)
        && Number.isFinite(sat.lonDeg)
        && Number.isFinite(ue.latDeg)
        && Number.isFinite(ue.lonDeg);
      const geometricLink = hasGeometricMetadata
        ? computeGeometricLinkGeometry({
          satLatDeg: sat.latDeg!,
          satLonDeg: sat.lonDeg!,
          satAltitudeKm: sat.altitudeKm,
          userLatDeg: ue.latDeg,
          userLonDeg: ue.lonDeg,
        })
        : null;
      const hasBeamGeometricMetadata = hasGeometricMetadata
        && Number.isFinite(beam.beamCenterLatDeg)
        && Number.isFinite(beam.beamCenterLonDeg);
      const offAxisDeg = hasBeamGeometricMetadata
        ? computeGeometricOffAxisDeg({
          satLatDeg: sat.latDeg!,
          satLonDeg: sat.lonDeg!,
          satAltitudeKm: sat.altitudeKm,
          beamCenterLatDeg: beam.beamCenterLatDeg!,
          beamCenterLonDeg: beam.beamCenterLonDeg!,
          userLatDeg: ue.latDeg,
          userLonDeg: ue.lonDeg,
          beamAxisEcefKm: beam.beamAxisEcefKm,
        })
        : flatOffAxisDeg;
      const beamGainDb = computeBeamGainDb(offAxisDeg, beamwidth3dBDeg, antenna.model);
      if (beamGainDb <= BEAM_GAIN_FLOOR_DB) continue;
      const steeringLossDb = computeSteeringLossDb(
        beam.scanAngleDeg,
        antenna.maxSteeringAngleDeg,
        antenna.scanLossAtMaxSteeringDb,
      );
      const losSeedKey = `${sat.id}|${beam.beamId}|${Math.floor(simTimeSec)}`;
      const isLos = usesTr38811Path
        ? sampleLosStateTr38811(
          geometricLink?.elevationDeg ?? sat.elevationDeg,
          tr38811Environment,
          losSeedKey,
        )
        : true;

      const linkRangeKm = geometricLink?.slantRangeKm ?? sat.rangeKm;
      const linkElevationDeg = geometricLink?.elevationDeg ?? sat.elevationDeg;
      const pathLossDb = computePathLossDb(
        linkRangeKm,
        channel.frequencyGHz,
        linkElevationDeg,
        channel.pathLossComponents,
        {
          isLos,
          nlosClutterLossDb: tr38811NlosClutterLossDb,
          overrides: channel.lossOverrides,
        },
      );
      const txPowerDbm = beamPowerOverrideDbmByKey?.get(`${sat.id}:${beam.beamId}`)
        ?? maxTxPowerDbm;

      const linkSignalBeforeReceiverGainDbm =
        txPowerDbm
        + antenna.maxGainDbi
        + beamGainDb
        - steeringLossDb
        - pathLossDb;
      // Phase 4B keeps G^R as a numerator-only research override, so it
      // shifts desired signal power without rewriting interference terms.
      const rsrpDbm = linkSignalBeforeReceiverGainDbm + receiverGainDbi;

      const thetaRad = (offAxisDeg * Math.PI) / 180;
      // Factor the same received-power product into the public H · G^T
      // contract: G^T now includes the boresight gain G0 and the normalized
      // off-axis pattern, while H keeps path loss, scan loss, and receiver
      // gain.  This is an algebraic projection of the existing dB sum; it
      // does not change the received-power or SINR result.
      const transmitGainLinear = dbToLinear(antenna.maxGainDbi + beamGainDb);
      const linkKey = angleAwareLinkKey(ue.id, sat.id, beam.beamId);
      const previousState = angleAware === undefined
        ? undefined
        : angleAware.previousStates.get(linkKey);
      const angleAwareState = angleAware === undefined
        ? null
        : resolveAngleAwarePowerState(
          previousState,
          simTimeSec,
          thetaRad,
          transmitGainLinear,
        );
      const angleAwarePowerW = angleAwareState === null
        ? null
        : angleAwareState.powerW;
      const effectiveTxPowerDbm = angleAwarePowerW === null
        ? txPowerDbm
        : wattsToDbm(angleAwarePowerW);
      const effectiveHDb = -steeringLossDb - pathLossDb + receiverGainDbi;
      const effectiveSignalW = angleAwarePowerW === null
        ? dbmToMw(rsrpDbm) / 1e3
        : angleAwarePowerW * dbToLinear(effectiveHDb) * transmitGainLinear;
      const effectiveSignalDbm = wattsToDbm(effectiveSignalW);

      entries.push({
        sample: {
          ueId: ue.id,
          satId: sat.id,
          beamId: beam.beamId,
          rsrpDbm: effectiveSignalDbm,
          sinrDb: -Infinity,
          signalDbm: effectiveSignalDbm,
          intraInterferenceDbm: -Infinity,
          interInterferenceDbm: -Infinity,
          noiseDbm,
          denominatorDbm: noiseDbm,
          txPowerDbm: effectiveTxPowerDbm,
          pathLossDb,
          beamGainDb,
          steeringLossDb,
          receiverGainDbi,
        },
        signalMw: effectiveSignalW * 1e3,
        // Interference is received power in the same linear receiver domain as
        // the wanted link.  The public formula exposes only the total I; the
        // legacy intra/inter dB partition is filled after the same sum.
        interferenceMw: angleAwarePowerW === null
          ? dbmToMw(linkSignalBeforeReceiverGainDbm + receiverGainDbi)
          : effectiveSignalW * 1e3,
        angleAwareDraft: angleAwareState === null || angleAwarePowerW === null
          ? undefined
          : {
            state: angleAwareState,
            previousState: previousState !== undefined
              && previousState.timeSec < simTimeSec
              ? previousState
              : null,
            thetaRad,
            transmitGainLinear,
            channelGainLinear: dbToLinear(effectiveHDb),
            powerW: angleAwarePowerW,
            distanceM: Math.max(linkRangeKm, 0) * 1e3,
          },
      });
    }
  }

  if (entries.length === 0) return [];

  // Compute SINR: signal / (co-frequency interference + noise).
  // Beam colors and interference use the same F1..Fn reuse index:
  // B1 -> F1, B2 -> F2, ..., wrapping after the configured reuse count.
  const reuseGroups = beamConfig.frequencyReuse;

  const angleAwareSystemPowerW = angleAware === undefined
    ? null
    : angleAware.fixedPowerW + entries.reduce((sum, entry) => {
      const key = angleAwareBeamKey(entry.sample.satId, entry.sample.beamId);
      if (!activeBeamKeys.has(key) || entry.angleAwareDraft === undefined) return sum;
      const efficiency = Number.isFinite(angleAware.conversionEfficiency)
        && angleAware.conversionEfficiency > 0
        ? angleAware.conversionEfficiency
        : 1;
      const configuredLoad = angleAware.beamLoadByKey?.get(key);
      const beamLoad = Number.isFinite(configuredLoad) && (configuredLoad ?? 0) > 0
        ? Math.max(1, Math.floor(configuredLoad ?? 1))
        : 1;
      return sum + (entry.angleAwareDraft.powerW / efficiency) * beamLoad;
    }, 0);

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
    const nextSample: LinkSample = {
      ...entry.sample,
      sinrDb,
      intraInterferenceDbm: mwToDbm(intraSatInterferenceMw),
      interInterferenceDbm: mwToDbm(interSatInterferenceMw),
      noiseDbm,
      denominatorDbm: mwToDbm(denominatorMw),
    };

    if (angleAware !== undefined && entry.angleAwareDraft !== undefined) {
      const draft = entry.angleAwareDraft;
      const interferenceW = interferenceMw / 1e3;
      const noiseW = noiseMw / 1e3;
      const gammaLinear = servingSignalMw / Math.max(denominatorMw, 1e-30);
      const beamLoad = angleAware.beamLoadByKey?.get(
        angleAwareBeamKey(entry.sample.satId, entry.sample.beamId),
      ) ?? 1;
      const throughputBps = computeAngleAwareThroughputBps(
        bandwidthHz,
        beamLoad,
        gammaLinear,
      );
      const conversionEfficiency = Number.isFinite(angleAware.conversionEfficiency)
        && angleAware.conversionEfficiency > 0
        ? angleAware.conversionEfficiency
        : 1;
      const powerConsumptionW = draft.powerW / conversionEfficiency;
      const systemPowerW = Math.max(angleAwareSystemPowerW ?? powerConsumptionW, 0);
      nextSample.angleAware = {
        timeSec: draft.state.timeSec,
        previousTimeSec: draft.previousState?.timeSec ?? null,
        previousThetaRad: draft.previousState?.thetaRad ?? null,
        previousPowerW: draft.previousState?.powerW ?? null,
        previousTransmitGainLinear: draft.previousState?.transmitGainLinear ?? null,
        segmentStartTimeSec: draft.state.segmentStartTimeSec,
        segmentStartThetaRad: draft.state.segmentStartThetaRad,
        segmentStartPowerW: draft.state.segmentStartPowerW,
        segmentStartTransmitGainLinear: draft.state.segmentStartTransmitGainLinear,
        thetaRad: draft.thetaRad,
        distanceM: draft.distanceM,
        powerW: draft.powerW,
        transmitGainLinear: draft.transmitGainLinear,
        channelGainLinear: draft.channelGainLinear,
        desiredSignalW: servingSignalMw / 1e3,
        interferenceW,
        noiseW,
        gammaLinear,
        gammaDb: linearToDb(gammaLinear),
        bandwidthHz,
        beamLoad,
        throughputBps,
        conversionEfficiency,
        powerConsumptionW,
        fixedPowerW: angleAware.fixedPowerW,
        systemPowerW,
        energyEfficiencyBitsPerJoule: computeAngleAwareEnergyEfficiency(
          throughputBps,
          systemPowerW,
        ),
      };
    }

    return nextSample;
  });
}
