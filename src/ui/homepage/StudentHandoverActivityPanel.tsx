import type { CSSProperties, ReactNode } from 'react';

import { useLocale } from '../../i18n';
import type { HandoverTeachingSurfaceProjection } from '../../scene/handoverTeachingSurfaceProjection';
import { handoverSurfaceIdentityAttributes } from '../../scene/handoverSurfaceBinding';
import type { InstructorHandoverTransportSnapshot } from '../../homepage/teaching/instructorHandoverTransport';
import {
  STUDENT_HANDOVER_ACTIVITY_STEPS,
  STUDENT_HANDOVER_EVIDENCE_CLAIMS,
  STUDENT_HANDOVER_EXPLANATION_CHOICES,
  STUDENT_HANDOVER_OBSERVATION_CHECKPOINTS,
  STUDENT_HANDOVER_PREDICTION_CHOICES,
  studentHandoverCheckpointAt,
  type StudentHandoverActivityStep,
  type StudentHandoverCheckpointId,
  type StudentHandoverEvidenceClaimId,
  type StudentHandoverExplanationChoice,
  type StudentHandoverPredictionChoice,
} from '../../homepage/teaching/studentHandoverActivityContract';
import type { StudentHandoverActivityEvidence } from '../../homepage/teaching/studentHandoverActivityEvidence';
import type { StudentHandoverActivityState } from '../../homepage/teaching/studentHandoverActivityState';
import { studentHandoverActivityTelemetryAttributes } from '../../homepage/teaching/studentHandoverActivityTelemetry';

const COLORS = {
  panel: '#06131b',
  soft: 'rgba(255,255,255,0.05)',
  line: 'rgba(218,244,255,0.18)',
  text: '#f1fbff',
  quiet: 'rgba(229,244,251,0.70)',
  accent: '#76ead7',
  warn: '#ffd78a',
  danger: '#ff9a9a',
} as const;

const buttonStyle: CSSProperties = {
  width: '100%',
  minHeight: 46,
  padding: '10px 12px',
  borderRadius: 8,
  border: `1px solid ${COLORS.accent}`,
  background: 'rgba(118,234,215,.12)',
  color: COLORS.text,
  font: 'inherit',
  fontSize: 16,
  fontWeight: 800,
  cursor: 'pointer',
};

function predictionLabel(choice: StudentHandoverPredictionChoice, isEnglish: boolean): string {
  const labels: Record<StudentHandoverPredictionChoice, readonly [string, string]> = {
    'stay-serving': ['留在目前 serving beam', 'Stay on the current serving beam'],
    'switch-target': ['切換到指定 candidate beam', 'Switch to the named candidate beam'],
    'insufficient-evidence': ['目前證據不足', 'There is not enough evidence yet'],
  };
  return labels[choice][isEnglish ? 1 : 0];
}

function stepLabel(
  step: StudentHandoverActivityStep,
  isEnglish: boolean,
): string {
  if (isEnglish) return step[0]!.toUpperCase() + step.slice(1);
  switch (step) {
    case 'predict': return '預測';
    case 'operate': return '操作';
    case 'observe': return '觀察';
    case 'explain': return '解釋';
    case 'complete': return '完成';
  }
}

function explanationLabel(choice: StudentHandoverExplanationChoice, isEnglish: boolean): string {
  const labels: Record<StudentHandoverExplanationChoice, readonly [string, string]> = {
    'all-four-conditions-held': [
      '服務跌破閾值、候選高於閾值且更佳，並完成 TTT，因此提交換手。',
      'Serving fell below the floor, the replacement cleared it and was better, and TTT completed.',
    ],
    'candidate-alone-was-enough': [
      '只要候選高於閾值，就必須立即換手。',
      'A replacement above the floor is enough to switch immediately.',
    ],
    'highest-elevation-forced-switch': [
      '仰角最高的波束一定強制成為服務波束。',
      'The highest-elevation beam must become serving.',
    ],
    'evidence-still-insufficient': [
      '完成所有觀察後仍無法判斷是否應換手。',
      'The completed observations still do not support a decision.',
    ],
  };
  return labels[choice][isEnglish ? 1 : 0];
}

function evidenceLabel(claim: StudentHandoverEvidenceClaimId, isEnglish: boolean): string {
  const labels: Record<StudentHandoverEvidenceClaimId, readonly [string, string]> = {
    'serving-below-floor': ['Serving 低於 floor', 'Serving is below the floor'],
    'replacement-above-floor': ['Replacement 高於 floor', 'Replacement is above the floor'],
    'replacement-beats-serving': ['Replacement 優於 serving', 'Replacement beats serving'],
    'hold-complete': ['Hold／TTT 已完成', 'Hold / TTT is complete'],
    committed: ['換手已 committed', 'The handover is committed'],
  };
  return labels[claim][isEnglish ? 1 : 0];
}

function checkpointLabel(id: StudentHandoverCheckpointId, isEnglish: boolean): string {
  const labels: Record<StudentHandoverCheckpointId, readonly [string, string]> = {
    'candidate-comparison': ['候選比較', 'Candidate comparison'],
    'conditions-and-hold': ['四項條件與 TTT', 'Four conditions and TTT'],
    'commit-receipt': ['提交狀態', 'Commit state'],
  };
  return labels[id][isEnglish ? 1 : 0];
}

function endpointLabel(
  endpoint: StudentHandoverActivityEvidence['source'],
): string {
  const satellite = endpoint.satelliteLabel ?? endpoint.satelliteId;
  const beam = endpoint.beamLabel ?? (endpoint.cellId === null ? '—' : `cell ${endpoint.cellId}`);
  return `${satellite} · ${beam}`;
}

function ChoiceCard({
  checked,
  testId,
  children,
  onChange,
}: {
  readonly checked: boolean;
  readonly testId: string;
  readonly children: ReactNode;
  readonly onChange: () => void;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 11px',
      borderRadius: 8, border: `1px solid ${checked ? COLORS.accent : COLORS.line}`,
      background: checked ? 'rgba(118,234,215,.10)' : COLORS.soft,
      cursor: 'pointer', fontSize: 15.5, lineHeight: 1.45,
    }}>
      <input
        type="radio"
        data-testid={testId}
        checked={checked}
        onChange={onChange}
        style={{ marginTop: 4, accentColor: COLORS.accent }}
      />
      <span>{children}</span>
    </label>
  );
}

function StudentEvidencePanel({
  evidence,
  isEnglish,
}: {
  readonly evidence: StudentHandoverActivityEvidence | null;
  readonly isEnglish: boolean;
}) {
  const truth = evidence?.truth ?? null;
  const conditions: readonly [StudentHandoverEvidenceClaimId, boolean][] = [
    ['serving-below-floor', truth?.servingBelowFloor ?? false],
    ['replacement-above-floor', truth?.replacementAboveFloor ?? false],
    ['replacement-beats-serving', truth?.replacementBeatsServing ?? false],
    ['hold-complete', truth?.holdComplete ?? false],
    ['committed', truth?.committed ?? false],
  ];

  return (
    <div
      data-testid="student-evidence-panel"
      data-evidence-checkpoint-id={evidence?.checkpointId ?? ''}
      data-evidence-source-time-sec={evidence === null ? '' : String(evidence.sourceTimeSec)}
      data-evidence-story-id={evidence?.storyId ?? ''}
      data-evidence-pair-key={evidence?.pairKey ?? ''}
      style={{
        display: 'grid', gap: 8, padding: 11, borderRadius: 9,
        border: `1px solid ${COLORS.line}`, background: COLORS.soft,
      }}
    >
      <strong style={{ fontSize: 13, color: COLORS.accent, letterSpacing: '.05em' }}>
        {isEnglish ? 'SHARED R5 EVIDENCE' : '共享 R5 證據'}
      </strong>
      {evidence === null ? (
        <span role="status" style={{ color: COLORS.quiet }}>
          {isEnglish ? 'Preparing the bounded checkpoint…' : '正在準備受限觀察點…'}
        </span>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 4, fontSize: 14.5 }}>
            <span><strong>{isEnglish ? 'Checkpoint' : '觀察點'}：</strong>
              {checkpointLabel(evidence.checkpointId, isEnglish)} · {evidence.sourceTimeSec}s</span>
            <span><strong>{isEnglish ? 'Source' : '來源'}：</strong>{endpointLabel(evidence.source)}</span>
            <span><strong>{isEnglish ? 'Target' : '目標'}：</strong>{endpointLabel(evidence.target)}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {evidence.source.eeKbitPerJoule.toFixed(1)} → {evidence.target.eeKbitPerJoule.toFixed(1)} Kbit/J
              {' · '}{isEnglish ? 'floor' : '閾值'} {evidence.thresholdKbitPerJoule} Kbit/J
            </span>
          </div>
          <div style={{ display: 'grid', gap: 5 }}>
            {conditions.map(([claim, ok]) => (
              <div
                key={claim}
                data-evidence-claim={claim}
                data-evidence-value={ok ? 'true' : 'false'}
                style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 15.5 }}
              >
                <span aria-hidden="true" style={{ color: ok ? COLORS.accent : COLORS.danger }}>
                  {ok ? '✓' : '✕'}
                </span>
                <span>{evidenceLabel(claim, isEnglish)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export interface StudentHandoverActivityPanelProps {
  readonly state: StudentHandoverActivityState;
  readonly evidence: StudentHandoverActivityEvidence | null;
  readonly projection: HandoverTeachingSurfaceProjection | null;
  readonly transport: InstructorHandoverTransportSnapshot | null;
  readonly onSelectPrediction: (prediction: StudentHandoverPredictionChoice) => void;
  readonly onLockPrediction: () => void;
  readonly onBeginObserve: () => void;
  readonly onRequestCheckpoint: (checkpointId: StudentHandoverCheckpointId) => void;
  readonly onFinishObserve: () => void;
  readonly onSelectExplanation: (explanation: StudentHandoverExplanationChoice) => void;
  readonly onToggleEvidenceClaim: (claim: StudentHandoverEvidenceClaimId) => void;
  readonly onSubmitExplanation: () => void;
  readonly onReset: () => void;
  readonly onExit: () => void;
}

export function StudentHandoverActivityPanel({
  state,
  evidence,
  projection,
  transport,
  onSelectPrediction,
  onLockPrediction,
  onBeginObserve,
  onRequestCheckpoint,
  onFinishObserve,
  onSelectExplanation,
  onToggleEvidenceClaim,
  onSubmitExplanation,
  onReset,
  onExit,
}: StudentHandoverActivityPanelProps) {
  const { locale } = useLocale();
  const isEnglish = locale === 'en';
  const activityTelemetryAttributes = studentHandoverActivityTelemetryAttributes(
    'activity',
    state,
    transport,
    projection?.binding ?? null,
  );
  const railTelemetryAttributes = studentHandoverActivityTelemetryAttributes(
    'rail',
    state,
    transport,
    projection?.binding ?? null,
  );
  const railStoryAttributes = handoverSurfaceIdentityAttributes(
    'rail',
    projection?.binding ?? null,
  );
  const stepIndex = STUDENT_HANDOVER_ACTIVITY_STEPS.indexOf(state.step);
  const nextCheckpoint = studentHandoverCheckpointAt(state.observations.length);
  const allObserved = state.observations.length === STUDENT_HANDOVER_OBSERVATION_CHECKPOINTS.length
    && state.pendingCheckpointId === null;
  const explanationReady = state.selectedExplanation !== null
    && state.selectedEvidenceClaims.some(claim => claim !== 'committed');
  const observedClaims = new Set(
    state.observations.flatMap(observation => observation.evidenceClaims),
  );

  return (
    <section
      data-testid="student-guided-flow-panel"
      {...railStoryAttributes}
      {...railTelemetryAttributes}
      data-student-control-boundary="safe-only"
      data-student-unsafe-controls="hidden-or-disabled"
      aria-label={isEnglish ? 'Student guided handover activity' : '學生引導式換手活動'}
      style={{
        display: 'grid', gap: 11, alignContent: 'start', minWidth: 0, minHeight: 0,
        height: '100%', overflowY: 'auto', padding: 14, borderRadius: 10,
        border: `1px solid ${COLORS.line}`, background: COLORS.panel, color: COLORS.text,
        font: '15.5px/1.55 "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif',
      }}
    >
      <div
        data-testid="student-activity-surface"
        {...activityTelemetryAttributes}
        style={{ display: 'contents' }}
      >
      <header style={{ display: 'grid', gap: 5 }}>
        <span style={{ color: COLORS.accent, fontSize: 12, fontWeight: 900, letterSpacing: '.08em' }}>
          {isEnglish ? 'R6 · STUDENT GUIDED FLOW' : 'R6 · 學生引導流程'}
        </span>
        <strong data-testid="student-activity-title" style={{ fontSize: 21 }}>
          {isEnglish ? 'Predict → Operate → Observe → Explain → Reset' : '預測 → 操作 → 觀察 → 解釋 → 重設'}
        </strong>
        <div
          data-testid="student-group-vote-prompt"
          style={{
            padding: '10px 11px', borderRadius: 8, background: 'rgba(255,215,138,.10)',
            border: '1px solid rgba(255,215,138,.45)', color: COLORS.warn,
            fontSize: 18, lineHeight: 1.55, fontWeight: 750,
          }}
        >
          {isEnglish
            ? 'Teacher-led option: ask the room to vote by hand before revealing the checkpoints.'
            : '教師帶領提示：揭露觀察點前，請全班先舉手或口頭表決。'}
        </div>
      </header>

      <div data-testid="student-activity-progress" style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {STUDENT_HANDOVER_ACTIVITY_STEPS.map((step, index) => (
          <span
            key={step}
            data-student-progress-step={step}
            data-student-progress-active={step === state.step ? 'true' : 'false'}
            style={{
              padding: '4px 8px', borderRadius: 999, fontSize: 12.5, fontWeight: 800,
              color: index <= stepIndex ? COLORS.accent : COLORS.quiet,
              border: `1px solid ${index <= stepIndex ? 'rgba(118,234,215,.5)' : COLORS.line}`,
            }}
          >
            {index + 1}. {stepLabel(step, isEnglish)}
          </span>
        ))}
      </div>

      {state.step === 'predict' && (
        <div data-testid="student-step-predict" style={{ display: 'grid', gap: 9 }}>
          <strong style={{ fontSize: 18 }}>
            {isEnglish ? 'Predict before the evidence is revealed' : '在證據揭露前先預測'}
          </strong>
          <span style={{ color: COLORS.quiet }}>
            {isEnglish
              ? 'What should happen to the current serving beam? Your answer locks when you continue.'
              : '目前 serving beam 接下來應如何處理？進入操作後答案會鎖定。'}
          </span>
          <div role="radiogroup" aria-label={isEnglish ? 'Prediction choices' : '預測選項'}
            style={{ display: 'grid', gap: 7 }}>
            {STUDENT_HANDOVER_PREDICTION_CHOICES.map(choice => (
              <ChoiceCard
                key={choice}
                checked={state.selectedPrediction === choice}
                testId={`student-prediction-${choice}`}
                onChange={() => onSelectPrediction(choice)}
              >
                {predictionLabel(choice, isEnglish)}
              </ChoiceCard>
            ))}
          </div>
          <button
            type="button"
            data-testid="student-lock-prediction"
            disabled={state.selectedPrediction === null}
            onClick={onLockPrediction}
            style={{
              ...buttonStyle,
              opacity: state.selectedPrediction === null ? 0.45 : 1,
              cursor: state.selectedPrediction === null ? 'not-allowed' : 'pointer',
            }}
          >
            {isEnglish ? 'Lock prediction and continue' : '鎖定預測並繼續'}
          </button>
          <button
            type="button"
            data-testid="student-exit-activity"
            onClick={onExit}
            style={{
              ...buttonStyle,
              borderColor: COLORS.line,
              background: 'transparent',
              color: COLORS.quiet,
            }}
          >
            {isEnglish ? 'Exit student activity' : '離開學生活動'}
          </button>
        </div>
      )}

      {state.step === 'operate' && (
        <div data-testid="student-step-operate" style={{ display: 'grid', gap: 10 }}>
          <strong style={{ fontSize: 18 }}>{isEnglish ? 'Operate one bounded action' : '執行一個受限操作'}</strong>
          <span style={{ color: COLORS.quiet }}>
            {isEnglish
              ? 'Your prediction is locked. This button only commands the R5 transport to the declared checkpoints.'
              : '預測已鎖定。此按鈕只會命令既有 R5 transport 前往已宣告的觀察點。'}
          </span>
          <div style={{ padding: 10, borderRadius: 8, border: `1px solid ${COLORS.line}` }}>
            <span style={{ color: COLORS.quiet }}>{isEnglish ? 'Locked prediction' : '已鎖定預測'}：</span>{' '}
            <strong>{predictionLabel(state.selectedPrediction!, isEnglish)}</strong>
          </div>
          <button
            type="button"
            data-testid="student-start-observation"
            onClick={onBeginObserve}
            style={buttonStyle}
          >
            {isEnglish ? 'Start comparison / run observation' : '開始比較／執行觀察'}
          </button>
        </div>
      )}

      {state.step === 'observe' && (
        <div data-testid="student-step-observe" style={{ display: 'grid', gap: 10 }}>
          <strong style={{ fontSize: 18 }}>{isEnglish ? 'Observe shared evidence' : '觀察共享證據'}</strong>
          <span style={{ color: COLORS.quiet }}>
            {isEnglish
              ? `${state.observations.length} of ${STUDENT_HANDOVER_OBSERVATION_CHECKPOINTS.length} checkpoints recorded.`
              : `已記錄 ${state.observations.length}／${STUDENT_HANDOVER_OBSERVATION_CHECKPOINTS.length} 個觀察點。`}
          </span>
          <StudentEvidencePanel
            evidence={evidence}
            isEnglish={isEnglish}
          />
          {state.pendingCheckpointId !== null ? (
            <span data-testid="student-checkpoint-pending" role="status" style={{ color: COLORS.warn }}>
              {isEnglish
                ? `Moving to ${checkpointLabel(state.pendingCheckpointId, true)}…`
                : `正在前往「${checkpointLabel(state.pendingCheckpointId, false)}」…`}
            </span>
          ) : !allObserved && nextCheckpoint !== null ? (
            <button
              type="button"
              data-testid="student-next-checkpoint"
              onClick={() => onRequestCheckpoint(nextCheckpoint.id)}
              style={buttonStyle}
            >
              {isEnglish
                ? `Observe next: ${checkpointLabel(nextCheckpoint.id, true)}`
                : `觀察下一點：${checkpointLabel(nextCheckpoint.id, false)}`}
            </button>
          ) : (
            <button
              type="button"
              data-testid="student-finish-observe"
              onClick={onFinishObserve}
              style={buttonStyle}
            >
              {isEnglish ? 'Use the evidence to explain' : '使用證據進行解釋'}
            </button>
          )}
        </div>
      )}

      {state.step === 'explain' && (
        <div data-testid="student-step-explain" style={{ display: 'grid', gap: 10 }}>
          <strong style={{ fontSize: 18 }}>{isEnglish ? 'Explain with evidence' : '使用證據解釋'}</strong>
          <StudentEvidencePanel
            evidence={evidence}
            isEnglish={isEnglish}
          />
          <span style={{ color: COLORS.quiet }}>
            {isEnglish
              ? 'Choose the explanation, then cite at least one comparable condition.'
              : '選擇解釋，並至少引用一項可比較的條件證據。'}
          </span>
          <div role="radiogroup" aria-label={isEnglish ? 'Explanation choices' : '解釋選項'}
            style={{ display: 'grid', gap: 7 }}>
            {STUDENT_HANDOVER_EXPLANATION_CHOICES.map(choice => (
              <ChoiceCard
                key={choice}
                checked={state.selectedExplanation === choice}
                testId={`student-explanation-${choice}`}
                onChange={() => onSelectExplanation(choice)}
              >
                {explanationLabel(choice, isEnglish)}
              </ChoiceCard>
            ))}
          </div>
          <div
            role="group"
            aria-label={isEnglish ? 'Evidence claims' : '證據主張'}
            style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 8, border: `1px solid ${COLORS.line}` }}
          >
            <strong>{isEnglish ? 'Evidence I used' : '我使用的證據'}</strong>
            {STUDENT_HANDOVER_EVIDENCE_CLAIMS.map(claim => {
              const observed = observedClaims.has(claim);
              const selected = state.selectedEvidenceClaims.includes(claim);
              return (
                <label key={claim} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  color: observed ? COLORS.text : COLORS.quiet,
                  opacity: observed ? 1 : 0.5,
                }}>
                  <input
                    type="checkbox"
                    data-testid={`student-evidence-choice-${claim}`}
                    checked={selected}
                    disabled={!observed}
                    onChange={() => onToggleEvidenceClaim(claim)}
                    style={{ accentColor: COLORS.accent }}
                  />
                  {evidenceLabel(claim, isEnglish)}
                </label>
              );
            })}
          </div>
          <button
            type="button"
            data-testid="student-submit-explanation"
            disabled={!explanationReady}
            onClick={onSubmitExplanation}
            style={{
              ...buttonStyle,
              opacity: explanationReady ? 1 : 0.45,
              cursor: explanationReady ? 'pointer' : 'not-allowed',
            }}
          >
            {isEnglish ? 'Complete activity with this evidence' : '以此證據完成活動'}
          </button>
        </div>
      )}

      {state.step === 'complete' && state.completionReceipt !== null && (
        <div data-testid="student-step-complete" style={{ display: 'grid', gap: 10 }}>
          <strong style={{ fontSize: 20, color: COLORS.accent }}>
            {isEnglish ? 'Activity complete' : '活動完成'}
          </strong>
          <StudentEvidencePanel
            evidence={evidence}
            isEnglish={isEnglish}
          />
          <div
            data-testid="student-completion-receipt"
            style={{
              display: 'grid', gap: 5, padding: 11, borderRadius: 8,
              border: `1px solid ${COLORS.accent}`, background: 'rgba(118,234,215,.08)',
            }}
          >
            <strong>{isEnglish ? 'Completion receipt' : '完成收據'}</strong>
            <span>{isEnglish ? 'Prediction' : '預測'}：
              {predictionLabel(state.completionReceipt.prediction, isEnglish)}</span>
            <span>{isEnglish ? 'Explanation' : '解釋'}：
              {explanationLabel(state.completionReceipt.explanation, isEnglish)}</span>
            <span>{isEnglish ? 'Evidence' : '證據'}：
              {state.completionReceipt.evidenceClaims
                .map(claim => evidenceLabel(claim, isEnglish))
                .join(isEnglish ? '; ' : '；')}</span>
            <span style={{ color: COLORS.quiet, fontSize: 12, overflowWrap: 'anywhere' }}>
              {state.completionReceipt.receiptId}
            </span>
          </div>
          <button
            type="button"
            data-testid="student-reset-activity"
            onClick={onReset}
            style={buttonStyle}
          >
            {isEnglish ? 'Reset to Predict' : '重設回 Predict'}
          </button>
        </div>
      )}
      </div>
    </section>
  );
}
