import {
  ENERGY_LAB_FRAME_SET_DIGEST,
  ENERGY_LAB_PARAMS,
  ENERGY_LAB_SCENARIO_ID,
  ENERGY_LAB_STOPS,
  energyLabPoint,
  type EnergyLabPoint,
} from './energyLabFixture';

/**
 * The lesson clock is deliberately longer than the fixture sweep.  The clock
 * controls presentation only; every displayed scientific value is still an
 * exact point from `energyLabFixture.ts`.
 */
export const ENERGY_LAB_DURATION_SEC = 84;
export const ENERGY_LAB_PREDICTION_END_SEC = 10;
export const ENERGY_LAB_ACT6_DURATION_SEC = 42;

const BASELINE_POWER_W = ENERGY_LAB_STOPS[6]!;
const LOW_POWER_W = ENERGY_LAB_STOPS[0]!;
const MAX_POWER_W = ENERGY_LAB_STOPS[ENERGY_LAB_STOPS.length - 1]!;

const DOWNWARD_SWEEP_STOPS: readonly number[] = Object.freeze([
  ENERGY_LAB_STOPS[5]!,
  ENERGY_LAB_STOPS[4]!,
  ENERGY_LAB_STOPS[3]!,
  ENERGY_LAB_STOPS[2]!,
  ENERGY_LAB_STOPS[1]!,
  ENERGY_LAB_STOPS[0]!,
]);

const UPWARD_SWEEP_STOPS: readonly number[] = Object.freeze([
  ENERGY_LAB_STOPS[1]!,
  ENERGY_LAB_STOPS[2]!,
  ENERGY_LAB_STOPS[3]!,
  ENERGY_LAB_STOPS[4]!,
  ENERGY_LAB_STOPS[5]!,
  ENERGY_LAB_STOPS[6]!,
  ENERGY_LAB_STOPS[7]!,
  ENERGY_LAB_STOPS[8]!,
  ENERGY_LAB_STOPS[9]!,
]);

/** Four teacher-facing buttons; every value is a fixture stop, not a new arm. */
export const ENERGY_LAB_CHECKPOINTS: readonly number[] = Object.freeze([
  ENERGY_LAB_STOPS[0]!,
  ENERGY_LAB_STOPS[3]!,
  ENERGY_LAB_STOPS[6]!,
  ENERGY_LAB_STOPS[9]!,
]);

export const ENERGY_LAB_QUESTION_POWER_W = LOW_POWER_W;

export const ENERGY_LAB_SOURCE_CONTRACT = Object.freeze({
  frameSetDigest: ENERGY_LAB_FRAME_SET_DIGEST,
  scenarioId: ENERGY_LAB_SCENARIO_ID,
  eeLabel: 'ΣR / P^N = η · Mbit/J',
  rateUnit: 'Mbit/s',
  systemPowerUnit: 'W',
  energyEfficiencyUnit: 'Mbit/J',
  evidenceLimit: '固定教學資料；不是即時網路結果。',
});

export type EnergyLabPrediction = 'service-survives' | 'service-fails';
export type EnergyLabServiceAnswer = 'all-served' | 'service-fails';

export type EnergyLabBeatId =
  | 'prediction'
  | 'baseline'
  | 'downward-sweep'
  | 'outage-reveal'
  | 'upward-sweep'
  | 'checkpoint-compare'
  | 'finale';

export type EnergyLabAct6BeatId = 'source' | 'sample' | 'receipt';

export type EnergyLabAct = 5 | 6;

export function energyLabActFromSearch(search: string): EnergyLabAct {
  return new URLSearchParams(search).get('act') === '6' ? 6 : 5;
}

export function energyLabActFromLocation(pathname: string, search: string): EnergyLabAct {
  if (pathname === '/course/energy-evidence') return 6;
  return energyLabActFromSearch(search);
}

export interface EnergyLabBeat {
  readonly id: EnergyLabBeatId;
  readonly startSec: number;
  readonly endSec: number;
}

export interface EnergyLabAct6Beat {
  readonly id: EnergyLabAct6BeatId;
  readonly startSec: number;
  readonly endSec: number;
}

export const ENERGY_LAB_BEATS: readonly EnergyLabBeat[] = Object.freeze([
  Object.freeze({ id: 'prediction' as const, startSec: 0, endSec: 10 }),
  Object.freeze({ id: 'baseline' as const, startSec: 10, endSec: 20 }),
  Object.freeze({ id: 'downward-sweep' as const, startSec: 20, endSec: 38 }),
  Object.freeze({ id: 'outage-reveal' as const, startSec: 38, endSec: 50 }),
  Object.freeze({ id: 'upward-sweep' as const, startSec: 50, endSec: 70 }),
  Object.freeze({ id: 'checkpoint-compare' as const, startSec: 70, endSec: 78 }),
  Object.freeze({ id: 'finale' as const, startSec: 78, endSec: 84 }),
]);

export const ENERGY_LAB_ACT6_BEATS: readonly EnergyLabAct6Beat[] = Object.freeze([
  Object.freeze({ id: 'source' as const, startSec: 0, endSec: 12 }),
  Object.freeze({ id: 'sample' as const, startSec: 12, endSec: 27 }),
  Object.freeze({ id: 'receipt' as const, startSec: 27, endSec: ENERGY_LAB_ACT6_DURATION_SEC }),
]);

export interface EnergyLabSample {
  readonly powerW: number;
  readonly point: EnergyLabPoint;
}

export type EnergyLabServiceState = 'healthy' | 'degraded' | 'outage';

export interface EnergyLabDirectorFrame {
  readonly courseTimeSec: number;
  readonly beat: EnergyLabBeat;
  readonly beatProgress: number;
  readonly currentSample: EnergyLabSample;
  readonly selectedSample: EnergyLabSample;
  readonly sampledPoints: readonly EnergyLabSample[];
  readonly traceSamples: readonly EnergyLabSample[];
  readonly bestSample: EnergyLabSample;
  readonly serviceState: EnergyLabServiceState;
  readonly lowSinrUserCount: number;
  readonly totalUserCount: number;
  readonly questionSample: EnergyLabSample;
  readonly questionAnswer: EnergyLabServiceAnswer;
  readonly bestServiceValidSample: EnergyLabSample;
  readonly sourceContract: typeof ENERGY_LAB_SOURCE_CONTRACT;
  /** A presentation-only intensity; no scientific value is derived from it. */
  readonly beamVisualStrength: number;
}

export interface EnergyLabLocalReceiptField {
  readonly key: 'DELIVERED_DATA_MBIT' | 'TOTAL_ENERGY_J' | 'RUN_EE_MBIT_PER_J' | 'LOW_SINR_RATIO';
  readonly value: number;
  readonly unit: 'Mbit' | 'J' | 'Mbit/J' | 'ratio';
}

export interface EnergyLabLocalReceipt {
  readonly receiptId: string;
  readonly frameSetDigest: typeof ENERGY_LAB_FRAME_SET_DIGEST;
  readonly scenarioId: typeof ENERGY_LAB_SCENARIO_ID;
  readonly sourceLabel: 'deterministic-teaching-fixture';
  readonly persistence: 'local-only';
  readonly samplePowerW: number;
  readonly sampleDurationSec: 1;
  readonly fields: readonly EnergyLabLocalReceiptField[];
  readonly evidenceLimit: typeof ENERGY_LAB_SOURCE_CONTRACT.evidenceLimit;
}

const SAMPLED_POINTS: readonly EnergyLabSample[] = Object.freeze(
  ENERGY_LAB_STOPS.map(powerW => Object.freeze({ powerW, point: energyLabPoint(powerW) })),
);

function clampTime(courseTimeSec: number): number {
  if (!Number.isFinite(courseTimeSec) || courseTimeSec < 0) return 0;
  return Math.min(ENERGY_LAB_DURATION_SEC, courseTimeSec);
}

export function clampEnergyLabCourseTime(courseTimeSec: number): number {
  return clampTime(courseTimeSec);
}

export function advanceEnergyLabCourseTime(
  courseTimeSec: number,
  elapsedSec: number,
  playbackSpeed: number,
): number {
  const safeElapsed = Number.isFinite(elapsedSec) && elapsedSec > 0 ? elapsedSec : 0;
  const safeSpeed = Number.isFinite(playbackSpeed) && playbackSpeed > 0 ? playbackSpeed : 1;
  return clampTime(courseTimeSec + safeElapsed * safeSpeed);
}

function beatForTime(courseTimeSec: number): EnergyLabBeat {
  const time = clampTime(courseTimeSec);
  const beat = ENERGY_LAB_BEATS.find(candidate => time < candidate.endSec);
  return beat ?? ENERGY_LAB_BEATS[ENERGY_LAB_BEATS.length - 1]!;
}

export function energyLabBeatAtTime(courseTimeSec: number): EnergyLabBeat {
  return beatForTime(courseTimeSec);
}

export function energyLabBeatProgress(courseTimeSec: number, beat = beatForTime(courseTimeSec)): number {
  if (beat.endSec <= beat.startSec) return 1;
  return Math.max(0, Math.min(1, (clampTime(courseTimeSec) - beat.startSec) / (beat.endSec - beat.startSec)));
}

function stopAt(powerW: number): EnergyLabSample {
  const sample = SAMPLED_POINTS.find(candidate => candidate.powerW === powerW);
  if (sample === undefined) throw new RangeError(`energy-lab power ${powerW} W is not a fixture stop`);
  return sample;
}

function stepStop(stops: readonly number[], progress: number): number {
  const index = Math.min(stops.length - 1, Math.floor(Math.max(0, Math.min(0.999999, progress)) * stops.length));
  return stops[index]!;
}

function powerForBeat(beat: EnergyLabBeat, progress: number): number {
  switch (beat.id) {
    case 'prediction':
    case 'baseline':
      return BASELINE_POWER_W;
    case 'downward-sweep':
      return stepStop(DOWNWARD_SWEEP_STOPS, progress);
    case 'outage-reveal':
      return LOW_POWER_W;
    case 'upward-sweep':
      return stepStop(UPWARD_SWEEP_STOPS, progress);
    case 'checkpoint-compare':
      return BASELINE_POWER_W;
    case 'finale':
      return BASELINE_POWER_W;
  }
}

function uniqueSortedSamples(powerStops: readonly number[]): readonly EnergyLabSample[] {
  return Object.freeze([...new Set(powerStops)].sort((left, right) => left - right).map(stopAt));
}

function traceStopsForBeat(beat: EnergyLabBeat, progress: number): readonly number[] {
  switch (beat.id) {
    case 'prediction':
      return Object.freeze([]);
    case 'baseline':
      return Object.freeze([BASELINE_POWER_W]);
    case 'downward-sweep': {
      const revealed = DOWNWARD_SWEEP_STOPS.slice(0, Math.max(1, Math.ceil(progress * DOWNWARD_SWEEP_STOPS.length)));
      return uniqueSortedSamples([...revealed, BASELINE_POWER_W]).map(sample => sample.powerW);
    }
    case 'outage-reveal':
      return uniqueSortedSamples([...DOWNWARD_SWEEP_STOPS, BASELINE_POWER_W]).map(sample => sample.powerW);
    case 'upward-sweep': {
      const revealed = UPWARD_SWEEP_STOPS.slice(0, Math.max(1, Math.ceil(progress * UPWARD_SWEEP_STOPS.length)));
      return uniqueSortedSamples([...revealed, ...DOWNWARD_SWEEP_STOPS, BASELINE_POWER_W]).map(sample => sample.powerW);
    }
    case 'checkpoint-compare':
    case 'finale':
      return ENERGY_LAB_STOPS;
  }
}

function serviceStateFor(point: EnergyLabPoint): EnergyLabServiceState {
  const lowSinrUserCount = Math.round(point.lowSinrFraction * ENERGY_LAB_PARAMS.userOffAxisDeg.length);
  if (lowSinrUserCount === 0) return 'healthy';
  if (lowSinrUserCount >= ENERGY_LAB_PARAMS.userOffAxisDeg.length) return 'outage';
  return 'degraded';
}

function isServiceValid(sample: EnergyLabSample): boolean {
  return sample.point.lowSinrFraction === 0;
}

function serviceAnswerFor(sample: EnergyLabSample): EnergyLabServiceAnswer {
  return isServiceValid(sample) ? 'all-served' : 'service-fails';
}

export function sampledEnergyLabPoints(): readonly EnergyLabSample[] {
  return SAMPLED_POINTS;
}

export function serviceValidEnergyLabPoints(): readonly EnergyLabSample[] {
  return Object.freeze(SAMPLED_POINTS.filter(isServiceValid));
}

export function energyLabSampleAt(powerW: number): EnergyLabSample {
  return stopAt(powerW);
}

export function bestSampledEnergyLabPoint(): EnergyLabSample {
  let best = serviceValidEnergyLabPoints()[0] ?? SAMPLED_POINTS[0]!;
  for (const candidate of serviceValidEnergyLabPoints().slice(1)) {
    if (candidate.point.eeMbitPerJ > best.point.eeMbitPerJ) best = candidate;
  }
  return best;
}

export function energyLabAct6BeatAtTime(courseTimeSec: number): EnergyLabAct6Beat {
  const time = Math.max(0, Math.min(ENERGY_LAB_ACT6_DURATION_SEC, Number.isFinite(courseTimeSec) ? courseTimeSec : 0));
  return ENERGY_LAB_ACT6_BEATS.find(candidate => time < candidate.endSec)
    ?? ENERGY_LAB_ACT6_BEATS[ENERGY_LAB_ACT6_BEATS.length - 1]!;
}

export function buildEnergyLabLocalReceipt(sample = bestSampledEnergyLabPoint()): EnergyLabLocalReceipt {
  const point = sample.point;
  return Object.freeze({
    receiptId: `local-energy-fixture-${sample.powerW.toFixed(2).replace('.', '-')}`,
    frameSetDigest: ENERGY_LAB_FRAME_SET_DIGEST,
    scenarioId: ENERGY_LAB_SCENARIO_ID,
    sourceLabel: 'deterministic-teaching-fixture' as const,
    persistence: 'local-only' as const,
    samplePowerW: sample.powerW,
    sampleDurationSec: 1 as const,
    fields: Object.freeze([
      Object.freeze({ key: 'DELIVERED_DATA_MBIT' as const, value: point.totalRateMbps, unit: 'Mbit' as const }),
      Object.freeze({ key: 'TOTAL_ENERGY_J' as const, value: point.systemPowerW, unit: 'J' as const }),
      Object.freeze({ key: 'RUN_EE_MBIT_PER_J' as const, value: point.eeMbitPerJ, unit: 'Mbit/J' as const }),
      Object.freeze({ key: 'LOW_SINR_RATIO' as const, value: point.lowSinrFraction, unit: 'ratio' as const }),
    ]),
    evidenceLimit: ENERGY_LAB_SOURCE_CONTRACT.evidenceLimit,
  });
}

export function resolveEnergyLabFrame(
  courseTimeSec: number,
  selectedCheckpointW = BASELINE_POWER_W,
): EnergyLabDirectorFrame {
  const clampedTime = clampTime(courseTimeSec);
  const beat = beatForTime(clampedTime);
  const progress = energyLabBeatProgress(clampedTime, beat);
  const currentSample = stopAt(powerForBeat(beat, progress));
  const selectedSample = stopAt(selectedCheckpointW);
  const bestSample = bestSampledEnergyLabPoint();
  const questionSample = stopAt(ENERGY_LAB_QUESTION_POWER_W);
  const traceSamples = Object.freeze(traceStopsForBeat(beat, progress).map(stopAt));
  const lowSinrUserCount = Math.round(currentSample.point.lowSinrFraction * ENERGY_LAB_PARAMS.userOffAxisDeg.length);

  return Object.freeze({
    courseTimeSec: clampedTime,
    beat,
    beatProgress: progress,
    currentSample,
    selectedSample,
    sampledPoints: SAMPLED_POINTS,
    traceSamples,
    bestSample,
    serviceState: serviceStateFor(currentSample.point),
    lowSinrUserCount,
    totalUserCount: ENERGY_LAB_PARAMS.userOffAxisDeg.length,
    questionSample,
    questionAnswer: serviceAnswerFor(questionSample),
    bestServiceValidSample: bestSample,
    sourceContract: ENERGY_LAB_SOURCE_CONTRACT,
    beamVisualStrength: beat.id === 'prediction'
      ? 0.66
      : Math.max(0.14, Math.min(1, currentSample.powerW / MAX_POWER_W)),
  });
}

export function predictionLabel(prediction: EnergyLabPrediction | null): string {
  if (prediction === 'service-survives') return '仍可全部服務';
  if (prediction === 'service-fails') return '無法全部服務';
  return '尚未選擇';
}

export function observedCheckpointLabel(sample: EnergyLabSample, best = bestSampledEnergyLabPoint()): string {
  const lowSinrUserCount = Math.round(sample.point.lowSinrFraction * ENERGY_LAB_PARAMS.userOffAxisDeg.length);
  if (lowSinrUserCount >= ENERGY_LAB_PARAMS.userOffAxisDeg.length) return '全體低-SINR／服務中斷';
  if (lowSinrUserCount > 0) return `${lowSinrUserCount}/${ENERGY_LAB_PARAMS.userOffAxisDeg.length} 位 UE 低-SINR`;
  if (sample.powerW === best.powerW) return '採樣 EE 最高';
  if (sample.point.eeMbitPerJ < best.point.eeMbitPerJ) return '服務健康，但 EE 低於最佳採樣';
  return '服務健康';
}

export const ENERGY_LAB_BASELINE_POWER_W = BASELINE_POWER_W;
export const ENERGY_LAB_LOW_POWER_W = LOW_POWER_W;
