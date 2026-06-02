/**
 * INV-3: this resolver only SELECTS and BOUNDS real handover-rail events.
 * It fabricates no times, synthesizes no events, and owns no motion.
 */
import { eventSourceTimeSec, type HandoverRailEvent, type HandoverRailEventKind } from '../ui/HandoverEventRail';

export const CINEMATIC_LEAD_IN_SEC = 2;
// Mirrors engine RECENT_HO_LINGER_SEC = 5: the post-handover settle/linger window.
export const CINEMATIC_LEAD_OUT_SEC = 5;

export interface CinematicReplayWindow {
  readonly eventId: string;
  readonly kind: HandoverRailEventKind;
  readonly eventSec: number;
  readonly startSec: number;
  readonly endSec: number;
  readonly windowDurationSec: number;
}

export function resolveCinematicReplayWindow(
  events: readonly HandoverRailEvent[],
  kind: HandoverRailEventKind,
  nowSec: number,
  durationSec: number,
  opts?: { leadInSec?: number; leadOutSec?: number },
): CinematicReplayWindow | null {
  const safeDuration = Number.isFinite(durationSec) ? Math.max(0, durationSec) : 0;
  if (safeDuration <= 0) return null;

  const now = Number.isFinite(nowSec) ? nowSec : 0;
  const leadIn = Math.max(0, opts?.leadInSec ?? CINEMATIC_LEAD_IN_SEC);
  const leadOut = Math.max(0, opts?.leadOutSec ?? CINEMATIC_LEAD_OUT_SEC);
  const candidates = events
    .filter(event => event.kind === kind)
    .map(event => ({ event, t: eventSourceTimeSec(event) }))
    .filter(candidate => Number.isFinite(candidate.t))
    .sort((a, b) => a.t - b.t || a.event.id.localeCompare(b.event.id));

  if (candidates.length <= 0) return null;

  const target = candidates.find(candidate => candidate.t >= now) ?? candidates[0];
  const clamp = (value: number): number => Math.min(Math.max(value, 0), safeDuration);
  const eventSec = clamp(target.t);
  const startSec = clamp(target.t - leadIn);
  const endSec = clamp(target.t + leadOut);
  const windowDurationSec = endSec - startSec;

  if (windowDurationSec <= 0) return null;

  return {
    eventId: target.event.id,
    kind,
    eventSec,
    startSec,
    endSec,
    windowDurationSec,
  };
}
