import { useCallback, useEffect, useMemo, useState } from 'react';
import { MainScene } from './scene/MainScene';
import { loadProfile } from './profiles';
import type { RuntimeConfig, SimState } from './scene/types';
import { recommendDemoReplayStartOffsetSec } from './scene/replay-recommendation';
import { ControlBar } from './ui/ControlBar';
import { InfoPanel } from './ui/InfoPanel';

const PROFILE_ID = 'hobs-2024-candidate-rich';
const PROFILE = loadProfile(PROFILE_ID);
const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const DEFAULT_BASE_SPEED = 5;
const HANDOVER_FOCUS_SPEED = 1;

export function App() {
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_BASE_SPEED);
  const [autoSlowEnabled, setAutoSlowEnabled] = useState(true);
  const [autoSlowDismissed, setAutoSlowDismissed] = useState(false);

  // Memoize recommendation to prevent recalculating on every render,
  // but this still runs during the first render. 
  // Given we have localStorage cache now, it will be instant after the first run.
  const demoStartOffset = useMemo(() => 
    recommendDemoReplayStartOffsetSec(PROFILE, EPOCH_MS), 
  []);

  const runtime = useMemo((): RuntimeConfig => ({
    presentationMode: 'demo-readability',
    replay: {
      epochUtcMs: EPOCH_MS,
      startOffsetSec: demoStartOffset,
      loop: true,
    },
  }), [demoStartOffset]);

  const [simState, setSimState] = useState<SimState>({
    servingSatId: null,
    servingBeamId: null,
    servingElevationDeg: null,
    servingRangeKm: null,
    pendingTargetSatId: null,
    pendingTargetBeamId: null,
    pendingTargetSinrDb: null,
    comparisonSatId: null,
    comparisonBeamId: null,
    comparisonElevationDeg: null,
    comparisonRangeKm: null,
    comparisonSinrDb: null,
    comparisonKind: null,
    sinrDeltaDb: null,
    recentHoSourceSatId: null,
    recentHoTargetSatId: null,
    sinrDb: -Infinity,
    handoverOffsetDb: PROFILE.handover.offsetDb,
    handoverTriggerProgressSec: 0,
    handoverTriggerSec: PROFILE.handover.triggerTimeSec,
    hoCount: 0,
    lastHoReason: '',
    beamHopEnabled: PROFILE.beamHopping.enabled,
    beamHopSlotIndex: -1,
    beamHopSlotSec: PROFILE.beamHopping.slotSec,
    servingBeamActiveThisSlot: null,
    servingSatActiveBeamIds: [],
    pendingTargetActiveBeamIds: [],
  });

  const handleSimUpdate = useCallback((state: SimState) => {
    setSimState(state);
  }, []);

  const autoSlowActive = simState.pendingTargetSatId !== null;
  const autoSlowApplied = autoSlowEnabled && autoSlowActive && !autoSlowDismissed;
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
        runtime={runtime}
        onSimUpdate={handleSimUpdate}
      />
      <ControlBar
        paused={paused}
        speed={speed}
        effectiveSpeed={effectiveSpeed}
        autoSlowActive={autoSlowActive}
        autoSlowApplied={autoSlowApplied}
        autoSlowEnabled={autoSlowEnabled}
        onTogglePause={() => setPaused(p => !p)}
        onSpeedChange={setSpeed}
        onDismissAutoSlow={() => setAutoSlowDismissed(true)}
        onToggleAutoSlow={() => setAutoSlowEnabled(e => !e)}
      />
      <InfoPanel {...simState} />
    </div>
  );
}
