import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';

const SPEED_PRESETS = [1, 2, 5, 10, 20] as const;
const STEP_SECONDS = 10;
const TICK_RATIOS = [0, 0.25, 0.5, 0.75, 1] as const;

export type TimelineSpeedPreset = (typeof SPEED_PRESETS)[number];
type TimelineTransportIcon = 'jump-start' | 'step-backward' | 'play' | 'pause' | 'step-forward' | 'jump-end';

export interface TimelineBarProps {
  readonly currentTimeSec: number;
  readonly durationSec: number;
  readonly paused: boolean;
  readonly speed: number;
  readonly onTogglePause: () => void;
  readonly onSeek: (targetTimeSec: number) => void;
  readonly onSpeedChange: (speed: TimelineSpeedPreset) => void;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly sourceOwner: string;
  readonly horizonKind: string;
  readonly horizonLabel: string;
  readonly horizonSec?: number;
  readonly claimKind: string;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function clampTime(value: number, durationSec: number): number {
  if (!isFiniteNumber(value)) return 0;
  return Math.min(Math.max(value, 0), durationSec);
}

export function formatTimelineTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(isFiniteNumber(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function TimelineIcon({ icon }: { readonly icon: TimelineTransportIcon }) {
  return (
    <span className={`leo-timeline-bar__icon leo-timeline-bar__icon--${icon}`} aria-hidden="true">
      <span className="leo-timeline-bar__icon-mark" />
    </span>
  );
}

export function TimelineBar({
  currentTimeSec,
  durationSec,
  paused,
  speed,
  onTogglePause,
  onSeek,
  onSpeedChange,
  disabled = false,
  className,
  sourceOwner,
  horizonKind,
  horizonLabel,
  horizonSec,
  claimKind,
}: TimelineBarProps) {
  const safeDurationSec = Math.max(0, isFiniteNumber(durationSec) ? durationSec : 0);
  const safeHorizonSec = Math.max(
    0,
    isFiniteNumber(horizonSec ?? NaN) ? horizonSec as number : safeDurationSec,
  );
  const safeCurrentTimeSec = clampTime(currentTimeSec, safeDurationSec);
  const isTimelineDisabled = disabled || safeDurationSec <= 0;
  const progressPercent = safeDurationSec > 0 ? (safeCurrentTimeSec / safeDurationSec) * 100 : 0;
  const rootClassName = className ? `leo-timeline-bar ${className}` : 'leo-timeline-bar';
  const currentTimeLabel = formatTimelineTime(safeCurrentTimeSec);
  const durationLabel = formatTimelineTime(safeDurationSec);
  const progressStyle = {
    '--leo-timeline-progress': `${progressPercent}%`,
  } as CSSProperties;

  const seekTo = (targetTimeSec: number) => {
    if (isTimelineDisabled) return;
    onSeek(clampTime(targetTimeSec, safeDurationSec));
  };

  const seekFromPointer = (event: PointerEvent<HTMLInputElement>) => {
    if (isTimelineDisabled) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const ratio = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1);
    seekTo(ratio * safeDurationSec);
  };

  const handleSliderKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (isTimelineDisabled) return;

    if (event.key === 'Home') {
      event.preventDefault();
      seekTo(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      seekTo(safeDurationSec);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      seekTo(safeCurrentTimeSec - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      seekTo(safeCurrentTimeSec + 1);
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      seekTo(safeCurrentTimeSec - STEP_SECONDS);
    } else if (event.key === 'PageUp') {
      event.preventDefault();
      seekTo(safeCurrentTimeSec + STEP_SECONDS);
    }
  };

  return (
    <section
      className={rootClassName}
      aria-label="Playback timeline controls"
      data-testid="timeline-bar"
      data-paused={paused ? 'true' : 'false'}
      data-disabled={isTimelineDisabled ? 'true' : 'false'}
      data-current-time-sec={safeCurrentTimeSec.toFixed(3)}
      data-duration-sec={safeDurationSec.toFixed(3)}
      data-source-owner={sourceOwner}
      data-horizon-kind={horizonKind}
      data-horizon-sec={safeHorizonSec.toFixed(3)}
      data-horizon-label={horizonLabel}
      data-claim-kind={claimKind}
      data-progress-pct={progressPercent.toFixed(3)}
      style={progressStyle}
    >
      <div className="leo-timeline-bar__chrome" aria-hidden="true" />

      <div className="leo-timeline-bar__controls" role="group" aria-label="Timeline transport controls">
        <button
          className="leo-timeline-bar__button leo-timeline-bar__button--compact"
          type="button"
          aria-label="Jump to start"
          data-testid="timeline-jump-start"
          disabled={isTimelineDisabled || safeCurrentTimeSec <= 0}
          onClick={() => seekTo(0)}
        >
          <TimelineIcon icon="jump-start" />
        </button>
        <button
          className="leo-timeline-bar__button"
          type="button"
          aria-label="Step backward 10 seconds"
          data-testid="timeline-step-backward"
          disabled={isTimelineDisabled || safeCurrentTimeSec <= 0}
          onClick={() => seekTo(safeCurrentTimeSec - STEP_SECONDS)}
        >
          <TimelineIcon icon="step-backward" />
        </button>
        <button
          className="leo-timeline-bar__button leo-timeline-bar__button--primary"
          type="button"
          aria-label={paused ? 'Play timeline' : 'Pause timeline'}
          data-testid="timeline-toggle-play"
          disabled={disabled}
          onClick={onTogglePause}
        >
          <TimelineIcon icon={paused ? 'play' : 'pause'} />
        </button>
        <button
          className="leo-timeline-bar__button"
          type="button"
          aria-label="Step forward 10 seconds"
          data-testid="timeline-step-forward"
          disabled={isTimelineDisabled || safeCurrentTimeSec >= safeDurationSec}
          onClick={() => seekTo(safeCurrentTimeSec + STEP_SECONDS)}
        >
          <TimelineIcon icon="step-forward" />
        </button>
        <button
          className="leo-timeline-bar__button leo-timeline-bar__button--compact"
          type="button"
          aria-label="Jump to end"
          data-testid="timeline-jump-end"
          disabled={isTimelineDisabled || safeCurrentTimeSec >= safeDurationSec}
          onClick={() => seekTo(safeDurationSec)}
        >
          <TimelineIcon icon="jump-end" />
        </button>
      </div>

      <div className="leo-timeline-bar__clock">
        <span className="leo-timeline-bar__clock-prefix">T+</span>
        <span className="leo-timeline-bar__time" data-testid="timeline-current-time">
          {currentTimeLabel}
        </span>
        <span className="leo-timeline-bar__clock-divider" aria-hidden="true">
          /
        </span>
        <span className="leo-timeline-bar__time" data-testid="timeline-duration">
          {durationLabel}
        </span>
        <span className="leo-timeline-bar__source-chip" data-testid="timeline-source-label">
          {horizonLabel}
        </span>
      </div>

      <div className="leo-timeline-bar__speed-presets" role="group" aria-label="Playback speed presets">
        {SPEED_PRESETS.map(preset => {
          const active = speed === preset;
          return (
            <button
              key={preset}
              className="leo-timeline-bar__speed-button"
              type="button"
              aria-label={`Set playback speed to ${preset}x`}
              aria-pressed={active}
              data-testid={`timeline-speed-${preset}x`}
              disabled={disabled}
              onClick={() => onSpeedChange(preset)}
            >
              {preset}x
            </button>
          );
        })}
      </div>

      <div className="leo-timeline-bar__scrubber">
        <div className="leo-timeline-bar__ruler" aria-hidden="true">
          <span className="leo-timeline-bar__progress-glow" />
          <span className="leo-timeline-bar__playhead" />
        </div>
        <input
          className="leo-timeline-bar__slider"
          type="range"
          min={0}
          max={safeDurationSec}
          step={0.1}
          value={safeCurrentTimeSec}
          aria-label="Timeline scrubber"
          aria-valuetext={`${currentTimeLabel} of ${durationLabel}`}
          data-testid="timeline-scrubber"
          disabled={isTimelineDisabled}
          onInput={event => seekTo(event.currentTarget.valueAsNumber)}
          onChange={event => seekTo(event.currentTarget.valueAsNumber)}
          onKeyDown={handleSliderKeyDown}
          onPointerDown={event => {
            event.currentTarget.setPointerCapture(event.pointerId);
            seekFromPointer(event);
          }}
          onPointerMove={event => {
            if ((event.buttons & 1) === 1) seekFromPointer(event);
          }}
        />
        <div className="leo-timeline-bar__tick-row" aria-hidden="true">
          {TICK_RATIOS.map(ratio => (
            <span
              key={ratio}
              className="leo-timeline-bar__tick-label"
              style={{ '--leo-timeline-tick-position': `${ratio * 100}%` } as CSSProperties}
            >
              {formatTimelineTime(safeDurationSec * ratio)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
