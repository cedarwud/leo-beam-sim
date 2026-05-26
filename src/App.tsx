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
  createOmegaRescalarizedModqnReplayPlaybackDisplayState,
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
  getBundleSidebarSnapshot,
  persistHandoverMode,
  type RuntimeHandoverMode,
  type RuntimeOmegaState,
} from './ui/useModqnHandoverState';
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
import {
  SCENE_TOPOLOGY_OVERRIDES_KEY,
  applySceneTopology,
  createSceneTopologyState,
  getSceneTopologyEvidenceKey,
  getSceneTopologyResetKey,
  hasSceneTopologyOverrides,
  type SceneTopologyState,
} from './sceneTopology';
import {
  SCENE_VISUAL_SCALE_OVERRIDES_KEY,
  createSceneVisualScaleState,
  getSceneVisualScaleResetKey,
  hasSceneVisualScaleOverrides,
  resolveSceneVisualScaleMultipliers,
  type SceneVisualScaleMultipliers,
  type SceneVisualScaleState,
} from './sceneVisualScale';
import { ControlBar } from './ui/ControlBar';
import { AppModeRail } from './ui/AppModeRail';
import { DiagnosticsDrawer } from './ui/DiagnosticsDrawer';
import { InfoPanel } from './ui/InfoPanel';
import { SidebarTabShell, type SidebarTabItem } from './ui/SidebarTabShell';
import { SignalTuningPanel } from './ui/SignalTuningPanel';
import { ModqnObjectiveTab } from './ui/ModqnObjectiveTab';
import { ModqnEvidenceTab } from './ui/ModqnEvidenceTab';
import { ServiceStatusBanner } from './ui/modqn-training/ServiceStatusBanner';
import { TrainingForm } from './ui/modqn-training/TrainingForm';
import { JobsPanel } from './ui/modqn-training/JobsPanel';
import { ArtifactPicker } from './ui/modqn-training/ArtifactPicker';
import { RewardCurvePanel } from './ui/modqn-training/RewardCurvePanel';
import { DecisionVizPanel } from './ui/modqn-training/DecisionVizPanel';
import { readTrainingServiceBaseUrl } from './modqn/training-trigger/baseUrl';
import { fetchUserTrainedBundleEnvelope } from './modqn/training-trigger/userTrainedBundleFetch';
import { HandoverPolicyControls } from './ui/HandoverPolicyControls';
import {
  ClaimBoundaryBanner,
  type ClaimBoundaryBannerInput,
} from './ui/ClaimBoundaryBanner';
import { loadShowcaseArtifact } from './showcase/loadShowcaseArtifact';
import { showcaseArtifactToSceneInterpolated } from './showcase/showcaseArtifactToSceneInterpolated';
import { ShowcaseReplayController } from './showcase/ShowcaseReplayController';
import type { VisualShowcaseArtifact } from './scene/visual-showcase-contract';
import {
  DEFAULT_UE_MOBILITY_PARAMS,
  type UeMobilityParams,
} from './engine/ue/multiUeMobility';
import type { NormalizedSceneFrame } from './scene/NormalizedSceneFrame';
import type {
  SignalSourceState,
  PanelPrimaryState,
  PanelComparisonState,
  VisualFrequencyDiagnosticsState,
} from './scene/types';
import { persistUiMode, readPersistedUiMode, type UiMode } from './ui/uiMode';
import {
  APP_MODE_DEFAULT_PROFILE,
  APP_MODE_HANDOVER_MAP,
  readPersistedAppMode,
  readPersistedProfileByMode,
  persistAppMode,
  persistProfileByMode,
  resolveProfileForAppMode,
  type AppExperienceMode,
  type ProfileByMode,
} from './ui/appMode';
import { usePlaybackControls } from './usePlaybackControls';
import { useCameraControls } from './useCameraControls';

const DEFAULT_PROFILE_ID = APP_MODE_DEFAULT_PROFILE['sinr-experiment'];
const EPOCH_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const MODQN_PAPER_BASELINE_UE_COUNT = 100;

/**
 * P1e follow-up: ClaimBoundaryBanner mount input for the live-sim path.
 *
 * The renderer accepts only the {sceneSource, claimBoundary, evidenceStatus,
 * provenance} subset of NormalizedSceneFrame. On the live-sim path no artifact
 * is loaded, so we feed the banner a static stub that mirrors the live-stub
 * shape emitted by `liveSimToScene` (allowedClaims / forbiddenClaims identical
 * to the producer-validated live boundary). The banner therefore renders in
 * `kind: 'rendered'` mode with the live SINR claim and the live forbidden-claim
 * list active. Full artifact-replay banner wiring (sourcing the input from the
 * loaded VisualShowcaseArtifact) lands in A-P3.
 */
const LIVE_SIM_CLAIM_BOUNDARY_INPUT: ClaimBoundaryBannerInput = {
  sceneSource: 'live-sim',
  provenance: {
    kind: 'live-stub',
    note: 'live-sim provenance — repo build info',
  },
  claimBoundary: {
    kind: 'live-stub',
    storyKind: 'live-sinr-sim',
    allowedClaims: ['interference-aware SINR (live)'],
    forbiddenClaims: [
      'Multi-Catfish-MODQN effectiveness',
      'Catfish-EE',
      'general EE-MODQN superiority',
      'active-TX EE recovery',
      'physical energy saving',
    ],
  },
  evidenceStatus: { kind: 'live-stub', status: 'live', notes: [] },
};

type LeftSidebarTab = 'objective' | 'signal' | 'handover' | 'training' | 'jobs';
type RightSidebarTab = 'modqn' | 'live';

const LEFT_SIDEBAR_TABS: readonly SidebarTabItem<LeftSidebarTab>[] = [
  { key: 'objective', label: 'MODQN objective', description: 'post-hoc ω weights' },
  { key: 'signal', label: 'SINR formula', description: 'SINR tuning' },
  { key: 'handover', label: 'Handover policy', description: 'decision timing gates' },
  { key: 'training', label: 'MODQN training', description: 'launch backend training run' },
  { key: 'jobs', label: 'MODQN jobs', description: 'training run history' },
];

const SINR_LEFT_SIDEBAR_TABS: readonly SidebarTabItem<LeftSidebarTab>[] = [
  LEFT_SIDEBAR_TABS[1],
  LEFT_SIDEBAR_TABS[2],
];

const MODQN_LEFT_SIDEBAR_TABS: readonly SidebarTabItem<LeftSidebarTab>[] = [
  LEFT_SIDEBAR_TABS[0],
  LEFT_SIDEBAR_TABS[1],
  LEFT_SIDEBAR_TABS[2],
  LEFT_SIDEBAR_TABS[3],
  LEFT_SIDEBAR_TABS[4],
];

const RIGHT_SIDEBAR_TABS: readonly SidebarTabItem<RightSidebarTab>[] = [
  { key: 'live', label: 'Live status', description: 'current scene state' },
  { key: 'modqn', label: 'MODQN evidence', description: 'artifact proof' },
];

const SINR_RIGHT_SIDEBAR_TABS: readonly SidebarTabItem<RightSidebarTab>[] = [
  RIGHT_SIDEBAR_TABS[0],
];

const MODQN_RIGHT_SIDEBAR_TABS: readonly SidebarTabItem<RightSidebarTab>[] = RIGHT_SIDEBAR_TABS;

interface InitialRuntimeState {
  readonly appMode: AppExperienceMode;
  readonly selectedProfileId: string;
  readonly handoverMode: RuntimeHandoverMode;
  readonly profileByMode: ProfileByMode;
}

interface HandoverPolicyRuntimeState {
  profileId: string;
  draft: HandoverPolicyTuningState;
  applied: HandoverPolicyTuningState;
  version: number;
}

function resolvePresentationMode(profile: Profile): PresentationMode {
  if (profile.id === APP_MODE_DEFAULT_PROFILE['sinr-experiment']) return 'demo-readability';
  if (profile.profileClass === 'candidate-rich') return 'candidate-rich';
  return 'research-default';
}

function isKnownProfileId(id: string): boolean {
  return profileList.some(p => p.id === id);
}

function readInitialRuntimeState(): InitialRuntimeState {
  const appMode = readPersistedAppMode();
  const profileByMode = readPersistedProfileByMode();
  const selectedProfileId = resolveProfileForAppMode(appMode, profileByMode, isKnownProfileId);
  const handoverMode = APP_MODE_HANDOVER_MAP[appMode];
  const defaultState: InitialRuntimeState = {
    appMode,
    selectedProfileId: DEFAULT_PROFILE_ID,
    handoverMode,
    profileByMode,
  };
  return { ...defaultState, selectedProfileId };
}

function getLeftSidebarTabsForMode(mode: RuntimeHandoverMode): readonly SidebarTabItem<LeftSidebarTab>[] {
  return mode === 'sinr-offset'
    ? SINR_LEFT_SIDEBAR_TABS
    : MODQN_LEFT_SIDEBAR_TABS;
}

function getDefaultLeftSidebarTabForMode(mode: RuntimeHandoverMode): LeftSidebarTab {
  return mode === 'sinr-offset' ? 'signal' : 'objective';
}

function getRightSidebarTabsForMode(mode: RuntimeHandoverMode): readonly SidebarTabItem<RightSidebarTab>[] {
  return mode === 'decision-overlay-on-live-sinr'
    ? MODQN_RIGHT_SIDEBAR_TABS
    : SINR_RIGHT_SIDEBAR_TABS;
}

function getDefaultRightSidebarTabForMode(_mode: RuntimeHandoverMode): RightSidebarTab {
  return 'live';
}

function clampOmegaComponent(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(1, Math.max(0, numeric));
}

function normalizeRuntimeOmega(weights: Readonly<Record<string, unknown>> | undefined): RuntimeOmegaState {
  const throughput = clampOmegaComponent(
    weights?.throughput ?? weights?.r1Throughput,
    MODQN_PAPER_FAITHFUL_OMEGA.throughput,
  );
  const handover = clampOmegaComponent(
    weights?.handover ?? weights?.r2Handover,
    MODQN_PAPER_FAITHFUL_OMEGA.handover,
  );
  const loadBalance = clampOmegaComponent(
    weights?.loadBalance ?? weights?.r3LoadBalance,
    MODQN_PAPER_FAITHFUL_OMEGA.loadBalance,
  );
  const sum = throughput + handover + loadBalance;
  if (sum <= 0) return MODQN_PAPER_FAITHFUL_OMEGA;
  return {
    throughput: throughput / sum,
    handover: handover / sum,
    loadBalance: loadBalance / sum,
  };
}

function readSceneSourceFromUrl(): 'live-sim' | 'artifact-replay' {
  if (typeof window === 'undefined') return 'live-sim';
  const params = new URLSearchParams(window.location.search);
  const src = params.get('sceneSource');
  return src === 'artifact-replay' ? 'artifact-replay' : 'live-sim';
}

function readSceneTopologyOverrides(): SceneTopologyState {
  if (typeof window === 'undefined') return createSceneTopologyState();

  try {
    const stored = window.localStorage.getItem(SCENE_TOPOLOGY_OVERRIDES_KEY);
    if (stored === null) return createSceneTopologyState();
    const parsed: unknown = JSON.parse(stored);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return createSceneTopologyState();
    }
    const record = parsed as Partial<Record<keyof SceneTopologyState, unknown>>;
    const mobilityParams = record.ueMobilityParams;
    const normalizedMobilityParams: UeMobilityParams | null =
      mobilityParams !== null
      && typeof mobilityParams === 'object'
      && !Array.isArray(mobilityParams)
      && typeof (mobilityParams as Partial<UeMobilityParams>).speedKmPerSec === 'number'
      && typeof (mobilityParams as Partial<UeMobilityParams>).waypointCount === 'number'
      && typeof (mobilityParams as Partial<UeMobilityParams>).manhattanGridSpacingKm === 'number'
        ? {
            speedKmPerSec: (mobilityParams as UeMobilityParams).speedKmPerSec,
            waypointCount: (mobilityParams as UeMobilityParams).waypointCount,
            manhattanGridSpacingKm: (mobilityParams as UeMobilityParams).manhattanGridSpacingKm,
          }
        : null;
    return {
      satsPerPlane: typeof record.satsPerPlane === 'number' ? record.satsPerPlane : null,
      beamCountPerSatellite: typeof record.beamCountPerSatellite === 'number'
        ? record.beamCountPerSatellite
        : null,
      ueCount: typeof record.ueCount === 'number' ? record.ueCount : null,
      ueDistributionMode: record.ueDistributionMode === 'random'
        || record.ueDistributionMode === 'grid'
        || record.ueDistributionMode === 'clustered'
        ? record.ueDistributionMode
        : null,
      ueMobilityMode: record.ueMobilityMode === 'static'
        || record.ueMobilityMode === 'random-walk'
        || record.ueMobilityMode === 'waypoints'
        || record.ueMobilityMode === 'manhattan'
        ? record.ueMobilityMode
        : null,
      ueMobilityParams: normalizedMobilityParams,
      enableUeTrails: record.enableUeTrails === true ? true : null,
    };
  } catch {
    return createSceneTopologyState();
  }
}

function readSceneVisualScaleOverrides(): SceneVisualScaleState {
  if (typeof window === 'undefined') return createSceneVisualScaleState();

  try {
    const stored = window.localStorage.getItem(SCENE_VISUAL_SCALE_OVERRIDES_KEY);
    if (stored === null) return createSceneVisualScaleState();
    const parsed: unknown = JSON.parse(stored);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return createSceneVisualScaleState();
    }
    const record = parsed as Partial<Record<keyof SceneVisualScaleState, unknown>>;
    const sceneScale = record.sceneScale === 'demo-readability' || record.sceneScale === 'paper-faithful'
      ? record.sceneScale
      : 'paper-faithful';
    return {
      sceneScale,
      ueMarkerScale: typeof record.ueMarkerScale === 'number' ? record.ueMarkerScale : 1.0,
    };
  } catch {
    return createSceneVisualScaleState();
  }
}

export function App() {
  const [sceneSource] = useState<'live-sim' | 'artifact-replay'>(() => readSceneSourceFromUrl());
  const [showcaseArtifact, setShowcaseArtifact] = useState<VisualShowcaseArtifact | null>(null);
  const [showcaseLoading, setShowcaseLoading] = useState(false);
  const [showcaseError, setShowcaseError] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [ueDisplayCount, setUeDisplayCount] = useState<number>(100);
  const [elevatedUeId, setElevatedUeId] = useState<string | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);

  const initialRuntimeRef = useRef<InitialRuntimeState | null>(null);
  if (initialRuntimeRef.current === null) {
    initialRuntimeRef.current = readInitialRuntimeState();
  }
  const initialRuntime = initialRuntimeRef.current;
  const [appMode, setAppModeRaw] = useState<AppExperienceMode>(initialRuntime.appMode);
  const profileByModeRef = useRef<ProfileByMode>(initialRuntime.profileByMode);
  const [selectedProfileId, setSelectedProfileId] = useState(initialRuntime.selectedProfileId);
  const [uiMode, setUiMode] = useState<UiMode>(() => readPersistedUiMode());

  // S3: handover mode — persisted for sinr-offset/decision-overlay-on-live-sinr, never for omega-heuristic.
  const [handoverMode, setHandoverModeRaw] = useState<RuntimeHandoverMode>(
    initialRuntime.handoverMode,
  );
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
  const [rightSidebarTab, setRightSidebarTab] = useState<RightSidebarTab>('live');
  const [selectedUserTrainedJobId, setSelectedUserTrainedJobId] = useState<string | null>(null);
  const [bundleProvenanceKind, setBundleProvenanceKind] = useState<'paper-faithful' | 'user-trained'>('paper-faithful');
  const [userTrainedLoadError, setUserTrainedLoadError] = useState<string | null>(null);
  const visibleLeftSidebarTabs = useMemo(
    () => getLeftSidebarTabsForMode(handoverMode),
    [handoverMode],
  );
  const activeLeftSidebarTab = visibleLeftSidebarTabs.some(tab => tab.key === leftSidebarTab)
    ? leftSidebarTab
    : getDefaultLeftSidebarTabForMode(handoverMode);
  const visibleRightSidebarTabs = useMemo(
    () => getRightSidebarTabsForMode(handoverMode),
    [handoverMode],
  );
  const activeRightSidebarTab = visibleRightSidebarTabs.some(tab => tab.key === rightSidebarTab)
    ? rightSidebarTab
    : getDefaultRightSidebarTabForMode(handoverMode);
  const [beamDensityOverride, setBeamDensityOverride] = useState<BeamDensity | null>(null);
  const [beamCalloutsEnabled, setBeamCalloutsEnabled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(() => readPrefersReducedMotion());
  const [viewport, setViewport] = useState(() => readRuntimeViewport());
  const camera = useCameraControls();
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
    () => applySceneTopology(applySignalTuning(baseProfile, signalTuning), appMode === 'sinr-experiment' ? sceneTopology : createSceneTopologyState()),
    [appMode, baseProfile, signalTuning, sceneTopology],
  );
  const effectiveProfile = useMemo(
    () => applyHandoverPolicyTuning(signalTunedProfile, appliedHandoverPolicy),
    [signalTunedProfile, appliedHandoverPolicy],
  );
  const hasSignalOverrides = useMemo(
    () => hasSignalTuningOverrides(baseProfile, signalTuning),
    [baseProfile, signalTuning],
  );
  const hasTopologyOverrides = useMemo(
    () => appMode === 'sinr-experiment' && hasSceneTopologyOverrides(sceneTopology),
    [appMode, sceneTopology],
  );
  const hasVisualScaleOverrides = useMemo(
    () => hasSceneVisualScaleOverrides(sceneVisualScale),
    [sceneVisualScale],
  );
  const sceneVisualScaleResetKey = useMemo(
    () => getSceneVisualScaleResetKey(sceneVisualScale),
    [sceneVisualScale],
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
    () => [
      getSignalTuningResetKey(signalTuning),
      getSceneTopologyResetKey(appMode === 'sinr-experiment' ? sceneTopology : createSceneTopologyState()),
    ].join('|'),
    [appMode, signalTuning, sceneTopology],
  );
  const signalEvidenceKey = useMemo(
    () => [
      getSignalTuningEvidenceKey(signalTuning),
      getSceneTopologyEvidenceKey(appMode === 'sinr-experiment' ? sceneTopology : createSceneTopologyState()),
    ].join('|'),
    [appMode, sceneTopology, signalTuning],
  );
  const handoverResetKey = useMemo(
    () => `${handoverMode}:${handoverPolicyVersion}:${getHandoverPolicyResetKey(appliedHandoverPolicy)}`,
    [appliedHandoverPolicy, handoverMode, handoverPolicyVersion],
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
    beamCalloutsEnabled,
    cinematicMode: effectiveCinematicMode,
    cameraCommand: camera.cameraCommand,
    viewport,
    ueCount: appMode === 'sinr-experiment'
      ? sceneTopology.ueCount ?? undefined
      : MODQN_PAPER_BASELINE_UE_COUNT,
    ueDistributionMode: appMode === 'sinr-experiment'
      ? sceneTopology.ueDistributionMode ?? 'random'
      : 'random',
    ueMobilityMode: appMode === 'sinr-experiment'
      ? sceneTopology.ueMobilityMode ?? 'static'
      : 'static',
    ueMobilityParams: appMode === 'sinr-experiment'
      ? sceneTopology.ueMobilityParams ?? DEFAULT_UE_MOBILITY_PARAMS
      : DEFAULT_UE_MOBILITY_PARAMS,
    enableUeTrails: appMode === 'sinr-experiment'
      ? sceneTopology.enableUeTrails === true
      : false,
  }), [
    appMode,
    beamDensityOverride,
    beamCalloutsEnabled,
    camera.cameraCommand,
    demoStartOffset,
    effectiveProfile,
    effectiveCinematicMode,
    handoverResetKey,
    runtimeVisualSettings,
    sceneTopology.ueDistributionMode,
    sceneTopology.ueMobilityMode,
    sceneTopology.ueMobilityParams,
    sceneTopology.enableUeTrails,
    sceneTopology.ueCount,
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

  const handleSceneTopologyChange = useCallback((next: SceneTopologyState) => {
    startTransition(() => {
      setSceneTopology(next);
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

  const handleProfileChange = useCallback((profileId: string) => {
    const next: ProfileByMode = {
      ...profileByModeRef.current,
      [appMode]: profileId,
    };
    profileByModeRef.current = next;
    persistProfileByMode(next);
    setSelectedProfileId(profileId);
  }, [appMode]);

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
      setLeftSidebarTab('objective');
      setRightSidebarTab('live');
      return;
    }

    // omega-heuristic: never persist; just set in-memory.
    if (nextMode === 'omega-heuristic') {
      setHandoverModeRaw(nextMode);
      setRescalarizeFallbackCount(0);
      resetOmegaDisplayApplied();
      setLeftSidebarTab('objective');
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
    setLeftSidebarTab('signal');
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
  const handleHandoverModeChange = useCallback((nextMode: RuntimeHandoverMode) => {
    if (nextMode === handoverMode) return;
    applyHandoverModeSideEffects(nextMode, effectiveProfile);
  }, [
    applyHandoverModeSideEffects,
    effectiveProfile,
    handoverMode,
  ]);

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

    startTransition(() => {
      setAppModeRaw(nextMode);
      setSelectedProfileId(incomingProfileId);
      applyHandoverModeSideEffects(nextHandoverMode, incomingProfile);
    });
  }, [
    appMode,
    applyHandoverModeSideEffects,
    selectedProfileId,
  ]);

  // S3: expose a setter so ModqnObjectiveTab (via useModqnHandoverState hook)
  // can update the omegaActive snapshot in the mode context.
  const handleOmegaActiveChange = useCallback((next: RuntimeOmegaState) => {
    setOmegaActiveForContext(next);
    markOmegaDisplayApplied();
  }, [markOmegaDisplayApplied]);

  const handleBeamDensityChange = useCallback((nextDensity: BeamDensity) => {
    setBeamDensityOverride(nextDensity);
  }, []);

  // D-S3 replaces the Phase B stub import { fetchArtifactManifest } path with an all-or-nothing envelope swap.
  const handleLoadIntoScene = useCallback(async (jobId: string) => {
    const config = { baseUrl: readTrainingServiceBaseUrl() };
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
    setBundleProvenanceKind('paper-faithful');
    setUserTrainedLoadError(null);
  }, []);

  useEffect(() => subscribeToReducedMotionPreference(setReducedMotion), []);

  useEffect(() => subscribeToRuntimeViewport(setViewport), []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SCENE_TOPOLOGY_OVERRIDES_KEY, JSON.stringify(sceneTopology));
    } catch {
      // Storage can be unavailable in private or embedded browser contexts.
    }
  }, [sceneTopology]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SCENE_VISUAL_SCALE_OVERRIDES_KEY, JSON.stringify(sceneVisualScale));
    } catch {
      // Storage can be unavailable in private or embedded browser contexts.
    }
  }, [sceneVisualScale]);

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

  // P3: fetch visual-showcase-v1 artifact at startup if in artifact-replay mode.
  useEffect(() => {
    if (sceneSource !== 'artifact-replay') return;
    setShowcaseLoading(true);
    fetch('/showcase-artifacts/visual-showcase-v1.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP error ${r.status}`);
        return r.json();
      })
      .then(data => {
        const art = loadShowcaseArtifact(data);
        setShowcaseArtifact(art);
        setShowcaseLoading(false);
      })
      .catch(err => {
        setShowcaseError(err instanceof Error ? err.message : String(err));
        setShowcaseLoading(false);
      });
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
    if (!replaySceneFrame) return [];
    const allUes = replaySceneFrame.ues;
    if (allUes.length === 0) return [];
    const focusedId = elevatedUeId ?? allUes[0]?.id;
    const focusedIndex = allUes.findIndex(u => u.id === focusedId);
    const reordered = [...allUes];
    if (focusedIndex > 0) {
      const [focusedUe] = reordered.splice(focusedIndex, 1);
      reordered.unshift(focusedUe);
    }
    return reordered.slice(0, Math.min(ueDisplayCount, reordered.length));
  }, [replaySceneFrame, elevatedUeId, ueDisplayCount]);

  const activeSceneFrame = useMemo((): NormalizedSceneFrame | undefined => {
    if (sceneSource !== 'artifact-replay' || !replaySceneFrame) return undefined;
    return {
      ...replaySceneFrame,
      ues: processedUes,
    };
  }, [sceneSource, replaySceneFrame, processedUes]);

  // Sync replay frame state to SimState so InfoPanel/DiagnosticsDrawer reflect
  // the producer-truth playback cursor. We never recompute SINR or handover
  // truth here — we only forward producer values (R1).
  useEffect(() => {
    if (sceneSource !== 'artifact-replay' || !replaySceneFrame) return;

    const allUes = replaySceneFrame.ues;
    if (allUes.length === 0) return;
    const focusedId = elevatedUeId ?? allUes[0]?.id ?? null;
    const focusedUe = (focusedId ? allUes.find(u => u.id === focusedId) : null) ?? allUes[0];
    if (!focusedUe) return;

    let hoCount = 0;
    let intraHoCount = 0;
    if (showcaseArtifact) {
      for (let i = 1; i <= frameIndex; i++) {
        const prev = showcaseArtifact.timeline[i - 1];
        const curr = showcaseArtifact.timeline[i];
        if (!prev || !curr) continue;
        const prevUe = prev.ues.find(u => u.id === focusedId) ?? prev.ues[0];
        const currUe = curr.ues.find(u => u.id === focusedId) ?? curr.ues[0];
        if (prevUe && currUe) {
          if (currUe.servingSatelliteId !== prevUe.servingSatelliteId) {
            hoCount++;
          } else if (currUe.servingBeamId !== prevUe.servingBeamId) {
            intraHoCount++;
          }
        }
      }
    }

    const servingSatId = focusedUe.servingSatelliteId;
    const servingBeamId = focusedUe.servingBeamId ? parseInt(focusedUe.servingBeamId) : null;
    const targetSatId = focusedUe.targetSatelliteId ?? null;
    const targetBeamId = focusedUe.targetBeamId ? parseInt(focusedUe.targetBeamId) : null;

    const candidates = focusedUe.candidatesByBeamId;
    const targetSinrDb =
      targetSatId && focusedUe.targetBeamId && candidates
        ? candidates.get(focusedUe.targetBeamId)?.dB ?? null
        : null;

    const physicalServing: SignalSourceState = {
      satId: servingSatId,
      beamId: servingBeamId,
      sinrDb: focusedUe.channelMetric.dB,
      elevationDeg: null,
      rangeKm: null,
      status: 'derived',
    };

    const panelPrimary: PanelPrimaryState = {
      ...physicalServing,
      role:
        replaySceneFrame.handover.kind !== 'none' && replaySceneFrame.handover.kind !== ''
          ? 'ho-source'
          : 'serving',
    };

    const panelComparison: PanelComparisonState = {
      satId: targetSatId,
      beamId: targetBeamId,
      sinrDb: targetSinrDb,
      elevationDeg: null,
      rangeKm: null,
      status: targetSatId ? 'derived' : 'none',
      role: targetSatId ? 'pending' : 'none',
    };

    const sinrDeltaDb = targetSinrDb !== null ? targetSinrDb - focusedUe.channelMetric.dB : null;

    const visualFrequencyDiagnostics: VisualFrequencyDiagnosticsState = {
      primary: {
        satId: servingSatId,
        beamId: servingBeamId,
        frequencyIndex: 0,
        frequencyIndexSource:
          servingSatId !== null && servingBeamId !== null
            ? 'fallback-numeric-modulo'
            : 'not-visible',
        runtimeFrequencyReuse: 0,
        coreLayoutFrequencyReuse: null,
      },
      comparison: {
        satId: targetSatId,
        beamId: targetBeamId,
        frequencyIndex: 0,
        frequencyIndexSource:
          targetSatId !== null && targetBeamId !== null
            ? 'fallback-numeric-modulo'
            : 'not-visible',
        runtimeFrequencyReuse: 0,
        coreLayoutFrequencyReuse: null,
      },
    };

    setSimState({
      profileId: showcaseArtifact?.scenario.id ?? 'modqn-1sat-7beam',
      formulaFamilyLabel: 'SNR (no interference)',
      satelliteVisualIdentityById: {},
      physicalServing,
      panelPrimary,
      panelComparison,
      visualFrequencyDiagnostics,
      servingSatId,
      servingBeamId,
      servingElevationDeg: null,
      servingRangeKm: null,
      pendingTargetSatId: targetSatId,
      pendingTargetBeamId: targetBeamId,
      pendingTargetSinrDb: targetSinrDb,
      comparisonSatId: targetSatId,
      comparisonBeamId: targetBeamId,
      comparisonElevationDeg: null,
      comparisonRangeKm: null,
      comparisonSinrDb: targetSinrDb,
      comparisonKind: targetSatId ? 'pending' : null,
      sinrDeltaDb,
      recentHoSourceSatId: null,
      recentHoTargetSatId: null,
      recentHoSourceBeamId: null,
      recentHoTargetBeamId: null,
      recentHoDeltaDb: null,
      lastHoEvent: null,
      simTimeSec: replaySceneFrame.tSec,
      sinrDb: focusedUe.channelMetric.dB,
      physicalServingBudget: null,
      servingBudget: null,
      handoverOffsetDb: 0,
      handoverTriggerProgressSec: 0,
      handoverTriggerSec: 0,
      hoCount,
      intraHoCount,
      lastHoReason: replaySceneFrame.handover.handoverProvenance?.note ?? '—',
      beamHopEnabled: false,
      beamHopSlotIndex: -1,
      beamHopSlotSec: 0,
      servingBeamActiveThisSlot: true,
      servingSatActiveBeamIds: servingBeamId !== null ? [servingBeamId] : [],
      pendingTargetActiveBeamIds: targetBeamId !== null ? [targetBeamId] : [],
    });
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
      data-ui-mode={uiMode}
      data-app-mode={appMode}
      data-topology-overrides-active={hasTopologyOverrides ? 'true' : 'false'}
      data-visual-scale-overrides-active={hasVisualScaleOverrides ? 'true' : 'false'}
      data-visual-scale-key={sceneVisualScaleResetKey}
      className="leo-app-shell"
    >
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
        beamCalloutsEnabled={beamCalloutsEnabled}
        cinematicMode={effectiveCinematicMode}
        handoverMode={handoverMode}
        onProfileChange={handleProfileChange}
        onUiModeChange={handleUiModeChange}
        onBeamDensityChange={handleBeamDensityChange}
        onToggleBeamCallouts={() => setBeamCalloutsEnabled(value => !value)}
        onCameraPresetSelect={camera.selectCameraPreset}
        onCinematicModeChange={camera.setCinematicMode}
        onTogglePause={playback.togglePause}
        onSpeedChange={playback.setSpeed}
        onDismissAutoSlow={playback.dismissAutoSlow}
        onToggleAutoSlow={playback.toggleAutoSlow}
        onHandoverModeChange={handleHandoverModeChange}
        sceneSource={sceneSource}
        liveUeCount={runtime.ueCount ?? 1}
        ueDisplayCount={ueDisplayCount}
        maxUeCount={showcaseArtifact?.timeline[0]?.ues.length ?? 100}
        onUeDisplayCountChange={setUeDisplayCount}
        elevatedUeId={elevatedUeId}
        ueIds={showcaseArtifact?.timeline[0]?.ues.map(u => u.id) ?? []}
        onElevatedUeIdChange={setElevatedUeId}
      />
      <div className="leo-shell-row">
        <AppModeRail mode={appMode} onChange={handleAppModeChange} />
        <aside className="leo-shell-left" aria-label="Signal tuning panel slot">
          <SidebarTabShell
            label="Simulation control sidebar"
            side="left"
            tabs={visibleLeftSidebarTabs}
            activeKey={activeLeftSidebarTab}
            onChange={setLeftSidebarTab}
          >
            {activeLeftSidebarTab === 'objective' ? (
              <ModqnObjectiveTab />
            ) : activeLeftSidebarTab === 'signal' ? (
              <SignalTuningPanel
                baseProfile={baseProfile}
                tuning={signalTuning}
                topology={sceneTopology}
                sceneVisualScale={sceneVisualScale}
                hasOverrides={hasSignalOverrides}
                appMode={appMode}
                uiMode="tuning"
                formulaBudget={simState.physicalServingBudget}
                isFormulaEvidenceStale={staleFormulaEvidenceKey !== null}
                onTuningChange={handleSignalTuningChange}
                onTopologyChange={handleSceneTopologyChange}
                onSceneVisualScaleChange={setSceneVisualScale}
                onReset={handleResetSignalTuning}
              />
            ) : activeLeftSidebarTab === 'training' ? (
              <TrainingForm appMode={appMode} />
            ) : activeLeftSidebarTab === 'jobs' ? (
              <JobsPanel appMode={appMode} onLoadIntoScene={handleLoadIntoScene} />
            ) : (
              <HandoverPolicyControls
                draft={handoverPolicyDraft}
                applied={appliedHandoverPolicy}
                hasDraftChanges={hasHandoverDraftChanges}
                hasOverrides={hasHandoverResetTarget}
                onDraftChange={handleHandoverPolicyDraftChange}
                onApply={handleApplyHandoverPolicy}
                onReset={handleResetHandoverPolicy}
              />
            )}
          </SidebarTabShell>
        </aside>
        <main
          className="leo-shell-canvas"
          data-testid="leo-shell-canvas"
          data-handover-criterion={
            handoverMode === 'decision-overlay-on-live-sinr' ? 'decision-overlay-on-live-sinr' : 'sinr-offset'
          }
        >
          <MainScene
            speed={playback.effectiveSpeed}
            paused={playback.paused}
            profile={effectiveProfile}
            runtime={runtime}
            visualScaleMultipliers={visualScaleMultipliers}
            modqnReplayDisplayState={renderedModqnReplayDisplayState}
            showModqnReplayScene={false}
            onSimUpdate={handleSimUpdate}
            sceneFrame={activeSceneFrame}
          />
        </main>
        <aside className="leo-shell-right" aria-label="Signal status panel slot">
          <ServiceStatusBanner appMode={appMode} />
          <SidebarTabShell
            label="Simulation status sidebar"
            side="right"
            tabs={visibleRightSidebarTabs}
            activeKey={activeRightSidebarTab}
            onChange={setRightSidebarTab}
          >
            {activeRightSidebarTab === 'live' ? (
              <section className="leo-live-status-stack" aria-label="Live status for current scene">
                <ClaimBoundaryBanner
                  frame={
                    sceneSource === 'artifact-replay' && activeSceneFrame
                      ? activeSceneFrame
                      : LIVE_SIM_CLAIM_BOUNDARY_INPUT
                  }
                  bundleProvenanceKind={bundleProvenanceKind}
                />
                <InfoPanel
                  {...simState}
                  uiMode={uiMode}
                  profile={effectiveProfile}
                  handoverMode={handoverMode}
                  isFormulaEvidenceStale={staleFormulaEvidenceKey !== null}
                  channelMetricKind={activeSceneFrame?.channelMetricKind}
                />
                <DiagnosticsDrawer
                  {...simState}
                  uiMode={uiMode}
                  profile={effectiveProfile}
                  handoverMode={handoverMode}
                  rescalarizeFallbackCount={rescalarizeFallbackCount}
                />
              </section>
            ) : (
              <section
                className="leo-modqn-sidebar-stack"
                aria-label="MODQN proof"
              >
                {userTrainedLoadError !== null ? (
                  <div
                    role="alert"
                    data-testid="load-into-scene-error-banner"
                    className="leo-load-into-scene-error-banner"
                  >
                    User-trained bundle load failed: {userTrainedLoadError}
                  </div>
                ) : null}
                {bundleProvenanceKind === 'user-trained' ? (
                  <button
                    type="button"
                    data-testid="revert-to-paper-faithful"
                    className="leo-revert-to-paper-faithful"
                    onClick={() => { void handleRevertToPaperFaithful(); }}
                  >
                    Revert to paper-faithful
                  </button>
                ) : null}
                <ArtifactPicker
                  appMode={appMode}
                  selectedJobId={selectedUserTrainedJobId}
                  onLoadEntry={handleLoadIntoScene}
                />
                <ModqnEvidenceTab
                  simState={simState}
                  bandwidthMHz={effectiveProfile.channel.bandwidthMHz}
                  appliedHandoverOffsetDb={appliedHandoverPolicy.offsetDb}
                  appliedHandoverTriggerTimeSec={appliedHandoverPolicy.triggerTimeSec}
                  handoverMode={handoverMode}
                  bundleProvenanceKind={bundleProvenanceKind}
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
    </div>
    </ModqnHandoverModeProvider>
    </ModqnEnvelopeProvider>
  );
}
