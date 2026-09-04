import type { AngleAwarePowerState } from './types';

const MIN_POSITIVE = 1e-15;

/**
 * Active simplified-EE engineering constants. Keep these in the executable
 * contract so p^0, xi, and P^p cannot drift apart between UI and runtime.
 */
export const ANGLE_AWARE_BEAM_POWER_CAP_W = 1.65;
export const ANGLE_AWARE_MAX_EFFICIENCY = 0.35;
export const ANGLE_AWARE_BACKOFF_DB = 5;
export const ANGLE_AWARE_FIXED_RF_CHAIN_POWER_W = 0.338;
export const ANGLE_AWARE_FIXED_BASEBAND_POWER_W = 0.2;
export const ANGLE_AWARE_SEGMENT_START_POWER_W = ANGLE_AWARE_BEAM_POWER_CAP_W / 2;
/**
 * Homepage live-lane slew limit for the inverse-gain power recurrence.
 *
 * The teaching surface advances in discrete frames.  Without a finite
 * actuator response, one sampled antenna-gain change can make p(t) jump from
 * the cap to a small value (or back again), which makes EE look like random
 * noise even though the geometry is moving continuously.
 */
export const ANGLE_AWARE_HOMEPAGE_POWER_SLEW_RATIO = 0.12;
export const ANGLE_AWARE_EE_CONTRACT_VERSION = 'single-sinr-previous-step-power-v2';

/** Class-B RF-to-supply efficiency for one physical beam. */
export function resolveAngleAwareConversionEfficiency(
  beamPowerW: number,
  maxEfficiency = ANGLE_AWARE_MAX_EFFICIENCY,
  beamPowerCapW = ANGLE_AWARE_BEAM_POWER_CAP_W,
  backoffDb = ANGLE_AWARE_BACKOFF_DB,
): number {
  const safePower = Number.isFinite(beamPowerW) && beamPowerW > 0 ? beamPowerW : 0;
  const safeMax = Number.isFinite(maxEfficiency) && maxEfficiency > 0
    ? maxEfficiency
    : ANGLE_AWARE_MAX_EFFICIENCY;
  const safeCap = Number.isFinite(beamPowerCapW) && beamPowerCapW > 0
    ? beamPowerCapW
    : ANGLE_AWARE_BEAM_POWER_CAP_W;
  const safeBackoff = Number.isFinite(backoffDb) ? backoffDb : ANGLE_AWARE_BACKOFF_DB;
  const saturationPowerW = safeCap * 10 ** (safeBackoff / 10);
  return Math.min(safeMax, safeMax * Math.sqrt(safePower / saturationPowerW));
}

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
  powerCapW?: number,
  powerSlewRatio?: number,
): AngleAwarePowerState {
  const safeTimeSec = Number.isFinite(timeSec) ? timeSec : 0;
  const safeThetaRad = Number.isFinite(thetaRad) ? thetaRad : 0;
  const safeGain = Math.max(
    Number.isFinite(transmitGainLinear) && transmitGainLinear > 0
      ? transmitGainLinear
      : MIN_POSITIVE,
    MIN_POSITIVE,
  );
  // The homepage passes its physical P_beam,max here. Keep this optional so
  // legacy/direct consumers retain their historical recurrence.
  const safePowerCapW = Number.isFinite(powerCapW) && powerCapW! > 0
    ? powerCapW!
    : Number.POSITIVE_INFINITY;
  const segmentStartPowerW = Number.isFinite(safePowerCapW)
    ? Math.min(ANGLE_AWARE_SEGMENT_START_POWER_W, safePowerCapW)
    : ANGLE_AWARE_SEGMENT_START_POWER_W;
  const sameFrameToleranceSec = 1e-9;
  const canContinue = previous !== undefined
    && Number.isFinite(previous.timeSec)
    // Repeated evaluations at the same effective simulation time should keep the
    // same segment and hold state; only genuine backward jumps restart from p^0.
    && previous.timeSec <= safeTimeSec + sameFrameToleranceSec
    && Number.isFinite(previous.powerW)
    && previous.powerW > 0
    && Number.isFinite(previous.transmitGainLinear)
    && previous.transmitGainLinear > 0;
  const isSameFrame = canContinue && Math.abs(previous.timeSec - safeTimeSec) <= sameFrameToleranceSec;
  const rawPowerW = canContinue
    ? (isSameFrame
      ? previous.powerW
      : previous.powerW * previous.transmitGainLinear / safeGain)
    : segmentStartPowerW;
  const safePowerSlewRatio = Number.isFinite(powerSlewRatio) && powerSlewRatio! >= 0
    ? Math.min(powerSlewRatio!, 1)
    : null;
  const slewLimitedPowerW = canContinue && !isSameFrame && safePowerSlewRatio !== null
    ? Math.min(
      Math.max(
        rawPowerW,
        previous.powerW * (1 - safePowerSlewRatio),
      ),
      previous.powerW * (1 + safePowerSlewRatio),
    )
    : rawPowerW;
  const powerW = Math.min(slewLimitedPowerW, safePowerCapW);

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
    segmentStartPowerW: canContinue ? previous.segmentStartPowerW : segmentStartPowerW,
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
