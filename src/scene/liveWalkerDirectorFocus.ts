/**
 * ITEM #C — live-walker Director focus resolver.
 *
 * The artifact-replay lane's Director "cinematic" seeks the seekable replay to the
 * next handover window and frames the satellite pair (`resolveCinematicReplayWindow`
 * + `camera.requestInterFocus`). The LIVE WALKER lanes (`sinr-live`,
 * `modqn-live-cell-preview`) run a real multi-plane Walker constellation that
 * genuinely produces inter-satellite handovers; this resolver lets the live
 * Director button do the same seek-to-next-HO + sat-pair framing against the
 * validated live Walker handover event index
 * (docs/live-walker-handover-event-map-sdd.md).
 *
 * Governance / honesty: this only SELECTS a real, indexed live-walker rail event
 * and returns its source-time seek target plus the involved satellite ids. It
 * fabricates no event, no time, and no horizon — the seek target is always a real
 * `sourceTimeSec` (SDD: "The bottom timeline seek target is always sourceTimeSec").
 * The claim stays `profile-derived-forecast` (sinr-live) or `overlay-demo`
 * (modqn-live-cell-preview), never producer proof. It reuses the proven artifact
 * selection (`resolveCinematicReplayWindow`) so the "next event at/after now,
 * deterministic tie-break, clamp to source duration" behaviour is identical and
 * single-sourced — the only difference is the live-honest type/claim wrapper.
 *
 * FORECAST-FIDELITY LIMIT (honest, codex-reviewed 2026-06-04): on the LIVE lane the
 * seek re-simulates from a RESET handover state at the lead-in (useSimulation's
 * seekToTimelineFrame resets the HandoverManager), so the UE cold-attaches to the
 * handover TARGET satellite at the framed moment rather than replaying a warm
 * from->to make-before-break. The indexed handover still fires in the running sim
 * (verified), and the camera frames the real from/to pair, but the pre-handover
 * serving history of the FROM satellite is not reconstructed (that needs the full
 * sim history, impractical to warm up at 0.05x). This is inherent to the live
 * re-sim path and is exactly why the claim is `profile-derived-forecast`, never a
 * producer-recorded handover replay (that fidelity lives on the artifact lane).
 */
import { resolveCinematicReplayWindow } from './cinematicReplayWindow';
import type { HandoverRailEvent, HandoverRailEventKind } from '../ui/HandoverEventRail';

export type LiveWalkerDirectorFocusClaimKind = 'live-truth' | 'profile-derived-forecast' | 'overlay-demo';

export interface LiveWalkerDirectorFocusTarget {
  readonly eventId: string;
  readonly kind: HandoverRailEventKind;
  /** Real source-time of the selected handover event (live Walker index axis). */
  readonly eventSec: number;
  /**
   * Seek target on the live timeline: the lead-in BEFORE the event, in source
   * time. Seeking here (rather than exactly at the event) lets the 0.05x slow-mo
   * play INTO the handover. It is always a real source-time clamped to the
   * window, never a fabricated horizon.
   */
  readonly seekTargetSec: number;
  readonly fromSatId: string | null;
  readonly toSatId: string | null;
  /** Honest claim of the live focus: never producer proof. */
  readonly claimKind: LiveWalkerDirectorFocusClaimKind;
}

export function resolveLiveWalkerFocusWindow(
  events: readonly HandoverRailEvent[],
  kind: HandoverRailEventKind,
  nowSec: number,
  durationSec: number,
  claimKind: LiveWalkerDirectorFocusClaimKind,
): LiveWalkerDirectorFocusTarget | null {
  const window = resolveCinematicReplayWindow(events, kind, nowSec, durationSec);
  if (window === null) return null;
  return {
    eventId: window.eventId,
    kind: window.kind,
    eventSec: window.eventSec,
    // window.startSec = clamp(eventSec - lead-in, [0, duration]): a real source-time.
    seekTargetSec: window.startSec,
    fromSatId: window.fromSatId,
    toSatId: window.toSatId,
    claimKind,
  };
}
