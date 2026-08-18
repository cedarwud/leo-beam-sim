import type { CanonicalTleHandoverEvent } from '../../simulator/canonicalTleHandover';
import type { TleAnalysisRun } from '../../simulator/tleAnalysisRun';

export const VISUAL_LAB_CANONICAL_TIMELINE_SCHEMA = 'visual-lab-canonical-timeline-v1' as const;

export interface VisualLabCanonicalTimelinePoint {
  readonly anchorIndex: number;
  readonly timeSec: number;
  readonly instantUtc: string;
  readonly servingSatelliteId: string;
  readonly candidateSatelliteId: string | null;
  readonly servingSinrDb: number;
  readonly candidateSinrDb: number | null;
  readonly throughputBps: number;
  readonly powerW: number;
  /** Per-anchor canonical EE, aligned with the instantaneous result dock. */
  readonly instantaneousEeBitsPerJ: number;
  readonly deliveredBits: number;
  readonly energyJ: number;
  readonly cumulativeEeBitsPerJ: number;
  readonly handoverCount: number;
}

export interface VisualLabCanonicalHandoverMarker {
  readonly eventId: string;
  readonly event: Exclude<CanonicalTleHandoverEvent, 'none' | 'initial-attach'>;
  readonly anchorIndex: number;
  readonly timeSec: number;
  readonly instantUtc: string;
  readonly fromSatelliteId: string;
  readonly toSatelliteId: string;
  readonly reason: string;
}

export interface VisualLabCanonicalTimeline {
  readonly schemaVersion: typeof VISUAL_LAB_CANONICAL_TIMELINE_SCHEMA;
  readonly isMock: false;
  readonly availability: 'available';
  readonly analysisRunId: string;
  readonly geometryRunId: string;
  readonly durationSec: number;
  readonly stepSec: number;
  readonly anchorCount: number;
  readonly points: readonly VisualLabCanonicalTimelinePoint[];
  readonly markers: readonly VisualLabCanonicalHandoverMarker[];
}

const timelineCache = new WeakMap<TleAnalysisRun, VisualLabCanonicalTimeline>();

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} is not finite`);
  return value;
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

/**
 * Project one completed accepted analysis run onto a compact real-data chart.
 * Every interval contributes to cumulative data and energy.  Display points
 * are downsampled only after that exact accumulation, and every real serving
 * change anchor is retained even when it falls between the regular samples.
 */
export function adaptTleAnalysisRunToVisualLabTimeline(
  run: TleAnalysisRun,
  sampleStride = 5,
): VisualLabCanonicalTimeline {
  if (!Number.isInteger(sampleStride) || sampleStride <= 0) {
    throw new RangeError('sampleStride must be a positive integer');
  }
  if (sampleStride === 5) {
    const cached = timelineCache.get(run);
    if (cached !== undefined) return cached;
  }

  // A replay needs an accepted point before, at, and after each real serving
  // change.  Retain those neighbouring anchors in addition to the compact
  // chart stride so the Story controller never has to invent an intermediate
  // value or infer a handover from a downsampled point.
  const storyAnchors = new Set<number>();
  for (const event of run.handoverTrace.servingChangeEvents) {
    for (const anchorIndex of [
      event.triggerAnchorIndex - 1,
      event.triggerAnchorIndex,
      event.triggerAnchorIndex + 1,
    ]) {
      if (anchorIndex >= 0 && anchorIndex < run.anchorCount) storyAnchors.add(anchorIndex);
    }
  }
  for (const transition of run.beamScheduleTrace?.transitionEvidence ?? []) {
    if (
      transition.kind !== 'same-satellite-beam-switch'
      || transition.servicePairChanged !== true
    ) continue;
    for (const anchorIndex of [
      transition.fromSlot.anchorIndex,
      transition.toSlot.anchorIndex,
      transition.toSlot.anchorIndex + 1,
    ]) {
      if (anchorIndex >= 0 && anchorIndex < run.anchorCount) storyAnchors.add(anchorIndex);
    }
  }
  const points: VisualLabCanonicalTimelinePoint[] = [];
  let deliveredBits = 0;
  let energyJ = 0;
  let previousFrame = null as ReturnType<TleAnalysisRun['getFrame']>;

  for (let anchorIndex = 0; anchorIndex < run.anchorCount; anchorIndex += 1) {
    if (anchorIndex > 0 && previousFrame !== null) {
      deliveredBits += finite(previousFrame.throughput.totalRateBps, `anchor ${anchorIndex - 1} throughput`) * run.stepS;
      energyJ += finite(previousFrame.power.systemPowerW, `anchor ${anchorIndex - 1} power`) * run.stepS;
    }
    const frame = run.getFrame(anchorIndex);
    if (frame === null) throw new Error(`accepted analysis run has no frame at anchor ${anchorIndex}`);
    previousFrame = frame;

    const keep = anchorIndex === 0
      || anchorIndex === run.anchorCount - 1
      || anchorIndex % sampleStride === 0
      || storyAnchors.has(anchorIndex);
    if (!keep) continue;

    const serving = frame.links[0];
    if (serving === undefined) throw new Error(`accepted frame ${frame.frameId} has no serving link`);
    const trace = frame.handover;
    const cumulativeEeBitsPerJ = energyJ === 0 ? 0 : deliveredBits / energyJ;
    points.push(freeze({
      anchorIndex,
      timeSec: anchorIndex * run.stepS,
      instantUtc: frame.instantUtc,
      servingSatelliteId: serving.satelliteId,
      candidateSatelliteId: frame.candidateLink?.satelliteId ?? null,
      servingSinrDb: finite(serving.sinrDb, `anchor ${anchorIndex} serving SINR`),
      candidateSinrDb: frame.candidateLink === null
        ? null
        : finite(frame.candidateLink.sinrDb, `anchor ${anchorIndex} candidate SINR`),
      throughputBps: finite(frame.throughput.totalRateBps, `anchor ${anchorIndex} throughput`),
      powerW: finite(frame.power.systemPowerW, `anchor ${anchorIndex} power`),
      instantaneousEeBitsPerJ: finite(
        frame.ee.instantaneousBitsPerJ,
        `anchor ${anchorIndex} instantaneous EE`,
      ),
      deliveredBits,
      energyJ,
      cumulativeEeBitsPerJ,
      handoverCount: trace?.cumulativeCount ?? 0,
    }));
  }

  const markers = run.handoverTrace.servingChangeEvents.map(event => freeze({
    eventId: event.eventId,
    event: event.sourceEvent,
    anchorIndex: event.triggerAnchorIndex,
    timeSec: event.triggerAnchorIndex * run.stepS,
    instantUtc: event.triggerInstantUtc,
    fromSatelliteId: event.fromSatelliteId,
    toSatelliteId: event.toSatelliteId,
    reason: event.reason,
  } satisfies VisualLabCanonicalHandoverMarker));

  const timeline = freeze({
    schemaVersion: VISUAL_LAB_CANONICAL_TIMELINE_SCHEMA,
    isMock: false,
    availability: 'available',
    analysisRunId: run.analysisRunId,
    geometryRunId: run.geometryRunId,
    durationSec: run.durationS,
    stepSec: run.stepS,
    anchorCount: run.anchorCount,
    points: freeze(points),
    markers: freeze(markers),
  } satisfies VisualLabCanonicalTimeline);
  if (sampleStride === 5) timelineCache.set(run, timeline);
  return timeline;
}

export const createVisualLabCanonicalTimeline = adaptTleAnalysisRunToVisualLabTimeline;
