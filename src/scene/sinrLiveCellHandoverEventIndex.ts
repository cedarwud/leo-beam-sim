import { HandoverManager } from '../engine/handover/handover-manager';
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
  createSinrLiveCellModel,
  attachSinrLiveCellFrame,
} from './sinrLiveCellRuntime';
import type { UeCellServingRecord } from './sinrLiveCellModel';
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
  readonly beamCountBySatellite?: Readonly<Record<string, number>>;
  /** Must match the live scene's role-specific display/scheduler budgets. */
  readonly servingBeamCount?: number;
  readonly candidateBeamCount?: number;
  /** Must match the live scene; omitted keeps the model's historical default. */
  readonly beamHoppingEnabled?: boolean;
}

interface UeServingSnapshot {
  readonly ueId: string;
  readonly cellId: number;
  readonly servingSatId: string;
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

function roundTimeSec(value: number): number {
  return Number(value.toFixed(6));
}

function formatScalar(value: string | number | undefined): string {
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
  readonly beamCountBySatellite?: Readonly<Record<string, number>>;
  readonly servingBeamCount?: number;
  readonly candidateBeamCount?: number;
  readonly beamHoppingEnabled?: boolean;
}): string {
  const { profile } = input;
  return [
    'ueScope=cell-truth-ue-events',
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
    `beamCountBySatellite=${formatBeamCountBySatellite(input.beamCountBySatellite)}`,
    `servingBeamCount=${formatScalar(input.servingBeamCount)}`,
    `candidateBeamCount=${formatScalar(input.candidateBeamCount)}`,
    `beamHoppingEnabled=${input.beamHoppingEnabled ?? 'unset'}`,
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
    ueScope: 'cell-truth-ue-events',
    primaryUeId: LIVE_WALKER_HANDOVER_EVENT_INDEX_PRIMARY_UE_ID,
    aggregateUeCount: ueCount,
    aggregateClaim: 'cell-truth-event-index',
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
        beamCountBySatellite: input.beamCountBySatellite,
        servingBeamCount: input.servingBeamCount,
        candidateBeamCount: input.candidateBeamCount,
        beamHoppingEnabled: input.beamHoppingEnabled,
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

function toSnapshot(record: UeCellServingRecord): UeServingSnapshot | null {
  if (
    record.cellId === null
    || record.servingSatId === null
    || record.beamIdentity === null
  ) {
    return null;
  }
  return {
    ueId: record.ueId,
    cellId: record.cellId,
    servingSatId: record.servingSatId,
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
    if (input.previous.cellId === input.current.cellId) return null;
  }
  if (kind === 'inter' && input.previous.servingSatId === input.current.servingSatId) return null;
  if (input.previous.ueId !== input.current.ueId) return null;

  const sourceTimeSec = clampLiveWalkerEventSourceTimeSec(roundTimeSec(input.sourceTimeSec));
  const fromSinrDb = Number.isFinite(input.previous.sinrDb ?? NaN) ? input.previous.sinrDb : null;
  const toSinrDb = Number.isFinite(input.current.sinrDb ?? NaN) ? input.current.sinrDb : null;
  if (toSinrDb === null) return null;
  const deltaDb = fromSinrDb === null ? null : Number((toSinrDb - fromSinrDb).toFixed(6));

  return {
    id: eventId(input.sequence, sourceTimeSec, kind, input.current.ueId),
    sourceTimeSec,
    kind,
    fromSatId: input.previous.servingSatId,
    // S4-2 pun retirement: cell-truth rows have NO steered beam — the
    // earth-fixed cell ids below are the handover identity.
    fromBeamId: null,
    toSatId: input.current.servingSatId,
    toBeamId: null,
    ueId: input.current.ueId,
    fromCellId: input.previous.cellId,
    toCellId: input.current.cellId,
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
  );
  if (sinrLiveCellModel === null) {
    return terminalSinrLiveCellHandoverEventIndexBuilder({
      ...baseIndex,
      sourceGapReasons: ['sinrLiveCells model is unavailable for the live SINR cell-truth trajectory'],
    });
  }

  const hoManager = new HandoverManager(input.profile.handover, {
    enforceSharedHandoverInterval: true,
  });
  const secondaryHoManagers = Array.from(
    { length: Math.max(0, ueCount - 1) },
    () => new HandoverManager(input.profile.handover),
  );
  const state = createRuntimeFrameStepState(0);
  const beamLayoutsByShellId = createBeamLayoutsByShellId(input.profile);
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
    uePrimaryAnchorMode,
    ueDistributionScope,
    ueDistributionRadiusKm: input.ueDistributionRadiusKm,
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
        if (event) events.push(event);
      }
      if (current === null) previousByUeId.delete(record.ueId);
      else previousByUeId.set(record.ueId, current);
    }
  };
  collectCellTruthEvents();

  const totalSteps = Math.ceil(
    LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC / simStepSec,
  );
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
      events: events.sort((a, b) => (
        a.sourceTimeSec - b.sourceTimeSec
        || a.kind.localeCompare(b.kind)
        || (a.ueId ?? '').localeCompare(b.ueId ?? '')
        || a.id.localeCompare(b.id)
      )),
    };
  };

  return {
    totalSteps,
    stepsCompleted: () => stepsDone,
    isDone: () => done,
    runSlice,
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
