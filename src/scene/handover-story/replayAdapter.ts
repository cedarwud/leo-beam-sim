import type { NormalizedSceneFrame } from '../NormalizedSceneFrame';
import type {
  HandoverStoryEndpoint,
  HandoverStoryFrame,
  HandoverStoryKind,
  HandoverStoryPhase,
} from './contracts';
import { HANDOVER_STORY_FRAME_SCHEMA_VERSION } from './contracts';
import {
  clampStoryProgress,
  freezeHandoverStoryFrame,
  storyBeamToken,
} from './frame';

export interface ReplayHandoverStoryFrameInput {
  readonly frame: NormalizedSceneFrame | null;
}

function replayKind(value: string): HandoverStoryKind | null {
  switch (value) {
    case 'intra':
    case 'intra-satellite-beam-switch': return 'intra';
    case 'inter':
    case 'inter-satellite-handover': return 'inter';
    default: return null;
  }
}

function replayPhase(value: string): HandoverStoryPhase | null {
  switch (value) {
    case 'serving':
    case 'monitoring': return 'serving';
    case 'preparing':
    case 'arming':
    case 'candidate':
    case 'evaluating':
    case 'qualifying': return 'measuring';
    case 'holding':
    case 'selection-hold': return 'holding';
    case 'dual-active':
    case 'committing':
    case 'switching':
    case 'releasing': return 'switching';
    case 'committed':
    case 'completed':
    case 'guard':
    case 'settled': return 'settled';
    default: return null;
  }
}

function replayEndpoint(
  satelliteId: string,
  beamId: string,
): HandoverStoryEndpoint {
  return {
    satelliteId,
    cellId: null,
    beamId,
    satelliteLabel: null,
    beamLabel: null,
    geometryStatus: 'unchecked',
    ee: null,
    sinr: null,
    elevationDeg: null,
  };
}

/** Normalize one recorded artifact frame without reconstructing missing truth. */
export function resolveReplayHandoverStoryFrame(
  input: ReplayHandoverStoryFrameInput,
): HandoverStoryFrame | null {
  const frame = input.frame;
  if (frame === null || frame.sceneSource !== 'artifact-replay') return null;
  // Legacy artifacts may omit this boolean; an explicit false is authoritative.
  if (frame.handover.sourceHandoverOccurred === false) return null;
  if (!Number.isFinite(frame.tSec) || frame.tSec < 0) return null;
  const kind = replayKind(frame.handover.kind);
  const phase = replayPhase(frame.handover.phase);
  if (kind === null || phase === null) return null;

  let from: HandoverStoryEndpoint;
  let to: HandoverStoryEndpoint;
  let progress01: number;

  if (kind === 'intra') {
    const transition = frame.transitionProgress.intra;
    const satelliteId = storyBeamToken(transition?.satId)
      ?? storyBeamToken(frame.handover.servingSatelliteId);
    const fromBeamId = storyBeamToken(transition?.fromBeamId);
    const toBeamId = storyBeamToken(transition?.toBeamId);
    if (satelliteId === null || fromBeamId === null || toBeamId === null) return null;
    from = replayEndpoint(satelliteId, fromBeamId);
    to = replayEndpoint(satelliteId, toBeamId);
    progress01 = clampStoryProgress(transition?.progress01 ?? 0);
  } else {
    const transition = frame.transitionProgress.inter;
    const fromSatelliteId = storyBeamToken(transition?.fromSatId);
    const toSatelliteId = storyBeamToken(transition?.toSatId);
    const fromBeamId = storyBeamToken(transition?.fromBeamId);
    const toBeamId = storyBeamToken(transition?.toBeamId);
    if (fromSatelliteId === null || toSatelliteId === null
      || fromBeamId === null || toBeamId === null) return null;
    from = replayEndpoint(fromSatelliteId, fromBeamId);
    to = replayEndpoint(toSatelliteId, toBeamId);
    progress01 = clampStoryProgress(transition?.progress01 ?? 0);
  }

  const pair = `${from.satelliteId}|${from.beamId}>${to.satelliteId}|${to.beamId}`;
  return freezeHandoverStoryFrame({
    schemaVersion: HANDOVER_STORY_FRAME_SCHEMA_VERSION,
    storyId: `replay:${kind}:${pair}`,
    kind,
    phase,
    progress01,
    committed: phase === 'settled',
    ueId: null,
    from,
    to,
    provenance: {
      producer: 'artifact-replay',
      claimClass: 'recorded-replay',
      decisionEvidence: 'none',
      snapshotId: null,
      episodeId: null,
      sourceFrameId: null,
      disclosure: 'artifact-replay-read-only',
      decisionInputAllowed: false,
    },
    clock: {
      basis: 'replay-time',
      currentSec: frame.tSec,
      durationSec: null,
      sourceTimeSec: frame.tSec,
    },
  });
}
