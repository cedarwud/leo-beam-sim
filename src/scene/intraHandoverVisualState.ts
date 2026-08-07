import {
  SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC,
  type SinrLiveCellHandoverEvent,
} from './sinrLiveCellModel';

/**
 * Select the event that may arm the protagonist's triggered intra visual.
 *
 * `recentHandoverEvents` is a display window, not an event-history source. Keep
 * the predicate explicit here so an inter event, an expired event, or a future
 * event can never paint the intra handover's yellow source cone.
 */
export function resolveRecentPrimaryIntraHandoverEvent(input: {
  readonly events: readonly SinrLiveCellHandoverEvent[] | undefined;
  readonly primaryUeId: string | undefined;
  readonly simTimeSec: number;
  readonly retentionSec?: number;
}): SinrLiveCellHandoverEvent | null {
  if (!input.events || !input.primaryUeId || !Number.isFinite(input.simTimeSec)) return null;
  const retentionSec = input.retentionSec ?? SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC;
  if (!Number.isFinite(retentionSec) || retentionSec < 0) return null;

  // The model exposes events newest last. Walk backwards so the visual follows
  // the latest qualifying intra event when a UE hands over more than once in the
  // short retention window.
  for (let index = input.events.length - 1; index >= 0; index -= 1) {
    const event = input.events[index];
    if (
      event.ueId !== input.primaryUeId
      || event.kind !== 'intra'
      || event.fromSatId === null
      || event.fromCellId === null
    ) {
      continue;
    }
    const ageSec = input.simTimeSec - event.sourceTimeSec;
    if (ageSec >= 0 && ageSec < retentionSec) return event;
  }
  return null;
}
