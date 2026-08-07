import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createObserverContext } from '../engine/orbit';
import { HandoverManager } from '../engine/handover/handover-manager';
import { loadProfile } from '../profiles';
import {
  createBeamLayoutsByShellId,
  createRuntimeFrameStepState,
  createTrajectoryCache,
  stepRuntimeFrame,
} from './runtimeFrameStep';
import { selectOtherHandoverUeIds } from './otherHandoverUeSelector';

test('real live runtime exposes concurrent secondary handovers to the selector', () => {
  const profile = loadProfile('hobs-2024-candidate-rich');
  const epochUtcMs = Date.UTC(2026, 0, 1);
  const observer = createObserverContext(
    profile.orbit.observerLatDeg,
    profile.orbit.observerLonDeg,
  );
  const replay = {
    epochUtcMs,
    startOffsetSec: 0,
    loop: false,
    windowLengthSec: 7200,
  };
  const trajectoryCache = createTrajectoryCache(profile, observer, epochUtcMs);
  const beamLayoutsByShellId = createBeamLayoutsByShellId(profile);
  const hoManager = new HandoverManager(profile.handover);
  const secondaryHoManagers = Array.from(
    { length: 99 },
    () => new HandoverManager(profile.handover),
  );
  const state = createRuntimeFrameStepState(0);
  let firstSelected: readonly string[] = [];

  for (let step = 0; step < 450 && firstSelected.length === 0; step += 1) {
    const output = stepRuntimeFrame({
      profile,
      replay,
      speed: 1,
      paused: step === 0,
      deltaSec: step === 0 ? 0 : 0.25,
      observer,
      beamLayoutsByShellId,
      trajectoryCache,
      hoManager,
      secondaryHoManagers,
      state,
      ueCount: 100,
      uePrimaryAnchorMode: 'observer',
    });
    firstSelected = selectOtherHandoverUeIds({
      ues: output.frame.perUePositions,
      primaryUeId: output.frame.perUePositions[0]?.id,
      triggerTimeSec: profile.handover.triggerTimeSec,
      maxOtherHandoverUes: 6,
    });
  }

  assert.ok(firstSelected.length > 0, 'at least one secondary handover becomes visible');
  assert.ok(firstSelected.length <= 6, 'selector applies the scene cap');
  assert.ok(firstSelected.every(id => id !== 'live-ue-0'), 'primary UE is excluded');
});
