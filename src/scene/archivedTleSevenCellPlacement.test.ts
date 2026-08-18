#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  ARCHIVED_TLE_CANONICAL_CELL_IDS,
  ARCHIVED_TLE_DISPLAY_AXIAL_COORDINATES,
  ARCHIVED_TLE_DISPLAY_CELL_IDS,
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
  'every canonical cell maps to the exact irregular axial target',
);
assert.equal(new Set(placement.cells.map(cell => cell.displayCellId)).size, 7);
assert.equal(new Set(placement.cells.map(cell => `${cell.q}:${cell.r}`)).size, 7);

const radialDistances = placement.cells.map(cell => Math.hypot(cell.q, cell.r, cell.q + cell.r));
assert.ok(new Set(radialDistances).size > 1, 'the selected positions are irregular, not one regular ring');

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
