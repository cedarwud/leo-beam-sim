/**
 * SINR-live handover ticker (G2-TICKER).
 *
 * An always-on HUD on the `sinr-live` lane that proves the "一直有換手" goal: a
 * monotonic running COUNT of how many REAL handovers have fired this continuity
 * epoch, split inter (cross-satellite) vs intra (cross-cell). It complements the
 * ambient live-handover PULSE cones — the scene shows the recent flares, the ticker
 * gives the running total.
 *
 * Why a cumulative total, not a "last N seconds" window: the cell model's
 * `recentHandoverEvents` is a sim-time RETENTION WINDOW that, at high playback
 * speed, spans only a fraction of a second of wall time and so empties between the
 * UI publisher's throttled ticks — a windowed count read 0 while the unthrottled
 * pulse rendered cones (the HUD under-counted the live stream). A cumulative total
 * (`cumulativeIntra/InterHandoverCount`, published from the cell model) survives any
 * publish cadence: the throttle batches increments instead of dropping events.
 *
 * Honesty (governance Rule#6):
 * - Display-only. It renders ONLY the running totals the cell model already
 *   accumulated from its classified handovers (G2a) — it never invents a handover,
 *   a timing, or a from→to pair, and does no arithmetic beyond total = intra + inter.
 * - Lane-truthful, stamped `data-claim-kind="sinr-handover"`. It NEVER mentions
 *   MODQN / producer and claims no decision proof — only "this many live cell-truth
 *   handovers have fired this run".
 */
import type { JSX } from 'react';

interface SinrHandoverTickerProps {
  /** `SimState.cumulativeIntraHandoverCount` — monotonic intra-HO epoch total (G2a). */
  readonly cumulativeIntra?: number;
  /** `SimState.cumulativeInterHandoverCount` — monotonic inter-HO epoch total (G2a). */
  readonly cumulativeInter?: number;
  readonly visible: boolean;
}

export function SinrHandoverTicker({
  cumulativeIntra,
  cumulativeInter,
  visible,
}: SinrHandoverTickerProps): JSX.Element | null {
  if (!visible) return null;
  const intra = cumulativeIntra ?? 0;
  const inter = cumulativeInter ?? 0;
  const total = intra + inter;
  return (
    <div
      className="leo-sinr-ho-ticker"
      data-testid="sinr-handover-ticker"
      data-claim-kind="sinr-handover"
      data-ho-total={total}
      data-ho-inter={inter}
      data-ho-intra={intra}
    >
      <div className="leo-sinr-ho-ticker__title">Handovers · this run</div>
      <div className="leo-sinr-ho-ticker__total" data-testid="sinr-handover-ticker-total">
        {total}
      </div>
      <div className="leo-sinr-ho-ticker__split">
        <span data-testid="sinr-handover-ticker-inter">inter {inter}</span>
        <span data-testid="sinr-handover-ticker-intra">intra {intra}</span>
      </div>
      <div className="leo-sinr-ho-ticker__claim" data-claim="sinr-handover">
        live cell-truth handovers · not MODQN
      </div>
    </div>
  );
}
