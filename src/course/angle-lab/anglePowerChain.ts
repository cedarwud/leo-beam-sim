/**
 * Act 3 — the angle-aware power chain.
 *
 * The chain the lecture draws, in ACTIVE SYMBOL AUTHORITY notation:
 *
 *   θ → G^T(θ) = G₀·F(θ, θ_3dB)      (HOBS Eq.(3), the J₁/J₃ pattern)
 *     → p(t) = p(t−1)·G^T(θ(t−1))/G^T(θ(t))   within one served segment
 *     → γ_{u,s,v} → R_{u,s,v} → η_{u,s,v}
 *
 * The recursion is exact while the beam load and the interference-plus-noise
 * term hold still, which is what "within one served segment" means. Nothing
 * here names a deleted symbol: it is a RATIO of gains, never a required-SINR
 * inversion, even though the two are algebraically the same motion.
 *
 * `F` comes from `engine/signal/beam-gain.ts` — the runtime's own pattern — so
 * θ_3dB genuinely enters the numbers instead of only resizing a footprint.
 */

import { BEAM_GAIN_FLOOR_DB, computeBeamGainDb } from '../../engine/signal/beam-gain';

/** Transmit power at the start of a served segment, in W. */
export const ANGLE_LAB_SEGMENT_START_POWER_W = 2;

/** The runtime's default half-power beamwidth, in degrees. */
export const ANGLE_LAB_DEFAULT_THETA_3DB_DEG = 3.32;

export type AngleLabPatternMode = 'demo' | 'canonical';

export interface AngleLabStep {
  readonly thetaDeg: number;
  /** G^T(θ)/G₀ in dB — zero at boresight, negative off it. */
  readonly gainDb: number;
  /** The same, linear. */
  readonly gainRatio: number;
  /** p(t) in W after the recursion. */
  readonly powerW: number;
  /** True once the beam has to push past the rated per-beam cap. */
  readonly overRatedCap: boolean;
  /**
   * The pattern has bottomed out at its floor.
   *
   * Past this point the recursion still produces a number, but it is a number
   * about a link that no longer exists — the beam has lost the user. Reporting
   * the state beats printing "20,000 W" as if it meant something.
   */
  readonly atGainFloor: boolean;
}

/**
 * A simplified single-lobe pattern for DEMO mode.
 *
 * Deliberately smooth and side-lobe free: it is honest about being a teaching
 * curve, and switching to CANONICAL is what reveals the side lobes and answers
 * "why does a small offset cost so much".
 */
function demoGainDb(thetaDeg: number, theta3dbDeg: number): number {
  const ratio = thetaDeg / Math.max(theta3dbDeg, 1e-9);
  return -3 * ratio * ratio;
}

export function angleLabGainDb(
  thetaDeg: number,
  theta3dbDeg: number,
  mode: AngleLabPatternMode,
): number {
  if (mode === 'demo') return demoGainDb(Math.abs(thetaDeg), theta3dbDeg);
  return computeBeamGainDb(Math.abs(thetaDeg), theta3dbDeg, 'bessel-j1-j3');
}

/**
 * Advances the recursion by one step.
 *
 * A beam holding link quality as the user drifts off boresight must push more
 * power by exactly the ratio the gain fell — that is the energy bill for a
 * pointing error, and it is the whole point of the act.
 */
export function angleLabStep(options: {
  readonly thetaDeg: number;
  readonly previousThetaDeg: number | null;
  readonly previousPowerW: number | null;
  readonly theta3dbDeg: number;
  readonly mode: AngleLabPatternMode;
  readonly ratedCapW: number;
}): AngleLabStep {
  const gainDb = angleLabGainDb(options.thetaDeg, options.theta3dbDeg, options.mode);
  const gainRatio = 10 ** (gainDb / 10);

  let powerW: number;
  if (options.previousPowerW === null || options.previousThetaDeg === null) {
    powerW = ANGLE_LAB_SEGMENT_START_POWER_W;
  } else {
    const previousRatio = 10 ** (
      angleLabGainDb(options.previousThetaDeg, options.theta3dbDeg, options.mode) / 10);
    powerW = options.previousPowerW * (previousRatio / Math.max(gainRatio, 1e-12));
  }

  return Object.freeze({
    thetaDeg: options.thetaDeg,
    gainDb,
    gainRatio,
    powerW,
    atGainFloor: options.mode === 'canonical' && gainDb <= BEAM_GAIN_FLOOR_DB + 0.05,
    // Reported, not clamped: the lecture's point is that the demand runs past
    // the hardware, and hiding that behind a silent clamp removes the lesson.
    overRatedCap: powerW > options.ratedCapW,
  });
}

/**
 * The whole sweep from boresight out to `maxThetaDeg`, as one segment.
 *
 * Every step chains off the previous one, so the power curve is the recursion
 * itself rather than a closed form evaluated point by point.
 */
export function angleLabSweep(options: {
  readonly maxThetaDeg: number;
  readonly stepDeg: number;
  readonly theta3dbDeg: number;
  readonly mode: AngleLabPatternMode;
  readonly ratedCapW: number;
}): readonly AngleLabStep[] {
  const steps: AngleLabStep[] = [];
  let previousThetaDeg: number | null = null;
  let previousPowerW: number | null = null;

  for (let thetaDeg = 0; thetaDeg <= options.maxThetaDeg + 1e-9; thetaDeg += options.stepDeg) {
    const step = angleLabStep({
      thetaDeg,
      previousThetaDeg,
      previousPowerW,
      theta3dbDeg: options.theta3dbDeg,
      mode: options.mode,
      ratedCapW: options.ratedCapW,
    });
    steps.push(step);
    previousThetaDeg = step.thetaDeg;
    previousPowerW = step.powerW;
  }
  return Object.freeze(steps);
}

/**
 * The angle at which the pattern has fallen by `targetDropDb`.
 *
 * Bisection on the real pattern, so the "drop it 3 dB" task lands where the
 * engine says it lands rather than on an assumed half-width.
 */
export function angleLabAngleForDrop(
  targetDropDb: number,
  theta3dbDeg: number,
  mode: AngleLabPatternMode,
): number {
  let low = 0;
  let high = theta3dbDeg * 4;
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const mid = (low + high) / 2;
    if (angleLabGainDb(mid, theta3dbDeg, mode) > -targetDropDb) low = mid;
    else high = mid;
  }
  return low;
}
