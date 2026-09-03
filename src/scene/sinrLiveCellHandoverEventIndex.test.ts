#!/usr/bin/env node
/**
 * D4 S3a model gate: cell-truth handover cinema events are sourced from
 * `sinrLiveCells` UE transitions, carry old/new cell/off-axis identities, and
 * fail closed when the transition does not match the claimed kind.
 *
 * Run via `npm run validate:phase-c:handover-cinema:model`.
 */
import {
  createSinrLiveCellHandoverEventFromUeTransition,
  resolveUeServingCellId,
} from './sinrLiveCellHandoverEventIndex';

let passed = 0;
function pass(label: string): void {
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}: ${label}`);
}
function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
  }
}
function assertNotNull<T>(value: T | null, label: string): T {
  if (value === null) throw new Error(`${label}: expected non-null, got null`);
  return value;
}
function assertNull(value: unknown, label: string): void {
  if (value !== null) throw new Error(`${label}: expected null, got ${JSON.stringify(value)}`);
}
function check(label: string, fn: () => void): void {
  fn();
  pass(label);
}

check('serving cell identity follows the serving beam, not geographic membership', () => {
  assertEqual(resolveUeServingCellId({ cellId: 2, servingBeamId: 8 }), 7, 'serving beam cell');
  assertEqual(resolveUeServingCellId({ cellId: 2, servingBeamId: null }), 2, 'membership fallback');
  assertEqual(resolveUeServingCellId({ cellId: null, servingBeamId: null }), null, 'unserved');
});

const previous = {
  ueId: 'live-ue-7',
  cellId: 4,
  geographicCellId: 4,
  servingSatId: 'SAT-A',
  servingBeamId: 5,
  beamIdentity: 'SAT-A#beam5',
  frequencyIndex: 1,
  sinrDb: -3.4,
  offAxisDeg: 1.1,
};
const current = {
  ueId: 'live-ue-7',
  cellId: 4,
  geographicCellId: 4,
  servingSatId: 'SAT-A',
  servingBeamId: 421,
  beamIdentity: 'SAT-A#beam421',
  frequencyIndex: 3,
  sinrDb: 0.6,
  offAxisDeg: 1.8,
};

check('intra event preserves same sat/cell, distinct beam ids, SINR delta, source time, and off-axis', () => {
  const event = assertNotNull(createSinrLiveCellHandoverEventFromUeTransition({
    previous,
    current,
    handoverKind: 'intra',
    sourceTimeSec: 42.1234567,
    offsetDb: 2,
    sequence: 3,
  }), 'event');
  assertEqual(event.kind, 'intra', 'kind');
  assertEqual(event.fromSatId, 'SAT-A', 'from sat');
  assertEqual(event.toSatId, 'SAT-A', 'to sat');
  assertEqual(event.fromCellId, 4, 'from cell');
  assertEqual(event.toCellId, 4, 'to cell');
  assertEqual(event.fromBeamId, 5, 'from beam id');
  assertEqual(event.toBeamId, 421, 'to beam id');
  assertEqual(event.fromBeamIdentity, 'SAT-A#beam5', 'from beam identity');
  assertEqual(event.toBeamIdentity, 'SAT-A#beam421', 'to beam identity');
  assertEqual(event.ueId, 'live-ue-7', 'ue id');
  assertEqual(event.fromOffAxisDeg, 1.1, 'from off-axis');
  assertEqual(event.toOffAxisDeg, 1.8, 'to off-axis');
  assertEqual(event.fromSinrDb, -3.4, 'from SINR');
  assertEqual(event.toSinrDb, 0.6, 'to SINR');
  assertEqual(event.deltaDb, 4, 'delta');
  assertEqual(event.sourceTimeSec, 42.123457, 'rounded source time');
  assertEqual(event.clickTargetSec, event.sourceTimeSec, 'click target is source time');
});

check('intra event keeps the geographic cell when the pre-commit serving beam still names another cell', () => {
  const event = assertNotNull(createSinrLiveCellHandoverEventFromUeTransition({
    previous: { ...previous, cellId: 0, geographicCellId: 4 },
    current: { ...current, cellId: 6, geographicCellId: 4 },
    handoverKind: 'intra',
    sourceTimeSec: 43,
    offsetDb: 2,
    sequence: 5,
  }), 'same geographic-cell event');
  assertEqual(event.fromCellId, 4, 'from geographic cell');
  assertEqual(event.toCellId, 4, 'to geographic cell');
  assertEqual(event.fromBeamId, 5, 'from serving beam');
  assertEqual(event.toBeamId, 421, 'to serving beam');
});

check('inter event requires a satellite change and can keep the same cell', () => {
  const event = assertNotNull(createSinrLiveCellHandoverEventFromUeTransition({
    previous,
    current: {
      ...previous,
      servingSatId: 'SAT-B',
      beamIdentity: 'SAT-B#cell4',
      sinrDb: -1.4,
    },
    handoverKind: 'inter',
    sourceTimeSec: 100,
    offsetDb: 2,
    sequence: 4,
  }), 'event');
  assertEqual(event.kind, 'inter', 'kind');
  assertEqual(event.fromSatId, 'SAT-A', 'from sat');
  assertEqual(event.toSatId, 'SAT-B', 'to sat');
  assertEqual(event.fromCellId, 4, 'from cell');
  assertEqual(event.toCellId, 4, 'to cell');
  assertEqual(event.deltaDb, 2, 'delta');
});

check('transition helper fails closed on mismatched kind, unknown kind, mismatched UE, and missing winner SINR', () => {
  assertNull(createSinrLiveCellHandoverEventFromUeTransition({
    previous,
    current: { ...current, servingSatId: 'SAT-B' },
    handoverKind: 'intra',
    sourceTimeSec: 1,
    offsetDb: 2,
    sequence: 0,
  }), 'intra with sat change');
  assertNull(createSinrLiveCellHandoverEventFromUeTransition({
    previous,
    current: { ...previous },
    handoverKind: 'intra',
    sourceTimeSec: 1,
    offsetDb: 2,
    sequence: 0,
  }), 'intra without beam change');
  assertNull(createSinrLiveCellHandoverEventFromUeTransition({
    previous,
    current: { ...current, cellId: 9, geographicCellId: 9 },
    handoverKind: 'intra',
    sourceTimeSec: 1,
    offsetDb: 2,
    sequence: 0,
  }), 'intra with geographic cell change');
  assertNull(createSinrLiveCellHandoverEventFromUeTransition({
    previous,
    current: previous,
    handoverKind: 'inter',
    sourceTimeSec: 1,
    offsetDb: 2,
    sequence: 0,
  }), 'inter without sat change');
  assertNull(createSinrLiveCellHandoverEventFromUeTransition({
    previous,
    current,
    handoverKind: 'attach',
    sourceTimeSec: 1,
    offsetDb: 2,
    sequence: 0,
  }), 'attach is not cinema handover');
  assertNull(createSinrLiveCellHandoverEventFromUeTransition({
    previous,
    current: { ...current, ueId: 'live-ue-8' },
    handoverKind: 'intra',
    sourceTimeSec: 1,
    offsetDb: 2,
    sequence: 0,
  }), 'mismatched UE');
  assertNull(createSinrLiveCellHandoverEventFromUeTransition({
    previous,
    current: { ...current, sinrDb: null },
    handoverKind: 'intra',
    sourceTimeSec: 1,
    offsetDb: 2,
    sequence: 0,
  }), 'missing winner SINR');
});

console.log(`\n${passed} checks passed.`);
