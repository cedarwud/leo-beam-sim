import type { Profile } from '../../profiles/types';
import type { LinkSample } from '../signal/types';
import type { HandoverDecision, HandoverEvent, HandoverPolicy, ServingState } from './types';
import { SinrOffsetPolicy } from './policies/sinr-offset';

function createPolicy(config: Profile['handover']): HandoverPolicy {
  switch (config.policy) {
    case 'sinr-offset':
      return new SinrOffsetPolicy(config.offsetDb, config.triggerTimeSec, config.sinrThresholdDb);
    default:
      throw new Error(`Unknown handover policy: ${config.policy}`);
  }
}

export class HandoverManager {
  private policy: HandoverPolicy;
  state: ServingState = {
    satId: null,
    beamId: null,
    sinrDb: -Infinity,
    triggerTimeSec: 0,
    pendingTarget: null,
  };
  eventLog: HandoverEvent[] = [];

  constructor(config: Profile['handover']) {
    this.policy = createPolicy(config);
  }

  update(candidates: LinkSample[], dt: number, simTimeMs: number): HandoverDecision {
    // Update current SINR from candidates if still serving
    if (this.state.satId !== null) {
      const currentBeam = candidates.find(
        c => c.satId === this.state.satId && c.beamId === this.state.beamId,
      );
      this.state.sinrDb = currentBeam?.sinrDb ?? -Infinity;
    }

    const decision = this.policy.evaluate(this.state, candidates, dt);

    if (decision.action !== 'stay' && decision.target) {
      this.eventLog.push({
        timeMs: simTimeMs,
        action: decision.action,
        fromSatId: this.state.satId,
        fromBeamId: this.state.beamId,
        toSatId: decision.target.satId,
        toBeamId: decision.target.beamId,
        sinrDb: candidates.find(
          c => c.satId === decision.target!.satId && c.beamId === decision.target!.beamId,
        )?.sinrDb ?? 0,
      });

      this.state.satId = decision.target.satId;
      this.state.beamId = decision.target.beamId;
      this.state.triggerTimeSec = 0;
      this.state.pendingTarget = null;
    } else {
      // Update trigger time tracking for pending inter-HO
      const sorted = [...candidates].sort((a, b) => b.sinrDb - a.sinrDb);
      const best = sorted[0];
      if (best && best.satId !== this.state.satId) {
        if (
          this.state.pendingTarget?.satId === best.satId &&
          this.state.pendingTarget?.beamId === best.beamId
        ) {
          this.state.triggerTimeSec += dt;
        } else {
          this.state.triggerTimeSec = dt;
          this.state.pendingTarget = { satId: best.satId, beamId: best.beamId };
        }
      } else {
        this.state.triggerTimeSec = 0;
        this.state.pendingTarget = null;
      }
    }

    return decision;
  }
}
