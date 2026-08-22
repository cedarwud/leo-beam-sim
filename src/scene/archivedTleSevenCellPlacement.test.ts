#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  ARCHIVED_TLE_CANONICAL_CELL_IDS,
  ARCHIVED_TLE_DISPLAY_AXIAL_COORDINATES,
  ARCHIVED_TLE_DISPLAY_CELL_IDS,
  ARCHIVED_TLE_DISPLAY_RING_SPACING,
  ARCHIVED_TLE_FOOTPRINT_EXTENT_SCALE,
  ARCHIVED_TLE_GROUND_PADDING_KM,
  ARCHIVED_TLE_NTPU_GROUND_BOUNDS_KM,
  buildArchivedTleSevenCellPlacement,
  remapArchivedTleUePosition,
} from './archivedTleSevenCellPlacement';

const sourceRadiusKm = 20;
const canonicalCells = ARCHIVED_TLE_CANONICAL_CELL_IDS.map(index => {
  const q = [0, 2, 0, -1, -2, 0, 2][index]!;
  const r = [0, 0, 2, 2, 1, -2, -2][index]!;
  return {
    index,
    centerKm: [
      sourceRadiusKm * Math.sqrt(3) * (q + r / 2),
      sourceRadiusKm * 1.5 * r,
    ] as const,
  };
});

const placement = buildArchivedTleSevenCellPlacement({
  cells: canonicalCells,
  sourceCellRadiusKm: sourceRadiusKm,
});

assert.equal(placement.cells.length, 7);
assert.deepEqual(
  placement.cells.map(cell => cell.displayCellId),
  [...ARCHIVED_TLE_DISPLAY_CELL_IDS],
  'the archived centre uses the selected historical 37-cell IDs',
);
assert.deepEqual(
  placement.cells.map(cell => [cell.q, cell.r]),
  ARCHIVED_TLE_DISPLAY_AXIAL_COORDINATES.map(({ q, r }) => [q, r]),
  'every canonical cell maps to the exact compact axial target',
);
assert.equal(new Set(placement.cells.map(cell => cell.displayCellId)).size, 7);
assert.equal(new Set(placement.cells.map(cell => `${cell.q}:${cell.r}`)).size, 7);

const radialDistances = placement.cells.map(cell => Math.hypot(cell.q, cell.r, cell.q + cell.r));
assert.equal(radialDistances[0], 0, 'cell 0 is the compact cluster centre');
assert.ok(
  radialDistances.slice(1).every(distance => Math.abs(distance - Math.sqrt(2) * ARCHIVED_TLE_DISPLAY_RING_SPACING) < 1e-9),
  'the six surrounding cells form one regular ring',
);

// The classroom cut must read like the legacy-3d seven-cell cluster.  A 4%
// outer border is painted around each hex, so adjacent cell centres need a
// little more than the exact pointy-hex edge distance (sqrt(3) * radius), and
// the whole cluster must stay compact rather than spanning the old 37-cell
// substrate.
const displayRadiusKm = placement.cells[0]!.radiusKm;
for (let i = 0; i < placement.cells.length; i += 1) {
  for (let j = i + 1; j < placement.cells.length; j += 1) {
    const left = placement.cells[i]!;
    const right = placement.cells[j]!;
    const distanceKm = Math.hypot(
      left.centerKm[0] - right.centerKm[0],
      left.centerKm[1] - right.centerKm[1],
    );
    assert.ok(
      distanceKm >= Math.sqrt(3) * displayRadiusKm * ARCHIVED_TLE_FOOTPRINT_EXTENT_SCALE - 1e-9,
      `display hex borders must not overlap: ${left.canonicalCellId}↔${right.canonicalCellId}`,
    );
  }
}
const maxAbsCenterRatio = Math.max(
  ...placement.cells.flatMap(cell => [
    Math.abs(cell.centerKm[0]) / displayRadiusKm,
    Math.abs(cell.centerKm[1]) / displayRadiusKm,
  ]),
);
assert.ok(maxAbsCenterRatio <= 2.05, `display hex cluster must stay compact; got ${maxAbsCenterRatio}`);

for (const cell of placement.cells) {
  const halfWidth = ARCHIVED_TLE_NTPU_GROUND_BOUNDS_KM.widthKm / 2 - ARCHIVED_TLE_GROUND_PADDING_KM;
  const halfHeight = ARCHIVED_TLE_NTPU_GROUND_BOUNDS_KM.heightKm / 2 - ARCHIVED_TLE_GROUND_PADDING_KM;
  const extent = cell.radiusKm * 1.04;
  assert.ok(Math.abs(cell.centerKm[0]) + extent <= halfWidth + 1e-9, `cell ${cell.canonicalCellId} fits east bounds`);
  assert.ok(Math.abs(cell.centerKm[1]) + extent <= halfHeight + 1e-9, `cell ${cell.canonicalCellId} fits north bounds`);
}

const sourceCell = canonicalCells[3]!;
const sourceUser = {
  index: 0,
  cellIndex: sourceCell.index,
  positionKm: [sourceCell.centerKm[0] + 5, sourceCell.centerKm[1] - 4] as const,
};
const remappedUser = remapArchivedTleUePosition(placement, sourceUser);
const targetCell = placement.cellByCanonicalId.get(sourceCell.index)!;
assert.ok(Math.abs(remappedUser[0] - targetCell.centerKm[0]) > 0);
assert.ok(Math.abs(remappedUser[1] - targetCell.centerKm[1]) > 0);
assert.ok(
  Math.abs((remappedUser[0] - targetCell.centerKm[0]) - 5 * placement.fitScale) < 1e-9,
  'UE east offset is preserved with the common fit scale',
);
assert.ok(
  Math.abs((remappedUser[1] - targetCell.centerKm[1]) + 4 * placement.fitScale) < 1e-9,
  'UE north offset is preserved with the common fit scale',
);

console.log('archived TLE seven-cell placement tests passed');
