import type { ReactElement } from 'react';

import type { VisualLabLocale } from '../../prototype/visual-lab-g0/presentation/visualLabPresentationContract';
import type {
  VisualLabStoryControllerState,
  VisualLabStorySceneDirection,
} from '../story';
import {
  formatStoryMetric,
  storyPointMetrics,
} from './storyRailModel';
import './VisualLabStoryStageCue.scss';

export interface VisualLabStoryStageCueProps {
  readonly state: VisualLabStoryControllerState;
  readonly direction: VisualLabStorySceneDirection;
  readonly locale: VisualLabLocale;
  readonly directorEnabled: boolean;
  readonly disabled?: boolean;
  readonly onDirectorEnabledChange: (enabled: boolean) => void;
}

const COPY = Object.freeze({
  'zh-Hant': Object.freeze({
    interTitle: '跨衛星換手',
    intraTitle: '同衛星換束',
    before: '切換前',
    decision: '判定時刻',
    after: '切換後',
    beforeBody: '先看目前服務鏈路與四項結果。',
    interDecisionBody: '服務角色在此時刻轉交給候選衛星。',
    intraDecisionBody: '同一衛星在此時刻切換服務波束。',
    afterBody: '確認新服務鏈路與結果變化。',
    autoCamera: '自動運鏡',
    freeCamera: '自由鏡頭',
    sinr: 'SINR',
    throughput: '吞吐量',
    power: '功率',
    energyEfficiency: '能源效率',
  }),
  en: Object.freeze({
    interTitle: 'Inter-satellite handover',
    intraTitle: 'Same-satellite beam switch',
    before: 'Before',
    decision: 'Decision',
    after: 'After',
    beforeBody: 'Read the current serving link and the four results first.',
    interDecisionBody: 'Serving ownership transfers to the candidate satellite at this anchor.',
    intraDecisionBody: 'The serving beam changes on the same satellite at this anchor.',
    afterBody: 'Confirm the new serving link and the result changes.',
    autoCamera: 'Directed camera',
    freeCamera: 'Free camera',
    sinr: 'SINR',
    throughput: 'Throughput',
    power: 'Power',
    energyEfficiency: 'Energy efficiency',
  }),
});

function beatLabel(
  beat: VisualLabStorySceneDirection['beat'],
  locale: VisualLabLocale,
): string {
  return COPY[locale][beat];
}

function beatBody(
  direction: VisualLabStorySceneDirection,
  locale: VisualLabLocale,
): string {
  const copy = COPY[locale];
  if (direction.beat === 'before') return copy.beforeBody;
  if (direction.beat === 'after') return copy.afterBody;
  return direction.storyKind === 'inter-handover'
    ? copy.interDecisionBody
    : copy.intraDecisionBody;
}

function identity(direction: VisualLabStorySceneDirection, locale: VisualLabLocale): string {
  if (
    direction.storyKind === 'intra-handover'
    && direction.fromBeamId !== null
    && direction.toBeamId !== null
  ) {
    const beam = locale === 'zh-Hant' ? '波束' : 'Beam';
    return `${direction.fromSatelliteId} · ${beam} ${direction.fromBeamId} → ${direction.toBeamId}`;
  }
  return `${direction.fromSatelliteId} → ${direction.toSatelliteId}`;
}

export function VisualLabStoryStageCue({
  state,
  direction,
  locale,
  directorEnabled,
  disabled = false,
  onDirectorEnabledChange,
}: VisualLabStoryStageCueProps): ReactElement {
  const copy = COPY[locale];
  const metrics = storyPointMetrics(state.activeStep);
  const title = direction.storyKind === 'inter-handover' ? copy.interTitle : copy.intraTitle;

  return (
    <aside
      className="vlab-story-stage-cue"
      data-story-kind={direction.storyKind}
      data-story-beat={direction.beat}
      data-camera-cue={direction.cameraCue}
      aria-live="polite"
    >
      <header className="vlab-story-stage-cue__header">
        <div>
          <span className="vlab-story-stage-cue__eyebrow">{title}</span>
          <h2>{beatLabel(direction.beat, locale)}</h2>
        </div>
        <button
          type="button"
          className="vlab-story-stage-cue__camera"
          aria-pressed={directorEnabled}
          disabled={disabled}
          onClick={() => onDirectorEnabledChange(!directorEnabled)}
        >
          <span aria-hidden="true">{directorEnabled ? '◉' : '◎'}</span>
          <span>{directorEnabled ? copy.autoCamera : copy.freeCamera}</span>
        </button>
      </header>

      <div className="vlab-story-stage-cue__progress" aria-label={`${title} · ${beatLabel(direction.beat, locale)}`}>
        {(['before', 'decision', 'after'] as const).map((beat, index) => (
          <span key={beat} className={beat === direction.beat ? 'is-active' : ''} aria-current={beat === direction.beat ? 'step' : undefined}>
            <i aria-hidden="true">{index + 1}</i>
            <b>{beatLabel(beat, locale)}</b>
          </span>
        ))}
      </div>

      <p className="vlab-story-stage-cue__identity">{identity(direction, locale)}</p>
      <p className="vlab-story-stage-cue__body">{beatBody(direction, locale)}</p>

      <dl className="vlab-story-stage-cue__metrics">
        <div><dt>{copy.sinr}</dt><dd>{formatStoryMetric(metrics.sinrDb, 'sinr', locale)}</dd></div>
        <div><dt>{copy.throughput}</dt><dd>{formatStoryMetric(metrics.throughputBps, 'throughput', locale)}</dd></div>
        <div><dt>{copy.power}</dt><dd>{formatStoryMetric(metrics.powerW, 'power', locale)}</dd></div>
        <div><dt>{copy.energyEfficiency}</dt><dd>{formatStoryMetric(metrics.energyEfficiencyBitsPerJ, 'energy-efficiency', locale)}</dd></div>
      </dl>
    </aside>
  );
}
