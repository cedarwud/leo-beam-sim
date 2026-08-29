import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';

import {
  candidateLinkKeyString,
  sameCandidateLinkKey,
  type CandidateLinkKey,
  type HandoverCommitReceipt,
  type HandoverDecisionFrame,
  type HandoverPhase,
} from '../../engine/handover/candidateDecisionContract';
import {
  type CandidatePresentationPlan,
} from '../../engine/handover/candidatePresentationPlan';
import { formatCandidateDisplayKey } from '../../engine/handover/candidateDisplayKey';
import { useLocale } from '../../i18n';
import type { AcceptedHandoverPresentationSnapshot } from '../../scene/acceptedHandoverPresentationSnapshot';
import { CandidateSetPanel } from './CandidateSetPanel';
import {
  useCandidateInspectionSelection,
  type CandidateInspectionSnapshotInput,
} from './candidateInspectionSelection';

const RECEIPT_VISIBLE_MS = 8_000;

interface HandoverEvaluationPanelProps {
  readonly snapshot: AcceptedHandoverPresentationSnapshot;
}

export interface HandoverDecisionTimeDisplay {
  readonly dateTime: string;
  readonly label: string;
}

/**
 * Walker frames currently carry an absolute scenario epoch. Present that as a
 * 24-hour UTC timestamp instead of an unreadable billion-second `t` value;
 * deterministic fixtures and relative producers retain the compact `t = … s`
 * form.
 */
export function formatHandoverDecisionTime(simTimeMs: number): HandoverDecisionTimeDisplay {
  if (simTimeMs >= Date.UTC(2000, 0, 1)) {
    const iso = new Date(simTimeMs).toISOString();
    return {
      dateTime: iso,
      label: `${iso.slice(0, 19).replace('T', ' ')} UTC`,
    };
  }
  const seconds = Math.max(0, simTimeMs / 1000);
  return {
    dateTime: `PT${seconds}S`,
    label: `t = ${seconds.toFixed(1)} s`,
  };
}

const PHASE_STEPS = ['monitoring', 'eligibility', 'qualification', 'selection', 'switching'] as const;

function phaseStep(phase: HandoverPhase): (typeof PHASE_STEPS)[number] {
  switch (phase) {
    case 'initial-attach':
    case 'monitoring': return 'monitoring';
    case 'evaluating': return 'eligibility';
    case 'qualifying': return 'qualification';
    case 'selection-hold': return 'selection';
    case 'switching':
    case 'guard': return 'switching';
  }
}

function keyExists(frame: HandoverDecisionFrame, key: CandidateLinkKey | null): boolean {
  if (key === null) return false;
  if (frame.serving !== null && sameCandidateLinkKey(frame.serving, key)) return true;
  return frame.opportunities.some(opportunity => sameCandidateLinkKey(opportunity.key, key));
}

function displayKeyFor(plan: CandidatePresentationPlan, key: CandidateLinkKey | null): string {
  if (key === null) return '—';
  const displayed = plan.displayedLinks.find(link => sameCandidateLinkKey(link.key, key));
  if (displayed !== undefined) return displayed.displayKey;
  const opportunity = plan.decision.opportunities.find(candidate => sameCandidateLinkKey(candidate.key, key));
  return formatCandidateDisplayKey({
    key,
    beamIdentitySource: opportunity?.beamIdentitySource
      ?? plan.decision.opportunities[0]?.beamIdentitySource
      ?? 'physical-beam',
  });
}

function phaseTitle(phase: HandoverPhase, copy: (zh: string, en: string) => string): string {
  switch (phase) {
    case 'initial-attach': return copy('初始連線評估', 'Initial-link evaluation');
    case 'monitoring': return copy('持續監測', 'Monitoring');
    case 'evaluating': return copy('候選資格檢核', 'Candidate eligibility');
    case 'qualifying': return copy('條件持續時間', 'Qualification timing');
    case 'selection-hold': return copy('領先候選確認', 'Leader confirmation');
    case 'switching': return copy('切換邊界', 'Switch boundary');
    case 'guard': return copy('切換保護期間', 'Handover guard');
  }
}

function receiptTitle(receipt: HandoverCommitReceipt, copy: (zh: string, en: string) => string): string {
  switch (receipt.kind) {
    case 'initial-attach': return copy('初始連線完成', 'Initial link established');
    case 'intra-satellite': return copy('同衛星波束切換完成', 'Same-satellite beam switch complete');
    case 'inter-satellite': return copy('跨衛星換手完成', 'Inter-satellite handover complete');
  }
}

function decisionBasis(
  receipt: HandoverCommitReceipt,
  copy: (zh: string, en: string) => string,
): string {
  if (receipt.mode === 'ee-optimization') {
    return copy('選擇依據：預測能源效率較佳，且服務條件均成立', 'Basis: higher forecast EE with all service gates satisfied');
  }
  if (receipt.mode === 'service-continuity-protection') {
    return copy('選擇依據：維持服務連續性', 'Basis: service-continuity protection');
  }
  return copy('選擇依據：SINR 條件、偏移量與持續時間均成立', 'Basis: SINR, offset, and timing conditions were satisfied');
}

function phaseLabel(step: (typeof PHASE_STEPS)[number], copy: (zh: string, en: string) => string): string {
  switch (step) {
    case 'monitoring': return copy('監測', 'Monitor');
    case 'eligibility': return copy('資格', 'Eligible');
    case 'qualification': return copy('穩定計時', 'Qualify');
    case 'selection': return copy('選定', 'Select');
    case 'switching': return copy('切換', 'Switch');
  }
}

function modeLabel(frame: HandoverDecisionFrame, copy: (zh: string, en: string) => string): string {
  switch (frame.mode) {
    case 'sinr-offset': return copy('SINR 換手評估', 'SINR handover evaluation');
    case 'ee-optimization': return copy('預測能源效率評估', 'Forecast EE evaluation');
    case 'service-continuity-protection': return copy('服務連續性保護', 'Service-continuity protection');
  }
}

function ServingLink({ plan, copy }: {
  readonly plan: CandidatePresentationPlan;
  readonly copy: (zh: string, en: string) => string;
}) {
  const titleId = useId();
  const serving = plan.displayedLinks.find(link => link.isServing) ?? null;
  const ratedAdmission = serving?.opportunity?.sinrMeasurementContext?.powerModel === 'profile-rated-rf';
  return (
    <section className="leo-handover-serving" aria-labelledby={titleId}>
      <header>
        <h3 id={titleId}>{copy('目前服務連線', 'Current serving link')}</h3>
        <span data-active-data-link={serving === null ? 'false' : 'true'}>
          {serving === null ? copy('尚未建立', 'Not established') : copy('唯一作用中鏈路', 'Only active data link')}
        </span>
      </header>
      {serving === null ? (
        <p>{copy('正在比較可建立初始連線的候選組合', 'Comparing candidates for the initial link')}</p>
      ) : (
        <div
          className="leo-handover-serving__link"
          data-satellite-id={serving.key.satelliteId}
          data-beam-id={serving.key.beamId}
          data-pair-key={candidateLinkKeyString(serving.key)}
          data-scene-join-key={serving.sceneJoinKey}
          data-rail-join-key={serving.railJoinKey}
          style={{ '--leo-handover-link-color': serving.beamIdentity?.cssColor ?? serving.satelliteIdentity.cssColor } as CSSProperties}
        >
          <span aria-hidden="true">{serving.beamIdentity?.glyph ?? serving.satelliteIdentity.glyph}</span>
          <strong>{serving.displayKey}</strong>
          <small>
            {ratedAdmission
              ? copy('資格 SINR', 'Admission SINR')
              : 'SINR'} {serving.opportunity?.sinr.status === 'available' && serving.opportunity.sinr.value !== null
              ? `${serving.opportunity.sinr.value.toFixed(1)} dB`
              : '—'}
          </small>
        </div>
      )}
    </section>
  );
}

function countHardEligibleCandidateSatellites(decision: HandoverDecisionFrame): number {
  return new Set(decision.states
    .filter(state => (
      state.hardEligibility === 'eligible'
      && (decision.serving === null || !sameCandidateLinkKey(state.key, decision.serving))
    ))
    .map(state => state.key.satelliteId)).size;
}

function countDisplayedHardEligibleCandidates(plan: CandidatePresentationPlan): number {
  return plan.displayedLinks.filter(link => (
    link.isCandidate && link.state?.hardEligibility === 'eligible'
  )).length;
}

export function HandoverEvaluationPanel({ snapshot }: HandoverEvaluationPanelProps) {
  const decision = snapshot.decision;
  const plan = snapshot.plan;
  const { locale } = useLocale();
  const isEnglish = locale === 'en';
  const copy = (zh: string, en: string) => (isEnglish ? en : zh);
  const candidateInspectionSnapshot = useMemo<CandidateInspectionSnapshotInput>(() => ({
    episodeId: snapshot.episodeId,
    snapshotId: snapshot.snapshotId,
    validKeys: plan.scientificCandidateKeys,
  }), [plan.scientificCandidateKeys, snapshot.episodeId, snapshot.snapshotId]);
  const { pinnedKey, setPinnedKey, togglePinnedKey } = useCandidateInspectionSelection(
    decision.episodeId,
    candidateInspectionSnapshot,
  );
  const [receipt, setReceipt] = useState<HandoverCommitReceipt | null>(snapshot.commit);
  const receiptEpisodeId = useRef(decision.episodeId);

  useEffect(() => {
    if (pinnedKey !== null && !keyExists(decision, pinnedKey)) setPinnedKey(null);
  }, [decision, pinnedKey]);

  useEffect(() => {
    if (receiptEpisodeId.current !== decision.episodeId) {
      receiptEpisodeId.current = decision.episodeId;
      setReceipt(null);
    }
    if (snapshot.commit !== null) {
      setReceipt(snapshot.commit);
      return;
    }
    setReceipt(current => (
      current !== null
      && snapshot.simTimeMs >= current.simTimeMs
      && snapshot.serving !== null
      && sameCandidateLinkKey(snapshot.serving.key, current.to)
        ? current
        : null
    ));
  }, [decision.episodeId, snapshot.commit, snapshot.serving, snapshot.simTimeMs]);

  useEffect(() => {
    if (receipt === null) return undefined;
    const timer = window.setTimeout(() => setReceipt(null), RECEIPT_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [receipt]);

  const currentStep = phaseStep(decision.phase);
  const currentStepIndex = PHASE_STEPS.indexOf(currentStep);
  const togglePin = (key: CandidateLinkKey) => togglePinnedKey(key);
  const decisionTime = formatHandoverDecisionTime(decision.simTimeMs);
  const ratedAdmission = decision.opportunities.some(opportunity => (
    opportunity.sinrMeasurementContext?.purpose === 'sinr-offset-admission'
    && opportunity.sinrMeasurementContext.powerModel === 'profile-rated-rf'
  ));
  const hardEligibleSatelliteCount = countHardEligibleCandidateSatellites(decision);
  const displayedHardEligibleCount = countDisplayedHardEligibleCandidates(plan);
  const overflowHardEligibleCount = Math.max(0, snapshot.counts.hardEligible - displayedHardEligibleCount);

  return (
    <section
      className="leo-handover-evaluation"
      data-testid="handover-evaluation-panel"
      data-decision-phase={decision.phase}
      data-decision-mode={decision.mode}
      data-accepted-snapshot-id={snapshot.snapshotId}
      data-policy-config-hash={snapshot.policyConfigHash}
      data-active-data-link-count={snapshot.activeDataLinkCount}
      data-scientific-candidate-count={plan.scientificCandidatePairCount}
      data-hard-eligible-candidate-count={snapshot.counts.hardEligible}
      data-hard-eligible-satellite-count={hardEligibleSatelliteCount}
      data-displayed-hard-eligible-candidate-count={displayedHardEligibleCount}
      data-overflow-hard-eligible-candidate-count={overflowHardEligibleCount}
      data-trigger-satisfied-candidate-count={snapshot.counts.triggerSatisfied}
      data-ttt-stable-candidate-count={snapshot.counts.tttStable}
      data-displayed-candidate-count={snapshot.counts.displayed}
      data-overflow-candidate-count={snapshot.counts.overflow}
      data-satellite-identity-colors={JSON.stringify(Object.fromEntries(
        [...plan.groups]
          .sort((left, right) => left.satelliteId.localeCompare(right.satelliteId))
          .map(group => [group.satelliteId, group.satelliteIdentity.cssColor]),
      ))}
      data-source-frame-id={snapshot.sourceFrameId}
      aria-label={copy('多候選換手評估', 'Multi-candidate handover evaluation')}
    >
      <header className="leo-handover-evaluation__header">
        <div aria-live="polite" aria-atomic="true">
          <p>{modeLabel(decision, copy)}</p>
          <h2>{phaseTitle(decision.phase, copy)}</h2>
          <small className="leo-handover-evaluation__source">
            {decision.opportunities.some(opportunity => opportunity.beamIdentitySource === 'walker-cell-surrogate')
              ? ratedAdmission
                ? copy('資料來源：模擬星座同時刻額定功率量測', 'Source: same-frame simulated-constellation rated-power measurements')
                : copy('資料來源：模擬星座同時刻量測', 'Source: same-frame simulated-constellation measurements')
              : copy('資料來源：同幀候選量測', 'Source: same-frame candidate measurements')}
          </small>
        </div>
        <time dateTime={decisionTime.dateTime}>
          {decisionTime.label}
        </time>
      </header>

      <ol className="leo-handover-phase-strip" aria-label={copy('換手評估進度', 'Handover evaluation progress')}>
        {PHASE_STEPS.map((step, index) => (
          <li
            key={step}
            data-state={index < currentStepIndex ? 'complete' : index === currentStepIndex ? 'current' : 'upcoming'}
            aria-current={index === currentStepIndex ? 'step' : undefined}
          >
            <span>{index + 1}</span>
            {phaseLabel(step, copy)}
          </li>
        ))}
      </ol>

      <section className="leo-handover-counts" aria-label={copy('候選篩選狀態', 'Candidate filtering status')}>
        <header>
          <strong>{copy('候選篩選狀態', 'Candidate filtering status')}</strong>
          <small>
            {copy('目前判斷基準：', 'Current decision basis: ')}
            {snapshot.activeTriggerObjective === 'sinr-offset'
              ? copy('SINR 相容條件', 'SINR compatibility')
              : snapshot.activeTriggerObjective === 'initial-attach-compatibility'
                ? copy('初始連線相容條件', 'Initial-link compatibility')
                : copy('服務連續性條件', 'Service-continuity compatibility')}
            {copy(
              ` · 合格 ${snapshot.counts.hardEligible}（${hardEligibleSatelliteCount} 星）· 顯示 ${displayedHardEligibleCount} / ${snapshot.counts.hardEligible}`,
              ` · eligible ${snapshot.counts.hardEligible} (${hardEligibleSatelliteCount} sats) · shown ${displayedHardEligibleCount} / ${snapshot.counts.hardEligible}`,
            )}
          </small>
        </header>
        <dl>
          <div><dt>{copy('已觀測', 'Observed')}</dt><dd>{snapshot.counts.observed}</dd></div>
          <div>
            <dt>{copy('服務資格通過', 'Hard eligible')}</dt>
            <dd>{snapshot.counts.hardEligible}</dd>
          </div>
          <div><dt>{copy('觸發條件成立', 'Trigger satisfied')}</dt><dd>{snapshot.counts.triggerSatisfied}</dd></div>
          <div><dt>{copy('TTT 已完成', 'TTT stable')}</dt><dd>{snapshot.counts.tttStable}</dd></div>
          <div><dt>{copy('畫面顯示', 'Displayed')}</dt><dd>{snapshot.counts.displayed}</dd></div>
        </dl>
      </section>

      <ServingLink plan={plan} copy={copy} />

      {receipt !== null && (
        <aside
          className="leo-handover-receipt"
          role="status"
          aria-live="polite"
          data-from-satellite-id={receipt.from?.satelliteId}
          data-from-beam-id={receipt.from?.beamId}
          data-to-satellite-id={receipt.to.satelliteId}
          data-to-beam-id={receipt.to.beamId}
        >
          <strong>{receiptTitle(receipt, copy)}</strong>
          <span>
            {displayKeyFor(plan, receipt.from)}
            {' → '}
            {displayKeyFor(plan, receipt.to)}
          </span>
          <p>{decisionBasis(receipt, copy)}</p>
        </aside>
      )}

      {(decision.provisionalLeader !== null || decision.selectedTarget !== null) && (
        <section
          className="leo-handover-selection"
          aria-label={copy('候選選定狀態', 'Candidate selection state')}
          data-satellite-id={(decision.selectedTarget ?? decision.provisionalLeader)?.satelliteId}
          data-beam-id={(decision.selectedTarget ?? decision.provisionalLeader)?.beamId}
        >
          <div>
            <small>{decision.selectedTarget !== null ? copy('已選定', 'Selected') : copy('暫列第一', 'Provisional leader')}</small>
            <strong>{displayKeyFor(plan, decision.selectedTarget ?? decision.provisionalLeader)}</strong>
          </div>
          <span>
            {copy('選定保持', 'Selection hold')} {Math.min(decision.selectionHoldSec, decision.selectionHoldRequiredSec).toFixed(1)} / {decision.selectionHoldRequiredSec.toFixed(1)} s
          </span>
        </section>
      )}

      <CandidateSetPanel plan={plan} pinnedKey={plan.pinnedKey} onTogglePin={togglePin} copy={copy} />

      <footer className="leo-handover-evaluation__footnote">
        <span>
          {ratedAdmission
            ? copy('目前依額定功率 RF 資格量測、SINR 偏移量與持續時間評估；預測能源效率尚未啟用。', 'Current evaluation uses rated-power RF admission, SINR offset, and timing; forecast EE is not active.')
            : decision.mode === 'sinr-offset'
              ? copy('目前依 SINR、偏移量與持續時間評估；預測能源效率尚未啟用。', 'Current evaluation uses SINR, offset, and timing; forecast EE is not active.')
            : copy('所有候選均以相同預測時域與服務條件比較。', 'All candidates are compared over the same forecast horizon and service gates.')}
        </span>
        {decision.opportunities.some(opportunity => opportunity.beamIdentitySource === 'walker-cell-surrogate') && (
          <span>
            {copy('B 與 C 編號用來對應模擬波束及其地面服務 Cell，並非實體衛星波束識別碼。', 'B and C identify a simulated beam and its ground-service cell, not a physical satellite beam ID.')}
          </span>
        )}
      </footer>
    </section>
  );
}
