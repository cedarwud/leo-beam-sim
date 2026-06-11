/**
 * Handover-cinema "why (SINR)" explainer panel (S1.3).
 *
 * A floating, focus-scoped card shown during the cinema on the `sinr-live` lane.
 * It explains the handover in SINR terms ONLY: the two candidate beams + their
 * recorded live SINR, the delta, and the SINR-offset decision rule.
 *
 * Honesty (governance Rule#6, CLAUDE.md §3 / SDD §9):
 * - It is lane-truthful and stamped `data-claim-kind="sinr-offset"`. It NEVER
 *   mentions MODQN / producer and NEVER claims this is decision proof — the only
 *   rule it states is the live SINR-offset handover policy.
 * - Every SINR value comes from the live handover index (real SINR truth); the
 *   panel fabricates nothing. Per-row provenance is stamped `live`.
 * - It renders only while a cinema focus is active; it never lingers in a sidebar.
 */
import type { JSX } from 'react';
import {
  decideSinrOffsetExplainer,
  type CinemaCandidateDetail,
  type SinrCandidateRow,
} from '../app/handoverCinema';
import { EVENT_INDEX_COARSE_FORECAST_NOTE } from '../scene/liveWalkerHandoverEventIndex';

interface SinrOffsetExplainerProps {
  readonly candidate: CinemaCandidateDetail | null;
  readonly visible: boolean;
}

function formatSinr(sinrDb: number | null): string {
  return sinrDb == null ? '—' : `${sinrDb.toFixed(1)} dB`;
}

function formatDelta(deltaDb: number | null): string | null {
  if (deltaDb == null) return null;
  const sign = deltaDb >= 0 ? '+' : '−';
  return `${sign}${Math.abs(deltaDb).toFixed(1)} dB`;
}

function formatOffAxis(offAxisDeg: number | null): string {
  return offAxisDeg == null ? '—' : `${offAxisDeg.toFixed(2)}°`;
}

function ruleText(kind: 'intra' | 'inter', offsetDb: number): string {
  return kind === 'inter'
    ? `Switch satellite when best SINR − offset (${offsetDb.toFixed(1)} dB) beats serving SINR.`
    : 'Switch beam when another beam on the same satellite has stronger SINR.';
}

function roleLabel(row: SinrCandidateRow): string {
  return row.role === 'winner' ? 'winner' : 'serving';
}

export function SinrOffsetExplainer({ candidate, visible }: SinrOffsetExplainerProps): JSX.Element | null {
  const model = decideSinrOffsetExplainer(candidate);
  if (!visible || model === null) return null;
  const delta = formatDelta(model.deltaDb);

  return (
    <div
      className="leo-handover-cinema-sinr-explainer"
      data-testid="handover-cinema-sinr-explainer"
      data-claim-kind="sinr-offset"
      data-live-claim={model.claimKind}
      data-source-owner={model.sourceOwner}
      data-event-id={model.eventId}
      data-source-time-sec={model.sourceTimeSec.toFixed(3)}
      data-ue-id={model.ueId ?? ''}
      data-focus-kind={model.kind}
    >
      <div className="leo-handover-cinema-sinr-explainer__title">
        Why this {model.kind === 'inter' ? 'satellite handover' : 'beam switch'}? (SINR)
      </div>
      <div className="leo-handover-cinema-sinr-explainer__rule" data-reason-type="sinr-offset">
        {ruleText(model.kind, model.offsetDb)}
      </div>
      <div className="leo-handover-cinema-sinr-explainer__candidates">
        {/* S4-2: the rendered unit id prefers the TYPED cellId on cell-truth rows
            (row.beamId is null there — the pun is retired) and falls back to the
            steered beamId. Rendered values are unchanged: cell rows always showed
            the cell id in these attributes. */}
        {model.rows.map(row => (
          <div
            key={`${row.satId}-${row.cellId ?? row.beamId}-${row.role}`}
            className="leo-handover-cinema-sinr-explainer__candidate"
            data-testid="sinr-candidate-row"
            data-role={row.role}
            data-sat-id={row.satId}
            data-beam-id={`${row.satId}-${row.cellId ?? row.beamId}`}
            data-logical-beam-id={String(row.cellId ?? row.beamId)}
            data-cell-id={row.cellId == null ? '' : String(row.cellId)}
            data-beam-identity={row.beamIdentity ?? ''}
            data-frequency-index={row.frequencyIndex == null ? '' : String(row.frequencyIndex)}
            data-off-axis-deg={row.offAxisDeg == null ? '' : row.offAxisDeg.toFixed(3)}
            data-sinr-db={row.sinrDb == null ? '' : row.sinrDb.toFixed(1)}
            data-is-selected={row.isSelected ? 'true' : 'false'}
            data-provenance-plane="live"
          >
            <span className="leo-handover-cinema-sinr-explainer__candidate-label">
              {row.isSelected ? '★ ' : ''}{row.beamLabel}
            </span>
            <span className="leo-handover-cinema-sinr-explainer__candidate-role">{roleLabel(row)}</span>
            <span className="leo-handover-cinema-sinr-explainer__candidate-sinr">{formatSinr(row.sinrDb)}</span>
            {model.sourceOwner === 'sinr-live-cell-truth' && (
              <span className="leo-handover-cinema-sinr-explainer__candidate-off-axis">
                {formatOffAxis(row.offAxisDeg)} off-axis
              </span>
            )}
          </div>
        ))}
      </div>
      {delta !== null && (
        <div className="leo-handover-cinema-sinr-explainer__delta" data-testid="sinr-explainer-delta">
          Winner {delta} vs serving
        </div>
      )}
      {/* S4-4 (D4): the sinrLiveCells event index is precomputed OFFLINE at a
          fixed coarse step (App passes 30 s), while the live scene runs at a
          finer variable frame dt — so a clicked marker is honestly a coarse
          FORECAST, not the exact live-displayed transition. This TIMING caveat
          is orthogonal to the SOURCE-axis claim above (data-live-claim stays
          'live-truth' because the SINR values ARE real leo cell-truth). */}
      {model.sourceOwner === 'sinr-live-cell-truth' && (
        <div
          className="leo-handover-cinema-sinr-explainer__forecast"
          data-testid="sinr-explainer-forecast"
        >
          {EVENT_INDEX_COARSE_FORECAST_NOTE}
        </div>
      )}
      <div
        className="leo-handover-cinema-sinr-explainer__claim-stamp"
        data-claim="sinr-offset"
      >
        {model.sourceOwner === 'sinr-live-cell-truth'
          ? 'sinrLiveCells · sinr-offset (not MODQN)'
          : 'live SINR · sinr-offset (not MODQN)'}
      </div>
    </div>
  );
}
