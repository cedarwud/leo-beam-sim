import type {
  HandoverStoryEndpoint,
  HandoverStoryFrame,
  HandoverStoryMetric,
  HandoverStoryPhase,
  HandoverTeachingFrameInput,
  HandoverTeachingLinkFrameInput,
  HandoverTeachingPhaseId,
  HandoverTeachingSceneStory,
} from './contracts';
import { HANDOVER_STORY_FRAME_SCHEMA_VERSION } from './contracts';
import {
  clampStoryProgress,
  finiteStoryNumber,
  freezeHandoverStoryFrame,
  nonEmptyStoryToken,
  storyGeometryStatus,
  validStoryIndex,
} from './frame';

function authoredMetric(value: number, unit: string): HandoverStoryMetric {
  return Object.freeze({
    status: 'authored',
    value: finiteStoryNumber(value),
    unit,
    sourceFrameId: null,
    reason: 'authored teaching value; not measured',
    provenance: 'authored-teaching',
  });
}

function teachingPhase(phase: HandoverTeachingPhaseId): HandoverStoryPhase {
  switch (phase) {
    case 'serving': return 'serving';
    case 'candidate': return 'measuring';
    case 'countdown': return 'holding';
    case 'switching': return 'switching';
    case 'settled': return 'settled';
  }
}

export interface TeachingHandoverStoryFrameInput {
  readonly story: HandoverTeachingSceneStory | null;
  readonly frame: HandoverTeachingFrameInput | null;
  readonly isDrawable?: (satelliteId: string, cellId: number | null) => boolean;
}

function teachingEndpoint(
  satelliteId: string,
  cellId: number | null,
  link: HandoverTeachingLinkFrameInput,
  isDrawable: TeachingHandoverStoryFrameInput['isDrawable'],
): HandoverStoryEndpoint {
  return {
    satelliteId,
    cellId,
    beamId: null,
    satelliteLabel: nonEmptyStoryToken(link.satelliteLabel) ? link.satelliteLabel : null,
    beamLabel: nonEmptyStoryToken(link.beamLabel) ? link.beamLabel : null,
    geometryStatus: storyGeometryStatus(isDrawable?.(satelliteId, cellId)),
    ee: authoredMetric(link.eeKbitPerJoule, 'Kbit/J'),
    sinr: null,
    elevationDeg: finiteStoryNumber(link.elevationDeg),
  };
}

function validTeachingStory(story: HandoverTeachingSceneStory): boolean {
  if (!nonEmptyStoryToken(story.storyKey)
    || !nonEmptyStoryToken(story.sourceSatelliteId)) return false;
  if (validStoryIndex(story.sourceCellId) === null) return false;
  if (story.targetCellId !== null && validStoryIndex(story.targetCellId) === null) {
    return false;
  }
  if (story.kind === 'inter') {
    return nonEmptyStoryToken(story.targetSatelliteId)
      && story.targetSatelliteId !== story.sourceSatelliteId;
  }
  return story.targetSatelliteId === null
    || story.targetSatelliteId === story.sourceSatelliteId;
}

/** Normalize one authored teaching frame without upgrading it to evidence. */
export function resolveTeachingHandoverStoryFrame(
  input: TeachingHandoverStoryFrameInput,
): HandoverStoryFrame | null {
  const story = input.story;
  const frame = input.frame;
  if (story === null || frame === null || !validTeachingStory(story)) return null;
  if (!Number.isFinite(frame.totalSec) || frame.totalSec <= 0) return null;
  if (!Number.isFinite(frame.elapsedSec)) return null;
  if (!Number.isFinite(frame.serving.eeKbitPerJoule)
    || !Number.isFinite(frame.winner.eeKbitPerJoule)) return null;

  const sourceCellId = validStoryIndex(story.sourceCellId);
  if (sourceCellId === null) return null;
  const targetSatelliteId = story.kind === 'inter'
    ? story.targetSatelliteId
    : story.sourceSatelliteId;
  if (!nonEmptyStoryToken(targetSatelliteId)) return null;
  const targetCellId = validStoryIndex(story.targetCellId) ?? sourceCellId;
  const from = teachingEndpoint(
    story.sourceSatelliteId,
    sourceCellId,
    frame.serving,
    input.isDrawable,
  );
  const to = teachingEndpoint(
    targetSatelliteId,
    targetCellId,
    frame.winner,
    input.isDrawable,
  );

  return freezeHandoverStoryFrame({
    schemaVersion: HANDOVER_STORY_FRAME_SCHEMA_VERSION,
    storyId: story.storyKey,
    kind: story.kind,
    phase: teachingPhase(frame.phase.id),
    progress01: clampStoryProgress(frame.elapsedSec / frame.totalSec),
    committed: frame.committed,
    ueId: null,
    from,
    to,
    provenance: {
      producer: 'teaching',
      claimClass: 'authored-teaching',
      decisionEvidence: 'none',
      snapshotId: null,
      episodeId: null,
      sourceFrameId: null,
      disclosure: 'authored-teaching-not-measured',
      decisionInputAllowed: false,
    },
    clock: {
      basis: 'teaching-script',
      currentSec: Math.max(0, Math.min(frame.totalSec, frame.elapsedSec)),
      durationSec: frame.totalSec,
      sourceTimeSec: null,
    },
  });
}
