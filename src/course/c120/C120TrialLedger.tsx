import type { ReactNode } from 'react';

import {
  C120_CLAIM_BOUNDARY,
  C120_UNITS,
  type C120ReplayInput,
  type C120WorkbookReplayRecord,
} from './contract';
import { useC120Locale } from './i18n';

type C120Text = (zhHant: string, en: string) => string;

export type C120TrialCategory = 'baseline' | 'candidate' | 'revision' | 'withheld';

export interface C120TrialLedgerProps {
  readonly records: readonly C120WorkbookReplayRecord[];
  readonly heading?: string;
  readonly className?: string;
}

const CATEGORY_LABELS: Readonly<Record<C120TrialCategory, readonly [string, string]>> = {
  baseline: ['基準', 'Baseline'],
  candidate: ['候選方案', 'Candidate'],
  revision: ['修正版', 'Revision'],
  withheld: ['保留情境', 'Withheld'],
};

function trialCategories(input: C120ReplayInput): readonly C120TrialCategory[] {
  if (input.surface === 'lab-a') return ['candidate'];
  if (input.surface === 'lab-b') return ['withheld'];
  if (input.surface === 'clinic') return ['withheld'];

  const primaryCategory: C120TrialCategory = input.revisionOrdinal === 1
    ? 'revision'
    : input.withheldEvent === 'none' ? 'baseline' : 'candidate';
  return input.withheldEvent === 'none'
    ? [primaryCategory]
    : [primaryCategory, 'withheld'];
}

function actionIdentity(input: C120ReplayInput): string {
  if (input.surface === 'lab-a') {
    return `missionContractId=${input.missionContractId} · candidateId=${input.candidateId} · hiddenConditionId=${input.hiddenConditionId}`;
  }
  if (input.surface === 'lab-b') {
    return `missionContractId=${input.missionContractId} · frozenRuleId=${input.frozenRuleId} · thresholdId=${input.thresholdId} · holdCountId=${input.holdCountId} · lowerThresholdId=${input.lowerThresholdId} · traceId=${input.traceId}`;
  }
  if (input.surface === 'clinic') {
    return `missionContractId=${input.missionContractId} · actionId=${input.actionId} · featureSetId=${input.featureSetId} · traceId=${input.traceId}`;
  }
  return `slots=${input.slots.join(' → ')} · missionContractId=${input.missionContractId} · revisionOrdinal=${input.revisionOrdinal} · withheldEvent=${input.withheldEvent}`;
}

function flag(field: 'service_pass' | 'deadline', value: boolean, text: C120Text): ReactNode {
  return (
    <span
      className={`c120-evidence-ledger__status ${value ? 'c120-evidence-ledger__status--pass' : 'c120-evidence-ledger__status--fail'}`}
      data-field={field}
      data-value={String(value)}
    >
      {field}={value ? text('達標', 'PASS') : text('未達標', 'FAIL')}
    </span>
  );
}

function metric(field: string, value: number, unit: string): ReactNode {
  const text = String(value);
  return (
    <span data-field={field} data-unit={unit} className="c120-evidence-ledger__value">
      <data value={text}>{text}</data> {unit}
    </span>
  );
}

function categoriesMarkup(categories: readonly C120TrialCategory[], text: C120Text): ReactNode {
  return (
    <span className="c120-evidence-ledger__value">
      {categories.map((category, index) => (
        <span key={category} data-trial-category={category}>
          {index > 0 ? ' · ' : ''}{text(...CATEGORY_LABELS[category])}
        </span>
      ))}
    </span>
  );
}

function TrialRow({ record, text }: { readonly record: C120WorkbookReplayRecord; readonly text: C120Text }): ReactNode {
  const categories = trialCategories(record.input);
  const evidence = record.outcome;

  return (
    <tr data-testid="c120-trial-ledger-row" data-trial-categories={categories.join(' ')}>
      <th scope="row">
        {categoriesMarkup(categories, text)}
      </th>
      <td data-surface={record.input.surface}>
        <span className="c120-evidence-ledger__value">surface={record.input.surface}</span>
        <span className="c120-evidence-ledger__value c120-evidence-ledger__value--long">
          action={actionIdentity(record.input)}
        </span>
      </td>
      <td data-provenance="provider-replay">
        <span className="c120-evidence-ledger__value c120-evidence-ledger__value--long">replayId={record.replayId}</span>
        <span className="c120-evidence-ledger__value c120-evidence-ledger__value--long">replayInputId={record.replayInputId}</span>
      </td>
      <td>{flag('service_pass', evidence.servicePass, text)}</td>
      <td>{flag('deadline', evidence.deadlinePass, text)}</td>
      <td data-field="freshness">freshness={evidence.freshnessStatus}</td>
      <td>{metric('active_seconds', evidence.activeTimeSec, C120_UNITS.activeTime)}</td>
      <td>{metric('power', evidence.systemPowerW, C120_UNITS.power)}</td>
      <td>{metric('consumed_energy', evidence.consumedEnergyJ, C120_UNITS.consumedEnergy)}</td>
      <td>{metric('budget_remaining', evidence.budgetRemainingJ, C120_UNITS.energyBudget)}</td>
      <td>{metric('delivered_data', evidence.deliveredBits, C120_UNITS.deliveredData)}</td>
      <td>{metric('energy_efficiency', evidence.energyEfficiencyBitsPerJ, C120_UNITS.energyEfficiency)}</td>
      <td>{metric('switch_count', evidence.switchCount, 'count')}</td>
      <td>{metric('wake_count', evidence.wakeCount, 'count')}</td>
    </tr>
  );
}

function emptyLedger(heading: string, text: C120Text): ReactNode {
  return (
    <section
      className="c120-evidence-ledger c120-trial-ledger c120-evidence-ledger--empty"
      data-testid="c120-trial-ledger-empty"
      aria-label={heading}
      role="status"
    >
      <h3>{heading}</h3>
      <p className="c120-evidence-ledger__empty-state">
        {text('目前還沒有可比較的結果。完成一次選擇與重播後，這裡會保留基準、候選方案、修正版或保留情境的紀錄。', 'There are no comparable results yet. Complete one decision replay to record baseline, candidate, revision, or withheld evidence.')}
      </p>
      <p className="c120-surface-claim">{C120_CLAIM_BOUNDARY}</p>
    </section>
  );
}

export function C120TrialLedger({
  records,
  heading,
  className,
}: C120TrialLedgerProps): ReactNode {
  const { text } = useC120Locale();
  const localizedHeading = heading ?? text('歷次選擇比較', 'Decision trial comparison');
  if (records.length === 0) return emptyLedger(localizedHeading, text);

  const classes = ['c120-evidence-ledger', 'c120-trial-ledger', className].filter(Boolean).join(' ');
  return (
    <section className={classes} data-testid="c120-trial-ledger" aria-label={localizedHeading} data-record-count={records.length}>
      <div className="c120-evidence-ledger__header">
        <div>
          <p className="c120-eyebrow">{text('課程重播比較 · 唯讀', 'COURSE REPLAY COMPARISON · READ ONLY')}</p>
          <h3>{localizedHeading}</h3>
          <p className="c120-evidence-ledger__identity">{text('下列數值直接顯示課程資料提供的結果，瀏覽器沒有重新套用科學公式。', 'Values below are displayed directly from course-provided outcomes; the browser does not reapply scientific formulas.')}</p>
        </div>
        <p className="c120-surface-claim">{C120_CLAIM_BOUNDARY}</p>
      </div>

      <div className="c120-evidence-ledger__table-scroll" tabIndex={0} aria-label={text('可水平捲動的歷次選擇比較表', 'Scrollable decision trial comparison')}>
        <table className="c120-evidence-ledger__table">
          <caption>{text('C-120 課程重播比較：基準、候選方案、修正版與保留情境。科學數值未在瀏覽器中重新計算。', 'C-120 course replay comparison: baseline, candidate, revision, and withheld trials. Scientific values are displayed without browser calculation.')}</caption>
          <thead>
            <tr>
              <th scope="col">{text('結果類型', 'Trial category')}</th>
              <th scope="col">{text('題目 / 動作識別', 'Surface / action identity')}</th>
              <th scope="col">{text('重播來源', 'Replay provenance')}</th>
              <th scope="col">service_pass</th>
              <th scope="col">{text('期限', 'Deadline')}</th>
              <th scope="col">{text('新鮮度', 'Freshness')}</th>
              <th scope="col">{text('運作時間', 'Active')} (s)</th>
              <th scope="col">{text('功率', 'Power')} (W)</th>
              <th scope="col">{text('已消耗', 'Consumed')} (J)</th>
              <th scope="col">{text('剩餘預算', 'Budget remaining')} (J)</th>
              <th scope="col">{text('已送達', 'Delivered')} (bit)</th>
              <th scope="col">Bit/J (bit/J)</th>
              <th scope="col">{text('切換次數', 'Switches')} (count)</th>
              <th scope="col">{text('喚醒次數', 'Wakes')} (count)</th>
            </tr>
          </thead>
          <tbody>
            {records.map(record => <TrialRow key={record.replayInputId} record={record} text={text} />)}
          </tbody>
        </table>
      </div>
    </section>
  );
}
