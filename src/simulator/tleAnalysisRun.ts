import type {
  PassEvent,
  PassGeometrySource,
  PassPlan,
  PassPlannerOptions,
} from '../tle/pass';
import { planPassDiversity } from '../tle/pass';
import {
  createTleRunBundleSnapshot,
  hydrateTleRunBundle,
  TLE_RUN_ANCHOR_COUNT,
  TLE_RUN_DURATION_S,
  TLE_RUN_STEP_S,
  type TleRunBundle,
  type TleRunBundleSnapshot,
} from '../tle/run';
import { deriveObserverLinkGeometry } from './observer';
import {
  buildSimulationBeamScheduleProjection,
  buildSimulationAnalysisFrame,
  buildSimulationAnalysisFrameWithLaggedInterference,
  computeSimulationRunComputation,
  createSimulationAnalysisRunId,
  createSimulatorTleStateFromRunAnchor,
  type SimulationBeamScheduleProjection,
  type SimulationAnalysisFrameBuildOptions,
  type SimulationRunComputation,
  type SimulatorRunAnchorSelection,
} from './analysis';
import {
  buildCanonicalTleHandoverTrace,
  DEFAULT_CANONICAL_TLE_HANDOVER_POLICY,
  type CanonicalTleHandoverComparisonSample,
  type CanonicalTleHandoverTargetSelection,
  type CanonicalTleHandoverTrace,
} from './canonicalTleHandover';
import type {
  LoadedTleSnapshotSelection,
  SimulationAnalysisFrame,
  SimulatorParameters,
  SimulatorRunAnchorIdentity,
  SimulatorRunEvaluation,
} from './types';
import {
  assertSupportedBeamLayoutCount,
  createCompleteHexBeamLayout,
} from '../core/beam/completeHexPresets';
import { normalizePerSatelliteBeamLayoutCount } from './beamLayoutOverrides';
import {
  assertSimulatorBeamIlluminationMode,
  eligibleBeamCountForVisualLabScenario,
} from './beamIlluminationScenario';
import {
  createBeamScheduleTrace,
  type BeamScheduleTrace,
} from '../visualLab/beamRuntime/beamScheduleTrace';

/**
 * The source of a selected serving identity at one playback anchor.
 *
 * `pass-plan` means the pass planner selected a complete, real extracted pass.
 * `visible-geometry-fallback` is deliberately explicit: the planner had no
 * complete event covering this edge/anchor, so the highest-elevation real
 * satellite in the already-computed frame is used only to keep the scene
 * inspectable.  It is not a fabricated handover decision.  `unavailable`
 * means no real above-horizon satellite exists at that anchor.
 */
export type TleAnchorSelectionKind =
  | 'pass-plan'
  | 'visible-geometry-fallback'
  | 'unavailable';

export interface TleAnalysisRunAnchorIdentity extends SimulatorRunAnchorIdentity {
  readonly selectionKind: TleAnchorSelectionKind;
}

export interface TleAnalysisRunAnchorSelection {
  readonly anchorIndex: number;
  readonly anchorTimeSec: number;
  readonly selectedSatelliteId: string | null;
  readonly candidateSatelliteId: string | null;
  readonly servingPassId: string | null;
  readonly candidatePassId: string | null;
  readonly selectionKind: TleAnchorSelectionKind;
  readonly identity: TleAnalysisRunAnchorIdentity;
}

export interface TleAnalysisRunBuildInput {
  readonly selection: LoadedTleSnapshotSelection;
  readonly geometryRun: TleRunBundle;
  readonly parameters: SimulatorParameters;
  /** Override only the pass-diversity policy; the run axis remains fixed. */
  readonly passPolicy?: PassPlannerOptions;
  /** Reuse a completed plan when only canonical parameters changed. */
  readonly passPlan?: PassPlan;
  /** Bounded canonical scenario probe; never changes the archived-TLE geometry. */
  readonly frameOptions?: SimulationAnalysisFrameBuildOptions;
}

/**
 * Visual Lab pass policy: keep the service link inside the readable NTPU
 * near-field scene and allow a real replacement pass to take over before the
 * current satellite has fallen toward the horizon.  A 50-degree mask is a
 * presentation/run-planning boundary, not a change to the RF/SINR equations:
 * the canonical handover trace still applies its offset/TTT decision to the
 * resulting archived-TLE geometry.
 */
export const DEFAULT_TLE_ANALYSIS_PASS_POLICY: Readonly<PassPlannerOptions> = Object.freeze({
  policyRevision: 'tle-pass-diversity-v2-visual-early-handover',
  minimumElevationDeg: 50,
  minimumCandidateOverlapSec: 30,
  minimumCandidateContinuationSec: 60,
});

/** Data-only analysis publication carried by the archived-TLE Worker. */
export const TLE_ANALYSIS_RUN_SNAPSHOT_SCHEMA = 'tle-analysis-run-snapshot-v1' as const;

export interface TleAnalysisRunSnapshotSourceIdentity {
  readonly archiveId: string;
  readonly publicationSha256: string;
  readonly t0Utc: string;
  readonly geometryRunId: string;
}

export interface TleAnalysisRunSnapshot {
  readonly schema: typeof TLE_ANALYSIS_RUN_SNAPSHOT_SCHEMA;
  readonly runId: string;
  readonly analysisRunId: string;
  readonly geometryRunId: string;
  readonly sourceIdentity: TleAnalysisRunSnapshotSourceIdentity;
  readonly selection: LoadedTleSnapshotSelection;
  readonly geometryRun: TleRunBundleSnapshot;
  readonly passPlan: PassPlan;
  readonly parameters: SimulatorParameters;
  readonly frameOptions: Readonly<SimulationAnalysisFrameBuildOptions>;
  readonly evaluation: SimulatorRunEvaluation;
  readonly durationS: typeof TLE_RUN_DURATION_S;
  readonly stepS: typeof TLE_RUN_STEP_S;
  readonly anchorCount: typeof TLE_RUN_ANCHOR_COUNT;
  readonly anchorSelections: readonly TleAnalysisRunAnchorSelection[];
  readonly handoverTrace: CanonicalTleHandoverTrace;
  /** Accepted per-anchor illumination and complete per-UE service-pair evidence. */
  readonly beamScheduleTrace: BeamScheduleTrace | null;
  /**
   * Optional frame cache for small offline parity fixtures. Production Worker
   * snapshots omit it because each frame repeats the full constellation; the
   * hydrated facade then materializes one requested frame from the transferred
   * geometry and the frozen analysis identity.
   */
  readonly frames?: readonly SimulationAnalysisFrame[];
}

export type TleAnalysisSnapshot = TleAnalysisRunSnapshot;

export interface TleAnalysisRun {
  /** Stable identity including geometry run, policy revision, and parameters. */
  readonly runId: string;
  readonly analysisRunId: string;
  readonly geometryRunId: string;
  readonly selection: LoadedTleSnapshotSelection;
  readonly geometryRun: TleRunBundle;
  readonly passPlan: PassPlan;
  readonly parameters: SimulatorParameters;
  readonly frameOptions: Readonly<SimulationAnalysisFrameBuildOptions>;
  readonly evaluation: SimulatorRunEvaluation;
  /** Compatibility alias used by older controller adapters. */
  readonly runEvaluation: SimulatorRunEvaluation;
  readonly durationS: typeof TLE_RUN_DURATION_S;
  readonly stepS: typeof TLE_RUN_STEP_S;
  readonly anchorCount: typeof TLE_RUN_ANCHOR_COUNT;
  /** Compact planner selections only; no per-anchor constellation frames. */
  readonly anchorSelections: readonly TleAnalysisRunAnchorSelection[];
  /** Immutable offset/TTT decisions derived from the same run anchors. */
  readonly handoverTrace: CanonicalTleHandoverTrace;
  /** Null only for compatibility runs that did not select a complete-ring layout. */
  readonly beamScheduleTrace: BeamScheduleTrace | null;
  readonly getAnchorIndexForElapsedSec: (elapsedSec: number) => number;
  readonly anchorIndexForElapsedSec: (elapsedSec: number) => number;
  readonly getElapsedSecForAnchorIndex: (anchorIndex: number) => number;
  readonly getAnchorSelection: (anchor: number) => TleAnalysisRunAnchorSelection;
  readonly getFrame: (anchor: number) => SimulationAnalysisFrame | null;
  readonly frameAt: (anchor: number) => SimulationAnalysisFrame | null;
  readonly getFrameAtElapsedSec: (elapsedSec: number) => SimulationAnalysisFrame | null;
  /** Rebuild only canonical parameter/evaluation projections; TLE geometry and pass plan stay frozen. */
  readonly withParameters: (parameters: SimulatorParameters) => TleAnalysisRun;
  /** Rebuild canonical frames/evaluation with a bounded UE geometry probe. */
  readonly withFrameOptions: (options: SimulationAnalysisFrameBuildOptions) => TleAnalysisRun;
  /** Atomically rebuild parameters and the bounded scenario probe. */
  readonly withExperiment: (
    parameters: SimulatorParameters,
    options: SimulationAnalysisFrameBuildOptions,
  ) => TleAnalysisRun;
  /** Explicit alias for callers that treat parameter edits as a rebuild. */
  readonly rebuild: (parameters: SimulatorParameters) => TleAnalysisRun;
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be finite`);
  return value;
}

/** Snap to the nearest 30-second anchor, then clamp to the inclusive run. */
export function anchorIndexForElapsedSec(elapsedSec: number): number {
  const value = finite(elapsedSec, 'elapsedSec');
  return Math.min(
    TLE_RUN_ANCHOR_COUNT - 1,
    Math.max(0, Math.round(value / TLE_RUN_STEP_S)),
  );
}

export function elapsedSecForAnchorIndex(anchorIndex: number): number {
  if (!Number.isFinite(anchorIndex)) throw new RangeError('anchorIndex must be finite');
  const index = Math.min(TLE_RUN_ANCHOR_COUNT - 1, Math.max(0, Math.round(anchorIndex)));
  return index * TLE_RUN_STEP_S;
}

function anchorIndexForRun(run: TleRunBundle, anchor: number): number {
  if (!Number.isFinite(anchor)) throw new RangeError('anchor must be finite');
  // The public helper accepts either an integer index or elapsed seconds only
  // through the explicit getFrameAtElapsedSec method. Keeping getFrame index
  // based avoids ambiguous values such as 30 (index 30 vs 30 seconds).
  return Math.min(run.anchorCount - 1, Math.max(0, Math.round(anchor)));
}

function compareSatelliteIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function passById(plan: PassPlan): Readonly<Record<string, PassEvent>> {
  const result: Record<string, PassEvent> = {};
  for (const pass of plan.passes) result[pass.passId] = pass;
  return result;
}

function geometrySourceForRun(run: TleRunBundle): PassGeometrySource {
  const satelliteIds = run.satellites.map(satellite => satellite.satelliteId);
  const anchorTimes = Array.from({ length: run.anchorCount }, (_unused, index) => run.getAnchorUtc(index));
  return {
    // Every satellite reads the same ISO UTC axis.  No per-satellite time
    // shifting is possible at this seam.
    anchorTimes,
    satelliteIds,
    sample: (satelliteId, _anchorTime, anchorIndex) => {
      const satelliteIndex = run.getSatelliteIndex(satelliteId);
      if (satelliteIndex === undefined) return null;
      const state = run.readStateByIndex(anchorIndex, satelliteIndex);
      const geometry = deriveObserverLinkGeometry(state.positionTemeKm, state.requestedInstantUtc);
      return {
        satelliteId,
        azimuthDeg: geometry.azimuthDeg,
        elevationDeg: geometry.elevationDeg,
        rangeKm: geometry.rangeKm,
      };
    },
  };
}

function visibleSatelliteAtAnchor(
  run: TleRunBundle,
  anchorIndex: number,
  excludedSatelliteId?: string,
): { readonly satelliteId: string; readonly elevationDeg: number } | null {
  const instantUtc = run.getAnchorUtc(anchorIndex);
  let best: { readonly satelliteId: string; readonly elevationDeg: number } | null = null;
  for (let satelliteIndex = 0; satelliteIndex < run.satelliteCount; satelliteIndex += 1) {
    const state = run.readStateByIndex(anchorIndex, satelliteIndex);
    if (state.satelliteId === excludedSatelliteId) continue;
    const geometry = deriveObserverLinkGeometry(state.positionTemeKm, instantUtc);
    if (!geometry.visible) continue;
    if (
      best === null
      || geometry.elevationDeg > best.elevationDeg
      || (geometry.elevationDeg === best.elevationDeg && compareSatelliteIds(state.satelliteId, best.satelliteId) < 0)
    ) {
      best = { satelliteId: state.satelliteId, elevationDeg: geometry.elevationDeg };
    }
  }
  return best;
}

function candidateForAnchor(
  run: TleRunBundle,
  anchorIndex: number,
  servingSatelliteId: string,
  pass: PassEvent | null,
): string | null {
  if (pass === null || pass.satelliteId === servingSatelliteId) return null;
  const candidateIndex = run.getSatelliteIndex(pass.satelliteId);
  if (candidateIndex === undefined) return null;
  const state = run.readStateByIndex(anchorIndex, candidateIndex);
  const geometry = deriveObserverLinkGeometry(state.positionTemeKm, state.requestedInstantUtc);
  return geometry.visible ? pass.satelliteId : null;
}

function isVisibleSatelliteAtAnchor(
  run: TleRunBundle,
  anchorIndex: number,
  satelliteId: string,
): boolean {
  const satelliteIndex = run.getSatelliteIndex(satelliteId);
  if (satelliteIndex === undefined) return false;
  const state = run.readStateByIndex(anchorIndex, satelliteIndex);
  const geometry = deriveObserverLinkGeometry(state.positionTemeKm, state.requestedInstantUtc);
  // The local/NTPU scene is a near-field presentation: once the serving
  // satellite falls below the same service mask used by the pass planner, it
  // is already outside the readable scene even though it remains mathematically
  // above the geometric horizon.  Use the shared run policy here so the
  // accepted trace commits to the real next pass before that low-elevation
  // tail is rendered as a misleading long link.
  return geometry.visible
    && geometry.elevationDeg >= (DEFAULT_TLE_ANALYSIS_PASS_POLICY.minimumElevationDeg ?? 0);
}

/**
 * Select only a real above-horizon target for a comparison sample.  The
 * planned serving identity is preferred when the planner has moved to a new
 * pass; its candidate is next; the deterministic highest-elevation real
 * satellite is the final continuity fallback.
 */
function comparisonTargetForAnchor(
  run: TleRunBundle,
  plannedSelections: readonly TleAnalysisRunAnchorSelection[],
  anchorIndex: number,
  activeServingSatelliteId: string,
): string | null {
  const planned = plannedSelections[anchorIndex];
  const candidates = [
    planned?.selectedSatelliteId ?? null,
    planned?.candidateSatelliteId ?? null,
  ];
  for (const candidateId of candidates) {
    if (
      candidateId !== null
      && candidateId !== activeServingSatelliteId
      && isVisibleSatelliteAtAnchor(run, anchorIndex, candidateId)
    ) return candidateId;
  }
  // The highest-elevation visible satellite is often the active serving
  // satellite. Ask the selector for the best *other* visible satellite rather
  // than finding the serving satellite and then discarding it; otherwise a
  // cache-first frame can show a real candidate which disappears when the
  // accepted run materializes anchor 0.
  const fallback = visibleSatelliteAtAnchor(run, anchorIndex, activeServingSatelliteId);
  return fallback?.satelliteId ?? null;
}

function comparisonSampleForAnchor(
  selection: LoadedTleSnapshotSelection,
  run: TleRunBundle,
  parameters: SimulatorParameters,
  plannedSelections: readonly TleAnalysisRunAnchorSelection[],
  anchorIndex: number,
  activeServingSatelliteId: string,
  frameOptions: SimulationAnalysisFrameBuildOptions,
): CanonicalTleHandoverComparisonSample {
  const planned = plannedSelections[anchorIndex];
  if (planned === undefined) throw new Error(`missing planned TLE selection at anchor ${anchorIndex}`);
  const instantUtc = run.getAnchorUtc(anchorIndex);
  const servingVisible = isVisibleSatelliteAtAnchor(run, anchorIndex, activeServingSatelliteId);
  const candidateSatelliteId = comparisonTargetForAnchor(
    run,
    plannedSelections,
    anchorIndex,
    activeServingSatelliteId,
  );

  // The old serving identity cannot be passed to the frame builder after it
  // has dropped below the horizon.  Materialize the real continuity target as
  // a one-link frame and expose it as the candidate of the failed comparison;
  // the state machine then requests that target again after the forced switch.
  if (!servingVisible) {
    if (candidateSatelliteId === null) {
      throw new Error(`no real visible continuity target at anchor ${anchorIndex}`);
    }
    const targetState = createSimulatorTleStateFromRunAnchor(
      selection,
      run,
      anchorIndex,
      {
        selectedSatelliteId: candidateSatelliteId,
        candidateSatelliteId: null,
        identity: planned.identity,
      } satisfies SimulatorRunAnchorSelection,
    );
    const targetFrame = buildSimulationAnalysisFrame(targetState, parameters, undefined, frameOptions);
    const targetLink = targetFrame.links[0];
    return Object.freeze({
      anchorIndex,
      instantUtc,
      servingSatelliteId: activeServingSatelliteId,
      candidateSatelliteId,
      servingVisible: false,
      candidateVisible: true,
      servingSinrDb: null,
      candidateSinrDb: targetLink?.sinrDb ?? null,
    });
  }

  const state = createSimulatorTleStateFromRunAnchor(
    selection,
    run,
    anchorIndex,
    {
      selectedSatelliteId: activeServingSatelliteId,
      candidateSatelliteId,
      identity: planned.identity,
    } satisfies SimulatorRunAnchorSelection,
  );
  const frame = buildSimulationAnalysisFrame(state, parameters, undefined, frameOptions);
  const servingLink = frame.links[0];
  const candidateLink = frame.candidateLink;
  return Object.freeze({
    anchorIndex,
    instantUtc,
    servingSatelliteId: activeServingSatelliteId,
    candidateSatelliteId: candidateLink?.satelliteId ?? null,
    servingVisible: true,
    candidateVisible: candidateLink !== null,
    servingSinrDb: servingLink?.sinrDb ?? null,
    candidateSinrDb: candidateLink?.sinrDb ?? null,
  });
}

function passForSatelliteAtAnchor(
  plan: PassPlan,
  anchorIndex: number,
  satelliteId: string | null,
): PassEvent | null {
  if (satelliteId === null) return null;
  return plan.passes
    .filter(pass => (
      pass.satelliteId === satelliteId
      && pass.aosAnchorIndex <= anchorIndex
      && pass.losAnchorIndex >= anchorIndex
    ))
    .sort((left, right) => left.passId.localeCompare(right.passId))[0] ?? null;
}

/**
 * Preserve the planner origin of a target instead of inferring provenance
 * from any coincidentally overlapping extracted pass.
 */
export function resolvePassPlanTargetSelection(
  plan: PassPlan,
  plannedSelection: TleAnalysisRunAnchorSelection,
  anchorIndex: number,
  targetSatelliteId: string,
): CanonicalTleHandoverTargetSelection | null {
  if (plannedSelection.anchorIndex !== anchorIndex) {
    throw new Error(`planned target selection anchor mismatch at ${anchorIndex}`);
  }
  const targetPassId = plannedSelection.selectedSatelliteId === targetSatelliteId
    && plannedSelection.selectionKind === 'pass-plan'
    ? plannedSelection.servingPassId
    : plannedSelection.candidateSatelliteId === targetSatelliteId
      ? plannedSelection.candidatePassId
      : null;
  if (targetPassId === null) return null;
  const targetPass = plan.passes.find(pass => pass.passId === targetPassId);
  if (
    targetPass === undefined
    || targetPass.satelliteId !== targetSatelliteId
    || targetPass.aosAnchorIndex > anchorIndex
    || targetPass.losAnchorIndex < anchorIndex
  ) return null;
  return freeze({
    selectionKind: 'pass-plan',
    passId: targetPass.passId,
    satelliteId: targetPass.satelliteId,
    sourceLocator: `passPlan.passes[passId=${targetPass.passId}]`,
  });
}

function createTraceAnchorSelections(
  run: TleRunBundle,
  plan: PassPlan,
  analysisRunId: string,
  plannedSelections: readonly TleAnalysisRunAnchorSelection[],
  handoverTrace: CanonicalTleHandoverTrace,
): readonly TleAnalysisRunAnchorSelection[] {
  const selections = handoverTrace.anchors.map(trace => {
    const planned = plannedSelections[trace.anchorIndex];
    if (planned === undefined) throw new Error(`handover trace references unknown anchor ${trace.anchorIndex}`);
    const servingPass = passForSatelliteAtAnchor(plan, trace.anchorIndex, trace.servingSatelliteId);
    const candidatePass = passForSatelliteAtAnchor(plan, trace.anchorIndex, trace.candidateSatelliteId);
    const selectionKind: TleAnchorSelectionKind = servingPass === null
      ? 'visible-geometry-fallback'
      : 'pass-plan';
    const identity = freeze({
      ...planned.identity,
      runId: analysisRunId,
      servingPassId: servingPass?.passId ?? null,
      candidatePassId: candidatePass?.passId ?? null,
      selectionKind,
    } satisfies TleAnalysisRunAnchorIdentity);
    return freeze({
      anchorIndex: trace.anchorIndex,
      anchorTimeSec: trace.anchorIndex * run.stepS,
      selectedSatelliteId: trace.servingSatelliteId,
      candidateSatelliteId: trace.candidateSatelliteId,
      servingPassId: servingPass?.passId ?? null,
      candidatePassId: candidatePass?.passId ?? null,
      selectionKind,
      identity,
    });
  });
  return freeze(selections);
}

function createAnchorSelections(
  run: TleRunBundle,
  plan: PassPlan,
  analysisRunId: string,
): readonly TleAnalysisRunAnchorSelection[] {
  const events = passById(plan);
  const selections: TleAnalysisRunAnchorSelection[] = [];
  for (let anchorIndex = 0; anchorIndex < run.anchorCount; anchorIndex += 1) {
    const planned = plan.serviceAnchors[anchorIndex];
    if (planned === undefined) throw new Error(`pass plan does not cover run anchor ${anchorIndex}`);
    const plannedPass = planned.servingPassId === null ? null : events[planned.servingPassId] ?? null;
    const fallback = plannedPass === null ? visibleSatelliteAtAnchor(run, anchorIndex) : null;
    const selectedSatelliteId = plannedPass?.satelliteId ?? fallback?.satelliteId ?? null;
    const selectionKind: TleAnchorSelectionKind = plannedPass === null
      ? selectedSatelliteId === null ? 'unavailable' : 'visible-geometry-fallback'
      : 'pass-plan';
    const candidatePass = planned.candidatePassId === null ? null : events[planned.candidatePassId] ?? null;
    const candidateSatelliteId = selectedSatelliteId === null
      ? null
      : candidateForAnchor(run, anchorIndex, selectedSatelliteId, candidatePass);
    const identity = freeze({
      runId: analysisRunId,
      geometryRunId: run.runId,
      anchorIndex,
      anchorCount: run.anchorCount,
      elapsedSec: anchorIndex * run.stepS,
      durationSec: run.durationS,
      stepSec: run.stepS,
      passPolicyRevision: plan.policyRevision,
      servingPassId: planned.servingPassId,
      candidatePassId: candidateSatelliteId === null ? null : planned.candidatePassId,
      selectionKind,
    } satisfies TleAnalysisRunAnchorIdentity);
    selections.push(freeze({
      anchorIndex,
      anchorTimeSec: anchorIndex * run.stepS,
      selectedSatelliteId,
      candidateSatelliteId,
      servingPassId: planned.servingPassId,
      candidatePassId: candidateSatelliteId === null ? null : planned.candidatePassId,
      selectionKind,
      identity,
    }));
  }
  return freeze(selections);
}

function buildRunComputation(
  run: TleRunBundle,
  selections: readonly TleAnalysisRunAnchorSelection[],
  parameters: SimulatorParameters,
  frameOptions: SimulationAnalysisFrameBuildOptions,
): SimulationRunComputation {
  const samples = [] as Array<{
    readonly instantUtc: string;
    readonly positionTemeKm: ReturnType<TleRunBundle['readStateByIndex']>['positionTemeKm'];
    readonly durationSec: number;
    readonly satelliteId: string;
  }>;
  for (let anchorIndex = 0; anchorIndex < run.anchorCount - 1; anchorIndex += 1) {
    const selection = selections[anchorIndex];
    if (selection?.selectedSatelliteId === null || selection === undefined) {
      throw new Error(`archived TLE run has no real NTPU-visible serving satellite at anchor ${anchorIndex}`);
    }
    const satelliteIndex = run.getSatelliteIndex(selection.selectedSatelliteId);
    if (satelliteIndex === undefined) throw new Error(`run selection references unknown satellite ${selection.selectedSatelliteId}`);
    const state = run.readStateByIndex(anchorIndex, satelliteIndex);
    samples.push({
      instantUtc: state.requestedInstantUtc,
      positionTemeKm: state.positionTemeKm,
      durationSec: run.stepS,
      satelliteId: selection.selectedSatelliteId,
    });
  }
  if (samples.length !== run.anchorCount - 1) {
    throw new Error(`archived TLE run evaluation requires ${run.anchorCount - 1} interval starts`);
  }
  const computation = computeSimulationRunComputation(samples, parameters, frameOptions);
  if (computation.laggedInterferenceByAnchor.length !== run.anchorCount) {
    throw new Error(`archived TLE run lagged-interference trace requires ${run.anchorCount} accepted anchors`);
  }
  return computation;
}

function buildBeamScheduleTraceForRun(
  run: TleRunBundle,
  selections: readonly TleAnalysisRunAnchorSelection[],
  parameters: SimulatorParameters,
  frameOptions: SimulationAnalysisFrameBuildOptions,
  analysisRunId: string,
  intervalProjections: readonly SimulationBeamScheduleProjection[] | null,
): BeamScheduleTrace | null {
  if (intervalProjections === null) return null;
  const endpointAnchorIndex = run.anchorCount - 1;
  const endpointSelection = selections[endpointAnchorIndex];
  if (endpointSelection?.selectedSatelliteId === null || endpointSelection === undefined) {
    throw new Error('beam schedule trace endpoint requires a real serving satellite');
  }
  const endpointSatelliteIndex = run.getSatelliteIndex(endpointSelection.selectedSatelliteId);
  if (endpointSatelliteIndex === undefined) {
    throw new Error(`beam schedule endpoint references unknown satellite ${endpointSelection.selectedSatelliteId}`);
  }
  const endpointState = run.readStateByIndex(endpointAnchorIndex, endpointSatelliteIndex);
  const endpointProjection = buildSimulationBeamScheduleProjection({
    instantUtc: endpointState.requestedInstantUtc,
    positionTemeKm: endpointState.positionTemeKm,
    durationSec: run.stepS,
    satelliteId: endpointSelection.selectedSatelliteId,
  }, parameters, frameOptions, endpointAnchorIndex);
  if (endpointProjection === null) return null;
  const projections = [...intervalProjections, endpointProjection];
  if (projections.length !== run.anchorCount) {
    throw new Error(`beam schedule trace requires ${run.anchorCount} accepted anchor projections`);
  }

  const satelliteProjectionById = new Map<string, SimulationBeamScheduleProjection>();
  for (const projection of projections) {
    const previous = satelliteProjectionById.get(projection.satelliteId);
    if (previous !== undefined && (
      previous.beamLayoutCount !== projection.beamLayoutCount
      || previous.halfPowerBeamWidthDeg !== projection.halfPowerBeamWidthDeg
      || previous.mode !== projection.mode
    )) {
      throw new Error(`beam schedule layout changed inside accepted run for ${projection.satelliteId}`);
    }
    satelliteProjectionById.set(projection.satelliteId, projection);
  }

  return createBeamScheduleTrace({
    analysisRunId,
    geometryRunId: run.runId,
    satellites: [...satelliteProjectionById.values()].map(projection => ({
      layout: createCompleteHexBeamLayout({
        satelliteId: projection.satelliteId,
        beamCount: projection.beamLayoutCount,
        halfPowerBeamWidthDeg: projection.halfPowerBeamWidthDeg,
      }),
      mode: projection.mode,
      maxEligiblePerSlot: eligibleBeamCountForVisualLabScenario(
        projection.beamLayoutCount,
        projection.mode,
      ),
    })),
    slots: projections.map(projection => ({
      identity: {
        slotId: `${analysisRunId}:beam-slot:${projection.anchorIndex}`,
        slotIndex: projection.anchorIndex,
        anchorIndex: projection.anchorIndex,
        anchorTimeSec: projection.anchorIndex * run.stepS,
        instantUtc: projection.instantUtc,
      },
      associations: projection.associations,
    })),
  });
}

function normalizeFrameOptions(
  options: SimulationAnalysisFrameBuildOptions | undefined,
): Readonly<SimulationAnalysisFrameBuildOptions> {
  const beamLayoutCount = options?.beamLayoutCount === undefined
    ? undefined
    : assertSupportedBeamLayoutCount(options.beamLayoutCount);
  const overrides = [...(options?.userPositionOverridesKm ?? [])]
    .map(override => Object.freeze({
      userIndex: override.userIndex,
      positionKm: Object.freeze([
        override.positionKm[0],
        override.positionKm[1],
      ] as const),
    }))
    .sort((left, right) => left.userIndex - right.userIndex);
  const perSatelliteBeamLayoutCount = normalizePerSatelliteBeamLayoutCount(options?.perSatelliteBeamLayoutCount);
  const beamIlluminationMode = options?.beamIlluminationMode === undefined
    ? undefined
    : assertSimulatorBeamIlluminationMode(options.beamIlluminationMode);
  return Object.freeze({
    ...(beamLayoutCount === undefined ? {} : { beamLayoutCount }),
    ...(Object.keys(perSatelliteBeamLayoutCount).length === 0 ? {} : { perSatelliteBeamLayoutCount }),
    ...(beamIlluminationMode === undefined ? {} : { beamIlluminationMode }),
    userPositionOverridesKm: Object.freeze(overrides),
    ...(options?.representativeUserIndex === undefined
      ? {}
      : { representativeUserIndex: options.representativeUserIndex }),
  });
}

function validateRunContract(run: TleRunBundle): void {
  if (run.durationS !== TLE_RUN_DURATION_S || run.stepS !== TLE_RUN_STEP_S || run.anchorCount !== TLE_RUN_ANCHOR_COUNT) {
    throw new Error('TleAnalysisRun requires the fixed 7,200-second / 30-second / 241-anchor RunBundle contract');
  }
  if (run.satelliteCount <= 0) throw new Error('TleAnalysisRun requires at least one resolved satellite');
}

/**
 * Compose one immutable analysis run from a completed full-catalog RunBundle.
 * The planner reads only same-instant geometry callbacks; the returned object
 * stores compact pass/anchor identities and retains the RunBundle for all
 * frame materialization and canonical calculations.
 */
export function buildTleAnalysisRun(input: TleAnalysisRunBuildInput): TleAnalysisRun {
  validateRunContract(input.geometryRun);
  const run = input.geometryRun;
  const frameOptions = normalizeFrameOptions(input.frameOptions);
  const geometrySource = geometrySourceForRun(run);
  const passPlan = input.passPlan ?? planPassDiversity(geometrySource, {
    ...DEFAULT_TLE_ANALYSIS_PASS_POLICY,
    ...input.passPolicy,
  });
  if (passPlan.anchorTimesSec.length !== run.anchorCount) {
    throw new Error('pass plan anchor axis does not match the completed geometry run');
  }
  const analysisRunId = createSimulationAnalysisRunId(
    run.runId,
    passPlan.policyRevision,
    input.parameters,
    frameOptions.userPositionOverridesKm?.length === 0
      && Object.keys(frameOptions.perSatelliteBeamLayoutCount ?? {}).length === 0
      && frameOptions.representativeUserIndex === undefined
      && frameOptions.beamLayoutCount === undefined
      && frameOptions.beamIlluminationMode === undefined
      ? undefined
      : frameOptions,
  );
  const plannedAnchorSelections = createAnchorSelections(run, passPlan, analysisRunId);
  const handoverTrace = buildCanonicalTleHandoverTrace({
    analysisRunId,
    geometryRunId: run.runId,
    anchorCount: run.anchorCount,
    policy: DEFAULT_CANONICAL_TLE_HANDOVER_POLICY,
    plannedServingSatelliteId: anchorIndex => plannedAnchorSelections[anchorIndex]?.selectedSatelliteId ?? null,
    resolveComparison: (anchorIndex, activeServingSatelliteId) => comparisonSampleForAnchor(
      input.selection,
      run,
      input.parameters,
      plannedAnchorSelections,
      anchorIndex,
      activeServingSatelliteId,
      frameOptions,
    ),
    resolveTargetSelection: (anchorIndex, targetSatelliteId) => (
      resolvePassPlanTargetSelection(
        passPlan,
        plannedAnchorSelections[anchorIndex]!,
        anchorIndex,
        targetSatelliteId,
      )
    ),
  });
  // The trace, rather than the pass planner, is the authoritative serving
  // sequence consumed by evaluation and frame materialization.
  const anchorSelections = createTraceAnchorSelections(
    run,
    passPlan,
    analysisRunId,
    plannedAnchorSelections,
    handoverTrace,
  );
  const unavailableAnchors = anchorSelections
    .filter(anchor => anchor.selectedSatelliteId === null)
    .map(anchor => anchor.anchorIndex);
  if (unavailableAnchors.length > 0) {
    throw new Error(
      `archived TLE run cannot publish: no real NTPU-visible serving satellite at anchors ${unavailableAnchors.join(', ')}`,
    );
  }
  const runComputation = buildRunComputation(run, anchorSelections, input.parameters, frameOptions);
  const evaluation = runComputation.evaluation;
  const beamScheduleTrace = buildBeamScheduleTraceForRun(
    run,
    anchorSelections,
    input.parameters,
    frameOptions,
    analysisRunId,
    runComputation.beamScheduleProjections,
  );

  const getAnchorSelection = (anchor: number): TleAnalysisRunAnchorSelection => anchorSelections[anchorIndexForRun(run, anchor)]!;
  const getFrame = (anchor: number): SimulationAnalysisFrame | null => {
    const anchorIndex = anchorIndexForRun(run, anchor);
    const anchorSelection = anchorSelections[anchorIndex]!;
    if (anchorSelection.selectedSatelliteId === null) return null;
    const laggedInterferenceUW = runComputation.laggedInterferenceByAnchor[anchorIndex];
    if (laggedInterferenceUW === undefined) {
      throw new Error(`analysis run has no lagged-interference state at anchor ${anchorIndex}`);
    }
    const tleState = createSimulatorTleStateFromRunAnchor(
      input.selection,
      run,
      anchorIndex,
      {
        selectedSatelliteId: anchorSelection.selectedSatelliteId,
        candidateSatelliteId: anchorSelection.candidateSatelliteId,
        identity: anchorSelection.identity,
      } satisfies SimulatorRunAnchorSelection,
    );
    return deepFreeze({
      ...buildSimulationAnalysisFrameWithLaggedInterference(
        tleState,
        input.parameters,
        evaluation,
        frameOptions,
        laggedInterferenceUW,
      ),
      handover: handoverTrace.anchors[anchorIndex],
    });
  };
  const getFrameAtElapsedSec = (elapsedSec: number): SimulationAnalysisFrame | null => (
    getFrame(anchorIndexForElapsedSec(elapsedSec))
  );
  const rebuild = (parameters: SimulatorParameters): TleAnalysisRun => buildTleAnalysisRun({
    selection: input.selection,
    geometryRun: run,
    passPlan,
    parameters,
    frameOptions,
  });
  const rebuildFrameOptions = (options: SimulationAnalysisFrameBuildOptions): TleAnalysisRun => buildTleAnalysisRun({
    selection: input.selection,
    geometryRun: run,
    passPlan,
    parameters: input.parameters,
    frameOptions: options,
  });
  const rebuildExperiment = (
    parameters: SimulatorParameters,
    options: SimulationAnalysisFrameBuildOptions,
  ): TleAnalysisRun => buildTleAnalysisRun({
    selection: input.selection,
    geometryRun: run,
    passPlan,
    parameters,
    frameOptions: options,
  });

  return deepFreeze({
    runId: analysisRunId,
    analysisRunId,
    geometryRunId: run.runId,
    selection: input.selection,
    geometryRun: run,
    passPlan,
    parameters: input.parameters,
    frameOptions,
    evaluation,
    runEvaluation: evaluation,
    durationS: TLE_RUN_DURATION_S,
    stepS: TLE_RUN_STEP_S,
    anchorCount: TLE_RUN_ANCHOR_COUNT,
    anchorSelections,
    handoverTrace,
    beamScheduleTrace,
    getAnchorIndexForElapsedSec: anchorIndexForElapsedSec,
    anchorIndexForElapsedSec,
    getElapsedSecForAnchorIndex: elapsedSecForAnchorIndex,
    getAnchorSelection,
    getFrame,
    frameAt: getFrame,
    getFrameAtElapsedSec,
    withParameters: rebuild,
    withFrameOptions: rebuildFrameOptions,
    withExperiment: rebuildExperiment,
    rebuild,
  });
}

/** Alias for callers that use the shorter “analysis run” name. */
export const createTleAnalysisRun = buildTleAnalysisRun;
/** Alias used by the homepage controller's historical naming seam. */
export const buildSimulationAnalysisRun = buildTleAnalysisRun;

export type TleAnalysisRunSnapshotErrorCode = 'INVALID_SNAPSHOT' | 'IDENTITY_MISMATCH';

export interface TleAnalysisRunSnapshotOptions {
  /** Include every full frame only for small deterministic parity fixtures. */
  readonly includeFrames?: boolean;
}

export class TleAnalysisRunSnapshotError extends Error {
  readonly code: TleAnalysisRunSnapshotErrorCode;

  constructor(code: TleAnalysisRunSnapshotErrorCode, message: string) {
    super(message);
    this.name = 'TleAnalysisRunSnapshotError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function analysisSnapshotFail(
  code: TleAnalysisRunSnapshotErrorCode,
  message: string,
): never {
  throw new TleAnalysisRunSnapshotError(code, message);
}

function analysisSnapshotText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') analysisSnapshotFail('INVALID_SNAPSHOT', `${label} must be a non-empty string`);
  return value.trim();
}

function analysisSnapshotSameJson(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function normalizedSnapshotFrameOptions(
  options: SimulationAnalysisFrameBuildOptions,
): Readonly<SimulationAnalysisFrameBuildOptions> {
  const beamLayoutCount = options.beamLayoutCount === undefined
    ? undefined
    : assertSupportedBeamLayoutCount(options.beamLayoutCount);
  const perSatelliteBeamLayoutCount = normalizePerSatelliteBeamLayoutCount(options.perSatelliteBeamLayoutCount);
  const beamIlluminationMode = options.beamIlluminationMode === undefined
    ? undefined
    : assertSimulatorBeamIlluminationMode(options.beamIlluminationMode);
  return Object.freeze({
    ...(beamLayoutCount === undefined ? {} : { beamLayoutCount }),
    ...(Object.keys(perSatelliteBeamLayoutCount).length === 0 ? {} : { perSatelliteBeamLayoutCount }),
    ...(beamIlluminationMode === undefined ? {} : { beamIlluminationMode }),
    userPositionOverridesKm: Object.freeze([...(options.userPositionOverridesKm ?? [])]
      .map(override => Object.freeze({
        userIndex: override.userIndex,
        positionKm: Object.freeze([override.positionKm[0], override.positionKm[1]] as const),
      }))
      .sort((left, right) => left.userIndex - right.userIndex)),
    ...(options.representativeUserIndex === undefined
      ? {}
      : { representativeUserIndex: options.representativeUserIndex }),
  });
}

function snapshotAnalysisIdentity(
  geometryRunId: string,
  passPolicyRevision: string,
  parameters: SimulatorParameters,
  frameOptions: Readonly<SimulationAnalysisFrameBuildOptions>,
): string {
  const hasScenarioProbe = (frameOptions.userPositionOverridesKm?.length ?? 0) > 0
    || frameOptions.representativeUserIndex !== undefined
    || frameOptions.beamLayoutCount !== undefined
    || Object.keys(frameOptions.perSatelliteBeamLayoutCount ?? {}).length > 0
    || frameOptions.beamIlluminationMode !== undefined;
  return createSimulationAnalysisRunId(
    geometryRunId,
    passPolicyRevision,
    parameters,
    hasScenarioProbe ? frameOptions : undefined,
  );
}

function validateAnalysisSnapshotContract(
  snapshot: TleAnalysisRunSnapshot,
  geometryRun: TleRunBundle,
): void {
  if (snapshot.schema !== TLE_ANALYSIS_RUN_SNAPSHOT_SCHEMA) {
    analysisSnapshotFail('INVALID_SNAPSHOT', 'unsupported TleAnalysisRun snapshot schema');
  }
  const analysisRunId = analysisSnapshotText(snapshot.analysisRunId, 'snapshot.analysisRunId');
  if (snapshot.runId !== analysisRunId) analysisSnapshotFail('IDENTITY_MISMATCH', 'snapshot runId must equal analysisRunId');
  if (snapshot.geometryRunId !== geometryRun.runId || snapshot.geometryRunId !== snapshot.geometryRun.geometryRunId) {
    analysisSnapshotFail('IDENTITY_MISMATCH', 'snapshot geometryRunId disagrees with its geometry snapshot');
  }
  const sourceIdentity = snapshot.sourceIdentity;
  if (sourceIdentity === null || typeof sourceIdentity !== 'object') analysisSnapshotFail('INVALID_SNAPSHOT', 'snapshot source identity is missing');
  if (
    sourceIdentity.archiveId !== geometryRun.archiveId
    || sourceIdentity.publicationSha256 !== geometryRun.publicationSha256
    || sourceIdentity.t0Utc !== geometryRun.t0Utc
    || sourceIdentity.geometryRunId !== geometryRun.runId
  ) analysisSnapshotFail('IDENTITY_MISMATCH', 'snapshot source/TLE identity disagrees with geometry run');
  if (snapshot.selection.catalog.archiveId !== geometryRun.archiveId) {
    analysisSnapshotFail('IDENTITY_MISMATCH', 'snapshot selection catalog disagrees with geometry run');
  }
  if (snapshot.selection.snapshot.sha256 !== geometryRun.publicationSha256) {
    analysisSnapshotFail('IDENTITY_MISMATCH', 'snapshot selected publication SHA disagrees with geometry run');
  }
  if (!analysisSnapshotSameJson(snapshot.selection.manifest, geometryRun.manifest)) {
    analysisSnapshotFail('IDENTITY_MISMATCH', 'snapshot selected manifest disagrees with geometry run manifest');
  }
  if (snapshot.durationS !== TLE_RUN_DURATION_S || snapshot.stepS !== TLE_RUN_STEP_S || snapshot.anchorCount !== TLE_RUN_ANCHOR_COUNT) {
    analysisSnapshotFail('INVALID_SNAPSHOT', 'snapshot analysis axis disagrees with the canonical 7,200/30/241 contract');
  }
  const frameOptions = normalizedSnapshotFrameOptions(snapshot.frameOptions);
  if (!analysisSnapshotSameJson(frameOptions, snapshot.frameOptions)) {
    analysisSnapshotFail('INVALID_SNAPSHOT', 'snapshot frameOptions are not normalized');
  }
  const expectedAnalysisRunId = snapshotAnalysisIdentity(
    geometryRun.runId,
    snapshot.passPlan.policyRevision,
    snapshot.parameters,
    frameOptions,
  );
  if (expectedAnalysisRunId !== analysisRunId) {
    analysisSnapshotFail('IDENTITY_MISMATCH', 'snapshot analysisRunId does not match geometry, policy, parameters, and UE identity');
  }
  if (snapshot.passPlan.anchorTimesSec.length !== geometryRun.anchorCount || snapshot.passPlan.serviceAnchors.length !== geometryRun.anchorCount) {
    analysisSnapshotFail('INVALID_SNAPSHOT', 'snapshot pass plan does not cover every geometry anchor');
  }
  if (snapshot.anchorSelections.length !== geometryRun.anchorCount || snapshot.handoverTrace.anchors.length !== geometryRun.anchorCount) {
    analysisSnapshotFail('INVALID_SNAPSHOT', 'snapshot anchor selection/trace lengths disagree with geometry run');
  }
  if (snapshot.evaluation.sampleCount !== geometryRun.anchorCount - 1 || snapshot.evaluation.durationS !== geometryRun.durationS) {
    analysisSnapshotFail('INVALID_SNAPSHOT', 'snapshot evaluation does not cover the fixed run interval axis');
  }
  if (snapshot.handoverTrace.analysisRunId !== analysisRunId || snapshot.handoverTrace.geometryRunId !== geometryRun.runId) {
    analysisSnapshotFail('IDENTITY_MISMATCH', 'snapshot handover trace identity disagrees with the analysis run');
  }
  if (snapshot.beamScheduleTrace === undefined) {
    analysisSnapshotFail('INVALID_SNAPSHOT', 'snapshot beam schedule trace field is missing');
  }
  if (snapshot.beamScheduleTrace !== null) {
    if (
      snapshot.beamScheduleTrace.analysisRunId !== analysisRunId
      || snapshot.beamScheduleTrace.geometryRunId !== geometryRun.runId
    ) {
      analysisSnapshotFail('IDENTITY_MISMATCH', 'snapshot beam schedule trace identity disagrees with the analysis run');
    }
    if (snapshot.beamScheduleTrace.slots.length !== geometryRun.anchorCount) {
      analysisSnapshotFail('INVALID_SNAPSHOT', 'snapshot beam schedule trace does not cover every accepted anchor');
    }
    try {
      const rebuiltBeamScheduleTrace = createBeamScheduleTrace({
        analysisRunId,
        geometryRunId: geometryRun.runId,
        satellites: snapshot.beamScheduleTrace.satellites.map(satellite => ({
          layout: satellite.layout,
          mode: satellite.policy.mode,
          maxEligiblePerSlot: satellite.policy.maxEligiblePerSlot,
          ...(satellite.policy.mode === 'fixed'
            ? { fixedBeamIds: satellite.policy.fixedBeamIds }
            : {}),
        })),
        slots: snapshot.beamScheduleTrace.slots.map(slot => ({
          identity: slot.identity,
          associations: slot.associations,
        })),
      });
      if (!analysisSnapshotSameJson(rebuiltBeamScheduleTrace, snapshot.beamScheduleTrace)) {
        analysisSnapshotFail('IDENTITY_MISMATCH', 'snapshot beam schedule trace digest or realization is stale');
      }
    } catch (error) {
      if (error instanceof TleAnalysisRunSnapshotError) throw error;
      analysisSnapshotFail('INVALID_SNAPSHOT', `snapshot beam schedule trace is invalid: ${String(error)}`);
    }
  } else if (
    frameOptions.beamLayoutCount !== undefined
    || Object.keys(frameOptions.perSatelliteBeamLayoutCount ?? {}).length > 0
    || frameOptions.beamIlluminationMode !== undefined
  ) {
    analysisSnapshotFail('INVALID_SNAPSHOT', 'complete-ring snapshot is missing its beam schedule trace');
  }
  if (snapshot.frames !== undefined && snapshot.frames.length !== geometryRun.anchorCount) {
    analysisSnapshotFail('INVALID_SNAPSHOT', 'snapshot canonical frame count disagrees with geometry run');
  }
  const satelliteIds = new Set(geometryRun.satellites.map(satellite => satellite.satelliteId));
  for (let anchorIndex = 0; anchorIndex < geometryRun.anchorCount; anchorIndex += 1) {
    const selection = snapshot.anchorSelections[anchorIndex];
    const trace = snapshot.handoverTrace.anchors[anchorIndex];
    const beamSlot = snapshot.beamScheduleTrace?.slots[anchorIndex];
    const frame = snapshot.frames?.[anchorIndex];
    if (selection === undefined || trace === undefined) {
      analysisSnapshotFail('INVALID_SNAPSHOT', `snapshot is missing anchor ${anchorIndex}`);
    }
    if (
      selection.anchorIndex !== anchorIndex
      || selection.identity.anchorIndex !== anchorIndex
      || selection.identity.runId !== analysisRunId
      || selection.identity.geometryRunId !== geometryRun.runId
      || selection.identity.anchorCount !== geometryRun.anchorCount
      || selection.identity.elapsedSec !== anchorIndex * geometryRun.stepS
    ) analysisSnapshotFail('IDENTITY_MISMATCH', `snapshot anchor identity mismatch at ${anchorIndex}`);
    if (selection.selectedSatelliteId !== null && !satelliteIds.has(selection.selectedSatelliteId)) {
      analysisSnapshotFail('IDENTITY_MISMATCH', `snapshot serving satellite is absent at anchor ${anchorIndex}`);
    }
    if (selection.candidateSatelliteId !== null && (!satelliteIds.has(selection.candidateSatelliteId) || selection.candidateSatelliteId === selection.selectedSatelliteId)) {
      analysisSnapshotFail('IDENTITY_MISMATCH', `snapshot candidate satellite is invalid at anchor ${anchorIndex}`);
    }
    if (
      trace.anchorIndex !== anchorIndex
      || trace.servingSatelliteId !== selection.selectedSatelliteId
      || trace.candidateSatelliteId !== selection.candidateSatelliteId
    ) analysisSnapshotFail('IDENTITY_MISMATCH', `snapshot handover identity mismatch at ${anchorIndex}`);
    if (beamSlot !== undefined && (
      beamSlot.identity.anchorIndex !== anchorIndex
      || beamSlot.identity.slotIndex !== anchorIndex
      || beamSlot.identity.anchorTimeSec !== anchorIndex * geometryRun.stepS
      || beamSlot.identity.instantUtc !== geometryRun.getAnchorUtc(anchorIndex)
    )) analysisSnapshotFail('IDENTITY_MISMATCH', `snapshot beam schedule identity mismatch at ${anchorIndex}`);
    if (beamSlot !== undefined) {
      if (beamSlot.associations.length !== 100) {
        analysisSnapshotFail('INVALID_SNAPSHOT', `snapshot beam schedule UE domain is incomplete at ${anchorIndex}`);
      }
      if (beamSlot.associations.some(association => (
        association.satelliteId !== selection.selectedSatelliteId
        || association.beamId === null
      ))) {
        analysisSnapshotFail('IDENTITY_MISMATCH', `snapshot beam schedule service ownership disagrees at ${anchorIndex}`);
      }
    }
    if (frame !== undefined) {
      if (
        frame.instantUtc !== geometryRun.getAnchorUtc(anchorIndex)
        || frame.selectedSatelliteId !== selection.selectedSatelliteId
        || frame.parameters === undefined
        || !analysisSnapshotSameJson(frame.parameters, snapshot.parameters)
      ) analysisSnapshotFail('IDENTITY_MISMATCH', `snapshot canonical frame identity mismatch at ${anchorIndex}`);
      if (
        frame.runAnchor === undefined
        || frame.runAnchor.runId !== analysisRunId
        || frame.runAnchor.geometryRunId !== geometryRun.runId
        || frame.runAnchor.anchorIndex !== anchorIndex
        || frame.tleState.runAnchor?.runId !== analysisRunId
        || frame.tleState.runAnchor?.geometryRunId !== geometryRun.runId
        || frame.tleState.runAnchor?.anchorIndex !== anchorIndex
      ) analysisSnapshotFail('IDENTITY_MISMATCH', `snapshot canonical run anchor mismatch at ${anchorIndex}`);
      if (beamSlot !== undefined) {
        const satelliteSlot = beamSlot.satelliteSlots.find(item => item.satelliteId === frame.selectedSatelliteId);
        if (
          satelliteSlot === undefined
          || !analysisSnapshotSameJson(satelliteSlot.beamLoad, frame.scenario.beamLoadB)
          || !analysisSnapshotSameJson(satelliteSlot.activeBeamMask, frame.scenario.beamActiveB)
          || !analysisSnapshotSameJson(satelliteSlot.eligibleBeamIds, frame.scenario.beamIllumination.eligibleBeamIds)
        ) analysisSnapshotFail('IDENTITY_MISMATCH', `snapshot beam schedule realization disagrees with canonical frame at ${anchorIndex}`);
      }
    }
  }
}

/**
 * Snapshot the completed analysis identities/evaluation after the producer
 * has composed the run.  The default Worker payload deliberately omits the
 * repeated full-constellation frame cache; hydration can compose a requested
 * frame from the frozen geometry/evaluation/trace without rerunning SGP4,
 * pass planning, or handover analysis. `includeFrames` is retained for small
 * parity fixtures that need direct frame-cache transport.
 */
export function createTleAnalysisRunSnapshot(
  run: TleAnalysisRun,
  options: TleAnalysisRunSnapshotOptions = {},
): TleAnalysisRunSnapshot {
  const geometryRun = createTleRunBundleSnapshot(run.geometryRun);
  const frames = options.includeFrames === true
    ? (() => {
      const result: SimulationAnalysisFrame[] = [];
      for (let anchorIndex = 0; anchorIndex < run.anchorCount; anchorIndex += 1) {
        const frame = run.getFrame(anchorIndex);
        if (frame === null || frame === undefined) {
          analysisSnapshotFail('INVALID_SNAPSHOT', `completed analysis run has no frame at anchor ${anchorIndex}`);
        }
        result.push(frame);
      }
      return result;
    })()
    : undefined;
  if (frames !== undefined && frames.length !== run.anchorCount) {
    analysisSnapshotFail('INVALID_SNAPSHOT', 'requested analysis frame cache is incomplete');
  }
  const snapshot: TleAnalysisRunSnapshot = {
    schema: TLE_ANALYSIS_RUN_SNAPSHOT_SCHEMA,
    runId: run.runId,
    analysisRunId: run.analysisRunId,
    geometryRunId: run.geometryRunId,
    sourceIdentity: {
      archiveId: run.geometryRun.archiveId,
      publicationSha256: run.geometryRun.publicationSha256,
      t0Utc: run.geometryRun.t0Utc,
      geometryRunId: run.geometryRunId,
    },
    selection: run.selection,
    geometryRun,
    passPlan: run.passPlan,
    parameters: run.parameters,
    frameOptions: run.frameOptions,
    evaluation: run.evaluation,
    durationS: TLE_RUN_DURATION_S,
    stepS: TLE_RUN_STEP_S,
    anchorCount: TLE_RUN_ANCHOR_COUNT,
    anchorSelections: run.anchorSelections,
    handoverTrace: run.handoverTrace,
    beamScheduleTrace: run.beamScheduleTrace,
    ...(frames === undefined ? {} : { frames }),
  };
  // Keep the typed-array geometry storage transferable; freeze all other
  // records so a local producer cannot mutate the snapshot after admission.
  return Object.freeze({
    ...snapshot,
    selection: deepFreeze(snapshot.selection),
    passPlan: deepFreeze(snapshot.passPlan),
    parameters: deepFreeze({ ...snapshot.parameters }),
    frameOptions: deepFreeze(snapshot.frameOptions),
    evaluation: deepFreeze({ ...snapshot.evaluation }),
    anchorSelections: deepFreeze(snapshot.anchorSelections),
    handoverTrace: deepFreeze(snapshot.handoverTrace),
    beamScheduleTrace: snapshot.beamScheduleTrace === null
      ? null
      : deepFreeze(snapshot.beamScheduleTrace),
    ...(frames === undefined ? {} : { frames: deepFreeze(frames) }),
  });
}

/*
 * Keep this small helper next to the snapshot seam so both the normal builder
 * and the hydrated facade use the exact same frame composition path.
 */
function materializeHydratedAnalysisFrame(
  selection: LoadedTleSnapshotSelection,
  geometryRun: TleRunBundle,
  parameters: SimulatorParameters,
  frameOptions: Readonly<SimulationAnalysisFrameBuildOptions>,
  evaluation: SimulatorRunEvaluation,
  handoverTrace: CanonicalTleHandoverTrace,
  anchorSelections: readonly TleAnalysisRunAnchorSelection[],
  laggedInterferenceByAnchor: readonly (readonly number[])[],
  anchor: number,
): SimulationAnalysisFrame | null {
  const anchorIndex = anchorIndexForRun(geometryRun, anchor);
  const anchorSelection = anchorSelections[anchorIndex];
  if (anchorSelection === undefined || anchorSelection.selectedSatelliteId === null) return null;
  const laggedInterferenceUW = laggedInterferenceByAnchor[anchorIndex];
  if (laggedInterferenceUW === undefined) {
    throw new Error(`hydrated analysis run has no lagged-interference state at anchor ${anchorIndex}`);
  }
  const tleState = createSimulatorTleStateFromRunAnchor(
    selection,
    geometryRun,
    anchorIndex,
    {
      selectedSatelliteId: anchorSelection.selectedSatelliteId,
      candidateSatelliteId: anchorSelection.candidateSatelliteId,
      identity: anchorSelection.identity,
    } satisfies SimulatorRunAnchorSelection,
  );
  return deepFreeze({
    ...buildSimulationAnalysisFrameWithLaggedInterference(
      tleState,
      parameters,
      evaluation,
      frameOptions,
      laggedInterferenceUW,
    ),
    handover: handoverTrace.anchors[anchorIndex],
  });
}

/**
 * Recreate the random-access analysis facade from an accepted Worker
 * snapshot. No pass planning, SGP4 propagation, or full analysis-run rebuild
 * occurs in this function; a requested uncached frame reuses the stored
 * evaluation and handover identities through the canonical frame composer.
 */
export function hydrateTleAnalysisRunSnapshot(snapshot: TleAnalysisRunSnapshot): TleAnalysisRun {
  if (snapshot === null || typeof snapshot !== 'object') analysisSnapshotFail('INVALID_SNAPSHOT', 'TleAnalysisRun snapshot must be an object');
  const geometryRun = hydrateTleRunBundle(snapshot.geometryRun);
  validateAnalysisSnapshotContract(snapshot, geometryRun);
  const selection = deepFreeze(snapshot.selection);
  const passPlan = deepFreeze(snapshot.passPlan);
  const parameters = deepFreeze({ ...snapshot.parameters });
  const frameOptions = deepFreeze(normalizedSnapshotFrameOptions(snapshot.frameOptions));
  const evaluation = deepFreeze({ ...snapshot.evaluation });
  const anchorSelections = deepFreeze(snapshot.anchorSelections);
  const handoverTrace = deepFreeze(snapshot.handoverTrace);
  const beamScheduleTrace = snapshot.beamScheduleTrace === null
    ? null
    : deepFreeze(snapshot.beamScheduleTrace);
  const frames = snapshot.frames === undefined ? undefined : deepFreeze(snapshot.frames);
  // The snapshot intentionally carries geometry and accepted identities, not
  // UI state. Rebuild the deterministic canonical carry trace from those
  // inputs so uncached hydrated frames use the same previous-anchor estimate
  // as the original accepted run.
  const runComputation = buildRunComputation(
    geometryRun,
    anchorSelections,
    parameters,
    frameOptions,
  );
  if (!analysisSnapshotSameJson(runComputation.evaluation, evaluation)) {
    analysisSnapshotFail('IDENTITY_MISMATCH', 'snapshot evaluation disagrees with the canonical lagged-interference rebuild');
  }
  const getAnchorSelection = (anchor: number): TleAnalysisRunAnchorSelection => anchorSelections[anchorIndexForRun(geometryRun, anchor)]!;
  const getFrame = (anchor: number): SimulationAnalysisFrame | null => {
    const anchorIndex = anchorIndexForRun(geometryRun, anchor);
    if (frames !== undefined) return frames[anchorIndex] ?? null;
    return materializeHydratedAnalysisFrame(
      selection,
      geometryRun,
      parameters,
      frameOptions,
      evaluation,
      handoverTrace,
      anchorSelections,
      runComputation.laggedInterferenceByAnchor,
      anchorIndex,
    );
  };
  const getFrameAtElapsedSec = (elapsedSec: number): SimulationAnalysisFrame | null => getFrame(anchorIndexForElapsedSec(elapsedSec));
  const rebuild = (nextParameters: SimulatorParameters): TleAnalysisRun => buildTleAnalysisRun({
    selection,
    geometryRun,
    passPlan,
    parameters: nextParameters,
    frameOptions,
  });
  const rebuildFrameOptions = (nextOptions: SimulationAnalysisFrameBuildOptions): TleAnalysisRun => buildTleAnalysisRun({
    selection,
    geometryRun,
    passPlan,
    parameters,
    frameOptions: nextOptions,
  });
  const rebuildExperiment = (
    nextParameters: SimulatorParameters,
    nextOptions: SimulationAnalysisFrameBuildOptions,
  ): TleAnalysisRun => buildTleAnalysisRun({
    selection,
    geometryRun,
    passPlan,
    parameters: nextParameters,
    frameOptions: nextOptions,
  });
  return deepFreeze({
    runId: snapshot.analysisRunId,
    analysisRunId: snapshot.analysisRunId,
    geometryRunId: geometryRun.runId,
    selection,
    geometryRun,
    passPlan,
    parameters,
    frameOptions,
    evaluation,
    runEvaluation: evaluation,
    durationS: TLE_RUN_DURATION_S,
    stepS: TLE_RUN_STEP_S,
    anchorCount: TLE_RUN_ANCHOR_COUNT,
    anchorSelections,
    handoverTrace,
    beamScheduleTrace,
    getAnchorIndexForElapsedSec: anchorIndexForElapsedSec,
    anchorIndexForElapsedSec,
    getElapsedSecForAnchorIndex: elapsedSecForAnchorIndex,
    getAnchorSelection,
    getFrame,
    frameAt: getFrame,
    getFrameAtElapsedSec,
    withParameters: rebuild,
    withFrameOptions: rebuildFrameOptions,
    withExperiment: rebuildExperiment,
    rebuild,
  });
}

export const snapshotTleAnalysisRun = createTleAnalysisRunSnapshot;
export const createTleAnalysisSnapshot = createTleAnalysisRunSnapshot;
export const hydrateTleAnalysisRun = hydrateTleAnalysisRunSnapshot;
export const restoreTleAnalysisRun = hydrateTleAnalysisRunSnapshot;
