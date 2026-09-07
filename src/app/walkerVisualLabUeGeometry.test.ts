import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveWalkerVisualLabUeGeometry,
  positionForWalkerVisualLabUeAngle,
  type WalkerVisualLabUeGeometryInput,
} from './walkerVisualLabUeGeometry';

const BASE_INPUT: WalkerVisualLabUeGeometryInput = {
  link: {
    satelliteDistanceKm: 1000,
    satelliteElevationDeg: 45,
  },
  geometry: {
    beamCenterKm: [0, 0],
    acceptedPositionKm: [10, 0],
    cellRadiusKm: 100,
    worldUnitsPerKm: 2,
  },
  representativeUserIndex: 0,
  selectedUeWorldPosition: null,
};

test('derives accepted, draft, and maximum angles without React state', () => {
  const derived = deriveWalkerVisualLabUeGeometry(BASE_INPUT);

  assert.equal(derived.hasDraft, false);
  assert.equal(derived.draftAngleDeg, derived.acceptedAngleDeg);
  assert.ok(derived.acceptedAngleDeg > 0);
  assert.ok(derived.maxAngleDeg > derived.acceptedAngleDeg);
  assert.equal(derived.scale, 2);
  assert.equal(derived.representativeUserIndex, 0);
});

test('converts a world-space draft UE into the canonical ground-plane input', () => {
  const derived = deriveWalkerVisualLabUeGeometry({
    ...BASE_INPUT,
    selectedUeWorldPosition: { x: 20, z: -10 },
  });

  assert.equal(derived.hasDraft, true);
  assert.deepEqual(derived.angleInput.userPositionKm, [10, 5]);
  assert.notEqual(derived.draftAngleDeg, derived.acceptedAngleDeg);

  const edge = positionForWalkerVisualLabUeAngle(
    derived,
    derived.maxAngleDeg * Math.PI / 180,
  );
  assert.ok(edge[0] !== 0 || edge[1] !== 0);
});
