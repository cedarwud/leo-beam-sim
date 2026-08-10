import type { ReactNode } from 'react';

import {
  C120_CLAIM_BOUNDARY,
  type C120AuthoritativeReplay,
  type C120Evidence,
  type C120ReplayFrame,
  type C120UnitContract,
} from './contract';
import { useC120Locale } from './i18n';

type C120Text = (zhHant: string, en: string) => string;

/**
 * A read-only view over values that already arrived in an authoritative C-120
 * replay.  This component deliberately contains no scientific calculation:
 * even values that look derivable (budget remaining, bit/J, or cumulative J)
 * are rendered verbatim from the provider frame.
 */
export interface C120EvidenceLedgerProps {
  readonly replay?: C120AuthoritativeReplay | null;
  readonly currentFrameIndex?: number;
  readonly onFrameSelect?: (frameIndex: number) => void;
  readonly ledgerDefaultOpen?: boolean;
  readonly heading?: string;
  readonly className?: string;
}

function providerValue(value: number | string): string {
  return String(value);
}

function metric(value: number, unit: string, label: string): ReactNode {
  return (
    <span className="c120-evidence-ledger__value c120-evidence-ledger__value--long" data-unit={unit}>
      <data value={providerValue(value)} aria-label={`${label}: ${providerValue(value)} ${unit}`}>
        {providerValue(value)}
      </data>
      <span className="c120-evidence-ledger__unit" aria-hidden="true"> {unit}</span>
    </span>
  );
}

function status(value: boolean, passLabel: string, failLabel: string): ReactNode {
  return (
    <span
      className={`c120-evidence-ledger__status ${value ? 'c120-evidence-ledger__status--pass' : 'c120-evidence-ledger__status--fail'}`}
      data-status={value ? 'pass' : 'fail'}
    >
      {value ? passLabel : failLabel}
    </span>
  );
}

function freshnessLabel(value: C120Evidence['freshnessStatus'], text: C120Text): string {
  if (value === 'not-applicable') return text('不適用', 'not applicable');
  if (value === 'fresh') return text('在時限內', 'fresh');
  if (value === 'stale') return text('已過時限', 'stale');
  return value;
}

function warningValue(frame: C120ReplayFrame, text: C120Text): ReactNode {
  if (frame.evidence.warningCodes.length === 0) {
    return <span className="c120-evidence-ledger__value">{text('無', 'none')}</span>;
  }
  return (
    <span className="c120-evidence-ledger__value c120-evidence-ledger__value--long" data-warning-codes={frame.evidence.warningCodes.join('|')}>
      {frame.evidence.warningCodes.join(', ')}
    </span>
  );
}

function frameIdentity(frame: C120ReplayFrame): ReactNode {
  return (
    <span className="c120-evidence-ledger__provenance" data-provenance="frame-identity">
      <span>{frame.identity.providerKind} · {frame.identity.providerId}</span>
      <span className="c120-evidence-ledger__value c120-evidence-ledger__value--long">{frame.identity.replayInputId}</span>
      <span className="c120-evidence-ledger__value c120-evidence-ledger__value--long">{frame.identity.frameId}</span>
    </span>
  );
}

function renderFrameSelector(
  frame: C120ReplayFrame,
  selected: boolean,
  onFrameSelect: C120EvidenceLedgerProps['onFrameSelect'],
  text: C120Text,
): ReactNode {
  if (onFrameSelect === undefined) {
    return <span className="c120-evidence-ledger__frame-label">{text('畫面', 'Frame')} {frame.frameIndex + 1}{selected ? ` · ${text('目前', 'Current')}` : ''}</span>;
  }
  return (
    <button
      type="button"
      className="c120-evidence-ledger__frame-button"
      aria-current={selected ? 'true' : undefined}
      aria-label={text(
        `顯示重播畫面 ${frame.frameIndex + 1}，經過 ${providerValue(frame.elapsedSec)} ${frame.identity.units.elapsedTime}`,
        `Show replay frame ${frame.frameIndex + 1}, elapsed ${providerValue(frame.elapsedSec)} ${frame.identity.units.elapsedTime}`,
      )}
      onClick={() => onFrameSelect(frame.frameIndex)}
    >
      {text('畫面', 'Frame')} {frame.frameIndex + 1}{selected && <span className="c120-current-marker"> · {text('目前', 'Current')}</span>}
    </button>
  );
}

function FrameRow({
  frame,
  selected,
  onFrameSelect,
  text,
}: {
  readonly frame: C120ReplayFrame;
  readonly selected: boolean;
  readonly onFrameSelect: C120EvidenceLedgerProps['onFrameSelect'];
  readonly text: C120Text;
}): ReactNode {
  const { evidence } = frame;
  const units = frame.identity.units;
  return (
    <tr
      className={selected ? 'c120-evidence-ledger__row c120-evidence-ledger__row--current' : 'c120-evidence-ledger__row'}
      data-current-frame={selected ? 'true' : 'false'}
      aria-current={selected ? 'true' : undefined}
    >
      <th scope="row" className="c120-evidence-ledger__frame">
        {renderFrameSelector(frame, selected, onFrameSelect, text)}
        <span className="c120-evidence-ledger__value c120-evidence-ledger__value--long">{frame.identity.frameId}</span>
      </th>
      <td>{metric(frame.elapsedSec, units.elapsedTime, text('經過時間', 'Elapsed time'))}</td>
      <td>
        <span className="c120-evidence-ledger__action">{frame.actionLabel}</span>
        <span className="c120-evidence-ledger__state">{frame.stateLabel}</span>
        <span className="c120-evidence-ledger__quality">{frame.qualityLabel}</span>
      </td>
      <td>{status(evidence.servicePass, text('達標', 'PASS'), text('未達標', 'FAIL'))}</td>
      <td>{status(evidence.deadlinePass, text('達標', 'PASS'), text('未達標', 'FAIL'))}</td>
      <td>{freshnessLabel(evidence.freshnessStatus, text)}</td>
      <td>{metric(evidence.systemPowerW, units.power, text('系統功率', 'System power'))}</td>
      <td>{metric(evidence.consumedEnergyJ, units.consumedEnergy, text('已消耗能量', 'Consumed energy'))}</td>
      <td>{metric(evidence.deliveredBits, units.deliveredData, text('已送達資料', 'Delivered data'))}</td>
      <td>{metric(evidence.energyEfficiencyBitsPerJ, units.energyEfficiency, text('能源效率', 'Energy efficiency'))}</td>
      <td>
        <span className="c120-evidence-ledger__value c120-evidence-ledger__value--long" data-budget-remaining={providerValue(evidence.budgetRemainingJ)}>
          {metric(evidence.energyBudgetJ, units.energyBudget, text('能量預算', 'Energy budget'))}
          <span className="c120-evidence-ledger__subvalue">
            {text('剩餘', 'remaining')} {metric(evidence.budgetRemainingJ, units.energyBudget, text('剩餘能量', 'Budget remaining'))}
          </span>
        </span>
      </td>
      <td>{metric(evidence.activeTimeSec, units.activeTime, text('運作時間', 'Active time'))}</td>
      <td>
        <span className="c120-evidence-ledger__value">{providerValue(evidence.switchCount)} {text('次切換', 'switches')}</span>
        <span className="c120-evidence-ledger__value">{providerValue(evidence.wakeCount)} {text('次喚醒', 'wakes')}</span>
      </td>
      <td>{warningValue(frame, text)}</td>
      <td>{frameIdentity(frame)}</td>
    </tr>
  );
}

function emptyLedger(heading: string, text: C120Text): ReactNode {
  return (
    <section className="c120-evidence-ledger c120-evidence-ledger--empty" data-testid="c120-evidence-ledger-empty" aria-labelledby="c120-evidence-ledger-heading">
      <h3 id="c120-evidence-ledger-heading">{heading}</h3>
      <p className="c120-evidence-ledger__empty-state">{text('還沒有結果資料。先完成目前題目的選擇並執行結果。', 'No result data is available yet. Complete the current choice and run its result.')}</p>
      <p className="c120-surface-claim">{C120_CLAIM_BOUNDARY}</p>
    </section>
  );
}

export function C120EvidenceLedger({
  replay,
  currentFrameIndex = 0,
  onFrameSelect,
  ledgerDefaultOpen = false,
  heading,
  className,
}: C120EvidenceLedgerProps): ReactNode {
  const { text } = useC120Locale();
  const localizedHeading = heading ?? text('結果的數值證據', 'Numerical evidence for this result');
  const frames = replay?.frames ?? [];
  const currentFrame = frames.find(frame => frame.frameIndex === currentFrameIndex) ?? frames[0];
  if (replay === null || replay === undefined || currentFrame === undefined || frames.length === 0) {
    return emptyLedger(localizedHeading, text);
  }

  const units: C120UnitContract = currentFrame.identity.units;
  const { evidence } = currentFrame;
  const classes = ['c120-evidence-ledger', className].filter(Boolean).join(' ');
  return (
    <section
      className={classes}
      data-testid="c120-evidence-ledger"
      data-scenario-id={replay.identity.scenarioId}
      data-replay-id={replay.replayId}
      aria-labelledby="c120-evidence-ledger-heading"
    >
      <div className="c120-evidence-ledger__header">
        <div>
          <p className="c120-eyebrow">{text('課程資料提供的證據 · 唯讀', 'COURSE-PROVIDED EVIDENCE · READ ONLY')}</p>
          <h3 id="c120-evidence-ledger-heading">{localizedHeading}</h3>
          <p className="c120-evidence-ledger__identity">
            {text('案例', 'scenario')} <span className="c120-evidence-ledger__value c120-evidence-ledger__value--long">{replay.identity.scenarioId}</span>
            {' · '}{text('重播', 'replay')} <span className="c120-evidence-ledger__value c120-evidence-ledger__value--long">{replay.replayId}</span>
          </p>
        </div>
        <p className="c120-surface-claim">{C120_CLAIM_BOUNDARY}</p>
      </div>

      <div className="c120-evidence-ledger__outcome" data-testid="c120-evidence-ledger-current-outcome">
        <div className="c120-evidence-ledger__outcome-heading">
          <span className="c120-eyebrow">{text('目前畫面的結果', 'CURRENT FRAME OUTCOME')}</span>
          <strong>{text('畫面', 'Frame')} {currentFrame.frameIndex + 1} · {currentFrame.stateLabel}</strong>
          <span>{text('動作', 'Action')}：{currentFrame.actionLabel}</span>
        </div>
        <dl className="c120-evidence-ledger__metrics">
          <div><dt>{text('服務', 'Service')}</dt><dd>{status(evidence.servicePass, text('達標', 'PASS'), text('未達標', 'FAIL'))}</dd></div>
          <div><dt>{text('期限', 'Deadline')}</dt><dd>{status(evidence.deadlinePass, text('達標', 'PASS'), text('未達標', 'FAIL'))}</dd></div>
          <div><dt>{text('新鮮度', 'Freshness')}</dt><dd>{freshnessLabel(evidence.freshnessStatus, text)}</dd></div>
          <div><dt>{text('功率', 'Power')}</dt><dd>{metric(evidence.systemPowerW, units.power, text('系統功率', 'System power'))}</dd></div>
          <div><dt>{text('已消耗能量', 'Consumed')}</dt><dd>{metric(evidence.consumedEnergyJ, units.consumedEnergy, text('已消耗能量', 'Consumed energy'))}</dd></div>
          <div><dt>{text('已送達資料', 'Delivered')}</dt><dd>{metric(evidence.deliveredBits, units.deliveredData, text('已送達資料', 'Delivered data'))}</dd></div>
          <div><dt>{text('每焦耳送達量', 'Bit/J')}</dt><dd>{metric(evidence.energyEfficiencyBitsPerJ, units.energyEfficiency, text('能源效率', 'Energy efficiency'))}</dd></div>
        </dl>
      </div>

      <details className="c120-evidence-ledger__details" open={ledgerDefaultOpen}>
        <summary>{text(`查看逐格技術紀錄（${frames.length} 格）`, `Show synchronized frame ledger (${frames.length} frames)`)}</summary>
        <div className="c120-evidence-ledger__table-scroll" tabIndex={0} aria-label={text('可水平捲動的重播證據表', 'Scrollable replay evidence ledger')}>
          <table className="c120-evidence-ledger__table">
            <caption>{text(`重播 ${replay.replayId} 的課程資料；「目前」標記代表與畫面同步的資料列。`, `Course-provided values for ${replay.replayId}; the “Current” marker identifies the synchronized row.`)}</caption>
            <thead>
              <tr>
                <th scope="col">{text('畫面', 'Frame')}</th>
                <th scope="col">{text('經過時間', 'Elapsed')} ({units.elapsedTime})</th>
                <th scope="col">{text('動作 / 狀態', 'Action / state')}</th>
                <th scope="col">{text('服務', 'Service')}</th>
                <th scope="col">{text('期限', 'Deadline')}</th>
                <th scope="col">{text('新鮮度', 'Freshness')}</th>
                <th scope="col">{text('功率', 'Power')} ({units.power})</th>
                <th scope="col">{text('已消耗', 'Consumed')} ({units.consumedEnergy})</th>
                <th scope="col">{text('已送達', 'Delivered')} ({units.deliveredData})</th>
                <th scope="col">bit/J ({units.energyEfficiency})</th>
                <th scope="col">{text('預算', 'Budget')} ({units.energyBudget})</th>
                <th scope="col">{text('運作', 'Active')} ({units.activeTime})</th>
                <th scope="col">{text('切換 / 喚醒', 'Switch / wake')}</th>
                <th scope="col">{text('警告', 'Warnings')}</th>
                <th scope="col">{text('資料來源', 'Provenance')}</th>
              </tr>
            </thead>
            <tbody>
              {frames.map(frame => (
                <FrameRow
                  key={frame.identity.frameId}
                  frame={frame}
                  selected={frame.frameIndex === currentFrame.frameIndex}
                  onFrameSelect={onFrameSelect}
                  text={text}
                />
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
