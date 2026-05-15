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
    <div className="leo-info-panel">
      <div className="leo-info-panel__grid">
        {showProfileIdentity && (profileId || formulaFamilyLabel) && (
          <div className="leo-info-panel__profile-card">
            <div className="leo-info-panel__profile-label">SIGNAL PROFILE</div>
            <div className="leo-info-panel__profile-family">{formulaFamilyLabel ?? '—'}</div>
            <div className="leo-info-panel__profile-id">{profileId ?? '—'}</div>
          </div>
        )}

        <div role="status" aria-live="polite" aria-label="Serving and comparison beam status">
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
