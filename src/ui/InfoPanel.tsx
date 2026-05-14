import { UI_TOKENS } from '../constants/uiTokens';
import type { Profile } from '../profiles/types';
import type { SimState } from '../scene/types';
import { DuelCard, type DuelSignalTone } from './info-panel/DuelCard';
import {
  formatPanelBeamIdentity,
  formatStatusLabel,
  glyphForSatId,
  resolveDuelStateLabel,
} from './info-panel/formatters';
import { FormulaTermsReadout } from './info-panel/FormulaTermsReadout';
import type { UiMode } from './uiMode';

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
  comparisonSatId,
  comparisonBeamId,
  comparisonElevationDeg,
  comparisonRangeKm,
  comparisonSinrDb,
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
