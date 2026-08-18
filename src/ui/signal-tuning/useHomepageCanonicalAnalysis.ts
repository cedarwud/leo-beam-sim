import { useEffect, useMemo, useRef, useState } from 'react';
import { CanonicalEeAccumulator } from '../../analysis/canonicalEe';
import { loadTleSnapshotSelection, loadTleWebArchiveCatalog } from '../../simulator/archive';
import {
  buildSimulationAnalysisFrame,
  createSimulationAnalysisRunId,
  createSimulatorTleState,
  simulatorTaipeiDateTimeToUtc,
  type SimulationAnalysisFrameBuildOptions,
} from '../../simulator/analysis';
import {
  buildTleAnalysisRun,
  type TleAnalysisRun,
  type TleAnalysisRunBuildInput,
} from '../../simulator/tleAnalysisRun';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  SIMULATOR_CATALOG_URLS,
  type SimulatorConstellation,
  type SimulationAnalysisFrame,
  type SimulatorLoadStatus,
  type SimulatorParameters,
  type TleWebArchiveCatalog,
} from '../../simulator/types';
import { isTleArchiveError } from '../../tle/errors';
import {
  nearestTleTimeFallbackCandidates,
  type TleTimeResolution,
} from '../../simulator/tleTimeFallback';
import {
  buildTleRunBundle,
  isTleRunError,
  TLE_RUN_ANCHOR_COUNT,
  TLE_RUN_DURATION_S,
  TLE_RUN_STEP_S,
  type TleRunBundle,
  type TleRunProgress,
} from '../../tle/run';
import {
  createTleRunWorkerTransport,
  TleRunWorkerError,
  type TleRunWorkerProgressMessage,
} from '../../tle/run/workerTransport';
import {
  createHomepageFirstFrameCacheKey,
  createHomepageFirstFrameCacheKeyFromTleState,
  loadHomepageFirstFrameArtifact,
  preloadHomepageFirstFrameArtifact,
  readHomepageFirstFrameSessionCache,
  readHomepageFirstFrameCache,
  writeHomepageFirstFrameCache,
  writeHomepageFirstFrameModuleCache,
} from './homepageFirstFrameCache';
import {
  loadVisualLabDefaultFullRunArtifact,
} from './defaultVisualLabFullRunArtifact';
import { assertSupportedBeamLayoutCount } from '../../core/beam/completeHexPresets';
import { normalizePerSatelliteBeamLayoutCount } from '../../simulator/beamLayoutOverrides';
import { assertSimulatorBeamIlluminationMode } from '../../simulator/beamIlluminationScenario';

const HOMEPAGE_CANONICAL_TAIPEI_LOCAL = '2026-08-12T20:00';
export const HOMEPAGE_DEFAULT_CONSTELLATION: SimulatorConstellation = 'starlink';

// React StrictMode mounts the homepage effect twice in development.  Keep
// only overlapping catalog requests shared; resolved catalogs are deliberately
// not retained so an explicit Apply still revalidates the mutable index.
const inFlightHomepageCatalogLoads = new Map<string, Promise<TleWebArchiveCatalog>>();

function loadHomepageCatalogOnce(url: string): Promise<TleWebArchiveCatalog> {
  const existing = inFlightHomepageCatalogLoads.get(url);
  if (existing !== undefined) return existing;
  const request = loadTleWebArchiveCatalog(url).finally(() => {
    if (inFlightHomepageCatalogLoads.get(url) === request) inFlightHomepageCatalogLoads.delete(url);
  });
  inFlightHomepageCatalogLoads.set(url, request);
  return request;
}

export interface HomepageCanonicalEvaluation {
  readonly deliveredBits: number;
  readonly consumedEnergyJ: number;
  readonly energyEfficiencyBitsPerJ: number;
  /** Elapsed duration represented by accepted frames since the last reset. */
  readonly durationSec: number;
}

/** Internal accumulator detail retained for focused session tests only. */
interface HomepageCanonicalEvaluationSnapshot extends HomepageCanonicalEvaluation {
  readonly sampleCount: number;
}

const EMPTY_HOMEPAGE_CANONICAL_EVALUATION: HomepageCanonicalEvaluation = Object.freeze({
  deliveredBits: 0,
  consumedEnergyJ: 0,
  energyEfficiencyBitsPerJ: 0,
  durationSec: 0,
});

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Dev/evidence-only instrumentation.  Keep this off the visual surface while
 * making it possible to distinguish artifact, session, module, and computed
 * first frames in a live browser trace.
 */
function publishHomepageFirstFrameDiagnostic(source: HomepageFirstFrameSource | null): void {
  if (typeof document === 'undefined') return;
  if (source === null) {
    delete document.documentElement.dataset.homepageFirstFrameSource;
    delete document.documentElement.dataset.homepageFirstFramePublishedMs;
    return;
  }
  document.documentElement.dataset.homepageFirstFrameSource = source;
  const now = globalThis.performance?.now();
  if (typeof now === 'number' && Number.isFinite(now)) {
    document.documentElement.dataset.homepageFirstFramePublishedMs = now.toFixed(1);
  }
}

export type HomepageTleFallbackFailureStage = 'selection' | 'geometry' | 'analysis';

/**
 * Only source/time-dependent failures may advance to another catalog boundary.
 * Configuration, parameter, and internal-contract errors fail immediately so
 * repeating an expensive complete run cannot hide the real defect.
 */
export function shouldAttemptHomepageTleTimeFallback(
  error: unknown,
  stage: HomepageTleFallbackFailureStage,
): boolean {
  if (stage === 'selection') {
    return isTleArchiveError(error)
      && error.code !== 'REQUESTED_INSTANT_INVALID'
      && error.code !== 'TIMEZONE_INVALID'
      && error.code !== 'AMBIGUOUS_LOCAL_TIME';
  }
  if (stage === 'geometry') {
    return (isTleRunError(error) && error.code === 'PROPAGATION_FAILED')
      || (error instanceof TleRunWorkerError && error.code === 'PROPAGATION_FAILED');
  }
  if (error instanceof TleRunWorkerError) {
    // A Worker analysis error is only fallback-eligible when it carries the
    // same source/time-dependent no-service contract as the in-process path.
    // Do not turn an arbitrary Worker/runtime defect into an expensive retry
    // across every nearby archive boundary.
    return error.code === 'PROPAGATION_FAILED'
      || (
        error.code === 'ANALYSIS_FAILED'
        && (
          error.message.startsWith('archived TLE run cannot publish: no real NTPU-visible serving satellite')
          || error.message.startsWith('archived TLE run has no real NTPU-visible serving satellite')
        )
      );
  }
  if (isTleArchiveError(error) && error.code === 'PROPAGATION_FAILED') {
    // The fast first-frame path performs SGP4 before the full RunBundle exists,
    // so its propagation refusal reaches this controller through the analysis
    // catch. It is still source/time dependent and may try the next bounded
    // catalog-time candidate.
    return true;
  }
  const message = readableError(error);
  return message.startsWith('archived TLE run cannot publish: no real NTPU-visible serving satellite')
    || message.startsWith('archived TLE run has no real NTPU-visible serving satellite');
}

export interface HomepageCanonicalParameterAcceptance {
  readonly accepted: boolean;
  readonly parameters: SimulatorParameters;
  readonly frame: SimulationAnalysisFrame | null;
  readonly error: string | null;
}

function homepageEvaluationContextId(frame: SimulationAnalysisFrame): string {
  return JSON.stringify({
    constellation: frame.provenance.constellation,
    model: frame.parameters,
    representativeUserIndex: frame.links[0]?.userIndex ?? null,
    userPositionsKm: frame.scenario.users.map(user => user.positionKm),
    beamLayout: frame.scenario.beamLayout,
    beamIlluminationMode: frame.scenario.beamIllumination.mode,
  });
}

function homepageEvaluationFrameIdentity(frame: SimulationAnalysisFrame): string {
  // `buildSimulationAnalysisFrame` includes the optional run-anchor identity
  // in frameId.  The first-frame fast path has no run anchor, while the same
  // visible calculation from the completed run does.  They are one accepted
  // homepage frame, so the evaluation identity deliberately follows the
  // canonical instant/serving satellite instead of that transport detail.
  return JSON.stringify({
    instantUtc: frame.instantUtc,
    selectedSatelliteId: frame.selectedSatelliteId,
    durationSec: frame.inputs.config.frameDurationS,
  });
}

function homepageEvaluationFrameDurationSec(frame: SimulationAnalysisFrame): number | null {
  const runAnchor = frame.runAnchor ?? frame.tleState.runAnchor;
  // The fast first frame is the provisional form of run anchor 0. Count the
  // same 30-second homepage interval immediately so replacing it with the
  // completed anchor cannot leave a stray 1-second contribution.
  if (runAnchor === undefined) return TLE_RUN_STEP_S;

  // A completed run has one display-only terminal anchor after its interval
  // starts. Only interval starts contribute to EE_eval; the endpoint must not
  // invent another step beyond the published run horizon.
  if (
    !Number.isInteger(runAnchor.anchorIndex)
    || runAnchor.anchorIndex < 0
    || runAnchor.anchorIndex >= runAnchor.anchorCount - 1
  ) {
    return null;
  }
  return runAnchor.stepSec;
}

function homepageEvaluationSnapshot(
  snapshot: ReturnType<CanonicalEeAccumulator['snapshot']>,
  durationSec: number,
): HomepageCanonicalEvaluationSnapshot {
  return Object.freeze({
    deliveredBits: snapshot.deliveredBits,
    consumedEnergyJ: snapshot.consumedEnergyJ,
    energyEfficiencyBitsPerJ: snapshot.energyEfficiencyBitsPerJ,
    durationSec,
    sampleCount: snapshot.sampleCount,
  });
}

function homepageEvaluationsEqual(
  left: HomepageCanonicalEvaluation,
  right: HomepageCanonicalEvaluation,
): boolean {
  return left.deliveredBits === right.deliveredBits
    && left.consumedEnergyJ === right.consumedEnergyJ
    && left.energyEfficiencyBitsPerJ === right.energyEfficiencyBitsPerJ
    && left.durationSec === right.durationSec;
}

function homepageEvaluationPublic(
  value: HomepageCanonicalEvaluation,
): HomepageCanonicalEvaluation {
  return Object.freeze({
    deliveredBits: value.deliveredBits,
    consumedEnergyJ: value.consumedEnergyJ,
    energyEfficiencyBitsPerJ: value.energyEfficiencyBitsPerJ,
    durationSec: value.durationSec,
  });
}

/**
 * Session-scoped ratio-of-sums evaluation for accepted homepage frames.
 *
 * The canonical instant/serving-satellite identity is the StrictMode/re-render
 * de-duplication boundary. Date/time changes retain the same model context and
 * therefore append; a constellation or model-parameter change clears the old
 * window before accepting the new frame.
 */
export class HomepageCanonicalEvaluationSession {
  private readonly accumulator = new CanonicalEeAccumulator();
  private contextId: string | null = null;
  private lastAcceptedFrameIdentity: string | null = null;
  private durationSec = 0;

  snapshot(): HomepageCanonicalEvaluationSnapshot {
    return homepageEvaluationSnapshot(this.accumulator.snapshot(), this.durationSec);
  }

  reset(): HomepageCanonicalEvaluationSnapshot {
    this.accumulator.reset();
    this.durationSec = 0;
    this.lastAcceptedFrameIdentity = null;
    return this.snapshot();
  }

  accept(frame: SimulationAnalysisFrame): HomepageCanonicalEvaluationSnapshot {
    const contextId = homepageEvaluationContextId(frame);
    if (this.contextId !== null && this.contextId !== contextId) {
      this.accumulator.reset();
      this.durationSec = 0;
      this.lastAcceptedFrameIdentity = null;
    }
    this.contextId = contextId;

    const frameIdentity = `${contextId}::${homepageEvaluationFrameIdentity(frame)}`;
    if (this.lastAcceptedFrameIdentity !== frameIdentity) {
      const frameDurationSec = homepageEvaluationFrameDurationSec(frame);
      if (frameDurationSec !== null) {
        this.accumulator.append(frame.canonical, frameDurationSec);
        this.durationSec += frameDurationSec;
      }
      this.lastAcceptedFrameIdentity = frameIdentity;
    }
    return this.snapshot();
  }
}

/**
 * Validate a parameter candidate against the frame that would remain visible.
 *
 * When a TLE request is in flight, `tleState` is intentionally cleared and the
 * UI keeps `fallbackFrame` visible.  Building against that fallback preserves
 * the same parameter/frame identity during the request.  Once a TLE state is
 * available it is authoritative, so a candidate is only accepted after the
 * canonical producer successfully builds its frame.
 */
export function acceptHomepageCanonicalParameterCandidate(
  currentParameters: SimulatorParameters,
  nextParameters: SimulatorParameters,
  tleState: ReturnType<typeof createSimulatorTleState> | null,
  fallbackFrame: SimulationAnalysisFrame | null,
  frameOptions?: SimulationAnalysisFrameBuildOptions,
): HomepageCanonicalParameterAcceptance {
  const validationState = tleState ?? fallbackFrame?.tleState ?? null;
  if (validationState === null) {
    // There is no published frame to keep in sync yet. The first TLE state
    // will still be validated by the normal computed-frame path below.
    return {
      accepted: true,
      parameters: { ...nextParameters },
      frame: null,
      error: null,
    };
  }

  try {
    const frame = buildSimulationAnalysisFrame(validationState, nextParameters, undefined, frameOptions);
    return {
      accepted: true,
      parameters: { ...nextParameters },
      frame,
      error: null,
    };
  } catch (error) {
    return {
      accepted: false,
      parameters: { ...currentParameters },
      frame: fallbackFrame,
      error: readableError(error),
    };
  }
}

export interface HomepageCanonicalAnalysisState {
  readonly frame: SimulationAnalysisFrame | null;
  /**
   * Complete accepted TLE/canonical run behind the published frame.
   * Route adapters may project it, but must not mutate it or build a second
   * scientific state beside it.
   */
  readonly acceptedRun?: TleAnalysisRun | null;
  /** Non-user-facing provenance of the currently published first frame. */
  readonly firstFrameSource?: HomepageFirstFrameSource | null;
  /** Upper completed TLE anchor used only for continuous centre-scene interpolation. */
  readonly visualNextFrame: SimulationAnalysisFrame | null;
  readonly evaluation: HomepageCanonicalEvaluation;
  readonly resetEvaluation: () => void;
  readonly catalog: TleWebArchiveCatalog | null;
  readonly status: SimulatorLoadStatus;
  readonly error: string | null;
  readonly requestedConstellation: SimulatorConstellation;
  readonly setRequestedConstellation: (next: SimulatorConstellation) => void;
  readonly resetRequestedConstellation: () => void;
  readonly taipeiDateTime: string;
  readonly setTaipeiDateTime: (next: string) => void;
  readonly resetTaipeiDateTime: () => void;
  /** Draft orbit settings never trigger work until this explicit action runs. */
  readonly applyRequestedOrbitSettings?: () => void;
  /** True when the visible draft differs from the request currently being shown/built. */
  readonly orbitSettingsDirty?: boolean;
  readonly parameters: SimulatorParameters;
  readonly setParameters: (next: SimulatorParameters) => void;
  readonly resetParameters: () => void;
  readonly frameOptions: Readonly<SimulationAnalysisFrameBuildOptions>;
  readonly setFrameOptions: (next: SimulationAnalysisFrameBuildOptions) => void;
  readonly resetFrameOptions: () => void;
  /** True only after the complete 241-anchor archived-TLE run is published. */
  readonly runReady: boolean;
  /** Current full-run build progress; null once no build is in flight. */
  readonly runProgress: TleRunProgress | null;
  /** Requested versus actually published start time for the current complete run. */
  readonly timeResolution?: TleTimeResolution | null;
  /** Present while bounded nearest-time fallback candidates are being checked. */
  readonly timeFallbackSearch?: HomepageTleFallbackSearch | null;
  readonly timelineDurationSec: number;
  readonly timelineCurrentTimeSec: number;
  readonly timelineStepSec: number;
  /** Select any time inside the already-published run; analysis uses its lower anchor. */
  readonly selectTimelineTimeSec: (targetSec: number) => void;
}

export interface HomepageTleFallbackSearch {
  readonly requestedInstantUtc: string;
  readonly candidateInstantUtc: string;
  readonly attemptNumber: number;
  readonly candidateCount: number;
  readonly exactFailure: string;
}

interface HomepageTimelineSelection {
  readonly currentTimeSec: number;
  readonly anchorIndex: number;
}

interface AppliedHomepageOrbitRequest {
  readonly constellation: SimulatorConstellation;
  readonly taipeiDateTime: string;
  /** Lets an explicit retry rebuild the same source/time after an error. */
  readonly revision: number;
}

function buildHomepageTleAnalysisRun(input: TleAnalysisRunBuildInput): TleAnalysisRun {
  // Pass planning, anchor identity, frame materialization, and the
  // ratio-of-sums evaluation remain owned by the simulator module. This hook
  // is only the atomic publication controller for the homepage.
  return buildTleAnalysisRun(input);
}

export type HomepageFirstFrameSource = 'artifact' | 'full-run-artifact' | 'computed' | 'module' | 'session';

export interface HomepageFirstFrameBuildResult {
  readonly frame: SimulationAnalysisFrame;
  readonly source: HomepageFirstFrameSource;
}

export interface HomepageCanonicalAnalysisOptions {
  readonly initialFrameOptions?: SimulationAnalysisFrameBuildOptions;
}

function normalizeHomepageFrameOptions(
  options: SimulationAnalysisFrameBuildOptions | undefined,
): Readonly<SimulationAnalysisFrameBuildOptions> {
  const beamLayoutCount = options?.beamLayoutCount === undefined
    ? undefined
    : assertSupportedBeamLayoutCount(options.beamLayoutCount);
  const perSatelliteBeamLayoutCount = normalizePerSatelliteBeamLayoutCount(options?.perSatelliteBeamLayoutCount);
  const beamIlluminationMode = options?.beamIlluminationMode === undefined
    ? undefined
    : assertSimulatorBeamIlluminationMode(options.beamIlluminationMode);
  return Object.freeze({
    ...(beamLayoutCount === undefined ? {} : { beamLayoutCount }),
    ...(Object.keys(perSatelliteBeamLayoutCount).length === 0 ? {} : { perSatelliteBeamLayoutCount }),
    ...(beamIlluminationMode === undefined ? {} : { beamIlluminationMode }),
    userPositionOverridesKm: Object.freeze([...(options?.userPositionOverridesKm ?? [])].map(override => Object.freeze({
      userIndex: override.userIndex,
      positionKm: Object.freeze([override.positionKm[0], override.positionKm[1]] as const),
    }))),
    ...(options?.representativeUserIndex === undefined
      ? {}
      : { representativeUserIndex: options.representativeUserIndex }),
  });
}

/** Let React commit and the browser paint the verified first frame before the full run starts. */
export async function yieldForHomepageFirstFramePaint(): Promise<void> {
  const requestAnimationFrame = (globalThis as typeof globalThis & {
    requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  }).requestAnimationFrame;
  if (typeof requestAnimationFrame === 'function') {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
  await new Promise<void>(resolve => globalThis.setTimeout(resolve, 0));
}

export function buildHomepageFirstFrame(
  requestedInstantUtc: string,
  appliedInstantUtc: string,
  catalog: TleWebArchiveCatalog,
  selection: Awaited<ReturnType<typeof loadTleSnapshotSelection>>,
  parameters: SimulatorParameters,
  frameOptions?: SimulationAnalysisFrameBuildOptions,
): HomepageFirstFrameBuildResult {
  const hasScenarioProbe = (frameOptions?.userPositionOverridesKm?.length ?? 0) > 0
    || frameOptions?.representativeUserIndex !== undefined
    || frameOptions?.beamLayoutCount !== undefined
    || Object.keys(frameOptions?.perSatelliteBeamLayoutCount ?? {}).length > 0
    || frameOptions?.beamIlluminationMode !== undefined;
  if (hasScenarioProbe) {
    const tleState = createSimulatorTleState(selection, appliedInstantUtc);
    return {
      frame: buildSimulationAnalysisFrame(tleState, parameters, undefined, frameOptions),
      source: 'computed',
    };
  }
  const key = createHomepageFirstFrameCacheKey(
    requestedInstantUtc,
    appliedInstantUtc,
    catalog,
    selection,
    parameters,
  );
  const cached = readHomepageFirstFrameCache(key);
  if (cached?.source === 'module') return cached;
  if (cached?.source === 'session') {
    const frame = buildSimulationAnalysisFrame(cached.tleState, parameters);
    if (!writeHomepageFirstFrameModuleCache(key, frame)) {
      throw new Error('homepage first-frame session cache frame is missing the current canonical link power shape');
    }
    return { frame, source: 'session' };
  }
  const tleState = createSimulatorTleState(selection, appliedInstantUtc);
  const frame = buildSimulationAnalysisFrame(tleState, parameters);
  if (!writeHomepageFirstFrameCache(key, frame)) {
    throw new Error('homepage first-frame frame is missing the current canonical link power shape');
  }
  return { frame, source: 'computed' };
}

function frameAtRunAnchor(run: TleAnalysisRun, anchorIndex: number): SimulationAnalysisFrame {
  const frame = run.getFrame(anchorIndex);
  if (frame === undefined || frame === null) {
    throw new Error(`tleAnalysisRun did not produce a visible frame at anchor ${anchorIndex}`);
  }
  return frame;
}

interface PublishedHomepageTleRun {
  readonly analysisRun: TleAnalysisRun;
  readonly geometryRun: TleRunBundle;
  readonly selection: Awaited<ReturnType<typeof loadTleSnapshotSelection>>;
  readonly timeResolution: TleTimeResolution;
}

const HOMEPAGE_EXPERIMENT_CACHE_LIMIT = 6;

function homepageExperimentAnalysisRunId(
  basePublication: PublishedHomepageTleRun,
  parameters: SimulatorParameters,
  frameOptions: Readonly<SimulationAnalysisFrameBuildOptions>,
): string {
  const hasScenarioProbe = (frameOptions.userPositionOverridesKm?.length ?? 0) > 0
    || frameOptions.representativeUserIndex !== undefined
    || frameOptions.beamLayoutCount !== undefined
    || Object.keys(frameOptions.perSatelliteBeamLayoutCount ?? {}).length > 0
    || frameOptions.beamIlluminationMode !== undefined;
  return createSimulationAnalysisRunId(
    basePublication.analysisRun.geometryRunId,
    basePublication.analysisRun.passPlan.policyRevision,
    parameters,
    hasScenarioProbe ? frameOptions : undefined,
  );
}

/**
 * Publish a verified first frame for the initial load, then atomically replace
 * it with the complete archived-TLE run.  A later explicit Apply retains the
 * previous accepted publication while the next source/date request is built;
 * only a complete replacement run may supersede it.
 */
export function useHomepageCanonicalAnalysis(
  options: HomepageCanonicalAnalysisOptions = {},
): HomepageCanonicalAnalysisState {
  const initialFrameOptionsRef = useRef<Readonly<SimulationAnalysisFrameBuildOptions> | null>(null);
  if (initialFrameOptionsRef.current === null) {
    initialFrameOptionsRef.current = normalizeHomepageFrameOptions(options.initialFrameOptions);
  }
  const [requestedConstellation, setRequestedConstellation] = useState<SimulatorConstellation>(HOMEPAGE_DEFAULT_CONSTELLATION);
  const [taipeiDateTime, setTaipeiDateTime] = useState(HOMEPAGE_CANONICAL_TAIPEI_LOCAL);
  const [appliedOrbitRequest, setAppliedOrbitRequest] = useState<AppliedHomepageOrbitRequest>({
    constellation: HOMEPAGE_DEFAULT_CONSTELLATION,
    taipeiDateTime: HOMEPAGE_CANONICAL_TAIPEI_LOCAL,
    revision: 0,
  });
  const [catalog, setCatalog] = useState<TleWebArchiveCatalog | null>(null);
  const [status, setStatus] = useState<SimulatorLoadStatus>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [parameterError, setParameterError] = useState<string | null>(null);
  const [parameters, setParametersState] = useState<SimulatorParameters>({ ...DEFAULT_SIMULATOR_PARAMETERS });
  const [frameOptions, setFrameOptionsState] = useState<Readonly<SimulationAnalysisFrameBuildOptions>>(
    initialFrameOptionsRef.current,
  );
  const [publishedRun, setPublishedRun] = useState<PublishedHomepageTleRun | null>(null);
  const [evaluation, setEvaluation] = useState<HomepageCanonicalEvaluation>(EMPTY_HOMEPAGE_CANONICAL_EVALUATION);
  const [firstFrameSource, setFirstFrameSource] = useState<HomepageFirstFrameSource | null>(null);
  const [timelineSelection, setTimelineSelection] = useState<HomepageTimelineSelection>({
    currentTimeSec: 0,
    anchorIndex: 0,
  });
  const [runProgress, setRunProgress] = useState<TleRunProgress | null>(null);
  const [timeFallbackSearch, setTimeFallbackSearch] = useState<HomepageTleFallbackSearch | null>(null);
  const lastAcceptedFrame = useRef<SimulationAnalysisFrame | null>(null);
  const evaluationSession = useRef<HomepageCanonicalEvaluationSession | null>(null);
  if (evaluationSession.current === null) {
    evaluationSession.current = new HomepageCanonicalEvaluationSession();
  }
  const parametersRef = useRef(parameters);
  parametersRef.current = parameters;
  const frameOptionsRef = useRef(frameOptions);
  frameOptionsRef.current = frameOptions;
  const publishedRunRef = useRef(publishedRun);
  publishedRunRef.current = publishedRun;
  const experimentPublicationCache = useRef<Map<string, PublishedHomepageTleRun>>(new Map());
  const rememberExperimentPublication = (publication: PublishedHomepageTleRun): void => {
    const cache = experimentPublicationCache.current;
    cache.delete(publication.analysisRun.analysisRunId);
    cache.set(publication.analysisRun.analysisRunId, publication);
    while (cache.size > HOMEPAGE_EXPERIMENT_CACHE_LIMIT) {
      const oldestKey = cache.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      cache.delete(oldestKey);
    }
  };
  const timelineSelectionRef = useRef(timelineSelection);
  timelineSelectionRef.current = timelineSelection;
  const requestId = useRef(0);
  const activeAbortController = useRef<AbortController | null>(null);
  // Parameter and bounded scene edits reuse accepted geometry in their own
  // Worker.  Keeping this transport separate prevents a slider/scene edit
  // from superseding an archived-TLE source build that is already in flight.
  const analysisWorkerTransport = useRef<ReturnType<typeof createTleRunWorkerTransport>>(null);
  const analysisRebuildRequestId = useRef(0);
  const analysisRebuildAbortController = useRef<AbortController | null>(null);
  const publishEvaluation = (next: HomepageCanonicalEvaluation): void => {
    const publicEvaluation = homepageEvaluationPublic(next);
    setEvaluation(previous => homepageEvaluationsEqual(previous, publicEvaluation) ? previous : publicEvaluation);
  };
  const acceptEvaluationFrame = (nextFrame: SimulationAnalysisFrame): void => {
    const nextEvaluation = evaluationSession.current!.accept(nextFrame);
    publishEvaluation(nextEvaluation);
  };

  useEffect(() => () => {
    analysisRebuildRequestId.current += 1;
    analysisRebuildAbortController.current?.abort();
    analysisRebuildAbortController.current = null;
    analysisWorkerTransport.current?.dispose();
    analysisWorkerTransport.current = null;
  }, []);

  useEffect(() => {
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    const controller = new AbortController();
    activeAbortController.current?.abort();
    activeAbortController.current = controller;
    // The transport is request-scoped and lazy. The first frame is still
    // published from the artifact/session path below; the module Worker is
    // constructed only after that paint yield, so its module fetch cannot
    // delay the existing first-frame path.
    const workerTransportRef: {
      current: ReturnType<typeof createTleRunWorkerTransport>;
    } = { current: null };
    const ensureWorkerTransport = (): ReturnType<typeof createTleRunWorkerTransport> => {
      if (workerTransportRef.current !== null) return workerTransportRef.current;
      try {
        workerTransportRef.current = createTleRunWorkerTransport();
      } catch {
        // A browser that cannot construct module Workers keeps the explicit
        // in-process baseline as a bounded fallback. It never changes formulas
        // or publication identity.
        workerTransportRef.current = null;
      }
      return workerTransportRef.current;
    };
    let cancelled = false;
    const retainPreviousAccepted = publishedRun !== null && lastAcceptedFrame.current !== null;
    let completedFirstFrameSource: HomepageFirstFrameSource | null = null;
    const isCurrent = () => !cancelled && !controller.signal.aborted && currentRequest === requestId.current;
    setStatus('loading');
    setLoadError(null);
    setParameterError(null);
    setRunProgress(null);
    setTimeFallbackSearch(null);
    if (!retainPreviousAccepted) {
      setFirstFrameSource(null);
      publishHomepageFirstFrameDiagnostic(null);
      setCatalog(null);
    }

    // The artifact is immutable and independently key-validated below.  Start
    // its fetch while the mutable catalog is being revalidated so the default
    // first frame does not wait on two serial network turns.
    const shouldPreloadDefaultArtifact = appliedOrbitRequest.constellation === HOMEPAGE_DEFAULT_CONSTELLATION
      && appliedOrbitRequest.taipeiDateTime === HOMEPAGE_CANONICAL_TAIPEI_LOCAL;
    if (shouldPreloadDefaultArtifact) preloadHomepageFirstFrameArtifact();

    void (async () => {
      try {
        const nextCatalog = await loadHomepageCatalogOnce(SIMULATOR_CATALOG_URLS[appliedOrbitRequest.constellation]);
        if (nextCatalog.constellation !== appliedOrbitRequest.constellation) {
          throw new Error(`homepage catalog mismatch: requested ${appliedOrbitRequest.constellation}, received ${nextCatalog.constellation}`);
        }
        const requestedInstantUtc = simulatorTaipeiDateTimeToUtc(appliedOrbitRequest.taipeiDateTime);
        // The checked-in complete 241-anchor artifact is the default startup
        // path.  The compact first frame still paints first, then this
        // immutable artifact fills the timeline without starting scientific
        // computation in the browser.  `?visualLabFullRun=0` is retained as a
        // diagnostic escape hatch for constrained-device testing only.
        const fullRunArtifactOptOut = typeof window !== 'undefined'
          && new URLSearchParams(window.location.search).get('visualLabFullRun') === '0';
        const canUseDefaultFullRunArtifact = !fullRunArtifactOptOut
          && appliedOrbitRequest.constellation === HOMEPAGE_DEFAULT_CONSTELLATION
          && appliedOrbitRequest.taipeiDateTime === HOMEPAGE_CANONICAL_TAIPEI_LOCAL
          && requestedInstantUtc === '2026-08-12T12:00:00.000Z'
          && JSON.stringify(parametersRef.current) === JSON.stringify(DEFAULT_SIMULATOR_PARAMETERS)
          && (frameOptionsRef.current.userPositionOverridesKm?.length ?? 0) === 0
          && frameOptionsRef.current.representativeUserIndex === undefined
          && frameOptionsRef.current.beamLayoutCount === undefined
          && Object.keys(frameOptionsRef.current.perSatelliteBeamLayoutCount ?? {}).length === 0
          && frameOptionsRef.current.beamIlluminationMode === undefined;
        // Start the complete immutable artifact as soon as the catalog identity
        // is known. The first-frame artifact can still paint immediately while
        // this larger request is validated; the live Worker is not created
        // until this promise has either produced a complete run or failed
        // closed.
        const defaultFullRunPromise = canUseDefaultFullRunArtifact
          ? loadVisualLabDefaultFullRunArtifact({
            requestedInstantUtc,
            appliedInstantUtc: requestedInstantUtc,
            catalog: nextCatalog,
            parameters: parametersRef.current,
            frameOptions: frameOptionsRef.current,
          })
          : Promise.resolve(null);
        const fallbackCandidates = nearestTleTimeFallbackCandidates(nextCatalog, requestedInstantUtc);
        const candidateInstants = [
          requestedInstantUtc,
          ...fallbackCandidates.map(candidate => candidate.instantUtc),
        ];
        const failures: Array<{ readonly instantUtc: string; readonly error: string }> = [];
        let firstFramePublished = false;
        const publishFirstFrame = async (
          firstFrame: SimulationAnalysisFrame,
          source: HomepageFirstFrameSource,
        ): Promise<boolean> => {
          if (!isCurrent()) return false;
          completedFirstFrameSource = source;
          // The first-frame artifact is the initial-load fast path, not a
          // partial replacement transaction.  When an accepted run is already
          // visible, keep it intact until the new complete run passes every
          // source, geometry and analysis gate below.
          if (!retainPreviousAccepted) {
            lastAcceptedFrame.current = firstFrame;
            setFirstFrameSource(source);
            publishHomepageFirstFrameDiagnostic(source);
            setCatalog(nextCatalog);
            acceptEvaluationFrame(firstFrame);
            setTimelineSelection({ currentTimeSec: 0, anchorIndex: 0 });
          }
          setRunProgress({
            status: 'running',
            completedAnchors: 0,
            totalAnchors: TLE_RUN_ANCHOR_COUNT,
            anchorIndex: -1,
            anchorUtc: null,
            fraction: 0,
            progress: 0,
          });
          // React state alone does not guarantee a browser paint before the
          // CPU-heavy full-catalog run begins. Yield a paint frame, then one
          // task, so the verified first frame becomes visible immediately;
          // the locked timeline can continue filling in the background.
          await yieldForHomepageFirstFramePaint();
          return isCurrent();
        };

        const canUseDefaultFirstFrameArtifact = appliedOrbitRequest.constellation === HOMEPAGE_DEFAULT_CONSTELLATION
          && appliedOrbitRequest.taipeiDateTime === HOMEPAGE_CANONICAL_TAIPEI_LOCAL
          && requestedInstantUtc === '2026-08-12T12:00:00.000Z'
          && JSON.stringify(parametersRef.current) === JSON.stringify(DEFAULT_SIMULATOR_PARAMETERS)
          && (frameOptionsRef.current.userPositionOverridesKm?.length ?? 0) === 0
          && frameOptionsRef.current.representativeUserIndex === undefined
          && frameOptionsRef.current.beamLayoutCount === undefined
          && Object.keys(frameOptionsRef.current.perSatelliteBeamLayoutCount ?? {}).length === 0
          && frameOptionsRef.current.beamIlluminationMode === undefined;
        if (canUseDefaultFirstFrameArtifact) {
          const firstFrameExpectation = {
            requestedInstantUtc,
            appliedInstantUtc: requestedInstantUtc,
            catalog: nextCatalog,
            parameters: parametersRef.current,
          };

          // Warm reloads should consume the compact, already-validated
          // session state before touching the immutable artifact or the full
          // snapshot.  The expectation still binds archive, formula, time,
          // and parameter identity to the current catalog.
          const sessionTleState = readHomepageFirstFrameSessionCache(firstFrameExpectation);
          if (sessionTleState !== null) {
            try {
              const sessionFrame = buildSimulationAnalysisFrame(sessionTleState, parametersRef.current);
              const sessionKey = createHomepageFirstFrameCacheKeyFromTleState(
                requestedInstantUtc,
                requestedInstantUtc,
                nextCatalog,
                sessionTleState,
                parametersRef.current,
              );
              if (!writeHomepageFirstFrameModuleCache(sessionKey, sessionFrame)) {
                throw new Error('homepage first-frame session cache frame is missing the current canonical link power shape');
              }
              firstFramePublished = await publishFirstFrame(sessionFrame, 'session');
              if (!firstFramePublished) return;
            } catch {
              // A persisted payload is an optimization only.  Fall through to
              // the checked-in artifact, then to the full selected-TLE path.
            }
          }

          const artifactTleState = firstFramePublished
            ? null
            : await loadHomepageFirstFrameArtifact(firstFrameExpectation);
          if (artifactTleState !== null) {
            try {
              const artifactFrame = buildSimulationAnalysisFrame(artifactTleState, parametersRef.current);
              const artifactKey = createHomepageFirstFrameCacheKeyFromTleState(
                requestedInstantUtc,
                requestedInstantUtc,
                nextCatalog,
                artifactTleState,
                parametersRef.current,
              );
              // Keep the compact state available on the next reload while the
              // module cache retains the already rebuilt canonical frame.
              if (!writeHomepageFirstFrameCache(artifactKey, artifactFrame)) {
                throw new Error('homepage first-frame artifact frame is missing the current canonical link power shape');
              }
              firstFramePublished = await publishFirstFrame(artifactFrame, 'artifact');
              if (!firstFramePublished) return;
            } catch {
              // A checked-in artifact is only an optimization. If its state
              // cannot rebuild the canonical frame, continue through the
              // normal selected-TLE path and let its validation fail closed.
            }
          }
        }

        let completed: {
          readonly appliedInstantUtc: string;
          readonly selection: Awaited<ReturnType<typeof loadTleSnapshotSelection>>;
          readonly geometryRun: TleRunBundle;
          readonly analysisRun: TleAnalysisRun;
        } | null = null;

        const defaultFullRun = await defaultFullRunPromise;
        if (defaultFullRun !== null) {
          if (!firstFramePublished) {
            const artifactFrame = defaultFullRun.getFrame(0);
            if (artifactFrame === null) throw new Error('default full-run artifact has no accepted anchor-0 frame');
            firstFramePublished = await publishFirstFrame(artifactFrame, 'full-run-artifact');
            if (!firstFramePublished) return;
          }
          completed = {
            appliedInstantUtc: requestedInstantUtc,
            selection: defaultFullRun.selection,
            geometryRun: defaultFullRun.geometryRun,
            analysisRun: defaultFullRun,
          };
        }

        for (let candidateIndex = 0; completed === null && candidateIndex < candidateInstants.length; candidateIndex += 1) {
          const appliedInstantUtc = candidateInstants[candidateIndex]!;
          if (!isCurrent()) return;
          if (candidateIndex > 0) {
            setRunProgress(null);
            setTimeFallbackSearch({
              requestedInstantUtc,
              candidateInstantUtc: appliedInstantUtc,
              attemptNumber: candidateIndex,
              candidateCount: fallbackCandidates.length,
              exactFailure: failures[0]?.error ?? 'the requested instant could not build a complete run',
            });
          }
          let selection: Awaited<ReturnType<typeof loadTleSnapshotSelection>>;
          try {
            selection = await loadTleSnapshotSelection(nextCatalog, appliedInstantUtc);
          } catch (error) {
            if (!isCurrent()) return;
            if (!shouldAttemptHomepageTleTimeFallback(error, 'selection')) throw error;
            firstFramePublished = false;
            completedFirstFrameSource = null;
            if (!retainPreviousAccepted) lastAcceptedFrame.current = null;
            failures.push({ instantUtc: appliedInstantUtc, error: readableError(error) });
            continue;
          }

          if (!firstFramePublished) {
            let firstFrame: SimulationAnalysisFrame;
            let firstFrameSource: HomepageFirstFrameSource = 'computed';
            try {
              const firstFrameResult = buildHomepageFirstFrame(
                requestedInstantUtc,
                appliedInstantUtc,
                nextCatalog,
                selection,
                parametersRef.current,
                frameOptionsRef.current,
              );
              firstFrame = firstFrameResult.frame;
              firstFrameSource = firstFrameResult.source;
            } catch (error) {
              if (!isCurrent()) return;
              if (!shouldAttemptHomepageTleTimeFallback(error, 'analysis')) throw error;
              failures.push({ instantUtc: appliedInstantUtc, error: readableError(error) });
              continue;
            }

            // Publish the exact selected-TLE/SGP4/canonical first frame before
            // the complete geometry run starts. `runReady` remains false, so
            // the timeline cannot seek into an unfinished two-hour window.
            firstFramePublished = await publishFirstFrame(firstFrame, firstFrameSource);
            if (!firstFramePublished) return;
          }

          let geometryRun: TleRunBundle;
          let workerAnalysisRun: TleAnalysisRun | null = null;
          let sourceWorkerTransport: ReturnType<typeof createTleRunWorkerTransport> = null;
          try {
            const activeWorkerTransport = ensureWorkerTransport();
            sourceWorkerTransport = activeWorkerTransport;
            if (activeWorkerTransport !== null) {
              const workerResult = await activeWorkerTransport.build({
                selection,
                t0Utc: appliedInstantUtc,
                parameters: parametersRef.current,
                frameOptions: frameOptionsRef.current,
              }, {
                signal: controller.signal,
                onProgress: (message: TleRunWorkerProgressMessage) => {
                  if (isCurrent() && message.phase === 'geometry') setRunProgress(message.progress);
                },
              });
              geometryRun = workerResult.geometryRun;
              workerAnalysisRun = workerResult.analysisRun;
            } else {
              geometryRun = await buildTleRunBundle({
                selection,
                t0Utc: appliedInstantUtc,
                signal: controller.signal,
                isCurrent,
                onProgress: progress => {
                  if (isCurrent()) setRunProgress(progress);
                },
              });
            }
          } catch (error) {
            if (!isCurrent()) return;
            const failureStage: HomepageTleFallbackFailureStage = error instanceof TleRunWorkerError && error.code === 'ANALYSIS_FAILED'
              ? 'analysis'
              : 'geometry';
            if (!shouldAttemptHomepageTleTimeFallback(error, failureStage)) throw error;
            firstFramePublished = false;
            completedFirstFrameSource = null;
            if (!retainPreviousAccepted) lastAcceptedFrame.current = null;
            failures.push({ instantUtc: appliedInstantUtc, error: readableError(error) });
            continue;
          }

          if (!isCurrent()) return;
          try {
            // The Worker has already composed and snapshotted the complete
            // analysis run. If controls changed while the source request was
            // running, reconcile them in that same Worker from the completed
            // geometry/pass plan; never block the publication task with a
            // second 241-anchor analysis rebuild.
            let analysisRun = workerAnalysisRun === null
              ? buildHomepageTleAnalysisRun({
                selection,
                geometryRun,
                parameters: parametersRef.current,
                frameOptions: frameOptionsRef.current,
              })
              : workerAnalysisRun;
            while (
              sourceWorkerTransport !== null
              && (
                JSON.stringify(analysisRun.parameters) !== JSON.stringify(parametersRef.current)
                || JSON.stringify(analysisRun.frameOptions) !== JSON.stringify(frameOptionsRef.current)
              )
            ) {
              const currentParameters = parametersRef.current;
              const currentFrameOptions = frameOptionsRef.current;
              const reconciled = await sourceWorkerTransport.rebuildAnalysis({
                selection,
                geometryRun,
                passPlan: analysisRun.passPlan,
                parameters: currentParameters,
                frameOptions: currentFrameOptions,
              }, { signal: controller.signal });
              if (!isCurrent()) return;
              geometryRun = reconciled.geometryRun;
              analysisRun = reconciled.analysisRun;
            }
            completed = { appliedInstantUtc, selection, geometryRun, analysisRun };
            break;
          } catch (error) {
            if (!isCurrent()) return;
            if (!shouldAttemptHomepageTleTimeFallback(error, 'analysis')) throw error;
            firstFramePublished = false;
            completedFirstFrameSource = null;
            if (!retainPreviousAccepted) lastAcceptedFrame.current = null;
            failures.push({ instantUtc: appliedInstantUtc, error: readableError(error) });
          }
        }

        if (completed === null) {
          const lastFailure = failures[failures.length - 1];
          throw new Error(
            `所選時刻與 ${fallbackCandidates.length} 個最近的資料邊界都無法建立完整兩小時場景`
            + (lastFailure === undefined ? '' : `；最後一次：${lastFailure.error}`),
          );
        }
        const { appliedInstantUtc, selection, geometryRun, analysisRun } = completed;
        const timeResolution: TleTimeResolution = Object.freeze({
          requestedInstantUtc,
          appliedInstantUtc,
          usedFallback: appliedInstantUtc !== requestedInstantUtc,
          offsetSeconds: (Date.parse(appliedInstantUtc) - Date.parse(requestedInstantUtc)) / 1_000,
          attemptedInstantCount: failures.length + 1,
          exactFailure: appliedInstantUtc === requestedInstantUtc ? null : failures[0]?.error ?? null,
        });
        const nextFrame = frameAtRunAnchor(analysisRun, 0);
        if (!isCurrent()) return;
        // Set the fallback before publishing the object so no render can
        // observe a published run without its matching frame.
        lastAcceptedFrame.current = nextFrame;
        evaluationSession.current!.reset();
        acceptEvaluationFrame(nextFrame);
        setCatalog(nextCatalog);
        setFirstFrameSource(completedFirstFrameSource ?? 'computed');
        publishHomepageFirstFrameDiagnostic(completedFirstFrameSource ?? 'computed');
        const nextPublication = { analysisRun, geometryRun, selection, timeResolution };
        experimentPublicationCache.current.clear();
        rememberExperimentPublication(nextPublication);
        publishedRunRef.current = nextPublication;
        setPublishedRun(nextPublication);
        setTimeFallbackSearch(null);
        setTimelineSelection({ currentTimeSec: 0, anchorIndex: 0 });
        setRunProgress(previous => previous?.status === 'complete'
          ? previous
          : {
            status: 'complete',
            completedAnchors: TLE_RUN_ANCHOR_COUNT,
            totalAnchors: TLE_RUN_ANCHOR_COUNT,
            anchorIndex: TLE_RUN_ANCHOR_COUNT - 1,
            anchorUtc: geometryRun.getAnchorUtc(TLE_RUN_ANCHOR_COUNT - 1),
            fraction: 1,
            progress: 1,
          });
        setStatus('ready');
        // The source Worker has completed its one publication transaction.
        // Analysis edits deliberately use their own replaceable Worker below,
        // so retaining this producer would only leave an idle duplicate.
        workerTransportRef.current?.dispose();
        workerTransportRef.current = null;
      } catch (error) {
        if (!isCurrent()) return;
        setTimeFallbackSearch(null);
        setLoadError(readableError(error));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      workerTransportRef.current?.dispose();
      if (activeAbortController.current === controller) activeAbortController.current = null;
    };
  }, [appliedOrbitRequest]);

  const publishedFrame = useMemo(() => {
    if (publishedRun === null || status !== 'ready') return null;
    try {
      return frameAtRunAnchor(publishedRun.analysisRun, timelineSelection.anchorIndex);
    } catch {
      return null;
    }
  }, [publishedRun, status, timelineSelection.anchorIndex]);
  const visualNextFrame = useMemo(() => {
    if (publishedRun === null || status !== 'ready') return null;
    const nextAnchorIndex = Math.min(
      TLE_RUN_ANCHOR_COUNT - 1,
      timelineSelection.anchorIndex + 1,
    );
    try {
      return frameAtRunAnchor(publishedRun.analysisRun, nextAnchorIndex);
    } catch {
      return null;
    }
  }, [publishedRun, status, timelineSelection.anchorIndex]);
  useEffect(() => {
    if (publishedFrame === null || status !== 'ready') return;
    const nextEvaluation = evaluationSession.current!.accept(publishedFrame);
    publishEvaluation(nextEvaluation);
  }, [publishedFrame, status]);
  if (publishedFrame !== null && status === 'ready') lastAcceptedFrame.current = publishedFrame;
  const frame = publishedFrame ?? lastAcceptedFrame.current;
  const currentCatalog = catalog?.constellation === requestedConstellation ? catalog : null;
  const runReady = publishedRun !== null && status === 'ready';

  const resetEvaluation = () => {
    publishEvaluation(evaluationSession.current!.reset());
  };

  const selectTimelineTimeSec = (targetSec: number) => {
    if (!runReady || !Number.isFinite(targetSec)) return;
    const boundedTimeSec = Math.max(0, Math.min(TLE_RUN_DURATION_S, targetSec));
    const anchorIndex = Math.max(0, Math.min(
      TLE_RUN_ANCHOR_COUNT - 1,
      Math.floor(boundedTimeSec / TLE_RUN_STEP_S),
    ));
    setTimelineSelection(previous => (
      previous.currentTimeSec === boundedTimeSec && previous.anchorIndex === anchorIndex
        ? previous
        : { currentTimeSec: boundedTimeSec, anchorIndex }
    ));
  };

  const rebuildAcceptedExperiment = (
    basePublication: PublishedHomepageTleRun,
    nextParameters: SimulatorParameters,
    nextFrameOptions: Readonly<SimulationAnalysisFrameBuildOptions>,
  ): void => {
    const rebuildRequest = analysisRebuildRequestId.current + 1;
    analysisRebuildRequestId.current = rebuildRequest;
    analysisRebuildAbortController.current?.abort();
    // `buildTleAnalysisRun` is a synchronous scientific producer inside the
    // Worker. A queued cancel message cannot interrupt that stack, therefore a
    // newer edit terminates the old Worker and starts one clean last-write-wins
    // producer instead of waiting behind stale analysis work.
    analysisWorkerTransport.current?.dispose();
    analysisWorkerTransport.current = null;
    const controller = new AbortController();
    analysisRebuildAbortController.current = controller;
    const baseGeometryRunId = basePublication.analysisRun.geometryRunId;
    const isCurrent = (): boolean => (
      !controller.signal.aborted
      && rebuildRequest === analysisRebuildRequestId.current
    );

    const publishAccepted = (result: {
      readonly geometryRun: TleRunBundle;
      readonly analysisRun: TleAnalysisRun;
    }): void => {
      if (!isCurrent()) return;
      const currentPublication = publishedRunRef.current;
      if (
        currentPublication === null
        || currentPublication.analysisRun.geometryRunId !== baseGeometryRunId
        || result.analysisRun.geometryRunId !== baseGeometryRunId
      ) return;
      const nextFrame = frameAtRunAnchor(
        result.analysisRun,
        timelineSelectionRef.current.anchorIndex,
      );
      const nextPublication: PublishedHomepageTleRun = {
        ...currentPublication,
        geometryRun: result.geometryRun,
        analysisRun: result.analysisRun,
      };
      rememberExperimentPublication(nextPublication);
      lastAcceptedFrame.current = nextFrame;
      parametersRef.current = result.analysisRun.parameters;
      frameOptionsRef.current = result.analysisRun.frameOptions;
      publishedRunRef.current = nextPublication;
      setPublishedRun(nextPublication);
      setParametersState(result.analysisRun.parameters);
      setFrameOptionsState(result.analysisRun.frameOptions);
      acceptEvaluationFrame(nextFrame);
      setParameterError(null);
      if (analysisRebuildAbortController.current === controller) {
        analysisRebuildAbortController.current = null;
      }
    };

    const rejectCurrent = (error: unknown): void => {
      if (!isCurrent()) return;
      const currentPublication = publishedRunRef.current;
      if (currentPublication?.analysisRun.geometryRunId !== baseGeometryRunId) return;
      parametersRef.current = currentPublication.analysisRun.parameters;
      frameOptionsRef.current = currentPublication.analysisRun.frameOptions;
      setParametersState(currentPublication.analysisRun.parameters);
      setFrameOptionsState(currentPublication.analysisRun.frameOptions);
      setParameterError(readableError(error));
      if (analysisRebuildAbortController.current === controller) {
        analysisRebuildAbortController.current = null;
      }
    };

    rememberExperimentPublication(basePublication);
    const cachedPublication = experimentPublicationCache.current.get(
      homepageExperimentAnalysisRunId(basePublication, nextParameters, nextFrameOptions),
    );
    if (
      cachedPublication !== undefined
      && cachedPublication.analysisRun.geometryRunId === baseGeometryRunId
    ) {
      publishAccepted(cachedPublication);
      return;
    }

    let transport: ReturnType<typeof createTleRunWorkerTransport> = null;
    try {
      transport = createTleRunWorkerTransport();
      analysisWorkerTransport.current = transport;
    } catch {
      transport = null;
    }
    if (transport !== null) {
      void transport.rebuildAnalysis({
        selection: basePublication.selection,
        geometryRun: basePublication.geometryRun,
        passPlan: basePublication.analysisRun.passPlan,
        parameters: nextParameters,
        frameOptions: nextFrameOptions,
      }, { signal: controller.signal }).then(publishAccepted).catch(error => {
        if (error instanceof TleRunWorkerError && error.code === 'CANCELLED') return;
        rejectCurrent(error);
      });
      return;
    }

    // Non-Worker environments retain the same scientific path, but yield the
    // event task first so the input itself never performs a complete run
    // rebuild synchronously.
    globalThis.setTimeout(() => {
      if (!isCurrent()) return;
      try {
        const analysisRun = basePublication.analysisRun.withExperiment(
          nextParameters,
          nextFrameOptions,
        );
        publishAccepted({ geometryRun: basePublication.geometryRun, analysisRun });
      } catch (error) {
        rejectCurrent(error);
      }
    }, 0);
  };

  const updateParameters = (next: SimulatorParameters) => {
    setParameterError(null);
    if (publishedRun === null) {
      // No geometry has been published yet, so there is no visible frame that
      // could disagree with these pending inputs. The first completed run will
      // consume the ref value below.
      const acceptance = acceptHomepageCanonicalParameterCandidate(
        parameters,
        next,
        null,
        lastAcceptedFrame.current,
        frameOptionsRef.current,
      );
      if (!acceptance.accepted) {
        setParameterError(acceptance.error);
        return;
      }
      parametersRef.current = acceptance.parameters;
      setParametersState(acceptance.parameters);
      return;
    }
    const acceptance = acceptHomepageCanonicalParameterCandidate(
      parametersRef.current,
      next,
      null,
      lastAcceptedFrame.current,
      frameOptionsRef.current,
    );
    if (!acceptance.accepted) {
      setParameterError(acceptance.error);
      return;
    }
    parametersRef.current = acceptance.parameters;
    setParametersState(acceptance.parameters);
    rebuildAcceptedExperiment(publishedRun, acceptance.parameters, frameOptionsRef.current);
  };

  const resetParameters = () => updateParameters({ ...DEFAULT_SIMULATOR_PARAMETERS });
  const updateFrameOptions = (next: SimulationAnalysisFrameBuildOptions) => {
    setParameterError(null);
    try {
      const normalized = normalizeHomepageFrameOptions(next);
      if (publishedRun === null) {
        const tleState = lastAcceptedFrame.current?.tleState ?? null;
        if (tleState !== null) buildSimulationAnalysisFrame(tleState, parametersRef.current, undefined, normalized);
        frameOptionsRef.current = normalized;
        setFrameOptionsState(normalized);
        return;
      }
      frameOptionsRef.current = normalized;
      setFrameOptionsState(normalized);
      rebuildAcceptedExperiment(publishedRun, parametersRef.current, normalized);
    } catch (error) {
      setParameterError(readableError(error));
    }
  };
  const resetFrameOptions = () => updateFrameOptions(initialFrameOptionsRef.current!);
  const error = loadError ?? parameterError;
  const orbitSettingsDirty = requestedConstellation !== appliedOrbitRequest.constellation
    || taipeiDateTime !== appliedOrbitRequest.taipeiDateTime;

  const applyRequestedOrbitSettings = () => {
    if (!orbitSettingsDirty && status !== 'error') return;
    analysisRebuildRequestId.current += 1;
    analysisRebuildAbortController.current?.abort();
    analysisRebuildAbortController.current = null;
    // A source/time transaction supersedes every analysis-only transaction.
    // Terminate the Worker because its synchronous producer cannot consume a
    // queued cancel message until after the expensive analysis has returned.
    analysisWorkerTransport.current?.dispose();
    analysisWorkerTransport.current = null;
    activeAbortController.current?.abort();
    // Source/time publication is atomic: the previous accepted geometry,
    // results and evaluation remain visible while the draft request builds.
    // The completed request replaces them together in the effect above.
    setRunProgress(null);
    setTimeFallbackSearch(null);
    setCatalog(null);
    setLoadError(null);
    setParameterError(null);
    setStatus('loading');
    setAppliedOrbitRequest(previous => ({
      constellation: requestedConstellation,
      taipeiDateTime,
      revision: previous.revision + 1,
    }));
  };

  return {
    frame,
    acceptedRun: publishedRun?.analysisRun ?? null,
    firstFrameSource,
    visualNextFrame,
    evaluation,
    resetEvaluation,
    catalog: currentCatalog,
    status,
    error,
    requestedConstellation,
    setRequestedConstellation: next => {
      if (next === requestedConstellation) return;
      setRequestedConstellation(next);
    },
    resetRequestedConstellation: () => {
      if (requestedConstellation === HOMEPAGE_DEFAULT_CONSTELLATION) return;
      setRequestedConstellation(HOMEPAGE_DEFAULT_CONSTELLATION);
    },
    taipeiDateTime,
    setTaipeiDateTime: next => {
      if (next === taipeiDateTime) return;
      setTaipeiDateTime(next);
    },
    resetTaipeiDateTime: () => {
      const latestArchiveDate = currentCatalog?.lastArchiveDate;
      if (latestArchiveDate === undefined) return;
      const normalized = `${latestArchiveDate.slice(0, 4)}-${latestArchiveDate.slice(4, 6)}-${latestArchiveDate.slice(6, 8)}`;
      const next = `${normalized}T20:00`;
      if (next === taipeiDateTime) return;
      setTaipeiDateTime(next);
    },
    applyRequestedOrbitSettings,
    orbitSettingsDirty,
    parameters,
    setParameters: updateParameters,
    resetParameters,
    frameOptions,
    setFrameOptions: updateFrameOptions,
    resetFrameOptions,
    runReady,
    runProgress,
    timeResolution: publishedRun?.timeResolution ?? null,
    timeFallbackSearch,
    timelineDurationSec: TLE_RUN_DURATION_S,
    timelineCurrentTimeSec: runReady
      ? timelineSelection.currentTimeSec
      : (frame?.runAnchor?.elapsedSec ?? 0),
    timelineStepSec: TLE_RUN_STEP_S,
    selectTimelineTimeSec,
  };
}
