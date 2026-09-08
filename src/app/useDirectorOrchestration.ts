/**
 * Director orchestration hook (P3 extraction, 2026-06-06).
 *
 * The cinematic / live-focus lifecycle — requestDirectorFocus (3 focus paths:
 * artifact cinematic seek, live deferred-seek-then-frame, legacy now-focus), the
 * D3 fade hand-off, and the seven interlocking effects (cinematic auto-end, live
 * deferred-landing, activeCinematicWindow + event-marker cleanup, lane-switch /
 * lane-leave / Escape cancellation) — used to live inline in App.tsx, which the
 * render-layer architecture audit flagged as a god-component hotspot. It is moved
 * here verbatim (behaviour-preserving) so App owns only the wiring and this hook
 * owns the director state machine, mirroring the existing usePlaybackControls /
 * useCameraControls pattern.
 *
 * It owns no truth: it only orchestrates the display-only camera focus + replay/
 * live seek + the 0.05x slow-mo handoff. The actual focus pose + claim honesty
 * live in MainScene / directorFocusPose / liveWalkerDirectorFocus.
 */
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { CameraControls } from '../useCameraControls';
import type { PlaybackControls } from '../usePlaybackControls';
import type { ShowcaseReplayController } from '../showcase/ShowcaseReplayController';
import type { HandoverRailEvent } from '../ui/HandoverEventRail';
import type { SceneLane } from './sceneLane';
import { clampTimelineTime } from './timelineRailAuthority';
import {
  resolveCinematicReplayWindow,
  shouldEndCinematicReplay,
  type CinematicReplayWindow,
} from '../scene/cinematicReplayWindow';
import {
  resolveLiveWalkerFocusWindow,
  type LiveWalkerDirectorFocusClaimKind,
} from '../scene/liveWalkerDirectorFocus';

export interface LiveTimelineSeekRequest {
  targetSec: number;
  requestKey: string;
  /** Only the homepage Director asks the live source to rebuild history. */
  sourceHistoryReplay?: boolean;
}

/**
 * Maximum time an armed live focus may keep the acceptance controls locked
 * while waiting for the asynchronous simulation seek callback.  A seek can be
 * superseded or fail to report its landing; the source event remains in the
 * rail, but the presentation-only arm must fail closed instead of locking the
 * controls forever.
 */
export const LIVE_DIRECTOR_SEEK_ARM_TIMEOUT_MS = 8_000;

export interface UseDirectorOrchestrationParams {
  readonly [key: string]: unknown;
  readonly camera: CameraControls;
  readonly playback: PlaybackControls;
  readonly replayController: ShowcaseReplayController | null;
  readonly directorCinematicEnabled: boolean;
  readonly directorFocusEnabled: boolean;
  readonly artifactHandoverRailEvents: readonly HandoverRailEvent[];
  readonly liveWalkerHandoverRailEvents: readonly HandoverRailEvent[];
  readonly liveDirectorFocusClaimKind: LiveWalkerDirectorFocusClaimKind;
  readonly liveDirectorRailDurationSec: number;
  readonly timelineDurationSec: number;
  readonly liveTimelineWindowStartSec: number;
  readonly reducedMotion: boolean;
  readonly sceneLane: SceneLane;
  readonly currentTimeSec: number;
  /** Replay cursor (artifact axis), tracked by App for the cinematic resolver. */
  readonly currentTimeSecRef: MutableRefObject<number>;
  /** Absolute live sim cursor, set by App's handleSimUpdate, read as "now". */
  readonly liveSimTimeSecRef: MutableRefObject<number>;
  readonly setLiveTimelineSeekRequest: (request: LiveTimelineSeekRequest) => void;
  readonly setLiveObservedHandoverRailEvents: (events: HandoverRailEvent[]) => void;
}

export interface DirectorOrchestration {
  readonly handleDirectorIntraFocus: () => void;
  readonly handleDirectorInterFocus: () => void;
  readonly cinematicFadePulse: number | null;
  readonly handleCinematicSeekPeak: () => void;
  /**
   * Fired by useSimulation the instant it consumes a seek, carrying that seek's
   * requestKey. The live cinema fires the armed Director focus on the EXACT matching
   * key (deterministic landing) instead of watching the throttled published
   * simTimeSec cross a time band — the publish-skip never-fire fix.
   */
  readonly handleLiveSeekLanded: (seekRequestKey: string) => void;
  readonly liveDirectorFocusEventSec: number | null;
  /**
   * Event id of the armed/active live Director focus (null when none). Shares the
   * exact lifecycle of `liveDirectorFocusEventSec`; the handover cinema uses it to
   * look up the focused event's candidate detail in the live Walker index.
   */
  readonly liveDirectorFocusEventId: string | null;
  readonly cancelPendingLiveFocus: () => void;
}

export function useDirectorOrchestration(params: UseDirectorOrchestrationParams): DirectorOrchestration {
  const {
    camera,
    playback,
    replayController,
    directorCinematicEnabled,
    directorFocusEnabled,
    artifactHandoverRailEvents,
    liveWalkerHandoverRailEvents,
    liveDirectorFocusClaimKind,
    liveDirectorRailDurationSec,
    timelineDurationSec,
    liveTimelineWindowStartSec,
    reducedMotion,
    sceneLane,
    currentTimeSec,
    currentTimeSecRef,
    liveSimTimeSecRef,
    setLiveTimelineSeekRequest,
    setLiveObservedHandoverRailEvents,
  } = params;

  // ITEM #C: the source-time of the live Walker handover event the Director focus
  // is seeking to / framing (null when no live focus is armed or active). Drives
  // `data-live-director-focus-event-sec` honesty telemetry (the gate binds the
  // seek target to this real event time) and doubles as the "armed" indicator for
  // the Escape/cancel handler during the async arming window.
  const [liveDirectorFocusEventSec, setLiveDirectorFocusEventSec] = useState<number | null>(null);
  // ITEM #C / cinema (S1): the event id of the armed/active live focus, shared
  // lifecycle with the source-time marker above. Lets the handover cinema resolve
  // the focused event's candidate detail (beam ids + recorded SINR) from the index.
  const [liveDirectorFocusEventId, setLiveDirectorFocusEventId] = useState<string | null>(null);
  const [activeCinematicWindow, setActiveCinematicWindow] = useState<CinematicReplayWindow | null>(null);
  const [cinematicFadePulse, setCinematicFadePulse] = useState<number | null>(null);
  const pendingCinematicSeekRef = useRef<(() => void) | null>(null);
  // Previous replay cursor time, for cinematic auto-end loop-wrap detection.
  const prevCinematicTimeSecRef = useRef(0);
  const pendingLiveFocusRef = useRef<{
    readonly kind: 'intra' | 'inter';
    readonly framing: { readonly fromSatId: string | null; readonly toSatId: string | null };
    readonly seekTargetSec: number;
    // The seek requestKey this focus is armed against; the deterministic landing
    // (handleLiveSeekLanded) fires the camera focus the instant useSimulation reports
    // this exact key consumed — never on the throttled published simTimeSec.
    readonly requestKey: string;
  } | null>(null);
  const pendingLiveFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingLiveFocusTimeout = useCallback(() => {
    const timeout = pendingLiveFocusTimeoutRef.current;
    if (timeout === null) return;
    clearTimeout(timeout);
    pendingLiveFocusTimeoutRef.current = null;
  }, []);

  // ITEM #C: cancel any armed-but-unfired live Director focus. Nulls the deferred
  // focus AND the not-yet-run fade-peak seek closure, and clears the event marker.
  // Used on a lane switch (the pending event belongs to the previous lane's index)
  // and on an exit/Escape during the async arming window (so the focus the user
  // tried to abort never engages).
  const cancelPendingLiveFocus = useCallback(() => {
    pendingLiveFocusRef.current = null;
    pendingCinematicSeekRef.current = null;
    clearPendingLiveFocusTimeout();
    setLiveDirectorFocusEventSec(null);
    setLiveDirectorFocusEventId(null);
  }, [clearPendingLiveFocusTimeout]);

  const requestDirectorFocus = useCallback((kind: 'intra' | 'inter') => {
    if (directorCinematicEnabled && replayController) {
      // Resolve on the artifact's absolute tSec axis (events carry event.tSec,
      // currentTimeSecRef tracks the replay cursor in the same axis).
      const replayWindow = resolveCinematicReplayWindow(
        artifactHandoverRailEvents,
        kind,
        currentTimeSecRef.current,
        timelineDurationSec,
      );
      if (!replayWindow) return;
      const runCinematicSeek = () => {
        if (playback.paused) playback.togglePause();
        // Real reposition; the artifact scene frame is a render-time memo on
        // currentTimeSec, so it recomputes from the selected replay cursor.
        replayController.seek(replayWindow.startSec);
        setActiveCinematicWindow(replayWindow);
        const framing = { fromSatId: replayWindow.fromSatId, toSatId: replayWindow.toSatId };
        if (kind === 'intra') camera.requestIntraFocus(framing);
        else camera.requestInterFocus(framing);
      };
      if (reducedMotion) {
        runCinematicSeek();
      } else {
        pendingCinematicSeekRef.current = runCinematicSeek;
        setCinematicFadePulse(prev => (prev === null ? 0 : prev + 1));
      }
      return;
    }
    // ── ITEM #C: LIVE WALKER lanes — seek to the next handover event, frame the
    // satellite pair, and play it in 0.05x slow-mo (mirrors the artifact cinematic).
    // The live walker is forward-only, but a SEEK to one indexed event pins an
    // unambiguous (fromSat, toSat, sourceTime) triple, resolving the old "which
    // handover is currently active?" ambiguity that previously scoped sat-pair
    // framing to the artifact lane only. The seek target is always a real
    // source-time (docs/live-walker-handover-event-map-sdd.md); the claim stays
    // profile-derived-forecast / overlay-demo, never producer proof.
    if (directorFocusEnabled) {
      const focusTarget = resolveLiveWalkerFocusWindow(
        liveWalkerHandoverRailEvents,
        kind,
        liveSimTimeSecRef.current,
        liveDirectorRailDurationSec,
        liveDirectorFocusClaimKind,
      );
      if (focusTarget) {
        // Mark the focus armed for the WHOLE window (fade + async seek-land) so
        // Escape / viewport-click / lane-switch can cancel it at any point, and so
        // the honesty telemetry exposes the real resolved event source-time.
        setLiveDirectorFocusEventSec(focusTarget.eventSec);
        setLiveDirectorFocusEventId(focusTarget.eventId);
        const runLiveFocusSeek = () => {
          // Play the sim so the slow-mo glides INTO the upcoming handover.
          if (playback.paused) playback.togglePause();
          const seekRequestKey = `${focusTarget.seekTargetSec.toFixed(3)}:${Date.now().toString(36)}`;
          // Arm the deferred camera focus BEFORE issuing the seek so the seek-landed
          // callback (fired when useSimulation consumes this exact requestKey) always
          // finds the pending focus. The camera focus is deferred — not fired now — so
          // MainScene's lookupSatWorldPos frames the POST-seek fromSat/toSat positions,
          // not the pre-seek pose.
          pendingLiveFocusRef.current = {
            kind,
            framing: { fromSatId: focusTarget.fromSatId, toSatId: focusTarget.toSatId },
            seekTargetSec: focusTarget.seekTargetSec,
            requestKey: seekRequestKey,
          };
          clearPendingLiveFocusTimeout();
          pendingLiveFocusTimeoutRef.current = setTimeout(() => {
            const pending = pendingLiveFocusRef.current;
            if (pending?.requestKey !== seekRequestKey) return;
            // The source event remains authoritative in the rail; only release
            // this presentation arm when the async landing callback is absent.
            pendingLiveFocusRef.current = null;
            setLiveDirectorFocusEventSec(null);
            setLiveDirectorFocusEventId(null);
            pendingLiveFocusTimeoutRef.current = null;
          }, LIVE_DIRECTOR_SEEK_ARM_TIMEOUT_MS);
          // Seek the live timeline exactly as a handover-rail marker click does:
          // the source-time lead-in is consumed as the absolute sim offset by
          // useSimulation.seekToTimelineFrame.
          setLiveTimelineSeekRequest({
            targetSec: focusTarget.seekTargetSec,
            requestKey: seekRequestKey,
            sourceHistoryReplay: true,
          });
          setLiveObservedHandoverRailEvents([]);
        };
        if (reducedMotion) {
          runLiveFocusSeek();
        } else {
          pendingCinematicSeekRef.current = runLiveFocusSeek;
          setCinematicFadePulse(prev => (prev === null ? 0 : prev + 1));
        }
        return;
      }
      // No resolvable indexed event: fail closed.  A Director acceptance action
      // must never create a camera-only focus without a source event/time.  The
      // explicit `Trigger Intra` control is the separate, seek-free engine jog;
      // it does not come through this source-backed focus path.
      return;
    }
    // Non-artifact, non-live lanes have no source-backed Director event surface.
    // Keep the callback inert rather than presenting a source-less camera shot.
    return;
  }, [
    artifactHandoverRailEvents,
    camera,
    clearPendingLiveFocusTimeout,
    directorCinematicEnabled,
    directorFocusEnabled,
    liveDirectorFocusClaimKind,
    liveDirectorRailDurationSec,
    liveSimTimeSecRef,
    liveTimelineWindowStartSec,
    liveWalkerHandoverRailEvents,
    playback,
    replayController,
    reducedMotion,
    currentTimeSecRef,
    setLiveObservedHandoverRailEvents,
    setLiveTimelineSeekRequest,
    timelineDurationSec,
  ]);

  const handleCinematicSeekPeak = useCallback(() => {
    const run = pendingCinematicSeekRef.current;
    pendingCinematicSeekRef.current = null;
    run?.();
  }, []);

  const handleDirectorIntraFocus = useCallback(() => requestDirectorFocus('intra'), [requestDirectorFocus]);
  const handleDirectorInterFocus = useCallback(() => requestDirectorFocus('inter'), [requestDirectorFocus]);

  // Cinematic auto-end: when the replay cursor reaches the window end (or wraps
  // past it), restore. directorFocusActive then drops, effectiveSpeed returns to
  // normal, and replay resumes its normal rate from there.
  useEffect(() => {
    const prevTimeSec = prevCinematicTimeSecRef.current;
    const cinematicCurrentTimeSec = currentTimeSec;
    prevCinematicTimeSecRef.current = cinematicCurrentTimeSec;
    if (shouldEndCinematicReplay(
      activeCinematicWindow,
      camera.directorPhase,
      prevTimeSec,
      cinematicCurrentTimeSec,
    )) {
      camera.exitDirectorFocus();
    }
  }, [activeCinematicWindow, camera, camera.directorPhase, currentTimeSec]);

  // ── ITEM #C: live Director focus DETERMINISTIC landing. The live seek lands
  // asynchronously (useSimulation rebuilds the frame at the target); App's simState
  // is published by the THROTTLED useSimStatePublisher, which can SKIP the exact
  // post-seek simTimeSec for a small / near-event seek — so the old time-band watcher
  // on the published cursor intermittently never fired (the gate-5 intra never-fire).
  // Instead, useSimulation calls back the instant it consumes a seek, carrying that
  // seek's requestKey; we fire the armed focus on the EXACT matching key —
  // deterministic in either seek direction, immune to publish throttling. Firing only
  // AFTER the seek frame is built keeps MainScene's lookupSatWorldPos resolving the
  // POST-seek fromSat/toSat positions for the pose.
  const handleLiveSeekLanded = useCallback((landedSeekRequestKey: string) => {
    const pending = pendingLiveFocusRef.current;
    if (pending === null || pending.requestKey !== landedSeekRequestKey) return;
    clearPendingLiveFocusTimeout();
    // Engage only from idle; a re-arm mid-focus is replaced by the next arm, not
    // queued.  Drop the stale arm/marker here; the old early return left both
    // set and permanently disabled Next Intra/Inter.
    if (camera.directorPhase !== 'idle') {
      pendingLiveFocusRef.current = null;
      setLiveDirectorFocusEventSec(null);
      setLiveDirectorFocusEventId(null);
      return;
    }
    pendingLiveFocusRef.current = null;
    if (pending.kind === 'intra') camera.requestIntraFocus(pending.framing);
    else camera.requestInterFocus(pending.framing);
  }, [camera, clearPendingLiveFocusTimeout]);

  useEffect(() => {
    return () => clearPendingLiveFocusTimeout();
  }, [clearPendingLiveFocusTimeout]);

  useEffect(() => {
    if (camera.directorPhase === 'idle' && activeCinematicWindow !== null) {
      setActiveCinematicWindow(null);
    }
  }, [activeCinematicWindow, camera.directorPhase]);

  // ITEM #C: clear the live focus event marker once a FIRED focus returns to idle
  // (exit/auto-restore). During the arming window the pending ref is still set and
  // the phase is idle, so the `pendingLiveFocusRef.current === null` guard leaves
  // the marker in place until the focus actually engages or is cancelled.
  useEffect(() => {
    if (
      camera.directorPhase === 'idle'
      && pendingLiveFocusRef.current === null
      && pendingCinematicSeekRef.current === null
      && liveDirectorFocusEventSec !== null
    ) {
      setLiveDirectorFocusEventSec(null);
      setLiveDirectorFocusEventId(null);
    }
  }, [camera.directorPhase, liveDirectorFocusEventSec]);

  // ITEM #C: a lane switch (appMode change keeps sceneSource=live-sim, so both
  // live lanes keep directorFocusEnabled true and the lane-leave cleanup below
  // does NOT fire) must drop any armed-but-unfired focus — its event/framing came
  // from the previous lane's live Walker index and would otherwise fire on the new
  // lane against a stale satellite pair.
  useEffect(() => {
    cancelPendingLiveFocus();
  }, [sceneLane, cancelPendingLiveFocus]);

  useEffect(() => {
    if (!directorFocusEnabled && !directorCinematicEnabled) {
      camera.exitDirectorFocus();
      setActiveCinematicWindow(null);
      // Drop any armed-but-unfired live focus so it can't fire after the lane left.
      cancelPendingLiveFocus();
    }
  }, [directorFocusEnabled, directorCinematicEnabled, camera, cancelPendingLiveFocus]);

  // ITEM #C: Escape exits an active focus AND cancels an armed-but-unfired one.
  // Register the listener while a focus is active (phase !== idle) OR arming
  // (a live event marker is set while still idle), so an abort during the ~300ms
  // fade + async-seek-land window is honored instead of silently engaging.
  useEffect(() => {
    if (camera.directorPhase === 'idle' && liveDirectorFocusEventSec === null) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      cancelPendingLiveFocus();
      camera.exitDirectorFocus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [camera, camera.directorPhase, liveDirectorFocusEventSec, cancelPendingLiveFocus]);

  return {
    handleDirectorIntraFocus,
    handleDirectorInterFocus,
    cinematicFadePulse,
    handleCinematicSeekPeak,
    handleLiveSeekLanded,
    liveDirectorFocusEventSec,
    liveDirectorFocusEventId,
    cancelPendingLiveFocus,
  };
}
