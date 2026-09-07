import type { SinrLiveCinemaHandoverCandidate } from '../viz/SinrLiveCellBeamCones';
import type { SinrLiveCellFrame } from './sinrLiveCellModel';

export interface CandidateDisplayCellFrameInput {
  readonly source: SinrLiveCellFrame | undefined;
  readonly sceneSource: 'live' | 'archived-tle';
  readonly candidateSatelliteId: string | null | undefined;
}

export interface CinemaInterDisplayCellFrameInput {
  readonly source: SinrLiveCellFrame | undefined;
  readonly pairCandidate: SinrLiveCinemaHandoverCandidate | null;
}

function beamsForSatellite(
  frame: SinrLiveCellFrame,
  satelliteIds: readonly string[],
): SinrLiveCellFrame['illuminatedBeams'] {
  return frame.cells.flatMap(cell => satelliteIds.map(satelliteId => ({
    satId: satelliteId,
    cellId: cell.cellId,
    frequencyIndex: cell.frequencyIndex,
    serving: false,
  })));
}

/** Build the archived-TLE comparison satellite's display-only cell frame. */
export function resolveCandidateDisplayCellFrame(
  input: CandidateDisplayCellFrameInput,
): SinrLiveCellFrame | undefined {
  if (
    input.sceneSource !== 'archived-tle'
    || input.candidateSatelliteId === null
    || input.candidateSatelliteId === undefined
    || input.source === undefined
  ) {
    return input.source;
  }

  return {
    ...input.source,
    illuminatedBeams: beamsForSatellite(input.source, [input.candidateSatelliteId]),
  };
}

/** Build the anchored inter-cinema pair's display-only cell frame. */
export function resolveCinemaInterDisplayCellFrame(
  input: CinemaInterDisplayCellFrameInput,
): SinrLiveCellFrame | undefined {
  const candidate = input.pairCandidate;
  if (candidate?.kind !== 'inter' || input.source === undefined) return input.source;

  return {
    ...input.source,
    illuminatedBeams: beamsForSatellite(input.source, [candidate.fromSatId, candidate.toSatId]),
  };
}
