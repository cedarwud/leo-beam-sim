/**
 * Experiment 6: Pure TypeScript model for 24-hour multi-satellite contact schedule.
 *
 * Computes:
 * - All satellite contact pass windows across the 24-hour diurnal period
 * - Total contact opportunity minutes (raw sum of pass durations)
 * - Total merged contact coverage minutes (non-overlapping union of coverage)
 * - Longest outage duration, start/end timestamps, and neighboring passes
 * - Overlap count (intervals where >= 2 satellites provide simultaneous coverage)
 * - Concurrency distribution (0, 1, 2, 3+ satellites in view)
 *
 * Scientific Boundary:
 * All results represent geometric contact opportunities and NOT guaranteed RF service.
 */

import { twoline2satrec, type SatRec } from 'satellite.js';

import type {
  MultiSatScheduleRequest,
  MultiSatScheduleResult,
  OutageInterval,
  OverlapInterval,
  SatellitePassWindow,
  ScheduleInterval,
  SingleReceiverSchedule,
  TopocentricLookPoint,
} from './types';
import { NTPU_LAB_OBSERVER } from './fixtures';
import { createLabProvenance } from './scientificBoundaries';
import {
  computeLookAngleAtInstant,
  findCrossingInstant,
  refinePeakInstant,
} from './singlePassModel';

export const DEFAULT_SCHEDULE_DURATION_HOURS = 24;
export const DEFAULT_SCHEDULE_STEP_SEC = 30; // 30-second scan resolution for 24h catalog

interface InternalSatPass {
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly orbitalPlane?: string;
  readonly aosMs: number;
  readonly aosUtc: string;
  readonly aosAzimuthDeg: number;
  readonly aosElevationDeg: number;
  readonly aosRangeKm: number;
  readonly peakMs: number;
  readonly peakUtc: string;
  readonly peakAzimuthDeg: number;
  readonly peakElevationDeg: number;
  readonly peakRangeKm: number;
  readonly losMs: number;
  readonly losUtc: string;
  readonly losAzimuthDeg: number;
  readonly losElevationDeg: number;
  readonly losRangeKm: number;
  readonly durationSec: number;
}

/**
 * Extracts all passes for a single satellite across a time window above minimumElevationDeg.
 */
function extractSatPasses(
  satrec: SatRec,
  satelliteId: string,
  satelliteName: string,
  orbitalPlane: string | undefined,
  windowStartMs: number,
  windowEndMs: number,
  stepSec: number,
  minimumElevationDeg: number,
  observer = NTPU_LAB_OBSERVER,
): readonly InternalSatPass[] {
  const passes: InternalSatPass[] = [];

  let inPass = false;
  let passStartScanMs = -1;
  let passPeakSample: TopocentricLookPoint | null = null;
  let prevSample: TopocentricLookPoint | null = null;

  for (let t = windowStartMs; t <= windowEndMs; t += stepSec * 1000) {
    const current = computeLookAngleAtInstant(satrec, t, observer);
    if (!current) {
      prevSample = null;
      continue;
    }

    const isAbove = current.elevationDeg >= minimumElevationDeg;

    if (!inPass && isAbove) {
      inPass = true;
      passStartScanMs = t;
      passPeakSample = current;
    } else if (inPass) {
      if (passPeakSample === null || current.elevationDeg > passPeakSample.elevationDeg) {
        passPeakSample = current;
      }
      if (!isAbove) {
        inPass = false;
        // Refine AOS: find previous crossing below threshold
        let beforeAosMs = prevSample ? prevSample.instantMs : passStartScanMs - stepSec * 1000;
        let scanBack = computeLookAngleAtInstant(satrec, beforeAosMs, observer);
        while (scanBack && scanBack.elevationDeg >= minimumElevationDeg && beforeAosMs > windowStartMs - 20 * 60 * 1000) {
          beforeAosMs -= stepSec * 1000;
          scanBack = computeLookAngleAtInstant(satrec, beforeAosMs, observer);
        }

        const refinedAos = findCrossingInstant(satrec, beforeAosMs, beforeAosMs + stepSec * 1000, minimumElevationDeg, observer)
          ?? computeLookAngleAtInstant(satrec, passStartScanMs, observer)!;
        const boundedAos = refinedAos.instantMs < windowStartMs
          ? computeLookAngleAtInstant(satrec, windowStartMs, observer) ?? refinedAos
          : refinedAos;

        const atLosMs = prevSample ? prevSample.instantMs : t - stepSec * 1000;
        const refinedLosCandidate = findCrossingInstant(satrec, atLosMs, t, minimumElevationDeg, observer)
          ?? current;
        const boundedLos = refinedLosCandidate.instantMs > windowEndMs
          ? computeLookAngleAtInstant(satrec, windowEndMs, observer) ?? refinedLosCandidate
          : refinedLosCandidate;

        // Refine Peak between AOS and LOS
        const peakSample = refinePeakInstant(satrec, boundedAos.instantMs, boundedLos.instantMs, observer);

        const durSec = Math.max(0, (boundedLos.instantMs - boundedAos.instantMs) / 1000);
        if (durSec > 0) {
          passes.push({
            satelliteId,
            satelliteName,
            orbitalPlane,
            aosMs: boundedAos.instantMs,
            aosUtc: boundedAos.instantUtc,
            aosAzimuthDeg: boundedAos.azimuthDeg,
            aosElevationDeg: boundedAos.elevationDeg,
            aosRangeKm: boundedAos.rangeKm,
            peakMs: peakSample.instantMs,
            peakUtc: peakSample.instantUtc,
            peakAzimuthDeg: peakSample.azimuthDeg,
            peakElevationDeg: peakSample.elevationDeg,
            peakRangeKm: peakSample.rangeKm,
            losMs: boundedLos.instantMs,
            losUtc: boundedLos.instantUtc,
            losAzimuthDeg: boundedLos.azimuthDeg,
            losElevationDeg: boundedLos.elevationDeg,
            losRangeKm: boundedLos.rangeKm,
            durationSec: durSec,
          });
        }
        passPeakSample = null;
      }
    }
    prevSample = current;
  }

  // Handle pass that extends to the end of the window
  if (inPass && prevSample) {
    let beforeAosMs = passStartScanMs - stepSec * 1000;
    let scanBack = computeLookAngleAtInstant(satrec, beforeAosMs, observer);
    while (scanBack && scanBack.elevationDeg >= minimumElevationDeg && beforeAosMs > windowStartMs - 20 * 60 * 1000) {
      beforeAosMs -= stepSec * 1000;
      scanBack = computeLookAngleAtInstant(satrec, beforeAosMs, observer);
    }

    const refinedAos = findCrossingInstant(satrec, beforeAosMs, beforeAosMs + stepSec * 1000, minimumElevationDeg, observer)
      ?? computeLookAngleAtInstant(satrec, passStartScanMs, observer)!;
    const boundedAos = refinedAos.instantMs < windowStartMs
      ? computeLookAngleAtInstant(satrec, windowStartMs, observer) ?? refinedAos
      : refinedAos;

    // Scan forward to find LOS
    let forwardMs = prevSample.instantMs + stepSec * 1000;
    let scanFwd = computeLookAngleAtInstant(satrec, forwardMs, observer);
    while (scanFwd && scanFwd.elevationDeg >= minimumElevationDeg && forwardMs < windowEndMs + 20 * 60 * 1000) {
      forwardMs += stepSec * 1000;
      scanFwd = computeLookAngleAtInstant(satrec, forwardMs, observer);
    }

    const refinedLosCandidate = findCrossingInstant(satrec, forwardMs - stepSec * 1000, forwardMs, minimumElevationDeg, observer)
      ?? prevSample;
    const boundedLos = refinedLosCandidate.instantMs > windowEndMs
      ? computeLookAngleAtInstant(satrec, windowEndMs, observer) ?? refinedLosCandidate
      : refinedLosCandidate;

    const peakSample = refinePeakInstant(satrec, boundedAos.instantMs, boundedLos.instantMs, observer);
    const durSec = Math.max(0, (boundedLos.instantMs - boundedAos.instantMs) / 1000);

    if (durSec > 0) {
      passes.push({
        satelliteId,
        satelliteName,
        orbitalPlane,
        aosMs: boundedAos.instantMs,
        aosUtc: boundedAos.instantUtc,
        aosAzimuthDeg: boundedAos.azimuthDeg,
        aosElevationDeg: boundedAos.elevationDeg,
        aosRangeKm: boundedAos.rangeKm,
        peakMs: peakSample.instantMs,
        peakUtc: peakSample.instantUtc,
        peakAzimuthDeg: peakSample.azimuthDeg,
        peakElevationDeg: peakSample.elevationDeg,
        peakRangeKm: peakSample.rangeKm,
        losMs: boundedLos.instantMs,
        losUtc: boundedLos.instantUtc,
        losAzimuthDeg: boundedLos.azimuthDeg,
        losElevationDeg: boundedLos.elevationDeg,
        losRangeKm: boundedLos.rangeKm,
        durationSec: durSec,
      });
    }
  }
  return passes;
}

/**
 * Computes 24-hour multi-satellite contact schedule for Experiment 6.
 */
export function compute24HourMultiSatSchedule(
  request: MultiSatScheduleRequest,
): MultiSatScheduleResult {
  const observer = request.observer ?? NTPU_LAB_OBSERVER;
  const minimumElevationDeg = request.minimumElevationDeg;
  const startMs = Date.parse(request.startUtc);
  if (!Number.isFinite(startMs)) {
    throw new TypeError(`invalid startUtc: ${request.startUtc}`);
  }

  const durationHours = request.durationHours ?? DEFAULT_SCHEDULE_DURATION_HOURS;
  const durationSec = durationHours * 3600;
  const endMs = startMs + durationSec * 1000;
  const stepSec = Math.max(5, request.sampleStepSec ?? DEFAULT_SCHEDULE_STEP_SEC);

  // 1. Extract all passes for all satellites
  const allInternalPasses: InternalSatPass[] = [];

  for (const satInput of request.satellites) {
    let satrec: SatRec;
    try {
      satrec = twoline2satrec(satInput.line1, satInput.line2);
    } catch {
      continue;
    }
    if (!satrec || satrec.error !== 0) continue;

    const satPasses = extractSatPasses(
      satrec,
      satInput.satelliteId,
      satInput.satelliteName,
      satInput.orbitalPlane,
      startMs,
      endMs,
      stepSec,
      minimumElevationDeg,
      observer,
    );
    allInternalPasses.push(...satPasses);
  }

  // 2. Sort all passes chronologically by AOS
  allInternalPasses.sort((a, b) => a.aosMs - b.aosMs || a.satelliteId.localeCompare(b.satelliteId));

  // Build public SatellitePassWindow items with 1-based indexing
  const passes: SatellitePassWindow[] = [];
  const passesBySatellite: Record<string, SatellitePassWindow[]> = {};

  for (let index = 0; index < allInternalPasses.length; index += 1) {
    const raw = allInternalPasses[index]!;
    const passWindow: SatellitePassWindow = Object.freeze({
      passId: `pass-${raw.satelliteId}-${index + 1}`,
      satelliteId: raw.satelliteId,
      satelliteName: raw.satelliteName,
      passIndex: index + 1,
      aos: Object.freeze({
        eventType: 'AOS' as const,
        instantUtc: raw.aosUtc,
        instantMs: raw.aosMs,
        azimuthDeg: raw.aosAzimuthDeg,
        elevationDeg: raw.aosElevationDeg,
        rangeKm: raw.aosRangeKm,
      }),
      peak: Object.freeze({
        eventType: 'PEAK' as const,
        instantUtc: raw.peakUtc,
        instantMs: raw.peakMs,
        azimuthDeg: raw.peakAzimuthDeg,
        elevationDeg: raw.peakElevationDeg,
        maxElevationDeg: raw.peakElevationDeg,
        rangeKm: raw.peakRangeKm,
      }),
      los: Object.freeze({
        eventType: 'LOS' as const,
        instantUtc: raw.losUtc,
        instantMs: raw.losMs,
        azimuthDeg: raw.losAzimuthDeg,
        elevationDeg: raw.losElevationDeg,
        rangeKm: raw.losRangeKm,
      }),
      durationSec: raw.durationSec,
      durationMinutes: raw.durationSec / 60,
      ...(raw.orbitalPlane ? { orbitalPlane: raw.orbitalPlane } : {}),
    });

    passes.push(passWindow);
    if (!passesBySatellite[raw.satelliteId]) {
      passesBySatellite[raw.satelliteId] = [];
    }
    passesBySatellite[raw.satelliteId]!.push(passWindow);
  }

  // 3. Compute total contact opportunity minutes (raw sum)
  const totalContactOpportunityMinutes = passes.reduce((acc, p) => acc + p.durationMinutes, 0);

  // 4. Merge time intervals to compute true non-overlapping contact coverage and outages
  interface TimeInterval {
    startMs: number;
    endMs: number;
  }

  const sortedIntervals: TimeInterval[] = allInternalPasses
    .map(p => ({
      startMs: Math.max(startMs, p.aosMs),
      endMs: Math.min(endMs, p.losMs),
    }))
    .filter(interval => interval.endMs > interval.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  const mergedIntervals: TimeInterval[] = [];
  for (const interval of sortedIntervals) {
    if (mergedIntervals.length === 0) {
      mergedIntervals.push({ ...interval });
    } else {
      const last = mergedIntervals[mergedIntervals.length - 1]!;
      if (interval.startMs <= last.endMs) {
        last.endMs = Math.max(last.endMs, interval.endMs);
      } else {
        mergedIntervals.push({ ...interval });
      }
    }
  }

  const totalMergedContactCoverageMs = mergedIntervals.reduce((acc, int) => acc + (int.endMs - int.startMs), 0);
  const totalMergedContactCoverageMinutes = totalMergedContactCoverageMs / 60000;
  const coverageDutyCyclePercent = (totalMergedContactCoverageMs / (durationSec * 1000)) * 100;

  // 5. Compute Outages
  const outages: OutageInterval[] = [];
  let currentCoverageCursor = startMs;

  for (let i = 0; i < mergedIntervals.length; i += 1) {
    const int = mergedIntervals[i]!;
    if (int.startMs > currentCoverageCursor) {
      const outageDurSec = (int.startMs - currentCoverageCursor) / 1000;
      // Neighbor labels must be derived from the actual interval boundaries;
      // merged coverage intervals do not have the same index as raw passes
      // when overlaps or multiple passes per satellite are present.
      let previousPass: InternalSatPass | undefined;
      for (const candidate of allInternalPasses) {
        if (candidate.losMs > currentCoverageCursor) break;
        previousPass = candidate;
      }
      const nextPass = allInternalPasses.find(candidate => candidate.aosMs >= int.startMs);

      outages.push(Object.freeze({
        outageId: `outage-${outages.length + 1}`,
        startUtc: new Date(currentCoverageCursor).toISOString(),
        startMs: currentCoverageCursor,
        endUtc: new Date(int.startMs).toISOString(),
        endMs: int.startMs,
        durationSec: outageDurSec,
        durationMinutes: outageDurSec / 60,
        ...(previousPass ? { previousPassSatelliteName: previousPass.satelliteName } : {}),
        ...(nextPass ? { nextPassSatelliteName: nextPass.satelliteName } : {}),
      }));
    }
    currentCoverageCursor = Math.max(currentCoverageCursor, int.endMs);
  }

  if (currentCoverageCursor < endMs) {
    const outageDurSec = (endMs - currentCoverageCursor) / 1000;
    outages.push(Object.freeze({
      outageId: `outage-${outages.length + 1}`,
      startUtc: new Date(currentCoverageCursor).toISOString(),
      startMs: currentCoverageCursor,
      endUtc: new Date(endMs).toISOString(),
      endMs,
      durationSec: outageDurSec,
      durationMinutes: outageDurSec / 60,
      previousPassSatelliteName: passes[passes.length - 1]?.satelliteName,
    }));
  }

  let longestOutage: OutageInterval | null = null;
  for (const out of outages) {
    if (longestOutage === null || out.durationSec > longestOutage.durationSec) {
      longestOutage = out;
    }
  }

  const totalOutageMinutes = outages.reduce((acc, o) => acc + o.durationMinutes, 0);

  // 6. Compute Overlaps and Schedule Timeline Events (sweep-line algorithm)
  interface SweepPoint {
    timeMs: number;
    type: 'START' | 'END';
    satelliteId: string;
    satelliteName: string;
  }

  const sweepPoints: SweepPoint[] = [];
  for (const p of allInternalPasses) {
    const pStart = Math.max(startMs, p.aosMs);
    const pEnd = Math.min(endMs, p.losMs);
    if (pEnd > pStart) {
      sweepPoints.push({ timeMs: pStart, type: 'START', satelliteId: p.satelliteId, satelliteName: p.satelliteName });
      sweepPoints.push({ timeMs: pEnd, type: 'END', satelliteId: p.satelliteId, satelliteName: p.satelliteName });
    }
  }

  sweepPoints.sort((a, b) => a.timeMs - b.timeMs || (a.type === 'END' ? -1 : 1));

  // Partition the 24-hour timeline into contiguous constant-concurrency intervals
  const timelineIntervals: ScheduleInterval[] = [];
  const activeSatsMap = new Map<string, { satelliteId: string; satelliteName: string }>();
  let lastSweepTimeMs = startMs;

  const overlaps: OverlapInterval[] = [];
  const concurrencyTimeMs: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let maxConcurrentSatellites = 0;

  // Add boundary points if not present
  const allEventTimes = Array.from(new Set([startMs, ...sweepPoints.map(sp => sp.timeMs), endMs])).sort((a, b) => a - b);

  let pointIndex = 0;
  for (let i = 0; i < allEventTimes.length - 1; i += 1) {
    const t0 = allEventTimes[i]!;
    const t1 = allEventTimes[i + 1]!;

    // Process all sweep points at t0
    while (pointIndex < sweepPoints.length && sweepPoints[pointIndex]!.timeMs <= t0) {
      const pt = sweepPoints[pointIndex]!;
      if (pt.type === 'START') {
        activeSatsMap.set(pt.satelliteId, { satelliteId: pt.satelliteId, satelliteName: pt.satelliteName });
      } else {
        activeSatsMap.delete(pt.satelliteId);
      }
      pointIndex += 1;
    }

    const concurrency = activeSatsMap.size;
    maxConcurrentSatellites = Math.max(maxConcurrentSatellites, concurrency);
    const deltaMs = t1 - t0;
    const durSec = deltaMs / 1000;

    // Track histogram
    const bucket = concurrency >= 3 ? 3 : concurrency;
    concurrencyTimeMs[bucket] = (concurrencyTimeMs[bucket] ?? 0) + deltaMs;

    const activeList = Array.from(activeSatsMap.values());
    const isOutage = concurrency === 0;
    const isOverlap = concurrency >= 2;

    if (isOverlap) {
      overlaps.push(Object.freeze({
        overlapId: `overlap-${overlaps.length + 1}`,
        startUtc: new Date(t0).toISOString(),
        startMs: t0,
        endUtc: new Date(t1).toISOString(),
        endMs: t1,
        durationSec: durSec,
        durationMinutes: durSec / 60,
        overlappingSatellites: Object.freeze([...activeList]),
        satelliteCount: concurrency,
      }));
    }

    timelineIntervals.push(Object.freeze({
      intervalIndex: timelineIntervals.length + 1,
      startUtc: new Date(t0).toISOString(),
      startMs: t0,
      endUtc: new Date(t1).toISOString(),
      endMs: t1,
      durationSec: durSec,
      durationMinutes: durSec / 60,
      concurrency,
      isOutage,
      isOverlap,
      activeSatellites: Object.freeze(activeList),
    }));
  }

  const concurrencyDistributionMinutes: Record<number, number> = {
    0: (concurrencyTimeMs[0] ?? 0) / 60000,
    1: (concurrencyTimeMs[1] ?? 0) / 60000,
    2: (concurrencyTimeMs[2] ?? 0) / 60000,
    3: (concurrencyTimeMs[3] ?? 0) / 60000,
  };

  const averagePassDurationMinutes = passes.length > 0
    ? totalContactOpportunityMinutes / passes.length
    : 0;

  const provenance = createLabProvenance(observer.id);

  // Freeze passesBySatellite collections
  const frozenPassesBySatellite: Record<string, readonly SatellitePassWindow[]> = {};
  for (const [satId, satPassList] of Object.entries(passesBySatellite)) {
    frozenPassesBySatellite[satId] = Object.freeze(satPassList);
  }

  return Object.freeze({
    windowStartUtc: new Date(startMs).toISOString(),
    windowEndUtc: new Date(endMs).toISOString(),
    durationHours,
    observer,
    minimumElevationDeg,
    satelliteCount: request.satellites.length,
    totalPassesCount: passes.length,
    passes: Object.freeze(passes),
    passesBySatellite: Object.freeze(frozenPassesBySatellite),
    totalContactOpportunityMinutes,
    totalMergedContactCoverageMinutes,
    coverageDutyCyclePercent,
    longestOutage,
    outages: Object.freeze(outages),
    totalOutageMinutes,
    overlapCount: overlaps.length,
    overlaps: Object.freeze(overlaps),
    maxConcurrentSatellites,
    timelineIntervals: Object.freeze(timelineIntervals),
    concurrencyDistributionMinutes: Object.freeze(concurrencyDistributionMinutes),
    averagePassDurationMinutes,
    provenance,
  });
}

/**
 * Weighted interval scheduling for one receiver that can track at most one
 * satellite at a time.  The objective is the maximum sum of geometric window
 * durations.  Slew time, acquisition delay, RF lock and protocol setup remain
 * outside this geometry-only result.
 */
export function selectMaximumDurationSingleReceiverSchedule(
  inputPasses: readonly SatellitePassWindow[],
): SingleReceiverSchedule {
  const passes = [...inputPasses].sort((left, right) => (
    left.los.instantMs - right.los.instantMs
      || left.aos.instantMs - right.aos.instantMs
      || left.satelliteId.localeCompare(right.satelliteId)
  ));
  const predecessor = passes.map((pass, index) => {
    let low = 0;
    let high = index - 1;
    let match = -1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (passes[mid]!.los.instantMs <= pass.aos.instantMs) {
        match = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return match;
  });
  const bestDurationSec = new Array<number>(passes.length + 1).fill(0);
  const take = new Array<boolean>(passes.length).fill(false);
  for (let index = 0; index < passes.length; index += 1) {
    const include = passes[index]!.durationSec + bestDurationSec[predecessor[index]! + 1]!;
    const exclude = bestDurationSec[index]!;
    if (include > exclude + 1e-9) {
      bestDurationSec[index + 1] = include;
      take[index] = true;
    } else {
      bestDurationSec[index + 1] = exclude;
    }
  }

  const selected: SatellitePassWindow[] = [];
  let index = passes.length - 1;
  while (index >= 0) {
    const include = passes[index]!.durationSec + bestDurationSec[predecessor[index]! + 1]!;
    const exclude = bestDurationSec[index]!;
    if (take[index] && include > exclude + 1e-9) {
      selected.push(passes[index]!);
      index = predecessor[index]!;
    } else {
      index -= 1;
    }
  }
  selected.reverse();

  return Object.freeze({
    objective: 'MAXIMUM_GEOMETRIC_OPPORTUNITY_DURATION',
    assumption: 'ONE_TRACKING_CHANNEL_ZERO_SWITCH_GUARD',
    windows: Object.freeze(selected),
    totalDurationMinutes: selected.reduce((sum, pass) => sum + pass.durationMinutes, 0),
  });
}
