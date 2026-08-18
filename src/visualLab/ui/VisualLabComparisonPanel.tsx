import type { CSSProperties, ReactElement } from 'react';
import type {
  ComparisonClassification,
  ComparisonMetricDelta,
  ComparisonView,
} from '../comparison';
import { VISUAL_LAB_INPUT_DEFINITIONS, type VisualLabLocale } from '../experiment';
import {
  formatBits,
  formatEnergy,
  formatEnergyEfficiency,
  formatPower,
  formatRate,
} from '../format';

/**
 * A presentation-only A/B comparison of the accepted visual-lab read model.
 *
 * This component deliberately does not calculate a second frame.  The
 * session owns the comparison and supplies immutable deltas; the panel only
 * makes the provenance, changed inputs, and available metrics legible.
 */
export interface VisualLabComparisonPanelProps {
  readonly comparison: ComparisonView | null | undefined;
  readonly locale: VisualLabLocale;
  readonly theme?: 'dark' | 'light';
  /** Whether an accepted current frame exists and can become baseline A. */
  readonly canSaveBaseline?: boolean;
  readonly onSaveBaseline: () => void;
  readonly onClearBaseline: () => void;
  readonly savingBaseline?: boolean;
  readonly className?: string;
}

type LocalizedCopy = Readonly<{ readonly 'zh-Hant': string; readonly en: string }>;

const localized = (zhHant: string, en: string): LocalizedCopy => Object.freeze({ 'zh-Hant': zhHant, en });

const COPY = Object.freeze({
  eyebrow: localized('控制比較', 'Controlled comparison'),
  title: localized('A／B 結果比較', 'A/B result comparison'),
  description: localized(
    '先儲存 A；調整一個參數後，B 會在新結果通過核對時自動更新。',
    'Save A first; after one parameter change, B updates automatically when the new result passes the comparison gates.',
  ),
  saveA: localized('儲存為基準 A', 'Save as baseline A'),
  replaceA: localized('更新基準 A', 'Update baseline A'),
  clearA: localized('清除基準 A', 'Clear baseline A'),
  baseline: localized('基準 A', 'Baseline A'),
  current: localized('目前 B', 'Current B'),
  changedInputs: localized('已改變的輸入', 'Changed inputs'),
  noChangedInputs: localized('沒有改變的輸入', 'No inputs changed'),
  identical: localized('兩組輸入相同；結果可用來核對。', 'The inputs are identical; use this as a comparison check.'),
  causal: localized('只改變一個輸入；可檢視這個單一變因與結果的連動。', 'One input changed; inspect how this single input moves the results.'),
  exploratory: localized('改變了多個輸入；只呈現結果差異，不歸因於單一變因。', 'Multiple inputs changed; results are shown without attributing them to one cause.'),
  unavailableTitle: localized('目前無法比較', 'Comparison unavailable'),
  unavailableNoBaseline: localized('請先建立基準 A，才能比較目前結果。', 'Save a baseline A before comparing the current result.'),
  unavailableNoCandidate: localized('基準 A 已保存；套用新的參數或場景後才會有 B。', 'Baseline A is saved; apply a new parameter or scene to create B.'),
  unavailableMismatch: localized('兩筆資料的來源或場景不一致，暫不顯示數值差異。', 'The two data sources or scenes do not match, so numeric differences are withheld.'),
  unavailableCandidate: localized('目前沒有可接受的 B 結果。', 'There is no accepted candidate B result yet.'),
  gateHint: localized('A／B 需使用同一星座、時刻、TLE frame 與鏈路身份；只比較通過核對的參數變更。', 'A/B requires the same constellation, instant, TLE frame, and link identity; only accepted parameter changes are compared.'),
  metrics: localized('可比較的結果', 'Comparable results'),
  delta: localized('差值（B − A）', 'Delta (B − A)'),
  throughput: localized('總吞吐量', 'Total throughput'),
  systemPower: localized('系統功率', 'System power'),
  instantaneousEe: localized('瞬時 EE', 'Instantaneous EE'),
  cumulativeEe: localized('累積 EE', 'Cumulative EE'),
  deliveredBits: localized('累積傳送資料量', 'Accumulated delivered data'),
  consumedEnergy: localized('累積消耗能量', 'Accumulated consumed energy'),
  noValue: localized('—', '—'),
  baselineSaved: localized('已保存 A', 'A saved'),
  noBaseline: localized('尚未建立 A', 'A not saved'),
  currentBAuto: localized('目前 B（自動更新）', 'Current B (auto)'),
  currentBHint: localized('B 不是另一筆手動保存的資料；它是最新一筆通過核對的 accepted 結果。', 'B is not a second manual save; it is the latest accepted result that passes the comparison gates.'),
} as const);

type MetricId =
  | 'totalThroughputBps'
  | 'systemPowerW'
  | 'instantaneousEeBitsPerJ'
  | 'cumulativeEeBitsPerJ'
  | 'deliveredBits'
  | 'consumedJoules';

interface MetricDefinition {
  readonly id: MetricId;
  readonly label: LocalizedCopy;
  readonly format: (value: number | null) => string;
  readonly tone: 'service' | 'energy';
}

const METRICS: readonly MetricDefinition[] = Object.freeze([
  { id: 'totalThroughputBps', label: COPY.throughput, format: formatRate, tone: 'service' },
  { id: 'systemPowerW', label: COPY.systemPower, format: formatPower, tone: 'service' },
  { id: 'instantaneousEeBitsPerJ', label: COPY.instantaneousEe, format: formatEnergyEfficiency, tone: 'energy' },
  { id: 'cumulativeEeBitsPerJ', label: COPY.cumulativeEe, format: formatEnergyEfficiency, tone: 'energy' },
  { id: 'deliveredBits', label: COPY.deliveredBits, format: formatBits, tone: 'energy' },
  { id: 'consumedJoules', label: COPY.consumedEnergy, format: formatEnergy, tone: 'energy' },
]);

function text(copy: LocalizedCopy, locale: VisualLabLocale): string {
  return copy[locale];
}

function signedMetric(definition: MetricDefinition, value: number | null, locale: VisualLabLocale): string {
  if (value === null || !Number.isFinite(value)) return text(COPY.noValue, locale);
  const absolute = definition.format(Math.abs(value));
  return `${value >= 0 ? '+' : '−'}${absolute}`;
}

function classificationCopy(classification: ComparisonClassification | null, locale: VisualLabLocale): string | null {
  if (classification === 'identical') return text(COPY.identical, locale);
  if (classification === 'causal') return text(COPY.causal, locale);
  if (classification === 'exploratory') return text(COPY.exploratory, locale);
  return null;
}

function unavailableCopy(comparison: ComparisonView | null | undefined, locale: VisualLabLocale): string {
  if (comparison === null || comparison === undefined) return text(COPY.unavailableCandidate, locale);
  if (comparison.baseline === null) return text(COPY.unavailableNoBaseline, locale);
  if (comparison.candidate === null) return text(COPY.unavailableNoCandidate, locale);
  return text(COPY.unavailableMismatch, locale);
}

function metricDelta(comparison: ComparisonView, id: MetricId): ComparisonMetricDelta {
  return comparison.frame.deltas[id];
}

function MetricCard({
  definition,
  comparison,
  locale,
}: {
  readonly definition: MetricDefinition;
  readonly comparison: ComparisonView;
  readonly locale: VisualLabLocale;
}): ReactElement {
  const delta = metricDelta(comparison, definition.id);
  const label = text(definition.label, locale);
  const a = definition.format(delta.baseline);
  const b = definition.format(delta.candidate);
  const difference = signedMetric(definition, delta.delta, locale);
  return (
    <div className={`vlab-result-item is-${definition.tone}`} data-comparison-metric={definition.id}>
      <span>{label}</span>
      <strong aria-label={`${label}: ${text(COPY.baseline, locale)} ${a}; ${text(COPY.current, locale)} ${b}`}>
        <span>{text(COPY.baseline, locale)} · {a}</span>
        <span>{text(COPY.current, locale)} · {b}</span>
      </strong>
      <small>{text(COPY.delta, locale)} · {difference}</small>
    </div>
  );
}

function ChangedInputs({ comparison, locale }: { readonly comparison: ComparisonView; readonly locale: VisualLabLocale }): ReactElement | null {
  if (comparison.baseline === null || comparison.candidate === null) return null;
  const keys = comparison.changedParameterKeys;
  return (
    <div className="vlab-comparison-panel__inputs" data-comparison-inputs>
      <span>{text(COPY.changedInputs, locale)}</span>
      {keys.length === 0 ? (
        <code>{text(COPY.noChangedInputs, locale)}</code>
      ) : (
        <ul>
          {keys.map((key) => {
            const definition = VISUAL_LAB_INPUT_DEFINITIONS.find((candidate) => candidate.key === key);
            return <li key={key}>
              <span>{definition?.label[locale] ?? key}</span>
              <code>{definition?.symbol ? `${definition.symbol} · ${key}` : key}</code>
            </li>;
          })}
        </ul>
      )}
    </div>
  );
}

export function VisualLabComparisonPanel({
  comparison,
  locale = 'zh-Hant',
  theme = 'dark',
  canSaveBaseline,
  onSaveBaseline,
  onClearBaseline,
  savingBaseline = false,
  className,
}: VisualLabComparisonPanelProps): ReactElement {
  const classNames = ['vlab-result-group', 'vlab-comparison-panel', className].filter(Boolean).join(' ');
  const hasBaseline = comparison?.baseline !== null && comparison?.baseline !== undefined;
  const saveAllowed = canSaveBaseline ?? (comparison?.candidate !== null && comparison?.candidate !== undefined);
  const frameAvailable = comparison?.availability === 'available' && comparison.frame.availability === 'available';
  const classification = frameAvailable ? classificationCopy(comparison.classification, locale) : null;
  const lightFallbackStyle: CSSProperties = {
    color: 'var(--vlab-ink)',
    background: 'var(--vlab-surface)',
    fontSize: '14px',
  };
  return (
    <section
      className={classNames}
      data-theme={theme}
      data-comparison-availability={frameAvailable ? 'available' : 'unavailable'}
      aria-labelledby="vlab-comparison-panel-heading"
      style={lightFallbackStyle}
    >
      <header className="vlab-comparison-panel__header" style={{ padding: '13px 12px', borderBottom: '1px solid var(--vlab-line)' }}>
        <div>
          <p className="vlab-eyebrow">{text(COPY.eyebrow, locale)}</p>
          <h3 id="vlab-comparison-panel-heading" style={{ margin: 0 }}>{text(COPY.title, locale)}</h3>
          <p className="vlab-comparison-panel__description" style={{ margin: '6px 0 0', color: 'var(--vlab-muted)', lineHeight: 1.45 }}>{text(COPY.description, locale)}</p>
        </div>
        <div className="vlab-comparison-panel__actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
          <button
            type="button"
            className="vlab-quiet-button"
            data-comparison-action="save-baseline"
            onClick={onSaveBaseline}
            disabled={!saveAllowed || savingBaseline}
            aria-label={text(hasBaseline ? COPY.replaceA : COPY.saveA, locale)}
            style={{ minHeight: 44 }}
          >
            {text(hasBaseline ? COPY.replaceA : COPY.saveA, locale)}
          </button>
          <button
            type="button"
            className="vlab-quiet-button"
            data-comparison-action="clear-baseline"
            onClick={onClearBaseline}
            disabled={!hasBaseline || savingBaseline}
            aria-label={text(COPY.clearA, locale)}
            style={{ minHeight: 44 }}
          >
            {text(COPY.clearA, locale)}
          </button>
          <span className="vlab-status-chip" role="status" data-comparison-baseline-status>
            {text(hasBaseline ? COPY.baselineSaved : COPY.noBaseline, locale)}
          </span>
          <span className="vlab-status-chip" role="status" data-comparison-candidate-status>
            {text(COPY.currentBAuto, locale)}
          </span>
        </div>
        <p data-comparison-candidate-hint style={{ margin: '10px 12px 0', color: 'var(--vlab-muted)', lineHeight: 1.45 }}>
          {text(COPY.currentBHint, locale)}
        </p>
      </header>

      {!frameAvailable ? (
        <>
          <div className="vlab-comparison-panel__unavailable" data-comparison-unavailable role="status" style={{ padding: '13px 12px', color: 'var(--vlab-muted)', lineHeight: 1.5 }}>
            <strong style={{ display: 'block', color: 'var(--vlab-ink)' }}>{text(COPY.unavailableTitle, locale)}</strong>
            <span>{unavailableCopy(comparison, locale)}</span>
          </div>
          {comparison?.baseline !== null && comparison?.baseline !== undefined && comparison?.candidate !== null && comparison?.candidate !== undefined
            ? <ChangedInputs comparison={comparison} locale={locale} />
            : null}
          <p data-comparison-gate-hint style={{ margin: '10px 12px 12px', color: 'var(--vlab-muted)', lineHeight: 1.45 }}>{text(COPY.gateHint, locale)}</p>
        </>
      ) : (
        <>
          <div className="vlab-comparison-panel__classification" data-comparison-classification={comparison.classification ?? 'unavailable'} style={{ padding: '11px 12px', borderBottom: '1px solid var(--vlab-line)', lineHeight: 1.5 }}>
            <strong>{classification}</strong>
          </div>
          <ChangedInputs comparison={comparison} locale={locale} />
          <div className="vlab-comparison-panel__metrics" aria-label={text(COPY.metrics, locale)}>
            <div className="vlab-result-grid" data-comparison-metrics>
              {METRICS.map((definition) => <MetricCard key={definition.id} definition={definition} comparison={comparison} locale={locale} />)}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
