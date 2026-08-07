import type { Profile } from '../profiles/types';
import type { SimState } from '../scene/types';
import type { VisualShowcaseChannelMetricKind } from '../scene/visual-showcase-contract';
import { UI_TOKENS } from '../constants/uiTokens';
import { DuelCard, type DuelSignalTone } from './info-panel/DuelCard';
import {
  formatCellServingIdentity,
  formatPanelBeamIdentity,
  formatStatusLabel,
  glyphForSatId,
  resolveDuelStateLabel,
} from './info-panel/formatters';
import { FormulaTermsReadout } from './info-panel/FormulaTermsReadout';
import { TeachingEnergyCard, type TeachingCanonicalReadout } from './info-panel/TeachingEnergyCard';
import {
  ClassroomEnergyComparisonCard,
  type ClassroomEnergyComparisonCardProps,
} from './info-panel/ClassroomEnergyComparisonCard';
import { ExperimentRecordCard } from './info-panel/ExperimentRecordCard';
import { usePanelCopy } from './info-panel/panelHelp';
import type { TeachingEnergyReadout, ExperimentRecord, ExperimentTaskId } from '../teaching';
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
  /**
   * Teaching energy/EE read model (Wave 2 props contract). Assembled once in
   * `App.tsx` from the live SimState plus the energy tuning controls, so the
   * left controls, the scene and this readout all describe the same instant.
   *
   * `undefined` = not wired yet (the ledger section is simply absent — better
   * than an all-dash card nobody asked for). `null` = wired but this frame has
   * nothing trustworthy, which renders as dashes, never zeroes.
   */
  teachingEnergy?: TeachingEnergyReadout | null;
  canonicalReadout?: TeachingCanonicalReadout | null;
  onTeachingEnergyReset?: () => void;
  classroomEnergyComparison?: ClassroomEnergyComparisonCardProps;
  experimentRecord?: ExperimentRecord | null;
  selectedExperimentTask?: ExperimentTaskId;
  onExperimentTaskChange?: (task: ExperimentTaskId) => void;
  onCaptureExperimentRecord?: () => void;
};

const EXPERIMENT_TASK_LABELS: Record<ExperimentTaskId, string> = {
  T1: 'T1 功率鏈',
  T2: 'T2 累積能源',
  T3: 'T3 固定 B/K',
  T4: 'T4 重設與復原',
  T5: 'T5 實際資料 50/35 dBm',
  T6: 'T6 canonical EE',
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
  handoverOffsetDb,
  handoverTriggerProgressSec,
  handoverTriggerSec,
  hoCount,
  canonicalEe,
  teachingEnergy,
  canonicalReadout,
  onTeachingEnergyReset,
  classroomEnergyComparison,
  experimentRecord,
  selectedExperimentTask = 'T1',
  onExperimentTaskChange,
  onCaptureExperimentRecord,
}: InfoPanelProps) {
  const { tx } = usePanelCopy();
  const selectedExperimentTaskLabel = EXPERIMENT_TASK_LABELS[selectedExperimentTask];
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
  // Non-default handover modes carry a display-vs-truth distinction in their
  // caption ("live SINR reference" is NOT the deciding authority under the
  // overlay). That nuance rides along as a quiet caption note rather than being
  // dropped for tidiness; under the plain sinr-offset mode there is nothing
  // extra to say, so no note is emitted.
  const modeNote = (note: string): string | undefined => (
    handoverMode === 'sinr-offset' ? undefined : note
  );
  const servingCaption = panelPrimary.role === 'ho-source'
    ? tx('panel.caption.previousSource')
    : tx('panel.caption.serving');
  // 'previous source' / 'recent target …' are the canonical role captions the
  // recent-HO surfaces (and `validate:phase1a:recent-ho-ui`) speak.
  const servingCaptionNote = panelPrimary.role === 'ho-source'
    ? 'previous source'
    : modeNote(modeCopy.servingCaption);
  const comparisonTitle =
    panelComparison.role === 'pending'
      ? 'PENDING TARGET'
      : panelComparison.role === 'ho-target'
        ? 'HO TARGET'
        : panelComparison.role === 'candidate'
          ? 'BEST CANDIDATE'
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
      ? modeNote(modeCopy.pendingCaption)
      : panelComparison.role === 'ho-target'
        ? panelComparison.satId === physicalServing.satId
          ? 'recent target / serving now'
          : 'recent target'
        : panelComparison.role === 'candidate'
          ? modeNote(modeCopy.candidateCaption)
          : undefined;
  const formulaTermsVisible = showFormulaTerms && handoverMode !== 'decision-overlay-on-live-sinr';
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
          contextBadgeTone={handoverMode === 'sinr-offset' ? 'neutral' : 'candidate'}
          deltaLabel={modeCopy.deltaLabel}
          offsetLabel={modeCopy.offsetLabel}
          triggerLabel={modeCopy.triggerLabel}
          triggerAriaLabel={modeCopy.triggerAriaLabel}
          handoverCount={hoCount}
        />
        </div>
      </div>

      {/* Teaching energy breakdown — the Σ-over-time story (Σ Mbit / Σ J). */}
      {teachingEnergy === undefined ? null : (
        <TeachingEnergyCard
          readout={teachingEnergy}
          canonicalReadout={canonicalReadout ?? canonicalEe ?? null}
          onReset={onTeachingEnergyReset}
        />
      )}

      {classroomEnergyComparison && (
        <ClassroomEnergyComparisonCard {...classroomEnergyComparison} />
      )}

      {onCaptureExperimentRecord && (
        <div style={{ marginTop: '16px' }}>
          <div
            data-testid="experiment-record-task-label"
            style={{ marginBottom: '8px', color: 'var(--leo-text-secondary)', fontSize: '14px', fontWeight: 700 }}
          >
            目前實驗題目：{selectedExperimentTaskLabel}
          </div>
          <button
            onClick={onCaptureExperimentRecord}
            data-testid="capture-experiment-record"
            className="leo-button"
            aria-label={`擷取 ${selectedExperimentTaskLabel} 實驗紀錄`}
            title="按下後固定目前量測窗口，並在下方顯示可匯出的紀錄"
            style={{
              width: '100%',
              minHeight: 42,
              padding: `${UI_TOKENS.space.sm}px ${UI_TOKENS.space.md}px`,
              background: UI_TOKENS.color.surface.fieldSoft,
              color: UI_TOKENS.color.text.primary,
              border: `1px solid ${UI_TOKENS.color.border.tuningPanel}`,
              borderRadius: UI_TOKENS.radius.md,
              cursor: 'pointer',
              fontSize: UI_TOKENS.type.size.tiny,
              fontWeight: UI_TOKENS.type.weight.strong,
              textAlign: 'left',
            }}
          >
            擷取 {selectedExperimentTaskLabel} 實驗紀錄
          </button>
        </div>
      )}

      {onCaptureExperimentRecord && !experimentRecord && (
        <div
          data-testid="experiment-record-empty"
          role="status"
          style={{ marginTop: '8px', color: 'var(--leo-text-muted)', fontSize: '12px' }}
        >
          尚未擷取 {selectedExperimentTask} 實驗紀錄；完成該題量測後按「擷取實驗紀錄」。
        </div>
      )}

      {experimentRecord && (
        <ExperimentRecordCard record={experimentRecord} />
      )}

      {formulaTermsVisible && (
        <FormulaTermsReadout
          source={physicalServing}
          budget={physicalServingBudget}
          isFormulaEvidenceStale={isFormulaEvidenceStale}
          frequencyReuse={frequencyReuse}
          servingCellId={servingCellId}
        />
      )}
    </div>
  );
}
