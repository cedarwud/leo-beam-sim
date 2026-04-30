import { UI_CLASSES, UI_TOKENS } from '../constants/uiTokens';
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
  onProfileChange: (profileId: string) => void;
  onUiModeChange: (mode: UiMode) => void;
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
  onProfileChange,
  onUiModeChange,
  onTogglePause,
  onSpeedChange,
  onDismissAutoSlow,
  onToggleAutoSlow,
}: ControlBarProps) {
  return (
    <div className="leo-control-bar" style={{
      position: 'absolute',
      top: 12,
      left: 12,
      zIndex: 10,
      display: 'flex',
      flexWrap: 'wrap',
      gap: 12,
      alignItems: 'center',
      background: UI_TOKENS.color.surface.controlBar,
      padding: '8px 16px',
      borderRadius: UI_TOKENS.radius.md,
      color: UI_TOKENS.color.text.primary,
      fontSize: UI_TOKENS.type.size.body,
      fontFamily: UI_TOKENS.type.family.mono,
    }}>
      <button
        className={UI_CLASSES.button}
        onClick={onTogglePause}
        style={{
          cursor: 'pointer',
          background: 'none',
          border: '1px solid #666',
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
            border: '1px solid rgba(141, 247, 229, 0.38)',
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
              border: '1px solid #666',
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
            background: '#1c2a3a',
            border: '1px solid #4d85c7',
            color: '#d7ebff',
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

      <div style={{ color: autoSlowActive ? UI_TOKENS.color.semantic.warning.accent : '#9aa3b2', minWidth: 140 }}>
        Scene: {effectiveSpeed.toFixed(1)}x{autoSlowApplied ? ' (HO Slow)' : autoSlowActive ? ' (HO Slow Off)' : ''}
      </div>
    </div>
  );
}
