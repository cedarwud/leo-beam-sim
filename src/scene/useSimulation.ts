import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { createObserverContext } from '../engine/orbit';
import {
  HandoverManager,
  type HandoverDecisionOverride,
} from '../engine/handover/handover-manager';
import type { Profile } from '../profiles/types';
import type { UeDistributionMode, UePrimaryAnchorMode } from '../engine/ue/multiUeState';
import {
  createMobilityStates,
  DEFAULT_UE_MOBILITY_PARAMS,
  type UeMobilityMode,
  type UeMobilityParams,
  type UePerMobilityState,
} from '../engine/ue/multiUeMobility';
import type { ReplayConfig, SimFrame, UeDistributionScope } from './types';
import { createEmptyFrame, normalizeReplayOffset } from './simulationHelpers';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  readWallClockMs,
  stepRuntimeFrame,
  type RuntimeFrameStepState,
} from './runtimeFrameStep';
import {
  attachSinrLiveCellFrame,
  createSinrLiveCellModel,
} from './sinrLiveCellRuntime';
import { reScalarize } from '../modqn/replay-bundle/rescalarize';
import { computeHeuristicNotPaperScore } from '../engine/handover/decision-override';
import {
  ModqnEnvelopeContext,
  ModqnHandoverModeContext,
} from '../modqn/runtimeContext';
import type { ReScalarizeResult } from '../modqn/replay-bundle/rescalarize';

// S3: HandoverManager subclass that injects the S3 decisionOverride ref on
// every `.update()` call so stepRuntimeFrame (src/scene/runtimeFrameStep.ts,
// which is FROZEN this slice) picks up the override without modification.
// When `overrideRef.current` is null the call is byte-equivalent to the base
// class — SDD §9.7 truth invariance is preserved for sinr-offset mode.
class S3HandoverManager extends HandoverManager {
  // React MutableRefObject equivalent (plain object ref — no React dep needed).
  overrideRef: { current: HandoverDecisionOverride | null } = { current: null };

  override update(
    candidates: Parameters<HandoverManager['update']>[0],
    dt: Parameters<HandoverManager['update']>[1],
    simTimeMs: Parameters<HandoverManager['update']>[2],
    explicitOverride?: HandoverDecisionOverride,
  ) {
    return super.update(
      candidates,
      dt,
      simTimeMs,
      explicitOverride ?? (this.overrideRef.current ?? undefined),
    );
  }
}

function resolveModqnReplayOverrideTarget(
  input: Parameters<HandoverDecisionOverride>[0],
  result: ReScalarizeResult,
): { satId: string; beamId: number } | null {
  const { candidates, serving, sortedBySinrDesc } = input;
  const exactCandidate = candidates.find(
    candidate => candidate.satId === result.satId && candidate.beamId === result.beamId,
  );
  if (exactCandidate) {
    return { satId: exactCandidate.satId, beamId: exactCandidate.beamId };
  }

  // The producer artifact is a 1-satellite / 7-beam replay surface and names
  // its selected satellite as `sat-0`. The live showcase scene may keep a richer
  // visual profile, so preserve the producer's local beam choice while choosing
  // the most relevant live satellite for the existing HandoverManager timing.
  const sameServingSatCandidate = serving.satId === null
    ? undefined
    : candidates.find(candidate => (
      candidate.satId === serving.satId
      && candidate.beamId === result.beamId
    ));
  if (sameServingSatCandidate) {
    return { satId: sameServingSatCandidate.satId, beamId: sameServingSatCandidate.beamId };
  }

  const bestVisibleLocalBeamCandidate = sortedBySinrDesc.find(candidate => candidate.beamId === result.beamId);
  return bestVisibleLocalBeamCandidate === undefined
    ? null
    : {
      satId: bestVisibleLocalBeamCandidate.satId,
      beamId: bestVisibleLocalBeamCandidate.beamId,
    };
}

export {
  CACHE_ELEVATION_DEG,
  MAX_STEERING_EXTRA_RINGS,
  MIN_ELEVATION_DEG,
  RECENT_HO_LINGER_SEC,
  SIM_DURATION_SEC,
  SIM_STEP_SEC,
  SKY_DOME_H_RADIUS,
  SKY_DOME_V_RADIUS,
} from './runtimeFrameStep';

/**
 * G2-WARMSTART: the CAP on how much sim-time the warm-up run-through may advance the
 * model through at the first sinr-live cold-start. A freshly attached
 * `HandoverManager` cannot hand over until its `pingPongGuardSec` (30s) + TTT (3.5s)
 * elapse, so a cold start shows ZERO handovers (and zero G2c pulse cones) for the
 * first ~42s of the candidate-rich demo (`demoStartOffsetSec` 450; probe
 * `scripts/_probe-warmstart.ts`). The run-through STOPS at the first frame that
 * carries a live pulse (break-on-pulse), so it normally ends at the first post-guard
 * handover burst (~42s), NOT this cap — the cap only bounds a quiet window
 * (handovers are bursty, so a fixed endpoint can land in a >4s inter-burst gap and
 * open with no pulse cones). The warm-up runs the REAL model forward (fabricates
 * nothing — Rule#6); it is sinr-live-lane only and runs once (the demo open).
 */
const SINR_LIVE_WARMUP_CAP_SEC = 130;
/**
 * Coarse sim-time step for the warm-up run-through. Matches the offline event index's
 * 2s scan (the HO guard/TTT are sim-time integrated, so a 2s grain accumulates them
 * faithfully); break-on-pulse keeps the typical one-time cost to ~21 steps (~0.5s).
 */
const SINR_LIVE_WARMUP_STEP_SEC = 2;

export function useSimulation(
  profile: Profile,
  replay: ReplayConfig,
  speed: number,
  paused: boolean,
  signalResetKey?: string,
  handoverResetKey?: string,
  beamFootprintMultiplier?: number,
  ueCount?: number,
  ueDistributionMode: UeDistributionMode = 'random',
  uePrimaryAnchorMode: UePrimaryAnchorMode = 'observer',
  ueMobilityMode: UeMobilityMode = 'static',
  ueMobilityParams: UeMobilityParams = DEFAULT_UE_MOBILITY_PARAMS,
  ueDistributionScope: UeDistributionScope = 'beam-footprint',
  ueDistributionRadiusKm?: number,
  mapKmPerWorldUnit?: number,
  // S-cells-2 (ADDITIVE): when true (sceneLane === 'sinr-live' only) the
  // earth-fixed cell truth is layered onto each published frame as the new
  // optional `frame.sinrLiveCells`. `stepRuntimeFrame` stays FROZEN; existing
  // frame fields are byte-identical, so the other three lanes see zero drift.
  useEarthFixedCellTruth: boolean = false,
  // Deterministic Director-focus landing: invoked the instant a seek is applied
  // (buildRuntimeStateAt at the target) with the consumed seekRequestKey. The live
  // cinema fires the camera focus on this exact signal instead of waiting for the
  // THROTTLED published simTimeSec to cross a time band — which the publisher can skip
  // for small / near-event seeks, stranding an armed focus → intermittent never-fire.
  onSeekLanded?: (seekRequestKey: string) => void,
  // Demo intra-handover jog: ENU offset (km) applied to the PRIMARY UE only, so it
  // crosses into an adjacent same-sat beam cell and the engine does a real intra.
  primaryJogEastKm: number = 0,
  primaryJogNorthKm: number = 0,
): SimFrame {
  // S3: read handover mode + current bundle envelope from contexts. When the
  // mode contexts are absent (headless tests, pure SINR render) we fall back to
  // sinr-offset behavior (no override installed — truth invariance preserved).
  const { envelope, slotOffset } = useContext(ModqnEnvelopeContext);
  const modeCtx = useContext(ModqnHandoverModeContext);
  const { mode: handoverMode, omegaActive, incrementRescalarizeFallback } = modeCtx;

  // Stable refs so the override closure (below) always reads the latest values
  // from the current render without needing to be recreated.
  const incrementFallbackRef = useRef(incrementRescalarizeFallback);
  incrementFallbackRef.current = incrementRescalarizeFallback;
  const envelopeRef = useRef(envelope);
  envelopeRef.current = envelope;
  const slotOffsetRef = useRef(slotOffset);
  slotOffsetRef.current = slotOffset;
  const handoverModeRef = useRef(handoverMode);
  handoverModeRef.current = handoverMode;
  const omegaActiveRef = useRef(omegaActive);
  omegaActiveRef.current = omegaActive;

  // Build the decisionOverride callback. It is stable (referentially) across
  // renders and reads the latest values from refs at call time. When
  // handoverMode is `sinr-offset` (or any unknown mode) the override returns
  // null on every call, which is byte-equivalent to no-override
  // (SDD §9.7 truth invariance).
  //
  // S4 (SDD §9.5): when handoverMode === 'omega-heuristic' the override
  // consults `computeHeuristicNotPaperScore` over the live candidate set. The
  // selected beam still flows through HandoverManager for trigger timing and
  // ping-pong-guard timing (engine-side, unchanged); only the argmax step is
  // replaced. The heuristic does NOT use re-scalarization or the bundle —
  // SDD §4.4 item 3 forbids the bundle parser from emitting this mode.
  const decisionOverride = useCallback<HandoverDecisionOverride>(input => {
    const mode = handoverModeRef.current;

    if (mode === 'decision-overlay-on-live-sinr') {
      const env = envelopeRef.current;
      if (!env) return null;

      const safeSlot = Math.min(
        Math.max(Math.trunc(slotOffsetRef.current), 0),
        Math.max(env.replaySlots.length - 1, 0),
      );
      const slot = env.replaySlots[safeSlot] ?? env.replaySlots[0];
      const row = slot?.rows[0];
      if (!row) return null;

      const diag = row.producerTruth.policyDiagnostics;
      const candidates = diag?.topCandidates;
      if (!candidates || candidates.length === 0) return null;

      const omega = omegaActiveRef.current;
      const result = reScalarize(candidates, omega);
      if (!result) return null;

      if (result.wasFallback) {
        incrementFallbackRef.current();
      }

      return resolveModqnReplayOverrideTarget(input, result);
    }

    if (mode === 'omega-heuristic') {
      const omega = omegaActiveRef.current;
      const heuristicResult = computeHeuristicNotPaperScore({
        omega,
        candidates: input.candidates,
        serving: input.serving,
      });
      if (!heuristicResult) return null;
      return { satId: heuristicResult.satId, beamId: heuristicResult.beamId };
    }

    return null;
  }, []); // deps intentionally empty — all mutable reads go through refs

  const observer = useMemo(
    () => createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg),
    [profile.orbit.observerLatDeg, profile.orbit.observerLonDeg],
  );

  const beamLayoutsByShellId = useMemo(() => {
    return createBeamLayoutsByShellId(profile);
  }, [
    profile.antenna.beamwidth3dBRad,
    profile.antenna.maxSteeringAngleDeg,
    profile.beams.frequencyReuse,
    profile.beams.perSatellite,
    profile.orbit.shells,
  ]);

  const trajectoryCache = useMemo(() => {
    return createTrajectoryCache(profile, observer, replay.epochUtcMs);
  }, [observer, profile.orbit.shells, replay.epochUtcMs]);

  // S3: use the subclass so stepRuntimeFrame picks up the override without
  // needing a frozen-file edit.
  const hoManager = useMemo(() => new S3HandoverManager(profile.handover), [profile.handover]);
  const requestedUeCount = Math.trunc(ueCount ?? 1);
  const effectiveUeCount = Number.isFinite(requestedUeCount) ? Math.max(1, requestedUeCount) : 1;
  const secondaryHoManagers = useMemo(
    () => Array.from(
      { length: Math.max(0, effectiveUeCount - 1) },
      () => new HandoverManager(profile.handover),
    ),
    [effectiveUeCount, profile.handover],
  );
  // S-cells-2 (ADDITIVE): the earth-fixed cell-truth model. `null` on every lane
  // but sinr-live (the gate is off → byte-identical frames there). Recreated only
  // on a profile / lane-gate / epoch change, which also resets its internal cell
  // HandoverManagers — the intended full reset for those transitions.
  const sinrLiveCellModel = useMemo(
    () => createSinrLiveCellModel(profile, useEarthFixedCellTruth, replay.epochUtcMs),
    [profile, useEarthFixedCellTruth, replay.epochUtcMs],
  );
  const effectiveUeMobilityParams = ueMobilityParams ?? DEFAULT_UE_MOBILITY_PARAMS;
  const ueDeterministicSeed = profile.ueDistribution?.seed ?? 42;
  const createCurrentMobilityStates = useCallback(() => (
    createMobilityStates(effectiveUeCount, ueMobilityMode, effectiveUeMobilityParams, ueDeterministicSeed)
  ), [effectiveUeCount, ueMobilityMode, effectiveUeMobilityParams, ueDeterministicSeed]);
  const mobilityStatesRef = useRef<UePerMobilityState[]>(createCurrentMobilityStates());
  const maxTimeSec = getTrajectoryMaxTimeSec(trajectoryCache);
  const initialSimTimeSec = normalizeReplayOffset(replay.startOffsetSec, maxTimeSec, replay.loop);
  const runtimeStateRef = useRef<RuntimeFrameStepState>(
    createRuntimeFrameStepState(initialSimTimeSec),
  );
  const frameRef = useRef<SimFrame>(createEmptyFrame(initialSimTimeSec));
  const publishNextFrameRef = useRef(true);
  // G2-WARMSTART: the warm-up run-through is a ~0.5s synchronous main-thread cost,
  // so it runs ONCE — the first sinr-live cold-start (the demo open) — not on every
  // later cold-start (handover/signal reset, profile switch), which would re-freeze
  // the UI. Those subsequent cold-starts open cold and re-warm naturally as the sim
  // plays forward.
  const hasWarmedOnceRef = useRef(false);
  const [, setVersion] = useState(0);

  const installDecisionOverride = useCallback(() => {
    // MODQN consolidation: the MODQN live page reuses the SINR scene render directly,
    // so the PRIMARY UE now runs the live SINR-offset serving (same as the 99
    // secondaries) instead of the decision-overlay override. The override re-scalarized
    // the DEGENERATE producer envelope (collapsed to ~1 beam / 0 multi-beam cones),
    // which defeated the point of the scene. The MODQN proof is the Q-value sidebar
    // (reads modqnReplayEnvelope directly), NOT a scene-driving override. The
    // omega-heuristic path is unchanged.
    hoManager.overrideRef.current =
      handoverModeRef.current === 'omega-heuristic' ? decisionOverride : null;
  }, [decisionOverride, hoManager]);

  // S3-2 / S4-1: one helper for both kinds of HO-manager time transition.
  //  - 'cold-start' (mount, profile change, signalReset, handoverReset): full
  //    reset() — fresh state, no serving carried.
  //  - 'rebase' (loop/window wrap, seek): clock-REBASE the managers by the
  //    sim-time jump (offsets only guardUntilMs/pendingSinceMs), keeping serving +
  //    eventLog so a UE survives the jump instead of cold-re-acquiring under the
  //    strict re-attach threshold (the served-N/N flicker, S3 plan §1.6).
  // S4-1 extends the rebase to the cell-truth model (sinrLiveCellModel) so it now
  // rebases on a time-shift and resets only on cold-start, in lockstep with the
  // steered managers (was: ALWAYS reset — the D5 hole deferred from S3-2). null on
  // non-sinr-live lanes.
  const transitionHoManagers = useCallback(
    (transition: { kind: 'cold-start' } | { kind: 'rebase'; deltaMs: number }) => {
      if (transition.kind === 'rebase') {
        hoManager.rebase(transition.deltaMs);
        secondaryHoManagers.forEach(manager => manager.rebase(transition.deltaMs));
        sinrLiveCellModel?.rebase(transition.deltaMs);
      } else {
        hoManager.reset();
        secondaryHoManagers.forEach(manager => manager.reset());
        sinrLiveCellModel?.reset();
      }
    },
    [hoManager, secondaryHoManagers, sinrLiveCellModel],
  );

  // Cold-start wrapper — the named helper the signalReset effect + per-UE
  // handover gate (validate:phase-f) reference. Time-shift callers
  // (resetToReplayStartFrame timeShift, seekToTimelineFrame) call
  // transitionHoManagers({ kind: 'rebase', … }) directly.
  const resetAllHoManagers = useCallback(() => {
    transitionHoManagers({ kind: 'cold-start' });
  }, [transitionHoManagers]);

  const resetMobilityStates = useCallback(() => {
    mobilityStatesRef.current = createCurrentMobilityStates();
  }, [createCurrentMobilityStates]);

  // S3-3: the SINGLE "construct the runtime state at sim-time T" recipe. It
  // collapses the three hand-rolled reseat blocks — the cold-start reset, the
  // loop/window-length wrap, and the timeline seek — into one parametrized path so a
  // future change (S3-1 clock injection, S3-2 clock rebase, …) touches ONE place
  // instead of three near-identical ~40-line copies. `intent` selects the HO-manager
  // time transition:
  //   - 'cold-start' (mount / profile / epoch / signalReset / handoverReset): full
  //     reset() — fresh managers, no serving carried.
  //   - 'seek' | 'wrap' (timeline seek, loop/window re-loop): clock-REBASE the
  //     steered managers by the sim-time jump (S3-2) so a UE keeps its serving link
  //     across the jump instead of cold-re-acquiring under the strict re-attach
  //     threshold (the served-N/N flicker).
  // Positions always cold-reseat at the target (D1): mobility states regenerate and a
  // single paused dt=0 step renders T — no warm O(N) replay on a 7200 s timeline. The
  // reseat publishes a real populated frame (never a blank createEmptyFrame — that
  // removes the old signalReset empty-frame flicker).
  const buildRuntimeStateAt = useCallback(
    (params: { toSec: number; intent: 'cold-start' | 'seek' | 'wrap'; warmupSec?: number }) => {
      const targetOffset = normalizeReplayOffset(params.toSec, maxTimeSec, replay.loop);
      if (params.intent === 'cold-start') {
        resetAllHoManagers();
      } else {
        transitionHoManagers({
          kind: 'rebase',
          deltaMs: (targetOffset - runtimeStateRef.current.simTimeSec) * 1000,
        });
      }
      resetMobilityStates();
      runtimeStateRef.current = createRuntimeFrameStepState(targetOffset);
      installDecisionOverride();
      const { frame } = stepRuntimeFrame({
        profile,
        replay,
        speed,
        paused: true,
        deltaSec: 0,
        beamFootprintMultiplier,
        mapKmPerWorldUnit,
        // S3-1: inject the display-latch wall clock explicitly so the live step
        // takes no ambient performance.now() read (pure-step contract). Same value
        // the step previously read itself — behavior-identical.
        nowMs: readWallClockMs(),
        observer,
        beamLayoutsByShellId,
        trajectoryCache,
        hoManager,
        secondaryHoManagers,
        ueCount: effectiveUeCount,
        ueDistributionMode,
        primaryJogEastKm,
        primaryJogNorthKm,
        uePrimaryAnchorMode,
        ueMobilityMode,
        ueMobilityParams: effectiveUeMobilityParams,
        ueDistributionScope,
        ueDistributionRadiusKm,
        mobilityStates: mobilityStatesRef.current,
        state: runtimeStateRef.current,
      });
      // S-cells-2: additive cell truth on the reseat frame (dt 0 — single static
      // step; managers already transitioned above). no-op off lane.
      attachSinrLiveCellFrame(frame, sinrLiveCellModel, 0);

      // G2-WARMSTART: on the FIRST sinr-live cold-start (the demo open), advance the
      // freshly cold-attached managers + cell model PAST the ~42s ping-pong-guard
      // warm-up so the demo opens WITH a live handover pulse already on screen — a
      // cold start otherwise shows a static scene with zero handovers (and zero G2c
      // pulse cones) until the guard elapses. Run-through: step the REAL model forward
      // in coarse 2s increments (matching the offline event-index scan grain — a
      // physically-valid post-guard seed, NOT a byte-exact reproduction of the live
      // ~16ms-grain play), DISCARDING intermediate frames, and STOP the moment the
      // published frame actually carries a live pulse (recentHandoverEvents > 0) — so
      // it opens on a handover, not in a between-burst gap, and typically stops at the
      // first post-guard burst (~42s ≈ 21 steps ≈ ~0.5s one-time synchronous cost),
      // not the full cap. `params.warmupSec` is the CAP (bounds a quiet window).
      // Truth-neutral (Rule#6): the real model produces every value; nothing is
      // fabricated. Lane-gated on the cell model (sinr-live only) AND latched to the
      // first warm (hasWarmedOnceRef) so later cold-starts do not re-freeze the UI;
      // seek / wrap / signal-reset pass no warm-up (cold/rebase semantics unchanged).
      let publishFrame = frame;
      const warmupCapSec = (sinrLiveCellModel && !hasWarmedOnceRef.current) ? (params.warmupSec ?? 0) : 0;
      if (warmupCapSec > 0) {
        hasWarmedOnceRef.current = true;
        let warmedSec = 0;
        while (warmedSec < warmupCapSec) {
          const stepSec = Math.min(SINR_LIVE_WARMUP_STEP_SEC, warmupCapSec - warmedSec);
          const warm = stepRuntimeFrame({
            profile,
            replay,
            // Advance exactly `stepSec` of sim-time regardless of the user's playback
            // speed (speed:1 → simTimeSec += stepSec * 1).
            speed: 1,
            paused: false,
            deltaSec: stepSec,
            beamFootprintMultiplier,
            mapKmPerWorldUnit,
            nowMs: readWallClockMs(),
            observer,
            beamLayoutsByShellId,
            trajectoryCache,
            hoManager,
            secondaryHoManagers,
            ueCount: effectiveUeCount,
            ueDistributionMode,
            primaryJogEastKm,
            primaryJogNorthKm,
            uePrimaryAnchorMode,
            ueMobilityMode,
            ueMobilityParams: effectiveUeMobilityParams,
            ueDistributionScope,
            ueDistributionRadiusKm,
            mobilityStates: mobilityStatesRef.current,
            state: runtimeStateRef.current,
          });
          // Faithful to the frozen play loop: on a trajectory wrap, rebase the
          // externally-attached cell model BEFORE the attach (the step rebases the
          // steered managers in-step but not the cell model — unreachable at the demo
          // start 450+cap, but kept so the warm-up can't corrupt cell guards if the
          // offset/cap ever move near maxTimeSec).
          if (warm.didLoopWrap) {
            sinrLiveCellModel?.rebase((warm.frame.simTimeSec - warm.previousSimTimeSec) * 1000);
          }
          // Advance the cell model by the real elapsed sim-time (clamped to 0 on a
          // wrap by attach) so its per-cell managers + the recentHandoverEvents pulse
          // log warm in lockstep with the steered managers.
          attachSinrLiveCellFrame(warm.frame, sinrLiveCellModel, warm.frame.simTimeSec - warm.previousSimTimeSec);
          publishFrame = warm.frame;
          warmedSec += stepSec;
          // Stop as soon as the PUBLISHED frame carries a live pulse so the demo opens
          // on a handover (the guard + the cold-attach 'attach' classification keep
          // recentHandoverEvents empty until the first real post-guard HO).
          if ((warm.frame.sinrLiveCells?.recentHandoverEvents.length ?? 0) > 0) break;
        }
      }
      frameRef.current = publishFrame;
      publishNextFrameRef.current = true;
      setVersion(v => v + 1);
    },
    [
      beamLayoutsByShellId,
      effectiveUeCount,
      hoManager,
      installDecisionOverride,
      maxTimeSec,
      observer,
      profile,
      replay,
      resetAllHoManagers,
      transitionHoManagers,
      resetMobilityStates,
      secondaryHoManagers,
      sinrLiveCellModel,
      speed,
      beamFootprintMultiplier,
      mapKmPerWorldUnit,
      trajectoryCache,
      ueDistributionMode,
      uePrimaryAnchorMode,
      ueMobilityMode,
      effectiveUeMobilityParams,
      ueDistributionScope,
      ueDistributionRadiusKm,
    ],
  );

  // S3-3: thin adapters over the one-reset recipe — kept as named helpers because
  // effects + gates reference them by name and signature. resetToReplayStartFrame()
  // is a cold-start at the replay start offset; with { timeShift: true } (loop/window
  // re-loop) it is a 'wrap' time-shift (rebase). seekToTimelineFrame(T) is a timeline
  // 'seek' time-shift to T (rebase).
  const resetToReplayStartFrame = useCallback((options?: { timeShift?: boolean }) => {
    buildRuntimeStateAt({
      toSec: replay.startOffsetSec,
      intent: options?.timeShift ? 'wrap' : 'cold-start',
      // G2-WARMSTART: a cold-start opens the demo warm (the recipe latches it to the
      // FIRST sinr-live cold-start + lane-gates it); a wrap (window re-loop) is a
      // rebase that already keeps serving, so it passes no warm-up cap.
      warmupSec: options?.timeShift ? 0 : SINR_LIVE_WARMUP_CAP_SEC,
    });
  }, [buildRuntimeStateAt, replay.startOffsetSec]);

  const seekToTimelineFrame = useCallback((targetSec: number) => {
    buildRuntimeStateAt({ toSec: targetSec, intent: 'seek' });
  }, [buildRuntimeStateAt]);

  useEffect(() => {
    resetToReplayStartFrame();
  }, [maxTimeSec, profile.id, replay.epochUtcMs, replay.loop, replay.startOffsetSec]);

  // Keep the latest landing callback in a ref so the seek effect (keyed only on
  // seekRequestKey) never re-runs on callback identity changes nor fires a stale one.
  const onSeekLandedRef = useRef(onSeekLanded);
  useEffect(() => {
    onSeekLandedRef.current = onSeekLanded;
  }, [onSeekLanded]);

  useEffect(() => {
    if (replay.seekRequestKey === undefined || replay.seekTargetSec === undefined) return;
    seekToTimelineFrame(replay.seekTargetSec);
    // Deterministic Director-focus landing: signal the consumed key the instant the
    // seek frame is built (replaces the throttled-simTimeSec time-band landing).
    onSeekLandedRef.current?.(replay.seekRequestKey);
  }, [replay.seekRequestKey]);

  useEffect(() => {
    // S3-3: a signal-control reset is a cold-start at the CURRENT sim-time. Route it
    // through the one-reset recipe so it publishes a real populated frame instead of
    // the old createEmptyFrame flicker (and shares the clock-injection / cell-attach
    // wiring with every other reseat).
    //
    // Deps are [signalResetKey] ONLY — deliberately omitting buildRuntimeStateAt, the
    // same way the mount / handoverReset / seek effects omit their wrapper callbacks.
    // The recipe carries a wide dep array (profile, replay, speed, observer, …); listing
    // it here would cold-reset every HO manager whenever any of those live inputs change
    // — most damagingly a playback `speed` change mid-flight, which would wipe serving
    // (the served-N/N regression S3-2 fixed). React still invokes the LATEST recipe
    // closure at fire time (the effect is recreated when signalResetKey changes), so the
    // reseat uses current values; it just no longer re-fires on speed/observer/etc.
    buildRuntimeStateAt({ toSec: runtimeStateRef.current.simTimeSec, intent: 'cold-start' });
  }, [signalResetKey]);

  useEffect(() => {
    resetMobilityStates();
    // Phase 3 S1: same-count distribution/mobility changes regenerate UE
    // positions but reuse this RuntimeFrameStepState (we keep sim-time + HO
    // continuity). The secondary serving cache is keyed only by UE count, so
    // without this it would hold serving/SINR computed for the OLD positions
    // and (while paused, accumulator frozen) apply them to the NEW positions
    // indefinitely. Invalidate it so the next frame recomputes against the
    // regenerated positions.
    runtimeStateRef.current.secondaryServingCache = null;
    runtimeStateRef.current.secondaryRecomputeAccumulatorSec = 0;
    publishNextFrameRef.current = true;
    setVersion(v => v + 1);
  }, [
    profile.id,
    effectiveUeCount,
    ueDistributionMode,
    uePrimaryAnchorMode,
    ueDistributionScope,
    ueDistributionRadiusKm,
    ueMobilityMode,
    effectiveUeMobilityParams,
    resetMobilityStates,
  ]);

  useEffect(() => {
    resetToReplayStartFrame();
  }, [handoverResetKey]);

  useEffect(() => {
    // Profile-backed SINR controls must refresh the React UI even when simulation time is paused.
    publishNextFrameRef.current = true;
  }, [profile, beamFootprintMultiplier, ueDistributionScope, ueDistributionRadiusKm, mapKmPerWorldUnit]);

  useFrame((_, delta) => {
    if (trajectoryCache.length === 0) return;

    // S3/S4: install or clear the override on the manager each frame so the
    // ref is current at the moment hoManager.update() fires inside
    // stepRuntimeFrame. The S3 invariant remains visible in source —
    // `handoverModeRef.current === 'decision-overlay-on-live-sinr' ? decisionOverride : null` —
    // and S4 widens the truthiness to also enable the override under
    // `omega-heuristic`. In `sinr-offset` (or any unknown) mode the install
    // resolves to null, which is byte-equivalent to base-class behavior
    // (SDD §9.7 truth invariance).
    installDecisionOverride();

    const windowLength = replay.windowLengthSec ?? 180; // Default keeps legacy short-window demos.
    if (
      replay.loop
      && runtimeStateRef.current.simTimeSec >= replay.startOffsetSec + windowLength
    ) {
      // S3-2: the window re-loop is a TIME-SHIFT back to startOffset — rebase the
      // steered managers (keep serving) instead of cold-reset, so the 100-UE
      // mosaic does not crash served-N/N on every wrap.
      resetToReplayStartFrame({ timeShift: true });
      return;
    }

    const { frame, previousSimTimeSec, didLoopWrap } = stepRuntimeFrame({
      profile,
      replay,
      speed,
      paused,
      deltaSec: delta,
      beamFootprintMultiplier,
      mapKmPerWorldUnit,
      // S3-1: inject the display-latch wall clock explicitly so the live step
      // takes no ambient performance.now() read (pure-step contract). Same value
      // the step previously read itself — behavior-identical.
      nowMs: readWallClockMs(),
      observer,
      beamLayoutsByShellId,
      trajectoryCache,
      hoManager,
      secondaryHoManagers,
      ueCount: effectiveUeCount,
      ueDistributionMode,
      primaryJogEastKm,
      primaryJogNorthKm,
      uePrimaryAnchorMode,
      ueMobilityMode,
      ueMobilityParams: effectiveUeMobilityParams,
      ueDistributionScope,
      ueDistributionRadiusKm,
      mobilityStates: mobilityStatesRef.current,
      state: runtimeStateRef.current,
    });
    // S4-1: the live loop wrap is the in-step didLoopWrap (production windowLengthSec
    // == maxTimeSec, so the in-hook window-reloop guard above is unreachable). The step
    // rebases the STEERED managers in-step on a wrap but NOT the externally-attached
    // cell model — so rebase it here by the same wrap delta, before the attach, else its
    // per-cell HandoverManagers keep a stale FUTURE guard that suppresses serving
    // continuity + inter-HO for the rest of the loop. (Seek/window-reloop time-shifts go
    // through transitionHoManagers instead; this covers the trajectory-loop wrap.)
    if (didLoopWrap) {
      sinrLiveCellModel?.rebase((frame.simTimeSec - previousSimTimeSec) * 1000);
    }
    // S-cells-2: additive cell truth, advanced by the real sim-time delta so the
    // per-cell HandoverManagers time their trigger/ping-pong guards correctly. dt is 0
    // when paused and clamped to 0 on the wrap frame (negative delta). no-op off lane.
    attachSinrLiveCellFrame(frame, sinrLiveCellModel, frame.simTimeSec - previousSimTimeSec);
    frameRef.current = frame;

    if (runtimeStateRef.current.simTimeSec !== previousSimTimeSec || publishNextFrameRef.current) {
      publishNextFrameRef.current = false;
      setVersion(v => v + 1);
    }
  });

  return frameRef.current;
}
