import type { Profile } from '../profiles/types';
import type { SimState } from '../scene/types';
import type { VisualShowcaseChannelMetricKind } from '../scene/visual-showcase-contract';
import { DuelCard, type DuelSignalTone } from './info-panel/DuelCard';
import {
  formatCellServingIdentity,
  formatPanelBeamIdentity,
  formatStatusLabel,
  glyphForSatId,
  resolveDuelStateLabel,
} from './info-panel/formatters';
import { FormulaTermsReadout } from './info-panel/FormulaTermsReadout';
import { usePanelCopy } from './info-panel/panelHelp';
import { HandoverEvaluationPanel } from './handover-evaluation/HandoverEvaluationPanel';
import { useLocale } from '../i18n';
import { ProvenanceBadge } from './common/ProvenanceBadge';

type InfoPanelProps = SimState & {
  /**
   * When true, render the SINR formula-term breakdown (driven by the live
   * diagnostics toggle that replaced the removed diagnostics UI-mode). Still
   * suppressed under decision-overlay-on-live-sinr where the offset is not the
   * authority. Defaults false = the clean showcase look.
   */
  showFormulaTerms?: boolean;
  profile: Profile;
  handoverMode?: 'sinr-offset';
  isFormulaEvidenceStale?: boolean;
  /** Cell identity of a display-only same-satellite comparison beam. */
  comparisonCellId?: number | null;
  /**
   * P1e (c) audit-list hook (PR-0.5 backfill): channel-metric kind the panel
   * should render. Live engine = `'sinr-with-interference'`; replay artifact
   * = `'snr-no-interference'`. Optional; full label-branching wiring is
   * reserved for the slice PRs — this prop only exposes the contract surface.
  */
  channelMetricKind?: VisualShowcaseChannelMetricKind;
  /** Source boundary for the physical values in this panel. */
  sourceProvenance?: 'synthetic-walker' | 'archived-tle' | 'artifact-replay';
  /** Nested under WalkerResultsRail when that parent owns the source badge. */
  showProvenanceBadge?: boolean;
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

// The status copy is exported so callers and focused checks share one canonical
// description of the live SINR handover protocol.
export function getLiveStatusModeCopy(_mode?: 'sinr-offset'): LiveStatusModeCopy {
  return {
    label: 'SINR Experiment Mode',
    detail: 'Traditional live SINR-offset handover protocol',
    duelBadge: 'Live SINR Protocol',
    duelDetail: 'Serving link and handover decisions are fully driven by the traditional live SINR-offset protocol.',
    servingCaption: 'live serving link',
    pendingCaption: 'handover timer',
    candidateCaption: 'best option link',
    deltaLabel: 'signal delta Δ SINR',
    offsetLabel: 'hysteresis margin threshold',
    triggerLabel: 'time-to-trigger timer',
    triggerAriaLabel: 'handover timer progress bar',
  };
}

export function InfoPanel({
  satelliteVisualIdentityById = {},
  physicalServing,
  panelPrimary,
  panelComparison,
  showFormulaTerms = false,
  profile,
  handoverMode = 'sinr-offset',
  isFormulaEvidenceStale = false,
  servingSatId,
  servingBeamId,
  servingCellId,
  servingElevationDeg,
  servingRangeKm,
  comparisonCellId = null,
  comparisonSatId,
  comparisonBeamId,
  comparisonElevationDeg,
  comparisonRangeKm,
  comparisonSinrDb,
  sinrDeltaDb,
  sinrDb,
  physicalServingBudget,
  angleAwareFormulaFrame,
  acceptedHandoverPresentation = null,
  handoverOffsetDb,
  handoverTriggerProgressSec,
  handoverTriggerSec,
  hoCount,
  sourceProvenance = 'synthetic-walker',
  showProvenanceBadge = true,
}: InfoPanelProps) {
  const { tx } = usePanelCopy();
  const { locale } = useLocale();
  const isEnglish = locale === 'en';
  // S5-2b: on the sinr-live cell lane the serving unit is the typed cell id
  // (`servingBeamId` is null under the cell model — there is no steered beam), so
  // the serving column must render ACTIVE on a cell id too, else the cell-truth
  // serving sat would blank despite the cones beaming it.
  const hasServingSignal = servingSatId !== null && (servingBeamId !== null || servingCellId !== null);
  // Cell lane: the contender is a cell id (comparisonBeamId is null), so mirror the
  // serving :131 fallback — accept a comparison whose serving cell id is set (W7). On the
  // steered lane comparisonBeamId is non-null so this is unchanged there.
  const hasComparisonSignal = comparisonSatId !== null && (comparisonBeamId !== null || servingCellId !== null);
  const triggerRatio = handoverTriggerSec > 0
    ? Math.min(handoverTriggerProgressSec / handoverTriggerSec, 1)
    : 0;
  const servingTitle = panelPrimary.role === 'ho-source' ? 'HO SOURCE' : 'ACTIVE SERVING';
  const modeCopy = getLiveStatusModeCopy(handoverMode);
  // Plain-language column names. The uppercase role tokens above stay on
  // screen (scene, event rail and validators all speak them); these are what a
  // student reads first.
  const servingFriendlyTitle = panelPrimary.role === 'ho-source'
    ? tx('panel.role.hoSource')
    : tx('panel.role.activeServing');
  const servingCaption = panelPrimary.role === 'ho-source'
    ? tx('panel.caption.previousSource')
    : tx('panel.caption.serving');
  // 'previous source' / 'recent target …' are the canonical role captions the
  // recent-HO surfaces (and `validate:phase1a:recent-ho-ui`) speak.
  const servingCaptionNote = panelPrimary.role === 'ho-source'
    ? 'previous source'
    : undefined;
  const comparisonTitle =
    panelComparison.role === 'pending'
      ? 'PENDING TARGET'
        : panelComparison.role === 'ho-target'
        ? 'HO TARGET'
        : panelComparison.role === 'candidate'
          ? 'BEST OPTION'
          : 'COMPARISON';
  const comparisonFriendlyTitle =
    panelComparison.role === 'pending'
      ? tx('panel.role.pendingTarget')
      : panelComparison.role === 'ho-target'
        ? tx('panel.role.hoTarget')
        : panelComparison.role === 'candidate'
          ? tx('panel.role.bestCandidate')
          : tx('panel.role.comparison');
  const comparisonCaption =
    panelComparison.role === 'pending'
      ? tx('panel.caption.pending')
      : panelComparison.role === 'ho-target'
        ? panelComparison.satId === physicalServing.satId
          ? tx('panel.caption.recentTargetServing')
          : tx('panel.caption.recentTarget')
        : panelComparison.role === 'candidate'
          ? tx('panel.caption.candidate')
          : tx('panel.caption.none');
  const comparisonCaptionNote =
    panelComparison.role === 'pending'
      ? undefined
      : panelComparison.role === 'ho-target'
        ? panelComparison.satId === physicalServing.satId
          ? 'recent target / serving now'
          : 'recent target'
        : panelComparison.role === 'candidate'
          ? undefined
          : undefined;
  const formulaTermsVisible = showFormulaTerms;
  const frequencyReuse = profile.beams.frequencyReuse;
  // Cell lane (servingBeamId null, servingCellId set): the serving unit is the
  // earth-fixed cell. Use formatCellServingIdentity — its frequency token is the
  // 0-indexed `cellFrequencyIndex` the cone render uses, NOT the 1-indexed steered
  // beam formula in formatPanelBeamIdentity (do NOT collapse these back together,
  // or the label F-index drifts off the cone colour for every cell ≠ 0 mod reuse).
  const servingIdentity = servingBeamId === null && servingCellId !== null
    ? formatCellServingIdentity(servingSatId, servingCellId, frequencyReuse, 'none')
    : formatPanelBeamIdentity(servingSatId, servingBeamId, frequencyReuse, 'none');
  // Cell lane (W7): the contender serves the SAME cell as serving (runner-up sat), so
  // format it as a cell identity via servingCellId — mirrors the serving branch above so
  // its F-token tracks the cone colour. Steered lane (comparisonBeamId set) is unchanged.
  const comparisonIdentity = comparisonBeamId === null && comparisonSatId !== null && (comparisonCellId ?? servingCellId) !== null
    ? formatCellServingIdentity(comparisonSatId, comparisonCellId ?? servingCellId, frequencyReuse, 'none')
    : formatPanelBeamIdentity(comparisonSatId, comparisonBeamId, frequencyReuse, 'none');
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
    <div className="leo-info-panel" data-provenance-source={sourceProvenance}>
      {showProvenanceBadge && (
        <div
          data-testid="info-panel-source"
          style={{ display: 'grid', gap: 5, justifyItems: 'start', marginBottom: 8 }}
        >
          <ProvenanceBadge source={sourceProvenance} testId="info-panel-source-badge">
            {sourceProvenance === 'synthetic-walker'
              ? (isEnglish ? 'SOURCE · SYNTHETIC WALKER COMPUTATION' : '來源 · 合成 Walker 計算值')
              : sourceProvenance === 'archived-tle'
                ? (isEnglish ? 'SOURCE · ARCHIVED TLE / SGP4' : '來源 · 封存 TLE / SGP4')
                : (isEnglish ? 'SOURCE · ARTIFACT REPLAY' : '來源 · Artifact replay')}
          </ProvenanceBadge>
        </div>
      )}
      <div className="leo-info-panel__grid">
        {/* SIGNAL PROFILE + HANDOVER MODE cards removed (older-tuning right-sidebar
            restore): the right sidebar leads straight with the BEAM DUEL. Profile +
            formula family stay visible in the LEFT tuning panel. */}
        {acceptedHandoverPresentation !== null ? (
          <HandoverEvaluationPanel snapshot={acceptedHandoverPresentation} />
        ) : (
          <div role="status" aria-live="polite" aria-label="Serving and comparison beam status">
          <DuelCard
          hideHeaderTitle
          servingTitle={servingTitle}
          servingFriendlyTitle={servingFriendlyTitle}
          servingCaption={servingCaption}
          servingCaptionNote={servingCaptionNote}
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
          comparisonFriendlyTitle={comparisonFriendlyTitle}
          comparisonCaption={comparisonCaption}
          comparisonCaptionNote={comparisonCaptionNote}
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
          contextBadgeTone="neutral"
          deltaLabel={modeCopy.deltaLabel}
          offsetLabel={modeCopy.offsetLabel}
          triggerLabel={modeCopy.triggerLabel}
          triggerAriaLabel={modeCopy.triggerAriaLabel}
          handoverCount={hoCount}
          />
          </div>
        )}
      </div>

      {formulaTermsVisible && (
        <FormulaTermsReadout
          source={physicalServing}
          budget={physicalServingBudget}
          isFormulaEvidenceStale={isFormulaEvidenceStale}
          frequencyReuse={frequencyReuse}
          servingCellId={servingCellId}
          formulaFrame={angleAwareFormulaFrame}
        />
      )}
    </div>
  );
}
