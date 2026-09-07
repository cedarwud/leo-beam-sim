import assert from 'node:assert/strict';
import test from 'node:test';

import type { SinrLiveCinemaHandoverCandidate } from '../viz/SinrLiveCellBeamCones';
import type { SinrLiveCellFrame } from './sinrLiveCellModel';
import {
  resolveCandidateDisplayCellFrame,
  resolveCinemaInterDisplayCellFrame,
} from './sceneDisplayCellFrames';

function frame(overrides: Partial<SinrLiveCellFrame> = {}): SinrLiveCellFrame {
  return {
    simTimeSec: 12,
    cells: [
      {
        cellId: 0,
        servingSatId: 'sat-serving',
        beamIdentity: 'sat-serving#cell0',
        frequencyIndex: 0,
        servingSinrDb: 18,
        candidateCount: 1,
      },
      {
        cellId: 1,
        servingSatId: 'sat-serving',
        beamIdentity: 'sat-serving#cell1',
        frequencyIndex: 1,
        servingSinrDb: 16,
        candidateCount: 1,
      },
    ],
    ues: [],
    illuminatedBeams: [
      { satId: 'sat-serving', cellId: 0, frequencyIndex: 0, serving: true },
    ],
    servedCellCount: 2,
    servedUeCount: 0,
    servingSatCount: 1,
    intraHandoverCount: 0,
    interHandoverCount: 0,
    cumulativeIntraHandoverCount: 0,
    cumulativeInterHandoverCount: 0,
    recentHandoverEvents: [],
    ...overrides,
  };
}

function candidate(kind: 'intra' | 'inter' = 'inter'): SinrLiveCinemaHandoverCandidate {
  return {
    eventId: 'event-1',
    ueId: 'ue-0',
    kind,
    sourceTimeSec: 12,
    fromSatId: 'sat-source',
    fromCellId: 0,
    toSatId: 'sat-target',
    toCellId: 0,
  };
}

test('keeps the live candidate frame unchanged', () => {
  const source = frame();

  assert.strictEqual(
    resolveCandidateDisplayCellFrame({
      source,
      sceneSource: 'live',
      candidateSatelliteId: 'sat-target',
    }),
    source,
  );
});

test('projects one non-serving beam per cell for an archived candidate satellite', () => {
  const source = frame();
  const result = resolveCandidateDisplayCellFrame({
    source,
    sceneSource: 'archived-tle',
    candidateSatelliteId: 'sat-target',
  });

  assert.deepEqual(result?.illuminatedBeams, [
    { satId: 'sat-target', cellId: 0, frequencyIndex: 0, serving: false },
    { satId: 'sat-target', cellId: 1, frequencyIndex: 1, serving: false },
  ]);
  assert.deepEqual(result?.cells, source.cells);
  assert.notStrictEqual(result, source);
});

test('fails closed to the source when the archived candidate identity is absent', () => {
  const source = frame();

  assert.strictEqual(
    resolveCandidateDisplayCellFrame({
      source,
      sceneSource: 'archived-tle',
      candidateSatelliteId: null,
    }),
    source,
  );
  assert.strictEqual(
    resolveCandidateDisplayCellFrame({
      source: undefined,
      sceneSource: 'archived-tle',
      candidateSatelliteId: 'sat-target',
    }),
    undefined,
  );
});

test('projects both endpoints across every cell for an inter cinema pair', () => {
  const source = frame();
  const result = resolveCinemaInterDisplayCellFrame({
    source,
    pairCandidate: candidate(),
  });

  assert.deepEqual(result?.illuminatedBeams, [
    { satId: 'sat-source', cellId: 0, frequencyIndex: 0, serving: false },
    { satId: 'sat-target', cellId: 0, frequencyIndex: 0, serving: false },
    { satId: 'sat-source', cellId: 1, frequencyIndex: 1, serving: false },
    { satId: 'sat-target', cellId: 1, frequencyIndex: 1, serving: false },
  ]);
});

test('keeps the source frame for non-inter cinema and inactive input', () => {
  const source = frame();

  assert.strictEqual(
    resolveCinemaInterDisplayCellFrame({ source, pairCandidate: candidate('intra') }),
    source,
  );
  assert.strictEqual(
    resolveCinemaInterDisplayCellFrame({ source: undefined, pairCandidate: null }),
    undefined,
  );
});
