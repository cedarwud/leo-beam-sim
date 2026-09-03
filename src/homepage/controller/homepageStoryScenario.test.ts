import assert from 'node:assert/strict';
import test from 'node:test';

import { HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM } from './homepageStoryScenario';

test('homepage natural handover story exposes one finite source trajectory input', () => {
  assert.deepEqual(HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM, {
    east: 10,
    north: 0,
  });
  assert.ok(Number.isFinite(HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM.east));
  assert.ok(Number.isFinite(HOMEPAGE_NATURAL_HANDOVER_STORY_PRIMARY_JOG_KM.north));
});
