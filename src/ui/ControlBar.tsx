import { UI_CLASSES } from '../constants/uiTokens';
import type { BeamDensity, CameraPreset, CinematicMode } from '../scene/types';
import { UI_MODES, isUiMode, type UiMode } from './uiMode';
import type { RuntimeHandoverMode } from '../modqn/runtimeControls';

interface ProfileOption {
  id: string;
  label: string;
}

interface ControlBarProps {
  selectedProfileId: string;
  profileOptions: ProfileOption[];
  paused: boolean;
  speed: number;
  effectiveSpeed: number;
  autoSlowActive: boolean;
  autoSlowApplied: boolean;
  autoSlowEnabled: boolean;
  uiMode: UiMode;
  beamDensity: BeamDensity;
  beamCalloutsEnabled: boolean;
  cinematicMode: CinematicMode;
  /** S3: current handover mode from App.tsx state (SDD §9.4 item 1). */
  handoverMode?: RuntimeHandoverMode;
  onProfileChange: (profileId: string) => void;
  onUiModeChange: (mode: UiMode) => void;
  onBeamDensityChange: (density: BeamDensity) => void;
  onToggleBeamCallouts: () => void;
  onCameraPresetSelect: (preset: CameraPreset) => void;
  onCinematicModeChange: (mode: CinematicMode) => void;
  onTogglePause: () => void;
  onSpeedChange: (speed: number) => void;
  onDismissAutoSlow: () => void;
  onToggleAutoSlow: () => void;
  /** S3: mode selector change handler from App.tsx (handles ω reset and mode reset). */
  onHandoverModeChange?: (mode: RuntimeHandoverMode) => void;

  // P2b Display-filter & focus UE controls
  sceneSource?: 'live-sim' | 'artifact-replay';
  liveUeCount?: number;
  ueDisplayCount?: number;
  maxUeCount?: number;
  onUeDisplayCountChange?: (count: number) => void;
  elevatedUeId?: string | null;
  ueIds?: readonly string[];
  onElevatedUeIdChange?: (id: string) => void;
}

// Public demo modes. ω adjustment is now handled inside the decision-overlay
// mode via the sidebar Apply action, not as a third top-level handover mode.
// P1c OQ-7: `'modqn-replay'` renamed to `'decision-overlay-on-live-sinr'` to
// disambiguate it from the new `sceneSource='artifact-replay'` axis.
const HANDOVER_MODE_OPTIONS: Array<{
  mode: RuntimeHandoverMode;
  label: string;
  disabledReason?: string;
}> = [
  { mode: 'sinr-offset', label: 'SINR Experiment' },
  { mode: 'decision-overlay-on-live-sinr', label: 'MODQN Demo' },
];

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
  paused,
  speed,
  effectiveSpeed,
  autoSlowActive,
  autoSlowApplied,
  autoSlowEnabled,
  uiMode,
  beamDensity,
  beamCalloutsEnabled,
  cinematicMode,
  handoverMode = 'sinr-offset',
  onUiModeChange,
  onBeamDensityChange,
  onToggleBeamCallouts,
  onCameraPresetSelect,
  onCinematicModeChange,
  onTogglePause,
  onSpeedChange,
  onToggleAutoSlow,
  onHandoverModeChange,
  sceneSource = 'live-sim',
  liveUeCount = 1,
  ueDisplayCount = 100,
  maxUeCount = 100,
  onUeDisplayCountChange,
  elevatedUeId = null,
  ueIds = [],
  onElevatedUeIdChange,
}: ControlBarProps) {
  const sceneSuffix = autoSlowApplied
    ? ' (HO Slow)'
    : autoSlowActive
      ? ' (HO Slow Off)'
      : '';
  return (
    <div className="leo-control-bar">
      <button
        className={`${UI_CLASSES.button} leo-control-bar__play`}
        type="button"
        data-paused={paused ? 'true' : 'false'}
        onClick={onTogglePause}
      >
        {paused ? 'Play' : 'Pause'}
      </button>

      {/* Handover mode selector. MODQN ω changes are applied inside replay. */}
      <div
        className="leo-control-bar__handover-mode-group"
        role="group"
        aria-label="Handover mode"
        data-testid="handover-mode-control"
      >
        {HANDOVER_MODE_OPTIONS.map(option => {
          const isSelected = handoverMode === option.mode;
          const isDisabled = option.disabledReason !== undefined;
          return (
            <button
              key={option.mode}
              className={`${UI_CLASSES.button} leo-control-bar__handover-mode-button`}
              type="button"
              aria-label={`Set handover mode to ${option.label}${isDisabled ? ` (${option.disabledReason})` : ''}`}
              aria-pressed={isSelected}
              aria-disabled={isDisabled}
              data-testid={`handover-mode-${option.mode}`}
              title={isDisabled ? option.disabledReason : undefined}
              disabled={isDisabled}
              onClick={() => {
                if (!isDisabled && onHandoverModeChange) {
                  onHandoverModeChange(option.mode);
                }
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

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

      <label className="leo-control-bar__field-row">
        Speed:
        <input
          className={`${UI_CLASSES.range} leo-control-bar__speed-range`}
          type="range"
          min={1}
          max={20}
          value={speed}
          aria-label="Playback speed"
          aria-valuetext={`${speed} times real time`}
          onChange={e => onSpeedChange(Number(e.target.value))}
        />
        <span aria-hidden="true">{speed}x</span>
      </label>

      {sceneSource === 'artifact-replay' ? (
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

      <div
        className="leo-control-bar__scene-readout"
        data-warning={autoSlowActive ? 'true' : 'false'}
      >
        Scene: {effectiveSpeed.toFixed(1)}x{sceneSuffix}
      </div>

    </div>
  );
}
