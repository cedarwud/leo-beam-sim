import { useCallback, useEffect, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { HomepageTeachingTimeline } from '../ui/homepage/HomepageTeachingTimeline';
import type { HomepageHandoverStoryProjection } from '../homepage/controller/contracts';
import type { HomepageDemoWindow } from '../homepage/controller/homepageDemoWindow';
import { clampTimelineTime } from './timelineRailAuthority';

interface TeachingPlayback {
  readonly paused: boolean;
  readonly effectiveSpeed: number;
  readonly setPaused: (paused: boolean) => void;
  readonly togglePause: () => void;
}

export interface AppHomepageTeachingStoryProps {
  readonly isRootHomepage: boolean;
  readonly showTimeline: boolean;
  readonly currentSourceTimeSec: number;
  readonly simTimeSec: number;
  readonly homepageDemoRunEndSec: number | null;
  readonly homepageDemoWindow: HomepageDemoWindow | null;
  readonly liveTimelineWindowStartSec: number;
  readonly timelineDurationSec: number;
  readonly homepageHandoverStory: HomepageHandoverStoryProjection | null;
  readonly satelliteNameById: ReadonlyMap<string, string> | null;
  readonly playback: TeachingPlayback;
  readonly onTimelineSeek: (targetSec: number, options?: { readonly sourceHistoryReplay?: boolean }) => void;
  readonly setHomepageDemoRunEndSec: Dispatch<SetStateAction<number | null>>;
  readonly setHomepageTeachingActive: Dispatch<SetStateAction<boolean>>;
  readonly setHomepageTeachingDetailsVisible: Dispatch<SetStateAction<boolean>>;
}

/** Owns the homepage's scripted teaching window and its presentation controls. */
export function useAppHomepageTeachingStory({
  isRootHomepage,
  showTimeline,
  currentSourceTimeSec,
  simTimeSec,
  homepageDemoRunEndSec,
  homepageDemoWindow,
  liveTimelineWindowStartSec,
  timelineDurationSec,
  homepageHandoverStory,
  satelliteNameById,
  playback,
  onTimelineSeek,
  setHomepageDemoRunEndSec,
  setHomepageTeachingActive,
  setHomepageTeachingDetailsVisible,
}: AppHomepageTeachingStoryProps): ReactNode {
  const handleRevealDetails = useCallback(() => {
    setHomepageTeachingDetailsVisible(true);
  }, [setHomepageTeachingDetailsVisible]);

  const handleSeekSource = useCallback((sourceTimeSec: number, pause: boolean) => {
    const targetSourceSec = homepageDemoWindow === null
      ? Math.max(0, sourceTimeSec)
      : Math.min(
        Math.max(sourceTimeSec, homepageDemoWindow.leadInSec),
        homepageDemoWindow.endSec,
      );
    const visibleTargetSec = clampTimelineTime(
      targetSourceSec - liveTimelineWindowStartSec,
      timelineDurationSec,
    );
    onTimelineSeek(visibleTargetSec, { sourceHistoryReplay: true });
    if (pause) playback.setPaused(true);
  }, [homepageDemoWindow, liveTimelineWindowStartSec, onTimelineSeek, playback, timelineDurationSec]);

  const handleEnd = useCallback(() => {
    if (homepageDemoWindow !== null) handleSeekSource(homepageDemoWindow.endSec, true);
    setHomepageDemoRunEndSec(null);
    setHomepageTeachingActive(false);
    setHomepageTeachingDetailsVisible(false);
    playback.setPaused(true);
  }, [handleSeekSource, homepageDemoWindow, playback, setHomepageDemoRunEndSec, setHomepageTeachingActive, setHomepageTeachingDetailsVisible]);

  useEffect(() => {
    if (!isRootHomepage || homepageDemoRunEndSec === null || !Number.isFinite(simTimeSec)) return;
    if (simTimeSec < homepageDemoRunEndSec) return;
    setHomepageDemoRunEndSec(null);
    setHomepageTeachingActive(false);
    setHomepageTeachingDetailsVisible(false);
    if (!playback.paused) playback.setPaused(true);
  }, [homepageDemoRunEndSec, isRootHomepage, playback, setHomepageDemoRunEndSec, setHomepageTeachingActive, setHomepageTeachingDetailsVisible, simTimeSec]);

  if (!showTimeline) return null;
  return (
    <HomepageTeachingTimeline
      currentSourceTimeSec={currentSourceTimeSec}
      startSourceTimeSec={homepageDemoWindow?.leadInSec ?? Math.max(0, simTimeSec - 30)}
      endSourceTimeSec={homepageDemoWindow?.endSec ?? Math.max(simTimeSec + 30, Math.max(0, simTimeSec - 30) + 60)}
      paused={playback.paused}
      speed={playback.effectiveSpeed}
      handoverStory={homepageHandoverStory}
      satelliteNameById={satelliteNameById}
      onRevealDetails={handleRevealDetails}
      onSeekSource={handleSeekSource}
      onTogglePause={playback.togglePause}
      onEnd={handleEnd}
    />
  );
}
