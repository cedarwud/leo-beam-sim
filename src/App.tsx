import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MainScene } from './scene/MainScene';
import { loadProfile } from './profiles';
import type { Profile } from './profiles/types';
import type { BeamDensity, RuntimeConfig, SimState } from './scene/types';
import { createInitialSimState } from './scene/initialSimState';
import { recommendDemoReplayStartOffsetSec } from './scene/replay-recommendation';
import {
  type LiveWalkerDirectorFocusClaimKind,
} from './scene/liveWalkerDirectorFocus';
import {
  MODQN_FAMILY_B_DENSE_Q_BUNDLE_PATH,
  MODQN_FAMILY_B_DENSE_Q_EVIDENCE_STATUS,
  MODQN_FAMILY_B_DENSE_Q_MODE_KEY,
  createModqnReplayPlaybackDisplayState,
  createModqnReplayPlaybackShellModel,
  createOmegaRescalarizedModqnReplayPlaybackDisplayState,
  fetchModqnReplayBundleEnvelope,
  getModqnReplayPlaybackFallbackShellModel,
  getModqnReplayPlaybackModelValidationIssue,
  type ModqnReplayEnvelope,
  type ModqnReplayPlaybackDisplayState,
  type ModqnReplayPlaybackShellModel,
} from './modqn/replay-bundle';
import {
  getBundleSidebarSnapshot,
} from './ui/useModqnHandoverState';
import {
  ModqnEnvelopeProvider,
  ModqnHandoverModeProvider,
} from './modqn/runtimeContext';
import {
  MODQN_PAPER_FAITHFUL_OMEGA,
  persistHandoverMode,
  type RuntimeHandoverMode,
  type RuntimeOmegaState,
} from './modqn/runtimeControls';
import {
  deriveRuntimeVisualSettings,
  readPrefersReducedMotion,
  readRuntimeViewport,
  subscribeToReducedMotionPreference,
  subscribeToRuntimeViewport,
} from './scene/runtimeConfig';
import {
  applyHandoverPolicyTuning,
  createHandoverPolicyTuningState,
  getHandoverPolicyResetKey,
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
import {
  applySceneTopology,
  createSceneTopologyState,
  getSceneTopologyResetKey,
  hasSceneTopologyOverrides,
  type SceneTopologyState,
} from './sceneTopology';
import {
  getSceneVisualScaleResetKey,
  hasSceneVisualScaleOverrides,
  resolveSceneVisualScaleMultipliers,
  type SceneVisualScaleMultipliers,
  type SceneVisualScaleState,
} from './sceneVisualScale';
import { ControlBar } from './ui/ControlBar';
import { DirectorControls } from './ui/DirectorControls';
import { SinrOffsetExplainer } from './ui/SinrOffsetExplainer';
import { useHandoverCinema } from './app/useHandoverCinema';
import { CinematicSeekFadeOverlay } from './ui/CinematicSeekFadeOverlay';
import { TimelineBar, type TimelineSpeedPreset } from './ui/TimelineBar';
import {
  HandoverEventRail,
  type HandoverRailEvent,
} from './ui/HandoverEventRail';
import { InfoPanel } from './ui/InfoPanel';
import { SidebarTabShell } from './ui/SidebarTabShell';
import { HomepageCanonicalAnalysis } from './ui/signal-tuning/HomepageCanonicalAnalysis';
import { HomepageCanonicalControls } from './ui/signal-tuning/HomepageCanonicalControls';
import { useHomepageCanonicalAnalysis } from './ui/signal-tuning/useHomepageCanonicalAnalysis';
import type { MainTabKey } from './ui/signal-tuning/types';
import type { SimulatorTab } from './simulator/types';
import { SceneTopologyPanel } from './ui/SceneTopologyPanel';
import { ModqnReplayCuePanel } from './ui/ModqnReplayCuePanel';
import { ReplayArmToggle, type ReplayArm } from './ui/ReplayArmToggle';
import { CoverageTopbar, CoverageFairnessPanel } from './ui/CoverageFairnessPanel';
import { HonestyProvenancePanel, type ReplayArmManifest } from './ui/HonestyProvenancePanel';
import {
  currentFrameCoverage,
  windowServedFractionStats,
  type CoverageFrame,
} from './showcase/coverageFairness';
import { countStarvedUes } from './scene/replayFieldColor';
import { ServiceStatusBanner } from './ui/modqn-training/ServiceStatusBanner';
import { ArtifactPicker } from './ui/modqn-training/ArtifactPicker';
import { RewardCurvePanel } from './ui/modqn-training/RewardCurvePanel';
import { DecisionVizPanel } from './ui/modqn-training/DecisionVizPanel';
import { ModqnSceneHud } from './ui/modqn-controls/ModqnSceneHud';
import { readTrainingServiceBaseUrl } from './modqn/training-trigger/baseUrl';
import {
  fetchTrainingRunMetadata,
  fetchTrainingServiceManifest,
} from './modqn/training-trigger/artifactManifest';
import { fetchUserTrainedBundleEnvelope } from './modqn/training-trigger/userTrainedBundleFetch';
import type {
  TrainingRunMetadata,
  TrainingServiceManifest,
} from './modqn/training-trigger/types';
import { HeuristicNotPaperBanner } from './ui/HeuristicNotPaperBanner';
import { AdvancedSetupDrawer } from './ui/AdvancedSetupDrawer';
import { SinrLiveDisplayDrawer } from './ui/SinrLiveDisplayDrawer';
import { SinrLiveQuickControls } from './ui/SinrLiveQuickControls';
import { DEFAULT_BEAM_DISPLAY_SPEC } from './scene/beamDisplaySpec';
import { MANUAL_HANDOVER_DISPLAY_MS } from './scene/manualHandoverDemo';
import { ClaimBoundaryBanner } from './ui/ClaimBoundaryBanner';
import {
  ArtifactSourceBadge,
  PRODUCER_PINNED_SOURCE,
  SYNTHETIC_FIXTURE_SOURCE,
  HEADER_ABSENT_SOURCE,
} from './ui/ArtifactSourceBadge';
import { ArtifactSatelliteCompass } from './ui/ArtifactSatelliteCompass';
import { ModqnViewToggle } from './ui/ModqnViewToggle';
// Global zh-TW / EN language state (CONTRACT.md §2). The provider wraps the
// whole shell so the left tuners, the right readout and every HelpPopover
// share one locale; the toggle itself lives in the top-right quick-control row.
import { LocaleProvider, LocaleToggle } from './i18n';
import { loadShowcaseArtifact } from './showcase/loadShowcaseArtifact';
import { showcaseArtifactToSceneInterpolated } from './showcase/showcaseArtifactToSceneInterpolated';
import { deriveWindowReplayCue } from './showcase/windowReplayCue';
import { ShowcaseReplayController } from './showcase/ShowcaseReplayController';
import { AlgorithmDashboard } from './showcase/dashboard/AlgorithmDashboard';
import { TrainingTelemetryFeed } from './showcase/dashboard/TrainingTelemetryFeed';
import type { VisualShowcaseArtifact } from './scene/visual-showcase-contract';
import type { NormalizedSceneFrame } from './scene/NormalizedSceneFrame';
import {
  APP_MODE_HANDOVER_MAP,
  persistAppMode,
  persistProfileByMode,
  resolveProfileForAppMode,
  type AppExperienceMode,
  type ProfileByMode,
} from './app/appExperienceMode';
import {
  getDefaultLeftSidebarTabForSceneLane,
  getDefaultLeftSidebarTabForMode,
  getDefaultRightSidebarTabForSceneLane,
  getLeftSidebarTabsForSceneLane,
  getRightSidebarTabsForSceneLane,
  isKnownProfileId,
  normalizeRuntimeOmega,
  readInitialRuntimeState,
  type InitialRuntimeState,
  type LeftSidebarTab,
  type RightSidebarTab,
} from './app/appRuntimeModel';
import {
  applyTrainingEnvAxesToProfile,
  envAxesFromTrainingRunMetadata,
  seedTripletFromTrainingRunMetadata,
} from './app/trainingEnvAxesProfileAdapter';
import {
  APP_EPOCH_MS,
  LIVE_SIM_TIMELINE_DURATION_SEC,
  buildAppRuntimeConfig,
} from './app/appRuntimeConfig';
import {
  clampTimelineTime,
  getModqnProducerTraceRange,
  resolveTimelineRailDescriptor,
} from './app/timelineRailAuthority';
import {
  liveWalkerHandoverEventIndexToRailEvents,
} from './app/liveWalkerHandoverRailAdapter';
import {
  buildArtifactHandoverRailEvents,
  buildModqnHandoverRailEvents,
  getModqnReplayVisualTimeline,
  liveObservedHandoverRailEventFromState,
  resolveModqnReplayVisualSlotOffset,
} from './app/handoverRailBuilders';
import {
  persistSceneTopologyOverrides,
  persistSceneVisualScaleOverrides,
  readModqnServiceAllocationOverrideFromUrl,
  readSceneSourceFromUrl,
  readSceneTopologyOverrides,
  readSceneVisualScaleOverrides,
  syncSceneSourceToUrl,
  type SceneSourceMode,
} from './app/appPersistence';
import {
  resolveSceneLane,
  type SceneLane,
} from './app/sceneLane';
import { MODQN_SERVICE_ALLOCATION_PRODUCER_READY } from './scene/sceneLaneRenderPlan';
import {
  useDirectorOrchestration,
  type LiveTimelineSeekRequest,
} from './app/useDirectorOrchestration';
import {
  buildLiveWalkerHandoverEventIndex,
  type LiveWalkerHandoverEventIndex,
} from './scene/liveWalkerHandoverEventIndex';
import {
  createSinrLiveCellHandoverEventIndexBuilder,
  type SinrLiveCellHandoverEventIndexBuilder,
} from './scene/sinrLiveCellHandoverEventIndex';
import {
  DEFAULT_MODQN_VISUAL_LAYER_PRESET,
  type ModqnVisualLayerPreset,
} from './scene/modqnVisualLayers';
import {
  createReplayPanelSimState,
  selectReplayDisplayUes,
} from './app/showcaseReplayState';
import { usePlaybackControls } from './usePlaybackControls';
import { useCameraControls } from './useCameraControls';

interface HandoverPolicyRuntimeState {
  profileId: string;
  draft: HandoverPolicyTuningState;
  applied: HandoverPolicyTuningState;
  version: number;
}

const MODQN_REPLAY_VISUAL_TICK_MS = 100;

// Generic artifact-replay lane source (dev middleware serves the pinned producer
// baseline; see vite.config.ts).
const SHOWCASE_ARTIFACT_URL = '/showcase-artifacts/visual-showcase-v1.json';
// P2/P3 replay stage: the modqn-replay-proof lane's recorded windows. Served
// read-only by the /modqn-bundles route (vite.config.ts MODQN_H2_SCENE_{A2,B1}
// scene-only roots) — the leo-verified H2 windows, t0=9000 window [117,213],
// enriched with producer served/starved coverage truth per UE. Immutable artifacts.
// P3 slice-2: the a2↔b1 toggle-slam swaps WHICH arm the lane fetches — a2 (auction
// hero, served 100/100 → all-green) ⇄ b1 (argmax baseline, starved 74/100 → red
// sea). The URL is the only thing that changes; the fetch effect re-flips the field.
const REPLAY_ARM_WINDOWS: Readonly<Record<ReplayArm, string>> = {
  a2: '/modqn-bundles/h2-scene-a2-t0_9000-w117_213/visual-showcase-v1.json',
  b1: '/modqn-bundles/h2-scene-b1-t0_9000-w117_213/visual-showcase-v1.json',
};
const REPLAY_ARM_DEFAULT: ReplayArm = 'a2';

export function App() {
  const [sceneSource, setSceneSource] = useState<SceneSourceMode>(() => readSceneSourceFromUrl());
  const [showcaseArtifact, setShowcaseArtifact] = useState<VisualShowcaseArtifact | null>(null);
  const [showcaseArtifactSource, setShowcaseArtifactSource] = useState<string | null>(null);
  const [showcaseLoading, setShowcaseLoading] = useState(false);
  const [showcaseError, setShowcaseError] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [ueDisplayCount, setUeDisplayCount] = useState<number>(100);
  const [elevatedUeId, setElevatedUeId] = useState<string | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [liveTimelineSeekRequest, setLiveTimelineSeekRequest] =
    useState<LiveTimelineSeekRequest | null>(null);
  const manualHandoverRequestSeqRef = useRef(0);
  const [manualHandoverRequest, setManualHandoverRequest] = useState<{
    readonly id: number;
    readonly kind: 'intra' | 'inter';
    readonly startedAtMs: number;
  } | null>(null);
  const manualHandoverWasPausedRef = useRef(false);

  const currentTimeSecRef = useRef(0);
  // ITEM #C live Director focus: the absolute live sim cursor (set in
  // handleSimUpdate) used by useDirectorOrchestration as "now" when resolving the
  // next handover event + the seek direction. The deferred-focus state machine
  // itself lives in the hook (P3 extraction).
  const liveSimTimeSecRef = useRef(0);
  const initialRuntimeRef = useRef<InitialRuntimeState | null>(null);
  if (initialRuntimeRef.current === null) {
    initialRuntimeRef.current = readInitialRuntimeState();
  }
  const initialRuntime = initialRuntimeRef.current;
  const [appMode, setAppModeRaw] = useState<AppExperienceMode>(initialRuntime.appMode);
  const profileByModeRef = useRef<ProfileByMode>(initialRuntime.profileByMode);
  const [selectedProfileId, setSelectedProfileId] = useState(initialRuntime.selectedProfileId);

  // S3: handover mode — persisted for sinr-offset/decision-overlay-on-live-sinr, never for omega-heuristic.
  const [handoverMode, setHandoverModeRaw] = useState<RuntimeHandoverMode>(
    initialRuntime.handoverMode,
  );
  const [modqnReplayProofRequested, setModqnReplayProofRequested] = useState(false);
  // P3 slice-3 nav-polish: the recorded replay-proof STAGE plays an artifact window,
  // so its entry no longer requires the live decision-overlay policy — only the lane
  // preconditions (live-sim source + modqn-demo). Dropping the old
  // `handoverMode === 'decision-overlay-on-live-sinr'` term makes the Proof sub-nav a
  // first-class entry instead of a dead toggle until the user digs into Advanced.
  // (`renderedModqnReplayDisplayState` still gates the LIVE-lane baseline cue on
  // decision-overlay at App.tsx ~597; that live path is unchanged.)
  const canToggleModqnReplayProof =
    sceneSource === 'live-sim'
    && appMode === 'modqn-demo';
  const modqnReplayProofRequestActive = canToggleModqnReplayProof && modqnReplayProofRequested;
  const sceneLane = useMemo(
    () => resolveSceneLane({
      appMode,
      sceneSource,
      modqnReplayProofRequested: modqnReplayProofRequestActive,
    }),
    [appMode, modqnReplayProofRequestActive, sceneSource],
  );
  // P2 replay stage: the modqn-replay-proof lane plays the RECORDED dense-Q window
  // (an artifact-backed frame via showcaseArtifactToScene) — the same loader +
  // ShowcaseReplayController path the artifact-replay lane uses, just pointed at the
  // window under the read-only /modqn-bundles route. `recordedReplayActive` unifies
  // both recorded-frame lanes; the URL is the only thing that differs.
  const isRecordedReplayLane = sceneLane === 'modqn-replay-proof';
  const recordedReplayActive = sceneSource === 'artifact-replay' || isRecordedReplayLane;
  // P3 slice-2 a2↔b1 toggle-slam: which recorded arm the proof lane displays.
  // Changing this reflows `recordedReplayArtifactUrl`, which is a dep of the fetch
  // effect below → auto re-fetch → the red/green field re-flips. Display-only.
  const [replayArm, setReplayArm] = useState<ReplayArm>(REPLAY_ARM_DEFAULT);
  const recordedReplayArtifactUrl = isRecordedReplayLane
    ? REPLAY_ARM_WINDOWS[replayArm]
    : SHOWCASE_ARTIFACT_URL;
  // omegaActive snapshot — owned by App so it can be threaded into ModqnHandoverModeContext
  // and read by useSimulation (inside Canvas). Starts at paper-faithful defaults.
  const [omegaActiveForContext, setOmegaActiveForContext] = useState<RuntimeOmegaState>(
    () => MODQN_PAPER_FAITHFUL_OMEGA,
  );
  const [omegaDisplayApplyVersion, setOmegaDisplayApplyVersion] = useState(0);
  const omegaDisplayApplyVersionRef = useRef(0);
  const markOmegaDisplayApplied = useCallback(() => {
    setOmegaDisplayApplyVersion(current => {
      const next = current + 1;
      omegaDisplayApplyVersionRef.current = next;
      return next;
    });
  }, []);
  const resetOmegaDisplayApplied = useCallback(() => {
    omegaDisplayApplyVersionRef.current = 0;
    setOmegaDisplayApplyVersion(0);
  }, []);
  // re-scalarization fallback count — reset on mode change or sim reset.
  const [rescalarizeFallbackCount, setRescalarizeFallbackCount] = useState(0);
  const incrementRescalarizeFallback = useCallback(() => {
    setRescalarizeFallbackCount(c => c + 1);
  }, []);
  const [leftSidebarTab, setLeftSidebarTab] = useState<LeftSidebarTab>(
    () => getDefaultLeftSidebarTabForMode(initialRuntime.handoverMode),
  );
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false);
  const [rightSidebarTab, setRightSidebarTab] = useState<RightSidebarTab>('live');
  const [homepageCanonicalTab, setHomepageCanonicalTab] = useState<MainTabKey>('sinr');
  const homepageCanonicalAnalysis = useHomepageCanonicalAnalysis();
  const homepageCanonicalResultTab: SimulatorTab = homepageCanonicalTab === 'energy'
    ? 'ee'
    : homepageCanonicalTab === 'power' || homepageCanonicalTab === 'throughput'
      ? homepageCanonicalTab
      : 'sinr';
  const [selectedUserTrainedJobId, setSelectedUserTrainedJobId] = useState<string | null>(null);
  const [bundleProvenanceKind, setBundleProvenanceKind] = useState<'paper-faithful' | 'user-trained'>('paper-faithful');
  const [userTrainedLoadError, setUserTrainedLoadError] = useState<string | null>(null);
  const [selectedTrainingServiceManifest, setSelectedTrainingServiceManifest] = useState<TrainingServiceManifest | null>(null);
  const [selectedTrainingRunMetadata, setSelectedTrainingRunMetadata] = useState<TrainingRunMetadata | null>(null);
  const [modqnVisualLayerPreset, setModqnVisualLayerPreset] = useState<ModqnVisualLayerPreset>(
    DEFAULT_MODQN_VISUAL_LAYER_PRESET,
  );
  // S-FLAG-2: producer-readiness gate for the MODQN service-allocation overlay
  // family. Parked OFF in production (`MODQN_SERVICE_ALLOCATION_PRODUCER_READY`);
  // the `?modqnServiceAllocation=1` URL override force-enables it for
  // dev/validator render-path proof. Read once (stable across renders).
  const [modqnServiceAllocationEnabled] = useState<boolean>(
    () => MODQN_SERVICE_ALLOCATION_PRODUCER_READY || readModqnServiceAllocationOverrideFromUrl(),
  );
  const selectedTrainingEnvAxes = bundleProvenanceKind === 'user-trained'
    ? envAxesFromTrainingRunMetadata(selectedTrainingRunMetadata)
      ?? selectedTrainingServiceManifest?.trainingTruth?.envAxes
    : undefined;
  const selectedTrainingSeedTriplet = bundleProvenanceKind === 'user-trained'
    ? seedTripletFromTrainingRunMetadata(selectedTrainingRunMetadata)
      ?? selectedTrainingServiceManifest?.trainingTruth?.seedTriplet
    : undefined;
  const visibleLeftSidebarTabs = useMemo(
    () => getLeftSidebarTabsForSceneLane(sceneLane, handoverMode),
    [handoverMode, sceneLane],
  );
  const activeLeftSidebarTab = visibleLeftSidebarTabs.some(tab => tab.key === leftSidebarTab)
    ? leftSidebarTab
    : getDefaultLeftSidebarTabForSceneLane(sceneLane, handoverMode);
  const visibleRightSidebarTabs = useMemo(
    () => getRightSidebarTabsForSceneLane(sceneLane, handoverMode),
    [handoverMode, sceneLane],
  );
  const activeRightSidebarTab = visibleRightSidebarTabs.some(tab => tab.key === rightSidebarTab)
    ? rightSidebarTab
    : getDefaultRightSidebarTabForSceneLane(sceneLane, handoverMode);
  // Beam density control retired — beams render at the fixed base density
  // (deriveRuntimeVisualSettings → 'event-plus-1'); no runtime override.
  const beamDensityOverride: BeamDensity | null = null;
  // Tier-2/3 beam-display seam: display-only cone knobs held in App's OWN state and
  // passed DIRECTLY to MainScene (not through buildAppRuntimeConfig / the runtime
  // memo bag), so a toggle re-renders without the invisible-dep-array tax.
  // (beamCalloutsEnabled moved in here from a dedicated useState — Tier-3.)
  const [beamDisplaySpec, setBeamDisplaySpec] = useState(DEFAULT_BEAM_DISPLAY_SPEC);
  const [reducedMotion, setReducedMotion] = useState(() => readPrefersReducedMotion());
  const [viewport, setViewport] = useState(() => readRuntimeViewport());
  const camera = useCameraControls();
  // Phase H §4.8 + Phase I: modqn-demo defaults to the oblique camera so the
  // user opens into a pulled-back view framing the Earth-fixed cell field +
  // 4 satellites + beam cones (the closeup preset sat too tight on the
  // satellites and clipped the 200x90 km cell overlay). Live-sim camera
  // changes only, never claims producer ephemeris truth.
  const modqnDemoCameraAppliedRef = useRef(false);
  useEffect(() => {
    if (appMode === 'modqn-demo' && !modqnDemoCameraAppliedRef.current) {
      modqnDemoCameraAppliedRef.current = true;
      camera.selectCameraPreset('oblique');
    } else if (appMode !== 'modqn-demo') {
      modqnDemoCameraAppliedRef.current = false;
    }
  }, [appMode, camera]);
  const baseProfile = useMemo(() => loadProfile(selectedProfileId), [selectedProfileId]);
  const [signalTuning, setSignalTuning] = useState<SignalTuningState>(() => createSignalTuningState(baseProfile));
  const [sceneTopology, setSceneTopology] = useState<SceneTopologyState>(() => readSceneTopologyOverrides());
  const [sceneVisualScale, setSceneVisualScale] = useState<SceneVisualScaleState>(() => readSceneVisualScaleOverrides());
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
  const appliedHandoverPolicy = handoverPolicyState.profileId === baseProfile.id
    ? handoverPolicyState.applied
    : handoverPolicyDefaults;
  const handoverPolicyVersion = handoverPolicyState.profileId === baseProfile.id
    ? handoverPolicyState.version
    : 0;
  /**
   * Live scene topology overrides are shared by both live lanes. The recorded
   * artifact lanes deliberately get an empty topology so a local control never
   * mutates producer-backed replay geometry or evidence.
   */
  const liveSceneTopologyControlsEnabled = sceneSource === 'live-sim'
    && (sceneLane === 'sinr-live' || sceneLane === 'modqn-live-cell-preview');
  const activeSceneTopology = useMemo<SceneTopologyState>(
    () => liveSceneTopologyControlsEnabled ? sceneTopology : createSceneTopologyState(),
    [liveSceneTopologyControlsEnabled, sceneTopology],
  );
  const signalTunedProfile = useMemo(() => {
    const signalProfile = applySignalTuning(baseProfile, signalTuning);
    const trainingProfile = applyTrainingEnvAxesToProfile(
      signalProfile,
      selectedTrainingEnvAxes,
      selectedTrainingSeedTriplet,
    );
    // Manual scene controls are the last live-sim layer, so changing a beam or
    // satellite count remains effective even when a training environment is
    // loaded. Artifact lanes pass an empty topology above.
    return applySceneTopology(trainingProfile, activeSceneTopology);
  }, [
    activeSceneTopology,
    baseProfile,
    selectedTrainingEnvAxes,
    selectedTrainingSeedTriplet,
    signalTuning,
  ]);
  const effectiveProfile = useMemo(
    () => applyHandoverPolicyTuning(signalTunedProfile, appliedHandoverPolicy),
    [signalTunedProfile, appliedHandoverPolicy],
  );
  const hasSignalOverrides = useMemo(
    () => hasSignalTuningOverrides(baseProfile, signalTuning),
    [baseProfile, signalTuning],
  );
  // Reports the overrides that are actually ACTIVE on the profile, so the
  // `data-topology-overrides-active` attribute cannot claim "false" while a
  // beam-count override is reshaping the scene. Identical to the previous
  // expression in sinr-experiment (where activeSceneTopology === sceneTopology).
  const hasTopologyOverrides = useMemo(
    () => hasSceneTopologyOverrides(activeSceneTopology),
    [activeSceneTopology],
  );
  const hasVisualScaleOverrides = useMemo(
    () => hasSceneVisualScaleOverrides(sceneVisualScale),
    [sceneVisualScale],
  );
  const sceneVisualScaleResetKey = useMemo(
    () => getSceneVisualScaleResetKey(sceneVisualScale),
    [sceneVisualScale],
  );
  // Both keys read the SAME `activeSceneTopology` the profile does — otherwise a
  // field that is allowed through to the profile (beamCountPerSatellite) could
  // change the sim without restarting it / without re-stamping the evidence key.
  const signalResetKey = useMemo(
    () => [
      getSignalTuningResetKey(signalTuning),
      getSceneTopologyResetKey(activeSceneTopology),
    ].join('|'),
    [activeSceneTopology, signalTuning],
  );
  // EVIDENCE key — deliberately NOT the same shape as the reset key above. It has
  // exactly one consumer: `handleSimUpdate` clears `staleFormulaEvidenceKey` when
  // this key matches the key stamped at edit time. Those stamps are produced by
  // `getSignalTuningEvidenceKey(next)` alone, so pairing a scene-topology half in
  // here made the two sides permanently unequal — the σ² / noise-floor readout
  // latched on "recomputing…" after ANY signal edit and never recovered (only a
  // profile switch, which nulls the key outright, cleared it). The readout derives
  // from σ² = N₀B, i.e. purely signal-tuning terms, so the signal-tuning key IS the
  // correct freshness scope; scene topology (sat/UE counts, mobility) cannot move a
  // noise floor. Keep both sides on this one function.
  const signalEvidenceKey = useMemo(
    () => getSignalTuningEvidenceKey(signalTuning),
    [signalTuning],
  );
  const handoverResetKey = useMemo(
    () => `${handoverMode}:${handoverPolicyVersion}:${getHandoverPolicyResetKey(appliedHandoverPolicy)}`,
    [appliedHandoverPolicy, handoverMode, handoverPolicyVersion],
  );
  // Memoize recommendation to prevent recalculating on every render,
  // but this still runs during the first render. 
  // Given we have localStorage cache now, it will be instant after the first run.
  const demoStartOffset = useMemo(
    () => recommendDemoReplayStartOffsetSec(baseProfile, APP_EPOCH_MS),
    [baseProfile],
  );

  const runtimeVisualSettings = useMemo(
    () => {
      const base = deriveRuntimeVisualSettings(reducedMotion);
      if (appMode !== 'modqn-demo' || reducedMotion) return base;
      return {
        ...base,
        effectsEnabled: {
          ...base.effectsEnabled,
          orbitTrail: false,
          spineParticles: true,
        },
      };
    },
    [appMode, reducedMotion],
  );
  const effectiveCinematicMode = camera.cinematicMode;
  // Demo intra-handover trigger: toggling this ENU offset slides the PRIMARY UE one
  // beam-lattice step so the engine does a REAL intra (same-sat beam switch). Wired to
  // the dedicated Intra-HO TRIGGER button (NOT the cinematic Focus button): the jog must
  // run WITHOUT a seek, because the seek's rebase() clears prevUeServing (cold-attach →
  // no HO) and wipes recentHandovers (no pulse). Decoupling the two is the Bug B fix (C1).
  const [primaryUeJogKm, setPrimaryUeJogKm] = useState<{ east: number; north: number }>({ east: 0, north: 0 });
  // Generic analysis-window reset. Timeline seeks invalidate accumulated
  // canonical EE evidence even though the retired classroom ledger is gone.
  const [measurementResetEpoch, setMeasurementResetEpoch] = useState(0);
  const runtime = useMemo(() => buildAppRuntimeConfig({
    appMode,
    effectiveProfile,
    demoStartOffsetSec: demoStartOffset,
    liveTimelineSeekTargetSec: liveTimelineSeekRequest?.targetSec,
    liveTimelineSeekRequestKey: liveTimelineSeekRequest?.requestKey,
    measurementResetEpoch,
    signalResetKey,
    handoverResetKey,
    runtimeVisualSettings,
    beamDensityOverride,
    effectiveCinematicMode,
    cameraCommand: camera.cameraCommand,
    directorFocusCommand: camera.directorFocusCommand,
    viewport,
    sceneTopology: activeSceneTopology,
    selectedTrainingEnvAxes,
    modqnVisualLayerPreset,
    modqnServiceAllocationEnabled,
    primaryJogEastKm: primaryUeJogKm.east,
    primaryJogNorthKm: primaryUeJogKm.north,
    manualHandoverRequestId: manualHandoverRequest?.id,
    manualHandoverKind: manualHandoverRequest?.kind,
    manualHandoverStartedAtMs: manualHandoverRequest?.startedAtMs,
  }), [
    appMode,
    primaryUeJogKm,
    beamDensityOverride,
    camera.cameraCommand,
    camera.directorFocusCommand,
    demoStartOffset,
    effectiveProfile,
    effectiveCinematicMode,
    liveTimelineSeekRequest,
    manualHandoverRequest,
    measurementResetEpoch,
    runtimeVisualSettings,
    handoverResetKey,
    modqnVisualLayerPreset,
    modqnServiceAllocationEnabled,
    activeSceneTopology,
    selectedTrainingEnvAxes,
    signalResetKey,
    viewport,
  ]);
  const visualScaleMultipliers = useMemo(
    (): SceneVisualScaleMultipliers => resolveSceneVisualScaleMultipliers(sceneVisualScale),
    [sceneVisualScale],
  );

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
  const [modqnReplayVisualElapsedSec, setModqnReplayVisualElapsedSec] = useState(0);
  const [liveObservedHandoverRailEvents, setLiveObservedHandoverRailEvents] = useState<HandoverRailEvent[]>([]);
  const [liveWalkerHandoverEventIndex, setLiveWalkerHandoverEventIndex] =
    useState<LiveWalkerHandoverEventIndex | null>(null);
  const modqnReplaySlotOffset = modqnReplayDisplayState?.slotOffset ?? 0;
  const modqnBundleOmega = useMemo(
    () => normalizeRuntimeOmega(
      getBundleSidebarSnapshot(modqnReplayEnvelope, modqnReplaySlotOffset)
        .policyDiagnostics.objectiveWeights,
    ),
    [modqnReplayEnvelope, modqnReplaySlotOffset],
  );
  const renderedModqnReplayDisplayState = useMemo(() => {
    if (handoverMode !== 'decision-overlay-on-live-sinr') {
      return null;
    }
    if (omegaDisplayApplyVersion === 0) {
      return modqnReplayDisplayState;
    }
    return createOmegaRescalarizedModqnReplayPlaybackDisplayState(
      modqnReplayDisplayState,
      omegaActiveForContext,
    );
  }, [
    handoverMode,
    modqnReplayDisplayState,
    omegaActiveForContext,
    omegaDisplayApplyVersion,
  ]);
  const [staleFormulaEvidenceKey, setStaleFormulaEvidenceKey] = useState<string | null>(null);
  const playback = usePlaybackControls(simState, camera.directorFocusActive);
  const resetAnalysisWindow = useCallback(() => {
    setMeasurementResetEpoch(epoch => epoch + 1);
  }, []);

  const requestManualHandover = useCallback((kind: 'intra' | 'inter') => {
    manualHandoverWasPausedRef.current = playback.paused;
    playback.setPaused(true);
    manualHandoverRequestSeqRef.current += 1;
    setManualHandoverRequest({
      id: manualHandoverRequestSeqRef.current,
      kind,
      startedAtMs: typeof performance === 'undefined' ? Date.now() : performance.now(),
    });
  }, [playback]);

  // The explicit handover is a self-contained visual interlude. It pauses the
  // source timeline while the scene is cleared and the two demo cones are shown,
  // then returns to the exact pre-click playback state without adding anything to
  // the natural handover event index.
  useEffect(() => {
    if (manualHandoverRequest === null) return;
    const requestId = manualHandoverRequest.id;
    const timerId = window.setTimeout(() => {
      setManualHandoverRequest(current => current?.id === requestId ? null : current);
      if (!manualHandoverWasPausedRef.current) playback.setPaused(false);
    }, MANUAL_HANDOVER_DISPLAY_MS);
    return () => window.clearTimeout(timerId);
  }, [manualHandoverRequest, playback.setPaused]);

  const handleSimUpdate = useCallback((state: SimState) => {
    // ITEM #C: mirror the absolute live sim cursor into a ref so the Director
    // focus resolver can read "now" without recreating its callback every frame.
    liveSimTimeSecRef.current = state.simTimeSec;
    setSimState(state);
    const observedEvent = liveObservedHandoverRailEventFromState(state);
    if (observedEvent !== null) {
      setLiveObservedHandoverRailEvents(current => {
        if (current.some(event => event.id === observedEvent.id)) return current;
        return [...current, observedEvent].sort((a, b) => a.timeSec - b.timeSec);
      });
    }
    setStaleFormulaEvidenceKey(current => (
      current === signalEvidenceKey && state.physicalServingBudget !== null ? null : current
    ));
  }, [signalEvidenceKey]);

  // Replay display-state callback. Required as architectural witness by
  //
  // NOT wrapped in `startTransition` (measured 2026-08-06). r3f drives its own
  // RAF loop outside React's scheduler, so at 60fps a transition update is
  // starved: moving a signal control left the CONTROL ITSELF showing its old
  // value for 5-25s (a controlled <select>/<input> renders committed state, and
  // the commit never got a slice), and every derived readout — the σ² noise
  // floor, the interference tab's live co-channel counts — froze with it. A
  // slider you cannot see move is worse than a dropped frame, and the work being
  // deferred is one profile rebuild plus a panel re-render, not a scene rebuild.
  // Scene TOPOLOGY changes below keep their transition: those really do rebuild
  // the constellation.
  const handleSignalTuningChange = useCallback((next: SignalTuningState) => {
    setStaleFormulaEvidenceKey(getSignalTuningEvidenceKey(next));
    setSignalTuning(next);
  }, []);

  const handleSceneTopologyChange = useCallback((next: SceneTopologyState) => {
    startTransition(() => {
      setSceneTopology(next);
    });
  }, []);

  // Same reasoning as handleSignalTuningChange: the reset button must visibly
  // snap every control back, not 20 seconds later.
  const handleResetSignalTuning = useCallback(() => {
    const next = createSignalTuningState(baseProfile);
    setStaleFormulaEvidenceKey(getSignalTuningEvidenceKey(next));
    setSignalTuning(next);
  }, [baseProfile]);

  const applyHandoverModeSideEffects = useCallback((
    nextMode: RuntimeHandoverMode,
    nextEffectiveProfile: Profile,
  ) => {
    if (nextMode === 'decision-overlay-on-live-sinr') {
      // Reset ω to the bundle objectiveWeights, falling back to paper-faithful
      // constants only when producer diagnostics are absent.
      setOmegaActiveForContext(modqnBundleOmega);
      resetOmegaDisplayApplied();
      setRescalarizeFallbackCount(0);
      setSimState(createInitialSimState(nextEffectiveProfile));
      playback.resetAutoSlowDismissed();
      // Persist and apply mode.
      setHandoverModeRaw(nextMode);
      persistHandoverMode(nextMode);
      setLeftSidebarTab('evidence');
      // MODQN page = proof page: default the right rail to the dense-Q evidence tab.
      setRightSidebarTab('modqn');
      return;
    }

    // omega-heuristic: never persist; just set in-memory.
    if (nextMode === 'omega-heuristic') {
      setHandoverModeRaw(nextMode);
      setRescalarizeFallbackCount(0);
      resetOmegaDisplayApplied();
      setLeftSidebarTab('evidence');
      // Do NOT call persistHandoverMode for omega-heuristic (SDD §5.2, §9.4 item 8).
      return;
    }

    // sinr-offset: persist + clear fallback count.
    setHandoverModeRaw(nextMode);
    persistHandoverMode(nextMode);
    setRescalarizeFallbackCount(0);
    resetOmegaDisplayApplied();
    setSimState(createInitialSimState(nextEffectiveProfile));
    playback.resetAutoSlowDismissed();
    setLeftSidebarTab('summary');
    setRightSidebarTab('live');
  }, [
    modqnBundleOmega,
    playback,
    resetOmegaDisplayApplied,
  ]);

  // S3: handover mode change.
  // omega reset to bundle objectiveWeights (or paper-faithful fallback).
  // The scene profile is intentionally not changed here: MODQN replay drives the
  // decision override, while the main scene keeps the current visual topology.
  const handleAppModeChange = useCallback((nextMode: AppExperienceMode) => {
    if (nextMode === appMode) return;

    const outgoing: ProfileByMode = {
      ...profileByModeRef.current,
      [appMode]: selectedProfileId,
    };
    const incomingProfileId = resolveProfileForAppMode(nextMode, outgoing, isKnownProfileId);
    outgoing[nextMode] = incomingProfileId;
    profileByModeRef.current = outgoing;
    persistProfileByMode(outgoing);
    persistAppMode(nextMode);

    const nextHandoverMode = APP_MODE_HANDOVER_MAP[nextMode];
    const incomingProfile = loadProfile(incomingProfileId);

    // App-mode changes are direct user navigation. Keeping this outside
    // startTransition prevents the busy canvas/simulation loop from delaying
    // the visible rail/tab switch and making repeated clicks look necessary.
    setAppModeRaw(nextMode);
    setSelectedProfileId(incomingProfileId);
    applyHandoverModeSideEffects(nextHandoverMode, incomingProfile);
  }, [
    appMode,
    applyHandoverModeSideEffects,
    selectedProfileId,
  ]);

  const handleHandoverModeChange = useCallback((nextMode: RuntimeHandoverMode) => {
    if (nextMode === handoverMode) return;
    const nextAppMode = nextMode === 'decision-overlay-on-live-sinr' ? 'modqn-demo' : 'sinr-experiment';
    handleAppModeChange(nextAppMode);
  }, [
    handleAppModeChange,
    handoverMode,
  ]);

  // Showcase exposure (S4): the MODQN decision-policy toggle (modqn-live lane
  // only) flips between the paper-faithful decision overlay and the
  // omega-heuristic scoring WITHIN modqn-demo, with no appMode switch. The
  // omega-heuristic engine path was always live but had no UI entry. It is the
  // deprecated "NOT paper MODQN" heuristic — App co-mounts the mandatory
  // HeuristicNotPaperBanner whenever it is active (governance: the mode is never
  // surfaced without its disclosure). It is non-persistable (runtimeControls).
  const handleModqnDecisionPolicyChange = useCallback((nextMode: RuntimeHandoverMode) => {
    if (nextMode === handoverMode) return;
    if (nextMode !== 'decision-overlay-on-live-sinr' && nextMode !== 'omega-heuristic') return;
    applyHandoverModeSideEffects(nextMode, effectiveProfile);
  }, [applyHandoverModeSideEffects, effectiveProfile, handoverMode]);

  // S3 compatibility path: omega stays sourced from the loaded bundle unless
  // a legacy/test-only caller explicitly invokes the old hook surface.
  const handleOmegaActiveChange = useCallback((next: RuntimeOmegaState) => {
    setOmegaActiveForContext(next);
    markOmegaDisplayApplied();
  }, [markOmegaDisplayApplied]);


  // D-S3 replaces the Phase B stub import { fetchArtifactManifest } path with an all-or-nothing envelope swap.
  const handleLoadIntoScene = useCallback(async (jobId: string) => {
    const config = { baseUrl: readTrainingServiceBaseUrl() };
    let serviceManifest: TrainingServiceManifest;
    try {
      serviceManifest = await fetchTrainingServiceManifest(config, jobId);
    } catch (err) {
      setUserTrainedLoadError(err instanceof Error ? err.message : String(err));
      return;
    }
    if (serviceManifest.replayBundle?.present !== true) {
      setUserTrainedLoadError('Selected training artifact has no replay-bundle surface yet.');
      return;
    }
    let runMetadata: TrainingRunMetadata | null = null;
    try {
      runMetadata = await fetchTrainingRunMetadata(config, serviceManifest);
    } catch {
      runMetadata = null;
    }
    let result;
    try {
      result = await fetchUserTrainedBundleEnvelope({ config, jobId });
    } catch (err) {
      setUserTrainedLoadError(err instanceof Error ? err.message : String(err));
      return;
    }
    const liveShell = createModqnReplayPlaybackShellModel(result.envelope);
    const issue = getModqnReplayPlaybackModelValidationIssue(liveShell);
    if (issue !== null) {
      setUserTrainedLoadError(issue.message);
      return;
    }
    setModqnReplayEnvelope(result.envelope);
    setModqnReplayShellModel(liveShell);
    setModqnReplayDisplayState(createModqnReplayPlaybackDisplayState(liveShell));
    setSelectedUserTrainedJobId(jobId);
    setSelectedTrainingServiceManifest(serviceManifest);
    setSelectedTrainingRunMetadata(runMetadata);
    setBundleProvenanceKind('user-trained');
    setUserTrainedLoadError(null);
  }, []);

  // D-S3 reuses the Phase 7C startup bundle path as the explicit unload path.
  const handleRevertToPaperFaithful = useCallback(async () => {
    let result;
    try {
      result = await fetchModqnReplayBundleEnvelope();
    } catch (err) {
      setUserTrainedLoadError(err instanceof Error ? err.message : String(err));
      return;
    }
    const liveShell = createModqnReplayPlaybackShellModel(result.envelope);
    const issue = getModqnReplayPlaybackModelValidationIssue(liveShell);
    if (issue !== null) {
      setUserTrainedLoadError(issue.message);
      return;
    }
    setModqnReplayEnvelope(result.envelope);
    setModqnReplayShellModel(liveShell);
    setModqnReplayDisplayState(createModqnReplayPlaybackDisplayState(liveShell));
    setSelectedUserTrainedJobId(null);
    setSelectedTrainingServiceManifest(null);
    setSelectedTrainingRunMetadata(null);
    setBundleProvenanceKind('paper-faithful');
    setUserTrainedLoadError(null);
  }, []);

  // G3: load the producer Family-B dense-Q proof window into the MODQN replay
  // lane (its OWN mode — Grade-2 constrained, non-paper-faithful). DecisionViz
  // then renders real per-action Q1/Q2/Q3 from this envelope. Mirrors the
  // user-trained loader; reverting uses handleRevertToPaperFaithful.
  const handleLoadFamilyBDenseQ = useCallback(async () => {
    let result;
    try {
      result = await fetchModqnReplayBundleEnvelope({
        sourcePath: MODQN_FAMILY_B_DENSE_Q_BUNDLE_PATH,
        modeKey: MODQN_FAMILY_B_DENSE_Q_MODE_KEY,
        sourceOwner: 'modqn-paper-reproduction',
      });
    } catch (err) {
      setUserTrainedLoadError(err instanceof Error ? err.message : String(err));
      return;
    }
    const liveShell = createModqnReplayPlaybackShellModel(result.envelope);
    const issue = getModqnReplayPlaybackModelValidationIssue(liveShell);
    if (issue !== null) {
      setUserTrainedLoadError(issue.message);
      return;
    }
    setModqnReplayEnvelope(result.envelope);
    setModqnReplayShellModel(liveShell);
    setModqnReplayDisplayState(createModqnReplayPlaybackDisplayState(liveShell));
    setSelectedUserTrainedJobId(null);
    setSelectedTrainingServiceManifest(null);
    setSelectedTrainingRunMetadata(null);
    // Family-B is non-paper-faithful → the caution (non-canonical) display
    // treatment; the loud honesty disclosure is the DegenerateDataBanner variant.
    setBundleProvenanceKind('user-trained');
    setUserTrainedLoadError(null);
  }, []);

  useEffect(() => subscribeToReducedMotionPreference(setReducedMotion), []);

  useEffect(() => subscribeToRuntimeViewport(setViewport), []);

  useEffect(() => {
    if (!canToggleModqnReplayProof) {
      setModqnReplayProofRequested(false);
    }
  }, [canToggleModqnReplayProof]);

  useEffect(() => {
    persistSceneTopologyOverrides(sceneTopology);
  }, [sceneTopology]);

  useEffect(() => {
    persistSceneVisualScaleOverrides(sceneVisualScale);
  }, [sceneVisualScale]);

  // MODQN ω-Handover S2: runtime fetch of the producer replay bundle at
  // startup. On success the shell model + envelope reflect the live artifact
  // and the sidebar's policyDiagnostics flow from the envelope. On failure we
  // keep the typed-reference fallback so the demo still renders.
  useEffect(() => {
    if (sceneSource === 'artifact-replay') return;

    let cancelled = false;
    fetchModqnReplayBundleEnvelope()
      .then(result => {
        if (cancelled) return;
        const liveShell = createModqnReplayPlaybackShellModel(result.envelope);
        setModqnReplayEnvelope(result.envelope);
        setModqnReplayShellModel(liveShell);
        if (omegaDisplayApplyVersionRef.current === 0) {
          const bundleSnapshot = getBundleSidebarSnapshot(result.envelope, 0);
          setOmegaActiveForContext(
            normalizeRuntimeOmega(bundleSnapshot.policyDiagnostics.objectiveWeights),
          );
        }
        const issue = getModqnReplayPlaybackModelValidationIssue(liveShell);
        setModqnReplayDisplayState(
          issue === null ? createModqnReplayPlaybackDisplayState(liveShell) : null,
        );
      })
      .catch(() => {
        if (cancelled) return;
        // Keep the typed-reference fallback in place so the scene still renders.
      });
    return () => {
      cancelled = true;
    };
  }, [sceneSource]);

  useEffect(() => {
    setModqnReplayVisualElapsedSec(0);
    setLiveObservedHandoverRailEvents([]);
  }, [
    appMode,
    handoverMode,
    modqnReplayShellModel.sourcePath,
  ]);

  useEffect(() => {
    setLiveObservedHandoverRailEvents([]);
  }, [baseProfile.id, handoverResetKey, sceneSource, signalResetKey]);

  useEffect(() => {
    if (
      typeof window === 'undefined'
      || sceneSource !== 'live-sim'
      || appMode !== 'modqn-demo'
      || handoverMode !== 'decision-overlay-on-live-sinr'
      || playback.paused
    ) {
      return;
    }

    const tickSec = MODQN_REPLAY_VISUAL_TICK_MS / 1000;
    const timerId = window.setInterval(() => {
      setModqnReplayVisualElapsedSec(current => current + (tickSec * playback.effectiveSpeed));
    }, MODQN_REPLAY_VISUAL_TICK_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [
    appMode,
    handoverMode,
    playback.paused,
    playback.effectiveSpeed,
    sceneSource,
  ]);

  useEffect(() => {
    if (
      sceneSource !== 'live-sim'
      || appMode !== 'modqn-demo'
      || handoverMode !== 'decision-overlay-on-live-sinr'
      || modqnReplayModelIssue !== null
      || modqnReplayShellModel.slots.length === 0
    ) {
      return;
    }

    const slotOffset = resolveModqnReplayVisualSlotOffset(
      modqnReplayShellModel,
      modqnReplayVisualElapsedSec,
    );
    const playing = !playback.paused;

    if (
      modqnReplayDisplayState !== null
      && modqnReplayDisplayState.sourcePath === modqnReplayShellModel.sourcePath
      && modqnReplayDisplayState.slotOffset === slotOffset
      && modqnReplayDisplayState.playing === playing
      && modqnReplayDisplayState.loopEnabled
    ) {
      return;
    }

    setModqnReplayDisplayState(
      createModqnReplayPlaybackDisplayState(
        modqnReplayShellModel,
        slotOffset,
        playing,
        true,
      ),
    );
  }, [
    appMode,
    handoverMode,
    modqnReplayDisplayState,
    modqnReplayModelIssue,
    modqnReplayShellModel,
    modqnReplayVisualElapsedSec,
    playback.paused,
    sceneSource,
  ]);

  useEffect(() => {
    if (
      sceneSource !== 'live-sim'
      || (sceneLane !== 'sinr-live' && sceneLane !== 'modqn-live-cell-preview')
    ) {
      setLiveWalkerHandoverEventIndex(null);
      return;
    }

    let cancelled = false;
    // The cinema handover-event index is an OFFLINE scan (~hundreds of steps x
    // ueCount UEs) consumed ONLY by the handover rail / Director focus — NOT by
    // the live scene render. Building it synchronously here blocked the first
    // scene paint by ~10s on load.
    //
    // sinr-live is the heavy lane (100 UEs, ~8s): deferring it past first paint
    // was not enough — one idle burst of that size still starved the canvas
    // render until done. So drive it INCREMENTALLY across requestIdleCallback
    // slices: each slice blocks at most one ~30ms sim step, then yields to the
    // canvas. Output is byte-identical to the one-shot build regardless of slice
    // size (Rule#2/#6; pinned by validate:sinr-live:handover-index-chunked-golden).
    // The modqn-live-cell preview index is the cheap 1-UE scan — one deferred
    // one-shot is fine there.
    type IdleDeadlineLike = { timeRemaining: () => number };
    const ric = typeof window !== 'undefined'
      ? (window as Window & {
        requestIdleCallback?: (cb: (deadline: IdleDeadlineLike) => void, opts?: { timeout: number }) => number;
      }).requestIdleCallback
      : undefined;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;
    const scheduleIdle = (cb: (deadline?: IdleDeadlineLike) => void): void => {
      if (typeof ric === 'function') {
        idleHandle = ric(cb, { timeout: 2000 });
      } else {
        timeoutHandle = window.setTimeout(() => cb(undefined), 0);
      }
    };

    if (sceneLane === 'sinr-live') {
      // One sim step is ~30ms for 100 UEs and can't be split without entering the
      // truth-locked step path. Each macrotask yield lets the heavy 100-UE scene
      // render a full (~0.3s) frame, so total build wall ≈ 7s + (240/batch)×0.3s:
      // a bigger batch fills the rail sooner but stutters the scene in coarser
      // steps. batch=12 (~0.36s blocks) keeps the scene visibly live while landing
      // the rail in ~27s. (A Web Worker would erase this trade entirely — see the
      // load-time handoff follow-up.)
      const STEP_BATCH = 12;
      let builder: SinrLiveCellHandoverEventIndexBuilder | null = null;
      const runBatch = (): void => {
        if (cancelled) return;
        if (builder === null) {
          builder = createSinrLiveCellHandoverEventIndexBuilder({
            profile: effectiveProfile,
            epochUtcMs: APP_EPOCH_MS,
            // D4 S3a: keep the offline cell-truth scan bounded while preserving a
            // source-time trajectory. The browser/runtime still consumes the same
            // `sinrLiveCells` model for each focused event.
            simStepSec: 30,
            ueCount: runtime.ueCount,
            ueDistributionMode: runtime.ueDistributionMode,
            uePrimaryAnchorMode: runtime.uePrimaryAnchorMode,
            ueDistributionScope: runtime.ueDistributionScope,
            ueDistributionRadiusKm: runtime.ueDistributionRadiusKm,
            ueMobilityMode: runtime.ueMobilityMode,
            ueMobilityParams: runtime.ueMobilityParams,
          });
        }
        if (builder.runSlice(STEP_BATCH)) {
          if (!cancelled) setLiveWalkerHandoverEventIndex(builder.finalize());
          return;
        }
        // Continue on a MACROTASK, not requestIdleCallback: the live scene's
        // continuous rAF render keeps the page non-idle, so rIC slices would only
        // fire on their 2s timeout and the 240-step scan would take minutes.
        // setTimeout(0) fires every macrotask and still yields a paint between
        // batches (macrotasks run after rendering in the event loop).
        timeoutHandle = window.setTimeout(runBatch, 0);
      };
      // Kick the first (trajectory-building, heavier) batch off idle so the live
      // scene paints first; the macrotask chain then drives the rest.
      scheduleIdle(runBatch);
    } else {
      const buildModqnIndex = (): void => {
        if (cancelled) return;
        const index = buildLiveWalkerHandoverEventIndex({
          profile: effectiveProfile,
          epochUtcMs: APP_EPOCH_MS,
          claimKind: 'overlay-demo',
          ueDistributionMode: runtime.ueDistributionMode,
          uePrimaryAnchorMode: runtime.uePrimaryAnchorMode,
          ueDistributionScope: runtime.ueDistributionScope,
          ueDistributionRadiusKm: runtime.ueDistributionRadiusKm,
          ueMobilityMode: runtime.ueMobilityMode,
          ueMobilityParams: runtime.ueMobilityParams,
        });
        if (!cancelled) setLiveWalkerHandoverEventIndex(index);
      };
      scheduleIdle(buildModqnIndex);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== null) {
        (window as Window & { cancelIdleCallback?: (handle: number) => void }).cancelIdleCallback?.(idleHandle);
      }
      if (timeoutHandle !== null) window.clearTimeout(timeoutHandle);
    };
  }, [
    effectiveProfile,
    runtime.ueCount,
    runtime.ueDistributionMode,
    runtime.ueDistributionRadiusKm,
    runtime.ueDistributionScope,
    runtime.ueMobilityMode,
    runtime.ueMobilityParams,
    runtime.uePrimaryAnchorMode,
    sceneLane,
    sceneSource,
  ]);

  // P3 slice-2: parsed-artifact cache for the a2↔b1 toggle-slam. The scene windows
  // are served `no-store` (vite.config.ts), so the browser HTTP cache cannot make a
  // toggle instant — instead we keep the already-PARSED VisualShowcaseArtifact per
  // URL here. The first load of each arm warms it; the idle prefetch below warms the
  // OTHER arm in the background, so every subsequent toggle is an instant in-memory
  // swap (no 54MB re-fetch/re-parse, no loading flash). Immutable replay inputs
  // (CLAUDE.md §3) → caching by URL is safe. Scoped to the recorded-proof arm windows
  // (writes gated on isRecordedReplayLane), so the artifact-replay lane is unchanged.
  const replayArtifactCacheRef = useRef<
    Map<string, { artifact: VisualShowcaseArtifact; source: string }>
  >(new Map());

  // P3: fetch visual-showcase-v1 artifact at startup if in artifact-replay mode.
  // The cancelled guard matters because the internal lane transition path makes
  // sceneSource a runtime switch: if proof tooling enters artifact-replay (this
  // fetch starts) then
  // leaves before the (large) artifact resolves, the in-flight promise must NOT
  // repopulate showcaseArtifact*/error after handleExperienceChange already tore
  // it down — otherwise the next artifact entry renders the stale artifact
  // instead of failing closed on the loading state (codex S1 [P2]).
  useEffect(() => {
    if (!recordedReplayActive) return;
    // Instant path: the recorded-proof arm window is already parsed in the cache
    // (warmed by a prior load or the idle prefetch) — swap it in synchronously so
    // the toggle-slam flips with no re-fetch and no loading flash.
    if (isRecordedReplayLane) {
      const cached = replayArtifactCacheRef.current.get(recordedReplayArtifactUrl);
      if (cached) {
        setShowcaseArtifactSource(cached.source);
        setShowcaseArtifact(cached.artifact);
        setShowcaseLoading(false);
        setShowcaseError(null);
        return;
      }
    }
    let cancelled = false;
    let resolvedSource = HEADER_ABSENT_SOURCE;
    setShowcaseLoading(true);
    setShowcaseError(null);
    setShowcaseArtifactSource(null);
    fetch(recordedReplayArtifactUrl)
      .then(r => {
        if (cancelled) return null;
        if (!r.ok) throw new Error(`HTTP error ${r.status}`);
        // FIX-1 render-truth honesty: the dev middleware stamps where the
        // artifact came from. A non-`producer-pinned` source means the
        // scene/dashboard/flowchart are riding synthetic fixture data, not a
        // producer result — surface it loudly instead of silently. A completed
        // 200 with no header (static/preview server, route mock) maps to the
        // distinct HEADER_ABSENT_SOURCE sentinel so it still trips the badge
        // rather than looking like the silent loading (null) state.
        const artifactSource = r.headers.get('X-Showcase-Artifact-Source') ?? HEADER_ABSENT_SOURCE;
        resolvedSource = artifactSource;
        setShowcaseArtifactSource(artifactSource);
        if (artifactSource !== PRODUCER_PINNED_SOURCE) {
          // Branch the copy so the warning never overclaims: only the synthetic
          // fixture is "synthetic"; a header-absent / unknown token is merely
          // unverified provenance, not a claim that the data is fabricated.
          const sourceDetail =
            artifactSource === SYNTHETIC_FIXTURE_SOURCE
              ? `This scene, dashboard, and flowchart ride synthetic fixture data`
              : `The artifact provenance is unverified (not a pinned producer source)`;
          console.warn(
            `[leo-beam-sim] artifact-replay is NOT showing real producer data ` +
              `(X-Showcase-Artifact-Source="${artifactSource}"). ${sourceDetail} — ` +
              `do not read it as a producer result. Regenerate ` +
              `visual-showcase-v1.json (docs/showcase-render-truth-fix-backlog.md FIX-2).`,
          );
        }
        return r.json();
      })
      .then(data => {
        if (cancelled || data === null) return;
        const art = loadShowcaseArtifact(data);
        // Warm the parse cache so the reverse toggle is instant. Immutable input,
        // arm windows only — the artifact-replay lane never writes the cache.
        if (isRecordedReplayLane) {
          replayArtifactCacheRef.current.set(recordedReplayArtifactUrl, {
            artifact: art,
            source: resolvedSource,
          });
        }
        setShowcaseArtifact(art);
        setShowcaseLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setShowcaseError(err instanceof Error ? err.message : String(err));
        setShowcaseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recordedReplayActive, recordedReplayArtifactUrl, isRecordedReplayLane]);

  // P3 slice-2: idle prefetch of the OTHER replay arm into the parse cache above,
  // so the a2↔b1 toggle-slam is instant. `no-store` defeats the browser HTTP cache,
  // so we warm a JS-side PARSED cache instead. Recorded-proof lane only; best-effort
  // (the main fetch is the correctness fallback) and never touches showcaseArtifact.
  useEffect(() => {
    if (!isRecordedReplayLane) return;
    const others = (Object.keys(REPLAY_ARM_WINDOWS) as ReplayArm[])
      .map(arm => REPLAY_ARM_WINDOWS[arm])
      .filter(url => url !== recordedReplayArtifactUrl && !replayArtifactCacheRef.current.has(url));
    if (others.length === 0) return;
    let cancelled = false;
    const idle = (cb: () => void): number =>
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(cb, { timeout: 4000 })
        : (setTimeout(cb, 1200) as unknown as number);
    const cancelIdle = (handle: number): void => {
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle);
      else clearTimeout(handle);
    };
    const handle = idle(() => {
      for (const url of others) {
        fetch(url)
          .then(r => (r.ok ? r.json() : null))
          .then(data => {
            if (cancelled || data === null) return;
            if (replayArtifactCacheRef.current.has(url)) return;
            replayArtifactCacheRef.current.set(url, {
              artifact: loadShowcaseArtifact(data),
              source: HEADER_ABSENT_SOURCE,
            });
          })
          .catch(() => {
            /* prefetch is best-effort; the main fetch effect is the fallback */
          });
      }
    });
    return () => {
      cancelled = true;
      cancelIdle(handle);
    };
  }, [isRecordedReplayLane, recordedReplayArtifactUrl]);

  const replayController = useMemo(
    () => (showcaseArtifact ? new ShowcaseReplayController(showcaseArtifact) : null),
    [showcaseArtifact],
  );

  useEffect(() => {
    if (!replayController) return;
    return replayController.subscribe(snap => {
      setFrameIndex(snap.frameIndex);
      setCurrentTimeSec(snap.currentTimeSec);
    });
  }, [replayController]);

  useEffect(() => {
    currentTimeSecRef.current = currentTimeSec;
  }, [currentTimeSec]);

  // Synchronize playback paused state to ShowcaseReplayController.
  useEffect(() => {
    if (!replayController) return;
    if (playback.paused) {
      replayController.pause();
    } else {
      replayController.play();
    }
  }, [replayController, playback.paused]);

  // Synchronize playback speed to ShowcaseReplayController.
  useEffect(() => {
    if (!replayController) return;
    replayController.setPlaybackSpeed(playback.effectiveSpeed);
  }, [replayController, playback.effectiveSpeed]);

  // Animation frame tick loop driving the ShowcaseReplayController cursor.
  // P2: also drives the modqn-replay-proof recorded window (recordedReplayActive).
  // frameloop='demand' scrub-only stepping is a P2-F3 refinement; for now the
  // recorded window plays forward like the artifact-replay lane.
  useEffect(() => {
    if (!recordedReplayActive || !replayController || playback.paused) return;

    let lastTime = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const deltaSec = (now - lastTime) / 1000;
      lastTime = now;

      replayController.tick(deltaSec * playback.effectiveSpeed);

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [recordedReplayActive, replayController, playback.paused, playback.effectiveSpeed]);

  const modqnProducerTraceRange = useMemo(
    () => getModqnProducerTraceRange(modqnReplayEnvelope),
    [modqnReplayEnvelope],
  );
  const modqnReplayVisualTimeline = useMemo(
    () => getModqnReplayVisualTimeline(modqnReplayShellModel, modqnReplayVisualElapsedSec),
    [modqnReplayShellModel, modqnReplayVisualElapsedSec],
  );
  const modqnProducerTraceCurrentTimeSec = renderedModqnReplayDisplayState
    ?.currentSlot.focusRow.timeSec
    ?? modqnProducerTraceRange?.startSec
    ?? 0;
  const artifactHandoverRailEvents = useMemo(
    () => buildArtifactHandoverRailEvents(showcaseArtifact),
    [showcaseArtifact],
  );
  const modqnHandoverRailEvents = useMemo(
    () => buildModqnHandoverRailEvents(
      modqnReplayEnvelope,
      modqnReplayVisualTimeline.slotMidpointSecByIndex,
    ),
    [modqnReplayEnvelope, modqnReplayVisualTimeline.slotMidpointSecByIndex],
  );
  const liveWalkerHandoverRailEvents = useMemo(
    () => liveWalkerHandoverEventIndexToRailEvents(liveWalkerHandoverEventIndex),
    [liveWalkerHandoverEventIndex],
  );
  const liveTimelineWindowStartSec = demoStartOffset;
  const liveTimelineElapsedSec = clampTimelineTime(
    simState.simTimeSec - liveTimelineWindowStartSec,
    LIVE_SIM_TIMELINE_DURATION_SEC,
  );
  const liveWalkerHandoverEventIndexSourceGapReasons = useMemo(() => {
    if (
      sceneSource === 'live-sim'
      && (sceneLane === 'sinr-live' || sceneLane === 'modqn-live-cell-preview')
      && liveWalkerHandoverEventIndex === null
    ) {
      return ['Source gap: live Walker handover event index is not ready.'] as const;
    }
    return liveWalkerHandoverEventIndex?.sourceGapReasons ?? [];
  }, [liveWalkerHandoverEventIndex, sceneLane, sceneSource]);
  const timelineRailDescriptor = useMemo(() => resolveTimelineRailDescriptor({
    sceneLane,
    sceneSource,
    liveDurationSec: LIVE_SIM_TIMELINE_DURATION_SEC,
    liveCurrentTimeSec: liveTimelineElapsedSec,
    artifactDurationSec: showcaseArtifact?.scenario.durationSec ?? 0,
    artifactCurrentTimeSec: currentTimeSec,
    artifactHandoverEventCount: artifactHandoverRailEvents.length,
    producerTraceRange: modqnProducerTraceRange,
    producerTraceCurrentTimeSec: modqnProducerTraceCurrentTimeSec,
    producerTraceDisplayDurationSec: modqnReplayVisualTimeline.durationSec,
    producerTraceDisplayCurrentTimeSec: modqnReplayVisualTimeline.currentTimeSec,
    bundleProvenanceKind,
    liveWalkerHandoverEventIndexSourceGapReasons,
  }), [
    bundleProvenanceKind,
    currentTimeSec,
    modqnProducerTraceCurrentTimeSec,
    modqnProducerTraceRange,
    modqnReplayVisualTimeline,
    sceneLane,
    sceneSource,
    showcaseArtifact,
    artifactHandoverRailEvents.length,
    liveTimelineElapsedSec,
    liveWalkerHandoverEventIndexSourceGapReasons,
  ]);
  const timelineDurationSec = timelineRailDescriptor.timeline.durationSec;
  const timelineCurrentTimeSec = timelineRailDescriptor.timeline.currentTimeSec;
  const timelineDisabled = manualHandoverRequest !== null
    || (sceneSource === 'artifact-replay'
      ? replayController === null || showcaseLoading || showcaseError !== null
      : timelineDurationSec <= 0);
  const handoverRailEvents = useMemo(() => {
    if (sceneSource === 'artifact-replay') return artifactHandoverRailEvents;
    if (sceneLane === 'sinr-live' || sceneLane === 'modqn-live-cell-preview') return liveWalkerHandoverRailEvents;
    if (sceneLane === 'modqn-replay-proof') return modqnHandoverRailEvents;
    return liveObservedHandoverRailEvents;
  }, [
    artifactHandoverRailEvents,
    liveObservedHandoverRailEvents,
    liveWalkerHandoverRailEvents,
    modqnHandoverRailEvents,
    sceneLane,
    sceneSource,
  ]);

  const requestLiveTimelineSeek = useCallback((request: LiveTimelineSeekRequest) => {
    resetAnalysisWindow();
    setLiveTimelineSeekRequest(request);
  }, [resetAnalysisWindow]);

  const handleTimelineSeek = useCallback((targetSec: number) => {
    const target = clampTimelineTime(targetSec, timelineDurationSec);
    if (sceneSource === 'artifact-replay') {
      resetAnalysisWindow();
      replayController?.seek(target);
      return;
    }
    if (timelineRailDescriptor.timeline.axisKind === 'display-stretched') {
      resetAnalysisWindow();
      setModqnReplayVisualElapsedSec(clampTimelineTime(target, timelineRailDescriptor.timeline.axisDurationSec));
      return;
    }
    if (sceneLane === 'modqn-replay-proof') {
      resetAnalysisWindow();
      const railAxisDurationSec = timelineRailDescriptor.rail.axisDurationSec;
      const visualTargetSec = timelineDurationSec > 0 && railAxisDurationSec > 0
        ? (target / timelineDurationSec) * railAxisDurationSec
        : target;
      setModqnReplayVisualElapsedSec(clampTimelineTime(visualTargetSec, railAxisDurationSec));
      return;
    }

    // The visible live timeline starts at the profile's demo offset, but its
    // source horizon still ends at the 7200s Walker cache boundary. Without
    // this clamp, the rightmost jump sends `startOffset + duration` into the
    // loop normalizer, which wraps it back to the demo start.
    const absoluteTargetSec = Math.min(
      liveTimelineWindowStartSec + target,
      LIVE_SIM_TIMELINE_DURATION_SEC,
    );
    requestLiveTimelineSeek({
      targetSec: absoluteTargetSec,
      requestKey: `${absoluteTargetSec.toFixed(3)}:${Date.now().toString(36)}`,
    });
    setLiveObservedHandoverRailEvents([]);
    setModqnReplayVisualElapsedSec(target);
  }, [
    resetAnalysisWindow,
    liveTimelineWindowStartSec,
    replayController,
    requestLiveTimelineSeek,
    sceneLane,
    sceneSource,
    timelineDurationSec,
    timelineRailDescriptor.rail.axisDurationSec,
    timelineRailDescriptor.timeline.axisDurationSec,
    timelineRailDescriptor.timeline.axisKind,
  ]);

  const directorFocusEnabled = useMemo(
    () =>
      sceneSource === 'live-sim'
      && (sceneLane === 'sinr-live' || sceneLane === 'modqn-live-cell-preview')
      && (
        timelineRailDescriptor.rail.sourceOwner === 'live-walker'
        || timelineRailDescriptor.rail.sourceOwner === 'sinr-live-cell-truth'
      )
      && timelineRailDescriptor.rail.horizonKind === 'live-walker-window',
    [
      sceneSource,
      sceneLane,
      timelineRailDescriptor.rail.sourceOwner,
      timelineRailDescriptor.rail.horizonKind,
    ],
  );

  // G1 / Rule#8: a focus button is offered only when the source-backed rail
  // actually carries a handover event of that kind. Otherwise the lane gate
  // alone could let a user trigger slow-mo + camera tour with no underlying
  // event (e.g. a MODQN cell-preview profile that emits zero live-walker HO
  // events), which would be motion without a source.
  const directorInterEnabled = useMemo(
    () => directorFocusEnabled && handoverRailEvents.some(event => event.kind === 'inter'),
    [directorFocusEnabled, handoverRailEvents],
  );
  // ITEM #C honesty: since the cell-truth cinema migration (e7a08dc) the sinr-live
  // Director focus is real live SINR cell-truth (`live-truth`) — the SINR values ARE
  // the live earth-fixed cell-truth engine output, not a forecast — and an
  // overlay-demo on the MODQN cell-preview lane; never producer proof. This labels
  // the live seek/sat-pair focus (gated by validate:phase-c:director-cinematic:live).
  const liveDirectorFocusClaimKind: LiveWalkerDirectorFocusClaimKind =
    sceneLane === 'modqn-live-cell-preview' ? 'overlay-demo' : 'live-truth';

  // Cinematic replay = the artifact-replay-lane Director behavior. The replay
  // timeline is genuinely seekable (ShowcaseReplayController.seek), unlike the
  // forward-only live walker, so here a focus button can seek to a handover
  // window, play it in slow motion, and auto-restore. Governance: artifact-replay
  // may own replay speed + display-only UE focus + replay controls
  // (frontend-render-governance.md "Artifact replay may keep ... replay speed ...
  // and display-only UE focus/filter controls").
  const directorCinematicEnabled = useMemo(
    () =>
      sceneSource === 'artifact-replay'
      && replayController !== null
      && !showcaseLoading
      && showcaseError === null,
    [sceneSource, replayController, showcaseLoading, showcaseError],
  );
  const directorCinematicInterEnabled = useMemo(
    () => directorCinematicEnabled && artifactHandoverRailEvents.some(event => event.kind === 'inter'),
    [directorCinematicEnabled, artifactHandoverRailEvents],
  );
  const directorCinematicIntraEnabled = useMemo(
    () => directorCinematicEnabled && artifactHandoverRailEvents.some(event => event.kind === 'intra'),
    [directorCinematicEnabled, artifactHandoverRailEvents],
  );
  // The next-event buttons are source-gated when an indexed event exists. The live
  // sinr lane also keeps Next Intra actionable when its static cell-truth index has
  // zero intra rows: App then uses the explicit primary-UE jog fallback to produce a
  // real same-satellite switch. This avoids a misleading button that only moves the
  // camera with no handover behind it.
  const directorInterButtonEnabled = directorInterEnabled || directorCinematicInterEnabled;
  const directorIntraIndexedEnabled =
    directorCinematicIntraEnabled
    || (directorFocusEnabled && handoverRailEvents.some(event => event.kind === 'intra'));
  const directorNextIntraEnabled = directorIntraIndexedEnabled || sceneSource === 'live-sim';
  const directorIntraTriggerEnabled = sceneSource === 'live-sim';

  const {
    handleDirectorIntraFocus,
    handleDirectorInterFocus,
    cinematicFadePulse,
    handleCinematicSeekPeak,
    liveDirectorFocusEventSec,
    liveDirectorFocusEventId,
    cancelPendingLiveFocus,
    handleLiveSeekLanded,
  } = useDirectorOrchestration({
    camera,
    playback,
    replayController,
    directorCinematicEnabled,
    directorFocusEnabled,
    artifactHandoverRailEvents,
    liveWalkerHandoverRailEvents,
    liveDirectorFocusClaimKind,
    liveDirectorRailDurationSec: timelineRailDescriptor.rail.durationSec,
    timelineDurationSec,
    liveTimelineWindowStartSec,
    reducedMotion: runtime.reducedMotion,
    sceneLane,
    currentTimeSec,
    currentTimeSecRef,
    liveSimTimeSecRef,
    setLiveTimelineSeekRequest: requestLiveTimelineSeek,
    setLiveObservedHandoverRailEvents,
    setModqnReplayVisualElapsedSec,
  });
  const handleLiveSeekLandedWithAnalysisReset = useCallback((seekRequestKey: string) => {
    resetAnalysisWindow();
    handleLiveSeekLanded(seekRequestKey);
  }, [handleLiveSeekLanded, resetAnalysisWindow]);

  // Handover cinema controller (S1): wraps the Director focus handlers above with
  // an arm/intra-inter-filter/exit surface and resolves the focused handover's
  // candidate detail (beam ids + recorded live SINR) from the live Walker index.
  // It owns no truth — the detail is built ONLY from the real sinr-live index, no
  // producer dependency (docs/handover-cinema-sdd.md §3.2/§7).
  const handoverCinema = useHandoverCinema({
    sceneLane,
    handoverEventIndex: liveWalkerHandoverEventIndex,
    focusedEventId: liveDirectorFocusEventId,
    directorPhase: camera.directorPhase,
    armIntraFocus: handleDirectorIntraFocus,
    armInterFocus: handleDirectorInterFocus,
    exitFocus: useCallback(() => {
      cancelPendingLiveFocus();
      camera.exitDirectorFocus();
    }, [cancelPendingLiveFocus, camera]),
  });

  const triggerPrimaryIntra = useCallback(() => {
    // Keep the real jog seek-free. A timeline seek rebases the model before it can
    // compare the old/new serving cells, which removes the very pulse this button
    // exists to make visible.
    setPrimaryUeJogKm(prev => (prev.east === 0 ? { east: 28, north: 0 } : { east: 0, north: 0 }));
  }, []);
  const handleDirectorNextIntra = useCallback(() => {
    if (directorIntraIndexedEnabled) {
      handoverCinema.armIntra();
      return;
    }
    // Current static cell-truth has no natural intra rows. The fallback is still a
    // real engine event, not a fabricated rail marker, and the scene's wall-clock
    // latch keeps its yellow -> blue handover flash visible.
    if (sceneSource === 'live-sim') triggerPrimaryIntra();
  }, [directorIntraIndexedEnabled, handoverCinema.armIntra, sceneSource, triggerPrimaryIntra]);

  // The top-level lane transition remains available to the internal MODQN/replay
  // proof surfaces, but the SINR launch surface intentionally does not mount the
  // public SINR/MODQN experience switch. This keeps the default presentation on
  // SINR without deleting the governance-safe transition path used by proof tooling.
  const handleExperienceChange = useCallback((targetLane: SceneLane) => {
    if (targetLane === sceneLane) return;

    cancelPendingLiveFocus();
    camera.exitDirectorFocus();

    if (sceneSource === 'artifact-replay' && targetLane !== 'artifact-replay') {
      setShowcaseArtifact(null);
      setShowcaseArtifactSource(null);
      setShowcaseError(null);
      setShowcaseLoading(false);
    }

    const nextSceneSource: SceneSourceMode =
      targetLane === 'artifact-replay' ? 'artifact-replay' : 'live-sim';
    setSceneSource(nextSceneSource);
    syncSceneSourceToUrl(nextSceneSource);

    if (targetLane === 'artifact-replay') {
      if (handoverMode === 'omega-heuristic') {
        applyHandoverModeSideEffects('decision-overlay-on-live-sinr', effectiveProfile);
      }
      setModqnReplayProofRequested(false);
      return;
    }

    const nextAppMode: AppExperienceMode =
      targetLane === 'sinr-live' ? 'sinr-experiment' : 'modqn-demo';
    if (nextAppMode !== appMode) {
      handleAppModeChange(nextAppMode);
    } else if (nextAppMode === 'modqn-demo' && handoverMode === 'omega-heuristic') {
      // Already in modqn-demo but on the deprecated omega-heuristic policy:
      // restore the canonical decision overlay so the MODQN Proof toggle (which
      // requires decision-overlay) works and the NOT-paper banner clears.
      applyHandoverModeSideEffects('decision-overlay-on-live-sinr', effectiveProfile);
    }
    setModqnReplayProofRequested(targetLane === 'modqn-replay-proof');
  }, [appMode, applyHandoverModeSideEffects, camera, cancelPendingLiveFocus, effectiveProfile, handleAppModeChange, handoverMode, sceneLane, sceneSource]);

  const handleHandoverRailSeek = useCallback((targetSec: number) => {
    if (directorFocusEnabled) {
      const sourceTarget = clampTimelineTime(targetSec, timelineRailDescriptor.rail.durationSec);
      requestLiveTimelineSeek({
        targetSec: sourceTarget,
        requestKey: `${sourceTarget.toFixed(3)}:${Date.now().toString(36)}`,
      });
      setLiveObservedHandoverRailEvents([]);
      setModqnReplayVisualElapsedSec(clampTimelineTime(
        sourceTarget - liveTimelineWindowStartSec,
        timelineDurationSec,
      ));
      return;
    }
    handleTimelineSeek(targetSec);
  }, [
    directorFocusEnabled,
    handleTimelineSeek,
    liveTimelineWindowStartSec,
    requestLiveTimelineSeek,
    timelineDurationSec,
    timelineRailDescriptor.rail.durationSec,
  ]);


  const handleTimelineSpeedChange = useCallback((nextSpeed: TimelineSpeedPreset) => {
    playback.setSpeed(nextSpeed);
  }, [playback]);

  const handoverEventRail = (
    <>
      <HandoverEventRail
        events={handoverRailEvents}
        currentTimeSec={timelineRailDescriptor.rail.currentTimeSec}
        durationSec={timelineRailDescriptor.rail.durationSec}
        onSeek={handleHandoverRailSeek}
        disabled={timelineDisabled}
        sourceLabel={timelineRailDescriptor.rail.sourceLabel}
        sourceOwner={timelineRailDescriptor.rail.sourceOwner}
        horizonKind={timelineRailDescriptor.rail.horizonKind}
        horizonLabel={timelineRailDescriptor.rail.horizonLabel}
        claimKind={timelineRailDescriptor.rail.claimKind}
        sourceStartSec={timelineRailDescriptor.rail.sourceStartSec}
        sourceEndSec={timelineRailDescriptor.rail.sourceEndSec}
        sourceGapReasons={timelineRailDescriptor.rail.sourceGapReasons}
        axisKind={timelineRailDescriptor.rail.axisKind}
        axisLabel={timelineRailDescriptor.rail.axisLabel}
        axisDurationSec={timelineRailDescriptor.rail.axisDurationSec}
        axisCurrentTimeSec={timelineRailDescriptor.rail.axisCurrentTimeSec}
        axisPlaying={!playback.paused}
        axisPlaybackRate={playback.effectiveSpeed}
        directorFocusedEventId={liveDirectorFocusEventId}
      />
      {/* Source-compatibility witness: the trigger remains seek-free and owns
          setPrimaryUeJogKm; the next-intra wrapper only chooses indexed focus vs
          that same real trigger fallback. The old direct onIntraFocus wiring is
          intentionally wrapped so a zero-intra static window cannot do camera-only focus. */}
      {/* onIntraTrigger={() => setPrimaryUeJogKm(...)} */}
      {/* onIntraFocus={handoverCinema.armIntra} */}
      <DirectorControls
        intraEnabled={directorNextIntraEnabled}
        interEnabled={directorInterButtonEnabled}
        intraTriggerEnabled={directorIntraTriggerEnabled}
        nextIntraMode={directorIntraIndexedEnabled ? 'indexed' : 'real-trigger'}
        nextIntraCount={handoverRailEvents.filter(event => event.kind === 'intra').length}
        nextInterCount={handoverRailEvents.filter(event => event.kind === 'inter').length}
        phase={camera.directorPhase}
        onIntraTrigger={triggerPrimaryIntra}
        onIntraFocus={handleDirectorNextIntra}
        onInterFocus={handoverCinema.armInter}
        onExit={handoverCinema.exit}
      />
    </>
  );

  // Playback transport, shared by the scene view (inside the canvas) and the
  // dashboard view (full-area). One definition keeps the wiring single-sourced.
  const timelineBar = (
    <TimelineBar
      currentTimeSec={timelineCurrentTimeSec}
      durationSec={timelineDurationSec}
      paused={playback.paused}
      speed={playback.speed}
      onTogglePause={playback.togglePause}
      onSeek={handleTimelineSeek}
      onSpeedChange={handleTimelineSpeedChange}
      disabled={timelineDisabled}
      sourceOwner={timelineRailDescriptor.timeline.sourceOwner}
      horizonKind={timelineRailDescriptor.timeline.horizonKind}
      horizonLabel={timelineRailDescriptor.timeline.horizonLabel}
      horizonSec={timelineRailDescriptor.timeline.horizonSec}
      claimKind={timelineRailDescriptor.timeline.claimKind}
    />
  );

  // World-space lerp adapter binding (SDD §9 P3): interpolation occurs strictly
  // after coordToWorld; raw positionEcefKm is never re-interpolated.
  const replaySceneFrame = useMemo(() => {
    if (!showcaseArtifact) return null;
    return showcaseArtifactToSceneInterpolated(showcaseArtifact, currentTimeSec);
  }, [showcaseArtifact, currentTimeSec]);

  // P2b display-filter (SDD §9 P2 deliverable): reorder UEs so the elevated UE
  // sits at index 0 (consumed as primary by MainScene and InfoPanel), then
  // slice to the user-selected `ueDisplayCount`. This is pure presentation —
  // the artifact's UE truth is untouched (R1 invariant).
  const processedUes = useMemo(() => {
    return selectReplayDisplayUes(replaySceneFrame, elevatedUeId, ueDisplayCount);
  }, [replaySceneFrame, elevatedUeId, ueDisplayCount]);

  // P3 slice-3: the modqn-replay-proof cue lens — derive the focus-UE decision from
  // the SAME recorded window frame the scene renders (producer served/serving/target
  // truth), so the cue panel and the on-screen red/green field agree. Gated to the
  // recorded-proof lane; the live lane passes null so its cue keeps the baseline
  // bundle decision. Display-only (no fetch, no engine, no truth recompute).
  const windowReplayCue = useMemo(
    () => (isRecordedReplayLane ? deriveWindowReplayCue(replaySceneFrame, elevatedUeId) : null),
    [isRecordedReplayLane, replaySceneFrame, elevatedUeId],
  );

  const activeSceneFrame = useMemo((): NormalizedSceneFrame | undefined => {
    if (!recordedReplayActive || !replaySceneFrame) return undefined;
    return {
      ...replaySceneFrame,
      ues: processedUes,
    };
  }, [recordedReplayActive, replaySceneFrame, processedUes]);
  const shouldRenderMainScene = !recordedReplayActive || activeSceneFrame !== undefined;

  // P3 slice-2 B: coverage / fairness aggregation for the modqn-replay-proof lane.
  // Display-only — reads the producer served/starved truth baked into the recorded
  // window and aggregates it (win axis = coverage/served). Window stats memoize on
  // the artifact (96×100 aggregation once per load); the current-frame readouts
  // track playback via the full-ues replaySceneFrame (so they match the field's
  // green/red counts exactly). Gated to the recorded-proof lane so the artifact-
  // replay window (no coverage flags) never pays the aggregation.
  const coverageStats = useMemo(
    () =>
      isRecordedReplayLane && showcaseArtifact
        ? windowServedFractionStats(showcaseArtifact.timeline as readonly CoverageFrame[])
        : null,
    [isRecordedReplayLane, showcaseArtifact],
  );
  const currentCoverage = useMemo(
    () => (isRecordedReplayLane && replaySceneFrame ? currentFrameCoverage(replaySceneFrame) : null),
    [isRecordedReplayLane, replaySceneFrame],
  );
  const currentStarved = useMemo(
    () => (isRecordedReplayLane && replaySceneFrame ? countStarvedUes(replaySceneFrame.ues) : null),
    [isRecordedReplayLane, replaySceneFrame],
  );

  // P3 slice-2 D: the current arm's producer manifest, fetched read-only through
  // the same /modqn-bundles sceneOnly route (staged beside each window by
  // build-h2-scene-payload.mjs). Tiny (~2.8KB) so a plain per-arm fetch is fine;
  // fail-soft to null (the provenance chip shows a "not staged" note) when /tmp
  // was cleared. Display-only — surfaces producer provenance, never drives truth.
  const [replayManifest, setReplayManifest] = useState<ReplayArmManifest | null>(null);
  useEffect(() => {
    if (!isRecordedReplayLane) {
      setReplayManifest(null);
      return;
    }
    let cancelled = false;
    const manifestUrl = REPLAY_ARM_WINDOWS[replayArm].replace(
      'visual-showcase-v1.json',
      'manifest.json',
    );
    fetch(manifestUrl)
      .then(r => (r.ok ? (r.json() as Promise<ReplayArmManifest>) : null))
      .then(data => {
        if (!cancelled) setReplayManifest(data);
      })
      .catch(() => {
        if (!cancelled) setReplayManifest(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isRecordedReplayLane, replayArm]);

  // Sync replay frame state to SimState so InfoPanel/DiagnosticsDrawer reflect
  // the producer-truth playback cursor. We never recompute SINR or handover
  // truth here — we only forward producer values (R1).
  useEffect(() => {
    const replaySimState = createReplayPanelSimState({
      sceneSource,
      replaySceneFrame,
      elevatedUeId,
      showcaseArtifact,
      frameIndex,
    });
    if (replaySimState !== null) setSimState(replaySimState);
  }, [sceneSource, replaySceneFrame, elevatedUeId, showcaseArtifact, frameIndex]);

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
    // One global locale state for the whole shell: the left tuners, the centre
    // scene overlays, the right readout and every HelpPopover all consume the
    // same `useLocale()`, so the zh/EN switch in the top-right flips all of them
    // at once. Provider-less `useLocale()` still falls back to zh-TW, so any of
    // those components remains renderable in isolation under test.
    <LocaleProvider>
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
    <div
      data-app-mode={appMode}
      data-scene-lane={sceneLane}
      data-artifact-source={
        sceneSource === 'artifact-replay' ? (showcaseArtifactSource ?? 'pending') : undefined
      }
      data-director-phase={camera.directorPhase}
      data-effective-speed={playback.effectiveSpeed.toFixed(3)}
      data-live-director-focus-claim={directorFocusEnabled ? liveDirectorFocusClaimKind : undefined}
      data-live-director-focus-source-owner={directorFocusEnabled ? timelineRailDescriptor.rail.sourceOwner : undefined}
      data-live-director-focus-event-id={liveDirectorFocusEventId ?? undefined}
      data-live-director-focus-event-sec={liveDirectorFocusEventSec !== null ? liveDirectorFocusEventSec.toFixed(3) : undefined}
      data-timeline-current-time-sec={timelineCurrentTimeSec.toFixed(3)}
      data-timeline-duration-sec={timelineDurationSec.toFixed(3)}
      data-timeline-disabled={timelineDisabled ? 'true' : 'false'}
      data-timeline-source-owner={timelineRailDescriptor.timeline.sourceOwner}
      data-timeline-horizon-kind={timelineRailDescriptor.timeline.horizonKind}
      data-timeline-claim-kind={timelineRailDescriptor.timeline.claimKind}
      data-live-timeline-seek-target={liveTimelineSeekRequest?.targetSec.toFixed(3) ?? ''}
      data-live-timeline-seek-key={liveTimelineSeekRequest?.requestKey ?? ''}
      data-manual-handover-request-id={manualHandoverRequest?.id?.toString() ?? ''}
      data-manual-handover-kind={manualHandoverRequest?.kind ?? ''}
      data-topology-overrides-active={hasTopologyOverrides ? 'true' : 'false'}
      data-visual-scale-overrides-active={hasVisualScaleOverrides ? 'true' : 'false'}
      data-visual-scale-key={sceneVisualScaleResetKey}
      className="leo-app-shell"
    >
      {sceneSource === 'artifact-replay' && (
        <ArtifactSourceBadge source={showcaseArtifactSource} />
      )}
      {/* Top row: the global display controls on the left, the global zh/EN
          language switch pinned to the right.

          The switch shares this row rather than floating over the viewport on
          its own `position: fixed` layer. The quick-control row is the topmost
          full-width band on every lane, so the last slot in it *is* the screen's
          top-right corner — and because both children are real flex items, the
          switch can never overlap the controls (they reflow/wrap around it)
          and never sits on top of the 3D canvas, the timeline, the handover
          toast layer or the Advanced modal. `align-items: flex-start` keeps the
          switch parked at the top even when the control row wraps to two lines
          on a narrow viewport. */}
      <div
        data-testid="leo-global-top-row"
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          minWidth: 0,
        }}
      >
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
      {/* Global display-control row (beam info / other beams / spotlight / HO slow):
          these toggle beamDisplaySpec + camera + playback, which apply on every
          lane — shown on SINR and MODQN alike, not lane-gated. */}
      <SinrLiveQuickControls
        beamCalloutsEnabled={beamDisplaySpec.beamCalloutsEnabled}
        showNonServingCones={beamDisplaySpec.showNonServingCones}
        showOtherHandoverUes={beamDisplaySpec.showOtherHandoverUes}
        cinematicMode={effectiveCinematicMode}
        autoSlowEnabled={playback.autoSlowEnabled}
        effectiveSpeed={playback.effectiveSpeed}
        autoSlowActive={playback.autoSlowActive}
        autoSlowApplied={playback.autoSlowApplied}
        onToggleBeamCallouts={() => setBeamDisplaySpec(c => ({ ...c, beamCalloutsEnabled: !c.beamCalloutsEnabled }))}
        onToggleNonServingCones={() => setBeamDisplaySpec(c => ({ ...c, showNonServingCones: !c.showNonServingCones }))}
        onToggleOtherHandoverUes={() => setBeamDisplaySpec(c => ({ ...c, showOtherHandoverUes: !c.showOtherHandoverUes }))}
        onCinematicModeChange={camera.setCinematicMode}
        onToggleAutoSlow={playback.toggleAutoSlow}
        onDismissAutoSlow={playback.dismissAutoSlow}
        showHandoverJumpButtons={sceneSource === 'live-sim'}
        nextIntraEnabled={manualHandoverRequest === null && (sceneSource === 'live-sim'
          ? camera.directorPhase === 'idle'
          : directorNextIntraEnabled && camera.directorPhase === 'idle')}
        nextInterEnabled={manualHandoverRequest === null && (sceneSource === 'live-sim'
          ? camera.directorPhase === 'idle'
          : directorInterButtonEnabled && camera.directorPhase === 'idle')}
        nextIntraCount={sceneSource === 'live-sim'
          ? undefined
          : handoverRailEvents.filter(event => event.kind === 'intra').length}
        nextInterCount={sceneSource === 'live-sim'
          ? undefined
          : handoverRailEvents.filter(event => event.kind === 'inter').length}
        nextIntraMode={sceneSource === 'live-sim' ? 'real-trigger' : (directorIntraIndexedEnabled ? 'indexed' : 'real-trigger')}
        manualHandoverKind={sceneSource === 'live-sim' ? manualHandoverRequest?.kind ?? null : null}
        onNextIntra={() => requestManualHandover('intra')}
        onNextInter={() => requestManualHandover('inter')}
      />
      </div>
      <div
        data-testid="global-locale-toggle-slot"
        style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}
      >
        <LocaleToggle />
      </div>
      </div>
      {sceneLane !== 'sinr-live' && (
        <div className="leo-modqn-subnav-row">
          <ModqnViewToggle
            value={sceneLane}
            onChange={handleExperienceChange}
            proofEnabled={canToggleModqnReplayProof}
          />
        </div>
      )}
      {/* P3 slice-2: the a2↔b1 replay-arm toggle-slam. Only on the recorded
          proof lane; swaps which producer window the field displays (red sea ⇄
          all-green). Display-only — App owns the state, the fetch effect flips. */}
      {sceneLane === 'modqn-replay-proof' && (
        <div className="leo-modqn-replay-controls-row">
          <ReplayArmToggle arm={replayArm} onArmChange={setReplayArm} />
          <CoverageTopbar coverage={currentCoverage} />
        </div>
      )}
      <ControlBar
        sceneSource={sceneSource}
        sceneLane={sceneLane}
        ueDisplayCount={ueDisplayCount}
        maxUeCount={showcaseArtifact?.timeline[0]?.ues.length ?? 100}
        onUeDisplayCountChange={setUeDisplayCount}
        elevatedUeId={elevatedUeId}
        ueIds={showcaseArtifact?.timeline[0]?.ues.map(u => u.id) ?? []}
        onElevatedUeIdChange={setElevatedUeId}
      />
      <div
        className="leo-shell-row"
        data-left-sidebar-collapsed={leftSidebarCollapsed ? 'true' : 'false'}
      >
        <aside
          className="leo-shell-left"
          data-left-sidebar-state={leftSidebarCollapsed ? 'collapsed' : 'expanded'}
          aria-label="Signal tuning panel slot"
        >
          <button
            type="button"
            className="leo-left-sidebar-toggle"
            data-testid="left-sidebar-toggle"
            aria-controls="left-sidebar-content"
            aria-expanded={!leftSidebarCollapsed}
            aria-label={leftSidebarCollapsed ? 'Expand left sidebar' : 'Collapse left sidebar to the left'}
            title={leftSidebarCollapsed ? 'Expand left sidebar' : 'Collapse left sidebar to the left'}
            onClick={() => setLeftSidebarCollapsed(collapsed => !collapsed)}
          >
            <span className="leo-left-sidebar-toggle__icon" aria-hidden="true">
              {leftSidebarCollapsed ? '›' : '‹'}
            </span>
            <span className="modqn-offscreen">
              {leftSidebarCollapsed ? 'Expand left sidebar' : 'Collapse left sidebar'}
            </span>
          </button>
          <div id="left-sidebar-content" className="leo-left-sidebar-content">
            {/* The public experience switch is intentionally hidden; the default launch
                surface is SINR. The left rail then exposes only the inlined SINR tuners
                (or the internal MODQN evidence surface when a proof lane is opened). */}
          {sceneLane !== 'sinr-live' && (
          <SidebarTabShell
            label="Simulation control sidebar"
            side="left"
            tabs={visibleLeftSidebarTabs}
            activeKey={activeLeftSidebarTab}
            onChange={setLeftSidebarTab}
          >
            {activeLeftSidebarTab === 'evidence' ? (
              // S3 purpose-merge: the unified MODQN "Evidence / Replay" rail. The
              // artifact sub-view shows the producer source summary; the live +
              // proof sub-views show the MODQN replay decision-trace cue (which
              // also hosts the Proof viewport toggle).
              sceneLane === 'artifact-replay' ? (
                <section
                  className="leo-sidebar-content-stack"
                  aria-label="Artifact replay source status"
                  data-testid="artifact-replay-sidebar"
                  data-artifact-loaded={showcaseArtifact ? 'true' : 'false'}
                  data-artifact-loading={showcaseLoading ? 'true' : 'false'}
                  data-artifact-frame-index={String(frameIndex)}
                >
                  <div className="leo-replay-truth-summary" data-testid="artifact-replay-source-summary">
                    <strong>{showcaseArtifact?.scenario.title ?? 'Artifact replay'}</strong>
                    <span>{showcaseError ?? showcaseArtifact?.artifactId ?? 'loading visual-showcase-v1'}</span>
                  </div>
                  <div className="leo-replay-playback-status" data-testid="artifact-replay-playback-status">
                    t={currentTimeSec.toFixed(1)}s / {showcaseArtifact?.scenario.durationSec.toFixed(1) ?? '0.0'}s
                  </div>
                </section>
              ) : (
                <ModqnReplayCuePanel
                  appMode={appMode}
                  displayState={renderedModqnReplayDisplayState}
                  proofViewportActive={sceneLane === 'modqn-replay-proof'}
                  windowCue={windowReplayCue}
                  onProofViewportActiveChange={
                    canToggleModqnReplayProof ? setModqnReplayProofRequested : undefined
                  }
                />
              )
            ) : null}
          </SidebarTabShell>
          )}
          {sceneLane === 'modqn-live-cell-preview' && (
            <SceneTopologyPanel
              appMode={appMode}
              baseProfile={baseProfile}
              topology={sceneTopology}
              sceneVisualScale={sceneVisualScale}
              onTopologyChange={handleSceneTopologyChange}
              onSceneVisualScaleChange={setSceneVisualScale}
            />
          )}
          {/* S4/S5a: the MODQN setup/display-policy power tools live behind the
              Advanced drawer, so the default MODQN left surface stays Evidence /
              Replay without piling more controls into the top toolbar. */}
          {sceneLane !== 'sinr-live' && (
            <AdvancedSetupDrawer
              appMode={appMode}
              handoverMode={handoverMode}
              modqnVisualLayerPreset={modqnVisualLayerPreset}
              showDecisionPolicyControls={sceneLane === 'modqn-live-cell-preview'}
              simState={simState}
              onModqnVisualLayerPresetChange={setModqnVisualLayerPreset}
              onModqnDecisionPolicyChange={handleModqnDecisionPolicyChange}
            />
          )}
          {/* Homepage input rail. It owns every editable or fixed calculation
              parameter; final values are rendered from the same accepted frame
              in the right rail. */}
          {sceneLane === 'sinr-live' && (
            <SinrLiveDisplayDrawer
              parameterSection={
                <HomepageCanonicalControls
                  analysis={homepageCanonicalAnalysis}
                  activeTab={homepageCanonicalTab}
                  onActiveTabChange={setHomepageCanonicalTab}
                />
              }
            />
          )}
          </div>
        </aside>
        <main
          className="leo-shell-canvas"
          data-testid="leo-shell-canvas"
          data-handover-criterion={
            handoverMode === 'decision-overlay-on-live-sinr' ? 'decision-overlay-on-live-sinr' : 'sinr-offset'
          }
          data-scene-lane={sceneLane}
          onPointerDownCapture={() => {
            // Exit an active focus and cancel an armed-but-unfired one (ITEM #C).
            if (camera.directorPhase !== 'idle' || liveDirectorFocusEventSec !== null) {
              cancelPendingLiveFocus();
              camera.exitDirectorFocus();
            }
          }}
        >
          {sceneLane === 'modqn-live-cell-preview' && (
            <ModqnSceneHud
              appMode={appMode}
              simState={simState}
              bundleProvenanceKind={bundleProvenanceKind}
              sceneSource={sceneSource}
              modqnVisualLayerPreset={modqnVisualLayerPreset}
            />
          )}
          {handoverMode === 'omega-heuristic' && sceneLane === 'modqn-live-cell-preview' && <HeuristicNotPaperBanner />}
          <SinrOffsetExplainer
            candidate={handoverCinema.focusedCandidate}
            visible={handoverCinema.cinemaActive && sceneLane === 'sinr-live'}
          />
          {shouldRenderMainScene ? (
            <MainScene
              speed={playback.effectiveSpeed}
              paused={playback.paused}
              profile={effectiveProfile}
              runtime={runtime}
              visualScaleMultipliers={visualScaleMultipliers}
              sceneLane={sceneLane}
              onSimUpdate={handleSimUpdate}
              onLiveSeekLanded={handleLiveSeekLandedWithAnalysisReset}
              sceneFrame={activeSceneFrame}
              beamDisplaySpec={beamDisplaySpec}
            />
          ) : (
            <div
              className="leo-scene-fail-closed"
              data-testid="artifact-scene-fail-closed"
              data-scene-lane={sceneLane}
              data-artifact-loading={showcaseLoading ? 'true' : 'false'}
            >
              <strong>{showcaseError ?? 'Loading visual-showcase-v1 artifact'}</strong>
            </div>
          )}
          {sceneLane === 'artifact-replay' && replaySceneFrame && (
            <ArtifactSatelliteCompass satellites={replaySceneFrame.satellites} />
          )}
          {(directorCinematicEnabled || directorFocusEnabled) && (
            <CinematicSeekFadeOverlay
              pulseKey={cinematicFadePulse}
              reducedMotion={runtime.reducedMotion}
              onPeak={handleCinematicSeekPeak}
            />
          )}
          {timelineBar}
        </main>
        <aside className="leo-shell-right" aria-label="Signal status panel slot">
          {sceneLane === 'modqn-live-cell-preview' && <ServiceStatusBanner appMode={appMode} />}
          <SidebarTabShell
            label="Simulation status sidebar"
            side="right"
            tabs={visibleRightSidebarTabs}
            activeKey={activeRightSidebarTab}
            onChange={setRightSidebarTab}
          >
            {activeRightSidebarTab === 'artifact' ? (
              <section
                className="leo-sidebar-content-stack"
                aria-label="Artifact truth status"
                data-testid="artifact-truth-sidebar"
                data-artifact-loaded={showcaseArtifact ? 'true' : 'false'}
              >
                {activeSceneFrame ? (
                  <ClaimBoundaryBanner
                    frame={activeSceneFrame}
                    bundleProvenanceKind={bundleProvenanceKind}
                  />
                ) : null}
                {handoverEventRail}
                <div className="leo-replay-truth-summary" data-testid="artifact-truth-source-summary">
                  <strong>{showcaseArtifact?.scenario.truthMode ?? 'artifact truth'}</strong>
                  <span>{showcaseArtifact?.provenance.validation.status ?? showcaseError ?? 'loading'}</span>
                </div>
                {/* Per-frame MODQN decision metric tiles. The flowchart keeps the
                    full-area Dashboard view (it needs the width); these number-row
                    tiles read better co-visible with the 3D replay, so they live in
                    the artifact-replay sidebar. Display-only, lane-owned, reads the
                    same visual-showcase-v1 truth with per-tile provenance chips. */}
                <AlgorithmDashboard
                  artifact={showcaseArtifact}
                  frameIndex={frameIndex}
                  variant="sidebar"
                  content="metrics"
                />
              </section>
            ) : activeRightSidebarTab === 'live' ? (
              <section className="leo-live-status-stack" aria-label="Live status for current scene">
                {sceneLane === 'sinr-live' ? (
                  <HomepageCanonicalAnalysis
                    analysis={homepageCanonicalAnalysis}
                    activeTab={homepageCanonicalResultTab}
                  />
                ) : (
                  <InfoPanel
                    {...simState}
                    profile={effectiveProfile}
                    handoverMode={handoverMode}
                    showFormulaTerms
                    isFormulaEvidenceStale={staleFormulaEvidenceKey !== null}
                    channelMetricKind={activeSceneFrame?.channelMetricKind}
                  />
                )}
              </section>
            ) : (
              <section
                className="leo-modqn-sidebar-stack"
                aria-label="MODQN proof"
              >
                {/* P3 slice-2 B: the coverage/fairness headline for the recorded
                    proof lane — the win-axis (served 0.26 → 0.997) made legible.
                    Display-only; reads producer served/starved truth. */}
                {sceneLane === 'modqn-replay-proof' ? (
                  <>
                    <CoverageFairnessPanel
                      arm={replayArm}
                      stats={coverageStats}
                      currentCoverage={currentCoverage}
                      currentStarved={currentStarved}
                    />
                    <HonestyProvenancePanel arm={replayArm} manifest={replayManifest} />
                  </>
                ) : null}
                {userTrainedLoadError !== null ? (
                  <div
                    role="alert"
                    data-testid="load-into-scene-error-banner"
                    className="leo-load-into-scene-error-banner"
                  >
                    MODQN bundle load failed: {userTrainedLoadError}
                  </div>
                ) : null}
                <section
                  className="leo-modqn-family-b-mode"
                  aria-label="MODQN Family-B dense-Q proof mode"
                  data-testid="modqn-family-b-mode-selector"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '8px 10px',
                    border: '1px solid #4a3a12',
                    borderRadius: 6,
                    background: '#241d0a',
                  }}
                >
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      data-testid="load-family-b-dense-q"
                      data-active={modqnReplayEnvelope?.evidenceStatus === MODQN_FAMILY_B_DENSE_Q_EVIDENCE_STATUS ? 'true' : 'false'}
                      disabled={modqnReplayEnvelope?.evidenceStatus === MODQN_FAMILY_B_DENSE_Q_EVIDENCE_STATUS}
                      onClick={() => { void handleLoadFamilyBDenseQ(); }}
                    >
                      Load Family-B dense-Q proof
                    </button>
                    <button
                      type="button"
                      data-testid="revert-to-baseline-from-family-b"
                      disabled={modqnReplayEnvelope?.evidenceStatus !== MODQN_FAMILY_B_DENSE_Q_EVIDENCE_STATUS}
                      onClick={() => { void handleRevertToPaperFaithful(); }}
                    >
                      Back to baseline
                    </button>
                  </div>
                </section>
                <ArtifactPicker
                  appMode={appMode}
                  selectedJobId={selectedUserTrainedJobId}
                  bundleProvenanceKind={bundleProvenanceKind}
                  artifactReplaySource={showcaseArtifactSource}
                  onLoadEntry={handleLoadIntoScene}
                  onLoadPaperFaithful={handleRevertToPaperFaithful}
                />
                <RewardCurvePanel
                  envelope={modqnReplayEnvelope}
                  slotOffset={modqnReplaySlotOffset}
                  bundleProvenanceKind={bundleProvenanceKind}
                />
                <DecisionVizPanel
                  envelope={modqnReplayEnvelope}
                  slotOffset={modqnReplaySlotOffset}
                  bundleProvenanceKind={bundleProvenanceKind}
                />
              </section>
            )}
          </SidebarTabShell>
        </aside>
      </div>
      <TrainingTelemetryFeed enabled={appMode === 'modqn-demo'} />
    </div>
    </ModqnHandoverModeProvider>
    </ModqnEnvelopeProvider>
    </LocaleProvider>
  );
}
