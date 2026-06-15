import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Children, isValidElement, type ReactElement } from 'react';
import * as THREE from 'three';
import { satelliteTint } from '../src/constants/beamRoleTokens.ts';
import {
  CELL_SCHEDULE_VIZ_SLOT_SEC,
  DISPLAY_CELL_SCHEDULE_MAX_ACTIVE_CELLS_PER_SLOT,
  computeCellScheduleViz,
  type CellScheduleViz,
} from '../src/scene/useCellSchedule.ts';
import {
  CellBeamCones,
  computeConeApexFromTransform,
  computeConeBaseCenterFromTransform,
  resolveCellBeamConeRenderCount,
  resolveCellBeamConeItems,
  resolveCellBeamConeSatelliteCount,
} from '../src/viz/CellBeamCones.tsx';
import type { WorldPoint } from '../src/viz/CellFootprints.tsx';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEG_TO_RAD = Math.PI / 180;
const CENTER_LAT_DEG = 40;
const CENTER_LON_DEG = 116;
const ALTITUDE_KM = 780;
const BEAMWIDTH_3DB_RAD = 2 * DEG_TO_RAD;
const WORLD_UNITS_PER_KM = 2;
const SATELLITES = [
  { id: 'sat-0' },
  { id: 'sat-1' },
  { id: 'sat-2' },
  { id: 'sat-3' },
] as const;

type AnyElement = ReactElement<{
  name?: string;
  position?: readonly [number, number, number];
  quaternion?: THREE.Quaternion;
  userData?: Record<string, unknown>;
  children?: unknown;
  args?: readonly unknown[];
  color?: string;
  opacity?: number;
  transparent?: boolean;
  depthWrite?: boolean;
  toneMapped?: boolean;
  side?: THREE.Side;
}>;

const PASSED: string[] = [];

function pass(label: string): void {
  PASSED.push(label);
  console.log(`PASS ${String(PASSED.length).padStart(2, '0')}: ${label}`);
}

function expect(condition: boolean, label: string): void {
  assert.ok(condition, label);
  pass(label);
}

function expectEqual<T>(actual: T, expected: T, label: string): void {
  assert.deepEqual(actual, expected, label);
  pass(label);
}

function expectApprox(actual: number, expected: number, epsilon: number, label: string): void {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${label}: expected ${expected}, got ${actual}`,
  );
  pass(label);
}

function scheduleAt(slotIndex: number, satellites = SATELLITES): CellScheduleViz {
  return computeCellScheduleViz({
    simTimeSec: slotIndex * CELL_SCHEDULE_VIZ_SLOT_SEC,
    altitudeKm: ALTITUDE_KM,
    beamwidth3dBRad: BEAMWIDTH_3DB_RAD,
    centerLatDeg: CENTER_LAT_DEG,
    centerLonDeg: CENTER_LON_DEG,
    worldUnitsPerKm: WORLD_UNITS_PER_KM,
    satellites,
  });
}

function geoSchedule(servingCount: number): CellScheduleViz {
  return computeCellScheduleViz({
    simTimeSec: 0,
    altitudeKm: ALTITUDE_KM,
    beamwidth3dBRad: BEAMWIDTH_3DB_RAD,
    centerLatDeg: CENTER_LAT_DEG,
    centerLonDeg: CENTER_LON_DEG,
    worldUnitsPerKm: WORLD_UNITS_PER_KM,
    satellites: Array.from({ length: 12 }, (_, index) => ({
      id: `geo-sat-${index}`,
      latDeg: CENTER_LAT_DEG,
      lonDeg: CENTER_LON_DEG,
      altitudeKm: ALTITUDE_KM,
    })),
    servingCount,
  });
}

function satelliteWorldById(schedule: CellScheduleViz): ReadonlyMap<string, WorldPoint> {
  const satIds = [...new Set(schedule.slot.assignments.map(assignment => assignment.satId))];
  return new Map(satIds.map((satId, index) => [
    satId,
    {
      x: (index - 1.5) * 180,
      y: 620 - index * 18,
      z: (index % 2 === 0 ? -1 : 1) * (80 + index * 30),
    },
  ]));
}

function satelliteTintById(schedule: CellScheduleViz): ReadonlyMap<string, string> {
  const satIds = [...new Set(schedule.slot.assignments.map(assignment => assignment.satId))];
  return new Map(satIds.map((satId, index) => [satId, satelliteTint(satId, index)]));
}

function childrenOf(element: AnyElement): AnyElement[] {
  return Children
    .toArray(element.props.children)
    .filter(isValidElement)
    .map(child => child as AnyElement);
}

function coneElement(
  schedule: CellScheduleViz,
  worlds = satelliteWorldById(schedule),
  tints = satelliteTintById(schedule),
): AnyElement {
  const element = CellBeamCones({
    schedule,
    satelliteWorldById: worlds,
    satelliteTintById: tints,
  });
  assert.ok(element !== null, 'CellBeamCones returned null unexpectedly');
  return element as AnyElement;
}

function firstMesh(group: AnyElement): AnyElement {
  const mesh = childrenOf(group).find(child => child.type === 'mesh');
  assert.ok(mesh, `missing mesh in ${group.props.name ?? 'group'}`);
  return mesh;
}

function geometryChild(mesh: AnyElement): AnyElement {
  const geometry = childrenOf(mesh).find(child => child.type === 'coneGeometry');
  assert.ok(geometry, 'missing coneGeometry child');
  return geometry;
}

function materialChild(mesh: AnyElement): AnyElement {
  const material = childrenOf(mesh).find(child => child.type === 'meshBasicMaterial');
  assert.ok(material, 'missing meshBasicMaterial child');
  return material;
}

function roundedConeSnapshot(schedule: CellScheduleViz): readonly unknown[] {
  return resolveCellBeamConeItems({
    schedule,
    satelliteWorldById: satelliteWorldById(schedule),
    satelliteTintById: satelliteTintById(schedule),
  }).map(item => ({
    cellId: item.assignment.cellId,
    satId: item.assignment.satId,
    beamIndex: item.assignment.beamIndex,
    color: item.color,
    radius: round6(item.baseRadiusWorld),
    height: round6(item.heightWorld),
    midpoint: [round6(item.midpoint.x), round6(item.midpoint.y), round6(item.midpoint.z)],
    quaternion: [round6(item.quaternion.x), round6(item.quaternion.y), round6(item.quaternion.z), round6(item.quaternion.w)],
  }));
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

const slot0 = scheduleAt(0);
const worlds = satelliteWorldById(slot0);
const tints = satelliteTintById(slot0);
const placementByCellId = new Map(slot0.placements.map(placement => [placement.cellId, placement]));
const hidden = CellBeamCones({
  schedule: slot0,
  satelliteWorldById: worlds,
  satelliteTintById: tints,
  visible: false,
});

expectEqual(hidden, null, 'CellBeamCones returns null when visible is false');

const element = coneElement(slot0, worlds, tints);
expectEqual(element.props.name, 'cell-beam-cones', 'top group is named cell-beam-cones');
expectEqual(element.props.userData?.coneCount, 28, 'top group coneCount is 28 for canonical fixture');

const groups = childrenOf(element);
expectEqual(groups.length, slot0.slot.assignments.length, 'renders one cone group per active assignment');
expectEqual(
  resolveCellBeamConeRenderCount({ schedule: slot0, satelliteWorldById: worlds, satelliteTintById: tints }),
  groups.length,
  'render-count helper matches rendered cone group length for canonical fixture',
);
expect(
  groups.every((group, index) => group.props.name === `cell-beam-cone-${slot0.slot.assignments[index]?.cellId}`),
  'each cone group name is cell-beam-cone-${cellId}',
);
expect(
  groups.every((group, index) => {
    const assignment = slot0.slot.assignments[index];
    if (!assignment) return false;
    const placement = placementByCellId.get(assignment.cellId);
    return group.props.userData?.cellId === assignment.cellId
      && group.props.userData?.satId === assignment.satId
      && group.props.userData?.satVisualIndex === assignment.satVisualIndex
      && group.props.userData?.baseRadiusWorld === placement?.radiusWorld;
  }),
  'cone userData carries cellId, satId, satVisualIndex, and footprint baseRadiusWorld',
);

const firstGroup = groups[0] as AnyElement;
const firstAssignment = slot0.slot.assignments[0];
assert.ok(firstAssignment, 'missing first assignment');
const firstPlacement = placementByCellId.get(firstAssignment.cellId);
assert.ok(firstPlacement, 'missing first placement');
const firstMeshEl = firstMesh(firstGroup);
const firstGeometry = geometryChild(firstMeshEl);
const firstMaterial = materialChild(firstMeshEl);
const firstSat = worlds.get(firstAssignment.satId);
assert.ok(firstSat, 'missing first satellite world');
const firstMidpoint = new THREE.Vector3(...(firstMeshEl.props.position as [number, number, number]));
const firstQuaternion = firstMeshEl.props.quaternion;
assert.ok(firstQuaternion instanceof THREE.Quaternion, 'first mesh quaternion is THREE.Quaternion');
const expectedHeight = new THREE.Vector3(firstSat.x, firstSat.y, firstSat.z)
  .distanceTo(new THREE.Vector3(firstPlacement.worldX, 0, firstPlacement.worldZ));

expectEqual(firstGeometry.props.args?.[0], firstPlacement.radiusWorld, 'cone base radius equals placement.radiusWorld');
expectEqual(firstGeometry.props.args?.[4], true, 'cone geometry is open-ended side surface');
expectApprox(firstGeometry.props.args?.[1] as number, expectedHeight, 1e-9, 'cone height equals sat-to-cell distance');
expectApprox(Number(firstGroup.props.userData?.heightWorld), expectedHeight, 1e-9, 'group heightWorld matches sat-to-cell distance');
expectApprox(
  computeConeApexFromTransform(firstMidpoint, firstQuaternion, expectedHeight)
    .distanceTo(new THREE.Vector3(firstSat.x, firstSat.y, firstSat.z)),
  0,
  1e-9,
  'cone transform places apex at serving satellite world position',
);
expectApprox(
  computeConeBaseCenterFromTransform(firstMidpoint, firstQuaternion, expectedHeight)
    .distanceTo(new THREE.Vector3(firstPlacement.worldX, 0, firstPlacement.worldZ)),
  0,
  1e-9,
  'cone transform places base center on assigned cell ground position',
);
expectEqual(firstMaterial.props.color, tints.get(firstAssignment.satId), 'cone material tint comes from serving satellite tint');
expect(
  firstMaterial.props.transparent === true
    && Number(firstMaterial.props.opacity) >= 0.05
    && Number(firstMaterial.props.opacity) <= 0.28
    && firstMaterial.props.depthWrite === false
    && firstMaterial.props.side === THREE.DoubleSide
    && firstMaterial.props.toneMapped === false,
  'cone material is translucent, double-sided, depthWrite=false, toneMapped=false',
);

const missingSatId = slot0.slot.assignments[0]?.satId;
assert.ok(missingSatId, 'missing satellite id for skip test');
const reducedWorlds = new Map([...worlds.entries()].filter(([satId]) => satId !== missingSatId));
const reducedResolvedCount = slot0.slot.assignments.filter(assignment => reducedWorlds.has(assignment.satId)).length;
const reducedElement = coneElement(slot0, reducedWorlds, tints);
expectEqual(childrenOf(reducedElement).length, reducedResolvedCount, 'missing satellite world skips only its cones without throwing');
expectEqual(reducedElement.props.userData?.coneCount, reducedResolvedCount, 'coneCount reflects only resolvable assignments');
expectEqual(
  resolveCellBeamConeRenderCount({ schedule: slot0, satelliteWorldById: reducedWorlds, satelliteTintById: tints }),
  reducedResolvedCount,
  'render-count helper reflects reduced resolvable cones when satellite world is missing',
);
expectEqual(roundedConeSnapshot(slot0), roundedConeSnapshot(scheduleAt(0)), 'same schedule input produces deterministic cone transforms');

const activeCellIds = new Set(slot0.slot.assignments.map(assignment => assignment.cellId));
const renderedCellIds = new Set(groups.map(group => Number(group.props.userData?.cellId)));
expect(
  slot0.slot.idleCellIds.every(cellId => !renderedCellIds.has(cellId)),
  'idle cells have no beam cone',
);
expect(
  groups.every(group => activeCellIds.has(Number(group.props.userData?.cellId))),
  'each rendered cone belongs to an active cell',
);
expect(
  groups.every(group => worlds.has(String(group.props.userData?.satId))),
  'each cone satId is one of the serving satellites with world coordinates',
);
expect(
  new Set(groups.map(group => materialChild(firstMesh(group)).props.color)).size >= 4,
  'cones carry distinct serving satellite tints',
);
expect(
  resolveCellBeamConeItems({ schedule: slot0, satelliteWorldById: worlds, satelliteTintById: tints })
    .every(item => item.baseRadiusWorld === placementByCellId.get(item.assignment.cellId)?.radiusWorld),
  'all resolved cone radii are footprint-derived placement radii',
);

const focusedUe = {
  servingSatelliteId: firstAssignment.satId,
  servingBeamId: String(firstAssignment.beamIndex),
  targetSatelliteId: null,
  targetBeamId: null,
};
const focusedDemoItems = resolveCellBeamConeItems({
  schedule: slot0,
  satelliteWorldById: worlds,
  satelliteTintById: tints,
  focusedUe,
  appMode: 'modqn-demo',
});
const focusedDemoRenderCount = resolveCellBeamConeRenderCount({
  schedule: slot0,
  satelliteWorldById: worlds,
  satelliteTintById: tints,
  focusedUe,
  appMode: 'modqn-demo',
});
const allServingDemoRenderCount = resolveCellBeamConeRenderCount({
  schedule: slot0,
  satelliteWorldById: worlds,
  satelliteTintById: tints,
  focusedUe,
  beamConeScope: 'all-serving-satellites',
  appMode: 'modqn-demo',
});
expect(
  focusedDemoRenderCount > 0 && focusedDemoRenderCount < slot0.slot.assignments.length,
  'modqn-demo focus satellite render count is lower than schedule assignment count',
);
expectEqual(
  focusedDemoRenderCount,
  focusedDemoItems.length,
  'modqn-demo focus satellite render-count helper equals resolved cone items length',
);
expect(
  allServingDemoRenderCount > focusedDemoRenderCount,
  'all-serving-satellites scope renders more MODQN demo cones than focus scope',
);
expectEqual(
  resolveCellBeamConeSatelliteCount({
    schedule: slot0,
    satelliteWorldById: worlds,
    satelliteTintById: tints,
    focusedUe,
    beamConeScope: 'focus-satellite',
    appMode: 'modqn-demo',
  }),
  1,
  'focus-satellite scope renders one serving satellite',
);
expect(
  resolveCellBeamConeSatelliteCount({
    schedule: slot0,
    satelliteWorldById: worlds,
    satelliteTintById: tints,
    focusedUe,
    beamConeScope: 'all-serving-satellites',
    appMode: 'modqn-demo',
  }) > 1,
  'all-serving-satellites scope renders multiple serving satellites',
);

const lCapped = geoSchedule(8);
expectEqual(
  lCapped.slot.assignments.length,
  DISPLAY_CELL_SCHEDULE_MAX_ACTIVE_CELLS_PER_SLOT,
  'L-capped geo schedule uses display-only active-cell cap',
);
expectEqual(
  childrenOf(coneElement(lCapped, satelliteWorldById(lCapped), satelliteTintById(lCapped))).length,
  DISPLAY_CELL_SCHEDULE_MAX_ACTIVE_CELLS_PER_SLOT,
  'CellBeamCones renders display-capped cones for L-capped schedule',
);

const mainSceneSource = readFileSync(path.join(REPO_ROOT, 'src/scene/MainScene.tsx'), 'utf8');
const renderPlanSource = readFileSync(path.join(REPO_ROOT, 'src/scene/sceneLaneRenderPlan.ts'), 'utf8');
expect(
  mainSceneSource.includes('CellBeamCones,')
    && mainSceneSource.includes('resolveCellBeamConeRenderCount,')
    && mainSceneSource.includes('resolveCellBeamConeSatelliteCount,')
    && mainSceneSource.includes('{showCellOverlay && modqnVisualLayers.beamCones && (\n        <CellBeamCones')
    && mainSceneSource.includes('schedule={cellSchedule}')
    && mainSceneSource.includes('satelliteWorldById={satelliteWorldById}')
    && mainSceneSource.includes('satelliteTintById={satelliteTintById}')
    && mainSceneSource.includes('beamConeScope={modqnVisualLayers.beamConeScope}'),
  'MainScene mounts CellBeamCones gated on showCellOverlay and the MODQN beam-cone visual layer scope',
);
expect(
  mainSceneSource.includes('{showSinrLiveCellBeams && (')
    && mainSceneSource.includes('<SinrLiveCellBeamCones items={sinrLiveCellBeamConeItems} dimShallowCones />'),
  'MainScene mounts the sinr-live cell-truth beam cones (the legacy steered SatelliteBeams block was retired — Tier-2 dead twin)',
);
expect(
  renderPlanSource.includes('const showLiveBeamCones = showSinrBeamRender;'),
  'Scene lane render plan derives live beam cones from showSinrBeamRender (sinr-live OR the MODQN cell-overlay reuse), not the sinr-live viewport alone',
);
expect(
  mainSceneSource.includes('{showLiveSceneEffects && <AmbientFootprintRings'),
  'MainScene gates AmbientFootprintRings with live-scene effects',
);
expect(
  mainSceneSource.includes('{showGroundRipple && ('),
  'MainScene gates ServingGroundRipple behind showGroundRipple',
);
expect(
  renderPlanSource.includes('const showLiveSceneEffects = showSinrBeamRender;')
    && /showOrbitTrail:[\s\S]*?showLiveSceneEffects/.test(renderPlanSource),
  'Scene lane render plan gates OrbitTrail behind showLiveSceneEffects (= showSinrBeamRender: sinr-live OR the MODQN cell-overlay reuse)',
);
const telemetrySource = readFileSync(path.join(REPO_ROOT, 'src/scene/SceneTelemetry.tsx'), 'utf8');
expect(
  telemetrySource.includes('el.dataset.cellBeamConeCount = props.cellBeamConeCount;')
    && mainSceneSource.includes('cellBeamConeCount={showCellOverlay ? String(renderedCellBeamConeCount) : \'\'}')
    && mainSceneSource.includes('resolveCellBeamConeRenderCount({'),
  'MainScene and SceneTelemetry add cellBeamConeCount rendered-object dataset bridge',
);

assert.ok(PASSED.length >= 24, `expected >=24 assertions; got ${PASSED.length}`);
console.log(`validate-phase-i-s5b-cell-beam-cones: PASS (${PASSED.length}/0 assertions)`);
