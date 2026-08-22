import assert from 'node:assert/strict';

import { generateUePositions } from '../engine/ue/multiUeState';
import { loadProfile } from '../profiles';
import {
  applyLegacyConstellationPreset,
  applySceneTopology,
  createSceneTopologyState,
} from '../sceneTopology';
import {
  assignUeToNearestCell,
  resolveBeamWindowSlotIndex,
} from './sinrLiveCellModel';
import {
  buildSinrLiveCellLayout,
  SINR_LIVE_BEAM_DISPLAY_CELL_COUNT,
  SINR_LIVE_SEVEN_CELL_AXIAL_COORDINATES,
  resolveSinrLiveBeamCapacityPerSat,
  resolveSinrLiveBeamsPerSat,
  SINR_LIVE_CELL_COUNT,
} from './sinrLiveCellRuntime';
import { SINR_LIVE_FOOTPRINT_RING_OUTER_FACTOR } from '../constants/sinrLiveConeStyle';

const starlink = loadProfile('hobs-2024-candidate-rich');
const oneweb = applyLegacyConstellationPreset(starlink, 'oneweb');
const satelliteCount = (profile: typeof starlink) => profile.orbit.shells.reduce(
  (sum, shell) => sum + shell.planes * shell.satsPerPlane,
  0,
);

assert(oneweb.orbit.shells.every(shell => shell.altitudeKm > 550));
assert(satelliteCount(oneweb) < satelliteCount(starlink));
assert.equal(applyLegacyConstellationPreset(starlink, 'starlink'), starlink);

const layout = buildSinrLiveCellLayout(starlink);
assert.equal(layout.centers.length, 7);
assert.equal(SINR_LIVE_CELL_COUNT, 7);

const liveCellRadiusKm = layout.cellRadiusKm;
for (let i = 0; i < layout.centers.length; i += 1) {
  for (let j = i + 1; j < layout.centers.length; j += 1) {
    const left = layout.centers[i]!;
    const right = layout.centers[j]!;
    const distanceKm = Math.hypot(left.localXKm - right.localXKm, left.localYKm - right.localYKm);
    assert.ok(
      distanceKm >= Math.sqrt(3) * liveCellRadiusKm * SINR_LIVE_FOOTPRINT_RING_OUTER_FACTOR - 1e-9,
      `live seven-cell footprint borders must not overlap: ${left.cellId}↔${right.cellId}`,
    );
  }
}
const maxLiveCellRadius = Math.max(...layout.centers.flatMap(center => [
  Math.abs(center.localXKm) / liveCellRadiusKm,
  Math.abs(center.localYKm) / liveCellRadiusKm,
]));
assert.ok(maxLiveCellRadius < 2.2, `live seven-cell cluster must stay compact; got ${maxLiveCellRadius}`);
assert.equal(SINR_LIVE_SEVEN_CELL_AXIAL_COORDINATES.length, 7);
const positions = generateUePositions({
  ueCount: 100,
  primaryEastKm: 0,
  primaryNorthKm: 0,
  primaryFootprintRadiusKm: layout.cellRadiusKm,
  ueWorldScale: 1,
  seed: 7,
  mode: 'seven-cell-asymmetric',
  primaryAnchorMode: 'observer',
  cellCentersKm: layout.centers.map(center => ({
    eastKm: center.localXKm,
    northKm: center.localYKm,
  })),
  cellRadiusKm: layout.cellRadiusKm,
});
assert.equal(positions.length, 100);

const countByCell = new Map<number, number>();
for (const position of positions) {
  const membership = assignUeToNearestCell(position, layout);
  assert.notEqual(membership.cellId, null);
  assert(membership.distanceKm < layout.cellRadiusKm * 0.75);
  countByCell.set(membership.cellId!, (countByCell.get(membership.cellId!) ?? 0) + 1);
}
assert.deepEqual(
  layout.centers.map(center => countByCell.get(center.cellId) ?? 0),
  [18, 16, 15, 14, 13, 12, 12],
  '100 UEs use a deterministic asymmetric seven-cell population',
);

const oneCellLayout = buildSinrLiveCellLayout(starlink, 1);
const oneCellPositions = generateUePositions({
  ueCount: 100,
  primaryEastKm: 0,
  primaryNorthKm: 0,
  primaryFootprintRadiusKm: oneCellLayout.cellRadiusKm,
  ueWorldScale: 1,
  seed: 7,
  mode: 'seven-cell-asymmetric',
  primaryAnchorMode: 'observer',
  cellCentersKm: oneCellLayout.centers.map(center => ({
    eastKm: center.localXKm,
    northKm: center.localYKm,
  })),
  cellRadiusKm: oneCellLayout.cellRadiusKm,
});
assert.equal(new Set(oneCellPositions.map(position => assignUeToNearestCell(position, oneCellLayout).cellId)).size, 1);

const nineteenCellLayout = buildSinrLiveCellLayout(starlink, 19);
const nineteenCellPositions = generateUePositions({
  ueCount: 100,
  primaryEastKm: 0,
  primaryNorthKm: 0,
  primaryFootprintRadiusKm: nineteenCellLayout.cellRadiusKm,
  ueWorldScale: 1,
  seed: 7,
  mode: 'seven-cell-asymmetric',
  primaryAnchorMode: 'observer',
  cellCentersKm: nineteenCellLayout.centers.map(center => ({
    eastKm: center.localXKm,
    northKm: center.localYKm,
  })),
  cellRadiusKm: nineteenCellLayout.cellRadiusKm,
});
assert.equal(
  new Set(nineteenCellPositions.map(position => assignUeToNearestCell(position, nineteenCellLayout).cellId)).size,
  19,
  '100 UEs cover every scene cell in the 19-cell layout',
);

const displayLayout = buildSinrLiveCellLayout(starlink, SINR_LIVE_BEAM_DISPLAY_CELL_COUNT);
assert.equal(displayLayout.centers.length, 19);
assert.deepEqual(
  displayLayout.centers.map(center => center.cellId),
  Array.from({ length: 19 }, (_, index) => index),
  '19-beam display keeps stable 0..18 cell IDs',
);
assert.deepEqual(
  displayLayout.centers.slice(0, 7).map(center => [
    center.localXKm.toFixed(6),
    center.localYKm.toFixed(6),
  ]),
  layout.centers.map(center => [center.localXKm.toFixed(6), center.localYKm.toFixed(6)]),
  '19-beam display reuses the same seven active cell centres as UE/SINR truth',
);
const activeRadii = new Set(
  layout.centers.map(center => Math.hypot(center.localXKm, center.localYKm).toFixed(3)),
);
assert(activeRadii.size >= 3, 'the phase offset keeps the observer off the regular-ring centre');
const displayRadii = new Set(
  displayLayout.centers.map(center => Math.hypot(center.localXKm, center.localYKm).toFixed(3)),
);
assert(displayRadii.size >= 8, '19-beam display cells use an irregular footprint');
const displayEastExtentKm = Math.max(...displayLayout.centers.map(center => center.localXKm))
  - Math.min(...displayLayout.centers.map(center => center.localXKm));
assert(
  displayEastExtentKm > layout.cellRadiusKm * 9,
  '19-beam display footprint is wider than the compact radius-two disk',
);

const nineteenBeamProfile = applySceneTopology(starlink, {
  ...createSceneTopologyState(),
  beamCountPerSatellite: 19,
});
assert.equal(
  resolveSinrLiveBeamsPerSat(nineteenBeamProfile),
  7,
  'seven target cells cap simultaneous active beams while retaining the 19-beam capacity selection',
);
assert.equal(resolveSinrLiveBeamCapacityPerSat(nineteenBeamProfile), 19);
const servingMasterProfile = applySceneTopology(starlink, {
  ...createSceneTopologyState(),
  servingBeamCount: 19,
});
assert.equal(
  resolveSinrLiveBeamCapacityPerSat(servingMasterProfile),
  19,
  'serving-satellite scene count is also the profile beam fallback',
);
assert.equal(resolveBeamWindowSlotIndex(false, 25, 2.5), 0);
assert.equal(resolveBeamWindowSlotIndex(true, 25, 2.5), 10);

console.log('legacy scene configuration drives seven-cell UEs, constellation, and beam scheduling');
