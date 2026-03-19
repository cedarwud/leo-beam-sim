import { profiles } from '../profiles';

interface ControlBarProps {
  paused: boolean;
  speed: number;
  profileId: string;
  onTogglePause: () => void;
  onSpeedChange: (speed: number) => void;
  onProfileChange: (id: string) => void;
}

export function ControlBar({
  paused,
  speed,
  profileId,
  onTogglePause,
  onSpeedChange,
  onProfileChange,
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

      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        Speed:
        <input
          type="range"
          min={1}
          max={100}
          value={speed}
          onChange={e => onSpeedChange(Number(e.target.value))}
          style={{ width: 80 }}
        />
        <span>{speed}x</span>
      </label>

      <select
        value={profileId}
        onChange={e => onProfileChange(e.target.value)}
        style={{ background: '#333', color: 'white', border: '1px solid #666', padding: '4px 8px', borderRadius: 4 }}
      >
        {Object.keys(profiles).map(id => (
          <option key={id} value={id}>{id}</option>
        ))}
      </select>
    </div>
  );
}
