import { BEAM_ROLE_TOKENS } from '../../constants/beamRoleTokens';
import { MIN_VISIBLE_SINR_DB } from '../../constants/sinr';
import { UI_TOKENS } from '../../constants/uiTokens';
import {
  channelMetricLabelForKind,
  formatElevation,
  formatSlantRange,
  sinrColor,
} from './formatters';
import type { GlyphKind } from '../../contracts/glyphTypes';
import { PanelBeamIdentity } from './Identity';
import { StatusBadge, type StatusBadgeTone } from './StatusBadge';

// P1e (c) audit-list hook (PR-0.5 backfill): `channelMetricLabelForKind` is
// imported so the bare numeric SINR readout below can later branch its label
// on the producer-declared kind. Full label rendering is reserved for the
// slice PRs — the constant keeps the contract surface in scope.
const _PANEL_SINR_LABEL_DEFAULT = channelMetricLabelForKind(undefined);
void _PANEL_SINR_LABEL_DEFAULT;

function SinrReadout({
  testId,
  sinrDb,
  isActive,
}: {
  testId: string;
  sinrDb: number | null;
  isActive: boolean;
}) {
  const hasValue = isActive
    && sinrDb !== null
    && Number.isFinite(sinrDb)
    && sinrDb > MIN_VISIBLE_SINR_DB;
  const color = hasValue ? sinrColor(sinrDb) : UI_TOKENS.color.text.primary;

  if (!hasValue) {
    return (
      <div
        data-testid={testId}
        style={{
          color,
          fontSize: UI_TOKENS.type.size.signal,
          fontWeight: UI_TOKENS.type.weight.strong,
          lineHeight: 1,
          minWidth: 0,
        }}
      >
        —
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 5,
        minWidth: 0,
        color,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span style={{
        fontSize: UI_TOKENS.type.size.signal,
        fontWeight: UI_TOKENS.type.weight.strong,
        lineHeight: 0.95,
      }}>
        {sinrDb.toFixed(1)}
      </span>
      <span style={{
        fontSize: UI_TOKENS.type.size.caption,
        fontWeight: UI_TOKENS.type.weight.heavy,
        lineHeight: 1,
        opacity: 0.88,
      }}>
        dB
      </span>
    </div>
  );
}

function CompactSignalMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 6,
      minWidth: 0,
      padding: '5px 6px',
      borderRadius: UI_TOKENS.radius.sm,
      background: UI_TOKENS.color.surface.card,
      border: `1px solid ${UI_TOKENS.color.border.metric}`,
      overflowWrap: 'normal',
    }}>
      <span style={{
        color: UI_TOKENS.color.text.secondary,
        fontSize: UI_TOKENS.type.size.tiny,
        lineHeight: 1.15,
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
      <span style={{
        minWidth: 0,
        color: UI_TOKENS.color.text.primary,
        fontSize: UI_TOKENS.type.size.tiny,
        fontWeight: UI_TOKENS.type.weight.heavy,
        lineHeight: 1.15,
        textAlign: 'right',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  );
}

export type DuelSignalTone = 'serving' | 'pending' | 'recentSource' | 'recentTarget' | 'neutral';

function duelSignalToneStyle(tone: DuelSignalTone) {
  if (tone === 'serving') {
    return {
      accent: UI_TOKENS.color.semantic.serving.accent,
      title: UI_TOKENS.color.semantic.serving.title,
      caption: UI_TOKENS.color.semantic.serving.caption,
      background: UI_TOKENS.color.semantic.serving.background,
      border: UI_TOKENS.color.semantic.serving.border,
      glow: UI_TOKENS.color.semantic.serving.glow,
    };
  }

  if (tone === 'pending') {
    return {
      accent: UI_TOKENS.color.semantic.candidate.accent,
      title: UI_TOKENS.color.semantic.candidate.title,
      caption: UI_TOKENS.color.semantic.candidate.caption,
      background: UI_TOKENS.color.semantic.candidate.background,
      border: UI_TOKENS.color.semantic.candidate.border,
      glow: UI_TOKENS.color.semantic.candidate.glow,
    };
  }

  if (tone === 'recentSource') {
    return {
      accent: BEAM_ROLE_TOKENS.recentSource.color,
      title: '#fff2b8',
      caption: 'rgba(255,242,184,0.72)',
      background: 'linear-gradient(180deg, rgba(118, 94, 13, 0.32), rgba(50, 39, 9, 0.27))',
      border: 'rgba(250, 204, 21, 0.42)',
      glow: 'inset 0 0 24px rgba(250, 204, 21, 0.1), 0 0 16px rgba(250, 204, 21, 0.08)',
    };
  }

  if (tone === 'recentTarget') {
    return {
      accent: UI_TOKENS.color.semantic.candidate.accent,
      title: UI_TOKENS.color.semantic.candidate.title,
      caption: UI_TOKENS.color.semantic.candidate.caption,
      background: UI_TOKENS.color.semantic.candidate.background,
      border: UI_TOKENS.color.semantic.candidate.border,
      glow: UI_TOKENS.color.semantic.candidate.glow,
    };
  }

  return {
    accent: UI_TOKENS.color.semantic.inactive,
    title: UI_TOKENS.color.text.secondary,
    caption: UI_TOKENS.color.text.faint,
    background: UI_TOKENS.color.surface.cardSubtle,
    border: UI_TOKENS.color.border.subtle,
    glow: 'none',
  };
}

export function DuelSignalColumn({
  testId,
  identityTestId,
  title,
  caption,
  badgeText,
  badgeTone,
  identity,
  isActive,
  glyph,
  sinrDb,
  elevationDeg,
  rangeKm,
  tone,
}: {
  testId: string;
  identityTestId: string;
  title: string;
  caption: string;
  badgeText: string;
  badgeTone: StatusBadgeTone;
  identity: string;
  isActive: boolean;
  glyph: GlyphKind | null;
  sinrDb: number | null;
  elevationDeg: number | null;
  rangeKm: number | null;
  tone: DuelSignalTone;
}) {
  const toneStyle = duelSignalToneStyle(tone);

  return (
    <div
      data-testid={testId}
      className="leo-duel-signal-block"
      data-duel-block={testId === 'info-panel-primary-sinr-status' ? 'serving' : 'comparison'}
      data-ownership="operational-sinr-status"
      style={{
        minWidth: 0,
        padding: '12px',
        background: toneStyle.background,
        borderRadius: UI_TOKENS.radius.lg,
        border: `1px solid ${toneStyle.border}`,
        boxShadow: toneStyle.glow,
        display: 'grid',
        gap: 9,
        overflowWrap: 'normal',
      }}
    >
      <div style={{
        display: 'grid',
        justifyItems: 'start',
        gap: 5,
        minWidth: 0,
      }}>
        <div style={{
          minWidth: 0,
          color: toneStyle.title,
          fontSize: UI_TOKENS.type.size.caption,
          fontWeight: UI_TOKENS.type.weight.heavy,
          textTransform: 'uppercase',
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
        }}>
          {title}
        </div>
        <StatusBadge tone={badgeTone}>
          {badgeText}
        </StatusBadge>
      </div>

      <div style={{
        color: toneStyle.caption,
        fontSize: UI_TOKENS.type.size.caption,
        lineHeight: 1.25,
      }}>
        {caption}
      </div>

      <div
        data-testid={identityTestId}
        data-beam-identity={isActive ? identity : undefined}
        data-satellite-glyph={glyph ?? undefined}
        style={{
          color: UI_TOKENS.color.text.primary,
          fontSize: UI_TOKENS.type.size.body,
          fontWeight: UI_TOKENS.type.weight.strong,
          lineHeight: 1.28,
          minHeight: 42,
          overflowWrap: 'anywhere',
        }}
      >
        <PanelBeamIdentity identity={identity} glyph={glyph} />
      </div>

      <SinrReadout
        testId={`${testId}-sinr-readout`}
        sinrDb={sinrDb}
        isActive={isActive}
      />

      <div style={{
        display: 'grid',
        gap: 5,
      }}>
        <CompactSignalMetric
          label="El"
          value={formatElevation(isActive ? elevationDeg : null)}
        />
        <CompactSignalMetric
          label="Range"
          value={formatSlantRange(isActive ? rangeKm : null)}
        />
      </div>
    </div>
  );
}
