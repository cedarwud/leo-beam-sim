import assert from 'node:assert/strict';

import {
  INITIAL_SCIENTIFIC_EXPLANATION_EXPERIENCE,
  SCIENTIFIC_EXPLANATION_STORAGE_NAMESPACE,
  reduceScientificExplanationExperience,
  scientificExplanationStorageKey,
} from './scientificExplanationExperienceState';

assert.equal(SCIENTIFIC_EXPLANATION_STORAGE_NAMESPACE, 'leo-beam-sim:/explain/:');
assert.equal(scientificExplanationStorageKey('presentation-v1'), 'leo-beam-sim:/explain/:presentation-v1');
assert.throws(() => scientificExplanationStorageKey('../homepage'), /invalid \/explain storage-key suffix/);

const oriented = reduceScientificExplanationExperience(
  INITIAL_SCIENTIFIC_EXPLANATION_EXPERIENCE,
  { type: 'reveal-orientation' },
);
assert.deepEqual(oriented.lesson, {
  stage: 'orient',
  recordId: 'scientific-causal-lab-v1',
  actionId: 'a1-orient',
});
assert.equal(oriented.presentation.visibleLayer, 'causal-lab');
assert.equal(oriented.capture.readiness, 'not-requested');
assert.ok(Object.isFrozen(oriented.lesson));
assert.ok(Object.isFrozen(oriented.presentation));
assert.ok(Object.isFrozen(oriented.capture));

assert.equal(
  reduceScientificExplanationExperience(oriented, { type: 'return-to-entry' }),
  INITIAL_SCIENTIFIC_EXPLANATION_EXPERIENCE,
);

console.log('Scientific explanation experience-state tests passed');
