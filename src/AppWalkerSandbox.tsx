import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useHandoverCinema } from './app/useHandoverCinema';
import { shouldSuppressInterSeekFade } from './scene/handoverDisplayIsolation';
import { createSinrLiveBeamDisplayFrame } from './scene/sinrLiveBeamDisplayFrame';
import { CinematicSeekFadeOverlay } from './ui/CinematicSeekFadeOverlay';
import { TimelineBar, type TimelineSpeedPreset } from './ui/TimelineBar';
import {
  HandoverEventRail,
  type HandoverRailEvent,
} from './ui/HandoverEventRail';
import { InfoPanel } from './ui/InfoPanel';
import { SidebarTabShell } from './ui/SidebarTabShell';
import { HomepageCanonicalControls } from './ui/signal-tuning/HomepageCanonicalControls';
import { HomepageCanonicalServingComparison } from './ui/signal-tuning/HomepageCanonicalServingComparison';
import { HomepageRightRail } from './ui/signal-tuning/HomepageRightRail';
import { SignalTuningPanel } from './ui/SignalTuningPanel';
import { WalkerResultsRail } from './ui/signal-tuning/WalkerResultsRail';
import { useHomepageCanonicalAnalysis } from './ui/signal-tuning/useHomepageCanonicalAnalysis';
import type { MainTabKey } from './ui/signal-tuning/types';
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
import { buildNonOverlappingIntraPresentationSlots } from './scene/handoverPresentationSchedule';
import { ClaimBoundaryBanner } from './ui/ClaimBoundaryBanner';
import {
  ArtifactSourceBadge,
  PRODUCER_PINNED_SOURCE,
  SYNTHETIC_FIXTURE_SOURCE,
  HEADER_ABSENT_SOURCE,
} from './ui/ArtifactSourceBadge';
import { ArtifactSatelliteCompass } from './ui/ArtifactSatelliteCompass';
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
  resolveHomepageInitialRuntimeState,
  type InitialRuntimeState,
  type LeftSidebarTab,
  type RightSidebarTab,
} from './app/appRuntimeModel';
import {
  envAxesFromTrainingRunMetadata,
  seedTripletFromTrainingRunMetadata,
} from './app/trainingEnvAxesProfileAdapter';
import {
  type WalkerSignalProfileInput,
} from './app/walkerSignalProfile';
import {
  APP_EPOCH_MS,
  LIVE_SIM_TIMELINE_DURATION_SEC,
  buildAppRuntimeConfig,
} from './app/appRuntimeConfig';
import {
  clampTimelineTime,
  createArchivedTleRunTimelineDescriptor,
  getModqnProducerTraceRange,
  resolveTimelineRailDescriptor,
} from './app/timelineRailAuthority';
import { resolveWalkerHandoverRailSeek } from './app/walkerHandoverRailSeek';
import { canRequestWalkerIntraDemo } from './app/walkerIntraDemoAdmission';
import { resolveWalkerTimelineSeek } from './app/walkerTimelineSeek';
import { advanceArchivedTlePlaybackCursor } from './app/archivedTlePlayback';
import {
  liveWalkerHandoverEventIndexToRailEvents,
  selectDirectorHandoverEvents,
} from './app/liveWalkerHandoverRailAdapter';
import {
  type WalkerHandoverRailSelectionInput,
} from './app/walkerHandoverRailSelection';
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
import type { HandoverPresentationSnapshot } from './scene/handoverPresentationOwner';
import { useCameraControls } from './useCameraControls';
// --- /walker sandbox-only imports below. These power the temporary
// /simulator-style left-sidebar reference column grafted in for the "/"
// left-sidebar redesign; they are not used by the live App.tsx.
import { useVisualLabSession } from './visualLab/session';
import {
  DEFAULT_VISUAL_LAB_INPUTS,
  type VisualLabInputKey,
  type VisualLabInputValues,
} from './visualLab/experiment';
import {
  VisualLabProgressiveControlDock,
  type VisualLabUeGeometryControls,
} from './prototype/visual-lab-g0/VisualLabProgressiveControlDock';
import {
  VISUAL_LAB_MODULES,
  moduleDefinition,
  moduleShortLabel,
  type VisualLabModuleKey,
} from './prototype/visual-lab-g0/visualLabWorkspace';
import type { VisualLabFocus, VisualLabView } from './prototype/visual-lab-g0/VisualLabScene';
import {
  radiansFromDegrees,
} from './prototype/visual-lab-g0/visualLabUeGeometry';
import {
  positionForWalkerVisualLabUeAngle,
} from './app/walkerVisualLabUeGeometry';
import { buildWalkerVisualLabUeGeometryInput } from './app/walkerVisualLabUeGeometryInput';
import type { WalkerIntraTeachingDisplayInput } from './app/walkerIntraTeachingDisplay';
import { focusForVisualLabInput } from './prototype/visual-lab-g0/visualLabInputFocus';
import './prototype/visual-lab-g0/UnifiedVisualLabPrototype.scss';
import './AppWalkerSandboxReskin.scss';
import { useWalkerVisualLabGeometry } from './app/useWalkerVisualLabGeometry';
import { useWalkerSignalProfile } from './app/useWalkerSignalProfile';
import { useWalkerHandoverRail } from './app/useWalkerHandoverRail';
import { useWalkerIntraTeachingDisplay } from './app/useWalkerIntraTeachingDisplay';

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

// Sandbox-only: sidebar 2 keeps SignalTuningPanel's real "main tab" buttons
// (they own the actual tab state -- SignalTuningPanel is uncontrolled), but
// that native tab row is hidden (see AppWalkerSandboxReskin.scss) and
// replaced by this icon nav in the same vlab-sidebar-modules layout as
// sidebar 1. Selecting an icon here forwards a real click to the hidden
// native button by id, so SignalTuningPanel's own state (and everything it
// renders below) keeps working unmodified -- content is untouched, only the
// switcher's presentation changes. Symbols reuse the exact glyphs
// /simulator already assigns these concepts in visualLabWorkspace.ts
// (VISUAL_LAB_MODULES + VISUAL_LAB_RESULT_MODULES: TLE / gamma / R / P / eta).
type SandboxSidebar2Tab = 'scenario' | 'sinr' | 'throughput' | 'power' | 'energy';
const SANDBOX_SIDEBAR2_MODULES: readonly { readonly key: SandboxSidebar2Tab; readonly symbol: string; readonly label: string }[] = [
  { key: 'scenario', symbol: 'TLE', label: 'Scenario' },
  { key: 'sinr', symbol: 'γ', label: 'SINR' },
  { key: 'throughput', symbol: 'R', label: 'Throughput' },
  { key: 'power', symbol: 'P', label: 'Power' },
  { key: 'energy', symbol: 'η', label: 'EE' },
];

// Sandbox-only toggle: while comparing just the two left sidebars, drop the
// center scene and right rail from the layout entirely. Flip back to false to
// see the full four-column shell again.
const SANDBOX_HIDE_CANVAS_AND_RIGHT_RAIL = true;

export function AppWalkerSandbox() {
  // `/` is the original public Walker surface. `/legacy` and `/walker` remain
  // explicit aliases so old bookmarks and comparison screenshots keep working;
  // `/simulator` now serves the unified Visual Lab route.
  // This restores the pre-canonical Walker scene and its formula/tuning shell
  // without forking the renderer or the simulation engine.
  // Keep this as a route-level presentation choice; it must not fork the renderer
  // or duplicate the simulation engine.
  const isLegacyWalkerRoute = typeof window !== 'undefined'
    && (
      window.location.pathname === '/'
      || window.location.pathname === '/legacy'
      || window.location.pathname === '/walker'
    );
  const [sceneSource, setSceneSource] = useState<SceneSourceMode>(() => (
    isLegacyWalkerRoute ? 'live-sim' : readSceneSourceFromUrl()
  ));
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
    readonly origin: 'button' | 'scheduled';
    readonly intraPresentation: SimState['intraHandoverPresentation'];
  } | null>(null);
  // The presentation owner is advanced inside MainScene's render, while the
  // cinema/control state is owned by App. Keep their locks separate and derive
  // one admission flag; a later App render must never overwrite the child
  // owner's render-time lock with a stale `false`.
  const handoverPresentationBusyRef = useRef(false);
  const handoverControlBusyRef = useRef(false);
  const handoverBusyRef = useRef(false);
  const manualHandoverWasPausedRef = useRef(false);

  const currentTimeSecRef = useRef(0);
  // ITEM #C live Director focus: the absolute live sim cursor (set in
  // handleSimUpdate) used by useDirectorOrchestration as "now" when resolving the
  // next handover event + the seek direction. The deferred-focus state machine
  // itself lives in the hook (P3 extraction).
  const liveSimTimeSecRef = useRef(0);
  const initialRuntimeRef = useRef<InitialRuntimeState | null>(null);
  if (initialRuntimeRef.current === null) {
    initialRuntimeRef.current = resolveHomepageInitialRuntimeState(readInitialRuntimeState());
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
  const signalProfileInput = useMemo<WalkerSignalProfileInput>(() => ({
    baseProfile,
    signalTuning,
    selectedTrainingEnvAxes,
    selectedTrainingSeedTriplet,
    activeSceneTopology,
  }), [
    activeSceneTopology,
    baseProfile,
    selectedTrainingEnvAxes,
    selectedTrainingSeedTriplet,
    signalTuning,
  ]);
  const { signalTunedProfile } = useWalkerSignalProfile({ signalProfileInput });
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
    manualHandoverOrigin: manualHandoverRequest?.origin,
    manualHandoverStartedAtMs: manualHandoverRequest?.startedAtMs,
    manualHandoverSourceSatId: manualHandoverRequest?.intraPresentation?.sourceSatId,
    manualHandoverSourceCellId: manualHandoverRequest?.intraPresentation?.sourceCellId,
    manualHandoverTargetCellId: manualHandoverRequest?.intraPresentation?.targetCellId,
    manualHandoverServingSinrDb: manualHandoverRequest?.intraPresentation?.servingSinrDb,
    manualHandoverCandidateSinrDb: manualHandoverRequest?.intraPresentation?.candidateSinrDb,
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
  const walkerBeamDisplayFrame = useMemo(() => createSinrLiveBeamDisplayFrame({
    profile: effectiveProfile,
    runtime,
    servingSatelliteId: simState.physicalServing.satId,
    candidateSatelliteId: simState.pendingTargetSatId ?? simState.comparisonSatId,
  }), [
    effectiveProfile,
    runtime,
    simState.comparisonSatId,
    simState.pendingTargetSatId,
    simState.physicalServing.satId,
  ]);
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
  const [visibleHandover, setVisibleHandover] = useState<{
    readonly active: boolean;
    readonly kind: 'intra' | 'inter' | null;
    readonly source: 'walker' | 'tle' | 'manual' | 'cinema' | null;
    readonly mode: 'idle' | 'presenting' | 'cooldown';
    readonly cooldownUntilMs: number;
  }>({ active: false, kind: null, source: null, mode: 'idle', cooldownUntilMs: 0 });
  const visibleHandoverActive = visibleHandover.active;
  const visibleHandoverBusy = visibleHandover.mode === 'presenting'
    || (visibleHandover.mode === 'cooldown'
      && (typeof performance === 'undefined' ? Date.now() : performance.now()) < visibleHandover.cooldownUntilMs);
  const visibleManualHandoverActive = visibleHandover.active && visibleHandover.source === 'manual';
  const handleHandoverPresentationChange = useCallback((snapshot: HandoverPresentationSnapshot) => {
    setVisibleHandover(current => {
      const { view } = snapshot;
      const next = {
        // Keep the full owner envelope active through the settled tail. HO
        // Slow and the control lock must not release while the story is still
        // visible, otherwise a high playback rate can outrun the inter latch.
        active: view.active,
        kind: view.event?.kind ?? null,
        source: view.event?.source ?? null,
        mode: snapshot.mode,
        cooldownUntilMs: snapshot.cooldownUntilMs,
      } as const;
      return current.active === next.active
        && current.kind === next.kind
        && current.source === next.source
        && current.mode === next.mode
        && current.cooldownUntilMs === next.cooldownUntilMs
        ? current
      : next;
    });
  }, []);
  const handleHandoverPresentationBusyChange = useCallback((busy: boolean) => {
    // This is intentionally ref-only. MainScene invokes it during its render so
    // the parent automatic-intra effect observes the same owner state without
    // waiting for the child effect that mirrors the visible snapshot.
    handoverPresentationBusyRef.current = busy;
    handoverBusyRef.current = busy || handoverControlBusyRef.current;
  }, []);
  const playback = usePlaybackControls(
    simState,
    camera.directorFocusActive,
    visibleHandoverActive,
  );
  const resetAnalysisWindow = useCallback(() => {
    setMeasurementResetEpoch(epoch => epoch + 1);
  }, []);

  const requestMovingIntraDemo = useCallback((origin: 'button' | 'scheduled' = 'button'): boolean => {
    const presentation = simState.intraHandoverPresentation;
    if (!canRequestWalkerIntraDemo({
      presentation,
      manualHandoverActive: manualHandoverRequest !== null,
      visibleHandoverActive: visibleHandover.active,
      handoverBusy: handoverBusyRef.current,
    })) return false;
    manualHandoverWasPausedRef.current = playback.paused;
    // The display-only fallback must keep the source timeline running so the
    // source satellite and its beam apex continue to move during the cue.
    playback.setPaused(false);
    manualHandoverRequestSeqRef.current += 1;
    setManualHandoverRequest({
      id: manualHandoverRequestSeqRef.current,
      kind: 'intra',
      startedAtMs: typeof performance === 'undefined' ? Date.now() : performance.now(),
      origin,
      intraPresentation: presentation,
    });
    return true;
  }, [manualHandoverRequest, playback, simState.intraHandoverPresentation, visibleHandover.active]);

  // The fallback is a display-only same-satellite beam-switch cue. It runs on the
  // moving source timeline, then returns to the exact pre-click playback state
  // without adding anything to the natural handover event index.
  useEffect(() => {
    if (manualHandoverRequest === null) return;
    const requestId = manualHandoverRequest.id;
    const timerId = window.setTimeout(() => {
      setManualHandoverRequest(current => current?.id === requestId ? null : current);
      if (manualHandoverWasPausedRef.current) playback.setPaused(true);
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
  // Scene topology edits rebuild the constellation, but the selected value must
  // commit immediately so a controlled radio cannot be overwritten by the live
  // frame publisher while the rebuild is pending.
  const handleSignalTuningChange = useCallback((next: SignalTuningState) => {
    setStaleFormulaEvidenceKey(getSignalTuningEvidenceKey(next));
    setSignalTuning(next);
  }, []);

  const handleSceneTopologyChange = useCallback((next: SceneTopologyState) => {
    setSceneTopology(next);
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
    // The canonical SINR/TLE homepage does not consume MODQN replay evidence.
    // Do not trigger its dev-server export path behind an unrelated workspace;
    // it can block archived-TLE requests and makes the visible homepage depend
    // on a backend surface that is neither displayed nor used by its formulas.
    if (sceneSource === 'artifact-replay' || appMode !== 'modqn-demo') return;

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
  }, [appMode, sceneSource]);

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
            beamCountBySatellite: runtime.beamCountBySatellite,
            servingBeamCount: runtime.servingBeamCount,
            candidateBeamCount: runtime.candidateBeamCount,
            beamHoppingEnabled: runtime.beamHoppingEnabled,
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
    runtime.beamCountBySatellite,
    runtime.servingBeamCount,
    runtime.candidateBeamCount,
    runtime.beamHoppingEnabled,
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
  const liveWalkerDirectorHandoverRailEvents = useMemo(() => {
    if (liveWalkerHandoverEventIndex === null) return [];
    return liveWalkerHandoverEventIndexToRailEvents({
      ...liveWalkerHandoverEventIndex,
      events: selectDirectorHandoverEvents(
        liveWalkerHandoverEventIndex,
        liveWalkerHandoverEventIndex.events,
      ),
    });
  }, [liveWalkerHandoverEventIndex]);
  const automaticIntraPresentationSlots = useMemo(() => {
    if (
      !isLegacyWalkerRoute
      || sceneSource !== 'live-sim'
      || sceneLane !== 'sinr-live'
      || liveWalkerHandoverEventIndex === null
    ) return [];
    return buildNonOverlappingIntraPresentationSlots({
      interEventTimesSec: liveWalkerDirectorHandoverRailEvents
        .filter(event => event.kind === 'inter')
        .map(event => event.sourceTimeSec ?? event.timeSec),
      // Leave a short quiet lead-in after the warm-start frame so the first
      // automatic cue does not fire on the same render as scene entry.
      startSec: demoStartOffset + 60,
      endSec: LIVE_SIM_TIMELINE_DURATION_SEC,
    });
  }, [
    demoStartOffset,
    isLegacyWalkerRoute,
    liveWalkerDirectorHandoverRailEvents,
    liveWalkerHandoverEventIndex,
    sceneLane,
    sceneSource,
  ]);
  const automaticIntraScheduleRef = useRef<{ nextIndex: number; lastSimTimeSec: number | null }>({
    nextIndex: 0,
    lastSimTimeSec: null,
  });
  useEffect(() => {
    const scheduleState = automaticIntraScheduleRef.current;
    if (automaticIntraPresentationSlots.length === 0) {
      scheduleState.nextIndex = 0;
      scheduleState.lastSimTimeSec = null;
      return;
    }
    const currentTimeSec = simState.simTimeSec;
    if (
      !Number.isFinite(currentTimeSec)
      || (scheduleState.lastSimTimeSec !== null && currentTimeSec < scheduleState.lastSimTimeSec - 1)
    ) {
      scheduleState.nextIndex = 0;
    }
    while (
      scheduleState.nextIndex < automaticIntraPresentationSlots.length
      && automaticIntraPresentationSlots[scheduleState.nextIndex]!.endSec < currentTimeSec
    ) {
      scheduleState.nextIndex += 1;
    }
    const slot = automaticIntraPresentationSlots[scheduleState.nextIndex];
    if (
      slot !== undefined
      && currentTimeSec >= slot.startSec
      && currentTimeSec <= slot.endSec
      && (requestMovingIntraDemo('scheduled') || handoverBusyRef.current)
    ) {
      // A blocked slot is a stale teaching reservation, not a queue. Skipping
      // it prevents an intra cue from being replayed immediately after an
      // inter story releases the wall-clock owner.
      scheduleState.nextIndex += 1;
    }
    scheduleState.lastSimTimeSec = currentTimeSec;
  }, [automaticIntraPresentationSlots, requestMovingIntraDemo, simState.simTimeSec]);
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
      return ['Source gap: live-scene handover event index is not ready.'] as const;
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
  const archivedTleTimelineDescriptor = useMemo(
    () => createArchivedTleRunTimelineDescriptor({
      runReady: homepageCanonicalAnalysis.runReady ?? false,
      durationSec: homepageCanonicalAnalysis.timelineDurationSec ?? 7200,
      currentTimeSec: homepageCanonicalAnalysis.timelineCurrentTimeSec ?? 0,
      stepSec: homepageCanonicalAnalysis.timelineStepSec ?? 30,
    }),
    [
      homepageCanonicalAnalysis.runReady,
      homepageCanonicalAnalysis.timelineCurrentTimeSec,
      homepageCanonicalAnalysis.timelineDurationSec,
      homepageCanonicalAnalysis.timelineStepSec,
    ],
  );
  // The homepage's visible timeline is a fully materialized archived-TLE run.
  // Other lanes retain the existing Walker/artifact/proof authority unchanged.
  const activeTimelineDescriptor = sceneLane === 'sinr-live' && !isLegacyWalkerRoute
    ? archivedTleTimelineDescriptor
    : timelineRailDescriptor.timeline;
  const timelineDurationSec = activeTimelineDescriptor.durationSec;
  const timelineCurrentTimeSec = activeTimelineDescriptor.currentTimeSec;
  const archivedTleTimelineCurrentTimeRef = useRef(timelineCurrentTimeSec);
  archivedTleTimelineCurrentTimeRef.current = timelineCurrentTimeSec;
  const archivedTleSelectTimelineTimeRef = useRef<((targetSec: number) => void) | undefined>(
    homepageCanonicalAnalysis.selectTimelineTimeSec,
  );
  archivedTleSelectTimelineTimeRef.current = homepageCanonicalAnalysis.selectTimelineTimeSec;
  const timelineDisabled = manualHandoverRequest !== null
    || (sceneLane === 'sinr-live' && !isLegacyWalkerRoute
      ? !(homepageCanonicalAnalysis.runReady ?? false)
      : sceneSource === 'artifact-replay'
      ? replayController === null || showcaseLoading || showcaseError !== null
      : timelineDurationSec <= 0);

  // Archived-TLE homepage playback advances only inside the already-published
  // two-hour run. The lower/upper 30-second SGP4 anchors bracket a continuous
  // display interpolation; no browser-time propagation or uncomputed seek is
  // introduced. All other lanes keep their existing transport loops.
  useEffect(() => {
    if (
      sceneLane !== 'sinr-live'
      || isLegacyWalkerRoute
      || !(homepageCanonicalAnalysis.runReady ?? false)
      || playback.paused
      || timelineDurationSec <= 0
      || typeof window === 'undefined'
    ) {
      return;
    }

    const initialTimeSec = archivedTleTimelineCurrentTimeRef.current;
    if (initialTimeSec >= timelineDurationSec) {
      playback.setPaused(true);
      return;
    }

    let lastTimeMs = performance.now();
    // React may batch the anchor-state update for several RAF callbacks. Keep
    // a local source-time cursor so playback still advances between commits;
    // the ref is consulted only to detect an external scrub/anchor jump.
    let playbackCursorSec = initialTimeSec;
    let lastRequestedTimeSec = initialTimeSec;
    let lastPublishedAtMs = lastTimeMs;
    let frameId = 0;
    const tick = (nowMs: number): void => {
      const deltaSec = Math.max(0, (nowMs - lastTimeMs) / 1000);
      lastTimeMs = nowMs;
      const externallySelectedSec = archivedTleTimelineCurrentTimeRef.current;
      if (Math.abs(externallySelectedSec - lastRequestedTimeSec) >= 15) {
        playbackCursorSec = externallySelectedSec;
      }
      playbackCursorSec = advanceArchivedTlePlaybackCursor({
        currentTimeSec: playbackCursorSec,
        deltaSec,
        selectedSpeed: playback.speed,
        durationSec: timelineDurationSec,
      });
      lastRequestedTimeSec = playbackCursorSec;
      archivedTleTimelineCurrentTimeRef.current = playbackCursorSec;
      const targetSec = Math.min(
        playbackCursorSec,
        timelineDurationSec,
      );
      // Twenty UI publications per wall-clock second keep the centre visually
      // continuous without forcing the entire App tree through a 60 Hz React
      // render loop. The TLE positions themselves remain bracketed by the
      // completed 30-second SGP4 anchors.
      if (nowMs - lastPublishedAtMs >= 50 || targetSec >= timelineDurationSec) {
        lastPublishedAtMs = nowMs;
        archivedTleSelectTimelineTimeRef.current?.(targetSec);
      }
      if (targetSec >= timelineDurationSec) {
        playback.setPaused(true);
        return;
      }
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [
    homepageCanonicalAnalysis.runReady,
    playback.speed,
    playback.paused,
    playback.setPaused,
    isLegacyWalkerRoute,
    sceneLane,
    timelineDurationSec,
  ]);

  const handoverRailSelectionInput = useMemo<WalkerHandoverRailSelectionInput>(() => ({
    scene: { sceneSource, sceneLane },
    events: {
      artifact: artifactHandoverRailEvents,
      liveObserved: liveObservedHandoverRailEvents,
      liveWalker: liveWalkerHandoverRailEvents,
      modqn: modqnHandoverRailEvents,
    },
  }), [
    artifactHandoverRailEvents,
    liveObservedHandoverRailEvents,
    liveWalkerHandoverRailEvents,
    modqnHandoverRailEvents,
    sceneLane,
    sceneSource,
  ]);
  const { handoverRailEvents } = useWalkerHandoverRail({ handoverRailSelectionInput });

  const requestLiveTimelineSeek = useCallback((request: LiveTimelineSeekRequest) => {
    // The archived-TLE homepage has no live Walker seek path. Keep every
    // caller (including the legacy Director wrapper) on the same published
    // anchor selector so it cannot accidentally rebase the live simulator.
    if (sceneLane === 'sinr-live' && !isLegacyWalkerRoute) {
      if (homepageCanonicalAnalysis.runReady ?? false) {
        homepageCanonicalAnalysis.selectTimelineTimeSec?.(request.targetSec);
      }
      return;
    }
    resetAnalysisWindow();
    setLiveTimelineSeekRequest(request);
  }, [homepageCanonicalAnalysis, isLegacyWalkerRoute, resetAnalysisWindow, sceneLane]);

  const handleTimelineSeek = useCallback((targetSec: number) => {
    const resolution = resolveWalkerTimelineSeek({
      scene: {
        lane: sceneLane,
        source: sceneSource,
        isLegacyWalkerRoute,
      },
      targetSec,
      timeline: {
        durationSec: timelineDurationSec,
        axisKind: timelineRailDescriptor.timeline.axisKind,
        axisDurationSec: timelineRailDescriptor.timeline.axisDurationSec,
      },
      rail: {
        axisDurationSec: timelineRailDescriptor.rail.axisDurationSec,
      },
      live: {
        windowStartSec: liveTimelineWindowStartSec,
        durationSec: LIVE_SIM_TIMELINE_DURATION_SEC,
      },
    });

    if (resolution.kind === 'archived-tle') {
      if (homepageCanonicalAnalysis.runReady ?? false) {
        homepageCanonicalAnalysis.selectTimelineTimeSec?.(resolution.targetSec);
      }
      return;
    }
    if (resolution.kind === 'artifact-replay') {
      resetAnalysisWindow();
      replayController?.seek(resolution.targetSec);
      return;
    }
    if (resolution.kind === 'display-stretched') {
      resetAnalysisWindow();
      setModqnReplayVisualElapsedSec(resolution.targetSec);
      return;
    }
    if (resolution.kind === 'modqn-replay-proof') {
      resetAnalysisWindow();
      setModqnReplayVisualElapsedSec(resolution.targetSec);
      return;
    }

    // The visible live timeline starts at the profile's demo offset, but its
    // source horizon still ends at the 7200s Walker cache boundary. The pure
    // resolver clamps this source target so the rightmost jump cannot wrap the
    // live loop back to the demo start.
    requestLiveTimelineSeek({
      targetSec: resolution.sourceTargetSec,
      requestKey: `${resolution.sourceTargetSec.toFixed(3)}:${Date.now().toString(36)}`,
    });
    setLiveObservedHandoverRailEvents([]);
    setModqnReplayVisualElapsedSec(resolution.visualTargetSec);
  }, [
    resetAnalysisWindow,
    homepageCanonicalAnalysis,
    isLegacyWalkerRoute,
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
    () => directorFocusEnabled
      && handoverRailEvents.some(event => event.kind === 'inter')
      && liveWalkerDirectorHandoverRailEvents.some(event => event.kind === 'inter'),
    [directorFocusEnabled, handoverRailEvents, liveWalkerDirectorHandoverRailEvents],
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
  // The next-event buttons prefer the source-backed index. If the current static
  // window has no same-satellite row (or the index is rebuilding), keep the action
  // live through the same real UE-jog path used by Trigger Intra. This keeps the
  // Director and quick-control surfaces semantically identical on the legacy entry.
  const directorInterButtonEnabled = directorInterEnabled || directorCinematicInterEnabled;
  const directorIntraIndexedEnabled =
    directorCinematicIntraEnabled
    || (directorFocusEnabled
      && liveWalkerDirectorHandoverRailEvents.some(event => event.kind === 'intra'));
  const liveIntraFallbackEnabled = sceneSource === 'live-sim';
  const directorNextIntraEnabled = directorIntraIndexedEnabled || liveIntraFallbackEnabled;
  const directorIntraTriggerEnabled = liveIntraFallbackEnabled;

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
    liveWalkerHandoverRailEvents: liveWalkerDirectorHandoverRailEvents,
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
  const handoverControlBusy = visibleHandoverBusy
    || manualHandoverRequest !== null
    || camera.directorPhase !== 'idle'
    || liveDirectorFocusEventId !== null
    || liveDirectorFocusEventSec !== null;
  const handoverCinema = useHandoverCinema({
    sceneLane,
    handoverEventIndex: liveWalkerHandoverEventIndex,
    focusedEventId: liveDirectorFocusEventId,
    directorPhase: camera.directorPhase,
    presentationBusy: handoverControlBusy,
    armIntraFocus: handleDirectorIntraFocus,
    armInterFocus: handleDirectorInterFocus,
    exitFocus: useCallback(() => {
      cancelPendingLiveFocus();
      camera.exitDirectorFocus();
    }, [cancelPendingLiveFocus, camera]),
  });
  // `requestMovingIntraDemo` is declared before the Director hook so the
  // automatic timeline effect can use it. Merge the App-owned control lock with
  // the MainScene render-time presentation lock; do not overwrite one with the
  // other between React render/commit phases.
  handoverControlBusyRef.current = handoverControlBusy;
  handoverBusyRef.current = handoverControlBusy || handoverPresentationBusyRef.current;

  const triggerPrimaryIntra = useCallback(() => {
    if (handoverBusyRef.current) return;
    // Keep the real jog seek-free. A timeline seek rebases the model before it can
    // compare the old/new serving cells, which removes the very pulse this button
    // exists to make visible.
    setPrimaryUeJogKm(prev => (prev.east === 0 ? { east: 28, north: 0 } : { east: 0, north: 0 }));
  }, []);
  const handleDirectorNextIntra = useCallback(() => {
    if (handoverBusyRef.current) return;
    if (directorIntraIndexedEnabled) {
      handoverCinema.armIntra();
      return;
    }
    // Current static cell-truth has no natural intra rows. The fallback is still a
    // real engine event, not a fabricated rail marker, and the scene's wall-clock
    // latch keeps the same-satellite beam-shade transition visible.
    if (liveIntraFallbackEnabled) triggerPrimaryIntra();
  }, [directorIntraIndexedEnabled, handoverCinema.armIntra, liveIntraFallbackEnabled, triggerPrimaryIntra]);
  const handleQuickIntra = useCallback(() => {
    if (handoverBusyRef.current) return;
    if (directorIntraIndexedEnabled) {
      handoverCinema.armIntra();
      return;
    }
    if (liveIntraFallbackEnabled) triggerPrimaryIntra();
  }, [directorIntraIndexedEnabled, handoverCinema.armIntra, liveIntraFallbackEnabled, triggerPrimaryIntra]);
  const handleDirectorNextInter = useCallback(() => {
    if (handoverBusyRef.current) return;
    handoverCinema.armInter();
  }, [handoverCinema.armInter]);
  const handleQuickInter = useCallback(() => {
    if (handoverBusyRef.current) return;
    handoverCinema.armInter();
  }, [handoverCinema.armInter]);

  // While the explicit intra story is visible, latch the two measured links in
  // the right rail as well. The scene keeps moving, so reading the live frame
  // directly here would make the candidate card jump to a different cell before
  // the animation ends. This is a presentation snapshot only; formula evidence
  // and serving state remain the live model values.
  const intraTeachingDisplayInput = useMemo<WalkerIntraTeachingDisplayInput>(() => ({
    simState,
    visibleManualHandoverActive,
    manualHandoverKind: manualHandoverRequest?.kind ?? null,
    intraPresentation: manualHandoverRequest?.intraPresentation ?? null,
  }), [manualHandoverRequest, simState, visibleManualHandoverActive]);
  const { intraTeachingDisplayState } = useWalkerIntraTeachingDisplay({ intraTeachingDisplayInput });
  const intraTeachingComparisonCellId = visibleManualHandoverActive && manualHandoverRequest?.kind === 'intra'
    ? manualHandoverRequest.intraPresentation?.targetCellId ?? null
    : null;

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
    const resolution = resolveWalkerHandoverRailSeek({
      sceneLane,
      directorFocusEnabled,
      targetSec,
      railDurationSec: timelineRailDescriptor.rail.durationSec,
      liveTimelineWindowStartSec,
      timelineDurationSec,
    });
    if (resolution.kind === 'timeline') {
      handleTimelineSeek(resolution.targetSec);
      return;
    }
    if (resolution.kind === 'director-live') {
      requestLiveTimelineSeek({
        targetSec: resolution.sourceTargetSec,
        requestKey: `${resolution.sourceTargetSec.toFixed(3)}:${Date.now().toString(36)}`,
      });
      setLiveObservedHandoverRailEvents([]);
      setModqnReplayVisualElapsedSec(resolution.visualTargetSec);
      return;
    }
  }, [
    directorFocusEnabled,
    handleTimelineSeek,
    liveTimelineWindowStartSec,
    requestLiveTimelineSeek,
    sceneLane,
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
        nextIntraCount={directorIntraIndexedEnabled
          ? handoverRailEvents.filter(event => event.kind === 'intra').length
          : undefined}
        nextInterCount={handoverRailEvents.filter(event => event.kind === 'inter').length}
        phase={camera.directorPhase}
        onIntraTrigger={triggerPrimaryIntra}
        onIntraFocus={handleDirectorNextIntra}
        onInterFocus={handleDirectorNextInter}
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
      stepSec={sceneLane === 'sinr-live' && !isLegacyWalkerRoute ? (homepageCanonicalAnalysis.timelineStepSec ?? 30) : undefined}
      scrubStepSec={sceneLane === 'sinr-live' && !isLegacyWalkerRoute ? 1 : undefined}
      disabled={timelineDisabled}
      sourceOwner={activeTimelineDescriptor.sourceOwner}
      horizonKind={activeTimelineDescriptor.horizonKind}
      horizonLabel={activeTimelineDescriptor.horizonLabel}
      horizonSec={activeTimelineDescriptor.horizonSec}
      claimKind={activeTimelineDescriptor.claimKind}
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


  // === /walker sandbox-only: independent Visual Lab session ===============
  // Powers the reference left-sidebar column below. Deliberately its own
  // useVisualLabSession() instance -- it does not read or write any Walker
  // state above, so it cannot disturb the live "/" page or its own
  // still-in-flux left sidebar. Delete this whole block plus the
  // `leo-walker-sandbox-vlab-reference` <aside> once the redesign lands.
  const vlabRefSession = useVisualLabSession({ view: 'service', density: 'clean', focus: 'geometry' });
  const vlabRefLab = vlabRefSession.snapshot();
  const vlabRefInputs = vlabRefLab.draft.parameters as VisualLabInputValues;
  const vlabRefSnapshot = vlabRefLab.canonical;
  const vlabRefLocalScene = vlabRefLab.localScene;
  const vlabRefDraftSource = {
    constellation: vlabRefLab.draft.source.constellation,
    localDateTime: vlabRefLab.draft.source.taipeiDateTime || '2026-08-12T20:00',
  };
  const vlabRefDisplayAcceptedSource = vlabRefLab.accepted !== null
    ? {
      constellation: vlabRefLab.accepted.identity.constellation,
      localDateTime: vlabRefLab.accepted.identity.instantTaipei.slice(0, 16),
    }
    : { constellation: 'starlink' as const, localDateTime: '2026-08-12T20:00' };
  const vlabRefAcceptedSourceMatchesDraft = vlabRefLab.accepted !== null
    && vlabRefLab.accepted.identity.constellation === vlabRefLab.draft.source.constellation
    && vlabRefLab.accepted.identity.instantTaipei.slice(0, 16) === vlabRefLab.draft.source.taipeiDateTime;
  const vlabRefApplyingSource = vlabRefLab.draft.source.dirty === false
    && vlabRefLab.accepted !== null
    && !vlabRefAcceptedSourceMatchesDraft;
  const vlabRefSourceDirty = vlabRefLab.draft.source.dirty;
  const [vlabRefOpenModules, setVlabRefOpenModules] = useState<readonly VisualLabModuleKey[]>(['scene']);
  const [vlabRefActiveModule, setVlabRefActiveModule] = useState<VisualLabModuleKey>('scene');
  const [vlabRefSelectedUe, setVlabRefSelectedUe] = useState<{ readonly x: number; readonly z: number } | null>(null);
  const vlabRefUeRecomputeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (vlabRefUeRecomputeTimerRef.current !== null) clearTimeout(vlabRefUeRecomputeTimerRef.current);
  }, []);
  const vlabRefSetView = useCallback((next: VisualLabView): void => {
    void vlabRefSession.dispatch({ type: 'setView', view: next });
  }, [vlabRefSession]);
  const vlabRefSetFocus = useCallback((next: Exclude<VisualLabFocus, 'none'>): void => {
    void vlabRefSession.dispatch({ type: 'setFocus', focus: next });
  }, [vlabRefSession]);
  const vlabRefOpenModule = useCallback((module: VisualLabModuleKey): void => {
    setVlabRefOpenModules((current) => current.includes(module) ? current : [...current, module]);
    setVlabRefActiveModule(module);
    vlabRefSetFocus(moduleDefinition(module).focus);
  }, [vlabRefSetFocus]);
  const vlabRefUpdateInput = useCallback((key: VisualLabInputKey, value: number): void => {
    void vlabRefSession.dispatch({ type: 'editCanonicalParameter', key, value });
    vlabRefSetFocus(focusForVisualLabInput(key));
  }, [vlabRefSession, vlabRefSetFocus]);
  const vlabRefResetInput = useCallback((key: VisualLabInputKey): void => {
    vlabRefUpdateInput(key, DEFAULT_VISUAL_LAB_INPUTS[key]);
  }, [vlabRefUpdateInput]);
  const vlabRefApplySource = useCallback((): void => {
    void vlabRefSession.dispatch({ type: 'applySource' });
  }, [vlabRefSession]);
  const vlabRefScheduleUeRecompute = useCallback((userIndex: number, positionKm: readonly [number, number]): void => {
    if (vlabRefUeRecomputeTimerRef.current !== null) clearTimeout(vlabRefUeRecomputeTimerRef.current);
    vlabRefUeRecomputeTimerRef.current = setTimeout(() => {
      vlabRefUeRecomputeTimerRef.current = null;
      void vlabRefSession.dispatch({
        type: 'applyRepresentativeUeFrameOptions',
        frameOptions: {
          representativeUserIndex: userIndex,
          userPositionOverridesKm: [{ userIndex, positionKm }],
        },
      });
    }, 180);
  }, [vlabRefSession]);
  const vlabRefResetUeProbe = useCallback((): void => {
    if (vlabRefUeRecomputeTimerRef.current !== null) {
      clearTimeout(vlabRefUeRecomputeTimerRef.current);
      vlabRefUeRecomputeTimerRef.current = null;
    }
    setVlabRefSelectedUe(null);
    void vlabRefSession.dispatch({ type: 'resetRepresentativeUeFrameOptions' });
  }, [vlabRefSession]);
  const vlabRefUeGeometryInput = useMemo(
    () => buildWalkerVisualLabUeGeometryInput({
      snapshot: vlabRefSnapshot,
      localScene: vlabRefLocalScene,
      selectedUeWorldPosition: vlabRefSelectedUe,
    }),
    [vlabRefLocalScene, vlabRefSelectedUe, vlabRefSnapshot],
  );
  const { vlabRefUeGeometry } = useWalkerVisualLabGeometry({ vlabRefUeGeometryInput });
  const vlabRefUeGeometryControls: VisualLabUeGeometryControls | null = useMemo(() => {
    if (vlabRefUeGeometry === null) return null;
    const { angleInput, scale } = vlabRefUeGeometry;
    return {
      acceptedAngleDeg: vlabRefUeGeometry.acceptedAngleDeg,
      draftAngleDeg: vlabRefUeGeometry.draftAngleDeg,
      maxAngleDeg: vlabRefUeGeometry.maxAngleDeg,
      hasDraft: vlabRefUeGeometry.hasDraft,
      onAngleChange: (angleDeg: number): void => {
        const positionKm = positionForWalkerVisualLabUeAngle(vlabRefUeGeometry, radiansFromDegrees(angleDeg));
        setVlabRefSelectedUe({ x: positionKm[0] * scale, z: -positionKm[1] * scale });
        vlabRefScheduleUeRecompute(vlabRefUeGeometry.representativeUserIndex, positionKm);
        vlabRefSetFocus('geometry');
      },
      onReset: vlabRefResetUeProbe,
    };
  }, [vlabRefResetUeProbe, vlabRefScheduleUeRecompute, vlabRefSetFocus, vlabRefUeGeometry]);
  const vlabRefUi = vlabRefLab.presentation.locale === 'zh-Hant' ? {
    modulesAria: '可逐步加入的分析模組',
    fieldAria: '場域切換',
    ntpuField: 'NTPU 場域',
    globalField: '全球軌道',
    switchTheme: '切換主題',
    building: '正在建立衛星軌道與鏈路結果',
    buildingHint: '完整計算完成後即可調整參數。',
  } : {
    modulesAria: 'Progressive analysis modules',
    fieldAria: 'Field switch',
    ntpuField: 'NTPU field',
    globalField: 'Global orbit',
    switchTheme: 'Switch theme',
    building: 'Building satellite orbits and link results',
    buildingHint: 'Parameters become adjustable once the full computation lands.',
  };

  // Sandbox-only: mirrors SignalTuningPanel's own (uncontrolled) main-tab
  // state so the icon nav below can show the right button as active. See the
  // SANDBOX_SIDEBAR2_MODULES comment above for why this forwards a real
  // click rather than driving SignalTuningPanel via a prop.
  const [sandboxSidebar2ActiveTab, setSandboxSidebar2ActiveTab] = useState<SandboxSidebar2Tab>('sinr');
  const sandboxSidebar2SelectTab = useCallback((key: SandboxSidebar2Tab) => {
    setSandboxSidebar2ActiveTab(key);
    document.getElementById(`signal-tuning-main-tab-${key}`)?.click();
  }, []);

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
      data-legacy-walker-route={isLegacyWalkerRoute ? 'true' : undefined}
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
      data-timeline-source-owner={activeTimelineDescriptor.sourceOwner}
      data-timeline-horizon-kind={activeTimelineDescriptor.horizonKind}
      data-timeline-claim-kind={activeTimelineDescriptor.claimKind}
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
      {/* Global display controls remain available on the SINR/TLE homepage as
          well as the replay lanes. The current scene still consumes
          beamDisplaySpec for callouts, secondary beams and cinematic display;
          hiding this whole row made those existing controls unreachable. */}
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
        showHandoverJumpButtons={sceneSource === 'live-sim'
          && (sceneLane === 'sinr-live' || sceneLane === 'modqn-live-cell-preview')}
        nextIntraEnabled={manualHandoverRequest === null
          && directorNextIntraEnabled
          && camera.directorPhase === 'idle'
          && !handoverControlBusy}
        nextInterEnabled={manualHandoverRequest === null
          && directorInterButtonEnabled
          && camera.directorPhase === 'idle'
          && !handoverControlBusy}
        nextIntraCount={directorIntraIndexedEnabled
          ? sceneSource === 'live-sim'
            ? liveWalkerDirectorHandoverRailEvents.filter(event => event.kind === 'intra').length
            : handoverRailEvents.filter(event => event.kind === 'intra').length
          : undefined}
        nextInterCount={sceneSource === 'live-sim'
          ? undefined
          : handoverRailEvents.filter(event => event.kind === 'inter').length}
        nextIntraMode={directorIntraIndexedEnabled ? 'indexed' : 'real-trigger'}
        manualHandoverKind={sceneSource === 'live-sim' ? manualHandoverRequest?.kind ?? null : null}
        onNextIntra={handleQuickIntra}
        onNextInter={handleQuickInter}
      />
      </div>
      <div
        data-testid="global-locale-toggle-slot"
        style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}
      >
        <LocaleToggle />
      </div>
      </div>
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
        style={{
          // Sandbox-only: center scene + right rail are hidden below (SANDBOX_HIDE_CANVAS_AND_RIGHT_RAIL)
          // while only the two left sidebars are being compared, so the grid only needs two tracks.
          gridTemplateAreas: SANDBOX_HIDE_CANVAS_AND_RIGHT_RAIL
            ? '"vlabref left"'
            : '"vlabref left canvas right"',
          // Both columns get a floor they can't be squeezed below (previously
          // column 2 was `minmax(0, ...)` -- a 0 floor -- so widening column
          // 1's fixed 460px just ate column 2's space and made ITS content
          // (e.g. the SINR term-chip labels) truncate worse than before.
          gridTemplateColumns: SANDBOX_HIDE_CANVAS_AND_RIGHT_RAIL
            ? 'minmax(420px, 1fr) minmax(520px, 1fr)'
            : 'minmax(420px, 1fr) minmax(520px, 1fr) minmax(480px, 1fr) minmax(280px, var(--leo-right-drawer-width))',
        }}
      >
        {/* /walker sandbox-only reference column: the real /simulator left
            sidebar, running its own Visual Lab session. Kept side-by-side
            with the original leo-shell-left below while that one gets
            reskinned to match. Remove this <aside> (and the vlabRef* state
            block above) once the redesign is done. */}
        <aside
          className="leo-walker-sandbox-vlab-reference"
          aria-label="Visual Lab left sidebar (reference, for redesign)"
          data-testid="walker-sandbox-vlab-reference"
          style={{ gridArea: 'vlabref', minWidth: 0, overflowY: 'auto' }}
        >
          <div className={`leo-walker-sandbox-vlab-vars${vlabRefLab.presentation.theme === 'light' ? ' leo-walker-sandbox-vlab-vars--light' : ''}`}>
            <div className="vlab-left-control-stack">
              <nav className="vlab-sidebar-modules" aria-label={vlabRefUi.modulesAria}>
                {VISUAL_LAB_MODULES.map((module) => {
                  const isOpen = vlabRefOpenModules.includes(module.key);
                  const isActive = isOpen && vlabRefActiveModule === module.key;
                  return (
                    <button
                      key={module.key}
                      type="button"
                      className={`vlab-sidebar-module vlab-sidebar-module--${module.tone}${isActive ? ' is-active' : ''}`}
                      aria-pressed={isActive}
                      onClick={() => vlabRefOpenModule(module.key)}
                    >
                      <span aria-hidden="true">{module.symbol}</span>
                      <strong>{moduleShortLabel(module.key, vlabRefLab.presentation.locale)}</strong>
                    </button>
                  );
                })}
              </nav>
              <div className="vlab-sidebar-utilities">
                <button
                  type="button"
                  className="vlab-field-switch"
                  role="switch"
                  aria-checked={vlabRefLab.presentation.view !== 'earth'}
                  aria-label={vlabRefUi.fieldAria}
                  onClick={() => vlabRefSetView(vlabRefLab.presentation.view === 'earth' ? 'service' : 'earth')}
                >
                  <span>{vlabRefLab.presentation.view === 'earth' ? vlabRefUi.globalField : vlabRefUi.ntpuField}</span>
                  <i aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={vlabRefUi.switchTheme}
                  onClick={() => { void vlabRefSession.dispatch({ type: 'setTheme', theme: vlabRefLab.presentation.theme === 'dark' ? 'light' : 'dark' }); }}
                >
                  {vlabRefLab.presentation.theme === 'dark' ? '☀' : '☾'}
                </button>
                <button
                  type="button"
                  onClick={() => { void vlabRefSession.dispatch({ type: 'setLocale', locale: vlabRefLab.presentation.locale === 'zh-Hant' ? 'en' : 'zh-Hant' }); }}
                >
                  {vlabRefLab.presentation.locale === 'zh-Hant' ? 'EN' : '繁中'}
                </button>
              </div>
              {vlabRefOpenModules.includes(vlabRefActiveModule) && vlabRefSnapshot !== null ? (
                <VisualLabProgressiveControlDock
                  className="vlab-panel vlab-progressive-control-dock"
                  locale={vlabRefLab.presentation.locale}
                  activeModule={vlabRefActiveModule}
                  inputs={vlabRefInputs}
                  draftSource={vlabRefDraftSource}
                  acceptedSource={vlabRefDisplayAcceptedSource}
                  applyingSource={vlabRefApplyingSource}
                  sourceDirty={vlabRefSourceDirty}
                  beamLayoutCount={vlabRefLab.draft.frameOptions.beamLayoutCount}
                  beamIlluminationMode={vlabRefLab.draft.frameOptions.beamIlluminationMode}
                  ueGeometry={vlabRefUeGeometryControls}
                  perSatelliteBeamLayoutCount={vlabRefLab.draft.frameOptions.perSatelliteBeamLayoutCount}
                  snapshot={vlabRefSnapshot}
                  onDraftSourceChange={(patch) => {
                    void vlabRefSession.dispatch({ type: 'editSourceDraft', draft: {
                      constellation: patch.constellation ?? vlabRefDraftSource.constellation,
                      taipeiDateTime: patch.localDateTime ?? vlabRefDraftSource.localDateTime,
                    } });
                  }}
                  onApplySource={vlabRefApplySource}
                  onBeamLayoutCountChange={(beamCount) => {
                    setVlabRefSelectedUe(null);
                    void vlabRefSession.dispatch({ type: 'setBeamLayoutCount', beamCount });
                  }}
                  onBeamIlluminationModeChange={(mode) => {
                    setVlabRefSelectedUe(null);
                    void vlabRefSession.dispatch({ type: 'setBeamIlluminationMode', mode });
                  }}
                  onPerSatelliteBeamLayoutChange={(satelliteId, beamCount) => {
                    setVlabRefSelectedUe(null);
                    void vlabRefSession.dispatch({ type: 'setPerSatelliteBeamLayout', satelliteId, beamCount });
                  }}
                  onPerSatelliteBeamLayoutRemove={(satelliteId) => {
                    setVlabRefSelectedUe(null);
                    void vlabRefSession.dispatch({ type: 'removePerSatelliteBeamLayout', satelliteId });
                  }}
                  onInputChange={vlabRefUpdateInput}
                  onResetInput={vlabRefResetInput}
                  onResetAll={() => { void vlabRefSession.dispatch({ type: 'resetCanonicalParameters' }); }}
                />
              ) : vlabRefOpenModules.includes(vlabRefActiveModule) ? (
                <aside className="vlab-panel vlab-progressive-control-dock vlab-data-pending" aria-busy="true">
                  <strong>{vlabRefUi.building}</strong>
                  <span>{vlabRefUi.buildingHint}</span>
                </aside>
              ) : null}
            </div>
          </div>
        </aside>
        <aside
          className="leo-shell-left leo-walker-sandbox-vlab-reskin"
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
          {/* /walker sandbox-only: icon module nav standing in for
              SignalTuningPanel's own text-tab row (hidden by the reskin
              stylesheet), same vlab-sidebar-modules structure as sidebar 1. */}
          {sceneLane === 'sinr-live' && isLegacyWalkerRoute && (
            <div className="leo-walker-sandbox-vlab-vars">
              <nav
                className="vlab-sidebar-modules leo-walker-sandbox-sidebar2-nav"
                aria-label="Left sidebar module switch (mirrors /simulator)"
              >
                {SANDBOX_SIDEBAR2_MODULES.map((module) => {
                  const isActive = sandboxSidebar2ActiveTab === module.key;
                  return (
                    <button
                      key={module.key}
                      type="button"
                      className={`vlab-sidebar-module${isActive ? ' is-active' : ''}`}
                      aria-pressed={isActive}
                      onClick={() => sandboxSidebar2SelectTab(module.key)}
                    >
                      <span aria-hidden="true">{module.symbol}</span>
                      <strong>{module.label}</strong>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}
          {/* Homepage input rail. It owns every editable or fixed calculation
              parameter; final values are rendered from the same accepted frame
              in the right rail. */}
          {sceneLane === 'sinr-live' && (
            <SinrLiveDisplayDrawer
              parameterSection={
                isLegacyWalkerRoute ? (
                  <SignalTuningPanel
                    baseProfile={baseProfile}
                    tuning={signalTuning}
                    topology={activeSceneTopology}
                    sceneVisualScale={sceneVisualScale}
                    hasOverrides={hasSignalOverrides || hasTopologyOverrides || hasVisualScaleOverrides}
                    appMode={appMode}
                    formulaBudget={simState.physicalServingBudget}
                    isFormulaEvidenceStale={staleFormulaEvidenceKey !== null}
                    onTuningChange={handleSignalTuningChange}
                    onTopologyChange={handleSceneTopologyChange}
                    servingSatelliteId={simState.servingSatId}
                    candidateSatelliteId={simState.pendingTargetSatId ?? simState.comparisonSatId}
                    formulaFrame={simState.angleAwareFormulaFrame}
                    onSceneVisualScaleChange={setSceneVisualScale}
                    onReset={handleResetSignalTuning}
                  />
                ) : (
                  <HomepageCanonicalControls
                    analysis={homepageCanonicalAnalysis}
                    activeTab={homepageCanonicalTab}
                    onActiveTabChange={setHomepageCanonicalTab}
                  />
                )
              }
            />
          )}
          </div>
        </aside>
        <main
          className="leo-shell-canvas"
          data-testid="leo-shell-canvas"
          style={SANDBOX_HIDE_CANVAS_AND_RIGHT_RAIL ? { display: 'none' } : undefined}
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
          <div
            className="leo-walker-sandbox-scene-placeholder"
            data-testid="walker-sandbox-scene-placeholder"
          >
            <strong>Main scene rendering is disabled in this /walker sandbox.</strong>
            <span>This route exists to redesign the left sidebar against the /simulator reference column; the 3D canvas is intentionally skipped for now.</span>
          </div>
          {sceneLane === 'artifact-replay' && replaySceneFrame && (
            <ArtifactSatelliteCompass satellites={replaySceneFrame.satellites} />
          )}
          {(directorCinematicEnabled || directorFocusEnabled) && (
            <CinematicSeekFadeOverlay
              pulseKey={cinematicFadePulse}
              reducedMotion={runtime.reducedMotion}
              suppressVisual={shouldSuppressInterSeekFade(handoverCinema.armFilter)}
              onPeak={handleCinematicSeekPeak}
            />
          )}
          {timelineBar}
        </main>
        <aside
          className="leo-shell-right"
          aria-label="Calculated values panel"
          style={SANDBOX_HIDE_CANVAS_AND_RIGHT_RAIL ? { display: 'none' } : undefined}
        >
          {sceneLane === 'sinr-live' && !isLegacyWalkerRoute ? (
            <HomepageRightRail
              analysis={homepageCanonicalAnalysis}
            >
              <HomepageCanonicalServingComparison frame={homepageCanonicalAnalysis.frame} />
            </HomepageRightRail>
          ) : (
            <>
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
                {sceneLane === 'sinr-live' && isLegacyWalkerRoute ? (
                  <WalkerResultsRail
                    profile={effectiveProfile}
                    physicalServing={simState.physicalServing}
                    physicalServingBudget={simState.physicalServingBudget}
                    servingCellId={simState.servingCellId}
                    pendingTargetSatId={simState.pendingTargetSatId}
                    angleAwareFormulaFrame={simState.angleAwareFormulaFrame}
                    simTimeSec={simState.simTimeSec}
                    beamHopEnabled={walkerBeamDisplayFrame.beamHoppingEnabled}
                    isFormulaEvidenceStale={staleFormulaEvidenceKey !== null}
                  >
                    <InfoPanel
                      {...intraTeachingDisplayState}
                      profile={effectiveProfile}
                      handoverMode={handoverMode}
                      comparisonCellId={intraTeachingComparisonCellId}
                      isFormulaEvidenceStale={staleFormulaEvidenceKey !== null}
                      channelMetricKind={activeSceneFrame?.channelMetricKind}
                    />
                  </WalkerResultsRail>
                ) : (
                  <InfoPanel
                    {...intraTeachingDisplayState}
                    profile={effectiveProfile}
                    handoverMode={handoverMode}
                    comparisonCellId={intraTeachingComparisonCellId}
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
            </>
          )}
        </aside>
      </div>
      <TrainingTelemetryFeed enabled={appMode === 'modqn-demo'} />
    </div>
    </ModqnHandoverModeProvider>
    </ModqnEnvelopeProvider>
    </LocaleProvider>
  );
}
