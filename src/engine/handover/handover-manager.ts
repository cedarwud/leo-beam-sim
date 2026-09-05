import type { Profile } from '../../profiles/types';
import type { LinkSample } from '../signal/types';
import type { HandoverCommitPath } from './commitProvenance';
import type { HandoverDecision, HandoverEvent, IntraSwitchPreview, ServingState } from './types';

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

/**
 * Runtime role options for one manager instance.
 *
 * The primary displayed UE uses the shared interval so intra/inter decisions
 * cannot cross the visible handover story. Background UE managers retain the
 * historical continuity-rescue behavior; their events are telemetry only and
 * must not be allowed to change the primary scene's timing.
 */
export interface HandoverManagerOptions {
  readonly enforceSharedHandoverInterval?: boolean;
}

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
  /** Keep both handover kinds apart for the full visible handover envelope. */
  private static readonly MIN_HANDOVER_INTERVAL_MS = 6000;
  private readonly sinrThresholdDb: number;
  private readonly offsetDb: number;
  private readonly triggerTimeSec: number;
  private readonly pingPongGuardMs: number;
  private readonly pendingTargetHoldMs: number;
  private readonly intraSwitchTimeSec: number;
  private readonly maxIntraSwitchesPerServingEpoch: number;
  private readonly sinrSmoothingSec: number;
  private readonly enforceSharedHandoverInterval: boolean;
  private guardUntilMs = 0;
  private pendingSinceMs: number | null = null;
  private intraSwitchTarget: { beamId: number; triggerTimeSec: number } | null = null;
  private servingEpochSatId: string | null = null;
  private intraSwitchCountForServingEpoch = 0;
  private readonly servedBeamIdsForServingEpoch = new Set<number>();
  private readonly smoothedSinrByAssignment = new Map<string, number>();
  state: ServingState = createServingState();
  eventLog: HandoverEvent[] = [];

  constructor(config: Profile['handover'], options: HandoverManagerOptions = {}) {
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
      Math.floor(config.maxIntraSwitchesPerServingEpoch ?? 2),
    );
    this.sinrSmoothingSec = config.sinrSmoothingSec;
    this.enforceSharedHandoverInterval = options.enforceSharedHandoverInterval ?? false;
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

  /**
   * Consolidation S3-2 — clock REBASE across a sim-time jump (loop wrap, window
   * re-loop, seek), the non-destructive cousin of {@link reset}.
   *
   * A sim-time jump invalidates ONLY the two sim-time-absolute timers this class
   * holds — `guardUntilMs` and `pendingSinceMs` (both `epochUtcMs + simTimeSec*1000`
   * milliseconds; S3 plan §1.6). It does NOT invalidate serving (`state`), the
   * `eventLog`, smoothed SINR, or the serving epoch — those describe *which* link a
   * UE holds, which a clock jump does not change. `reset()` nuking the `eventLog`
   * is exactly the served-N/N flicker: the −3 dB re-attach relax
   * ({@link REATTACH_THRESHOLD_RELAX_DB}) keys off `eventLog.length > 0`, so a
   * cold-reset UE faces the *strict* threshold and stalls re-acquiring for several
   * frames across every wrap. Offsetting the two timers by the exact jump
   * `deltaMs` preserves the elapsed-time relationship the next
   * `update(simTimeMs)` reads, so the serving link survives the jump.
   *
   * Backward jumps (`deltaMs < 0`, the wrap/seek-back case) are clamped: a guard
   * window cannot start before sim-time zero (`guardUntilMs ≥ 0`), and if a
   * `pendingSinceMs` would rebase to a negative (pre-epoch) instant the WHOLE
   * pending is retracted ({@link clearPendingTarget}: target + trigger timer +
   * since-stamp) — a stamp-less pending left behind would commit on the next
   * `update()` via the accumulated `triggerTimeSec`, bypassing the
   * `pendingTargetHoldMs` gate. (Under an exact offset against the absolute UTC
   * clock these clamps are defensive: for any in-trajectory jump the rebased
   * values stay positive and never exceed the post-jump clock.)
   */
  rebase(deltaMs: number): void {
    this.guardUntilMs = Math.max(0, this.guardUntilMs + deltaMs);
    if (this.pendingSinceMs !== null) {
      const rebasedPendingSinceMs = this.pendingSinceMs + deltaMs;
      if (rebasedPendingSinceMs >= 0) {
        this.pendingSinceMs = rebasedPendingSinceMs;
      } else {
        this.clearPendingTarget();
      }
    }
  }

  getTrackedSinrDb(satId: string | null, beamId: number | null): number | null {
    if (!satId || beamId === null) return null;
    const key = beamAssignmentKey(satId, beamId);
    return this.smoothedSinrByAssignment.get(key) ?? null;
  }

  getIntraSwitchPreview(): IntraSwitchPreview | null {
    if (!this.intraSwitchTarget || this.state.satId === null || this.state.beamId === null) return null;
    const triggerTimeTargetSec = Math.max(this.intraSwitchTimeSec, 1e-6);
    return {
      satId: this.state.satId,
      fromBeamId: this.state.beamId,
      toBeamId: this.intraSwitchTarget.beamId,
      triggerTimeSec: this.intraSwitchTarget.triggerTimeSec,
      triggerTimeTargetSec,
      progress: Math.min(1, Math.max(0, this.intraSwitchTarget.triggerTimeSec / triggerTimeTargetSec)),
    };
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
          'manager:initial-attach',
        );
      }
      return { action: 'stay', reason: 'no candidate above threshold' };
    }

    const currentSinr = this.state.sinrDb;
    this.ensureServingEpoch();

    // The primary displayed UE gives inter/intra one shared lock. This check
    // deliberately comes before continuity rescue: a serving-beam drop must
    // not let the rescue branch bypass the inter guard and commit an intra
    // during the active story. Background managers keep the legacy rescue
    // behavior because their events are not the viewport owner.
    const guardActive = simTimeMs < this.guardUntilMs;
    if (guardActive && this.enforceSharedHandoverInterval) {
      this.clearPendingTarget();
      this.clearIntraSwitch();
      return { action: 'stay', reason: 'handover guard active' };
    }

    // Continuity rescue (beam-floor, owner-approved continuity-override). When the
    // serving beam has LEFT the steering cone — it dropped out of this tick's
    // candidates, so currentSinr === -Infinity — the UE is about to be stranded:
    // the next slot the serving satellite can no longer schedule that beam. If a
    // still-steerable sibling beam on the SAME satellite can carry a real link
    // (>= the serving floor), switch to it. For the primary manager the shared
    // guard above intentionally covers this rescue too; for background managers
    // this preserves their prior continuity exception. If no same-sat beam can
    // carry the link, the sat is genuinely leaving: inter-HO (if a successor is
    // visible) or honest service loss takes over below.
    if (currentSinr === -Infinity) {
      const rescue = sorted.find(
        candidate =>
          candidate.satId === this.state.satId
          && candidate.beamId !== this.state.beamId
          && candidate.sinrDb >= this.sinrThresholdDb,
      );
      if (rescue) {
        return this.commitDecision(
          'intra-switch',
          rescue,
          sorted,
          simTimeMs,
          'continuity rescue: serving beam left the steering cone, switch to steerable sibling',
          'manager:continuity-rescue',
        );
      }
    }

    // Inter-HO owns the hard serving-satellite boundary. The primary shared
    // guard remains ahead of local same-satellite beam refinements. The second
    // guard below preserves the normal configured ping-pong behavior for the
    // independent background managers.
    if (guardActive) {
      this.clearPendingTarget();
      this.clearIntraSwitch();
      return { action: 'stay', reason: 'handover guard active' };
    }
    const qualifiedTargets = sorted.filter(
      candidate => candidate.satId !== this.state.satId && candidate.sinrDb - this.offsetDb > currentSinr,
    );
    const bestTarget = qualifiedTargets[0];
    if (bestTarget) {
      this.clearIntraSwitch();
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
            'manager:inter-stable-pending-hold',
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
          'manager:inter-stable-target',
        );
      }

      return this.pendingDecisionReason(activePendingSample ?? bestTarget, 'tracking pending target');
    }

    const sameSatBestBeam =
      best.satId === this.state.satId
      && best.beamId !== this.state.beamId
      && best.sinrDb > currentSinr
        ? best
        : null;
    const bestSameSatBeam =
      sameSatBestBeam && this.canUseIntraSwitchTarget(sameSatBestBeam.beamId)
        ? sameSatBestBeam
        : null;
    const intraSwitchBlockedReason =
      bestSameSatBeam ? null : this.describeIntraSwitchBlock(sameSatBestBeam?.beamId ?? null);

    if (!bestSameSatBeam) {
      this.clearPendingTarget();
      this.clearIntraSwitch();
      return {
        action: 'stay',
        reason: intraSwitchBlockedReason
          ? `${intraSwitchBlockedReason}; inter-HO conditions not met`
          : 'conditions not met',
      };
    }

    this.clearPendingTarget();
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
        'manager:intra-dwell',
      );
    }

    return {
      action: 'stay',
      reason: `tracking intra-switch target: ${bestSameSatBeam.satId} B${bestSameSatBeam.beamId}, ${this.intraSwitchTarget.triggerTimeSec.toFixed(1)}/${this.intraSwitchTimeSec.toFixed(1)}s`,
    };
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
    provenance: HandoverCommitPath,
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
    } else if (action === 'intra-switch') {
      if (fromBeamId !== null) this.servedBeamIdsForServingEpoch.add(fromBeamId);
      this.servedBeamIdsForServingEpoch.add(target.beamId);
      this.intraSwitchCountForServingEpoch += 1;
    }

    if (this.enforceSharedHandoverInterval) {
      // Apply one minimum interval after either handover kind. The configured
      // ping-pong guard remains the policy floor; the six-second presentation
      // envelope wins when it is longer, so the next kind cannot start before
      // the current story has released the viewport.
      this.guardUntilMs = Math.max(
        this.guardUntilMs,
        simTimeMs + Math.max(this.pingPongGuardMs, HandoverManager.MIN_HANDOVER_INTERVAL_MS),
      );
    } else if (action === 'inter-handover') {
      // Preserve the historical independent-manager contract for background
      // UE telemetry: only inter-HO starts its configured ping-pong guard.
      this.guardUntilMs = simTimeMs + this.pingPongGuardMs;
    }

    return {
      action,
      target: { satId: target.satId, beamId: target.beamId },
      reason,
      provenance,
    };
  }

  private pendingDecisionReason(target: Pick<LinkSample, 'satId' | 'beamId'>, prefix: string): HandoverDecision {
    return {
      action: 'stay',
      reason: `${prefix}: ${target.satId} B${target.beamId}, ${(Math.max(this.state.triggerTimeSec, 0)).toFixed(1)}/${this.triggerTimeSec.toFixed(1)}s`,
    };
  }
}
