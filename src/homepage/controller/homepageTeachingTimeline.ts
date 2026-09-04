import type { HomepageDemoWindow } from './homepageDemoWindow';

/**
 * Homepage teaching playback is a presentation mode over the existing source
 * window. It owns no simulation cursor, clock, candidate ranking, or decision.
 */
export type HomepageTeachingMode = 'continuous' | 'guided';

export interface HomepageTeachingStop {
  readonly id: string;
  readonly label: string;
  readonly sourceTimeSec: number;
  readonly eventId?: string;
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function addStop(
  stops: HomepageTeachingStop[],
  stop: HomepageTeachingStop,
): void {
  if (!finite(stop.sourceTimeSec)) return;
  const previous = stops[stops.length - 1];
  if (previous !== undefined && Math.abs(previous.sourceTimeSec - stop.sourceTimeSec) < 0.001) {
    // Keep the final receipt visible when a degenerate source window places
    // two teaching boundaries on the same source frame.
    if (stop.id === 'end') stops[stops.length - 1] = stop;
    return;
  }
  stops.push(stop);
}

/**
 * Return the small set of source-backed stops used by Guided mode. The labels
 * describe where the viewer is in the existing event window; they do not
 * invent a new handover phase or change the decision source.
 */
export function createHomepageTeachingStops(
  window: HomepageDemoWindow,
): readonly HomepageTeachingStop[] {
  const intra = window.events[0];
  const inter = window.events[1];
  const intraCommitSec = clamp(intra.sourceTimeSec, window.leadInSec, window.endSec);
  const interLeadInSec = clamp(
    Math.max(intraCommitSec, inter.sourceStartSec),
    window.leadInSec,
    window.endSec,
  );
  const interCommitSec = clamp(inter.sourceTimeSec, interLeadInSec, window.endSec);
  const stops: HomepageTeachingStop[] = [];

  addStop(stops, {
    id: 'intra-candidates',
    label: 'Intra · 候選比較',
    sourceTimeSec: window.leadInSec,
    eventId: intra.id,
  });
  addStop(stops, {
    id: 'intra-commit',
    label: 'Intra · Beam 換手',
    sourceTimeSec: intraCommitSec,
    eventId: intra.id,
  });
  addStop(stops, {
    id: 'inter-candidates',
    label: 'Inter · 候選比較',
    sourceTimeSec: interLeadInSec,
    eventId: inter.id,
  });
  addStop(stops, {
    id: 'inter-commit',
    label: 'Inter · Satellite 換手',
    sourceTimeSec: interCommitSec,
    eventId: inter.id,
  });
  addStop(stops, {
    id: 'end',
    label: '教學窗口結束',
    sourceTimeSec: window.endSec,
  });

  return Object.freeze(stops.map(stop => Object.freeze(stop)));
}

export function findNextHomepageTeachingStop(
  stops: readonly HomepageTeachingStop[],
  currentSourceTimeSec: number,
): HomepageTeachingStop | null {
  const current = finite(currentSourceTimeSec) ? currentSourceTimeSec : 0;
  return stops.find(stop => stop.sourceTimeSec > current + 0.25) ?? null;
}

export function findPreviousHomepageTeachingStop(
  stops: readonly HomepageTeachingStop[],
  currentSourceTimeSec: number,
): HomepageTeachingStop | null {
  const current = finite(currentSourceTimeSec) ? currentSourceTimeSec : Number.POSITIVE_INFINITY;
  for (let index = stops.length - 1; index >= 0; index -= 1) {
    const stop = stops[index]!;
    if (stop.sourceTimeSec < current - 0.25) return stop;
  }
  return null;
}

export function findCurrentHomepageTeachingStop(
  stops: readonly HomepageTeachingStop[],
  currentSourceTimeSec: number,
): HomepageTeachingStop | null {
  const current = finite(currentSourceTimeSec) ? currentSourceTimeSec : 0;
  let selected: HomepageTeachingStop | null = null;
  for (const stop of stops) {
    if (stop.sourceTimeSec <= current + 0.25) selected = stop;
    else break;
  }
  return selected;
}
