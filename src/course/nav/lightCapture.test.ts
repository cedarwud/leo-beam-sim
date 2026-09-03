import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isSixActsLightCaptureLocation,
  sixActsHref,
} from './lightCapture';

test('light capture is enabled only on the six-acts routes', () => {
  assert.equal(isSixActsLightCaptureLocation('/course/six-acts', '?theme=light-capture'), true);
  assert.equal(isSixActsLightCaptureLocation('/course/tle-journey', '?theme=light-capture'), true);
  assert.equal(isSixActsLightCaptureLocation('/course/off-axis-lab', '?theme=light-capture'), true);
  assert.equal(isSixActsLightCaptureLocation('/course/handover-theater', '?theme=light-capture'), true);
  assert.equal(isSixActsLightCaptureLocation('/simulator', '?theme=light-capture'), false);
  assert.equal(isSixActsLightCaptureLocation('/course/tle-journey', '?theme=dark'), false);
  assert.equal(isSixActsLightCaptureLocation('/course/tle-journey', ''), false);
});

test('internal six-acts links preserve capture mode without touching other links', () => {
  assert.equal(sixActsHref('/course/tle-journey', true), '/course/tle-journey?theme=light-capture');
  assert.equal(sixActsHref('/course/tle-journey?beat=3', true), '/course/tle-journey?beat=3&theme=light-capture');
  assert.equal(sixActsHref('/', true), '/');
  assert.equal(sixActsHref('/course/tle-journey', false), '/course/tle-journey');
});
