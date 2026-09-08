import type { DirectorControlsProps } from '../ui/DirectorControls';
import { DirectorControls } from '../ui/DirectorControls';
import {
  HandoverEventRail,
  type HandoverRailEvent,
} from '../ui/HandoverEventRail';
import type { TimelineRailDescriptor } from './timelineRailAuthority';

type RailSurface = TimelineRailDescriptor['rail'];
type DirectorWiring = Omit<DirectorControlsProps, 'onIntraTrigger' | 'onIntraFocus' | 'onInterFocus' | 'onExit'> & {
  readonly liveDirectorFocusEventId?: string | null;
};

/**
 * The shell's handover-rail wiring owner. It joins the source-backed rail
 * descriptor to the Director controls without choosing events or owning truth.
 */
export interface AppHandoverRailProps {
  readonly events: readonly HandoverRailEvent[];
  readonly surface: RailSurface;
  readonly disabled: boolean;
  readonly axisPlaying: boolean;
  readonly axisPlaybackRate: number;
  readonly director: DirectorWiring;
  readonly onSeek: (targetTimeSec: number) => void;
  readonly onIntraTrigger: () => void;
  readonly onIntraFocus: () => void;
  readonly onInterFocus: () => void;
  readonly onExit: () => void;
}

export function AppHandoverRail({
  events,
  surface,
  disabled,
  axisPlaying,
  axisPlaybackRate,
  director,
  onSeek,
  onIntraTrigger,
  onIntraFocus,
  onInterFocus,
  onExit,
}: AppHandoverRailProps) {
  return (
    <>
      <HandoverEventRail
        events={events}
        currentTimeSec={surface.currentTimeSec}
        durationSec={surface.durationSec}
        onSeek={onSeek}
        disabled={disabled}
        sourceLabel={surface.sourceLabel}
        sourceOwner={surface.sourceOwner}
        horizonKind={surface.horizonKind}
        horizonLabel={surface.horizonLabel}
        claimKind={surface.claimKind}
        sourceStartSec={surface.sourceStartSec}
        sourceEndSec={surface.sourceEndSec}
        sourceGapReasons={surface.sourceGapReasons}
        axisKind={surface.axisKind}
        axisLabel={surface.axisLabel}
        axisDurationSec={surface.axisDurationSec}
        axisCurrentTimeSec={surface.axisCurrentTimeSec}
        axisPlaying={axisPlaying}
        axisPlaybackRate={axisPlaybackRate}
        directorFocusedEventId={director.liveDirectorFocusEventId}
      />
      <DirectorControls
        {...director}
        onIntraTrigger={onIntraTrigger}
        onIntraFocus={onIntraFocus}
        onInterFocus={onInterFocus}
        onExit={onExit}
      />
    </>
  );
}
