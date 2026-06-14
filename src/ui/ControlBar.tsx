import { UI_CLASSES } from '../constants/uiTokens';
import type { SceneLane } from '../app/sceneLane';

interface ControlBarProps {
  // Playback (play/pause, speed, scrub, seek) is owned solely by the bottom
  // TimelineBar — the ControlBar no longer duplicates it (consolidation C1).
  //
  // G1-CONTROLBAR-ADV: the SINR-live display/camera controls (beam density,
  // beam-info callouts, camera presets, spotlight, HO-slow) moved off the top bar
  // into the opt-in SinrLiveDisplayDrawer. After the UI-mode switch was removed
  // the ControlBar only owns the lane-aware UE display filter / read-only count.

  // P2b Display-filter & focus UE controls
  sceneSource?: 'live-sim' | 'artifact-replay';
  sceneLane?: SceneLane;
  liveUeCount?: number;
  ueDisplayCount?: number;
  maxUeCount?: number;
  onUeDisplayCountChange?: (count: number) => void;
  elevatedUeId?: string | null;
  ueIds?: readonly string[];
  onElevatedUeIdChange?: (id: string) => void;
}

export function ControlBar({
  sceneSource = 'live-sim',
  sceneLane = sceneSource === 'artifact-replay' ? 'artifact-replay' : 'sinr-live',
  liveUeCount = 1,
  ueDisplayCount = 100,
  maxUeCount = 100,
  onUeDisplayCountChange,
  elevatedUeId = null,
  ueIds = [],
  onElevatedUeIdChange,
}: ControlBarProps) {
  const isArtifactReplay = sceneLane === 'artifact-replay' || sceneSource === 'artifact-replay';
  return (
    <div className="leo-control-bar">
      {isArtifactReplay ? (
        <>
          <label className="leo-control-bar__field-row">
            Active UEs:
            <input
              className={`${UI_CLASSES.range} leo-control-bar__speed-range`}
              type="range"
              min={1}
              max={maxUeCount}
              value={ueDisplayCount}
              aria-label="Active UEs display filter"
              onChange={e => onUeDisplayCountChange?.(Number(e.target.value))}
            />
            <span>showing {ueDisplayCount} of {maxUeCount}</span>
          </label>
          <label className="leo-control-bar__field-row">
            Focus UE:
            <select
              className={UI_CLASSES.select + ' leo-control-bar__ue-select'}
              value={elevatedUeId ?? ''}
              onChange={e => onElevatedUeIdChange?.(e.target.value)}
            >
              {ueIds.map(id => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <span className="leo-control-bar__ue-filter-readonly">
          Active UEs: {Math.max(1, Math.trunc(liveUeCount))}
        </span>
      )}
    </div>
  );
}
