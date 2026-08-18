import assert from 'node:assert/strict';

import {
  nudgeVisualLabUe,
  visualLabUeDirectionForKey,
} from './visualLabUeNudge';

assert.deepEqual(nudgeVisualLabUe(
  { x: 0, z: 0 },
  { x: 0, z: 0 },
  1,
  'right',
  0.2,
), { x: 0.2, z: 0 });

const bounded = nudgeVisualLabUe(
  { x: 0.95, z: 0 },
  { x: 0, z: 0 },
  1,
  'right',
  0.2,
);
assert.ok(Math.hypot(bounded.x, bounded.z) <= 1 + Number.EPSILON);
assert.equal(visualLabUeDirectionForKey('ArrowUp'), 'up');
assert.equal(visualLabUeDirectionForKey('Enter'), null);

console.log('visual-lab UE keyboard nudge stays inside the accepted cell');
