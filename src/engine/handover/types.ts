import type { LinkSample } from '../signal/types';

export interface ServingState {
  satId: string | null;
  beamId: number | null;
  sinrDb: number;
  /** Accumulated trigger time for pending handover (seconds) */
  triggerTimeSec: number;
  /** Target candidate during trigger accumulation */
  pendingTarget: { satId: string; beamId: number } | null;
}

export type HandoverAction = 'stay' | 'intra-switch' | 'inter-handover';

export interface HandoverDecision {
  action: HandoverAction;
  target?: { satId: string; beamId: number };
  reason: string;
}

export interface HandoverEvent {
  timeMs: number;
  action: HandoverAction;
  fromSatId: string | null;
  fromBeamId: number | null;
  toSatId: string;
  toBeamId: number;
  sinrDb: number;
}

export interface HandoverPolicy {
  evaluate(
    current: ServingState,
    candidates: LinkSample[],
    dt: number,
  ): HandoverDecision;
}
