import { UI_TOKENS } from '../../constants/uiTokens';
import type { GlyphKind } from '../../viz/glyphs';
import { StatusBadge, type StatusBadgeTone } from './StatusBadge';
import { DuelDecisionColumn } from './DuelDecisionColumn';
import { DuelSignalColumn, type DuelSignalTone } from './DuelSignalColumn';

export type { DuelSignalTone } from './DuelSignalColumn';

export function DuelCard({
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
  servingBadgeTone: StatusBadgeTone;
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
