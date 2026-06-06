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
      data-focus-kind={model.kind}
    >
      <div className="leo-handover-cinema-sinr-explainer__title">
        Why this {model.kind === 'inter' ? 'satellite handover' : 'beam switch'}? (SINR)
      </div>
      <div className="leo-handover-cinema-sinr-explainer__rule" data-reason-type="sinr-offset">
        {ruleText(model.kind, model.offsetDb)}
      </div>
      <div className="leo-handover-cinema-sinr-explainer__candidates">
        {model.rows.map(row => (
          <div
            key={`${row.satId}-${row.beamId}-${row.role}`}
            className="leo-handover-cinema-sinr-explainer__candidate"
            data-testid="sinr-candidate-row"
            data-role={row.role}
            data-beam-id={`${row.satId}-${row.beamId}`}
            data-sinr-db={row.sinrDb == null ? '' : row.sinrDb.toFixed(1)}
            data-is-selected={row.isSelected ? 'true' : 'false'}
            data-provenance-plane="live"
          >
            <span className="leo-handover-cinema-sinr-explainer__candidate-label">
              {row.isSelected ? '★ ' : ''}{row.beamLabel}
            </span>
            <span className="leo-handover-cinema-sinr-explainer__candidate-role">{roleLabel(row)}</span>
            <span className="leo-handover-cinema-sinr-explainer__candidate-sinr">{formatSinr(row.sinrDb)}</span>
          </div>
        ))}
      </div>
      {delta !== null && (
        <div className="leo-handover-cinema-sinr-explainer__delta" data-testid="sinr-explainer-delta">
          Winner {delta} vs serving
        </div>
      )}
      <div
        className="leo-handover-cinema-sinr-explainer__claim-stamp"
        data-claim="sinr-offset"
      >
        live SINR · sinr-offset (not MODQN)
      </div>
    </div>
  );
}
