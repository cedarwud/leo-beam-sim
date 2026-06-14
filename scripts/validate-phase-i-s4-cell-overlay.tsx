import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Children, isValidElement, type ReactElement } from 'react';
import {
  CELL_SCHEDULE_VIZ_SLOT_SEC,
  computeCellScheduleViz,
  type CellScheduleViz,
} from '../src/scene/useCellSchedule.ts';
import { SATELLITE_TINT_PALETTE, satelliteTint } from '../src/constants/beamRoleTokens.ts';
import { CellOverlay as CellOverlayComponent } from '../src/viz/CellOverlay.tsx';

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

type GroupElement = ReactElement<{
  name?: string;
  userData?: Record<string, unknown>;
  children?: unknown;
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

function scheduleAt(simTimeSec: number, satellites = SATELLITES): CellScheduleViz {
  return computeCellScheduleViz({
    simTimeSec,
    altitudeKm: ALTITUDE_KM,
    beamwidth3dBRad: BEAMWIDTH_3DB_RAD,
    centerLatDeg: CENTER_LAT_DEG,
    centerLonDeg: CENTER_LON_DEG,
    worldUnitsPerKm: WORLD_UNITS_PER_KM,
    satellites,
  });
}

function activeSet(schedule: CellScheduleViz): readonly number[] {
  return [...schedule.assignmentByCellId.keys()].sort((a, b) => a - b);
}

function placementSnapshot(schedule: CellScheduleViz): readonly unknown[] {
  return schedule.placements.map(placement => ({
    cellId: placement.cellId,
    worldX: round6(placement.worldX),
    worldZ: round6(placement.worldZ),
    radiusWorld: round6(placement.radiusWorld),
  }));
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function overlayElement(schedule: CellScheduleViz): GroupElement {
  const satelliteTintById = new Map(SATELLITES.map((satellite, index) => [
    satellite.id,
    satelliteTint(satellite.id, index),
  ]));
  const element = CellOverlayComponent({ schedule, satelliteTintById });
  assert.ok(element !== null, 'CellOverlay returned null unexpectedly');
  return element as GroupElement;
}

function overlayChildren(element: GroupElement): GroupElement[] {
  return Children
    .toArray(element.props.children)
    .filter(isValidElement)
    .map(child => child as GroupElement);
}

const slot0 = scheduleAt(0);
const slot1 = scheduleAt(CELL_SCHEDULE_VIZ_SLOT_SEC);
const slot2 = scheduleAt(CELL_SCHEDULE_VIZ_SLOT_SEC * 2 + 0.49);
const duplicateSlot0 = scheduleAt(0);
const tintById = new Map(SATELLITES.map((satellite, index) => [
  satellite.id,
  satelliteTint(satellite.id, index),
]));

expectEqual(slot0.slotIndex, 0, 'simTime 0 resolves to slotIndex 0');
expectEqual(slot1.slotIndex, 1, 'slotIndex increments at simTime = slotSec');
expectEqual(slot2.slotIndex, 2, 'slotIndex uses floor(simTime / slotSec)');
expectEqual(scheduleAt(12.49).slotIndex, 4, 'slotIndex floors a late in-slot sample');
expectEqual(scheduleAt(-5).slotIndex, 0, 'negative sim time clamps to slotIndex 0');
expectEqual(slot0.layout.count, 37, 'layout.count is 37');
expectEqual(slot0.placements.length, 37, 'placements length is 37');
expectEqual(slot0.assignmentByCellId.size, 28, 'slot 0 active count is 28 under 4-sat synthetic fixture');
expectEqual(slot0.slot.idleCellIds.length, 9, 'slot 0 idle count is 9');
expectEqual(
  slot0.assignmentByCellId.size + slot0.slot.idleCellIds.length,
  37,
  'active plus idle cells equal layout count',
);

for (const placement of slot0.placements) {
  assert.ok(Number.isFinite(placement.worldX), `cell ${placement.cellId} worldX finite`);
  assert.ok(Number.isFinite(placement.worldZ), `cell ${placement.cellId} worldZ finite`);
  assert.ok(Number.isFinite(placement.radiusWorld), `cell ${placement.cellId} radiusWorld finite`);
}
pass('each placement has finite worldX, worldZ, and radiusWorld');

const centerPlacement = slot0.placements.find(placement => placement.cellId === 0);
assert.ok(centerPlacement, 'missing center cell placement');
expectApprox(centerPlacement.worldX, 0, 1e-9, 'cell 0 worldX is at service center');
expectApprox(centerPlacement.worldZ, 0, 1e-9, 'cell 0 worldZ is at service center');
expectApprox(
  centerPlacement.radiusWorld,
  slot0.layout.cellRadiusKm * WORLD_UNITS_PER_KM,
  1e-6,
  'radiusWorld equals cellRadiusKm * worldUnitsPerKm',
);

const eastPlacement = slot0.placements.find(placement => placement.center.localXKm > 0);
assert.ok(eastPlacement, 'missing east-side placement');
expect(eastPlacement.worldX > 0, 'positive localXKm east maps to positive worldX');

const northPlacement = slot0.placements.find(placement => placement.center.localYKm > 0);
assert.ok(northPlacement, 'missing north-side placement');
expect(northPlacement.worldZ < 0, 'positive localYKm north maps to negative worldZ');

expect(
  [...slot0.assignmentByCellId.keys()].every(cellId => !slot0.slot.idleCellIds.includes(cellId)),
  'assignmentByCellId contains active cells only',
);
expect(
  slot0.slot.assignments.every(assignment => SATELLITES.some(satellite => satellite.id === assignment.satId)),
  'every assignment satId comes from display satellite ids',
);
expectEqual(placementSnapshot(slot0), placementSnapshot(duplicateSlot0), 'placements are deterministic for same input');
expectEqual(activeSet(slot0), activeSet(duplicateSlot0), 'active set is deterministic for same input');
expect(
  JSON.stringify(activeSet(slot0)) !== JSON.stringify(activeSet(slot1)),
  'slot 0 active cell set differs from slot 1',
);

const union10 = new Set<number>();
for (let slotIndex = 0; slotIndex < 10; slotIndex += 1) {
  for (const cellId of activeSet(scheduleAt(slotIndex * CELL_SCHEDULE_VIZ_SLOT_SEC))) {
    union10.add(cellId);
  }
}
expectEqual([...union10].sort((a, b) => a - b), slot0.layout.centers.map(cell => cell.cellId), 'slots 0..9 touch all 37 cells');

const zeroSatSchedule = scheduleAt(0, []);
expectEqual(zeroSatSchedule.assignmentByCellId.size, 0, 'zero satellites returns activeCount 0 without throwing');
expectEqual(zeroSatSchedule.slot.idleCellIds.length, 37, 'zero satellites keeps all cells idle');
expect(scheduleAt(0, [{ id: 'sat-only' }]).assignmentByCellId.size <= 7, 'one satellite is capped at 7 active beams');
// S2: tint is satId-stable (was displayOrder%len, which made any 4 sats
// trivially 4-distinct). Assert the construction-independent invariants: the
// palette is 4-distinct and every satellite tint is a palette colour.
expectEqual(new Set(SATELLITE_TINT_PALETTE).size, 4, 'satellite tint palette has four distinct colors');
expect(
  SATELLITES.every(satellite => (SATELLITE_TINT_PALETTE as readonly string[]).includes(satelliteTint(satellite.id))),
  'every satellite tint is a palette color',
);

const hiddenOverlay = CellOverlayComponent({ schedule: slot0, satelliteTintById: tintById, visible: false });
expectEqual(hiddenOverlay, null, 'CellOverlay returns null when visible is false');

const element = overlayElement(slot0);
expectEqual(element.props.name, 'cell-overlay', 'CellOverlay top group is named cell-overlay');
expectEqual(element.props.userData?.slotIndex, slot0.slotIndex, 'CellOverlay userData slotIndex matches schedule');
expectEqual(element.props.userData?.activeCount, 28, 'CellOverlay userData activeCount is 28');
expectEqual(element.props.userData?.idleCount, 9, 'CellOverlay userData idleCount is 9');

const children = overlayChildren(element);
expectEqual(children.length, 37, 'CellOverlay renders 37 direct cell children');
expect(
  children.every(child => typeof child.props.name === 'string' && child.props.name.startsWith('cell-')),
  'every rendered cell child has a stable cell-* name',
);

const activeChildren = children.filter(child => child.props.userData?.active === true);
const idleChildren = children.filter(child => child.props.userData?.active === false);
expectEqual(activeChildren.length, 28, 'rendered tree has 28 active cell groups');
expectEqual(idleChildren.length, 9, 'rendered tree has 9 idle cell groups');
expect(
  activeChildren.every(child => tintById.get(String(child.props.userData?.satId)) === child.props.userData?.lineColor),
  'active rendered cells carry serving satellite tint',
);
expect(
  idleChildren.every(child => child.props.userData?.lineColor === '#6b7280' && child.props.userData?.lineOpacity === 0.25),
  'idle rendered cells carry muted gray style',
);

const mainSceneSource = readFileSync(path.join(REPO_ROOT, 'src/scene/MainScene.tsx'), 'utf8');
const renderPlanSource = readFileSync(path.join(REPO_ROOT, 'src/scene/sceneLaneRenderPlan.ts'), 'utf8');
expect(
  mainSceneSource.includes('resolveSceneLaneRenderPlan({')
    && renderPlanSource.includes("input.sceneLane === 'modqn-live-cell-preview' && isLiveScene"),
  'Scene lane render plan gates CellOverlay to modqn-live-cell-preview live-sim only',
);
expect(
  // S-cells-4d (commit f2a7bab) RETIRED the legacy 20-hex green-disc ground
  // paint entirely: `showEarthFixedCells` is now hard-coded `false` on every
  // lane instead of `showLiveSceneEffects`. This is strictly stronger than the
  // original gate ("hidden outside live scene effects") — the legacy layer is
  // now hidden EVERYWHERE, which trivially includes every non-live lane. Same
  // governance property (legacy EarthFixedCells never leaks onto a non-live
  // lane), pinned at its current form.
  renderPlanSource.includes('showEarthFixedCells: false'),
  'Scene lane render plan hides legacy EarthFixedCells outside live scene effects',
);
const telemetrySource = readFileSync(path.join(REPO_ROOT, 'src/scene/SceneTelemetry.tsx'), 'utf8');
expect(
  telemetrySource.includes('dataset.cellOverlaySlotIndex')
    && telemetrySource.includes('dataset.cellOverlayActiveCount')
    && telemetrySource.includes('dataset.cellOverlayIdleCount')
    && telemetrySource.includes('dataset.cellOverlayCellCount'),
  'SceneTelemetry exposes cell overlay dataset bridge fields',
);
expect(
  mainSceneSource.includes('cellOverlaySlotIndex=')
    && mainSceneSource.includes('cellOverlayActiveCount=')
    && mainSceneSource.includes('cellOverlayIdleCount=')
    && mainSceneSource.includes('cellOverlayCellCount='),
  'MainScene passes cell overlay props to SceneTelemetry',
);

assert.ok(PASSED.length >= 25, `expected >=25 assertions; got ${PASSED.length}`);
console.log(`validate-phase-i-s4-cell-overlay: PASS (${PASSED.length}/0 assertions)`);
