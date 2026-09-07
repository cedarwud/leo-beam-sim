import assert from 'node:assert/strict';
import test from 'node:test';

import type { AcceptedHandoverPresentationSnapshot } from './acceptedHandoverPresentationSnapshot';
import { resolveAcceptedSatelliteIdentityColor } from './acceptedSatelliteIdentityColor';

const snapshot = {
  plan: {
    identityAllocation: {
      identitiesBySatelliteId: {
        'sat-a': { cssColor: '#accepted' },
      },
    },
  },
} as unknown as AcceptedHandoverPresentationSnapshot;

test('uses the accepted identity color when the satellite is allocated', () => {
  assert.equal(resolveAcceptedSatelliteIdentityColor(snapshot, 'sat-a', '#fallback'), '#accepted');
});

test('keeps a deterministic fallback for an unallocated satellite', () => {
  assert.equal(resolveAcceptedSatelliteIdentityColor(snapshot, 'sat-b', '#fallback'), '#fallback');
  assert.equal(resolveAcceptedSatelliteIdentityColor(null, 'sat-b', '#fallback'), '#fallback');
});
