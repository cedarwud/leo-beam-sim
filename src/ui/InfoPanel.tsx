import type { CSSProperties, ReactNode } from 'react';
import { BEAM_ROLE_TOKENS } from '../constants/beamRoleTokens';
import { MIN_VISIBLE_SINR_DB } from '../constants/sinr';
import { UI_TOKENS } from '../constants/uiTokens';
import type { Profile } from '../profiles/types';
import type { SimState } from '../scene/types';
import { formatBeamIdentity } from '../utils/formatSatelliteLabel';
import { glyphSymbolForKind, type GlyphKind } from '../viz/glyphs';
import type { UiMode } from './uiMode';

function sinrColor(sinrDb: number): string {
  if (sinrDb >= 20) return UI_TOKENS.color.signalQuality.great;
  if (sinrDb >= 10) return UI_TOKENS.color.signalQuality.good;
  if (sinrDb >= 5) return UI_TOKENS.color.signalQuality.warning;
  return UI_TOKENS.color.signalQuality.poor;
}

function deltaColor(deltaDb: number | null, offsetDb: number): string {
  if (deltaDb === null) return UI_TOKENS.color.semantic.inactive;
  if (deltaDb >= offsetDb) return UI_TOKENS.color.semantic.good;
  if (deltaDb >= 0) return UI_TOKENS.color.semantic.warning.accent;
  return UI_TOKENS.color.semantic.danger;
}

function formatSinr(sinrDb: number | null): string {
  if (sinrDb === null || !Number.isFinite(sinrDb) || sinrDb <= MIN_VISIBLE_SINR_DB) return '—';
  return `${sinrDb.toFixed(1)} dB`;
}

function formatElevation(elevationDeg: number | null): string {
  if (elevationDeg === null || !Number.isFinite(elevationDeg)) return '—';
  return `${elevationDeg.toFixed(1)}°`;
}

function formatSlantRange(rangeKm: number | null): string {
  if (rangeKm === null || !Number.isFinite(rangeKm)) return '—';
  return `${rangeKm.toFixed(0)} km`;
}

function formatDb(value: number): string {
  return `${value.toFixed(1)} dB`;
}

function formatDbm(value: number): string {
  return `${value.toFixed(1)} dBm`;
}

function formatDbi(value: number): string {
  return `${value.toFixed(1)} dBi`;
}

function formatStatusLabel(status: SimState['panelPrimary']['status']): string {
  switch (status) {
    case 'live':
      return 'live';
    case 'latched':
      return 'latched';
    case 'recent-ho':
      return 'recent HO';
    case 'derived':
      return 'derived';
    case 'none':
      return 'none';
  }
}

function formatPanelBeamIdentity(
  satId: string | null,
  beamId: number | null,
  frequencyReuse: number,
  emptyLabel: string,
): string {
  if (!satId || beamId === null) return emptyLabel;
  return formatBeamIdentity({ satId, beamId, frequencyReuse });
}

function glyphForSatId(
  satId: string | null,
  satelliteVisualIdentityById: SimState['satelliteVisualIdentityById'],
): GlyphKind | null {
  if (!satId) return null;
  return satelliteVisualIdentityById[satId]?.satelliteGlyph ?? null;
}

function InlineSatelliteGlyph({ glyph }: { glyph: GlyphKind }) {
  return (
    <span
      data-testid="info-panel-satellite-glyph"
      data-satellite-glyph={glyph}
      aria-hidden="true"
      style={{
        display: 'inline-block',
        marginRight: 5,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontFeatureSettings: '"liga" 0',
        textRendering: 'geometricPrecision',
        lineHeight: 1,
      }}
    >
      {glyphSymbolForKind(glyph)}
    </span>
  );
}

function PanelBeamIdentity({
  identity,
  glyph,
}: {
  identity: string;
  glyph: GlyphKind | null;
}) {
  return (
    <>
      {glyph && <InlineSatelliteGlyph glyph={glyph} />}
      <span>{identity}</span>
    </>
  );
}

function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: string;
  tone?: 'serving' | 'candidate' | 'warning' | 'neutral';
}) {
  const color = tone === 'serving'
    ? UI_TOKENS.color.semantic.serving.badge
    : tone === 'candidate'
      ? UI_TOKENS.color.semantic.candidate.badge
      : tone === 'warning'
        ? UI_TOKENS.color.semantic.warning.badge
        : UI_TOKENS.color.text.secondary;
  const border = tone === 'serving'
    ? UI_TOKENS.color.semantic.serving.badgeBorder
    : tone === 'candidate'
      ? UI_TOKENS.color.semantic.candidate.badgeBorder
      : tone === 'warning'
        ? UI_TOKENS.color.semantic.warning.badgeBorder
        : UI_TOKENS.color.border.soft;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 7px',
      borderRadius: UI_TOKENS.radius.pill,
      border: `1px solid ${border}`,
      color,
      background: tone === 'serving'
        ? 'rgba(65, 199, 255, 0.16)'
        : tone === 'candidate'
          ? 'rgba(255, 190, 69, 0.16)'
          : tone === 'warning'
            ? 'rgba(255, 125, 104, 0.14)'
            : UI_TOKENS.color.surface.card,
      fontSize: UI_TOKENS.type.size.tiny,
      fontWeight: UI_TOKENS.type.weight.heavy,
      lineHeight: 1.2,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function DebugRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(92px, 0.8fr) minmax(0, 1.2fr)',
      gap: 10,
      minWidth: 0,
    }}>
      <div style={{ color: UI_TOKENS.color.text.faint }}>{label}</div>
      <div style={{ color: UI_TOKENS.color.text.secondary, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}

function MetricTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={{
      padding: '8px 10px',
      borderRadius: UI_TOKENS.radius.md,
      background: UI_TOKENS.color.surface.card,
      border: `1px solid ${UI_TOKENS.color.border.metric}`,
    }}>
      <div style={{ fontSize: UI_TOKENS.type.size.tiny, color: UI_TOKENS.color.text.secondary, letterSpacing: 0.4, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: UI_TOKENS.type.size.body, fontWeight: UI_TOKENS.type.weight.strong, color: UI_TOKENS.color.text.primary }}>
        {value}
      </div>
    </div>
  );
}

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

type DuelSignalTone = 'serving' | 'pending' | 'recentSource' | 'neutral';

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
      title: '#d8ecfb',
      caption: 'rgba(218,236,248,0.76)',
      background: 'linear-gradient(180deg, rgba(80, 118, 148, 0.38), rgba(36, 56, 78, 0.3))',
      border: 'rgba(131, 168, 199, 0.48)',
      glow: 'inset 0 0 24px rgba(131, 168, 199, 0.13), 0 0 18px rgba(131, 168, 199, 0.1)',
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

function DuelSignalColumn({
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
  badgeTone: 'serving' | 'candidate' | 'warning' | 'neutral';
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

function formatDeltaDb(deltaDb: number | null): string {
  if (deltaDb === null) return '—';
  return `${deltaDb >= 0 ? '+' : ''}${deltaDb.toFixed(1)} dB`;
}

function resolveDuelStateLabel(input: {
  comparisonRole: SimState['panelComparison']['role'];
  triggerProgressSec: number;
}): { label: string; tone: 'serving' | 'candidate' | 'warning' | 'neutral' } {
  if (input.comparisonRole === 'pending' || input.triggerProgressSec > 0) {
    return { label: 'pending', tone: 'candidate' };
  }
  if (input.comparisonRole === 'ho-target') {
    return { label: 'recent HO', tone: 'warning' };
  }
  if (input.comparisonRole === 'candidate') {
    return { label: 'candidate', tone: 'candidate' };
  }
  return { label: 'idle', tone: 'neutral' };
}

function DuelDecisionColumn({
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
  stateTone: 'serving' | 'candidate' | 'warning' | 'neutral';
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

function DuelCard({
  servingTitle,
  servingCaption,
  servingBadgeText,
  servingBadgeTone,
  servingIdentity,
  hasServingSignal,
  servingGlyph,
  servingSinrDb,
  servingElevationDeg,
  servingRangeKm,
  servingTone,
  comparisonTitle,
  comparisonCaption,
  comparisonBadgeText,
  comparisonBadgeTone,
  comparisonIdentity,
  hasComparisonSignal,
  comparisonGlyph,
  comparisonSinrDb,
  comparisonElevationDeg,
  comparisonRangeKm,
  comparisonTone,
  sinrDeltaDb,
  handoverOffsetDb,
  handoverTriggerProgressSec,
  handoverTriggerSec,
  triggerRatio,
  stateLabel,
  stateTone,
}: {
  servingTitle: string;
  servingCaption: string;
  servingBadgeText: string;
  servingBadgeTone: 'serving' | 'candidate' | 'warning' | 'neutral';
  servingIdentity: string;
  hasServingSignal: boolean;
  servingGlyph: GlyphKind | null;
  servingSinrDb: number | null;
  servingElevationDeg: number | null;
  servingRangeKm: number | null;
  servingTone: DuelSignalTone;
  comparisonTitle: string;
  comparisonCaption: string;
  comparisonBadgeText: string;
  comparisonBadgeTone: 'serving' | 'candidate' | 'warning' | 'neutral';
  comparisonIdentity: string;
  hasComparisonSignal: boolean;
  comparisonGlyph: GlyphKind | null;
  comparisonSinrDb: number | null;
  comparisonElevationDeg: number | null;
  comparisonRangeKm: number | null;
  comparisonTone: DuelSignalTone;
  sinrDeltaDb: number | null;
  handoverOffsetDb: number;
  handoverTriggerProgressSec: number;
  handoverTriggerSec: number;
  triggerRatio: number;
  stateLabel: string;
  stateTone: 'serving' | 'candidate' | 'warning' | 'neutral';
}) {
  return (
    <section
      data-testid="info-panel-duel-card"
      className="leo-duel-card"
      data-layout-policy="compact-two-column-standard-container-query"
      style={{
        display: 'grid',
        gap: 10,
        padding: '12px',
        borderRadius: UI_TOKENS.radius.lg,
        background: UI_TOKENS.color.surface.cardSubtle,
        border: `1px solid ${UI_TOKENS.color.border.subtle}`,
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 10,
        alignItems: 'center',
      }}>
        <div style={{
          color: UI_TOKENS.color.text.controlLabel,
          fontSize: UI_TOKENS.type.size.caption,
          fontWeight: UI_TOKENS.type.weight.heavy,
          textTransform: 'uppercase',
        }}>
          Beam duel
        </div>
        <StatusBadge tone="neutral">live context</StatusBadge>
      </div>

      <div
        data-testid="info-panel-duel-body"
        className="leo-duel-card-body"
        style={{
          display: 'grid',
          gap: 10,
          alignItems: 'stretch',
          overflowWrap: 'normal',
        }}
      >
        <DuelSignalColumn
          testId="info-panel-primary-sinr-status"
          identityTestId="info-panel-primary-beam-identity"
          title={servingTitle}
          caption={servingCaption}
          badgeText={servingBadgeText}
          badgeTone={servingBadgeTone}
          identity={servingIdentity}
          isActive={hasServingSignal}
          glyph={servingGlyph}
          sinrDb={servingSinrDb}
          elevationDeg={servingElevationDeg}
          rangeKm={servingRangeKm}
          tone={servingTone}
        />
        <DuelDecisionColumn
          sinrDeltaDb={sinrDeltaDb}
          handoverOffsetDb={handoverOffsetDb}
          triggerProgressSec={handoverTriggerProgressSec}
          triggerSec={handoverTriggerSec}
          triggerRatio={triggerRatio}
          stateLabel={stateLabel}
          stateTone={stateTone}
        />
        <DuelSignalColumn
          testId="info-panel-comparison-sinr-status"
          identityTestId="info-panel-comparison-beam-identity"
          title={comparisonTitle}
          caption={comparisonCaption}
          badgeText={comparisonBadgeText}
          badgeTone={comparisonBadgeTone}
          identity={comparisonIdentity}
          isActive={hasComparisonSignal}
          glyph={comparisonGlyph}
          sinrDb={comparisonSinrDb}
          elevationDeg={comparisonElevationDeg}
          rangeKm={comparisonRangeKm}
          tone={comparisonTone}
        />
      </div>
    </section>
  );
}

type FormulaEvidenceStatus = 'current' | 'stale' | 'waiting';
type FormulaTermUnit = 'dBm' | 'dB' | 'dBi';

const srOnlyStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

function formatFormulaSourceProvenance(status: SimState['physicalServing']['status']): string {
  switch (status) {
    case 'live':
      return 'physical serving source';
    case 'latched':
      return 'latched physical serving source';
    case 'recent-ho':
      return 'recent-HO physical serving source';
    case 'derived':
      return 'derived physical serving source';
    case 'none':
      return 'no physical serving source';
  }
}

function formatFormulaTermValue(value: number | null, unit: FormulaTermUnit): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (unit === 'dBi') return formatDbi(value);
  if (unit === 'dB') return formatDb(value);
  return formatDbm(value);
}

function FormulaTermTile({
  dataTerm,
  status,
  symbol,
  label,
  hiddenLabel,
  value,
  unit = 'dBm',
  tone = 'default',
}: {
  dataTerm: string;
  status: FormulaEvidenceStatus;
  symbol: ReactNode;
  label: string;
  hiddenLabel?: string;
  value: number | null;
  unit?: FormulaTermUnit;
  tone?: 'default' | 'fixed' | 'signal' | 'loss' | 'interference' | 'noise';
}) {
  const formattedValue = formatFormulaTermValue(value, unit);
  const valueLabel = status === 'current'
    ? formattedValue ?? '—'
    : status === 'stale'
      ? formattedValue ? `${formattedValue} stale` : 'stale waiting'
      : 'waiting';

  const accent = tone === 'fixed'
    ? UI_TOKENS.color.semantic.fixed
    : tone === 'loss'
      ? '#58bff0'
      : tone === 'interference'
        ? '#ff8a6b'
        : tone === 'noise'
          ? UI_TOKENS.color.semantic.info
          : UI_TOKENS.color.semantic.tuning;
  const background = tone === 'fixed'
    ? 'rgba(247, 217, 123, 0.1)'
    : tone === 'loss'
      ? 'rgba(88, 191, 240, 0.09)'
      : tone === 'interference'
        ? 'rgba(255, 138, 107, 0.1)'
        : tone === 'noise'
          ? 'rgba(123, 167, 255, 0.1)'
          : 'rgba(118, 234, 215, 0.1)';

  return (
    <div
      data-term={dataTerm}
      data-formula-evidence-status={status}
      style={{
        display: 'grid',
        gap: 4,
        minWidth: 0,
        padding: '9px 10px',
        borderRadius: UI_TOKENS.radius.md,
        background,
        border: `1px solid ${accent}24`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
        <span style={{
          fontFamily: UI_TOKENS.type.family.math,
          fontSize: UI_TOKENS.type.size.body,
          color: accent,
          fontWeight: UI_TOKENS.type.weight.heavy,
          whiteSpace: 'nowrap',
        }}>
          {symbol}
        </span>
        <span style={{
          minWidth: 0,
          color: UI_TOKENS.color.text.muted,
          fontSize: UI_TOKENS.type.size.tiny,
          lineHeight: 1.2,
          textTransform: 'uppercase',
          overflowWrap: 'anywhere',
        }}>
          {label}
          {hiddenLabel && hiddenLabel !== label && <span style={srOnlyStyle}> {hiddenLabel}</span>}
        </span>
      </div>
      <div style={{
        color: status === 'current'
          ? accent
          : UI_TOKENS.color.text.faint,
        fontSize: UI_TOKENS.type.size.body,
        fontWeight: UI_TOKENS.type.weight.heavy,
        lineHeight: 1.2,
      }}>
        {valueLabel}
      </div>
    </div>
  );
}

function FormulaTermsReadout({
  source,
  budget,
  isFormulaEvidenceStale,
  frequencyReuse,
}: {
  source: SimState['physicalServing'];
  budget: SimState['physicalServingBudget'];
  isFormulaEvidenceStale: boolean;
  frequencyReuse: number;
}) {
  const hasFormulaSource = source.satId !== null && source.beamId !== null;
  const formulaEvidenceStatus: FormulaEvidenceStatus = isFormulaEvidenceStale
    ? 'stale'
    : budget !== null && hasFormulaSource
      ? 'current'
      : 'waiting';
  const formulaResultLabel = formulaEvidenceStatus === 'waiting'
    ? 'waiting'
    : source.sinrDb !== null && Number.isFinite(source.sinrDb)
      ? `${formatSinr(source.sinrDb)}${formulaEvidenceStatus === 'stale' ? ' stale' : ''}`
      : formulaEvidenceStatus;
  const sourceLabel = hasFormulaSource
    ? formatPanelBeamIdentity(source.satId, source.beamId, frequencyReuse, 'No physical serving source yet')
    : 'No physical serving source yet';
  const statusLabel = formulaEvidenceStatus === 'current'
    ? source.status
    : formulaEvidenceStatus;
  const evidenceCopy = formulaEvidenceStatus === 'current' && source.status === 'live'
    ? 'Live values from computeLinkBudget.'
    : formulaEvidenceStatus === 'current'
      ? 'Last-known values for the latched source.'
      : formulaEvidenceStatus === 'stale'
        ? 'Edited. Waiting for the next recomputed frame.'
        : 'Waiting for a physical serving source.';
  const legacyEvidenceCopy = formulaEvidenceStatus === 'current' && source.status === 'live'
    ? 'Current computeLinkBudget term values for the physical serving formula source.'
    : formulaEvidenceStatus === 'current'
      ? 'Last-known computeLinkBudget term values for the latched physical serving formula source.'
      : formulaEvidenceStatus === 'stale'
        ? 'Formula evidence is stale after a runtime edit; last-known values are labeled stale.'
        : 'Waiting for a physical serving formula source; placeholders keep the term grid stable.';

  const TermGroup = ({
    title,
    tone,
    children,
  }: {
    title: string;
    tone: string;
    children: ReactNode;
  }) => (
    <section style={{
      display: 'grid',
      gap: 7,
      padding: '9px',
      borderRadius: UI_TOKENS.radius.lg,
      background: UI_TOKENS.color.surface.cardFaint,
      border: `1px solid ${tone}24`,
    }}>
      <div style={{
        color: tone,
        fontSize: UI_TOKENS.type.size.caption,
        fontWeight: UI_TOKENS.type.weight.heavy,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
      }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7 }}>
        {children}
      </div>
    </section>
  );

  return (
    <div
      data-testid="formula-verification-card"
      data-formula-evidence-status={formulaEvidenceStatus}
      style={{
        marginTop: 12,
        display: 'grid',
        gap: 10,
        padding: '13px 14px',
        borderRadius: UI_TOKENS.radius.lg,
        background: 'linear-gradient(180deg, rgba(8, 38, 44, 0.82), rgba(5, 15, 24, 0.72))',
        border: '1px solid rgba(118, 234, 215, 0.2)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            color: UI_TOKENS.color.semantic.tuningSoft,
            fontSize: UI_TOKENS.type.size.caption,
            fontWeight: UI_TOKENS.type.weight.heavy,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}>
            SINR Formula Terms
          </div>
          <div style={{
            marginTop: 5,
            color: UI_TOKENS.color.text.primary,
            fontSize: UI_TOKENS.type.size.body,
            lineHeight: 1.35,
          }}>
            {sourceLabel}
          </div>
          <div style={{
            marginTop: 4,
            color: UI_TOKENS.color.text.secondary,
            fontSize: UI_TOKENS.type.size.caption,
            lineHeight: 1.35,
          }}>
            {formulaEvidenceStatus === 'stale'
              ? 'stale after edit; waiting for next recomputed frame'
              : formatFormulaSourceProvenance(source.status)}
          </div>
        </div>
        <div
          data-testid="formula-result-readout"
          data-ownership="formula-verification"
          data-visual-weight="secondary"
          style={{
            display: 'grid',
            gap: 3,
            justifyItems: 'end',
            minWidth: 96,
            padding: '7px 9px',
            borderRadius: UI_TOKENS.radius.md,
            background: UI_TOKENS.color.surface.card,
            border: '1px solid rgba(118, 234, 215, 0.22)',
          }}
        >
          <div style={{
            color: UI_TOKENS.color.text.muted,
            fontSize: UI_TOKENS.type.size.tiny,
            fontWeight: UI_TOKENS.type.weight.heavy,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>
            γ result
          </div>
          <div style={{
            color: formulaEvidenceStatus === 'current' ? sinrColor(source.sinrDb ?? -Infinity) : UI_TOKENS.color.text.faint,
            fontSize: UI_TOKENS.type.size.bodyLg,
            fontWeight: UI_TOKENS.type.weight.heavy,
            whiteSpace: 'nowrap',
          }}>
            {formulaResultLabel}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        <StatusBadge tone={formulaEvidenceStatus === 'current' ? 'serving' : 'warning'}>
          {statusLabel}
        </StatusBadge>
        <StatusBadge tone="neutral">
          computeLinkBudget
        </StatusBadge>
      </div>

      <div
        data-testid="formula-term-evidence"
        data-ownership="formula-verification"
        data-visual-weight="primary"
        data-formula-evidence-status={formulaEvidenceStatus}
        style={{
          display: 'grid',
          gap: 9,
        }}
      >
        <div style={{
          color: UI_TOKENS.color.text.muted,
          fontSize: UI_TOKENS.type.size.caption,
          lineHeight: 1.4,
        }}>
          {evidenceCopy}
          <span style={srOnlyStyle}>{legacyEvidenceCopy}</span>
        </div>
        <div
          data-testid="formula-term-grid"
          data-formula-evidence-status={formulaEvidenceStatus}
          style={{ display: 'grid', gap: 9 }}
        >
          <TermGroup title="Signal path" tone={UI_TOKENS.color.semantic.tuning}>
            <FormulaTermTile
              dataTerm="signalDbm"
              status={formulaEvidenceStatus}
              symbol={<>S</>}
              label="Signal total"
              hiddenLabel="numerator / signalDbm"
              value={budget?.signalDbm ?? null}
              tone="signal"
            />
            <FormulaTermTile
              dataTerm="effectiveTxPower"
              status={formulaEvidenceStatus}
              symbol={<>P<sub>t</sub></>}
              label="Tx power"
              hiddenLabel="effective transmit power"
              value={budget?.txPowerDbm ?? null}
              tone="signal"
            />
            <FormulaTermTile
              dataTerm="transmitGain"
              status={formulaEvidenceStatus}
              symbol={<>G<sup>T</sup></>}
              label="Tx gain"
              hiddenLabel="transmit gain pattern"
              value={budget?.beamGainDb ?? null}
              unit="dB"
              tone="signal"
            />
            <FormulaTermTile
              dataTerm="receiverGain"
              status={formulaEvidenceStatus}
              symbol={<>G<sup>R</sup></>}
              label="Rx gain"
              hiddenLabel="receiver gain"
              value={budget?.receiverGainDbi ?? null}
              unit="dBi"
              tone="fixed"
            />
          </TermGroup>
          <TermGroup title="Loss" tone="#58bff0">
            <FormulaTermTile
              dataTerm="pathLoss"
              status={formulaEvidenceStatus}
              symbol={<>L</>}
              label="Path loss"
              hiddenLabel="path loss"
              value={budget?.pathLossDb ?? null}
              unit="dB"
              tone="loss"
            />
            <FormulaTermTile
              dataTerm="scanLoss"
              status={formulaEvidenceStatus}
              symbol={<>L<sub>scan</sub></>}
              label="Scan loss"
              hiddenLabel="scan loss"
              value={budget?.steeringLossDb ?? null}
              unit="dB"
              tone="loss"
            />
          </TermGroup>
          <TermGroup title="Interference + noise" tone={UI_TOKENS.color.semantic.info}>
            <FormulaTermTile
              dataTerm="intraInterference"
              status={formulaEvidenceStatus}
              symbol={<>I<sup>a</sup></>}
              label="Inside sat"
              hiddenLabel="intra interference"
              value={budget?.intraInterferenceDbm ?? null}
              tone="interference"
            />
            <FormulaTermTile
              dataTerm="interInterference"
              status={formulaEvidenceStatus}
              symbol={<>I<sup>b</sup></>}
              label="Other sat"
              hiddenLabel="inter interference"
              value={budget?.interInterferenceDbm ?? null}
              tone="interference"
            />
            <FormulaTermTile
              dataTerm="noiseDbm"
              status={formulaEvidenceStatus}
              symbol={<>σ²</>}
              label="Noise floor"
              hiddenLabel="noise σ² / noiseDbm"
              value={budget?.noiseDbm ?? null}
              tone="noise"
            />
            <FormulaTermTile
              dataTerm="denominator"
              status={formulaEvidenceStatus}
              symbol={<>D</>}
              label="Denominator"
              hiddenLabel="denominator"
              value={budget?.denominatorDbm ?? null}
              tone="noise"
            />
          </TermGroup>
        </div>
      </div>
    </div>
  );
}

type InfoPanelProps = SimState & {
  uiMode: UiMode;
  profile: Profile;
  isFormulaEvidenceStale?: boolean;
};

export function InfoPanel({
  satelliteVisualIdentityById = {},
  physicalServing,
  panelPrimary,
  panelComparison,
  uiMode,
  profile,
  isFormulaEvidenceStale = false,
  profileId,
  formulaFamilyLabel,
  servingSatId,
  servingBeamId,
  servingElevationDeg,
  servingRangeKm,
  pendingTargetSatId,
  pendingTargetBeamId,
  pendingTargetSinrDb,
  comparisonSatId,
  comparisonBeamId,
  comparisonElevationDeg,
  comparisonRangeKm,
  comparisonSinrDb,
  comparisonKind,
  sinrDeltaDb,
  sinrDb,
  physicalServingBudget,
  handoverOffsetDb,
  handoverTriggerProgressSec,
  handoverTriggerSec,
}: InfoPanelProps) {
  const hasServingSignal = servingSatId !== null && servingBeamId !== null;
  const hasComparisonSignal = comparisonSatId !== null && comparisonBeamId !== null;
  const triggerRatio = handoverTriggerSec > 0
    ? Math.min(handoverTriggerProgressSec / handoverTriggerSec, 1)
    : 0;
  const servingTitle = panelPrimary.role === 'ho-source' ? 'HO SOURCE' : 'ACTIVE SERVING';
  const servingCaption = panelPrimary.role === 'ho-source'
    ? 'previous source'
    : 'physical serving';
  const comparisonTitle =
    panelComparison.role === 'pending'
      ? 'PENDING TARGET'
      : panelComparison.role === 'ho-target'
        ? 'HO TARGET'
        : panelComparison.role === 'candidate'
          ? 'BEST CANDIDATE'
          : 'COMPARISON';
  const comparisonCaption =
    panelComparison.role === 'pending'
      ? 'handover timer'
      : panelComparison.role === 'ho-target'
        ? panelComparison.satId === physicalServing.satId ? 'recent target / serving now' : 'recent target'
        : panelComparison.role === 'candidate'
          ? 'derived comparison'
          : 'no comparison';
  const showProfileIdentity = uiMode !== 'tuning';
  const showFormulaTerms = uiMode === 'tuning' || uiMode === 'diagnostics';
  const frequencyReuse = profile.beams.frequencyReuse;
  const servingIdentity = formatPanelBeamIdentity(servingSatId, servingBeamId, frequencyReuse, 'none');
  const comparisonIdentity = formatPanelBeamIdentity(comparisonSatId, comparisonBeamId, frequencyReuse, 'none');
  const servingGlyph = hasServingSignal ? glyphForSatId(servingSatId, satelliteVisualIdentityById) : null;
  const comparisonGlyph = hasComparisonSignal ? glyphForSatId(comparisonSatId, satelliteVisualIdentityById) : null;
  const servingTone: DuelSignalTone = panelPrimary.role === 'ho-source'
    ? 'recentSource'
    : hasServingSignal
      ? 'serving'
      : 'neutral';
  const comparisonTone: DuelSignalTone = panelComparison.role === 'ho-target'
    ? 'recentSource'
    : hasComparisonSignal
      ? 'pending'
      : 'neutral';
  const duelState = resolveDuelStateLabel({
    comparisonRole: panelComparison.role,
    triggerProgressSec: handoverTriggerProgressSec,
  });
  return (
    <div className="leo-info-panel" style={{
      background: UI_TOKENS.color.surface.panel,
      backdropFilter: 'blur(10px)',
      padding: '16px 18px',
      borderRadius: UI_TOKENS.radius.panel,
      border: `1px solid ${UI_TOKENS.color.border.panel}`,
      boxShadow: UI_TOKENS.shadow.panel,
      color: UI_TOKENS.color.text.primary,
      fontSize: UI_TOKENS.type.size.bodyLg,
      fontFamily: UI_TOKENS.type.family.mono,
      boxSizing: 'border-box',
      width: 'min(460px, calc(100vw - 24px))',
      minWidth: 0,
      overflowWrap: 'anywhere',
    }}>
      <div style={{ display: 'grid', gap: 12 }}>
        {showProfileIdentity && (profileId || formulaFamilyLabel) && (
          <div style={{
            padding: '10px 12px',
            background: UI_TOKENS.color.surface.cardSubtle,
            borderRadius: UI_TOKENS.radius.lg,
            border: `1px solid ${UI_TOKENS.color.border.subtle}`,
          }}>
            <div style={{ fontSize: UI_TOKENS.type.size.caption, color: UI_TOKENS.color.text.secondary, letterSpacing: 0.6, marginBottom: 4 }}>
              SIGNAL PROFILE
            </div>
            <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.text.primary, marginBottom: 2 }}>
              {formulaFamilyLabel ?? '—'}
            </div>
            <div style={{ fontSize: UI_TOKENS.type.size.caption, color: UI_TOKENS.color.text.secondary }}>
              {profileId ?? '—'}
            </div>
          </div>
        )}

        <DuelCard
          servingTitle={servingTitle}
          servingCaption={servingCaption}
          servingBadgeText={panelPrimary.role === 'ho-source' ? 'recent HO' : formatStatusLabel(panelPrimary.status)}
          servingBadgeTone={panelPrimary.role === 'ho-source' ? 'warning' : 'serving'}
          servingIdentity={servingIdentity}
          hasServingSignal={hasServingSignal}
          servingGlyph={servingGlyph}
          servingSinrDb={sinrDb}
          servingElevationDeg={servingElevationDeg}
          servingRangeKm={servingRangeKm}
          servingTone={servingTone}
          comparisonTitle={comparisonTitle}
          comparisonCaption={comparisonCaption}
          comparisonBadgeText={formatStatusLabel(panelComparison.status)}
          comparisonBadgeTone={panelComparison.role === 'ho-target' ? 'warning' : 'candidate'}
          comparisonIdentity={comparisonIdentity}
          hasComparisonSignal={hasComparisonSignal}
          comparisonGlyph={comparisonGlyph}
          comparisonSinrDb={comparisonSinrDb}
          comparisonElevationDeg={comparisonElevationDeg}
          comparisonRangeKm={comparisonRangeKm}
          comparisonTone={comparisonTone}
          sinrDeltaDb={sinrDeltaDb}
          handoverOffsetDb={handoverOffsetDb}
          handoverTriggerProgressSec={handoverTriggerProgressSec}
          handoverTriggerSec={handoverTriggerSec}
          triggerRatio={triggerRatio}
          stateLabel={duelState.label}
          stateTone={duelState.tone}
        />
      </div>

      {showFormulaTerms && (
        <FormulaTermsReadout
          source={physicalServing}
          budget={physicalServingBudget}
          isFormulaEvidenceStale={isFormulaEvidenceStale}
          frequencyReuse={frequencyReuse}
        />
      )}

    </div>
  );
}
