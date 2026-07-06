import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import {
  CELL_SCHEDULE_VIZ_SLOT_SEC,
  computeCellScheduleViz,
  type CellReassignment,
  type CellScheduleViz,
} from '../src/scene/useCellSchedule.ts';
import { satelliteTint } from '../src/constants/beamRoleTokens.ts';
import { CellOverlay as CellOverlayComponent } from '../src/viz/CellOverlay.tsx';
import {
  CellFootprintEllipse,
  computeFootprintEllipse,
  type WorldPoint,
} from '../src/viz/CellFootprints.tsx';
import {
  CellHandoverArcs,
  INTER_ARC_COLOR,
  INTRA_ARC_COLOR,
} from '../src/viz/CellHandoverArcs.tsx';

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
  userData?: Record<string, unknown>;
  children?: ReactNode;
  cellId?: number;
  satelliteWorld?: WorldPoint;
  color?: string;
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

function scheduleAt(slotIndex: number): CellScheduleViz {
  return computeCellScheduleViz({
    simTimeSec: slotIndex * CELL_SCHEDULE_VIZ_SLOT_SEC,
    altitudeKm: ALTITUDE_KM,
    beamwidth3dBRad: BEAMWIDTH_3DB_RAD,
    centerLatDeg: CENTER_LAT_DEG,
    centerLonDeg: CENTER_LON_DEG,
    worldUnitsPerKm: WORLD_UNITS_PER_KM,
    satellites: SATELLITES,
  });
}

function assignmentSnapshot(schedule: CellScheduleViz): readonly unknown[] {
  return schedule.slot.assignments.map(assignment => ({
    cellId: assignment.cellId,
    satId: assignment.satId,
    beamIndex: assignment.beamIndex,
  }));
}

function mapSnapshot(map: ReadonlyMap<number, unknown>): readonly [number, unknown][] {
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

function activeCellIds(schedule: CellScheduleViz): Set<number> {
  return new Set(schedule.slot.assignments.map(assignment => assignment.cellId));
}

function reassignmentCellIds(reassignments: readonly CellReassignment[]): Set<number> {
  return new Set(reassignments.map(reassignment => reassignment.cellId));
}

function satelliteWorldById(): ReadonlyMap<string, WorldPoint> {
  return new Map([
    ['sat-0', { x: 0, y: 640, z: 0 }],
    ['sat-1', { x: 220, y: 610, z: -70 }],
    ['sat-2', { x: -210, y: 600, z: 110 }],
    ['sat-3', { x: 130, y: 580, z: 210 }],
  ]);
}

function tintById(): ReadonlyMap<string, string> {
  return new Map(SATELLITES.map((satellite, index) => [
    satellite.id,
    satelliteTint(satellite.id, index),
  ]));
}

function childrenOf(element: AnyElement): AnyElement[] {
  return Children
    .toArray(element.props.children)
    .filter(isValidElement)
    .map(child => child as AnyElement);
}

function cellChildren(schedule: CellScheduleViz): AnyElement[] {
  const element = CellOverlayComponent({
    schedule,
    satelliteTintById: tintById(),
    satelliteWorldById: satelliteWorldById(),
  });
  assert.ok(element !== null, 'CellOverlay returned null unexpectedly');
  return childrenOf(element as AnyElement);
}

function footprintElements(cellGroups: readonly AnyElement[]): AnyElement[] {
  return cellGroups.flatMap(cellGroup => (
    childrenOf(cellGroup).filter(child => child.type === CellFootprintEllipse)
  ));
}

function resolvedFootprintLine(footprintElement: AnyElement): AnyElement {
  return CellFootprintEllipse(footprintElement.props as Parameters<typeof CellFootprintEllipse>[0]) as AnyElement;
}

function arcElement(reassignments: readonly CellReassignment[]): AnyElement {
  const element = CellHandoverArcs({
    reassignments,
    satelliteWorldById: satelliteWorldById(),
  });
  assert.ok(element !== null, 'CellHandoverArcs returned null unexpectedly');
  return element as AnyElement;
}

const slot0 = scheduleAt(0);
const slot1 = scheduleAt(1);
const duplicateSlot1 = scheduleAt(1);
const currentActive = activeCellIds(slot1);
const previousActive = activeCellIds(slot0);
const reassignCellIds = reassignmentCellIds(slot1.cellReassignments);
const idleToActive = [...currentActive].filter(cellId => !previousActive.has(cellId));
const activeToIdle = [...previousActive].filter(cellId => !currentActive.has(cellId));

expectEqual(slot0.cellReassignments.length, 0, 'slotIndex 0 has zero cellReassignments');
expectEqual(assignmentSnapshot(slot0), assignmentSnapshot({ ...slot0, slot: slot0.previousSlot }), 'slotIndex 0 previousSlot equals current slot');
expectEqual(slot1.previousSlot.slotIndex, 0, 'slotIndex 1 previousSlot.slotIndex is 0');
expect(
  slot1.cellReassignments.every(reassignment => currentActive.has(reassignment.cellId) && previousActive.has(reassignment.cellId)),
  'cellReassignments only include cells active in both previous and current slots',
);
expect(
  idleToActive.length > 0 && idleToActive.every(cellId => !reassignCellIds.has(cellId)),
  'idle-to-active cells are not counted as handovers',
);
expect(
  activeToIdle.length > 0 && activeToIdle.every(cellId => !reassignCellIds.has(cellId)),
  'active-to-idle cells are not counted as handovers',
);
expect(
  slot1.cellReassignments.some(reassignment => reassignment.kind === 'inter')
    && slot1.cellReassignments.filter(reassignment => reassignment.kind === 'inter').every(reassignment => reassignment.fromSatId !== reassignment.toSatId),
  'inter reassignments change serving satellite',
);
expect(
  slot1.cellReassignments.some(reassignment => reassignment.kind === 'intra')
    && slot1.cellReassignments.filter(reassignment => reassignment.kind === 'intra').every(reassignment => (
      reassignment.fromSatId === reassignment.toSatId
      && reassignment.fromBeamIndex !== reassignment.toBeamIndex
    )),
  'intra reassignments keep satellite and switch beam index',
);
expect(
  slot1.cellReassignments.every(reassignment => {
    const placement = slot1.placements.find(candidate => candidate.cellId === reassignment.cellId);
    return placement !== undefined
      && Number.isFinite(reassignment.worldX)
      && Number.isFinite(reassignment.worldZ)
      && reassignment.worldX === placement.worldX
      && reassignment.worldZ === placement.worldZ;
  }),
  'each reassignment has finite worldX/worldZ matching its placement',
);
expectEqual(
  slot1.cellReassignments.map(reassignment => reassignment.cellId),
  [...slot1.cellReassignments].map(reassignment => reassignment.cellId).sort((a, b) => a - b),
  'cellReassignments are sorted ascending by cellId',
);
expectEqual(slot1.cellReassignments, duplicateSlot1.cellReassignments, 'reassignment delta is deterministic for same input');
expect(
  Array.from({ length: 10 }, (_, index) => scheduleAt(index + 1).cellReassignments.length)
    .some(count => count > 0),
  'slots 1..10 include at least one reassignment',
);
expect(
  slot1.cellReassignments.every(reassignment => reassignment.kind === 'intra' || reassignment.kind === 'inter'),
  'reassignment kind is always intra or inter',
);
expectEqual(
  mapSnapshot(slot1.previousAssignmentByCellId),
  mapSnapshot(slot0.assignmentByCellId),
  'previousAssignmentByCellId mirrors the slot-(N-1) assignment map',
);

const radiusWorld = 10;
const overhead = computeFootprintEllipse({ x: 0, y: 100, z: 0 }, { x: 0, z: 0 }, radiusWorld);
expect(
  Math.abs(overhead.longAxis - overhead.shortAxis) <= overhead.shortAxis * 0.05,
  'overhead footprint is circular within 5 percent',
);
const oblique30 = computeFootprintEllipse({ x: Math.sqrt(3) * 100, y: 100, z: 0 }, { x: 0, z: 0 }, radiusWorld);
expectApprox(oblique30.longAxis, radiusWorld * 2, radiusWorld * 0.05, '30 degree footprint long axis is approximately 2x short axis');
expectEqual(oblique30.shortAxis, radiusWorld, 'footprint shortAxis equals radiusWorld exactly');
expect(
  [15, 20, 30, 45, 60, 89].every(elevationDeg => {
    const y = 100;
    const horizontal = y / Math.tan(elevationDeg * DEG_TO_RAD);
    const ellipse = computeFootprintEllipse({ x: horizontal, y, z: 0 }, { x: 0, z: 0 }, radiusWorld);
    return ellipse.longAxis >= ellipse.shortAxis;
  }),
  'footprint longAxis is never shorter than shortAxis for tested elevations',
);
const lowElevation = computeFootprintEllipse({ x: 1000, y: 20, z: 0 }, { x: 0, z: 0 }, radiusWorld);
expect(
  lowElevation.longAxis <= radiusWorld / Math.sin(15 * DEG_TO_RAD) + 1e-9,
  'footprint longAxis is clamped below 15 degree elevation',
);
const azimuthEllipse = computeFootprintEllipse({ x: 3, y: 4, z: 5 }, { x: 1, z: 2 }, radiusWorld);
expectApprox(azimuthEllipse.longAxisAzimuth, Math.atan2(3, 2), 1e-12, 'footprint azimuth points toward satellite ground projection');
const fallback = computeFootprintEllipse(undefined, { x: 0, z: 0 }, radiusWorld);
expectEqual(fallback.longAxis, fallback.shortAxis, 'missing satellite world falls back to circular footprint');

const cells = cellChildren(slot0);
const footprints = footprintElements(cells);
expectEqual(footprints.length, 28, 'CellOverlay renders one footprint element per active cell');
expect(
  cells
    .filter(cell => cell.props.userData?.active === false)
    .every(cell => footprintElements([cell]).length === 0),
  'idle cells have no footprint ellipse',
);
const firstFootprintLine = resolvedFootprintLine(footprints[0] as AnyElement);
expect(
  firstFootprintLine.props.name === `footprint-${footprints[0]?.props.cellId}`
    && Number.isFinite(firstFootprintLine.props.userData?.longAxis)
    && Number.isFinite(firstFootprintLine.props.userData?.shortAxis)
    && Number.isFinite(firstFootprintLine.props.userData?.longAxisAzimuth),
  'footprint userData carries longAxis, shortAxis, and azimuth',
);
expectEqual(
  CellHandoverArcs({
    reassignments: slot1.cellReassignments,
    satelliteWorldById: satelliteWorldById(),
    visible: false,
  }),
  null,
  'CellHandoverArcs returns null when visible is false',
);
const arcs = arcElement(slot1.cellReassignments);
expectEqual(arcs.props.name, 'cell-handover-arcs', 'CellHandoverArcs top group is named cell-handover-arcs');
const arcGroups = childrenOf(arcs).filter(child => (
  child.type === 'group' && typeof child.props.name === 'string' && child.props.name.startsWith('cell-ho-arc-')
));
expectEqual(arcGroups.length, slot1.cellReassignments.length, 'CellHandoverArcs renders one arc group per reassignment');
expect(
  arcGroups.some(group => group.props.userData?.kind === 'inter' && group.props.userData?.color === INTER_ARC_COLOR)
    && arcGroups.some(group => group.props.userData?.kind === 'intra' && group.props.userData?.color === INTRA_ARC_COLOR),
  'inter arcs carry purple token and intra arcs carry teal token',
);
expectEqual(
  Number(arcs.props.userData?.interCount) + Number(arcs.props.userData?.intraCount),
  slot1.cellReassignments.length,
  'CellHandoverArcs userData interCount plus intraCount equals total reassignment count',
);
expect(
  arcGroups.every(group => typeof group.props.userData?.label === 'string' && String(group.props.userData.label).includes(' -> ')),
  'CellHandoverArcs carries source-to-target identity labels',
);
expect(
  arcs.props.userData?.source === 'profile-derived-demo'
    && arcs.props.userData?.claimBoundary === 'profile-derived overlay'
    && arcs.props.userData?.proofStatus === 'non-proof',
  'CellHandoverArcs root labels profile-derived non-proof claim boundary',
);

const mainSceneSource = readFileSync(path.join(REPO_ROOT, 'src/scene/MainScene.tsx'), 'utf8');
const sceneLaneRenderPlanSource = readFileSync(path.join(REPO_ROOT, 'src/scene/sceneLaneRenderPlan.ts'), 'utf8');
const telemetrySource = readFileSync(path.join(REPO_ROOT, 'src/scene/SceneTelemetry.tsx'), 'utf8');
const cellHandoverArcsSource = readFileSync(path.join(REPO_ROOT, 'src/viz/CellHandoverArcs.tsx'), 'utf8');
expect(
  cellHandoverArcsSource.includes("import { Line, Text }")
    && cellHandoverArcsSource.includes('buildIdentityLabel')
    && cellHandoverArcsSource.includes("ARC_PROOF_STATUS = 'non-proof'"),
  'CellHandoverArcs renders identity labels with non-proof overlay metadata',
);
expect(
  sceneLaneRenderPlanSource.includes("const showCellOverlay = input.sceneLane === 'modqn-live-cell-preview' && isLiveScene")
    && mainSceneSource.includes('{showCellOverlay && (\n        <CellHandoverArcs')
    && telemetrySource.includes('dataset.cellHoReassignmentCount')
    && telemetrySource.includes('dataset.cellHoInterCount')
    && telemetrySource.includes('dataset.cellHoIntraCount')
    && mainSceneSource.includes('cellHoReassignmentCount=')
    && mainSceneSource.includes('cellHoInterCount=')
    && mainSceneSource.includes('cellHoIntraCount='),
  'MainScene gates CellHandoverArcs to the live MODQN cell lane and exposes cellHo dataset fields via SceneTelemetry',
);

assert.ok(PASSED.length >= 30, `expected >=30 assertions; got ${PASSED.length}`);
console.log(`validate-phase-i-s5a-footprint-handover: PASS (${PASSED.length}/0 assertions)`);
