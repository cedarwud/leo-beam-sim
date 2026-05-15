import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MainScene } from './scene/MainScene';
import {
  getProfileLabel,
  loadProfile,
  profileList,
} from './profiles';
import type { Profile } from './profiles/types';
import type { BeamDensity, PresentationMode, RuntimeConfig, SimState } from './scene/types';
import { createInitialSimState } from './scene/initialSimState';
import { recommendDemoReplayStartOffsetSec } from './scene/replay-recommendation';
import {
  createModqnReplayPlaybackDisplayState,
  createModqnReplayPlaybackShellModel,
  fetchModqnReplayBundleEnvelope,
  getModqnReplayPlaybackFallbackShellModel,
  getModqnReplayPlaybackModelValidationIssue,
  type ModqnReplayEnvelope,
  type ModqnReplayPlaybackDisplayState,
  type ModqnReplayPlaybackShellModel,
} from './modqn/replay-bundle';
import {
  ModqnEnvelopeProvider,
  ModqnHandoverModeProvider,
  MODQN_PAPER_FAITHFUL_OMEGA,
  readPersistedHandoverMode,
  persistHandoverMode,
  type RuntimeHandoverMode,
  type RuntimeOmegaState,
} from './ui/useModqnHandoverState';
import { MODQN_1SAT_7BEAM_PROFILE_ID } from './profiles';
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
import { HeuristicNotPaperBanner } from './ui/HeuristicNotPaperBanner';
import { InfoPanel } from './ui/InfoPanel';
import { SidebarTabShell, type SidebarTabItem } from './ui/SidebarTabShell';
import { SignalTuningPanel } from './ui/SignalTuningPanel';
import { ModqnObjectiveTab } from './ui/ModqnObjectiveTab';
import { ModqnEvidenceTab } from './ui/ModqnEvidenceTab';
import { persistUiMode, readPersistedUiMode, type UiMode } from './ui/uiMode';
import { usePlaybackControls } from './usePlaybackControls';
import { useCameraControls } from './useCameraControls';

const DEFAULT_PROFILE_ID = 'hobs-2024-candidate-rich';
const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

type LeftSidebarTab = 'signal' | 'objective';
type RightSidebarTab = 'modqn' | 'live';

const LEFT_SIDEBAR_TABS: readonly SidebarTabItem<LeftSidebarTab>[] = [
  { key: 'objective', label: 'MODQN objective', description: 'ω weights + retrain' },
  { key: 'signal', label: 'Signal formula', description: 'SINR tuning' },
];

const RIGHT_SIDEBAR_TABS: readonly SidebarTabItem<RightSidebarTab>[] = [
  { key: 'modqn', label: 'MODQN', description: 'proof + replay evidence' },
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
  const [uiMode, setUiMode] = useState<UiMode>(() => readPersistedUiMode());

  // S3: handover mode — persisted for sinr-offset/modqn-replay, never for omega-heuristic.
  const [handoverMode, setHandoverModeRaw] = useState<RuntimeHandoverMode>(
    () => readPersistedHandoverMode(),
  );
  // omegaActive snapshot — owned by App so it can be threaded into ModqnHandoverModeContext
  // and read by useSimulation (inside Canvas). Starts at paper-faithful defaults.
  const [omegaActiveForContext, setOmegaActiveForContext] = useState<RuntimeOmegaState>(
    () => MODQN_PAPER_FAITHFUL_OMEGA,
  );
  // re-scalarization fallback count — reset on mode change or sim reset.
  const [rescalarizeFallbackCount, setRescalarizeFallbackCount] = useState(0);
  const incrementRescalarizeFallback = useCallback(() => {
    setRescalarizeFallbackCount(c => c + 1);
  }, []);
  const [leftSidebarTab, setLeftSidebarTab] = useState<LeftSidebarTab>('objective');
  const [rightSidebarTab, setRightSidebarTab] = useState<RightSidebarTab>('modqn');
  const [beamDensityOverride, setBeamDensityOverride] = useState<BeamDensity | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => readPrefersReducedMotion());
  const [viewport, setViewport] = useState(() => readRuntimeViewport());
  const camera = useCameraControls();
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
    () => resolveRuntimeCinematicMode(uiMode, camera.cinematicMode),
    [camera.cinematicMode, uiMode],
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
    cameraCommand: camera.cameraCommand,
    viewport,
  }), [
    beamDensityOverride,
    camera.cameraCommand,
    demoStartOffset,
    effectiveProfile,
    effectiveCinematicMode,
    handoverResetKey,
    runtimeVisualSettings,
    signalResetKey,
    viewport,
  ]);

  const [simState, setSimState] = useState<SimState>(() => createInitialSimState(baseProfile));
  // MODQN ω-Handover S2: replace the hard-coded shell model with a runtime
  // fetch of the producer's replay bundle. The fallback typed-reference is
  // used to keep the demo renderable when the dev server's static-file route
  // cannot reach the producer artifact. SDD §9.3 acceptance.
  const fallbackShellModel = useMemo(getModqnReplayPlaybackFallbackShellModel, []);
  const [modqnReplayShellModel, setModqnReplayShellModel] = useState<ModqnReplayPlaybackShellModel>(
    () => fallbackShellModel,
  );
  const [modqnReplayEnvelope, setModqnReplayEnvelope] = useState<ModqnReplayEnvelope | null>(null);
  const [modqnReplayFetchError, setModqnReplayFetchError] = useState<string | null>(null);
  const modqnReplayModelIssue = useMemo(
    () => getModqnReplayPlaybackModelValidationIssue(modqnReplayShellModel),
    [modqnReplayShellModel],
  );
  const [modqnReplayDisplayState, setModqnReplayDisplayState] = useState<ModqnReplayPlaybackDisplayState | null>(
    () => (
      modqnReplayModelIssue === null
        ? createModqnReplayPlaybackDisplayState(fallbackShellModel)
        : null
    ),
  );
  const modqnReplaySlotOffset = modqnReplayDisplayState?.slotOffset ?? 0;
  const [staleFormulaEvidenceKey, setStaleFormulaEvidenceKey] = useState<string | null>(null);
  const playback = usePlaybackControls(simState);

  const handleSimUpdate = useCallback((state: SimState) => {
    setSimState(state);
    setStaleFormulaEvidenceKey(current => (
      current === signalEvidenceKey && state.physicalServingBudget !== null ? null : current
    ));
  }, [signalEvidenceKey]);

  // Replay display-state callback. Required as architectural witness by
  // validate-modqn-phase7k-r1-control-plane-hardening — must touch only
  // setModqnReplayDisplayState and never live-control state.
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
      playback.resetAutoSlowDismissed();
    });
  }, [baseProfile.id, handoverPolicyDraft, playback, signalTunedProfile]);

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
      playback.resetAutoSlowDismissed();
    });
  }, [baseProfile, playback, signalTunedProfile]);

  const handleUiModeChange = useCallback((nextMode: UiMode) => {
    setBeamDensityOverride(null);
    setUiMode(nextMode);
    persistUiMode(nextMode);
  }, []);

  // S3: handover mode change with profile-lock enforcement (SDD §6.2).
  // omega reset to bundle objectiveWeights (or paper-faithful fallback).
  // MODQN board default-on when entering modqn-replay.
  const handleHandoverModeChange = useCallback((nextMode: RuntimeHandoverMode) => {
    if (nextMode === handoverMode) return;

    if (nextMode === 'modqn-replay') {
      const targetProfileId = MODQN_1SAT_7BEAM_PROFILE_ID;
      const isAlreadyOnTarget = selectedProfileId === targetProfileId;

      if (!isAlreadyOnTarget) {
        // Profile lock: ask user to confirm switching to modqn-1sat-7beam.
        const confirmed = window.confirm(
          'modqn-replay requires the modqn-1sat-7beam profile.\n\n'
          + 'Switch to modqn-1sat-7beam and reset simulation? '
          + 'Your signal/handover tuning will be reset.',
        );
        if (!confirmed) {
          // Cancel — keep sinr-offset.
          return;
        }
        // Switch profile, reset sim, reset ω to paper-faithful defaults.
        startTransition(() => {
          setSelectedProfileId(targetProfileId);
          const targetProfile = loadProfile(targetProfileId);
          setSignalTuning(createSignalTuningState(targetProfile));
          const defaults = createHandoverPolicyTuningState(targetProfile);
          setHandoverPolicyState({
            profileId: targetProfileId,
            draft: defaults,
            applied: defaults,
            version: 0,
          });
          setSimState(createInitialSimState(targetProfile));
          playback.resetAutoSlowDismissed();
          setRescalarizeFallbackCount(0);
        });
      } else {
        // Already on modqn-1sat-7beam — just reset fallback count.
        setRescalarizeFallbackCount(0);
      }
      // Reset ω to paper-faithful defaults (bundle objectiveWeights, if available;
      // falls back to MODQN_PAPER_FAITHFUL_OMEGA per SDD §6.2).
      setOmegaActiveForContext(MODQN_PAPER_FAITHFUL_OMEGA);
      // Persist and apply mode.
      setHandoverModeRaw(nextMode);
      persistHandoverMode(nextMode);
      // Note: MODQN board default-on is handled in the right sidebar tab by the
      // mode selector render — the board's visibility is controlled by the
      // rightSidebarTab being 'modqn'. For S3 we ensure the tab switches to
      // 'modqn' when entering modqn-replay.
      setRightSidebarTab('modqn');
      return;
    }

    // omega-heuristic: never persist; just set in-memory.
    if (nextMode === 'omega-heuristic') {
      setHandoverModeRaw(nextMode);
      setRescalarizeFallbackCount(0);
      // Do NOT call persistHandoverMode for omega-heuristic (SDD §5.2, §9.4 item 8).
      return;
    }

    // sinr-offset: persist + clear fallback count.
    setHandoverModeRaw(nextMode);
    persistHandoverMode(nextMode);
    setRescalarizeFallbackCount(0);
  }, [handoverMode, selectedProfileId, playback]);

  // S3: expose a setter so ModqnObjectiveTab (via useModqnHandoverState hook)
  // can update the omegaActive snapshot in the mode context.
  const handleOmegaActiveChange = useCallback((next: RuntimeOmegaState) => {
    setOmegaActiveForContext(next);
  }, []);

  const handleBeamDensityChange = useCallback((nextDensity: BeamDensity) => {
    setBeamDensityOverride(nextDensity);
  }, []);

  useEffect(() => subscribeToReducedMotionPreference(setReducedMotion), []);

  useEffect(() => subscribeToRuntimeViewport(setViewport), []);

  // MODQN ω-Handover S2: runtime fetch of the producer replay bundle at
  // startup. On success the shell model + envelope reflect the live artifact
  // and the sidebar's policyDiagnostics flow from the envelope. On failure we
  // surface a banner and keep the typed-reference fallback so the demo still
  // renders. SDD §9.3 acceptance.
  useEffect(() => {
    let cancelled = false;
    fetchModqnReplayBundleEnvelope()
      .then(result => {
        if (cancelled) return;
        const liveShell = createModqnReplayPlaybackShellModel(result.envelope);
        setModqnReplayEnvelope(result.envelope);
        setModqnReplayShellModel(liveShell);
        setModqnReplayFetchError(null);
        const issue = getModqnReplayPlaybackModelValidationIssue(liveShell);
        setModqnReplayDisplayState(
          issue === null ? createModqnReplayPlaybackDisplayState(liveShell) : null,
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : String(error);
        // Keep the typed-reference fallback in place so the scene still
        // renders; surface the failure to the user via the banner below.
        setModqnReplayFetchError(message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resetAutoSlowDismissedRef = useRef(playback.resetAutoSlowDismissed);
  resetAutoSlowDismissedRef.current = playback.resetAutoSlowDismissed;
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
    resetAutoSlowDismissedRef.current();
  }, [baseProfile]);

  return (
    <ModqnEnvelopeProvider
      envelope={modqnReplayEnvelope}
      slotOffset={modqnReplaySlotOffset}
    >
    <ModqnHandoverModeProvider
      mode={handoverMode}
      setMode={handleHandoverModeChange}
      omegaActive={omegaActiveForContext}
      onOmegaActiveChange={handleOmegaActiveChange}
      rescalarizeFallbackCount={rescalarizeFallbackCount}
      incrementRescalarizeFallback={incrementRescalarizeFallback}
    >
    <div data-ui-mode={uiMode} className="leo-app-shell">
      {modqnReplayFetchError !== null && (
        <div
          className="leo-modqn-bundle-fetch-banner"
          role="alert"
          data-testid="modqn-bundle-fetch-banner"
          data-modqn-bundle-fetch-status="failed"
          style={{
            background: '#7a3a00',
            color: '#fff8e7',
            padding: '8px 16px',
            fontSize: 13,
            borderBottom: '1px solid #b25c00',
          }}
        >
          <strong>MODQN bundle fetch failed.</strong>{' '}
          Falling back to the typed-reference shell model for demo
          rendering. Live MODQN replay diagnostics will not reflect the
          producer artifact until the dev-server route /modqn-bundles is
          reachable. Error: {modqnReplayFetchError}
        </div>
      )}
      {/* S3: Paper-faithful replay info banner — non-warning, dismissable (SDD §6.1 / §9.4 item 7) */}
      {handoverMode === 'modqn-replay' && (
        <div
          className="leo-modqn-replay-mode-banner"
          role="status"
          data-testid="modqn-replay-mode-banner"
          style={{
            background: 'rgba(0, 80, 180, 0.72)',
            color: '#d4edff',
            padding: '6px 16px',
            fontSize: 13,
            borderBottom: '1px solid rgba(100, 180, 255, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span>Paper-faithful: MODQN baseline replay</span>
          <button
            type="button"
            aria-label="Dismiss MODQN replay mode banner"
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
            }}
            onClick={() => handleHandoverModeChange('sinr-offset')}
          >
            ×
          </button>
        </div>
      )}
      <ControlBar
        selectedProfileId={selectedProfileId}
        profileOptions={profileOptions}
        paused={playback.paused}
        speed={playback.speed}
        effectiveSpeed={playback.effectiveSpeed}
        autoSlowActive={playback.autoSlowActive}
        autoSlowApplied={playback.autoSlowApplied}
        autoSlowEnabled={playback.autoSlowEnabled}
        uiMode={uiMode}
        beamDensity={runtime.beamDensity}
        cinematicMode={effectiveCinematicMode}
        beamHopEnabled={simState.beamHopEnabled}
        beamHopSlotIndex={simState.beamHopSlotIndex}
        handoverMode={handoverMode}
        onProfileChange={setSelectedProfileId}
        onUiModeChange={handleUiModeChange}
        onBeamDensityChange={handleBeamDensityChange}
        onCameraPresetSelect={camera.selectCameraPreset}
        onCinematicModeChange={camera.setCinematicMode}
        onTogglePause={playback.togglePause}
        onSpeedChange={playback.setSpeed}
        onDismissAutoSlow={playback.dismissAutoSlow}
        onToggleAutoSlow={playback.toggleAutoSlow}
        onHandoverModeChange={handleHandoverModeChange}
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
            {leftSidebarTab === 'objective' ? (
              <ModqnObjectiveTab />
            ) : (
              <SignalTuningPanel
                baseProfile={baseProfile}
                tuning={signalTuning}
                hasOverrides={hasSignalOverrides}
                uiMode="tuning"
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
        {/* S3 + S4: data-handover-criterion attribute on scene container.
            SDD §9.4 item 6 (sinr-offset / modqn-replay) and SDD §4.4 item 4 /
            §9.5 item 4 — omega-heuristic mode emits the exact string
            'omega-heuristic-not-paper' for capture metadata. */}
        <main
          className="leo-shell-canvas"
          data-testid="leo-shell-canvas"
          data-handover-criterion={
            handoverMode === 'omega-heuristic'
              ? 'omega-heuristic-not-paper'
              : (handoverMode === 'modqn-replay' ? 'modqn-replay' : 'sinr-offset')
          }
        >
          {/* S4: persistent heuristic-mode warning banner (SDD §4.4 item 1).
              Mounted inside <main> so it travels with the scene container in
              both browser fullscreen and cinematic-mode dimming. */}
          {handoverMode === 'omega-heuristic' && <HeuristicNotPaperBanner />}
          <MainScene
            speed={playback.effectiveSpeed}
            paused={playback.paused}
            profile={effectiveProfile}
            runtime={runtime}
            modqnReplayDisplayState={modqnReplayDisplayState}
            onSimUpdate={handleSimUpdate}
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
              <section
                className="leo-modqn-sidebar-stack"
                aria-label="MODQN proof"
              >
                <ModqnEvidenceTab
                  simState={simState}
                  bandwidthMHz={effectiveProfile.channel.bandwidthMHz}
                  appliedHandoverOffsetDb={appliedHandoverPolicy.offsetDb}
                  appliedHandoverTriggerTimeSec={appliedHandoverPolicy.triggerTimeSec}
                />
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
                  handoverMode={handoverMode}
                  rescalarizeFallbackCount={rescalarizeFallbackCount}
                />
              </section>
            )}
          </SidebarTabShell>
        </aside>
      </div>
    </div>
    </ModqnHandoverModeProvider>
    </ModqnEnvelopeProvider>
  );
}
