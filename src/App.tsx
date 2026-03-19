import { useCallback, useEffect, useState } from 'react';
import { MainScene } from './scene/MainScene';
import { loadProfile } from './profiles';
import type { RuntimeConfig, SimState } from './scene/types';
import { recommendDemoReplayStartOffsetSec } from './scene/replay-recommendation';
import { ControlBar } from './ui/ControlBar';
import { InfoPanel } from './ui/InfoPanel';

const PROFILE_ID = 'hobs-2024-candidate-rich';
const PROFILE = loadProfile(PROFILE_ID);
const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const DEMO_START = recommendDemoReplayStartOffsetSec(PROFILE, EPOCH_MS);
const DEFAULT_BASE_SPEED = 10;
const HANDOVER_FOCUS_SPEED = 2;

const RUNTIME: RuntimeConfig = {
  presentationMode: 'demo-readability',
  replay: {
    epochUtcMs: EPOCH_MS,
    startOffsetSec: DEMO_START,
    loop: true,
  },
};

export function App() {
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_BASE_SPEED);
  const [autoSlowDismissed, setAutoSlowDismissed] = useState(false);
  const [simState, setSimState] = useState<SimState>({
    servingSatId: null,
    servingBeamId: null,
    pendingTargetSatId: null,
    pendingTargetBeamId: null,
    recentHoSourceSatId: null,
    recentHoTargetSatId: null,
    sinrDb: -Infinity,
    hoCount: 0,
    lastHoReason: '',
  });

  const handleSimUpdate = useCallback((state: SimState) => {
    setSimState(state);
  }, []);

  const autoSlowActive =
    simState.pendingTargetSatId !== null
    || simState.recentHoSourceSatId !== null
    || simState.recentHoTargetSatId !== null;
  const autoSlowApplied = autoSlowActive && !autoSlowDismissed;
  const effectiveSpeed = autoSlowApplied ? Math.min(speed, HANDOVER_FOCUS_SPEED) : speed;

  useEffect(() => {
    if (!autoSlowActive) setAutoSlowDismissed(false);
  }, [autoSlowActive]);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <MainScene
        speed={effectiveSpeed}
        paused={paused}
        profileId={PROFILE_ID}
        runtime={RUNTIME}
        onSimUpdate={handleSimUpdate}
      />
      <ControlBar
        paused={paused}
        speed={speed}
        effectiveSpeed={effectiveSpeed}
        autoSlowActive={autoSlowActive}
        autoSlowApplied={autoSlowApplied}
        onTogglePause={() => setPaused(p => !p)}
        onSpeedChange={setSpeed}
        onDismissAutoSlow={() => setAutoSlowDismissed(true)}
      />
      <InfoPanel {...simState} />
    </div>
  );
}
