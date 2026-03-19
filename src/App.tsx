import { useState, useCallback } from 'react';
import { MainScene } from './scene/MainScene';
import type { RuntimeConfig, SimState } from './scene/types';
import { ControlBar } from './ui/ControlBar';
import { InfoPanel } from './ui/InfoPanel';

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  presentationMode: 'research-default',
  replay: {
    epochUtcMs: Date.UTC(2026, 0, 1, 0, 0, 0),
    startOffsetSec: 0,
    loop: false,
  },
};

export function App() {
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [profileId, setProfileId] = useState('hobs-2024-paper-default');
  const [simState, setSimState] = useState<SimState>({
    servingSatId: null as string | null,
    servingBeamId: null as number | null,
    sinrDb: -Infinity,
    hoCount: 0,
    lastHoReason: '',
  });

  const handleSimUpdate = useCallback((state: typeof simState) => {
    setSimState(state);
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <MainScene
        speed={speed}
        paused={paused}
        profileId={profileId}
        runtime={DEFAULT_RUNTIME_CONFIG}
        onSimUpdate={handleSimUpdate}
      />
      <ControlBar
        paused={paused}
        speed={speed}
        profileId={profileId}
        onTogglePause={() => setPaused(p => !p)}
        onSpeedChange={setSpeed}
        onProfileChange={setProfileId}
      />
      <InfoPanel {...simState} />
    </div>
  );
}
