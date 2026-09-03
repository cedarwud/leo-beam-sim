import assert from 'node:assert/strict';

import {
  clipRect,
  measureVisualContractGeometry,
  rect,
  rectangleUnionArea,
  rectangleUnionAreaClipped,
} from './rectangleUnion';

const first = rect(0, 0, 10, 10);
const second = rect(5, 5, 10, 10);

// 100 + 100 - 25: the overlap is counted exactly once.
assert.equal(rectangleUnionArea([first, second]), 175);
assert.equal(rectangleUnionArea([first, second, first]), 175);
assert.deepEqual(clipRect(second, rect(0, 0, 12, 12)), {
  left: 5,
  top: 5,
  right: 12,
  bottom: 12,
});
assert.equal(rectangleUnionAreaClipped([first, second], rect(0, 0, 12, 12)), 124);

const metrics = measureVisualContractGeometry({
  viewport: rect(0, 0, 100, 100),
  stage: rect(10, 10, 80, 80),
  subjects: [rect(40, 40, 20, 20)],
  opaqueOverlays: [rect(0, 0, 20, 20), rect(10, 10, 20, 20)],
});
assert.equal(metrics.stageCoverage, 0.64);
assert.equal(metrics.unoccludedStage, 0.9375);
assert.equal(metrics.subjectOverlayIntersection, 0);

const clippedSubjectMetrics = measureVisualContractGeometry({
  viewport: rect(0, 0, 100, 100),
  stage: rect(0, 0, 100, 100),
  subjects: [rect(40, 40, 20, 20)],
  opaqueOverlays: [rect(40, 40, 10, 20), rect(45, 40, 10, 20)],
});
assert.equal(clippedSubjectMetrics.subjectOverlayIntersection, 0.75);

const oversizedStageMetrics = measureVisualContractGeometry({
  viewport: rect(0, 0, 100, 100),
  stage: rect(-20, -20, 160, 160),
  subjects: [rect(40, 40, 20, 20)],
  opaqueOverlays: [],
});
assert.equal(oversizedStageMetrics.stageCoverage, 1);
assert.equal(oversizedStageMetrics.unoccludedStage, 1);

const overlappingSubjectMetrics = measureVisualContractGeometry({
  viewport: rect(0, 0, 100, 100),
  stage: rect(0, 0, 100, 100),
  subjects: [rect(0, 0, 10, 10), rect(5, 0, 10, 10)],
  opaqueOverlays: [rect(5, 0, 10, 10), rect(10, 0, 10, 10)],
});
// Subject union is 150; the union of all overlay∩subject regions is 100.
assert.equal(overlappingSubjectMetrics.subjectOverlayIntersection, 2 / 3);

console.log('rectangleUnion.test.ts: PASS');
