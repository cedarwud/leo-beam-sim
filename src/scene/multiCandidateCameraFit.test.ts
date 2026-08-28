import assert from 'node:assert/strict';
import test from 'node:test';

import {
  areMultiCandidateFocusPointsWithinSafeFrame,
  resolveMultiCandidateCameraFit,
} from './multiCandidateCameraFit';

const points = [
  [0, 0, 0],
  [0, 0, 1000],
  [-220, 720, 80],
  [260, 680, -120],
] as const;

test('fits the same real geometry farther away in a narrow centre viewport', () => {
  const wide = resolveMultiCandidateCameraFit({
    points,
    currentPosition: [0, 500, 900],
    currentTarget: [0, 0, 0],
    verticalFovDeg: 45,
    aspect: 16 / 9,
  });
  const narrow = resolveMultiCandidateCameraFit({
    points,
    currentPosition: [0, 500, 900],
    currentTarget: [0, 0, 0],
    verticalFovDeg: 45,
    aspect: 0.6,
  });

  assert.ok(wide);
  assert.ok(narrow);
  assert.ok(narrow.distance > wide.distance);
  assert.deepEqual(narrow.target, [20, 360, 440]);
  assert.ok(narrow.distance <= 2850);
});

test('fails closed for invalid camera inputs and returns null without geometry', () => {
  assert.equal(resolveMultiCandidateCameraFit({
    points: [],
    currentPosition: [0, 0, 1],
    currentTarget: [0, 0, 0],
    verticalFovDeg: 45,
    aspect: 1,
  }), null);
  assert.throws(() => resolveMultiCandidateCameraFit({
    points,
    currentPosition: [0, 0, 1],
    currentTarget: [0, 0, 0],
    verticalFovDeg: 45,
    aspect: 0,
  }), /camera fov and aspect/);
});

test('centres the primary UE-to-satellite span independently of candidate context', () => {
  const fit = resolveMultiCandidateCameraFit({
    points,
    focusGroundPoint: [0, 0, 0],
    focusElevatedPoint: [-220, 720, 80],
    currentPosition: [0, 500, 900],
    currentTarget: [0, 0, 0],
    verticalFovDeg: 45,
    aspect: 0.6,
  });

  assert.ok(fit);
  assert.deepEqual(fit.target, [-110, 360, 40]);
  assert.ok(fit.distance <= 2850);
});

test('keeps a stationary camera while focus points remain inside the padded frame', () => {
  assert.equal(areMultiCandidateFocusPointsWithinSafeFrame({
    points: [[0, 0, 0], [0, 180, 0]],
    position: [0, 100, 600],
    target: [0, 90, 0],
    verticalFovDeg: 45,
    aspect: 0.72,
  }), true);
});

test('requests a new composition before a focus point leaves the canvas', () => {
  const input = {
    position: [0, 100, 600] as const,
    target: [0, 90, 0] as const,
    verticalFovDeg: 45,
    aspect: 0.72,
  };
  assert.equal(areMultiCandidateFocusPointsWithinSafeFrame({
    ...input,
    points: [[240, 180, 0]],
  }), false);
  assert.equal(areMultiCandidateFocusPointsWithinSafeFrame({
    ...input,
    points: [[0, 100, 700]],
  }), false);
});

test('validates safe-frame limits instead of silently accepting unusable bounds', () => {
  assert.throws(() => areMultiCandidateFocusPointsWithinSafeFrame({
    points: [[0, 0, 0]],
    position: [0, 100, 600],
    target: [0, 0, 0],
    verticalFovDeg: 45,
    aspect: 1,
    horizontalLimit: 1.1,
  }), /horizontalLimit/);
});
