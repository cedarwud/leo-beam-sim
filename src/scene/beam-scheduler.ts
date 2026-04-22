import type { Profile } from '../profiles/types';
import type { BeamCellState } from './types';

export interface CandidateBeamCell extends BeamCellState {
  distanceToUeKm: number;
}

export interface ScheduledBeamSelection {
  activeBeamCells: BeamCellState[];
  activeBeamIds: number[];
  candidateBeamIds: number[];
  frameSlotIndex: number;
}

interface ScheduleBeamCellsOptions {
  minimumActiveBeamCount?: number;
  fallbackBeamCells?: CandidateBeamCell[];
}

function beamHopSeed(satId: string): number {
  let hash = 0;
  for (let i = 0; i < satId.length; i++) {
    hash = (hash * 31 + satId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function toBeamState(beam: CandidateBeamCell): BeamCellState {
  return {
    beamId: beam.beamId,
    offsetEastKm: beam.offsetEastKm,
    offsetNorthKm: beam.offsetNorthKm,
    scanAngleDeg: beam.scanAngleDeg,
  };
}

function appendUniqueBeamStates(
  activeBeamCells: BeamCellState[],
  sourceBeamCells: CandidateBeamCell[],
  beamLimit: number,
): void {
  for (const beam of sourceBeamCells) {
    if (activeBeamCells.length >= beamLimit) break;
    if (activeBeamCells.some(active => active.beamId === beam.beamId)) continue;
    activeBeamCells.push(toBeamState(beam));
  }
}

export function scheduleBeamCells(
  candidateBeamCells: CandidateBeamCell[],
  requiredBeamCells: CandidateBeamCell[],
  satId: string,
  slotIndex: number,
  config: Profile['beamHopping'],
  options: ScheduleBeamCellsOptions = {},
): ScheduledBeamSelection {
  if (candidateBeamCells.length === 0 && requiredBeamCells.length === 0) {
    return {
      activeBeamCells: [],
      activeBeamIds: [],
      candidateBeamIds: [],
      frameSlotIndex: -1,
    };
  }

  const requiredBeamStates = [...new Map(
    requiredBeamCells.map(beam => [beam.beamId, toBeamState(beam)]),
  ).values()];
  const requiredBeamIdSet = new Set(requiredBeamStates.map(beam => beam.beamId));
  const candidateBeamIds = [...new Set([
    ...candidateBeamCells.map(beam => beam.beamId),
    ...requiredBeamStates.map(beam => beam.beamId),
  ])];
  const minimumActiveBeamCount = Math.max(
    1,
    options.minimumActiveBeamCount ?? 1,
    requiredBeamStates.length,
  );
  const configuredBeamLimit = Math.min(
    config.maxActiveBeamsPerSlot,
    Math.max(candidateBeamCells.length, requiredBeamStates.length),
  );
  const beamLimit = Math.max(minimumActiveBeamCount, configuredBeamLimit);
  const fallbackBeamCells = [...(options.fallbackBeamCells ?? [])]
    .sort((a, b) => a.distanceToUeKm - b.distanceToUeKm || a.beamId - b.beamId);

  if (config.scheduler === 'distance-priority') {
    const activeBeamCells = [...requiredBeamStates];
    appendUniqueBeamStates(activeBeamCells, candidateBeamCells, beamLimit);
    // Protect serving/pending satellites from collapsing to a single beam when
    // the normal candidate window becomes too narrow near the footprint edge.
    appendUniqueBeamStates(activeBeamCells, fallbackBeamCells, beamLimit);
    return {
      activeBeamCells,
      activeBeamIds: activeBeamCells.map(beam => beam.beamId),
      candidateBeamIds,
      frameSlotIndex: slotIndex,
    };
  }

  const ordered = [...candidateBeamCells].sort((a, b) => a.beamId - b.beamId);
  const frameLengthSlots = Math.max(1, config.frameLengthSlots);
  const frameSlotIndex = ((slotIndex % frameLengthSlots) + frameLengthSlots) % frameLengthSlots;
  const activeBeamCells: BeamCellState[] = [...requiredBeamStates];

  if (ordered.length > 0) {
    const startIndex = (frameSlotIndex * beamLimit + beamHopSeed(satId)) % ordered.length;
    for (let i = 0; i < ordered.length && activeBeamCells.length < beamLimit; i++) {
      const beam = ordered[(startIndex + i) % ordered.length];
      if (requiredBeamIdSet.has(beam.beamId) || activeBeamCells.some(active => active.beamId === beam.beamId)) {
        continue;
      }
      activeBeamCells.push(toBeamState(beam));
    }
  }

  appendUniqueBeamStates(activeBeamCells, fallbackBeamCells, beamLimit);

  return {
    activeBeamCells,
    activeBeamIds: activeBeamCells.map(beam => beam.beamId),
    candidateBeamIds,
    frameSlotIndex,
  };
}
