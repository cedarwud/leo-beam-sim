import {
  buildCellLayout,
  elevationAngleRad,
} from '../src/engine/cells/cellLayout.ts';
import {
  DEFAULT_BEAMS_PER_SATELLITE,
  computeScheduleHorizon,
  computeSlotSchedule,
  maxActivePerSlot,
} from '../src/engine/cells/cellScheduler.ts';
import type {
  CellAssignment,
  CellScheduleSlot,
  SatellitePose,
  SchedulerConfig,
} from '../src/engine/cells/cellScheduler.ts';

interface ValidationResult {
  readonly passed: boolean;
  readonly name: string;
  readonly details?: string;
}

const DEG_TO_RAD = Math.PI / 180;
const MIN_ELEVATION_DEG = 15;
const CANONICAL_CENTER_LAT_DEG = 40;
const CANONICAL_CENTER_LON_DEG = 116;
const CANONICAL_ALTITUDE_KM = 780;
const CANONICAL_BEAMWIDTH_3DB_DEG = 2;
const EXPECTED_LAYOUT_COUNT = 37;
const EXPECTED_ACTIVE_PER_SLOT = 28;

const layout = buildCellLayout({
  centerLatDeg: CANONICAL_CENTER_LAT_DEG,
  centerLonDeg: CANONICAL_CENTER_LON_DEG,
  altitudeKm: CANONICAL_ALTITUDE_KM,
  beamwidth3dBRad: CANONICAL_BEAMWIDTH_3DB_DEG * DEG_TO_RAD,
});

const canonicalSatellites: readonly SatellitePose[] = [
  satellite('sat-0', 0, 40, 116),
  satellite('sat-1', 1, 40.1, 116),
  satellite('sat-2', 2, 40, 116.1),
  satellite('sat-3', 3, 40.1, 116.1),
];

const canonicalConfig: SchedulerConfig = {
  layout,
  satellites: canonicalSatellites,
  beamsPerSatellite: DEFAULT_BEAMS_PER_SATELLITE,
  minElevationDeg: MIN_ELEVATION_DEG,
};

const slot0 = computeSlotSchedule(canonicalConfig, 0);
const slot1 = computeSlotSchedule(canonicalConfig, 1);
const horizon10 = computeScheduleHorizon(canonicalConfig, 0, 10);

function satellite(satId: string, visualIndex: number, latDeg: number, lonDeg: number): SatellitePose {
  return {
    satId,
    visualIndex,
    latDeg,
    lonDeg,
    altitudeKm: CANONICAL_ALTITUDE_KM,
  };
}

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

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  assert(Object.is(actual, expected), `${label}: expected ${String(expected)}, got ${String(actual)}`);
}

function assertDeepEqual(actual: unknown, expected: unknown, label: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(actualJson === expectedJson, `${label}: expected ${expectedJson}, got ${actualJson}`);
}

function assertSortedNumbers(values: readonly number[], label: string): void {
  const sorted = [...values].sort((a, b) => a - b);
  assertDeepEqual(values, sorted, label);
}

function assertSortedAssignments(assignments: readonly CellAssignment[]): void {
  const sorted = [...assignments].sort(compareAssignments);
  assertDeepEqual(assignments, sorted, 'assignments sorted by satVisualIndex then beamIndex');
}

function compareAssignments(a: CellAssignment, b: CellAssignment): number {
  return (a.satVisualIndex - b.satVisualIndex)
    || (a.beamIndex - b.beamIndex)
    || (a.cellId - b.cellId)
    || a.satId.localeCompare(b.satId);
}

function assertUnique(values: readonly string[] | readonly number[], label: string): void {
  assert(new Set<string | number>(values).size === values.length, `${label}: ${values.join(', ')}`);
}

function assignmentCellIds(slot: CellScheduleSlot): readonly number[] {
  return slot.assignments.map(assignment => assignment.cellId).sort((a, b) => a - b);
}

function expectedRotatedCellIds(slotIndex: number): readonly number[] {
  const start = (slotIndex * EXPECTED_ACTIVE_PER_SLOT) % layout.count;
  return Array.from(
    { length: EXPECTED_ACTIVE_PER_SLOT },
    (_, offset) => layout.centers[(start + offset) % layout.count]?.cellId,
  ).filter((cellId): cellId is number => cellId !== undefined).sort((a, b) => a - b);
}

function expectedRotationStart(slotIndex: number): number {
  return (slotIndex * EXPECTED_ACTIVE_PER_SLOT) % layout.count;
}

function assertAssignedCellsMatchRotation(slot: CellScheduleSlot): void {
  assertDeepEqual(
    assignmentCellIds(slot),
    expectedRotatedCellIds(slot.slotIndex),
    `slot ${slot.slotIndex} assignment cell set`,
  );
}

function countBy<T extends string | number>(values: readonly T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function assignmentKey(assignment: CellAssignment): string {
  return `${assignment.satId}:${assignment.beamIndex}`;
}

function assertAllAssignmentsRespectElevation(slot: CellScheduleSlot, config: SchedulerConfig): void {
  for (const assignment of slot.assignments) {
    const satellitePose = config.satellites.find(candidate => candidate.satId === assignment.satId);
    const cell = config.layout.centers.find(candidate => candidate.cellId === assignment.cellId);
    assert(satellitePose !== undefined, `missing satellite ${assignment.satId}`);
    assert(cell !== undefined, `missing cell ${assignment.cellId}`);
    const elevationDeg = elevationAngleRad(
      satellitePose.latDeg,
      satellitePose.lonDeg,
      satellitePose.altitudeKm,
      cell.latDeg,
      cell.lonDeg,
    ) / DEG_TO_RAD;
    assert(
      elevationDeg > (config.minElevationDeg ?? MIN_ELEVATION_DEG),
      `${assignment.satId}/B${assignment.beamIndex} assigned cell ${assignment.cellId} at ${elevationDeg} deg`,
    );
  }
}

function configWithSatellites(satellites: readonly SatellitePose[], overrides: Partial<SchedulerConfig> = {}): SchedulerConfig {
  return {
    ...canonicalConfig,
    satellites,
    ...overrides,
  };
}

function assertNoDuplicateAssignments(slot: CellScheduleSlot): void {
  assertUnique(slot.assignments.map(assignment => assignment.cellId), 'duplicate assigned cellId');
  assertUnique(slot.assignments.map(assignmentKey), 'duplicate sat/beam pair');
}

function assertPerSatCapacity(slot: CellScheduleSlot, beamsPerSatellite: number): void {
  const counts = countBy(slot.assignments.map(assignment => assignment.satId));
  for (const [satId, count] of counts.entries()) {
    assert(count <= beamsPerSatellite, `${satId} has ${count} assignments; capacity=${beamsPerSatellite}`);
  }
}

function assertEveryCanonicalSatHasSevenAssignments(slot: CellScheduleSlot): void {
  const counts = countBy(slot.assignments.map(assignment => assignment.satId));
  for (const sat of canonicalSatellites) {
    assertEqual(counts.get(sat.satId) ?? 0, DEFAULT_BEAMS_PER_SATELLITE, `${sat.satId} assignment count`);
  }
}

function assertEveryBeamIndexUsedFourTimes(slot: CellScheduleSlot): void {
  const counts = countBy(slot.assignments.map(assignment => assignment.beamIndex));
  for (let beamIndex = 0; beamIndex < DEFAULT_BEAMS_PER_SATELLITE; beamIndex += 1) {
    assertEqual(counts.get(beamIndex) ?? 0, canonicalSatellites.length, `beamIndex ${beamIndex} usage`);
  }
}

function allCellIds(): readonly number[] {
  return layout.centers.map(cell => cell.cellId);
}

function unionAssignedCells(slots: readonly CellScheduleSlot[]): Set<number> {
  return new Set(slots.flatMap(slot => slot.assignments.map(assignment => assignment.cellId)));
}

function visualIndexBySatId(config: SchedulerConfig): Map<string, number> {
  return new Map(config.satellites.map(sat => [sat.satId, sat.visualIndex]));
}

const results: ValidationResult[] = [
  check('maxActivePerSlot is 28 for 4 satellites x 7 beams over 37 cells', () => {
    assertEqual(maxActivePerSlot(canonicalConfig), EXPECTED_ACTIVE_PER_SLOT, 'K');
  }),
  check('slot 0 returns 28 assignments under all-visible fixture', () => {
    assertEqual(slot0.assignments.length, EXPECTED_ACTIVE_PER_SLOT, 'slot0 assignment count');
  }),
  check('slot 0 returns 9 idle cell IDs', () => {
    assertEqual(slot0.idleCellIds.length, 9, 'slot0 idle count');
  }),
  check('slot 0 assignments are sorted by satellite visual index then beam index', () => {
    assertSortedAssignments(slot0.assignments);
  }),
  check('slot 0 idle cell IDs are sorted ascending', () => {
    assertSortedNumbers(slot0.idleCellIds, 'slot0 idle cell IDs');
  }),
  check('slot 0 has no duplicate assigned cell IDs', () => {
    assertUnique(slot0.assignments.map(assignment => assignment.cellId), 'slot0 assigned cells');
  }),
  check('slot 0 has no duplicate satellite-beam pairs', () => {
    assertUnique(slot0.assignments.map(assignmentKey), 'slot0 sat/beam pairs');
  }),
  check('each assigned cell maps to one satellite-beam pair', () => {
    assertNoDuplicateAssignments(slot0);
  }),
  check('each satellite has exactly 7 assignments under all-visible fixture', () => {
    assertEveryCanonicalSatHasSevenAssignments(slot0);
  }),
  check('each beamIndex 0..6 is used exactly 4 times in slot 0', () => {
    assertEveryBeamIndexUsedFourTimes(slot0);
  }),
  check('slot 0 assigned cells total equals layout.count minus idle count', () => {
    assertEqual(slot0.assignments.length, layout.count - slot0.idleCellIds.length, 'assigned vs idle total');
  }),
  check('slot 0 chooses cells 0..27', () => {
    assertDeepEqual(assignmentCellIds(slot0), Array.from({ length: 28 }, (_, index) => index), 'slot0 chosen cells');
  }),
  check('slot 1 chooses cells 28..36 plus 0..18', () => {
    assertDeepEqual(slot1.assignments.map(assignment => assignment.cellId).sort((a, b) => a - b), [
      ...Array.from({ length: 19 }, (_, index) => index),
      ...Array.from({ length: 9 }, (_, index) => index + 28),
    ], 'slot1 chosen cells');
  }),
  check('slot N rotation start offset follows (N * 28) mod 37', () => {
    for (const slotIndex of [0, 1, 2, 3, 10, 27, 36, 100]) {
      const slot = computeSlotSchedule(canonicalConfig, slotIndex);
      assertAssignedCellsMatchRotation(slot);
      assert(
        slot.assignments.some(assignment => assignment.cellId === expectedRotationStart(slotIndex)),
        `slot ${slotIndex} does not include start offset ${expectedRotationStart(slotIndex)}`,
      );
    }
  }),
  check('slot 0 compute is deterministic across consecutive calls', () => {
    assertDeepEqual(computeSlotSchedule(canonicalConfig, 0), computeSlotSchedule(canonicalConfig, 0), 'slot0 repeat');
  }),
  check('horizon 0..9 compute is deterministic across consecutive calls', () => {
    assertDeepEqual(computeScheduleHorizon(canonicalConfig, 0, 10), computeScheduleHorizon(canonicalConfig, 0, 10), 'horizon repeat');
  }),
  check('horizon of 10 slots serves every cell at least once', () => {
    const served = unionAssignedCells(horizon10);
    assertDeepEqual([...served].sort((a, b) => a - b), allCellIds(), 'served cell IDs over horizon10');
  }),
  check('no slot in horizon of 10 exceeds K assignments', () => {
    for (const slot of horizon10) {
      assert(slot.assignments.length <= EXPECTED_ACTIVE_PER_SLOT, `slot ${slot.slotIndex} count=${slot.assignments.length}`);
    }
  }),
  check('scheduler skips a satellite below the elevation mask', () => {
    const degraded = computeSlotSchedule(configWithSatellites([
      satellite('sat-0', 0, 60, 116),
      satellite('sat-1', 1, 40.1, 116),
      satellite('sat-2', 2, 40, 116.1),
      satellite('sat-3', 3, 40.1, 116.1),
    ]), 0);
    assert(degraded.assignments.length < EXPECTED_ACTIVE_PER_SLOT, `assignment count=${degraded.assignments.length}`);
    assert(degraded.assignments.every(assignment => assignment.satId !== 'sat-0'), 'invisible sat-0 received assignments');
    assert(degraded.idleCellIds.length > slot0.idleCellIds.length, `idle count=${degraded.idleCellIds.length}`);
  }),
  check('with only one visible satellite, assignments are capped at seven beams', () => {
    const oneVisible = computeSlotSchedule(configWithSatellites([
      satellite('sat-0', 0, 40, 116),
      satellite('sat-1', 1, 60, 116),
      satellite('sat-2', 2, 60, 116),
      satellite('sat-3', 3, 60, 116),
    ]), 0);
    assert(oneVisible.assignments.length <= DEFAULT_BEAMS_PER_SATELLITE, `assignment count=${oneVisible.assignments.length}`);
    assert(oneVisible.assignments.every(assignment => assignment.satId === 'sat-0'), 'non-visible satellite received assignment');
  }),
  check('visibility-degraded idle count equals 37 minus assignments', () => {
    const oneVisible = computeSlotSchedule(configWithSatellites([
      satellite('sat-0', 0, 40, 116),
      satellite('sat-1', 1, 60, 116),
      satellite('sat-2', 2, 60, 116),
      satellite('sat-3', 3, 60, 116),
    ]), 0);
    assertEqual(oneVisible.idleCellIds.length, layout.count - oneVisible.assignments.length, 'degraded idle count');
  }),
  check('satVisualIndex is preserved from input satellite poses', () => {
    const visualById = visualIndexBySatId(canonicalConfig);
    for (const assignment of slot0.assignments) {
      assertEqual(assignment.satVisualIndex, visualById.get(assignment.satId), `${assignment.satId} visual index`);
    }
  }),
  check('computeScheduleHorizon(0, 5) returns five slots', () => {
    assertEqual(computeScheduleHorizon(canonicalConfig, 0, 5).length, 5, 'horizon length');
  }),
  check('computeScheduleHorizon(0, 5) slotIndex values are 0..4', () => {
    const horizon = computeScheduleHorizon(canonicalConfig, 0, 5);
    for (let index = 0; index < 5; index += 1) {
      assertEqual(horizon[index]?.slotIndex, index, `horizon slot ${index}`);
    }
  }),
  check('computeScheduleHorizon(3, 1)[0] equals computeSlotSchedule(3)', () => {
    assertDeepEqual(computeScheduleHorizon(canonicalConfig, 3, 1)[0], computeSlotSchedule(canonicalConfig, 3), 'slot 3 equivalence');
  }),
  check('higher-elevation satellite is preferred when both satellites can see the cell', () => {
    const preferenceConfig = configWithSatellites([
      satellite('sat-low', 0, 40.5, 116.5),
      satellite('sat-high', 1, 40, 116),
    ], {
      beamsPerSatellite: 1,
      maxActivePerSlot: 1,
    });
    const preferenceSlot = computeSlotSchedule(preferenceConfig, 0);
    assertEqual(preferenceSlot.assignments[0]?.cellId, 0, 'preference slot cellId');
    assertEqual(preferenceSlot.assignments[0]?.satId, 'sat-high', 'preferred satellite');
  }),
  check('no satellite exceeds beamsPerSatellite capacity', () => {
    assertPerSatCapacity(slot0, DEFAULT_BEAMS_PER_SATELLITE);
  }),
  check('every assignment respects the configured elevation mask', () => {
    assertAllAssignmentsRespectElevation(slot0, canonicalConfig);
  }),
  check('slotIndex 0, 1, and 100 compute without crash and slot 100 returns 28 assignments', () => {
    assertEqual(computeSlotSchedule(canonicalConfig, 0).assignments.length, EXPECTED_ACTIVE_PER_SLOT, 'slot 0');
    assertEqual(computeSlotSchedule(canonicalConfig, 1).assignments.length, EXPECTED_ACTIVE_PER_SLOT, 'slot 1');
    assertEqual(computeSlotSchedule(canonicalConfig, 100).assignments.length, EXPECTED_ACTIVE_PER_SLOT, 'slot 100');
  }),
  check('slot 0 assignments plus idle cells equal layout count', () => {
    assertEqual(slot0.assignments.length + slot0.idleCellIds.length, layout.count, 'slot0 count invariant');
  }),
  check('layout count remains the canonical 37', () => {
    assertEqual(layout.count, EXPECTED_LAYOUT_COUNT, 'layout.count');
  }),
  check('maxActivePerSlot override is bounded by layout count and capacity', () => {
    assertEqual(maxActivePerSlot({ ...canonicalConfig, maxActivePerSlot: 99 }), EXPECTED_ACTIVE_PER_SLOT, 'oversized override');
    assertEqual(maxActivePerSlot({ ...canonicalConfig, maxActivePerSlot: 5 }), 5, 'small override');
  }),
  check('satellite input order does not affect deterministic schedule output', () => {
    const shuffled = configWithSatellites([canonicalSatellites[2]!, canonicalSatellites[0]!, canonicalSatellites[3]!, canonicalSatellites[1]!]);
    assertDeepEqual(computeSlotSchedule(shuffled, 2), computeSlotSchedule(canonicalConfig, 2), 'shuffled satellite order');
  }),
  check('idle cell set is the complement of assigned cell set', () => {
    const assigned = new Set(slot0.assignments.map(assignment => assignment.cellId));
    for (const cellId of allCellIds()) {
      const isIdle = slot0.idleCellIds.includes(cellId);
      assert(isIdle !== assigned.has(cellId), `cell ${cellId} isIdle=${isIdle} assigned=${assigned.has(cellId)}`);
    }
  }),
  check('all canonical cells are visible from all canonical satellites', () => {
    for (const sat of canonicalSatellites) {
      for (const cell of layout.centers) {
        const elevationDeg = elevationAngleRad(sat.latDeg, sat.lonDeg, sat.altitudeKm, cell.latDeg, cell.lonDeg) / DEG_TO_RAD;
        assert(elevationDeg > MIN_ELEVATION_DEG, `${sat.satId} cell ${cell.cellId} elevation=${elevationDeg}`);
      }
    }
  }),
  check('slot 0 uses beam indices only in 0..6', () => {
    for (const assignment of slot0.assignments) {
      assert(assignment.beamIndex >= 0 && assignment.beamIndex < DEFAULT_BEAMS_PER_SATELLITE, `beamIndex=${assignment.beamIndex}`);
    }
  }),
  check('slot 0 idle cells are 28..36 under all-visible fixture', () => {
    assertDeepEqual(slot0.idleCellIds, Array.from({ length: 9 }, (_, index) => index + 28), 'slot0 idle cells');
  }),
];

for (const [index, result] of results.entries()) {
  const number = String(index + 1).padStart(2, '0');
  if (result.passed) {
    console.log(`PASS ${number}: ${result.name}`);
  } else {
    console.log(`FAIL ${number}: ${result.name} ${result.details ?? ''}`.trim());
  }
}

const passCount = results.filter(result => result.passed).length;
const failCount = results.length - passCount;
console.log(`Summary: ${passCount} PASS, ${failCount} FAIL`);

if (failCount > 0) {
  process.exitCode = 1;
}
