// Handover-rail builders extracted from App.tsx. These are pure module-scope
// functions: they read artifact / SimState truth and emit display rail events.
// They close over no component state, so the move is behavior-preserving.
import type { SimState } from '../scene/types';
import type { VisualShowcaseArtifact } from '../scene/visual-showcase-contract';
import type { HandoverRailEvent, HandoverRailEventKind } from '../ui/HandoverEventRail';
import { APP_EPOCH_MS } from './appRuntimeConfig';

function formatRailBeamLabel(satId: string | null | undefined, beamId: string | number | null | undefined): string {
  const satLabel = satId ?? 'unknown';
  if (beamId === null || beamId === undefined || beamId === '') return satLabel;
  return `${satLabel} B${beamId}`;
}

function normalizeRailEventKind(kind: string | undefined): HandoverRailEventKind | null {
  const value = kind?.toLowerCase() ?? '';
  if (value.includes('inter')) return 'inter';
  if (value.includes('intra') || value.includes('beam-switch') || value.includes('beam')) return 'intra';
  return null;
}

function getNearestShowcaseFrame(
  artifact: VisualShowcaseArtifact,
  timeSec: number,
): VisualShowcaseArtifact['timeline'][number] | null {
  let nearest: VisualShowcaseArtifact['timeline'][number] | null = null;
  let bestDistance = Infinity;
  for (const frame of artifact.timeline) {
    const distance = Math.abs(frame.tSec - timeSec);
    if (distance < bestDistance) {
      nearest = frame;
      bestDistance = distance;
    }
  }
  return nearest;
}

function deriveArtifactRailEventKind(
  artifact: VisualShowcaseArtifact,
  timeSec: number,
  eventType: string,
): HandoverRailEventKind | null {
  const frame = getNearestShowcaseFrame(artifact, timeSec);
  const sourceKind = normalizeRailEventKind(eventType) ?? normalizeRailEventKind(frame?.handoverState.kind);
  if (sourceKind !== null) return sourceKind;

  const handover = frame?.handoverState;
  if (handover?.targetSatelliteId && handover.targetSatelliteId !== handover.servingSatelliteId) return 'inter';
  if (handover?.targetBeamId && handover.targetBeamId !== handover.servingBeamId) return 'intra';
  return null;
}

export function buildArtifactHandoverRailEvents(
  artifact: VisualShowcaseArtifact | null,
): readonly HandoverRailEvent[] {
  if (artifact === null) return [];

  return artifact.events.flatMap(event => {
    if (!event.type.toLowerCase().includes('handover')) return [];
    const kind = deriveArtifactRailEventKind(artifact, event.tSec, event.type);
    if (kind === null) return [];
    const frame = getNearestShowcaseFrame(artifact, event.tSec);
    const handover = frame?.handoverState;
    // Director framing IDs come from the primary frame handover state. Attach
    // them only when that state describes an inter-satellite change.
    const decisionSource = handover?.servingSatelliteId ?? null;
    const decisionTarget = handover?.targetSatelliteId ?? null;
    const primaryInterHo =
      decisionSource !== null && decisionTarget !== null && decisionSource !== decisionTarget;
    const fromSatId = primaryInterHo ? decisionSource : null;
    const toSatId = primaryInterHo ? decisionTarget : null;
    return [{
      id: `artifact-${event.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      timeSec: event.tSec,
      kind,
      title: event.title,
      fromLabel: formatRailBeamLabel(handover?.servingSatelliteId, handover?.servingBeamId),
      toLabel: formatRailBeamLabel(handover?.targetSatelliteId ?? handover?.servingSatelliteId, handover?.targetBeamId),
      fromSatId,
      toSatId: toSatId ?? null,
      detail: event.type,
      source: 'artifact-replay' as const,
    }];
  });
}

export function liveObservedHandoverRailEventFromState(state: SimState): HandoverRailEvent | null {
  const event = state.lastHoEvent;
  if (event === null || event.fromSatId === null || event.fromBeamId === null) return null;

  const kind = event.action === 'inter-handover' ? 'inter' : event.action === 'intra-switch' ? 'intra' : null;
  if (kind === null) return null;

  const eventTimeSec = (event.timeMs - APP_EPOCH_MS) / 1000;
  const timeSec = Number.isFinite(eventTimeSec) && eventTimeSec >= 0
    ? eventTimeSec
    : state.simTimeSec;

  return {
    id: `live-${kind}-${event.timeMs}-${event.fromSatId}-${event.fromBeamId}-${event.toSatId}-${event.toBeamId}`,
    timeSec,
    kind,
    title: kind === 'inter' ? 'Observed satellite handover' : 'Observed beam switch',
    fromLabel: formatRailBeamLabel(event.fromSatId, event.fromBeamId),
    toLabel: formatRailBeamLabel(event.toSatId, event.toBeamId),
    source: 'live-observed',
  };
}
