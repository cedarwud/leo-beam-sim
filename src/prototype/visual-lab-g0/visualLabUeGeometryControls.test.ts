import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveVisualLabUeGeometryControls,
} from './visualLabUeGeometryControls';
import {
  offAxisAngleRadForVisualLabUe,
  positionForVisualLabUeOffAxisAngle,
  radiansFromDegrees,
} from './visualLabUeGeometry';

const input = {
  satelliteDistanceKm: 900,
  satelliteElevationDeg: 52,
  beamCenterKm: [12, -8] as const,
  acceptedPositionKm: [20, 0] as const,
  maxRadiusKm: 20,
  worldUnitsPerKm: 0.04,
  selectedUeWorldPosition: null,
};

test('UE control derivation exposes the accepted angle, draft angle, and bounded slider maximum', () => {
  const derived = deriveVisualLabUeGeometryControls(input);

  assert.ok(derived !== null);
  assert.equal(derived.hasDraft, false);
  assert.ok(derived.acceptedAngleDeg > 0);
  assert.ok(derived.draftAngleDeg > 0);
  assert.ok(derived.maxAngleDeg >= derived.draftAngleDeg);
  assert.deepEqual(derived.angleInput.direction, [0.7071067811865475, 0.7071067811865475]);
});

test('UE control derivation converts world-space drafts and preserves the exact inverse seam', () => {
  const derived = deriveVisualLabUeGeometryControls({
    ...input,
    selectedUeWorldPosition: { x: 0.8, z: -0.32 },
  });

  assert.ok(derived !== null);
  assert.equal(derived.hasDraft, true);
  assert.deepEqual(derived.angleInput.userPositionKm, [20, 8]);
  const positionKm = positionForVisualLabUeOffAxisAngle(derived.angleInput, radiansFromDegrees(derived.draftAngleDeg));
  const angle = offAxisAngleRadForVisualLabUe({
    satelliteDistanceKm: input.satelliteDistanceKm,
    satelliteElevationDeg: input.satelliteElevationDeg,
    beamCenterKm: input.beamCenterKm,
    userPositionKm: positionKm,
  });
  assert.ok(Math.abs(angle - radiansFromDegrees(derived.draftAngleDeg)) < 1e-10);
});

test('UE control derivation rejects invalid display scale inputs', () => {
  assert.equal(deriveVisualLabUeGeometryControls({ ...input, worldUnitsPerKm: 0 }), null);
});
