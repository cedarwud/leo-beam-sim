import type { LiveWalkerHandoverEventIndex } from '../scene/liveWalkerHandoverEventIndex';
import type { HandoverRailEvent } from '../ui/HandoverEventRail';

function formatLiveWalkerBeamLabel(satId: string, beamId: number): string {
  return `${satId} B${beamId}`;
}

function liveWalkerRailTitle(kind: HandoverRailEvent['kind']): string {
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
      title: liveWalkerRailTitle(event.kind),
      fromLabel: formatLiveWalkerBeamLabel(event.fromSatId, event.fromBeamId),
      toLabel: formatLiveWalkerBeamLabel(event.toSatId, event.toBeamId),
      fromSatId: event.fromSatId,
      toSatId: event.toSatId,
      detail: `${index.ueScope}; ${index.aggregateClaim}`,
      source: 'live-walker',
      count: event.count,
    }))
    .sort((a, b) => (
      (a.sourceTimeSec ?? a.timeSec) - (b.sourceTimeSec ?? b.timeSec)
      || a.kind.localeCompare(b.kind)
      || a.id.localeCompare(b.id)
    ));
}
