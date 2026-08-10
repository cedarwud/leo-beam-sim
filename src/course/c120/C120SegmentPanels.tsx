import type {
  C120AuthoritativeReplay,
  C120ConstructedResponseKey,
  C120ConstructedResponses,
  C120LabCAction,
  C120LabCSlots,
  C120ReplayInput,
  C120Scenario,
  C120SegmentId,
} from './contract';
import {
  buildC120IdeaCard,
  deriveC120LabBRuleId,
  type C120Availability,
  type C120BinaryPrediction,
  type C120ClaimDisposition,
  type C120InteractionState,
  type C120Provenance,
  type C120ValidationIssue,
} from './learningState';
import {
  C120_CONSTRUCTED_RESPONSE_DEFINITIONS,
  C120_NOVICE_GUIDES,
  C120_TEACHING_CONTENT,
  type C120LocalizedCopy,
  localizeC120TeachingText,
} from './teachingContent';
import { validateC120PinnedTleImport } from './tleImport';
import { useC120Locale, type C120Locale } from './i18n';

export { createInitialC120InteractionState } from './learningState';
export type { C120InteractionState } from './learningState';

export interface C120SegmentPanelsProps {
  readonly activeSegment: C120SegmentId;
  readonly scenario: C120Scenario;
  readonly state: C120InteractionState;
  readonly responses: C120ConstructedResponses;
  readonly activeReplay: C120AuthoritativeReplay | null;
  readonly runError: string | null;
  readonly completedSegments: readonly C120SegmentId[];
  readonly checkpointOrdinal: number;
  readonly completionIssue: C120ValidationIssue | null;
  readonly onState: (next: C120InteractionState) => void;
  readonly onResponse: (key: C120ConstructedResponseKey, value: string) => void;
  readonly onRunInput: (input: C120ReplayInput) => void;
  readonly onComplete: (segment: C120SegmentId) => void;
  readonly onCheckpoint: () => void;
  readonly onReset: () => void;
  readonly onUseFallback: () => void;
  readonly onScaffold: (eventId: string) => void;
  readonly onRecordInstructorRescue: () => void;
}

const CLAIMS = [
  { id: 'rate-is-energy', text: 'The highest rate is automatically the lowest-energy choice.' },
  { id: 'system-boundary', text: 'Power and consumed energy only make sense after we name the system boundary.' },
  { id: 'same-job', text: 'Only alternatives with the same work and deadline can be compared directly.' },
] as const;

const ACTION_LABELS: Record<C120LabCAction, string> = {
  'fixed-contact': 'Fixed contact',
  'fixed-outage': 'Fixed outage',
  'send-urgent': 'Send urgent',
  'batch-periodic': 'Batch periodic',
  'send-bulk': 'Send bulk',
  'flush-batch': 'Flush batch',
  wait: 'Wait',
  sleep: 'Sleep',
};

const ACTION_LABELS_ZH: Record<C120LabCAction, string> = {
  'fixed-contact': '固定接觸',
  'fixed-outage': '固定中斷',
  'send-urgent': '傳送緊急卡',
  'batch-periodic': '批次傳送週期卡',
  'send-bulk': '傳送大量卡',
  'flush-batch': '送出批次',
  wait: '等待',
  sleep: '睡眠',
};

function uiText(locale: C120Locale, zhHant: string, en: string): string {
  return locale === 'en' ? en : zhHant;
}

function authoredText(locale: C120Locale, value: string): string {
  return localizeC120TeachingText(value, locale);
}

function localizedCopy(locale: C120Locale, copy: C120LocalizedCopy): string {
  return locale === 'en' ? copy.en : copy.zhHant;
}

function actionLabel(locale: C120Locale, action: C120LabCAction): string {
  return locale === 'en' ? ACTION_LABELS[action] : ACTION_LABELS_ZH[action];
}

function claimText(locale: C120Locale, id: (typeof CLAIMS)[number]['id']): string {
  const claim = CLAIMS.find(item => item.id === id);
  if (!claim) return '';
  const zh: Record<(typeof CLAIMS)[number]['id'], string> = {
    'rate-is-energy': '最高速率自動就是最低能量的決策。',
    'system-boundary': '功率與消耗能量需要明確的系統邊界。',
    'same-job': '只有相同工作量、相同期限的選項才可以直接比較。',
  };
  return locale === 'en' ? claim.text : zh[id];
}

function scenarioCopy(locale: C120Locale, value: string): string {
  if (locale === 'en') return value;
  const translations: Record<string, string> = {
    'different workload and deadline': '不同工作量與期限',
    'same workload, same contact window, system W and consumed J': '相同工作量、相同接觸窗口、系統 W 與消耗 J',
    'active transfer': '主動傳送',
    'fixed + idle tail': '固定成本＋閒置尾段',
    'same payload; deadline still open': '相同 payload，期限尚未到',
    'same payload; deadline met': '相同 payload，已符合期限',
    'Trace A teaches the rule; Trace B withholds its later quality trend.': 'Trace A 讓你建立規則；Trace B 隱藏後續品質趨勢。',
    'fixed contact': '固定接觸',
    'fixed outage': '固定中斷',
    'Pace to idle': '逐步降到閒置',
    'Balanced pace': '平衡節奏',
    'Burst then sleep': '突發傳送後睡眠',
    'Finish quickly, then sleep.': '快速完成後睡眠。',
    'Keep the transfer active at a moderate rate.': '以中等速率維持傳送啟動。',
    'Use a high burst followed by an early sleep state.': '先用高突發速率，再提早進入睡眠狀態。',
    'Switch now': '現在切換',
    'Stable for two': '穩定兩步後切換',
    'Hysteresis band': '遲滯區間',
    'React to the first improvement.': '對第一次改善立即反應。',
    'Switch after two stable quality events.': '兩次穩定品質事件後再切換。',
    'Require clear separation before switching back.': '切回前需要清楚的品質差距。',
    'Action P': '動作 P',
    'Action Q': '動作 Q',
    'Apply the authored P control policy.': '套用編寫的 P 控制策略。',
    'Apply the authored Q control policy.': '套用編寫的 Q 控制策略。',
    'Quality at decision time': '決策時刻的品質',
    'Freshness at decision time': '決策時刻的新鮮度',
    'Event timestamp': '事件時間戳',
    'Future delivered bits': '未來交付位元',
    'Future service result': '未來服務結果',
    'deterministic C-120 fixture replay producer': '可重播的 C-120 教學資料產生器',
    'NTPU teaching observer': 'NTPU 教學觀測者',
    'room warming': '房間升溫',
    'room steady': '房間穩定',
    'room briefly cooler': '房間短暫變冷',
    'room drifts back': '房間逐漸回復',
    'room stable again': '房間再次穩定',
    'Wait for one more event': '再等待一個事件',
    'Remain on the current state': '保持目前狀態',
    'Low band': '低區間',
    'Steady band': '穩定區間',
    'High band': '高區間',
    'same lower threshold': '相同的較低門檻',
    'one band lower': '低一個區間',
    'two bands lower': '低兩個區間',
    'Shorter contact window': '較短的接觸窗口',
    'Surprise urgent card': '驚喜緊急卡片',
    'Smart farm': '智慧農場',
    'HVAC': '暖通空調（HVAC）',
    'Edge cache': '邊緣快取',
    'Logistics': '物流',
    'Baseline': '基準線',
    'State / data': '狀態／資料',
    'Control': '控制',
    'Power-time pathway': '功率和時間路徑',
    'Boundary / unit': '邊界／單位',
    'Service constraint': '服務限制',
    'Held-out case': '保留案例',
    'Falsifier': '反駁條件',
    'AUTO': '自動',
    'SELECT': '選擇',
  };
  return translations[value] ?? value;
}

function validationMessage(locale: C120Locale, issue: C120ValidationIssue): string {
  if (locale === 'en') return issue.message;
  const messages: Record<string, string> = {
    'claim-classification-missing': '請先判斷三個主張。',
    'mission-contract-missing': '請選一個任務契約，讓後續比較使用同一個邊界。',
    'mission-contract-incomparable': '這個選項刻意不可比較；請選固定工作、期限與系統邊界。',
    'claim-confidence-missing': '請先記錄第一次的信心程度。',
    'claim-evidence-hidden': '請先揭露兩格證據，再做一次重新判斷。',
    'claim-rejudgment-missing': '請在揭露後做一次有證據支持的重新判斷。',
    'opening-clause-missing': '請用因果連接詞和一個證據、邊界或單位完成開場句。',
    'tle-file-not-validated': '請匯入並驗證本情境指定的離線 TLE 紀錄。',
    'tle-import-incomplete': '請完成三個固定離線 TLE 匯入階段。',
    'tle-lineage-incorrect': '請重新檢查這一列屬於哪一種來源。',
    'tle-exclusions-incomplete': '請選出 TLE 不包含的每一項量。',
    'tle-confirmation-missing': '請確認這些模擬能量值從哪裡來。',
    'tle-window-decision-missing': '請選擇模型推導服務窗口內的區間。',
    'lab-a-reference-missing': '請先執行或打開參考示例。',
    'lab-a-prediction-missing': '請在回放前預測主動時間、消耗 J、服務、bit/J 與信心。',
    'lab-a-prediction-not-frozen': '請先凍結候選預測，再執行回放。',
    'lab-a-mechanism-missing': '請選擇你預期最會影響結果的機制。',
    'lab-a-candidate-missing': '請選擇一種傳送節奏。',
    'lab-a-replay-missing': '請執行目前選定的候選，建立權威證據。',
    'lab-a-ledger-missing': '請把候選回放保留在權威試驗帳本中。',
    'lab-a-verdict-missing': '請標記回放支持了你的預測，還是讓你需要修正。',
    'lab-a-clause-missing': '請用因果連接詞和一個證據、邊界或單位完成實驗 A 句子。',
    'lab-b-entry-incorrect': '請回看示範 Trace A，重新判斷下一個狀態。',
    'lab-b-prediction-missing': '請預測服務、主動時間、消耗 J、切換與信心。',
    'lab-b-prediction-not-frozen': '請先凍結 Trace B 預測，再執行規則回放。',
    'lab-b-rule-incomplete': '請完成凍結前所有可執行規則區塊。',
    'lab-b-rule-mismatch': '規則 ID 必須由畫面上的 threshold、N 和 lower-threshold 選項組成。',
    'lab-b-alternate-missing': '請查看一次允許的 Trace A 倒帶，並做替代判斷。',
    'lab-b-rule-not-frozen': '請先凍結完整規則，再打開 Trace B。',
    'lab-b-replay-missing': '請用凍結規則執行保留的 Trace B。',
    'lab-b-verdict-missing': '請針對保留追蹤判斷凍結規則。',
    'lab-b-clause-missing': '請用因果連接詞和一個證據、邊界或單位完成實驗 B 句子。',
    'checkpoint-missing': '請先儲存可恢復的檢查點。',
    'recovery-retrieval-incorrect': '請依序找出 state → time → power → J 這條因果鏈。',
    'recovery-counterexample-incorrect': '請辨認改變邊界可能反轉比較結果。',
    'recovery-clause-missing': '請用因果連接詞和一個證據、邊界或單位完成復原句子。',
    'lab-c-entry-incorrect': '請用示範卡片時間選擇合法時槽。',
    'lab-c-baseline-missing': '請先查看完成的單卡片示例與 baseline 帳本。',
    'lab-c-prediction-missing': '請預測服務、新鮮度、喚醒、主動時間、消耗 J、預算與信心。',
    'lab-c-prediction-not-frozen': '請先凍結排程預測，再進行第一次執行。',
    'lab-c-first-run-missing': '請先執行一次六時槽排程，再進行修正。',
    'lab-c-revision-not-consequential': '第一次執行後請做一次可見的排程變更。',
    'lab-c-revision-missing': '請套用一次修正並執行驚喜事件。',
    'lab-c-ledger-incomplete': '請把第一次和修正版證據都保留在試驗帳本。',
    'lab-c-clause-missing': '請用因果連接詞和一個證據、邊界或單位完成實驗 C 句子。',
    'clinic-worked-incorrect': '請用時間戳判斷示範特徵在決策時刻是否已存在。',
    'clinic-card-incorrect': '請依決策時間重新檢查這張卡。卡片名稱本身不是證據。',
    'clinic-prediction-missing': '請預測哪個動作能在回放前保護服務門檻。',
    'clinic-confidence-missing': '請在凍結診間決策前記錄信心。',
    'clinic-action-not-frozen': '請選擇並凍結一個合法動作。',
    'clinic-replay-missing': '請在時間順序回放上執行凍結動作。',
    'clinic-clause-missing': '請用因果連接詞和一個證據、邊界或單位完成診間句子。',
    'transfer-domain-missing': '請選擇一個尚未看過的 transfer 領域。',
    'transfer-retrieval-incorrect': '請提取相同工作、期限與系統邊界的比較門檻。',
    'transfer-power-energy-incorrect': '在同一服務邊界下，請把低 W 與低消耗 J 分開閱讀。',
    'transfer-dynamic-incorrect': '動態策略依決策時刻狀態改變動作，不是依動畫改變。',
    'transfer-saving-incorrect': '請把預測分數和操作節省證據分開。',
    'transfer-what-if-missing': '請在看到結果前，為 held-out 案例做一次修正。',
    'transfer-pathway-missing': '請選擇帶到新領域的狀態／時間路徑。',
    'transfer-hypothesis-missing': '請用因果連接詞和一個證據、邊界或單位完成假說。',
    'transfer-falsifier-missing': '請說明一個反事實結果，以及會反駁假說的證據或邊界。',
  };
  return messages[issue.code] ?? '請回到這一組控制，完成下一個標示的步驟。';
}

function errorText(locale: C120Locale, error: string): string {
  return locale === 'en' ? error : '這次回放未被接受。請載入一個有標示來源的合法選項，再試一次。';
}

function responseValue(responses: C120ConstructedResponses, key: C120ConstructedResponseKey): string {
  return responses[key] ?? '';
}

function ShortResponse({
  responseKey,
  label,
  responses,
  onResponse,
  issue,
}: {
  responseKey: C120ConstructedResponseKey;
  label: string;
  responses: C120ConstructedResponses;
  onResponse: C120SegmentPanelsProps['onResponse'];
  issue: C120ValidationIssue | null;
}) {
  const { locale } = useC120Locale();
  const definition = C120_CONSTRUCTED_RESPONSE_DEFINITIONS.find(item => item.key === responseKey);
  const id = `c120-response-${responseKey}`;
  const invalid = issue?.fieldId === id;
  return (
    <label className="c120-response">
      <span>{locale === 'en' ? label : definition?.zhHantLabel ?? label} / {definition?.fieldKind === 'SHORT-CLAUSE' ? uiText(locale, '短句', 'SHORT-CLAUSE') : uiText(locale, '句型', 'STEM')}</span>
      {definition && <small className="c120-response__stem">{locale === 'en' ? definition.prompt : definition.zhHantPrompt ?? definition.prompt}</small>}
      <textarea
        id={id}
        name={responseKey}
        rows={2}
        maxLength={definition?.maxLength ?? 240}
        autoComplete="off"
        required
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? 'c120-completion-error' : undefined}
        value={responseValue(responses, responseKey)}
        onChange={event => onResponse(responseKey, event.target.value)}
        placeholder={uiText(locale, '寫下一句連結證據的話…', 'One evidence-linked clause…')}
      />
      <small>{responseValue(responses, responseKey).length}/{definition?.maxLength ?? 240} / {uiText(locale, '建構式回答', 'constructed response')}</small>
      <small>{uiText(locale, '只作自動標記，不由人評分。請包含因果或反事實連接詞，以及一個證據、邊界或單位詞。', 'Auto-marker only, not human-scored. Include a causal or counterfactual connector and one evidence, boundary, or unit term.')}</small>
    </label>
  );
}

function Prediction({ value, onChange, legend, name, id, disabled = false, issue = null }: {
  value: C120BinaryPrediction;
  onChange: (value: C120BinaryPrediction) => void;
  legend: string;
  name: string;
  id: string;
  disabled?: boolean;
  issue?: C120ValidationIssue | null;
}) {
  const { locale } = useC120Locale();
  const invalid = issue?.fieldId === id || issue?.fieldId === id.replace(/-prediction-[^-]+$/, '-prediction');
  return (
    <fieldset className="c120-inline-choice" id={id} aria-invalid={invalid || undefined} aria-describedby={invalid ? 'c120-completion-error' : undefined}>
      <legend>{legend}</legend>
      {(['lower', 'higher', 'same'] as const).map(option => (
        <label key={option}>
          <input type="radio" name={name} value={option} checked={value === option} disabled={disabled} onChange={() => onChange(option)} />
          {option === 'lower' ? uiText(locale, '較低', 'lower') : option === 'higher' ? uiText(locale, '較高', 'higher') : uiText(locale, '相同', 'same')}
        </label>
      ))}
    </fieldset>
  );
}

function ConfidenceChoice({ id, name, value, disabled, onChange, issue = null }: {
  id: string;
  name: string;
  value: C120InteractionState['labAPredictionConfidence'];
  disabled: boolean;
  onChange: (value: 'low' | 'medium' | 'high') => void;
  issue?: C120ValidationIssue | null;
}) {
  const { locale } = useC120Locale();
  const invalid = issue?.fieldId === id;
  return (
    <fieldset id={id} className="c120-inline-choice" aria-invalid={invalid || undefined} aria-describedby={invalid ? 'c120-completion-error' : undefined}>
      <legend>{uiText(locale, '預測信心', 'Prediction confidence')}</legend>
      {(['low', 'medium', 'high'] as const).map(option => (
        <label key={option}><input type="radio" name={name} value={option} checked={value === option} disabled={disabled} onChange={() => onChange(option)}/>{option === 'low' ? uiText(locale, '低', 'low') : option === 'medium' ? uiText(locale, '中', 'medium') : uiText(locale, '高', 'high')}</label>
      ))}
    </fieldset>
  );
}

function ReplayResult({ replay }: { replay: C120AuthoritativeReplay | null }) {
  const { locale, formatNumber } = useC120Locale();
  if (replay === null) return <p className="c120-empty-state">{uiText(locale, '凍結決策後，執行權威回放。', 'Freeze a decision, then run its authoritative replay.')}</p>;
  const outcome = replay.outcome;
  return (
    <section className="c120-result" aria-live="polite" data-replay-id={replay.replayId}>
      <div>
        <span>{uiText(locale, '權威回放', 'AUTHORITATIVE REPLAY')}</span>
        <strong>{scenarioCopy(locale, replay.mechanismLabel)}</strong>
        <small>{scenarioCopy(locale, replay.conditionLabel)}</small>
      </div>
      <dl>
        <div><dt>{uiText(locale, '服務', 'service')}</dt><dd>{outcome.servicePass ? 'PASS' : 'FAIL'}</dd></div>
        <div><dt>{uiText(locale, '系統功率', 'system power')}</dt><dd>{formatNumber(outcome.systemPowerW)} W</dd></div>
        <div><dt>{uiText(locale, '消耗能量', 'consumed')}</dt><dd>{formatNumber(outcome.consumedEnergyJ)} J</dd></div>
        <div><dt>{uiText(locale, '已交付', 'delivered')}</dt><dd>{formatNumber(outcome.deliveredBits)} bit</dd></div>
        <div><dt>{uiText(locale, '能量效率', 'EE')}</dt><dd>{formatNumber(outcome.energyEfficiencyBitsPerJ)} bit/J</dd></div>
      </dl>
    </section>
  );
}

function NoviceScaffold({ segment, locale }: { segment: C120SegmentId; locale: C120Locale }) {
  const guide = C120_NOVICE_GUIDES[segment];
  return (
    <section className="c120-novice-scaffold" aria-label={uiText(locale, '這一段怎麼進行', 'How this segment works')} data-segment={segment}>
      <p className="c120-novice-scaffold__question"><strong>{uiText(locale, '先想想', 'Start with this question')}</strong>: {localizedCopy(locale, guide.question)}</p>
      <div className="c120-novice-scaffold__grid">
        <article><h3>{uiText(locale, '這一段要做什麼', 'What to do')}</h3><p>{localizedCopy(locale, guide.whatToDo)}</p></article>
        <article><h3>{uiText(locale, '觀察什麼', 'What to watch')}</h3><p>{localizedCopy(locale, guide.whatToNotice)}</p></article>
        <details className="c120-novice-scaffold__more">
          <summary>{uiText(locale, '為什麼重要，或需要下一步？', 'Why it matters or how to continue')}</summary>
          <article><h3>{uiText(locale, '為什麼重要', 'Why it matters')}</h3><p>{localizedCopy(locale, guide.whyItMatters)}</p></article>
          <article><h3>{uiText(locale, '卡住時怎麼繼續', 'If you get stuck')}</h3><p>{localizedCopy(locale, guide.recovery)}</p></article>
        </details>
      </div>
    </section>
  );
}

function SegmentComplete({ complete, segment, onComplete, issue }: {
  complete: boolean;
  segment: C120SegmentId;
  onComplete: (segment: C120SegmentId) => void;
  issue: C120ValidationIssue | null;
}) {
  const { locale } = useC120Locale();
  return (
    <div className="c120-completion-gate">
      {issue && (
        <p id="c120-completion-error" className="c120-alert" role="alert">
          <strong>{uiText(locale, '下一步', 'Next step')}</strong>: {validationMessage(locale, issue)}
        </p>
      )}
      <button className="c120-primary" type="button" disabled={complete} aria-describedby={issue ? 'c120-completion-error' : undefined} onClick={() => onComplete(segment)}>
        {complete ? uiText(locale, '證據已鎖定', 'Evidence locked') : uiText(locale, '檢查證據並繼續', 'Check evidence & continue')}
      </button>
    </div>
  );
}

export function C120SegmentPanels(props: C120SegmentPanelsProps) {
  const {
    activeSegment,
    scenario,
    state,
    responses,
    activeReplay,
    runError,
    completedSegments,
    checkpointOrdinal,
    completionIssue,
    onState,
    onResponse,
    onRunInput,
    onComplete,
    onCheckpoint,
    onReset,
    onUseFallback,
    onScaffold,
    onRecordInstructorRescue,
  } = props;
  const { locale, formatNumber } = useC120Locale();
  const teach = (value: string) => authoredText(locale, value);
  const alreadyComplete = completedSegments.includes(activeSegment);

  if (activeSegment === 'claim-detective') {
    const mission = scenario.missionContracts.find(option => option.id === state.missionContractId);
    const worked = C120_TEACHING_CONTENT.claimDetective;
    return (
      <section id="c120-learning-workbench" className="c120-workbench" aria-labelledby="c120-segment-title" tabIndex={-1}>
        <div className="c120-section-heading"><span>{uiText(locale, '00-10 / 主張判斷', '00-10 / CLAIM CHECK')}</span><h2 id="c120-segment-title" tabIndex={-1}>{uiText(locale, '這些證據能支持什麼結論？', 'What conclusion can this evidence support?')}</h2><p>{teach(worked.question)}</p></div>
        <NoviceScaffold segment="claim-detective" locale={locale} />
        <details className="c120-worked-example">
          <summary>{teach(worked.workedTrace.title)}</summary>
          <p>{teach(worked.workedTrace.note)}</p>
          <div className="c120-table-scroll" tabIndex={0} aria-label={uiText(locale, '可水平捲動的兩時槽示範追蹤', 'Scrollable two-slot worked trace')}>
            <table><caption>{uiText(locale, '兩時槽的教學追蹤；數值是明確的模擬輸入。', 'Two-slot teaching trace. Values are explicit simulated inputs.')}</caption><thead><tr><th scope="col">{uiText(locale, '時槽', 'slot')}</th><th scope="col">{uiText(locale, '狀態', 'state')}</th><th scope="col">W</th><th scope="col">{uiText(locale, '累積 J', 'cumulative J')}</th><th scope="col">{uiText(locale, '交付 bit', 'delivered bit')}</th><th scope="col">{uiText(locale, '服務／邊界', 'service / boundary')}</th></tr></thead><tbody>{worked.workedTrace.slots.map(slot => <tr key={slot.id}><th scope="row">{slot.timeLabel}</th><td>{scenarioCopy(locale, slot.stateLabel)}</td><td>{formatNumber(slot.powerW)} W</td><td>{formatNumber(slot.consumedEnergyJ)} J</td><td>{formatNumber(slot.deliveredBits)} bit</td><td>{slot.serviceLabel === 'pending' ? uiText(locale, '待完成', 'pending') : slot.serviceLabel === 'complete' ? uiText(locale, '完成', 'complete') : uiText(locale, '未達成', 'missed')} / {scenarioCopy(locale, slot.boundaryLabel)}</td></tr>)}</tbody></table>
          </div>
        </details>
        <div className="c120-card-grid c120-card-grid--three" aria-invalid={completionIssue?.fieldId.startsWith('c120-claim-') ? true : undefined} aria-describedby={completionIssue?.fieldId.startsWith('c120-claim-') ? 'c120-completion-error' : undefined}>
          {CLAIMS.map(claim => (
            <label className="c120-choice-card" key={claim.id}>
              <strong>{claimText(locale, claim.id)}</strong>
              <select
                id={`c120-claim-${claim.id}`}
                name={`claim-${claim.id}`}
                aria-label={uiText(locale, '這個主張的判斷', 'Disposition for claim')}
                value={state.claimJudgments[claim.id] ?? ''}
                disabled={state.claimEvidenceRevealed}
                onChange={event => onState({ ...state, claimJudgments: { ...state.claimJudgments, [claim.id]: event.target.value as C120ClaimDisposition } })}
              >
                <option value="">{uiText(locale, '選擇…', 'Choose…')}</option><option value="accept">{uiText(locale, '接受', 'Accept')}</option><option value="qualify">{uiText(locale, '限定', 'Qualify')}</option><option value="reject">{uiText(locale, '拒絕', 'Reject')}</option>
              </select>
            </label>
          ))}
        </div>
        <fieldset id="c120-mission-contract" className="c120-contract-picker" aria-invalid={completionIssue?.fieldId === 'c120-mission-contract' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-mission-contract' ? 'c120-completion-error' : undefined}><legend>{uiText(locale, '供後續比較使用的任務契約', 'Mission contract for all later comparisons')}</legend>{scenario.missionContracts.map(option => <label key={option.id} className={option.comparisonStatus === 'INCOMPARABLE' ? 'is-warning' : ''}><input type="radio" name="mission-contract" value={option.id} disabled={state.claimEvidenceRevealed} checked={state.missionContractId === option.id} onChange={() => onState({ ...state, missionContractId: option.id })}/><span><strong>{scenarioCopy(locale, option.boundaryLabel)}</strong><small>{formatNumber(option.payloadBits)} bit / {option.deadlineSec} s / {option.comparisonStatus}</small></span></label>)}</fieldset>
        {mission?.comparisonStatus === 'INCOMPARABLE' && <p className="c120-alert" role="alert">{uiText(locale, '比較門檻：這個契約刻意不可比較。請選固定服務邊界。', 'Comparison gate: this contract is intentionally incomparable. Choose the fixed service boundary to continue.')}</p>}
        <fieldset id="c120-claim-confidence" className="c120-inline-choice" aria-invalid={completionIssue?.fieldId === 'c120-claim-confidence' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-claim-confidence' ? 'c120-completion-error' : undefined}><legend>{uiText(locale, '揭露證據前的信心', 'Confidence before evidence')}</legend>{(['low', 'medium', 'high'] as const).map(option => <label key={option}><input type="radio" name="claim-confidence" value={option} disabled={state.claimEvidenceRevealed} checked={state.confidence === option} onChange={() => onState({ ...state, confidence: option })}/>{option === 'low' ? uiText(locale, '低', 'low') : option === 'medium' ? uiText(locale, '中', 'medium') : uiText(locale, '高', 'high')}</label>)}</fieldset>
        <button id="c120-claim-reveal" className="c120-run" type="button" aria-describedby={completionIssue?.fieldId === 'c120-claim-reveal' ? 'c120-completion-error' : undefined} disabled={Object.values(state.claimJudgments).some(value => value === '') || state.missionContractId === '' || state.confidence === '' || state.claimEvidenceRevealed} onClick={() => onState({ ...state, claimEvidenceRevealed: true })}>{state.claimEvidenceRevealed ? uiText(locale, '任務契約已凍結', 'Mission contract frozen') : uiText(locale, '凍結契約並揭露證據', 'Freeze contract and reveal evidence')}</button>
        {state.claimEvidenceRevealed && (
          <div className="c120-reveal" aria-live="polite">
            <p><strong>{uiText(locale, '揭露觀察', 'Observation reveal')}</strong>: {worked.observationReveal.map(item => teach(item)).join(' → ')}</p>
            <label><span>{uiText(locale, '證據後重新判斷一次', 'One re-judgment after evidence')}</span><select id="c120-claim-rejudgment" name="claim-rejudgment" aria-invalid={completionIssue?.fieldId === 'c120-claim-rejudgment' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-claim-rejudgment' ? 'c120-completion-error' : undefined} value={state.claimRejudgment} onChange={event => onState({ ...state, claimRejudgment: event.target.value as C120ClaimDisposition })}><option value="">{uiText(locale, '選擇…', 'Choose…')}</option><option value="accept">{uiText(locale, '接受', 'Accept')}</option><option value="qualify">{uiText(locale, '限定', 'Qualify')}</option><option value="reject">{uiText(locale, '拒絕', 'Reject')}</option></select></label>
          </div>
        )}
        <p className="c120-unit-hint"><strong>{uiText(locale, '邊界與單位檢查', 'Boundary and unit check')}</strong>: {teach(worked.unitHint)}</p>
        <details className="c120-fast-branch"><summary>{teach(worked.fastCounterexample.title)}</summary><p>{teach(worked.fastCounterexample.prompt)}</p><p>{teach(worked.fastCounterexample.observation)}</p></details>
        <ShortResponse responseKey="openingClause" label="1 / 8 / Opening claim" responses={responses} onResponse={onResponse} issue={completionIssue}/>
        <SegmentComplete segment="claim-detective" onComplete={onComplete} complete={alreadyComplete} issue={completionIssue}/>
      </section>
    );
  }

  if (activeSegment === 'tle-anchor') {
    const content = C120_TEACHING_CONTENT.tleAnchor;
    return (
      <section id="c120-learning-workbench" className="c120-workbench" aria-labelledby="c120-segment-title" tabIndex={-1}>
        <div className="c120-section-heading"><span>{uiText(locale, '10-18 / 資料錨點', '10-18 / DATA ANCHOR')}</span><h2 id="c120-segment-title" tabIndex={-1}>{uiText(locale, '看懂 TLE、UTC 如何連到 NTPU 服務窗口', 'See how TLE and UTC connect to the NTPU service window')}</h2><p>{teach(content.question)}</p></div>
        <NoviceScaffold segment="tle-anchor" locale={locale} />
        <section id="c120-tle-import" className="c120-import-stages" aria-labelledby="c120-tle-import-title">
          <div><span className="c120-eyebrow">{uiText(locale, '固定離線匯入', 'PINNED OFFLINE IMPORT')}</span><h3 id="c120-tle-import-title">{teach(content.offlineImport.label)}</h3><p>{teach(content.offlineImport.importInstruction)}</p><small>{scenario.manifest.scenario.tleSourceId} / {scenario.tle.sourceEpochUtc} / fixture {scenario.manifest.scenario.fixtureVersion}</small></div>
          <div className="c120-import-file">
            <a href={scenario.tle.downloadPath} download={scenario.tle.downloadPath.split('/').pop() ?? 'oneweb-0314-provider.tle'}>{uiText(locale, '下載與 provider 綁定的 TLE 紀錄', 'Download provider-bound TLE record')}</a>
            <label id="c120-tle-file" aria-invalid={completionIssue?.fieldId === 'c120-tle-file' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-tle-file' ? 'c120-completion-error' : undefined}><span>{uiText(locale, '匯入下載的三行紀錄', 'Import the downloaded three-line record')}</span><input type="file" name="c120-tle-file" accept=".tle,.txt,text/plain" onChange={async event => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const receipt = validateC120PinnedTleImport(await file.text(), file.name, scenario.tle);
                event.target.setCustomValidity('');
                onState({ ...state, tleImportValidated: true, tleImportFileName: receipt.fileName, tleImportRecordSha256: receipt.recordSha256 });
              } catch (error) {
                const message = errorText(locale, error instanceof Error ? error.message : 'Pinned TLE identity mismatch');
                event.target.setCustomValidity(message);
                event.target.reportValidity();
                onState({ ...state, tleImportValidated: false, tleImportFileName: file.name, tleImportRecordSha256: '' });
              }
            }}/></label>
            <p role="status">{state.tleImportValidated ? `${uiText(locale, '已驗證', 'Validated')} / ${state.tleImportFileName} / ${state.tleImportRecordSha256}` : uiText(locale, '尚未匯入符合 provider 的 TLE 紀錄。', 'No provider-matching TLE record imported yet.')}</p>
          </div>
          <ol>{content.stages.map(stage => {
            const complete = state.tleImportStage >= stage.order;
            const unlocked = state.tleImportValidated && state.tleImportStage >= stage.order - 1;
            const value = stage.id === 'pinned-source'
              ? scenario.manifest.scenario.tleSourceId
              : stage.id === 'model-derived-window' ? scenario.tle.producerLabel : stage.value;
            return <li key={stage.id} data-complete={complete}><span>0{stage.order}</span><div><strong>{teach(stage.label)}</strong><small>{teach(stage.studentAction)}</small>{complete && <p>{value} / {teach(stage.disclosure)}</p>}</div><button type="button" aria-describedby={completionIssue?.fieldId === 'c120-tle-import' ? 'c120-completion-error' : undefined} disabled={!unlocked || complete} onClick={() => onState({ ...state, tleImportStage: stage.order })}>{complete ? uiText(locale, '已匯入', 'Imported') : uiText(locale, '開啟階段', 'Open stage')}</button></li>;
          })}</ol>
        </section>
        <details className="c120-worked-example" onToggle={event => onState({ ...state, tleTechnicalOpen: event.currentTarget.open })}><summary>{uiText(locale, '逐步查看技術細節', 'Progressive technical details')}</summary><dl className="c120-technical-grid"><div><dt>{uiText(locale, '來源 epoch', 'source epoch')}</dt><dd>{scenario.tle.sourceEpochUtc}</dd></div><div><dt>{uiText(locale, '目標 UTC', 'target UTC')}</dt><dd>{scenario.tle.targetUtc}</dd></div><div><dt>{uiText(locale, '觀測者', 'observer')}</dt><dd>{scenarioCopy(locale, scenario.tle.observerLabel)}</dd></div><div><dt>{uiText(locale, '狀態', 'state')}</dt><dd>{scenarioCopy(locale, scenario.tle.frame.stateLabel)} / {uiText(locale, '可見', 'visible')} {String(scenario.tle.frame.scene.visible)}</dd></div><div><dt>{uiText(locale, '仰角方向', 'look angle')}</dt><dd>az {scenario.tle.frame.scene.azimuthDeg} deg / el {scenario.tle.frame.scene.elevationDeg} deg</dd></div><div><dt>{uiText(locale, '產生器', 'producer')}</dt><dd>{scenarioCopy(locale, scenario.tle.producerLabel)}</dd></div></dl></details>
        <ol className="c120-lineage c120-lineage--interactive" aria-invalid={completionIssue?.fieldId.startsWith('c120-tle-lineage-') ? true : undefined} aria-describedby={completionIssue?.fieldId.startsWith('c120-tle-lineage-') ? 'c120-completion-error' : undefined}>{scenario.tle.lineage.map(item => <li key={item.order}><span>0{item.order}</span><strong>{scenarioCopy(locale, item.label)}</strong><small>{item.value}</small><select id={`c120-tle-lineage-${item.order}`} name={`tle-lineage-${item.order}`} aria-label={uiText(locale, '來源分類', 'Provenance classification')} value={state.tleProvenance[String(item.order)] ?? ''} onChange={event => onState({ ...state, tleProvenance: { ...state.tleProvenance, [String(item.order)]: event.target.value as C120Provenance } })}><option value="">{uiText(locale, '分類…', 'Classify…')}</option><option value="SOURCE">SOURCE</option><option value="MODEL-DERIVED">MODEL-DERIVED</option><option value="COURSE-ASSUMPTION">COURSE-ASSUMPTION</option></select></li>)}</ol>
        <fieldset id="c120-tle-exclusions" className="c120-check-grid" aria-invalid={completionIssue?.fieldId === 'c120-tle-exclusions' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-tle-exclusions' ? 'c120-completion-error' : undefined}><legend>{uiText(locale, 'TLE 不包含…', 'TLE does not contain…')}</legend>{scenario.tle.tleDoesNotContain.map(item => <label key={item}><input type="checkbox" name="tle-exclusions" value={item} checked={state.tleExcluded.includes(item)} onChange={event => onState({ ...state, tleExcluded: event.target.checked ? [...state.tleExcluded, item] : state.tleExcluded.filter(value => value !== item) })}/>{uiText(locale, item === 'power' ? '功率' : item === 'traffic' ? '流量' : item === 'handover' ? '換手' : '能量', item)}</label>)}</fieldset>
        <fieldset id="c120-tle-window-decision" className="c120-inline-choice" aria-invalid={completionIssue?.fieldId === 'c120-tle-window-decision' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-tle-window-decision' ? 'c120-completion-error' : undefined}><legend>{uiText(locale, '哪個動作位於顯示的服務窗口內？', 'Which action is inside the displayed service window?')}</legend>{content.sendWaitChoice.map(choice => <label key={choice.id}><input type="radio" name="tle-window-decision" value={choice.id} checked={state.tleWindowDecisionId === choice.id} onChange={() => onState({ ...state, tleWindowDecisionId: choice.id })}/><span>{teach(choice.label)}<small>{teach(choice.consequence)}</small></span></label>)}</fieldset>
        <label id="c120-tle-confirm" className="c120-confirm" aria-invalid={completionIssue?.fieldId === 'c120-tle-confirm' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-tle-confirm' ? 'c120-completion-error' : undefined}><input type="checkbox" name="tle-confirm" checked={state.tleConfirmed} onChange={event => onState({ ...state, tleConfirmed: event.target.checked })}/>{uiText(locale, '我確認回放能量值來自版本化 provider，而不是 TLE。', 'I confirm that replay energy values come from the versioned replay provider, not from the TLE.')}</label>
        <SegmentComplete segment="tle-anchor" onComplete={onComplete} complete={alreadyComplete} issue={completionIssue}/>
      </section>
    );
  }

  if (activeSegment === 'lab-a') {
    const rightReplay = activeReplay?.input.surface === 'lab-a' && activeReplay.input.candidateId === state.labACandidateId;
    const content = C120_TEACHING_CONTENT.labA;
    return (
      <section id="c120-learning-workbench" className="c120-workbench" aria-labelledby="c120-segment-title" tabIndex={-1}>
        <div className="c120-section-heading"><span>{uiText(locale, '18-41 / 實驗 A', '18-41 / LAB A')}</span><h2 id="c120-segment-title" tabIndex={-1}>{uiText(locale, '同一份工作，試三種節奏', 'Try three paces on the same job')}</h2><p>{teach(content.question)}</p></div>
        <NoviceScaffold segment="lab-a" locale={locale} />
        <details className="c120-worked-example"><summary>{teach(content.workedExample.title)}</summary><p>{teach(content.workedExample.note)}</p><div className="c120-worked-rows">{content.workedExample.slots.map(slot => <article key={slot.id}><span>{teach(slot.label)}</span><strong>{formatNumber(slot.powerW)} W / {slot.durationSec} s</strong><small>{teach(slot.energyLabel)}</small></article>)}</div><p>{teach(content.workedExample.conclusion)}</p></details>
        <section id="c120-lab-a-reference" className="c120-reference-run"><div><span className="c120-eyebrow">{uiText(locale, '自動 / 先看參考', 'AUTO / REFERENCE FIRST')}</span><h3>{uiText(locale, '參考回放', 'Reference replay')}</h3><p>{teach(content.referenceReplayPrompt)}</p></div><button className="c120-run" type="button" onClick={() => { onState({ ...state, labAReferenceSeen: true }); onRunInput(scenario.labA.referenceReplay.input); }}>{uiText(locale, '執行參考', 'Run reference')}</button></section>
        <div id="c120-lab-a-candidate" className="c120-card-grid c120-card-grid--three" aria-invalid={completionIssue?.fieldId === 'c120-lab-a-candidate' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-lab-a-candidate' ? 'c120-completion-error' : undefined}>{scenario.labA.candidates.map(candidate => <label className="c120-choice-card" key={candidate.id}><input type="radio" name="lab-a-candidate" value={candidate.id} disabled={state.labAPredictionFrozen} checked={state.labACandidateId === candidate.id} onChange={() => onState({ ...state, labACandidateId: candidate.id, labACandidateRunDone: false, labAVerdict: '', labAFastBranchAnswer: '' })}/><strong>{scenarioCopy(locale, candidate.label)}</strong><small>{scenarioCopy(locale, candidate.description)}</small></label>)}</div>
        <div id="c120-lab-a-prediction" className="c120-prediction-grid">
          <Prediction id="c120-lab-a-prediction-active" name="lab-a-prediction-active" legend={uiText(locale, '和參考相比，主動時間會…', 'Compared with the reference, active time will be…')} value={state.labAActiveTimePrediction} disabled={state.labAPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labAActiveTimePrediction: value })}/>
          <Prediction id="c120-lab-a-prediction-j" name="lab-a-prediction-j" legend={uiText(locale, '消耗 J 會…', 'Consumed J will be…')} value={state.labAPrediction} disabled={state.labAPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labAPrediction: value })}/>
          <Prediction id="c120-lab-a-prediction-service" name="lab-a-prediction-service" legend={uiText(locale, '服務餘裕會…', 'Service margin will be…')} value={state.labAServicePrediction} disabled={state.labAPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labAServicePrediction: value })}/>
          <Prediction id="c120-lab-a-prediction-bitj" name="lab-a-prediction-bitj" legend={uiText(locale, 'provider 擁有的 bit/J 會…', 'Provider-owned bit/J will be…')} value={state.labABitJPrediction} disabled={state.labAPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labABitJPrediction: value })}/>
        </div>
        <label id="c120-lab-a-mechanism" className="c120-select-field" aria-invalid={completionIssue?.fieldId === 'c120-lab-a-mechanism' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-lab-a-mechanism' ? 'c120-completion-error' : undefined}><span>{uiText(locale, '預期的主要機制 / 選擇', 'Expected main mechanism / SELECT')}</span><select name="lab-a-mechanism" disabled={state.labAPredictionFrozen} value={state.labAMechanismId} onChange={event => onState({ ...state, labAMechanismId: event.target.value })}><option value="">{uiText(locale, '選擇…', 'Choose…')}</option>{content.mechanismWordBank.map(item => <option key={item.id} value={item.id}>{teach(item.label)} / {teach(item.copy)}</option>)}</select></label>
        <ConfidenceChoice id="c120-lab-a-confidence" name="lab-a-confidence" value={state.labAPredictionConfidence} disabled={state.labAPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labAPredictionConfidence: value })}/>
        <div className="c120-button-row"><button id="c120-lab-a-freeze" type="button" aria-describedby={completionIssue?.fieldId === 'c120-lab-a-freeze' ? 'c120-completion-error' : undefined} disabled={state.labAPredictionFrozen || !state.labAReferenceSeen || state.labACandidateId === '' || state.labAMechanismId === '' || state.labAPredictionConfidence === '' || [state.labAActiveTimePrediction, state.labAPrediction, state.labAServicePrediction, state.labABitJPrediction].includes('')} onClick={() => onState({ ...state, labAPredictionFrozen: true })}>{uiText(locale, '凍結預測', 'Freeze prediction')}</button><button id="c120-lab-a-run" className="c120-run" type="button" aria-describedby={completionIssue?.fieldId === 'c120-lab-a-run' ? 'c120-completion-error' : undefined} disabled={!state.labAPredictionFrozen || state.labACandidateId === '' || state.missionContractId !== 'mission-fixed-service-boundary'} onClick={() => { if (state.labACandidateId !== '') { onState({ ...state, labACandidateRunDone: true }); onRunInput({ surface: 'lab-a', missionContractId: 'mission-fixed-service-boundary', candidateId: state.labACandidateId, hiddenConditionId: 'high-idle-cost' }); } }}>{uiText(locale, '執行凍結候選', 'Run frozen candidate')}</button></div>
        {runError && <p className="c120-alert" role="alert"><strong>{uiText(locale, '排程未被接受', 'Schedule not accepted')}</strong>: {errorText(locale, runError)}</p>}
        <ReplayResult replay={rightReplay ? activeReplay : null}/>
        <fieldset id="c120-lab-a-verdict" className="c120-inline-choice" aria-invalid={completionIssue?.fieldId === 'c120-lab-a-verdict' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-lab-a-verdict' ? 'c120-completion-error' : undefined}><legend>{uiText(locale, '你的預測是…', 'Your prediction was…')}</legend>{(['supported', 'revised'] as const).map(value => <label key={value}><input type="radio" name="lab-a-verdict" value={value} checked={state.labAVerdict === value} onChange={() => onState({ ...state, labAVerdict: value })}/>{value === 'supported' ? uiText(locale, '獲支持', 'supported') : uiText(locale, '已修正', 'revised')}</label>)}</fieldset>
        <details className="c120-negative-control"><summary>{teach(content.negativeControl.label)}</summary><p>{teach(content.negativeControl.copy)}</p><button type="button" disabled={!state.labAPredictionFrozen || state.labACandidateId === ''} onClick={() => { if (state.labACandidateId !== '') { onScaffold('lab-a:negative-control:same-input'); onRunInput({ surface: 'lab-a', missionContractId: 'mission-fixed-service-boundary', candidateId: state.labACandidateId, hiddenConditionId: 'high-idle-cost' }); } }}>{uiText(locale, '重新執行固定輸入', 'Re-run held-constant input')}</button></details>
        <div className="c120-hint-ladder" aria-label={uiText(locale, '實驗 A 腳手架提示', 'Lab A scaffold ladder')}>{content.hints.map(hint => <details key={hint.id} onToggle={event => event.currentTarget.open && onScaffold(`lab-a:hint-${hint.level}:${hint.id}`)}><summary>{uiText(locale, '提示', 'Hint')} {hint.level}</summary><p>{teach(hint.copy)}</p></details>)}</div>
        <details id="c120-lab-a-fast" className="c120-fast-branch"><summary>{uiText(locale, '可選的快速反例', 'Optional fast counterexample')}</summary><p>{uiText(locale, '固定候選，再揭露更緊的編寫服務窗口。限定後的排名還成立嗎？', 'Keep the candidate fixed, then reveal a tighter authored service window. Does the qualified ranking survive?')}</p><button type="button" disabled={!state.labAPredictionFrozen || state.labACandidateId === ''} onClick={() => { if (state.labACandidateId !== '') { onState({ ...state, labAFastBranchAnswer: 'ranking-can-reverse' }); onRunInput({ surface: 'lab-a', missionContractId: 'mission-fixed-service-boundary', candidateId: state.labACandidateId, hiddenConditionId: 'tight-service-window' }); } }}>{uiText(locale, '執行更緊窗口反例', 'Run tighter-window counterexample')}</button>{state.labAFastBranchAnswer && <small>{teach(content.fastBranch.observation)}</small>}</details>
        <ShortResponse responseKey="labAClause" label="2 / 8 / Evidence clause" responses={responses} onResponse={onResponse} issue={completionIssue}/>
        <SegmentComplete segment="lab-a" onComplete={onComplete} complete={alreadyComplete} issue={completionIssue}/>
      </section>
    );
  }

  if (activeSegment === 'lab-b') {
    const rightReplay = activeReplay?.input.surface === 'lab-b' && activeReplay.input.frozenRuleId === state.labBRuleId;
    const content = C120_TEACHING_CONTENT.labB;
    const counterexampleReplay = scenario.labB.replays.find(replay => replay.input.surface === 'lab-b'
      && replay.input.frozenRuleId === (state.labBRuleId === 'hysteresis' ? 'stable-two' : 'hysteresis'));
    const updateRuleBuilder = (patch: Partial<Pick<C120InteractionState, 'labBThresholdId' | 'labBHoldCountId' | 'labBLowerThresholdId'>>) => {
      const next = { ...state, ...patch, labBRuleFrozen: false };
      onState({
        ...next,
        labBRuleId: deriveC120LabBRuleId(next.labBThresholdId, next.labBHoldCountId, next.labBLowerThresholdId),
      });
    };
    return (
      <section id="c120-learning-workbench" className="c120-workbench" aria-labelledby="c120-segment-title" tabIndex={-1}>
        <div className="c120-section-heading"><span>{uiText(locale, '41-64 / 實驗 B', '41-64 / LAB B')}</span><h2 id="c120-segment-title" tabIndex={-1}>{uiText(locale, '何時切換，才不會反覆來回？', 'When should you switch without bouncing back and forth?')}</h2><p>{teach(content.question)}</p></div>
        <NoviceScaffold segment="lab-b" locale={locale} />
        <details className="c120-worked-example"><summary>{teach(content.workedTrace.title)}</summary><p>{teach(content.workedTrace.note)}</p><div className="c120-table-scroll" tabIndex={0} aria-label={uiText(locale, '可捲動的五事件示範追蹤', 'Scrollable five-event worked trace')}><table><caption>{uiText(locale, 'Trace A 在看到未來趨勢前教你推理下一狀態。', 'Trace A teaches next-state reasoning before the future trend is shown.')}</caption><thead><tr><th scope="col">{uiText(locale, '事件', 'event')}</th><th scope="col">{uiText(locale, '房間類比', 'room analogy')}</th><th scope="col">{uiText(locale, '品質', 'quality')}</th><th scope="col">{uiText(locale, '狀態', 'state')}</th><th scope="col">{uiText(locale, '下一狀態問題', 'next-state prompt')}</th></tr></thead><tbody>{content.workedTrace.events.map(event => <tr key={event.id}><th scope="row">{event.timeLabel}</th><td>{scenarioCopy(locale, event.roomState)}</td><td>{event.qualityBand}</td><td>{event.servingState}</td><td>{teach(event.nextStatePrompt)}</td></tr>)}</tbody></table></div></details>
        <fieldset id="c120-lab-b-entry" className="c120-inline-choice" aria-invalid={completionIssue?.fieldId === 'c120-lab-b-entry' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-lab-b-entry' ? 'c120-completion-error' : undefined}><legend>{teach(content.entryCheck.prompt)}</legend>{content.traceAChoices.map(choice => <label key={choice.id}><input type="radio" name="lab-b-entry" value={choice.id} disabled={state.labBRuleFrozen} checked={state.labBEntryAnswer === choice.id} onChange={() => onState({ ...state, labBEntryAnswer: choice.id })}/>{scenarioCopy(locale, choice.label)}</label>)}</fieldset>
        <label id="c120-lab-b-alternate" className="c120-confirm" aria-invalid={completionIssue?.fieldId === 'c120-lab-b-alternate' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-lab-b-alternate' ? 'c120-completion-error' : undefined}><input type="checkbox" name="lab-b-alternate" disabled={state.labBRuleFrozen} checked={state.labBAlternateReviewed} onChange={event => onState({ ...state, labBAlternateReviewed: event.target.checked })}/>{uiText(locale, '我使用允許的一次倒帶，比較替代的 Trace A 動作，再凍結。', 'I used the one permitted rewind to compare the alternate Trace A action before freezing.')}</label>
        <p className="c120-trace-note">{scenarioCopy(locale, scenario.labB.traceALabel)} {teach(content.withheldTrace.changedFutureTrend)}</p>
        <div id="c120-lab-b-prediction" className="c120-prediction-grid">
          <Prediction id="c120-lab-b-prediction-service" name="lab-b-prediction-service" legend={uiText(locale, '在保留 Trace B 上，服務會…', 'On withheld Trace B, service will be…')} value={state.labBServicePrediction} disabled={state.labBPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labBServicePrediction: value })}/>
          <Prediction id="c120-lab-b-prediction-active" name="lab-b-prediction-active" legend={uiText(locale, '主動時間會…', 'Active time will be…')} value={state.labBActiveTimePrediction} disabled={state.labBPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labBActiveTimePrediction: value })}/>
          <Prediction id="c120-lab-b-prediction-energy" name="lab-b-prediction-energy" legend={uiText(locale, '消耗 J 會…', 'Consumed J will be…')} value={state.labBEnergyPrediction} disabled={state.labBPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labBEnergyPrediction: value })}/>
          <Prediction id="c120-lab-b-prediction-switch" name="lab-b-prediction-switch" legend={uiText(locale, '切換次數會…', 'Switch count will be…')} value={state.labBPrediction} disabled={state.labBPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labBPrediction: value })}/>
        </div>
        <ConfidenceChoice id="c120-lab-b-confidence" name="lab-b-confidence" value={state.labBPredictionConfidence} disabled={state.labBPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labBPredictionConfidence: value })}/>
        <div id="c120-lab-b-rule" className="c120-rule-builder" aria-invalid={completionIssue?.fieldId === 'c120-lab-b-rule' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-lab-b-rule' ? 'c120-completion-error' : undefined}>
          <span className="c120-eyebrow">{uiText(locale, '可執行的非程式規則', 'EXECUTABLE NON-CODE RULE')}</span>
          <p>{teach(content.ruleBuilder.executableBlock)}</p>
          <div className="c120-transfer-grid">
            <label><span>{uiText(locale, 'threshold（門檻）', 'threshold')}</span><select name="lab-b-threshold" disabled={state.labBRuleFrozen || state.labBPredictionFrozen} value={state.labBThresholdId} onChange={event => updateRuleBuilder({ labBThresholdId: event.target.value })}><option value="">{uiText(locale, '選擇…', 'Choose…')}</option>{content.ruleBuilder.thresholdOptions.map(item => <option key={item.id} value={item.id}>{teach(item.label)}</option>)}</select></label>
            <label><span>{uiText(locale, '連續步數 N', 'N consecutive steps')}</span><select name="lab-b-hold-count" disabled={state.labBRuleFrozen || state.labBPredictionFrozen} value={state.labBHoldCountId} onChange={event => updateRuleBuilder({ labBHoldCountId: event.target.value })}><option value="">{uiText(locale, '選擇…', 'Choose…')}</option>{content.ruleBuilder.consecutiveStepOptions.map(item => <option key={item.id} value={item.id}>{teach(item.label)} / {teach(item.countLabel)}</option>)}</select></label>
            <label><span>{uiText(locale, '回切的較低門檻', 'lower return threshold')}</span><select name="lab-b-lower-threshold" disabled={state.labBRuleFrozen || state.labBPredictionFrozen} value={state.labBLowerThresholdId} onChange={event => updateRuleBuilder({ labBLowerThresholdId: event.target.value })}><option value="">{uiText(locale, '選擇…', 'Choose…')}</option>{content.ruleBuilder.lowerThresholdOptions.map(item => <option key={item.id} value={item.id}>{teach(item.label)}</option>)}</select></label>
          </div>
          <p className="c120-derived-rule" role="status"><strong>{uiText(locale, '推導出的 provider 規則：', 'Derived provider rule:')}</strong> {state.labBRuleId || uiText(locale, '完成三個區塊', 'complete all three blocks')}</p>
          <div className="c120-card-grid c120-card-grid--three">{scenario.labB.rules.map(rule => <article className="c120-choice-card" key={rule.id} data-selected={state.labBRuleId === rule.id}><strong>{scenarioCopy(locale, rule.label)}</strong><small>{scenarioCopy(locale, rule.description)}</small><button type="button" disabled={state.labBRuleFrozen || state.labBPredictionFrozen} onClick={() => { onScaffold(`lab-b:rule-template:${rule.id}`); if (rule.id === 'switch-now') updateRuleBuilder({ labBThresholdId: 'threshold-low', labBHoldCountId: 'one-step', labBLowerThresholdId: 'lower-same' }); else if (rule.id === 'stable-two') updateRuleBuilder({ labBThresholdId: 'threshold-steady', labBHoldCountId: 'two-steps', labBLowerThresholdId: 'lower-one-band' }); else updateRuleBuilder({ labBThresholdId: 'threshold-high', labBHoldCountId: 'two-steps', labBLowerThresholdId: 'lower-two-bands' }); }}>{uiText(locale, '載入腳手架', 'Load as scaffold')}</button></article>)}</div>
        </div>
        <div className="c120-button-row"><button id="c120-lab-b-freeze" type="button" aria-describedby={completionIssue?.fieldId === 'c120-lab-b-freeze' ? 'c120-completion-error' : undefined} disabled={state.labBEntryAnswer === '' || !state.labBAlternateReviewed || state.labBRuleId === '' || state.labBPredictionConfidence === '' || [state.labBPrediction, state.labBServicePrediction, state.labBActiveTimePrediction, state.labBEnergyPrediction].includes('') || state.labBRuleFrozen} onClick={() => onState({ ...state, labBRuleFrozen: true, labBPredictionFrozen: true })}>{uiText(locale, '凍結預測與規則', 'Freeze prediction + rule')}</button><button id="c120-lab-b-run" className="c120-run" type="button" aria-describedby={completionIssue?.fieldId === 'c120-lab-b-run' ? 'c120-completion-error' : undefined} disabled={!state.labBRuleFrozen || !state.labBPredictionFrozen || state.labBRuleId === '' || state.missionContractId !== 'mission-fixed-service-boundary'} onClick={() => state.labBRuleId !== '' && onRunInput({ surface: 'lab-b', missionContractId: 'mission-fixed-service-boundary', frozenRuleId: state.labBRuleId, thresholdId: state.labBThresholdId as 'threshold-low' | 'threshold-steady' | 'threshold-high', holdCountId: state.labBHoldCountId as 'one-step' | 'two-steps', lowerThresholdId: state.labBLowerThresholdId as 'lower-same' | 'lower-one-band' | 'lower-two-bands', traceId: 'trace-b-withheld' })}>{uiText(locale, '執行保留 Trace B', 'Run withheld Trace B')}</button></div>
        {runError && <p className="c120-alert" role="alert"><strong>{uiText(locale, '回放未被接受', 'Replay not accepted')}</strong>: {errorText(locale, runError)}</p>}
        <ReplayResult replay={rightReplay ? activeReplay : null}/>
        <fieldset id="c120-lab-b-verdict" className="c120-inline-choice" aria-invalid={completionIssue?.fieldId === 'c120-lab-b-verdict' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-lab-b-verdict' ? 'c120-completion-error' : undefined}><legend>{uiText(locale, '你的凍結規則是…', 'Your frozen rule was…')}</legend>{(['supported', 'revised'] as const).map(value => <label key={value}><input type="radio" name="lab-b-verdict" value={value} checked={state.labBVerdict === value} onChange={() => onState({ ...state, labBVerdict: value })}/>{value === 'supported' ? uiText(locale, '獲支持', 'supported') : uiText(locale, '已修正', 'revised')}</label>)}</fieldset>
        <div className="c120-hint-ladder" aria-label={uiText(locale, '實驗 B 腳手架提示', 'Lab B scaffold ladder')}>{content.hints.map(hint => <details key={hint.id} onToggle={event => event.currentTarget.open && onScaffold(`lab-b:hint-${hint.level}:${hint.id}`)}><summary>{uiText(locale, '提示', 'Hint')} {hint.level}</summary><p>{teach(hint.copy)}</p></details>)}</div>
        <details id="c120-lab-b-fast" className="c120-fast-branch"><summary>{uiText(locale, '可選的後果反例', 'Optional consequential counterexample')}</summary><p>{teach(content.counterexample.prompt)}</p><button type="button" disabled={!state.labBRuleFrozen || counterexampleReplay === undefined} onClick={() => { if (counterexampleReplay) { onState({ ...state, labBFastBranchAnswer: 'state-energy' }); onRunInput(counterexampleReplay.input); } }}>{uiText(locale, '回放另一條凍結規則', 'Replay a different frozen rule')}</button>{state.labBFastBranchAnswer && <small>{teach(content.counterexample.observation)} {uiText(locale, '請重新執行原本的凍結規則，再鎖定核心判斷。', 'Re-run your original frozen rule before locking the core verdict.')}</small>}</details>
        <ShortResponse responseKey="labBClause" label="3 / 8 / Rule clause" responses={responses} onResponse={onResponse} issue={completionIssue}/>
        <SegmentComplete segment="lab-b" onComplete={onComplete} complete={alreadyComplete} issue={completionIssue}/>
      </section>
    );
  }

  if (activeSegment === 'recovery') {
    return (
      <section id="c120-learning-workbench" className="c120-workbench" aria-labelledby="c120-segment-title" tabIndex={-1}>
        <div className="c120-section-heading"><span>{uiText(locale, '64-69 / 復原', '64-69 / RECOVERY')}</span><h2 id="c120-segment-title" tabIndex={-1}>{uiText(locale, '停下來，也能從同一條因果鏈繼續', 'Pause and continue from the same causal chain')}</h2><p>{uiText(locale, '檢查點會保存 session、你的選擇、目前段落與 telemetry；不同 provider 的資料不會混在一起。', 'A checkpoint keeps the session, your choices, the active segment, and telemetry. Data from different providers never gets mixed.')}</p></div>
        <NoviceScaffold segment="recovery" locale={locale} />
        <div className="c120-recovery-grid"><article><span>{uiText(locale, '檢查點', 'CHECKPOINT')}</span><strong>#{checkpointOrdinal}</strong><p>{uiText(locale, '儲存可恢復的本機快照，讓它出現在可重開的工作簿 bundle。', 'Save a restorable local snapshot and make it available through the reopenable workbook bundle.')}</p><button id="c120-save-checkpoint" type="button" aria-describedby={completionIssue?.fieldId === 'c120-save-checkpoint' ? 'c120-completion-error' : undefined} onClick={onCheckpoint}>{uiText(locale, '儲存可恢復檢查點', 'Save restorable checkpoint')}</button></article><article><span>{uiText(locale, '重設', 'RESET')}</span><strong>{uiText(locale, '確認＋復原', 'Confirm + undo')}</strong><p>{uiText(locale, '重設會要求確認，並保留一份記憶體中的復原快照。', 'Reset asks for confirmation and keeps one in-memory undo snapshot.')}</p><button type="button" onClick={onReset}>{uiText(locale, '查看重設', 'Review reset')}</button></article><article><span>{uiText(locale, 'fallback', 'FALLBACK')}</span><strong>{uiText(locale, 'provider 層級切換', 'Provider-level switch')}</strong><p>{uiText(locale, '從可替換的 stub provider 重新載入 TLE／回放／工作簿；絕不混用 frame。', 'Reload all TLE/replays/workbook from the replaceable stub provider; never mix frames.')}</p><button type="button" onClick={onUseFallback}>{uiText(locale, '使用一致的 fallback', 'Use coherent fallback')}</button></article></div>
        <div className="c120-transfer-grid">
          <label id="c120-recovery-retrieval" aria-invalid={completionIssue?.fieldId === 'c120-recovery-retrieval' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-recovery-retrieval' ? 'c120-completion-error' : undefined}><span>{uiText(locale, '閉卷因果提取 / 選擇', 'Closed-book causal retrieval / SELECT')}</span><select name="recovery-retrieval" value={state.recoveryRetrievalId} onChange={event => onState({ ...state, recoveryRetrievalId: event.target.value })}><option value="">{uiText(locale, '選擇…', 'Choose…')}</option><option value="state-time-power">{uiText(locale, '決策 → 狀態 → 主動／閒置時間 → W/J → 服務證據', 'decision → state → active/idle time → W/J → service evidence')}</option><option value="score-energy">{uiText(locale, '分數 → 自動省能量', 'score → automatic energy saving')}</option><option value="rate-winner">{uiText(locale, '最高速率 → 自動勝者', 'highest rate → automatic winner')}</option></select></label>
          <label id="c120-recovery-counterexample" aria-invalid={completionIssue?.fieldId === 'c120-recovery-counterexample' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-recovery-counterexample' ? 'c120-completion-error' : undefined}><span>{uiText(locale, '邊界反例 / 選擇', 'Boundary counterexample / SELECT')}</span><select name="recovery-counterexample" value={state.recoveryCounterexampleId} onChange={event => onState({ ...state, recoveryCounterexampleId: event.target.value })}><option value="">{uiText(locale, '選擇…', 'Choose…')}</option><option value="boundary-can-reverse">{uiText(locale, '改變工作量／期限可能反轉或使比較無效。', 'Changing workload/deadline can reverse or invalidate the comparison.')}</option><option value="numbers-always-win">{uiText(locale, '相同數字排名永遠成立。', 'The same numeric ranking is universal.')}</option></select></label>
        </div>
        <div className="c120-rescue-note"><p>{uiText(locale, '教師救援是 telemetry，不是處罰；只有真的需要人介入時才記錄。', 'Instructor rescue is telemetry, not a penalty. Record it only when a human had to intervene.')}</p><button type="button" onClick={onRecordInstructorRescue}>{uiText(locale, '記錄一次教師救援', 'Record one instructor rescue')}</button></div>
        <ShortResponse responseKey="recoveryClause" label="4 / 8 / Closed-book causal chain" responses={responses} onResponse={onResponse} issue={completionIssue}/>
        <SegmentComplete segment="recovery" onComplete={onComplete} complete={alreadyComplete} issue={completionIssue}/>
      </section>
    );
  }

  if (activeSegment === 'lab-c') {
    const labCReplay = activeReplay?.input.surface === 'lab-c' ? activeReplay : null;
    const content = C120_TEACHING_CONTENT.labC;
    const updateSlot = (index: number, action: C120LabCAction) => {
      const slots = [...state.labCSlots] as C120LabCAction[];
      slots[index] = action;
      onState({
        ...state,
        labCSlots: slots as unknown as C120LabCSlots,
        labCFirstRunDone: state.labCFirstRunDone,
        labCRevisionApplied: false,
      });
    };
    const matchingFirstRun = scenario.labC.replays.find(replay => replay.input.surface === 'lab-c'
      && replay.input.revisionOrdinal === 0
      && JSON.stringify(replay.input.slots) === JSON.stringify(state.labCSlots));
    const revisionReplay = scenario.labC.replays.find(replay => replay.input.surface === 'lab-c'
      && replay.input.revisionOrdinal === 1
      && JSON.stringify(replay.input.slots) === JSON.stringify(state.labCSlots));
    return (
      <section id="c120-learning-workbench" className="c120-workbench" aria-labelledby="c120-segment-title" tabIndex={-1}>
        <div className="c120-section-heading"><span>{uiText(locale, '69-92 / 實驗 C', '69-92 / LAB C')}</span><h2 id="c120-segment-title" tabIndex={-1}>{uiText(locale, '在六個時槽內安排有限能量', 'Place limited energy across six slots')}</h2><p>{teach(content.question)}</p></div>
        <NoviceScaffold segment="lab-c" locale={locale} />
        <h3 className="c120-step-heading">{uiText(locale, '步驟 1：先讀示範卡片', 'Step 1: read the worked card')}</h3>
        <details className="c120-worked-example"><summary>{teach(content.workedExample.title)}</summary><dl className="c120-technical-grid"><div><dt>{uiText(locale, '卡片', 'card')}</dt><dd>{teach(content.workedExample.card.label)}</dd></div><div><dt>{uiText(locale, '產生', 'generated')}</dt><dd>{content.workedExample.card.generatedAt}</dd></div><div><dt>{uiText(locale, '期限', 'deadline')}</dt><dd>{content.workedExample.card.deadlineAt}</dd></div><div><dt>{uiText(locale, '新鮮度', 'freshness')}</dt><dd>{content.workedExample.card.freshnessLimit}</dd></div><div><dt>{uiText(locale, '窗口', 'window')}</dt><dd>{content.workedExample.card.contactWindow}</dd></div><div><dt>{uiText(locale, '合法時槽', 'legal slot')}</dt><dd>{content.workedExample.card.legalSlot}</dd></div></dl><p>{content.workedExample.generatedSentReceived.map(item => teach(item)).join(' → ')}</p><p>{teach(content.workedExample.observation)}</p></details>
        <fieldset id="c120-lab-c-entry" className="c120-inline-choice" aria-invalid={completionIssue?.fieldId === 'c120-lab-c-entry' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-lab-c-entry' ? 'c120-completion-error' : undefined}><legend>{teach(content.entryCheck.prompt)}</legend>{content.entryCheck.choices.map(choice => <label key={choice}><input type="radio" name="lab-c-entry" value={choice} checked={state.labCEntryAnswer === choice} onChange={() => onState({ ...state, labCEntryAnswer: choice })}/>{uiText(locale, choice === 'slot 2' ? '時槽 2' : choice === 'slot 5' ? '時槽 5' : '不在接觸窗口內', choice)}</label>)}</fieldset>
        <details className="c120-step-details" open={state.labCEntryAnswer !== ''}><summary>{uiText(locale, '步驟 2：凍結第一次預測與排程', 'Step 2: freeze the first prediction and schedule')}</summary>
        <div id="c120-lab-c-prediction" className="c120-prediction-grid" aria-invalid={completionIssue?.fieldId === 'c120-lab-c-prediction' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-lab-c-prediction' ? 'c120-completion-error' : undefined}>
          <Prediction id="c120-lab-c-prediction-service" name="lab-c-prediction-service" legend={uiText(locale, '相對隱藏 baseline，服務會…', 'For this schedule versus the hidden baseline, service will be…')} value={state.labCServicePrediction} disabled={state.labCPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labCServicePrediction: value })}/>
          <Prediction id="c120-lab-c-prediction-freshness" name="lab-c-prediction-freshness" legend={uiText(locale, '新鮮度會…', 'Freshness will be…')} value={state.labCFreshnessPrediction} disabled={state.labCPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labCFreshnessPrediction: value })}/>
          <Prediction id="c120-lab-c-prediction-wakes" name="lab-c-prediction-wakes" legend={uiText(locale, '喚醒次數會…', 'Wake count will be…')} value={state.labCWakePrediction} disabled={state.labCPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labCWakePrediction: value })}/>
          <Prediction id="c120-lab-c-prediction-active" name="lab-c-prediction-active" legend={uiText(locale, '主動時間會…', 'Active time will be…')} value={state.labCActiveTimePrediction} disabled={state.labCPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labCActiveTimePrediction: value })}/>
          <Prediction id="c120-lab-c-prediction-energy" name="lab-c-prediction-energy" legend={uiText(locale, '消耗 J 會…', 'Consumed J will be…')} value={state.labCPrediction} disabled={state.labCPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labCPrediction: value })}/>
          <Prediction id="c120-lab-c-prediction-budget" name="lab-c-prediction-budget" legend={uiText(locale, '剩餘預算會…', 'Budget remaining will be…')} value={state.labCBudgetPrediction} disabled={state.labCPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labCBudgetPrediction: value })}/>
        </div>
        <ConfidenceChoice id="c120-lab-c-confidence" name="lab-c-confidence" value={state.labCPredictionConfidence} disabled={state.labCPredictionFrozen} issue={completionIssue} onChange={value => onState({ ...state, labCPredictionConfidence: value })}/>
        <div className="c120-bounded-schedules" aria-label={uiText(locale, 'provider 支援的第一次排程', 'Provider-supported first-run schedules')}>{content.boundedSchedules.slice(0, 2).map((schedule, index) => <button key={schedule.id} type="button" disabled={state.labCPredictionFrozen || state.labCFirstRunDone} onClick={() => { onScaffold(`lab-c:${schedule.scaffoldLevel}:${schedule.id}`); onState({ ...state, labCSlots: schedule.slots, labCFirstRunSlots: null, labCFirstRunDone: false, labCRevisionApplied: false }); }}><span>{index === 0 ? uiText(locale, '參考形狀', 'REFERENCE SHAPE') : uiText(locale, '學習者第一次執行', 'LEARNER FIRST RUN')}</span><strong>{teach(schedule.label)}</strong><small>{teach(schedule.constraintNote)}</small></button>)}</div>
        <p className="c120-scroll-hint">{uiText(locale, '四個時槽可操作；固定接觸與中斷保持鎖定。窄螢幕時排程板可水平捲動。', 'Four slots are actionable. Fixed contact and outage remain locked. The board scrolls horizontally on narrow screens.')}</p>
        <div className="c120-schedule" role="group" aria-label={uiText(locale, '六時槽排程', 'Six-slot schedule')}>{scenario.labC.slotLabels.map((label, index) => <label key={label}><span>{index + 1}</span><strong>{scenarioCopy(locale, label)}</strong><select name={`lab-c-slot-${index + 1}`} value={state.labCSlots[index]} disabled={index === 0 || index === 3 || state.labCRevisionApplied || (!state.labCFirstRunDone && state.labCPredictionFrozen)} onChange={event => updateSlot(index, event.target.value as C120LabCAction)}>{scenario.labC.allowedActionsBySlot[index].map(action => <option key={action} value={action}>{actionLabel(locale, action)}</option>)}</select></label>)}</div>
        {!state.labCFirstRunDone && !matchingFirstRun && <p className="c120-inline-guidance">{uiText(locale, '這個第一次執行組合不在 bounded fixture library。請載入一個支援形狀；每次啟用的執行仍由 provider 擁有。', 'This exact first-run combination is outside the bounded fixture library. Load one supported shape; every enabled run remains provider-owned.')}</p>}
        {state.labCFirstRunDone && !state.labCRevisionApplied && revisionReplay === undefined && <div className="c120-inline-guidance"><p>{uiText(locale, '凍結前請做一次支援的可見修正。腳手架可以載入 bounded 修正版，但不會替你執行。', 'Make one supported visible revision before freeze. A scaffold may load the bounded revision without running it.')}</p><button type="button" onClick={() => { const scaffold = scenario.labC.replays.find(replay => replay.input.surface === 'lab-c' && replay.input.revisionOrdinal === 1); if (scaffold?.input.surface === 'lab-c') { onScaffold('lab-c:revision:bounded-scaffold'); onState({ ...state, labCSlots: scaffold.input.slots }); } }}>{uiText(locale, '載入一個合法修正版腳手架', 'Load one legal revision scaffold')}</button></div>}
        <div className="c120-button-row"><button id="c120-lab-c-prediction-freeze" type="button" aria-describedby={completionIssue?.fieldId === 'c120-lab-c-prediction-freeze' ? 'c120-completion-error' : undefined} disabled={state.labCPredictionFrozen || state.labCEntryAnswer !== 'slot 2' || state.labCPredictionConfidence === '' || [state.labCPrediction, state.labCServicePrediction, state.labCFreshnessPrediction, state.labCWakePrediction, state.labCActiveTimePrediction, state.labCBudgetPrediction].includes('')} onClick={() => onState({ ...state, labCPredictionFrozen: true })}>{uiText(locale, '凍結第一次預測', 'Freeze first-run prediction')}</button></div>
        </details>
        <h3 className="c120-step-heading">{uiText(locale, '步驟 3：先看 baseline', 'Step 3: reveal the baseline')}</h3>
        <details className="c120-step-details" open={state.labCPredictionFrozen}><summary>{uiText(locale, '凍結後才揭露的 baseline', 'Baseline after the prediction is frozen')}</summary>
        <section id="c120-lab-c-baseline" className="c120-reference-run"><div><span className="c120-eyebrow">{uiText(locale, '自動 / 隱藏 baseline', 'AUTO / HIDDEN BASELINE')}</span><h3>{uiText(locale, '立即傳送 baseline', 'Send-immediately baseline')}</h3><p>{uiText(locale, '揭露 provider 結果前，先凍結選定排程與六個預測方向。同步帳本會分開保存服務、新鮮度、喚醒、主動時間、J、預算與 bit/J。', 'Freeze the selected schedule and all six prediction directions before revealing this provider result. The synchronized ledger keeps service, freshness, wakes, active time, J, budget and bit/J separate.')}</p></div><button className="c120-run" type="button" aria-describedby={completionIssue?.fieldId === 'c120-lab-c-baseline' ? 'c120-completion-error' : undefined} disabled={!state.labCPredictionFrozen || state.labCBaselineSeen} onClick={() => { onState({ ...state, labCBaselineSeen: true }); onRunInput(scenario.labC.replays[0]!.input); }}>{state.labCBaselineSeen ? uiText(locale, 'baseline 已揭露', 'Baseline revealed') : uiText(locale, '揭露 baseline 帳本', 'Reveal baseline ledger')}</button></section>
        </details>
        <h3 className="c120-step-heading">{uiText(locale, '步驟 4：執行一次，再修正一次', 'Step 4: run once, then revise once')}</h3>
        <details className="c120-step-details" open={state.labCBaselineSeen}><summary>{uiText(locale, 'baseline 後的兩次執行', 'The two runs after the baseline')}</summary>
        <div className="c120-button-row"><button id="c120-lab-c-run" className="c120-run" type="button" aria-describedby={completionIssue?.fieldId === 'c120-lab-c-run' ? 'c120-completion-error' : undefined} disabled={!state.labCPredictionFrozen || !state.labCBaselineSeen || matchingFirstRun === undefined || state.labCFirstRunDone} onClick={() => { if (matchingFirstRun?.input.surface === 'lab-c') { onState({ ...state, labCFirstRunSlots: state.labCSlots, labCFirstRunDone: true }); onRunInput(matchingFirstRun.input); } }}>{uiText(locale, '執行一次排程', 'Run schedule once')}</button><button id="c120-lab-c-revise" type="button" aria-describedby={completionIssue?.fieldId === 'c120-lab-c-revise' ? 'c120-completion-error' : undefined} disabled={!state.labCFirstRunDone || state.labCRevisionApplied || revisionReplay === undefined || JSON.stringify(state.labCFirstRunSlots) === JSON.stringify(state.labCSlots)} onClick={() => { if (revisionReplay?.input.surface === 'lab-c') { onState({ ...state, labCRevisionApplied: true }); onRunInput(revisionReplay.input); } }}>{uiText(locale, '凍結一次修正並揭露 held-out 事件', 'Freeze one revision + reveal held-out event')}</button></div>
        </details>
        {runError && <div className="c120-alert" role="alert"><strong>{uiText(locale, '排程未被接受', 'Schedule not accepted')}</strong><p>{errorText(locale, runError)}</p><button type="button" onClick={() => { onScaffold('lab-c:autofill:documented-recovery'); onState({ ...state, labCSlots: ['fixed-contact', 'wait', 'batch-periodic', 'fixed-outage', 'flush-batch', 'sleep'], labCFirstRunDone: false, labCRevisionApplied: false }); }}>{uiText(locale, '載入文件化復原排程', 'Load documented recovery schedule')}</button></div>}
        <ReplayResult replay={labCReplay}/>
        {labCReplay && labCReplay.cardLedger.length > 0 && <details className="c120-worked-example"><summary>{uiText(locale, '查看權威 Lab C 卡片帳本', 'View authoritative Lab C card ledger')}</summary><div className="c120-table-scroll" tabIndex={0} aria-label={uiText(locale, '可捲動的權威 Lab C 卡片帳本', 'Scrollable authoritative Lab C card ledger')}><table><caption>{uiText(locale, 'provider 擁有的卡片時間順序；所有數值共享回放身分。', 'Provider-owned card chronology; all values share the replay identity.')}</caption><thead><tr><th scope="col">{uiText(locale, '卡片', 'card')}</th><th scope="col">{uiText(locale, '產生', 'generated')}</th><th scope="col">{uiText(locale, '傳送', 'sent')}</th><th scope="col">{uiText(locale, '收到', 'received')}</th><th scope="col">{uiText(locale, '狀態', 'state')}</th><th scope="col">{uiText(locale, '服務', 'service')}</th><th scope="col">{uiText(locale, '新鮮度', 'freshness')}</th><th scope="col">J</th><th scope="col">{uiText(locale, '預算', 'budget')}</th><th scope="col">bit</th><th scope="col">bit/J</th></tr></thead><tbody>{labCReplay.cardLedger.map(row => <tr key={row.cardId}><th scope="row">{row.cardId}</th><td>{row.generatedAtSec} s</td><td>{row.sentAtSec === null ? uiText(locale, '未傳送', 'not sent') : `${row.sentAtSec} s`}</td><td>{row.receivedAtSec === null ? uiText(locale, '未收到', 'not received') : `${row.receivedAtSec} s`}</td><td>{row.state}</td><td>{row.servicePass ? 'PASS' : 'FAIL'}</td><td>{row.freshnessStatus}</td><td>{row.consumedEnergyJ} J</td><td>{row.budgetRemainingJ} J</td><td>{row.deliveredBits} bit</td><td>{row.energyEfficiencyBitsPerJ} bit/J</td></tr>)}</tbody></table></div></details>}
        <details id="c120-lab-c-fast" className="c120-fast-branch"><summary>{uiText(locale, '可選的後果比較', 'Optional consequential comparison')}</summary><p>{uiText(locale, '回放立即傳送的 provider baseline，再回到凍結修正版，在同一任務契約下比較服務與能量。', 'Replay the send-immediately provider baseline, then return to your frozen revision to compare service and energy under the same mission contract.')}</p><button type="button" disabled={!state.labCRevisionApplied} onClick={() => { onState({ ...state, labCFastBranchAnswer: 'service-before-saving' }); onRunInput(scenario.labC.replays[0]!.input); }}>{uiText(locale, '回放 baseline 反例', 'Replay baseline counterexample')}</button>{state.labCFastBranchAnswer && <small>{teach(content.surpriseBranch.observation)}</small>}</details>
        <ShortResponse responseKey="labCClause" label="5 / 8 / Schedule clause" responses={responses} onResponse={onResponse} issue={completionIssue}/>
        <SegmentComplete segment="lab-c" onComplete={onComplete} complete={alreadyComplete} issue={completionIssue}/>
      </section>
    );
  }

  if (activeSegment === 'clinic') {
    const cardsReady = scenario.clinic.featureCards.every(card => state.clinicAvailability[card.id] === (card.availableAtDecisionTime ? 'available' : 'leaky'));
    const rightReplay = activeReplay?.input.surface === 'clinic' && activeReplay.input.actionId === state.clinicActionId;
    const content = C120_TEACHING_CONTENT.clinic;
    const selectedFeatureIds = scenario.clinic.featureCards
      .filter(card => state.clinicAvailability[card.id] === 'available')
      .map(card => card.id);
    const featureSetId = scenario.clinic.featureCards.some(card => !card.availableAtDecisionTime && selectedFeatureIds.includes(card.id))
      ? 'post-action-mixed' as const
      : 'decision-time-only' as const;
    const clinicInput = state.clinicActionId === '' ? null : {
      surface: 'clinic' as const,
      missionContractId: 'mission-fixed-service-boundary' as const,
      actionId: state.clinicActionId,
      featureSetId,
      traceId: 'chronological-trace-b' as const,
    };
    const alternateClinicReplay = scenario.clinic.replays.find(replay => replay.input.surface === 'clinic'
      && replay.input.actionId !== state.clinicActionId && replay.input.featureSetId === featureSetId);
    return (
      <section id="c120-learning-workbench" className="c120-workbench" aria-labelledby="c120-segment-title" tabIndex={-1}>
        <div className="c120-section-heading"><span>{uiText(locale, '92-106 / 證據診間', '92-106 / EVIDENCE CLINIC')}</span><h2 id="c120-segment-title" tabIndex={-1}>{uiText(locale, '分數很高，也要先確認資料時間', 'A high score still needs a time check')}</h2><p>{teach(content.question)}</p></div>
        <NoviceScaffold segment="clinic" locale={locale} />
        <details className="c120-worked-example"><summary>{teach(content.workedExample.title)}</summary><p><strong>{teach(content.workedExample.cardLabel)}</strong> / {content.workedExample.timestamp}</p><p>{uiText(locale, '動作前：', 'Before action: ')}{teach(content.workedExample.decisionTimeObservation)}</p><p>{uiText(locale, '動作後：', 'After action: ')}{teach(content.workedExample.afterActionObservation)}</p><fieldset id="c120-clinic-worked" className="c120-inline-choice" aria-invalid={completionIssue?.fieldId === 'c120-clinic-worked' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-clinic-worked' ? 'c120-completion-error' : undefined}><legend>{uiText(locale, '品質／新鮮度快照在決策時刻可用嗎？', 'Was the quality/freshness snapshot available at decision time?')}</legend><label><input type="radio" name="clinic-worked" value="available" checked={state.clinicWorkedAnswer === 'available'} onChange={() => onState({ ...state, clinicWorkedAnswer: 'available' })}/>{uiText(locale, '當時可用', 'Available')}</label><label><input type="radio" name="clinic-worked" value="leaky" checked={state.clinicWorkedAnswer === 'leaky'} onChange={() => onState({ ...state, clinicWorkedAnswer: 'leaky' })}/>{uiText(locale, '動作後才有', 'After action')}</label></fieldset></details>
        <div className="c120-card-grid">{scenario.clinic.featureCards.map((card, index) => {
          const neutral = content.featureCards[index];
          return <label id={`c120-clinic-card-${card.id}`} className="c120-choice-card" key={card.id} aria-invalid={completionIssue?.fieldId === `c120-clinic-card-${card.id}` || undefined} aria-describedby={completionIssue?.fieldId === `c120-clinic-card-${card.id}` ? 'c120-completion-error' : undefined}><strong>{neutral ? teach(neutral.neutralLabel) : `${uiText(locale, '卡片', 'Card')} ${index + 1}`}</strong><small>{neutral ? teach(neutral.timestampLabel) : uiText(locale, '有時間戳的資料列', 'timestamped row')} / {neutral ? teach(neutral.studentPrompt) : uiText(locale, '依決策時間分類。', 'Classify by decision time.')}</small><select name={`clinic-card-${card.id}`} disabled={state.clinicActionFrozen} value={state.clinicAvailability[card.id] ?? ''} onChange={event => onState({ ...state, clinicAvailability: { ...state.clinicAvailability, [card.id]: event.target.value as C120Availability } })}><option value="">{uiText(locale, '分類…', 'Classify…')}</option><option value="available">{uiText(locale, '現在可用', 'Available now')}</option><option value="leaky">{uiText(locale, '凍結動作後', 'After frozen action')}</option></select></label>;
        })}</div>
        {cardsReady && <p className="c120-inline-guidance" role="status">{uiText(locale, '五個時間戳都已分類；現在可以查看答案來源與模型分數比較。', 'All five timestamps are classified. The answer provenance and model-score comparison are now visible.')}</p>}
        <label id="c120-clinic-prediction" className="c120-select-field" aria-invalid={completionIssue?.fieldId === 'c120-clinic-prediction' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-clinic-prediction' ? 'c120-completion-error' : undefined}><span>{uiText(locale, '操作回放前，你預測哪個動作能保護服務門檻？', 'Before operational replay, which action do you predict will protect the service gate?')}</span><select name="clinic-prediction" disabled={state.clinicActionFrozen} value={state.clinicPrediction} onChange={event => onState({ ...state, clinicPrediction: event.target.value })}><option value="">{uiText(locale, '選擇…', 'Choose…')}</option>{content.actionChoices.map(action => <option key={action.id} value={action.id}>{teach(action.neutralLabel)}</option>)}</select></label>
        <ConfidenceChoice id="c120-clinic-confidence" name="clinic-confidence" value={state.clinicPredictionConfidence} disabled={state.clinicActionFrozen} issue={completionIssue} onChange={value => onState({ ...state, clinicPredictionConfidence: value })}/>
        {state.clinicActionFrozen && <div className="c120-score-split" aria-label={uiText(locale, '預測分數，與操作證據分開', 'Prediction scores, separate from operational evidence')}><article><span>{uiText(locale, '決策時刻模型分數', 'DECISION-TIME MODEL SCORE')}</span><strong>{scenario.clinic.honestModelScorePercent}%</strong><small>{uiText(locale, '僅預測證據', 'prediction evidence only')}</small></article><article className="is-warning"><span>{uiText(locale, '動作後感知分數', 'POST-ACTION-AWARE SCORE')}</span><strong>{scenario.clinic.oracleModelScorePercent}%</strong><small>{uiText(locale, '凍結後稽核，不是操作證據', 'Audit after freeze, not operational evidence')}</small></article></div>}
        <div className="c120-card-grid" aria-invalid={completionIssue?.fieldId === 'c120-clinic-freeze' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-clinic-freeze' ? 'c120-completion-error' : undefined}>{scenario.clinic.actions.map((action, index) => <label className="c120-choice-card" key={action.id}><input type="radio" name="clinic-action" value={action.id} disabled={state.clinicActionFrozen} checked={state.clinicActionId === action.id} onChange={() => onState({ ...state, clinicActionId: action.id })}/><strong>{content.actionChoices[index] ? teach(content.actionChoices[index].neutralLabel) : scenarioCopy(locale, action.label)}</strong><small>{content.actionChoices[index] ? teach(content.actionChoices[index].decisionTimeRule) : scenarioCopy(locale, action.description)}</small></label>)}</div>
        <div className="c120-button-row"><button id="c120-clinic-freeze" type="button" aria-describedby={completionIssue?.fieldId === 'c120-clinic-freeze' ? 'c120-completion-error' : undefined} disabled={!cardsReady || state.clinicPrediction === '' || state.clinicPredictionConfidence === '' || state.clinicActionId === '' || state.clinicActionFrozen} onClick={() => onState({ ...state, clinicActionFrozen: true })}>{uiText(locale, '凍結特徵邊界、預測與動作', 'Freeze feature boundary + prediction + action')}</button><button id="c120-clinic-run" className="c120-run" type="button" aria-describedby={completionIssue?.fieldId === 'c120-clinic-run' ? 'c120-completion-error' : undefined} disabled={!state.clinicActionFrozen || clinicInput === null} onClick={() => clinicInput && onRunInput(clinicInput)}>{uiText(locale, '執行時間順序回放', 'Run chronological replay')}</button></div>
        {runError && <p className="c120-alert" role="alert"><strong>{uiText(locale, '回放未被接受', 'Replay not accepted')}</strong>: {errorText(locale, runError)}</p>}
        <ReplayResult replay={rightReplay ? activeReplay : null}/>
        <div className="c120-hint-ladder" aria-label={uiText(locale, '診間腳手架提示', 'Clinic scaffold ladder')}>{content.hints.map(hint => <details key={hint.id}><summary>{uiText(locale, '提示', 'Hint')} {hint.level}</summary><p>{state.clinicHintLevel >= hint.level ? teach(hint.copy) : uiText(locale, '打開後取得提示。', 'Open to reveal the hint.')}</p><button type="button" disabled={state.clinicHintLevel >= hint.level} onClick={() => { onState({ ...state, clinicHintLevel: hint.level }); onScaffold(`clinic:hint-${hint.level}:${hint.id}`); }}>{uiText(locale, '記錄我使用了這個提示', 'Record this hint')}</button></details>)}</div>
        <details id="c120-clinic-fast" className="c120-fast-branch"><summary>{uiText(locale, '可選的後果比較', 'Optional consequential comparison')}</summary><p>{uiText(locale, '保持相同凍結特徵邊界，回放另一個合法動作。', 'Keep the same frozen feature boundary and replay the other legal action.')}</p><button type="button" disabled={!state.clinicActionFrozen || alternateClinicReplay === undefined} onClick={() => { if (alternateClinicReplay) { onState({ ...state, clinicFastBranchAnswer: 'score-can-fail-service' }); onRunInput(alternateClinicReplay.input); } }}>{uiText(locale, '執行另一個凍結動作', 'Run alternate frozen action')}</button>{state.clinicFastBranchAnswer && <small>{teach(content.distributionShift.observation)} {uiText(locale, '請重新執行你選的動作，再鎖定核心判斷。', 'Re-run your chosen action before locking the core verdict.')}</small>}</details>
        <ShortResponse responseKey="clinicClause" label="6 / 8 / Leakage diagnosis" responses={responses} onResponse={onResponse} issue={completionIssue}/>
        <SegmentComplete segment="clinic" onComplete={onComplete} complete={alreadyComplete} issue={completionIssue}/>
      </section>
    );
  }

  const transferContent = C120_TEACHING_CONTENT.transfer;
  const ideaCard = buildC120IdeaCard(state, scenario, responses);
  return (
    <section id="c120-learning-workbench" className="c120-workbench" aria-labelledby="c120-segment-title" tabIndex={-1}>
      <div className="c120-section-heading"><span>{uiText(locale, '106-120 / 競賽轉移', '106-120 / COMPETITION TRANSFER')}</span><h2 id="c120-segment-title" tabIndex={-1}>{uiText(locale, '把這套方法帶到另一個問題', 'Carry this method into another problem')}</h2><p>{teach(transferContent.question)}</p></div>
      <NoviceScaffold segment="transfer" locale={locale} />
      <h3 className="c120-step-heading">{uiText(locale, '步驟 1：看懂格式，再選新領域', 'Step 1: read the format, then choose a new domain')}</h3>
      <details className="c120-worked-example"><summary>{uiText(locale, '完成格式示例：', 'Completed format example: ')}{teach(transferContent.workedFormatExample.domainLabel)}</summary><p>{teach(transferContent.workedFormatExample.fixtureLabel)}</p><dl className="c120-idea-card">{transferContent.workedFormatExample.exampleFields.map(field => <div key={field.fieldId}><dt>{field.fieldId}</dt><dd>{teach(field.example)}</dd></div>)}</dl><p>{teach(transferContent.workedFormatExample.note)}</p></details>
      <div className="c120-transfer-grid"><label id="c120-transfer-domain" aria-invalid={completionIssue?.fieldId === 'c120-transfer-domain' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-transfer-domain' ? 'c120-completion-error' : undefined}><span>{uiText(locale, '尚未看過的轉移領域 / 選擇', 'Unseen transfer domain / SELECT')}</span><select name="transfer-domain" value={state.transferDomainId} onChange={event => onState({ ...state, transferDomainId: event.target.value })}><option value="">{uiText(locale, '選擇…', 'Choose…')}</option>{transferContent.unseenDomainChoices.map(domain => <option key={domain.id} value={domain.id}>{teach(domain.label)} / {teach(domain.prompt)}</option>)}</select></label>
      </div>
      <h3 className="c120-step-heading">{uiText(locale, '步驟 2：提取可比較的條件', 'Step 2: retrieve the comparison conditions')}</h3>
      <details className="c120-step-details" open={state.transferDomainId !== ''}><summary>{uiText(locale, '完成領域選擇後打開四個提取題', 'Open the four retrieval checks after choosing a domain')}</summary>
      <label id="c120-transfer-retrieval" aria-invalid={completionIssue?.fieldId === 'c120-transfer-retrieval' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-transfer-retrieval' ? 'c120-completion-error' : undefined}><span>{uiText(locale, '提取關鍵比較門檻', 'Retrieve the key comparison gate')}</span><select name="transfer-retrieval" value={state.retrievalAnswerId} onChange={event => onState({ ...state, retrievalAnswerId: event.target.value })}><option value="">{uiText(locale, '選擇…', 'Choose…')}</option><option value="same-boundary">{uiText(locale, '相同工作＋相同期限＋系統邊界', 'Same job + same deadline + system boundary')}</option><option value="rate-only">{uiText(locale, '只看最高速率', 'Highest rate only')}</option><option value="score-only">{uiText(locale, '只看最高模型分數', 'Highest model score only')}</option></select></label>
      <div className="c120-transfer-grid c120-retrieval-checks">
        <label id="c120-transfer-retrieval-power" aria-invalid={completionIssue?.fieldId === 'c120-transfer-retrieval-power' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-transfer-retrieval-power' ? 'c120-completion-error' : undefined}><span>{uiText(locale, '低 W 與低 J', 'Low W versus low J')}</span><select name="transfer-retrieval-power" value={state.retrievalPowerEnergyId} onChange={event => onState({ ...state, retrievalPowerEnergyId: event.target.value })}><option value="">{uiText(locale, '選擇…', 'Choose…')}</option><option value="read-both">{uiText(locale, '在一個服務邊界下讀 W 與 J。', 'Read W and J under one service boundary.')}</option><option value="low-w-only">{uiText(locale, '只選最低 W。', 'Choose the lowest W only.')}</option></select></label>
        <label id="c120-transfer-retrieval-dynamic" aria-invalid={completionIssue?.fieldId === 'c120-transfer-retrieval-dynamic' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-transfer-retrieval-dynamic' ? 'c120-completion-error' : undefined}><span>{uiText(locale, '動態策略檢查', 'Dynamic policy check')}</span><select name="transfer-retrieval-dynamic" value={state.retrievalDynamicPolicyId} onChange={event => onState({ ...state, retrievalDynamicPolicyId: event.target.value })}><option value="">{uiText(locale, '選擇…', 'Choose…')}</option><option value="state-changes-action">{uiText(locale, '決策時刻狀態改變凍結動作。', 'Decision-time state changes the frozen action.')}</option><option value="animation">{uiText(locale, '畫面會動。', 'The screen animates.')}</option></select></label>
        <label id="c120-transfer-retrieval-saving" aria-invalid={completionIssue?.fieldId === 'c120-transfer-retrieval-saving' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-transfer-retrieval-saving' ? 'c120-completion-error' : undefined}><span>{uiText(locale, '預測與節省', 'Prediction versus saving')}</span><select name="transfer-retrieval-saving" value={state.retrievalPredictionSavingId} onChange={event => onState({ ...state, retrievalPredictionSavingId: event.target.value })}><option value="">{uiText(locale, '選擇…', 'Choose…')}</option><option value="separate-evidence">{uiText(locale, '預測分數與操作回放是分開的證據。', 'Prediction score and operational replay are separate evidence.')}</option><option value="score-is-energy">{uiText(locale, '準確度就是能量結果。', 'Accuracy is the energy result.')}</option></select></label>
        <label id="c120-transfer-pathway" aria-invalid={completionIssue?.fieldId === 'c120-transfer-pathway' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-transfer-pathway' ? 'c120-completion-error' : undefined}><span>{uiText(locale, '帶走的功率和時間路徑', 'Power and time pathway carried forward')}</span><select name="transfer-pathway" value={state.powerTimePathwayId} onChange={event => onState({ ...state, powerTimePathwayId: event.target.value })}><option value="">{uiText(locale, '選擇…', 'Choose…')}</option><option value="active-idle">{uiText(locale, '主動／閒置時間', 'active / idle time')}</option><option value="fixed-wakeup">{uiText(locale, '固定／喚醒成本列', 'fixed / wake cost rows')}</option><option value="state-switch">{uiText(locale, '狀態／切換持續時間', 'state / switching duration')}</option></select></label>
      </div>
      </details>
      <h3 className="c120-step-heading">{uiText(locale, '步驟 3：修正一次並寫下證據', 'Step 3: revise once and write the evidence')}</h3>
      <label id="c120-transfer-what-if" className="c120-select-field" aria-invalid={completionIssue?.fieldId === 'c120-transfer-what-if' || undefined} aria-describedby={completionIssue?.fieldId === 'c120-transfer-what-if' ? 'c120-completion-error' : undefined}><span>{teach(transferContent.whatIfPrompt)}</span><select name="transfer-what-if" value={state.transferWhatIfId} onChange={event => onState({ ...state, transferWhatIfId: event.target.value })}><option value="">{uiText(locale, '選擇唯一允許的修正…', 'Choose the one permitted revision…')}</option><option value="revise-held-out">{uiText(locale, '在看到結果前修正 held-out 案例。', 'Revise the held-out case before seeing its result.')}</option><option value="retune-result">{uiText(locale, '看到結果後重新調參。', 'Retune after seeing the result.')}</option></select></label>
      <div className="c120-idea-chain" aria-label={uiText(locale, '累積決策鏈', 'Cumulative decision chain')}><span>{uiText(locale, '邊界', 'BOUNDARY')}</span><b>→</b><span>{uiText(locale, '預測', 'PREDICT')}</span><b>→</b><span>{uiText(locale, '凍結', 'FREEZE')}</span><b>→</b><span>{uiText(locale, '回放', 'REPLAY')}</span><b>→</b><span>{uiText(locale, '修正', 'REVISE')}</span></div>
      <details className="c120-worked-example"><summary>{uiText(locale, '查看累積 Energy Decision Idea Card', 'View cumulative Energy Decision Idea Card')}</summary>
      <section className="c120-idea-card-wrap" aria-labelledby="c120-idea-card-title"><span className="c120-eyebrow">{uiText(locale, '能量決策 idea card / 8 個語意欄位', 'ENERGY DECISION IDEA CARD / 8 SEMANTIC FIELDS')}</span><h3 id="c120-idea-card-title">{uiText(locale, '累積產物', 'Cumulative artifact')}</h3><dl className="c120-idea-card">{ideaCard.map(field => <div key={field.id}><dt>{scenarioCopy(locale, field.label)}<small>{field.mode}</small></dt><dd>{scenarioCopy(locale, field.value)}</dd></div>)}</dl></section>
      </details>
      <ShortResponse responseKey="competitionHypothesis" label="7 / 8 / Transfer hypothesis" responses={responses} onResponse={onResponse} issue={completionIssue}/>
      <ShortResponse responseKey="falsifier" label="8 / 8 / Falsifier" responses={responses} onResponse={onResponse} issue={completionIssue}/>
      <SegmentComplete segment="transfer" onComplete={onComplete} complete={alreadyComplete} issue={completionIssue}/>
    </section>
  );
}
