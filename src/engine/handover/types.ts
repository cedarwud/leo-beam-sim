import type { HandoverCommitPath } from './commitProvenance';

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
  /**
   * Which authority approved this commit, stated by the committing code rather
   * than recovered by matching `reason` text.
   *
   * Invariant: `HandoverManager.commitDecision` is the only writer, so
   * `provenance != null` is equivalent to "this decision committed a handover".
   * A `stay` or pending decision leaves it undefined. Converging the commit
   * paths depends on that equivalence, so do not set it anywhere else.
   */
  provenance?: HandoverCommitPath;
}

export interface HandoverEvent {
  timeMs: number;
  action: HandoverAction;
  fromSatId: string | null;
  fromBeamId: number | null;
  fromSinrDb: number | null;
  toSatId: string;
  toBeamId: number;
  toSinrDb: number;
  deltaDb: number | null;
}

export interface IntraSwitchPreview {
  satId: string;
  fromBeamId: number;
  toBeamId: number;
  triggerTimeSec: number;
  triggerTimeTargetSec: number;
  progress: number;
}
