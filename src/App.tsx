import { useCallback, useEffect, useMemo, useState } from 'react';
import { MainScene } from './scene/MainScene';
import {
  getFormulaFamilyLabel,
  getProfileLabel,
  loadProfile,
  profileList,
} from './profiles';
import type { Profile } from './profiles/types';
import type { PresentationMode, RuntimeConfig, SimState } from './scene/types';
import { recommendDemoReplayStartOffsetSec } from './scene/replay-recommendation';
import { ControlBar } from './ui/ControlBar';
import { InfoPanel } from './ui/InfoPanel';

const DEFAULT_PROFILE_ID = 'hobs-2024-candidate-rich';
const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const DEFAULT_BASE_SPEED = 5;
const HANDOVER_FOCUS_SPEED = 1;

function resolvePresentationMode(profile: Profile): PresentationMode {
  if (profile.id === DEFAULT_PROFILE_ID) return 'demo-readability';
  if (profile.profileClass === 'candidate-rich') return 'candidate-rich';
  return 'research-default';
}

function createInitialSimState(profile: Profile): SimState {
  return {
    profileId: profile.id,
    formulaFamilyLabel: getFormulaFamilyLabel(profile.formulaFamily),
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
    handoverOffsetDb: profile.handover.offsetDb,
    handoverTriggerProgressSec: 0,
    handoverTriggerSec: profile.handover.triggerTimeSec,
    hoCount: 0,
    lastHoReason: '',
    beamHopEnabled: profile.beamHopping.enabled,
    beamHopSlotIndex: -1,
    beamHopSlotSec: profile.beamHopping.slotSec,
    servingBeamActiveThisSlot: null,
    servingSatActiveBeamIds: [],
    pendingTargetActiveBeamIds: [],
  };
}

export function App() {
  const [selectedProfileId, setSelectedProfileId] = useState(DEFAULT_PROFILE_ID);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_BASE_SPEED);
  const [autoSlowEnabled, setAutoSlowEnabled] = useState(true);
  const [autoSlowDismissed, setAutoSlowDismissed] = useState(false);
  const profile = useMemo(() => loadProfile(selectedProfileId), [selectedProfileId]);
  const profileOptions = useMemo(
    () => profileList.map(entry => ({ id: entry.id, label: getProfileLabel(entry) })),
    [],
  );

  // Memoize recommendation to prevent recalculating on every render,
  // but this still runs during the first render. 
  // Given we have localStorage cache now, it will be instant after the first run.
  const demoStartOffset = useMemo(
    () => recommendDemoReplayStartOffsetSec(profile, EPOCH_MS),
    [profile],
  );

  const runtime = useMemo((): RuntimeConfig => ({
    presentationMode: resolvePresentationMode(profile),
    replay: {
      epochUtcMs: EPOCH_MS,
      startOffsetSec: demoStartOffset,
      loop: true,
    },
  }), [demoStartOffset, profile]);

  const [simState, setSimState] = useState<SimState>(() => createInitialSimState(profile));

  const handleSimUpdate = useCallback((state: SimState) => {
    setSimState(state);
  }, []);

  const autoSlowActive = simState.pendingTargetSatId !== null;
  const autoSlowApplied = autoSlowEnabled && autoSlowActive && !autoSlowDismissed;
  const effectiveSpeed = autoSlowApplied ? Math.min(speed, HANDOVER_FOCUS_SPEED) : speed;

  useEffect(() => {
    if (!autoSlowActive) setAutoSlowDismissed(false);
  }, [autoSlowActive]);

  useEffect(() => {
    setSimState(createInitialSimState(profile));
    setAutoSlowDismissed(false);
  }, [profile]);

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <MainScene
        speed={effectiveSpeed}
        paused={paused}
        profileId={selectedProfileId}
        runtime={runtime}
        onSimUpdate={handleSimUpdate}
      />
      <ControlBar
        selectedProfileId={selectedProfileId}
        profileOptions={profileOptions}
        paused={paused}
        speed={speed}
        effectiveSpeed={effectiveSpeed}
        autoSlowActive={autoSlowActive}
        autoSlowApplied={autoSlowApplied}
        autoSlowEnabled={autoSlowEnabled}
        onProfileChange={setSelectedProfileId}
        onTogglePause={() => setPaused(p => !p)}
        onSpeedChange={setSpeed}
        onDismissAutoSlow={() => setAutoSlowDismissed(true)}
        onToggleAutoSlow={() => setAutoSlowEnabled(e => !e)}
      />
      <InfoPanel {...simState} />
    </div>
  );
}
