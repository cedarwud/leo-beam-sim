import { UI_CLASSES } from '../constants/uiTokens';
import type { SceneLane } from '../app/sceneLane';
import type { BeamDensity, CameraPreset, CinematicMode } from '../scene/types';
import { UI_MODES, isUiMode, type UiMode } from './uiMode';

interface ProfileOption {
  id: string;
  label: string;
}

interface ControlBarProps {
  selectedProfileId: string;
  profileOptions: ProfileOption[];
  // Playback (play/pause, speed, scrub, seek) is owned solely by the bottom
  // TimelineBar — the ControlBar no longer duplicates it (consolidation C1).
  autoSlowEnabled: boolean;
  uiMode: UiMode;
  beamDensity: BeamDensity;
  beamCalloutsEnabled: boolean;
  cinematicMode: CinematicMode;
  onProfileChange: (profileId: string) => void;
  onUiModeChange: (mode: UiMode) => void;
  onBeamDensityChange: (density: BeamDensity) => void;
  onToggleBeamCallouts: () => void;
  onCameraPresetSelect: (preset: CameraPreset) => void;
  onCinematicModeChange: (mode: CinematicMode) => void;
  onToggleAutoSlow: () => void;

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

const UI_MODE_LABELS: Record<UiMode, string> = {
  presentation: 'Presentation',
  tuning: 'Tuning',
  diagnostics: 'Diagnostics',
};

const DENSITY_OPTIONS: Array<{ label: string; density: BeamDensity }> = [
  { label: 'few', density: 'event-only' },
  { label: 'normal', density: 'event-plus-1' },
  { label: 'many', density: 'all' },
];

const CAMERA_PRESETS: Array<{ label: string; preset: CameraPreset }> = [
  { label: 'Zenith', preset: 'zenith' },
  { label: 'Oblique', preset: 'oblique' },
  { label: 'Chase', preset: 'chase' },
  { label: 'Paper-faithful close-up', preset: 'paper-faithful-closeup' },
];

export function ControlBar({
  autoSlowEnabled,
  uiMode,
  beamDensity,
  beamCalloutsEnabled,
  cinematicMode,
  onUiModeChange,
  onBeamDensityChange,
  onToggleBeamCallouts,
  onCameraPresetSelect,
  onCinematicModeChange,
  onToggleAutoSlow,
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
  const showSinrLiveControls = sceneLane === 'sinr-live';
  return (
    <div className="leo-control-bar">
      <label className="leo-control-bar__field-row">
        Mode:
        <select
          className={`${UI_CLASSES.select} leo-control-bar__mode-select`}
          aria-label="UI mode"
          value={uiMode}
          onChange={event => {
            const nextMode = event.target.value;
            if (isUiMode(nextMode)) onUiModeChange(nextMode);
          }}
        >
          {UI_MODES.map(mode => (
            <option key={mode} value={mode}>
              {UI_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>

      {showSinrLiveControls && (
        <>
          <div
            className="leo-control-bar__density-group"
            role="group"
            aria-label="Beam density"
            data-testid="beam-density-control"
          >
            {DENSITY_OPTIONS.map(option => {
              const selected = beamDensity === option.density;
              return (
                <button
                  key={option.density}
                  className={`${UI_CLASSES.button} leo-control-bar__density-button`}
                  type="button"
                  aria-label={`Set beam density to ${option.label}`}
                  aria-pressed={selected}
                  data-testid={`beam-density-${option.label}`}
                  onClick={() => onBeamDensityChange(option.density)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <label
            className="leo-control-bar__toggle"
            title="Show or hide beam information blocks in the scene"
          >
            <input
              className={UI_CLASSES.checkbox}
              type="checkbox"
              aria-label="Show beam information blocks"
              data-testid="beam-info-toggle"
              checked={beamCalloutsEnabled}
              onChange={onToggleBeamCallouts}
            />
            Beam Info
          </label>

          <div
            className="leo-control-bar__camera-group"
            role="group"
            aria-label="Camera presets"
            data-testid="camera-preset-control"
          >
            {CAMERA_PRESETS.map(option => (
              <button
                key={option.preset}
                className={`${UI_CLASSES.button} leo-control-bar__camera-button`}
                type="button"
                aria-label={`Set camera preset to ${option.label}`}
                data-testid={`camera-preset-${option.preset}`}
                onClick={() => onCameraPresetSelect(option.preset)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label
            className="leo-control-bar__toggle"
            title="Highlight serving beam path with cinematic spotlight"
          >
            <input
              className={UI_CLASSES.checkbox}
              type="checkbox"
              aria-label="Spotlight mode: highlight serving beam path"
              checked={cinematicMode === 'spotlight'}
              onChange={event => {
                onCinematicModeChange(event.target.checked ? 'spotlight' : 'off');
              }}
            />
            Spotlight
          </label>

          <label
            className="leo-control-bar__toggle"
            title="Auto-slow simulation rate during handover events"
          >
            <input
              className={UI_CLASSES.checkbox}
              type="checkbox"
              aria-label="Auto slow on handover"
              checked={autoSlowEnabled}
              onChange={onToggleAutoSlow}
            />
            HO Slow
          </label>
        </>
      )}

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
