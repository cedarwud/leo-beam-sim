/**
 * Act 2 station 4 — the elevation-versus-time "mountain" for one pass.
 *
 * Reuses `simulator/observer` for look angles and satellite.js for SGP4, so the
 * curve the room reads is the same geometry every other act uses.
 */

import { propagate, twoline2satrec } from 'satellite.js';

import { NTPU_TLE_OBSERVER, deriveObserverLinkGeometry } from '../../simulator/observer';

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
  const satrec = twoline2satrec(line1, line2);
  const samples: TleJourneySample[] = [];
  for (let instantMs = startMs; instantMs <= endMs; instantMs += stepSec * 1000) {
    const when = new Date(instantMs);
    const propagated = propagate(satrec, when);
    if (propagated?.position === undefined || satrec.error !== 0) continue;
    const geometry = deriveObserverLinkGeometry(
      propagated.position as { x: number; y: number; z: number },
      when.toISOString(),
      NTPU_TLE_OBSERVER,
    );
    samples.push(Object.freeze({
      instantMs,
      elevationDeg: geometry.elevationDeg,
      azimuthDeg: geometry.azimuthDeg,
      rangeKm: geometry.rangeKm,
    }));
  }
  return Object.freeze(samples);
}

/**
 * The first pass at or after `fromMs` that clears `minimumElevationDeg`.
 *
 * Rise and set are the first and last samples above the threshold, not
 * interpolated crossings: the curve the room reads is the sampled one, and a
 * smoothed boundary would disagree with the picture.
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
  for (const sample of window) if (sample.elevationDeg > peak.elevationDeg) peak = sample;
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
