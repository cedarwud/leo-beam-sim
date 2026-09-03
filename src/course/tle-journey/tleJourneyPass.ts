/**
 * Act 2 station 5 — the elevation-versus-time "mountain" and sky dome pass.
 *
 * Validates TLE input before propagation and projects the repository SGP4 /
 * observer APIs (`src/simulator/observer.ts` and `src/tle/propagation.ts`).
 */

import { validateTleLines } from '../../tle/validation';
import { propagateTleSnapshot } from '../../tle/propagation';
import { TLE_SOURCE_KIND, type ResolvedTleSnapshot } from '../../tle/types';
import { NTPU_TLE_OBSERVER, deriveObserverLinkGeometry } from '../../simulator/observer';
import { SAMPLE_TLE } from './tleJourneyStations';

export interface TleJourneySample {
  readonly instantMs: number;
  readonly elevationDeg: number;
  readonly azimuthDeg: number;
  readonly rangeKm: number;
}

export interface TleJourneyPass {
  readonly samples: readonly TleJourneySample[];
  readonly riseMs: number;
  readonly peakMs: number;
  readonly setMs: number;
  readonly peakElevationDeg: number;
  readonly durationSec: number;
  readonly minimumElevationDeg: number;
}

/** Elevation track over a window, at a fixed step. */
export function sampleTleJourneyTrack(
  line1: string,
  line2: string,
  startMs: number,
  endMs: number,
  stepSec: number,
): readonly TleJourneySample[] {
  let validated;
  try {
    validated = validateTleLines(line1, line2);
  } catch {
    return Object.freeze([]);
  }

  const samples: TleJourneySample[] = [];
  for (let instantMs = startMs; instantMs <= endMs; instantMs += stepSec * 1000) {
    const when = new Date(instantMs);
    const instantUtc = when.toISOString();

    const snapshot: ResolvedTleSnapshot = {
      satelliteId: validated.identity.satelliteId,
      satelliteName: SAMPLE_TLE.name,
      epochUtc: validated.epoch.epochUtc,
      line1: validated.line1,
      line2: validated.line2,
      sourcePath: SAMPLE_TLE.sourcePath,
      sourceKind: TLE_SOURCE_KIND,
      requestedInstantUtc: instantUtc,
      ageMs: Math.abs(instantMs - validated.epoch.epochMs),
      maxPropagationAgeMs: 7 * 86_400_000,
      provenance: {
        satelliteId: validated.identity.satelliteId,
        satelliteName: SAMPLE_TLE.name,
        sourcePath: SAMPLE_TLE.sourcePath,
        sourceKind: TLE_SOURCE_KIND,
        epochUtc: validated.epoch.epochUtc,
        line1: validated.line1,
        line2: validated.line2,
      },
    };

    try {
      const propagated = propagateTleSnapshot(snapshot, instantUtc);
      const geometry = deriveObserverLinkGeometry(
        propagated.positionTemeKm,
        instantUtc,
        NTPU_TLE_OBSERVER,
      );
      samples.push(Object.freeze({
        instantMs,
        elevationDeg: geometry.elevationDeg,
        azimuthDeg: geometry.azimuthDeg,
        rangeKm: geometry.rangeKm,
      }));
    } catch {
      // Propagation failed; skip sample
    }
  }
  return Object.freeze(samples);
}

/**
 * The first pass at or after `fromMs` that clears `minimumElevationDeg`.
 *
 * Rise and set are the first and last samples above the threshold, not
 * interpolated crossings: the curve the room reads is the sampled one.
 */
export function findTleJourneyPass(
  line1: string,
  line2: string,
  fromMs: number,
  searchSec: number,
  stepSec: number,
  minimumElevationDeg: number,
): TleJourneyPass | null {
  const samples = sampleTleJourneyTrack(line1, line2, fromMs, fromMs + searchSec * 1000, stepSec);
  let start = -1;
  for (let index = 0; index < samples.length; index += 1) {
    const above = samples[index]!.elevationDeg >= minimumElevationDeg;
    if (above && start === -1) start = index;
    if (!above && start !== -1) {
      return buildPass(samples.slice(start, index), minimumElevationDeg);
    }
  }
  if (start !== -1 && start < samples.length - 1) {
    return buildPass(samples.slice(start), minimumElevationDeg);
  }
  return null;
}

function buildPass(
  window: readonly TleJourneySample[],
  minimumElevationDeg: number,
): TleJourneyPass | null {
  if (window.length < 2) return null;
  let peak = window[0]!;
  for (const sample of window) {
    if (sample.elevationDeg > peak.elevationDeg) peak = sample;
  }
  const rise = window[0]!;
  const set = window[window.length - 1]!;
  return Object.freeze({
    samples: window,
    riseMs: rise.instantMs,
    peakMs: peak.instantMs,
    setMs: set.instantMs,
    peakElevationDeg: peak.elevationDeg,
    durationSec: (set.instantMs - rise.instantMs) / 1000,
    minimumElevationDeg,
  });
}
