import type { AngleAwarePowerState } from './types';

const MIN_POSITIVE = 1e-15;

/** Segment-start condition from the active simplified EE contract. */
export const ANGLE_AWARE_SEGMENT_START_POWER_W = 2;

export function dbmToWatts(dbm: number): number {
  return 10 ** ((dbm - 30) / 10);
}

export function wattsToDbm(watts: number): number {
  return watts > 0 ? 10 * Math.log10(watts * 1e3) : -Infinity;
}

export function dbToLinear(db: number): number {
  return 10 ** (db / 10);
}

export function linearToDb(linear: number): number {
  return linear > 0 ? 10 * Math.log10(linear) : -Infinity;
}

/** Stable ownership key for one public (u,s,v) link. */
export function angleAwareLinkKey(
  ueId: string | undefined,
  satId: string,
  beamId: number,
): string {
  return `${ueId ?? 'ue'}|${satId}|${beamId}`;
}

/** Stable key for beam-level load and active-assignment lookup. */
export function angleAwareBeamKey(satId: string, beamId: number): string {
  return `${satId}:${beamId}`;
}

export function resolveAngleAwarePowerState(
  previous: AngleAwarePowerState | undefined,
  timeSec: number,
  thetaRad: number,
  transmitGainLinear: number,
): AngleAwarePowerState {
  const safeTimeSec = Number.isFinite(timeSec) ? timeSec : 0;
  const safeThetaRad = Number.isFinite(thetaRad) ? thetaRad : 0;
  const safeGain = Math.max(
    Number.isFinite(transmitGainLinear) && transmitGainLinear > 0
      ? transmitGainLinear
      : MIN_POSITIVE,
    MIN_POSITIVE,
  );
  const sameFrameToleranceSec = 1e-9;
  const canContinue = previous !== undefined
    && Number.isFinite(previous.timeSec)
    // Repeated evaluations at the same effective simulation time should keep the
    // same segment and hold state; only genuine backward jumps restart from 2W.
    && previous.timeSec <= safeTimeSec + sameFrameToleranceSec
    && Number.isFinite(previous.powerW)
    && previous.powerW > 0
    && Number.isFinite(previous.transmitGainLinear)
    && previous.transmitGainLinear > 0;
  const isSameFrame = canContinue && Math.abs(previous.timeSec - safeTimeSec) <= sameFrameToleranceSec;
  const powerW = canContinue
    ? (isSameFrame
      ? previous.powerW
      : previous.powerW * previous.transmitGainLinear / safeGain)
    : ANGLE_AWARE_SEGMENT_START_POWER_W;

  return {
    timeSec: safeTimeSec,
    thetaRad: safeThetaRad,
    transmitGainLinear: safeGain,
    powerW,
    segmentStartTimeSec: canContinue ? previous.segmentStartTimeSec : safeTimeSec,
    segmentStartThetaRad: canContinue ? previous.segmentStartThetaRad : safeThetaRad,
    segmentStartTransmitGainLinear: canContinue
      ? previous.segmentStartTransmitGainLinear
      : safeGain,
    segmentStartPowerW: ANGLE_AWARE_SEGMENT_START_POWER_W,
  };
}

/** C5: link throughput with one beam-level load value. */
export function computeAngleAwareThroughputBps(
  bandwidthHz: number,
  beamLoad: number,
  gammaLinear: number,
): number {
  const safeBandwidthHz = Number.isFinite(bandwidthHz) && bandwidthHz > 0 ? bandwidthHz : 0;
  const safeLoad = Number.isFinite(beamLoad) && beamLoad > 0 ? beamLoad : 1;
  const safeGamma = Number.isFinite(gammaLinear) && gammaLinear >= 0 ? gammaLinear : 0;
  return (safeBandwidthHz / safeLoad) * Math.log2(1 + safeGamma);
}

/** C8: selected-link throughput over the common system power. */
export function computeAngleAwareEnergyEfficiency(
  throughputBps: number,
  systemPowerW: number,
): number {
  return Number.isFinite(throughputBps)
    && throughputBps >= 0
    && Number.isFinite(systemPowerW)
    && systemPowerW > 0
    ? throughputBps / systemPowerW
    : 0;
}
