/**
 * INV-3: this resolver only SELECTS and BOUNDS real handover-rail events.
 * It fabricates no times, synthesizes no events, and owns no motion.
 */
import { eventSourceTimeSec, type HandoverRailEvent, type HandoverRailEventKind } from '../ui/HandoverEventRail';
import type { DirectorFocusPhase } from './types';

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
  readonly fromSatId: string | null;
  readonly toSatId: string | null;
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
    fromSatId: target.event.fromSatId ?? null,
    toSatId: target.event.toSatId ?? null,
  };
}

// A backward jump in the absolute sim clock larger than this (while focused) is
// treated as a timeline loop-wrap or an external seek, not normal slow playback.
export const CINEMATIC_WRAP_BACKSTEP_SEC = 0.001;

export function shouldEndCinematicReplay(
  window: CinematicReplayWindow | null,
  phase: DirectorFocusPhase,
  prevTimeSec: number,
  currentTimeSec: number,
): boolean {
  if (!window) return false;
  // Wait until the camera settles; acquiring includes the seek/tween handoff.
  if (phase !== 'focused') return false;
  if (!Number.isFinite(currentTimeSec)) return false;
  // Normal end: playback advanced to (or past) the window end.
  if (currentTimeSec >= window.endSec) return true;
  // Loop-wrap / backward-seek end: when the window end sits near maxTimeSec the live
  // sim can wrap (or the user can seek) past the end without ever satisfying the
  // forward check above; ending here avoids holding 0.05x slow-mo indefinitely.
  if (Number.isFinite(prevTimeSec) && currentTimeSec < prevTimeSec - CINEMATIC_WRAP_BACKSTEP_SEC) {
    return true;
  }
  return false;
}
