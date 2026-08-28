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
  buildCandidatePresentationPlan,
  type CandidatePresentationPlan,
} from '../../engine/handover/candidatePresentationPlan';
import type { HandoverVisualIdentityAllocation } from '../../constants/handoverVisualIdentity';
import { useLocale } from '../../i18n';
import { CandidateSetPanel } from './CandidateSetPanel';

const RECEIPT_VISIBLE_MS = 8_000;

interface HandoverEvaluationPanelProps {
  readonly decision: HandoverDecisionFrame;
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

function formatLink(
  key: CandidateLinkKey | null,
  frame: HandoverDecisionFrame,
  copy: (zh: string, en: string) => string,
): string {
  if (key === null) return '—';
  const opportunity = frame.opportunities.find(candidate => sameCandidateLinkKey(candidate.key, key));
  const walkerSurrogate = opportunity?.beamIdentitySource === 'walker-cell-surrogate'
    || (opportunity === undefined
      && frame.opportunities.some(candidate => candidate.beamIdentitySource === 'walker-cell-surrogate'));
  const beam = walkerSurrogate
    ? copy(`Walker 模型波束 B${key.beamId}`, `Walker beam surrogate B${key.beamId}`)
    : copy(`波束 B${key.beamId}`, `Beam B${key.beamId}`);
  return `${key.satelliteId} / ${beam}`;
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
          style={{ '--leo-handover-link-color': serving.beamIdentity?.cssColor ?? serving.satelliteIdentity.cssColor } as CSSProperties}
        >
          <span aria-hidden="true">{serving.beamIdentity?.glyph ?? serving.satelliteIdentity.glyph}</span>
          <strong>{formatLink(serving.key, plan.decision, copy)}</strong>
          <small>
            SINR {serving.opportunity?.sinr.status === 'available' && serving.opportunity.sinr.value !== null
              ? `${serving.opportunity.sinr.value.toFixed(1)} dB`
              : '—'}
          </small>
        </div>
      )}
    </section>
  );
}

export function HandoverEvaluationPanel({ decision }: HandoverEvaluationPanelProps) {
  const { locale } = useLocale();
  const isEnglish = locale === 'en';
  const copy = (zh: string, en: string) => (isEnglish ? en : zh);
  const [pinnedKey, setPinnedKey] = useState<CandidateLinkKey | null>(null);
  const [receipt, setReceipt] = useState<HandoverCommitReceipt | null>(decision.recentCommit);
  const previousIdentityAllocation = useRef<HandoverVisualIdentityAllocation | null>(null);
  const receiptEpisodeId = useRef(decision.episodeId);

  const effectivePin = keyExists(decision, pinnedKey) ? pinnedKey : null;
  const plan = useMemo(() => buildCandidatePresentationPlan(decision, undefined, {
    pinnedKey: effectivePin,
    previousIdentityAllocation: previousIdentityAllocation.current,
  }), [decision, effectivePin]);

  useEffect(() => {
    previousIdentityAllocation.current = plan.identityAllocation;
  }, [plan.identityAllocation]);

  useEffect(() => {
    if (pinnedKey !== null && !keyExists(decision, pinnedKey)) setPinnedKey(null);
  }, [decision, pinnedKey]);

  useEffect(() => {
    if (receiptEpisodeId.current !== decision.episodeId) {
      receiptEpisodeId.current = decision.episodeId;
      setReceipt(null);
    }
    if (decision.recentCommit !== null) setReceipt(decision.recentCommit);
  }, [decision.episodeId, decision.recentCommit]);

  useEffect(() => {
    if (receipt === null) return undefined;
    const timer = window.setTimeout(() => setReceipt(null), RECEIPT_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [receipt]);

  const currentStep = phaseStep(decision.phase);
  const currentStepIndex = PHASE_STEPS.indexOf(currentStep);
  const togglePin = (key: CandidateLinkKey) => {
    setPinnedKey(previous => previous !== null && candidateLinkKeyString(previous) === candidateLinkKeyString(key)
      ? null
      : key);
  };

  return (
    <section
      className="leo-handover-evaluation"
      data-testid="handover-evaluation-panel"
      data-decision-phase={decision.phase}
      data-decision-mode={decision.mode}
      data-active-data-link-count={plan.activeDataLinkCount}
      data-scientific-candidate-count={plan.scientificCandidatePairCount}
      data-source-frame-id={decision.sourceFrameId}
      aria-label={copy('多候選換手評估', 'Multi-candidate handover evaluation')}
    >
      <header className="leo-handover-evaluation__header">
        <div aria-live="polite" aria-atomic="true">
          <p>{modeLabel(decision, copy)}</p>
          <h2>{phaseTitle(decision.phase, copy)}</h2>
          <small className="leo-handover-evaluation__source">
            {decision.opportunities.some(opportunity => opportunity.beamIdentitySource === 'walker-cell-surrogate')
              ? copy('資料來源：Walker 模型同幀量測', 'Source: same-frame Walker model measurements')
              : copy('資料來源：同幀候選量測', 'Source: same-frame candidate measurements')}
          </small>
        </div>
        <time dateTime={`PT${Math.max(0, decision.simTimeMs / 1000)}S`}>
          t = {(decision.simTimeMs / 1000).toFixed(1)} s
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

      <ServingLink plan={plan} copy={copy} />
      <CandidateSetPanel plan={plan} pinnedKey={effectivePin} onTogglePin={togglePin} copy={copy} />

      {(decision.provisionalLeader !== null || decision.selectedTarget !== null) && (
        <section className="leo-handover-selection" aria-label={copy('候選選定狀態', 'Candidate selection state')}>
          <div>
            <small>{decision.selectedTarget !== null ? copy('已選定', 'Selected') : copy('暫列第一', 'Provisional leader')}</small>
            <strong>{formatLink(decision.selectedTarget ?? decision.provisionalLeader, decision, copy)}</strong>
          </div>
          <span>
            {copy('選定保持', 'Selection hold')} {Math.min(decision.selectionHoldSec, decision.selectionHoldRequiredSec).toFixed(1)} / {decision.selectionHoldRequiredSec.toFixed(1)} s
          </span>
        </section>
      )}

      {receipt !== null && (
        <aside className="leo-handover-receipt" role="status" aria-live="polite">
          <strong>{receiptTitle(receipt, copy)}</strong>
          <span>{formatLink(receipt.from, decision, copy)} → {formatLink(receipt.to, decision, copy)}</span>
          <p>{decisionBasis(receipt, copy)}</p>
        </aside>
      )}

      <footer className="leo-handover-evaluation__footnote">
        <span>
          {decision.mode === 'sinr-offset'
            ? copy('目前依 SINR、門檻與時間條件評估；預測能源效率尚未啟用。', 'Current evaluation uses SINR, gates, and timing; forecast EE is not active.')
            : copy('所有候選均以相同預測時域與服務條件比較。', 'All candidates are compared over the same forecast horizon and service gates.')}
        </span>
        {decision.opportunities.some(opportunity => opportunity.beamIdentitySource === 'walker-cell-surrogate') && (
          <span>
            {copy('B 編號為 Walker 模型的地面服務單元，不是 TLE 提供的實體波束識別碼。', 'B identifies a Walker ground-service surrogate, not a physical beam ID provided by TLE.')}
          </span>
        )}
      </footer>
    </section>
  );
}
