import type { Profile } from '../../profiles/types';
import type { LinkSample } from '../signal/types';
import type { HandoverDecision, HandoverEvent, ServingState } from './types';

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
  private readonly sinrThresholdDb: number;
  private readonly offsetDb: number;
  private readonly triggerTimeSec: number;
  private readonly pingPongGuardMs: number;
  private readonly pendingTargetHoldMs: number;
  private readonly intraSwitchTimeSec: number;
  private readonly sinrSmoothingSec: number;
  private guardUntilMs = 0;
  private pendingSinceMs: number | null = null;
  private intraSwitchTarget: { beamId: number; triggerTimeSec: number } | null = null;
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
    this.sinrSmoothingSec = config.sinrSmoothingSec;
  }

  reset(): void {
    this.guardUntilMs = 0;
    this.pendingSinceMs = null;
    this.intraSwitchTarget = null;
    this.smoothedSinrByAssignment.clear();
    this.state = createServingState();
    this.eventLog = [];
  }

  clearServing(): void {
    this.pendingSinceMs = null;
    this.intraSwitchTarget = null;
    this.state = createServingState();
  }

  update(candidates: LinkSample[], dt: number, simTimeMs: number): HandoverDecision {
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

    const sorted = [...smoothedCandidates].sort((a, b) => b.sinrDb - a.sinrDb);
    const best = sorted[0];

    if (this.state.satId === null) {
      this.clearPendingTarget();
      this.clearIntraSwitch();
      if (best.sinrDb >= this.sinrThresholdDb) {
        return this.commitDecision(
          'inter-handover',
          best,
          sorted,
          simTimeMs,
          'initial attach',
        );
      }
      return { action: 'stay', reason: 'no candidate above threshold' };
    }

    const currentSinr = this.state.sinrDb;
    const bestSameSatBeam = sorted.find(
      candidate =>
        candidate.satId === this.state.satId
        && candidate.beamId !== this.state.beamId
        && candidate.sinrDb > currentSinr,
    );

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
      return { action: 'stay', reason: 'conditions not met' };
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

  private smoothCandidates(candidates: LinkSample[], dt: number): LinkSample[] {
    const activeKeys = new Set<string>();
    const alpha = this.sinrSmoothingSec <= 0
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

  private commitDecision(
    action: HandoverDecision['action'],
    target: LinkSample,
    candidates: LinkSample[],
    simTimeMs: number,
    reason: string,
  ): HandoverDecision {
    this.eventLog.push({
      timeMs: simTimeMs,
      action,
      fromSatId: this.state.satId,
      fromBeamId: this.state.beamId,
      toSatId: target.satId,
      toBeamId: target.beamId,
      sinrDb: candidates.find(
        candidate => candidate.satId === target.satId && candidate.beamId === target.beamId,
      )?.sinrDb ?? target.sinrDb,
    });

    this.state.satId = target.satId;
    this.state.beamId = target.beamId;
    this.state.sinrDb = target.sinrDb;
    this.clearPendingTarget();
    this.clearIntraSwitch();

    if (action === 'inter-handover') {
      this.guardUntilMs = simTimeMs + this.pingPongGuardMs;
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
