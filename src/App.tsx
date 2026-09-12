import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MainScene } from './scene/MainScene';
import { loadProfile } from './profiles';
import type { BeamDensity, RuntimeConfig, SimState } from './scene/types';
import { createInitialSimState } from './scene/initialSimState';
import { recommendDemoReplayStartOffsetSec } from './scene/replay-recommendation';
import { shouldSuppressInterSeekFade } from './scene/handoverDisplayIsolation';
import {
  type LiveWalkerDirectorFocusClaimKind,
} from './scene/liveWalkerDirectorFocus';
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
import { AppHandoverRail } from './app/AppHandoverRail';
import { useHandoverCinema } from './app/useHandoverCinema';
import { createSinrLiveBeamDisplayFrame } from './scene/sinrLiveBeamDisplayFrame';
import { TimelineBar, type TimelineSpeedPreset } from './ui/TimelineBar';
import type { HandoverRailEvent } from './ui/HandoverEventRail';
import { HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM } from './homepage/controller/homepageStoryScenario';
import {
  HOMEPAGE_TEACHING_PLAYBACK_SPEED,
} from './homepage/controller/homepageHandoverTiming';
import {
  HOMEPAGE_INTRA_HANDOVER_DISPLAY_MS,
  MANUAL_HANDOVER_DISPLAY_MS,
} from './appearance/handoverTimingEnvelope';
import { HandoverTeachingRail, useHandoverTeachingLecture } from './ui/homepage/HandoverTeachingRail';
import type {
  TeachingHandoverKind,
} from './homepage/teaching/handoverTeachingScript';
import type { HandoverTeachingSceneStory } from './scene/handoverStoryFrame';
import {
  resolveHandoverAcceptedSurfaceProjection,
} from './scene/handoverAcceptedSurfaceProjection';
import {
  resolveHandoverTeachingSurfaceProjection,
  type HandoverTeachingSurfaceProjection,
} from './scene/handoverTeachingSurfaceProjection';
import { resolveSceneHandoverStoryFrameSet } from './scene/sceneHandoverStoryFrameSet';
import {
  resolveHandoverSurfaceBindings,
  type HandoverSurfaceBindingSet,
} from './scene/handoverSurfaceBinding';
import { cellIdFromLinkBudgetBeamId } from './scene/sinrLiveCellModel';
import { InfoPanel } from './ui/InfoPanel';
import { HomepageCanonicalServingComparison } from './ui/signal-tuning/HomepageCanonicalServingComparison';
import { HomepageRightRail } from './ui/signal-tuning/HomepageRightRail';
import {
  DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE,
  normalizeEeThresholdKbitPerJoule,
} from './engine/handover/eeThreshold';
import type { TeachingLinkSnapshot } from './ui/TeachingPanelDock';
import { deriveCanonicalTeachingLinkSnapshot } from './app/canonicalTeachingLinkSnapshot';
import { WalkerResultsRail } from './ui/signal-tuning/WalkerResultsRail';
import { useHomepageCanonicalAnalysis } from './ui/signal-tuning/useHomepageCanonicalAnalysis';
import type { MainTabKey } from './ui/signal-tuning/types';
import { SinrLiveQuickControls } from './ui/SinrLiveQuickControls';
import { DEFAULT_BEAM_DISPLAY_SPEC } from './scene/beamDisplaySpec';
import {
  ArtifactSourceBadge,
  PRODUCER_PINNED_SOURCE,
  SYNTHETIC_FIXTURE_SOURCE,
  HEADER_ABSENT_SOURCE,
} from './ui/ArtifactSourceBadge';
// Global zh-TW / EN language state (CONTRACT.md §2). The provider wraps the
// whole shell so the left tuners, the right readout and every HelpPopover
// share one locale; the toggle itself lives in the top-right quick-control row.
import { LocaleProvider } from './i18n';
import { loadShowcaseArtifact } from './showcase/loadShowcaseArtifact';
import { showcaseArtifactToSceneInterpolated } from './showcase/showcaseArtifactToSceneInterpolated';
import { ShowcaseReplayController } from './showcase/ShowcaseReplayController';
import type { VisualShowcaseArtifact } from './scene/visual-showcase-contract';
import type { NormalizedSceneFrame } from './scene/NormalizedSceneFrame';
import { resolveSceneLane } from './app/sceneLane';
import type { AppExperienceMode } from './app/appExperienceMode';
import {
  getDefaultLeftSidebarTabForSceneLane,
  getDefaultRightSidebarTabForSceneLane,
  getHomepageRightSidebarTabsForSceneLane,
  getLeftSidebarTabsForSceneLane,
  getRightSidebarTabsForSceneLane,
  readInitialRuntimeState,
  resolveHomepageInitialRuntimeState,
  type InitialRuntimeState,
  type RightSidebarTab,
} from './app/appRuntimeModel';
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
  persistSceneTopologyOverrides,
  persistSceneVisualScaleOverrides,
  persistHomepageNarrativeTeachingMode,
  readHomepageNarrativeTeachingMode,
  readSceneSourceFromUrl,
  readSceneTopologyOverrides,
  readSceneVisualScaleOverrides,
  type SceneSourceMode,
} from './app/appPersistence';
import {
  HOMEPAGE_SIMULATION_SOURCE_SWITCH_VISIBLE,
  persistSimulationSourceMode,
  readHomepageSimulationSourceMode,
  type SimulationSourceMode,
} from './app/simulationSourceMode';
import {
  deriveIntraTeachingDisplayState,
  deriveTeachingIdentityBinding,
  deriveTeachingInterRosterSatelliteIds,
  deriveTeachingSceneStoryCandidate,
  resolveTeachingIntraSatelliteId,
} from './app/teachingPresentationDerivations';
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
import type { SixActsFrameFacts } from './course/sixActs/liveReplayBridge';
import type { SixActsSubtitleState } from './course/sixActs/subtitleStateMachine';
import {
  DEFAULT_SHELL_CHROME_VISIBILITY,
  ShellChromeControls,
  type ShellChromeKey,
  type ShellChromeVisibility,
} from './ui/ShellChromeControls';
import type { SixActsTeachingReceipt } from './ui/SixActsTeachingOverlay';
import { SimulationSourceToggle } from './ui/SimulationSourceToggle';
import { SixActsTopEntry } from './ui/SixActsTopEntry';
import { HomepageBeamRailWaiting } from './ui/HomepageBeamRailWaiting';
import { GlobalLocaleToggleSlot } from './ui/GlobalLocaleToggleSlot';
import { AppRightSidebar } from './app/AppRightSidebar';
import { AppSceneOverlays } from './app/AppSceneOverlays';
import { publishAppSimulationFrame } from './app/appSimulationPublication';
import { useAppHomepageTeachingStory } from './app/AppHomepageTeachingStory';
import { useLeftSidebar } from './app/useLeftSidebar';
import { useDirectorModes } from './app/useDirectorModesQ1';
import { AppLeftSidebar } from './app/AppLeftSidebar';

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

// Generic artifact-replay lane source (dev middleware serves the pinned producer
// baseline; see vite.config.ts).
const SHOWCASE_ARTIFACT_URL = '/showcase-artifacts/visual-showcase-v1.json';
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
  const [appMode] = useState<AppExperienceMode>(() => initialRuntime.appMode);
  const selectedProfileId = initialRuntime.selectedProfileId;

  const handoverMode = 'sinr-offset' as const;
  const sceneLane = useMemo(
    () => resolveSceneLane({ appMode, sceneSource }),
    [appMode, sceneSource],
  );
  // The archived source is applicable only to the SINR homepage. Other lanes
  // keep their existing Walker/artifact ownership even if the persisted
  // homepage preference is TLE.
  const isArchivedTleSceneActive = sceneLane === 'sinr-live'
    && simulationSource === 'archived-tle';
  const isWalkerSceneActive = !isArchivedTleSceneActive;
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
  const visibleLeftSidebarTabs = useMemo(
    () => getLeftSidebarTabsForSceneLane(sceneLane, handoverMode),
    [handoverMode, sceneLane],
  );
  const activeLeftSidebarTab = visibleLeftSidebarTabs.some(tab => tab.key === leftSidebarTab)
    ? leftSidebarTab
    : getDefaultLeftSidebarTabForSceneLane(sceneLane, handoverMode);
  const isRootHomepage = typeof window !== 'undefined' && window.location.pathname === '/';
  const [focusedJoinKey, setFocusedJoinKey] = useState<string | null>(null);
  const handleFocusJoinKeyChange = useCallback((joinKey: string | null) => {
    setFocusedJoinKey(joinKey);
  }, []);
  const [homepageNarrativeTeachingMode, setHomepageNarrativeTeachingMode] = useState(
    () => readHomepageNarrativeTeachingMode(),
  );
  useEffect(() => {
    if (isRootHomepage) persistHomepageNarrativeTeachingMode(homepageNarrativeTeachingMode);
  }, [homepageNarrativeTeachingMode, isRootHomepage]);
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
    && sceneLane === 'sinr-live';
  const activeSceneTopology = useMemo<SceneTopologyState>(
    () => liveSceneTopologyControlsEnabled ? sceneTopology : createSceneTopologyState(),
    [liveSceneTopologyControlsEnabled, sceneTopology],
  );
  const signalTunedProfile = useMemo(() => deriveWalkerSignalTunedProfile({
    baseProfile,
    signalTuning,
    activeSceneTopology,
  }), [
    activeSceneTopology,
    baseProfile,
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
    () => deriveRuntimeVisualSettings(reducedMotion),
    [reducedMotion],
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
    activeSceneTopology,
    homepageEeThresholdKbitPerJoule,
    isRootHomepage,
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
    publishAppSimulationFrame({
      state,
      teachingMode,
      sceneLane,
      policy: {
        offsetDb: appliedHandoverPolicy.offsetDb,
        tttSec: appliedHandoverPolicy.triggerTimeSec,
      },
      signalEvidenceKey,
      liveSimTimeSecRef,
      walkerRuntimeHasPublishedRef,
      sixActsSubtitleRef,
      sixActsTeachingFactsRef,
      sixActsTeachingTraceRef,
      sixActsTeachingReceiptRef,
      setSimState,
      setSixActsSubtitle,
      setSixActsTeachingReceipt,
      setLiveObservedHandoverRailEvents,
      setStaleFormulaEvidenceKey,
    });
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

  useEffect(() => subscribeToReducedMotionPreference(setReducedMotion), []);

  useEffect(() => subscribeToRuntimeViewport(setViewport), []);

  useEffect(() => {
    persistSceneTopologyOverrides(sceneTopology);
  }, [sceneTopology]);

  useEffect(() => {
    persistSceneVisualScaleOverrides(sceneVisualScale);
  }, [sceneVisualScale]);


  useEffect(() => {
    setLiveObservedHandoverRailEvents([]);
  }, [baseProfile.id, handoverResetKey, sceneSource, signalResetKey]);


  useEffect(() => {
    if (
      sceneSource !== 'live-sim'
      || sceneLane !== 'sinr-live'
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

  // P3: fetch visual-showcase-v1 artifact at startup if in artifact-replay mode.
  // The cancelled guard matters because sceneSource is a runtime switch: if the
  // user leaves before the artifact resolves, the in-flight promise must not
  // repopulate stale scene state.
  useEffect(() => {
    if (sceneSource !== 'artifact-replay') return;
    let cancelled = false;
    let resolvedSource = HEADER_ABSENT_SOURCE;
    setShowcaseLoading(true);
    setShowcaseError(null);
    setShowcaseArtifactSource(null);
    fetch(SHOWCASE_ARTIFACT_URL)
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
  }, [sceneSource]);

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
  // The recorded artifact plays forward like the artifact-replay lane.
  useEffect(() => {
    if (sceneSource !== 'artifact-replay' || !replayController || playback.paused) return;

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
  }, [sceneSource, replayController, playback.paused, playback.effectiveSpeed]);

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
    liveWalkerHandoverEventIndex,
    liveWalkerHandoverEventIndexBuilding,
    focusedUeId: simState.primaryUeId,
    archivedTleRunReady: homepageCanonicalAnalysis.runReady ?? false,
    archivedTleDurationSec: homepageCanonicalAnalysis.timelineDurationSec ?? 7200,
    archivedTleCurrentTimeSec: homepageCanonicalAnalysis.timelineCurrentTimeSec ?? 0,
    archivedTleStepSec: homepageCanonicalAnalysis.timelineStepSec ?? 30,
  }), [
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
  ]);

  const { directorFocusEnabled, directorInterEnabled, directorCinematicEnabled, directorCinematicInterEnabled, directorCinematicIntraEnabled } = useDirectorModes({ artifactHandoverRailEvents, handoverRailEvents, isWalkerSceneActive, liveWalkerDirectorHandoverEventsForButtons, liveWalkerHandoverEventIndexBuilding, replayController, sceneLane, sceneSource, showcaseError, showcaseLoading, timelineRailDescriptor });

  // G1 / Rule#8: a focus button is offered only when the source-backed rail
  // actually carries a handover event of that kind. While a left-side control
  // is rebuilding the index, the old snapshot stays visible but is not
  // actionable; this keeps the scene/rail/button source identity atomic.
  
  // ITEM #C honesty: the live seek/sat-pair focus is real live cell truth.
  const liveDirectorFocusClaimKind: LiveWalkerDirectorFocusClaimKind = 'live-truth';

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
      return;
    }
    handleTimelineSeek(targetSec);
  }, [
    directorFocusEnabled,
    handleTimelineSeek,
    isRootHomepage,
    requestLiveTimelineSeek,
    sceneLane,
    timelineRailDescriptor.rail.durationSec,
  ]);


  const handleTimelineSpeedChange = useCallback((nextSpeed: TimelineSpeedPreset) => {
    playback.setSpeed(nextSpeed);
  }, [playback]);

  const handoverEventRail = (
    <AppHandoverRail
      events={handoverRailEvents}
      surface={timelineRailDescriptor.rail}
      disabled={timelineDisabled}
      axisPlaying={!playback.paused}
      axisPlaybackRate={playback.effectiveSpeed}
      director={{
        intraEnabled: directorNextIntraEnabled,
        interEnabled: directorInterButtonEnabled,
        intraTriggerEnabled: directorIntraTriggerEnabled,
        nextIntraMode: directorNextIntraMode,
        handoverIndexBuilding: liveWalkerHandoverEventIndexBuilding,
        // The event count is an internal index diagnostic, not a teaching
        // control. Keep it available to non-homepage compatibility lanes.
        nextIntraCount: isRootHomepage ? undefined : directorIntraIndexedEnabled
          ? directorFocusEnabled
            ? directorButtonCountEvents.filter(event => event.kind === 'intra').length
            : handoverRailEvents.filter(event => event.kind === 'intra').length
          : undefined,
        nextInterCount: isRootHomepage ? undefined : directorFocusEnabled
          ? directorButtonCountEvents.filter(event => event.kind === 'inter').length
          : handoverRailEvents.filter(event => event.kind === 'inter').length,
        phase: camera.directorPhase,
        liveDirectorFocusEventId,
      }}
      onSeek={handleHandoverRailSeek}
      onIntraTrigger={triggerPrimaryIntra}
      onIntraFocus={handleDirectorNextIntra}
      onInterFocus={handleDirectorNextInter}
      onExit={handoverCinema.exit}
    />
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
  // banner in normal mode. Its callbacks and bounded source window live in the
  // homepage teaching-story owner.
  const homepageTeachingTimeline = useAppHomepageTeachingStory({
    isRootHomepage,
    showTimeline: homepageRailShowAllSurfaces,
    currentSourceTimeSec: simState.simTimeSec,
    simTimeSec: simState.simTimeSec,
    homepageDemoWindow,
    homepageDemoRunEndSec,
    liveTimelineWindowStartSec,
    timelineDurationSec,
    homepageHandoverStory,
    satelliteNameById: homepageSatelliteNameById,
    playback,
    onTimelineSeek: handleTimelineSeek,
    setHomepageDemoRunEndSec,
    setHomepageTeachingActive,
    setHomepageTeachingDetailsVisible,
  });

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

  const activeSceneFrame = useMemo((): NormalizedSceneFrame | undefined => {
    if (sceneSource !== 'artifact-replay' || !replaySceneFrame) return undefined;
    return {
      ...replaySceneFrame,
      ues: processedUes,
    };
  }, [sceneSource, replaySceneFrame, processedUes]);
  const shouldRenderMainScene = sceneSource !== 'artifact-replay' || activeSceneFrame !== undefined;
  // R4: normalize accepted, teaching and replay stories once in the shell, then
  // pass the exact same frozen frames to scene, rail and caption projections.
  // The scene may add its local presentation-clock frame, but it must preserve
  // these shared source-frame object references.
  const appHandoverStoryFrames = useMemo(() => resolveSceneHandoverStoryFrameSet({
    acceptedSnapshot: sceneLane === 'sinr-live' && isWalkerSceneActive
      ? simState.acceptedHandoverPresentation ?? null
      : null,
    acceptedProducer: 'walker',
    resolveAcceptedCellId: cellIdFromLinkBudgetBeamId,
    teachingStory: isRootHomepage ? teachingSceneStory : null,
    teachingFrame: isRootHomepage ? teachingLecture.frame : null,
    replayFrame: activeSceneFrame ?? null,
  }), [
    activeSceneFrame,
    isRootHomepage,
    isWalkerSceneActive,
    sceneLane,
    simState.acceptedHandoverPresentation,
    teachingLecture.frame,
    teachingSceneStory,
  ]);
  const handoverSurfaceBindings = useMemo(
    () => resolveHandoverSurfaceBindings(appHandoverStoryFrames),
    [appHandoverStoryFrames],
  );
  const acceptedSurfaceProjection = useMemo(
    () => resolveHandoverAcceptedSurfaceProjection(
      handoverSurfaceBindings.accepted,
      homepageRailProjection,
      'walker',
    ),
    [handoverSurfaceBindings.accepted, homepageRailProjection],
  );
  const teachingSurfaceProjection = useMemo(
    () => resolveHandoverTeachingSurfaceProjection(
      handoverSurfaceBindings.teaching,
      teachingLecture.frame,
      teachingStageKind,
    ),
    [handoverSurfaceBindings.teaching, teachingLecture.frame, teachingStageKind],
  );
  // Keep scene props stable while the authored clock updates. The scene reads
  // the exact projection object through this ref; rail and caption receive that
  // same object directly, so none of the three can reinterpret its identity.
  const teachingSurfaceProjectionRef = useRef<HandoverTeachingSurfaceProjection | null>(null);
  teachingSurfaceProjectionRef.current = teachingSurfaceProjection;
  const handoverSurfaceBindingsRef = useRef<HandoverSurfaceBindingSet | null>(null);
  handoverSurfaceBindingsRef.current = handoverSurfaceBindings;


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
  let homepageRailContent: React.ReactNode = null;
  if (homepageRailProjection !== null) {
    homepageRailContent = (
      <HomepageBeamRail
        projection={homepageRailProjection}
        sourceProvenance="synthetic-walker"
        handoverSurfaceProjection={acceptedSurfaceProjection}
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
        selectedJoinKey={focusedJoinKey}
        onFocusJoinKeyChange={handleFocusJoinKeyChange}
      />
    );
  } else {
    homepageRailContent = <HomepageBeamRailWaiting />;
  }

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
        {homepageRailContent}
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
      data-visible-handover-kind={teachingSurfaceProjection?.binding.frame.kind ?? visibleHandover.kind ?? ''}
      data-visible-handover-source={teachingSurfaceProjection === null
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
        decisionPhase={multiCandidateDecision?.phase ?? null}
        teachingMode={homepageNarrativeTeachingMode}
        onTeachingModeChange={setHomepageNarrativeTeachingMode}
        showTeachingModeToggle={isRootHomepage}
        onToggleBeamCallouts={() => setBeamDisplaySpec(c => ({ ...c, beamCalloutsEnabled: !c.beamCalloutsEnabled }))}
        onToggleNonServingCones={() => setBeamDisplaySpec(c => ({ ...c, showNonServingCones: !c.showNonServingCones }))}
        onToggleOtherHandoverUes={() => setBeamDisplaySpec(c => ({ ...c, showOtherHandoverUes: !c.showOtherHandoverUes }))}
        onCinematicModeChange={camera.setCinematicMode}
        onToggleAutoSlow={playback.toggleAutoSlow}
        onDismissAutoSlow={playback.dismissAutoSlow}
        showHandoverJumpButtons={sceneSource === 'live-sim'
          && isWalkerSceneActive
          && sceneLane === 'sinr-live'}
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
        <AppLeftSidebar
          collapsed={leftSidebarCollapsed}
          shellVisible={shellChromeVisibility.leftSidebar}
          sceneLane={sceneLane}
          visibleTabs={visibleLeftSidebarTabs}
          activeTab={activeLeftSidebarTab}
          onToggleCollapsed={() => setLeftSidebarCollapsed(collapsed => !collapsed)}
          onTabChange={setLeftSidebarTab}
          showcaseArtifact={showcaseArtifact}
          showcaseLoading={showcaseLoading}
          showcaseError={showcaseError}
          frameIndex={frameIndex}
          currentTimeSec={currentTimeSec}
          showTeachingAuxiliaryUi={HOMEPAGE_TEACHING_AUXILIARY_UI_VISIBLE}
          campusVisible={campusVisible}
          onCampusVisibleChange={() => setCampusVisible(current => !current)}
          teachingMode={teachingMode}
          onTeachingModeChange={handleTeachingModeChange}
          teachingLinkSnapshot={teachingLinkSnapshot}
          isWalkerSceneActive={isWalkerSceneActive}
          handoverPolicyProps={{
            draft: handoverPolicyDraft,
            applied: appliedHandoverPolicy,
            hasDraftChanges: hasHandoverPolicyDraftChanges,
            hasOverrides: hasHandoverPolicyOverrides,
            onDraftChange: handleHandoverPolicyDraftChange,
            onApply: handleApplyHandoverPolicy,
            onReset: handleResetHandoverPolicy,
          }}
          archivedBoundaryProps={{ homepageCanonicalAnalysis }}
          signalTuningProps={{
            baseProfile,
            tuning: signalTuning,
            topology: activeSceneTopology,
            sceneVisualScale,
            hasOverrides: hasSignalOverrides || hasTopologyOverrides || hasVisualScaleOverrides,
            appMode,
            formulaBudget: simState.physicalServingBudget,
            isFormulaEvidenceStale: staleFormulaEvidenceKey !== null,
            activeMainTab: isRootHomepage ? homepageSignalTuningMainTab : undefined,
            onActiveMainTabChange: isRootHomepage ? setHomepageSignalTuningMainTab : undefined,
            onTuningChange: handleSignalTuningChange,
            onTopologyChange: handleSceneTopologyChange,
            servingSatelliteId: simState.servingSatId,
            candidateSatelliteId: simState.pendingTargetSatId ?? simState.comparisonSatId,
            formulaFrame: simState.angleAwareFormulaFrame,
            showHomepageEeThreshold: isRootHomepage,
            homepageEeThresholdKbitPerJoule,
            onHomepageEeThresholdKbitPerJouleChange: handleHomepageEeThresholdChange,
            walkerScenarioDate,
            walkerScenarioTime,
            onWalkerScenarioDateChange: setWalkerScenarioDate,
            onWalkerScenarioTimeChange: setWalkerScenarioTime,
            onSceneVisualScaleChange: setSceneVisualScale,
            onReset: handleResetSignalTuning,
          }}
          canonicalControlsProps={{
            analysis: homepageCanonicalAnalysis,
            activeTab: homepageCanonicalTab,
            onActiveTabChange: setHomepageCanonicalTab,
          }}
        />
        <main
          className="leo-shell-canvas"
          data-testid="leo-shell-canvas"
          data-timeline-visibility={shellChromeVisibility.timeline ? 'visible' : 'hidden'}
          data-handover-criterion={
            isArchivedTleSceneActive
              ? 'canonical-tle-3db-30s'
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
              handoverSurfaceBindingsRef={handoverSurfaceBindingsRef}
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
              teachingSurfaceProjectionRef={teachingSurfaceProjectionRef}
              focusedJoinKey={focusedJoinKey}
              onFocusJoinKeyChange={handleFocusJoinKeyChange}
              teachingNarrativeEnabled={isRootHomepage && homepageNarrativeTeachingMode}
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
          <AppSceneOverlays
            sceneLane={sceneLane}
            replaySceneFrame={replaySceneFrame}
            directorCinematicEnabled={directorCinematicEnabled}
            directorFocusEnabled={directorFocusEnabled}
            cinematicFadePulse={cinematicFadePulse}
            reducedMotion={runtime.reducedMotion}
            suppressCinematicFade={shouldSuppressInterSeekFade(handoverCinema.armFilter)}
            onCinematicSeekPeak={handleCinematicSeekPeak}
            shellOverlayVisible={shellChromeVisibility.sceneOverlay}
            showTeachingAuxiliaryUi={HOMEPAGE_TEACHING_AUXILIARY_UI_VISIBLE}
            teachingMode={teachingMode}
            isWalkerSceneActive={isWalkerSceneActive}
            sixActsSubtitle={sixActsSubtitle}
            sixActsFacts={sixActsTeachingFactsRef.current}
            sixActsTrace={sixActsTeachingTraceRef.current}
            sixActsReceipt={sixActsTeachingReceipt}
            sixActsOffsetDb={appliedHandoverPolicy.offsetDb}
            sixActsTttSec={appliedHandoverPolicy.triggerTimeSec}
            teachingProjection={teachingSurfaceProjection}
          />
          {shellChromeVisibility.timeline
            && (isRootHomepage || homepageTeachingTimeline === null)
            ? timelineBar
            : null}
        </main>
        <AppRightSidebar
          shellVisible={shellChromeVisibility.rightSidebar}
          isArchivedTleSceneActive={isArchivedTleSceneActive}
          homepageCanonicalRightRailProps={{ homepageCanonicalAnalysis }}
          teachingRail={teachingSurfaceProjection !== null ? (
            <HandoverTeachingRail
              projection={teachingSurfaceProjection}
              paused={teachingLecture.paused}
              onPausedChange={teachingLecture.setPaused}
              onRestart={teachingLecture.restart}
              onSeek={teachingLecture.seek}
              speed={teachingLecture.speed}
              onSpeedChange={teachingLecture.setSpeed}
              onClose={() => setTeachingStageKind(null)}
            />
          ) : null}
          homepageRailPanel={homepageRailPanel}
          visibleTabs={visibleRightSidebarTabs}
          activeTab={activeRightSidebarTab}
          onTabChange={setRightSidebarTab}
          showcaseArtifact={showcaseArtifact}
          showcaseError={showcaseError}
          activeSceneFrame={activeSceneFrame}
          frameIndex={frameIndex}
          handoverEventRail={handoverEventRail}
          liveRailSnapshotId={homepageRailProjection?.snapshotId ?? ''}
          liveRailSourceFrameId={homepageRailProjection?.sourceFrameId ?? ''}
          liveRailPhase={homepageRailProjection?.phase ?? ''}
          liveStatusContent={sceneLane === 'sinr-live' && isWalkerSceneActive ? (
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
                sourceProvenance="synthetic-walker"
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
              sourceProvenance={isArchivedTleSceneActive
                ? 'archived-tle'
                : sceneSource === 'artifact-replay'
                  ? 'artifact-replay'
                  : 'synthetic-walker'}
            />
          )}
        />
      </div>
    </div>
    </LocaleProvider>
  );
}
