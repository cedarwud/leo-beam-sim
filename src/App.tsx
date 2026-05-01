import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import { MainScene } from './scene/MainScene';
import {
  getProfileLabel,
  loadProfile,
  profileList,
} from './profiles';
import type { Profile } from './profiles/types';
import type { PresentationMode, RuntimeConfig, SimState } from './scene/types';
import { createInitialSimState } from './scene/initialSimState';
import { recommendDemoReplayStartOffsetSec } from './scene/replay-recommendation';
import {
  applyHandoverPolicyTuning,
  createHandoverPolicyTuningState,
  getHandoverPolicyResetKey,
  hasHandoverPolicyOverrides,
  sameHandoverPolicyTuning,
  type HandoverPolicyTuningState,
} from './handoverPolicyTuning';
import {
  applySignalTuning,
  createSignalTuningState,
  getSignalTuningEvidenceKey,
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

interface HandoverPolicyRuntimeState {
  profileId: string;
  draft: HandoverPolicyTuningState;
  applied: HandoverPolicyTuningState;
  version: number;
}

function resolvePresentationMode(profile: Profile): PresentationMode {
  if (profile.id === DEFAULT_PROFILE_ID) return 'demo-readability';
  if (profile.profileClass === 'candidate-rich') return 'candidate-rich';
  return 'research-default';
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
  const [handoverPolicyState, setHandoverPolicyState] = useState<HandoverPolicyRuntimeState>(() => {
    const initialPolicy = createHandoverPolicyTuningState(baseProfile);
    return {
      profileId: baseProfile.id,
      draft: initialPolicy,
      applied: initialPolicy,
      version: 0,
    };
  });
  const handoverPolicyDefaults = useMemo(
    () => createHandoverPolicyTuningState(baseProfile),
    [baseProfile],
  );
  const handoverPolicyDraft = handoverPolicyState.profileId === baseProfile.id
    ? handoverPolicyState.draft
    : handoverPolicyDefaults;
  const appliedHandoverPolicy = handoverPolicyState.profileId === baseProfile.id
    ? handoverPolicyState.applied
    : handoverPolicyDefaults;
  const handoverPolicyVersion = handoverPolicyState.profileId === baseProfile.id
    ? handoverPolicyState.version
    : 0;
  const signalTunedProfile = useMemo(
    () => applySignalTuning(baseProfile, signalTuning),
    [baseProfile, signalTuning],
  );
  const effectiveProfile = useMemo(
    () => applyHandoverPolicyTuning(signalTunedProfile, appliedHandoverPolicy),
    [signalTunedProfile, appliedHandoverPolicy],
  );
  const hasSignalOverrides = useMemo(
    () => hasSignalTuningOverrides(baseProfile, signalTuning),
    [baseProfile, signalTuning],
  );
  const hasHandoverAppliedOverrides = useMemo(
    () => hasHandoverPolicyOverrides(baseProfile, appliedHandoverPolicy),
    [baseProfile, appliedHandoverPolicy],
  );
  const hasHandoverDraftChanges = useMemo(
    () => !sameHandoverPolicyTuning(handoverPolicyDraft, appliedHandoverPolicy),
    [handoverPolicyDraft, appliedHandoverPolicy],
  );
  const hasHandoverResetTarget = useMemo(
    () => hasHandoverAppliedOverrides || hasHandoverPolicyOverrides(baseProfile, handoverPolicyDraft),
    [baseProfile, handoverPolicyDraft, hasHandoverAppliedOverrides],
  );
  const signalResetKey = useMemo(
    () => getSignalTuningResetKey(signalTuning),
    [signalTuning],
  );
  const signalEvidenceKey = useMemo(
    () => getSignalTuningEvidenceKey(signalTuning),
    [signalTuning],
  );
  const handoverResetKey = useMemo(
    () => `${handoverPolicyVersion}:${getHandoverPolicyResetKey(appliedHandoverPolicy)}`,
    [appliedHandoverPolicy, handoverPolicyVersion],
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
    handoverResetKey,
  }), [demoStartOffset, effectiveProfile, handoverResetKey, signalResetKey]);

  const [simState, setSimState] = useState<SimState>(() => createInitialSimState(baseProfile));
  const [staleFormulaEvidenceKey, setStaleFormulaEvidenceKey] = useState<string | null>(null);

  const handleSimUpdate = useCallback((state: SimState) => {
    setSimState(state);
    setStaleFormulaEvidenceKey(current => (
      current === signalEvidenceKey ? null : current
    ));
  }, [signalEvidenceKey]);

  const handleSignalTuningChange = useCallback((next: SignalTuningState) => {
    setStaleFormulaEvidenceKey(getSignalTuningEvidenceKey(next));
    startTransition(() => {
      setSignalTuning(next);
    });
  }, []);

  const handleResetSignalTuning = useCallback(() => {
    const next = createSignalTuningState(baseProfile);
    setStaleFormulaEvidenceKey(getSignalTuningEvidenceKey(next));
    startTransition(() => {
      setSignalTuning(next);
    });
  }, [baseProfile]);

  const handleHandoverPolicyDraftChange = useCallback((next: HandoverPolicyTuningState) => {
    startTransition(() => {
      setHandoverPolicyState(current => ({
        profileId: baseProfile.id,
        draft: next,
        applied: current.profileId === baseProfile.id ? current.applied : handoverPolicyDefaults,
        version: current.profileId === baseProfile.id ? current.version : 0,
      }));
    });
  }, [baseProfile.id, handoverPolicyDefaults]);

  const handleApplyHandoverPolicy = useCallback(() => {
    const nextApplied = { ...handoverPolicyDraft, policy: 'sinr-offset' as const };
    const nextEffectiveProfile = applyHandoverPolicyTuning(signalTunedProfile, nextApplied);
    startTransition(() => {
      setHandoverPolicyState(current => ({
        profileId: baseProfile.id,
        draft: nextApplied,
        applied: nextApplied,
        version: (current.profileId === baseProfile.id ? current.version : 0) + 1,
      }));
      setSimState(createInitialSimState(nextEffectiveProfile));
      setAutoSlowDismissed(false);
    });
  }, [baseProfile.id, handoverPolicyDraft, signalTunedProfile]);

  const handleResetHandoverPolicy = useCallback(() => {
    const defaults = createHandoverPolicyTuningState(baseProfile);
    const nextEffectiveProfile = applyHandoverPolicyTuning(signalTunedProfile, defaults);
    startTransition(() => {
      setHandoverPolicyState(current => ({
        profileId: baseProfile.id,
        draft: defaults,
        applied: defaults,
        version: (current.profileId === baseProfile.id ? current.version : 0) + 1,
      }));
      setSimState(createInitialSimState(nextEffectiveProfile));
      setAutoSlowDismissed(false);
    });
  }, [baseProfile, signalTunedProfile]);

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
    setHandoverPolicyState(current => {
      const defaults = createHandoverPolicyTuningState(baseProfile);
      return {
        profileId: baseProfile.id,
        draft: defaults,
        applied: defaults,
        version: current.version + 1,
      };
    });
    setSimState(createInitialSimState(baseProfile));
    setStaleFormulaEvidenceKey(null);
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
          isFormulaEvidenceStale={staleFormulaEvidenceKey !== null}
          handoverDraft={handoverPolicyDraft}
          appliedHandoverPolicy={appliedHandoverPolicy}
          hasHandoverDraftChanges={hasHandoverDraftChanges}
          hasHandoverOverrides={hasHandoverResetTarget}
          onTuningChange={handleSignalTuningChange}
          onReset={handleResetSignalTuning}
          onHandoverDraftChange={handleHandoverPolicyDraftChange}
          onApplyHandoverPolicy={handleApplyHandoverPolicy}
          onResetHandoverPolicy={handleResetHandoverPolicy}
        />
      )}
      <InfoPanel {...simState} uiMode={uiMode} profile={effectiveProfile} />
    </div>
  );
}
