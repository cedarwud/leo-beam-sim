import { MIN_VISIBLE_SINR_DB } from '../constants/sinr';
import { computeR1EnergyEfficiency } from '../utils/energyEfficiency';
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
import type { RuntimeHandoverMode } from '../modqn/runtimeControls';
import { OVERRIDE_PRIMARY_UE_SCOPE_NOTE } from '../modqn/runtimeControls';

type InfoPanelProps = SimState & {
  /**
   * When true, render the SINR formula-term breakdown (driven by the live
   * diagnostics toggle that replaced the removed diagnostics UI-mode). Still
   * suppressed under decision-overlay-on-live-sinr where the offset is not the
   * authority. Defaults false = the clean showcase look.
   */
  showFormulaTerms?: boolean;
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

// S4-4 (Decision D3): the decision/ω override is installed on the PRIMARY UE's
// HandoverManager only, so every override-mode copy carries the primary-only
// scope note (the secondary population follows live SINR-offset). Exported so
// `validate:s4:override-primary-scope` drives the real resolver instead of a
// source-text pin. The default `sinr-offset` mode never carries the note.
export function getLiveStatusModeCopy(mode: RuntimeHandoverMode): LiveStatusModeCopy {
  if (mode === 'decision-overlay-on-live-sinr') {
    return {
      label: 'MODQN Overlay Mode',
      detail: 'Live SINR geometry/reference with MODQN replay decision overlay',
      duelBadge: 'MODQN Decision Overlay',
      duelDetail: `Viewport uses live SINR geometry and metrics as reference while the serving beam displays the MODQN replay decision overlay. ${OVERRIDE_PRIMARY_UE_SCOPE_NOTE}`,
      servingCaption: 'MODQN overlay serving link',
      pendingCaption: 'handover target',
      candidateCaption: 'live SINR reference',
      deltaLabel: 'live Δ SINR',
      offsetLabel: 'gate offset',
      triggerLabel: 'decision timing threshold',
      triggerAriaLabel: 'MODQN decision progress bar',
    };
  }
  if (mode === 'omega-heuristic') {
    return {
      label: 'ω Heuristic Decision',
      detail: 'Simplified heuristic policy based on live omega weights',
      duelBadge: 'Heuristic Live Decision',
      duelDetail: `Serving link follows the live omega weighted heuristic policy. All signal and threshold metrics are computed live. ${OVERRIDE_PRIMARY_UE_SCOPE_NOTE}`,
      servingCaption: 'heuristic serving link',
      pendingCaption: 'handover target',
      candidateCaption: 'live SINR reference',
      deltaLabel: 'live Δ SINR',
      offsetLabel: 'gate offset',
      triggerLabel: 'handover progress',
      triggerAriaLabel: 'handover progress bar',
    };
  }
  return {
    label: 'SINR Experiment Mode',
    detail: 'Traditional live SINR-offset handover protocol',
    duelBadge: 'Live SINR Protocol',
    duelDetail: 'Serving link and handover decisions are fully driven by the traditional live SINR-offset protocol.',
    servingCaption: 'live serving link',
    pendingCaption: 'handover timer',
    candidateCaption: 'best candidate link',
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
  comparisonSatId,
  comparisonBeamId,
  comparisonElevationDeg,
  comparisonRangeKm,
  comparisonSinrDb,
  sinrDeltaDb,
  sinrDb,
  physicalServingBudget,
  servingBudget,
  handoverOffsetDb,
  handoverTriggerProgressSec,
  handoverTriggerSec,
}: InfoPanelProps) {
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
  const formulaTermsVisible = showFormulaTerms && handoverMode !== 'decision-overlay-on-live-sinr';
  const frequencyReuse = profile.beams.frequencyReuse;
  // r1 EE η, rendered beside the ACTIVE SERVING SINR it is derived from. The
  // numerator MUST use the same `sinrDb` this card displays, and the denominator
  // must be that same lane's transmit power — a cross-lane pairing would repeat
  // the W1 γ-mismatch the comparison column is suppressed to avoid (the cell
  // antenna is 50°/33.5 dBi, the steered one 12°/40 dBi; the same UE reads
  // ~6-10 dB apart across them). So the power source branches on the SAME lane
  // discriminator the identity strings above use:
  //   - cell lane (`servingCellId` set): `SinrLiveCellModel.linkBudgetOptions`
  //     passes NO `beamPowerOverrideDbmByKey`, so every cell beam transmits at
  //     `channel.maxTxPowerDbm`. `validate:r1-energy-efficiency:model` pins the
  //     "no override ⇒ maxTxPowerDbm" half of that against the real link budget;
  //     the cell record itself carries no power term, so the OTHER half — that
  //     the cell lane keeps passing no override — is a read-the-source
  //     assumption. If cell-lane power control is ever added, thread the
  //     effective power onto `UeCellServingRecord` and read it here.
  //   - steered lane: `servingBudget` is resolved from the very (sat, beam) that
  //     produced the displayed SINR, and its `txPowerDbm` is the EFFECTIVE value,
  //     so beam power control moves η honestly.
  // The reference's beam-load term cancels out of this ratio — see
  // `src/utils/energyEfficiency.ts` for the derivation and the claim scope.
  const isCellLane = servingCellId !== null;
  const servingTxPowerDbm = isCellLane
    ? profile.channel.maxTxPowerDbm
    : servingBudget?.txPowerDbm ?? null;
  // Blank η on exactly the same floor `SinrReadout` blanks its dB on, so the two
  // readouts can never disagree about whether there is a signal at all (a dashed
  // SINR beside a live-looking "0.00 b/J" would read as a broken panel).
  const servingR1EnergyEfficiency = computeR1EnergyEfficiency({
    sinrDb: sinrDb > MIN_VISIBLE_SINR_DB ? sinrDb : null,
    txPowerDbm: servingTxPowerDbm,
    bandwidthMHz: profile.channel.bandwidthMHz,
    frequencyReuse,
  });
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
  const comparisonIdentity = comparisonBeamId === null && comparisonSatId !== null && servingCellId !== null
    ? formatCellServingIdentity(comparisonSatId, servingCellId, frequencyReuse, 'none')
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
    <div className="leo-info-panel">
      <div className="leo-info-panel__grid">
        {/* SIGNAL PROFILE + HANDOVER MODE cards removed (older-tuning right-sidebar
            restore): the right sidebar leads straight with the BEAM DUEL. Profile +
            formula family stay visible in the LEFT tuning panel. */}
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
          servingR1EnergyEfficiencyBitsPerJoule={servingR1EnergyEfficiency?.bitsPerJoule ?? null}
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
          deltaLabel={modeCopy.deltaLabel}
          offsetLabel={modeCopy.offsetLabel}
          triggerLabel={modeCopy.triggerLabel}
          triggerAriaLabel={modeCopy.triggerAriaLabel}
        />
        </div>
      </div>

      {formulaTermsVisible && (
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
