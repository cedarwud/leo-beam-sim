import { UI_TOKENS } from '../../constants/uiTokens';
import type { VisualShowcaseChannelMetricKind } from '../../scene/visual-showcase-contract';
import type { GlyphKind } from '../../contracts/glyphTypes';
import { PanelHelp, usePanelCopy } from './panelHelp';
import { StatusBadge, type StatusBadgeTone } from './StatusBadge';
import { DuelDecisionColumn } from './DuelDecisionColumn';
import { DuelSignalColumn, type DuelColumnHelpKeys, type DuelSignalTone } from './DuelSignalColumn';

export type { DuelSignalTone } from './DuelSignalColumn';

/**
 * "?" wiring for the serving column. Serving and comparison use different
 * catalog entries (they answer different questions) and different `helpId`s
 * (globally unique — the id becomes a `data-testid` and keys the single-open
 * popover store, so El/Range need a per-column suffix).
 */
const SERVING_HELP_KEYS: DuelColumnHelpKeys = {
  identityHelpId: 'kpi.servingIdentity',
  identityTitleKey: 'kpi.servingIdentity.label',
  identityBodyKey: 'kpi.servingIdentity.help',
  sinrHelpId: 'kpi.servingSinr',
  sinrTitleKey: 'kpi.servingSinr.label',
  sinrBodyKey: 'kpi.servingSinr.help',
  elevationHelpId: 'kpi.elevation.serving',
  rangeHelpId: 'kpi.range.serving',
};

const COMPARISON_HELP_KEYS: DuelColumnHelpKeys = {
  identityHelpId: 'kpi.pendingTarget',
  identityTitleKey: 'kpi.pendingTarget.label',
  identityBodyKey: 'kpi.pendingTarget.help',
  sinrHelpId: 'kpi.candidateSinr',
  sinrTitleKey: 'kpi.candidateSinr.label',
  sinrBodyKey: 'kpi.candidateSinr.help',
  elevationHelpId: 'kpi.elevation.candidate',
  rangeHelpId: 'kpi.range.candidate',
};

/**
 * P1e (c) audit-list hook (PR-0.5 backfill): the channel-metric kind both
 * Serving and Comparison columns should render. Live engine =
 * `'sinr-with-interference'`; replay artifact = `'snr-no-interference'`.
 * Optional; full label-branching is reserved for the slice PRs — this prop
 * is declared so InfoPanel can thread the kind through without a downstream
 * `DuelCard` signature change.
 */
export type DuelCardChannelMetricProp = {
  channelMetricKind?: VisualShowcaseChannelMetricKind;
};

export function DuelCard({
  servingTitle,
  servingFriendlyTitle,
  servingCaption,
  servingCaptionNote,
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
  comparisonFriendlyTitle,
  comparisonCaption,
  comparisonCaptionNote,
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
  contextBadgeText = 'live context',
  contextBadgeTone = 'neutral',
  contextDetail,
  deltaLabel,
  offsetLabel,
  triggerLabel,
  triggerAriaLabel,
  handoverCount,
}: {
  servingTitle: string;
  /** Plain-language name for the serving column, shown above the role token. */
  servingFriendlyTitle: string;
  servingCaption: string;
  servingCaptionNote?: string;
  servingBadgeText: string;
  servingBadgeTone: StatusBadgeTone;
  servingIdentity: string;
  hasServingSignal: boolean;
  servingGlyph: GlyphKind | null;
  servingSinrDb: number | null;
  servingElevationDeg: number | null;
  servingRangeKm: number | null;
  servingTone: DuelSignalTone;
  comparisonTitle: string;
  /** Plain-language name for the comparison column. */
  comparisonFriendlyTitle: string;
  comparisonCaption: string;
  comparisonCaptionNote?: string;
  comparisonBadgeText: string;
  comparisonBadgeTone: StatusBadgeTone;
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
  stateTone: StatusBadgeTone;
  contextBadgeText?: string;
  contextBadgeTone?: StatusBadgeTone;
  contextDetail?: string;
  deltaLabel?: string;
  offsetLabel?: string;
  triggerLabel?: string;
  triggerAriaLabel?: string;
  handoverCount?: number;
}) {
  const { tx } = usePanelCopy();

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
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          minWidth: 0,
          color: UI_TOKENS.color.text.controlLabel,
          fontSize: UI_TOKENS.type.size.caption,
          fontWeight: UI_TOKENS.type.weight.heavy,
        }}>
          <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{tx('panel.duel.title')}</span>
          <PanelHelp
            helpId="panel.duel"
            titleText={tx('panel.duel.title')}
            bodyText={tx('panel.duel.help')}
          />
        </div>
        <StatusBadge tone={contextBadgeTone}>{contextBadgeText}</StatusBadge>
      </div>

      {/* The card's explanatory paragraph lives behind the header "?" — the
          card face itself carries only labels, values, units and status chips. */}
      {contextDetail ? (
        <div
          data-testid="info-panel-live-context-detail"
          style={{
            color: UI_TOKENS.color.text.secondary,
            fontSize: UI_TOKENS.type.size.caption,
            lineHeight: 1.35,
          }}
        >
          {contextDetail}
        </div>
      ) : null}

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
          friendlyTitle={servingFriendlyTitle}
          helpKeys={SERVING_HELP_KEYS}
          caption={servingCaption}
          captionNote={servingCaptionNote}
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
          handoverCount={handoverCount}
          deltaLabel={deltaLabel}
          offsetLabel={offsetLabel}
          triggerLabel={triggerLabel}
          triggerAriaLabel={triggerAriaLabel}
        />
        <DuelSignalColumn
          testId="info-panel-comparison-sinr-status"
          identityTestId="info-panel-comparison-beam-identity"
          title={comparisonTitle}
          friendlyTitle={comparisonFriendlyTitle}
          helpKeys={COMPARISON_HELP_KEYS}
          caption={comparisonCaption}
          captionNote={comparisonCaptionNote}
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
