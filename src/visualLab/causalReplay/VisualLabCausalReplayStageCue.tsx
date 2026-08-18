import type { ReactElement } from 'react';

import {
  causalClassificationLabel,
  causalMetricLabel,
  causalPhaseLabel,
  causalReplayMetrics,
  causalReplayObservation,
  causalReplayParameterChange,
  causalStoryTitle,
  formatCausalMetricDelta,
  formatCausalMetricValue,
} from './model';
import type {
  CausalReplayMetricId,
} from './model';
import type { VisualLabCausalPhase, VisualLabCausalReplayStageCueProps } from './types';
import './VisualLabCausalReplay.scss';

const METRIC_TONES: Readonly<Record<CausalReplayMetricId, string>> = Object.freeze({
  totalThroughputBps: 'service',
  systemPowerW: 'service',
  instantaneousEeBitsPerJ: 'energy',
  servingSinrDb: 'signal',
});

function MetricCard({
  id,
  baseline,
  candidate,
  delta,
  phase,
  locale,
}: {
  readonly id: CausalReplayMetricId;
  readonly baseline: number | null;
  readonly candidate: number | null;
  readonly delta: number | null;
  readonly phase: VisualLabCausalPhase;
  readonly locale: 'zh-Hant' | 'en';
}): ReactElement {
  const label = causalMetricLabel(id, locale);
  return (
    <div
      className={`vlab-causal-replay__metric is-${METRIC_TONES[id]}`}
      data-causal-metric={id}
      data-metric={id}
    >
      <dt>{label}</dt>
      <dd>
        <span data-metric-side="baseline">A · {formatCausalMetricValue(id, baseline)}</span>
        <span data-metric-side="candidate">B · {formatCausalMetricValue(id, phase === 'baseline' ? null : candidate)}</span>
      </dd>
      <small data-metric-side="delta">Δ · {formatCausalMetricDelta(id, phase === 'comparison' ? delta : null)}</small>
    </div>
  );
}

export function VisualLabCausalReplayStageCue({
  storyId,
  phase,
  comparison,
  parameterChange,
  changedParameter,
  servingSinr,
  locale = 'zh-Hant',
  theme = 'dark',
  className,
  directorEnabled = true,
  disabled = false,
  onDirectorEnabledChange,
}: VisualLabCausalReplayStageCueProps): ReactElement {
  const classification = comparison?.classification ?? null;
  const mismatchedGates = comparison === null || comparison === undefined
    ? ''
    : Object.entries(comparison.gates)
      .filter(([, gate]) => gate.status !== 'matched')
      .map(([key, gate]) => `${key}:${gate.status}`)
      .join(',');
  const parameter = causalReplayParameterChange(comparison, locale, parameterChange ?? changedParameter);
  const metrics = causalReplayMetrics(comparison, servingSinr);
  const observation = causalReplayObservation(comparison, phase, locale, servingSinr);
  const classes = ['vlab-causal-replay__stage-cue', `vlab-causal-replay__stage-cue--${theme}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <aside
      className={classes}
      aria-live="polite"
      aria-label={`${causalStoryTitle(storyId, locale)} · ${causalPhaseLabel(phase, locale)}`}
      data-causal-replay="stage-cue"
      data-story={storyId}
      data-phase={phase}
      data-classification={classification ?? 'unavailable'}
      data-causal-story={storyId}
      data-causal-phase={phase}
      data-causal-classification={classification ?? 'unavailable'}
      data-causal-value-availability={comparison?.frame.availability === 'available' ? 'available' : 'unavailable'}
      data-causal-unmatched-gates={mismatchedGates || undefined}
    >
      <header className="vlab-causal-replay__stage-header">
        <div>
          <span className="vlab-causal-replay__eyebrow">{locale === 'zh-Hant' ? '因果回放' : 'Causal replay'}</span>
          <h2>{causalStoryTitle(storyId, locale)}</h2>
        </div>
        <div className="vlab-causal-replay__stage-actions">
          <span className="vlab-causal-replay__phase-badge" data-causal-current-phase={phase}>
            {causalPhaseLabel(phase, locale)}
          </span>
          {onDirectorEnabledChange === undefined ? null : <button
            type="button"
            className="vlab-causal-replay__camera"
            aria-pressed={directorEnabled}
            disabled={disabled}
            onClick={() => onDirectorEnabledChange(!directorEnabled)}
          >
            <span aria-hidden="true">{directorEnabled ? '◉' : '◎'}</span>
            <span>{locale === 'zh-Hant'
              ? directorEnabled ? '自動運鏡' : '自由鏡頭'
              : directorEnabled ? 'Directed camera' : 'Free camera'}</span>
          </button>}
        </div>
      </header>

      <ol className="vlab-causal-replay__stage-phases" aria-label={locale === 'zh-Hant' ? '目前階段' : 'Current phase'}>
        {(['baseline', 'intervention', 'comparison'] as const).map(item => (
          <li key={item} className={item === phase ? 'is-active' : ''} data-causal-phase-indicator={item}>
            <span aria-hidden="true">{item === phase ? '●' : '○'}</span>
            <strong>{causalPhaseLabel(item, locale)}</strong>
          </li>
        ))}
      </ol>

      <div className="vlab-causal-replay__parameter" data-causal-parameter-count="1">
        <span className="vlab-causal-replay__parameter-label">
          {locale === 'zh-Hant' ? '變更參數' : 'Changed parameter'}
        </span>
        {parameter === null ? (
          <span className="vlab-causal-replay__parameter-value" data-causal-parameter="unavailable">—</span>
        ) : (
          <span className="vlab-causal-replay__parameter-value" data-causal-parameter="available">
            <strong>{parameter.label}</strong>
            <span>A · {parameter.baseline} → B · {parameter.candidate}</span>
          </span>
        )}
      </div>

      <div className="vlab-causal-replay__metric-grid" aria-label={locale === 'zh-Hant' ? '四項結果' : 'Four result readouts'}>
        {metrics.map(({ id, metric }) => (
          <MetricCard
            key={id}
            id={id}
            baseline={metric.baseline}
            candidate={metric.candidate}
            delta={metric.delta}
            phase={phase}
            locale={locale}
          />
        ))}
      </div>

      <p className="vlab-causal-replay__observation" data-causal-observation>{observation}</p>

      <span className="vlab-causal-replay__classification" data-causal-classification-label>
        {causalClassificationLabel(classification, locale)}
      </span>
    </aside>
  );
}

export const CausalReplayStageCue = VisualLabCausalReplayStageCue;
