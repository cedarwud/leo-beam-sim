import assert from 'node:assert/strict';

import { resolveDisplayHeroRecord } from './beamDisplaySpec';

const primary = { servingSatId: 'sat-primary', cellId: 0 };
const result = resolveDisplayHeroRecord(primary, [
  { servingSatId: 'sat-primary', cellId: 2 },
  { servingSatId: 'sat-fallback', cellId: 1 },
  { servingSatId: 'sat-fallback', cellId: 3 },
]);

assert.deepEqual(
  result,
  { ...primary, beamId: null },
  'the visual hero must retain the primary UE cell when its cone is temporarily unavailable',
);

console.log('beam display hero stability test passed');
