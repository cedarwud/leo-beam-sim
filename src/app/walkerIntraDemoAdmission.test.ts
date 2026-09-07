import assert from 'node:assert/strict';

import { canRequestWalkerIntraDemo } from './walkerIntraDemoAdmission';

const readyPresentation = {
  servingSinrDb: 8.5,
  candidateSinrDb: 7.25,
};

assert.equal(
  canRequestWalkerIntraDemo({
    presentation: readyPresentation,
    manualHandoverActive: false,
    visibleHandoverActive: false,
    handoverBusy: false,
  }),
  true,
  'a measured, idle presentation admits the display-only cue',
);

for (const blockedInput of [
  { presentation: null },
  { presentation: undefined },
  { presentation: readyPresentation, manualHandoverActive: true },
  { presentation: readyPresentation, visibleHandoverActive: true },
  { presentation: readyPresentation, handoverBusy: true },
  { presentation: { ...readyPresentation, servingSinrDb: Number.NaN } },
  { presentation: { ...readyPresentation, candidateSinrDb: Number.POSITIVE_INFINITY } },
]) {
  assert.equal(
    canRequestWalkerIntraDemo({
      presentation: blockedInput.presentation,
      manualHandoverActive: blockedInput.manualHandoverActive ?? false,
      visibleHandoverActive: blockedInput.visibleHandoverActive ?? false,
      handoverBusy: blockedInput.handoverBusy ?? false,
    }),
    false,
    'missing, busy, or non-finite handover evidence blocks the cue',
  );
}

console.log('walkerIntraDemoAdmission.test.ts: all assertions passed');
