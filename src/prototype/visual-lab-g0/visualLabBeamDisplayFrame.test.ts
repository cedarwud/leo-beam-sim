import assert from 'node:assert/strict';
import test from 'node:test';
import { createVisualLabBeamDisplayFrame } from './visualLabBeamDisplayFrame';

const frameOptions = {
  beamLayoutCount: 19 as const,
  perSatelliteBeamLayoutCount: { serving: 1 as const, candidate: 7 as const },
  beamIlluminationMode: 'fixed' as const,
  userPositionOverridesKm: [],
  representativeUserIndex: null,
};

test('accepted beam display frame resolves global and per-satellite budgets from one contract', () => {
  const frame = createVisualLabBeamDisplayFrame({
    frameOptions,
    snapshot: {
      source: { frameId: 'frame', constellation: 'starlink' } as never,
      serving: { satelliteId: 'serving' } as never,
      candidate: { satelliteId: 'candidate' } as never,
    } as never,
    localScene: null,
    globalSatelliteCount: 4,
  });

  assert.equal(frame.globalLayoutCount, 19);
  assert.equal(frame.globalSatelliteCount, 4);
  assert.equal(frame.globalBeamCount, 46);
  assert.equal(frame.serving.configuredLayoutCount, 1);
  assert.equal(frame.candidate.configuredLayoutCount, 7);
  assert.equal(frame.serving.activeTargetCount, 0);
  assert.equal(frame.candidate.activeTargetCount, 0);
  assert.equal(frame.illuminationMode, 'fixed');
});

test('missing satellite overrides fall back to the global layout', () => {
  const frame = createVisualLabBeamDisplayFrame({
    frameOptions: {
      ...frameOptions,
      perSatelliteBeamLayoutCount: {},
    },
    snapshot: {
      source: { frameId: 'frame', constellation: 'starlink' } as never,
      serving: { satelliteId: 'other-serving' } as never,
      candidate: { satelliteId: 'other-candidate' } as never,
    } as never,
    localScene: null,
  });

  assert.equal(frame.serving.configuredLayoutCount, 19);
  assert.equal(frame.candidate.configuredLayoutCount, 19);
});

test('candidate identity is presentation-visible only while the accepted trace is in TTT', () => {
  const localScene = {
    serving: { satelliteId: 'serving' },
    candidate: { availability: 'available', satelliteId: 'candidate' },
    representative: { servingBeam: null },
    configuredBeamTargets: { targets: [] },
    activeBeamTargets: { targets: [] },
    candidateBeamLayout: {
      displayTargets: [{ isLoaded: true, beamId: 1, satelliteId: 'candidate', cellIndex: 1, targetPositionWorld: [0, 0, 0], metric: null }],
      targets: [{ beamId: 1, satelliteId: 'candidate', cellIndex: 1, targetPositionWorld: [0, 0, 0], metric: null }],
      selectedBeamId: 1,
    },
    handover: {
      availability: 'available',
      state: 'monitoring',
      candidateSatelliteId: 'candidate',
    },
  };
  const monitoring = createVisualLabBeamDisplayFrame({
    frameOptions,
    snapshot: null,
    localScene: localScene as never,
  });
  assert.equal(monitoring.candidate.satelliteId, 'candidate');
  assert.equal(monitoring.candidate.visible, false);

  const pending = createVisualLabBeamDisplayFrame({
    frameOptions,
    snapshot: null,
    localScene: {
      ...localScene,
      handover: { ...localScene.handover, state: 'pending' },
    } as never,
  });
  assert.equal(pending.candidate.visible, true);
});
