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
  sameHandoverPolicyTuning,
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
import { HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM } from './homepage/controller/homepageStoryScenario';
import {
  HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS,
  HOMEPAGE_TEACHING_PLAYBACK_SPEED,
} from './homepage/controller/homepageHandoverTiming';
import {
  HandoverTeachingCaption,
  HandoverTeachingRail,
  useHandoverTeachingLecture,
} from './ui/homepage/HandoverTeachingRail';
import type {
  TeachingFrame,
  TeachingHandoverKind,
} from './homepage/teaching/handoverTeachingScript';
import type { HandoverTeachingSceneStory } from './viz/HandoverTeachingBeamCones';
import { InfoPanel } from './ui/InfoPanel';
import { SidebarTabShell } from './ui/SidebarTabShell';
import { HomepageCanonicalControls } from './ui/signal-tuning/HomepageCanonicalControls';
import { HomepageCanonicalServingComparison } from './ui/signal-tuning/HomepageCanonicalServingComparison';
import { HomepageRightRail } from './ui/signal-tuning/HomepageRightRail';
import { SignalTuningPanel } from './ui/SignalTuningPanel';
import { HandoverPolicyControls } from './ui/HandoverPolicyControls';
import {
  DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE,
  normalizeEeThresholdKbitPerJoule,
} from './engine/handover/eeThreshold';
import type { TeachingLinkSnapshot } from './ui/TeachingPanelDock';
import { deriveCanonicalTeachingLinkSnapshot } from './app/canonicalTeachingLinkSnapshot';
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
  getHomepageRightSidebarTabsForSceneLane,
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
import { deriveWalkerSignalTunedProfile } from './app/walkerSignalProfile';
import {
  LIVE_SIM_TIMELINE_DURATION_SEC,
  buildAppRuntimeConfig,
} from './app/appRuntimeConfig';
import {
  DEFAULT_WALKER_SCENARIO_DATE,
  DEFAULT_WALKER_SCENARIO_EPOCH_UTC_MS,
  DEFAULT_WALKER_SCENARIO_TIME,
  taipeiScenarioTimeToUtcMs,
} from './app/walkerScenarioTime';
import {
  clampTimelineTime,
} from './app/timelineRailAuthority';
import {
  deriveAppTimelineCore,
  deriveAppTimelineDisabled,
  deriveAppTimelineRailProjection,
} from './app/appTimelinePresentation';
import {
  advanceArchivedTlePlaybackCursor,
  resolveArchivedTlePlaybackStart,
} from './app/archivedTlePlayback';
import {
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
  HOMEPAGE_SIMULATION_SOURCE_SWITCH_VISIBLE,
  persistSimulationSourceMode,
  readHomepageSimulationSourceMode,
  type SimulationSourceMode,
} from './app/simulationSourceMode';
import {
  resolveSceneLane,
  type SceneLane,
} from './app/sceneLane';
import {
  deriveIntraTeachingDisplayState,
  deriveTeachingIdentityBinding,
  deriveTeachingInterRosterSatelliteIds,
  deriveTeachingSceneStoryCandidate,
  resolveTeachingIntraSatelliteId,
} from './app/teachingPresentationDerivations';
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
  createSinrLiveCellHandoverEventIndexWorkerTransport,
  type SinrLiveCellHandoverEventIndexWorkerTransport,
} from './scene/sinrLiveCellHandoverEventIndexWorkerTransport';
import {
  resolveSinrLiveCellLayoutAltitudeKm,
  resolveSinrLiveSceneCellCount,
} from './scene/sinrLiveCellRuntime';
import {
  DEFAULT_MODQN_VISUAL_LAYER_PRESET,
  type ModqnVisualLayerPreset,
} from './scene/modqnVisualLayers';
import {
  createReplayPanelSimState,
  selectReplayDisplayUes,
} from './app/showcaseReplayState';
import { usePlaybackControls } from './usePlaybackControls';
import { useHomepagePlaybackTransport } from './homepage/controller/useHomepagePlaybackTransport';
import {
  projectHomepageRail,
  type HomepageCandidateRosterContinuity,
} from './homepage/controller/railProjection';
import { buildHomepageSatelliteDisplayNameMap } from './homepage/controller/homepageSatelliteDisplayName';
import {
  resolveHomepageQuickJumpSourceSec,
} from './homepage/controller/homepageDemoWindow';
import {
  createHomepageHandoverJumpIntent,
  resolveHomepageHandoverJumpIntent,
  type HomepageHandoverJumpIntent,
} from './homepage/controller/handoverJumpIntent';
import { HomepageBeamRail } from './ui/homepage/HomepageBeamRail';
import { HomepageTeachingTimeline } from './ui/homepage/HomepageTeachingTimeline';
import type {
  HomepageAcceptedSnapshot,
  HomepageBeamMetricsProjection,
  HomepageHandoverPresentation,
  HomepageHandoverStoryProjection,
} from './homepage/controller/contracts';
import type { HandoverPresentationSnapshot } from './scene/handoverPresentationOwner';
import {
  isMultiCandidatePlaybackSlowDecisionFrame,
} from './scene/multiCandidateWarmStart';
import { useCameraControls } from './useCameraControls';
import {
  readSixActsTeachingModeFromSearch,
  readSixActsTeachingPresetFromSearch,
  SIX_ACTS_HANDOVER_PRESET,
  withSixActsTeachingMode,
  type SixActsTeachingMode,
} from './course/sixActs/teachingMode';
import {
  adaptHomepageSixActsFrameFacts,
  type SixActsFrameFacts,
} from './course/sixActs/liveReplayBridge';
import {
  advanceSixActsSubtitleState,
  createSixActsSubtitleState,
  type SixActsSubtitleState,
} from './course/sixActs/subtitleStateMachine';
import { SixActsSubtitleBar } from './course/nav/SixActsAnnotation';
import {
  DEFAULT_SHELL_CHROME_VISIBILITY,
  ShellChromeControls,
  type ShellChromeKey,
  type ShellChromeVisibility,
} from './ui/ShellChromeControls';
import {
  SixActsTeachingOverlay,
  type SixActsTeachingReceipt,
} from './ui/SixActsTeachingOverlay';
import { SimulationSourceToggle } from './ui/SimulationSourceToggle';
import { SixActsTopEntry } from './ui/SixActsTopEntry';
import { ArchivedTleBoundaryNote } from './ui/ArchivedTleBoundaryNote';
import { HomepageBeamRailWaiting } from './ui/HomepageBeamRailWaiting';
import { GlobalLocaleToggleSlot } from './ui/GlobalLocaleToggleSlot';
import { HomepageCanonicalRightRail } from './ui/HomepageCanonicalRightRail';
import { useLeftSidebar } from './app/useLeftSidebar';
import { useDirectorModes } from './app/useDirectorModesQ1';

/**
 * One lecture's own scene endpoints.
 *
 * The scripted run never asks the live model for a handover, so the scene's
 * demo resolver has no measured alternate link to fall back on. These carry
 * the lecture's protagonists instead: live identities the viewer can find in
 * the render, chosen by the lecture rather than by live evidence.
 */
interface TeachingHandoverEndpoints {
  readonly sourceSatId: string;
  readonly sourceCellId: number;
  /** Inter only: the spacecraft the lecture's winner row names. */
  readonly targetSatId?: string;
  /** Intra only: a second earth-fixed cell on the same spacecraft. */
  readonly targetCellId?: number;
  readonly servingSinrDb: number;
  readonly candidateSinrDb: number;
}

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
// Restore the engineering homepage while keeping the dedicated six-act entry.
// The teaching routes and reusable dock remain available for a later reopen.
const HOMEPAGE_TEACHING_AUXILIARY_UI_VISIBLE = false;
// The scene's demo resolver needs finite SINR on both sides of a manual cue.
// A lecture argues in EE, so this is only the margin its candidate row claims.
const TEACHING_MANUAL_CANDIDATE_LEAD_DB = 1.5;

export function App() {
  // `/` and `/legacy` mount this shell; `/walker` is routed to the isolated
  // AppWalkerSandbox by main.tsx. Route identity still owns the historical
  // sceneSource default, while the persisted Walker/TLE choice below explicitly
  // owns which scientific producer feeds the SINR homepage.
  const isLegacyWalkerRoute = typeof window !== 'undefined'
    && (
      window.location.pathname === '/'
      || window.location.pathname === '/legacy'
      || window.location.pathname === '/walker'
    );
  const [simulationSource, setSimulationSource] = useState<SimulationSourceMode>(
    readHomepageSimulationSourceMode,
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
  // The homepage Demo action owns one bounded source window. This is only an
  // integration stop marker; it does not advance time or decide a handover.
  const [homepageDemoRunEndSec, setHomepageDemoRunEndSec] = useState<number | null>(null);
  // The homepage teaching timeline is presentation-only. The live simulator
  // remains the sole clock; every action uses this one bounded source window.
  const [homepageTeachingActive, setHomepageTeachingActive] = useState(false);
  // The handover lecture the two teaching buttons open, or null for the normal
  // homepage. The stage owns its own authored data and clock; nothing about the
  // live lane changes while it is open.
  const [teachingStageKind, setTeachingStageKind] = useState<TeachingHandoverKind | null>(null);
  const [homepageTeachingDetailsVisible, setHomepageTeachingDetailsVisible] = useState(false);
  const [liveTimelineSeekRequest, setLiveTimelineSeekRequest] =
    useState<LiveTimelineSeekRequest | null>(null);
  const manualHandoverRequestSeqRef = useRef(0);
  const [manualHandoverRequest, setManualHandoverRequest] = useState<{
    readonly id: number;
    readonly kind: 'intra' | 'inter';
    readonly startedAtMs: number;
    readonly origin: 'button' | 'scheduled';
    readonly intraPresentation: SimState['intraHandoverPresentation'];
    /**
     * The endpoints a lecture asks the scene to paint. The live model has not
     * measured an alternate link during a scripted run, so the scene resolver
     * would fail closed on live evidence alone; the lecture supplies its own.
     */
    readonly teachingEndpoints: TeachingHandoverEndpoints | null;
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
  const walkerRuntimeHasPublishedRef = useRef(false);
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
  // The archived source is applicable only to the SINR homepage. Other lanes
  // keep their existing Walker/artifact ownership even if the persisted
  // homepage preference is TLE.
  const isArchivedTleSceneActive = sceneLane === 'sinr-live'
    && simulationSource === 'archived-tle';
  const isWalkerSceneActive = !isArchivedTleSceneActive;
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
  const { leftSidebarTab, setLeftSidebarTab, leftSidebarCollapsed, setLeftSidebarCollapsed } = useLeftSidebar({ initialRuntime });
  
  const [rightSidebarTab, setRightSidebarTab] = useState<RightSidebarTab>('live');
  // The live homepage keeps the Scenario tab selected while a topology edit
  // rebuilds the Walker source/index. Without this small UI-only handoff, the
  // tuning panel can remount on the rebuild bridge and fall back to SINR,
  // hiding the service/candidate beam controls exactly when the user needs to
  // verify the new topology.
  const [homepageSignalTuningMainTab, setHomepageSignalTuningMainTab] = useState<MainTabKey>('sinr');
  const [homepageCanonicalTab, setHomepageCanonicalTab] = useState<MainTabKey>('sinr');
  const [teachingMode, setTeachingMode] = useState<SixActsTeachingMode>(() => (
    !HOMEPAGE_TEACHING_AUXILIARY_UI_VISIBLE || typeof window === 'undefined'
      ? 'engineering'
      : readSixActsTeachingModeFromSearch(window.location.search) === 'teaching'
        || readSixActsTeachingPresetFromSearch(window.location.search) === SIX_ACTS_HANDOVER_PRESET
        ? 'teaching'
        : 'engineering'
  ));
  const [shellChromeVisibility, setShellChromeVisibility] = useState<ShellChromeVisibility>(
    DEFAULT_SHELL_CHROME_VISIBILITY,
  );
  const toggleShellChrome = useCallback((key: ShellChromeKey) => {
    setShellChromeVisibility(current => ({ ...current, [key]: !current[key] }));
  }, []);
  const showAllShellChrome = useCallback(() => {
    setShellChromeVisibility(DEFAULT_SHELL_CHROME_VISIBILITY);
  }, []);
  const hideAllShellChrome = useCallback(() => {
    setShellChromeVisibility({
      leftSidebar: false,
      rightSidebar: false,
      topControls: false,
      timeline: false,
      sceneOverlay: false,
    });
  }, []);
  const homepageCanonicalAnalysis = useHomepageCanonicalAnalysis({
    enabled: isArchivedTleSceneActive,
  });
  const homepageSatelliteNameById = useMemo(
    () => buildHomepageSatelliteDisplayNameMap(
      homepageCanonicalAnalysis.frame?.tleState.propagationFrame.satellites,
    ),
    [homepageCanonicalAnalysis.frame],
  );
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
  const isRootHomepage = typeof window !== 'undefined' && window.location.pathname === '/';
  const visibleRightSidebarTabs = useMemo(
    () => isRootHomepage
      ? getHomepageRightSidebarTabsForSceneLane(sceneLane, handoverMode)
      : getRightSidebarTabsForSceneLane(sceneLane, handoverMode),
    [handoverMode, isRootHomepage, sceneLane],
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
  const [campusVisible, setCampusVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(() => readPrefersReducedMotion());
  const [viewport, setViewport] = useState(() => readRuntimeViewport());
  // The homepage Director seeks to a real pre-handover lead-in so the viewer
  // can follow candidate qualification and TTT before the indexed commit.
  // Keep the longer display budget route-local; legacy aliases and the Walker
  // sandbox retain their existing camera timing.
  const camera = useCameraControls({
    focusAutoExitMs: isRootHomepage ? 45_000 : undefined,
  });
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
  const [homepageEeThresholdKbitPerJoule, setHomepageEeThresholdKbitPerJoule] = useState(
    DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE,
  );
  const handleHomepageEeThresholdChange = useCallback((next: number) => {
    setHomepageEeThresholdKbitPerJoule(normalizeEeThresholdKbitPerJoule(next));
  }, []);
  const [walkerScenarioDate, setWalkerScenarioDate] = useState(DEFAULT_WALKER_SCENARIO_DATE);
  const [walkerScenarioTime, setWalkerScenarioTime] = useState(DEFAULT_WALKER_SCENARIO_TIME);
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
  const handoverPolicyDraft = handoverPolicyState.profileId === baseProfile.id
    ? handoverPolicyState.draft
    : handoverPolicyDefaults;
  const hasHandoverPolicyDraftChanges = !sameHandoverPolicyTuning(
    handoverPolicyDraft,
    appliedHandoverPolicy,
  );
  const hasHandoverPolicyOverrides = !sameHandoverPolicyTuning(
    handoverPolicyDefaults,
    appliedHandoverPolicy,
  );
  const handleHandoverPolicyDraftChange = useCallback((next: HandoverPolicyTuningState) => {
    setHandoverPolicyState(current => {
      const defaults = createHandoverPolicyTuningState(baseProfile);
      const currentForProfile = current.profileId === baseProfile.id
        ? current
        : {
          profileId: baseProfile.id,
          draft: defaults,
          applied: defaults,
          version: current.version,
        };
      return {
        ...currentForProfile,
        draft: next,
      };
    });
  }, [baseProfile]);
  const handleApplyHandoverPolicy = useCallback(() => {
    setHandoverPolicyState(current => {
      const defaults = createHandoverPolicyTuningState(baseProfile);
      const draft = current.profileId === baseProfile.id ? current.draft : defaults;
      return {
        profileId: baseProfile.id,
        draft,
        applied: draft,
        version: current.version + 1,
      };
    });
  }, [baseProfile]);
  const handleResetHandoverPolicy = useCallback(() => {
    setHandoverPolicyState(current => {
      const defaults = createHandoverPolicyTuningState(baseProfile);
      return {
        profileId: baseProfile.id,
        draft: defaults,
        applied: defaults,
        version: current.version + 1,
      };
    });
  }, [baseProfile]);
  const handleTeachingModeChange = useCallback((nextMode: SixActsTeachingMode) => {
    setTeachingMode(nextMode);
    sixActsTeachingFactsRef.current = null;
    sixActsTeachingTraceRef.current = [];
    sixActsTeachingReceiptRef.current = null;
    sixActsAutoCameraKeyRef.current = null;
    sixActsSubtitleRef.current = null;
    setSixActsSubtitle(null);
    setSixActsTeachingReceipt(null);
    if (nextMode === 'engineering') camera.exitDirectorFocus();
    if (typeof window !== 'undefined') {
      window.history.replaceState(window.history.state, '', withSixActsTeachingMode(window.location.href, nextMode));
    }
  }, [camera]);
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
  const signalTunedProfile = useMemo(() => deriveWalkerSignalTunedProfile({
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
  const walkerScenarioEpochUtcMs = useMemo(
    () => taipeiScenarioTimeToUtcMs(walkerScenarioDate, walkerScenarioTime)
      ?? DEFAULT_WALKER_SCENARIO_EPOCH_UTC_MS,
    [walkerScenarioDate, walkerScenarioTime],
  );
  // Both keys read the SAME `activeSceneTopology` the profile does — otherwise a
  // field that is allowed through to the profile (beamCountPerSatellite) could
  // change the sim without restarting it / without re-stamping the evidence key.
  const signalResetKey = useMemo(
    () => [
      getSignalTuningResetKey(signalTuning),
      getSceneTopologyResetKey(activeSceneTopology),
      `epoch:${walkerScenarioEpochUtcMs}`,
    ].join('|'),
    [activeSceneTopology, signalTuning, walkerScenarioEpochUtcMs],
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
    () => recommendDemoReplayStartOffsetSec(effectiveProfile, walkerScenarioEpochUtcMs),
    [effectiveProfile.orbit, walkerScenarioEpochUtcMs],
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
  const [primaryUeJogKm, setPrimaryUeJogKm] = useState<{ east: number; north: number }>(() => (
    isRootHomepage && sceneLane === 'sinr-live'
      ? { ...HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM }
      : { east: 0, north: 0 }
  ));
  // A jog may need one published cell frame before the model exposes its
  // measured same-satellite alternate. This ref is only an input intent for
  // the existing manual presentation request; it is not a second animation or
  // handover authority.
  const intraDemoAwaitingMeasuredFrameRef = useRef(false);
  // Generic analysis-window reset. Timeline seeks invalidate accumulated
  // canonical EE evidence even though the retired classroom ledger is gone.
  const [measurementResetEpoch, setMeasurementResetEpoch] = useState(0);
  const runtime = useMemo(() => buildAppRuntimeConfig({
    appMode,
    effectiveProfile,
    demoStartOffsetSec: demoStartOffset,
    liveEpochUtcMs: walkerScenarioEpochUtcMs,
    liveTimelineSeekTargetSec: liveTimelineSeekRequest?.targetSec,
    liveTimelineSeekRequestKey: liveTimelineSeekRequest?.requestKey,
    liveTimelineSeekSourceHistoryReplay: liveTimelineSeekRequest?.sourceHistoryReplay,
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
    eeThresholdKbitPerJoule: isRootHomepage ? homepageEeThresholdKbitPerJoule : undefined,
    teachingLectureKind: isRootHomepage ? teachingStageKind : null,
    selectedTrainingEnvAxes,
    modqnVisualLayerPreset,
    modqnServiceAllocationEnabled,
    primaryJogEastKm: primaryUeJogKm.east,
    primaryJogNorthKm: primaryUeJogKm.north,
    manualHandoverRequestId: manualHandoverRequest?.id,
    manualHandoverKind: manualHandoverRequest?.kind,
    manualHandoverOrigin: manualHandoverRequest?.origin,
    manualHandoverStartedAtMs: manualHandoverRequest?.startedAtMs,
    // A lecture's own endpoints outrank the live intra sample: during a
    // scripted run there is no live sample, and when there is one it describes
    // a different story than the one being narrated.
    manualHandoverSourceSatId: manualHandoverRequest?.teachingEndpoints?.sourceSatId
      ?? manualHandoverRequest?.intraPresentation?.sourceSatId,
    manualHandoverSourceCellId: manualHandoverRequest?.teachingEndpoints?.sourceCellId
      ?? manualHandoverRequest?.intraPresentation?.sourceCellId,
    manualHandoverTargetSatId: manualHandoverRequest?.teachingEndpoints?.targetSatId,
    manualHandoverTargetCellId: manualHandoverRequest?.teachingEndpoints?.targetCellId
      ?? manualHandoverRequest?.intraPresentation?.targetCellId,
    manualHandoverServingSinrDb: manualHandoverRequest?.teachingEndpoints?.servingSinrDb
      ?? manualHandoverRequest?.intraPresentation?.servingSinrDb,
    manualHandoverCandidateSinrDb: manualHandoverRequest?.teachingEndpoints?.candidateSinrDb
      ?? manualHandoverRequest?.intraPresentation?.candidateSinrDb,
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
    homepageEeThresholdKbitPerJoule,
    isRootHomepage,
    selectedTrainingEnvAxes,
    signalResetKey,
    teachingStageKind,
    viewport,
  ]);
  const visualScaleMultipliers = useMemo(
    (): SceneVisualScaleMultipliers => resolveSceneVisualScaleMultipliers(sceneVisualScale),
    [sceneVisualScale],
  );

  const [simState, setSimState] = useState<SimState>(() => createInitialSimState(baseProfile));
  const sixActsSubtitleRef = useRef<SixActsSubtitleState | null>(null);
  const sixActsTeachingFactsRef = useRef<SixActsFrameFacts | null>(null);
  const sixActsTeachingTraceRef = useRef<readonly SixActsFrameFacts[]>([]);
  const sixActsTeachingReceiptRef = useRef<SixActsTeachingReceipt | null>(null);
  const sixActsAutoCameraKeyRef = useRef<string | null>(null);
  const [sixActsSubtitle, setSixActsSubtitle] = useState<SixActsSubtitleState | null>(null);
  const [sixActsTeachingReceipt, setSixActsTeachingReceipt] = useState<SixActsTeachingReceipt | null>(null);
  const walkerTeachingLinkSnapshot = useMemo<TeachingLinkSnapshot>(() => {
    const formulaFrame = simState.angleAwareFormulaFrame;
    const terms = formulaFrame?.terms;
    return {
      ueId: formulaFrame?.ueId ?? simState.primaryUeId ?? null,
      servingSatelliteId: simState.servingSatId,
      candidateSatelliteId: simState.pendingTargetSatId ?? simState.comparisonSatId,
      timeSec: terms?.timeSec ?? simState.simTimeSec,
      thetaDeg: terms === undefined ? null : terms.thetaRad * (180 / Math.PI),
      transmitGainLinear: terms?.transmitGainLinear ?? null,
      sinrDb: terms?.gammaDb ?? simState.sinrDb,
      throughputMbps: terms === undefined ? null : terms.throughputBps / 1e6,
      systemPowerW: terms?.systemPowerW ?? null,
      energyEfficiencyBitsPerJoule: terms?.energyEfficiencyBitsPerJoule ?? null,
    };
  }, [isRootHomepage, simState]);
  const canonicalTeachingLinkSnapshot = useMemo<TeachingLinkSnapshot>(
    () => deriveCanonicalTeachingLinkSnapshot(homepageCanonicalAnalysis.frame),
    [homepageCanonicalAnalysis.frame],
  );
  const teachingLinkSnapshot = isArchivedTleSceneActive
    ? canonicalTeachingLinkSnapshot
    : walkerTeachingLinkSnapshot;
  const walkerBeamDisplayFrame = useMemo(() => createSinrLiveBeamDisplayFrame({
    profile: effectiveProfile,
    runtime,
    servingSatelliteId: simState.physicalServing.satId,
    candidateSatelliteId: simState.pendingTargetSatId ?? simState.comparisonSatId,
    roleCountsRepresentFocusedCells: isRootHomepage,
  }), [
    effectiveProfile,
    isRootHomepage,
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
  const [liveWalkerHandoverEventIndexBuilding, setLiveWalkerHandoverEventIndexBuilding] = useState(false);
  // A button click during an index rebuild is a user command, not a second
  // event source. Keep at most one command and replay it through the freshly
  // rebuilt source index after the existing Director hook becomes actionable.
  const pendingDirectorJumpKindRef = useRef<HomepageHandoverJumpIntent | null>(null);
  // A topology edit starts a new source/index epoch.  Keep the previous epoch's
  // presentation and Director claim from disabling the new epoch's controls.
  // The ref is seeded so the first mount is not treated as a reset.
  const sceneTopologyResetKey = useMemo(
    () => getSceneTopologyResetKey(activeSceneTopology),
    [activeSceneTopology],
  );
  const previousSceneTopologyResetKeyRef = useRef(sceneTopologyResetKey);
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
  // What the scene is actually PAINTING, republished by the presentation owner
  // that lives inside the R3F tree. The rail and the story panel describe
  // intent; this and the lecture's own cone layer are the only things that say
  // which handover reached the canvas, which is why the shell root carries both
  // as data attributes.
  const [visibleHandover, setVisibleHandover] = useState<{
    readonly active: boolean;
    readonly kind: 'intra' | 'inter' | null;
    readonly source: 'walker' | 'tle' | 'manual' | 'cinema' | null;
    readonly mode: 'idle' | 'presenting' | 'cooldown';
    readonly cooldownUntilMs: number;
    readonly presentation: HomepageHandoverPresentation | null;
  }>({ active: false, kind: null, source: null, mode: 'idle', cooldownUntilMs: 0, presentation: null });
  const visibleHandoverActive = visibleHandover.active;
  // The accepted snapshot remains the only homepage truth. This tiny continuity
  // register only carries the immediately previous accepted publication into the
  // pure rail projection, so a commit/guard frame that temporarily omits its
  // candidate pair cannot erase the already-explained winner. It is reset by the
  // projection's own episode/epoch/policy checks; it does not own a clock,
  // decision, or presentation flag.
  const homepageRailContinuityRef = useRef<{
    readonly snapshot: HomepageAcceptedSnapshot;
    readonly beamMetrics: HomepageBeamMetricsProjection | null;
    readonly story: HomepageHandoverStoryProjection | null;
    readonly candidateRoster: HomepageCandidateRosterContinuity | null;
  } | null>(null);
  // The decision frame and the scene projection share one authority. On the
  // homepage, the readable HO Slow interval starts when the accepted decision
  // enters the real candidate/switching window and stays under the same
  // transport while the visible handover owner carries the source -> target
  // story. Other routes retain their legacy owner below.
  const multiCandidateDecision = simState.acceptedHandoverPresentation?.decision ?? null;
  const homepageRailProjection = useMemo(() => {
    const snapshot = simState.acceptedHandoverPresentation;
    if (typeof window === 'undefined' || window.location.pathname !== '/') return null;
    if (sceneLane !== 'sinr-live' || !isWalkerSceneActive || !snapshot) return null;
    const previous = homepageRailContinuityRef.current;
    const projection = projectHomepageRail(snapshot, {
      beamMetrics: simState.homepageBeamMetrics ?? null,
      configuredCellCount: runtime.servingBeamCount,
      previousSnapshot: previous?.snapshot ?? null,
      previousBeamMetrics: previous?.beamMetrics ?? null,
      previousStory: previous?.story ?? null,
      previousCandidateRoster: previous?.candidateRoster ?? null,
    });
    const story = projection.handoverStory ?? null;
    const candidateRoster = story === null || projection.visibleCandidates === undefined
      || projection.visibleCandidates.length === 0
      ? projection.candidateRosterRetained
        ? previous?.candidateRoster ?? null
        : null
      : {
        episodeId: snapshot.episodeId,
        epochToken: snapshot.epochToken,
        policyConfigHash: snapshot.policyConfigHash,
        sourceFrameId: projection.candidateRosterSourceFrameId ?? snapshot.sourceFrameId,
        source: story.source,
        target: story.target,
        links: projection.visibleCandidates,
      };
    homepageRailContinuityRef.current = {
      snapshot,
      beamMetrics: projection.beamMetrics ?? null,
      story,
      candidateRoster,
    };
    return projection;
  }, [
    isWalkerSceneActive,
    sceneLane,
    simState.acceptedHandoverPresentation,
    simState.homepageBeamMetrics,
    runtime.servingBeamCount,
  ]);
  const homepageCandidateComparisonActive = isRootHomepage
    && sceneLane === 'sinr-live'
    && isWalkerSceneActive
    && isMultiCandidatePlaybackSlowDecisionFrame(multiCandidateDecision);
  const multiCandidateComparisonActive = isRootHomepage
    ? homepageCandidateComparisonActive
    : visibleHandoverActive
      && sceneLane === 'sinr-live'
      && isWalkerSceneActive
      && isMultiCandidatePlaybackSlowDecisionFrame(multiCandidateDecision);
  const visibleHandoverBusy = visibleHandover.mode === 'presenting'
    || (visibleHandover.mode === 'cooldown'
      && (typeof performance === 'undefined' ? Date.now() : performance.now()) < visibleHandover.cooldownUntilMs);
  const visibleManualHandoverActive = visibleHandover.active && visibleHandover.source === 'manual';
  const handleHandoverPresentationChange = useCallback((snapshot: HandoverPresentationSnapshot) => {
    setVisibleHandover(current => {
      const { view } = snapshot;
      const event = view.event;
      const presentation: HomepageHandoverPresentation | null = view.active && event !== null
        ? Object.freeze({
          eventId: event.eventId,
          kind: event.kind,
          source: event.source,
          phase: view.phase ?? 'serving',
          progress01: view.progress01,
          from: Object.freeze({
            satelliteId: event.from.satId,
            beamId: event.from.beamId ?? event.from.cellId + 1,
            sinrDb: event.fromSinrDb ?? null,
          }),
          to: Object.freeze({
            satelliteId: event.to.satId,
            beamId: event.to.beamId ?? event.to.cellId + 1,
            sinrDb: event.toSinrDb ?? null,
          }),
          deltaDb: event.deltaDb ?? null,
        })
        : null;
      const next = {
        // Keep the full owner envelope active through the settled tail. HO
        // Slow and the control lock must not release while the story is still
        // visible, otherwise a high playback rate can outrun the inter latch.
        active: view.active,
        kind: view.event?.kind ?? null,
        source: view.event?.source ?? null,
        mode: snapshot.mode,
        cooldownUntilMs: snapshot.cooldownUntilMs,
        presentation,
      } as const;
      return current.active === next.active
        && current.kind === next.kind
        && current.source === next.source
        && current.mode === next.mode
        && current.cooldownUntilMs === next.cooldownUntilMs
        && current.presentation?.eventId === next.presentation?.eventId
        && current.presentation?.phase === next.presentation?.phase
        && current.presentation?.from.beamId === next.presentation?.from.beamId
        && current.presentation?.to.beamId === next.presentation?.to.beamId
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
  const legacyPlayback = usePlaybackControls(
    simState,
    camera.directorFocusActive,
    visibleHandoverActive,
    multiCandidateComparisonActive,
    // The homepage must start in motion. Event-index construction and other
    // background readiness work are display/quick-jump concerns, not a reason
    // to hold the live simulation at its first frame.
    false,
  );
  // `/` consumes the extracted PlaybackTransport boundary. The legacy hook
  // remains the owner for the other lanes, while this branch is the only
  // transport forwarded to the homepage scene, timeline, and rail.
  const homepagePlayback = useHomepagePlaybackTransport({
    directorFocusActive: camera.directorFocusActive,
    visibleHandoverActive,
    candidateComparisonActive: multiCandidateComparisonActive,
    startPaused: false,
  });
  const playback = isRootHomepage ? homepagePlayback : legacyPlayback;
  const resetAnalysisWindow = useCallback(() => {
    setMeasurementResetEpoch(epoch => epoch + 1);
  }, []);

  const requestMovingIntraDemo = useCallback((origin: 'button' | 'scheduled' = 'button'): boolean => {
    const presentation = simState.intraHandoverPresentation;
    if (
      presentation === null
      || presentation === undefined
      || manualHandoverRequest !== null
      || visibleHandover.active
      || handoverBusyRef.current
      || !Number.isFinite(presentation.servingSinrDb)
      || !Number.isFinite(presentation.candidateSinrDb)
    ) return false;
    manualHandoverWasPausedRef.current = playback.paused;
    // The display-only fallback must keep the source timeline running so the
    // source satellite and its beam apex continue to move during the cue.
    playback.setPaused(false);
    manualHandoverRequestSeqRef.current += 1;
    intraDemoAwaitingMeasuredFrameRef.current = false;
    setManualHandoverRequest({
      id: manualHandoverRequestSeqRef.current,
      kind: 'intra',
      startedAtMs: typeof performance === 'undefined' ? Date.now() : performance.now(),
      origin,
      intraPresentation: presentation,
      teachingEndpoints: null,
    });
    return true;
  }, [manualHandoverRequest, playback, simState.intraHandoverPresentation, visibleHandover.active]);

  // The live fallback jog is deliberately seek-free. Once that real model
  // update publishes a measured alternate beam, promote the same frame into
  // the existing manual presentation owner so the button always has a visible
  // two-beam story instead of relying on a one-frame natural pulse.
  useEffect(() => {
    if (!intraDemoAwaitingMeasuredFrameRef.current) return;
    if (requestMovingIntraDemo('button')) {
      intraDemoAwaitingMeasuredFrameRef.current = false;
    }
  }, [requestMovingIntraDemo, simState.intraHandoverPresentation]);

  // The fallback is a display-only same-satellite beam-switch cue. It runs on the
  // moving source timeline, then returns to the exact pre-click playback state
  // without adding anything to the natural handover event index.
  useEffect(() => {
    if (manualHandoverRequest === null) return;
    const requestId = manualHandoverRequest.id;
    const timerId = window.setTimeout(() => {
      setManualHandoverRequest(current => current?.id === requestId ? null : current);
      if (manualHandoverWasPausedRef.current) playback.setPaused(true);
    }, isRootHomepage ? HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS : MANUAL_HANDOVER_DISPLAY_MS);
    return () => window.clearTimeout(timerId);
  }, [isRootHomepage, manualHandoverRequest, playback.setPaused]);

  const handleSimUpdate = useCallback((state: SimState) => {
    // ITEM #C: mirror the absolute live sim cursor into a ref so the Director
    // focus resolver can read "now" without recreating its callback every frame.
    liveSimTimeSecRef.current = state.simTimeSec;
    walkerRuntimeHasPublishedRef.current = true;
    setSimState(state);
    if (teachingMode === 'teaching' && sceneLane === 'sinr-live') {
      const facts = adaptHomepageSixActsFrameFacts(state);
      if (facts === null) {
        const hadSubtitle = sixActsSubtitleRef.current !== null;
        const hadReceipt = sixActsTeachingReceiptRef.current !== null;
        sixActsTeachingFactsRef.current = null;
        sixActsTeachingTraceRef.current = [];
        sixActsTeachingReceiptRef.current = null;
        sixActsSubtitleRef.current = null;
        if (hadSubtitle) setSixActsSubtitle(null);
        if (hadReceipt) setSixActsTeachingReceipt(null);
      } else {
        sixActsTeachingFactsRef.current = facts;
        const previousTrace = sixActsTeachingTraceRef.current;
        const previousPoint = previousTrace[previousTrace.length - 1];
        const nextTrace = previousPoint !== undefined && facts.simTimeSec < previousPoint.simTimeSec
          ? [facts]
          : previousPoint === undefined || facts.simTimeSec > previousPoint.simTimeSec
            ? [...previousTrace, facts]
            : previousTrace;
        sixActsTeachingTraceRef.current = nextTrace.slice(-96);
        const commit = facts.lastCommittedHandover;
        const previousReceipt = sixActsTeachingReceiptRef.current;
        if (
          commit !== null
          && commit.action === 'inter-handover'
          && commit.fromSatelliteId !== null
          && previousReceipt?.commit.timeMs !== commit.timeMs
        ) {
          const nextReceipt = Object.freeze({
            commit,
            simTimeSec: facts.simTimeSec,
            hoCount: state.hoCount,
          });
          sixActsTeachingReceiptRef.current = nextReceipt;
          setSixActsTeachingReceipt(nextReceipt);
        }
        const policy = {
          offsetDb: appliedHandoverPolicy.offsetDb,
          tttSec: appliedHandoverPolicy.triggerTimeSec,
        } as const;
        const previous = sixActsSubtitleRef.current;
        const next = previous === null
          ? createSixActsSubtitleState(facts, policy)
          : advanceSixActsSubtitleState(previous, facts, policy);
        sixActsSubtitleRef.current = next;
        setSixActsSubtitle(next);
      }
    } else {
      const hadSubtitle = sixActsSubtitleRef.current !== null;
      const hadReceipt = sixActsTeachingReceiptRef.current !== null;
      sixActsTeachingFactsRef.current = null;
      sixActsTeachingTraceRef.current = [];
      sixActsTeachingReceiptRef.current = null;
      sixActsSubtitleRef.current = null;
      if (hadSubtitle) setSixActsSubtitle(null);
      if (hadReceipt) setSixActsTeachingReceipt(null);
    }
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
  }, [appliedHandoverPolicy.offsetDb, appliedHandoverPolicy.triggerTimeSec, sceneLane, signalEvidenceKey, teachingMode]);

  useEffect(() => {
    if (teachingMode !== 'teaching' || sceneLane !== 'sinr-live' || sixActsSubtitle === null) {
      sixActsAutoCameraKeyRef.current = null;
      return;
    }

    const facts = sixActsTeachingFactsRef.current;
    if (facts === null) return;

    const focusBeat = sixActsSubtitle.beat === 'candidate'
      || sixActsSubtitle.beat === 'elimination'
      || sixActsSubtitle.beat === 'ttt'
      || sixActsSubtitle.beat === 'execute';
    if (focusBeat && facts.candidateSatelliteId !== null) {
      const focusKey = `${facts.servingSatelliteId ?? 'none'}->${facts.candidateSatelliteId}`;
      if (sixActsAutoCameraKeyRef.current !== focusKey) {
        sixActsAutoCameraKeyRef.current = focusKey;
        camera.requestInterFocus({
          fromSatId: facts.servingSatelliteId,
          toSatId: facts.candidateSatelliteId,
        });
      }
      return;
    }

    if (
      (sixActsSubtitle.beat === 'service'
        || sixActsSubtitle.beat === 'decline'
        || sixActsSubtitle.beat === 'new-normal')
      && sixActsAutoCameraKeyRef.current !== null
    ) {
      sixActsAutoCameraKeyRef.current = null;
      camera.exitDirectorFocus();
    }
  }, [camera, sceneLane, sixActsSubtitle, teachingMode]);

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
      setLiveWalkerHandoverEventIndexBuilding(false);
      return;
    }
    // Keep an already-built Walker index resident while the TLE source is
    // selected. It is display state for the dormant Walker producer and must
    // neither leak into TLE nor be destroyed by a reversible source switch.
    if (!isWalkerSceneActive) return;

    let cancelled = false;
    // Keep the previous rail snapshot visible while its replacement is built,
    // but gate Director controls so a parameter change can never seek an event
    // from the previous source snapshot.
    setLiveWalkerHandoverEventIndexBuilding(true);
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
    let indexWorker: SinrLiveCellHandoverEventIndexWorkerTransport | null = null;
    let workerAbortController: AbortController | null = null;
    const scheduleIdle = (cb: (deadline?: IdleDeadlineLike) => void): void => {
      if (typeof ric === 'function') {
        idleHandle = ric(cb, { timeout: 2000 });
      } else {
        timeoutHandle = window.setTimeout(() => cb(undefined), 0);
      }
    };

    if (sceneLane === 'sinr-live') {
      // The acceptance controls need a cadence fine enough to retain short
      // same-satellite intra transitions. Thirty-second samples can skip a real
      // engine commit; 2 seconds matches the checked multi-candidate diagnostic
      // cadence while the incremental batches still yield to the live canvas.
      const STEP_BATCH = 12;
      let builder: SinrLiveCellHandoverEventIndexBuilder | null = null;
      const buildInput = {
        profile: effectiveProfile,
        epochUtcMs: runtime.replay.epochUtcMs,
        // D4 S3a: match the live multi-candidate authority's fine source
        // cadence so short intra commits are present in the index.
        simStepSec: 2,
        ueCount: runtime.ueCount,
        ueDistributionMode: runtime.ueDistributionMode,
        uePrimaryAnchorMode: runtime.uePrimaryAnchorMode,
        ueDistributionScope: runtime.ueDistributionScope,
        ueDistributionRadiusKm: runtime.ueDistributionRadiusKm,
        ueMobilityMode: runtime.ueMobilityMode,
        ueMobilityParams: runtime.ueMobilityParams,
        // Teaching navigation follows the same live cell truth but records
        // only the protagonist. The rendered homepage can keep its full UE
        // population; this scope prevents unrelated secondary-UE history
        // from delaying the 1/7-cell teaching controls.
        eventUeScope: runtime.focusCellId === null || runtime.focusCellId === undefined
          ? 'primary-ue-only' as const
          : 'cell-truth-ue-events' as const,
        focusCellId: runtime.focusCellId ?? null,
        beamCountBySatellite: runtime.beamCountBySatellite,
        servingBeamCount: runtime.servingBeamCount,
        candidateBeamCount: runtime.candidateBeamCount,
        beamHoppingEnabled: runtime.beamHoppingEnabled,
        // The acceptance buttons must resolve against the same steering and
        // multi-candidate authority path that renders the live scene.
        beamPointingMode: 'sampled-steering' as const,
        multiCandidateDecisionEnabled: true,
        eeThresholdKbitPerJoule: runtime.eeThresholdKbitPerJoule,
        // The event index must use the exact primary-UE source geometry that
        // the live scene receives through `runtime`, otherwise its natural
        // intra/inter timeline is a different simulation.
        primaryJogEastKm: runtime.primaryJogEastKm,
        primaryJogNorthKm: runtime.primaryJogNorthKm,
      };
      const runBatch = (): void => {
        if (cancelled) return;
        if (builder === null) {
          builder = createSinrLiveCellHandoverEventIndexBuilder(buildInput);
        }
        if (builder.runSlice(STEP_BATCH)) {
          if (!cancelled) {
            setLiveWalkerHandoverEventIndex(builder.finalize());
            setLiveWalkerHandoverEventIndexBuilding(false);
          }
          return;
        }
        // Continue on a MACROTASK, not requestIdleCallback: the live scene's
        // continuous rAF render keeps the page non-idle, so rIC slices would only
        // fire on their 2s timeout and the 240-step scan would take minutes.
        // setTimeout(0) fires every macrotask and still yields a paint between
        // batches (macrotasks run after rendering in the event loop).
        timeoutHandle = window.setTimeout(runBatch, 0);
      };
      // The complete 100-UE index is an offline scan. Keep it off the UI thread
      // when module Workers are available so the live carrier can continue to
      // render and the acceptance buttons become usable without a multi-minute
      // main-thread stall. The chunked builder remains the deterministic fallback
      // for SSR/test environments and browsers that do not expose Worker.
      try {
        indexWorker = createSinrLiveCellHandoverEventIndexWorkerTransport();
      } catch {
        // A browser may expose Worker while refusing module construction (for
        // example under a restrictive CSP). Treat that as an unavailable
        // accelerator and retain the deterministic chunked path below.
        indexWorker = null;
      }
      if (indexWorker !== null) {
        workerAbortController = new AbortController();
        indexWorker.build(buildInput, { signal: workerAbortController.signal })
          .then(index => {
            if (cancelled) return;
            setLiveWalkerHandoverEventIndex(index);
            setLiveWalkerHandoverEventIndexBuilding(false);
          })
          .catch(error => {
            // Abort/supersede is expected during parameter changes. A genuine
            // Worker failure falls back to the same byte-identical chunked
            // builder rather than leaving the rail without an index.
            if (cancelled) return;
            if (error instanceof Error && error.name === 'SinrLiveCellHandoverEventIndexWorkerError'
              && 'code' in error && (error as { code?: string }).code === 'CANCELLED') {
              return;
            }
            runBatch();
          });
      } else {
        // Kick the first (trajectory-building, heavier) batch off idle so the
        // live scene paints first; the macrotask chain then drives the rest.
        scheduleIdle(runBatch);
      }
    } else {
      const buildModqnIndex = (): void => {
        if (cancelled) return;
        const index = buildLiveWalkerHandoverEventIndex({
          profile: effectiveProfile,
          epochUtcMs: runtime.replay.epochUtcMs,
          claimKind: 'overlay-demo',
          ueDistributionMode: runtime.ueDistributionMode,
          uePrimaryAnchorMode: runtime.uePrimaryAnchorMode,
          ueDistributionScope: runtime.ueDistributionScope,
          ueDistributionRadiusKm: runtime.ueDistributionRadiusKm,
          ueMobilityMode: runtime.ueMobilityMode,
          ueMobilityParams: runtime.ueMobilityParams,
        });
        if (!cancelled) {
          setLiveWalkerHandoverEventIndex(index);
          setLiveWalkerHandoverEventIndexBuilding(false);
        }
      };
      scheduleIdle(buildModqnIndex);
    }

    return () => {
      cancelled = true;
      workerAbortController?.abort();
      indexWorker?.dispose();
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
    runtime.focusCellId,
    runtime.beamCountBySatellite,
    runtime.servingBeamCount,
    runtime.candidateBeamCount,
    runtime.beamHoppingEnabled,
    runtime.eeThresholdKbitPerJoule,
    runtime.primaryJogEastKm,
    runtime.primaryJogNorthKm,
    runtime.replay.epochUtcMs,
    isWalkerSceneActive,
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

  const timelineCore = useMemo(() => deriveAppTimelineCore({
    sceneLane,
    sceneSource,
    isRootHomepage,
    isWalkerSceneActive,
    isArchivedTleSceneActive,
    demoStartOffsetSec: demoStartOffset,
    liveDurationSec: LIVE_SIM_TIMELINE_DURATION_SEC,
    liveSimTimeSec: simState.simTimeSec,
    artifactCurrentTimeSec: currentTimeSec,
    showcaseArtifact,
    modqnReplayEnvelope,
    modqnReplayShellModel,
    modqnReplayVisualElapsedSec,
    renderedModqnReplayCurrentTimeSec: renderedModqnReplayDisplayState?.currentSlot.focusRow.timeSec,
    bundleProvenanceKind,
    liveWalkerHandoverEventIndex,
    liveWalkerHandoverEventIndexBuilding,
    focusedUeId: simState.primaryUeId,
    archivedTleRunReady: homepageCanonicalAnalysis.runReady ?? false,
    archivedTleDurationSec: homepageCanonicalAnalysis.timelineDurationSec ?? 7200,
    archivedTleCurrentTimeSec: homepageCanonicalAnalysis.timelineCurrentTimeSec ?? 0,
    archivedTleStepSec: homepageCanonicalAnalysis.timelineStepSec ?? 30,
  }), [
    bundleProvenanceKind,
    currentTimeSec,
    demoStartOffset,
    homepageCanonicalAnalysis.runReady,
    homepageCanonicalAnalysis.timelineCurrentTimeSec,
    homepageCanonicalAnalysis.timelineDurationSec,
    homepageCanonicalAnalysis.timelineStepSec,
    isArchivedTleSceneActive,
    isRootHomepage,
    isWalkerSceneActive,
    liveWalkerHandoverEventIndex,
    liveWalkerHandoverEventIndexBuilding,
    modqnReplayEnvelope,
    modqnReplayShellModel,
    modqnReplayVisualElapsedSec,
    renderedModqnReplayDisplayState?.currentSlot.focusRow.timeSec,
    sceneLane,
    sceneSource,
    showcaseArtifact,
    simState.primaryUeId,
    simState.simTimeSec,
  ]);
  const {
    artifactHandoverRailEvents,
    liveWalkerHandoverRailEvents,
    liveWalkerDirectorHandoverRailEvents,
    automaticIntraPresentationSlots,
    liveTimelineWindowStartSec,
    timelineRailDescriptor,
    activeTimelineDescriptor,
    timelineDurationSec,
    timelineCurrentTimeSec,
  } = timelineCore;
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
  const timelineRailProjection = useMemo(() => deriveAppTimelineRailProjection({
    sceneLane,
    sceneSource,
    isRootHomepage,
    isWalkerSceneActive,
    isArchivedTleSceneActive,
    timelineDurationSec,
    liveWalkerHandoverEventIndexBuilding,
    liveWalkerHandoverEventIndex,
    focusedUeId: simState.primaryUeId,
    liveObservedHandoverRailEvents,
    core: timelineCore,
  }), [
    isArchivedTleSceneActive,
    isRootHomepage,
    isWalkerSceneActive,
    liveObservedHandoverRailEvents,
    liveWalkerHandoverEventIndex,
    liveWalkerHandoverEventIndexBuilding,
    sceneLane,
    sceneSource,
    simState.primaryUeId,
    timelineCore,
    timelineDurationSec,
  ]);
  const {
    handoverRailEvents,
    homepageTimelineEventMarkers,
    homepageDemoWindow,
    homepageDirectorHandoverRailEvents,
    homepageIndexedStoryRoute,
    liveWalkerDirectorHandoverEventsForButtons,
  } = timelineRailProjection;
  const timelineDisabled = deriveAppTimelineDisabled({
    isWalkerSceneActive,
    manualHandoverRequested: manualHandoverRequest !== null,
    isArchivedTleSceneActive,
    archivedTleRunReady: homepageCanonicalAnalysis.runReady ?? false,
    sceneSource,
    replayControllerReady: replayController !== null,
    showcaseLoading,
    showcaseError,
    timelineDurationSec,
  });
  const archivedTleTimelineCurrentTimeRef = useRef(timelineCurrentTimeSec);
  archivedTleTimelineCurrentTimeRef.current = timelineCurrentTimeSec;
  const archivedTleSelectTimelineTimeRef = useRef<((targetSec: number) => void) | undefined>(
    homepageCanonicalAnalysis.selectTimelineTimeSec,
  );
  archivedTleSelectTimelineTimeRef.current = homepageCanonicalAnalysis.selectTimelineTimeSec;
  // The event index is an acceptance/quick-jump aid, not a prerequisite for
  // the live Walker simulation.  It is built in a Worker (or yielded slices)
  // after the first paint; blocking the transport here made the homepage look
  // frozen behind `Updating event index…` even though the scene itself was
  // already drawable.  Keep the two jump buttons gated by their own index
  // readiness, but let play/seek and the live satellite field start at once.
  // Archived-TLE homepage playback advances only inside the already-published
  // two-hour run. The lower/upper 30-second SGP4 anchors bracket a continuous
  // display interpolation; no browser-time propagation or uncomputed seek is
  // introduced. All other lanes keep their existing transport loops.
  useEffect(() => {
    if (
      sceneLane !== 'sinr-live'
      || !isArchivedTleSceneActive
      || !(homepageCanonicalAnalysis.runReady ?? false)
      || playback.paused
      || timelineDurationSec <= 0
      || typeof window === 'undefined'
    ) {
      return;
    }

    const initialTimeSec = archivedTleTimelineCurrentTimeRef.current;
    const playbackStart = resolveArchivedTlePlaybackStart(initialTimeSec, timelineDurationSec);
    if (playbackStart.restarted) {
      // Play after the final anchor is an explicit replay request. Update both
      // refs before the first RAF so the effect cannot immediately observe the
      // stale end cursor and pause itself again.
      archivedTleTimelineCurrentTimeRef.current = playbackStart.currentTimeSec;
      archivedTleSelectTimelineTimeRef.current?.(playbackStart.currentTimeSec);
    }

    let lastTimeMs = performance.now();
    // React may batch the anchor-state update for several RAF callbacks. Keep
    // a local source-time cursor so playback still advances between commits;
    // the ref is consulted only to detect an external scrub/anchor jump.
    let playbackCursorSec = playbackStart.currentTimeSec;
    let lastRequestedTimeSec = playbackStart.currentTimeSec;
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
    isArchivedTleSceneActive,
    sceneLane,
    timelineDurationSec,
  ]);

  const requestLiveTimelineSeek = useCallback((request: LiveTimelineSeekRequest) => {
    // The archived-TLE homepage has no live Walker seek path. Keep every
    // caller (including the legacy Director wrapper) on the same published
    // anchor selector so it cannot accidentally rebase the live simulator.
    if (isArchivedTleSceneActive) {
      if (homepageCanonicalAnalysis.runReady ?? false) {
        homepageCanonicalAnalysis.selectTimelineTimeSec?.(request.targetSec);
      }
      return;
    }
    resetAnalysisWindow();
    setLiveTimelineSeekRequest(request);
  }, [homepageCanonicalAnalysis, isArchivedTleSceneActive, resetAnalysisWindow]);

  const handleTimelineSeek = useCallback((
    targetSec: number,
    options: { readonly sourceHistoryReplay?: boolean } = {},
  ) => {
    // A manual seek starts a new navigation intent. The Demo handler sets its
    // bounded end marker again after this canonical transport request.
    setHomepageDemoRunEndSec(null);
    const target = clampTimelineTime(targetSec, timelineDurationSec);
    // PlaybackTransport acknowledges the homepage command but never owns the
    // source cursor. The canonical source-specific seek paths below remain the
    // only writers of simulation time.
    const transportTarget = isRootHomepage
      ? homepagePlayback.requestSeek(target)
      : target;
    // Archived-TLE homepage: the hook owns the published anchor and the
    // canonical frame. Never route this surface through Walker rebase/seek or
    // reset the live analysis window; a seek selects only an already-computed
    // 30-second anchor from the immutable run.
    if (isArchivedTleSceneActive) {
      if (homepageCanonicalAnalysis.runReady ?? false) {
        homepageCanonicalAnalysis.selectTimelineTimeSec?.(transportTarget);
      }
      return;
    }
    if (sceneSource === 'artifact-replay') {
      resetAnalysisWindow();
      replayController?.seek(transportTarget);
      return;
    }
    if (timelineRailDescriptor.timeline.axisKind === 'display-stretched') {
      resetAnalysisWindow();
      setModqnReplayVisualElapsedSec(clampTimelineTime(transportTarget, timelineRailDescriptor.timeline.axisDurationSec));
      return;
    }
    if (sceneLane === 'modqn-replay-proof') {
      resetAnalysisWindow();
      const railAxisDurationSec = timelineRailDescriptor.rail.axisDurationSec;
      const visualTargetSec = timelineDurationSec > 0 && railAxisDurationSec > 0
        ? (transportTarget / timelineDurationSec) * railAxisDurationSec
        : transportTarget;
      setModqnReplayVisualElapsedSec(clampTimelineTime(visualTargetSec, railAxisDurationSec));
      return;
    }

    // The visible live timeline starts at the profile's demo offset, but its
    // source horizon still ends at the 7200s Walker cache boundary. Without
    // this clamp, the rightmost jump sends `startOffset + duration` into the
    // loop normalizer, which wraps it back to the demo start.
    const absoluteTargetSec = Math.min(
      liveTimelineWindowStartSec + transportTarget,
      LIVE_SIM_TIMELINE_DURATION_SEC,
    );
    requestLiveTimelineSeek({
      targetSec: absoluteTargetSec,
      requestKey: `${absoluteTargetSec.toFixed(3)}:${Date.now().toString(36)}`,
      ...(options.sourceHistoryReplay === true ? { sourceHistoryReplay: true } : {}),
    });
    setLiveObservedHandoverRailEvents([]);
    setModqnReplayVisualElapsedSec(transportTarget);
  }, [
    homepagePlayback.requestSeek,
    isRootHomepage,
    resetAnalysisWindow,
    homepageCanonicalAnalysis,
    isArchivedTleSceneActive,
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

  const { directorFocusEnabled, directorInterEnabled, directorCinematicEnabled, directorCinematicInterEnabled, directorCinematicIntraEnabled } = useDirectorModes({ artifactHandoverRailEvents, handoverRailEvents, isWalkerSceneActive, liveWalkerDirectorHandoverEventsForButtons, liveWalkerHandoverEventIndexBuilding, replayController, sceneLane, sceneSource, showcaseError, showcaseLoading, timelineRailDescriptor });

  // G1 / Rule#8: a focus button is offered only when the source-backed rail
  // actually carries a handover event of that kind. While a left-side control
  // is rebuilding the index, the old snapshot stays visible but is not
  // actionable; this keeps the scene/rail/button source identity atomic.
  
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
  
  
  
  // The next-event buttons prefer the source-backed index. If the current
  // parameter set has no indexed same-satellite row, keep Next Intra
  // actionable through the existing real UE-jog path rather than leaving a
  // dead button in the top bar. During a rebuild, the homepage still has a
  // valid live fallback: it must win command admission before the queue path,
  // otherwise a click becomes invisible until a long index build completes.
  const directorIntraQueueable = directorFocusEnabled
    && liveWalkerHandoverEventIndexBuilding;
  const directorInterQueueable = directorFocusEnabled
    && liveWalkerHandoverEventIndexBuilding;
  const directorInterButtonEnabled = directorInterEnabled
    || directorCinematicInterEnabled
    || directorInterQueueable;
  const directorIntraIndexedEnabled =
    directorCinematicIntraEnabled
    || (directorFocusEnabled
      && !liveWalkerHandoverEventIndexBuilding
      && liveWalkerDirectorHandoverEventsForButtons.some(event => event.kind === 'intra'));
  const liveIntraFallbackEnabled = sceneSource === 'live-sim' && isWalkerSceneActive;
  const directorNextIntraEnabled = homepageIndexedStoryRoute
    ? directorIntraIndexedEnabled || directorIntraQueueable
    : directorIntraIndexedEnabled || liveIntraFallbackEnabled;
  const directorIntraTriggerEnabled = liveIntraFallbackEnabled;
  const directorNextIntraMode: 'indexed' | 'real-trigger' = homepageIndexedStoryRoute
    ? 'indexed'
    : liveIntraFallbackEnabled && !directorIntraIndexedEnabled ? 'real-trigger' : 'indexed';

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
    liveWalkerHandoverRailEvents: homepageDirectorHandoverRailEvents,
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
  // A topology edit can leave the old presentation owner busy for the one
  // React commit in which the replacement event index is already rebuilding.
  // On the homepage that state is a valid command queue window, not a reason
  // to make Next Intra/Inter silently inert. The queued intent still waits for
  // the current source index and the existing cinema owner; this only changes
  // command admission at the integration boundary.
  const homepageHandoverQueueOpen = isRootHomepage
    && (directorIntraQueueable || directorInterQueueable);
  const handoverCommandBusy = handoverControlBusy && !homepageHandoverQueueOpen;

  const homepageDemoWindowButtonEnabled = isRootHomepage
    && sceneSource === 'live-sim'
    && isWalkerSceneActive
    && sceneLane === 'sinr-live'
    && homepageDemoWindow !== null
    && !liveWalkerHandoverEventIndexBuilding
    && !timelineDisabled;
  const handleHomepageTeachingRevealDetails = useCallback(() => {
    setHomepageTeachingDetailsVisible(true);
  }, []);
  const handleHomepageTeachingSeekSource = useCallback((sourceTimeSec: number, pause: boolean) => {
    const targetSourceSec = homepageDemoWindow === null
      ? Math.max(0, sourceTimeSec)
      : Math.min(
        Math.max(sourceTimeSec, homepageDemoWindow.leadInSec),
        homepageDemoWindow.endSec,
      );
    const visibleTargetSec = clampTimelineTime(
      targetSourceSec - liveTimelineWindowStartSec,
      timelineDurationSec,
    );
    handleTimelineSeek(visibleTargetSec, { sourceHistoryReplay: true });
    if (pause) playback.setPaused(true);
  }, [
    handleTimelineSeek,
    homepageDemoWindow,
    liveTimelineWindowStartSec,
    playback,
    timelineDurationSec,
  ]);
  const handleHomepageTeachingEnd = useCallback(() => {
    if (homepageDemoWindow !== null) {
      handleHomepageTeachingSeekSource(homepageDemoWindow.endSec, true);
    }
    setHomepageDemoRunEndSec(null);
    setHomepageTeachingActive(false);
    setHomepageTeachingDetailsVisible(false);
    playback.setPaused(true);
  }, [handleHomepageTeachingSeekSource, homepageDemoWindow, playback]);
  useEffect(() => {
    if (!isRootHomepage || homepageDemoRunEndSec === null) return;
    if (!Number.isFinite(simState.simTimeSec) || simState.simTimeSec < homepageDemoRunEndSec) return;
    setHomepageDemoRunEndSec(null);
    setHomepageTeachingActive(false);
    setHomepageTeachingDetailsVisible(false);
    if (!playback.paused) playback.setPaused(true);
  }, [homepageDemoRunEndSec, isRootHomepage, playback.paused, playback.setPaused, simState.simTimeSec]);
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
  // Scene configuration changes rebuild the Walker source/index under a new
  // topology reset key. Release every presentation-only claim from the old
  // epoch before the replacement index can publish: otherwise a stale camera
  // phase, manual cue, or busy ref makes Next Intra/Inter look disabled even
  // though the new configuration is ready to accept a command. This effect
  // owns no clock, candidate ranking, or handover truth; it only performs the
  // existing cancellation/exit handoff at the integration boundary.
  useEffect(() => {
    const previousKey = previousSceneTopologyResetKeyRef.current;
    if (previousKey === sceneTopologyResetKey) return;
    previousSceneTopologyResetKeyRef.current = sceneTopologyResetKey;
    pendingDirectorJumpKindRef.current = null;
    cancelPendingLiveFocus();
    handoverCinema.exit();
    setManualHandoverRequest(null);
    handoverPresentationBusyRef.current = false;
    handoverControlBusyRef.current = false;
    handoverBusyRef.current = false;
  }, [cancelPendingLiveFocus, handoverCinema.exit, sceneTopologyResetKey]);
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
    intraDemoAwaitingMeasuredFrameRef.current = true;
    const fallbackJogEastKm = isRootHomepage && sceneLane === 'sinr-live'
      ? HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM.east
      : 28;
    setPrimaryUeJogKm(prev => (prev.east === 0
      ? { east: fallbackJogEastKm, north: 0 }
      : { east: 0, north: 0 }));
  }, [isRootHomepage, sceneLane]);

  /**
   * Homepage Phase 1 control path: jump into the already-indexed source event
   * and let the existing scene/presentation owner render it.  The old root
   * path additionally armed camera cinema, which forced a 10-second lead-in at
   * 0.25x before the same source story became visible.  This route-local shortcut
   * keeps the canonical transport/source seek and removes only that optional
   * camera wrapper; it does not select a candidate or create a presentation.
   */
  const jumpHomepageToIndexedEvent = useCallback((kind: 'intra' | 'inter'): boolean => {
    if (
      !homepageIndexedStoryRoute
      || homepageDemoWindow === null
      || liveWalkerHandoverEventIndexBuilding
      || camera.directorPhase !== 'idle'
      || manualHandoverRequest !== null
    ) return false;
    const event = homepageDemoWindow.events.find(candidate => candidate.kind === kind);
    if (event === undefined) return false;
    const sourceTargetSec = resolveHomepageQuickJumpSourceSec(event);
    if (sourceTargetSec === null) return false;
    pendingDirectorJumpKindRef.current = null;
    cancelPendingLiveFocus();
    camera.exitDirectorFocus();
    setHomepageTeachingActive(true);
    setHomepageTeachingDetailsVisible(true);
    const visibleTargetSec = clampTimelineTime(
      sourceTargetSec - liveTimelineWindowStartSec,
      timelineDurationSec,
    );
    handleTimelineSeek(visibleTargetSec, { sourceHistoryReplay: true });
    // The button is a teaching entry point, so it owns the rate as well as the
    // seek. At the homepage's 5x default the whole EE-decline -> threshold ->
    // TTT chain plays out in about two seconds, which is why the story reads as
    // an outcome rather than a decision. Display-only: dt scales in lockstep and
    // no decision evidence moves. The speed presets remain the escape hatch.
    playback.setSpeed(HOMEPAGE_TEACHING_PLAYBACK_SPEED);
    if (playback.paused) playback.setPaused(false);
    return true;
  }, [
    camera,
    cancelPendingLiveFocus,
    handleTimelineSeek,
    homepageDemoWindow,
    homepageIndexedStoryRoute,
    liveTimelineWindowStartSec,
    liveWalkerHandoverEventIndexBuilding,
    manualHandoverRequest,
    playback,
    timelineDurationSec,
  ]);

  const handleDirectorNextIntra = useCallback(() => {
    if (handoverBusyRef.current && !homepageHandoverQueueOpen) return;
    if (homepageIndexedStoryRoute && directorIntraQueueable) {
      pendingDirectorJumpKindRef.current = createHomepageHandoverJumpIntent('intra');
      return;
    }
    if (directorIntraIndexedEnabled) {
      if (homepageIndexedStoryRoute) {
        jumpHomepageToIndexedEvent('intra');
        return;
      }
      handoverCinema.armIntra();
      return;
    }
    if (!homepageIndexedStoryRoute && liveIntraFallbackEnabled && !handoverBusyRef.current) {
      // The jog remains the real engine fallback, but when the current source
      // frame already exposes a measured same-satellite alternate beam, route
      // the click through the existing manual presentation owner immediately.
      // This prevents a valid intra cue from becoming a silent UE movement while
      // keeping the cell model and decision engine as the only truth sources.
      if (!requestMovingIntraDemo('button')) triggerPrimaryIntra();
      return;
    }
    if (directorIntraQueueable) {
      pendingDirectorJumpKindRef.current = createHomepageHandoverJumpIntent('intra');
    }
  }, [directorIntraIndexedEnabled, directorIntraQueueable, handoverCinema.armIntra, homepageIndexedStoryRoute, homepageHandoverQueueOpen, jumpHomepageToIndexedEvent, liveIntraFallbackEnabled, requestMovingIntraDemo, triggerPrimaryIntra]);
  const teachingInterRosterSatelliteIds = useMemo(
    () => deriveTeachingInterRosterSatelliteIds({ projection: homepageRailProjection }),
    [homepageRailProjection],
  );
  const teachingIntraSatelliteId = useMemo(
    () => resolveTeachingIntraSatelliteId({
      projection: homepageRailProjection,
      servingSatelliteId: simState.servingSatId,
      teachingInterRosterSatelliteIds,
    }),
    [homepageRailProjection, simState.servingSatId, teachingInterRosterSatelliteIds],
  );
  const teachingIdentityBinding = useMemo(
    () => deriveTeachingIdentityBinding({
      projection: homepageRailProjection,
      homepageSatelliteNameById,
      teachingStageKind,
      teachingInterRosterSatelliteIds,
      servingElevationDeg: simState.servingElevationDeg,
      comparisonElevationDeg: simState.comparisonElevationDeg,
    }),
    [
      homepageRailProjection,
      homepageSatelliteNameById,
      teachingInterRosterSatelliteIds,
      simState.comparisonElevationDeg,
      simState.servingElevationDeg,
      teachingIntraSatelliteId,
      teachingStageKind,
    ],
  );
  const teachingLecture = useHandoverTeachingLecture(teachingStageKind, teachingIdentityBinding);
  const restartTeachingLecture = teachingLecture.restart;
  // The rail, the caption and the scene's teaching cones all read THIS frame.
  // It is handed to the scene by reference so a 60 Hz lecture clock cannot drag
  // the whole scene tree through a React render on every tick.
  const teachingLectureFrameRef = useRef<TeachingFrame | null>(null);
  teachingLectureFrameRef.current = teachingLecture.frame;
  /**
   * The two live identities the lecture's cones attach to.
   *
   * Authored numbers, live geometry: the endpoints are the same ones the rail
   * names, resolved from the accepted projection rather than from any handover
   * the model measured — a lecture is an authored story and the live lane never
   * produces one to borrow.
   */
  const teachingSceneStoryCandidate = useMemo(
    () => deriveTeachingSceneStoryCandidate({
      teachingStageKind,
      projection: homepageRailProjection,
      servingSatelliteId: simState.servingSatId,
      servingCellId: simState.servingCellId,
      teachingInterRosterSatelliteIds,
      servingBeamCount: runtime.servingBeamCount,
    }),
    [
      homepageRailProjection,
      runtime.servingBeamCount,
      simState.homepageBeamMetrics,
      simState.servingCellId,
      simState.servingSatId,
      teachingIntraSatelliteId,
      teachingInterRosterSatelliteIds,
      teachingStageKind,
    ],
  );
  // The live roster keeps re-ranking underneath the lecture, so recomputing the
  // endpoints every frame let the transfer change which spacecraft it was aimed
  // at halfway through the narration. Latch the pair for the run, exactly as the
  // inter cinema latches its own pair anchor.
  const teachingSceneStoryLatchRef = useRef<{
    readonly runKey: string;
    readonly story: HandoverTeachingSceneStory;
  } | null>(null);
  const teachingRunKey = teachingStageKind === null
    ? null
    : `${teachingStageKind}:${teachingLecture.runId}`;
  const teachingSceneStory = useMemo<HandoverTeachingSceneStory | null>(() => {
    if (teachingRunKey === null) {
      teachingSceneStoryLatchRef.current = null;
      return null;
    }
    const latched = teachingSceneStoryLatchRef.current;
    if (latched !== null && latched.runKey === teachingRunKey) return latched.story;
    if (teachingSceneStoryCandidate === null) return null;
    teachingSceneStoryLatchRef.current = {
      runKey: teachingRunKey,
      story: teachingSceneStoryCandidate,
    };
    return teachingSceneStoryCandidate;
  }, [teachingRunKey, teachingSceneStoryCandidate]);

  /**
   * The self-contained visual interlude the two buttons have always used on
   * other lanes: pause the source timeline, show the two demo cones in the NTPU
   * scene, then return to the exact pre-click playback state. It adds nothing
   * to the natural handover event index. Unconditional on purpose — the lecture
   * decides when the switch happens, so this must not second-guess it with the
   * live scene's own preconditions.
   *
   * The endpoints are the LECTURE's, not live evidence: a scripted run never
   * asks the model for a handover, so the scene's demo resolver has no measured
   * alternate link and would fail closed on every frame. They still have to be
   * identities the render already carries, or the scene drops the pair as
   * undrawable.
   */
  const requestManualHandover = useCallback((kind: 'intra' | 'inter'): void => {
    manualHandoverWasPausedRef.current = playback.paused;
    playback.setPaused(true);
    manualHandoverRequestSeqRef.current += 1;
    const servingLink = homepageRailProjection?.serving ?? null;
    const sourceSatId = simState.servingSatId ?? servingLink?.satelliteId ?? null;
    const sourceCellId = simState.servingCellId
      ?? (servingLink === null ? null : servingLink.beamId - 1);
    // The rail publishes one-based beam ids; scene geometry is zero-based cells.
    const servingBeamId = servingLink?.beamId
      ?? (sourceCellId === null ? null : sourceCellId + 1);
    // Intra re-points inside one spacecraft, so the target is the first
    // alternate beam the rail already lists for it — the same row the lecture's
    // winner names. With no published beam metric, step to the next cell in the
    // configured layout so the story still has two drawable endpoints.
    const intraTargetCellId = sourceSatId === null || sourceCellId === null
      ? null
      : (simState.homepageBeamMetrics?.metrics ?? [])
        .filter(metric => metric.satelliteId === sourceSatId && metric.beamId !== servingBeamId)
        .map(metric => metric.beamId - 1)
        .find(cellId => Number.isInteger(cellId) && cellId !== sourceCellId)
        ?? (sourceCellId + 1) % resolveSinrLiveSceneCellCount(runtime.servingBeamCount);
    // Inter keeps the earth-fixed cell and changes only the apex spacecraft.
    const interTargetSatId = teachingInterRosterSatelliteIds
      .find(satelliteId => satelliteId !== sourceSatId) ?? null;
    // The rail tells this story in EE; these only have to be finite for the
    // scene resolver, so they carry the live serving sample and a candidate
    // that leads it by the same margin the narration claims.
    const servingSinrDb = Number.isFinite(simState.sinrDb) ? simState.sinrDb : 0;
    const liveCandidateSinrDb = simState.comparisonSinrDb;
    const candidateSinrDb = liveCandidateSinrDb !== null
      && Number.isFinite(liveCandidateSinrDb)
      && liveCandidateSinrDb > servingSinrDb
      ? liveCandidateSinrDb
      : servingSinrDb + TEACHING_MANUAL_CANDIDATE_LEAD_DB;
    const teachingEndpoints: TeachingHandoverEndpoints | null =
      teachingStageKind === null || sourceSatId === null || sourceCellId === null
        ? null
        : kind === 'inter'
          ? interTargetSatId === null
            ? null
            : { sourceSatId, sourceCellId, targetSatId: interTargetSatId, servingSinrDb, candidateSinrDb }
          : intraTargetCellId === null || intraTargetCellId === sourceCellId
            ? null
            : { sourceSatId, sourceCellId, targetCellId: intraTargetCellId, servingSinrDb, candidateSinrDb };
    setManualHandoverRequest({
      id: manualHandoverRequestSeqRef.current,
      kind,
      startedAtMs: typeof performance === 'undefined' ? Date.now() : performance.now(),
      origin: 'button',
      // The lecture owns the story, so the scene does not need the live
      // intra-presentation sample the fallback path resolves for itself.
      intraPresentation: null,
      teachingEndpoints,
    });
  }, [
    homepageRailProjection,
    playback,
    runtime.servingBeamCount,
    simState.comparisonSinrDb,
    simState.homepageBeamMetrics,
    simState.servingCellId,
    simState.servingSatId,
    simState.sinrDb,
    teachingInterRosterSatelliteIds,
    teachingStageKind,
  ]);

  /**
   * Open one handover lecture.
   *
   * The live Walker scenario keeps the primary UE's serving link both above the
   * EE floor and above every replacement, so it never satisfies the homepage's
   * handover rule and produces no event to narrate. The lecture therefore runs
   * on its own authored timeline rather than on that scenario. It is a separate
   * surface with a single data owner, so its diagram and its rail cannot
   * disagree; the live lane keeps running untouched underneath it.
   *
   * A click during a run is a restart, never a no-op: the previous run's scene
   * interlude is dropped so a still-visible cue from the other kind cannot
   * outlive the story that asked for it.
   */
  const openHandoverTeachingStage = useCallback((kind: TeachingHandoverKind): void => {
    setManualHandoverRequest(null);
    // A same-kind click leaves `kind` unchanged, so the lecture's own arm effect
    // never fires; restarting explicitly is what re-arms the switching beat.
    if (teachingStageKind === kind) restartTeachingLecture();
    setTeachingStageKind(kind);
    // The lecture is paced in real seconds; the scene must not fly past it.
    playback.setSpeed(HOMEPAGE_TEACHING_PLAYBACK_SPEED);
    if (playback.paused) playback.setPaused(false);
  }, [playback, restartTeachingLecture, teachingStageKind]);

  // Fire the scene interlude on the lecture's switching beat rather than on the
  // click, so the cones change at the moment the narration says they do. One
  // shot per run: the ref is keyed to the lecture, not to the phase, so a pause
  // or a re-render inside the beat cannot retrigger it.
  const teachingSwitchFiredForRef = useRef<string | null>(null);
  const teachingPhaseId = teachingLecture.frame?.phase.id ?? null;
  useEffect(() => {
    if (teachingStageKind === null) {
      teachingSwitchFiredForRef.current = null;
      return;
    }
    if (teachingPhaseId !== 'switching') return;
    const runKey = `${teachingStageKind}:${teachingLecture.runId}`;
    if (teachingSwitchFiredForRef.current === runKey) return;
    teachingSwitchFiredForRef.current = runKey;
    requestManualHandover(teachingStageKind);
  }, [requestManualHandover, teachingLecture.runId, teachingPhaseId, teachingStageKind]);

  const handleQuickIntra = useCallback(() => {
    // The homepage buttons own a scripted teaching story, not an index seek.
    if (isRootHomepage) {
      openHandoverTeachingStage('intra');
      return;
    }
    if (handoverBusyRef.current && !homepageHandoverQueueOpen) return;
    if (homepageIndexedStoryRoute && directorIntraQueueable) {
      pendingDirectorJumpKindRef.current = createHomepageHandoverJumpIntent('intra');
      return;
    }
    if (directorIntraIndexedEnabled) {
      if (homepageIndexedStoryRoute) {
        jumpHomepageToIndexedEvent('intra');
        return;
      }
      handoverCinema.armIntra();
      return;
    }
    if (!homepageIndexedStoryRoute && liveIntraFallbackEnabled && !handoverBusyRef.current) {
      if (!requestMovingIntraDemo('button')) triggerPrimaryIntra();
      return;
    }
    if (directorIntraQueueable) {
      pendingDirectorJumpKindRef.current = createHomepageHandoverJumpIntent('intra');
    }
  }, [openHandoverTeachingStage, directorIntraIndexedEnabled, directorIntraQueueable, handoverCinema.armIntra, homepageIndexedStoryRoute, homepageHandoverQueueOpen, isRootHomepage, jumpHomepageToIndexedEvent, liveIntraFallbackEnabled, requestMovingIntraDemo, triggerPrimaryIntra]);
  const handleDirectorNextInter = useCallback(() => {
    if (handoverBusyRef.current && !homepageHandoverQueueOpen) return;
    if (directorInterQueueable) {
      pendingDirectorJumpKindRef.current = createHomepageHandoverJumpIntent('inter');
      return;
    }
    if (homepageIndexedStoryRoute) {
      jumpHomepageToIndexedEvent('inter');
      return;
    }
    if (!directorInterButtonEnabled) return;
    handoverCinema.armInter();
  }, [directorInterButtonEnabled, directorInterQueueable, handoverCinema.armInter, homepageHandoverQueueOpen, homepageIndexedStoryRoute, jumpHomepageToIndexedEvent]);
  const handleQuickInter = useCallback(() => {
    // The homepage buttons own a scripted teaching story, not an index seek.
    if (isRootHomepage) {
      openHandoverTeachingStage('inter');
      return;
    }
    if (handoverBusyRef.current && !homepageHandoverQueueOpen) return;
    if (directorInterQueueable) {
      pendingDirectorJumpKindRef.current = createHomepageHandoverJumpIntent('inter');
      return;
    }
    if (homepageIndexedStoryRoute) {
      jumpHomepageToIndexedEvent('inter');
      return;
    }
    if (!directorInterButtonEnabled) return;
    handoverCinema.armInter();
  }, [openHandoverTeachingStage, directorInterButtonEnabled, directorInterQueueable, handoverCinema.armInter, homepageHandoverQueueOpen, homepageIndexedStoryRoute, isRootHomepage, jumpHomepageToIndexedEvent]);

  // Complete a queued click only after the current parameter index is ready.
  // The matching event still comes from the existing rail projection, and the
  // actual focus still goes through useHandoverCinema. This effect owns no
  // timing, candidate ranking, or presentation state.
  useEffect(() => {
    const intent = pendingDirectorJumpKindRef.current;
    if (intent === null || liveWalkerHandoverEventIndexBuilding || handoverControlBusy) return;
    if (homepageIndexedStoryRoute && homepageDemoWindow === null) return;
    // Resolve against the source-backed event object, not the display rail
    // row. The rail is a projection and does not carry the complete event
    // identity required by the queued-intent contract.
    const matchingEvent = liveWalkerDirectorHandoverEventsForButtons.find(
      event => event.kind === intent.kind,
    ) ?? null;
    const queuedSelection = resolveHomepageHandoverJumpIntent(
      intent,
      {
        indexBuilding: liveWalkerHandoverEventIndexBuilding,
        matchingEvent,
      },
    );
    // This command belongs to the completed rebuild. Never replay it against a
    // later, unrelated index if no matching event was produced.
    pendingDirectorJumpKindRef.current = null;
    if (queuedSelection?.kind === 'intra') {
      if (homepageIndexedStoryRoute) jumpHomepageToIndexedEvent('intra');
      else handoverCinema.armIntra();
    }
    if (queuedSelection?.kind === 'inter') {
      if (homepageIndexedStoryRoute) jumpHomepageToIndexedEvent('inter');
      else handoverCinema.armInter();
    }
  }, [
    handoverControlBusy,
    handoverCinema.armInter,
    handoverCinema.armIntra,
    homepageDemoWindow,
    homepageIndexedStoryRoute,
    jumpHomepageToIndexedEvent,
    liveWalkerHandoverEventIndex,
    liveWalkerDirectorHandoverEventsForButtons,
    liveWalkerHandoverEventIndexBuilding,
  ]);

  const directorButtonCountEvents = homepageIndexedStoryRoute
    ? liveWalkerDirectorHandoverEventsForButtons
    : liveWalkerDirectorHandoverRailEvents;

  // Keep the measured intra cue as a display-only snapshot. The pure adapter
  // does not write the live simulator state or the manual request owner.
  const intraTeachingDisplayState = useMemo(
    () => deriveIntraTeachingDisplayState({
      simState,
      visibleManualHandoverActive,
      manualHandoverRequest: manualHandoverRequest === null ? null : {
        kind: manualHandoverRequest.kind,
        intraPresentation: manualHandoverRequest.intraPresentation,
      },
    }),
    [manualHandoverRequest, simState, visibleManualHandoverActive],
  );
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
    if (sceneLane === 'sinr-live') {
      // Homepage marker jumps must rebuild the source-backed decision history,
      // just like Demo/Next.  Otherwise the seek cold-starts at the landing
      // frame and the rail reaches a handover without the candidate lead-in.
      handleTimelineSeek(
        targetSec,
        isRootHomepage ? { sourceHistoryReplay: true } : undefined,
      );
      return;
    }
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
    isRootHomepage,
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
      {/* The explicit Trigger Intra action remains seek-free and owns
          setPrimaryUeJogKm. Next Intra prefers a source-indexed event and falls
          back to that same real engine jog only when the current index has no
          intra row, so the acceptance control never becomes inert. */}
      {/* onIntraTrigger={() => setPrimaryUeJogKm(...)} */}
      {/* onIntraFocus={handoverCinema.armIntra} */}
      <DirectorControls
        intraEnabled={directorNextIntraEnabled}
        interEnabled={directorInterButtonEnabled}
        intraTriggerEnabled={directorIntraTriggerEnabled}
        nextIntraMode={directorNextIntraMode}
        handoverIndexBuilding={liveWalkerHandoverEventIndexBuilding}
        // The event count is an internal index diagnostic, not a teaching
        // control.  Keep it available to non-homepage compatibility lanes, but
        // do not put a misleading quantity beside the homepage actions.
        nextIntraCount={isRootHomepage ? undefined : directorIntraIndexedEnabled
          ? directorFocusEnabled
            ? directorButtonCountEvents.filter(event => event.kind === 'intra').length
            : handoverRailEvents.filter(event => event.kind === 'intra').length
          : undefined}
        nextInterCount={isRootHomepage ? undefined : directorFocusEnabled
          ? directorButtonCountEvents.filter(event => event.kind === 'inter').length
          : handoverRailEvents.filter(event => event.kind === 'inter').length}
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
      stepSec={isArchivedTleSceneActive ? (homepageCanonicalAnalysis.timelineStepSec ?? 30) : undefined}
      scrubStepSec={isArchivedTleSceneActive ? 1 : undefined}
      disabled={timelineDisabled}
      sourceOwner={activeTimelineDescriptor.sourceOwner}
      horizonKind={activeTimelineDescriptor.horizonKind}
      horizonLabel={activeTimelineDescriptor.horizonLabel}
      horizonSec={activeTimelineDescriptor.horizonSec}
      claimKind={activeTimelineDescriptor.claimKind}
      eventMarkers={homepageTimelineEventMarkers}
      onSelect={handleTimelineSeek}
    />
  );
  const homepageHandoverStory = homepageRailProjection?.handoverStory ?? null;
  // Temporary homepage-only review mode requested by the owner: expose every
  // currently implemented right-rail surface at once.  It is a visibility
  // switch only; the accepted snapshot remains the sole source of evidence.
  const homepageRailShowAllSurfaces = isRootHomepage
    && sceneLane === 'sinr-live'
    && isWalkerSceneActive;
  // The teaching timeline is an event readout, not a permanent playback
  // banner in normal mode. Review mode deliberately keeps its shell visible so
  // the owner can inspect and remove redundant surfaces before the next pass.
  const homepageTeachingTimeline = homepageRailShowAllSurfaces
    ? (
      <HomepageTeachingTimeline
        currentSourceTimeSec={simState.simTimeSec}
        startSourceTimeSec={homepageDemoWindow?.leadInSec ?? Math.max(0, simState.simTimeSec - 30)}
        endSourceTimeSec={homepageDemoWindow?.endSec ?? Math.max(simState.simTimeSec + 30, Math.max(0, simState.simTimeSec - 30) + 60)}
        paused={playback.paused}
        speed={playback.effectiveSpeed}
        handoverStory={homepageHandoverStory}
        satelliteNameById={homepageSatelliteNameById}
        onRevealDetails={handleHomepageTeachingRevealDetails}
        onSeekSource={handleHomepageTeachingSeekSource}
        onTogglePause={playback.togglePause}
        onEnd={handleHomepageTeachingEnd}
      />
    )
    : null;

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
    liveSimTimeSecRef.current = 0;
    walkerRuntimeHasPublishedRef.current = false;
    setStaleFormulaEvidenceKey(null);
    resetAutoSlowDismissedRef.current();
  }, [baseProfile]);

  const handleSimulationSourceChange = (nextSource: SimulationSourceMode): void => {
    if (nextSource === simulationSource) return;

    // Source changes release presentation-only ownership. Walker is fully
    // unmounted while TLE owns the scene; on return, one deterministic seek
    // reconstructs its last published timeline/serving state without a hidden
    // background Walker or handover runtime.
    cancelPendingLiveFocus();
    camera.exitDirectorFocus();
    handoverCinema.exit();
    setManualHandoverRequest(null);
    if (nextSource === 'walker' && walkerRuntimeHasPublishedRef.current) {
      const restoreTargetSec = Math.max(
        0,
        Math.min(LIVE_SIM_TIMELINE_DURATION_SEC, liveSimTimeSecRef.current),
      );
      setLiveTimelineSeekRequest({
        targetSec: restoreTargetSec,
        requestKey: `source-restore:${restoreTargetSec.toFixed(3)}:${Date.now().toString(36)}`,
      });
    } else {
      setLiveTimelineSeekRequest(null);
    }
    setSixActsSubtitle(null);
    handoverPresentationBusyRef.current = false;
    handoverControlBusyRef.current = false;
    handoverBusyRef.current = false;
    persistSimulationSourceMode(nextSource);
    setSimulationSource(nextSource);
  };

  // The root SINR homepage has one right-rail surface: the accepted snapshot
  // beam projection. Palette/live-status tabs were competing presentation
  // surfaces, so the palette moved to `/beam-colors` and this rail is mounted
  // directly for the homepage only.
  const homepageRailPanel = homepageRailShowAllSurfaces
    ? (
      <section
        className="leo-live-status-stack"
        aria-label="Homepage service and replacement beams"
        data-testid="homepage-beam-rail-panel"
        data-homepage-rail-snapshot-id={homepageRailProjection?.snapshotId ?? ''}
        data-homepage-rail-source-frame-id={homepageRailProjection?.sourceFrameId ?? ''}
        data-homepage-rail-phase={homepageRailProjection?.phase ?? ''}
      >
        {homepageRailProjection ? (
          <HomepageBeamRail
            projection={homepageRailProjection}
            acceptedSnapshotMetadata={simState.acceptedHandoverPresentation}
            satelliteNameById={homepageSatelliteNameById}
            playback={{
              paused: playback.paused,
              selectedSpeed: playback.speed,
              effectiveSpeed: playback.effectiveSpeed,
            }}
            // Root homepage handover rows/story must come from the accepted
            // snapshot projection. `visibleHandover` remains a compatibility
            // owner for non-homepage lanes, but passing it here created a
            // second homepage rail presentation authority.
            // The homepage rail is driven only by the accepted EE decision
            // snapshot. The legacy presentation owner can animate a scheduled
            // event before the serving/target threshold contract is accepted,
            // which made the UI look like a handover above the configured floor.
            handoverPresentation={isRootHomepage ? null : visibleHandover.presentation}
            eeThresholdKbitPerJoule={homepageEeThresholdKbitPerJoule}
            showAllSurfaces={homepageRailShowAllSurfaces}
          />
        ) : (
          <HomepageBeamRailWaiting />
        )}
      </section>
    )
    : null;

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
      data-simulation-source={simulationSource}
      data-active-simulation-source={isArchivedTleSceneActive ? 'archived-tle' : 'walker'}
      data-walker-source-kind="synthetic-walker"
      data-walker-constellation={activeSceneTopology.constellation}
      data-walker-scenario-local={`${walkerScenarioDate}T${walkerScenarioTime}`}
      data-walker-epoch-utc-ms={walkerScenarioEpochUtcMs.toString()}
      data-walker-primary-shell-altitude-km={effectiveProfile.orbit.shells[0]?.altitudeKm?.toString() ?? ''}
      data-walker-satellite-count={effectiveProfile.orbit.shells.reduce(
        (total, shell) => total + shell.planes * shell.satsPerPlane,
        0,
      ).toString()}
      data-walker-cell-presentation-altitude-km={resolveSinrLiveCellLayoutAltitudeKm(effectiveProfile).toString()}
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
      data-live-handover-index-building={liveWalkerHandoverEventIndexBuilding ? '1' : '0'}
      data-handover-control-busy={handoverCommandBusy ? '1' : '0'}
      data-visible-handover-kind={teachingSceneStory?.kind ?? visibleHandover.kind ?? ''}
      data-visible-handover-source={teachingSceneStory === null
        ? visibleHandover.source ?? ''
        : 'teaching'}
      data-selected-speed={playback.speed.toFixed(3)}
      data-timeline-current-time-sec={timelineCurrentTimeSec.toFixed(3)}
      data-timeline-duration-sec={timelineDurationSec.toFixed(3)}
      data-timeline-disabled={timelineDisabled ? 'true' : 'false'}
      data-timeline-source-owner={activeTimelineDescriptor.sourceOwner}
      data-timeline-horizon-kind={activeTimelineDescriptor.horizonKind}
      data-timeline-claim-kind={activeTimelineDescriptor.claimKind}
      data-live-timeline-seek-target={liveTimelineSeekRequest?.targetSec.toFixed(3) ?? ''}
      data-live-timeline-seek-key={liveTimelineSeekRequest?.requestKey ?? ''}
      data-homepage-demo-window-ready={homepageDemoWindow !== null ? '1' : '0'}
      data-homepage-demo-window-enabled={homepageDemoWindowButtonEnabled ? '1' : '0'}
      data-homepage-demo-window-lead-in-sec={homepageDemoWindow?.leadInSec.toFixed(3) ?? ''}
      data-homepage-demo-window-end-sec={homepageDemoWindow?.endSec.toFixed(3) ?? ''}
      data-homepage-demo-window-first-event-id={homepageDemoWindow?.firstEventId ?? ''}
      data-homepage-demo-window-last-event-id={homepageDemoWindow?.lastEventId ?? ''}
      data-homepage-demo-window-alignment={homepageDemoWindow?.alignment.aligned === true ? 'aligned' : ''}
      data-homepage-demo-window-intra-from-sat-id={homepageDemoWindow?.events[0]?.fromSatId ?? ''}
      data-homepage-demo-window-intra-to-sat-id={homepageDemoWindow?.events[0]?.toSatId ?? ''}
      data-homepage-demo-window-intra-from-cell-id={homepageDemoWindow?.events[0]?.fromCellId?.toString() ?? ''}
      data-homepage-demo-window-intra-to-cell-id={homepageDemoWindow?.events[0]?.toCellId?.toString() ?? ''}
      data-homepage-demo-window-intra-from-beam-id={homepageDemoWindow?.events[0]?.fromBeamId?.toString() ?? ''}
      data-homepage-demo-window-intra-to-beam-id={homepageDemoWindow?.events[0]?.toBeamId?.toString() ?? ''}
      data-homepage-demo-window-inter-from-sat-id={homepageDemoWindow?.events[1]?.fromSatId ?? ''}
      data-homepage-demo-window-inter-to-sat-id={homepageDemoWindow?.events[1]?.toSatId ?? ''}
      data-homepage-demo-window-inter-from-cell-id={homepageDemoWindow?.events[1]?.fromCellId?.toString() ?? ''}
      data-homepage-demo-window-inter-to-cell-id={homepageDemoWindow?.events[1]?.toCellId?.toString() ?? ''}
      data-homepage-demo-window-inter-from-beam-id={homepageDemoWindow?.events[1]?.fromBeamId?.toString() ?? ''}
      data-homepage-demo-window-inter-to-beam-id={homepageDemoWindow?.events[1]?.toBeamId?.toString() ?? ''}
      data-manual-handover-request-id={manualHandoverRequest?.id?.toString() ?? ''}
      data-manual-handover-kind={manualHandoverRequest?.kind ?? ''}
      data-topology-overrides-active={hasTopologyOverrides ? 'true' : 'false'}
      data-visual-scale-overrides-active={hasVisualScaleOverrides ? 'true' : 'false'}
      data-visual-scale-key={sceneVisualScaleResetKey}
      data-teaching-stage-kind={teachingStageKind ?? ''}
      data-shell-left-sidebar-visible={shellChromeVisibility.leftSidebar ? 'true' : 'false'}
      data-shell-right-sidebar-visible={shellChromeVisibility.rightSidebar ? 'true' : 'false'}
      data-shell-top-controls-visible={shellChromeVisibility.topControls ? 'true' : 'false'}
      data-shell-timeline-visible={shellChromeVisibility.timeline ? 'true' : 'false'}
      data-shell-scene-overlay-visible={shellChromeVisibility.sceneOverlay ? 'true' : 'false'}
      className="leo-app-shell"
    >
      {sceneSource === 'artifact-replay' && (
        <ArtifactSourceBadge source={showcaseArtifactSource} />
      )}
      <ShellChromeControls
        visibility={shellChromeVisibility}
        onToggle={toggleShellChrome}
        onShowAll={showAllShellChrome}
        onHideAll={hideAllShellChrome}
      />
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
      {shellChromeVisibility.topControls && (
      <div className="leo-shell-top-chrome" data-testid="leo-shell-top-chrome">
      <div
        className="leo-global-top-row"
        data-testid="leo-global-top-row"
      >
      {/* Way into the six-acts teaching line, in the top band where the eye
          lands. The corner launcher alone was too easy to miss on a full
          engineering dashboard — which is exactly what happened. */}
      <SixActsTopEntry />
      {HOMEPAGE_SIMULATION_SOURCE_SWITCH_VISIBLE && sceneLane === 'sinr-live' && (
        <SimulationSourceToggle
          value={simulationSource}
          onChange={handleSimulationSourceChange}
        />
      )}
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
        requestedSpeed={playback.speed}
        autoSlowActive={playback.autoSlowActive}
        autoSlowApplied={playback.autoSlowApplied}
        onToggleBeamCallouts={() => setBeamDisplaySpec(c => ({ ...c, beamCalloutsEnabled: !c.beamCalloutsEnabled }))}
        onToggleNonServingCones={() => setBeamDisplaySpec(c => ({ ...c, showNonServingCones: !c.showNonServingCones }))}
        onToggleOtherHandoverUes={() => setBeamDisplaySpec(c => ({ ...c, showOtherHandoverUes: !c.showOtherHandoverUes }))}
        onCinematicModeChange={camera.setCinematicMode}
        onToggleAutoSlow={playback.toggleAutoSlow}
        onDismissAutoSlow={playback.dismissAutoSlow}
        showHandoverJumpButtons={sceneSource === 'live-sim'
          && isWalkerSceneActive
          && (sceneLane === 'sinr-live' || sceneLane === 'modqn-live-cell-preview')}
        handoverIndexBuilding={liveWalkerHandoverEventIndexBuilding}
        // The homepage buttons open a self-contained lecture with its own clock
        // and data, so no live-lane state may gate them. The lecture itself arms
        // a manual cue at its switching beat, so the shared `manualHandoverRequest
        // === null` guard would have made the buttons disable themselves halfway
        // through their own run. Every other lane keeps all four guards.
        nextIntraEnabled={isRootHomepage || (manualHandoverRequest === null
          && directorNextIntraEnabled
          && camera.directorPhase === 'idle'
          && !handoverCommandBusy)}
        nextInterEnabled={isRootHomepage || (manualHandoverRequest === null
          && directorInterButtonEnabled
          && camera.directorPhase === 'idle'
          && !handoverCommandBusy)}
        // Homepage actions are always actionable teaching jumps; the number of
        // indexed rows is not user-facing evidence and only made the controls
        // look like a time selector.
        nextIntraCount={isRootHomepage ? undefined : directorIntraIndexedEnabled
          ? sceneSource === 'live-sim' && isWalkerSceneActive
            ? directorButtonCountEvents.filter(event => event.kind === 'intra').length
            : handoverRailEvents.filter(event => event.kind === 'intra').length
          : undefined}
        nextInterCount={isRootHomepage ? undefined : sceneSource === 'live-sim' && isWalkerSceneActive
          ? directorButtonCountEvents.filter(event => event.kind === 'inter').length
          : handoverRailEvents.filter(event => event.kind === 'inter').length}
        nextIntraMode={directorNextIntraMode}
        manualHandoverKind={sceneSource === 'live-sim' && isWalkerSceneActive
          ? manualHandoverRequest?.kind ?? null
          : null}
        onNextIntra={handleQuickIntra}
        onNextInter={handleQuickInter}
      />
      </div>
      <GlobalLocaleToggleSlot />
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
      </div>
      )}
      <div
        className="leo-shell-row"
        data-left-sidebar-collapsed={leftSidebarCollapsed ? 'true' : 'false'}
        data-left-sidebar-hidden={shellChromeVisibility.leftSidebar ? 'false' : 'true'}
        data-right-sidebar-hidden={shellChromeVisibility.rightSidebar ? 'false' : 'true'}
      >
        <aside
          className="leo-shell-left"
          data-left-sidebar-state={leftSidebarCollapsed ? 'collapsed' : 'expanded'}
          data-shell-visibility={shellChromeVisibility.leftSidebar ? 'visible' : 'hidden'}
          aria-label="Signal tuning panel slot"
          aria-hidden={!shellChromeVisibility.leftSidebar}
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
              showTeachingAuxiliaryUi={HOMEPAGE_TEACHING_AUXILIARY_UI_VISIBLE}
              campusVisible={campusVisible}
              onCampusVisibleChange={() => setCampusVisible(current => !current)}
              teachingMode={teachingMode}
              onTeachingModeChange={handleTeachingModeChange}
              teachingLinkSnapshot={teachingLinkSnapshot}
              teachingPolicySection={isWalkerSceneActive ? (
                <HandoverPolicyControls
                  draft={handoverPolicyDraft}
                  applied={appliedHandoverPolicy}
                  hasDraftChanges={hasHandoverPolicyDraftChanges}
                  hasOverrides={hasHandoverPolicyOverrides}
                  onDraftChange={handleHandoverPolicyDraftChange}
                  onApply={handleApplyHandoverPolicy}
                  onReset={handleResetHandoverPolicy}
                />
              ) : (
                <ArchivedTleBoundaryNote homepageCanonicalAnalysis={homepageCanonicalAnalysis} />
              )}
              parameterSection={
                isWalkerSceneActive ? (
                  <SignalTuningPanel
                    baseProfile={baseProfile}
                    tuning={signalTuning}
                    topology={activeSceneTopology}
                    sceneVisualScale={sceneVisualScale}
                    hasOverrides={hasSignalOverrides || hasTopologyOverrides || hasVisualScaleOverrides}
                    appMode={appMode}
                    formulaBudget={simState.physicalServingBudget}
                    isFormulaEvidenceStale={staleFormulaEvidenceKey !== null}
                    activeMainTab={isRootHomepage ? homepageSignalTuningMainTab : undefined}
                    onActiveMainTabChange={isRootHomepage ? setHomepageSignalTuningMainTab : undefined}
                    onTuningChange={handleSignalTuningChange}
                    onTopologyChange={handleSceneTopologyChange}
                    servingSatelliteId={simState.servingSatId}
                    candidateSatelliteId={simState.pendingTargetSatId ?? simState.comparisonSatId}
                    formulaFrame={simState.angleAwareFormulaFrame}
                    showHomepageEeThreshold={isRootHomepage}
                    homepageEeThresholdKbitPerJoule={homepageEeThresholdKbitPerJoule}
                    onHomepageEeThresholdKbitPerJouleChange={handleHomepageEeThresholdChange}
                    walkerScenarioDate={walkerScenarioDate}
                    walkerScenarioTime={walkerScenarioTime}
                    onWalkerScenarioDateChange={setWalkerScenarioDate}
                    onWalkerScenarioTimeChange={setWalkerScenarioTime}
                    onSceneVisualScaleChange={setSceneVisualScale}
                    onReset={handleResetSignalTuning}
                    handoverPolicySection={(
                      <HandoverPolicyControls
                        draft={handoverPolicyDraft}
                        applied={appliedHandoverPolicy}
                        hasDraftChanges={hasHandoverPolicyDraftChanges}
                        hasOverrides={hasHandoverPolicyOverrides}
                        onDraftChange={handleHandoverPolicyDraftChange}
                        onApply={handleApplyHandoverPolicy}
                        onReset={handleResetHandoverPolicy}
                      />
                    )}
                  />
                ) : (
                  <>
                    <HomepageCanonicalControls
                      analysis={homepageCanonicalAnalysis}
                      activeTab={homepageCanonicalTab}
                      onActiveTabChange={setHomepageCanonicalTab}
                    />
                  </>
                )
              }
            />
          )}
          </div>
        </aside>
        <main
          className="leo-shell-canvas"
          data-testid="leo-shell-canvas"
          data-timeline-visibility={shellChromeVisibility.timeline ? 'visible' : 'hidden'}
          data-handover-criterion={
            isArchivedTleSceneActive
              ? 'canonical-tle-3db-30s'
              : handoverMode === 'decision-overlay-on-live-sinr'
                ? 'decision-overlay-on-live-sinr'
                : 'sinr-offset'
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
          {shouldRenderMainScene ? (
            <MainScene
              speed={playback.effectiveSpeed}
              paused={playback.paused}
              profile={effectiveProfile}
              runtime={runtime}
              visualScaleMultipliers={visualScaleMultipliers}
              sceneLane={sceneLane}
              homepageVisualIdentity={typeof window !== 'undefined' && window.location.pathname === '/'}
              homepageSatelliteNameById={homepageSatelliteNameById}
              homepageBeamMetrics={simState.homepageBeamMetrics ?? null}
              simulationSource={isArchivedTleSceneActive ? 'archived-tle' : 'walker'}
              campusVisible={campusVisible}
              onSimUpdate={handleSimUpdate}
              acceptedHandoverPresentation={isWalkerSceneActive
                ? simState.acceptedHandoverPresentation ?? null
                : null}
              onLiveSeekLanded={handleLiveSeekLandedWithAnalysisReset}
              sceneFrame={activeSceneFrame}
              canonicalAnalysisFrame={isArchivedTleSceneActive
                ? homepageCanonicalAnalysis.frame
                : null}
              canonicalAnalysisNextFrame={isArchivedTleSceneActive
                ? homepageCanonicalAnalysis.visualNextFrame
                : null}
              canonicalAnalysisError={isArchivedTleSceneActive
                ? homepageCanonicalAnalysis.error
                : null}
              canonicalVisualOffsetSec={isArchivedTleSceneActive
                ? Math.max(
                  0,
                  timelineCurrentTimeSec
                    - (homepageCanonicalAnalysis.frame?.runAnchor?.elapsedSec ?? timelineCurrentTimeSec),
                )
                : undefined}
              beamDisplaySpec={beamDisplaySpec}
              showSceneOverlays={shellChromeVisibility.sceneOverlay}
              handoverCinemaCandidate={sceneLane === 'sinr-live' && isWalkerSceneActive
                ? handoverCinema.focusedCandidate
                : null}
              handoverCinemaArmed={sceneLane === 'sinr-live' && isWalkerSceneActive && handoverCinema.cinemaActive}
              handoverCinemaKind={sceneLane === 'sinr-live' && isWalkerSceneActive && handoverCinema.armFilter !== 'off'
                ? handoverCinema.armFilter
                : null}
              teachingSceneStory={isRootHomepage ? teachingSceneStory : null}
              teachingLectureFrameRef={teachingLectureFrameRef}
              onHandoverPresentationChange={handleHandoverPresentationChange}
              onHandoverPresentationBusyChange={handleHandoverPresentationBusyChange}
              constellation={activeSceneTopology.constellation}
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
              suppressVisual={shouldSuppressInterSeekFade(handoverCinema.armFilter)}
              onPeak={handleCinematicSeekPeak}
            />
          )}
          {shellChromeVisibility.sceneOverlay && (
            <>
              {HOMEPAGE_TEACHING_AUXILIARY_UI_VISIBLE && teachingMode === 'teaching' && sceneLane === 'sinr-live' && isWalkerSceneActive && sixActsSubtitle !== null && (
                sixActsTeachingFactsRef.current === null ? null : (
                  <SixActsTeachingOverlay
                    beat={sixActsSubtitle.beat}
                    facts={sixActsTeachingFactsRef.current}
                    trace={sixActsTeachingTraceRef.current}
                    offsetDb={appliedHandoverPolicy.offsetDb}
                    tttSec={appliedHandoverPolicy.triggerTimeSec}
                    receipt={sixActsTeachingReceipt}
                  />
                )
              )}
              {HOMEPAGE_TEACHING_AUXILIARY_UI_VISIBLE && teachingMode === 'teaching' && sceneLane === 'sinr-live' && isWalkerSceneActive && sixActsSubtitle !== null && (
                <div
                  className="leo-six-acts-subtitle-overlay"
                  data-testid="six-acts-subtitle-overlay"
                  data-six-acts-beat={sixActsSubtitle.beat}
                >
                  <SixActsSubtitleBar
                    eyebrow={sixActsSubtitle.eyebrow}
                    text={sixActsSubtitle.text}
                    rows={sixActsSubtitle.rows}
                    tone={sixActsSubtitle.tone}
                    provenance={sixActsTeachingFactsRef.current?.provenance}
                    provenanceErrorCode={sixActsTeachingFactsRef.current?.provenanceErrorCode}
                  />
                </div>
              )}
            </>
          )}
          {teachingStageKind !== null && teachingLecture.frame !== null && (
            <HandoverTeachingCaption frame={teachingLecture.frame} />
          )}
          {shellChromeVisibility.timeline
            && (isRootHomepage || homepageTeachingTimeline === null)
            ? timelineBar
            : null}
        </main>
        <aside
          className="leo-shell-right"
          data-shell-visibility={shellChromeVisibility.rightSidebar ? 'visible' : 'hidden'}
          aria-label="Calculated values panel"
          aria-hidden={!shellChromeVisibility.rightSidebar}
        >
          {isArchivedTleSceneActive ? (
            <HomepageCanonicalRightRail homepageCanonicalAnalysis={homepageCanonicalAnalysis} />
          ) : teachingStageKind !== null && teachingLecture.frame !== null ? (
            <HandoverTeachingRail
              frame={teachingLecture.frame}
              kind={teachingStageKind}
              totalSec={teachingLecture.totalSec}
              paused={teachingLecture.paused}
              onPausedChange={teachingLecture.setPaused}
              onRestart={teachingLecture.restart}
              onClose={() => setTeachingStageKind(null)}
            />
          ) : homepageRailPanel !== null ? (
            homepageRailPanel
          ) : (
            <>
              {sceneLane === 'modqn-live-cell-preview' && <ServiceStatusBanner appMode={appMode} />}
              {visibleRightSidebarTabs.length > 0 ? (
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
              <section
                className="leo-live-status-stack"
                aria-label="Live status for current scene"
                data-homepage-rail-snapshot-id={homepageRailProjection?.snapshotId ?? ''}
                data-homepage-rail-source-frame-id={homepageRailProjection?.sourceFrameId ?? ''}
                data-homepage-rail-phase={homepageRailProjection?.phase ?? ''}
              >
                {sceneLane === 'sinr-live' && isWalkerSceneActive ? (
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
              ) : null}
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
