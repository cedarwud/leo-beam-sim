import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { createObserverContext } from '../engine/orbit';
import {
  HandoverManager,
  type HandoverDecisionOverride,
} from '../engine/handover/handover-manager';
import type { Profile } from '../profiles/types';
import type { UeDistributionMode } from '../engine/ue/multiUeState';
import {
  createMobilityStates,
  DEFAULT_UE_MOBILITY_PARAMS,
  type UeMobilityMode,
  type UePerMobilityState,
} from '../engine/ue/multiUeMobility';
import type { ReplayConfig, SimFrame } from './types';
import { createEmptyFrame, normalizeReplayOffset } from './simulationHelpers';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  getTrajectoryMaxTimeSec,
  stepRuntimeFrame,
  type RuntimeFrameStepState,
} from './runtimeFrameStep';
import { reScalarize } from '../modqn/replay-bundle/rescalarize';
import { computeHeuristicNotPaperScore } from '../engine/handover/decision-override';
import {
  ModqnEnvelopeContext,
  ModqnHandoverModeContext,
} from '../ui/useModqnHandoverState';
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
  ueMobilityMode: UeMobilityMode = 'static',
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
  const createCurrentMobilityStates = useCallback(() => (
    createMobilityStates(effectiveUeCount, ueMobilityMode, DEFAULT_UE_MOBILITY_PARAMS, 42)
  ), [effectiveUeCount, ueMobilityMode]);
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

  const resetAllHoManagers = useCallback(() => {
    hoManager.reset();
    secondaryHoManagers.forEach(manager => manager.reset());
  }, [hoManager, secondaryHoManagers]);

  const resetMobilityStates = useCallback(() => {
    mobilityStatesRef.current = createCurrentMobilityStates();
  }, [createCurrentMobilityStates]);

  const resetToReplayStartFrame = useCallback(() => {
    const startOffset = normalizeReplayOffset(replay.startOffsetSec, maxTimeSec, replay.loop);
    resetAllHoManagers();
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
      observer,
      beamLayoutsByShellId,
      trajectoryCache,
      hoManager,
      secondaryHoManagers,
      ueCount: effectiveUeCount,
      ueDistributionMode,
      ueMobilityMode,
      ueMobilityParams: DEFAULT_UE_MOBILITY_PARAMS,
      mobilityStates: mobilityStatesRef.current,
      state: runtimeStateRef.current,
    });
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
    resetMobilityStates,
    secondaryHoManagers,
    speed,
    beamFootprintMultiplier,
    trajectoryCache,
    ueDistributionMode,
    ueMobilityMode,
  ]);

  useEffect(() => {
    resetToReplayStartFrame();
  }, [maxTimeSec, profile.id, replay.epochUtcMs, replay.loop, replay.startOffsetSec]);

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
    publishNextFrameRef.current = true;
    setVersion(v => v + 1);
  }, [profile.id, effectiveUeCount, ueMobilityMode, resetMobilityStates]);

  useEffect(() => {
    resetToReplayStartFrame();
  }, [handoverResetKey]);

  useEffect(() => {
    // Profile-backed SINR controls must refresh the React UI even when simulation time is paused.
    publishNextFrameRef.current = true;
  }, [profile, beamFootprintMultiplier]);

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

    const { frame, previousSimTimeSec } = stepRuntimeFrame({
      profile,
      replay,
      speed,
      paused,
      deltaSec: delta,
      beamFootprintMultiplier,
      observer,
      beamLayoutsByShellId,
      trajectoryCache,
      hoManager,
      secondaryHoManagers,
      ueCount: effectiveUeCount,
      ueDistributionMode,
      ueMobilityMode,
      ueMobilityParams: DEFAULT_UE_MOBILITY_PARAMS,
      mobilityStates: mobilityStatesRef.current,
      state: runtimeStateRef.current,
    });
    frameRef.current = frame;

    if (runtimeStateRef.current.simTimeSec !== previousSimTimeSec || publishNextFrameRef.current) {
      publishNextFrameRef.current = false;
      setVersion(v => v + 1);
    }
  });

  return frameRef.current;
}
