import { UI_CLASSES, UI_TOKENS } from '../constants/uiTokens';
import type { BeamDensity, CameraPreset, CinematicMode } from '../scene/types';
import { UI_MODES, isUiMode, type UiMode } from './uiMode';

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
  onProfileChange: (profileId: string) => void;
  onUiModeChange: (mode: UiMode) => void;
  onBeamDensityChange: (density: BeamDensity) => void;
  onCameraPresetSelect: (preset: CameraPreset) => void;
  onCinematicModeChange: (mode: CinematicMode) => void;
  onTogglePause: () => void;
  onSpeedChange: (speed: number) => void;
  onDismissAutoSlow: () => void;
  onToggleAutoSlow: () => void;
}

const SHOW_PROFILE_SELECTOR = false;

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
  selectedProfileId,
  profileOptions,
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
  onProfileChange,
  onUiModeChange,
  onBeamDensityChange,
  onCameraPresetSelect,
  onCinematicModeChange,
  onTogglePause,
  onSpeedChange,
  onDismissAutoSlow,
  onToggleAutoSlow,
}: ControlBarProps) {
  return (
    <div className="leo-control-bar" style={{
      position: 'relative',
      zIndex: 10,
      width: '100%',
      maxWidth: '100%',
      display: 'flex',
      flexWrap: 'wrap',
      gap: 12,
      alignItems: 'center',
      background: UI_TOKENS.color.surface.controlBar,
      padding: '8px 16px',
      borderRadius: UI_TOKENS.radius.md,
      border: `1px solid ${UI_TOKENS.color.border.panel}`,
      boxShadow: '0 14px 32px rgba(0, 0, 0, 0.36)',
      color: UI_TOKENS.color.text.primary,
      fontSize: UI_TOKENS.type.size.body,
      fontFamily: UI_TOKENS.type.family.mono,
    }}>
      <button
        className={UI_CLASSES.button}
        onClick={onTogglePause}
        style={{
          cursor: 'pointer',
          background: paused ? 'rgba(118, 234, 215, 0.18)' : UI_TOKENS.color.surface.card,
          border: `1px solid ${UI_TOKENS.color.border.soft}`,
          color: UI_TOKENS.color.text.primary,
          padding: '4px 12px',
          borderRadius: UI_TOKENS.radius.sm,
        }}
      >
        {paused ? 'Play' : 'Pause'}
      </button>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        Mode:
        <select
          className={UI_CLASSES.select}
          aria-label="UI mode"
          value={uiMode}
          onChange={event => {
            const nextMode = event.target.value;
            if (isUiMode(nextMode)) onUiModeChange(nextMode);
          }}
          style={{
            cursor: 'pointer',
            background: UI_TOKENS.color.surface.field,
            border: `1px solid ${UI_TOKENS.color.border.tuningPanel}`,
            color: UI_TOKENS.color.text.primary,
            padding: '4px 8px',
            borderRadius: UI_TOKENS.radius.sm,
            minWidth: 138,
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
        role="group"
        aria-label="Beam density"
        data-testid="beam-density-control"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: 3,
          border: `1px solid ${UI_TOKENS.color.border.soft}`,
          borderRadius: UI_TOKENS.radius.sm,
          background: 'rgba(255, 255, 255, 0.04)',
        }}
      >
        {DENSITY_OPTIONS.map(option => {
          const selected = beamDensity === option.density;
          return (
            <button
              key={option.density}
              className={UI_CLASSES.button}
              type="button"
              aria-label={`Set beam density to ${option.label}`}
              aria-pressed={selected}
              data-testid={`beam-density-${option.label}`}
              onClick={() => onBeamDensityChange(option.density)}
              style={{
                cursor: 'pointer',
                minWidth: 58,
                background: selected ? 'rgba(118, 234, 215, 0.2)' : 'transparent',
                border: `1px solid ${selected ? 'rgba(118, 234, 215, 0.46)' : 'transparent'}`,
                color: selected ? '#d8fffa' : UI_TOKENS.color.text.secondary,
                padding: '4px 9px',
                borderRadius: UI_TOKENS.radius.sm,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div
        role="group"
        aria-label="Camera presets"
        data-testid="camera-preset-control"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {CAMERA_PRESETS.map(option => (
          <button
            key={option.preset}
            className={UI_CLASSES.button}
            type="button"
            aria-label={`Set camera preset to ${option.label}`}
            data-testid={`camera-preset-${option.preset}`}
            onClick={() => onCameraPresetSelect(option.preset)}
            style={{
              cursor: 'pointer',
              minWidth: 70,
              background: UI_TOKENS.color.surface.card,
              border: `1px solid ${UI_TOKENS.color.border.soft}`,
              color: UI_TOKENS.color.text.primary,
              padding: '4px 10px',
              borderRadius: UI_TOKENS.radius.sm,
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: uiMode === 'presentation' ? 'pointer' : 'not-allowed',
          opacity: uiMode === 'presentation' ? 1 : 0.62,
        }}
      >
        <input
          className={UI_CLASSES.checkbox}
          type="checkbox"
          aria-label="Spotlight mode"
          checked={cinematicMode === 'spotlight'}
          disabled={uiMode !== 'presentation'}
          onChange={event => {
            onCinematicModeChange(event.target.checked ? 'spotlight' : 'off');
          }}
          style={{ cursor: uiMode === 'presentation' ? 'pointer' : 'not-allowed' }}
        />
        Spotlight
      </label>

      {SHOW_PROFILE_SELECTOR && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Profile:
          <select
            className={UI_CLASSES.select}
            value={selectedProfileId}
            onChange={event => onProfileChange(event.target.value)}
            style={{
              cursor: 'pointer',
              background: UI_TOKENS.color.surface.field,
              border: `1px solid ${UI_TOKENS.color.border.soft}`,
              color: UI_TOKENS.color.text.primary,
              padding: '4px 8px',
              borderRadius: UI_TOKENS.radius.sm,
              minWidth: 220,
            }}
          >
            {profileOptions.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input
          className={UI_CLASSES.checkbox}
          type="checkbox"
          checked={autoSlowEnabled}
          onChange={onToggleAutoSlow}
          style={{ cursor: 'pointer' }}
        />
        HO Slow
      </label>

      {autoSlowApplied && (
        <button
          className={UI_CLASSES.button}
          onClick={onDismissAutoSlow}
        style={{
          cursor: 'pointer',
          background: 'rgba(123, 167, 255, 0.16)',
          border: '1px solid rgba(123, 167, 255, 0.32)',
          color: '#dbe7ff',
            padding: '4px 12px',
            borderRadius: UI_TOKENS.radius.sm,
          }}
        >
          Resume Normal Speed
        </button>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        Speed:
        <input
          className={UI_CLASSES.range}
          type="range"
          min={1}
          max={20}
          value={speed}
          onChange={e => onSpeedChange(Number(e.target.value))}
          style={{ width: 80 }}
        />
        <span>{speed}x</span>
      </label>

      <div style={{ color: autoSlowActive ? UI_TOKENS.color.semantic.warning.accent : UI_TOKENS.color.text.faint, minWidth: 140 }}>
        Scene: {effectiveSpeed.toFixed(1)}x{autoSlowApplied ? ' (HO Slow)' : autoSlowActive ? ' (HO Slow Off)' : ''}
      </div>

      <div
        data-testid="beam-hop-status-pill"
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 112,
          justifyContent: 'center',
          padding: '4px 10px',
          borderRadius: UI_TOKENS.radius.sm,
          border: `1px solid ${beamHopEnabled ? 'rgba(118, 234, 215, 0.42)' : UI_TOKENS.color.border.soft}`,
          background: beamHopEnabled ? 'rgba(118, 234, 215, 0.14)' : 'rgba(255, 255, 255, 0.04)',
          color: beamHopEnabled ? '#d8fffa' : UI_TOKENS.color.text.faint,
          fontWeight: 700,
          letterSpacing: 0,
        }}
      >
        <span>BH</span>
        <span>{beamHopEnabled ? `S${Math.max(beamHopSlotIndex, 0)}` : 'OFF'}</span>
      </div>
    </div>
  );
}
