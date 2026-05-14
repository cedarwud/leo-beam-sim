import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { createObserverContext } from '../engine/orbit';
import { HandoverManager } from '../engine/handover/handover-manager';
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

  const hoManager = useMemo(() => new HandoverManager(profile.handover), [profile.handover]);
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
