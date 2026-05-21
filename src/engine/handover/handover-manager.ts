import type { Profile } from '../../profiles/types';
import type { LinkSample } from '../signal/types';
import type { HandoverDecision, HandoverEvent, ServingState } from './types';

/**
 * Input contract for a {@link HandoverDecisionOverride}.
 *
 * SDD §5.3 (`docs/modqn-omega-handover-sdd.md`): the override receives the
 * same inputs as the engine — candidate beams, current serving, masks/ΔSINR
 * versus serving — and either picks a target beam or returns `null` to defer
 * to sinr-offset. Trigger timing, dwell, and ping-pong-guard remain
 * engine-side; the override only replaces the `argmax` step.
 */
export interface HandoverDecisionOverrideInput {
  /** Smoothed candidate beams visible this tick (post sinr smoothing). */
  readonly candidates: readonly LinkSample[];
  /** Same candidates pre-sorted by smoothed SINR descending. */
  readonly sortedBySinrDesc: readonly LinkSample[];
  /** Current serving snapshot at the moment override is consulted. */
  readonly serving: {
    readonly satId: string | null;
    readonly beamId: number | null;
    readonly sinrDb: number;
  };
  /** Engine offset (dB) used for the inter-HO ΔSINR mask. */
  readonly offsetDb: number;
}

/**
 * Optional decision override hook on {@link HandoverManager.update}.
 *
 * Returning `null` defers to the built-in sinr-offset argmax. Returning a
 * `{satId, beamId}` that exists in the candidate set re-prioritizes the
 * engine's argmax to that target. Trigger timing, dwell, and ping-pong-guard
 * keep running engine-side regardless.
 */
export type HandoverDecisionOverride = (
  input: HandoverDecisionOverrideInput,
) => { satId: string; beamId: number } | null;

function beamAssignmentKey(satId: string, beamId: number): string {
  return `${satId}:${beamId}`;
}

function createServingState(): ServingState {
  return {
    satId: null,
    beamId: null,
    sinrDb: -Infinity,
    triggerTimeSec: 0,
    pendingTarget: null,
  };
}

export class HandoverManager {
  private static readonly REATTACH_THRESHOLD_RELAX_DB = 3;
  private readonly sinrThresholdDb: number;
  private readonly offsetDb: number;
  private readonly triggerTimeSec: number;
  private readonly pingPongGuardMs: number;
  private readonly pendingTargetHoldMs: number;
  private readonly intraSwitchTimeSec: number;
  private readonly maxIntraSwitchesPerServingEpoch: number;
  private readonly sinrSmoothingSec: number;
  private guardUntilMs = 0;
  private pendingSinceMs: number | null = null;
  private intraSwitchTarget: { beamId: number; triggerTimeSec: number } | null = null;
  private servingEpochSatId: string | null = null;
  private intraSwitchCountForServingEpoch = 0;
  private readonly servedBeamIdsForServingEpoch = new Set<number>();
  private readonly smoothedSinrByAssignment = new Map<string, number>();
  state: ServingState = createServingState();
  eventLog: HandoverEvent[] = [];

  constructor(config: Profile['handover']) {
    if (config.policy !== 'sinr-offset') {
      throw new Error(`Unknown handover policy: ${config.policy}`);
    }

    this.sinrThresholdDb = config.sinrThresholdDb;
    this.offsetDb = config.offsetDb;
    this.triggerTimeSec = config.triggerTimeSec;
    this.pingPongGuardMs = config.pingPongGuardSec * 1000;
    this.pendingTargetHoldMs = config.pendingTargetHoldSec * 1000;
    this.intraSwitchTimeSec = config.intraSwitchTimeSec;
    this.maxIntraSwitchesPerServingEpoch = Math.max(
      0,
      Math.floor(config.maxIntraSwitchesPerServingEpoch ?? 1),
    );
    this.sinrSmoothingSec = config.sinrSmoothingSec;
  }

  reset(): void {
    this.guardUntilMs = 0;
    this.pendingSinceMs = null;
    this.intraSwitchTarget = null;
    this.clearServingEpoch();
    this.smoothedSinrByAssignment.clear();
    this.state = createServingState();
    this.eventLog = [];
  }

  clearServing(): void {
    this.pendingSinceMs = null;
    this.intraSwitchTarget = null;
    this.clearServingEpoch();
    this.state = createServingState();
  }

  getTrackedSinrDb(satId: string | null, beamId: number | null): number | null {
    if (!satId || beamId === null) return null;
    const key = beamAssignmentKey(satId, beamId);
    return this.smoothedSinrByAssignment.get(key) ?? null;
  }

  update(
    candidates: LinkSample[],
    dt: number,
    simTimeMs: number,
    decisionOverride?: HandoverDecisionOverride,
  ): HandoverDecision {
    const smoothedCandidates = this.smoothCandidates(candidates, dt);
    if (this.state.satId !== null) {
      const currentBeam = smoothedCandidates.find(
        candidate => candidate.satId === this.state.satId && candidate.beamId === this.state.beamId,
      );
      this.state.sinrDb = currentBeam?.sinrDb ?? -Infinity;
    } else {
      this.state.sinrDb = -Infinity;
    }

    if (smoothedCandidates.length === 0) {
      this.clearPendingTarget();
      this.clearIntraSwitch();
      return { action: 'stay', reason: 'no candidates' };
    }

    const sortedBase = [...smoothedCandidates].sort((a, b) => b.sinrDb - a.sinrDb);
    // SDD §5.3: override only replaces the argmax. We give it the same
    // inputs the engine has (candidates + ΔSINR mask offset + serving) and
    // re-prioritize sortedBase so the chosen target becomes sorted[0]. All
    // downstream timing/dwell/guard logic still operates on the same array
    // shape, so a null/absent override is byte-equivalent to the prior code.
    const sorted = this.applyDecisionOverride(sortedBase, smoothedCandidates, decisionOverride);
    const best = sorted[0];

    if (this.state.satId === null) {
      this.clearPendingTarget();
      this.clearIntraSwitch();
      const attachThresholdDb = this.eventLog.length > 0
        ? this.sinrThresholdDb - HandoverManager.REATTACH_THRESHOLD_RELAX_DB
        : this.sinrThresholdDb;
      if (best.sinrDb >= attachThresholdDb) {
        return this.commitDecision(
          'inter-handover',
          best,
          sorted,
          simTimeMs,
          this.eventLog.length > 0 ? 're-attach after service loss' : 'initial attach',
        );
      }
      return { action: 'stay', reason: 'no candidate above threshold' };
    }

    const currentSinr = this.state.sinrDb;
    this.ensureServingEpoch();
    const betterSameSatBeams = sorted.filter(
      candidate =>
        candidate.satId === this.state.satId
        && candidate.beamId !== this.state.beamId
        && candidate.sinrDb > currentSinr,
    );
    const bestSameSatBeam = betterSameSatBeams.find(candidate =>
      this.canUseIntraSwitchTarget(candidate.beamId),
    );
    const intraSwitchBlockedReason =
      bestSameSatBeam ? null : this.describeIntraSwitchBlock(betterSameSatBeams[0]?.beamId ?? null);

    if (bestSameSatBeam) {
      if (this.intraSwitchTarget?.beamId === bestSameSatBeam.beamId) {
        this.intraSwitchTarget.triggerTimeSec += dt;
      } else {
        this.intraSwitchTarget = { beamId: bestSameSatBeam.beamId, triggerTimeSec: dt };
      }

      if (this.intraSwitchTarget.triggerTimeSec >= this.intraSwitchTimeSec) {
        return this.commitDecision(
          'intra-switch',
          bestSameSatBeam,
          sorted,
          simTimeMs,
          `intra-switch after ${this.intraSwitchTarget.triggerTimeSec.toFixed(1)}s dwell`,
        );
      }
    } else {
      this.clearIntraSwitch();
    }

    const guardActive = simTimeMs < this.guardUntilMs;
    if (guardActive) {
      this.clearPendingTarget();
      return { action: 'stay', reason: 'handover guard active' };
    }

    const qualifiedTargets = sorted.filter(
      candidate => candidate.satId !== this.state.satId && candidate.sinrDb - this.offsetDb > currentSinr,
    );
    const bestTarget = qualifiedTargets[0];
    if (!bestTarget) {
      this.clearPendingTarget();
      return {
        action: 'stay',
        reason: intraSwitchBlockedReason
          ? `${intraSwitchBlockedReason}; inter-HO conditions not met`
          : 'conditions not met',
      };
    }

    const pendingSample = this.state.pendingTarget
      ? qualifiedTargets.find(
        candidate =>
          candidate.satId === this.state.pendingTarget?.satId
          && candidate.beamId === this.state.pendingTarget?.beamId,
      ) ?? null
      : null;

    if (!this.state.pendingTarget) {
      this.setPendingTarget(bestTarget, dt, simTimeMs);
      return this.pendingDecisionReason(bestTarget, 'new pending target');
    }

    const sameAsPending =
      pendingSample !== null
      && pendingSample.satId === bestTarget.satId
      && pendingSample.beamId === bestTarget.beamId;

    if (sameAsPending) {
      this.state.triggerTimeSec += dt;
    } else if (!pendingSample) {
      this.setPendingTarget(bestTarget, dt, simTimeMs);
      return this.pendingDecisionReason(bestTarget, 'pending target replaced');
    } else if (
      this.pendingSinceMs !== null
      && simTimeMs - this.pendingSinceMs < this.pendingTargetHoldMs
    ) {
      this.state.triggerTimeSec += dt;
      if (this.state.triggerTimeSec >= this.triggerTimeSec) {
        return this.commitDecision(
          'inter-handover',
          pendingSample,
          sorted,
          simTimeMs,
          `inter-HO after ${this.state.triggerTimeSec.toFixed(1)}s stable pending hold`,
        );
      }
      return this.pendingDecisionReason(
        pendingSample,
        'pending hold active',
      );
    } else {
      this.setPendingTarget(bestTarget, dt, simTimeMs);
      return this.pendingDecisionReason(bestTarget, 'pending target replaced');
    }

    const activePendingSample = this.state.pendingTarget
      ? qualifiedTargets.find(
        candidate =>
          candidate.satId === this.state.pendingTarget?.satId
          && candidate.beamId === this.state.pendingTarget?.beamId,
      ) ?? null
      : null;

    if (activePendingSample && this.state.triggerTimeSec >= this.triggerTimeSec) {
      return this.commitDecision(
        'inter-handover',
        activePendingSample,
        sorted,
        simTimeMs,
        `inter-HO: stable target for ${this.state.triggerTimeSec.toFixed(1)}s`,
      );
    }

    return this.pendingDecisionReason(activePendingSample ?? bestTarget, 'tracking pending target');
  }

  /**
   * SDD §5.3 override application. Pulls the override's chosen target to
   * the front of `sortedBase` so the existing argmax-driven branches
   * (intra-switch, inter-HO) see it as `sorted[0]`. Returns `sortedBase`
   * unchanged when:
   *   - override is not supplied (most callers; backwards-compatible),
   *   - override returns `null` (defer to sinr-offset),
   *   - override returns a target absent from this tick's candidates,
   *   - override returns the candidate that is already sorted[0].
   * Engine-side timing/dwell/guard logic is untouched.
   */
  private applyDecisionOverride(
    sortedBase: LinkSample[],
    smoothedCandidates: LinkSample[],
    decisionOverride: HandoverDecisionOverride | undefined,
  ): LinkSample[] {
    if (!decisionOverride) return sortedBase;
    const chosen = decisionOverride({
      candidates: smoothedCandidates,
      sortedBySinrDesc: sortedBase,
      serving: {
        satId: this.state.satId,
        beamId: this.state.beamId,
        sinrDb: this.state.sinrDb,
      },
      offsetDb: this.offsetDb,
    });
    if (!chosen) return sortedBase;
    const chosenIndex = sortedBase.findIndex(
      candidate => candidate.satId === chosen.satId && candidate.beamId === chosen.beamId,
    );
    if (chosenIndex <= 0) return sortedBase;
    const chosenSample = sortedBase[chosenIndex];
    const reordered = [chosenSample];
    for (let i = 0; i < sortedBase.length; i++) {
      if (i !== chosenIndex) reordered.push(sortedBase[i]);
    }
    return reordered;
  }

  private smoothCandidates(candidates: LinkSample[], dt: number): LinkSample[] {
    const activeKeys = new Set<string>();
    // Paused runtime tuning should not advance timers, but it must expose the current raw formula output.
    const alpha = this.sinrSmoothingSec <= 0 || dt <= 0
      ? 1
      : Math.min(1, dt / (this.sinrSmoothingSec + dt));

    const smoothed = candidates.map(candidate => {
      const key = beamAssignmentKey(candidate.satId, candidate.beamId);
      activeKeys.add(key);
      const previousSinr = this.smoothedSinrByAssignment.get(key);
      const sinrDb = previousSinr === undefined || alpha >= 1
        ? candidate.sinrDb
        : previousSinr + (candidate.sinrDb - previousSinr) * alpha;
      this.smoothedSinrByAssignment.set(key, sinrDb);
      return { ...candidate, sinrDb };
    });

    for (const key of this.smoothedSinrByAssignment.keys()) {
      if (!activeKeys.has(key)) this.smoothedSinrByAssignment.delete(key);
    }

    return smoothed;
  }

  private setPendingTarget(candidate: LinkSample, dt: number, simTimeMs: number): void {
    this.state.pendingTarget = { satId: candidate.satId, beamId: candidate.beamId };
    this.state.triggerTimeSec = dt;
    this.pendingSinceMs = simTimeMs;
  }

  private clearPendingTarget(): void {
    this.state.triggerTimeSec = 0;
    this.state.pendingTarget = null;
    this.pendingSinceMs = null;
  }

  private clearIntraSwitch(): void {
    this.intraSwitchTarget = null;
  }

  private clearServingEpoch(): void {
    this.servingEpochSatId = null;
    this.intraSwitchCountForServingEpoch = 0;
    this.servedBeamIdsForServingEpoch.clear();
  }

  private startServingEpoch(satId: string, beamId: number): void {
    this.servingEpochSatId = satId;
    this.intraSwitchCountForServingEpoch = 0;
    this.servedBeamIdsForServingEpoch.clear();
    this.servedBeamIdsForServingEpoch.add(beamId);
  }

  private ensureServingEpoch(): void {
    if (this.state.satId === null || this.state.beamId === null) {
      this.clearServingEpoch();
      return;
    }
    if (this.servingEpochSatId !== this.state.satId) {
      this.startServingEpoch(this.state.satId, this.state.beamId);
      return;
    }
    this.servedBeamIdsForServingEpoch.add(this.state.beamId);
  }

  private canUseIntraSwitchTarget(beamId: number): boolean {
    return this.intraSwitchCountForServingEpoch < this.maxIntraSwitchesPerServingEpoch
      && !this.servedBeamIdsForServingEpoch.has(beamId);
  }

  private describeIntraSwitchBlock(candidateBeamId: number | null): string | null {
    if (candidateBeamId === null) return null;
    if (this.intraSwitchCountForServingEpoch >= this.maxIntraSwitchesPerServingEpoch) {
      return `intra-switch epoch limit reached (${this.intraSwitchCountForServingEpoch}/${this.maxIntraSwitchesPerServingEpoch})`;
    }
    if (this.servedBeamIdsForServingEpoch.has(candidateBeamId)) {
      return `intra-switch beam B${candidateBeamId} already served in this satellite epoch`;
    }
    return null;
  }

  private commitDecision(
    action: HandoverDecision['action'],
    target: LinkSample,
    candidates: LinkSample[],
    simTimeMs: number,
    reason: string,
  ): HandoverDecision {
    const fromSatId = this.state.satId;
    const fromBeamId = this.state.beamId;
    const fromSinrDb = this.state.satId !== null ? this.state.sinrDb : null;
    const toSinrDb = candidates.find(
      candidate => candidate.satId === target.satId && candidate.beamId === target.beamId,
    )?.sinrDb ?? target.sinrDb;
    this.eventLog.push({
      timeMs: simTimeMs,
      action,
      fromSatId,
      fromBeamId,
      fromSinrDb,
      toSatId: target.satId,
      toBeamId: target.beamId,
      toSinrDb,
      deltaDb: fromSinrDb !== null ? toSinrDb - fromSinrDb : null,
    });

    this.state.satId = target.satId;
    this.state.beamId = target.beamId;
    this.state.sinrDb = target.sinrDb;
    this.clearPendingTarget();
    this.clearIntraSwitch();

    if (action === 'inter-handover') {
      this.startServingEpoch(target.satId, target.beamId);
      this.guardUntilMs = simTimeMs + this.pingPongGuardMs;
    } else if (action === 'intra-switch') {
      if (fromBeamId !== null) this.servedBeamIdsForServingEpoch.add(fromBeamId);
      this.servedBeamIdsForServingEpoch.add(target.beamId);
      this.intraSwitchCountForServingEpoch += 1;
    }

    return {
      action,
      target: { satId: target.satId, beamId: target.beamId },
      reason,
    };
  }

  private pendingDecisionReason(target: Pick<LinkSample, 'satId' | 'beamId'>, prefix: string): HandoverDecision {
    return {
      action: 'stay',
      reason: `${prefix}: ${target.satId} B${target.beamId}, ${(Math.max(this.state.triggerTimeSec, 0)).toFixed(1)}/${this.triggerTimeSec.toFixed(1)}s`,
    };
  }
}
