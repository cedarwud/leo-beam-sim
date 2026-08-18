import type { ReactElement } from 'react';

import {
  guidedReplayDefinition,
  guidedReplayCandidateEngaged,
  guidedReplayPhaseIndex,
  guidedReplayPhaseLabel,
  guidedReplayPhaseTiming,
  VISUAL_LAB_GUIDED_REPLAY_PHASES,
} from './model';
import type {
  VisualLabGuidedReplayAnnotationMode,
  VisualLabGuidedReplayRailProps,
} from './types';
import './VisualLabGuidedReplayRail.scss';

const COPY = Object.freeze({
  'zh-Hant': Object.freeze({
    aria: '情境回放控制列',
    mode: '呈現方式',
    clean: '乾淨版',
    annotated: '字幕標註版',
    play: '播放',
    pause: '暫停',
    next: '下一段',
    restart: '重新開始',
    replay: '回放',
  }),
  en: Object.freeze({
    aria: 'Scenario replay controls',
    mode: 'Presentation',
    clean: 'Clean',
    annotated: 'Annotated',
    play: 'Play',
    pause: 'Pause',
    next: 'Next',
    restart: 'Restart',
    replay: 'Replay',
  }),
});

function phaseState(
  candidateIndex: number,
  activeIndex: number,
): 'active' | 'complete' | 'upcoming' {
  if (candidateIndex === activeIndex) return 'active';
  return candidateIndex < activeIndex ? 'complete' : 'upcoming';
}

function ModeButton({
  mode,
  selected,
  label,
  disabled,
  onSelect,
}: {
  readonly mode: VisualLabGuidedReplayAnnotationMode;
  readonly selected: boolean;
  readonly label: string;
  readonly disabled: boolean;
  readonly onSelect: (mode: VisualLabGuidedReplayAnnotationMode) => void;
}): ReactElement {
  return (
    <button
      type="button"
      className={selected ? 'is-selected' : ''}
      aria-pressed={selected}
      disabled={disabled}
      data-guided-annotation-mode={mode}
      onClick={() => onSelect(mode)}
    >{label}</button>
  );
}

export function VisualLabGuidedReplayRail({
  storyId,
  phase,
  annotationMode,
  locale = 'zh-Hant',
  theme = 'dark',
  playing = false,
  busy = false,
  prepared = false,
  disabled = false,
  className,
  onAnnotationModeChange,
  onPlayToggle,
  onNext,
  onRestart,
}: VisualLabGuidedReplayRailProps): ReactElement {
  const copy = COPY[locale];
  const definition = guidedReplayDefinition(storyId);
  const activeIndex = guidedReplayPhaseIndex(phase);
  const guidedStatus = prepared ? 'ready' : busy ? 'preparing' : 'unavailable';
  const guidedStatusLabel = prepared
    ? copy.replay
    : busy
      ? locale === 'zh-Hant' ? '準備真實 A／B 與切換資料…' : 'Preparing real A/B and switch data…'
      : locale === 'zh-Hant' ? '尚未準備真實來源' : 'Real source not ready';
  return (
    <nav
      className={['vlab-guided-replay', `vlab-guided-replay--${theme}`, className].filter(Boolean).join(' ')}
      aria-label={copy.aria}
      data-guided-replay={storyId}
      data-guided-phase={phase}
      data-guided-stage={guidedReplayPhaseTiming(phase).stage}
      data-guided-candidate-engaged={String(guidedReplayCandidateEngaged(phase))}
      data-guided-annotation={annotationMode}
      data-guided-prepared={String(prepared)}
      data-guided-status={guidedStatus}
      aria-busy={busy}
    >
      <header className="vlab-guided-replay__heading">
        <span data-guided-status-label={guidedStatus}>{guidedStatusLabel}</span>
        <strong>{definition.title[locale]}</strong>
        <small>{guidedReplayPhaseLabel(phase, locale)}</small>
      </header>

      <div className="vlab-guided-replay__mode" role="group" aria-label={copy.mode}>
        <ModeButton mode="clean" selected={annotationMode === 'clean'} label={copy.clean} disabled={disabled} onSelect={onAnnotationModeChange} />
        <ModeButton mode="annotated" selected={annotationMode === 'annotated'} label={copy.annotated} disabled={disabled} onSelect={onAnnotationModeChange} />
      </div>

      <ol className="vlab-guided-replay__phases" aria-label={locale === 'zh-Hant' ? '故事階段' : 'Story phases'}>
        {VISUAL_LAB_GUIDED_REPLAY_PHASES.map((item, index) => {
          const state = phaseState(index, activeIndex);
          return (
            <li
              key={item}
              className={`is-${state}`}
              aria-current={state === 'active' ? 'step' : undefined}
              data-guided-phase-indicator={item}
              data-guided-phase-state={state}
              title={guidedReplayPhaseLabel(item, locale)}
            >
              <span aria-hidden="true">{index + 1}</span>
              <strong className="vlab-guided-replay__phase-label">{guidedReplayPhaseLabel(item, locale)}</strong>
            </li>
          );
        })}
      </ol>

      <div className="vlab-guided-replay__controls" aria-label={locale === 'zh-Hant' ? '回放操作' : 'Replay actions'}>
        <button type="button" className="is-primary" aria-pressed={playing} disabled={disabled} onClick={onPlayToggle}>
          <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>
          <span>{playing ? copy.pause : copy.play}</span>
        </button>
        <button type="button" disabled={disabled || phase === 'comparison'} onClick={onNext}>
          <span aria-hidden="true">›</span><span>{copy.next}</span>
        </button>
        <button type="button" disabled={disabled} onClick={onRestart}>
          <span aria-hidden="true">↺</span><span>{copy.restart}</span>
        </button>
      </div>
    </nav>
  );
}
