import test from 'node:test';
import assert from 'node:assert/strict';
import { homepageBeamIdentityFromCell } from './homepageBeamIdentity';

test('builds an identity from a valid satellite and cell', () => {
  assert.deepEqual(
    homepageBeamIdentityFromCell('sat-1', 3, 4),
    { satelliteId: 'sat-1', cellId: 3, beamId: 4 },
  );
});

test('rejects incomplete identities without React or canvas state', () => {
  assert.equal(homepageBeamIdentityFromCell(null, 3), null);
  assert.equal(homepageBeamIdentityFromCell('sat-1', null), null);
  assert.equal(homepageBeamIdentityFromCell('   ', 3), null);
  assert.equal(homepageBeamIdentityFromCell('sat-1', 1.5), null);
});

test('defaults the optional beam identity to null', () => {
  assert.deepEqual(
    homepageBeamIdentityFromCell('sat-1', 3),
    { satelliteId: 'sat-1', cellId: 3, beamId: null },
  );
});
