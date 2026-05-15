import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { createObserverContext } from '../engine/orbit';
import {
  HandoverManager,
  type HandoverDecisionOverride,
} from '../engine/handover/handover-manager';
import type { Profile } from '../profiles/types';
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
import {
  ModqnEnvelopeContext,
  ModqnHandoverModeContext,
} from '../ui/useModqnHandoverState';

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
  // handoverMode !== 'modqn-replay' the override returns null on every call,
  // which is byte-equivalent to no-override (SDD §9.7 truth invariance).
  const decisionOverride = useCallback<HandoverDecisionOverride>(() => {
    if (handoverModeRef.current !== 'modqn-replay') return null;

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

    return { satId: result.satId, beamId: result.beamId };
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
  const maxTimeSec = getTrajectoryMaxTimeSec(trajectoryCache);
  const initialSimTimeSec = normalizeReplayOffset(replay.startOffsetSec, maxTimeSec, replay.loop);
  const runtimeStateRef = useRef<RuntimeFrameStepState>(
    createRuntimeFrameStepState(initialSimTimeSec),
  );
  const frameRef = useRef<SimFrame>(createEmptyFrame(initialSimTimeSec));
  const publishNextFrameRef = useRef(true);
  const [, setVersion] = useState(0);

  useEffect(() => {
    const startOffset = normalizeReplayOffset(replay.startOffsetSec, maxTimeSec, replay.loop);
    hoManager.reset();
    runtimeStateRef.current = createRuntimeFrameStepState(startOffset);
    frameRef.current = createEmptyFrame(startOffset);
    publishNextFrameRef.current = true;
    setVersion(v => v + 1);
  }, [maxTimeSec, profile.id, replay.epochUtcMs, replay.loop, replay.startOffsetSec]);

  useEffect(() => {
    hoManager.reset();
    runtimeStateRef.current = createRuntimeFrameStepState(runtimeStateRef.current.simTimeSec);
    frameRef.current = createEmptyFrame(runtimeStateRef.current.simTimeSec);
    publishNextFrameRef.current = true;
    setVersion(v => v + 1);
  }, [signalResetKey]);

  useEffect(() => {
    hoManager.reset();
    runtimeStateRef.current = {
      ...runtimeStateRef.current,
      recentHo: null,
    };
    frameRef.current = createEmptyFrame(runtimeStateRef.current.simTimeSec);
    publishNextFrameRef.current = true;
    setVersion(v => v + 1);
  }, [handoverResetKey]);

  useEffect(() => {
    // Profile-backed SINR controls must refresh the React UI even when simulation time is paused.
    publishNextFrameRef.current = true;
  }, [profile]);

  useFrame((_, delta) => {
    if (trajectoryCache.length === 0) return;

    // S3: install or clear the override on the manager each frame so the ref
    // is current at the moment hoManager.update() fires inside stepRuntimeFrame.
    // Null when mode !== 'modqn-replay' — byte-equivalent to base-class behavior
    // (SDD §9.7 truth invariance for sinr-offset mode).
    hoManager.overrideRef.current =
      handoverModeRef.current === 'modqn-replay' ? decisionOverride : null;

    const { frame, previousSimTimeSec } = stepRuntimeFrame({
      profile,
      replay,
      speed,
      paused,
      deltaSec: delta,
      observer,
      beamLayoutsByShellId,
      trajectoryCache,
      hoManager,
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
