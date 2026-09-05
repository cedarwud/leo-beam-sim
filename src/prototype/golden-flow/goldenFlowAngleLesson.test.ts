import assert from 'node:assert/strict';

import { ANGLE_AWARE_SEGMENT_START_POWER_W } from '../../engine/signal/angle-aware-ee';
import {
  buildGoldenFlowAngleLessonMetrics,
  GOLDEN_FLOW_ANGLE_LESSON_HALF_POWER_RAD,
} from './goldenFlowAngleLesson';

// Absolute power expectations are pinned to the active EE contract's segment-
// start power (see angle-aware-ee.ts: p^0 = ANGLE_AWARE_BEAM_POWER_CAP_W / 2),
// not to a hardcoded literal, so this test does not go stale the next time
// that engineering constant is retuned.
const centre = buildGoldenFlowAngleLessonMetrics(0);
assert.equal(centre.relativeGainPercent, 100);
assert.equal(centre.requiredPowerW, ANGLE_AWARE_SEGMENT_START_POWER_W);
assert.equal(centre.baselinePowerW, ANGLE_AWARE_SEGMENT_START_POWER_W);
assert.equal(centre.powerMultiplier, 1);
assert.equal(centre.compensatedLinkPercent, 100);
assert.equal(centre.relativeEePercent, 100);

const edgeDeg = GOLDEN_FLOW_ANGLE_LESSON_HALF_POWER_RAD * 180 / Math.PI;
const edge = buildGoldenFlowAngleLessonMetrics(edgeDeg);
assert.ok(edge.relativeGainPercent > 49 && edge.relativeGainPercent < 51);
assert.ok(
  edge.requiredPowerW > ANGLE_AWARE_SEGMENT_START_POWER_W * 1.9
  && edge.requiredPowerW < ANGLE_AWARE_SEGMENT_START_POWER_W * 2.1,
);
assert.ok(edge.powerMultiplier > 1.9 && edge.powerMultiplier < 2.1);
assert.ok(Math.abs(edge.compensatedLinkPercent - 100) < 1e-9);
assert.ok(edge.relativeEePercent > 49 && edge.relativeEePercent < 51);

const outside = buildGoldenFlowAngleLessonMetrics(2);
assert.ok(outside.relativeGainPercent < edge.relativeGainPercent);
assert.ok(outside.requiredPowerW > edge.requiredPowerW);
assert.ok(outside.relativeEePercent < edge.relativeEePercent);

const exploredEdge = buildGoldenFlowAngleLessonMetrics(4);
assert.ok(exploredEdge.relativeGainPercent < outside.relativeGainPercent);
assert.ok(exploredEdge.requiredPowerW > outside.requiredPowerW);
assert.ok(exploredEdge.relativeEePercent < outside.relativeEePercent);

console.log('goldenFlowAngleLesson tests passed');
