import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { MainScene } from './scene/MainScene';
import {
  getFormulaFamilyLabel,
  getProfileLabel,
  loadProfile,
  profileList,
} from './profiles';
import type { Profile } from './profiles/types';
import type { PresentationMode, RuntimeConfig, SignalSourceState, SimState } from './scene/types';
import { recommendDemoReplayStartOffsetSec } from './scene/replay-recommendation';
import {
  applySignalTuning,
  createSignalTuningState,
  getSignalTuningResetKey,
  hasSignalTuningOverrides,
  type SignalTuningState,
} from './signalTuning';
import { ControlBar } from './ui/ControlBar';
import { InfoPanel } from './ui/InfoPanel';
import { SignalTuningPanel } from './ui/SignalTuningPanel';
import { persistUiMode, readPersistedUiMode, type UiMode } from './ui/uiMode';

const DEFAULT_PROFILE_ID = 'hobs-2024-candidate-rich';
const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const DEFAULT_BASE_SPEED = 5;
const HANDOVER_FOCUS_SPEED = 1;

function resolvePresentationMode(profile: Profile): PresentationMode {
  if (profile.id === DEFAULT_PROFILE_ID) return 'demo-readability';
  if (profile.profileClass === 'candidate-rich') return 'candidate-rich';
  return 'research-default';
}

function createEmptySignalSource(): SignalSourceState {
  return {
    satId: null,
    beamId: null,
    sinrDb: null,
    elevationDeg: null,
    rangeKm: null,
    status: 'none',
  };
}

function createInitialSimState(profile: Profile): SimState {
  const emptyPhysicalServing = createEmptySignalSource();
  const emptyPanelPrimary = createEmptySignalSource();
  const emptyPanelComparison = createEmptySignalSource();

  return {
    profileId: profile.id,
    formulaFamilyLabel: getFormulaFamilyLabel(profile.formulaFamily),
    physicalServing: emptyPhysicalServing,
    panelPrimary: { ...emptyPanelPrimary, role: 'none' },
    panelComparison: { ...emptyPanelComparison, role: 'none' },
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
    physicalServingBudget: null,
    servingBudget: null,
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
  const [uiMode, setUiMode] = useState<UiMode>(() => readPersistedUiMode());
  const baseProfile = useMemo(() => loadProfile(selectedProfileId), [selectedProfileId]);
  const [signalTuning, setSignalTuning] = useState<SignalTuningState>(() => createSignalTuningState(baseProfile));
  const effectiveProfile = useMemo(
    () => applySignalTuning(baseProfile, signalTuning),
    [baseProfile, signalTuning],
  );
  const hasSignalOverrides = useMemo(
    () => hasSignalTuningOverrides(baseProfile, signalTuning),
    [baseProfile, signalTuning],
  );
  const signalResetKey = useMemo(
    () => getSignalTuningResetKey(signalTuning),
    [signalTuning],
  );
  const profileOptions = useMemo(
    () => profileList.map(entry => ({ id: entry.id, label: getProfileLabel(entry) })),
    [],
  );

  // Memoize recommendation to prevent recalculating on every render,
  // but this still runs during the first render. 
  // Given we have localStorage cache now, it will be instant after the first run.
  const demoStartOffset = useMemo(
    () => recommendDemoReplayStartOffsetSec(baseProfile, EPOCH_MS),
    [baseProfile],
  );

  const runtime = useMemo((): RuntimeConfig => ({
    presentationMode: resolvePresentationMode(effectiveProfile),
    replay: {
      epochUtcMs: EPOCH_MS,
      startOffsetSec: demoStartOffset,
      loop: true,
    },
    signalResetKey,
  }), [demoStartOffset, effectiveProfile, signalResetKey]);

  const [simState, setSimState] = useState<SimState>(() => createInitialSimState(baseProfile));

  const handleSimUpdate = useCallback((state: SimState) => {
    setSimState(state);
  }, []);

  const handleSignalTuningChange = useCallback((next: SignalTuningState) => {
    startTransition(() => {
      setSignalTuning(next);
    });
  }, []);

  const handleResetSignalTuning = useCallback(() => {
    startTransition(() => {
      setSignalTuning(createSignalTuningState(baseProfile));
    });
  }, [baseProfile]);

  const handleUiModeChange = useCallback((nextMode: UiMode) => {
    setUiMode(nextMode);
    persistUiMode(nextMode);
  }, []);

  const autoSlowActive = simState.pendingTargetSatId !== null;
  const autoSlowApplied = autoSlowEnabled && autoSlowActive && !autoSlowDismissed;
  const effectiveSpeed = autoSlowApplied ? Math.min(speed, HANDOVER_FOCUS_SPEED) : speed;

  useEffect(() => {
    if (!autoSlowActive) setAutoSlowDismissed(false);
  }, [autoSlowActive]);

  useEffect(() => {
    setSignalTuning(createSignalTuningState(baseProfile));
    setSimState(createInitialSimState(baseProfile));
    setAutoSlowDismissed(false);
  }, [baseProfile]);

  return (
    <div data-ui-mode={uiMode} style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <MainScene
        speed={effectiveSpeed}
        paused={paused}
        profile={effectiveProfile}
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
        uiMode={uiMode}
        onProfileChange={setSelectedProfileId}
        onUiModeChange={handleUiModeChange}
        onTogglePause={() => setPaused(p => !p)}
        onSpeedChange={setSpeed}
        onDismissAutoSlow={() => setAutoSlowDismissed(true)}
        onToggleAutoSlow={() => setAutoSlowEnabled(e => !e)}
      />
      {uiMode === 'tuning' && (
        <SignalTuningPanel
          baseProfile={baseProfile}
          tuning={signalTuning}
          hasOverrides={hasSignalOverrides}
          currentSinrDb={simState.physicalServing.sinrDb ?? -Infinity}
          formulaBudget={simState.physicalServingBudget}
          formulaSource={simState.physicalServing}
          onTuningChange={handleSignalTuningChange}
          onReset={handleResetSignalTuning}
        />
      )}
      <InfoPanel {...simState} uiMode={uiMode} profile={effectiveProfile} />
    </div>
  );
}
