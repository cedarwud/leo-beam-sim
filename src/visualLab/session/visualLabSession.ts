import { useEffect, useRef, useSyncExternalStore } from 'react';

import {
  DEFAULT_VISUAL_LAB_PRESENTATION_STATE,
  type AcceptedCanonicalBeamIdentityTrace,
  type VisualLabExperience,
  type VisualLabLocale,
  type VisualLabPresentationState,
  type VisualLabTheme,
} from '../../prototype/visual-lab-g0/presentation/visualLabPresentationContract';
import type { BeamScheduleTrace } from '../beamRuntime/beamScheduleTrace';
import {
  adaptSimulationAnalysisFrameToVisualLabCanonicalSnapshot,
  type VisualLabCanonicalSnapshot,
} from '../../prototype/visual-lab-g0/visualLabCanonicalSnapshotAdapter';
import {
  adaptTleAnalysisRunToVisualLabTimeline,
  type VisualLabCanonicalTimeline,
} from '../../prototype/visual-lab-g0/visualLabCanonicalTimelineAdapter';
import {
  adaptSimulationAnalysisFrameToVisualLabGlobalScene,
  type VisualLabGlobalSceneFrame,
} from '../../prototype/visual-lab-g0/visualLabGlobalSceneAdapter';
import {
  adaptSimulationAnalysisFrameToVisualLabLocalScene,
  type VisualLabLocalScenePlan,
} from '../../prototype/visual-lab-g0/visualLabLocalSceneAdapter';
import {
  HOMEPAGE_DEFAULT_CONSTELLATION,
  useHomepageCanonicalAnalysis,
  type HomepageCanonicalAnalysisState,
} from '../../ui/signal-tuning/useHomepageCanonicalAnalysis';
import type { SimulationAnalysisFrameBuildOptions } from '../../simulator/analysis';
import {
  DEFAULT_BEAM_LAYOUT_COUNT,
  assertSupportedBeamLayoutCount,
  type SupportedBeamLayoutCount,
} from '../../core/beam/completeHexPresets';
import {
  normalizePerSatelliteBeamLayoutCount,
  type PerSatelliteBeamLayoutCount,
} from '../../simulator/beamLayoutOverrides';
import {
  DEFAULT_SIMULATOR_BEAM_ILLUMINATION_MODE,
  assertSimulatorBeamIlluminationMode,
  type SimulatorBeamIlluminationMode,
} from '../../simulator/beamIlluminationScenario';
import {
  VISUAL_LAB_INPUT_DEFINITIONS,
  VISUAL_LAB_INPUT_KEYS,
  type VisualLabInputKey,
} from '../experiment';
import {
  DEFAULT_SIMULATOR_PARAMETERS,
  type SimulatorConstellation,
  type SimulatorParameters,
} from '../../simulator/types';
import {
  buildComparisonView,
  captureComparisonEvidence,
  type ComparisonEvidence,
  type ComparisonView,
} from '../comparison/visualLabComparison';

export type { ComparisonEvidence, ComparisonView } from '../comparison/visualLabComparison';

/**
 * The only route-facing runtime surface for the visual lab.
 *
 * The implementation deliberately keeps the canonical hook state and its raw
 * frame/run values behind this interface.  Consumers receive an immutable
 * read model and semantic commands, never a producer object to combine with a
 * projection from another frame.
 */
export interface VisualLabSession {
  snapshot(): LabSnapshot;
  subscribe(listener: (snapshot: LabSnapshot) => void): () => void;
  dispatch(command: LabCommand): Promise<DispatchResult>;
}

export type LabPhase = 'idle' | 'cache-ready' | 'rebuilding' | 'ready' | 'rejected';

export type VisualLabView = 'earth' | 'sky' | 'service';
export type VisualLabDensity = 'clean' | 'context' | 'full';
export type VisualLabFocus = 'geometry' | 'handover' | 'energy' | 'none';

export type CanonicalParameterKey = VisualLabInputKey;

/** The Visual Lab owns exactly the finite 17-input experiment schema. */
export const VISUAL_LAB_CANONICAL_PARAMETER_KEYS = VISUAL_LAB_INPUT_KEYS;

const VISUAL_LAB_PARAMETER_DEFINITION_BY_KEY = new Map(
  VISUAL_LAB_INPUT_DEFINITIONS.map(definition => [definition.key, definition] as const),
);

export type VisualLabFrameOptions = {
  readonly beamLayoutCount?: SupportedBeamLayoutCount;
  readonly perSatelliteBeamLayoutCount?: PerSatelliteBeamLayoutCount;
  readonly beamIlluminationMode?: SimulatorBeamIlluminationMode;
  readonly userPositionOverridesKm?: readonly {
    readonly userIndex: number;
    readonly positionKm: readonly [number, number];
  }[];
  readonly representativeUserIndex?: number;
};

export interface SourceDraftCommandValue {
  readonly constellation?: SimulatorConstellation;
  readonly taipeiDateTime?: string;
  /** Alias accepted at the semantic boundary for callers using dateTime terminology. */
  readonly dateTime?: string;
}

type SourceDraftCommand =
  | { readonly type: 'setSourceDraft'; readonly draft: SourceDraftCommandValue }
  | { readonly type: 'editSourceDraft'; readonly draft: SourceDraftCommandValue }
  | { readonly type: 'sourceDraft'; readonly draft: SourceDraftCommandValue }
  | ({ readonly type: 'setSourceDraft' } & SourceDraftCommandValue)
  | ({ readonly type: 'editSourceDraft' } & SourceDraftCommandValue)
  | ({ readonly type: 'sourceDraft' } & SourceDraftCommandValue);

type ApplySourceCommand =
  | { readonly type: 'applySource' }
  | { readonly type: 'applySourceDraft' }
  | { readonly type: 'applyRequestedSourceSettings' };

type ParameterEditCommand =
  | { readonly type: 'editCanonicalParameter'; readonly key: CanonicalParameterKey; readonly value: number }
  | { readonly type: 'editCanonicalParameter'; readonly parameter: CanonicalParameterKey; readonly value: number }
  | { readonly type: 'setCanonicalParameter'; readonly key: CanonicalParameterKey; readonly value: number }
  | { readonly type: 'setCanonicalParameter'; readonly parameter: CanonicalParameterKey; readonly value: number }
  | { readonly type: 'editParameter'; readonly key: CanonicalParameterKey; readonly value: number }
  | { readonly type: 'editParameter'; readonly parameter: CanonicalParameterKey; readonly value: number };

type ParameterResetCommand =
  | { readonly type: 'resetCanonicalParameters' }
  | { readonly type: 'resetCanonicalParameter' };

type SeekCommand =
  | { readonly type: 'seek'; readonly timeSec: number }
  | { readonly type: 'seek'; readonly targetSec: number }
  | { readonly type: 'seekTimeline'; readonly timeSec: number }
  | { readonly type: 'seekTimeline'; readonly targetSec: number };

type FrameOptionsApplyCommand =
  | { readonly type: 'applyRepresentativeUeFrameOptions'; readonly frameOptions: VisualLabFrameOptions }
  | { readonly type: 'applyRepresentativeUeFrameOptions'; readonly options: VisualLabFrameOptions }
  | { readonly type: 'applyFrameOptions'; readonly frameOptions: VisualLabFrameOptions }
  | { readonly type: 'applyFrameOptions'; readonly options: VisualLabFrameOptions };

type FrameOptionsResetCommand =
  | { readonly type: 'resetRepresentativeUeFrameOptions' }
  | { readonly type: 'resetFrameOptions' };

type BeamLayoutCommand =
  | { readonly type: 'setBeamLayoutCount'; readonly beamCount: SupportedBeamLayoutCount }
  | { readonly type: 'setPerSatelliteBeamLayout'; readonly satelliteId: string; readonly beamCount: SupportedBeamLayoutCount }
  | { readonly type: 'removePerSatelliteBeamLayout'; readonly satelliteId: string };

type BeamIlluminationCommand =
  | { readonly type: 'setBeamIlluminationMode'; readonly mode: SimulatorBeamIlluminationMode };

/**
 * Finite semantic commands.  Aliases are retained for the migration period;
 * each alias still resolves to one owner and one state transition.
 */
export type LabCommand =
  | SourceDraftCommand
  | ApplySourceCommand
  | ParameterEditCommand
  | ParameterResetCommand
  | SeekCommand
  | FrameOptionsApplyCommand
  | FrameOptionsResetCommand
  | BeamLayoutCommand
  | BeamIlluminationCommand
  | { readonly type: 'setView'; readonly view: VisualLabView }
  | { readonly type: 'setPresentationView'; readonly view: VisualLabView }
  | { readonly type: 'setDensity'; readonly density: VisualLabDensity }
  | { readonly type: 'setPresentationDensity'; readonly density: VisualLabDensity }
  | { readonly type: 'setFocus'; readonly focus: VisualLabFocus }
  | { readonly type: 'setPresentationFocus'; readonly focus: VisualLabFocus }
  | { readonly type: 'setTheme'; readonly theme: VisualLabTheme }
  | { readonly type: 'setPresentationTheme'; readonly theme: VisualLabTheme }
  | { readonly type: 'setLocale'; readonly locale: VisualLabLocale }
  | { readonly type: 'setPresentationLocale'; readonly locale: VisualLabLocale }
  | { readonly type: 'setExperience'; readonly experience: VisualLabExperience }
  | { readonly type: 'setPresentationExperience'; readonly experience: VisualLabExperience }
  | { readonly type: 'setPresentation'; readonly presentation: Partial<PresentationView> }
  | { readonly type: 'saveBaseline' }
  | { readonly type: 'saveComparisonBaseline' }
  | { readonly type: 'clearBaseline' }
  | { readonly type: 'clearComparison' }
  | { readonly type: 'resetEvaluation' }
  | { readonly type: 'evaluationReset' };

export type LabErrorCode =
  | 'SOURCE_UNAVAILABLE'
  | 'SOURCE_REJECTED'
  | 'CANONICAL_UNAVAILABLE'
  | 'CANONICAL_REJECTED'
  | 'TIMELINE_UNAVAILABLE'
  | 'PROJECTION_FAILURE'
  | 'COMMAND_UNAVAILABLE'
  | 'COMMAND_REJECTED';

export interface LabError {
  readonly code: LabErrorCode;
  readonly message: string;
  readonly command: LabCommand['type'] | null;
}

export type DispatchStatus = 'accepted' | 'rejected' | 'unavailable';

export interface DispatchResult {
  readonly status: DispatchStatus;
  readonly accepted: boolean;
  readonly snapshot: LabSnapshot;
  readonly error: LabError | null;
}

export interface AcceptedEvidenceIdentity {
  readonly frameId: string;
  readonly tleFrameId: string;
  readonly runId: string | null;
  readonly analysisRunId: string | null;
  readonly geometryRunId: string | null;
  readonly instantUtc: string;
  readonly instantTaipei: string;
  readonly tleEpochUtc: string;
  readonly constellation: SimulatorConstellation;
  readonly archiveId: string;
  readonly archiveDate: string;
  readonly selectedSatelliteId: string | null;
  readonly candidateSatelliteId: string | null;
  readonly selectedTlePath: string;
  readonly sourceKind: 'ARCHIVED_TLE';
  readonly propagationModel: 'SGP4';
  readonly contractVersion: string;
}

export interface AcceptedEvidenceView {
  readonly identity: AcceptedEvidenceIdentity;
  /** Flat aliases make the identity easy to inspect without a second schema. */
  readonly frameId: string;
  readonly tleFrameId: string;
  readonly runId: string | null;
  readonly analysisRunId: string | null;
  readonly geometryRunId: string | null;
  readonly instantUtc: string;
  /** Exact inputs that produced this accepted frame; never the pending draft. */
  readonly parameters?: CanonicalParameterDraft;
  /** Present on runtime publications; optional for legacy export fixtures. */
  readonly frameOptions?: FrameOptionsDraftView;
  readonly canonical: VisualLabCanonicalSnapshot;
  readonly timeline: VisualLabCanonicalTimeline | null;
  readonly global: VisualLabGlobalSceneFrame | null;
  readonly local: VisualLabLocalScenePlan | null;
  readonly beamScheduleTrace: BeamScheduleTrace | null;
  readonly intraHandoverEvidence: AcceptedCanonicalBeamIdentityTrace | null;
  readonly runReady: boolean;
}

export interface SourceDraftView {
  readonly constellation: SimulatorConstellation;
  readonly taipeiDateTime: string;
  readonly dirty: boolean;
  readonly appliedConstellation: SimulatorConstellation | null;
  readonly appliedInstantUtc: string | null;
}

export type CanonicalParameterDraft = Readonly<Pick<SimulatorParameters, CanonicalParameterKey>>;

export interface FrameOptionsDraftView {
  readonly beamLayoutCount: SupportedBeamLayoutCount;
  readonly perSatelliteBeamLayoutCount: PerSatelliteBeamLayoutCount;
  readonly beamIlluminationMode: SimulatorBeamIlluminationMode;
  readonly userPositionOverridesKm: readonly {
    readonly userIndex: number;
    readonly positionKm: readonly [number, number];
  }[];
  readonly representativeUserIndex: number | null;
}

export interface ExperimentDraftView {
  readonly source: SourceDraftView;
  readonly parameters: CanonicalParameterDraft;
  readonly frameOptions: FrameOptionsDraftView;
}

export interface PresentationView extends VisualLabPresentationState {
  readonly view: VisualLabView;
  readonly density: VisualLabDensity;
  readonly focus: VisualLabFocus;
}

interface AvailabilityView {
  readonly availability: 'available' | 'unavailable';
  readonly reason: string | null;
}

export interface ResultLinkView extends AvailabilityView {
  readonly satelliteId: string | null;
  readonly beamId: number | null;
  readonly userId: string | null;
  readonly sinrLinear: number | null;
  readonly sinrDb: number | null;
  readonly requestedPowerW: number | null;
  readonly actualPowerW: number | null;
  readonly throughputBps: number | null;
  readonly instantaneousEeBitsPerJ: number | null;
  readonly distanceKm: number | null;
  readonly elevationDeg: number | null;
}

export interface ResultProjectionView {
  readonly identity: AcceptedEvidenceIdentity | null;
  readonly availability: 'available' | 'unavailable';
  readonly reason: string | null;
  readonly serving: ResultLinkView;
  readonly candidate: ResultLinkView;
  readonly handover: VisualLabCanonicalSnapshot['handover'];
  readonly sinr: {
    readonly servingDb: number | null;
    readonly candidateDb: number | null;
    readonly deltaDb: number | null;
  };
  readonly power: {
    readonly servingActualPowerW: number | null;
    readonly candidateActualPowerW: number | null;
    readonly systemPowerW: number | null;
  };
  readonly throughput: {
    readonly servingRateBps: number | null;
    readonly candidateRateBps: number | null;
    readonly totalRateBps: number | null;
  };
  readonly ee: {
    readonly instantaneousBitsPerJ: number | null;
    readonly cumulativeBitsPerJ: number | null;
  };
}

export interface EnergyStoryView {
  readonly identity: AcceptedEvidenceIdentity | null;
  readonly availability: 'available' | 'unavailable';
  readonly reason: string | null;
  readonly evaluation: VisualLabCanonicalSnapshot['evaluation'];
  readonly instantaneousBitsPerJ: number | null;
  readonly cumulativeBitsPerJ: number | null;
  readonly timeline: VisualLabCanonicalTimeline | null;
  readonly powerBoundary: {
    readonly servingActualPowerW: number | null;
    readonly systemPowerW: number | null;
    readonly beamActualPowerW: readonly number[];
    readonly paPowerW: readonly number[];
    readonly rfcPowerW: readonly number[];
    readonly basebandPowerW: readonly number[];
    readonly eventPowerW: readonly number[];
  } | null;
}

export interface ScenePlan {
  readonly schemaVersion: 'visual-lab-scene-plan-v1';
  readonly identity: AcceptedEvidenceIdentity | null;
  readonly view: VisualLabView;
  readonly density: VisualLabDensity;
  readonly focus: VisualLabFocus;
  readonly global: VisualLabGlobalSceneFrame | null;
  readonly local: VisualLabLocalScenePlan | null;
  readonly availability: 'available' | 'unavailable';
  readonly reason: string | null;
}

export interface CaptureView extends AvailabilityView {
  readonly locked: boolean;
  readonly identity: AcceptedEvidenceIdentity | null;
}

export interface ComputationProgressView {
  readonly status: 'idle' | 'running' | 'complete';
  readonly completedAnchors: number;
  readonly totalAnchors: number;
  readonly fraction: number;
}

export interface LabSnapshot {
  readonly phase: LabPhase;
  readonly accepted: AcceptedEvidenceView | null;
  readonly draft: ExperimentDraftView;
  readonly presentation: PresentationView;
  readonly scenePlan: ScenePlan | null;
  readonly results: ResultProjectionView;
  readonly energy: EnergyStoryView;
  readonly comparison: ComparisonView;
  readonly capture: CaptureView;
  readonly computation: ComputationProgressView;
  readonly error: LabError | null;
  /** Convenience projections; these are references into the same accepted read model. */
  readonly canonical: VisualLabCanonicalSnapshot | null;
  readonly timeline: VisualLabCanonicalTimeline | null;
  readonly globalScene: VisualLabGlobalSceneFrame | null;
  readonly localScene: VisualLabLocalScenePlan | null;
}

export interface VisualLabSessionFactoryOptions {
  readonly initialPresentation?: Partial<PresentationView>;
  /**
   * Internal test/adapter injection.  It is intentionally opaque at the
   * public boundary; only the hook binding below is allowed to interpret the
   * homepage canonical state.
   */
  readonly analysis?: unknown;
  readonly analysisProvider?: () => unknown;
}

interface CanonicalAnalysisState extends HomepageCanonicalAnalysisState {}

interface ControllerInput {
  readonly analysis: CanonicalAnalysisState | null;
  readonly presentation: PresentationView;
}

const EMPTY_EVALUATION: VisualLabCanonicalSnapshot['evaluation'] = Object.freeze({
  availability: 'unavailable',
  source: 'unavailable',
  deliveredBits: null,
  consumedEnergyJ: null,
  energyEfficiencyBitsPerJ: null,
  durationSec: null,
});

const EMPTY_RESULT_LINK: ResultLinkView = Object.freeze({
  availability: 'unavailable',
  satelliteId: null,
  beamId: null,
  userId: null,
  sinrLinear: null,
  sinrDb: null,
  requestedPowerW: null,
  actualPowerW: null,
  throughputBps: null,
  instantaneousEeBitsPerJ: null,
  distanceKm: null,
  elevationDeg: null,
  reason: 'no accepted canonical frame is available',
});

const EMPTY_PRESENTATION: PresentationView = Object.freeze({
  ...DEFAULT_VISUAL_LAB_PRESENTATION_STATE,
  view: 'earth',
  density: 'context',
  focus: 'none',
});

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asAnalysisState(value: unknown): CanonicalAnalysisState | null {
  if (value === null || typeof value !== 'object') return null;
  const candidate = value as Partial<CanonicalAnalysisState>;
  if (
    typeof candidate.status !== 'string'
    || typeof candidate.requestedConstellation !== 'string'
    || typeof candidate.taipeiDateTime !== 'string'
    || typeof candidate.resetEvaluation !== 'function'
    || typeof candidate.setParameters !== 'function'
    || typeof candidate.resetParameters !== 'function'
    || typeof candidate.setFrameOptions !== 'function'
    || typeof candidate.resetFrameOptions !== 'function'
    || typeof candidate.selectTimelineTimeSec !== 'function'
  ) return null;
  return candidate as CanonicalAnalysisState;
}

function parameterView(parameters: SimulatorParameters): CanonicalParameterDraft {
  const result = {} as Record<CanonicalParameterKey, number>;
  for (const key of VISUAL_LAB_CANONICAL_PARAMETER_KEYS) {
    result[key] = parameters[key];
  }
  return Object.freeze(result);
}

function frameOptionsView(options: Readonly<SimulationAnalysisFrameBuildOptions> | undefined): FrameOptionsDraftView {
  const overrides = (options?.userPositionOverridesKm ?? []).map(override => Object.freeze({
    userIndex: override.userIndex,
    positionKm: Object.freeze([override.positionKm[0], override.positionKm[1]] as [number, number]),
  }));
  return Object.freeze({
    beamLayoutCount: options?.beamLayoutCount ?? DEFAULT_BEAM_LAYOUT_COUNT,
    perSatelliteBeamLayoutCount: normalizePerSatelliteBeamLayoutCount(options?.perSatelliteBeamLayoutCount),
    beamIlluminationMode: options?.beamIlluminationMode ?? DEFAULT_SIMULATOR_BEAM_ILLUMINATION_MODE,
    userPositionOverridesKm: Object.freeze(overrides),
    representativeUserIndex: options?.representativeUserIndex ?? null,
  });
}

function computationProgressView(analysis: CanonicalAnalysisState | null): ComputationProgressView {
  if (analysis?.runReady === true) {
    const total = Math.max(1, analysis.runProgress?.totalAnchors ?? 241);
    return Object.freeze({ status: 'complete', completedAnchors: total, totalAnchors: total, fraction: 1 });
  }
  const progress = analysis?.runProgress;
  if (progress === null || progress === undefined) {
    return Object.freeze({ status: 'idle', completedAnchors: 0, totalAnchors: 0, fraction: 0 });
  }
  const totalAnchors = Number.isFinite(progress.totalAnchors) ? Math.max(0, progress.totalAnchors) : 0;
  const completedAnchors = Number.isFinite(progress.completedAnchors)
    ? Math.min(totalAnchors, Math.max(0, progress.completedAnchors))
    : 0;
  const fraction = Number.isFinite(progress.fraction)
    ? Math.min(1, Math.max(0, progress.fraction))
    : totalAnchors > 0 ? completedAnchors / totalAnchors : 0;
  return Object.freeze({ status: 'running', completedAnchors, totalAnchors, fraction });
}

function parametersEqual(
  left: CanonicalParameterDraft,
  right: CanonicalParameterDraft,
): boolean {
  return VISUAL_LAB_CANONICAL_PARAMETER_KEYS.every(key => left[key] === right[key]);
}

function frameOptionsEqual(left: FrameOptionsDraftView, right: FrameOptionsDraftView): boolean {
  if (left.beamLayoutCount !== right.beamLayoutCount) return false;
  if (left.beamIlluminationMode !== right.beamIlluminationMode) return false;
  if (JSON.stringify(left.perSatelliteBeamLayoutCount) !== JSON.stringify(right.perSatelliteBeamLayoutCount)) return false;
  if (left.representativeUserIndex !== right.representativeUserIndex) return false;
  if (left.userPositionOverridesKm.length !== right.userPositionOverridesKm.length) return false;
  return left.userPositionOverridesKm.every((override, index) => {
    const candidate = right.userPositionOverridesKm[index];
    return candidate !== undefined
      && candidate.userIndex === override.userIndex
      && candidate.positionKm[0] === override.positionKm[0]
      && candidate.positionKm[1] === override.positionKm[1];
  });
}

function sourceDraftView(analysis: CanonicalAnalysisState | null): SourceDraftView {
  const frame = analysis?.frame ?? null;
  return Object.freeze({
    constellation: analysis?.requestedConstellation ?? HOMEPAGE_DEFAULT_CONSTELLATION,
    taipeiDateTime: analysis?.taipeiDateTime ?? '',
    dirty: analysis?.orbitSettingsDirty ?? false,
    appliedConstellation: frame?.provenance.constellation ?? null,
    appliedInstantUtc: frame?.tleState.requestedInstantUtc ?? null,
  });
}

function applySourceDraftOverride(
  source: SourceDraftView,
  override: { readonly constellation: SimulatorConstellation; readonly taipeiDateTime: string } | null,
): SourceDraftView {
  if (override === null) return source;
  return Object.freeze({
    ...source,
    constellation: override.constellation,
    taipeiDateTime: override.taipeiDateTime,
    dirty: override.constellation !== source.appliedConstellation
      || override.taipeiDateTime !== source.taipeiDateTime,
  });
}

function emptyDraft(analysis: CanonicalAnalysisState | null): ExperimentDraftView {
  return Object.freeze({
    source: sourceDraftView(analysis),
    parameters: parameterView(analysis?.parameters ?? DEFAULT_SIMULATOR_PARAMETERS),
    frameOptions: frameOptionsView(analysis?.frameOptions),
  });
}

function identityForFrame(
  frame: NonNullable<CanonicalAnalysisState['frame']>,
  run: NonNullable<CanonicalAnalysisState['acceptedRun']> | null,
  canonical: VisualLabCanonicalSnapshot,
): AcceptedEvidenceIdentity {
  const identity = Object.freeze({
    frameId: frame.frameId,
    tleFrameId: frame.tleFrameId,
    runId: run?.runId ?? frame.runAnchor?.runId ?? null,
    analysisRunId: run?.analysisRunId ?? frame.runAnchor?.runId ?? null,
    geometryRunId: run?.geometryRunId ?? frame.runAnchor?.geometryRunId ?? null,
    instantUtc: frame.instantUtc,
    instantTaipei: frame.instantTaipei,
    tleEpochUtc: frame.tleEpochUtc,
    constellation: frame.provenance.constellation,
    archiveId: frame.provenance.archiveId,
    archiveDate: frame.provenance.archiveDate,
    selectedSatelliteId: canonical.source.selectedSatelliteId,
    candidateSatelliteId: canonical.handover.candidateSatelliteId ?? canonical.candidate.satelliteId,
    selectedTlePath: frame.provenance.selectedTlePath,
    sourceKind: frame.provenance.sourceKind,
    propagationModel: frame.provenance.propagationModel,
    contractVersion: frame.contractVersion,
  });
  return identity;
}

function acceptedIntraHandoverEvidence(
  run: NonNullable<CanonicalAnalysisState['acceptedRun']> | null,
): AcceptedCanonicalBeamIdentityTrace | null {
  const trace = run?.beamScheduleTrace ?? null;
  if (run === null || trace === null || trace.analysisRunId !== run.analysisRunId || trace.geometryRunId !== run.geometryRunId) {
    return null;
  }
  for (const transition of trace.transitionEvidence) {
    if (
      transition.kind !== 'same-satellite-beam-switch'
      || transition.servicePairChanged !== true
      || transition.from === null
      || transition.to === null
      || transition.from.satelliteId !== transition.to.satelliteId
      || transition.from.beamId === transition.to.beamId
      || typeof transition.userId !== 'string'
    ) continue;
    const beforeAnchorIndex = transition.fromSlot.anchorIndex;
    const decisionAnchorIndex = transition.toSlot.anchorIndex;
    const afterAnchorIndex = decisionAnchorIndex + 1;
    if (decisionAnchorIndex !== beforeAnchorIndex + 1 || afterAnchorIndex >= run.anchorCount) continue;
    const afterSlot = trace.slots[afterAnchorIndex];
    const afterAssociation = afterSlot?.associations.find(item => item.userId === transition.userId);
    if (
      afterAssociation?.satelliteId !== transition.to.satelliteId
      || afterAssociation.beamId !== transition.to.beamId
    ) continue;
    const beforeFrame = run.getFrame(beforeAnchorIndex);
    const decisionFrame = run.getFrame(decisionAnchorIndex);
    const afterFrame = run.getFrame(afterAnchorIndex);
    if (beforeFrame === null || decisionFrame === null || afterFrame === null) continue;
    const userIndex = decisionFrame.scenario.users.find(user => user.userId === transition.userId)?.index;
    if (userIndex === undefined) continue;
    if (
      beforeFrame.selectedSatelliteId !== transition.from.satelliteId
      || decisionFrame.selectedSatelliteId !== transition.to.satelliteId
      || afterFrame.selectedSatelliteId !== transition.to.satelliteId
      || beforeFrame.inputs.frame.servingBeamU[userIndex] !== transition.from.beamId
      || decisionFrame.inputs.frame.servingBeamU[userIndex] !== transition.to.beamId
      || afterFrame.inputs.frame.servingBeamU[userIndex] !== transition.to.beamId
    ) continue;
    return deepFreeze({
      adapter: 'accepted-canonical-beam-identity-trace-v1',
      sourceKind: 'real-tle-canonical',
      traceId: `${trace.traceDigest}:${transition.userId}:${beforeAnchorIndex}-${decisionAnchorIndex}`,
      analysisRunId: run.analysisRunId,
      geometryRunId: run.geometryRunId,
      frameId: decisionFrame.frameId,
      instantUtc: decisionFrame.instantUtc,
      traceDigest: trace.traceDigest,
      beforeAnchorIndex,
      decisionAnchorIndex,
      afterAnchorIndex,
      beforeFrameId: beforeFrame.frameId,
      decisionFrameId: decisionFrame.frameId,
      afterFrameId: afterFrame.frameId,
      beforeInstantUtc: beforeFrame.instantUtc,
      decisionInstantUtc: decisionFrame.instantUtc,
      afterInstantUtc: afterFrame.instantUtc,
      from: {
        satelliteId: transition.from.satelliteId,
        beamId: transition.from.beamId,
        userIndex,
        userId: transition.userId,
      },
      to: {
        satelliteId: transition.to.satelliteId,
        beamId: transition.to.beamId,
        userIndex,
        userId: transition.userId,
      },
    } satisfies AcceptedCanonicalBeamIdentityTrace);
  }
  return null;
}

function unavailableCanonicalSnapshot(message: string): VisualLabCanonicalSnapshot | null {
  // A canonical frame is the root of all quantitative projections.  Returning
  // null rather than manufacturing zero values makes a projection failure
  // explicit to every surface.
  void message;
  return null;
}

function linkView(link: VisualLabCanonicalSnapshot['serving']): ResultLinkView {
  return Object.freeze({
    availability: link.availability,
    satelliteId: link.satelliteId,
    beamId: link.beamId,
    userId: link.userId,
    sinrLinear: link.sinrLinear,
    sinrDb: link.sinrDb,
    requestedPowerW: link.requestedPowerW,
    actualPowerW: link.actualPowerW,
    throughputBps: link.throughputBps,
    instantaneousEeBitsPerJ: link.instantaneousEeBitsPerJ,
    distanceKm: link.distanceKm,
    elevationDeg: link.elevationDeg,
    reason: link.reason,
  });
}

function emptyResults(reason: string): ResultProjectionView {
  return Object.freeze({
    identity: null,
    availability: 'unavailable',
    reason,
    serving: EMPTY_RESULT_LINK,
    candidate: EMPTY_RESULT_LINK,
    handover: Object.freeze({
      availability: 'unavailable',
      state: null,
      event: null,
      offsetDb: null,
      tttSec: null,
      progressSec: null,
      ratio: null,
      cumulativeCount: null,
      reason,
      servingSatelliteId: null,
      candidateSatelliteId: null,
      deltaDb: null,
      eventFromSatelliteId: null,
      eventToSatelliteId: null,
    }),
    sinr: Object.freeze({ servingDb: null, candidateDb: null, deltaDb: null }),
    power: Object.freeze({ servingActualPowerW: null, candidateActualPowerW: null, systemPowerW: null }),
    throughput: Object.freeze({ servingRateBps: null, candidateRateBps: null, totalRateBps: null }),
    ee: Object.freeze({ instantaneousBitsPerJ: null, cumulativeBitsPerJ: null }),
  });
}

function emptyEnergy(reason: string): EnergyStoryView {
  return Object.freeze({
    identity: null,
    availability: 'unavailable',
    reason,
    evaluation: EMPTY_EVALUATION,
    instantaneousBitsPerJ: null,
    cumulativeBitsPerJ: null,
    timeline: null,
    powerBoundary: null,
  });
}

function errorView(
  code: LabErrorCode,
  message: string,
  command: LabCommand['type'] | null = null,
): LabError {
  return Object.freeze({ code, message, command });
}

function validateFrameOptions(options: VisualLabFrameOptions): string | null {
  if (options === null || typeof options !== 'object') return 'representative UE frame options must be an object';
  if (options.beamLayoutCount !== undefined) {
    try {
      assertSupportedBeamLayoutCount(options.beamLayoutCount);
    } catch {
      return 'beamLayoutCount must be one of 1, 7, or 19';
    }
  }
  try {
    normalizePerSatelliteBeamLayoutCount(options.perSatelliteBeamLayoutCount);
  } catch (error) {
    return readableError(error);
  }
  if (options.beamIlluminationMode !== undefined) {
    try {
      assertSimulatorBeamIlluminationMode(options.beamIlluminationMode);
    } catch (error) {
      return readableError(error);
    }
  }
  const overrides = options.userPositionOverridesKm ?? [];
  if (!Array.isArray(overrides)) return 'representative UE frame options must contain an override list';
  if (overrides.length > 1) return 'only one bounded representative UE override is allowed';
  if (options.representativeUserIndex !== undefined && !Number.isInteger(options.representativeUserIndex)) {
    return 'representativeUserIndex must be an integer';
  }
  for (const override of overrides) {
    if (!Number.isInteger(override.userIndex) || override.userIndex < 0) {
      return 'representative UE userIndex must be a non-negative integer';
    }
    if (
      !Array.isArray(override.positionKm)
      || override.positionKm.length !== 2
      || !Number.isFinite(override.positionKm[0])
      || !Number.isFinite(override.positionKm[1])
    ) return 'representative UE position must contain two finite coordinates';
    if (
      options.representativeUserIndex !== undefined
      && options.representativeUserIndex !== override.userIndex
    ) return 'representativeUserIndex must match the bounded UE override';
  }
  return null;
}

function normalizeFrameOptions(options: VisualLabFrameOptions): SimulationAnalysisFrameBuildOptions {
  const overrides = (options.userPositionOverridesKm ?? []).map(override => ({
    userIndex: override.userIndex,
    positionKm: [override.positionKm[0], override.positionKm[1]] as [number, number],
  }));
  const perSatelliteBeamLayoutCount = normalizePerSatelliteBeamLayoutCount(options.perSatelliteBeamLayoutCount);
  const beamIlluminationMode = options.beamIlluminationMode === undefined
    ? DEFAULT_SIMULATOR_BEAM_ILLUMINATION_MODE
    : assertSimulatorBeamIlluminationMode(options.beamIlluminationMode);
  return {
    ...(options.beamLayoutCount === undefined
      ? {}
      : { beamLayoutCount: assertSupportedBeamLayoutCount(options.beamLayoutCount) }),
    ...(Object.keys(perSatelliteBeamLayoutCount).length === 0
      ? {}
      : { perSatelliteBeamLayoutCount }),
    beamIlluminationMode,
    userPositionOverridesKm: overrides,
    ...(options.representativeUserIndex === undefined
      ? {}
      : { representativeUserIndex: options.representativeUserIndex }),
  };
}

function sourceDraftCommandValue(command: SourceDraftCommand): SourceDraftCommandValue {
  if ('draft' in command) return command.draft;
  return command;
}

function makePresentation(input: Partial<PresentationView> | undefined): PresentationView {
  return Object.freeze({
    theme: input?.theme ?? EMPTY_PRESENTATION.theme,
    locale: input?.locale ?? EMPTY_PRESENTATION.locale,
    experience: input?.experience ?? EMPTY_PRESENTATION.experience,
    view: input?.view ?? EMPTY_PRESENTATION.view,
    density: input?.density ?? EMPTY_PRESENTATION.density,
    focus: input?.focus ?? EMPTY_PRESENTATION.focus,
  });
}

class VisualLabSessionController {
  private readonly listeners = new Set<(snapshot: LabSnapshot) => void>();
  private readonly analysisProvider: (() => unknown) | null;
  private analysis: CanonicalAnalysisState | null;
  private presentation: PresentationView;
  private value: LabSnapshot;
  private previousFrame: CanonicalAnalysisState['frame'] = null;
  private previousRun: CanonicalAnalysisState['acceptedRun'] = null;
  private previousEvaluation: CanonicalAnalysisState['evaluation'] | null = null;
  private previousNextFrame: CanonicalAnalysisState['visualNextFrame'] = null;
  private previousTimelineTimeSec: number | null = null;
  private previousStatus: CanonicalAnalysisState['status'] | null = null;
  private previousError: string | null = null;
  private previousRequestedConstellation: SimulatorConstellation | null = null;
  private previousTaipeiDateTime: string | null = null;
  private previousParameters: CanonicalAnalysisState['parameters'] | null = null;
  private previousFrameOptions: CanonicalAnalysisState['frameOptions'] | null = null;
  private previousOrbitSettingsDirty: boolean | null = null;
  private previousRunProgress: CanonicalAnalysisState['runProgress'] = null;
  private acceptedCache: AcceptedEvidenceView | null = null;
  private projectionError: LabError | null = null;
  private commandError: LabError | null = null;
  private pendingScientific = false;
  private analysisNotificationPending = false;
  private sourceDraftOverride: { readonly constellation: SimulatorConstellation; readonly taipeiDateTime: string } | null = null;
  private parameterDraftOverride: CanonicalParameterDraft | null = null;
  private frameOptionsDraftOverride: FrameOptionsDraftView | null = null;
  /** Frozen A slot; candidate B is always the latest accepted projection. */
  private baselineComparison: ComparisonEvidence | null = null;

  readonly publicSession: VisualLabSession;

  constructor(input: ControllerInput, analysisProvider: (() => unknown) | null) {
    this.analysis = input.analysis;
    this.presentation = input.presentation;
    this.analysisProvider = analysisProvider;
    this.value = this.projectSnapshot();
    this.publicSession = Object.freeze({
      snapshot: () => this.readSnapshot(),
      subscribe: (listener: (snapshot: LabSnapshot) => void) => this.subscribe(listener),
      dispatch: (command: LabCommand) => this.dispatch(command),
    });
  }

  private readExternalAnalysis(): void {
    if (this.analysisProvider === null) return;
    const next = asAnalysisState(this.analysisProvider());
    if (next !== null) this.syncAnalysis(next);
  }

  private readSnapshot(): LabSnapshot {
    this.readExternalAnalysis();
    return this.value;
  }

  private subscribe(listener: (snapshot: LabSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const current = this.value;
    for (const listener of this.listeners) {
      try {
        listener(current);
      } catch {
        // A subscriber cannot prevent the other consumers from receiving the
        // immutable publication.  React will surface its own render error.
      }
    }
  }

  private publish(next: LabSnapshot, notify = true): void {
    this.value = next;
    if (notify) this.notify();
  }

  private projectionInputChanged(analysis: CanonicalAnalysisState): boolean {
    const nextTime = analysis.timelineCurrentTimeSec;
    return analysis.frame !== this.previousFrame
      || analysis.acceptedRun !== this.previousRun
      || analysis.evaluation !== this.previousEvaluation
      || analysis.visualNextFrame !== this.previousNextFrame
      || nextTime !== this.previousTimelineTimeSec
      || analysis.status !== this.previousStatus
      || analysis.error !== this.previousError
      || analysis.requestedConstellation !== this.previousRequestedConstellation
      || analysis.taipeiDateTime !== this.previousTaipeiDateTime
      || analysis.parameters !== this.previousParameters
      || analysis.frameOptions !== this.previousFrameOptions
      || (analysis.orbitSettingsDirty ?? null) !== this.previousOrbitSettingsDirty
      || analysis.runProgress !== this.previousRunProgress;
  }

  /** Called by the React binding; deliberately not on the public facade. */
  syncAnalysis(analysis: HomepageCanonicalAnalysisState): void {
    const next = asAnalysisState(analysis);
    if (next === null) return;
    const changed = this.projectionInputChanged(next);
    this.analysis = next;
    if (!changed) return;
    const frameChanged = next.frame !== this.previousFrame || next.acceptedRun !== this.previousRun;
    if (frameChanged) this.pendingScientific = false;
    if (
      this.sourceDraftOverride !== null
      && this.sourceDraftOverride.constellation === next.requestedConstellation
      && this.sourceDraftOverride.taipeiDateTime === next.taipeiDateTime
    ) this.sourceDraftOverride = null;
    if (this.parameterDraftOverride !== null && parametersEqual(this.parameterDraftOverride, parameterView(next.parameters))) {
      this.parameterDraftOverride = null;
    }
    if (this.frameOptionsDraftOverride !== null && frameOptionsEqual(this.frameOptionsDraftOverride, frameOptionsView(next.frameOptions))) {
      this.frameOptionsDraftOverride = null;
    }
    this.commandError = null;
    this.publish(this.projectSnapshot(), false);
    this.analysisNotificationPending = true;
  }

  /** Flushes updates after React has committed a render. */
  flushAnalysisNotification(): void {
    if (!this.analysisNotificationPending) return;
    this.analysisNotificationPending = false;
    this.notify();
  }

  private projectAccepted(analysis: CanonicalAnalysisState): AcceptedEvidenceView | null {
    const frame = analysis.frame;
    if (frame === null) return this.acceptedCache;
    const run = analysis.acceptedRun ?? null;
    const timelineTime = analysis.timelineCurrentTimeSec;
    const sameProjection = frame === this.previousFrame
      && run === this.previousRun
      && analysis.evaluation === this.previousEvaluation
      && analysis.visualNextFrame === this.previousNextFrame
      && timelineTime === this.previousTimelineTimeSec
      // The local/NTPU view must not pay the global 5k–10k satellite
      // projection cost during every startup/timeline tick. If the user later
      // switches to Earth view, force one projection then; the checked-in
      // global first-frame artifact can render while that projection is built.
      && (this.presentation.view !== 'earth' || this.acceptedCache?.global !== null)
      && this.acceptedCache !== null;
    if (sameProjection) return this.acceptedCache;

    try {
      const canonical = adaptSimulationAnalysisFrameToVisualLabCanonicalSnapshot({
        frame,
        evaluation: analysis.evaluation,
      });
      const identity = identityForFrame(frame, run, canonical);
      const timeline = run === null ? null : adaptTleAnalysisRunToVisualLabTimeline(run);
      const offset = frame.runAnchor === undefined
        ? 0
        : Math.max(0, Math.min(
          analysis.timelineStepSec,
          timelineTime - frame.runAnchor.elapsedSec,
        ));
      const previousAccepted = this.acceptedCache;
      const canReuseGlobal = previousAccepted?.frameId === identity.frameId
        && previousAccepted.global !== null;
      const global = canReuseGlobal
        ? previousAccepted.global
        : this.presentation.view === 'earth'
          ? adaptSimulationAnalysisFrameToVisualLabGlobalScene(frame)
          : null;
      const local = adaptSimulationAnalysisFrameToVisualLabLocalScene(frame, {
        visualPreviousFrame: this.previousFrame,
        visualNextFrame: analysis.visualNextFrame,
        visualOffsetSec: offset,
      });
      const beamScheduleTrace = run?.beamScheduleTrace ?? null;
      const intraHandoverEvidence = acceptedIntraHandoverEvidence(run);
      const accepted = deepFreeze({
        identity,
        frameId: identity.frameId,
        tleFrameId: identity.tleFrameId,
        runId: identity.runId,
        analysisRunId: identity.analysisRunId,
        geometryRunId: identity.geometryRunId,
        instantUtc: identity.instantUtc,
        parameters: parameterView(frame.parameters),
        frameOptions: frameOptionsView(run?.frameOptions ?? analysis.frameOptions),
        canonical,
        timeline,
        global,
        local,
        beamScheduleTrace,
        intraHandoverEvidence,
        runReady: analysis.runReady,
      } satisfies AcceptedEvidenceView);
      this.acceptedCache = accepted;
      this.projectionError = null;
      return accepted;
    } catch (error) {
      this.projectionError = errorView('PROJECTION_FAILURE', readableError(error));
      // Keep the last accepted publication while a malformed or unsupported
      // candidate is refused.  Never replace missing values with zeros.
      return this.acceptedCache;
    }
  }

  private buildResults(accepted: AcceptedEvidenceView | null): ResultProjectionView {
    if (accepted === null) return emptyResults('no accepted canonical frame is available');
    const canonical = accepted.canonical;
    return deepFreeze({
      identity: accepted.identity,
      availability: 'available',
      reason: null,
      serving: linkView(canonical.serving),
      candidate: linkView(canonical.candidate),
      handover: canonical.handover,
      sinr: {
        servingDb: canonical.serving.sinrDb,
        candidateDb: canonical.candidate.sinrDb,
        deltaDb: canonical.deltaSinrDb,
      },
      power: {
        servingActualPowerW: canonical.power.servingActualPowerW,
        candidateActualPowerW: canonical.power.candidateActualPowerW,
        systemPowerW: canonical.power.systemPowerW,
      },
      throughput: {
        servingRateBps: canonical.throughput.servingRateBps,
        candidateRateBps: canonical.throughput.candidateRateBps,
        totalRateBps: canonical.throughput.totalRateBps,
      },
      ee: {
        instantaneousBitsPerJ: canonical.ee.instantaneousBitsPerJ,
        cumulativeBitsPerJ: canonical.ee.cumulativeBitsPerJ,
      },
    });
  }

  private buildEnergy(analysis: CanonicalAnalysisState | null, accepted: AcceptedEvidenceView | null): EnergyStoryView {
    if (
      accepted === null
      || analysis?.frame === null
      || analysis === null
      || analysis.frame.frameId !== accepted.identity.frameId
    ) {
      return emptyEnergy('no accepted canonical frame is available');
    }
    const canonical = accepted.canonical;
    const power = analysis.frame.power;
    return deepFreeze({
      identity: accepted.identity,
      availability: accepted.timeline === null ? 'unavailable' : 'available',
      reason: accepted.timeline === null ? 'complete accepted run is unavailable at this frame' : null,
      evaluation: canonical.evaluation,
      instantaneousBitsPerJ: canonical.ee.instantaneousBitsPerJ,
      cumulativeBitsPerJ: canonical.ee.cumulativeBitsPerJ,
      timeline: accepted.timeline,
      powerBoundary: {
        servingActualPowerW: canonical.power.servingActualPowerW,
        systemPowerW: canonical.power.systemPowerW,
        beamActualPowerW: Object.freeze([...power.pDlActualBW]),
        paPowerW: Object.freeze([...power.pPaBW]),
        rfcPowerW: Object.freeze([...power.pRfcBW]),
        basebandPowerW: Object.freeze([...power.pBbBW]),
        eventPowerW: Object.freeze([...power.pEventBW]),
      },
    });
  }

  private comparisonEvidence(
    analysis: CanonicalAnalysisState | null,
    accepted: AcceptedEvidenceView,
  ): ComparisonEvidence {
    const run = analysis?.acceptedRun ?? null;
    const runEvaluation = run !== null
      && run.analysisRunId === accepted.identity.analysisRunId
      && run.geometryRunId === accepted.identity.geometryRunId
      ? {
        deliveredBits: run.evaluation.deliveredBits,
        consumedEnergyJ: run.evaluation.consumedEnergyJ,
        energyEfficiencyBitsPerJ: run.evaluation.evaluationBitsPerJ,
        durationSec: run.evaluation.durationS,
      }
      : null;
    return captureComparisonEvidence({
      accepted,
      parameters: accepted.parameters ?? parameterView(analysis?.parameters ?? DEFAULT_SIMULATOR_PARAMETERS),
      frameOptions: accepted.frameOptions ?? frameOptionsView(analysis?.frameOptions),
      presentation: this.presentation,
      runEvaluation,
    });
  }

  private phaseFor(analysis: CanonicalAnalysisState | null, accepted: AcceptedEvidenceView | null): LabPhase {
    if (analysis === null) return accepted === null ? 'idle' : 'ready';
    if (analysis.error !== null && analysis.error !== undefined) return 'rejected';
    if (this.projectionError !== null) return 'rejected';
    if (this.pendingScientific) return 'rebuilding';
    if (analysis.frame === null) return analysis.status === 'loading' ? 'idle' : 'rejected';
    if (analysis.runReady) return 'ready';
    if (analysis.firstFrameSource !== null) return 'cache-ready';
    return 'rebuilding';
  }

  private projectSnapshot(): LabSnapshot {
    const analysis = this.analysis;
    const accepted = analysis === null ? this.acceptedCache : this.projectAccepted(analysis);
    const baseDraft = emptyDraft(analysis);
    const draft = deepFreeze({
      source: applySourceDraftOverride(baseDraft.source, this.sourceDraftOverride),
      parameters: this.parameterDraftOverride ?? baseDraft.parameters,
      frameOptions: this.frameOptionsDraftOverride ?? baseDraft.frameOptions,
    } satisfies ExperimentDraftView);
    const presentation = this.presentation;
    const results = this.buildResults(accepted);
    const energy = this.buildEnergy(analysis, accepted);
    const scenePlan = accepted === null
      ? null
      : deepFreeze({
        schemaVersion: 'visual-lab-scene-plan-v1' as const,
        identity: accepted.identity,
        view: presentation.view,
        density: presentation.density,
        focus: presentation.focus,
        global: accepted.global,
        local: accepted.local,
        availability: accepted.global !== null && accepted.local !== null ? 'available' as const : 'unavailable' as const,
        reason: accepted.global !== null && accepted.local !== null ? null : 'one or more accepted scene projections are unavailable',
      } satisfies ScenePlan);
    const stateError = analysis?.error === null || analysis?.error === undefined
      ? null
      : errorView(
        analysis.status === 'error' ? 'SOURCE_REJECTED' : 'CANONICAL_REJECTED',
        analysis.error,
      );
    const error = this.commandError ?? this.projectionError ?? stateError;
    const phase = this.phaseFor(analysis, accepted);
    const captureReady = accepted?.runReady === true && phase === 'ready';
    const snapshot = deepFreeze({
      phase,
      accepted,
      draft,
      presentation,
      scenePlan,
      results,
      energy,
      comparison: buildComparisonView(
        this.baselineComparison,
        accepted === null ? null : this.comparisonEvidence(analysis, accepted),
      ),
      capture: {
        availability: captureReady ? 'available' as const : 'unavailable' as const,
        reason: captureReady
          ? null
          : accepted === null
            ? 'no accepted archived-TLE/SGP4 frame is available for capture'
            : 'capture remains locked until the complete accepted run is ready',
        locked: !captureReady,
        identity: accepted?.identity ?? null,
      },
      computation: computationProgressView(analysis),
      error,
      canonical: accepted?.canonical ?? null,
      timeline: accepted?.timeline ?? null,
      globalScene: accepted?.global ?? null,
      localScene: accepted?.local ?? null,
    } satisfies LabSnapshot);
    if (analysis !== null) {
      this.previousFrame = analysis.frame;
      this.previousRun = analysis.acceptedRun ?? null;
      this.previousEvaluation = analysis.evaluation;
      this.previousNextFrame = analysis.visualNextFrame;
      this.previousTimelineTimeSec = analysis.timelineCurrentTimeSec;
      this.previousStatus = analysis.status;
      this.previousError = analysis.error;
      this.previousRequestedConstellation = analysis.requestedConstellation;
      this.previousTaipeiDateTime = analysis.taipeiDateTime;
      this.previousParameters = analysis.parameters;
      this.previousFrameOptions = analysis.frameOptions;
      this.previousOrbitSettingsDirty = analysis.orbitSettingsDirty ?? null;
      this.previousRunProgress = analysis.runProgress;
    }
    return snapshot;
  }

  private commandFailure(
    status: Exclude<DispatchStatus, 'accepted'>,
    code: LabErrorCode,
    message: string,
    command: LabCommand['type'],
  ): DispatchResult {
    this.commandError = errorView(code, message, command);
    this.publish(this.projectSnapshot());
    return {
      status,
      accepted: false,
      snapshot: this.value,
      error: this.commandError,
    };
  }

  private acceptedCommand(command: LabCommand['type']): DispatchResult {
    this.commandError = null;
    this.publish(this.projectSnapshot());
    return {
      status: 'accepted',
      accepted: true,
      snapshot: this.value,
      error: null,
    };
  }

  private requireAnalysis(command: LabCommand['type']): CanonicalAnalysisState | null {
    this.readExternalAnalysis();
    if (this.analysis !== null) return this.analysis;
    this.commandFailure('unavailable', 'CANONICAL_UNAVAILABLE', 'canonical homepage analysis is unavailable', command);
    return null;
  }

  private dispatch(command: LabCommand): Promise<DispatchResult> {
    this.readExternalAnalysis();
    try {
      switch (command.type) {
        case 'setSourceDraft':
        case 'editSourceDraft':
        case 'sourceDraft': {
          const analysis = this.requireAnalysis(command.type);
          if (analysis === null) return Promise.resolve(this.valueResult('unavailable'));
          const draftValue = sourceDraftCommandValue(command);
          const nextConstellation = draftValue.constellation ?? analysis.requestedConstellation;
          const nextDateTime = draftValue.taipeiDateTime ?? draftValue.dateTime ?? analysis.taipeiDateTime;
          if (nextConstellation !== 'oneweb' && nextConstellation !== 'starlink') {
            return Promise.resolve(this.commandFailure('rejected', 'COMMAND_REJECTED', 'unsupported constellation draft', command.type));
          }
          if (typeof nextDateTime !== 'string' || nextDateTime.trim().length === 0) {
            return Promise.resolve(this.commandFailure('rejected', 'COMMAND_REJECTED', 'source date/time draft is empty', command.type));
          }
          this.sourceDraftOverride = Object.freeze({
            constellation: nextConstellation,
            taipeiDateTime: nextDateTime,
          });
          analysis.setRequestedConstellation(nextConstellation);
          analysis.setTaipeiDateTime(nextDateTime);
          return Promise.resolve(this.acceptedCommand(command.type));
        }
        case 'applySource':
        case 'applySourceDraft':
        case 'applyRequestedSourceSettings': {
          const analysis = this.requireAnalysis(command.type);
          if (analysis === null) return Promise.resolve(this.valueResult('unavailable'));
          const sourceDraft = applySourceDraftOverride(sourceDraftView(analysis), this.sourceDraftOverride);
          if (!sourceDraft.dirty && analysis.status !== 'error') {
            return Promise.resolve(this.commandFailure('unavailable', 'SOURCE_UNAVAILABLE', 'source draft has no unapplied change', command.type));
          }
          if (analysis.applyRequestedOrbitSettings === undefined) {
            return Promise.resolve(this.commandFailure('unavailable', 'SOURCE_UNAVAILABLE', 'canonical source owner does not expose Apply', command.type));
          }
          this.pendingScientific = true;
          analysis.applyRequestedOrbitSettings();
          return Promise.resolve(this.acceptedCommand(command.type));
        }
        case 'editCanonicalParameter':
        case 'setCanonicalParameter':
        case 'editParameter': {
          const analysis = this.requireAnalysis(command.type);
          if (analysis === null) return Promise.resolve(this.valueResult('unavailable'));
          const key = 'key' in command ? command.key : command.parameter;
          if (!VISUAL_LAB_CANONICAL_PARAMETER_KEYS.includes(key)) {
            return Promise.resolve(this.commandFailure('unavailable', 'COMMAND_UNAVAILABLE', `parameter ${String(key)} is not an editable canonical input`, command.type));
          }
          if (!Number.isFinite(command.value)) {
            return Promise.resolve(this.commandFailure('rejected', 'COMMAND_REJECTED', `parameter ${key} must be finite`, command.type));
          }
          const definition = VISUAL_LAB_PARAMETER_DEFINITION_BY_KEY.get(key);
          if (definition === undefined) {
            return Promise.resolve(this.commandFailure('unavailable', 'COMMAND_UNAVAILABLE', `parameter ${key} has no Visual Lab definition`, command.type));
          }
          const displayValue = definition.toDisplayValue(command.value);
          if (displayValue < definition.min || displayValue > definition.max) {
            return Promise.resolve(this.commandFailure(
              'rejected',
              'COMMAND_REJECTED',
              `parameter ${key} is outside its supported range`,
              command.type,
            ));
          }
          if (definition.valueKind === 'integer' && !Number.isInteger(displayValue)) {
            return Promise.resolve(this.commandFailure('rejected', 'COMMAND_REJECTED', `parameter ${key} must be an integer`, command.type));
          }
          const currentDraft = this.parameterDraftOverride ?? parameterView(analysis.parameters);
          if (Object.is(currentDraft[key], command.value)) {
            return Promise.resolve(this.acceptedCommand(command.type));
          }
          const next = { ...analysis.parameters, ...currentDraft, [key]: command.value };
          this.parameterDraftOverride = parameterView(next);
          this.pendingScientific = true;
          analysis.setParameters(next);
          return Promise.resolve(this.acceptedCommand(command.type));
        }
        case 'resetCanonicalParameters':
        case 'resetCanonicalParameter': {
          const analysis = this.requireAnalysis(command.type);
          if (analysis === null) return Promise.resolve(this.valueResult('unavailable'));
          this.parameterDraftOverride = parameterView(DEFAULT_SIMULATOR_PARAMETERS);
          this.pendingScientific = true;
          analysis.resetParameters();
          return Promise.resolve(this.acceptedCommand(command.type));
        }
        case 'seek':
        case 'seekTimeline': {
          const analysis = this.requireAnalysis(command.type);
          if (analysis === null) return Promise.resolve(this.valueResult('unavailable'));
          const targetSec = 'timeSec' in command ? command.timeSec : command.targetSec;
          if (!Number.isFinite(targetSec) || !analysis.runReady) {
            return Promise.resolve(this.commandFailure('unavailable', 'TIMELINE_UNAVAILABLE', !analysis.runReady
              ? 'timeline seek is unavailable until the complete accepted run is ready'
              : 'timeline seek requires a finite time', command.type));
          }
          analysis.selectTimelineTimeSec(targetSec);
          return Promise.resolve(this.acceptedCommand(command.type));
        }
        case 'applyRepresentativeUeFrameOptions':
        case 'applyFrameOptions': {
          const analysis = this.requireAnalysis(command.type);
          if (analysis === null) return Promise.resolve(this.valueResult('unavailable'));
          const options = 'frameOptions' in command ? command.frameOptions : command.options;
          const mergedOptions: VisualLabFrameOptions = {
            ...options,
            beamLayoutCount: options.beamLayoutCount
              ?? analysis.frameOptions.beamLayoutCount
              ?? DEFAULT_BEAM_LAYOUT_COUNT,
            perSatelliteBeamLayoutCount: options.perSatelliteBeamLayoutCount
              ?? analysis.frameOptions.perSatelliteBeamLayoutCount,
            beamIlluminationMode: options.beamIlluminationMode
              ?? analysis.frameOptions.beamIlluminationMode
              ?? DEFAULT_SIMULATOR_BEAM_ILLUMINATION_MODE,
          };
          const validationError = validateFrameOptions(mergedOptions);
          if (validationError !== null) {
            return Promise.resolve(this.commandFailure('rejected', 'COMMAND_REJECTED', validationError, command.type));
          }
          this.frameOptionsDraftOverride = frameOptionsView(normalizeFrameOptions(mergedOptions));
          this.pendingScientific = true;
          analysis.setFrameOptions(normalizeFrameOptions(mergedOptions));
          return Promise.resolve(this.acceptedCommand(command.type));
        }
        case 'resetRepresentativeUeFrameOptions':
        case 'resetFrameOptions': {
          const analysis = this.requireAnalysis(command.type);
          if (analysis === null) return Promise.resolve(this.valueResult('unavailable'));
          const resetOptions: SimulationAnalysisFrameBuildOptions = {
            beamLayoutCount: analysis.frameOptions.beamLayoutCount ?? DEFAULT_BEAM_LAYOUT_COUNT,
            perSatelliteBeamLayoutCount: {},
            beamIlluminationMode: DEFAULT_SIMULATOR_BEAM_ILLUMINATION_MODE,
            userPositionOverridesKm: [],
          };
          this.frameOptionsDraftOverride = frameOptionsView(resetOptions);
          this.pendingScientific = true;
          analysis.setFrameOptions(resetOptions);
          return Promise.resolve(this.acceptedCommand(command.type));
        }
        case 'setBeamLayoutCount': {
          const analysis = this.requireAnalysis(command.type);
          if (analysis === null) return Promise.resolve(this.valueResult('unavailable'));
          let beamLayoutCount: SupportedBeamLayoutCount;
          try {
            beamLayoutCount = assertSupportedBeamLayoutCount(command.beamCount);
          } catch (error) {
            return Promise.resolve(this.commandFailure('rejected', 'COMMAND_REJECTED', readableError(error), command.type));
          }
          const nextOptions: SimulationAnalysisFrameBuildOptions = {
            ...analysis.frameOptions,
            beamLayoutCount,
          };
          if ((analysis.frameOptions.beamLayoutCount ?? DEFAULT_BEAM_LAYOUT_COUNT) === beamLayoutCount) {
            return Promise.resolve(this.acceptedCommand(command.type));
          }
          this.frameOptionsDraftOverride = frameOptionsView(nextOptions);
          this.pendingScientific = true;
          analysis.setFrameOptions(nextOptions);
          return Promise.resolve(this.acceptedCommand(command.type));
        }
        case 'setPerSatelliteBeamLayout': {
          const analysis = this.requireAnalysis(command.type);
          if (analysis === null) return Promise.resolve(this.valueResult('unavailable'));
          let beamLayoutCount: SupportedBeamLayoutCount;
          try {
            beamLayoutCount = assertSupportedBeamLayoutCount(command.beamCount);
          } catch (error) {
            return Promise.resolve(this.commandFailure('rejected', 'COMMAND_REJECTED', readableError(error), command.type));
          }
          const satelliteId = command.satelliteId.trim();
          if (satelliteId.length === 0) {
            return Promise.resolve(this.commandFailure('rejected', 'COMMAND_REJECTED', 'satelliteId must be non-empty', command.type));
          }
          let perSatelliteBeamLayoutCount: PerSatelliteBeamLayoutCount;
          try {
            perSatelliteBeamLayoutCount = normalizePerSatelliteBeamLayoutCount({
              ...(analysis.frameOptions.perSatelliteBeamLayoutCount ?? {}),
              [satelliteId]: beamLayoutCount,
            });
          } catch (error) {
            return Promise.resolve(this.commandFailure('rejected', 'COMMAND_REJECTED', readableError(error), command.type));
          }
          const previous = analysis.frameOptions.perSatelliteBeamLayoutCount?.[satelliteId];
          if (previous === beamLayoutCount) return Promise.resolve(this.acceptedCommand(command.type));
          const nextOptions: SimulationAnalysisFrameBuildOptions = {
            ...analysis.frameOptions,
            perSatelliteBeamLayoutCount,
          };
          this.frameOptionsDraftOverride = frameOptionsView(nextOptions);
          this.pendingScientific = true;
          analysis.setFrameOptions(nextOptions);
          return Promise.resolve(this.acceptedCommand(command.type));
        }
        case 'removePerSatelliteBeamLayout': {
          const analysis = this.requireAnalysis(command.type);
          if (analysis === null) return Promise.resolve(this.valueResult('unavailable'));
          const satelliteId = command.satelliteId.trim();
          if (satelliteId.length === 0) {
            return Promise.resolve(this.commandFailure('rejected', 'COMMAND_REJECTED', 'satelliteId must be non-empty', command.type));
          }
          const current = analysis.frameOptions.perSatelliteBeamLayoutCount ?? {};
          if (current[satelliteId] === undefined) return Promise.resolve(this.acceptedCommand(command.type));
          const nextOverrides = { ...current };
          delete nextOverrides[satelliteId];
          const nextOptions: SimulationAnalysisFrameBuildOptions = {
            ...analysis.frameOptions,
            perSatelliteBeamLayoutCount: normalizePerSatelliteBeamLayoutCount(nextOverrides),
          };
          this.frameOptionsDraftOverride = frameOptionsView(nextOptions);
          this.pendingScientific = true;
          analysis.setFrameOptions(nextOptions);
          return Promise.resolve(this.acceptedCommand(command.type));
        }
        case 'setBeamIlluminationMode': {
          const analysis = this.requireAnalysis(command.type);
          if (analysis === null) return Promise.resolve(this.valueResult('unavailable'));
          let mode: SimulatorBeamIlluminationMode;
          try {
            mode = assertSimulatorBeamIlluminationMode(command.mode);
          } catch (error) {
            return Promise.resolve(this.commandFailure('rejected', 'COMMAND_REJECTED', readableError(error), command.type));
          }
          const current = analysis.frameOptions.beamIlluminationMode
            ?? DEFAULT_SIMULATOR_BEAM_ILLUMINATION_MODE;
          if (current === mode) return Promise.resolve(this.acceptedCommand(command.type));
          const nextOptions: SimulationAnalysisFrameBuildOptions = {
            ...analysis.frameOptions,
            beamLayoutCount: analysis.frameOptions.beamLayoutCount ?? DEFAULT_BEAM_LAYOUT_COUNT,
            beamIlluminationMode: mode,
          };
          this.frameOptionsDraftOverride = frameOptionsView(nextOptions);
          this.pendingScientific = true;
          analysis.setFrameOptions(nextOptions);
          return Promise.resolve(this.acceptedCommand(command.type));
        }
        case 'setView':
        case 'setPresentationView':
          this.presentation = makePresentation({ ...this.presentation, view: command.view });
          return Promise.resolve(this.acceptedCommand(command.type));
        case 'setDensity':
        case 'setPresentationDensity':
          this.presentation = makePresentation({ ...this.presentation, density: command.density });
          return Promise.resolve(this.acceptedCommand(command.type));
        case 'setFocus':
        case 'setPresentationFocus':
          this.presentation = makePresentation({ ...this.presentation, focus: command.focus });
          return Promise.resolve(this.acceptedCommand(command.type));
        case 'setTheme':
        case 'setPresentationTheme':
          this.presentation = makePresentation({ ...this.presentation, theme: command.theme });
          return Promise.resolve(this.acceptedCommand(command.type));
        case 'setLocale':
        case 'setPresentationLocale':
          this.presentation = makePresentation({ ...this.presentation, locale: command.locale });
          return Promise.resolve(this.acceptedCommand(command.type));
        case 'setExperience':
        case 'setPresentationExperience':
          this.presentation = makePresentation({ ...this.presentation, experience: command.experience });
          return Promise.resolve(this.acceptedCommand(command.type));
        case 'setPresentation':
          this.presentation = makePresentation({ ...this.presentation, ...command.presentation });
          return Promise.resolve(this.acceptedCommand(command.type));
        case 'saveBaseline':
        case 'saveComparisonBaseline': {
          const accepted = this.value.accepted;
          if (accepted === null) {
            return Promise.resolve(this.commandFailure(
              'unavailable',
              'CANONICAL_UNAVAILABLE',
              'an accepted canonical frame is required before registering baseline A',
              command.type,
            ));
          }
          this.baselineComparison = this.comparisonEvidence(this.analysis, accepted);
          return Promise.resolve(this.acceptedCommand(command.type));
        }
        case 'clearBaseline':
        case 'clearComparison':
          this.baselineComparison = null;
          return Promise.resolve(this.acceptedCommand(command.type));
        case 'resetEvaluation':
        case 'evaluationReset': {
          const analysis = this.requireAnalysis(command.type);
          if (analysis === null) return Promise.resolve(this.valueResult('unavailable'));
          analysis.resetEvaluation();
          return Promise.resolve(this.acceptedCommand(command.type));
        }
        default:
          return Promise.resolve(this.commandFailure('rejected', 'COMMAND_REJECTED', 'unknown visual-lab command', (command as { type: string }).type as LabCommand['type']));
      }
    } catch (error) {
      const commandType = command.type;
      return Promise.resolve(this.commandFailure('rejected', 'CANONICAL_REJECTED', readableError(error), commandType));
    }
  }

  private valueResult(status: DispatchStatus): DispatchResult {
    return {
      status,
      accepted: status === 'accepted',
      snapshot: this.value,
      error: this.commandError ?? this.value.error,
    };
  }
}

/**
 * Construct a stable facade.  The opaque analysis/provider options exist only
 * for deterministic adapter tests and migration seams; normal routes should
 * use `useVisualLabSession`, which binds the canonical hook privately.
 */
export function createVisualLabSession(options: VisualLabSessionFactoryOptions = {}): VisualLabSession {
  const analysis = asAnalysisState(options.analysis);
  const presentation = makePresentation(options.initialPresentation);
  return new VisualLabSessionController({ analysis, presentation }, options.analysisProvider ?? null).publicSession;
}

/** Internal controller binding used by the React hook and no route caller. */
function createBoundSession(analysis: HomepageCanonicalAnalysisState, presentation: PresentationView): VisualLabSessionController {
  return new VisualLabSessionController({ analysis, presentation }, null);
}

/**
 * React adapter over the same three-method facade.  The object identity stays
 * stable across React renders while accepted frame/run changes are published
 * through the facade's subscriber channel.
 */
export function useVisualLabSession(
  initialPresentation?: Partial<PresentationView>,
): VisualLabSession {
  const analysis = useHomepageCanonicalAnalysis({
    initialFrameOptions: {
      // Keep the cache identity aligned with the checked-in first-frame and
      // optional full-run artifacts.  Omitted scenario fields mean the
      // canonical baseline (the UI still exposes the effective 7-beam/fixed
      // defaults through frameOptionsView).  Explicit values are reserved for
      // a user experiment and would otherwise force a fresh SGP4 first frame
      // on every cold load.
      userPositionOverridesKm: [],
    },
  });
  const controllerRef = useRef<VisualLabSessionController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createBoundSession(analysis, makePresentation(initialPresentation));
  } else {
    controllerRef.current.syncAnalysis(analysis);
  }
  const controller = controllerRef.current;
  useSyncExternalStore(
    listener => controller.publicSession.subscribe(listener),
    () => controller.publicSession.snapshot(),
    () => controller.publicSession.snapshot(),
  );
  useEffect(() => {
    controller.flushAnalysisNotification();
  }, [controller, analysis]);
  return controller.publicSession;
}
