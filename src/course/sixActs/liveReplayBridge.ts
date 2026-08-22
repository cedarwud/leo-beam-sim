/**
 * Live-replay bridge — the producer the six-acts model layer was missing.
 *
 * It turns the homepage replay's per-frame output into `SixActsRuntimeSample[]`
 * for the run summary, and observes the handover the Act 4 director plans
 * around. Nothing here recomputes physics: rates and power come from the
 * canonical BeamShift EE producer, identity and handover facts from the runtime
 * frame.
 *
 * Two engine facts this module depends on, both structural rather than textual:
 *
 *   - attach / re-attach commits carry `fromSatId === null`, because the engine
 *     only takes that path while serving is already null. A genuine conditional
 *     inter-handover always has a `fromSatId`. That is how an attach is kept out
 *     of `NUM_HANDOVERS` without matching on a reason string.
 *   - `handoverTriggerProgressSec` is reset to 0 by the commit itself, so the
 *     condition's start is tracked as the frame boundary where progress first
 *     went positive — not read off the commit frame.
 *
 * See docs/sdd/SIX-ACTS-P0-VERTICAL-SLICE-SDD.md (M4).
 */

import type { SixActsLiveHandoverObservation } from './directorScript';
import type { SixActsRuntimeSample } from './runSummary';

export type SixActsBridgeErrorCode =
  | 'NON_ADVANCING_FRAME'
  | 'INVALID_EPOCH'
  | 'FOCUSED_UE_ABSENT'
  | 'INVALID_FRAME_TIME';

export class SixActsBridgeError extends Error {
  readonly code: SixActsBridgeErrorCode;

  constructor(code: SixActsBridgeErrorCode, message: string) {
    super(message);
    this.name = 'SixActsBridgeError';
    this.code = code;
  }
}

function fail(code: SixActsBridgeErrorCode, message: string): never {
  throw new SixActsBridgeError(code, message);
}

/** One committed decision, narrowed from the engine's `HandoverEvent`. */
export interface SixActsCommittedHandover {
  readonly timeMs: number;
  readonly action: 'stay' | 'intra-switch' | 'inter-handover';
  /** Null only for an attach or a re-attach after service loss. */
  readonly fromSatelliteId: string | null;
  readonly toSatelliteId: string;
  readonly deltaDb: number | null;
}

/**
 * The narrow port the bridge consumes.
 *
 * Deliberately not `SimFrame` itself: the classroom slice depends on a handful
 * of facts, and naming them keeps a scene-layer refactor from silently changing
 * what a lesson teaches.
 */
export interface SixActsFrameFacts {
  readonly simTimeSec: number;
  readonly servingSatelliteId: string | null;
  readonly servingSinrDb: number | null;
  readonly candidateSatelliteId: string | null;
  readonly candidateSinrDb: number | null;
  /** Accumulated TTT hold for the pending target, in seconds. */
  readonly triggerProgressSec: number;
  /** The engine's most recent committed decision, or null before the first. */
  readonly lastCommittedHandover: SixActsCommittedHandover | null;
  /** Per-UE rates R for this frame, in Mbit/s. */
  readonly ratesMbps: readonly number[];
  /** The resolved system power P^N for the same frame, in W. */
  readonly systemPowerW: number;
}

export interface SixActsReplayCollectorOptions {
  /** UTC ms that `simTimeSec === 0` corresponds to — the window's t0. */
  readonly epochUtcMs: number;
}

/**
 * Accumulates one replay pass.
 *
 * The first frame produces no sample: a sample covers the interval that ENDS at
 * its frame, so there is nothing to attribute until a second frame supplies the
 * interval. This matches how `BeamshiftCanonicalEeAccumulator.append` is
 * already driven from `useSimulation`, so the two never disagree about dt.
 */
export class SixActsReplayCollector {
  readonly epochUtcMs: number;

  private readonly collected: SixActsRuntimeSample[] = [];
  private readonly observed: SixActsLiveHandoverObservation[] = [];
  private previousSimTimeSec: number | null = null;
  private conditionStartSimTimeSec: number | null = null;
  private conditionTargetSatelliteId: string | null = null;
  private lastSeenCommitTimeMs: number | null = null;

  constructor(options: SixActsReplayCollectorOptions) {
    if (!Number.isFinite(options.epochUtcMs)) {
      fail('INVALID_EPOCH', 'the replay epoch must be finite UTC milliseconds');
    }
    this.epochUtcMs = options.epochUtcMs;
  }

  get samples(): readonly SixActsRuntimeSample[] {
    return Object.freeze([...this.collected]);
  }

  /** Every conditional handover the replay committed, in order. */
  get observations(): readonly SixActsLiveHandoverObservation[] {
    return Object.freeze([...this.observed]);
  }

  /** The first observation matching a pair, for the pinned teaching window. */
  findObservation(
    fromSatelliteId: string,
    toSatelliteId: string,
  ): SixActsLiveHandoverObservation | null {
    return this.observed.find(
      observation => observation.fromSatelliteId === fromSatelliteId
        && observation.toSatelliteId === toSatelliteId,
    ) ?? null;
  }

  push(facts: SixActsFrameFacts): SixActsRuntimeSample | null {
    if (!Number.isFinite(facts.simTimeSec) || facts.simTimeSec < 0) {
      fail('INVALID_FRAME_TIME', 'simTimeSec must be finite and non-negative');
    }
    if (this.previousSimTimeSec !== null && facts.simTimeSec <= this.previousSimTimeSec) {
      fail(
        'NON_ADVANCING_FRAME',
        'frame time must advance; start a new collector after a seek or a loop wrap',
      );
    }

    const instantMs = this.epochUtcMs + facts.simTimeSec * 1000;
    // Commit first, then condition: the engine clears `triggerProgressSec` as
    // part of committing, so the commit frame reports a zero hold. Tracking the
    // condition first would wipe the mark the commit is about to read.
    this.trackCommit(facts, instantMs);
    this.trackCondition(facts);

    if (this.previousSimTimeSec === null) {
      this.previousSimTimeSec = facts.simTimeSec;
      return null;
    }

    const sample: SixActsRuntimeSample = Object.freeze({
      instantMs,
      durationSec: facts.simTimeSec - this.previousSimTimeSec,
      servingSatelliteId: facts.servingSatelliteId,
      servingSinrDb: facts.servingSatelliteId === null ? null : facts.servingSinrDb,
      bestCandidateSatelliteId: facts.candidateSatelliteId,
      bestCandidateSinrDb: facts.candidateSinrDb,
      ratesMbps: Object.freeze([...facts.ratesMbps]),
      systemPowerW: facts.systemPowerW,
    });
    this.collected.push(sample);
    this.previousSimTimeSec = facts.simTimeSec;
    return sample;
  }

  /**
   * Marks where the offset condition began holding.
   *
   * The mark is the frame boundary BEFORE progress first went positive: the
   * engine has already accumulated one step of hold by the time it reports a
   * positive progress, so using the reporting frame would understate the hold
   * by exactly one dt and make an honest 30 s TTT look like 29.
   */
  private trackCondition(facts: SixActsFrameFacts): void {
    const holding = facts.triggerProgressSec > 0 && facts.candidateSatelliteId !== null;
    if (!holding) {
      this.conditionStartSimTimeSec = null;
      this.conditionTargetSatelliteId = null;
      return;
    }
    if (this.conditionStartSimTimeSec !== null
      && this.conditionTargetSatelliteId === facts.candidateSatelliteId) {
      return;
    }
    this.conditionStartSimTimeSec = this.previousSimTimeSec ?? facts.simTimeSec;
    this.conditionTargetSatelliteId = facts.candidateSatelliteId;
  }

  private trackCommit(facts: SixActsFrameFacts, instantMs: number): void {
    const commit = facts.lastCommittedHandover;
    if (commit === null) return;
    if (this.lastSeenCommitTimeMs === commit.timeMs) return;
    this.lastSeenCommitTimeMs = commit.timeMs;

    // An attach or a re-attach is not a conditional handover, and the engine
    // says so structurally: only a null serving state reaches that commit path.
    if (commit.action !== 'inter-handover' || commit.fromSatelliteId === null) {
      this.conditionStartSimTimeSec = null;
      this.conditionTargetSatelliteId = null;
      return;
    }
    // Without an observed hold there is no TTT to draw, so no plan is claimed.
    if (this.conditionStartSimTimeSec === null) return;

    const replayStepSec = this.previousSimTimeSec === null
      ? 0
      : facts.simTimeSec - this.previousSimTimeSec;
    this.observed.push(Object.freeze({
      source: 'live-replay' as const,
      commitInstantMs: instantMs,
      conditionStartInstantMs: this.epochUtcMs + this.conditionStartSimTimeSec * 1000,
      fromSatelliteId: commit.fromSatelliteId,
      toSatelliteId: commit.toSatelliteId,
      replayStepSec,
    }));
    this.conditionStartSimTimeSec = null;
    this.conditionTargetSatelliteId = null;
  }
}

/** The subset of the runtime frame the adapter reads. */
export interface SixActsAdaptableSimFrame {
  readonly simTimeSec: number;
  readonly serving: { readonly satId: string | null; readonly sinrDb: number };
  readonly pendingTargetSatId: string | null;
  readonly pendingTargetSinrDb: number | null;
  readonly handoverTriggerProgressSec: number;
  readonly lastHoEvent: {
    readonly timeMs: number;
    readonly action: 'stay' | 'intra-switch' | 'inter-handover';
    readonly fromSatId: string | null;
    readonly toSatId: string;
    readonly deltaDb: number | null;
  } | null;
}

/** The subset of the canonical EE producer's output the adapter reads. */
export interface SixActsAdaptableEnergyFrame {
  readonly systemPowerW: number;
  readonly users: readonly {
    readonly ueId: string;
    readonly status: 'served' | 'outage' | 'unserved';
    readonly sinrDb: number | null;
    readonly rateMbps: number;
  }[];
}

/**
 * Homepage publisher state consumed by the teaching adapter.
 *
 * `canonicalEe` is preferred when its complete payload is available. The live
 * homepage already publishes the selected-link `angleAwareFormulaFrame` to
 * the teaching dock, though, and the teaching cinema needs a real frame even
 * while the separate canonical accumulator is fail-closed. The fallback below
 * carries only that focused link; it never fills missing aggregate users with
 * invented values.
 */
export interface SixActsHomepageFrameState {
  readonly simTimeSec: number;
  readonly primaryUeId?: string | null;
  readonly canonicalEe?: {
    readonly systemPowerW: number | null;
    readonly perUserContributions: readonly {
      readonly ueId: string;
      readonly status?: 'served' | 'outage' | 'unserved';
      readonly satId?: string | null;
      readonly sinrDb?: number | null;
      readonly rateMbps?: number;
    }[] | null;
  } | null;
  readonly angleAwareFormulaFrame?: {
    readonly ueId: string;
    readonly satId: string;
    readonly selected: 0 | 1;
    readonly terms: {
      readonly gammaDb: number;
      readonly throughputBps: number;
      readonly systemPowerW: number;
    };
  } | null;
  readonly servingSatId: string | null;
  readonly sinrDb: number;
  readonly pendingTargetSatId: string | null;
  readonly pendingTargetSinrDb: number | null;
  readonly handoverTriggerProgressSec: number;
  readonly lastHoEvent: SixActsAdaptableSimFrame['lastHoEvent'];
}

/**
 * Maps one runtime frame plus its canonical EE frame onto the bridge's port.
 *
 * Attachment comes from the EE producer's per-UE status, not from the serving
 * identity alone: a UE can hold a serving id while the producer reports it in
 * outage, and the classroom number that matters is whether bits moved.
 */
export function adaptSixActsFrameFacts(
  frame: SixActsAdaptableSimFrame,
  energy: SixActsAdaptableEnergyFrame,
  focusedUeId: string,
): SixActsFrameFacts {
  const focused = energy.users.find(user => user.ueId === focusedUeId);
  if (focused === undefined) {
    fail('FOCUSED_UE_ABSENT', `the energy frame carries no UE ${focusedUeId}`);
  }
  const attached = focused.status === 'served' && focused.sinrDb !== null;

  return Object.freeze({
    simTimeSec: frame.simTimeSec,
    servingSatelliteId: attached ? frame.serving.satId : null,
    servingSinrDb: attached ? focused.sinrDb : null,
    candidateSatelliteId: frame.pendingTargetSatId,
    candidateSinrDb: frame.pendingTargetSinrDb,
    triggerProgressSec: frame.handoverTriggerProgressSec,
    lastCommittedHandover: frame.lastHoEvent === null ? null : Object.freeze({
      timeMs: frame.lastHoEvent.timeMs,
      action: frame.lastHoEvent.action,
      fromSatelliteId: frame.lastHoEvent.fromSatId,
      toSatelliteId: frame.lastHoEvent.toSatId,
      deltaDb: frame.lastHoEvent.deltaDb,
    }),
    ratesMbps: Object.freeze(energy.users.map(user => user.rateMbps)),
    systemPowerW: energy.systemPowerW,
  });
}

/**
 * Adapt the live homepage without weakening the fail-closed canonical EE
 * contract. The focused angle-aware formula frame is the same engine-backed
 * source already used by the dock; it is the only honest fallback when the
 * aggregate canonical publisher reports an unavailable/invalid payload.
 */
export function adaptHomepageSixActsFrameFacts(
  state: SixActsHomepageFrameState,
): SixActsFrameFacts | null {
  const primaryUeId = state.primaryUeId;
  const canonicalEe = state.canonicalEe;
  if (
    primaryUeId !== null
    && primaryUeId !== undefined
    && canonicalEe !== null
    && canonicalEe !== undefined
    && canonicalEe.systemPowerW !== null
    && Number.isFinite(canonicalEe.systemPowerW)
    && canonicalEe.perUserContributions !== null
  ) {
    return adaptSixActsFrameFacts(
      {
        simTimeSec: state.simTimeSec,
        serving: {
          satId: state.servingSatId,
          sinrDb: Number.isFinite(state.sinrDb) ? state.sinrDb : 0,
        },
        pendingTargetSatId: state.pendingTargetSatId,
        pendingTargetSinrDb: state.pendingTargetSinrDb,
        handoverTriggerProgressSec: state.handoverTriggerProgressSec,
        lastHoEvent: state.lastHoEvent,
      },
      {
        systemPowerW: canonicalEe.systemPowerW,
        users: canonicalEe.perUserContributions.map(user => ({
          ueId: user.ueId,
          status: user.status ?? (user.satId != null && user.sinrDb != null ? 'served' : 'unserved'),
          sinrDb: user.sinrDb ?? null,
          rateMbps: user.rateMbps ?? 0,
        })),
      },
      primaryUeId,
    );
  }

  const formulaFrame = state.angleAwareFormulaFrame;
  const formulaTerms = formulaFrame?.terms;
  if (
    formulaFrame === null
    || formulaFrame === undefined
    || formulaFrame.selected !== 1
    || formulaTerms === undefined
    || !Number.isFinite(formulaTerms.gammaDb)
    || !Number.isFinite(formulaTerms.throughputBps)
    || !Number.isFinite(formulaTerms.systemPowerW)
  ) return null;

  return adaptSixActsFrameFacts(
    {
      simTimeSec: state.simTimeSec,
      serving: {
        // The formula frame is the selected-link authority for this fallback;
        // keep the handover fields from the same homepage state alongside it.
        satId: state.servingSatId ?? formulaFrame.satId,
        sinrDb: formulaTerms.gammaDb,
      },
      pendingTargetSatId: state.pendingTargetSatId,
      pendingTargetSinrDb: state.pendingTargetSinrDb,
      handoverTriggerProgressSec: state.handoverTriggerProgressSec,
      lastHoEvent: state.lastHoEvent,
    },
    {
      systemPowerW: formulaTerms.systemPowerW,
      // This fallback is intentionally a focused-link projection. Other UE
      // rates are unavailable from this frame and are not fabricated.
      users: [{
        ueId: formulaFrame.ueId,
        status: 'served',
        sinrDb: formulaTerms.gammaDb,
        rateMbps: formulaTerms.throughputBps / 1e6,
      }],
    },
    formulaFrame.ueId,
  );
}
