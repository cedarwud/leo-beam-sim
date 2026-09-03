import { approvedTransmitGainLinear } from '../../analysis/canonicalEe';
import {
  ANGLE_AWARE_SEGMENT_START_POWER_W,
  computeAngleAwareEnergyEfficiency,
  resolveAngleAwarePowerState,
} from '../../engine/signal/angle-aware-ee';

/**
 * Act 3 is a controlled, single-link comparison.  The simulator profile stores
 * the full HPBW; the canonical producer consumes the one-sided half-power
 * angle, so divide by two exactly once at this teaching adapter boundary.
 */
export const GOLDEN_FLOW_ANGLE_LESSON_FULL_HPBW_RAD = 0.058;
export const GOLDEN_FLOW_ANGLE_LESSON_HALF_POWER_RAD =
  GOLDEN_FLOW_ANGLE_LESSON_FULL_HPBW_RAD / 2;
export const GOLDEN_FLOW_ANGLE_LESSON_G0_LINEAR = 10_000;

export interface GoldenFlowAngleLessonMetrics {
  readonly thetaDeg: number;
  /** Normalized antenna-pattern factor F(theta) = G^T(theta) / G0. */
  readonly patternFactor: number;
  readonly relativeGainPercent: number;
  /** Gain change relative to boresight; zero at theta=0 and negative off-axis. */
  readonly gainDeltaDb: number;
  /** Centre-bore reference used for the ideal compensation comparison. */
  readonly baselinePowerW: number;
  readonly requiredPowerW: number;
  /** Required-power ratio relative to the centred 2 W reference state. */
  readonly powerMultiplier: number;
  /** P'G^T(theta) relative to the centred PG0 term after ideal compensation. */
  readonly compensatedLinkPercent: number;
  readonly relativeEePercent: number;
}

/**
 * Projects the approved G^T(theta) and active served-segment power recursion
 * into one classroom causal chain.  The relative EE comparison holds delivered
 * service fixed, so its only changing denominator is this selected-link power.
 */
export function buildGoldenFlowAngleLessonMetrics(
  thetaDeg: number,
): GoldenFlowAngleLessonMetrics {
  const safeThetaDeg = Number.isFinite(thetaDeg) ? Math.max(0, thetaDeg) : 0;
  const thetaRad = safeThetaDeg * Math.PI / 180;
  const baselineGain = approvedTransmitGainLinear(
    0,
    GOLDEN_FLOW_ANGLE_LESSON_G0_LINEAR,
    GOLDEN_FLOW_ANGLE_LESSON_HALF_POWER_RAD,
  );
  const currentGain = approvedTransmitGainLinear(
    thetaRad,
    GOLDEN_FLOW_ANGLE_LESSON_G0_LINEAR,
    GOLDEN_FLOW_ANGLE_LESSON_HALF_POWER_RAD,
  );
  const baselineState = resolveAngleAwarePowerState(
    undefined,
    0,
    0,
    baselineGain,
  );
  const currentState = resolveAngleAwarePowerState(
    baselineState,
    1,
    thetaRad,
    currentGain,
  );
  // One normalized delivered bit/s is sufficient for a relative comparison;
  // it cancels from the ratio and avoids inventing a classroom traffic rate.
  const baselineEe = computeAngleAwareEnergyEfficiency(
    1,
    ANGLE_AWARE_SEGMENT_START_POWER_W,
  );
  const currentEe = computeAngleAwareEnergyEfficiency(1, currentState.powerW);
  const patternFactor = currentGain / baselineGain;
  const powerMultiplier = currentState.powerW / ANGLE_AWARE_SEGMENT_START_POWER_W;
  const compensatedLinkPercent = currentState.powerW * currentGain
    / (ANGLE_AWARE_SEGMENT_START_POWER_W * baselineGain) * 100;

  return Object.freeze({
    thetaDeg: safeThetaDeg,
    patternFactor,
    relativeGainPercent: patternFactor * 100,
    gainDeltaDb: 10 * Math.log10(Math.max(patternFactor, Number.MIN_VALUE)),
    baselinePowerW: ANGLE_AWARE_SEGMENT_START_POWER_W,
    requiredPowerW: currentState.powerW,
    powerMultiplier,
    compensatedLinkPercent,
    relativeEePercent: currentEe / baselineEe * 100,
  });
}
