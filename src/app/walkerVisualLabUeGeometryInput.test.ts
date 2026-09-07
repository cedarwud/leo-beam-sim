import assert from 'node:assert/strict';

import {
  buildWalkerVisualLabUeGeometryInput,
  type WalkerVisualLabUeGeometrySource,
} from './walkerVisualLabUeGeometryInput';

const source: WalkerVisualLabUeGeometrySource = {
  snapshot: {
    serving: {
      distanceKm: 1_234,
      elevationDeg: 48,
    },
  },
  localScene: {
    representative: {
      availability: 'available',
      user: {
        index: 7,
        positionKm: [1.5, -2.5],
      },
      cell: {
        centerKm: [0.5, -0.5],
      },
    },
    substrate: {
      cellRadiusKm: 10,
      worldUnitsPerKm: 0.25,
    },
  },
  selectedUeWorldPosition: { x: 0.75, z: -0.5 },
};

const geometryInput = buildWalkerVisualLabUeGeometryInput(source);
assert.deepEqual(geometryInput, {
  link: {
    satelliteDistanceKm: 1_234,
    satelliteElevationDeg: 48,
  },
  geometry: {
    beamCenterKm: [0.5, -0.5],
    acceptedPositionKm: [1.5, -2.5],
    cellRadiusKm: 10,
    worldUnitsPerKm: 0.25,
  },
  representativeUserIndex: 7,
  selectedUeWorldPosition: { x: 0.75, z: -0.5 },
});

assert.equal(
  buildWalkerVisualLabUeGeometryInput({
    ...source,
    selectedUeWorldPosition: null,
  })?.selectedUeWorldPosition,
  null,
  'the adapter preserves the absence of a draft world position',
);

for (const invalidSource of [
  { ...source, snapshot: null },
  {
    ...source,
    localScene: {
      ...source.localScene!,
      representative: {
        ...source.localScene!.representative,
        availability: 'unavailable' as const,
      },
    },
  },
  {
    ...source,
    localScene: {
      ...source.localScene!,
      substrate: { ...source.localScene!.substrate, worldUnitsPerKm: 0 },
    },
  },
]) {
  assert.equal(
    buildWalkerVisualLabUeGeometryInput(invalidSource),
    null,
    'incomplete geometry prerequisites must fail closed',
  );
}

console.log('walkerVisualLabUeGeometryInput.test.ts: all assertions passed');
