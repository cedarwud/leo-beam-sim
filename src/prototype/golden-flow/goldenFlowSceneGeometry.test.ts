import assert from 'node:assert/strict';

import {
  buildConstantElevationTerminalPosition,
  buildGroundBeamGeometry,
  buildGroundBoresightTarget,
  buildGroundClippedConePositions,
} from './goldenFlowSceneGeometry';

const constantElevationSource = [-4.3, 7.57, 0] as const;
const centeredTeachingTerminal = [1, 0, 0] as const;
const movedTeachingTerminal = buildConstantElevationTerminalPosition({
  source: constantElevationSource,
  centeredTerminal: centeredTeachingTerminal,
  offAxisDeg: 8,
});
assert.equal(movedTeachingTerminal[1], 0, 'moved UE remains on the ground');
assert.ok(
  movedTeachingTerminal[2] < centeredTeachingTerminal[2],
  'the authored constant-elevation branch moves the UE toward screen-right in the Act 3 camera',
);
const centeredHorizontalRadius = Math.hypot(
  centeredTeachingTerminal[0] - constantElevationSource[0],
  centeredTeachingTerminal[2] - constantElevationSource[2],
);
const movedHorizontalRadius = Math.hypot(
  movedTeachingTerminal[0] - constantElevationSource[0],
  movedTeachingTerminal[2] - constantElevationSource[2],
);
assert.ok(
  Math.abs(movedHorizontalRadius - centeredHorizontalRadius) < 1e-10,
  'UE path preserves the horizontal radius and therefore the elevation angle',
);
const centeredTeachingRay = centeredTeachingTerminal.map(
  (value, index) => value - constantElevationSource[index]!,
) as [number, number, number];
const movedTeachingRay = movedTeachingTerminal.map(
  (value, index) => value - constantElevationSource[index]!,
) as [number, number, number];
const teachingRayCosine = centeredTeachingRay.reduce(
  (sum, value, index) => sum + value * movedTeachingRay[index]!,
  0,
) / (Math.hypot(...centeredTeachingRay) * Math.hypot(...movedTeachingRay));
assert.ok(
  Math.abs(Math.acos(teachingRayCosine) * 180 / Math.PI - 8) < 1e-9,
  'UE displacement creates the requested true off-axis angle at the satellite',
);
assert.deepEqual(
  buildConstantElevationTerminalPosition({
    source: constantElevationSource,
    centeredTerminal: centeredTeachingTerminal,
    offAxisDeg: 0,
  }),
  centeredTeachingTerminal,
  'zero off-axis displacement keeps the UE under the fixed boresight',
);

const boresightSource = [-3.8, 4.7, -0.8] as const;
const boresightTerminal = [0, 0.24, 0.9] as const;
const boresightTarget = buildGroundBoresightTarget({
  source: boresightSource,
  terminal: boresightTerminal,
  offAxisDeg: 5.2147487675,
});
assert.equal(boresightTarget[1], 0, 'boresight target must lie on the ground');
const terminalDirection = boresightTerminal.map((value, index) => value - boresightSource[index]!) as [number, number, number];
const boresightDirection = boresightTarget.map((value, index) => value - boresightSource[index]!) as [number, number, number];
const vectorLength = (vector: readonly number[]) => Math.hypot(...vector);
const cosine = terminalDirection.reduce(
  (sum, value, index) => sum + value * boresightDirection[index]!,
  0,
) / (vectorLength(terminalDirection) * vectorLength(boresightDirection));
const measuredOffAxisDeg = Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
assert.ok(
  Math.abs(measuredOffAxisDeg - 5.2147487675) < 1e-9,
  'rendered boresight must preserve the requested 3D off-axis angle',
);

const centredTerminal = [0, 0, 0.9] as const;
const centredTarget = buildGroundBoresightTarget({
  source: boresightSource,
  terminal: centredTerminal,
  offAxisDeg: 0,
});
assert.ok(Math.abs(centredTarget[0] - centredTerminal[0]) < 1e-9);
assert.ok(Math.abs(centredTarget[2] - centredTerminal[2]) < 1e-9);
assert.equal(centredTarget[1], 0, 'a centred beam must land directly below the UE');

const secondCentredTarget = buildGroundBoresightTarget({
  source: [3.8, 4.9, -0.4],
  terminal: centredTerminal,
  offAxisDeg: 0,
});
assert.ok(
  secondCentredTarget.every((value, index) => Math.abs(value - centredTarget[index]!) < 1e-9),
  'two satellites comparing the same UE must share one ground target',
);

const geometry = buildGroundBeamGeometry({
  source: [0, 4, 0],
  target: [1, 2, 0],
  radius: 1,
  groundY: 0,
});

assert.deepEqual(geometry.groundAxis, [2, 0, 0]);
assert.equal(geometry.groundAxis[1], 0);
assert.ok(Math.abs(geometry.coneLength - 2 * Math.sqrt(5)) < 1e-10);
assert.equal(geometry.coneRadius, 2);
assert.ok(Math.abs(geometry.footprintCenter[0] - 48 / 19) < 1e-10);
assert.equal(geometry.footprintCenter[1], 0);
assert.ok(geometry.footprintMajorRadius > geometry.footprintMinorRadius);
assert.ok(Math.abs(geometry.footprintMajorRadius - 100 / (19 * Math.sqrt(5))) < 1e-10);
assert.ok(Math.abs(geometry.footprintMinorRadius - 20 / Math.sqrt(95)) < 1e-10);
assert.equal(geometry.footprintRotationY, 0);

const clipped = buildGroundClippedConePositions([0, 4, 0], geometry, 24);
assert.equal(clipped.length, 24 * 9);
for (let offset = 0; offset < clipped.length; offset += 9) {
  assert.equal(clipped[offset + 1], 4, 'each cone triangle starts at the satellite apex');
  assert.equal(clipped[offset + 4], 0, 'every first rim vertex lies on the ground plane');
  assert.equal(clipped[offset + 7], 0, 'every second rim vertex lies on the ground plane');
}

console.log('golden-flow ground beam geometry regression passed');
