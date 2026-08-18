#!/usr/bin/env node

import { resolveManualHandoverDemoEvent } from './manualHandoverDemo';
import type { IlluminatedCellBeam, SinrLiveCellFrame } from './sinrLiveCellModel';

const assert = {
  equal<TValue>(actual: TValue, expected: TValue, label: string): void {
    if (!Object.is(actual, expected)) {
      throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
    }
  },
};

let passed = 0;

function check(label: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}: ${label}`);
}

function beam(satId: string, cellId: number): IlluminatedCellBeam {
  return {
    satId,
    cellId,
    frequencyIndex: cellId % 3,
    serving: satId === 'sat-a',
  };
}

function frame(overrides: Partial<SinrLiveCellFrame> = {}): SinrLiveCellFrame {
  return {
    simTimeSec: 12,
    cells: [
      {
        cellId: 0,
        servingSatId: 'sat-a',
        beamIdentity: 'sat-a#cell0',
        frequencyIndex: 0,
        servingSinrDb: 18,
        candidateCount: 2,
      },
      {
        cellId: 1,
        servingSatId: 'sat-a',
        beamIdentity: 'sat-a#cell1',
        frequencyIndex: 1,
        servingSinrDb: 16,
        candidateCount: 1,
      },
      {
        cellId: 2,
        servingSatId: 'sat-b',
        beamIdentity: 'sat-b#cell2',
        frequencyIndex: 2,
        servingSinrDb: 14,
        candidateCount: 1,
      },
    ],
    ues: [
      {
        ueId: 'ue-0',
        cellId: 0,
        cellDistanceKm: 0,
        offAxisDeg: 0,
        servingSatId: 'sat-a',
        beamIdentity: 'sat-a#cell0',
        frequencyIndex: 0,
        sinrDb: 18,
        handoverKind: 'none',
        pendingTargetSatId: null,
        comparisonSatId: null,
        comparisonSinrDb: null,
      },
    ],
    illuminatedBeams: [],
    servedCellCount: 3,
    servedUeCount: 1,
    servingSatCount: 2,
    intraHandoverCount: 0,
    interHandoverCount: 0,
    cumulativeIntraHandoverCount: 0,
    cumulativeInterHandoverCount: 0,
    recentHandoverEvents: [],
    ...overrides,
  };
}

function primary(
  overrides: Partial<SinrLiveCellFrame['ues'][number]> = {},
): SinrLiveCellFrame['ues'][number] {
  return {
    ueId: 'ue-0',
    cellId: 0,
    cellDistanceKm: 0,
    offAxisDeg: 0,
    servingSatId: 'sat-a',
    beamIdentity: 'sat-a#cell0',
    frequencyIndex: 0,
    sinrDb: 18,
    handoverKind: 'none',
    pendingTargetSatId: null,
    comparisonSatId: null,
    comparisonSinrDb: null,
    ...overrides,
  };
}

check('inter prefers the model candidate over the first illuminated satellite', () => {
  const result = resolveManualHandoverDemoEvent(
    'inter',
    frame({
      ues: [primary({ pendingTargetSatId: 'sat-better', comparisonSatId: 'sat-better' })],
      illuminatedBeams: [beam('sat-far', 0), beam('sat-better', 0)],
    }),
    'ue-0',
    ['sat-a', 'sat-far', 'sat-better'],
  );

  assert.equal(result?.toSatId, 'sat-better', 'toSatId');
  assert.equal(result?.toCellId, 0, 'toCellId');
});

check('inter fails closed when no model-selected or illuminated target exists', () => {
  const result = resolveManualHandoverDemoEvent(
    'inter',
    frame({
      ues: [primary()],
      illuminatedBeams: [beam('sat-a', 1)],
    }),
    'ue-0',
    ['sat-a', 'sat-far'],
  );

  assert.equal(result, null, 'result');
});

check('intra stays on the source satellite and uses its illuminated beam', () => {
  const result = resolveManualHandoverDemoEvent(
    'intra',
    frame({
      illuminatedBeams: [beam('sat-a', 1), beam('sat-b', 2)],
    }),
    'ue-0',
    ['sat-a', 'sat-b'],
  );

  assert.equal(result?.fromSatId, 'sat-a', 'fromSatId');
  assert.equal(result?.toSatId, 'sat-a', 'toSatId');
  assert.equal(result?.toCellId, 1, 'toCellId');
});

console.log(`manualHandoverDemo.test: ${passed} checks passed`);
