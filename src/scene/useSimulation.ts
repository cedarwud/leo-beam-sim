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
  const [, setVersion] = useState(0);

  const installDecisionOverride = useCallback(() => {
    const overrideInModqnReplay =
      handoverModeRef.current === 'decision-overlay-on-live-sinr' ? decisionOverride : null;
    hoManager.overrideRef.current =
      overrideInModqnReplay
      ?? (handoverModeRef.current === 'omega-heuristic' ? decisionOverride : null);
  }, [decisionOverride, hoManager]);

  // S3-2: one helper for both kinds of HO-manager time transition.
  //  - 'cold-start' (mount, profile change, signalReset, handoverReset): full
  //    reset() — fresh state, no serving carried.
  //  - 'rebase' (loop/window wrap, seek): clock-REBASE the steered managers by the
  //    sim-time jump (offsets only guardUntilMs/pendingSinceMs), keeping serving +
  //    eventLog so a UE survives the jump instead of cold-re-acquiring under the
  //    strict re-attach threshold (the served-N/N flicker, S3 plan §1.6).
  // The cell-truth model (sinrLiveCellModel) ALWAYS resets here — its own
  // clock-rebase is deferred to S4 (cell lane = S4 serving truth, D5).
  const transitionHoManagers = useCallback(
    (transition: { kind: 'cold-start' } | { kind: 'rebase'; deltaMs: number }) => {
      if (transition.kind === 'rebase') {
        hoManager.rebase(transition.deltaMs);
        secondaryHoManagers.forEach(manager => manager.rebase(transition.deltaMs));
      } else {
        hoManager.reset();
        secondaryHoManagers.forEach(manager => manager.reset());
      }
      // S-cells-2: reset the cell-truth model in lockstep with the HO managers so
      // the next cell step is a clean cold-attach (clears per-cell HandoverManagers
      // + the per-UE serving-transition memory). null on non-sinr-live lanes.
      sinrLiveCellModel?.reset();
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

  const resetToReplayStartFrame = useCallback((options?: { timeShift?: boolean }) => {
    const startOffset = normalizeReplayOffset(replay.startOffsetSec, maxTimeSec, replay.loop);
    // S3-2: the windowLength re-loop calls this with `timeShift` — it is a
    // sim-time jump back to startOffset, so the steered managers REBASE (keep
    // serving) instead of cold-resetting. Cold-start callers (mount/profile/epoch
    // effect, handoverReset effect) pass no option and full-reset.
    if (options?.timeShift) {
      transitionHoManagers({
        kind: 'rebase',
        deltaMs: (startOffset - runtimeStateRef.current.simTimeSec) * 1000,
      });
    } else {
      resetAllHoManagers();
    }
    resetMobilityStates();
    runtimeStateRef.current = createRuntimeFrameStepState(startOffset);
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
      uePrimaryAnchorMode,
      ueMobilityMode,
      ueMobilityParams: effectiveUeMobilityParams,
      ueDistributionScope,
      ueDistributionRadiusKm,
      mobilityStates: mobilityStatesRef.current,
      state: runtimeStateRef.current,
    });
    // S-cells-2: additive cell truth on the reset frame (dt 0 — single static
    // step; managers already transitioned above). no-op off lane.
    attachSinrLiveCellFrame(frame, sinrLiveCellModel, 0);
    frameRef.current = frame;
    publishNextFrameRef.current = true;
    setVersion(v => v + 1);
  }, [
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
  ]);

  const seekToTimelineFrame = useCallback((targetSec: number) => {
    const targetOffset = normalizeReplayOffset(targetSec, maxTimeSec, replay.loop);
    // S3-2: a seek is a TIME-SHIFT — rebase the steered managers by the jump so
    // serving survives the seek (the served-N/N flicker fix). Position/mobility
    // still cold-reseat (S3-3 D1); HO-in-progress visuals stay cold (documented).
    transitionHoManagers({
      kind: 'rebase',
      deltaMs: (targetOffset - runtimeStateRef.current.simTimeSec) * 1000,
    });
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
      uePrimaryAnchorMode,
      ueMobilityMode,
      ueMobilityParams: effectiveUeMobilityParams,
      ueDistributionScope,
      ueDistributionRadiusKm,
      mobilityStates: mobilityStatesRef.current,
      state: runtimeStateRef.current,
    });
    // S-cells-2: additive cell truth on the seek frame (dt 0 — static reseat at
    // the seek target; cell model reset by transitionHoManagers above). no-op off lane.
    attachSinrLiveCellFrame(frame, sinrLiveCellModel, 0);
    frameRef.current = frame;
    publishNextFrameRef.current = true;
    setVersion(v => v + 1);
  }, [
    beamLayoutsByShellId,
    effectiveUeCount,
    hoManager,
    installDecisionOverride,
    maxTimeSec,
    observer,
    profile,
    replay,
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
  ]);

  useEffect(() => {
    resetToReplayStartFrame();
  }, [maxTimeSec, profile.id, replay.epochUtcMs, replay.loop, replay.startOffsetSec]);

  useEffect(() => {
    if (replay.seekRequestKey === undefined || replay.seekTargetSec === undefined) return;
    seekToTimelineFrame(replay.seekTargetSec);
  }, [replay.seekRequestKey]);

  useEffect(() => {
    resetAllHoManagers();
    resetMobilityStates();
    runtimeStateRef.current = createRuntimeFrameStepState(runtimeStateRef.current.simTimeSec);
    frameRef.current = createEmptyFrame(runtimeStateRef.current.simTimeSec);
    publishNextFrameRef.current = true;
    setVersion(v => v + 1);
  }, [resetAllHoManagers, resetMobilityStates, signalResetKey]);

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

    const { frame, previousSimTimeSec } = stepRuntimeFrame({
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
      uePrimaryAnchorMode,
      ueMobilityMode,
      ueMobilityParams: effectiveUeMobilityParams,
      ueDistributionScope,
      ueDistributionRadiusKm,
      mobilityStates: mobilityStatesRef.current,
      state: runtimeStateRef.current,
    });
    // S-cells-2: additive cell truth, advanced by the real sim-time delta so the
    // per-cell HandoverManagers time their trigger/ping-pong guards correctly.
    // dt 0 when paused; loop-wrap takes the early reset path above. no-op off lane.
    attachSinrLiveCellFrame(frame, sinrLiveCellModel, frame.simTimeSec - previousSimTimeSec);
    frameRef.current = frame;

    if (runtimeStateRef.current.simTimeSec !== previousSimTimeSec || publishNextFrameRef.current) {
      publishNextFrameRef.current = false;
      setVersion(v => v + 1);
    }
  });

  return frameRef.current;
}
