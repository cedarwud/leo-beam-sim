/**
 * SINR-live handover ticker (G2-TICKER).
 *
 * An always-on HUD on the `sinr-live` lane that proves the "一直有換手" goal: a
 * rolling readout of how many REAL handovers fired in the last
 * {@link ../scene/sinrLiveCellModel.SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC} of
 * sim-time, split inter (cross-satellite) vs intra (cross-cell). It complements
 * the ambient live-handover PULSE cones (the scene shows the flares; the ticker
 * gives the count).
 *
 * Honesty (governance Rule#6):
 * - Display-only. It reads ONLY the per-UE handover events the cell model already
 *   classified + pruned to the retention window
 *   (`SinrLiveCellFrame.recentHandoverEvents`, G2a) and COUNTS them by kind — it
 *   never invents a handover, a timing, or a from→to pair.
 * - Lane-truthful, stamped `data-claim-kind="sinr-handover"`. It NEVER mentions
 *   MODQN / producer and claims no decision proof — only "this many live
 *   cell-truth handovers happened in the last N seconds".
 */
import type { JSX } from 'react';

export interface RecentHandoverSummary {
  readonly inter: number;
  readonly intra: number;
  readonly total: number;
}

/**
 * Pure: count the rolling-window handover events by kind. The events are already
 * pruned to the retention window by the model, so this only tallies — it does not
 * filter by time or fabricate anything. Tolerates an undefined/empty list (N≤1 or
 * a frame with no recent handovers) → all-zero.
 */
export function summarizeRecentHandovers(
  events: readonly { readonly kind: 'inter' | 'intra' }[] | undefined,
): RecentHandoverSummary {
  let inter = 0;
  let intra = 0;
  for (const event of events ?? []) {
    if (event.kind === 'inter') inter += 1;
    else if (event.kind === 'intra') intra += 1;
  }
  return { inter, intra, total: inter + intra };
}

interface SinrHandoverTickerProps {
  /** `SimState.sinrLiveCells?.recentHandoverEvents` — the rolling real-handover log (G2a). */
  readonly recentHandoverEvents?: readonly { readonly kind: 'inter' | 'intra' }[];
  /** Retention window in sim-seconds, for the label (SINR_LIVE_RECENT_HANDOVER_RETENTION_SEC). */
  readonly retentionSec: number;
  readonly visible: boolean;
}

export function SinrHandoverTicker({
  recentHandoverEvents,
  retentionSec,
  visible,
}: SinrHandoverTickerProps): JSX.Element | null {
  if (!visible) return null;
  const summary = summarizeRecentHandovers(recentHandoverEvents);
  return (
    <div
      className="leo-sinr-ho-ticker"
      data-testid="sinr-handover-ticker"
      data-claim-kind="sinr-handover"
      data-ho-window-total={summary.total}
      data-ho-window-inter={summary.inter}
      data-ho-window-intra={summary.intra}
      data-ho-retention-sec={retentionSec}
    >
      <div className="leo-sinr-ho-ticker__title">Handovers · last {retentionSec}s</div>
      <div className="leo-sinr-ho-ticker__total" data-testid="sinr-handover-ticker-total">
        {summary.total}
      </div>
      <div className="leo-sinr-ho-ticker__split">
        <span data-testid="sinr-handover-ticker-inter">inter {summary.inter}</span>
        <span data-testid="sinr-handover-ticker-intra">intra {summary.intra}</span>
      </div>
      <div className="leo-sinr-ho-ticker__claim" data-claim="sinr-handover">
        live cell-truth handovers · not MODQN
      </div>
    </div>
  );
}
