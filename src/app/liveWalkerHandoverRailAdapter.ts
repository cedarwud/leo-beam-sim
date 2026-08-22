import type {
  LiveWalkerHandoverEvent,
  LiveWalkerHandoverEventIndex,
} from '../scene/liveWalkerHandoverEventIndex';
import type { HandoverRailEvent } from '../ui/HandoverEventRail';

/**
 * Director focus is a single-UE teaching shot. The cell-truth index also carries
 * aggregate events for the other UEs, so keep those on the rail but exclude them
 * from the Director's next-event selector. Legacy live-Walker rows already have
 * the primary-only scope and remain unchanged.
 */
export function selectDirectorHandoverEvents(
  index: Pick<LiveWalkerHandoverEventIndex, 'sourceOwner' | 'primaryUeId'>,
  events: readonly LiveWalkerHandoverEvent[],
  /**
   * The UE the panels are currently following. The cell-truth index records
   * events for EVERY UE, but the Director shows only the protagonist's — and
   * `index.primaryUeId` is baked to `live-ue-0` at build time, so without this
   * override Show Intra / Show Inter always seek to cell 0's handovers no
   * matter which cell is focused. Falls back to the index's own id.
   */
  focusedUeId?: string | null,
): readonly LiveWalkerHandoverEvent[] {
  if (index.sourceOwner !== 'sinr-live-cell-truth') return events;
  const protagonistUeId = focusedUeId ?? index.primaryUeId;
  return events.filter(event => event.ueId === protagonistUeId);
}

function formatLiveWalkerBeamLabel(satId: string, beamId: number | null): string {
  return `${satId} B${beamId}`;
}

function formatCellTruthBeamLabel(satId: string, cellId: number): string {
  return `${satId} C${cellId}`;
}

function liveWalkerRailTitle(kind: HandoverRailEvent['kind'], sourceOwner: LiveWalkerHandoverEventIndex['sourceOwner']): string {
  if (sourceOwner === 'sinr-live-cell-truth') {
    return kind === 'inter' ? 'SINR cell-truth satellite handover' : 'SINR cell-truth cell switch';
  }
  return kind === 'inter' ? 'Live satellite handover' : 'Live beam switch';
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
