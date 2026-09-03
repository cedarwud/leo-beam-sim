import type { ReactElement } from 'react';

import { formatTimelineTime } from '../TimelineBar';
import type { HomepageHandoverStoryProjection } from '../../homepage/controller/contracts';
import { candidateLinkKeyString } from '../../engine/handover/candidateDecisionContract';
import { useLocale } from '../../i18n';

export interface HomepageTeachingTimelineProps {
  readonly currentSourceTimeSec: number;
  readonly startSourceTimeSec: number;
  readonly endSourceTimeSec: number;
  readonly paused: boolean;
  readonly speed: number;
  /** Same accepted-snapshot story currently consumed by the scene and rail. */
  readonly handoverStory?: HomepageHandoverStoryProjection | null;
  readonly satelliteNameById?: ReadonlyMap<string, string> | null;
  /** Presentation-only reveal; it never changes the selected source frame. */
  readonly onRevealDetails?: () => void;
  readonly onSeekSource: (sourceTimeSec: number, pause: boolean) => void;
  readonly onTogglePause: () => void;
  readonly onEnd: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * A compact, window-local timeline. It is a view over the canonical source
 * cursor; it does not create an independent clock. The three homepage actions
 * use this same continuous window and existing play/pause transport.
 */
export function HomepageTeachingTimeline({
  currentSourceTimeSec,
  startSourceTimeSec,
  endSourceTimeSec,
  paused,
  speed,
  handoverStory = null,
  onRevealDetails,
  onSeekSource,
  onTogglePause,
  onEnd,
}: HomepageTeachingTimelineProps): ReactElement {
  const { locale } = useLocale();
  const isEnglish = locale === 'en';
  const safeStart = finiteOr(startSourceTimeSec, 0);
  const safeEnd = Math.max(safeStart, finiteOr(endSourceTimeSec, safeStart));
  const safeCurrent = clamp(finiteOr(currentSourceTimeSec, safeStart), safeStart, safeEnd);
  const duration = Math.max(0, safeEnd - safeStart);
  // Keep the source cursor absolute, but make the visible range local to the
  // selected teaching window so the maximum has an unambiguous meaning.
  const elapsed = clamp(safeCurrent - safeStart, 0, duration);
  const progress = duration > 0 ? (elapsed / duration) * 100 : 0;
  const storySourceKey = handoverStory === null ? '' : candidateLinkKeyString(handoverStory.source);
  const storyTargetKey = handoverStory === null ? '' : candidateLinkKeyString(handoverStory.target);
  const storyKindLabel = handoverStory === null
    ? null
    : handoverStory.kind === 'intra'
      ? (isEnglish ? 'Intra-cell handover · beam transition' : '同一 Cell 內 Beam 換手')
      : (isEnglish ? 'Inter-cell handover · satellite transition' : '跨 Cell 衛星換手');

  return (
    <section
      className="leo-homepage-teaching-timeline"
      aria-label="換手時間軸"
      data-testid="homepage-teaching-timeline"
      data-homepage-teaching-timeline-mode="continuous"
      data-homepage-teaching-timeline-current-sec={safeCurrent.toFixed(3)}
      data-homepage-teaching-timeline-start-sec={safeStart.toFixed(3)}
      data-homepage-teaching-timeline-end-sec={safeEnd.toFixed(3)}
      data-homepage-teaching-timeline-max-sec={duration.toFixed(3)}
      data-homepage-teaching-timeline-progress-pct={progress.toFixed(3)}
      data-homepage-teaching-story-kind={handoverStory?.kind ?? ''}
      data-homepage-teaching-story-source-key={storySourceKey}
      data-homepage-teaching-story-target-key={storyTargetKey}
    >
      <div className="leo-homepage-teaching-timeline__header">
        <span className="leo-homepage-teaching-timeline__clock" data-testid="homepage-teaching-clock">
          {formatTimelineTime(safeCurrent - safeStart)} / {formatTimelineTime(duration)}
        </span>
      </div>
      {handoverStory !== null && storyKindLabel !== null ? (
        <div
          className="leo-homepage-teaching-timeline__story-link"
          data-testid="homepage-teaching-story-link"
          data-story-kind={handoverStory.kind}
          data-story-source-key={storySourceKey}
          data-story-target-key={storyTargetKey}
        >
          <span className="leo-homepage-teaching-timeline__story-kind">
            {storyKindLabel}
          </span>
          <span className="leo-homepage-teaching-timeline__story-phase">
            {isEnglish ? `Phase · ${handoverStory.phase}` : `階段 · ${handoverStory.phase}`}
          </span>
        </div>
      ) : null}
      <div className="leo-homepage-teaching-timeline__controls" role="group" aria-label="換手時間軸控制">
        <button
          type="button"
          className="leo-homepage-teaching-timeline__button"
          data-testid="homepage-teaching-timeline-backward"
          aria-label="Seek backward five seconds"
          disabled={safeCurrent <= safeStart}
          onClick={() => {
            onRevealDetails?.();
            onSeekSource(safeCurrent - 5, false);
          }}
        >
          −5s
        </button>
        <button
          type="button"
          className="leo-homepage-teaching-timeline__button leo-homepage-teaching-timeline__button--play"
          data-testid="homepage-teaching-timeline-toggle-play"
          aria-label={paused ? 'Play teaching timeline' : 'Pause teaching timeline'}
          onClick={() => {
            onRevealDetails?.();
            onTogglePause();
          }}
        >
          {paused ? '播放' : '暫停'}
        </button>
        <button
          type="button"
          className="leo-homepage-teaching-timeline__button"
          data-testid="homepage-teaching-timeline-forward"
          aria-label="Seek forward five seconds"
          disabled={safeCurrent >= safeEnd}
          onClick={() => {
            onRevealDetails?.();
            onSeekSource(safeCurrent + 5, false);
          }}
        >
          +5s
        </button>
        <button
          type="button"
          className="leo-homepage-teaching-timeline__button leo-homepage-teaching-timeline__button--end"
          data-testid="homepage-teaching-timeline-end"
          onClick={onEnd}
        >
          結束
        </button>
      </div>
      <input
        className="leo-homepage-teaching-timeline__slider"
        type="range"
        min={0}
        max={duration}
        step={1}
        value={elapsed}
        aria-label="換手時間軸滑桿"
        data-testid="homepage-teaching-timeline-slider"
        disabled={duration <= 0}
        onChange={event => {
          onRevealDetails?.();
          onSeekSource(safeStart + Number(event.currentTarget.value), true);
        }}
      />
      <span className="leo-homepage-teaching-timeline__speed">{speed.toFixed(1)}×</span>
    </section>
  );
}
