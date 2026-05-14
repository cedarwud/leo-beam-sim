import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MainScene } from './scene/MainScene';
import {
  getProfileLabel,
  loadProfile,
  profileList,
} from './profiles';
import type { Profile } from './profiles/types';
import type { BeamDensity, CameraPreset, CinematicMode, PresentationMode, RuntimeConfig, SimState } from './scene/types';
import { createInitialSimState } from './scene/initialSimState';
import { recommendDemoReplayStartOffsetSec } from './scene/replay-recommendation';
import {
  MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL,
  createModqnReplayPlaybackDisplayState,
  getModqnReplayPlaybackModelValidationIssue,
  type ModqnReplayPlaybackDisplayState,
} from './modqn/replay-bundle';
import {
  deriveRuntimeVisualSettings,
  readPrefersReducedMotion,
  readRuntimeViewport,
  resolveRuntimeCinematicMode,
  subscribeToReducedMotionPreference,
  subscribeToRuntimeViewport,
} from './scene/runtimeConfig';
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
import { DiagnosticsDrawer } from './ui/DiagnosticsDrawer';
import { InfoPanel } from './ui/InfoPanel';
import { ModeEvidenceStrip } from './ui/ModeEvidenceStrip';
import {
  ModqnBaselineHandoverControls,
  ModqnBaselineReplayEvidence,
} from './ui/ModqnBaselineIntegrationPanel';
import { ModqnReplayPlaybackShell } from './ui/ModqnReplayPlaybackShell';
import { ModqnReplaySceneCues } from './ui/ModqnReplaySceneCues';
import { ModqnReplaySceneOverlay } from './ui/ModqnReplaySceneOverlay';
import { HandoverPolicyControls } from './ui/HandoverPolicyControls';
import { SidebarTabShell, type SidebarTabItem } from './ui/SidebarTabShell';
import { SignalTuningPanel } from './ui/SignalTuningPanel';
import type { TuningPageRequest } from './ui/signal-tuning/types';
import { persistUiMode, readPersistedUiMode, type UiMode } from './ui/uiMode';

const DEFAULT_PROFILE_ID = 'hobs-2024-candidate-rich';
const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const DEFAULT_BASE_SPEED = 5;
const HANDOVER_FOCUS_SPEED = 1;

type LeftSidebarTab = 'handover' | 'signal';
type RightSidebarTab = 'modqn' | 'live';

const LEFT_SIDEBAR_TABS: readonly SidebarTabItem<LeftSidebarTab>[] = [
  { key: 'handover', label: 'Live handover', description: 'policy controls' },
  { key: 'signal', label: 'Signal formula', description: 'SINR tuning' },
];

const RIGHT_SIDEBAR_TABS: readonly SidebarTabItem<RightSidebarTab>[] = [
  { key: 'modqn', label: 'MODQN replay', description: 'baseline evidence' },
  { key: 'live', label: 'Live status', description: 'HOBS/SINR' },
];

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
  const [leftSidebarTab, setLeftSidebarTab] = useState<LeftSidebarTab>('handover');
  const [rightSidebarTab, setRightSidebarTab] = useState<RightSidebarTab>('modqn');
  const [cinematicMode, setCinematicMode] = useState<CinematicMode>('off');
  const [beamDensityOverride, setBeamDensityOverride] = useState<BeamDensity | null>(null);
  const [cameraCommand, setCameraCommand] = useState<RuntimeConfig['cameraCommand']>();
  const [reducedMotion, setReducedMotion] = useState(() => readPrefersReducedMotion());
  const [viewport, setViewport] = useState(() => readRuntimeViewport());
  const cameraCommandSequenceRef = useRef(0);
  const tuningPageRequestSequenceRef = useRef(0);
  const [tuningPageRequest, setTuningPageRequest] = useState<TuningPageRequest | null>(null);
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

  const runtimeVisualSettings = useMemo(
    () => deriveRuntimeVisualSettings(uiMode, reducedMotion),
    [reducedMotion, uiMode],
  );
  const effectiveCinematicMode = useMemo(
    () => resolveRuntimeCinematicMode(uiMode, cinematicMode),
    [cinematicMode, uiMode],
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
    ...runtimeVisualSettings,
    beamDensity: beamDensityOverride ?? runtimeVisualSettings.beamDensity,
    cinematicMode: effectiveCinematicMode,
    cameraCommand,
    viewport,
  }), [
    beamDensityOverride,
    cameraCommand,
    demoStartOffset,
    effectiveProfile,
    effectiveCinematicMode,
    handoverResetKey,
    runtimeVisualSettings,
    signalResetKey,
    viewport,
  ]);

  const [simState, setSimState] = useState<SimState>(() => createInitialSimState(baseProfile));
  const modqnReplayModelIssue = useMemo(
    () => getModqnReplayPlaybackModelValidationIssue(MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL),
    [],
  );
  const [modqnReplayDisplayState, setModqnReplayDisplayState] = useState<ModqnReplayPlaybackDisplayState | null>(
    () => (
      modqnReplayModelIssue === null
        ? createModqnReplayPlaybackDisplayState(MODQN_PHASE7F_REPLAY_PLAYBACK_SHELL_MODEL)
        : null
    ),
  );
  const [staleFormulaEvidenceKey, setStaleFormulaEvidenceKey] = useState<string | null>(null);

  const handleSimUpdate = useCallback((state: SimState) => {
    setSimState(state);
    setStaleFormulaEvidenceKey(current => (
      current === signalEvidenceKey && state.physicalServingBudget !== null ? null : current
    ));
  }, [signalEvidenceKey]);

  const handleModqnReplayDisplayStateChange = useCallback((next: ModqnReplayPlaybackDisplayState | null) => {
    setModqnReplayDisplayState(current => (
      current !== null
      && next !== null
      && current.slotOffset === next.slotOffset
      && current.playing === next.playing
      && current.loopEnabled === next.loopEnabled
      && current.currentSlot === next.currentSlot
        ? current
        : next
    ));
  }, []);

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
    setBeamDensityOverride(null);
    setUiMode(nextMode);
    persistUiMode(nextMode);
  }, []);

  const handleOpenHandoverPolicyControls = useCallback(() => {
    setBeamDensityOverride(null);
    setLeftSidebarTab('handover');
    setUiMode('tuning');
    persistUiMode('tuning');
    tuningPageRequestSequenceRef.current += 1;
    setTuningPageRequest({
      page: 'handover-policy',
      sequence: tuningPageRequestSequenceRef.current,
    });
  }, []);

  const handleBeamDensityChange = useCallback((nextDensity: BeamDensity) => {
    setBeamDensityOverride(nextDensity);
  }, []);

  const handleCameraPresetSelect = useCallback((preset: CameraPreset) => {
    cameraCommandSequenceRef.current += 1;
    const nowMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    setCameraCommand({
      preset,
      issuedAtMs: nowMs + cameraCommandSequenceRef.current / 1000,
    });
  }, []);

  const handleCinematicModeChange = useCallback((nextMode: CinematicMode) => {
    setCinematicMode(nextMode);
  }, []);

  const autoSlowActive = simState.pendingTargetSatId !== null || simState.intraHandoverEvent !== null;
  const autoSlowApplied = autoSlowEnabled && autoSlowActive && !autoSlowDismissed;
  const effectiveSpeed = autoSlowApplied ? Math.min(speed, HANDOVER_FOCUS_SPEED) : speed;

  useEffect(() => {
    if (!autoSlowActive) setAutoSlowDismissed(false);
  }, [autoSlowActive]);

  useEffect(() => subscribeToReducedMotionPreference(setReducedMotion), []);

  useEffect(() => subscribeToRuntimeViewport(setViewport), []);

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
    <div data-ui-mode={uiMode} className="leo-app-shell">
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
        beamDensity={runtime.beamDensity}
        cinematicMode={effectiveCinematicMode}
        beamHopEnabled={simState.beamHopEnabled}
        beamHopSlotIndex={simState.beamHopSlotIndex}
        onProfileChange={setSelectedProfileId}
        onUiModeChange={handleUiModeChange}
        onBeamDensityChange={handleBeamDensityChange}
        onCameraPresetSelect={handleCameraPresetSelect}
        onCinematicModeChange={handleCinematicModeChange}
        onTogglePause={() => setPaused(p => !p)}
        onSpeedChange={setSpeed}
        onDismissAutoSlow={() => setAutoSlowDismissed(true)}
        onToggleAutoSlow={() => setAutoSlowEnabled(e => !e)}
      />
      <div className="leo-shell-row">
        <aside className="leo-shell-left" aria-label="Signal tuning panel slot">
          <SidebarTabShell
            label="Simulation control sidebar"
            side="left"
            tabs={LEFT_SIDEBAR_TABS}
            activeKey={leftSidebarTab}
            onChange={setLeftSidebarTab}
          >
            {leftSidebarTab === 'handover' ? (
              <div className="leo-sidebar-content-stack">
                <ModqnBaselineHandoverControls
                  appliedHandoverPolicy={appliedHandoverPolicy}
                  hasHandoverOverrides={hasHandoverAppliedOverrides}
                  hasHandoverDraftChanges={hasHandoverDraftChanges}
                  onOpenHandoverPolicyControls={handleOpenHandoverPolicyControls}
                  onResetHandoverPolicy={handleResetHandoverPolicy}
                />
                <HandoverPolicyControls
                  draft={handoverPolicyDraft}
                  applied={appliedHandoverPolicy}
                  hasDraftChanges={hasHandoverDraftChanges}
                  hasOverrides={hasHandoverResetTarget}
                  onDraftChange={handleHandoverPolicyDraftChange}
                  onApply={handleApplyHandoverPolicy}
                  onReset={handleResetHandoverPolicy}
                />
              </div>
            ) : (
              <SignalTuningPanel
                baseProfile={baseProfile}
                tuning={signalTuning}
                hasOverrides={hasSignalOverrides}
                uiMode="tuning"
                activePageRequest={tuningPageRequest}
                formulaBudget={simState.physicalServingBudget}
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
          </SidebarTabShell>
        </aside>
        <main className="leo-shell-canvas" data-testid="leo-shell-canvas">
          <MainScene
            speed={effectiveSpeed}
            paused={paused}
            profile={effectiveProfile}
            runtime={runtime}
            modqnReplayDisplayState={modqnReplayDisplayState}
            onSimUpdate={handleSimUpdate}
          />
          <ModqnReplaySceneOverlay
            displayState={modqnReplayDisplayState}
            failClosedReason={modqnReplayModelIssue?.message}
          />
        </main>
        <aside className="leo-shell-right" aria-label="Signal status panel slot">
          <SidebarTabShell
            label="Simulation status sidebar"
            side="right"
            tabs={RIGHT_SIDEBAR_TABS}
            activeKey={rightSidebarTab}
            onChange={setRightSidebarTab}
          >
            {rightSidebarTab === 'modqn' ? (
              <section className="leo-modqn-sidebar-stack" aria-label="MODQN replay evidence and controls">
                <details
                  className="leo-sidebar-disclosure"
                  data-testid="modqn-claim-boundaries-disclosure"
                  data-phase7h-open-for-validation="true"
                >
                  <summary>Claim boundaries</summary>
                  <ModeEvidenceStrip />
                </details>
                <ModqnReplaySceneCues
                  displayState={modqnReplayDisplayState}
                  failClosedReason={modqnReplayModelIssue?.message}
                />
                <ModqnBaselineReplayEvidence
                  replayDisplayState={modqnReplayDisplayState}
                  replayIssueMessage={modqnReplayModelIssue?.message}
                />
                <ModqnReplayPlaybackShell onDisplayStateChange={handleModqnReplayDisplayStateChange} />
              </section>
            ) : (
              <section className="leo-live-status-stack" aria-label="Live HOBS/SINR status">
                <InfoPanel
                  {...simState}
                  uiMode={uiMode}
                  profile={effectiveProfile}
                  isFormulaEvidenceStale={staleFormulaEvidenceKey !== null}
                />
                <DiagnosticsDrawer
                  {...simState}
                  uiMode={uiMode}
                  profile={effectiveProfile}
                />
              </section>
            )}
          </SidebarTabShell>
        </aside>
      </div>
    </div>
  );
}
