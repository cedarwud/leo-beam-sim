import type { Profile } from '../profiles/types';
import type { SimState } from '../scene/types';
import type { VisualShowcaseChannelMetricKind } from '../scene/visual-showcase-contract';
import { DuelCard, type DuelSignalTone } from './info-panel/DuelCard';
import {
  formatPanelBeamIdentity,
  formatStatusLabel,
  glyphForSatId,
  resolveDuelStateLabel,
} from './info-panel/formatters';
import { FormulaTermsReadout } from './info-panel/FormulaTermsReadout';
import type { RuntimeHandoverMode } from './useModqnHandoverState';
import type { UiMode } from './uiMode';

type InfoPanelProps = SimState & {
  uiMode: UiMode;
  profile: Profile;
  handoverMode?: RuntimeHandoverMode;
  isFormulaEvidenceStale?: boolean;
  /**
   * P1e (c) audit-list hook (PR-0.5 backfill): channel-metric kind the panel
   * should render. Live engine = `'sinr-with-interference'`; replay artifact
   * = `'snr-no-interference'`. Optional; full label-branching wiring is
   * reserved for the slice PRs — this prop only exposes the contract surface.
   */
  channelMetricKind?: VisualShowcaseChannelMetricKind;
};

interface LiveStatusModeCopy {
  label: string;
  detail: string;
  duelBadge: string;
  duelDetail: string;
  servingCaption: string;
  pendingCaption: string;
  candidateCaption: string;
  deltaLabel: string;
  offsetLabel: string;
  triggerLabel: string;
  triggerAriaLabel: string;
}

function getLiveStatusModeCopy(mode: RuntimeHandoverMode): LiveStatusModeCopy {
  if (mode === 'decision-overlay-on-live-sinr') {
    return {
      label: 'MODQN replay',
      detail: 'MODQN selects serving; SINR metrics are live',
      duelBadge: 'MODQN-selected',
      duelDetail: 'Serving follows the MODQN replay override. SINR, elevation, range, trigger timing, and comparison candidates remain live SINR references.',
      servingCaption: 'MODQN-selected live link',
      pendingCaption: 'engine timing target',
      candidateCaption: 'live SINR reference',
      deltaLabel: 'Δ live SINR',
      offsetLabel: 'Gate Offset',
      triggerLabel: 'Timing Gate',
      triggerAriaLabel: 'Live handover timing-gate progress',
    };
  }
  if (mode === 'omega-heuristic') {
    return {
      label: 'ω heuristic',
      detail: 'not paper MODQN',
      duelBadge: 'heuristic live',
      duelDetail: 'Serving follows a live heuristic override. Link metrics, timing gates, and comparison candidates remain live SINR references.',
      servingCaption: 'heuristic-selected link',
      pendingCaption: 'engine timing target',
      candidateCaption: 'live SINR reference',
      deltaLabel: 'Δ live SINR',
      offsetLabel: 'Gate Offset',
      triggerLabel: 'Timing Gate',
      triggerAriaLabel: 'Live handover timing-gate progress',
    };
  }
  return {
    label: 'SINR-offset',
    detail: 'live SINR policy',
    duelBadge: 'live SINR',
    duelDetail: 'Serving and candidate status come from the live SINR-offset handover policy.',
    servingCaption: 'physical serving',
    pendingCaption: 'handover timer',
    candidateCaption: 'derived comparison',
    deltaLabel: 'Δ SINR',
    offsetLabel: 'Need Offset',
    triggerLabel: 'Trigger Time',
    triggerAriaLabel: 'Handover trigger progress',
  };
}

export function InfoPanel({
  satelliteVisualIdentityById = {},
  physicalServing,
  panelPrimary,
  panelComparison,
  uiMode,
  profile,
  handoverMode = 'sinr-offset',
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
  const modeCopy = getLiveStatusModeCopy(handoverMode);
  const servingCaption = panelPrimary.role === 'ho-source'
    ? 'previous source'
    : modeCopy.servingCaption;
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
      ? modeCopy.pendingCaption
      : panelComparison.role === 'ho-target'
        ? panelComparison.satId === physicalServing.satId ? 'recent target / serving now' : 'recent target'
        : panelComparison.role === 'candidate'
          ? modeCopy.candidateCaption
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
    ? 'recentTarget'
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

        <div
          className="leo-info-panel__profile-card"
          data-testid="live-status-handover-mode"
          data-handover-mode={handoverMode}
        >
          <div className="leo-info-panel__profile-label">HANDOVER MODE</div>
          <div className="leo-info-panel__mode-label">{modeCopy.label}</div>
          <div className="leo-info-panel__mode-detail">{modeCopy.detail}</div>
        </div>

        <div role="status" aria-live="polite" aria-label="Serving and comparison beam status">
        <DuelCard
          servingTitle={servingTitle}
          servingCaption={servingCaption}
          servingBadgeText={panelPrimary.role === 'ho-source' ? 'recent HO' : formatStatusLabel(panelPrimary.status)}
          servingBadgeTone="serving"
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
          comparisonBadgeTone="candidate"
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
          contextBadgeText={modeCopy.duelBadge}
          contextBadgeTone={handoverMode === 'sinr-offset' ? 'neutral' : 'candidate'}
          contextDetail={modeCopy.duelDetail}
          deltaLabel={modeCopy.deltaLabel}
          offsetLabel={modeCopy.offsetLabel}
          triggerLabel={modeCopy.triggerLabel}
          triggerAriaLabel={modeCopy.triggerAriaLabel}
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
