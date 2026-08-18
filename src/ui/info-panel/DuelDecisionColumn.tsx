import type { ReactNode } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';
import { formatDeltaDb } from './formatters';
import { PanelHelp, usePanelCopy } from './panelHelp';
import { StatusBadge, type StatusBadgeTone } from './StatusBadge';

function DuelMetricTile({
  label,
  friendlyLabel,
  help,
  value,
  testId,
}: {
  /**
   * Mode-specific label owned by `getLiveStatusModeCopy` in InfoPanel.tsx.
   * `validate:vc4a:duel-card` pins that the strip renders the resolver's own
   * labels, so this string stays on screen verbatim — the plain-language name
   * is shown above it and the full definition lives behind the "?".
   */
  label: string;
  friendlyLabel: string;
  help?: ReactNode;
  value: string;
  testId?: string;
}) {
  return (
    <div data-testid={testId} style={{
      minWidth: 0,
      maxWidth: '100%',
      padding: '7px 7px',
      borderRadius: UI_TOKENS.radius.md,
      background: UI_TOKENS.color.surface.card,
      border: `1px solid ${UI_TOKENS.color.border.metric}`,
      boxSizing: 'border-box',
      overflow: 'hidden',
      overflowWrap: 'normal',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        minWidth: 0,
        color: UI_TOKENS.color.text.primary,
        fontSize: UI_TOKENS.type.size.tiny,
        fontWeight: UI_TOKENS.type.weight.strong,
        lineHeight: 1.15,
      }}>
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{friendlyLabel}</span>
        {help}
      </div>
      <div style={{
        color: UI_TOKENS.color.text.muted,
        fontSize: UI_TOKENS.type.size.tiny,
        lineHeight: 1.15,
        marginBottom: 3,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'clip',
      }}>
        {label}
      </div>
      <div style={{
        color: UI_TOKENS.color.text.primary,
        fontSize: UI_TOKENS.type.size.small,
        fontWeight: UI_TOKENS.type.weight.heavy,
        lineHeight: 1.1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}>
        {value}
      </div>
    </div>
  );
}

export function DuelDecisionColumn({
  sinrDeltaDb,
  handoverOffsetDb,
  triggerProgressSec,
  triggerSec,
  triggerRatio,
  stateLabel,
  stateTone,
  handoverCount,
  deltaLabel = 'Δ SINR',
  offsetLabel = 'Need Offset',
  triggerLabel = 'Trigger Time',
  triggerAriaLabel = 'Handover trigger progress',
  decisionUnavailableReason,
}: {
  sinrDeltaDb: number | null;
  handoverOffsetDb: number | null;
  triggerProgressSec: number | null;
  triggerSec: number | null;
  triggerRatio: number | null;
  stateLabel: string;
  stateTone: StatusBadgeTone;
  /** Handovers completed so far in this run. */
  handoverCount?: number | null;
  deltaLabel?: string;
  offsetLabel?: string;
  triggerLabel?: string;
  triggerAriaLabel?: string;
  /**
   * The TLE canonical frame compares links but does not own a handover policy.
   * When present, retain the familiar decision-column structure while showing
   * honest unavailable values instead of profile defaults or fabricated zeroes.
   */
  decisionUnavailableReason?: string;
}) {
  const { t, tx } = usePanelCopy();
  const hasHandoverDecision = decisionUnavailableReason === undefined
    && handoverOffsetDb !== null
    && triggerProgressSec !== null
    && triggerSec !== null
    && triggerRatio !== null;
  const progressPercent = hasHandoverDecision ? Math.round(triggerRatio * 100) : 0;

  return (
    <div
      data-testid="info-panel-duel-center"
      className="leo-duel-decision-strip"
      data-duel-block="decision"
      style={{
        minWidth: 0,
        display: 'grid',
        gap: 10,
        alignContent: 'stretch',
        justifyItems: 'stretch',
        padding: '11px 12px',
        borderRadius: UI_TOKENS.radius.lg,
        background: 'rgba(3, 10, 18, 0.46)',
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        overflowWrap: 'normal',
      }}
    >
      {/* PENDING TARGET already names the handover state; omit only the redundant center badge. */}
      <div
        aria-hidden={stateLabel === 'pending' ? true : undefined}
        style={{
          display: stateLabel === 'pending' ? 'none' : 'flex',
          justifyContent: 'center',
          minWidth: 0,
          width: '100%',
          overflow: 'hidden',
        }}
      >
        <StatusBadge tone={stateTone}>
          {stateLabel}
        </StatusBadge>
      </div>

      <div className="leo-duel-decision-metrics" style={{ minWidth: 0, width: '100%' }}>
        <DuelMetricTile
          testId="info-panel-duel-delta-tile"
          friendlyLabel={t('kpi.sinrDelta.label')}
          label={deltaLabel}
          help={(
            <PanelHelp
              helpId="kpi.sinrDelta"
              titleKey="kpi.sinrDelta.label"
              bodyKey="kpi.sinrDelta.help"
              formula={<>Δγ</>}
              meta={<>{t('common.unit.db')}</>}
            />
          )}
          value={formatDeltaDb(sinrDeltaDb)}
        />
        <DuelMetricTile
          testId="info-panel-duel-offset-tile"
          friendlyLabel={tx('panel.handoverOffset.label')}
          label={offsetLabel}
          help={(
            <PanelHelp
              helpId="panel.handoverOffset"
              titleText={tx('panel.handoverOffset.label')}
              bodyText={tx('panel.handoverOffset.help')}
              meta={<>{t('common.unit.db')}</>}
            />
          )}
          value={hasHandoverDecision ? `+${handoverOffsetDb!.toFixed(1)} dB` : '—'}
        />
      </div>

      <div className="leo-duel-trigger-row" style={{ minWidth: 0, width: '100%', overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gap: 3,
          color: UI_TOKENS.color.text.primary,
          fontSize: UI_TOKENS.type.size.caption,
          lineHeight: 1.25,
        }}>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            minWidth: 0,
          }}>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{t('kpi.tttProgress.label')}</span>
            <PanelHelp
              helpId="kpi.tttProgress"
              titleKey="kpi.tttProgress.label"
              bodyKey="kpi.tttProgress.help"
              meta={<>{t('common.unit.second')}</>}
            />
          </span>
          <span style={{
            color: UI_TOKENS.color.text.muted,
            fontSize: UI_TOKENS.type.size.tiny,
            whiteSpace: 'nowrap',
          }}>
            {triggerLabel}
          </span>
          <span style={{ color: UI_TOKENS.color.text.secondary, whiteSpace: 'nowrap' }}>
            {hasHandoverDecision ? `${triggerProgressSec!.toFixed(1)} / ${triggerSec!.toFixed(1)} s` : '—'}
          </span>
        </div>
        {hasHandoverDecision ? (
          <div
            data-testid="info-panel-duel-trigger-progress"
            role="progressbar"
            aria-label={triggerAriaLabel}
            aria-valuemin={0}
            aria-valuemax={triggerSec!}
            aria-valuenow={Math.min(triggerProgressSec!, triggerSec!)}
            data-trigger-progress={progressPercent}
            data-handover-decision="available"
            style={{
              height: 8,
              background: UI_TOKENS.color.border.subtle,
              borderRadius: UI_TOKENS.radius.pill,
              overflow: 'hidden',
            }}
          >
            <div style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: sinrDeltaDb !== null && sinrDeltaDb >= handoverOffsetDb!
                ? UI_TOKENS.color.semantic.good
                : UI_TOKENS.color.semantic.info,
              borderRadius: UI_TOKENS.radius.pill,
              transition: 'width 120ms linear',
            }}
            />
          </div>
        ) : (
          <div
            data-testid="info-panel-duel-trigger-progress"
            data-handover-decision="not-in-frame"
            style={{
              color: UI_TOKENS.color.text.faint,
              fontSize: UI_TOKENS.type.size.tiny,
              lineHeight: 1.35,
            }}
          >
            {decisionUnavailableReason}
          </div>
        )}
      </div>

      {handoverCount === undefined ? null : (
        <div
          data-testid="info-panel-duel-handover-count"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            minWidth: 0,
            width: '100%',
            overflow: 'hidden',
            color: UI_TOKENS.color.text.secondary,
            fontSize: UI_TOKENS.type.size.tiny,
            lineHeight: 1.2,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{tx('panel.field.handoverCount')}</span>
            <PanelHelp
              helpId="kpi.handoverCount"
              titleKey="kpi.handoverCount.label"
              bodyKey="kpi.handoverCount.help"
            />
          </span>
          <span style={{
            flexShrink: 0,
            color: UI_TOKENS.color.text.primary,
            fontWeight: UI_TOKENS.type.weight.heavy,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}>
            {handoverCount === null ? '—' : handoverCount}
            <span style={{
              marginLeft: 3,
              color: UI_TOKENS.color.text.secondary,
              fontWeight: UI_TOKENS.type.weight.strong,
            }}>
              {tx('panel.field.handoverCount.unit')}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
