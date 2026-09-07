import {
  SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC,
  type SinrLiveCellHandoverEvent,
} from './sinrLiveCellModel';

export interface RecentPrimaryHandoverEventInput {
  readonly events: readonly SinrLiveCellHandoverEvent[] | undefined;
  readonly primaryUeId: string | null | undefined;
  readonly simTimeSec: number;
  readonly retentionSec?: number;
}

export interface RecentInterHandoverEventInput {
  readonly events: readonly SinrLiveCellHandoverEvent[] | undefined;
  readonly simTimeSec: number;
  readonly retentionSec?: number;
}

function resolveRetentionSec(retentionSec: number | undefined): number | null {
  const resolved = retentionSec ?? SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC;
  return Number.isFinite(resolved) && resolved >= 0 ? resolved : null;
}

function isRetainedEvent(
  event: SinrLiveCellHandoverEvent,
  simTimeSec: number,
  retentionSec: number,
): boolean {
  const ageSec = simTimeSec - event.sourceTimeSec;
  return ageSec >= 0 && ageSec < retentionSec;
}

/**
 * Select the protagonist event for the normalized handover presentation.
 *
 * Events are newest last. A retained inter event stays authoritative even when
 * a newer same-UE intra event is present in the short display window.
 */
export function resolveRecentPrimaryHandoverEvent(
  input: RecentPrimaryHandoverEventInput,
): SinrLiveCellHandoverEvent | null {
  if (!input.events || !input.primaryUeId || !Number.isFinite(input.simTimeSec)) return null;
  const retentionSec = resolveRetentionSec(input.retentionSec);
  if (retentionSec === null) return null;

  let latestPrimaryIntra: SinrLiveCellHandoverEvent | null = null;
  for (let index = input.events.length - 1; index >= 0; index -= 1) {
    const event = input.events[index];
    if (
      event.ueId !== input.primaryUeId
      || event.fromSatId === null
      || event.fromCellId === null
      || !isRetainedEvent(event, input.simTimeSec, retentionSec)
    ) continue;
    if (event.kind === 'inter') return event;
    latestPrimaryIntra ??= event;
  }
  return latestPrimaryIntra;
}

/** Select the newest retained inter event across all UEs for visual suppression. */
export function resolveRecentInterHandoverEvent(
  input: RecentInterHandoverEventInput,
): SinrLiveCellHandoverEvent | null {
  if (!input.events || !Number.isFinite(input.simTimeSec)) return null;
  const retentionSec = resolveRetentionSec(input.retentionSec);
  if (retentionSec === null) return null;

  for (let index = input.events.length - 1; index >= 0; index -= 1) {
    const event = input.events[index];
    if (
      event.kind === 'inter'
      && event.fromSatId !== null
      && event.fromCellId !== null
      && isRetainedEvent(event, input.simTimeSec, retentionSec)
    ) return event;
  }
  return null;
}
