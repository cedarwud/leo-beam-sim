import { UI_TOKENS } from '../../constants/uiTokens';
import { formatDeltaDb } from './formatters';
import { StatusBadge, type StatusBadgeTone } from './StatusBadge';

function DuelMetricTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={{
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
        color: UI_TOKENS.color.text.secondary,
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
}: {
  sinrDeltaDb: number | null;
  handoverOffsetDb: number;
  triggerProgressSec: number;
  triggerSec: number;
  triggerRatio: number;
  stateLabel: string;
  stateTone: StatusBadgeTone;
}) {
  const progressPercent = Math.round(triggerRatio * 100);

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
      <div style={{ display: 'flex', justifyContent: 'center', minWidth: 0, width: '100%', overflow: 'hidden' }}>
        <StatusBadge tone={stateTone}>
          {stateLabel}
        </StatusBadge>
      </div>

      <div className="leo-duel-decision-metrics" style={{ minWidth: 0, width: '100%' }}>
        <DuelMetricTile
          label="Δ SINR"
          value={formatDeltaDb(sinrDeltaDb)}
        />
        <DuelMetricTile
          label="Need Offset"
          value={`+${handoverOffsetDb.toFixed(1)} dB`}
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
          <span style={{ whiteSpace: 'nowrap' }}>Trigger Time</span>
          <span style={{ color: UI_TOKENS.color.text.secondary, whiteSpace: 'nowrap' }}>
            {triggerProgressSec.toFixed(1)} / {triggerSec.toFixed(1)} s
          </span>
        </div>
        <div
          data-testid="info-panel-duel-trigger-progress"
          role="progressbar"
          aria-label="Handover trigger progress"
          aria-valuemin={0}
          aria-valuemax={triggerSec}
          aria-valuenow={Math.min(triggerProgressSec, triggerSec)}
          data-trigger-progress={progressPercent}
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
            background: sinrDeltaDb !== null && sinrDeltaDb >= handoverOffsetDb
              ? UI_TOKENS.color.semantic.good
              : UI_TOKENS.color.semantic.info,
            borderRadius: UI_TOKENS.radius.pill,
            transition: 'width 120ms linear',
          }}
          />
        </div>
      </div>
    </div>
  );
}
