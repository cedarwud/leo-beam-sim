/**
 * HOBS Algorithm 2: SINR offset + trigger time handover policy.
 *
 * 1. Sort candidate beams by SINR descending
 * 2. If best beam is same satellite & SINR > current → intra-LEO beam switch
 * 3. If different satellite & SINR_target - γ_os > SINR_current AND T_trig ≥ T_thr → inter-LEO handover
 * 4. Otherwise → stay
 *
 * Source: PAP-2024-HOBS Eq.(24)-(25)
 */

import type { LinkSample } from '../../signal/types';
import type { HandoverDecision, HandoverPolicy, ServingState } from '../types';

export class SinrOffsetPolicy implements HandoverPolicy {
  constructor(
    private offsetDb: number,
    private triggerThresholdSec: number,
    private sinrThresholdDb: number,
  ) {}

  evaluate(current: ServingState, candidates: LinkSample[], dt: number): HandoverDecision {
    if (candidates.length === 0) {
      return { action: 'stay', reason: 'no candidates' };
    }

    // Sort by SINR descending
    const sorted = [...candidates].sort((a, b) => b.sinrDb - a.sinrDb);
    const best = sorted[0];

    // If not currently serving anyone, pick best above threshold
    if (current.satId === null) {
      if (best.sinrDb >= this.sinrThresholdDb) {
        return {
          action: 'inter-handover',
          target: { satId: best.satId, beamId: best.beamId },
          reason: 'initial attach',
        };
      }
      return { action: 'stay', reason: 'no candidate above threshold' };
    }

    // Intra-LEO beam switch: same satellite, better beam
    if (best.satId === current.satId && best.beamId !== current.beamId && best.sinrDb > current.sinrDb) {
      return {
        action: 'intra-switch',
        target: { satId: best.satId, beamId: best.beamId },
        reason: `intra-switch: SINR ${best.sinrDb.toFixed(1)} > current ${current.sinrDb.toFixed(1)}`,
      };
    }

    // Inter-LEO handover: different satellite with offset condition
    if (best.satId !== current.satId && best.sinrDb - this.offsetDb > current.sinrDb) {
      // Check if this is the same pending target
      const isSameTarget = current.pendingTarget?.satId === best.satId && current.pendingTarget?.beamId === best.beamId;
      const newTriggerTime = isSameTarget ? current.triggerTimeSec + dt : dt;

      if (newTriggerTime >= this.triggerThresholdSec) {
        return {
          action: 'inter-handover',
          target: { satId: best.satId, beamId: best.beamId },
          reason: `inter-HO: SINR ${best.sinrDb.toFixed(1)} - ${this.offsetDb} > ${current.sinrDb.toFixed(1)}, trigger ${newTriggerTime.toFixed(1)}s`,
        };
      }
    }

    return { action: 'stay', reason: 'conditions not met' };
  }
}
