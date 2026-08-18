import assert from 'node:assert/strict';
import { deriveObserverLinkGeometry, NTPU_TLE_OBSERVER } from './observer';

assert.deepEqual(NTPU_TLE_OBSERVER, {
  id: 'ntpu-wgs84-v1',
  label: 'NTPU',
  latitudeDeg: 24.9441667,
  longitudeDeg: 121.3713889,
  heightKm: 0.05,
});

const geometry = deriveObserverLinkGeometry(
  { x: -3897.421, y: 4510.142, z: 3575.884 },
  '2026-08-08T12:00:00.000Z',
);
assert.equal(Number.isFinite(geometry.azimuthDeg), true);
assert.equal(Number.isFinite(geometry.elevationDeg), true);
assert.equal(Number.isFinite(geometry.rangeKm), true);
assert.equal(Number.isFinite(geometry.offAxisAngleRad), true);
assert.ok(geometry.azimuthDeg >= 0 && geometry.azimuthDeg < 360);
assert.ok(geometry.rangeKm > 0);
assert.ok(geometry.offAxisAngleRad >= 0 && geometry.offAxisAngleRad <= Math.PI);
assert.equal(
  geometry.visible,
  geometry.elevationDeg >= 0,
  'visibility uses the same elevation that downstream consumers read',
);

console.log('NTPU observer geometry contract passed');
