import assert from 'node:assert/strict';

import {
  C120_DEFAULT_MINIMUM_ELEVATION_DEG,
  C120_MAX_VISUAL_TRAJECTORY_POINTS,
  C120_MAX_VISUAL_RANGE_WU,
  createC120NTPUVisualTrajectory,
  projectC120OrbitScene,
  type C120NTPUVisualTrajectory,
} from './orbitSceneProjection';
import type { C120OrbitLookPoint } from './orbitPropagation';

function point(
  utc: string,
  azimuthDeg: number,
  elevationDeg: number,
  rangeKm: number,
): C120OrbitLookPoint {
  return { utc, azimuthDeg, elevationDeg, rangeKm };
}

function assertClose(actual: number, expected: number, tolerance = 1e-10): void {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not close to ${expected}`);
}

function expectRejected(action: () => unknown): void {
  assert.throws(action, error => error instanceof TypeError && String(error).includes('projection rejected input'));
}

const orderedPoints = [
  point('2026-08-09T18:28:00.000Z', 0, 0, 500),
  point('2026-08-09T18:29:00.000Z', 90, 20, 1_000),
  point('2026-08-09T18:30:00.000Z', 180, 45, 3_000),
];
const beforeInput = JSON.stringify(orderedPoints);
const trajectory = projectC120OrbitScene(orderedPoints, { minimumElevationDeg: 15 });

// Cardinal ENU directions: azimuth 0° = north, 90° = east, and Three.js
// world axes are [east, up, -north].
const north = trajectory.points[0];
assert.deepEqual(north.scene.observerPosition, [0, 0, 0]);
assertClose(north.scene.satellitePosition[0], 0);
assertClose(north.scene.satellitePosition[1], 0);
assert.ok(north.scene.satellitePosition[2] < 0);
assertClose(north.scene.beamPosition[0], 0);
assertClose(north.scene.beamPosition[2], north.scene.satellitePosition[2]);

const east = trajectory.points[1];
assert.ok(east.scene.satellitePosition[0] > 0);
assertClose(east.scene.satellitePosition[1], east.scene.satellitePosition[0] * Math.tan(20 * Math.PI / 180));
assertClose(east.scene.satellitePosition[2], 0);
assertClose(east.scene.beamPosition[0], east.scene.satellitePosition[0]);
assertClose(east.scene.beamPosition[1], 0);

const elevated = projectC120OrbitScene([
  point('2026-08-09T18:28:00.000Z', 0, 90, 1_000),
], { minimumElevationDeg: 15 }).points[0];
const expectedVisualRadius = 240 * 1_000 / (1_000 + 1_800);
assertClose(elevated.scene.satellitePosition[0], 0);
assertClose(elevated.scene.satellitePosition[1], expectedVisualRadius);
assertClose(elevated.scene.satellitePosition[2], 0);
elevated.scene.beamPosition.forEach(component => assertClose(component, 0));

// The source values are preserved flat beside the derived scene state.
assert.deepEqual(
  trajectory.points.map(({ utc, azimuthDeg, elevationDeg, rangeKm }) => ({ utc, azimuthDeg, elevationDeg, rangeKm })),
  orderedPoints,
);
assert.equal(trajectory.minimumElevationDeg, 15);
assert.equal(trajectory.points[0].scene.visible, false);
assert.equal(trajectory.points[1].scene.visible, true);
assert.equal(trajectory.points[2].scene.visible, true);

// The range mapping is monotonic and bounded; it never uses raw km as world
// units, even for an intentionally broad but accepted LEO slant range.
const rangeTrajectory = projectC120OrbitScene([
  point('2026-08-09T18:28:00.000Z', 90, 0, 100),
  point('2026-08-09T18:29:00.000Z', 90, 0, 1_000),
  point('2026-08-09T18:30:00.000Z', 90, 0, 50_000),
]);
const radii = rangeTrajectory.points.map(item => Math.hypot(...item.scene.satellitePosition));
assert.ok(radii[0] > 0);
assert.ok(radii[0] < radii[1]);
assert.ok(radii[1] < radii[2]);
assert.ok(radii[2] <= C120_MAX_VISUAL_RANGE_WU);
assert.ok(radii[2] < C120_MAX_VISUAL_RANGE_WU);

// A repeated call has identical JSON and a deeply frozen result.  The input
// remains untouched and is not frozen as a side effect.
const repeat = createC120NTPUVisualTrajectory(orderedPoints, { minimumElevationDeg: 15 });
assert.equal(JSON.stringify(repeat), JSON.stringify(trajectory));
assert.equal(JSON.stringify(orderedPoints), beforeInput);
assert.equal(Object.isFrozen(trajectory), true);
assert.equal(Object.isFrozen(trajectory.points), true);
assert.equal(Object.isFrozen(trajectory.points[0]), true);
assert.equal(Object.isFrozen(trajectory.points[0].scene), true);
assert.equal(Object.isFrozen(trajectory.points[0].scene.satellitePosition), true);
assert.equal(Object.isFrozen(orderedPoints), false);

// The default mask is explicit and deterministic.
assert.equal(
  projectC120OrbitScene([point('2026-08-09T18:28:00.000Z', 0, C120_DEFAULT_MINIMUM_ELEVATION_DEG, 500)])
    .points[0].scene.visible,
  true,
);

const valid = point('2026-08-09T18:28:00.000Z', 0, 15, 500);
expectRejected(() => projectC120OrbitScene([]));
expectRejected(() => projectC120OrbitScene(null as unknown as readonly C120OrbitLookPoint[]));
expectRejected(() => projectC120OrbitScene([{ ...valid, utc: '2026-08-09T18:28:00.000' }]));
expectRejected(() => projectC120OrbitScene([{ ...valid, utc: 'not-a-date' }]));
expectRejected(() => projectC120OrbitScene([{ ...valid, azimuthDeg: -0.1 }]));
expectRejected(() => projectC120OrbitScene([{ ...valid, azimuthDeg: 360 }]));
expectRejected(() => projectC120OrbitScene([{ ...valid, elevationDeg: -90.1 }]));
expectRejected(() => projectC120OrbitScene([{ ...valid, elevationDeg: 90.1 }]));
expectRejected(() => projectC120OrbitScene([{ ...valid, rangeKm: 0 }]));
expectRejected(() => projectC120OrbitScene([{ ...valid, rangeKm: Number.NaN }]));
expectRejected(() => projectC120OrbitScene([{ ...valid, rangeKm: Number.POSITIVE_INFINITY }]));
expectRejected(() => projectC120OrbitScene([{ ...valid, rangeKm: 50_001 }]));
expectRejected(() => projectC120OrbitScene([
  valid,
  point('2026-08-09T18:27:59.000Z', 0, 15, 500),
]));
expectRejected(() => projectC120OrbitScene([
  valid,
  point(valid.utc, 0, 15, 500),
]));
expectRejected(() => projectC120OrbitScene([{ ...valid, extra: true } as unknown as C120OrbitLookPoint]));
expectRejected(() => projectC120OrbitScene([valid], { minimumElevationDeg: 91 }));
expectRejected(() => projectC120OrbitScene([valid], { minimumElevationDeg: Number.NaN }));
expectRejected(() => projectC120OrbitScene(Array.from(
  { length: C120_MAX_VISUAL_TRAJECTORY_POINTS + 1 },
  (_, index) => point(new Date(Date.parse(valid.utc) + index * 1_000).toISOString(), 0, 15, 500),
)));

// Keep this explicit for a quick direct invocation in the repository's test
// style (which runs TypeScript files through tsx rather than node:test).
const result: C120NTPUVisualTrajectory = trajectory;
assert.equal(result.points.length, 3);
console.log('C-120 orbit scene projection tests passed');
