/**
 * Act 5 dual-arm power sweep — the headless half of M5.
 *
 * Both arms sweep the SAME immutable replay frames; that is the only thing that
 * makes the two curves comparable, so a point recorded against different frames
 * is a typed failure rather than a footnote.
 *
 * The three-segment shape is read out of the recorded data, never asserted: a
 * sweep that does not peak is reported as not peaking.
 *
 * See docs/sdd/SIX-ACTS-P0-VERTICAL-SLICE-SDD.md (M5).
 */

import type { SixActsArm } from './armStrategy';
import type { SixActsRunSummary } from './runSummary';

export type SixActsSweepArm = SixActsArm;

/**
 * The rated per-beam RF cap, in W (thesis-mc ch5 Table 5-2, and
 * `DEFAULT_SIMULATOR_PARAMETERS.beamPowerCapW`).
 *
 * A HARDWARE constant, not a policy knob. An arm may not be expressed as a
 * lower cap: that changes the physics, and the two arms stop being the same
 * immutable replay.
 */
export const SIX_ACTS_BEAM_POWER_CAP_W = 1.65;

export type SixActsSweepErrorCode =
  | 'FRAME_SET_MISMATCH'
  | 'SCENARIO_MISMATCH'
  | 'DUPLICATE_POINT'
  | 'INVALID_POWER'
  | 'POWER_CAP_MISMATCH'
  | 'POWER_ABOVE_CAP';

export class SixActsSweepError extends Error {
  readonly code: SixActsSweepErrorCode;

  constructor(code: SixActsSweepErrorCode, message: string) {
    super(message);
    this.name = 'SixActsSweepError';
    this.code = code;
  }
}

function fail(code: SixActsSweepErrorCode, message: string): never {
  throw new SixActsSweepError(code, message);
}

export interface SixActsSweepPoint {
  readonly arm: SixActsSweepArm;
  /** The swept knob: per-beam transmit power p, in W. */
  readonly beamPowerW: number;
  /** Identity of the immutable replay frames this point was measured on. */
  readonly frameSetDigest: string;
  /**
   * The rated cap in force for this point. Recorded so the sweep can prove both
   * arms ran the same hardware, rather than trusting that nobody lowered it.
   */
  readonly beamPowerCapW: number;
  readonly summary: SixActsRunSummary;
}

/** One plotted stop: the curves Act 5 grows on screen. */
export interface SixActsSweepSample {
  readonly beamPowerW: number;
  /** Sum over t and u of R dt, in Mbit. */
  readonly deliveredDataMbit: number;
  /** Sum over t of P^N dt, in J. */
  readonly totalEnergyJ: number;
  /** Run EE in Mbit/J. */
  readonly runEeMbitPerJ: number;
  readonly lowSinrRatioPercent: number;
  readonly outageDurationSec: number;
}

export type SixActsSweepShape =
  /** EE rises to a peak inside the swept range, then falls: the taught result. */
  | 'peak-inside-range'
  | 'monotonic-increasing'
  | 'monotonic-decreasing'
  /** Fewer than three stops: not enough to claim a shape. */
  | 'insufficient-points';

export interface SixActsSweepSegments {
  readonly shape: SixActsSweepShape;
  /** The best recorded stop, or null when the shape does not support one. */
  readonly peak: SixActsSweepSample | null;
  /** Stops below the peak: fixed overhead dominates and J/bit rises sharply. */
  readonly belowPeak: readonly SixActsSweepSample[];
  /** Stops above the peak: linear supply power against log rate growth. */
  readonly abovePeak: readonly SixActsSweepSample[];
}

/**
 * Records one sweep session.
 *
 * The frame-set digest is fixed at construction: both arms are compared against
 * one deterministic replay, and a point from a different frame set would
 * silently turn the comparison into two unrelated runs.
 */
export class SixActsPowerSweep {
  readonly frameSetDigest: string;
  readonly scenarioId: string;
  readonly beamPowerCapW: number;

  private readonly recorded: SixActsSweepPoint[] = [];

  constructor(options: {
    readonly frameSetDigest: string;
    readonly scenarioId: string;
    readonly beamPowerCapW?: number;
  }) {
    this.frameSetDigest = options.frameSetDigest;
    this.scenarioId = options.scenarioId;
    this.beamPowerCapW = options.beamPowerCapW ?? SIX_ACTS_BEAM_POWER_CAP_W;
  }

  get points(): readonly SixActsSweepPoint[] {
    return Object.freeze([...this.recorded]);
  }

  record(point: SixActsSweepPoint): void {
    if (!Number.isFinite(point.beamPowerW) || point.beamPowerW <= 0) {
      fail('INVALID_POWER', 'a swept beam power must be finite and positive W');
    }
    if (point.beamPowerCapW !== this.beamPowerCapW) {
      fail(
        'POWER_CAP_MISMATCH',
        'an arm may not change the rated power cap: that is hardware, not policy',
      );
    }
    if (point.beamPowerW > this.beamPowerCapW) {
      fail(
        'POWER_ABOVE_CAP',
        `${point.beamPowerW} W exceeds the rated cap of ${this.beamPowerCapW} W`,
      );
    }
    if (point.frameSetDigest !== this.frameSetDigest) {
      fail(
        'FRAME_SET_MISMATCH',
        'both arms must sweep the same immutable replay frames for the curves to be comparable',
      );
    }
    if (point.summary.scenarioId !== this.scenarioId) {
      fail('SCENARIO_MISMATCH', `point scenario ${point.summary.scenarioId} is not ${this.scenarioId}`);
    }
    const duplicate = this.recorded.some(
      existing => existing.arm === point.arm && existing.beamPowerW === point.beamPowerW,
    );
    if (duplicate) {
      fail('DUPLICATE_POINT', `${point.arm} already has a stop at ${point.beamPowerW} W`);
    }
    this.recorded.push(point);
  }

  /** One arm's stops, ordered by swept power. */
  curveFor(arm: SixActsSweepArm): readonly SixActsSweepSample[] {
    return Object.freeze(this.recorded
      .filter(point => point.arm === arm)
      .sort((left, right) => left.beamPowerW - right.beamPowerW)
      .map(point => Object.freeze({
        beamPowerW: point.beamPowerW,
        deliveredDataMbit: point.summary.deliveredDataMbit,
        totalEnergyJ: point.summary.totalEnergyJ,
        runEeMbitPerJ: point.summary.runEeMbitPerJ,
        lowSinrRatioPercent: point.summary.lowSinrRatioPercent,
        outageDurationSec: point.summary.outageDurationSec,
      })));
  }

  /** The arms that have at least one recorded stop. */
  get recordedArms(): readonly SixActsSweepArm[] {
    return Object.freeze([...new Set(this.recorded.map(point => point.arm))].sort());
  }
}

/**
 * Reads the three-segment structure out of one recorded curve.
 *
 * The peak is whichever recorded stop has the highest EE. A curve that only
 * rises or only falls is reported as such: the claim is that the optimum is
 * computed, so manufacturing one where the data has none would defeat it.
 */
export function describeSixActsSweepSegments(
  curve: readonly SixActsSweepSample[],
): SixActsSweepSegments {
  if (curve.length < 3) {
    return Object.freeze({
      shape: 'insufficient-points' as const,
      peak: null,
      belowPeak: Object.freeze([]),
      abovePeak: Object.freeze([]),
    });
  }

  let peakIndex = 0;
  for (let index = 1; index < curve.length; index += 1) {
    if (curve[index].runEeMbitPerJ > curve[peakIndex].runEeMbitPerJ) peakIndex = index;
  }

  if (peakIndex === curve.length - 1) {
    return Object.freeze({
      shape: 'monotonic-increasing' as const,
      peak: null,
      belowPeak: Object.freeze([...curve]),
      abovePeak: Object.freeze([]),
    });
  }
  if (peakIndex === 0) {
    return Object.freeze({
      shape: 'monotonic-decreasing' as const,
      peak: null,
      belowPeak: Object.freeze([]),
      abovePeak: Object.freeze([...curve]),
    });
  }

  return Object.freeze({
    shape: 'peak-inside-range' as const,
    peak: curve[peakIndex],
    belowPeak: Object.freeze(curve.slice(0, peakIndex)),
    abovePeak: Object.freeze(curve.slice(peakIndex + 1)),
  });
}
