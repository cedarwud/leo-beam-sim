import assert from 'node:assert/strict';

import {
  buildGoldenFlowAngleLessonMetrics,
  GOLDEN_FLOW_ANGLE_LESSON_HALF_POWER_RAD,
} from './goldenFlowAngleLesson';

const centre = buildGoldenFlowAngleLessonMetrics(0);
assert.equal(centre.relativeGainPercent, 100);
assert.equal(centre.requiredPowerW, 2);
assert.equal(centre.baselinePowerW, 2);
assert.equal(centre.powerMultiplier, 1);
assert.equal(centre.compensatedLinkPercent, 100);
assert.equal(centre.relativeEePercent, 100);

const edgeDeg = GOLDEN_FLOW_ANGLE_LESSON_HALF_POWER_RAD * 180 / Math.PI;
const edge = buildGoldenFlowAngleLessonMetrics(edgeDeg);
assert.ok(edge.relativeGainPercent > 49 && edge.relativeGainPercent < 51);
assert.ok(edge.requiredPowerW > 3.9 && edge.requiredPowerW < 4.1);
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
