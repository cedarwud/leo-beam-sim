import {
  DEFAULT_CELL_COUNT,
  DEFAULT_MIN_ELEVATION_DEG,
  SERVICE_AREA_HEIGHT_KM,
  SERVICE_AREA_WIDTH_KM,
  buildCellLayout,
  elevationAngleRad,
  isCellVisibleFromSatellite,
  localKmToLatLon,
} from '../src/engine/cells/cellLayout.ts';
import { loadProfile, MODQN_4SAT_7BEAM_PAPER_FAITHFUL_PROFILE_ID } from '../src/profiles/index.ts';

interface AxialCoordinate {
  readonly q: number;
  readonly r: number;
  readonly distance: number;
}

interface ValidationResult {
  readonly passed: boolean;
  readonly name: string;
  readonly details?: string;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const TOLERANCE_DEG = 1e-9;
const TOLERANCE_KM = 1e-9;

const profile = loadProfile(MODQN_4SAT_7BEAM_PAPER_FAITHFUL_PROFILE_ID);
const shell = profile.orbit.shells[0];
if (!shell) {
  throw new Error('MODQN paper-faithful profile has no orbit shell');
}

const canonicalConfig = {
  centerLatDeg: profile.orbit.observerLatDeg,
  centerLonDeg: profile.orbit.observerLonDeg,
  altitudeKm: shell.altitudeKm,
  beamwidth3dBRad: profile.antenna.beamwidth3dBRad,
};

const layout = buildCellLayout(canonicalConfig);
const repeatedLayout = buildCellLayout(canonicalConfig);
const axialByCellId = new Map(layout.centers.map(cell => [cell.cellId, recoverAxial(cell)]));
const ringByCellId = new Map([...axialByCellId.entries()].map(([cellId, axial]) => [cellId, axial.distance]));

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

function assertBetween(value: number, min: number, max: number, label: string): void {
  assert(value > min && value < max, `${label}: expected ${value} to be within (${min}, ${max})`);
}

function distanceKm(
  a: { readonly localXKm: number; readonly localYKm: number },
  b: { readonly localXKm: number; readonly localYKm: number },
): number {
  return Math.hypot(a.localXKm - b.localXKm, a.localYKm - b.localYKm);
}

function recoverAxial(cell: { readonly localXKm: number; readonly localYKm: number }): AxialCoordinate {
  const radiusKm = layout.cellRadiusKm;
  const rawR = cell.localYKm / (1.5 * radiusKm);
  const rawQ = (cell.localXKm / (Math.sqrt(3) * radiusKm)) - (rawR / 2);
  const q = Math.round(rawQ);
  const r = Math.round(rawR);
  const s = -q - r;

  assertClose(rawQ, q, 1e-9, `cell q coordinate ${cell.localXKm},${cell.localYKm}`);
  assertClose(rawR, r, 1e-9, `cell r coordinate ${cell.localXKm},${cell.localYKm}`);

  return {
    q,
    r,
    distance: Math.max(Math.abs(q), Math.abs(r), Math.abs(s)),
  };
}

function cellsInRing(ring: number) {
  return layout.centers.filter(cell => ringByCellId.get(cell.cellId) === ring);
}

function assertIdsInRange(cells: readonly { readonly cellId: number }[], minId: number, maxId: number, label: string): void {
  const ids = cells.map(cell => cell.cellId);
  assert(
    ids.length > 0 && ids.every(id => id >= minId && id <= maxId),
    `${label}: expected IDs within ${minId}..${maxId}; got ${ids.join(', ')}`,
  );
}

function minNearestNeighborDistanceKm(): number {
  let minDistance = Number.POSITIVE_INFINITY;
  for (const cell of layout.centers) {
    for (const other of layout.centers) {
      if (cell.cellId !== other.cellId) {
        minDistance = Math.min(minDistance, distanceKm(cell, other));
      }
    }
  }
  return minDistance;
}

function assertDeepEqualCenters(): void {
  const actual = JSON.stringify(layout.centers);
  const expected = JSON.stringify(repeatedLayout.centers);
  assert(actual === expected, 'consecutive layout builds produced different centers');
}

function maxAbs(values: readonly number[]): number {
  return values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
}

function elevationDeg(
  satLatDeg: number,
  satLonDeg: number,
  satAltitudeKm: number,
  cellLatDeg: number,
  cellLonDeg: number,
): number {
  return elevationAngleRad(satLatDeg, satLonDeg, satAltitudeKm, cellLatDeg, cellLonDeg) * RAD_TO_DEG;
}

const expectedSpacingKm = layout.cellRadiusKm * Math.sqrt(3);
const centerCell = layout.centers[0];
if (!centerCell) {
  throw new Error('canonical layout has no center cell');
}

const results: ValidationResult[] = [
  check('count is canonical 37', () => {
    assert(layout.count === DEFAULT_CELL_COUNT, `count=${layout.count}`);
  }),
  check('centers length is canonical 37', () => {
    assert(layout.centers.length === DEFAULT_CELL_COUNT, `centers.length=${layout.centers.length}`);
  }),
  check('cell IDs are unique 0..36', () => {
    const ids = layout.centers.map(cell => cell.cellId);
    assert(new Set(ids).size === DEFAULT_CELL_COUNT, `unique IDs=${new Set(ids).size}`);
    assert(ids.every((id, index) => id === index), `IDs are not stable index order: ${ids.join(', ')}`);
  }),
  check('cell 0 lat/lon equals service-area center', () => {
    assertClose(centerCell.latDeg, canonicalConfig.centerLatDeg, TOLERANCE_DEG, 'cell 0 lat');
    assertClose(centerCell.lonDeg, canonicalConfig.centerLonDeg, TOLERANCE_DEG, 'cell 0 lon');
  }),
  check('cell 0 local ENU is origin', () => {
    assertClose(centerCell.localXKm, 0, TOLERANCE_KM, 'cell 0 localXKm');
    assertClose(centerCell.localYKm, 0, TOLERANCE_KM, 'cell 0 localYKm');
  }),
  check('cell radius is profile-derived 13.0..14.5 km', () => {
    assertBetween(layout.cellRadiusKm, 13.0, 14.5, 'cellRadiusKm');
  }),
  check('all local east/west centers stay inside service envelope plus radius', () => {
    const maxEastKm = maxAbs(layout.centers.map(cell => cell.localXKm));
    const limitKm = layout.serviceArea.widthKm / 2 + layout.cellRadiusKm;
    assert(maxEastKm <= limitKm, `max |x|=${maxEastKm}, limit=${limitKm}`);
  }),
  check('all local north/south centers match SDD ring-3 span', () => {
    const maxNorthKm = maxAbs(layout.centers.map(cell => cell.localYKm));
    const expectedRing3NorthKm = layout.cellRadiusKm * 1.5 * 3;
    assertClose(maxNorthKm, expectedRing3NorthKm, 1e-9, 'max |y| for ring 3');
    assert(
      maxNorthKm <= (layout.serviceArea.heightKm / 2) + (1.5 * layout.cellRadiusKm),
      `max |y|=${maxNorthKm} exceeds ring-3 center envelope`,
    );
  }),
  check('service area dimensions are 200x90 km', () => {
    assert(layout.serviceArea.widthKm === SERVICE_AREA_WIDTH_KM, `width=${layout.serviceArea.widthKm}`);
    assert(layout.serviceArea.heightKm === SERVICE_AREA_HEIGHT_KM, `height=${layout.serviceArea.heightKm}`);
  }),
  check('ring 0 count is 1 and contains cell 0', () => {
    const cells = cellsInRing(0);
    assert(cells.length === 1, `ring 0 count=${cells.length}`);
    assert(cells[0]?.cellId === 0, `ring 0 cellId=${cells[0]?.cellId}`);
  }),
  check('ring 1 count is 6 and IDs are 1..6', () => {
    const cells = cellsInRing(1);
    assert(cells.length === 6, `ring 1 count=${cells.length}`);
    assertIdsInRange(cells, 1, 6, 'ring 1');
  }),
  check('ring 2 count is 12 and IDs are 7..18', () => {
    const cells = cellsInRing(2);
    assert(cells.length === 12, `ring 2 count=${cells.length}`);
    assertIdsInRange(cells, 7, 18, 'ring 2');
  }),
  check('ring 3 count is 18 and IDs are 19..36', () => {
    const cells = cellsInRing(3);
    assert(cells.length === 18, `ring 3 count=${cells.length}`);
    assertIdsInRange(cells, 19, 36, 'ring 3');
  }),
  check('layout generation is deterministic', assertDeepEqualCenters),
  check('ring-monotone IDs are strictly increasing', () => {
    for (let ring = 1; ring <= 3; ring += 1) {
      const priorMax = Math.max(...cellsInRing(ring - 1).map(cell => cell.cellId));
      const currentMin = Math.min(...cellsInRing(ring).map(cell => cell.cellId));
      assert(currentMin > priorMax, `ring ${ring} min ID ${currentMin} <= prior max ${priorMax}`);
    }
  }),
  check('lat/lon pairs are unique within 1e-6 deg', () => {
    const keys = layout.centers.map(cell => `${cell.latDeg.toFixed(6)},${cell.lonDeg.toFixed(6)}`);
    assert(new Set(keys).size === layout.centers.length, `unique rounded lat/lon pairs=${new Set(keys).size}`);
  }),
  check('minimum nearest-neighbor spacing is r_cell * sqrt(3) within 5%', () => {
    const actual = minNearestNeighborDistanceKm();
    const tolerance = expectedSpacingKm * 0.05;
    assertClose(actual, expectedSpacingKm, tolerance, 'minimum nearest-neighbor spacing');
  }),
  check('ring 1 cells are r_cell * sqrt(3) from cell 0', () => {
    for (const cell of cellsInRing(1)) {
      const actual = distanceKm(centerCell, cell);
      assertClose(actual, expectedSpacingKm, expectedSpacingKm * 0.05, `cell ${cell.cellId} center distance`);
    }
  }),
  check('localKmToLatLon origin preserves center', () => {
    const latLon = localKmToLatLon(40, 116, 0, 0);
    assertClose(latLon.latDeg, 40, TOLERANCE_DEG, 'origin lat');
    assertClose(latLon.lonDeg, 116, TOLERANCE_DEG, 'origin lon');
  }),
  check('localKmToLatLon 111.32 km east shifts longitude at 40N', () => {
    const latLon = localKmToLatLon(40, 116, 111.32, 0);
    assertClose(latLon.latDeg, 40, TOLERANCE_DEG, 'east shift lat');
    assertClose(latLon.lonDeg, 117.30540728933229, 1e-9, 'east shift lon');
  }),
  check('localKmToLatLon 111.32 km north shifts latitude by 1 deg', () => {
    const latLon = localKmToLatLon(40, 116, 0, 111.32);
    assertClose(latLon.latDeg, 41, TOLERANCE_DEG, 'north shift lat');
    assertClose(latLon.lonDeg, 116, TOLERANCE_DEG, 'north shift lon');
  }),
  check('direct-overhead satellite elevation is approximately pi/2', () => {
    const actual = elevationAngleRad(40, 116, 780, centerCell.latDeg, centerCell.lonDeg);
    assertClose(actual, Math.PI / 2, 1e-3, 'overhead elevation rad');
  }),
  check('30 deg west satellite is low but above horizon from cell 0', () => {
    const actual = elevationAngleRad(40, 116 - 30, 780, centerCell.latDeg, centerCell.lonDeg);
    assert(actual < Math.PI / 2, `elevation=${actual}`);
    assert(actual > 0, `elevation=${actual}`);
    assertClose(actual, 0.07820172049883949, 1e-9, '30 deg west elevation rad');
  }),
  check('visibility is true for cell 0 with direct-overhead satellite', () => {
    assert(
      isCellVisibleFromSatellite(40, 116, 780, centerCell),
      'direct-overhead satellite should be visible',
    );
  }),
  check('visibility is false for cell 0 with 60N satellite under 15 deg mask', () => {
    const actualElevationDeg = elevationDeg(60, 116, 780, centerCell.latDeg, centerCell.lonDeg);
    assert(actualElevationDeg < DEFAULT_MIN_ELEVATION_DEG, `elevationDeg=${actualElevationDeg}`);
    assert(
      !isCellVisibleFromSatellite(60, 116, 780, centerCell),
      '60N satellite should not pass 15 deg mask',
    );
  }),
  check('all 37 cells are visible when satellite is over service-area center', () => {
    const invisibleCells = layout.centers.filter(cell => (
      !isCellVisibleFromSatellite(40, 116, 780, cell)
    ));
    assert(invisibleCells.length === 0, `invisible cell IDs=${invisibleCells.map(cell => cell.cellId).join(', ')}`);
  }),
  check('cell radius equals altitude * tan(beamwidth / 2)', () => {
    const expected = canonicalConfig.altitudeKm * Math.tan(canonicalConfig.beamwidth3dBRad / 2);
    assertClose(layout.cellRadiusKm, expected, 1e-12, 'formula radius');
  }),
  check('cell 1 starts east of center and ring proceeds CCW', () => {
    const expectedAxial: readonly [number, number][] = [
      [1, 0],
      [0, 1],
      [-1, 1],
      [-1, 0],
      [0, -1],
      [1, -1],
    ];
    for (const [index, [q, r]] of expectedAxial.entries()) {
      const cellId = index + 1;
      const axial = axialByCellId.get(cellId);
      assert(axial?.q === q && axial.r === r, `cell ${cellId} axial=${JSON.stringify(axial)}, expected q=${q}, r=${r}`);
    }
  }),
  check('layout metadata preserves profile altitude and beamwidth', () => {
    assert(layout.altitudeKm === canonicalConfig.altitudeKm, `altitudeKm=${layout.altitudeKm}`);
    assert(layout.beamwidth3dBRad === canonicalConfig.beamwidth3dBRad, `beamwidth=${layout.beamwidth3dBRad}`);
  }),
  check('custom cellCount truncates deterministic ring order', () => {
    const firstSeven = buildCellLayout({ ...canonicalConfig, cellCount: 7 });
    assert(firstSeven.count === 7, `custom count=${firstSeven.count}`);
    assert(firstSeven.centers.length === 7, `custom centers=${firstSeven.centers.length}`);
    assert(
      JSON.stringify(firstSeven.centers) === JSON.stringify(layout.centers.slice(0, 7)),
      'first seven centers are not a stable truncation of canonical layout',
    );
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

if (passCount < 25) {
  failCount += 1;
  console.error(`FAIL ${String(results.length + 1).padStart(2, '0')}: minimum assertion count expected >=25, got ${passCount}`);
}

if (failCount > 0) {
  process.exitCode = 1;
} else {
  console.log(`validate-phase-i-s1-cell-layout: PASS (${passCount} assertions)`);
}
