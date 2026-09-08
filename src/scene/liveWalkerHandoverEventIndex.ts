import { createObserverContext } from '../engine/orbit';
import { HandoverManager } from '../engine/handover/handover-manager';
import type { HandoverEvent } from '../engine/handover/types';
import type { UeDistributionMode, UePrimaryAnchorMode } from '../engine/ue/multiUeState';
import {
  DEFAULT_UE_MOBILITY_PARAMS,
  type UeMobilityMode,
  type UeMobilityParams,
} from '../engine/ue/multiUeMobility';
import type { Profile } from '../profiles/types';
import {
  requireProfileWalkerConstellationSeed,
  WALKER_CONSTELLATION_PHASE_MODEL_VERSION,
} from '../engine/orbit';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  SIM_DURATION_SEC,
  stepRuntimeFrame,
} from './runtimeFrameStep';
import type { UeDistributionScope } from './types';

export const LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC = SIM_DURATION_SEC;
export const LIVE_WALKER_HANDOVER_EVENT_INDEX_DEFAULT_STEP_SEC = 1;
export const LIVE_WALKER_HANDOVER_EVENT_INDEX_PRIMARY_UE_ID = 'live-ue-0';

/**
 * S4-4 (Decision D4) honest-label note. Both handover event indices are
 * precomputed OFFLINE by re-running the sim at a FIXED COARSE step
 * (`generation.simStepSec`; App passes 30 s for the cell-truth scan,
 * `App.tsx` build site), whereas the live scene advances at a finer variable
 * per-frame dt (~16 ms). So a clicked cinema marker is a coarse FORECAST of
 * where a handover lands — not necessarily the exact transition the live scene
 * displayed (coarser steps + the TTT / ping-pong guards can shift or drop a
 * transition). Surfaced verbatim by the cinema SINR explainer; pinned by
 * `validate:s4:event-index-forecast-label`. (D4 = LABEL, not align — re-running
 * at the live dt over the 7200 s × 100-UE window is build-cost-prohibitive.)
 *
 * Orthogonality (S4-4 D4 review): this TIMING-fidelity note coexists with the
 * index's `claimKind: 'live-truth'` on purpose. `claimKind` is the SOURCE axis
 * (the rendered SINR is leo's real cell-truth, carried verbatim from the engine
 * HandoverEvent — NOT a profile projection); this note is the TIMING axis (the
 * marker positions come from a coarse offline step). They are independent — do
 * NOT flip `claimKind` to 'profile-derived-forecast' (that would falsely imply
 * the SINR values are a forecast; the steered live-walker index owns that bucket).
 */
export const EVENT_INDEX_COARSE_FORECAST_NOTE =
  'Coarse offline forecast — handover markers are precomputed at a fixed step; the live scene advances at a finer variable frame rate, so a marker may not match the exact live-displayed transition, or may not occur at all.';

export type LiveWalkerHandoverEventIndexSourceOwner = 'live-walker' | 'sinr-live-cell-truth';
export type LiveWalkerHandoverEventIndexHorizonKind = 'live-walker-window';
export type LiveWalkerHandoverEventIndexClaimKind =
  | 'live-truth'
  | 'profile-derived-forecast'
  | 'overlay-demo';
export type LiveWalkerHandoverEventIndexUeScope =
  | 'primary-ue-only'
  | 'cell-truth-ue-events';
export type LiveWalkerHandoverEventKind = 'intra' | 'inter';

export interface LiveWalkerHandoverEventIndexGeneration {
  readonly profileId: string;
  readonly epochUtcMs: number;
  readonly simStepSec: number;
  readonly handoverPolicyKey: string;
  readonly topologyKey: string;
  readonly runtimeFramePath: 'stepRuntimeFrame' | 'stepRuntimeFrame+sinrLiveCells';
}

export interface LiveWalkerHandoverEvent {
  readonly id: string;
  readonly sourceTimeSec: number;
  readonly kind: LiveWalkerHandoverEventKind;
  readonly fromSatId: string;
  /**
   * Beam id from the source handover assignment. Cell-truth rows use the
   * measured serving-beam key as well as the geographic `from/toCellId`, so a
   * same-cell intra switch can be rendered as two distinct beams on one cell.
   */
  readonly fromBeamId: number | null;
  readonly toSatId: string;
  readonly toBeamId: number | null;
  /** UE that produced this row. Old live-Walker forecast rows are always `live-ue-0`. */
  readonly ueId?: string;
  /** Geographic scene-cell identity carried by the source transition. */
  readonly fromCellId?: number;
  readonly toCellId?: number;
  readonly fromBeamIdentity?: string;
  readonly toBeamIdentity?: string;
  readonly fromFrequencyIndex?: number | null;
  readonly toFrequencyIndex?: number | null;
  /** UE off-axis angle (deg) relative to the old/new fixed cell centres. */
  readonly fromOffAxisDeg?: number | null;
  readonly toOffAxisDeg?: number | null;
  /**
   * Recorded SINR of the two candidate beams AT the handover decision, carried
   * verbatim from the engine `HandoverEvent` (the index already steps the real
   * sim to collect events; these were simply dropped before). `fromSinrDb` is
   * the serving (losing) candidate, `toSinrDb` the winner; both are live
   * SINR-truth, not producer values. Feeds the cinema SINR explainer.
   */
  readonly fromSinrDb: number | null;
  readonly toSinrDb: number;
  /** `toSinrDb - fromSinrDb` (dB); null when `fromSinrDb` is null (cold attach). */
  readonly deltaDb: number | null;
  readonly sourceStartSec: number;
  readonly sourceEndSec: number;
  readonly clickTargetSec: number;
  readonly primaryUeId: string;
  readonly count: 1;
}

export interface LiveWalkerHandoverEventIndex {
  readonly sourceOwner: LiveWalkerHandoverEventIndexSourceOwner;
  readonly horizonKind: LiveWalkerHandoverEventIndexHorizonKind;
  readonly claimKind: LiveWalkerHandoverEventIndexClaimKind;
  readonly durationSec: typeof LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC;
  readonly ueScope: LiveWalkerHandoverEventIndexUeScope;
  readonly primaryUeId: string;
  readonly aggregateUeCount: number;
  readonly aggregateClaim: 'not-100-ue-aggregate' | 'cell-truth-event-index';
  readonly generation: LiveWalkerHandoverEventIndexGeneration;
  /**
   * Inter-HO SINR-offset threshold (dB) of the live handover profile
   * (`profile.handover.offsetDb`). The cinema SINR explainer surfaces it as the
   * decision rule ("best SINR − offset > serving SINR"). Display-only.
   */
  readonly offsetDb: number;
  readonly sourceGapReasons: readonly string[];
  readonly events: readonly LiveWalkerHandoverEvent[];
}

export interface BuildLiveWalkerHandoverEventIndexInput {
  readonly profile: Profile;
  readonly epochUtcMs: number;
  readonly simStepSec?: number;
  readonly claimKind?: LiveWalkerHandoverEventIndexClaimKind;
  readonly ueDistributionMode?: UeDistributionMode;
  readonly uePrimaryAnchorMode?: UePrimaryAnchorMode;
  readonly ueDistributionScope?: UeDistributionScope;
  readonly ueDistributionRadiusKm?: number;
  readonly ueMobilityMode?: UeMobilityMode;
  readonly ueMobilityParams?: UeMobilityParams;
  /**
   * ENU offset (km) that moves the index's single probe UE off the observer.
   *
   * The index scans with `ueCount: 1` anchored at the observer, so every event
   * it records belongs to whichever cell sits at ENU (0,0). The Director's
   * Show Intra / Show Inter seek into this index, which is why they always
   * landed back on that cell no matter which cell the panels were focused on.
   * Supplying the focused cell's offset re-runs the same scan for that cell's
   * UE, so the cinematic seeks to a handover that actually belongs to it.
   */
  readonly probeOffsetKm?: { readonly eastKm: number; readonly northKm: number };
}

function finitePositiveOrFallback(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function clampLiveWalkerEventSourceTimeSec(sourceTimeSec: number): number {
  if (!Number.isFinite(sourceTimeSec)) return 0;
  return Math.min(Math.max(sourceTimeSec, 0), LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC);
}

function roundTimeSec(value: number): number {
  return Number(value.toFixed(6));
}

function formatScalar(value: string | number | undefined): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'unset';
  return value ?? 'unset';
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

function buildTopologyKey(input: {
  readonly profile: Profile;
  readonly ueDistributionMode: UeDistributionMode;
  readonly uePrimaryAnchorMode: UePrimaryAnchorMode;
  readonly ueDistributionScope: UeDistributionScope;
  readonly ueDistributionRadiusKm: number | undefined;
  readonly ueMobilityMode: UeMobilityMode;
}): string {
  const { profile } = input;
  return [
    'ueScope=primary-ue-only',
    `primaryUeId=${LIVE_WALKER_HANDOVER_EVENT_INDEX_PRIMARY_UE_ID}`,
    'ueCount=1',
    `orbitObserver=${profile.orbit.observerLatDeg},${profile.orbit.observerLonDeg}`,
    `orbitPhase=${WALKER_CONSTELLATION_PHASE_MODEL_VERSION}:${requireProfileWalkerConstellationSeed(profile)}`,
    `orbitShells=${profile.orbit.shells.map(shell => `${shell.id}:${shell.planes}x${shell.satsPerPlane}`).join(',')}`,
    `ueDistributionMode=${input.ueDistributionMode}`,
    `uePrimaryAnchorMode=${input.uePrimaryAnchorMode}`,
    `ueDistributionScope=${input.ueDistributionScope}`,
    `ueDistributionRadiusKm=${formatScalar(input.ueDistributionRadiusKm)}`,
    `ueMobilityMode=${input.ueMobilityMode}`,
  ].join('|');
}

function createEmptyIndex(
  input: BuildLiveWalkerHandoverEventIndexInput,
  simStepSec: number,
  sourceGapReasons: readonly string[],
): LiveWalkerHandoverEventIndex {
  const ueDistributionMode = input.ueDistributionMode ?? 'random';
  const uePrimaryAnchorMode = input.uePrimaryAnchorMode ?? 'distribution';
  const ueDistributionScope = input.ueDistributionScope ?? 'service-area';
  const ueMobilityMode = input.ueMobilityMode ?? 'static';

  return {
    sourceOwner: 'live-walker',
    horizonKind: 'live-walker-window',
    claimKind: input.claimKind ?? 'profile-derived-forecast',
    durationSec: LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC,
    ueScope: 'primary-ue-only',
    primaryUeId: LIVE_WALKER_HANDOVER_EVENT_INDEX_PRIMARY_UE_ID,
    aggregateUeCount: 1,
    aggregateClaim: 'not-100-ue-aggregate',
    generation: {
      profileId: input.profile.id,
      epochUtcMs: input.epochUtcMs,
      simStepSec,
      handoverPolicyKey: buildHandoverPolicyKey(input.profile),
      topologyKey: buildTopologyKey({
        profile: input.profile,
        ueDistributionMode,
        uePrimaryAnchorMode,
        ueDistributionScope,
        ueDistributionRadiusKm: input.ueDistributionRadiusKm,
        ueMobilityMode,
      }),
      runtimeFramePath: 'stepRuntimeFrame',
    },
    offsetDb: input.profile.handover.offsetDb,
    sourceGapReasons,
    events: [],
  };
}

function eventId(sequence: number, sourceTimeSec: number, kind: LiveWalkerHandoverEventKind): string {
  const timeToken = sourceTimeSec.toFixed(3).replace(/[^0-9]+/g, '_');
  return `live-walker-primary-${String(sequence).padStart(4, '0')}-${timeToken}-${kind}`;
}

export function createLiveWalkerHandoverEventFromRuntimeEvent(
  event: HandoverEvent,
  epochUtcMs: number,
  sequence: number,
): LiveWalkerHandoverEvent | null {
  if (event.fromSatId === null || event.fromBeamId === null) return null;

  const kind: LiveWalkerHandoverEventKind | null =
    event.action === 'intra-switch'
      ? 'intra'
      : event.action === 'inter-handover'
        ? 'inter'
        : null;
  if (kind === null) return null;

  if (kind === 'intra' && (event.fromSatId !== event.toSatId || event.fromBeamId === event.toBeamId)) {
    return null;
  }
  if (kind === 'inter' && event.fromSatId === event.toSatId) {
    return null;
  }

  const sourceTimeSec = clampLiveWalkerEventSourceTimeSec(roundTimeSec((event.timeMs - epochUtcMs) / 1000));
  return {
    id: eventId(sequence, sourceTimeSec, kind),
    sourceTimeSec,
    kind,
    fromSatId: event.fromSatId,
    fromBeamId: event.fromBeamId,
    toSatId: event.toSatId,
    toBeamId: event.toBeamId,
    fromSinrDb: event.fromSinrDb,
    toSinrDb: event.toSinrDb,
    deltaDb: event.deltaDb,
    sourceStartSec: clampLiveWalkerEventSourceTimeSec(roundTimeSec(sourceTimeSec - 10)),
    sourceEndSec: clampLiveWalkerEventSourceTimeSec(roundTimeSec(sourceTimeSec + 20)),
    clickTargetSec: sourceTimeSec,
    primaryUeId: LIVE_WALKER_HANDOVER_EVENT_INDEX_PRIMARY_UE_ID,
    count: 1,
  };
}

export function buildLiveWalkerHandoverEventIndex(
  input: BuildLiveWalkerHandoverEventIndexInput,
): LiveWalkerHandoverEventIndex {
  const simStepSec = finitePositiveOrFallback(
    input.simStepSec,
    LIVE_WALKER_HANDOVER_EVENT_INDEX_DEFAULT_STEP_SEC,
  );
  const probeOffsetKm = input.probeOffsetKm;
  const baseIndex = createEmptyIndex(input, simStepSec, []);
  const observer = createObserverContext(input.profile.orbit.observerLatDeg, input.profile.orbit.observerLonDeg);
  const trajectoryCache = createTrajectoryCache(input.profile, observer, input.epochUtcMs);
  const maxTimeSec = getTrajectoryMaxTimeSec(trajectoryCache);

  if (maxTimeSec < LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC) {
    return {
      ...baseIndex,
      sourceGapReasons: [
        `live satellite trajectory cache only spans ${maxTimeSec}s; expected ${LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC}s`,
      ],
    };
  }

  const hoManager = new HandoverManager(input.profile.handover, {
    enforceSharedHandoverInterval: true,
  });
  const state = createRuntimeFrameStepState(0);
  const beamLayoutsByShellId = createBeamLayoutsByShellId(input.profile);
  const replay = {
    epochUtcMs: input.epochUtcMs,
    startOffsetSec: 0,
    loop: false,
    windowLengthSec: LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC,
  };
  const ueDistributionMode = input.ueDistributionMode ?? 'random';
  const uePrimaryAnchorMode = input.uePrimaryAnchorMode ?? 'distribution';
  const ueDistributionScope = input.ueDistributionScope ?? 'service-area';
  const ueMobilityMode = input.ueMobilityMode ?? 'static';
  const ueMobilityParams = input.ueMobilityParams ?? DEFAULT_UE_MOBILITY_PARAMS;
  const events: LiveWalkerHandoverEvent[] = [];
  let seenEventCount = 0;

  const collectNewEvents = (): void => {
    const newEvents = hoManager.eventLog.slice(seenEventCount);
    for (const event of newEvents) {
      const indexEvent = createLiveWalkerHandoverEventFromRuntimeEvent(event, input.epochUtcMs, events.length);
      if (indexEvent) events.push(indexEvent);
    }
    seenEventCount = hoManager.eventLog.length;
  };

  stepRuntimeFrame({
    profile: input.profile,
    replay,
    speed: 1,
    paused: true,
    deltaSec: 0,
    observer,
    beamLayoutsByShellId,
    trajectoryCache,
    hoManager,
    state,
    ueCount: 1,
    primaryJogEastKm: probeOffsetKm?.eastKm ?? 0,
    primaryJogNorthKm: probeOffsetKm?.northKm ?? 0,
    ueDistributionMode,
    uePrimaryAnchorMode,
    ueDistributionScope,
    ueDistributionRadiusKm: input.ueDistributionRadiusKm,
    ueMobilityMode,
    ueMobilityParams,
  });
  collectNewEvents();

  while (state.simTimeSec < LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC) {
    const deltaSec = Math.min(
      simStepSec,
      LIVE_WALKER_HANDOVER_EVENT_INDEX_DURATION_SEC - state.simTimeSec,
    );
    stepRuntimeFrame({
      profile: input.profile,
      replay,
      speed: 1,
      paused: false,
      deltaSec,
      observer,
      beamLayoutsByShellId,
      trajectoryCache,
      hoManager,
      state,
      ueCount: 1,
      primaryJogEastKm: probeOffsetKm?.eastKm ?? 0,
      primaryJogNorthKm: probeOffsetKm?.northKm ?? 0,
      ueDistributionMode,
      uePrimaryAnchorMode,
      ueDistributionScope,
      ueDistributionRadiusKm: input.ueDistributionRadiusKm,
      ueMobilityMode,
      ueMobilityParams,
    });
    collectNewEvents();
  }

  return {
    ...baseIndex,
    events: events.sort((a, b) => (
      a.sourceTimeSec - b.sourceTimeSec
      || a.kind.localeCompare(b.kind)
      || a.id.localeCompare(b.id)
    )),
  };
}
