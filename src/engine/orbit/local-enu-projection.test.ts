import assert from 'node:assert/strict';
import test from 'node:test';

import {
  geodeticToEcefKm,
  normalizeLongitudeDeg,
  projectGeodeticToLocalEnuKm,
  projectLocalEnuKmToGeodetic,
} from './index';

test('flat local ENU projection round-trips at the Walker observer', () => {
  const observer = { latDeg: 25.1519, lonDeg: 121.7811 };
  const point = { latDeg: 25.1723, lonDeg: 121.8127 };
  const local = projectGeodeticToLocalEnuKm(observer, point);
  const restored = projectLocalEnuKmToGeodetic(observer, local);

  assert.ok(Math.abs(restored.latDeg - point.latDeg) < 1e-12);
  assert.ok(Math.abs(restored.lonDeg - point.lonDeg) < 1e-12);
  assert.ok(local.eastKm > 0);
  assert.ok(local.northKm > 0);
});

test('longitude projection follows the short dateline path', () => {
  const observer = { latDeg: 10, lonDeg: 179.9 };
  const point = { latDeg: 10, lonDeg: -179.9 };
  const local = projectGeodeticToLocalEnuKm(observer, point);
  const restored = projectLocalEnuKmToGeodetic(observer, local);

  assert.ok(local.eastKm > 0 && local.eastKm < 25);
  assert.ok(Math.abs(normalizeLongitudeDeg(restored.lonDeg - point.lonDeg)) < 1e-12);
});

test('shared WGS84 ECEF helper is the observer-context coordinate authority', () => {
  const ecef = geodeticToEcefKm(25.1519, 121.7811, 0.02);
  assert.equal(ecef.length, 3);
  ecef.forEach(value => assert.ok(Number.isFinite(value)));
  assert.ok(Math.abs(Math.hypot(...ecef) - 6374) < 20);
});

test('coordinate helpers reject non-finite and out-of-range values', () => {
  assert.throws(() => normalizeLongitudeDeg(Number.NaN), /finite/);
  assert.throws(
    () => projectGeodeticToLocalEnuKm({ latDeg: 91, lonDeg: 0 }, { latDeg: 0, lonDeg: 0 }),
    /inside/,
  );
  assert.throws(
    () => projectLocalEnuKmToGeodetic({ latDeg: 89.99, lonDeg: 0 }, { eastKm: 0, northKm: 10 }),
    /inside/,
  );
});
