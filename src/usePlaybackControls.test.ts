import assert from 'node:assert/strict';

import { resolveEffectivePlaybackSpeed } from './usePlaybackControls';

const handoverSlow = {
  directorSlowActive: false,
  candidateComparisonSlowActive: true,
  autoSlowApplied: true,
} as const;

assert.equal(
  resolveEffectivePlaybackSpeed({ speed: 1, ...handoverSlow }),
  0.5,
  'the default 1x transport remains readable during candidate comparison',
);
assert.equal(
  resolveEffectivePlaybackSpeed({ speed: 5, ...handoverSlow }),
  0.5,
  'the complete candidate-to-handover story stays slow even when 5x is selected',
);
assert.equal(
  resolveEffectivePlaybackSpeed({
    speed: 10,
    directorSlowActive: true,
    candidateComparisonSlowActive: true,
    autoSlowApplied: true,
  }),
  0.25,
  'director focus keeps owning the visible handover rate',
);
assert.equal(
  resolveEffectivePlaybackSpeed({
    speed: 5,
    directorSlowActive: false,
    candidateComparisonSlowActive: false,
    autoSlowApplied: false,
  }),
  5,
  'an accelerated preset remains effective during ordinary playback',
);
assert.equal(
  resolveEffectivePlaybackSpeed({
    speed: 1,
    directorSlowActive: true,
    candidateComparisonSlowActive: false,
    autoSlowApplied: true,
  }),
  0.25,
  'cinema focus still owns the default 1x presentation rate',
);

console.log('playback transport speed ownership checks pass');
