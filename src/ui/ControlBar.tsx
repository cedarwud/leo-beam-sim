interface ControlBarProps {
  paused: boolean;
  speed: number;
  effectiveSpeed: number;
  autoSlowActive: boolean;
  autoSlowApplied: boolean;
  autoSlowEnabled: boolean;
  onTogglePause: () => void;
  onSpeedChange: (speed: number) => void;
  onDismissAutoSlow: () => void;
  onToggleAutoSlow: () => void;
}

export function ControlBar({
  paused,
  speed,
  effectiveSpeed,
  autoSlowActive,
  autoSlowApplied,
  autoSlowEnabled,
  onTogglePause,
  onSpeedChange,
  onDismissAutoSlow,
  onToggleAutoSlow,
}: ControlBarProps) {
  return (
    <div style={{
      position: 'absolute',
      top: 12,
      left: 12,
      zIndex: 10,
      display: 'flex',
      gap: 12,
      alignItems: 'center',
      background: 'rgba(0,0,0,0.7)',
      padding: '8px 16px',
      borderRadius: 8,
      color: 'white',
      fontSize: 14,
      fontFamily: 'monospace',
    }}>
      <button
        onClick={onTogglePause}
        style={{ cursor: 'pointer', background: 'none', border: '1px solid #666', color: 'white', padding: '4px 12px', borderRadius: 4 }}
      >
        {paused ? 'Play' : 'Pause'}
      </button>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={autoSlowEnabled}
          onChange={onToggleAutoSlow}
          style={{ cursor: 'pointer' }}
        />
        HO Slow
      </label>

      {autoSlowApplied && (
        <button
          onClick={onDismissAutoSlow}
          style={{ cursor: 'pointer', background: '#1c2a3a', border: '1px solid #4d85c7', color: '#d7ebff', padding: '4px 12px', borderRadius: 4 }}
        >
          Resume Normal Speed
        </button>
      )}
...
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        Speed:
        <input
          type="range"
          min={1}
          max={20}
          value={speed}
          onChange={e => onSpeedChange(Number(e.target.value))}
          style={{ width: 80 }}
        />
        <span>{speed}x</span>
      </label>

      <div style={{ color: autoSlowActive ? '#ffd84a' : '#9aa3b2', minWidth: 140 }}>
        Scene: {effectiveSpeed.toFixed(1)}x{autoSlowApplied ? ' (HO Slow)' : autoSlowActive ? ' (HO Slow Off)' : ''}
      </div>
    </div>
  );
}
