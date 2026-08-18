import type { ReactElement } from 'react';

import type { VisualLabLocale } from '../experiment';
import {
  CAUSAL_REPLAY_PHASES,
  CAUSAL_REPLAY_STORIES,
  causalPhaseLabel,
  causalStoryTitle,
} from './model';
import type {
  VisualLabCausalPhase,
  VisualLabCausalReplayRailProps,
  VisualLabCausalStoryId,
} from './types';
import './VisualLabCausalReplay.scss';

const CONTROL_LABELS = Object.freeze({
  'zh-Hant': Object.freeze({ previous: '上一段', play: '播放', pause: '暫停', next: '下一段', restart: '重新開始' }),
  en: Object.freeze({ previous: 'Previous', play: 'Play', pause: 'Pause', next: 'Next', restart: 'Restart' }),
});

function choiceLabel(storyId: VisualLabCausalStoryId, locale: VisualLabLocale): string {
  return causalStoryTitle(storyId, locale);
}

function choiceShortLabel(storyId: VisualLabCausalStoryId, locale: VisualLabLocale): string {
  if (storyId === 'beamwidth') return locale === 'zh-Hant' ? '增益' : 'Gain';
  return locale === 'zh-Hant' ? '功率' : 'Power';
}

function phaseState(phase: VisualLabCausalPhase, current: VisualLabCausalPhase): 'active' | 'upcoming' | 'complete' {
  const currentIndex = CAUSAL_REPLAY_PHASES.indexOf(current);
  const phaseIndex = CAUSAL_REPLAY_PHASES.indexOf(phase);
  if (phaseIndex === currentIndex) return 'active';
  return phaseIndex < currentIndex ? 'complete' : 'upcoming';
}

export function VisualLabCausalReplayRail({
  storyId,
  phase,
  locale = 'zh-Hant',
  theme = 'dark',
  classification = null,
  playing = false,
  disabled = false,
  className,
  onStoryChange,
  onPrevious,
  onPlayToggle,
  onNext,
  onRestart,
}: VisualLabCausalReplayRailProps): ReactElement {
  const controls = CONTROL_LABELS[locale];
  const classes = ['vlab-causal-replay__rail', `vlab-causal-replay__rail--${theme}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <nav
      className={classes}
      aria-label={locale === 'zh-Hant' ? '因果回放控制列' : 'Causal replay controls'}
      data-causal-replay="rail"
      data-story={storyId}
      data-phase={phase}
      data-classification={classification ?? 'unavailable'}
      data-causal-story={storyId}
      data-causal-phase={phase}
      data-causal-classification={classification ?? 'unavailable'}
    >
      <div className="vlab-causal-replay__rail-heading">
        <span className="vlab-causal-replay__eyebrow">
          {locale === 'zh-Hant' ? '因果回放' : 'Causal replay'}
        </span>
        <strong>{causalStoryTitle(storyId, locale)}</strong>
      </div>

      <div className="vlab-causal-replay__story-choices" role="list" aria-label={locale === 'zh-Hant' ? '故事選擇' : 'Story choices'}>
        {CAUSAL_REPLAY_STORIES.map(choice => {
          const selected = choice === storyId;
          return (
            <div key={choice} role="listitem">
              <button
                type="button"
                className={`vlab-causal-replay__story-choice${selected ? ' is-selected' : ''}`}
                aria-pressed={selected}
                disabled={disabled}
                data-causal-story-choice={choice}
                data-causal-story-selected={selected ? 'true' : 'false'}
                onClick={() => onStoryChange(choice)}
              >
                <span className="vlab-causal-replay__story-choice-dot" aria-hidden="true" />
                <span>
                  <strong>
                    <span className="vlab-causal-replay__choice-label-full">{choiceLabel(choice, locale)}</span>
                    <span className="vlab-causal-replay__choice-label-short">{choiceShortLabel(choice, locale)}</span>
                  </strong>
                  <small aria-hidden="true">{causalStoryTitle(choice, locale)}</small>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <ol className="vlab-causal-replay__phases" aria-label={locale === 'zh-Hant' ? '回放階段' : 'Replay phases'}>
        {CAUSAL_REPLAY_PHASES.map((item, index) => {
          const state = phaseState(item, phase);
          return (
            <li
              key={item}
              className={`vlab-causal-replay__phase is-${state}`}
              aria-current={state === 'active' ? 'step' : undefined}
              data-causal-phase-indicator={item}
              data-causal-phase-state={state}
            >
              <span aria-hidden="true">{index + 1}</span>
              <strong>{causalPhaseLabel(item, locale)}</strong>
            </li>
          );
        })}
      </ol>

      <div className="vlab-causal-replay__controls" aria-label={locale === 'zh-Hant' ? '回放操作' : 'Replay actions'}>
        <button
          type="button"
          className="vlab-causal-replay__control"
          aria-label={controls.previous}
          data-causal-control="previous"
          disabled={disabled}
          onClick={onPrevious}
        >
          <span aria-hidden="true">←</span>
          <span>{controls.previous}</span>
        </button>
        <button
          type="button"
          className="vlab-causal-replay__control vlab-causal-replay__control--primary"
          aria-label={playing ? controls.pause : controls.play}
          aria-pressed={playing}
          data-causal-control="play-toggle"
          disabled={disabled}
          onClick={onPlayToggle}
        >
          <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>
          <span>{playing ? controls.pause : controls.play}</span>
        </button>
        <button
          type="button"
          className="vlab-causal-replay__control"
          aria-label={controls.next}
          data-causal-control="next"
          disabled={disabled}
          onClick={onNext}
        >
          <span aria-hidden="true">›</span>
          <span>{controls.next}</span>
        </button>
        <button
          type="button"
          className="vlab-causal-replay__control"
          aria-label={controls.restart}
          data-causal-control="restart"
          disabled={disabled}
          onClick={onRestart}
        >
          <span aria-hidden="true">↺</span>
          <span>{controls.restart}</span>
        </button>
      </div>
    </nav>
  );
}

export const CausalReplayRail = VisualLabCausalReplayRail;
