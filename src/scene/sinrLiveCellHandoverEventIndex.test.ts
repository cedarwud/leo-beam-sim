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

const previous = {
  ueId: 'live-ue-7',
  cellId: 4,
  servingSatId: 'SAT-A',
  beamIdentity: 'SAT-A#cell4',
  frequencyIndex: 1,
  sinrDb: -3.4,
  offAxisDeg: 1.1,
};
const current = {
  ueId: 'live-ue-7',
  cellId: 9,
  servingSatId: 'SAT-A',
  beamIdentity: 'SAT-A#cell9',
  frequencyIndex: 3,
  sinrDb: 0.6,
  offAxisDeg: 1.8,
};

check('intra event preserves same sat, old/new cells, SINR delta, source time, and off-axis', () => {
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
  assertEqual(event.toCellId, 9, 'to cell');
  assertEqual(event.fromBeamId, 4, 'from beam id is cell id');
  assertEqual(event.toBeamId, 9, 'to beam id is cell id');
  assertEqual(event.ueId, 'live-ue-7', 'ue id');
  assertEqual(event.fromOffAxisDeg, 1.1, 'from off-axis');
  assertEqual(event.toOffAxisDeg, 1.8, 'to off-axis');
  assertEqual(event.fromSinrDb, -3.4, 'from SINR');
  assertEqual(event.toSinrDb, 0.6, 'to SINR');
  assertEqual(event.deltaDb, 4, 'delta');
  assertEqual(event.sourceTimeSec, 42.123457, 'rounded source time');
  assertEqual(event.clickTargetSec, event.sourceTimeSec, 'click target is source time');
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
