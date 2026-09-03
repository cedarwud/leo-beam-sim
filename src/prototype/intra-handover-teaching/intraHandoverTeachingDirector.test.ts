import assert from 'node:assert/strict';

import {
  INTRA_HANDOVER_TEACHING_BEATS,
  INTRA_HANDOVER_TEACHING_DURATION_SEC,
  beatForIntraHandoverTeachingTime,
  clampIntraHandoverTeachingTime,
  directorStateForIntraHandoverTeachingTime,
  seekIntraHandoverTeachingTime,
} from './intraHandoverTeachingDirector';

assert.equal(INTRA_HANDOVER_TEACHING_DURATION_SEC, 78);
assert.equal(INTRA_HANDOVER_TEACHING_BEATS.length, 8);
assert.equal(INTRA_HANDOVER_TEACHING_BEATS[INTRA_HANDOVER_TEACHING_BEATS.length - 1]?.endSec, 78);
assert.equal(clampIntraHandoverTeachingTime(-1), 0);
assert.equal(clampIntraHandoverTeachingTime(90), 78);
assert.equal(clampIntraHandoverTeachingTime(Number.NaN), 0);
assert.equal(beatForIntraHandoverTeachingTime(0).id, 'establish');
assert.equal(beatForIntraHandoverTeachingTime(41.999).id, 'qualify');
assert.equal(beatForIntraHandoverTeachingTime(42).id, 'switch');
assert.equal(beatForIntraHandoverTeachingTime(78).id, 'compare');
assert.equal(directorStateForIntraHandoverTeachingTime(42).beatProgress, 0);
assert.equal(seekIntraHandoverTeachingTime(10, -20), 0);
assert.equal(seekIntraHandoverTeachingTime(76, 20), 78);
assert.equal(seekIntraHandoverTeachingTime(25, Number.NaN), 25);

console.log('intraHandoverTeachingDirector tests pass');
