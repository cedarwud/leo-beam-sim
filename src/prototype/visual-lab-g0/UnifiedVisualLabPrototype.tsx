import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { VisualLabProgressiveControlDock, type VisualLabUeGeometryControls } from './VisualLabProgressiveControlDock';
import { VisualLabProgressiveResultDock } from './VisualLabProgressiveResultDock';
import type { VisualLabResultFocus } from './visualLabResultFocus';
import {
  VisualLabScene,
  type VisualLabConstellation,
  type VisualLabDensity,
  type VisualLabFocus,
  type VisualLabSceneAssetKey,
  type VisualLabSceneAssetStatus,
  type VisualLabView,
} from './VisualLabScene';
import { VisualLabTimeline } from './VisualLabTimeline';
import { useVisualLabSession } from '../../visualLab/session';
import {
  deriveVisualLabStorySceneDirection,
  useVisualLabStoryController,
  type VisualLabStorySceneDirection,
} from '../../visualLab/story';
import {
  VisualLabStoryRail,
} from '../../visualLab/storyUi';
import { formatStoryMetric, storyPointMetrics } from '../../visualLab/storyUi/storyRailModel';
import {
  VisualLabCausalReplayRail,
  type VisualLabCausalParameterChange,
} from '../../visualLab/causalReplay';
import {
  VisualLabClipEntryShelf,
  createVisualLabClipEntries,
  type VisualLabClipId,
  type VisualLabClipLaunchState,
  type VisualLabClipLaunchTarget,
} from '../../visualLab/clipReplay';
import {
  VisualLabGuidedReplayAnnotationOverlay,
  VisualLabGuidedReplayRail,
  guidedReplayDefinition,
  guidedReplayProgress,
  guidedReplayPhaseLabel,
  guidedReplayReturnProgress,
  isGuidedHandoverPhase,
  VISUAL_LAB_GUIDED_REPLAY_TOTAL_DURATION_MS,
  type VisualLabGuidedReplayPhase,
  type VisualLabGuidedReplayProgress,
  type VisualLabGuidedReplayNormalizedAnchorMap,
} from '../../visualLab/guidedReplay';
import type { VisualLabInspectTarget } from './presentation/visualLabPresentationContract';
import {
  buildVisualLabCaptureBundle,
  captureCanvasToWebm,
  createLocalDownloadArtifactWriter,
  downloadVisualLabClipArchive,
  createPhase1UploadAdapter,
  type VisualLabCaptureBundle,
} from '../../visualLab/export';
import {
  drawVisualLabClipFrame,
  VISUAL_LAB_CLIP_HEIGHT,
  VISUAL_LAB_CLIP_WIDTH,
  type VisualLabClipFramePresentation,
} from './visualLabClipCompositor';
import { visualLabCopy } from './presentation/visualLabCopy';
import type { VisualLabCanonicalSnapshot } from './visualLabCanonicalSnapshotAdapter';
import {
  DEFAULT_VISUAL_LAB_INPUTS,
  VISUAL_LAB_INPUT_DEFINITIONS,
  type VisualLabInputKey,
  type VisualLabInputValues,
} from '../../visualLab/experiment';
import {
  VISUAL_LAB_MODULES,
  moduleDefinition,
  moduleShortLabel,
  type VisualLabModuleKey,
} from './visualLabWorkspace';
import { useVisualLabCausalReplay } from './useVisualLabCausalReplay';
import { useVisualLabGuidedReplay } from './useVisualLabGuidedReplay';
import { focusForVisualLabInput } from './visualLabInputFocus';
import {
  degreesFromRadians,
  offAxisAngleRadForVisualLabUe,
  positionForVisualLabUeOffAxisAngle,
  radiansFromDegrees,
} from './visualLabUeGeometry';
import { canonicalHandoverPresentation } from './visualLabHandoverPresentation';
import { advanceVisualLabPlayback } from './visualLabPlaybackClock';
import {
  visualLabGlobalConstellationStore,
  type VisualLabGlobalConstellationFirstFrameState,
} from '../../visualLab/globalConstellation';
import './UnifiedVisualLabPrototype.scss';

export type SceneSource = {
  readonly constellation: VisualLabConstellation;
  readonly localDateTime: string;
};

const INITIAL_SOURCE: SceneSource = {
  constellation: 'starlink',
  localDateTime: '2026-08-12T20:00',
};

/** Presentation anchors for the directed replay camera pose. */
const GUIDED_REPLAY_ANNOTATION_ANCHORS: VisualLabGuidedReplayNormalizedAnchorMap = Object.freeze({
  'serving-satellite': Object.freeze({ x: .34, y: .29, radius: .05 }),
  'candidate-satellite': Object.freeze({ x: .66, y: .29, radius: .05 }),
  ue: Object.freeze({ x: .5, y: .68, radius: .035 }),
  'serving-beam': Object.freeze({ x: .42, y: .5, radius: .055 }),
  'candidate-beam': Object.freeze({ x: .58, y: .5, radius: .055 }),
  'sinr-result': Object.freeze({ x: .82, y: .11, width: .095, height: .052 }),
  'power-result': Object.freeze({ x: .93, y: .11, width: .095, height: .052 }),
  'throughput-result': Object.freeze({ x: .82, y: .175, width: .095, height: .052 }),
  'ee-result': Object.freeze({ x: .93, y: .175, width: .095, height: .052 }),
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type DemoHandoverKind = 'intra-handover' | 'inter-handover';

interface DemoHandoverState {
  readonly kind: DemoHandoverKind;
  readonly elapsedMs: number;
}

interface DemoHandoverView {
  readonly phase: VisualLabGuidedReplayPhase;
  readonly beat: 'before' | 'decision' | 'after';
  readonly progress: VisualLabGuidedReplayProgress;
}

/**
 * Presentation-only fallback clock.  It makes the two handover stories
 * playable when the accepted run has no candidate-rich trace, without
 * changing the canonical frame, SINR, power, throughput, or EE values.
 */
function demoHandoverView(elapsedMs: number): DemoHandoverView {
  const elapsed = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0);
  // This is a short teaching clock, not the canonical 30 s TLE decision
  // clock.  The candidate qualifies in a few seconds so the handover can be
  // read without waiting for a low-elevation tail.
  if (elapsed < 1_000) return { phase: 'baseline', beat: 'before', progress: guidedReplayProgress('baseline', elapsed) };
  if (elapsed < 2_800) return { phase: 'intervention', beat: 'before', progress: guidedReplayProgress('intervention', elapsed - 1_000) };
  if (elapsed < 5_200) return { phase: 'before', beat: 'before', progress: guidedReplayProgress('before', elapsed - 2_800) };
  if (elapsed < 6_800) return { phase: 'decision', beat: 'decision', progress: guidedReplayProgress('decision', elapsed - 5_200) };
  return { phase: 'after', beat: 'after', progress: guidedReplayProgress('after', elapsed - 6_800) };
}

const DEMO_HANDOVER_DURATION_MS = 12_000;

function focusFromResult(resultFocus: VisualLabResultFocus): Exclude<VisualLabFocus, 'none'> {
  if (resultFocus === 'handover' || resultFocus === 'candidate-link') return 'handover';
  if (resultFocus === 'energy-flow') return 'energy';
  return 'geometry';
}

function canvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error('The browser could not encode the figure as PNG.'));
        return;
      }
      void blob.arrayBuffer().then(buffer => resolve(new Uint8Array(buffer)), reject);
    }, 'image/png');
  });
}

function TimelinePendingPreview({ locale }: { readonly locale: 'zh-Hant' | 'en' }): ReactElement {
  // The accepted timeline remains mounted while a new run is published.  This
  // empty state is only for the very first frame, so it never tells the user
  // that ordinary playback is blocked during a background calculation.
  return <div
    className="vlab-timeline-pending-preview vlab-timeline-pending-preview--empty"
    aria-label={locale === 'zh-Hant' ? '時間軸' : 'Timeline'}
    aria-busy="true"
  />;
}

/**
 * Progressive visual-lab shell over one accepted session.  The global and
 * NTPU views, story rail, controls, and results all project the same frame.
 */
export function UnifiedVisualLabPrototype(): ReactElement {
  const session = useVisualLabSession({ view: 'service', density: 'clean', focus: 'geometry' });
  const lab = session.snapshot();
  const storyController = useVisualLabStoryController(lab);
  const storyState = storyController.state();
  const causalReplay = useVisualLabCausalReplay(session, lab);
  const guidedReplay = useVisualLabGuidedReplay(session, lab, storyController, causalReplay);
  const copy = visualLabCopy(lab.presentation.locale);
  const snapshot = lab.canonical;
  const timeline = lab.timeline;
  const globalSceneFrame = lab.globalScene;
  const localScene = lab.localScene;
  const inputs = lab.draft.parameters as VisualLabInputValues;
  const acceptedBeamWidthRad = localScene?.render.beam.theta3dbRad ?? inputs.theta3dbRad;
  const beamWidthDraftScale = localScene !== null
    && Number.isFinite(acceptedBeamWidthRad)
    && acceptedBeamWidthRad > 0
    && Number.isFinite(inputs.theta3dbRad)
    ? clamp(inputs.theta3dbRad / acceptedBeamWidthRad, .65, 2.4)
    : 1;
  const [openModules, setOpenModules] = useState<readonly VisualLabModuleKey[]>(['scene']);
  const [activeModule, setActiveModule] = useState<VisualLabModuleKey>('scene');
  const view = lab.presentation.view;
  const density = lab.presentation.density;
  const focus = lab.presentation.focus === 'none' ? 'geometry' : lab.presentation.focus;
  const [selectedUe, setSelectedUe] = useState<{ readonly x: number; readonly z: number } | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const elapsedSecRef = useRef(0);
  const [playing, setPlaying] = useState(false);
  const autoStartedSceneRef = useRef(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [storyOpen, setStoryOpen] = useState(false);
  const [simpleReplayKind, setSimpleReplayKind] = useState<'intra-handover' | 'inter-handover' | null>(null);
  const [demoReplay, setDemoReplay] = useState<DemoHandoverState | null>(null);
  const [storyDirectorEnabled, setStoryDirectorEnabled] = useState(true);
  const [sceneLabelsVisible, setSceneLabelsVisible] = useState(true);
  const [clipShelfOpen, setClipShelfOpen] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<VisualLabClipId>('inter-handover');
  const [clipLaunchState, setClipLaunchState] = useState<VisualLabClipLaunchState>('idle');
  const [clipLaunchError, setClipLaunchError] = useState<string | null>(null);
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);
  const [captureBundle, setCaptureBundle] = useState<VisualLabCaptureBundle | null>(null);
  const [clipRecording, setClipRecording] = useState(false);
  const [sceneAssetStatus, setSceneAssetStatus] = useState<Partial<Record<VisualLabSceneAssetKey, VisualLabSceneAssetStatus>>>({});
  const figureRootRef = useRef<HTMLDivElement>(null);
  const replayLauncherButtonRef = useRef<HTMLButtonElement>(null);
  const clipPanelRef = useRef<HTMLDivElement>(null);
  const ueRecomputeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipCloseButtonRef = useRef<HTMLButtonElement>(null);
  const clipCaptureAbortRef = useRef<AbortController | null>(null);
  const clipFrameRef = useRef<VisualLabClipFramePresentation | null>(null);
  const demoReplayRef = useRef<DemoHandoverState | null>(null);
  const guidedHandoverActive = guidedReplay.open && isGuidedHandoverPhase(guidedReplay.phase);
  const guidedReturnProgress = guidedReplay.open
    ? guidedReplayReturnProgress(guidedReplay.phase, guidedReplay.progress.phaseElapsedMs)
    : null;
  const storyDirection = deriveVisualLabStorySceneDirection(storyState, storyOpen || guidedHandoverActive);
  const demoReplayView = demoReplay === null ? null : demoHandoverView(demoReplay.elapsedMs);
  const causalParameterKey: VisualLabInputKey = causalReplay.storyId === 'beamwidth'
    ? 'theta3dbRad'
    : 'beamPowerCapW';
  const causalParameterDefinition = VISUAL_LAB_INPUT_DEFINITIONS.find(definition => (
    definition.key === causalParameterKey
  ));
  const causalParameterChange: VisualLabCausalParameterChange | null = causalParameterDefinition === undefined
    || causalReplay.baselineValue === null
    || causalReplay.probeValue === null
    ? null
    : {
        key: causalParameterKey,
        label: causalParameterDefinition.label,
        baseline: `${causalParameterDefinition.formatDisplayValue(causalParameterDefinition.toDisplayValue(causalReplay.baselineValue))}${causalParameterDefinition.displayUnit === 'degree' ? '°' : ` ${causalParameterDefinition.displayUnit}`}`,
        candidate: `${causalParameterDefinition.formatDisplayValue(causalParameterDefinition.toDisplayValue(causalReplay.probeValue))}${causalParameterDefinition.displayUnit === 'degree' ? '°' : ` ${causalParameterDefinition.displayUnit}`}`,
      };
  const storyBeamTrace = storyOpen || guidedHandoverActive ? storyState.activeStep?.beamTrace ?? null : null;
  const storyBeamFocus = storyBeamTrace === null
    || (storyState.activeStep?.phase !== 'before'
      && storyState.activeStep?.phase !== 'decision'
      && storyState.activeStep?.phase !== 'after')
    ? null
    : {
        userIndex: storyBeamTrace.from.userIndex,
        fromBeamId: storyBeamTrace.from.beamId,
        toBeamId: storyBeamTrace.to.beamId,
        currentBeamId: storyState.activeStep.phase === 'before'
          ? storyBeamTrace.from.beamId
          : storyBeamTrace.to.beamId,
        phase: storyState.activeStep.phase,
      } as const;
  const demoDirection = useMemo<VisualLabStorySceneDirection | null>(() => {
    if (demoReplay === null || demoReplayView === null || localScene === null) return null;
    const rankedSatellites = localScene.satellites
      .slice()
      .sort((left, right) => right.topocentric.elevationDeg - left.topocentric.elevationDeg);
    // The intra path preserves the accepted serving identity and footprint.
    // The inter path starts from the highest visible pair in the retained
    // pool, so a stale low-elevation candidate cannot open the story.
    const servingSatellite = demoReplay.kind === 'inter-handover'
      ? rankedSatellites[0] ?? localScene.serving
      : localScene.serving;
    const servingId = servingSatellite.satelliteId;
    const otherSatellite = rankedSatellites.find(satellite => satellite.satelliteId !== servingId)
      ?? (localScene.candidate.availability === 'available' && localScene.candidate.satelliteId !== servingId ? localScene.candidate : null);
    const targetId = demoReplay.kind === 'intra-handover'
      ? servingId
      : otherSatellite?.satelliteId ?? `${servingId}-demo-candidate`;
    const user = localScene.representative.availability === 'available'
      ? localScene.representative.user
      : localScene.substrate.users[0] ?? null;
    const fromBeamId = user === null
      ? localScene.activeBeamTargets.targets[0]?.beamId ?? 0
      : localScene.activeBeamTargets.targets.find(target => target.cellIndex === user.cellIndex)?.beamId
        ?? localScene.activeBeamTargets.targets[0]?.beamId
        ?? 0;
    // A same-satellite handover changes the beam ownership presentation on
    // the same UE/cell; it must not draw a fictional jump to another cell.
    const toBeamId = fromBeamId;
    return Object.freeze({
      storyId: `demo:${demoReplay.kind}`,
      storyKind: demoReplay.kind === 'intra-handover' ? 'intra-handover' : 'inter-handover',
      beat: demoReplayView.beat,
      cameraCue: demoReplayView.beat === 'before'
        ? 'handover-before'
        : demoReplayView.beat === 'decision' ? 'handover-decision' : 'handover-after',
      fromSatelliteId: servingId,
      toSatelliteId: targetId,
      fromBeamId: demoReplay.kind === 'intra-handover' ? fromBeamId : null,
      toBeamId: demoReplay.kind === 'intra-handover' ? toBeamId : null,
      userIndex: user?.index ?? null,
      revision: `demo:${demoReplay.kind}:${demoReplayView.phase}:${Math.round(demoReplay.elapsedMs / 80)}`,
    });
  }, [demoReplay, demoReplayView, localScene]);
  const demoBeamFocus = useMemo(() => {
    if (demoReplay?.kind !== 'intra-handover' || demoDirection === null) return null;
    return Object.freeze({
      userIndex: demoDirection.userIndex ?? 0,
      fromBeamId: demoDirection.fromBeamId ?? 0,
      toBeamId: demoDirection.toBeamId ?? demoDirection.fromBeamId ?? 0,
      currentBeamId: demoReplayView?.beat === 'before'
        ? demoDirection.fromBeamId ?? 0
        : demoDirection.toBeamId ?? demoDirection.fromBeamId ?? 0,
      phase: demoReplayView?.beat ?? 'before',
    } as const);
  }, [demoDirection, demoReplay?.kind, demoReplayView?.beat]);
  const effectiveStoryDirection = demoDirection ?? storyDirection;
  const effectiveStoryBeamFocus = demoBeamFocus ?? storyBeamFocus;
  const effectiveGuidedReplayProgress = demoReplay !== null
    ? demoReplayView?.progress
    : guidedReplay.open ? guidedReplay.progress : undefined;
  const effectiveGuidedCandidateEngaged = demoReplay?.kind === 'inter-handover'
    ? demoReplayView?.progress.candidateEngaged
    : guidedReplay.open ? guidedReplay.progress.candidateEngaged : undefined;
  const effectiveStoryReturnProgress = demoReplay !== null && demoReplayView !== null
    ? guidedReplayReturnProgress(demoReplayView.phase, demoReplayView.progress.phaseElapsedMs)
    : guidedReturnProgress;
  const draftSource: SceneSource = {
    constellation: lab.draft.source.constellation,
    localDateTime: lab.draft.source.taipeiDateTime || INITIAL_SOURCE.localDateTime,
  };
  const displayAcceptedSource: SceneSource = lab.accepted !== null
    ? {
      constellation: lab.accepted.identity.constellation,
      localDateTime: lab.accepted.identity.instantTaipei.slice(0, 16),
    }
    : INITIAL_SOURCE;
  const [globalArtifactState, setGlobalArtifactState] = useState<VisualLabGlobalConstellationFirstFrameState>(() => visualLabGlobalConstellationStore.state(displayAcceptedSource.constellation));
  useEffect(() => {
    const constellation = displayAcceptedSource.constellation;
    setGlobalArtifactState(visualLabGlobalConstellationStore.state(constellation));
    const unsubscribe = visualLabGlobalConstellationStore.subscribe((next) => {
      if (next.constellation === constellation) setGlobalArtifactState(next);
    });
    void visualLabGlobalConstellationStore.load(constellation);
    return unsubscribe;
  }, [displayAcceptedSource.constellation]);
  useEffect(() => {
    // Warm both validated first-frame artifacts in the background so changing
    // Starlink/OneWeb does not wait for a complete timeline rebuild.
    void visualLabGlobalConstellationStore.load('starlink');
    void visualLabGlobalConstellationStore.load('oneweb');
  }, []);
  const globalArtifact = globalArtifactState.status === 'ready'
    && globalArtifactState.constellation === displayAcceptedSource.constellation
    ? globalArtifactState.artifact
    : null;
  // A full-run/parameter rebuild is a background publication transaction: the
  // accepted scene remains usable and controls must not be presented as
  // blocked.  Only a source/date transaction (applied draft differs from the
  // currently accepted identity) owns the source-application lock.
  const acceptedSourceMatchesDraft = lab.accepted !== null
    && lab.accepted.identity.constellation === lab.draft.source.constellation
    && lab.accepted.identity.instantTaipei.slice(0, 16) === lab.draft.source.taipeiDateTime;
  const applyingSource = lab.draft.source.dirty === false
    && lab.accepted !== null
    && !acceptedSourceMatchesDraft;
  const globalSceneComplete = lab.phase === 'ready' || timeline !== null;
  const globalRenderReady = (globalSceneComplete && globalSceneFrame !== null) || globalArtifact !== null;
  const globalStatus = lab.phase === 'rejected'
    ? 'error' as const
    : globalRenderReady
      ? 'ready' as const
      : globalArtifactState.status === 'loading' || applyingSource ? 'loading' as const : 'idle' as const;
  const ui = lab.presentation.locale === 'zh-Hant' ? {
    sourceAria: '目前場景來源',
    fieldAria: '場域切換',
    modulesAria: '可逐步加入的分析模組',
    ntpuField: 'NTPU 場域',
    globalField: '全球軌道',
    active: '目前操作',
    added: '已加入',
    add: '加入',
    unavailable: '目前資料無法建立',
    building: '正在建立衛星軌道與鏈路結果',
    buildingHint: '完整計算完成後即可調整參數。',
    centerAria: '視覺化場景、故事與時間軸',
    showSceneLabels: '顯示標籤',
    rebuilding: '正在更新衛星軌道場景',
    replayLibrary: '情境回放',
    closeReplay: '結束回放',
    closeReplayLibrary: '關閉情境回放',
    intraHandover: '同衛星換手',
    interHandover: '跨衛星換手',
    stopHandover: '停止換手播放',
    downloadReplay: '下載回放',
    recordingReplay: '正在錄製回放…',
    replayDownloaded: '回放影片與來源資訊已下載。',
    legendAria: '場景圖例',
    earthPrimary: '服務、候選與軌跡',
    earthVisible: 'NTPU 可見衛星',
    earthContext: '同一 TLE 時刻的其他衛星',
    skyServing: '服務軌跡',
    skyCandidate: '候選軌跡',
    skyContext: '其他可見衛星',
    serviceServing: '服務衛星與波束',
    serviceCandidate: '候選衛星與波束',
    serviceContext: '其他衛星與干擾',
    energy: '能量流',
    timelineBuilding: '正在建立完整時間軸',
    timelineLocked: '計算完成前不開放尚未建立的時間點。',
    calculationProgress: '軌道與鏈路計算進度',
    resultBuilding: '正在建立計算結果',
    resultLocked: '目前還沒有可顯示的完整結果。',
    skipControls: '跳到參數控制',
    skipScene: '跳到視覺化場景',
    skipResults: '跳到計算結果',
    switchTheme: lab.presentation.theme === 'dark' ? '切換至淺色主題' : '切換至深色主題',
  } : {
    sourceAria: 'Current scene source',
    fieldAria: 'Field switch',
    modulesAria: 'Analysis modules that can be revealed progressively',
    ntpuField: 'NTPU field',
    globalField: 'Global orbit',
    active: 'Active',
    added: 'Shown',
    add: 'Add',
    unavailable: 'The selected data could not be built',
    building: 'Building orbit and link results',
    buildingHint: 'Controls become available when the complete calculation is ready.',
    centerAria: 'Visualization scene, story, and timeline',
    showSceneLabels: 'Show labels',
    rebuilding: 'Updating the satellite-orbit scene',
    replayLibrary: 'Scenario replay',
    closeReplay: 'End replay',
    closeReplayLibrary: 'Close scenario replay',
    intraHandover: 'Intra-satellite beam switch',
    interHandover: 'Inter-satellite handover',
    stopHandover: 'Stop handover playback',
    downloadReplay: 'Download replay',
    recordingReplay: 'Recording replay…',
    replayDownloaded: 'The replay video and provenance have been downloaded.',
    legendAria: 'Scene legend',
    earthPrimary: 'Serving, candidate, and trajectories',
    earthVisible: 'Satellites visible from NTPU',
    earthContext: 'Other satellites at the same TLE instant',
    skyServing: 'Serving pass',
    skyCandidate: 'Candidate pass',
    skyContext: 'Other visible satellites',
    serviceServing: 'Serving satellite and beams',
    serviceCandidate: 'Candidate satellite and beam',
    serviceContext: 'Other satellites and interference',
    energy: 'Energy flow',
    timelineBuilding: 'Building the complete timeline',
    timelineLocked: 'Times that have not been computed remain unavailable.',
    calculationProgress: 'Orbit and link computation progress',
    resultBuilding: 'Building computed results',
    resultLocked: 'No complete result is available yet.',
    skipControls: 'Skip to parameter controls',
    skipScene: 'Skip to visualization scene',
    skipResults: 'Skip to computed results',
    switchTheme: lab.presentation.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
  } as const;

  useEffect(() => {
    setSelectedUe(null);
  }, [snapshot?.source.frameId]);

  useEffect(() => {
    if (!clipShelfOpen) return undefined;
    clipCloseButtonRef.current?.focus();
    const handleDialogKeys = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setClipShelfOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(clipPanelRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled):not([tabindex="-1"])') ?? [])];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', handleDialogKeys);
    return () => {
      window.removeEventListener('keydown', handleDialogKeys);
      replayLauncherButtonRef.current?.focus();
    };
  }, [clipShelfOpen]);

  useEffect(() => () => {
    clipCaptureAbortRef.current?.abort();
  }, []);

  // The hook's time resolution is the accepted run-start identity.  Derive
  // the visible source label from it whenever the global frame is ready so a
  // completed constellation/date switch cannot leave the controls describing
  // the previous run while Earth is already rendering the new one.
  const handleSceneAssetStatus = useCallback((asset: VisualLabSceneAssetKey, status: VisualLabSceneAssetStatus): void => {
    setSceneAssetStatus((current) => current[asset] === status ? current : { ...current, [asset]: status });
  }, []);
  const currentSatelliteAsset: VisualLabSceneAssetKey = `satellite-${displayAcceptedSource.constellation}`;
  const requiredSceneAssetsReady = view === 'earth'
    || (sceneAssetStatus[currentSatelliteAsset] === 'ready'
      && (view === 'sky' || sceneAssetStatus['ntpu-substrate'] === 'ready'));
  const requiredSceneAssetFailed = view !== 'earth'
    && (sceneAssetStatus[currentSatelliteAsset] === 'error'
      || (view === 'service' && sceneAssetStatus['ntpu-substrate'] === 'error'));
  const replaySourceLabel = `${displayAcceptedSource.constellation === 'starlink' ? 'Starlink' : 'OneWeb'} · ${displayAcceptedSource.localDateTime.replace('T', ' ')}`;
  const causalReplayAvailable = lab.phase === 'ready' && lab.accepted?.runReady === true && snapshot !== null;
  const activeReplayRuntime = guidedReplay.open ? 'guided' : storyOpen ? 'story' : causalReplay.open ? 'causal' : null;
  // Direct handover stories keep the normal scene, timeline, and result rail
  // visible.  Only the legacy guided/causal cinema uses the full-focus path.
  const replayFocusActive = guidedReplay.open || causalReplay.open;
  // The compact handover buttons own a short presentation clock.  Keep the
  // normal timeline in its playing state while that clock is active, but do
  // not advance the canonical run twice in parallel.
  const demoReplayActive = demoReplay !== null;
  // This is a presentation window over an accepted committed trace.  It is
  // intentionally derived from the same local scene DTO consumed by the
  // renderer; no timeline event or identity is manufactured in the shell.
  const canonicalVisualHandover = localScene === null
    ? null
    : canonicalHandoverPresentation(localScene.handover, localScene.interpolation.visualOffsetSec);
  const committedVisualSwitchWindow = !replayFocusActive
    && canonicalVisualHandover?.source === 'canonical-trace'
    && canonicalVisualHandover.phase === 'switch';
  const activeReplayId: VisualLabClipId | null = guidedReplay.open
    ? guidedReplay.storyId
    : storyOpen
      ? storyState.activeStoryKind === 'intra-handover' ? 'intra-beam-handover' : 'inter-handover'
      : causalReplay.open
        ? causalReplay.storyId === 'beamwidth' ? 'link-gain-ab' : 'power-cap-ab'
        : null;
  const activeReplayTitle = guidedReplay.open
    ? guidedReplayDefinition(guidedReplay.storyId).title[lab.presentation.locale]
    : storyOpen
    ? storyState.activeStoryKind === 'intra-handover'
      ? (lab.presentation.locale === 'zh-Hant' ? '同衛星換束' : 'Intra-satellite beam handover')
      : (lab.presentation.locale === 'zh-Hant' ? '跨衛星換手' : 'Inter-satellite handover')
    : causalReplay.storyId === 'beamwidth'
      ? (lab.presentation.locale === 'zh-Hant' ? '3 dB 波束寬度 A/B' : '3 dB beamwidth A/B')
      : (lab.presentation.locale === 'zh-Hant' ? '發射功率上限 A/B' : 'Transmit-power-cap A/B');
  const replayPhase = guidedReplay.open
    ? guidedReplay.phase
    : storyOpen
    ? storyState.activeStep?.phase ?? 'before'
    : causalReplay.phase;
  const replayPhaseLabel = guidedReplay.open
    ? guidedReplayPhaseLabel(guidedReplay.phase, lab.presentation.locale)
    : lab.presentation.locale === 'zh-Hant'
      ? ({ before: '調整前', decision: '判斷', after: '調整後', from: '原波束', transition: '換束過程', to: '新波束', baseline: '基準', intervention: '調整', comparison: '比較' } as const)[replayPhase]
      : ({ before: 'Before', decision: 'Decision', after: 'After', from: 'Original beam', transition: 'Beam transition', to: 'New beam', baseline: 'Baseline', intervention: 'Intervention', comparison: 'Comparison' } as const)[replayPhase];
  const storyClipMetrics = storyPointMetrics(storyState.activeStep);
  const storyClipIdentity = storyState.activeStep?.beamTrace === null || storyState.activeStep?.beamTrace === undefined
    ? `${storyDirection?.fromSatelliteId ?? lab.accepted?.identity.selectedSatelliteId ?? '—'} → ${storyDirection?.toSatelliteId ?? lab.accepted?.identity.candidateSatelliteId ?? '—'}`
    : `${storyState.activeStep.beamTrace.from.satelliteId} · UE ${storyState.activeStep.beamTrace.from.userId} · Beam ${storyState.activeStep.beamTrace.from.beamId} → ${storyState.activeStep.beamTrace.to.beamId}`;
  const causalClipIdentity = causalParameterChange === null
    ? `${lab.accepted?.identity.selectedSatelliteId ?? '—'} → ${lab.accepted?.identity.candidateSatelliteId ?? '—'}`
    : `${typeof causalParameterChange.label === 'string' ? causalParameterChange.label : causalParameterChange.label[lab.presentation.locale]} · ${causalParameterChange.baseline} → ${causalParameterChange.candidate}`;
  clipFrameRef.current = activeReplayRuntime === null || lab.accepted === null ? null : {
    locale: lab.presentation.locale,
    theme: lab.presentation.theme,
    title: activeReplayTitle,
    phase: replayPhaseLabel,
    sourceLabel: replaySourceLabel,
    identityLabel: activeReplayRuntime === 'story' || guidedHandoverActive ? storyClipIdentity : causalClipIdentity,
    metrics: {
      sinrDb: activeReplayRuntime === 'story' || guidedHandoverActive ? storyClipMetrics.sinrDb : snapshot?.serving.sinrDb ?? null,
      systemPowerW: activeReplayRuntime === 'story' || guidedHandoverActive ? storyClipMetrics.powerW : snapshot?.power.systemPowerW ?? null,
      totalThroughputBps: activeReplayRuntime === 'story' || guidedHandoverActive ? storyClipMetrics.throughputBps : snapshot?.throughput.totalRateBps ?? null,
      instantaneousEeBitsPerJ: activeReplayRuntime === 'story' || guidedHandoverActive ? storyClipMetrics.energyEfficiencyBitsPerJ : snapshot?.ee.instantaneousBitsPerJ ?? null,
    },
  };
  const replayClipAvailable = activeReplayRuntime !== null
    && activeReplayId !== null
    && clipLaunchState === 'running'
    && (activeReplayRuntime === 'causal'
      ? !causalReplay.busy && causalReplay.phase === 'comparison'
      : activeReplayRuntime === 'guided'
        ? guidedReplay.prepared && !guidedReplay.busy && guidedReplay.phase === 'comparison'
        : true)
    && lab.phase === 'ready'
    && lab.accepted?.runReady === true
    && typeof lab.accepted.analysisRunId === 'string'
    && lab.accepted.analysisRunId.length > 0
    && snapshot !== null
    && requiredSceneAssetsReady;
  const clipEntries = createVisualLabClipEntries({
    'inter-handover': {
      status: storyState.availability.interHandover.status === 'available'
        ? causalReplayAvailable ? 'available' : 'pending'
        : 'unavailable',
      reason: storyState.availability.interHandover.status === 'available'
        ? causalReplayAvailable ? null : lab.presentation.locale === 'zh-Hant' ? '等待完整 A/B 場景建立。' : 'Waiting for the complete A/B scene.'
        : lab.presentation.locale === 'zh-Hant'
          ? '目前資料沒有完整的跨衛星換手三錨點。'
          : 'The current source has no complete three-anchor inter-satellite handover.',
      runtimeId: storyState.availability.interHandover.selectedStoryId,
      sourceLabel: replaySourceLabel,
    },
    'intra-beam-handover': {
      status: storyState.availability.intraHandover.status === 'available'
        ? causalReplayAvailable ? 'available' : 'pending'
        : lab.phase === 'ready' && lab.accepted?.runReady === true && snapshot !== null
          ? 'preparing'
          : 'unavailable',
      reason: storyState.availability.intraHandover.status === 'available'
        ? causalReplayAvailable ? null : lab.presentation.locale === 'zh-Hant' ? '等待完整 A/B 場景建立。' : 'Waiting for the complete A/B scene.'
        : lab.phase === 'ready' && lab.accepted?.runReady === true && snapshot !== null
          ? lab.presentation.locale === 'zh-Hant'
            ? '播放時會先用同一筆 archived-TLE 真實資料建立 beam-hopping 三錨點，核對後才開始回放。'
            : 'Playback first builds and checks a beam-hopping three-anchor trace from the same archived-TLE run.'
          : lab.presentation.locale === 'zh-Hant'
            ? '目前資料尚未完成，無法準備同衛星換束軌跡。'
            : 'The current source is not complete enough to prepare a same-satellite beam-switch trace.',
      runtimeId: 'intra-handover',
      sourceLabel: replaySourceLabel,
    },
    'link-gain-ab': {
      status: causalReplayAvailable ? 'available' : 'pending',
      reason: causalReplayAvailable
        ? null
        : lab.presentation.locale === 'zh-Hant' ? '等待完整場景建立。' : 'Waiting for the complete scene.',
      runtimeId: 'beamwidth',
      sourceLabel: replaySourceLabel,
    },
    'power-cap-ab': {
      status: causalReplayAvailable ? 'available' : 'pending',
      reason: causalReplayAvailable
        ? null
        : lab.presentation.locale === 'zh-Hant' ? '等待完整場景建立。' : 'Waiting for the complete scene.',
      runtimeId: 'power-cap',
      sourceLabel: replaySourceLabel,
    },
  });
  useEffect(() => {
    elapsedSecRef.current = elapsedSec;
  }, [elapsedSec]);

  useEffect(() => {
    // The service view is the normal, source-backed scene.  Start its accepted
    // 2-hour timeline once the first complete run is ready so ordinary use can
    // actually reach the real TLE handover anchors.  A later manual pause is
    // respected; this is a one-time startup action, not an autoplay watchdog.
    if (
      autoStartedSceneRef.current
      || lab.phase !== 'ready'
      || timeline === null
      || view === 'earth'
      || replayFocusActive
      || demoReplayActive
    ) return;
    autoStartedSceneRef.current = true;
    setPlaying(true);
  }, [demoReplayActive, lab.phase, replayFocusActive, timeline, view]);

  useEffect(() => {
    demoReplayRef.current = demoReplay;
  }, [demoReplay]);

  useEffect(() => {
    if (demoReplay === null) return undefined;
    let previousTickAt = performance.now();
    const timer = window.setInterval(() => {
      const current = demoReplayRef.current;
      if (current === null) return;
      const now = performance.now();
      const deltaMs = Math.max(0, now - previousTickAt);
      previousTickAt = now;
      const nextElapsedMs = current.elapsedMs + deltaMs;
      if (nextElapsedMs >= DEMO_HANDOVER_DURATION_MS) {
        demoReplayRef.current = null;
        setDemoReplay(null);
        setSimpleReplayKind(null);
        return;
      }
      const next = Object.freeze({ ...current, elapsedMs: nextElapsedMs });
      demoReplayRef.current = next;
      setDemoReplay(next);
    }, 50);
    return () => window.clearInterval(timer);
  }, [demoReplay?.kind]);

  useEffect(() => {
    // Guided/causal replay owns its own source-backed phase clock.  Never let
    // the generic scene timeline advance underneath a frozen A/B pair.
    if (!playing || replayFocusActive || demoReplayActive) return undefined;
    let previousTickAt = performance.now();
    const timer = window.setInterval(() => {
      const tickAt = performance.now();
      // 1× is literal wall-clock speed outside the committed switch window.
      // A bounded interval is only a sampling cadence; it is not a second
      // simulation clock and must not multiply the requested rate.
      const wallDeltaSec = Math.max(0, (tickAt - previousTickAt) / 1_000);
      previousTickAt = tickAt;
      const next = advanceVisualLabPlayback(
        elapsedSecRef.current,
        wallDeltaSec,
        playbackRate,
        { committedSwitchWindow: committedVisualSwitchWindow, guidedReplayActive: replayFocusActive },
      );
      const duration = timeline?.durationSec ?? 0;
      const bounded = duration > 0 && next > duration ? 0 : next;
      elapsedSecRef.current = bounded;
      setElapsedSec(bounded);
      void session.dispatch({ type: 'seek', timeSec: bounded });
    // The accepted local scene already interpolates between adjacent TLE
    // anchors.  Refreshing only four times per second made that interpolation
    // look like discrete jumps, especially at 1x playback.  This cadence is
    // still far below a render loop, but gives the scene enough samples to
    // read as continuous without introducing a second propagation clock.
    }, 80);
    return () => window.clearInterval(timer);
  }, [playing, playbackRate, replayFocusActive, demoReplayActive, committedVisualSwitchWindow, session, timeline?.durationSec]);

  // The compact intra/inter controls advance the already compiled story
  // anchors.  No Worker or formula rebuild is involved in this clock.
  useEffect(() => {
    if (!storyOpen || storyState.status !== 'playing') return undefined;
    const timer = window.setInterval(() => {
      storyController.tick();
    }, 1_200);
    return () => window.clearInterval(timer);
  }, [storyController, storyOpen, storyState.status]);

  useEffect(() => {
    if (!storyOpen || storyState.activeStepSeekTimeSec === null) return;
    const next = storyState.activeStepSeekTimeSec;
    elapsedSecRef.current = next;
    setElapsedSec(next);
    void session.dispatch({ type: 'seek', timeSec: next });
  }, [session, storyOpen, storyState.activeStepSeekTimeSec]);

  useEffect(() => {
    // The compact handover buttons are a short presentation over the normal
    // accepted scene.  Once the real after-anchor has been shown, release the
    // story focus so the ordinary service view returns instead of remaining
    // latched on the completed handover.
    if (simpleReplayKind === null || !storyOpen || storyState.status !== 'completed') return undefined;
    const timer = window.setTimeout(() => {
      storyController.pause();
      setStoryOpen(false);
      setSimpleReplayKind(null);
    }, 1_200);
    return () => window.clearTimeout(timer);
  }, [simpleReplayKind, storyOpen, storyState.status, storyController]);

  const setView = (next: VisualLabView, autoPlayScene = true): void => {
    void session.dispatch({ type: 'setView', view: next });
    if (
      autoPlayScene
      && next !== 'earth'
      && lab.phase === 'ready'
      && timeline !== null
      && !storyOpen
      && !causalReplay.open
      && !guidedReplay.open
    ) setPlaying(true);
  };
  const setDensity = (next: VisualLabDensity): void => { void session.dispatch({ type: 'setDensity', density: next }); };
  const setFocus = (next: Exclude<VisualLabFocus, 'none'>): void => { void session.dispatch({ type: 'setFocus', focus: next }); };

  const updateInput = (key: VisualLabInputKey, value: number): void => {
    void session.dispatch({ type: 'editCanonicalParameter', key, value });
    setFocus(focusForVisualLabInput(key));
  };

  const resetInput = (key: VisualLabInputKey): void => {
    updateInput(key, DEFAULT_VISUAL_LAB_INPUTS[key]);
  };

  useEffect(() => () => {
    if (ueRecomputeTimerRef.current !== null) {
      clearTimeout(ueRecomputeTimerRef.current);
      ueRecomputeTimerRef.current = null;
    }
  }, []);

  const scheduleUeRecompute = useCallback((userIndex: number, positionKm: readonly [number, number]): void => {
    if (ueRecomputeTimerRef.current !== null) clearTimeout(ueRecomputeTimerRef.current);
    ueRecomputeTimerRef.current = setTimeout(() => {
      ueRecomputeTimerRef.current = null;
      void session.dispatch({
      type: 'applyRepresentativeUeFrameOptions',
      frameOptions: {
        representativeUserIndex: userIndex,
        userPositionOverridesKm: [{
          userIndex,
          positionKm,
        }],
      },
      });
    }, 180);
  }, [session]);

  const resetUeProbe = (): void => {
    if (ueRecomputeTimerRef.current !== null) {
      clearTimeout(ueRecomputeTimerRef.current);
      ueRecomputeTimerRef.current = null;
    }
    setSelectedUe(null);
    void session.dispatch({ type: 'resetRepresentativeUeFrameOptions' });
  };

  const ueGeometryControls: VisualLabUeGeometryControls | null = useMemo(() => {
    if (
      snapshot === null
      || localScene?.representative.availability !== 'available'
      || localScene.representative.user === null
      || localScene.representative.cell === null
      || snapshot.serving.distanceKm === null
      || snapshot.serving.elevationDeg === null
      || !Number.isFinite(localScene.substrate.worldUnitsPerKm)
      || localScene.substrate.worldUnitsPerKm <= 0
    ) return null;
    const representative = localScene.representative;
    const scale = localScene.substrate.worldUnitsPerKm;
    const acceptedPositionKm = representative.user.positionKm;
    const draftPositionKm: readonly [number, number] = selectedUe === null
      ? acceptedPositionKm
      : [selectedUe.x / scale, -selectedUe.z / scale];
    const beamCenterKm = representative.cell.centerKm;
    const maxRadiusKm = localScene.substrate.cellRadiusKm * .96;
    const directionVector = [
      acceptedPositionKm[0] - beamCenterKm[0],
      acceptedPositionKm[1] - beamCenterKm[1],
    ] as const;
    const directionLength = Math.hypot(directionVector[0], directionVector[1]);
    const direction = directionLength > 1e-12
      ? [directionVector[0] / directionLength, directionVector[1] / directionLength] as const
      : undefined;
    const angleInput = {
      satelliteDistanceKm: snapshot.serving.distanceKm,
      satelliteElevationDeg: snapshot.serving.elevationDeg,
      beamCenterKm,
      userPositionKm: draftPositionKm,
      maxRadiusKm,
      direction,
    } as const;
    const acceptedAngleRad = offAxisAngleRadForVisualLabUe({
      satelliteDistanceKm: angleInput.satelliteDistanceKm,
      satelliteElevationDeg: angleInput.satelliteElevationDeg,
      beamCenterKm,
      userPositionKm: acceptedPositionKm,
    });
    const draftAngleRad = offAxisAngleRadForVisualLabUe(angleInput);
    const maxPositionKm = positionForVisualLabUeOffAxisAngle(angleInput, Math.PI);
    const maxAngleRad = offAxisAngleRadForVisualLabUe({
      satelliteDistanceKm: angleInput.satelliteDistanceKm,
      satelliteElevationDeg: angleInput.satelliteElevationDeg,
      beamCenterKm,
      userPositionKm: maxPositionKm,
    });
    return {
      acceptedAngleDeg: degreesFromRadians(acceptedAngleRad),
      draftAngleDeg: degreesFromRadians(draftAngleRad),
      maxAngleDeg: Math.max(degreesFromRadians(maxAngleRad), .01),
      hasDraft: selectedUe !== null,
      onAngleChange: (angleDeg: number): void => {
        const positionKm = positionForVisualLabUeOffAxisAngle(angleInput, radiansFromDegrees(angleDeg));
        setSelectedUe({ x: positionKm[0] * scale, z: -positionKm[1] * scale });
        scheduleUeRecompute(representative.user.index, positionKm);
        setFocus('geometry');
      },
      onReset: resetUeProbe,
    };
  }, [localScene, resetUeProbe, scheduleUeRecompute, selectedUe, snapshot]);

  const downloadFigureBundle = async (): Promise<void> => {
    const sourceCanvas = figureRootRef.current?.querySelector('canvas');
    if (
      !(sourceCanvas instanceof HTMLCanvasElement)
      || lab.accepted === null
      || lab.capture.availability !== 'available'
      || lab.capture.locked
      || !requiredSceneAssetsReady
    ) {
      setCaptureStatus(requiredSceneAssetFailed
        ? (lab.presentation.locale === 'zh-Hant' ? '必要的 3D 模型未能載入，圖稿不會使用替代模型。' : 'A required 3D asset failed to load; the figure will not use fallback geometry.')
        : (lab.presentation.locale === 'zh-Hant' ? '完整計算與必要模型載入後才能擷取。' : 'Capture becomes available after the complete run and required assets load.'));
      return;
    }
    setCaptureStatus(lab.presentation.locale === 'zh-Hant' ? '正在建立論文圖…' : 'Building the paper figure…');
    try {
      const width = 1600;
      const height = 900;
      const headerHeight = 112;
      const footerHeight = 116;
      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;
      const context = output.getContext('2d');
      if (context === null) throw new Error('2D figure compositor is unavailable');
      const light = lab.presentation.theme === 'light';
      context.fillStyle = light ? '#f5efe4' : '#08131b';
      context.fillRect(0, 0, width, height);
      const sceneHeight = height - headerHeight - footerHeight;
      context.drawImage(sourceCanvas, 0, headerHeight, width, sceneHeight);
      context.fillStyle = light ? '#24343c' : '#edf6f5';
      context.font = '600 34px "Noto Serif TC", Georgia, serif';
      context.fillText(copy.shell.title, 48, 54);
      context.font = '500 20px "Noto Sans TC", system-ui, sans-serif';
      context.fillStyle = light ? '#586a70' : '#a9bdbe';
      context.fillText(`${displayAcceptedSource.constellation === 'starlink' ? 'Starlink' : 'OneWeb'} · ${lab.accepted.identity.instantTaipei.replace('T', ' ').slice(0, 19)} · TLE / SGP4`, 48, 88);
      const canonical = lab.canonical;
      const metricText = canonical === null
        ? ''
        : lab.presentation.locale === 'zh-Hant'
          ? `SINR ${canonical.serving.sinrDb?.toFixed(2) ?? '—'} dB   |   系統功率 ${canonical.power.systemPowerW?.toFixed(3) ?? '—'} W   |   總吞吐量 ${canonical.throughput.totalRateBps === null ? '—' : `${(canonical.throughput.totalRateBps / 1_000_000).toFixed(2)} Mbit/s`}   |   瞬時 EE ${canonical.ee.instantaneousBitsPerJ === null ? '—' : `${(canonical.ee.instantaneousBitsPerJ / 1_000_000).toFixed(2)} Mbit/J`}`
          : `SINR ${canonical.serving.sinrDb?.toFixed(2) ?? '—'} dB   |   System power ${canonical.power.systemPowerW?.toFixed(3) ?? '—'} W   |   Total throughput ${canonical.throughput.totalRateBps === null ? '—' : `${(canonical.throughput.totalRateBps / 1_000_000).toFixed(2)} Mbit/s`}   |   Instantaneous EE ${canonical.ee.instantaneousBitsPerJ === null ? '—' : `${(canonical.ee.instantaneousBitsPerJ / 1_000_000).toFixed(2)} Mbit/J`}`;
      context.fillStyle = light ? '#24343c' : '#edf6f5';
      context.font = '600 23px "Noto Sans TC", system-ui, sans-serif';
      context.fillText(metricText, 48, height - 68);
      context.fillStyle = light ? '#6a777a' : '#92a7a8';
      context.font = '500 17px "Noto Sans TC", system-ui, sans-serif';
      const offAxisAngleDeg = localScene === null
        ? null
        : localScene.render.beam.offAxisAngleRad * 180 / Math.PI;
      const angleText = offAxisAngleDeg === null
        ? ''
        : lab.presentation.locale === 'zh-Hant'
          ? `離軸角 θ ${offAxisAngleDeg.toFixed(2)}°   ·   `
          : `Off-axis angle θ ${offAxisAngleDeg.toFixed(2)}°   ·   `;
      context.fillText(`${angleText}${lab.accepted.identity.selectedSatelliteId ?? '—'} → ${lab.accepted.identity.candidateSatelliteId ?? '—'}   ·   archived TLE / SGP4`, 48, height - 34);
      const png = await canvasPng(output);
      const profileId = `visual-lab-${view}-${lab.presentation.theme}-${lab.presentation.locale}`;
      const bundle = buildVisualLabCaptureBundle(session, {
        figureId: profileId,
        figureProfile: {
          profileId,
          theme: lab.presentation.theme,
          locale: lab.presentation.locale,
          viewport: { width, height, devicePixelRatio: 1 },
          cameraPreset: view === 'earth' ? 'global-overview' : focus === 'handover' ? 'handover-focus' : 'ntpu-focus',
          layerPreset: density === 'full' ? 'full' : focus === 'energy' ? 'energy-story' : focus === 'handover' ? 'handover' : 'minimal',
        },
        capturedPng: { bytes: png, mediaType: 'image/png' },
        caption: lab.presentation.locale === 'zh-Hant'
          ? `${displayAcceptedSource.constellation === 'starlink' ? 'Starlink' : 'OneWeb'} archived-TLE／SGP4 在 NTPU 多波束場景中的鏈路與能源狀態。`
          : `${displayAcceptedSource.constellation === 'starlink' ? 'Starlink' : 'OneWeb'} archived-TLE/SGP4 link and energy state in the NTPU multi-beam scene.`,
        claimBoundary: lab.presentation.locale === 'zh-Hant'
          ? '本圖為 archived-TLE／SGP4 與 canonical 模型投影，不是即時遙測或實測節能成效。'
          : 'This figure is an archived-TLE/SGP4 canonical model projection, not live telemetry or measured energy savings.',
        sourceLocators: [lab.accepted.identity.selectedTlePath],
        equationLocators: ['ADR-003 canonical EE closure'],
      });
      setCaptureBundle(bundle);
      const result = await createLocalDownloadArtifactWriter().write(bundle);
      if (result.status !== 'written') throw new Error(result.reason ?? 'The figure bundle could not be downloaded');
      setCaptureStatus(lab.presentation.locale === 'zh-Hant'
        ? `已下載資料包，內含 ${result.artifacts.length} 個圖稿與資料檔。`
        : `Downloaded one bundle containing ${result.artifacts.length} figure and data files.`);
    } catch (error) {
      setCaptureStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const downloadActiveReplay = async (): Promise<void> => {
    const sourceCanvas = figureRootRef.current?.querySelector('canvas');
    const accepted = lab.accepted;
    const currentFrame = clipFrameRef.current;
    if (
      !(sourceCanvas instanceof HTMLCanvasElement)
      || accepted === null
      || currentFrame === null
      || activeReplayRuntime === null
      || activeReplayId === null
      || !replayClipAvailable
      || clipRecording
    ) {
      setCaptureStatus(lab.presentation.locale === 'zh-Hant'
        ? '完整回放與必要模型就緒後才能錄製。'
        : 'Recording becomes available after the complete replay and required assets are ready.');
      return;
    }

    const controller = new AbortController();
    clipCaptureAbortRef.current?.abort();
    clipCaptureAbortRef.current = controller;
    setClipRecording(true);
    setCaptureStatus(ui.recordingReplay);
    try {
      if (activeReplayRuntime === 'guided') {
        await guidedReplay.restart();
        await guidedReplay.togglePlay();
      } else if (activeReplayRuntime === 'story') {
        const restarted = storyController.restart();
        if (restarted.activeStepSeekTimeSec !== null) {
          await session.dispatch({ type: 'seek', timeSec: restarted.activeStepSeekTimeSec });
        }
        storyController.play();
      } else {
        await causalReplay.restart();
        await causalReplay.togglePlay();
      }
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
      });

      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = VISUAL_LAB_CLIP_WIDTH;
      outputCanvas.height = VISUAL_LAB_CLIP_HEIGHT;
      const outputContext = outputCanvas.getContext('2d', { alpha: false });
      if (outputContext === null) throw new Error('2D replay output is unavailable.');
      outputContext.fillStyle = '#07121a';
      outputContext.fillRect(0, 0, VISUAL_LAB_CLIP_WIDTH, VISUAL_LAB_CLIP_HEIGHT);
      const compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = VISUAL_LAB_CLIP_WIDTH;
      compositeCanvas.height = VISUAL_LAB_CLIP_HEIGHT;
      const compositeContext = compositeCanvas.getContext('2d', { alpha: false });
      if (compositeContext === null) throw new Error('2D replay compositor is unavailable.');
      const sceneCacheCanvas = document.createElement('canvas');
      let sceneCacheKey = '';
      let manualCaptureTrack: { requestFrame?: () => void } | null = null;
      const captureStart = session.snapshot().accepted;
      if (captureStart === null) throw new Error('The replay lost its accepted start frame.');
      const captureAnalysisRunId = captureStart.analysisRunId;
      if (captureAnalysisRunId === null || captureAnalysisRunId.length === 0) {
        throw new Error('The accepted replay has no analysis-run identity.');
      }
      const comparisonBaseline = activeReplayRuntime === 'causal' || activeReplayRuntime === 'guided' ? lab.comparison.baseline : null;
      const comparisonCandidate = activeReplayRuntime === 'causal' || activeReplayRuntime === 'guided' ? lab.comparison.candidate : null;
      const activeCompiledStory = activeReplayRuntime === 'story' || activeReplayRuntime === 'guided'
        ? storyState.stories.find(story => story.storyId === storyState.activeStoryId) ?? null
        : null;
      const storySource = activeCompiledStory?.descriptor.source ?? null;
      const provenance = {
        analysisRunId: captureAnalysisRunId,
        frame: captureStart.identity.frameId,
        story: activeReplayId,
        runtime: activeReplayRuntime === 'story'
          ? 'visual-lab-story-runtime-v1'
          : activeReplayRuntime === 'guided'
            ? 'visual-lab-guided-replay-v1'
            : 'visual-lab-causal-replay-v1',
        identityScope: activeReplayRuntime === 'guided'
          ? 'controlled-a-b-with-accepted-handover-sequence'
          : activeReplayRuntime === 'causal' ? 'controlled-a-b-sequence' : 'accepted-story-anchors',
        constellation: captureStart.identity.constellation,
        source: captureStart.identity.selectedTlePath,
        ...((activeReplayRuntime === 'story' || activeReplayRuntime === 'guided') && storyState.activeStoryId !== null
          ? { runtimeStoryId: storyState.activeStoryId }
          : {}),
        ...(storySource?.kind === 'inter-handover' && storySource.eventId !== null
          ? {
              handoverKind: 'inter-handover',
              eventId: storySource.eventId,
              fromSatelliteId: storySource.fromSatelliteId ?? 'unavailable',
              toSatelliteId: storySource.toSatelliteId ?? 'unavailable',
            }
          : {}),
        ...(storySource?.kind === 'intra-handover' && storySource.traceId !== null
          ? {
              handoverKind: 'intra-handover',
              traceId: storySource.traceId,
              userId: storySource.from?.userId ?? 'unavailable',
              satelliteId: storySource.from?.satelliteId ?? 'unavailable',
              fromBeamId: String(storySource.from?.beamId ?? 'unavailable'),
              toBeamId: String(storySource.to?.beamId ?? 'unavailable'),
            }
          : {}),
        ...(comparisonBaseline?.interval.analysisRunId
          ? {
              baselineAnalysisRunId: comparisonBaseline.interval.analysisRunId,
              baselineFrameId: comparisonBaseline.frameId,
            }
          : {}),
        ...(comparisonCandidate?.interval.analysisRunId
          ? {
              candidateAnalysisRunId: comparisonCandidate.interval.analysisRunId,
              candidateFrameId: comparisonCandidate.frameId,
            }
          : {}),
        ...((activeReplayRuntime === 'causal' || activeReplayRuntime === 'guided') && causalParameterChange !== null
          ? {
              changedParameterKey: causalParameterChange.key,
              changedParameterBaseline: String(causalParameterChange.baseline),
              changedParameterCandidate: String(causalParameterChange.candidate),
              comparisonClassification: lab.comparison.classification ?? 'unavailable',
              frameComparisonGate: lab.comparison.frame.availability,
              evaluationComparisonGate: lab.comparison.evaluation.availability,
            }
          : {}),
        ...(activeReplayRuntime === 'guided'
          ? {
              baselineStoryRuntimeId: guidedReplay.baselineStoryRuntimeId ?? 'unavailable',
              candidateStoryRuntimeId: guidedReplay.candidateStoryRuntimeId ?? 'unavailable',
              annotationMode: guidedReplay.annotationMode,
            }
          : {}),
      };
      const capture = await captureCanvasToWebm({
        canvas: outputCanvas,
        durationMs: activeReplayRuntime === 'guided' ? VISUAL_LAB_GUIDED_REPLAY_TOTAL_DURATION_MS : 4_200,
        fps: 12,
        mimeCandidates: ['video/webm;codecs=vp8', 'video/webm'],
        signal: controller.signal,
        provenance,
        browser: {
          captureStream: (canvas) => {
            const stream = canvas.captureStream(0);
            manualCaptureTrack = stream.getVideoTracks()[0] as { requestFrame?: () => void } | undefined ?? null;
            return stream;
          },
        },
        drawFrame: ({ canvas, elapsedMs, durationMs }) => {
          const presentation = clipFrameRef.current;
          const liveSourceCanvas = figureRootRef.current?.querySelector('canvas');
          if (presentation === null || !(liveSourceCanvas instanceof HTMLCanvasElement)) {
            throw new Error('The active replay scene is no longer available.');
          }
          const nextSceneCacheKey = `${presentation.phase}:${Math.floor(elapsedMs / 250)}`;
          if (nextSceneCacheKey !== sceneCacheKey) {
            sceneCacheCanvas.width = liveSourceCanvas.width;
            sceneCacheCanvas.height = liveSourceCanvas.height;
            const sceneCacheContext = sceneCacheCanvas.getContext('2d');
            if (sceneCacheContext === null) throw new Error('2D replay scene cache is unavailable.');
            sceneCacheContext.drawImage(liveSourceCanvas, 0, 0);
            sceneCacheKey = nextSceneCacheKey;
          }
          drawVisualLabClipFrame({
            outputCanvas: compositeCanvas,
            sourceCanvas: sceneCacheCanvas,
            presentation,
            elapsedMs,
            durationMs,
          });
          outputContext.drawImage(compositeCanvas, 0, 0);
          manualCaptureTrack?.requestFrame?.();
        },
      });
      if (capture.cancelled) {
        setCaptureStatus(lab.presentation.locale === 'zh-Hant' ? '回放錄製已取消。' : 'Replay recording was cancelled.');
        return;
      }
      const result = await downloadVisualLabClipArchive({
        capture,
        clipId: activeReplayId,
        title: activeReplayTitle,
        locale: lab.presentation.locale,
        theme: lab.presentation.theme,
        claimBoundary: lab.presentation.locale === 'zh-Hant'
          ? '本回放為 archived-TLE／SGP4 與 canonical 模型投影，不是即時遙測或實測節能成效。'
          : 'This replay is an archived-TLE/SGP4 canonical model projection, not live telemetry or measured energy savings.',
        sourceLocators: [captureStart.identity.selectedTlePath],
      });
      if (result.status !== 'written') throw new Error(result.reason ?? 'The replay archive could not be downloaded.');
      setCaptureStatus(ui.replayDownloaded);
    } catch (error) {
      setCaptureStatus(error instanceof Error ? error.message : String(error));
    } finally {
      if (clipCaptureAbortRef.current === controller) clipCaptureAbortRef.current = null;
      setClipRecording(false);
    }
  };

  const phase1Endpoint = import.meta.env.VITE_PHASE1_UPLOAD_ENDPOINT as string | undefined;
  const phase1SchemaId = import.meta.env.VITE_PHASE1_UPLOAD_SCHEMA_ID as string | undefined;
  const phase1Configured = Boolean(phase1Endpoint && phase1SchemaId);
  const uploadFigureBundle = async (): Promise<void> => {
    if (captureBundle === null || !phase1Configured || phase1Endpoint === undefined || phase1SchemaId === undefined) {
      setCaptureStatus(lab.presentation.locale === 'zh-Hant' ? '一期平台尚未設定上傳端點與 schema。' : 'The Phase-1 platform upload endpoint and schema are not configured.');
      return;
    }
    setCaptureStatus(lab.presentation.locale === 'zh-Hant' ? '正在上傳一期平台…' : 'Uploading to the Phase-1 platform…');
    const adapter = createPhase1UploadAdapter({
      endpoint: phase1Endpoint,
      schemaId: phase1SchemaId,
      fetcher: async (endpoint, init) => fetch(endpoint, init),
    });
    const result = await adapter.upload(captureBundle);
    setCaptureStatus(result.status === 'uploaded'
      ? (lab.presentation.locale === 'zh-Hant' ? '一期平台已回傳有效 receipt。' : 'The Phase-1 platform returned a valid receipt.')
      : result.reason ?? (lab.presentation.locale === 'zh-Hant' ? '上傳失敗。' : 'Upload failed.'));
  };

  const applySource = (): void => {
    setPlaying(false);
    setElapsedSec(0);
    void session.dispatch({ type: 'applySource' });
  };

  const startDemoHandoverReplay = async (kind: DemoHandoverKind): Promise<void> => {
    await closeActiveReplay();
    const next = Object.freeze({ kind, elapsedMs: 0 });
    demoReplayRef.current = next;
    setDemoReplay(next);
    setSimpleReplayKind(kind);
    // Same-satellite handover stays on the straight-on baseline camera so the
    // two beams remain easy to compare on one cell. Inter-satellite replay
    // keeps the directed camera because its two satellite identities need a
    // wider frame.
    setStoryDirectorEnabled(kind !== 'intra-handover');
    setClipShelfOpen(false);
    // The button starts its own visible clock.  Mark the scene as playing so
    // the user does not see the normal timeline remain paused; the guard above
    // prevents that clock from competing with the demo clock.
    setPlaying(true);
    openModule('scene', false);
    setView('service', false);
    setFocus('handover');
    setCaptureStatus(null);
  };

  const startSimpleHandoverReplay = async (kind: 'intra-handover' | 'inter-handover'): Promise<void> => {
    // The compact buttons are the reliable classroom/demo path.  A real
    // source-backed story remains available from the replay shelf, but the
    // direct controls must always show a complete candidate approach and
    // ownership transfer even when the accepted TLE run lacks a full trace.
    await startDemoHandoverReplay(kind);
  };

  const handleResultFocus = (resultFocus: VisualLabResultFocus): void => {
    setView('service');
    setFocus(focusFromResult(resultFocus));
  };

  const handleStoryInspect = (target: VisualLabInspectTarget): void => {
    if (target === 'scene') {
      openModule('scene');
      setView('service');
      setFocus('geometry');
      return;
    }
    if (target === 'handover') {
      openModule('scene');
      setView('service');
      setFocus('handover');
      return;
    }
    if (target === 'power' || target === 'energy-efficiency') {
      openModule('power');
      setFocus('energy');
      return;
    }
    openModule('sinr');
    setFocus(target === 'throughput' ? 'handover' : 'geometry');
  };

  const stepTime = (deltaSec: number): void => {
    const duration = timeline?.durationSec ?? 0;
    const next = clamp(elapsedSecRef.current + deltaSec, 0, duration);
    elapsedSecRef.current = next;
    setElapsedSec(next);
    void session.dispatch({ type: 'seek', timeSec: next });
  };

  const sourceDirty = lab.draft.source.dirty;
  const viewCopy: Record<VisualLabView, { readonly eyebrow: string; readonly title: string }> = {
    earth: { eyebrow: lab.presentation.locale === 'zh-Hant' ? '全球尺度' : 'Global scale', title: copy.sceneScale.globalDescription },
    sky: { eyebrow: lab.presentation.locale === 'zh-Hant' ? 'NTPU 上空尺度' : 'NTPU sky scale', title: copy.sceneScale.ntpuDescription },
    service: { eyebrow: lab.presentation.locale === 'zh-Hant' ? 'NTPU 多波束尺度' : 'NTPU multi-beam scale', title: copy.sceneScale.serviceDescription },
  };

  // The timeline is a primary reading surface, not a module that appears only
  // after opening Power.  Keep it expanded from the first accepted frame.
  const isAllOpen = VISUAL_LAB_MODULES.every((module) => openModules.includes(module.key));
  const timelineExpanded = true;

  function openModule(module: VisualLabModuleKey, autoPlayScene = true): void {
    setOpenModules((current) => current.includes(module) ? current : [...current, module]);
    setActiveModule(module);
    const definition = moduleDefinition(module);
    if (module !== 'scene') setView(definition.view, autoPlayScene);
    setFocus(definition.focus);
  }

  async function closeActiveReplay(): Promise<void> {
    clipCaptureAbortRef.current?.abort();
    demoReplayRef.current = null;
    setDemoReplay(null);
    setStoryOpen(false);
    setSimpleReplayKind(null);
    storyController.pause();
    if (guidedReplay.open) await guidedReplay.close();
    else if (causalReplay.open) await causalReplay.close();
    setClipLaunchState('idle');
    setClipLaunchError(null);
  }

  async function launchReplay(target: VisualLabClipLaunchTarget): Promise<void> {
    setSelectedClipId(target.clipId);
    setClipLaunchState('launching');
    setClipLaunchError(null);
    setPlaying(false);
    try {
      if (target.runtime === 'guided') {
        if (target.clipId !== 'inter-handover' && target.clipId !== 'intra-beam-handover') {
          throw new Error('Unknown guided replay target.');
        }
        if (storyOpen) setStoryOpen(false);
        setStoryDirectorEnabled(true);
        openModule(target.clipId === 'inter-handover' ? 'sinr' : 'power', false);
        setView('service', false);
        setFocus('handover');
        setClipShelfOpen(false);
        await guidedReplay.openStory(target.clipId, target.runtimeId);
      } else if (target.runtime === 'story') {
        if (causalReplay.open) await causalReplay.close();
        const selected = storyController.selectStory(target.runtimeId);
        const compiled = selected.stories.find(story => story.storyId === target.runtimeId) ?? null;
        if (compiled?.availability.status !== 'available') {
          throw new Error(lab.presentation.locale === 'zh-Hant'
            ? '這段換手回放在目前資料中不可用。'
            : 'This handover replay is unavailable for the current source.');
        }
        storyController.restart();
        storyController.play();
        setStoryDirectorEnabled(true);
        setStoryOpen(true);
        openModule('scene', false);
        setView('service', false);
        setFocus('handover');
      } else {
        const causalStoryId = target.runtimeId === 'power-cap'
          ? 'power-cap'
          : target.runtimeId === 'beamwidth'
            ? 'beamwidth'
            : null;
        if (causalStoryId === null) throw new Error('Unknown causal replay target.');
        setStoryOpen(false);
        setStoryDirectorEnabled(true);
        openModule(causalStoryId === 'beamwidth' ? 'sinr' : 'power', false);
        await causalReplay.openStory(causalStoryId);
        await causalReplay.togglePlay();
      }
      setClipShelfOpen(false);
      setClipLaunchState('running');
    } catch (error) {
      setClipLaunchState('error');
      setClipLaunchError(error instanceof Error ? error.message : String(error));
      setClipShelfOpen(true);
    }
  }

  return (
    <main
      className={`vlab-app vlab-app--progressive vlab-app--theme-${lab.presentation.theme} vlab-app--${lab.presentation.experience}${isAllOpen ? ' is-all-open' : ''}${replayFocusActive ? ' is-replay-focus' : ''}`}
      lang={lab.presentation.locale}
      data-lab-phase={lab.phase}
      data-run-ready={lab.accepted?.runReady ?? false}
      data-accepted-analysis-run-id={lab.accepted?.analysisRunId ?? undefined}
      data-timeline-analysis-run-id={lab.timeline?.analysisRunId ?? undefined}
      data-accepted-geometry-run-id={lab.accepted?.geometryRunId ?? undefined}
      data-timeline-geometry-run-id={lab.timeline?.geometryRunId ?? undefined}
      data-story-inter-status={storyState.availability.interHandover.status}
      data-story-intra-status={storyState.availability.intraHandover.status}
    >
      <nav className="vlab-skip-links" aria-label={lab.presentation.locale === 'zh-Hant' ? '跳躍導覽' : 'Skip navigation'}>
        <a href="#vlab-controls">{ui.skipControls}</a>
        <a href="#vlab-scene">{ui.skipScene}</a>
        <a href="#vlab-results">{ui.skipResults}</a>
      </nav>
      {captureStatus ? <span className="vlab-capture-status" role="status">{captureStatus}</span> : null}

      <section className="vlab-progressive-workspace has-control-dock">
        <div className="vlab-left-control-stack">
          <nav className="vlab-sidebar-modules" aria-label={ui.modulesAria}>
            {VISUAL_LAB_MODULES.map((module) => {
              const isOpen = openModules.includes(module.key);
              const isActive = isOpen && activeModule === module.key;
              return <button
                key={module.key}
                type="button"
                className={`vlab-sidebar-module vlab-sidebar-module--${module.tone}${isActive ? ' is-active' : ''}`}
                aria-pressed={isActive}
                disabled={clipRecording}
                onClick={() => openModule(module.key)}
              >
                <span aria-hidden="true">{module.symbol}</span>
                <strong>{moduleShortLabel(module.key, lab.presentation.locale)}</strong>
              </button>;
            })}
          </nav>
          <div className="vlab-sidebar-utilities">
            <button
              type="button"
              className="vlab-field-switch"
              role="switch"
              aria-checked={view !== 'earth'}
              aria-label={ui.fieldAria}
              disabled={clipRecording}
              onClick={() => setView(view === 'earth' ? 'service' : 'earth')}
            >
              <span>{view === 'earth' ? ui.globalField : ui.ntpuField}</span>
              <i aria-hidden="true" />
            </button>
            <button type="button" disabled={clipRecording} onClick={() => { void session.dispatch({ type: 'setTheme', theme: lab.presentation.theme === 'dark' ? 'light' : 'dark' }); }} aria-label={ui.switchTheme}>{lab.presentation.theme === 'dark' ? '☀' : '☾'}</button>
            <button type="button" disabled={clipRecording} onClick={() => { void session.dispatch({ type: 'setLocale', locale: lab.presentation.locale === 'zh-Hant' ? 'en' : 'zh-Hant' }); }}>{lab.presentation.locale === 'zh-Hant' ? 'EN' : '繁中'}</button>
          </div>
          {openModules.includes(activeModule) && snapshot !== null ? <VisualLabProgressiveControlDock
          className="vlab-panel vlab-progressive-control-dock"
          locale={lab.presentation.locale}
          activeModule={activeModule}
          inputs={inputs}
          draftSource={draftSource}
          acceptedSource={displayAcceptedSource}
          applyingSource={applyingSource}
          interactionLocked={clipRecording}
          sourceDirty={sourceDirty}
          beamLayoutCount={lab.draft.frameOptions.beamLayoutCount}
          beamIlluminationMode={lab.draft.frameOptions.beamIlluminationMode}
          ueGeometry={ueGeometryControls}
          perSatelliteBeamLayoutCount={lab.draft.frameOptions.perSatelliteBeamLayoutCount}
          snapshot={snapshot}
          onDraftSourceChange={(patch) => {
            void session.dispatch({ type: 'editSourceDraft', draft: {
              constellation: patch.constellation ?? draftSource.constellation,
              taipeiDateTime: patch.localDateTime ?? draftSource.localDateTime,
            } });
          }}
          onApplySource={applySource}
          onBeamLayoutCountChange={(beamCount) => {
            setPlaying(false);
            setElapsedSec(0);
            setSelectedUe(null);
            void session.dispatch({ type: 'setBeamLayoutCount', beamCount });
          }}
          onBeamIlluminationModeChange={(mode) => {
            setPlaying(false);
            setElapsedSec(0);
            setSelectedUe(null);
            void session.dispatch({ type: 'setBeamIlluminationMode', mode });
          }}
          onPerSatelliteBeamLayoutChange={(satelliteId, beamCount) => {
            setPlaying(false);
            setElapsedSec(0);
            setSelectedUe(null);
            void session.dispatch({ type: 'setPerSatelliteBeamLayout', satelliteId, beamCount });
          }}
          onPerSatelliteBeamLayoutRemove={(satelliteId) => {
            setPlaying(false);
            setElapsedSec(0);
            setSelectedUe(null);
            void session.dispatch({ type: 'removePerSatelliteBeamLayout', satelliteId });
          }}
          onInputChange={updateInput}
          onResetInput={resetInput}
          onResetAll={() => { void session.dispatch({ type: 'resetCanonicalParameters' }); }}
          /> : openModules.includes(activeModule) ? <aside id="vlab-controls" className="vlab-panel vlab-progressive-control-dock vlab-data-pending" aria-busy="true">
          <strong>{lab.phase === 'rejected' ? ui.unavailable : ui.building}</strong>
          <span>{lab.phase === 'rejected' ? ui.resultLocked : ui.buildingHint}</span>
          </aside> : null}
        </div>

        <section id="vlab-scene" className={`vlab-center-column has-controls-only-timeline${storyOpen ? ' has-story' : ''}${causalReplay.open ? ' has-causal-story' : ''}${guidedReplay.open ? ' has-guided-story' : ''}${clipShelfOpen ? ' has-clip-shelf' : ''}`} aria-label={ui.centerAria} tabIndex={-1}>
          <section className={`vlab-scene-shell${replayFocusActive ? ' is-replay-focus' : ''}`}>
            {!replayFocusActive ? <div className="vlab-scene-toolbar">
              <div className="vlab-scene-toolbar__group">
                <label className="vlab-scene-label-toggle">
                  <input
                    type="checkbox"
                    checked={sceneLabelsVisible}
                    disabled={clipRecording}
                    onChange={(event) => setSceneLabelsVisible(event.currentTarget.checked)}
                  />
                  <span>{ui.showSceneLabels}</span>
                </label>
                <button
                  ref={replayLauncherButtonRef}
                  type="button"
                  className={`vlab-story-toggle${simpleReplayKind === 'intra-handover' ? ' is-active' : ''}`}
                  aria-pressed={simpleReplayKind === 'intra-handover'}
                  disabled={localScene === null || clipRecording}
                  onClick={() => { void startSimpleHandoverReplay('intra-handover'); }}
                >{ui.intraHandover}</button>
                <button
                  type="button"
                  className={`vlab-story-toggle${simpleReplayKind === 'inter-handover' ? ' is-active' : ''}`}
                  aria-pressed={simpleReplayKind === 'inter-handover'}
                  disabled={localScene === null || clipRecording}
                  onClick={() => { void startSimpleHandoverReplay('inter-handover'); }}
                >{ui.interHandover}</button>
                {storyOpen || demoReplay !== null ? <button
                  type="button"
                  className="vlab-story-toggle"
                  disabled={clipRecording}
                  onClick={() => { void closeActiveReplay(); }}
                >{ui.stopHandover}</button> : null}
              </div>

              <div className={`vlab-scene-status${applyingSource ? ' is-pending' : ''}`} role="status">
                <i aria-hidden="true" />
                <span>{applyingSource
                  ? `${ui.rebuilding} · ${draftSource.constellation === 'starlink' ? 'Starlink' : 'OneWeb'} ${draftSource.localDateTime.replace('T', ' ')}`
                  : `${displayAcceptedSource.constellation === 'starlink' ? 'Starlink' : 'OneWeb'} · ${displayAcceptedSource.localDateTime.replace('T', ' ')}`}</span>
              </div>
            </div> : null}

            <div className="vlab-scene-frame" ref={figureRootRef}>
              {replayFocusActive && clipFrameRef.current !== null ? <aside className="vlab-replay-focus-hud" aria-live="polite">
                <div className="vlab-replay-focus-hud__identity">
                  <span>{activeReplayTitle}</span>
                  <strong>{replayPhaseLabel}</strong>
                  <small>{clipFrameRef.current.identityLabel}</small>
                </div>
                <dl className="vlab-replay-focus-hud__metrics">
                  <div><dt>SINR</dt><dd>{formatStoryMetric(clipFrameRef.current.metrics.sinrDb, 'sinr', lab.presentation.locale)}</dd></div>
                  <div><dt>{lab.presentation.locale === 'zh-Hant' ? '功率' : 'Power'}</dt><dd>{formatStoryMetric(clipFrameRef.current.metrics.systemPowerW, 'power', lab.presentation.locale)}</dd></div>
                  <div><dt>{lab.presentation.locale === 'zh-Hant' ? '吞吐量' : 'Throughput'}</dt><dd>{formatStoryMetric(clipFrameRef.current.metrics.totalThroughputBps, 'throughput', lab.presentation.locale)}</dd></div>
                  <div><dt>EE</dt><dd>{formatStoryMetric(clipFrameRef.current.metrics.instantaneousEeBitsPerJ, 'energy-efficiency', lab.presentation.locale)}</dd></div>
                </dl>
                <div className="vlab-replay-focus-hud__actions">
                  <button type="button" aria-pressed={storyDirectorEnabled} disabled={clipRecording} onClick={() => setStoryDirectorEnabled(current => !current)}>
                    {lab.presentation.locale === 'zh-Hant' ? storyDirectorEnabled ? '自動運鏡' : '自由鏡頭' : storyDirectorEnabled ? 'Directed camera' : 'Free camera'}
                  </button>
                  <button type="button" className="is-primary" disabled={clipRecording} onClick={() => { void closeActiveReplay(); }}>{ui.closeReplay}</button>
                </div>
              </aside> : null}
              <VisualLabScene
                view={view}
                density={density}
                focus={focus}
                beamWidthDraftScale={beamWidthDraftScale}
                constellation={displayAcceptedSource.constellation}
                theme={lab.presentation.theme}
                locale={lab.presentation.locale}
                showLabels={guidedReplay.open ? guidedReplay.annotationMode === 'annotated' : sceneLabelsVisible}
                selectedUe={selectedUe}
                storyBeamFocus={effectiveStoryBeamFocus}
                storyDirection={effectiveStoryDirection}
                guidedCandidateEngaged={effectiveGuidedCandidateEngaged}
                guidedReplayProgress={effectiveGuidedReplayProgress}
                storyReturnProgress={effectiveStoryReturnProgress}
                causalCameraCue={guidedHandoverActive ? null : causalReplay.cameraCue}
                storyDirectorEnabled={storyDirectorEnabled}
                localScene={localScene}
                globalSceneFrame={globalSceneComplete ? globalSceneFrame : null}
                globalArtifact={globalArtifact}
                globalStatus={globalStatus}
                globalError={lab.phase === 'rejected' ? ui.unavailable : null}
                onAssetStatusChange={handleSceneAssetStatus}
                onUeMove={(x, z) => {
                  setSelectedUe({ x, z });
                  setFocus('geometry');
                }}
              />

              {guidedReplay.open ? <VisualLabGuidedReplayAnnotationOverlay
                storyId={guidedReplay.storyId}
                phase={guidedReplay.phase}
                annotationMode={guidedReplay.annotationMode}
                locale={lab.presentation.locale}
                theme={lab.presentation.theme}
                anchors={GUIDED_REPLAY_ANNOTATION_ANCHORS}
              /> : null}

              {clipShelfOpen && !storyOpen && !causalReplay.open ? <div
                className="vlab-clip-launcher"
                role="dialog"
                aria-modal="true"
                aria-label={ui.replayLibrary}
                data-clip-launcher
              >
                <button
                  type="button"
                  className="vlab-clip-launcher__backdrop"
                  aria-label={ui.closeReplayLibrary}
                  tabIndex={-1}
                  onClick={() => setClipShelfOpen(false)}
                />
                <div className="vlab-clip-launcher__panel" ref={clipPanelRef}>
                  <button
                    ref={clipCloseButtonRef}
                    type="button"
                    className="vlab-clip-launcher__close"
                    aria-label={ui.closeReplayLibrary}
                    onClick={() => setClipShelfOpen(false)}
                  >×</button>
                  <VisualLabClipEntryShelf
                    entries={clipEntries}
                    selectedClipId={selectedClipId}
                    launchState={clipLaunchState}
                    error={clipLaunchError}
                    locale={lab.presentation.locale}
                    theme={lab.presentation.theme}
                    disabled={applyingSource}
                    onSelect={setSelectedClipId}
                    onLaunch={(target) => { void launchReplay(target); }}
                  />
                </div>
              </div> : null}

              {guidedReplay.open ? <VisualLabGuidedReplayRail
                storyId={guidedReplay.storyId}
                phase={guidedReplay.phase}
                annotationMode={guidedReplay.annotationMode}
                locale={lab.presentation.locale}
                theme={lab.presentation.theme}
                playing={guidedReplay.playing}
                busy={guidedReplay.busy}
                prepared={guidedReplay.prepared}
                disabled={clipRecording || guidedReplay.busy || lab.phase !== 'ready' || snapshot === null}
                onAnnotationModeChange={guidedReplay.setAnnotationMode}
                onPlayToggle={() => { void guidedReplay.togglePlay(); }}
                onNext={() => { void guidedReplay.next(); }}
                onRestart={() => { void guidedReplay.restart(); }}
              /> : causalReplay.open ? <VisualLabCausalReplayRail
                storyId={causalReplay.storyId}
                phase={causalReplay.phase}
                locale={lab.presentation.locale}
                theme={lab.presentation.theme}
                classification={lab.comparison.classification}
                playing={causalReplay.playing}
                disabled={clipRecording || causalReplay.busy || lab.phase !== 'ready' || snapshot === null}
                onStoryChange={(storyId) => {
                  setSelectedClipId(storyId === 'beamwidth' ? 'link-gain-ab' : 'power-cap-ab');
                  openModule(storyId === 'beamwidth' ? 'sinr' : 'power');
                  void causalReplay.selectStory(storyId);
                }}
                onPrevious={() => { void causalReplay.previous(); }}
                onPlayToggle={() => { void causalReplay.togglePlay(); }}
                onNext={() => { void causalReplay.next(); }}
                onRestart={() => { void causalReplay.restart(); }}
              /> : null}

              {!replayFocusActive ? <div className="vlab-scene-legend" aria-label={ui.legendAria}>
                {view === 'earth' ? <>
                  <span><i className="is-service" />{ui.earthPrimary}</span>
                  <span><i className="is-candidate" />{ui.earthVisible}</span>
                  <span><i />{ui.earthContext}</span>
                </> : null}
                {view === 'sky' ? <>
                  <span><i className="is-service" />{ui.skyServing}</span>
                  <span><i className="is-candidate" />{ui.skyCandidate}</span>
                  <span><i />{ui.skyContext}</span>
                </> : null}
                {view === 'service' ? <>
                  <span><i className="is-service" />{ui.serviceServing}</span>
                  <span><i className="is-candidate" />{ui.serviceCandidate}</span>
                  {focus === 'energy' && localScene !== null ? <span><i className="is-energy" />{ui.energy}</span> : null}
                </> : null}
              </div> : null}
            </div>
          </section>

          {storyOpen && simpleReplayKind === null ? <div className="vlab-story-shell">
            <VisualLabStoryRail
              controller={storyController}
              locale={lab.presentation.locale}
              compact
              busy={applyingSource}
              disabled={clipRecording || lab.phase !== 'ready' || snapshot === null || timeline === null}
              onSeek={(next) => {
                const bounded = clamp(next, 0, timeline?.durationSec ?? 0);
                setElapsedSec(bounded);
                void session.dispatch({ type: 'seek', timeSec: bounded });
              }}
              onInspect={handleStoryInspect}
              onForkExplore={() => {
                setStoryOpen(false);
                void session.dispatch({ type: 'setExperience', experience: 'explore' });
              }}
              onStoryChange={(kind) => setSelectedClipId(kind === 'intra-handover' ? 'intra-beam-handover' : 'inter-handover')}
            />
          </div> : <div className={`vlab-timeline-shell${timelineExpanded || replayFocusActive ? ' is-expanded' : ' is-compact'}`}>
            {snapshot !== null && timeline !== null ? <VisualLabTimeline
              className={`${timelineExpanded ? 'vlab-timeline--expanded' : 'vlab-timeline--compact'} vlab-timeline--controls-only`}
              locale={lab.presentation.locale}
              snapshot={snapshot}
              timeline={timeline}
              currentTimeSec={elapsedSec}
              playing={playing}
              playbackRate={playbackRate}
              onPlayToggle={() => setPlaying((current) => !current)}
              onSeek={(next) => {
                const bounded = clamp(next, 0, timeline.durationSec);
                setElapsedSec(bounded);
                void session.dispatch({ type: 'seek', timeSec: bounded });
              }}
              onStep={stepTime}
              onPlaybackRateChange={setPlaybackRate}
            /> : <TimelinePendingPreview locale={lab.presentation.locale} />}
          </div>}
        </section>

        {snapshot !== null ? <VisualLabProgressiveResultDock
          className="vlab-panel vlab-progressive-result-dock"
          locale={lab.presentation.locale}
          snapshot={snapshot}
          activeModule={activeModule}
          onFocus={handleResultFocus}
          comparison={lab.comparison}
          interactionLocked={clipRecording}
          canSaveBaseline={lab.accepted !== null && lab.phase !== 'rejected'}
          onSaveBaseline={() => { void session.dispatch({ type: 'saveComparisonBaseline' }); }}
          onClearBaseline={() => { void session.dispatch({ type: 'clearComparison' }); }}
        /> : <aside id="vlab-results" className="vlab-panel vlab-progressive-result-dock vlab-data-pending" aria-busy="true"><strong>{ui.resultBuilding}</strong><span>{ui.resultLocked}</span></aside>}
      </section>

    </main>
  );
}
