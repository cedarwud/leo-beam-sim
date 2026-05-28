import {
  FOOTPRINT_LONG_AXIS_MAX_MULT,
  FOOTPRINT_RADIUS_WORLD,
  MAX_BEAMS_PER_SATELLITE,
  computeBeamGeometry,
  computeCellPointingGeometry,
  offAxisAngleRad,
  slantRangeKm,
} from '../src/scene/beam-geometry-pure.ts';
import { elevationAngleRad } from '../src/engine/cells/cellLayout.ts';

interface ValidationResult {
  readonly passed: boolean;
  readonly name: string;
  readonly details?: string;
}

interface CellLike {
  readonly latDeg: number;
  readonly lonDeg: number;
}

const SAT_LAT_DEG = 40;
const SAT_LON_DEG = 116;
const SAT_ALTITUDE_KM = 780;
const CELL_RADIUS_KM = 14;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function check(name: string, assertion: () => void): ValidationResult {
  try {
    assertion();
    return { passed: true, name };
  } catch (error) {
    return {
      passed: false,
      name,
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertClose(actual: number, expected: number, tolerance: number, label: string): void {
  const delta = Math.abs(actual - expected);
  assert(
    delta <= tolerance,
    `${label}: expected ${expected}, got ${actual}, delta=${delta}, tolerance=${tolerance}`,
  );
}

function assertBetweenInclusive(value: number, min: number, max: number, label: string): void {
  assert(
    value >= min && value <= max,
    `${label}: expected ${value} within [${min}, ${max}]`,
  );
}

function assertFinite(value: number, label: string): void {
  assert(Number.isFinite(value), `${label}: expected finite, got ${value}`);
}

function assertMonotoneIncreasing(values: readonly number[], label: string): void {
  for (let index = 1; index < values.length; index += 1) {
    assert(
      values[index] > values[index - 1],
      `${label}: expected ${values.join(', ')} to be strictly increasing`,
    );
  }
}

function satelliteLonForElevation(targetElevationDeg: number): number {
  let lowOffsetDeg = 0;
  let highOffsetDeg = 35;

  for (let iteration = 0; iteration < 80; iteration += 1) {
    const midOffsetDeg = (lowOffsetDeg + highOffsetDeg) / 2;
    const elevationDeg = elevationAngleRad(
      SAT_LAT_DEG,
      SAT_LON_DEG + midOffsetDeg,
      SAT_ALTITUDE_KM,
      SAT_LAT_DEG,
      SAT_LON_DEG,
    ) * RAD_TO_DEG;

    if (elevationDeg > targetElevationDeg) {
      lowOffsetDeg = midOffsetDeg;
    } else {
      highOffsetDeg = midOffsetDeg;
    }
  }

  return SAT_LON_DEG + ((lowOffsetDeg + highOffsetDeg) / 2);
}

function geometryAtElevation(targetElevationDeg: number) {
  const satLonDeg = satelliteLonForElevation(targetElevationDeg);
  const cell = { latDeg: SAT_LAT_DEG, lonDeg: SAT_LON_DEG };
  return computeCellPointingGeometry(
    SAT_LAT_DEG,
    satLonDeg,
    SAT_ALTITUDE_KM,
    cell,
    CELL_RADIUS_KM,
  );
}

function deterministicPayload(value: ReturnType<typeof computeCellPointingGeometry>): string {
  return JSON.stringify({
    slantRangeKm: value.slantRangeKm,
    elevationRad: value.elevationRad,
    footprintLongAxisKm: value.footprintLongAxisKm,
    footprintShortAxisKm: value.footprintShortAxisKm,
    longAxisBearingRad: value.longAxisBearingRad,
  });
}

const centerCell: CellLike = { latDeg: SAT_LAT_DEG, lonDeg: SAT_LON_DEG };
const overheadGeometry = computeCellPointingGeometry(
  SAT_LAT_DEG,
  SAT_LON_DEG,
  SAT_ALTITUDE_KM,
  centerCell,
  CELL_RADIUS_KM,
);
const oblique30Geometry = geometryAtElevation(30);
const low5Geometry = geometryAtElevation(5);

const results: ValidationResult[] = [
  check('slant range at sub-satellite cell is altitude', () => {
    assertClose(
      slantRangeKm(40, 116, 780, 40, 116),
      780,
      0.5,
      'sub-satellite slant range',
    );
  }),
  check('off-nadir slant range is farther than altitude', () => {
    const actual = slantRangeKm(40, 116, 780, 40.1, 116);
    assert(actual > 780, `expected off-nadir range > 780, got ${actual}`);
  }),
  check('very far off-nadir slant range exceeds 1500 km', () => {
    const actual = slantRangeKm(40, 116, 780, 60, 116);
    assert(actual > 1500, `expected far off-nadir range > 1500, got ${actual}`);
  }),
  check('slant range grows monotonically with cell offset', () => {
    const ranges = [0, 0.05, 0.1, 0.2].map(offsetDeg => (
      slantRangeKm(40, 116, 780, 40 + offsetDeg, 116)
    ));
    assertMonotoneIncreasing(ranges, 'slant ranges by latitude offset');
  }),
  check('off-axis angle is zero when user is at nadir cell center', () => {
    assertClose(
      offAxisAngleRad(40, 116, 780, 40, 116, 40, 116),
      0,
      1e-6,
      'nadir cell-center off-axis angle',
    );
  }),
  check('off-axis angle is positive when user is offset from cell center', () => {
    const actual = offAxisAngleRad(40, 116, 780, 40, 116, 40, 116.05);
    assert(actual > 0, `expected positive off-axis angle, got ${actual}`);
  }),
  check('off-axis angle grows with user longitude offset', () => {
    const near = offAxisAngleRad(40, 116, 780, 40, 116, 40, 116.05);
    const far = offAxisAngleRad(40, 116, 780, 40, 116, 40, 116.1);
    assert(far > near, `expected far offset ${far} > near offset ${near}`);
  }),
  check('off-axis angle is symmetric for east and west user offsets', () => {
    const east = offAxisAngleRad(40, 116, 780, 40, 116, 40, 116.05);
    const west = offAxisAngleRad(40, 116, 780, 40, 116, 40, 115.95);
    assertClose(east, west, 1e-12, 'east/west symmetric off-axis angle');
  }),
  check('off-axis angle is zero at an off-axis cell center when beam tracks cell', () => {
    assertClose(
      offAxisAngleRad(40, 116, 780, 40, 116.1, 40, 116.1),
      0,
      1e-6,
      'off-axis tracked cell-center angle',
    );
  }),
  check('overhead cell-pointing geometry is circular with finite bearing', () => {
    assertClose(overheadGeometry.elevationRad, Math.PI / 2, 1e-3, 'overhead elevation');
    assertClose(overheadGeometry.footprintLongAxisKm, CELL_RADIUS_KM, 1e-6, 'overhead long axis');
    assertClose(overheadGeometry.footprintShortAxisKm, CELL_RADIUS_KM, 0, 'overhead short axis');
    assertFinite(overheadGeometry.longAxisBearingRad, 'overhead longAxisBearingRad');
  }),
  check('30 degree elevation footprint long axis is approximately 2x radius', () => {
    assertClose(oblique30Geometry.elevationRad, 30 * DEG_TO_RAD, 1e-9, '30 degree geometry elevation');
    assertClose(
      oblique30Geometry.footprintLongAxisKm,
      CELL_RADIUS_KM / Math.sin(30 * DEG_TO_RAD),
      CELL_RADIUS_KM * 0.05,
      '30 degree long axis',
    );
  }),
  check('footprint long axis is never shorter than short axis across elevations', () => {
    for (const elevationDeg of [20, 30, 45, 60, 89]) {
      const geometry = geometryAtElevation(elevationDeg);
      assert(
        geometry.footprintLongAxisKm >= geometry.footprintShortAxisKm,
        `elevation ${elevationDeg}: long=${geometry.footprintLongAxisKm}, short=${geometry.footprintShortAxisKm}`,
      );
    }
  }),
  check('footprint short axis exactly equals cell radius', () => {
    for (const elevationDeg of [20, 30, 45, 60, 89]) {
      const geometry = geometryAtElevation(elevationDeg);
      assert(
        geometry.footprintShortAxisKm === CELL_RADIUS_KM,
        `elevation ${elevationDeg}: short=${geometry.footprintShortAxisKm}`,
      );
    }
  }),
  check('extremely low elevation footprint long axis is clamped', () => {
    assertClose(low5Geometry.elevationRad, 5 * DEG_TO_RAD, 1e-9, '5 degree geometry elevation');
    assertClose(
      low5Geometry.footprintLongAxisKm,
      FOOTPRINT_LONG_AXIS_MAX_MULT * CELL_RADIUS_KM,
      1e-9,
      'low elevation long-axis clamp',
    );
  }),
  check('legacy computeBeamGeometry footprint regression remains unchanged', () => {
    const geometry = computeBeamGeometry(780, 0.0349);
    assertClose(geometry.footprintRadiusKm, 13.62, 0.05, 'legacy footprint radius');
  }),
  check('legacy FOOTPRINT_RADIUS_WORLD export remains 56', () => {
    assert(FOOTPRINT_RADIUS_WORLD === 56, `FOOTPRINT_RADIUS_WORLD=${FOOTPRINT_RADIUS_WORLD}`);
  }),
  check('legacy MAX_BEAMS_PER_SATELLITE export remains 7', () => {
    assert(MAX_BEAMS_PER_SATELLITE === 7, `MAX_BEAMS_PER_SATELLITE=${MAX_BEAMS_PER_SATELLITE}`);
  }),
  check('new footprint long-axis clamp multiplier is exported as 10', () => {
    assert(FOOTPRINT_LONG_AXIS_MAX_MULT === 10, `FOOTPRINT_LONG_AXIS_MAX_MULT=${FOOTPRINT_LONG_AXIS_MAX_MULT}`);
  }),
  check('slant range is strictly positive for non-degenerate inputs', () => {
    const actual = slantRangeKm(40, 116, 780, 40.25, 116.25);
    assert(actual > 0, `slant range=${actual}`);
  }),
  check('off-axis angle is always in [0, pi]', () => {
    const samples = [
      offAxisAngleRad(40, 116, 780, 40, 116, 40, 116),
      offAxisAngleRad(40, 116, 780, 40, 116, 40.1, 116.1),
      offAxisAngleRad(40, 116, 780, 40, 116.1, 39.9, 115.9),
    ];
    for (const [index, value] of samples.entries()) {
      assertBetweenInclusive(value, 0, Math.PI, `sample ${index} off-axis angle`);
    }
  }),
  check('cell-pointing elevation matches cellLayout elevationAngleRad', () => {
    const satLonDeg = satelliteLonForElevation(45);
    const geometry = computeCellPointingGeometry(40, satLonDeg, 780, centerCell, CELL_RADIUS_KM);
    const expected = elevationAngleRad(40, satLonDeg, 780, centerCell.latDeg, centerCell.lonDeg);
    assertClose(geometry.elevationRad, expected, 0, 'elevation helper parity');
  }),
  check('cell-pointing geometry is deterministic for identical inputs', () => {
    const first = computeCellPointingGeometry(40, satelliteLonForElevation(60), 780, centerCell, CELL_RADIUS_KM);
    const second = computeCellPointingGeometry(40, satelliteLonForElevation(60), 780, centerCell, CELL_RADIUS_KM);
    assert(
      deterministicPayload(first) === deterministicPayload(second),
      `first=${deterministicPayload(first)} second=${deterministicPayload(second)}`,
    );
  }),
  check('cell-pointing slant range equals standalone slantRangeKm', () => {
    const satLonDeg = satelliteLonForElevation(45);
    const geometry = computeCellPointingGeometry(40, satLonDeg, 780, centerCell, CELL_RADIUS_KM);
    const expected = slantRangeKm(40, satLonDeg, 780, centerCell.latDeg, centerCell.lonDeg);
    assertClose(geometry.slantRangeKm, expected, 0, 'slant range helper parity');
  }),
  check('long-axis bearing uses north-zero east-positive convention', () => {
    const eastGeometry = computeCellPointingGeometry(40, 116.1, 780, centerCell, CELL_RADIUS_KM);
    assertClose(eastGeometry.longAxisBearingRad, Math.PI / 2, 2e-3, 'eastward bearing');
  }),
];

let passCount = 0;
let failCount = 0;

for (const [index, result] of results.entries()) {
  const number = String(index + 1).padStart(2, '0');
  if (result.passed) {
    passCount += 1;
    console.log(`PASS ${number}: ${result.name}`);
  } else {
    failCount += 1;
    console.error(`FAIL ${number}: ${result.name} ${result.details ?? ''}`);
  }
}

if (passCount < 22) {
  failCount += 1;
  console.error(`FAIL ${String(results.length + 1).padStart(2, '0')}: minimum assertion count expected >=22, got ${passCount}`);
}

if (failCount > 0) {
  process.exitCode = 1;
} else {
  console.log(`validate-phase-i-s3-beam-geometry: PASS (${passCount} assertions)`);
}
