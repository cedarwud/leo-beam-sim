import { HandoverManager } from '../engine/handover/handover-manager';
import { DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE } from '../engine/handover/eeThreshold';
import {
  DEFAULT_UE_MOBILITY_PARAMS,
  createMobilityStates,
  type UeMobilityMode,
  type UeMobilityParams,
} from '../engine/ue/multiUeMobility';
import type { UeDistributionMode, UePrimaryAnchorMode } from '../engine/ue/multiUeState';
import { createObserverContext } from '../engine/orbit';
import type { Profile } from '../profiles/types';
import {
  requireProfileWalkerConstellationSeed,
  WALKER_CONSTELLATION_PHASE_MODEL_VERSION,
} from '../engine/orbit';
import {
  buildSinrLiveCellLayout,
  createSinrLiveCellModel,
  attachSinrLiveCellFrame,
  resolveSinrLiveSceneCellCount,
} from './sinrLiveCellRuntime';
import {
  cellIdFromLinkBudgetBeamId,
  type UeCellServingRecord,
} from './sinrLiveCellModel';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  stepRuntimeFrame,
} from './runtimeFrameStep';
import type { UeDistributionScope } from './types';
import {
  LIVE_WALKER_HANDOVER_EVENT_INDEX_DEFAULT_STEP_SEC,
  LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC,
  LIVE_WALKER_HANDOVER_EVENT_INDEX_PRIMARY_UE_ID,
  clampLiveWalkerEventSourceTimeSec,
  type LiveWalkerHandoverEvent,
  type LiveWalkerHandoverEventIndex,
  type LiveWalkerHandoverEventKind,
  type LiveWalkerHandoverEventIndexGeneration,
  type LiveWalkerHandoverEventIndexUeScope,
} from './liveWalkerHandoverEventIndex';

export interface BuildSinrLiveCellHandoverEventIndexInput {
  readonly profile: Profile;
  readonly epochUtcMs: number;
  readonly simStepSec?: number;
  readonly ueCount?: number;
  readonly ueDistributionMode?: UeDistributionMode;
  readonly uePrimaryAnchorMode?: UePrimaryAnchorMode;
  readonly ueDistributionScope?: UeDistributionScope;
  readonly ueDistributionRadiusKm?: number;
  readonly ueMobilityMode?: UeMobilityMode;
  readonly ueMobilityParams?: UeMobilityParams;
  /**
   * Which UE population the offline teaching index records. The live scene
   * may still render its full population; `primary-ue-only` is an explicit
   * navigation scope, not a second decision source or a fake event list.
   */
  readonly eventUeScope?: LiveWalkerHandoverEventIndexUeScope;
  /** The same inspected-cell viewpoint used by the live SINR cell model. */
  readonly focusCellId?: number | null;
  readonly beamCountBySatellite?: Readonly<Record<string, number>>;
  /** Must match the live scene's role-specific display/scheduler budgets. */
  readonly servingBeamCount?: number;
  readonly candidateBeamCount?: number;
  /** Must match the live scene; omitted keeps the model's historical default. */
  readonly beamHoppingEnabled?: boolean;
  /** Must match the live scene's steering mode; omitted keeps the historical default. */
  readonly beamPointingMode?: 'earth-fixed-cell' | 'sampled-steering';
  /** Must match the live homepage authority gate; omitted keeps the historical default. */
  readonly multiCandidateDecisionEnabled?: boolean;
  /** Must match the live homepage candidate EE floor, in Kbit/J. */
  readonly eeThresholdKbitPerJoule?: number;
  /** Must match the live primary UE source geometry; omitted keeps the zero-jog default. */
  readonly primaryJogEastKm?: number;
  readonly primaryJogNorthKm?: number;
}

/**
 * The only early-readiness window the homepage teaching timeline may consume.
 * This is a source-time prefix of the same 7200-second scan, not a shorter
 * replacement horizon.
 */
export const SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_PREVIEW_DURATION_SEC = 60 as const;

/**
 * Explicitly non-complete receipt for the homepage's source-backed teaching
 * prefix. It deliberately does not satisfy `LiveWalkerHandoverEventIndex`:
 * callers must handle `complete: false` and `horizonKind: ...-prefix` instead of
 * accidentally treating a partial event list as the 7200-second index.
 */
export interface SinrLiveCellHandoverEventIndexPreview {
  readonly sourceOwner: 'sinr-live-cell-truth';
  readonly horizonKind: 'live-walker-window-prefix';
  readonly claimKind: 'live-truth';
  readonly readiness: 'preview';
  readonly complete: false;
  readonly sourceWindow: {
    readonly startSec: 0;
    readonly endSec: typeof SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_PREVIEW_DURATION_SEC;
  };
  readonly coveredThroughSec: typeof SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_PREVIEW_DURATION_SEC;
  readonly sourceDurationSec: typeof LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC;
  readonly ueScope: LiveWalkerHandoverEventIndexUeScope;
  readonly primaryUeId: string;
  readonly aggregateUeCount: number;
  readonly aggregateClaim: 'not-100-ue-aggregate-prefix' | 'cell-truth-event-index-prefix';
  readonly generation: LiveWalkerHandoverEventIndexGeneration;
  readonly offsetDb: number;
  readonly sourceGapReasons: readonly string[];
  readonly events: readonly LiveWalkerHandoverEvent[];
}

interface UeServingSnapshot {
  readonly ueId: string;
  readonly cellId: number;
  /** Geographic membership remains separate from the serving beam identity. */
  readonly geographicCellId?: number | null;
  readonly servingSatId: string;
  /** Homepage same-cell intra switches need the real beam key, not only cellId. */
  readonly servingBeamId?: number | null;
  readonly beamIdentity: string;
  readonly frequencyIndex: number | null;
  readonly sinrDb: number | null;
  readonly offAxisDeg: number;
}

function finitePositiveOrFallback(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function finiteCountOrFallback(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.trunc(value))
    : fallback;
}

function resolveEventUeScope(
  value: LiveWalkerHandoverEventIndexUeScope | undefined,
): LiveWalkerHandoverEventIndexUeScope {
  return value === 'primary-ue-only' ? 'primary-ue-only' : 'cell-truth-ue-events';
}

function roundTimeSec(value: number): number {
  return Number(value.toFixed(6));
}

/**
 * Resolve the logical cell represented by a UE's current serving identity.
 * Geographic membership and serving beam/cell are intentionally separate in
 * the SINR cell model; an intra-satellite switch can keep the former unchanged.
 */
export function resolveUeServingCellId(record: Pick<UeCellServingRecord, 'cellId' | 'servingBeamId'>): number | null {
  return typeof record.servingBeamId === 'number' && Number.isFinite(record.servingBeamId)
    ? cellIdFromLinkBudgetBeamId(record.servingBeamId)
    : record.cellId;
}

function formatScalar(value: string | number | null | undefined): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'unset';
  return value ?? 'unset';
}

function formatBeamCountBySatellite(
  beamCountBySatellite: Readonly<Record<string, number>> | undefined,
): string {
  return Object.entries(beamCountBySatellite ?? {})
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([satelliteId, beamCount]) => `${satelliteId}:${formatScalar(beamCount)}`)
    .join(',');
}

function buildHandoverPolicyKey(profile: Profile): string {
  const handover = profile.handover;
  return [
    `policy=${handover.policy}`,
    `sinrThresholdDb=${handover.sinrThresholdDb}`,
    `offsetDb=${handover.offsetDb}`,
    `triggerTimeSec=${handover.triggerTimeSec}`,
    `pingPongGuardSec=${handover.pingPongGuardSec}`,
    `pendingTargetHoldSec=${handover.pendingTargetHoldSec}`,
    `intraSwitchTimeSec=${handover.intraSwitchTimeSec}`,
    `maxIntraSwitchesPerServingEpoch=${handover.maxIntraSwitchesPerServingEpoch ?? 'unset'}`,
    `sinrSmoothingSec=${handover.sinrSmoothingSec}`,
  ].join('|');
}

function buildCellTruthTopologyKey(input: {
  readonly profile: Profile;
  readonly ueCount: number;
  readonly ueDistributionMode: UeDistributionMode;
  readonly uePrimaryAnchorMode: UePrimaryAnchorMode;
  readonly ueDistributionScope: UeDistributionScope;
  readonly ueDistributionRadiusKm: number | undefined;
  readonly ueMobilityMode: UeMobilityMode;
  readonly eventUeScope: LiveWalkerHandoverEventIndexUeScope;
  readonly focusCellId: number | null | undefined;
  readonly beamCountBySatellite?: Readonly<Record<string, number>>;
  readonly servingBeamCount?: number;
  readonly candidateBeamCount?: number;
  readonly beamHoppingEnabled?: boolean;
  readonly beamPointingMode?: 'earth-fixed-cell' | 'sampled-steering';
  readonly multiCandidateDecisionEnabled?: boolean;
  readonly eeThresholdKbitPerJoule?: number;
  readonly primaryJogEastKm?: number;
  readonly primaryJogNorthKm?: number;
}): string {
  const { profile } = input;
  return [
    `ueScope=${input.eventUeScope}`,
    `primaryUeId=${LIVE_WALKER_HANDOVER_EVENT_INDEX_PRIMARY_UE_ID}`,
    `ueCount=${input.ueCount}`,
    `orbitObserver=${profile.orbit.observerLatDeg},${profile.orbit.observerLonDeg}`,
    `orbitPhase=${WALKER_CONSTELLATION_PHASE_MODEL_VERSION}:${requireProfileWalkerConstellationSeed(profile)}`,
    `orbitShells=${profile.orbit.shells.map(shell => `${shell.id}:${shell.planes}x${shell.satsPerPlane}`).join(',')}`,
    `ueDistributionMode=${input.ueDistributionMode}`,
    `uePrimaryAnchorMode=${input.uePrimaryAnchorMode}`,
    `ueDistributionScope=${input.ueDistributionScope}`,
    `ueDistributionRadiusKm=${formatScalar(input.ueDistributionRadiusKm)}`,
    `ueMobilityMode=${input.ueMobilityMode}`,
    `focusCellId=${formatScalar(input.focusCellId)}`,
    `beamCountBySatellite=${formatBeamCountBySatellite(input.beamCountBySatellite)}`,
    `servingBeamCount=${formatScalar(input.servingBeamCount)}`,
    `candidateBeamCount=${formatScalar(input.candidateBeamCount)}`,
    `beamHoppingEnabled=${input.beamHoppingEnabled ?? 'unset'}`,
    `beamPointingMode=${input.beamPointingMode ?? 'unset'}`,
    `multiCandidateDecisionEnabled=${input.multiCandidateDecisionEnabled ?? 'unset'}`,
    `eeThresholdKbitPerJoule=${formatScalar(input.eeThresholdKbitPerJoule)}`,
    `primaryJogEastKm=${formatScalar(input.primaryJogEastKm)}`,
    `primaryJogNorthKm=${formatScalar(input.primaryJogNorthKm)}`,
  ].join('|');
}

function createEmptySinrLiveCellIndex(
  input: BuildSinrLiveCellHandoverEventIndexInput,
  simStepSec: number,
  ueCount: number,
  sourceGapReasons: readonly string[],
): LiveWalkerHandoverEventIndex {
  const ueDistributionMode = input.ueDistributionMode ?? 'random';
  const uePrimaryAnchorMode = input.uePrimaryAnchorMode ?? 'observer';
  const ueDistributionScope = input.ueDistributionScope ?? 'beam-footprint';
  const ueMobilityMode = input.ueMobilityMode ?? 'static';
  const eventUeScope = resolveEventUeScope(input.eventUeScope);

  return {
    sourceOwner: 'sinr-live-cell-truth',
    horizonKind: 'live-walker-window',
    // SOURCE axis: the rendered SINR is leo's real cell-truth (verbatim from the
    // engine HandoverEvent), so this is 'live-truth', NOT a profile projection.
    // The coarse-offline-step TIMING caveat is a separate axis carried by
    // EVENT_INDEX_COARSE_FORECAST_NOTE / the cinema explainer (S4-4 D4); do not
    // conflate them by flipping this to 'profile-derived-forecast'.
    claimKind: 'live-truth',
    durationSec: LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC,
    ueScope: eventUeScope,
    primaryUeId: LIVE_WALKER_HANDOVER_EVENT_INDEX_PRIMARY_UE_ID,
    aggregateUeCount: ueCount,
    aggregateClaim: eventUeScope === 'primary-ue-only'
      ? 'not-100-ue-aggregate'
      : 'cell-truth-event-index',
    generation: {
      profileId: input.profile.id,
      epochUtcMs: input.epochUtcMs,
      simStepSec,
      handoverPolicyKey: buildHandoverPolicyKey(input.profile),
      topologyKey: buildCellTruthTopologyKey({
        profile: input.profile,
        ueCount,
        ueDistributionMode,
        uePrimaryAnchorMode,
        ueDistributionScope,
        ueDistributionRadiusKm: input.ueDistributionRadiusKm,
        ueMobilityMode,
        eventUeScope,
        focusCellId: input.focusCellId,
        beamCountBySatellite: input.beamCountBySatellite,
        servingBeamCount: input.servingBeamCount,
        candidateBeamCount: input.candidateBeamCount,
        beamHoppingEnabled: input.beamHoppingEnabled,
        beamPointingMode: input.beamPointingMode,
        multiCandidateDecisionEnabled: input.multiCandidateDecisionEnabled,
        eeThresholdKbitPerJoule: input.eeThresholdKbitPerJoule,
        primaryJogEastKm: input.primaryJogEastKm,
        primaryJogNorthKm: input.primaryJogNorthKm,
      }),
      runtimeFramePath: 'stepRuntimeFrame+sinrLiveCells',
    },
    offsetDb: input.profile.handover.offsetDb,
    sourceGapReasons,
    events: [],
  };
}

function eventId(sequence: number, sourceTimeSec: number, kind: LiveWalkerHandoverEventKind, ueId: string): string {
  const timeToken = sourceTimeSec.toFixed(3).replace(/[^0-9]+/g, '_');
  const ueToken = ueId.replace(/[^a-zA-Z0-9_-]+/g, '_');
  return `sinr-cell-${ueToken}-${String(sequence).padStart(4, '0')}-${timeToken}-${kind}`;
}

function compareCellTruthEvents(left: LiveWalkerHandoverEvent, right: LiveWalkerHandoverEvent): number {
  return left.sourceTimeSec - right.sourceTimeSec
    || left.kind.localeCompare(right.kind)
    || (left.ueId ?? '').localeCompare(right.ueId ?? '')
    || left.id.localeCompare(right.id);
}

function cadenceLandsOnPreviewWindow(simStepSec: number): boolean {
  const sampleCount = SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_PREVIEW_DURATION_SEC / simStepSec;
  return Number.isFinite(sampleCount)
    && Math.abs(sampleCount - Math.round(sampleCount)) <= 1e-9;
}

function toSnapshot(record: UeCellServingRecord): UeServingSnapshot | null {
  // `cellId` is geographic membership.  During homepage multi-candidate
  // decisions the primary UE can keep that membership while the authority
  // selects another beam/cell on the same satellite (a real intra event).  The
  // serving identity therefore comes from the beam surrogate; using membership
  // here silently erased every same-satellite cell switch from the event index.
  const servingCellId = resolveUeServingCellId(record);
  if (
    servingCellId === null
    || record.servingSatId === null
    || record.beamIdentity === null
  ) {
    return null;
  }
  return {
    ueId: record.ueId,
    cellId: servingCellId,
    geographicCellId: record.cellId,
    servingSatId: record.servingSatId,
    servingBeamId: record.servingBeamId,
    beamIdentity: record.beamIdentity,
    frequencyIndex: record.frequencyIndex,
    sinrDb: record.sinrDb,
    offAxisDeg: record.offAxisDeg,
  };
}

export function createSinrLiveCellHandoverEventFromUeTransition(input: {
  readonly previous: UeServingSnapshot;
  readonly current: UeServingSnapshot;
  readonly handoverKind: UeCellServingRecord['handoverKind'];
  readonly sourceTimeSec: number;
  readonly offsetDb: number;
  readonly sequence: number;
}): LiveWalkerHandoverEvent | null {
  const kind: LiveWalkerHandoverEventKind | null =
    input.handoverKind === 'intra'
      ? 'intra'
      : input.handoverKind === 'inter'
        ? 'inter'
        : null;
  if (kind === null) return null;

  if (kind === 'intra') {
    if (input.previous.servingSatId !== input.current.servingSatId) return null;
    // Intra-cell is a same-geographic-cell beam switch. The old cell-truth
    // adapter rejected equal cell ids, which erased the canonical homepage
    // one-cell case because the source and target beams intentionally share
    // one geographic cell. Keep the membership check explicit, then require a
    // distinct beam identity so an unchanged serving assignment is not an HO.
    const previousGeographicCellId = input.previous.geographicCellId ?? input.previous.cellId;
    const currentGeographicCellId = input.current.geographicCellId ?? input.current.cellId;
    if (previousGeographicCellId !== currentGeographicCellId) return null;
    const sameBeam = input.previous.servingBeamId !== undefined
      && input.current.servingBeamId !== undefined
      && input.previous.servingBeamId !== null
      && input.current.servingBeamId !== null
      ? input.previous.servingBeamId === input.current.servingBeamId
      : input.previous.beamIdentity === input.current.beamIdentity;
    if (sameBeam) return null;
  }
  if (kind === 'inter' && input.previous.servingSatId === input.current.servingSatId) return null;
  if (input.previous.ueId !== input.current.ueId) return null;

  const sourceTimeSec = clampLiveWalkerEventSourceTimeSec(roundTimeSec(input.sourceTimeSec));
  const fromSinrDb = Number.isFinite(input.previous.sinrDb ?? NaN) ? input.previous.sinrDb : null;
  const toSinrDb = Number.isFinite(input.current.sinrDb ?? NaN) ? input.current.sinrDb : null;
  if (toSinrDb === null) return null;
  const deltaDb = fromSinrDb === null ? null : Number((toSinrDb - fromSinrDb).toFixed(6));
  const fromCellId = input.previous.geographicCellId ?? input.previous.cellId;
  const toCellId = input.current.geographicCellId ?? input.current.cellId;

  return {
    id: eventId(input.sequence, sourceTimeSec, kind, input.current.ueId),
    sourceTimeSec,
    kind,
    fromSatId: input.previous.servingSatId,
    // Cell-truth rows retain the geographic cell identity and, when the
    // homepage model provides it, the distinct serving beam id as well. Legacy
    // hand-authored rows can still omit the optional beam id.
    fromBeamId: input.previous.servingBeamId ?? null,
    toSatId: input.current.servingSatId,
    toBeamId: input.current.servingBeamId ?? null,
    ueId: input.current.ueId,
    // Event cell ids are the geographic scene cells. The serving beam id is
    // allowed to lag membership for one pre-commit frame; using that logical
    // beam cell here would render a same-cell intra as two different cells.
    fromCellId,
    toCellId,
    fromBeamIdentity: input.previous.beamIdentity,
    toBeamIdentity: input.current.beamIdentity,
    fromFrequencyIndex: input.previous.frequencyIndex,
    toFrequencyIndex: input.current.frequencyIndex,
    fromOffAxisDeg: input.previous.offAxisDeg,
    toOffAxisDeg: input.current.offAxisDeg,
    fromSinrDb,
    toSinrDb,
    deltaDb,
    sourceStartSec: clampLiveWalkerEventSourceTimeSec(roundTimeSec(sourceTimeSec - 10)),
    sourceEndSec: clampLiveWalkerEventSourceTimeSec(roundTimeSec(sourceTimeSec + 20)),
    clickTargetSec: sourceTimeSec,
    primaryUeId: LIVE_WALKER_HANDOVER_EVENT_INDEX_PRIMARY_UE_ID,
    count: 1,
  };
}

/**
 * Resumable driver for the offline cell-truth handover scan.
 *
 * The scan re-runs the sim over the full 7200 s × `ueCount`-UE window
 * (~240 coarse steps) and is build-cost-heavy (~8 s for 100 UEs). Running it in
 * one synchronous burst on lane entry starved the first live-scene paint, so the
 * App drives it INCREMENTALLY across `requestIdleCallback` slices (one ~30 ms sim
 * step blocks at most), yielding to the canvas between slices.
 *
 * Truth invariant (Rule#2/#6): the chunked output is byte-identical to the
 * one-shot build regardless of slice size — `buildSinrLiveCellHandoverEventIndex`
 * IS this builder drained in a single slice, so there is one code path. The
 * slice-size invariance is pinned by `validate:sinr-live:handover-index-chunked-golden`.
 */
export interface SinrLiveCellHandoverEventIndexBuilder {
  /** Total coarse sim steps the scan will run (for progress display only). */
  readonly totalSteps: number;
  /** Steps run so far. */
  stepsCompleted(): number;
  /** True once every step has run (or the scan short-circuited at setup). */
  isDone(): boolean;
  /** Advance up to `maxSteps` coarse sim steps; returns `isDone()`. */
  runSlice(maxSteps: number): boolean;
  /**
   * Return the verified 0-60-second prefix once that exact cadence boundary is
   * complete. This is a read-only receipt; it never advances the scan.
   */
  preview(): SinrLiveCellHandoverEventIndexPreview | null;
  /** The final index. Throws if called before the scan is done (no partial truth). */
  finalize(): LiveWalkerHandoverEventIndex;
}

function terminalSinrLiveCellHandoverEventIndexBuilder(
  index: LiveWalkerHandoverEventIndex,
): SinrLiveCellHandoverEventIndexBuilder {
  return {
    totalSteps: 0,
    stepsCompleted: () => 0,
    isDone: () => true,
    runSlice: () => true,
    preview: () => null,
    finalize: () => index,
  };
}

export function createSinrLiveCellHandoverEventIndexBuilder(
  input: BuildSinrLiveCellHandoverEventIndexInput,
): SinrLiveCellHandoverEventIndexBuilder {
  const simStepSec = finitePositiveOrFallback(
    input.simStepSec,
    LIVE_WALKER_HANDOVER_EVENT_INDEX_DEFAULT_STEP_SEC,
  );
  const eventUeScope = resolveEventUeScope(input.eventUeScope);
  // Event scope is an output/filtering choice, not a physics shortcut. The
  // live SINR scene computes the primary link in the same full UE population
  // regardless of which rows the Director keeps. Reducing this to one UE made
  // the interference field and serving transitions differ from the rendered
  // scene, which erased the natural same-satellite intra event while leaving
  // inter events visible. Keep the full population for both scopes, then filter
  // only the emitted event rows below.
  const ueCount = finiteCountOrFallback(input.ueCount, 100);
  const baseIndex = createEmptySinrLiveCellIndex(input, simStepSec, ueCount, []);
  const observer = createObserverContext(input.profile.orbit.observerLatDeg, input.profile.orbit.observerLonDeg);
  const trajectoryCache = createTrajectoryCache(input.profile, observer, input.epochUtcMs);
  const maxTimeSec = getTrajectoryMaxTimeSec(trajectoryCache);

  if (maxTimeSec < LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC) {
    return terminalSinrLiveCellHandoverEventIndexBuilder({
      ...baseIndex,
      sourceGapReasons: [
        `live satellite trajectory cache only spans ${maxTimeSec}s; expected ${LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC}s`,
      ],
    });
  }

  const sinrLiveCellModel = createSinrLiveCellModel(
    input.profile,
    true,
    input.epochUtcMs,
    input.beamCountBySatellite,
    input.servingBeamCount,
    input.candidateBeamCount,
    input.beamHoppingEnabled,
    input.beamPointingMode ?? 'earth-fixed-cell',
    input.multiCandidateDecisionEnabled ?? false,
    input.eeThresholdKbitPerJoule ?? DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE,
  );
  if (sinrLiveCellModel === null) {
    return terminalSinrLiveCellHandoverEventIndexBuilder({
      ...baseIndex,
      sourceGapReasons: ['sinrLiveCells model is unavailable for the live SINR cell-truth trajectory'],
    });
  }
  sinrLiveCellModel.setFocusCell(input.focusCellId ?? null);

  const hoManager = new HandoverManager(input.profile.handover, {
    enforceSharedHandoverInterval: true,
  });
  const secondaryHoManagers = Array.from(
    { length: Math.max(0, ueCount - 1) },
    () => new HandoverManager(input.profile.handover),
  );
  const state = createRuntimeFrameStepState(0);
  const beamLayoutsByShellId = createBeamLayoutsByShellId(input.profile);
  // Keep the offline index's UE substrate identical to the live scene.  The
  // homepage's seven-cell asymmetric mode is defined by these fixed centres;
  // omitting them makes the index scan a different (random) UE placement and
  // can erase the same-satellite intra transitions that the canvas renders.
  const sceneCellLayout = buildSinrLiveCellLayout(
    input.profile,
    resolveSinrLiveSceneCellCount(input.servingBeamCount),
  );
  const sceneCellCentersKm = sceneCellLayout.centers.map(center => ({
    eastKm: center.localXKm,
    northKm: center.localYKm,
  }));
  const replay = {
    epochUtcMs: input.epochUtcMs,
    startOffsetSec: 0,
    loop: false,
    windowLengthSec: LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC,
  };
  const ueDistributionMode = input.ueDistributionMode ?? 'random';
  const uePrimaryAnchorMode = input.uePrimaryAnchorMode ?? 'observer';
  const ueDistributionScope = input.ueDistributionScope ?? 'beam-footprint';
  const ueMobilityMode = input.ueMobilityMode ?? 'static';
  const ueMobilityParams = input.ueMobilityParams ?? DEFAULT_UE_MOBILITY_PARAMS;
  const mobilityStates = createMobilityStates(
    ueCount,
    ueMobilityMode,
    ueMobilityParams,
    input.profile.ueDistribution?.seed ?? 42,
  );
  const previousByUeId = new Map<string, UeServingSnapshot>();
  const events: LiveWalkerHandoverEvent[] = [];

  // One sim step. `paused`/`deltaSec` are the only per-call deltas; sharing the
  // rest keeps the t=0 and loop steps provably identical to the original.
  const stepFrame = (paused: boolean, deltaSec: number) => stepRuntimeFrame({
    profile: input.profile,
    replay,
    speed: 1,
    paused,
    deltaSec,
    observer,
    beamLayoutsByShellId,
    trajectoryCache,
    hoManager,
    secondaryHoManagers,
    state,
    ueCount,
    ueDistributionMode,
    primaryJogEastKm: input.primaryJogEastKm,
    primaryJogNorthKm: input.primaryJogNorthKm,
    focusCellId: input.focusCellId ?? null,
    focusUeId: sinrLiveCellModel.getPinnedPrimaryUeId(),
    uePrimaryAnchorMode,
    ueDistributionScope,
    ueDistributionRadiusKm: input.ueDistributionRadiusKm,
    ueDistributionCellCentersKm: sceneCellCentersKm,
    ueDistributionCellRadiusKm: sceneCellLayout.cellRadiusKm,
    ueMobilityMode,
    ueMobilityParams,
    mobilityStates,
  });

  let frame = stepFrame(true, 0).frame;
  attachSinrLiveCellFrame(frame, sinrLiveCellModel, 0);

  const collectCellTruthEvents = (): void => {
    const cellFrame = frame?.sinrLiveCells;
    if (!cellFrame) return;
    for (const record of cellFrame.ues) {
      const current = toSnapshot(record);
      const previous = previousByUeId.get(record.ueId);
      if (current !== null && previous !== undefined) {
        const event = createSinrLiveCellHandoverEventFromUeTransition({
          previous,
          current,
          handoverKind: record.handoverKind,
          sourceTimeSec: cellFrame.simTimeSec,
          offsetDb: input.profile.handover.offsetDb,
          sequence: events.length,
        });
        if (
          event
          && (eventUeScope !== 'primary-ue-only' || event.ueId === baseIndex.primaryUeId)
        ) {
          events.push(event);
        }
      }
      if (current === null) previousByUeId.delete(record.ueId);
      else previousByUeId.set(record.ueId, current);
    }
  };
  collectCellTruthEvents();

  const totalSteps = Math.ceil(
    LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC / simStepSec,
  );
  const previewCadenceCompatible = cadenceLandsOnPreviewWindow(simStepSec);
  let stepsDone = 0;
  let done = state.simTimeSec >= LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC;

  const runSlice = (maxSteps: number): boolean => {
    let stepsThisSlice = 0;
    while (
      state.simTimeSec < LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC
      && stepsThisSlice < maxSteps
    ) {
      const deltaSec = Math.min(
        simStepSec,
        LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC - state.simTimeSec,
      );
      const result = stepFrame(false, deltaSec);
      frame = result.frame;
      attachSinrLiveCellFrame(frame, sinrLiveCellModel, frame.simTimeSec - result.previousSimTimeSec);
      collectCellTruthEvents();
      stepsThisSlice += 1;
      stepsDone += 1;
    }
    if (state.simTimeSec >= LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC) done = true;
    return done;
  };

  const preview = (): SinrLiveCellHandoverEventIndexPreview | null => {
    if (
      !previewCadenceCompatible
      || state.simTimeSec + 1e-9 < SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_PREVIEW_DURATION_SEC
    ) {
      return null;
    }
    return {
      sourceOwner: 'sinr-live-cell-truth',
      horizonKind: 'live-walker-window-prefix',
      claimKind: 'live-truth',
      readiness: 'preview',
      complete: false,
      sourceWindow: {
        startSec: 0,
        endSec: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_PREVIEW_DURATION_SEC,
      },
      coveredThroughSec: SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_PREVIEW_DURATION_SEC,
      sourceDurationSec: LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC,
      ueScope: baseIndex.ueScope,
      primaryUeId: baseIndex.primaryUeId,
      aggregateUeCount: baseIndex.aggregateUeCount,
      aggregateClaim: baseIndex.aggregateClaim === 'not-100-ue-aggregate'
        ? 'not-100-ue-aggregate-prefix'
        : 'cell-truth-event-index-prefix',
      generation: Object.freeze({ ...baseIndex.generation }),
      offsetDb: baseIndex.offsetDb,
      sourceGapReasons: Object.freeze([...baseIndex.sourceGapReasons]),
      events: Object.freeze(events
        .filter(event => event.sourceTimeSec <= SINR_LIVE_CELL_HANDOVER_EVENT_INDEX_PREVIEW_DURATION_SEC)
        .map(event => Object.freeze({ ...event }))
        .sort(compareCellTruthEvents)),
    };
  };

  const finalize = (): LiveWalkerHandoverEventIndex => {
    if (!done) {
      throw new Error('SINR cell-truth handover index finalized before the scan completed');
    }
    const sourceGapReasons: string[] = [];
    if (!events.some(event => event.kind === 'intra')) {
      sourceGapReasons.push('sinrLiveCells trajectory has no intra handover event for the current UE motion/source window');
    }
    if (!events.some(event => event.kind === 'inter')) {
      sourceGapReasons.push('sinrLiveCells trajectory has no inter handover event for the current UE motion/source window');
    }

    return {
      ...baseIndex,
      sourceGapReasons,
      events: events.sort(compareCellTruthEvents),
    };
  };

  return {
    totalSteps,
    stepsCompleted: () => stepsDone,
    isDone: () => done,
    runSlice,
    preview,
    finalize,
  };
}

/**
 * One-shot build = the resumable builder drained in a single slice. Kept as the
 * sole synchronous entry point (validators, non-render callers); the App render
 * path drives the builder incrementally instead. Output is identical either way.
 */
export function buildSinrLiveCellHandoverEventIndex(
  input: BuildSinrLiveCellHandoverEventIndexInput,
): LiveWalkerHandoverEventIndex {
  const builder = createSinrLiveCellHandoverEventIndexBuilder(input);
  builder.runSlice(Number.POSITIVE_INFINITY);
  return builder.finalize();
}
