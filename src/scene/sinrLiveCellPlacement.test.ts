import assert from 'node:assert/strict';
import test from 'node:test';

import { loadProfile } from '../profiles';
import {
  ARCHIVED_TLE_CANONICAL_CELL_IDS,
  buildArchivedTleSevenCellPlacement,
} from './archivedTleSevenCellPlacement';
import { buildSinrLiveCellLayout } from './sinrLiveCellRuntime';
import { resolveSinrLiveCellPlacementById } from './sinrLiveCellPlacement';

const profile = loadProfile('hobs-2024-candidate-rich');

test('returns an empty map when earth-fixed cell truth is disabled', () => {
  const placements = resolveSinrLiveCellPlacementById({
    enabled: false,
    hasCanonicalScenario: false,
    profile,
    servingBeamCount: 7,
    worldUnitsPerKm: 0.5,
  });

  assert.equal(placements.size, 0);
});

test('projects the live layout into the same east-to-world coordinate convention', () => {
  const worldUnitsPerKm = 0.5;
  const placements = resolveSinrLiveCellPlacementById({
    enabled: true,
    hasCanonicalScenario: false,
    profile,
    servingBeamCount: 7,
    worldUnitsPerKm,
  });
  const layout = buildSinrLiveCellLayout(profile, 7).centers[0]!;
  const rendered = placements.get(layout.cellId);

  assert.ok(rendered);
  assert.equal(rendered.worldUnitsPerKm, worldUnitsPerKm);
  assert.equal(rendered.worldX, layout.localXKm * worldUnitsPerKm);
  assert.equal(rendered.worldZ, -layout.localYKm * worldUnitsPerKm);
  assert.ok(rendered.radiusWorld > 0);
  assert.equal(placements.size, 7);
});

test('uses archived display placement when the canonical scenario is present', () => {
  const archivedPlacement = buildArchivedTleSevenCellPlacement({
    cells: ARCHIVED_TLE_CANONICAL_CELL_IDS.map(index => ({
      index,
      centerKm: [index * 2, -index] as const,
    })),
    sourceCellRadiusKm: 20,
  });
  const worldUnitsPerKm = 0.25;
  const placements = resolveSinrLiveCellPlacementById({
    enabled: true,
    hasCanonicalScenario: true,
    archivedTlePlacement: archivedPlacement,
    profile,
    servingBeamCount: 19,
    worldUnitsPerKm,
  });

  const archivedCell = archivedPlacement.cells[3]!;
  const renderedCell = placements.get(archivedCell.canonicalCellId);
  assert.ok(renderedCell);
  assert.equal(renderedCell.worldX, archivedCell.centerKm[0] * worldUnitsPerKm);
  assert.equal(renderedCell.worldZ, -archivedCell.centerKm[1] * worldUnitsPerKm);
  assert.equal(renderedCell.radiusWorld, archivedCell.radiusKm * worldUnitsPerKm);
  assert.equal(placements.size, archivedPlacement.cells.length);
});
