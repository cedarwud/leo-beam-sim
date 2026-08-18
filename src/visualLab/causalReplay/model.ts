import type {
  ComparisonClassification,
  ComparisonMetricDelta,
  ComparisonView,
} from '../comparison';
import {
  VISUAL_LAB_INPUT_DEFINITIONS,
  type VisualLabInputKey,
  type VisualLabLocale,
} from '../experiment';
import {
  formatCompactUnit,
  formatEnergyEfficiency,
  formatPower,
  formatRate,
} from '../format';
import type {
  VisualLabCausalParameterChange,
  VisualLabCausalPhase,
  VisualLabCausalSinrMetric,
  VisualLabCausalStoryId,
} from './types';

export const CAUSAL_REPLAY_PHASES = Object.freeze([
  'baseline',
  'intervention',
  'comparison',
] as const satisfies readonly VisualLabCausalPhase[]);

export const CAUSAL_REPLAY_STORIES = Object.freeze([
  'beamwidth',
  'power-cap',
] as const satisfies readonly VisualLabCausalStoryId[]);

export type CausalReplayMetricId =
  | 'totalThroughputBps'
  | 'systemPowerW'
  | 'instantaneousEeBitsPerJ'
  | 'servingSinrDb';

export interface CausalReplayMetricReadout {
  readonly id: CausalReplayMetricId;
  readonly metric: ComparisonMetricDelta;
}

export interface LocalizedCausalCopy {
  readonly 'zh-Hant': string;
  readonly en: string;
}

const NULL_METRIC: ComparisonMetricDelta = Object.freeze({
  baseline: null,
  candidate: null,
  delta: null,
});

const STORY_TITLES: Readonly<Record<VisualLabCausalStoryId, LocalizedCausalCopy>> = Object.freeze({
  beamwidth: Object.freeze({ 'zh-Hant': '3 dB 波束寬度', en: '3 dB beamwidth' }),
  'power-cap': Object.freeze({ 'zh-Hant': '功率上限', en: 'Power cap' }),
});

const STORY_DESCRIPTIONS: Readonly<Record<VisualLabCausalStoryId, LocalizedCausalCopy>> = Object.freeze({
  beamwidth: Object.freeze({ 'zh-Hant': '完整 3 dB 波束寬度', en: 'Full 3 dB beamwidth' }),
  'power-cap': Object.freeze({ 'zh-Hant': '單波束功率上限', en: 'Per-beam power cap' }),
});

const PHASE_LABELS: Readonly<Record<VisualLabCausalPhase, LocalizedCausalCopy>> = Object.freeze({
  baseline: Object.freeze({ 'zh-Hant': '基準', en: 'Baseline' }),
  intervention: Object.freeze({ 'zh-Hant': '介入', en: 'Intervention' }),
  comparison: Object.freeze({ 'zh-Hant': '比較', en: 'Comparison' }),
});

const METRIC_LABELS: Readonly<Record<CausalReplayMetricId, LocalizedCausalCopy>> = Object.freeze({
  totalThroughputBps: Object.freeze({ 'zh-Hant': '總吞吐量', en: 'Total throughput' }),
  systemPowerW: Object.freeze({ 'zh-Hant': '系統功率', en: 'System power' }),
  instantaneousEeBitsPerJ: Object.freeze({ 'zh-Hant': '瞬時 EE', en: 'Instantaneous EE' }),
  servingSinrDb: Object.freeze({ 'zh-Hant': '服務 SINR', en: 'Serving SINR' }),
});

export function causalStoryTitle(storyId: VisualLabCausalStoryId, locale: VisualLabLocale): string {
  return STORY_TITLES[storyId][locale];
}

export function causalStoryDescription(storyId: VisualLabCausalStoryId, locale: VisualLabLocale): string {
  return STORY_DESCRIPTIONS[storyId][locale];
}

export function causalPhaseLabel(phase: VisualLabCausalPhase, locale: VisualLabLocale): string {
  return PHASE_LABELS[phase][locale];
}

export function causalMetricLabel(metric: CausalReplayMetricId, locale: VisualLabLocale): string {
  return METRIC_LABELS[metric][locale];
}

export function causalClassificationLabel(
  classification: ComparisonClassification | null | undefined,
  locale: VisualLabLocale,
): string {
  if (classification === 'causal') return locale === 'zh-Hant' ? '單一變因' : 'Single-input causal';
  if (classification === 'identical') return locale === 'zh-Hant' ? '相同輸入' : 'Identical inputs';
  if (classification === 'exploratory') return locale === 'zh-Hant' ? '多重變因' : 'Multiple inputs';
  return locale === 'zh-Hant' ? '尚無比較' : 'No comparison';
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function frameIsAvailable(comparison: ComparisonView | null | undefined): comparison is ComparisonView {
  return comparison?.availability === 'available'
    && comparison.frame.availability === 'available';
}

function canonicalServingSinr(comparison: ComparisonView): VisualLabCausalSinrMetric {
  const baseline = finiteOrNull(comparison.baseline?.canonical?.serving?.sinrDb);
  const candidate = finiteOrNull(comparison.candidate?.canonical?.serving?.sinrDb);
  // ComparisonView intentionally has no serving-SINR delta.  Keep the values
  // source-backed and leave delta null unless the owner supplies it.
  return Object.freeze({ baseline, candidate, delta: null });
}

/**
 * Project exactly the four values a causal cue is allowed to display.
 * Missing or withheld frame evidence remains an em dash; no fallback value is
 * inferred from another metric or from a new simulation frame.
 */
export function causalReplayMetrics(
  comparison: ComparisonView | null | undefined,
  servingSinr?: VisualLabCausalSinrMetric | null,
): readonly CausalReplayMetricReadout[] {
  if (!frameIsAvailable(comparison)) {
    return Object.freeze([
      { id: 'totalThroughputBps', metric: NULL_METRIC },
      { id: 'systemPowerW', metric: NULL_METRIC },
      { id: 'instantaneousEeBitsPerJ', metric: NULL_METRIC },
      { id: 'servingSinrDb', metric: NULL_METRIC },
    ] satisfies readonly CausalReplayMetricReadout[]);
  }

  const frame = comparison.frame.deltas;
  const sinr = servingSinr ?? canonicalServingSinr(comparison);
  return Object.freeze([
    { id: 'totalThroughputBps', metric: frame.totalThroughputBps },
    { id: 'systemPowerW', metric: frame.systemPowerW },
    { id: 'instantaneousEeBitsPerJ', metric: frame.instantaneousEeBitsPerJ },
    { id: 'servingSinrDb', metric: sinr },
  ] satisfies readonly CausalReplayMetricReadout[]);
}

function metricTrend(
  metric: CausalReplayMetricId,
  value: number | null,
  locale: VisualLabLocale,
): string {
  if (value === null || !Number.isFinite(value)) return locale === 'zh-Hant' ? '無法判讀' : 'unavailable';
  const stableThreshold = metric === 'servingSinrDb'
    ? 0.05
    : metric === 'totalThroughputBps'
      ? 500_000
      : metric === 'systemPowerW'
        ? 0.01
        : 100_000;
  if (Math.abs(value) <= stableThreshold) return locale === 'zh-Hant' ? '維持' : 'held steady';
  if (value > 0) return locale === 'zh-Hant' ? '提升' : 'increased';
  return locale === 'zh-Hant' ? '下降' : 'decreased';
}

/**
 * Describe only the source-backed deltas already admitted by ComparisonView.
 * The sentence is intentionally withheld when the frame gate is unavailable.
 */
export function causalReplayObservation(
  comparison: ComparisonView | null | undefined,
  phase: VisualLabCausalPhase,
  locale: VisualLabLocale,
  servingSinr?: VisualLabCausalSinrMetric | null,
): string {
  if (phase === 'baseline') {
    return locale === 'zh-Hant'
      ? '先固定基準狀態，記錄吞吐量、系統功率、瞬時 EE 與服務 SINR。'
      : 'Hold the baseline and record throughput, system power, instantaneous EE, and serving SINR.';
  }
  if (phase === 'intervention') {
    return locale === 'zh-Hant'
      ? '只變更上方一個參數，重新建立可比較的結果。'
      : 'Change only the parameter above and rebuild the comparable result.';
  }
  if (!frameIsAvailable(comparison)) {
    return locale === 'zh-Hant'
      ? '這組資料未通過可比較性核對，因此不做因果解讀。'
      : 'This pair did not pass the comparability gates, so no causal reading is shown.';
  }

  const metrics = new Map(causalReplayMetrics(comparison, servingSinr).map(item => [item.id, item.metric]));
  const throughput = metricTrend('totalThroughputBps', metrics.get('totalThroughputBps')?.delta ?? null, locale);
  const power = metricTrend('systemPowerW', metrics.get('systemPowerW')?.delta ?? null, locale);
  const ee = metricTrend('instantaneousEeBitsPerJ', metrics.get('instantaneousEeBitsPerJ')?.delta ?? null, locale);
  const sinr = metricTrend('servingSinrDb', metrics.get('servingSinrDb')?.delta ?? null, locale);
  return locale === 'zh-Hant'
    ? `本次比較：吞吐量${throughput}、系統功率${power}、瞬時 EE ${ee}、服務 SINR ${sinr}。`
    : `In this comparison, throughput ${throughput}, system power ${power}, instantaneous EE ${ee}, and serving SINR ${sinr}.`;
}

function formatParameterNumber(value: number, unit: string | undefined): string {
  if (!Number.isFinite(value)) return '—';
  return unit === undefined ? new Intl.NumberFormat('en-US', {
    useGrouping: false,
    maximumSignificantDigits: 4,
  }).format(value) : formatCompactUnit(value, unit, 4);
}

function formatParameterValue(value: number | string | null, unit: string | undefined): string {
  if (typeof value === 'string') return value;
  if (value === null) return '—';
  return formatParameterNumber(value, unit);
}

/** Format a caller-provided change without changing its underlying value. */
export function formatCausalParameterChange(
  change: VisualLabCausalParameterChange,
  locale: VisualLabLocale,
): { readonly label: string; readonly baseline: string; readonly candidate: string } {
  const label = typeof change.label === 'string' ? change.label : change.label[locale];
  return Object.freeze({
    label,
    baseline: formatParameterValue(change.baseline, change.unit),
    candidate: formatParameterValue(change.candidate, change.unit),
  });
}

function definitionParameterChange(
  comparison: ComparisonView,
  locale: VisualLabLocale,
): VisualLabCausalParameterChange | null {
  if (comparison.classification !== 'causal' || comparison.changedParameterKeys.length !== 1) return null;
  const key = comparison.changedParameterKeys[0];
  if (key === undefined || comparison.baseline === null || comparison.candidate === null) return null;

  const definition = VISUAL_LAB_INPUT_DEFINITIONS.find(item => item.key === key);
  if (definition === undefined) return null;

  const baseline = comparison.baseline.parameters[definition.key as VisualLabInputKey];
  const candidate = comparison.candidate.parameters[definition.key as VisualLabInputKey];
  if (typeof baseline !== 'number' || typeof candidate !== 'number') return null;

  return Object.freeze({
    key,
    label: definition.label,
    baseline: definition.formatDisplayValue(definition.toDisplayValue(baseline)),
    candidate: definition.formatDisplayValue(definition.toDisplayValue(candidate)),
    unit: definition.displayUnit,
  });
}

/**
 * Resolve one changed input only when ComparisonView classifies the pair as
 * causal.  Exploratory pairs never get reduced to a misleading single cause.
 */
export function causalReplayParameterChange(
  comparison: ComparisonView | null | undefined,
  locale: VisualLabLocale,
  provided?: VisualLabCausalParameterChange | null,
): ReturnType<typeof formatCausalParameterChange> | null {
  if (provided !== undefined && provided !== null) return formatCausalParameterChange(provided, locale);
  if (comparison === null || comparison === undefined) return null;
  const derived = definitionParameterChange(comparison, locale);
  return derived === null ? null : formatCausalParameterChange(derived, locale);
}

function formatMetric(metric: CausalReplayMetricId, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  if (metric === 'totalThroughputBps') return formatRate(value);
  if (metric === 'systemPowerW') return formatPower(value);
  if (metric === 'instantaneousEeBitsPerJ') return formatEnergyEfficiency(value);
  return `${new Intl.NumberFormat('en-US', {
    useGrouping: false,
    maximumFractionDigits: 2,
  }).format(value)} dB`;
}

/** Format a delta that was supplied by ComparisonView without recomputing it. */
export function formatCausalMetricDelta(metric: CausalReplayMetricId, value: number | null): string {
  const formatted = formatMetric(metric, value);
  if (formatted === '—' || value === null || !Number.isFinite(value)) return formatted;
  if (value > 0) return `+${formatted}`;
  return formatted.replace('-', '−');
}

export function formatCausalMetricValue(metric: CausalReplayMetricId, value: number | null): string {
  return formatMetric(metric, value);
}
