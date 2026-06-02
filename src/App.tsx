import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MainScene } from './scene/MainScene';
import {
  getProfileLabel,
  loadProfile,
  profileList,
} from './profiles';
import type { Profile } from './profiles/types';
import type { BeamDensity, SimState } from './scene/types';
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
  type ModqnReplayPlaybackSlot,
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
  applySceneTopology,
  createSceneTopologyState,
  getSceneTopologyEvidenceKey,
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
import { TimelineBar, type TimelineSpeedPreset } from './ui/TimelineBar';
import {
  HandoverEventRail,
  type HandoverRailEvent,
  type HandoverRailEventKind,
} from './ui/HandoverEventRail';
import { DiagnosticsDrawer } from './ui/DiagnosticsDrawer';
import { InfoPanel } from './ui/InfoPanel';
import { SidebarTabShell } from './ui/SidebarTabShell';
import { SignalTuningPanel } from './ui/SignalTuningPanel';
import { ModqnReplayCuePanel } from './ui/ModqnReplayCuePanel';
import { ModqnEvidenceTab } from './ui/ModqnEvidenceTab';
import { ServiceStatusBanner } from './ui/modqn-training/ServiceStatusBanner';
import { TrainingForm } from './ui/modqn-training/TrainingForm';
import { JobsPanel } from './ui/modqn-training/JobsPanel';
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
import { HandoverPolicyControls } from './ui/HandoverPolicyControls';
import { ClaimBoundaryBanner } from './ui/ClaimBoundaryBanner';
import { loadShowcaseArtifact } from './showcase/loadShowcaseArtifact';
import { showcaseArtifactToSceneInterpolated } from './showcase/showcaseArtifactToSceneInterpolated';
import { ShowcaseReplayController } from './showcase/ShowcaseReplayController';
import { AlgorithmDashboard } from './showcase/dashboard/AlgorithmDashboard';
import type { VisualShowcaseArtifact } from './scene/visual-showcase-contract';
import type { NormalizedSceneFrame } from './scene/NormalizedSceneFrame';
import { persistUiMode, readPersistedUiMode, type UiMode } from './ui/uiMode';
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
  persistSceneTopologyOverrides,
  persistSceneVisualScaleOverrides,
  readSceneSourceFromUrl,
  readSceneTopologyOverrides,
  readSceneVisualScaleOverrides,
  type SceneSourceMode,
} from './app/appPersistence';
import {
  resolveSceneLane,
  shouldRenderModqnReplayScene,
} from './app/sceneLane';
import {
  buildLiveWalkerHandoverEventIndex,
  type LiveWalkerHandoverEventIndex,
} from './scene/liveWalkerHandoverEventIndex';
import {
  DEFAULT_MODQN_VISUAL_LAYER_PRESET,
  type ModqnVisualLayerPreset,
} from './scene/modqnVisualLayers';
import { LIVE_SIM_CLAIM_BOUNDARY_INPUT } from './app/liveClaimBoundary';
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

const MODQN_REPLAY_HANDOVER_SLOT_SEC = 3.2;
const MODQN_REPLAY_STABLE_SLOT_SEC = 0.9;
const MODQN_REPLAY_VISUAL_MIN_DISPLAY_DURATION_SEC = 60;
const MODQN_REPLAY_VISUAL_TICK_MS = 100;

interface LiveTimelineSeekRequest {
  targetSec: number;
  requestKey: string;
}

interface ModqnReplayVisualTimeline {
  readonly durationSec: number;
  readonly currentTimeSec: number;
  readonly slotMidpointSecByIndex: ReadonlyMap<number, number>;
}

function formatRailBeamLabel(satId: string | null | undefined, beamId: string | number | null | undefined): string {
  const satLabel = satId ?? 'unknown';
  if (beamId === null || beamId === undefined || beamId === '') return satLabel;
  return `${satLabel} B${beamId}`;
}

function normalizeRailEventKind(kind: string | undefined): HandoverRailEventKind | null {
  const value = kind?.toLowerCase() ?? '';
  if (value.includes('inter')) return 'inter';
  if (value.includes('intra') || value.includes('beam-switch') || value.includes('beam')) return 'intra';
  return null;
}

function getNearestShowcaseFrame(
  artifact: VisualShowcaseArtifact,
  timeSec: number,
): VisualShowcaseArtifact['timeline'][number] | null {
  let nearest: VisualShowcaseArtifact['timeline'][number] | null = null;
  let bestDistance = Infinity;
  for (const frame of artifact.timeline) {
    const distance = Math.abs(frame.tSec - timeSec);
    if (distance < bestDistance) {
      nearest = frame;
      bestDistance = distance;
    }
  }
  return nearest;
}

function deriveArtifactRailEventKind(
  artifact: VisualShowcaseArtifact,
  timeSec: number,
  eventType: string,
): HandoverRailEventKind | null {
  const frame = getNearestShowcaseFrame(artifact, timeSec);
  const sourceKind = normalizeRailEventKind(eventType) ?? normalizeRailEventKind(frame?.handoverState.kind);
  if (sourceKind !== null) return sourceKind;

  const handover = frame?.handoverState;
  if (handover?.targetSatelliteId && handover.targetSatelliteId !== handover.servingSatelliteId) return 'inter';
  if (handover?.targetBeamId && handover.targetBeamId !== handover.servingBeamId) return 'intra';
  return null;
}

function buildArtifactHandoverRailEvents(
  artifact: VisualShowcaseArtifact | null,
): readonly HandoverRailEvent[] {
  if (artifact === null) return [];

  return artifact.events.flatMap(event => {
    if (!event.type.toLowerCase().includes('handover')) return [];
    const kind = deriveArtifactRailEventKind(artifact, event.tSec, event.type);
    if (kind === null) return [];
    const frame = getNearestShowcaseFrame(artifact, event.tSec);
    const handover = frame?.handoverState;
    return [{
      id: `artifact-${event.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      timeSec: event.tSec,
      kind,
      title: event.title,
      fromLabel: formatRailBeamLabel(handover?.servingSatelliteId, handover?.servingBeamId),
      toLabel: formatRailBeamLabel(handover?.targetSatelliteId ?? handover?.servingSatelliteId, handover?.targetBeamId),
      detail: event.type,
      source: 'artifact-replay' as const,
    }];
  });
}

interface ModqnRailEventBucket {
  event: HandoverRailEvent;
  fromLabels: Set<string>;
  toLabels: Set<string>;
}

function summarizeRailLabelSet(labels: ReadonlySet<string>, pluralLabel: string): string {
  const values = [...labels];
  if (values.length === 0) return 'unknown';
  if (values.length === 1) return values[0] ?? 'unknown';
  return `${values.length} ${pluralLabel}`;
}

function buildModqnHandoverRailEvents(
  envelope: ModqnReplayEnvelope | null,
  displayTimeSecBySlotIndex: ReadonlyMap<number, number> = new Map(),
): readonly HandoverRailEvent[] {
  if (envelope === null) return [];

  const grouped = new Map<string, ModqnRailEventBucket>();
  for (const slot of envelope.replaySlots) {
    for (const row of slot.rows) {
      const eventKind = row.producerTruth.handoverEvent.kind;
      const kind = normalizeRailEventKind(eventKind);
      if (eventKind === 'none' || kind === null) continue;
      const previous = row.producerTruth.previousServing;
      const selected = row.producerTruth.selectedServing;
      const timeSec = row.producerTruth.timestamps.timeSec;
      const displayTimeSec = displayTimeSecBySlotIndex.get(slot.slotIndex);
      const fromLabel = formatRailBeamLabel(previous.satId, previous.localBeamIndex + 1);
      const toLabel = formatRailBeamLabel(selected.satId, selected.localBeamIndex + 1);
      const key = `${timeSec.toFixed(3)}:${kind}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.fromLabels.add(fromLabel);
        existing.toLabels.add(toLabel);
        const count = (existing.event.count ?? 1) + 1;
        existing.event = {
          ...existing.event,
          title: kind === 'inter' ? 'Satellite handover window' : 'Beam switch window',
          fromLabel: summarizeRailLabelSet(existing.fromLabels, 'sources'),
          toLabel: summarizeRailLabelSet(existing.toLabels, 'targets'),
          count,
        };
        continue;
      }
      grouped.set(key, {
        event: {
          id: `modqn-${kind}-${timeSec.toFixed(3).replace(/[^0-9]/g, '_')}`,
          timeSec,
          displayTimeSec,
          kind,
          title: kind === 'inter' ? 'Satellite handover' : 'Beam switch',
          fromLabel,
          toLabel,
          detail: `slot ${slot.slotIndex}`,
          source: 'modqn-replay',
          count: 1,
        },
        fromLabels: new Set([fromLabel]),
        toLabels: new Set([toLabel]),
      });
    }
  }

  return [...grouped.values()].map(bucket => bucket.event);
}

function liveObservedHandoverRailEventFromState(state: SimState): HandoverRailEvent | null {
  const event = state.lastHoEvent;
  if (event === null || event.fromSatId === null || event.fromBeamId === null) return null;

  const kind = event.action === 'inter-handover' ? 'inter' : event.action === 'intra-switch' ? 'intra' : null;
  if (kind === null) return null;

  const eventTimeSec = (event.timeMs - APP_EPOCH_MS) / 1000;
  const timeSec = Number.isFinite(eventTimeSec) && eventTimeSec >= 0
    ? eventTimeSec
    : state.simTimeSec;

  return {
    id: `live-${kind}-${event.timeMs}-${event.fromSatId}-${event.fromBeamId}-${event.toSatId}-${event.toBeamId}`,
    timeSec,
    kind,
    title: kind === 'inter' ? 'Observed satellite handover' : 'Observed beam switch',
    fromLabel: formatRailBeamLabel(event.fromSatId, event.fromBeamId),
    toLabel: formatRailBeamLabel(event.toSatId, event.toBeamId),
    source: 'live-observed',
  };
}

function getModqnReplayVisualSlotDuration(slot: ModqnReplayPlaybackSlot): number {
  return slot.focusRow.handoverEventKind === 'none'
    ? MODQN_REPLAY_STABLE_SLOT_SEC
    : MODQN_REPLAY_HANDOVER_SLOT_SEC;
}

function getModqnReplayVisualTimeline(
  model: ModqnReplayPlaybackShellModel,
  elapsedSec: number,
): ModqnReplayVisualTimeline {
  const baseSlotDurations = model.slots.map(slot => getModqnReplayVisualSlotDuration(slot));
  const baseDurationSec = baseSlotDurations.reduce((sum, durationSec) => sum + durationSec, 0);
  const displayScale = baseDurationSec > 0
    ? Math.max(1, MODQN_REPLAY_VISUAL_MIN_DISPLAY_DURATION_SEC / baseDurationSec)
    : 1;
  let cursorSec = 0;
  const slotMidpointSecByIndex = new Map<number, number>();
  for (let index = 0; index < model.slots.length; index += 1) {
    const slot = model.slots[index];
    if (slot === undefined) continue;
    const baseDurationSec = baseSlotDurations[index] ?? 0;
    const durationSec = baseDurationSec * displayScale;
    slotMidpointSecByIndex.set(slot.slotIndex, cursorSec + (durationSec / 2));
    cursorSec += durationSec;
  }

  const roundedCursorSec = Number(cursorSec.toFixed(6));
  const durationSec = Number.isFinite(roundedCursorSec) && roundedCursorSec > 0 ? roundedCursorSec : 0;
  return {
    durationSec,
    currentTimeSec: durationSec > 0 ? Math.max(0, elapsedSec) % durationSec : 0,
    slotMidpointSecByIndex,
  };
}

function resolveModqnReplayVisualSlotOffset(
  model: ModqnReplayPlaybackShellModel,
  elapsedSec: number,
): number {
  if (model.slots.length === 0) return 0;

  const totalSec = model.slots.reduce(
    (sum, slot) => sum + getModqnReplayVisualSlotDuration(slot),
    0,
  );
  if (!Number.isFinite(totalSec) || totalSec <= 0) return 0;

  let cursor = Math.max(0, elapsedSec) % totalSec;
  for (let index = 0; index < model.slots.length; index += 1) {
    const slot = model.slots[index];
    if (slot === undefined) continue;
    const durationSec = getModqnReplayVisualSlotDuration(slot);
    if (cursor < durationSec) return index;
    cursor -= durationSec;
  }

  return Math.max(0, model.slots.length - 1);
}

export function App() {
  const [sceneSource] = useState<SceneSourceMode>(() => readSceneSourceFromUrl());
  const [showcaseArtifact, setShowcaseArtifact] = useState<VisualShowcaseArtifact | null>(null);
  const [showcaseLoading, setShowcaseLoading] = useState(false);
  const [showcaseError, setShowcaseError] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [ueDisplayCount, setUeDisplayCount] = useState<number>(100);
  const [elevatedUeId, setElevatedUeId] = useState<string | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [liveTimelineSeekRequest, setLiveTimelineSeekRequest] =
    useState<LiveTimelineSeekRequest | null>(null);

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
  const [modqnReplayProofRequested, setModqnReplayProofRequested] = useState(false);
  const canToggleModqnReplayProof =
    sceneSource === 'live-sim'
    && appMode === 'modqn-demo'
    && handoverMode === 'decision-overlay-on-live-sinr';
  const modqnReplayProofRequestActive = canToggleModqnReplayProof && modqnReplayProofRequested;
  const sceneLane = useMemo(
    () => resolveSceneLane({
      appMode,
      sceneSource,
      modqnReplayProofRequested: modqnReplayProofRequestActive,
    }),
    [appMode, modqnReplayProofRequestActive, sceneSource],
  );
  const showModqnReplayScene = shouldRenderModqnReplayScene(sceneLane);
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
  const [selectedTrainingServiceManifest, setSelectedTrainingServiceManifest] = useState<TrainingServiceManifest | null>(null);
  const [selectedTrainingRunMetadata, setSelectedTrainingRunMetadata] = useState<TrainingRunMetadata | null>(null);
  const [modqnVisualLayerPreset, setModqnVisualLayerPreset] = useState<ModqnVisualLayerPreset>(
    DEFAULT_MODQN_VISUAL_LAYER_PRESET,
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
  const [beamDensityOverride, setBeamDensityOverride] = useState<BeamDensity | null>(null);
  const [beamCalloutsEnabled, setBeamCalloutsEnabled] = useState(true);
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
  const handoverPolicyDraft = handoverPolicyState.profileId === baseProfile.id
    ? handoverPolicyState.draft
    : handoverPolicyDefaults;
  const appliedHandoverPolicy = handoverPolicyState.profileId === baseProfile.id
    ? handoverPolicyState.applied
    : handoverPolicyDefaults;
  const handoverPolicyVersion = handoverPolicyState.profileId === baseProfile.id
    ? handoverPolicyState.version
    : 0;
  const signalTunedProfile = useMemo(() => {
    const topology = appMode === 'sinr-experiment'
      ? sceneTopology
      : createSceneTopologyState();
    const tuned = applySceneTopology(applySignalTuning(baseProfile, signalTuning), topology);
    return applyTrainingEnvAxesToProfile(tuned, selectedTrainingEnvAxes, selectedTrainingSeedTriplet);
  }, [
    appMode,
    baseProfile,
    selectedTrainingEnvAxes,
    selectedTrainingSeedTriplet,
    signalTuning,
    sceneTopology,
  ]);
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
    () => recommendDemoReplayStartOffsetSec(baseProfile, APP_EPOCH_MS),
    [baseProfile],
  );

  const runtimeVisualSettings = useMemo(
    () => {
      const base = deriveRuntimeVisualSettings(uiMode, reducedMotion);
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
    [appMode, reducedMotion, uiMode],
  );
  const effectiveCinematicMode = useMemo(
    () => resolveRuntimeCinematicMode(uiMode, camera.cinematicMode),
    [camera.cinematicMode, uiMode],
  );
  const runtime = useMemo(() => buildAppRuntimeConfig({
    appMode,
    effectiveProfile,
    demoStartOffsetSec: demoStartOffset,
    liveTimelineSeekTargetSec: liveTimelineSeekRequest?.targetSec,
    liveTimelineSeekRequestKey: liveTimelineSeekRequest?.requestKey,
    signalResetKey,
    handoverResetKey,
    runtimeVisualSettings,
    beamDensityOverride,
    beamCalloutsEnabled,
    effectiveCinematicMode,
    cameraCommand: camera.cameraCommand,
    viewport,
    sceneTopology,
    selectedTrainingEnvAxes,
    modqnVisualLayerPreset,
  }), [
    appMode,
    beamDensityOverride,
    beamCalloutsEnabled,
    camera.cameraCommand,
    demoStartOffset,
    effectiveProfile,
    effectiveCinematicMode,
    liveTimelineSeekRequest,
    runtimeVisualSettings,
    handoverResetKey,
    modqnVisualLayerPreset,
    sceneTopology,
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
  const playback = usePlaybackControls(simState);

  const handleSimUpdate = useCallback((state: SimState) => {
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
      setLeftSidebarTab('replay');
      setRightSidebarTab('live');
      return;
    }

    // omega-heuristic: never persist; just set in-memory.
    if (nextMode === 'omega-heuristic') {
      setHandoverModeRaw(nextMode);
      setRescalarizeFallbackCount(0);
      resetOmegaDisplayApplied();
      setLeftSidebarTab('replay');
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

  // S3 compatibility path: omega stays sourced from the loaded bundle unless
  // a legacy/test-only caller explicitly invokes the old hook surface.
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
  // surface a banner and keep the typed-reference fallback so the demo still
  // renders. SDD §9.3 acceptance.
  useEffect(() => {
    if (sceneSource === 'artifact-replay') return;

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
    const claimKind = sceneLane === 'modqn-live-cell-preview'
      ? 'overlay-demo'
      : 'profile-derived-forecast';
    const index = buildLiveWalkerHandoverEventIndex({
      profile: effectiveProfile,
      epochUtcMs: APP_EPOCH_MS,
      claimKind,
      ueDistributionMode: runtime.ueDistributionMode,
      uePrimaryAnchorMode: runtime.uePrimaryAnchorMode,
      ueDistributionScope: runtime.ueDistributionScope,
      ueDistributionRadiusKm: runtime.ueDistributionRadiusKm,
      ueMobilityMode: runtime.ueMobilityMode,
      ueMobilityParams: runtime.ueMobilityParams,
    });
    if (!cancelled) setLiveWalkerHandoverEventIndex(index);

    return () => {
      cancelled = true;
    };
  }, [
    effectiveProfile,
    runtime.ueDistributionMode,
    runtime.ueDistributionRadiusKm,
    runtime.ueDistributionScope,
    runtime.ueMobilityMode,
    runtime.ueMobilityParams,
    runtime.uePrimaryAnchorMode,
    sceneLane,
    sceneSource,
  ]);

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
  const timelineDisabled =
    sceneSource === 'artifact-replay'
      ? replayController === null || showcaseLoading || showcaseError !== null
      : timelineDurationSec <= 0;
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

  const handleTimelineSeek = useCallback((targetSec: number) => {
    const target = clampTimelineTime(targetSec, timelineDurationSec);
    if (sceneSource === 'artifact-replay') {
      replayController?.seek(target);
      return;
    }
    if (timelineRailDescriptor.timeline.axisKind === 'display-stretched') {
      setModqnReplayVisualElapsedSec(clampTimelineTime(target, timelineRailDescriptor.timeline.axisDurationSec));
      return;
    }
    if (sceneLane === 'modqn-replay-proof') {
      const railAxisDurationSec = timelineRailDescriptor.rail.axisDurationSec;
      const visualTargetSec = timelineDurationSec > 0 && railAxisDurationSec > 0
        ? (target / timelineDurationSec) * railAxisDurationSec
        : target;
      setModqnReplayVisualElapsedSec(clampTimelineTime(visualTargetSec, railAxisDurationSec));
      return;
    }

    const absoluteTargetSec = liveTimelineWindowStartSec + target;
    setLiveTimelineSeekRequest({
      targetSec: absoluteTargetSec,
      requestKey: `${absoluteTargetSec.toFixed(3)}:${Date.now().toString(36)}`,
    });
    setLiveObservedHandoverRailEvents([]);
    setModqnReplayVisualElapsedSec(target);
  }, [
    liveTimelineWindowStartSec,
    replayController,
    sceneLane,
    sceneSource,
    timelineDurationSec,
    timelineRailDescriptor.rail.axisDurationSec,
    timelineRailDescriptor.timeline.axisDurationSec,
    timelineRailDescriptor.timeline.axisKind,
  ]);

  const handleHandoverRailSeek = useCallback((targetSec: number) => {
    if (
      sceneSource === 'live-sim'
      && (sceneLane === 'sinr-live' || sceneLane === 'modqn-live-cell-preview')
      && timelineRailDescriptor.rail.sourceOwner === 'live-walker'
      && timelineRailDescriptor.rail.horizonKind === 'live-walker-window'
    ) {
      const sourceTarget = clampTimelineTime(targetSec, timelineRailDescriptor.rail.durationSec);
      setLiveTimelineSeekRequest({
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
    handleTimelineSeek,
    liveTimelineWindowStartSec,
    sceneLane,
    sceneSource,
    timelineDurationSec,
    timelineRailDescriptor.rail.durationSec,
    timelineRailDescriptor.rail.horizonKind,
    timelineRailDescriptor.rail.sourceOwner,
  ]);

  const handleTimelineSpeedChange = useCallback((nextSpeed: TimelineSpeedPreset) => {
    playback.setSpeed(nextSpeed);
  }, [playback]);

  const handoverEventRail = (
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

  const activeSceneFrame = useMemo((): NormalizedSceneFrame | undefined => {
    if (sceneSource !== 'artifact-replay' || !replaySceneFrame) return undefined;
    return {
      ...replaySceneFrame,
      ues: processedUes,
    };
  }, [sceneSource, replaySceneFrame, processedUes]);
  const shouldRenderMainScene = sceneSource !== 'artifact-replay' || activeSceneFrame !== undefined;

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
      data-scene-lane={sceneLane}
      data-timeline-current-time-sec={timelineCurrentTimeSec.toFixed(3)}
      data-timeline-duration-sec={timelineDurationSec.toFixed(3)}
      data-timeline-disabled={timelineDisabled ? 'true' : 'false'}
      data-timeline-source-owner={timelineRailDescriptor.timeline.sourceOwner}
      data-timeline-horizon-kind={timelineRailDescriptor.timeline.horizonKind}
      data-timeline-claim-kind={timelineRailDescriptor.timeline.claimKind}
      data-live-timeline-seek-target={liveTimelineSeekRequest?.targetSec.toFixed(3) ?? ''}
      data-live-timeline-seek-key={liveTimelineSeekRequest?.requestKey ?? ''}
      data-topology-overrides-active={hasTopologyOverrides ? 'true' : 'false'}
      data-visual-scale-overrides-active={hasVisualScaleOverrides ? 'true' : 'false'}
      data-visual-scale-key={sceneVisualScaleResetKey}
      className="leo-app-shell"
    >
      {sceneSource !== 'artifact-replay' && modqnReplayFetchError !== null && (
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
        sceneLane={sceneLane}
        liveUeCount={runtime.ueCount ?? 1}
        ueDisplayCount={ueDisplayCount}
        maxUeCount={showcaseArtifact?.timeline[0]?.ues.length ?? 100}
        onUeDisplayCountChange={setUeDisplayCount}
        elevatedUeId={elevatedUeId}
        ueIds={showcaseArtifact?.timeline[0]?.ues.map(u => u.id) ?? []}
        onElevatedUeIdChange={setElevatedUeId}
        modqnVisualLayerPreset={modqnVisualLayerPreset}
        onModqnVisualLayerPresetChange={setModqnVisualLayerPreset}
      />
      <div className="leo-shell-row">
        <aside className="leo-shell-left" aria-label="Signal tuning panel slot">
          <SidebarTabShell
            label="Simulation control sidebar"
            side="left"
            tabs={visibleLeftSidebarTabs}
            activeKey={activeLeftSidebarTab}
            onChange={setLeftSidebarTab}
          >
            {activeLeftSidebarTab === 'artifact' ? (
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
            ) : activeLeftSidebarTab === 'replay' ? (
              <ModqnReplayCuePanel
                appMode={appMode}
                displayState={renderedModqnReplayDisplayState}
                proofViewportActive={sceneLane === 'modqn-replay-proof'}
                onProofViewportActiveChange={
                  canToggleModqnReplayProof ? setModqnReplayProofRequested : undefined
                }
              />
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
          data-scene-lane={sceneLane}
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
          {shouldRenderMainScene ? (
            <MainScene
              speed={playback.effectiveSpeed}
              paused={playback.paused}
              profile={effectiveProfile}
              runtime={runtime}
              visualScaleMultipliers={visualScaleMultipliers}
              modqnReplayDisplayState={renderedModqnReplayDisplayState}
              showModqnReplayScene={showModqnReplayScene}
              sceneLane={sceneLane}
              onSimUpdate={handleSimUpdate}
              sceneFrame={activeSceneFrame}
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
                {sceneSource === 'artifact-replay' && (
                  <AlgorithmDashboard artifact={showcaseArtifact} frameIndex={frameIndex} />
                )}
              </section>
            ) : activeRightSidebarTab === 'live' ? (
              <section className="leo-live-status-stack" aria-label="Live status for current scene">
                <ClaimBoundaryBanner
                  frame={
                    sceneSource === 'artifact-replay' && activeSceneFrame
                      ? activeSceneFrame
                      : LIVE_SIM_CLAIM_BOUNDARY_INPUT
                  }
                  bundleProvenanceKind={bundleProvenanceKind}
                />
                {handoverEventRail}
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
                {handoverEventRail}
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
