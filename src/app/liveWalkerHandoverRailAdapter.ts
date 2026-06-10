import type { LiveWalkerHandoverEventIndex } from '../scene/liveWalkerHandoverEventIndex';
import type { HandoverRailEvent } from '../ui/HandoverEventRail';

function formatLiveWalkerBeamLabel(satId: string, beamId: number): string {
  return `${satId} B${beamId}`;
}

function formatCellTruthBeamLabel(satId: string, cellId: number): string {
  return `${satId} C${cellId}`;
}

function liveWalkerRailTitle(kind: HandoverRailEvent['kind'], sourceOwner: LiveWalkerHandoverEventIndex['sourceOwner']): string {
  if (sourceOwner === 'sinr-live-cell-truth') {
    return kind === 'inter' ? 'SINR cell-truth satellite handover' : 'SINR cell-truth cell switch';
  }
  return kind === 'inter' ? 'Live Walker satellite handover' : 'Live Walker beam switch';
}

export function liveWalkerHandoverEventIndexToRailEvents(
  index: LiveWalkerHandoverEventIndex | null,
): readonly HandoverRailEvent[] {
  if (index === null) return [];

  return index.events
    .map((event): HandoverRailEvent => ({
      id: event.id,
      timeSec: event.sourceTimeSec,
      sourceTimeSec: event.sourceTimeSec,
      clickTargetSec: event.clickTargetSec,
      kind: event.kind,
      title: liveWalkerRailTitle(event.kind, index.sourceOwner),
      fromLabel: index.sourceOwner === 'sinr-live-cell-truth' && event.fromCellId !== undefined
        ? formatCellTruthBeamLabel(event.fromSatId, event.fromCellId)
        : formatLiveWalkerBeamLabel(event.fromSatId, event.fromBeamId),
      toLabel: index.sourceOwner === 'sinr-live-cell-truth' && event.toCellId !== undefined
        ? formatCellTruthBeamLabel(event.toSatId, event.toCellId)
        : formatLiveWalkerBeamLabel(event.toSatId, event.toBeamId),
      fromSatId: event.fromSatId,
      toSatId: event.toSatId,
      detail: event.ueId
        ? `${event.ueId}; ${index.ueScope}; ${index.aggregateClaim}`
        : `${index.ueScope}; ${index.aggregateClaim}`,
      source: index.sourceOwner === 'sinr-live-cell-truth' ? 'sinr-live-cell-truth' : 'live-walker',
      count: event.count,
    }))
    .sort((a, b) => (
      (a.sourceTimeSec ?? a.timeSec) - (b.sourceTimeSec ?? b.timeSec)
      || a.kind.localeCompare(b.kind)
      || a.id.localeCompare(b.id)
    ));
}
