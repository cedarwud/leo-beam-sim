import type { ReactNode } from 'react';
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
import { PanelHelp, usePanelCopy } from './panelHelp';
import { StatusBadge, type StatusBadgeTone } from './StatusBadge';
import { InlineFormulaFraction } from '../signal-tuning/FormulaHeader';
import { LinkAngle, SystemAngleState } from '../signal-tuning/FormulaSymbols';

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
  help,
  value,
  valueUnit,
  testId,
  emphasis = 'default',
}: {
  label: string;
  /** "?" trigger for this field's definition. */
  help?: ReactNode;
  value: string;
  valueUnit?: string;
  testId?: string;
  emphasis?: 'default' | 'primary';
}) {
  const isPrimary = emphasis === 'primary';

  return (
    <div data-testid={testId} data-metric-emphasis={emphasis} style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
      padding: isPrimary ? '8px 9px' : '5px 6px',
      borderRadius: isPrimary ? UI_TOKENS.radius.md : UI_TOKENS.radius.sm,
      background: isPrimary ? UI_TOKENS.color.surface.cardSubtle : UI_TOKENS.color.surface.card,
      border: `1px solid ${isPrimary ? UI_TOKENS.color.border.focus : UI_TOKENS.color.border.metric}`,
      overflowWrap: 'normal',
    }}>
      <span style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        minWidth: 0,
        color: isPrimary ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
        fontSize: isPrimary ? UI_TOKENS.type.size.caption : UI_TOKENS.type.size.tiny,
        fontWeight: isPrimary ? UI_TOKENS.type.weight.strong : undefined,
        lineHeight: 1.15,
      }}>
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>
        {help}
      </span>
      <span style={{
        minWidth: 0,
        color: UI_TOKENS.color.text.primary,
        fontSize: isPrimary ? UI_TOKENS.type.size.bodyLg : UI_TOKENS.type.size.tiny,
        fontWeight: UI_TOKENS.type.weight.heavy,
        lineHeight: 1.15,
        textAlign: 'right',
        whiteSpace: 'nowrap',
      }}>
        {value}
        {valueUnit ? (
          <span
            data-testid={testId ? `${testId}-unit` : undefined}
            style={{
              marginLeft: 3,
              color: UI_TOKENS.color.text.secondary,
              fontSize: UI_TOKENS.type.size.tiny,
              fontWeight: UI_TOKENS.type.weight.strong,
            }}
          >
            {valueUnit}
          </span>
        ) : null}
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

/**
 * Which "?" definitions this column's fields point at. Serving and comparison
 * columns show the same *kinds* of numbers but mean different things, so they
 * get different catalog entries — and every `helpId` must be unique across the
 * whole app (it becomes a `data-testid` and drives the single-open popover
 * store), hence the per-column suffixes.
 */
export interface DuelColumnHelpKeys {
  readonly identityHelpId: string;
  readonly identityTitleKey: string;
  readonly identityBodyKey: string;
  readonly sinrHelpId: string;
  readonly sinrTitleKey: string;
  readonly sinrBodyKey: string;
  readonly elevationHelpId: string;
  readonly rangeHelpId: string;
}

export function DuelSignalColumn({
  testId,
  identityTestId,
  title,
  friendlyTitle,
  caption,
  captionNote,
  badgeText,
  badgeTone,
  identity,
  isActive,
  glyph,
  sinrDb,
  elevationDeg,
  rangeKm,
  tone,
  helpKeys,
}: {
  testId: string;
  identityTestId: string;
  /** Canonical uppercase role token (ACTIVE SERVING / PENDING TARGET / ...). */
  title: string;
  /** Plain-language name for the same thing, shown as the primary heading. */
  friendlyTitle: string;
  caption: string;
  /**
   * Canonical/technical restatement of the caption, shown as a quiet suffix.
   * Carries the handover-mode nuance ("live SINR reference" is a reference, not
   * the deciding authority) and the role tokens that `validate:phase1a:recent-
   * ho-ui` pins ("previous source", "recent target / serving now").
   */
  captionNote?: string;
  badgeText: string;
  badgeTone: StatusBadgeTone;
  identity: string;
  isActive: boolean;
  glyph: GlyphKind | null;
  sinrDb: number | null;
  elevationDeg: number | null;
  rangeKm: number | null;
  tone: DuelSignalTone;
  helpKeys: DuelColumnHelpKeys;
}) {
  const { t, tx } = usePanelCopy();
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
        {/* Plain-language heading first; the canonical uppercase role token is
            kept directly beneath it (it is the label the scene, the event rail
            and the validators all speak), just demoted to a quiet chip. */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          minWidth: 0,
          maxWidth: '100%',
          color: toneStyle.title,
          fontSize: UI_TOKENS.type.size.body,
          fontWeight: UI_TOKENS.type.weight.heavy,
          lineHeight: 1.2,
        }}>
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{friendlyTitle}</span>
          {/* The role sentence ("the link currently providing service", …) used
              to sit on the card face. It is now part of this "?" body, so the
              column keeps only its heading, the role token, the status chip and
              the numbers. */}
          <PanelHelp
            helpId={helpKeys.identityHelpId}
            titleKey={helpKeys.identityTitleKey}
            bodyText={`${t(helpKeys.identityBodyKey)} ${caption}`}
          />
        </div>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 5,
          minWidth: 0,
          maxWidth: '100%',
        }}>
        <div style={{
          minWidth: 0,
          color: UI_TOKENS.color.text.muted,
          fontSize: UI_TOKENS.type.size.tiny,
          fontWeight: UI_TOKENS.type.weight.strong,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
        }}>
          {title}
        </div>
        <StatusBadge tone={badgeTone}>
          {badgeText}
        </StatusBadge>
        </div>
      </div>

      {/* Only the short canonical note stays visible (`previous source`,
          `recent target / serving now`, and the handover-mode nuance) — those
          are role tags, not prose, and `validate:phase1a:recent-ho-ui` reads
          them off the screen. The full sentence moved into the heading "?". */}
      {captionNote ? (
        <div style={{
          color: UI_TOKENS.color.text.faint,
          fontSize: UI_TOKENS.type.size.tiny,
          lineHeight: 1.25,
        }}>
          {captionNote}
        </div>
      ) : null}

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

      {/* The big number used to sit here unlabelled — a student had no way to
          know what it measured. Label + "?" go ABOVE it (not beside it) so the
          readout keeps its own row: `validate:vc4a:duel-card` measures that the
          34px figure still fits inside a 360px-wide column. */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        minWidth: 0,
        marginBottom: -4,
        color: toneStyle.caption,
        fontSize: UI_TOKENS.type.size.tiny,
        fontWeight: UI_TOKENS.type.weight.strong,
        lineHeight: 1.2,
      }}>
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{tx('panel.field.signalQuality')}</span>
        <PanelHelp
          helpId={helpKeys.sinrHelpId}
          titleKey={helpKeys.sinrTitleKey}
          bodyKey={helpKeys.sinrBodyKey}
          formula={(
            <>γ<sub>u,s,v</sub>(t, <SystemAngleState />) = <InlineFormulaFraction
              numerator={<><i>p</i><sub>u,s,v</sub>(t, <LinkAngle />) · H<sub>u,s,v</sub>(t) · G<sup>T</sup>(<LinkAngle />)</>}
              denominator={<>I<sub>u,s,v</sub>(t, <SystemAngleState />) + σ²</>}
              label="link power times effective channel divided by total interference plus noise"
            /></>
          )}
          meta={<>{t('common.unit.db')} · {t('formula.sinr.caption')}</>}
        />
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
          label={tx('panel.field.elevation')}
          help={(
            <PanelHelp
              helpId={helpKeys.elevationHelpId}
              titleKey="kpi.elevation.label"
              bodyKey="kpi.elevation.help"
              meta={<>{t('common.unit.deg')}</>}
            />
          )}
          value={formatElevation(isActive ? elevationDeg : null)}
        />
        <CompactSignalMetric
          label={tx('panel.field.range')}
          help={(
            <PanelHelp
              helpId={helpKeys.rangeHelpId}
              titleKey="kpi.range.label"
              bodyKey="kpi.range.help"
              meta={<>{t('common.unit.km')}</>}
            />
          )}
          value={formatSlantRange(isActive ? rangeKm : null)}
        />
      </div>
    </div>
  );
}
