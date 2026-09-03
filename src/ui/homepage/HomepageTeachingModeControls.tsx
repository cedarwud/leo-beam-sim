import type { ReactElement } from 'react';

import type { HomepageTeachingMode, HomepageTeachingStop } from '../../homepage/controller/homepageTeachingTimeline';

export interface HomepageTeachingModeControlsProps {
  readonly enabled: boolean;
  readonly mode: HomepageTeachingMode;
  readonly active: boolean;
  readonly paused: boolean;
  readonly currentStop: HomepageTeachingStop | null;
  readonly onModeChange: (mode: HomepageTeachingMode) => void;
  readonly onStartGuided: () => void;
  readonly onPreviousStep: () => void;
  readonly onNextStep: () => void;
  readonly onEnd: () => void;
}

/**
 * Small homepage-only teaching controls. The scene remains unobstructed; all
 * state-changing callbacks are supplied by App's canonical transport owner.
 */
export function HomepageTeachingModeControls({
  enabled,
  mode,
  active,
  paused,
  currentStop,
  onModeChange,
  onStartGuided,
  onPreviousStep,
  onNextStep,
  onEnd,
}: HomepageTeachingModeControlsProps): ReactElement {
  return (
    <div
      className="leo-homepage-teaching-controls"
      data-testid="homepage-teaching-controls"
      data-homepage-teaching-mode={mode}
      data-homepage-teaching-active={active ? '1' : '0'}
      data-homepage-teaching-paused={paused ? '1' : '0'}
      data-homepage-teaching-stop-id={currentStop?.id ?? ''}
    >
      <span className="leo-homepage-teaching-controls__label">Teaching</span>
      <div className="leo-homepage-teaching-controls__modes" role="group" aria-label="Teaching playback mode">
        <button
          type="button"
          className="leo-homepage-teaching-controls__mode"
          data-testid="homepage-teaching-mode-continuous"
          aria-pressed={mode === 'continuous'}
          disabled={!enabled}
          onClick={() => onModeChange('continuous')}
        >
          連續播放
        </button>
        <button
          type="button"
          className="leo-homepage-teaching-controls__mode"
          data-testid="homepage-teaching-mode-guided"
          aria-pressed={mode === 'guided'}
          disabled={!enabled}
          onClick={() => onModeChange('guided')}
        >
          逐段教學
        </button>
      </div>
      {mode === 'guided' && !active && (
        <button
          type="button"
          className="leo-homepage-teaching-controls__action leo-homepage-teaching-controls__action--start"
          data-testid="homepage-teaching-start-guided"
          disabled={!enabled}
          onClick={onStartGuided}
        >
          開始逐段
        </button>
      )}
      {mode === 'guided' && active && (
        <>
          <button
            type="button"
            className="leo-homepage-teaching-controls__action"
            data-testid="homepage-teaching-previous"
            aria-label="Previous teaching step"
            disabled={!enabled}
            onClick={onPreviousStep}
          >
            上一段
          </button>
          <button
            type="button"
            className="leo-homepage-teaching-controls__action leo-homepage-teaching-controls__action--next"
            data-testid="homepage-teaching-next"
            aria-label="Next teaching step"
            disabled={!enabled}
            onClick={onNextStep}
          >
            下一段
          </button>
        </>
      )}
      {active && (
        <>
          <span className="leo-homepage-teaching-controls__status" role="status">
            {mode === 'guided'
              ? currentStop?.label ?? '逐段教學'
              : paused ? '已暫停' : '連續播放'}
          </span>
          <button
            type="button"
            className="leo-homepage-teaching-controls__action leo-homepage-teaching-controls__action--end"
            data-testid="homepage-teaching-end"
            onClick={onEnd}
          >
            結束
          </button>
        </>
      )}
    </div>
  );
}
