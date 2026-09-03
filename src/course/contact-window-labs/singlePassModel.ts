/**
 * Experiment 5: Pure TypeScript model for single-pass SGP4 WGS84 topocentric contact geometry.
 *
 * Computes:
 * - AOS (Acquisition of Signal): time, azimuth, elevation, slant range
 * - Peak: time of maximum elevation, peak elevation, peak azimuth, minimum slant range
 * - LOS (Loss of Signal): time, exit azimuth, elevation, slant range
 * - Duration: contact opportunity duration (seconds & minutes)
 * - Multi-mask sensitivity: compares pass window across 5°, 10°, 20°, and 30° elevation masks
 *
 * Scientific Boundary:
 * All metrics represent geometric contact opportunities and NOT guaranteed RF service.
 */

import {
  propagate,
  twoline2satrec,
  type SatRec,
} from 'satellite.js';

import type {
  AosEvent,
  LosEvent,
  MultiMaskComparisonRow,
  ObserverLocation,
  PeakEvent,
  SinglePassContactResult,
  SinglePassRequest,
  TopocentricLookPoint,
} from './types';
import { SUPPORTED_ELEVATION_MASKS_DEG } from './types';
import { NTPU_LAB_OBSERVER } from './fixtures';
import { createLabProvenance } from './scientificBoundaries';
import { deriveObserverLinkGeometry, NTPU_TLE_OBSERVER } from '../../simulator/observer';
import type { Vector3 } from '../../tle/types';

/** Default search window parameters. */
export const DEFAULT_SEARCH_DURATION_SEC = 4 * 3600; // 4 hours
export const DEFAULT_SAMPLE_STEP_SEC = 10; // 10 seconds step for coarse scan
export const ROOT_FINDING_TOLERANCE_MS = 50; // 50 ms resolution for exact AOS/LOS

function normalizeAzimuth(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Computes topocentric look angle (azimuth, elevation, range) for a satellite at a specific millisecond timestamp.
 */
export function computeLookAngleAtInstant(
  satrec: SatRec,
  instantMs: number,
  observer: ObserverLocation = NTPU_LAB_OBSERVER,
): TopocentricLookPoint | null {
  const date = new Date(instantMs);
  let state: ReturnType<typeof propagate>;
  try {
    state = propagate(satrec, date);
  } catch {
    return null;
  }

  if (state === null || state === undefined || satrec.error !== 0 || !state.position) {
    return null;
  }

  const pos = state.position as { x: number; y: number; z: number };
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) {
    return null;
  }

  // Reuse the repository's canonical TEME -> GMST -> ECEF -> WGS84
  // topocentric observer transform so this teaching model cannot drift from
  // the live TLE observer geometry used elsewhere in the simulator.
  let geometry: ReturnType<typeof deriveObserverLinkGeometry>;
  try {
    // The shared helper's exported observer type is the literal canonical
    // NTPU instance; ObserverLocation is intentionally structurally broader
    // for callers, while the runtime transform still reads its coordinates.
    geometry = deriveObserverLinkGeometry(
      pos as Vector3,
      date.toISOString(),
      observer as typeof NTPU_TLE_OBSERVER,
    );
  } catch {
    return null;
  }
  const elevationDeg = geometry.elevationDeg;
  const azimuthDeg = normalizeAzimuth(geometry.azimuthDeg);
  const rangeKm = geometry.rangeKm;

  if (!Number.isFinite(elevationDeg) || !Number.isFinite(azimuthDeg) || !Number.isFinite(rangeKm) || rangeKm <= 0) {
    return null;
  }

  return Object.freeze({
    instantUtc: date.toISOString(),
    instantMs,
    azimuthDeg,
    elevationDeg,
    rangeKm,
    visible: elevationDeg >= 0,
  });
}

/**
 * High-precision root finding (bisection) to find the exact instant where elevation crosses thresholdElevationDeg.
 */
export function findCrossingInstant(
  satrec: SatRec,
  beforeMs: number,
  afterMs: number,
  thresholdElevationDeg: number,
  observer: ObserverLocation,
  toleranceMs = ROOT_FINDING_TOLERANCE_MS,
): TopocentricLookPoint | null {
  let low = beforeMs;
  let high = afterMs;

  const lowPoint = computeLookAngleAtInstant(satrec, low, observer);
  const highPoint = computeLookAngleAtInstant(satrec, high, observer);
  if (!lowPoint || !highPoint) return null;

  const lowDiff = lowPoint.elevationDeg - thresholdElevationDeg;
  const highDiff = highPoint.elevationDeg - thresholdElevationDeg;
  if (lowDiff * highDiff > 0) {
    // Both on same side of threshold, pick the closer point
    return Math.abs(lowDiff) < Math.abs(highDiff) ? lowPoint : highPoint;
  }

  let bestPoint = highPoint;
  while (Math.abs(high - low) > toleranceMs) {
    const mid = Math.round((low + high) / 2);
    const midPoint = computeLookAngleAtInstant(satrec, mid, observer);
    if (!midPoint) break;

    bestPoint = midPoint;
    const midDiff = midPoint.elevationDeg - thresholdElevationDeg;
    if (Math.abs(midDiff) < 1e-4) {
      return midPoint;
    }

    if (lowDiff * midDiff <= 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return bestPoint;
}

/**
 * Refines the peak (maximum elevation point) within a candidate peak window using golden section search.
 */
export function refinePeakInstant(
  satrec: SatRec,
  startMs: number,
  endMs: number,
  observer: ObserverLocation = NTPU_LAB_OBSERVER,
  toleranceMs = 500,
): TopocentricLookPoint {
  let a = startMs;
  let b = endMs;
  const invPhi = (Math.sqrt(5) - 1) / 2; // ~0.618

  let c = Math.round(b - invPhi * (b - a));
  let d = Math.round(a + invPhi * (b - a));

  let pointC = computeLookAngleAtInstant(satrec, c, observer);
  let pointD = computeLookAngleAtInstant(satrec, d, observer);

  while (Math.abs(b - a) > toleranceMs) {
    if (pointC && pointD && pointC.elevationDeg > pointD.elevationDeg) {
      b = d;
      d = c;
      pointD = pointC;
      c = Math.round(b - invPhi * (b - a));
      pointC = computeLookAngleAtInstant(satrec, c, observer);
    } else {
      a = c;
      c = d;
      pointC = pointD;
      d = Math.round(a + invPhi * (b - a));
      pointD = computeLookAngleAtInstant(satrec, d, observer);
    }
  }

  const mid = Math.round((a + b) / 2);
  const midPoint = computeLookAngleAtInstant(satrec, mid, observer);
  if (midPoint) return midPoint;
  return pointC || pointD || computeLookAngleAtInstant(satrec, startMs, observer)!;
}

interface RawPassSpan {
  readonly startScanIndex: number;
  readonly endScanIndex: number;
  readonly peakSample: TopocentricLookPoint;
}

/**
 * Scans a track and identifies candidate pass spans above a given elevation threshold.
 */
function findPassSpans(
  samples: readonly TopocentricLookPoint[],
  thresholdDeg: number,
): readonly RawPassSpan[] {
  const spans: RawPassSpan[] = [];
  let inPass = false;
  let startIndex = -1;
  let currentPeak: TopocentricLookPoint | null = null;

  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i]!;
    const isAbove = sample.elevationDeg >= thresholdDeg;

    if (!inPass && isAbove) {
      inPass = true;
      startIndex = i;
      currentPeak = sample;
    } else if (inPass) {
      if (currentPeak === null || sample.elevationDeg > currentPeak.elevationDeg) {
        currentPeak = sample;
      }
      if (!isAbove) {
        inPass = false;
        if (currentPeak !== null) {
          spans.push({
            startScanIndex: startIndex,
            endScanIndex: i - 1,
            peakSample: currentPeak,
          });
        }
        currentPeak = null;
      }
    }
  }

  if (inPass && currentPeak !== null) {
    spans.push({
      startScanIndex: startIndex,
      endScanIndex: samples.length - 1,
      peakSample: currentPeak,
    });
  }

  return Object.freeze(spans);
}

/**
 * Computes single pass contact opportunity for Experiment 5.
 */
export function computeSinglePassContactOpportunity(
  request: SinglePassRequest,
): SinglePassContactResult {
  const observer = request.observer ?? NTPU_LAB_OBSERVER;
  const minimumElevationDeg = request.minimumElevationDeg;
  const startMs = Date.parse(request.searchStartUtc);
  if (!Number.isFinite(startMs)) {
    throw new TypeError(`invalid searchStartUtc: ${request.searchStartUtc}`);
  }

  const durationSec = request.searchDurationSec ?? DEFAULT_SEARCH_DURATION_SEC;
  const endMs = startMs + durationSec * 1000;
  const stepSec = Math.max(1, request.sampleStepSec ?? DEFAULT_SAMPLE_STEP_SEC);

  let satrec: SatRec;
  try {
    satrec = twoline2satrec(request.tle.line1, request.tle.line2);
  } catch (error) {
    throw new Error(`SGP4 init failed for ${request.tle.satelliteName}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!satrec || satrec.error !== 0) {
    throw new Error(`SGP4 satrec error ${satrec?.error ?? -1} for ${request.tle.satelliteName}`);
  }

  // 1. Scan trajectory across search window
  const trajectory: TopocentricLookPoint[] = [];
  for (let t = startMs; t <= endMs; t += stepSec * 1000) {
    const point = computeLookAngleAtInstant(satrec, t, observer);
    if (point) {
      trajectory.push(point);
    }
  }

  // 2. Find passes above minimumElevationDeg
  const spans = findPassSpans(trajectory, minimumElevationDeg);

  let aos: AosEvent | null = null;
  let peak: PeakEvent | null = null;
  let los: LosEvent | null = null;
  let passDurationSec = 0;
  let hasContact = false;

  if (spans.length > 0) {
    // Select the first complete pass or highest pass in the window
    const primarySpan = spans[0]!;
    hasContact = true;

    // Refine AOS: cross between sample before pass and sample at start of pass
    const beforeAosMs = primarySpan.startScanIndex > 0
      ? trajectory[primarySpan.startScanIndex - 1]!.instantMs
      : trajectory[primarySpan.startScanIndex]!.instantMs - stepSec * 1000;
    const atAosMs = trajectory[primarySpan.startScanIndex]!.instantMs;
    const refinedAos = findCrossingInstant(satrec, beforeAosMs, atAosMs, minimumElevationDeg, observer)
      ?? trajectory[primarySpan.startScanIndex]!;

    aos = Object.freeze({
      eventType: 'AOS',
      instantUtc: refinedAos.instantUtc,
      instantMs: refinedAos.instantMs,
      azimuthDeg: refinedAos.azimuthDeg,
      elevationDeg: refinedAos.elevationDeg,
      rangeKm: refinedAos.rangeKm,
    });

    // Refine Peak
    const peakSearchStart = Math.max(startMs, primarySpan.peakSample.instantMs - stepSec * 2000);
    const peakSearchEnd = Math.min(endMs, primarySpan.peakSample.instantMs + stepSec * 2000);
    const refinedPeak = refinePeakInstant(satrec, peakSearchStart, peakSearchEnd, observer);

    peak = Object.freeze({
      eventType: 'PEAK',
      instantUtc: refinedPeak.instantUtc,
      instantMs: refinedPeak.instantMs,
      azimuthDeg: refinedPeak.azimuthDeg,
      elevationDeg: refinedPeak.elevationDeg,
      maxElevationDeg: refinedPeak.elevationDeg,
      rangeKm: refinedPeak.rangeKm,
    });

    // Refine LOS: cross between sample at end of pass and sample after pass
    const atLosMs = trajectory[primarySpan.endScanIndex]!.instantMs;
    const afterLosMs = primarySpan.endScanIndex < trajectory.length - 1
      ? trajectory[primarySpan.endScanIndex + 1]!.instantMs
      : trajectory[primarySpan.endScanIndex]!.instantMs + stepSec * 1000;
    const refinedLos = findCrossingInstant(satrec, atLosMs, afterLosMs, minimumElevationDeg, observer)
      ?? trajectory[primarySpan.endScanIndex]!;

    los = Object.freeze({
      eventType: 'LOS',
      instantUtc: refinedLos.instantUtc,
      instantMs: refinedLos.instantMs,
      azimuthDeg: refinedLos.azimuthDeg,
      elevationDeg: refinedLos.elevationDeg,
      rangeKm: refinedLos.rangeKm,
    });

    passDurationSec = Math.max(0, (refinedLos.instantMs - refinedAos.instantMs) / 1000);
  }

  // 3. Multi-mask sensitivity comparison across 5°, 10°, 20°, 30°
  const multiMaskComparison: MultiMaskComparisonRow[] = [];
  for (const maskDeg of SUPPORTED_ELEVATION_MASKS_DEG) {
    const maskSpans = findPassSpans(trajectory, maskDeg);
    if (maskSpans.length === 0) {
      multiMaskComparison.push(Object.freeze({
        elevationMaskDeg: maskDeg,
        hasContact: false,
      }));
    } else {
      const span = maskSpans[0]!;
      const beforeAosMs = span.startScanIndex > 0
        ? trajectory[span.startScanIndex - 1]!.instantMs
        : trajectory[span.startScanIndex]!.instantMs - stepSec * 1000;
      const atAosMs = trajectory[span.startScanIndex]!.instantMs;
      const maskAos = findCrossingInstant(satrec, beforeAosMs, atAosMs, maskDeg, observer) ?? trajectory[span.startScanIndex]!;

      const atLosMs = trajectory[span.endScanIndex]!.instantMs;
      const afterLosMs = span.endScanIndex < trajectory.length - 1
        ? trajectory[span.endScanIndex + 1]!.instantMs
        : trajectory[span.endScanIndex]!.instantMs + stepSec * 1000;
      const maskLos = findCrossingInstant(satrec, atLosMs, afterLosMs, maskDeg, observer) ?? trajectory[span.endScanIndex]!;

      const maskPeak = refinePeakInstant(
        satrec,
        Math.max(startMs, span.peakSample.instantMs - stepSec * 2000),
        Math.min(endMs, span.peakSample.instantMs + stepSec * 2000),
        observer,
      );

      const durSec = Math.max(0, (maskLos.instantMs - maskAos.instantMs) / 1000);

      multiMaskComparison.push(Object.freeze({
        elevationMaskDeg: maskDeg,
        hasContact: true,
        aosUtc: maskAos.instantUtc,
        peakUtc: maskPeak.instantUtc,
        losUtc: maskLos.instantUtc,
        durationSec: durSec,
        durationMinutes: durSec / 60,
        peakElevationDeg: maskPeak.elevationDeg,
        peakAzimuthDeg: maskPeak.azimuthDeg,
        peakRangeKm: maskPeak.rangeKm,
      }));
    }
  }

  const provenance = createLabProvenance(observer.id);

  return Object.freeze({
    satelliteId: request.tle.satelliteId,
    satelliteName: request.tle.satelliteName,
    epochUtc: request.tle.epochUtc ?? new Date(startMs).toISOString(),
    observer,
    minimumElevationDeg,
    searchStartUtc: new Date(startMs).toISOString(),
    searchEndUtc: new Date(endMs).toISOString(),
    hasContact,
    aos,
    peak,
    los,
    durationSec: passDurationSec,
    durationMinutes: passDurationSec / 60,
    trajectory: Object.freeze(trajectory),
    multiMaskComparison: Object.freeze(multiMaskComparison),
    provenance,
  });
}
