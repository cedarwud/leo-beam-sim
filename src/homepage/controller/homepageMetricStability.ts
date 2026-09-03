import type { HomepageBeamMetric } from './contracts';

export interface HomepageLiveMetricValues {
  readonly sinrDb: number;
  readonly powerW: number;
  readonly throughputBps: number;
  readonly energyEfficiencyBitsPerJoule: number;
}

export interface StabilizeHomepageMetricValuesInput {
  readonly current: HomepageLiveMetricValues;
  readonly previous: Pick<HomepageBeamMetric, 'sinrDb' | 'powerW' | 'throughputBps' | 'energyEfficiencyBitsPerJoule'> | null;
  readonly currentSimTimeSec: number;
  readonly previousSimTimeSec: number | null;
}

/**
 * Display-only continuity constants. The raw source frame remains the
 * decision/scientific authority; these limits only stop the homepage rail and
 * EE colour projection from visibly teleporting between adjacent live frames.
 */
export const HOMEPAGE_METRIC_DISPLAY_STABILITY = Object.freeze({
  // The simulator's raw frame can change much faster than a lecturer can
  // explain from the visible elevation trend. These are display-only limits;
  // decision ranking still consumes the raw accepted frame.
  timeConstantSec: 8,
  maxPositiveLogStep: Math.log(1.08),
  maxSinrStepDb: 0.75,
  maxContinuityGapSec: 30,
});

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function smoothingAlpha(deltaSec: number): number {
  if (!Number.isFinite(deltaSec) || deltaSec <= 0) return 1;
  return 1 - Math.exp(-deltaSec / HOMEPAGE_METRIC_DISPLAY_STABILITY.timeConstantSec);
}

export function hasContinuousHomepageMetricTimeline(
  currentSimTimeSec: number,
  previousSimTimeSec: number | null,
): boolean {
  if (!finite(currentSimTimeSec) || !finite(previousSimTimeSec)) return false;
  const deltaSec = currentSimTimeSec - previousSimTimeSec;
  return deltaSec > 0 && deltaSec <= HOMEPAGE_METRIC_DISPLAY_STABILITY.maxContinuityGapSec;
}

function smoothNonNegative(
  current: number,
  previous: number,
  alpha: number,
): number {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return current;
  if (current === previous) return current;
  if (current <= 0 || previous <= 0) {
    return Math.max(0, previous + (current - previous) * alpha);
  }
  const logDelta = Math.log(current) - Math.log(previous);
  const boundedLogDelta = clamp(
    logDelta * alpha,
    -HOMEPAGE_METRIC_DISPLAY_STABILITY.maxPositiveLogStep,
    HOMEPAGE_METRIC_DISPLAY_STABILITY.maxPositiveLogStep,
  );
  return Math.exp(Math.log(previous) + boundedLogDelta);
}

function smoothSinrDb(current: number, previous: number, alpha: number): number {
  const delta = clamp(
    (current - previous) * alpha,
    -HOMEPAGE_METRIC_DISPLAY_STABILITY.maxSinrStepDb,
    HOMEPAGE_METRIC_DISPLAY_STABILITY.maxSinrStepDb,
  );
  return previous + delta;
}

/**
 * Smooth one same-role, same-pair display sample. A missing prior sample or a
 * backward/large timeline discontinuity returns the current raw values so a
 * seek cannot smear an old episode into a new one.
 */
export function stabilizeHomepageMetricValues(
  input: StabilizeHomepageMetricValuesInput,
): HomepageLiveMetricValues {
  const previous = input.previous;
  const previousSimTimeSec = input.previousSimTimeSec;
  if (
    previous === null
    || !finite(previous.sinrDb)
    || !finite(previous.powerW)
    || !finite(previous.throughputBps)
    || !finite(previous.energyEfficiencyBitsPerJoule)
    || !finite(previousSimTimeSec)
  ) return input.current;

  if (!hasContinuousHomepageMetricTimeline(input.currentSimTimeSec, previousSimTimeSec)) {
    return input.current;
  }

  const deltaSec = input.currentSimTimeSec - previousSimTimeSec;

  const alpha = smoothingAlpha(deltaSec);
  return {
    sinrDb: smoothSinrDb(input.current.sinrDb, previous.sinrDb, alpha),
    powerW: smoothNonNegative(input.current.powerW, previous.powerW, alpha),
    throughputBps: smoothNonNegative(input.current.throughputBps, previous.throughputBps, alpha),
    energyEfficiencyBitsPerJoule: smoothNonNegative(
      input.current.energyEfficiencyBitsPerJoule,
      previous.energyEfficiencyBitsPerJoule,
      alpha,
    ),
  };
}
