import {
  isDrawableHandoverPresentationEvent,
  type HandoverPresentationPhase,
  type HandoverPresentationView,
} from '../handoverPresentationOwner';
import type {
  HandoverStoryClaimClass,
  HandoverStoryEndpoint,
  HandoverStoryFrame,
  HandoverStoryMetric,
  HandoverStoryPhase,
} from './contracts';
import { HANDOVER_STORY_FRAME_SCHEMA_VERSION } from './contracts';
import {
  clampStoryProgress,
  finiteStoryNumber,
  freezeHandoverStoryFrame,
  storyBeamToken,
  storyGeometryStatus,
} from './frame';

function observedMetric(
  value: number | null | undefined,
  unit: string,
): HandoverStoryMetric | null {
  const finite = finiteStoryNumber(value);
  if (finite === null) return null;
  return Object.freeze({
    status: 'available',
    value: finite,
    unit,
    sourceFrameId: null,
    reason: 'presentation event carries no immutable metric-frame identity',
    provenance: 'observed-presentation',
  });
}

function presentationPhase(phase: HandoverPresentationPhase): HandoverStoryPhase {
  switch (phase) {
    case 'serving': return 'serving';
    case 'measuring': return 'measuring';
    case 'holding': return 'holding';
    case 'releasing': return 'switching';
    case 'settled': return 'settled';
  }
}

export interface PresentationHandoverStoryFrameInput {
  readonly view: HandoverPresentationView;
}

/** Normalize the existing wall-clock owner used by natural/manual/cinema stories. */
export function resolvePresentationHandoverStoryFrame(
  input: PresentationHandoverStoryFrameInput,
): HandoverStoryFrame | null {
  const view = input.view;
  const event = view.event;
  if (!view.active || !isDrawableHandoverPresentationEvent(event) || view.phase === null) {
    return null;
  }
  const command = event.source === 'manual' || event.source === 'cinema';
  const claimClass: HandoverStoryClaimClass = command
    ? 'presentation-command'
    : 'observed-simulation';
  const disclosure = command
    ? 'presentation-command-not-decision-evidence' as const
    : 'observed-simulation-read-only' as const;

  const from: HandoverStoryEndpoint = {
    satelliteId: event.from.satId,
    cellId: event.from.cellId,
    beamId: storyBeamToken(event.from.beamId),
    satelliteLabel: null,
    beamLabel: null,
    geometryStatus: storyGeometryStatus(event.from.drawable),
    ee: null,
    sinr: observedMetric(event.fromSinrDb, 'dB'),
    elevationDeg: null,
  };
  const to: HandoverStoryEndpoint = {
    satelliteId: event.to.satId,
    cellId: event.to.cellId,
    beamId: storyBeamToken(event.to.beamId),
    satelliteLabel: null,
    beamLabel: null,
    geometryStatus: storyGeometryStatus(event.to.drawable),
    ee: null,
    sinr: observedMetric(event.toSinrDb, 'dB'),
    elevationDeg: null,
  };

  const durationSec = event.durationMs / 1000;
  const progress01 = clampStoryProgress(view.progress01);
  return freezeHandoverStoryFrame({
    schemaVersion: HANDOVER_STORY_FRAME_SCHEMA_VERSION,
    storyId: event.eventId,
    kind: event.kind,
    phase: presentationPhase(view.phase),
    progress01,
    committed: view.targetRole === 'serving',
    ueId: event.ueId ?? null,
    from,
    to,
    provenance: {
      producer: event.source,
      claimClass,
      decisionEvidence: 'none',
      snapshotId: null,
      episodeId: null,
      sourceFrameId: null,
      disclosure,
      decisionInputAllowed: false,
    },
    clock: {
      basis: 'presentation-wall-clock',
      currentSec: progress01 * durationSec,
      durationSec,
      sourceTimeSec: finiteStoryNumber(event.sourceTimeSec),
    },
  });
}
