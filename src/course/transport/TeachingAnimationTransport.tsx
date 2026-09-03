import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
} from 'react';

import {
  DEFAULT_TRANSPORT_AUTO_HIDE_DELAY_MS,
  DEFAULT_TRANSPORT_STEP_SECONDS,
  TEACHING_PLAYBACK_SPEEDS,
  clampCourseTime,
  formatCourseTime,
  type PlaybackSpeed,
} from './teachingAnimationTransportModel';
import './TeachingAnimationTransport.scss';

export interface TeachingAnimationTransportProps {
  readonly currentTimeSec: number;
  readonly durationSec: number;
  readonly isPlaying: boolean;
  readonly playbackSpeed: PlaybackSpeed;
  readonly onPlayPause: () => void;
  readonly onSeek: (timeSec: number) => void;
  readonly onSpeedChange: (speed: PlaybackSpeed) => void;
  readonly onStepBackward?: (seconds?: number) => void;
  readonly onStepForward?: (seconds?: number) => void;
  readonly stepSeconds?: number;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly autoHideDelayMs?: number;
  readonly forceVisible?: boolean;
  readonly onVisibilityChange?: (visible: boolean) => void;
  readonly testId?: string;
}

export function TeachingAnimationTransport({
  currentTimeSec,
  durationSec,
  isPlaying,
  playbackSpeed,
  onPlayPause,
  onSeek,
  onSpeedChange,
  onStepBackward,
  onStepForward,
  stepSeconds = DEFAULT_TRANSPORT_STEP_SECONDS,
  disabled = false,
  className = '',
  autoHideDelayMs = DEFAULT_TRANSPORT_AUTO_HIDE_DELAY_MS,
  forceVisible = false,
  onVisibilityChange,
  testId = 'teaching-transport',
}: TeachingAnimationTransportProps): ReactElement {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isUserActive, setIsUserActive] = useState(true);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const hideTimerRef = useRef<number | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const speedTriggerRef = useRef<HTMLElement | null>(null);
  const clampedTime = clampCourseTime(currentTimeSec, durationSec);
  const progressRatio = durationSec > 0 ? clampedTime / durationSec : 0;
  const progressPercent = (progressRatio * 100).toFixed(2);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const pingActivity = useCallback(() => {
    setIsUserActive(true);
    clearHideTimer();
    if (isPlaying && !forceVisible && !isHovered && !isFocused) {
      hideTimerRef.current = window.setTimeout(() => {
        setIsUserActive(false);
      }, autoHideDelayMs);
    }
  }, [autoHideDelayMs, clearHideTimer, forceVisible, isFocused, isHovered, isPlaying]);

  useEffect(() => {
    if (!isPlaying || forceVisible || isHovered || isFocused) {
      setIsUserActive(true);
      clearHideTimer();
    } else {
      clearHideTimer();
      hideTimerRef.current = window.setTimeout(() => {
        setIsUserActive(false);
      }, autoHideDelayMs);
    }
    return clearHideTimer;
  }, [autoHideDelayMs, clearHideTimer, forceVisible, isFocused, isHovered, isPlaying]);

  const isVisible = forceVisible || !isPlaying || isHovered || isFocused || isUserActive;
  const isHidden = !isVisible;

  // A hidden rail cannot receive pointer events because the WebGL canvas owns
  // the stage.  Listen at the document boundary instead: the bottom edge is a
  // reliable reveal target even when the pointer is over the canvas.  Alt+T is the documented
  // keyboard path and focuses the first control after the rail is revealed.
  useEffect(() => {
    const handleGlobalPointerMove = (event: PointerEvent) => {
      if (!isHidden) return;
      if (event.clientY >= window.innerHeight - 96) pingActivity();
    };
    const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!isHidden || !event.altKey || event.key.toLowerCase() !== 't') return;
      event.preventDefault();
      pingActivity();
      window.requestAnimationFrame(() => playButtonRef.current?.focus());
    };
    document.addEventListener('pointermove', handleGlobalPointerMove, { passive: true });
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('pointermove', handleGlobalPointerMove);
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isHidden, pingActivity]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    if (isHidden) nav.setAttribute('inert', '');
    else nav.removeAttribute('inert');
  }, [isHidden]);

  useEffect(() => {
    if (isHidden) setIsSpeedMenuOpen(false);
  }, [isHidden]);

  useEffect(() => {
    onVisibilityChange?.(isVisible);
  }, [isVisible, onVisibilityChange]);

  const handleRangeChange = (event: ChangeEvent<HTMLInputElement>) => {
    pingActivity();
    const nextTime = Number.parseFloat(event.target.value);
    if (Number.isFinite(nextTime)) {
      onSeek(clampCourseTime(nextTime, durationSec));
    }
  };

  const handleRangeKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    pingActivity();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      onSeek(clampCourseTime(clampedTime - stepSeconds, durationSec));
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      onSeek(clampCourseTime(clampedTime + stepSeconds, durationSec));
    } else if (event.key === 'Home') {
      event.preventDefault();
      onSeek(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      onSeek(durationSec);
    }
  };

  const handleBackward = () => {
    pingActivity();
    if (onStepBackward) {
      onStepBackward(stepSeconds);
    } else {
      onSeek(clampCourseTime(clampedTime - stepSeconds, durationSec));
    }
  };

  const handleForward = () => {
    pingActivity();
    if (onStepForward) {
      onStepForward(stepSeconds);
    } else {
      onSeek(clampCourseTime(clampedTime + stepSeconds, durationSec));
    }
  };

  const handleSpeedMenuKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key !== 'Escape' || !isSpeedMenuOpen) return;
    event.preventDefault();
    setIsSpeedMenuOpen(false);
    speedTriggerRef.current?.focus();
  };

  const handleSpeedChange = (speed: PlaybackSpeed) => {
    pingActivity();
    onSpeedChange(speed);
    setIsSpeedMenuOpen(false);
    speedTriggerRef.current?.focus();
  };

  return (
    <>
      <span className="teaching-transport__reveal-hint" id={`${testId}-reveal-hint`}>
        控制台隱藏時，將滑鼠移到畫面底部，或按 Alt+T 顯示。
      </span>
      <nav
        ref={navRef}
        className={`teaching-transport ${className} ${isVisible ? 'is-visible' : 'is-hidden'}`}
        data-testid={testId}
        aria-label="教學動畫控制台"
        aria-describedby={`${testId}-reveal-hint`}
        aria-keyshortcuts="Alt+T"
        aria-hidden={isHidden ? 'true' : undefined}
        data-transport-visible={isVisible ? 'true' : 'false'}
        data-transport-playing={isPlaying ? 'true' : 'false'}
        data-transport-speed={String(playbackSpeed)}
        data-transport-time={clampedTime.toFixed(1)}
        data-transport-duration={durationSec.toFixed(1)}
        data-transport-keyboard-hint="Alt+T"
        onMouseEnter={() => {
          setIsHovered(true);
          pingActivity();
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          pingActivity();
        }}
        onPointerMove={pingActivity}
        onFocus={() => {
          setIsFocused(true);
          pingActivity();
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setIsFocused(false);
            pingActivity();
          }
        }}
        style={{ '--transport-progress': `${progressPercent}%` } as Record<string, string>}
      >
      <div className="teaching-transport__inner">
        {/* Play/Pause Button */}
        <button
          type="button"
          ref={playButtonRef}
          className={`teaching-transport__btn teaching-transport__btn--play ${isPlaying ? 'is-playing' : 'is-paused'}`}
          onClick={() => {
            pingActivity();
            onPlayPause();
          }}
          disabled={disabled}
          tabIndex={isVisible ? 0 : -1}
          aria-label={isPlaying ? '暫停動畫' : '播放動畫'}
          title={isPlaying ? '暫停 (Space)' : '播放 (Space)'}
          data-testid="transport-play-pause"
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" className="teaching-transport__icon" aria-hidden="true" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1.5" />
              <rect x="14" y="4" width="4" height="16" rx="1.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="teaching-transport__icon" aria-hidden="true" fill="currentColor">
              <path d="M7 4.5v15a1 1 0 0 0 1.55.83l12-7.5a1 1 0 0 0 0-1.66l-12-7.5A1 1 0 0 0 7 4.5z" />
            </svg>
          )}
          <span className="teaching-transport__btn-label">{isPlaying ? '暫停' : '播放'}</span>
        </button>

        {/* Backward seek (-5s) */}
        <button
          type="button"
          className="teaching-transport__btn teaching-transport__btn--step"
          onClick={handleBackward}
          disabled={disabled || clampedTime <= 0}
          tabIndex={isVisible ? 0 : -1}
          aria-label={`倒退 ${stepSeconds} 秒`}
          title={`倒退 ${stepSeconds} 秒`}
          data-testid="transport-rewind"
        >
          <svg viewBox="0 0 24 24" className="teaching-transport__icon" aria-hidden="true" fill="currentColor">
            <path d="M11 6.5v11a1 1 0 0 1-1.55.83l-8-5.5a1 1 0 0 1 0-1.66l8-5.5A1 1 0 0 1 11 6.5zm10 0v11a1 1 0 0 1-1.55.83l-8-5.5a1 1 0 0 1 0-1.66l8-5.5A1 1 0 0 1 21 6.5z" />
          </svg>
          <span className="teaching-transport__btn-text">-{stepSeconds}s</span>
        </button>

        {/* Forward seek (+5s) */}
        <button
          type="button"
          className="teaching-transport__btn teaching-transport__btn--step"
          onClick={handleForward}
          disabled={disabled || clampedTime >= durationSec}
          tabIndex={isVisible ? 0 : -1}
          aria-label={`快進 ${stepSeconds} 秒`}
          title={`快進 ${stepSeconds} 秒`}
          data-testid="transport-forward"
        >
          <svg viewBox="0 0 24 24" className="teaching-transport__icon" aria-hidden="true" fill="currentColor">
            <path d="M4 17.5v-11a1 1 0 0 1 1.55-.83l8 5.5a1 1 0 0 1 0 1.66l-8 5.5A1 1 0 0 1 4 17.5zm10 0v-11a1 1 0 0 1 1.55-.83l8 5.5a1 1 0 0 1 0 1.66l-8 5.5A1 1 0 0 1 14 17.5z" />
          </svg>
          <span className="teaching-transport__btn-text">+{stepSeconds}s</span>
        </button>

        {/* Timeline Slider Track */}
        <div className="teaching-transport__timeline-wrap">
          <input
            type="range"
            className="teaching-transport__range"
            min={0}
            max={durationSec}
            step={0.1}
            value={clampedTime}
            onChange={handleRangeChange}
            onKeyDown={handleRangeKeyDown}
            disabled={disabled}
            tabIndex={isVisible ? 0 : -1}
            aria-label="教學時間軸進度"
            aria-valuemin={0}
            aria-valuemax={durationSec}
            aria-valuenow={clampedTime}
            aria-valuetext={`${formatCourseTime(clampedTime)} / ${formatCourseTime(durationSec)}`}
            data-testid="transport-timeline-range"
          />
        </div>

        {/* Time Display */}
        <div className="teaching-transport__time" aria-label="播放時間" data-testid="transport-time-display">
          <span className="teaching-transport__time-current">{formatCourseTime(clampedTime)}</span>
          <span className="teaching-transport__time-sep">/</span>
          <span className="teaching-transport__time-duration">{formatCourseTime(durationSec)}</span>
        </div>

        {/* Playback Speed Disclosure */}
        <details
          className="teaching-transport__speeds"
          data-testid="transport-speeds"
          open={isSpeedMenuOpen}
          onToggle={(event) => setIsSpeedMenuOpen(event.currentTarget.open)}
          onKeyDown={handleSpeedMenuKeyDown}
        >
          <summary
            ref={speedTriggerRef}
            className="teaching-transport__speed-trigger"
            tabIndex={isVisible ? 0 : -1}
            aria-label={`播放速度，目前为 ${playbackSpeed} 倍，開啟選單`}
            aria-expanded={isSpeedMenuOpen}
            aria-controls={`${testId}-speed-options`}
            data-testid="transport-speed-current"
          >
            <span aria-hidden="true">{playbackSpeed}x</span>
            <span className="teaching-transport__speed-chevron" aria-hidden="true">⌄</span>
          </summary>
          <div
            id={`${testId}-speed-options`}
            className="teaching-transport__speed-menu"
            role="group"
            aria-label="播放速度選擇"
            hidden={!isSpeedMenuOpen}
          >
            {TEACHING_PLAYBACK_SPEEDS.map((speed) => {
              const isSpeedActive = playbackSpeed === speed;
              return (
                <button
                  key={speed}
                  type="button"
                  className={`teaching-transport__speed-btn ${isSpeedActive ? 'is-active' : ''}`}
                  onClick={() => handleSpeedChange(speed)}
                  disabled={disabled}
                  tabIndex={isSpeedMenuOpen && isVisible ? 0 : -1}
                  aria-pressed={isSpeedActive}
                  aria-label={`播放速度 ${speed} 倍`}
                  data-speed={speed}
                  data-testid={`transport-speed-${speed}`}
                >
                  {speed}x
                </button>
              );
            })}
          </div>
        </details>
      </div>
      </nav>
    </>
  );
}
