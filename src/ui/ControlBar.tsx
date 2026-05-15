import { UI_CLASSES } from '../constants/uiTokens';
import type { BeamDensity, CameraPreset, CinematicMode } from '../scene/types';
import { UI_MODES, isUiMode, type UiMode } from './uiMode';
import type { RuntimeHandoverMode } from './useModqnHandoverState';

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
  cinematicMode: CinematicMode;
  beamHopEnabled: boolean;
  beamHopSlotIndex: number;
  /** S3: current handover mode from App.tsx state (SDD §9.4 item 1). */
  handoverMode?: RuntimeHandoverMode;
  onProfileChange: (profileId: string) => void;
  onUiModeChange: (mode: UiMode) => void;
  onBeamDensityChange: (density: BeamDensity) => void;
  onCameraPresetSelect: (preset: CameraPreset) => void;
  onCinematicModeChange: (mode: CinematicMode) => void;
  onTogglePause: () => void;
  onSpeedChange: (speed: number) => void;
  onDismissAutoSlow: () => void;
  onToggleAutoSlow: () => void;
  /** S3: mode selector change handler from App.tsx (handles profile lock, ω reset). */
  onHandoverModeChange?: (mode: RuntimeHandoverMode) => void;
}

// S3: Mode selector entries (SDD §9.4 item 1). omega-heuristic is disabled
// with tooltip in S3; enabled in S4.
const HANDOVER_MODE_OPTIONS: Array<{
  mode: RuntimeHandoverMode;
  label: string;
  disabledReason?: string;
}> = [
  { mode: 'sinr-offset', label: 'SINR-offset' },
  { mode: 'modqn-replay', label: 'MODQN replay' },
  { mode: 'omega-heuristic', label: 'ω heuristic', disabledReason: 'Coming in S4' },
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
  cinematicMode,
  beamHopEnabled,
  beamHopSlotIndex,
  handoverMode = 'sinr-offset',
  onUiModeChange,
  onBeamDensityChange,
  onCameraPresetSelect,
  onCinematicModeChange,
  onTogglePause,
  onSpeedChange,
  onToggleAutoSlow,
  onHandoverModeChange,
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

      {/* S3: 3-way handover mode selector (SDD §9.4 item 1). omega-heuristic
          is disabled with tooltip in this slice; enabled in S4. */}
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

      <div
        className="leo-control-bar__scene-readout"
        data-warning={autoSlowActive ? 'true' : 'false'}
      >
        Scene: {effectiveSpeed.toFixed(1)}x{sceneSuffix}
      </div>

      <div
        className="leo-control-bar__beam-hop-pill"
        data-testid="beam-hop-status-pill"
        data-enabled={beamHopEnabled ? 'true' : 'false'}
        role="status"
        aria-live="polite"
        aria-label={`Beam hopping ${beamHopEnabled ? `enabled, slot ${Math.max(beamHopSlotIndex, 0)}` : 'disabled'}`}
        title="Beam-hopping status"
      >
        <span aria-hidden="true">BH</span>
        <span aria-hidden="true">{beamHopEnabled ? `S${Math.max(beamHopSlotIndex, 0)}` : 'OFF'}</span>
      </div>
    </div>
  );
}
