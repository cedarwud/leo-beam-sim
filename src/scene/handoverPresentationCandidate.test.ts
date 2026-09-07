import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveHandoverPresentationCandidate,
  type HandoverPresentationCandidateInput,
} from './handoverPresentationCandidate';

const world = new Map([
  ['source', { x: 1, y: 2, z: 3 }],
  ['target', { x: 4, y: 5, z: 6 }],
]);
const placements = new Map([[0, {}], [1, {}]]);

function baseInput(): HandoverPresentationCandidateInput {
  return {
    authority: {
      active: false,
      candidate: null,
      centralOverlayActive: false,
      decisionAuthorityPresent: false,
      acceptedPresentation: null,
    },
    manual: {
      active: false,
      requested: false,
      requestId: 7,
      displayMs: 8000,
      event: null,
      beamRecord: null,
    },
    natural: {
      event: null,
      source: 'live',
      satelliteWorldById: world,
    },
    cinema: {
      ready: false,
      armed: false,
      candidate: null,
      satelliteWorldById: world,
    },
    placementByCellId: placements,
    durations: {
      naturalIntraMs: 1000,
      naturalInterMs: 2000,
      cinemaIntraMs: 3000,
      cinemaInterMs: 4000,
    },
    teachingLectureActive: false,
  };
}

test('authority candidate wins before natural, manual, or cinema fallbacks', () => {
  const authority = {
    eventId: 'authority-1',
    source: 'walker' as const,
    kind: 'inter' as const,
    from: { satId: 'source', cellId: 0, drawable: true },
    to: { satId: 'target', cellId: 0, drawable: true },
    durationMs: 2500,
  };
  const input = {
    ...baseInput(),
    authority: { ...baseInput().authority, candidate: authority },
    manual: {
      ...baseInput().manual,
      active: true,
      event: {
        ueId: 'ue-0', kind: 'intra' as const, sourceTimeSec: 1,
        fromSatId: 'source', fromCellId: 0, toSatId: 'source', toCellId: 1,
      },
    },
  };

  assert.strictEqual(resolveHandoverPresentationCandidate(input), authority);
});

test('manual events resolve exact endpoints and measured link evidence', () => {
  const input = {
    ...baseInput(),
    manual: {
      ...baseInput().manual,
      active: true,
      event: {
        ueId: 'ue-0', kind: 'intra' as const, sourceTimeSec: 12,
        fromSatId: 'source', fromCellId: 0, toSatId: 'source', toCellId: 1,
        fromSinrDb: 3, toSinrDb: 5, deltaDb: 2,
      },
      beamRecord: {
        servingLinkSample: { beamId: 11 } as never,
        intraCandidateLinkSample: { beamId: 12 } as never,
      } as never,
    },
  };

  assert.deepEqual(resolveHandoverPresentationCandidate(input), {
    eventId: 'manual:7',
    source: 'manual',
    kind: 'intra',
    ueId: 'ue-0',
    sourceTimeSec: 12,
    from: { satId: 'source', cellId: 0, beamId: 11, drawable: true },
    to: { satId: 'source', cellId: 1, beamId: 12, drawable: true },
    durationMs: 8000,
    fromSinrDb: 3,
    toSinrDb: 5,
    deltaDb: 2,
  });
});

test('a requested but unavailable manual event suppresses other stories', () => {
  const input = {
    ...baseInput(),
    manual: {
      ...baseInput().manual,
      requested: true,
      event: {
        ueId: 'ue-0', kind: 'intra' as const, sourceTimeSec: 2,
        fromSatId: 'missing', fromCellId: 0, toSatId: 'target', toCellId: 1,
      },
    },
    natural: {
      ...baseInput().natural,
      event: {
        ueId: 'ue-0', kind: 'intra' as const, sourceTimeSec: 2,
        fromSatId: 'source', fromCellId: 0, toSatId: 'source', toCellId: 1,
      },
    },
  };

  assert.equal(resolveHandoverPresentationCandidate(input), null);
});

test('an accepted decision suppresses the natural fallback independently of the overlay flag', () => {
  const acceptedPresentation = {
    decision: {} as never,
  } as unknown as NonNullable<HandoverPresentationCandidateInput['authority']['acceptedPresentation']>;
  const input: HandoverPresentationCandidateInput = {
    ...baseInput(),
    authority: {
      ...baseInput().authority,
      active: true,
      acceptedPresentation,
    },
    natural: {
      ...baseInput().natural,
      event: {
        ueId: 'ue-0', kind: 'inter', sourceTimeSec: 4,
        fromSatId: 'source', fromCellId: 0, toSatId: 'target', toCellId: 1,
      },
    },
  };

  assert.equal(resolveHandoverPresentationCandidate(input), null);
});

test('ready cinema candidates own the fallback slot, while an armed seek fails closed', () => {
  const input = {
    ...baseInput(),
    cinema: {
      ...baseInput().cinema,
      ready: true,
      candidate: {
        eventId: 'cinema-1', ueId: 'ue-0', kind: 'inter' as const, sourceTimeSec: 20,
        fromSatId: 'source', fromCellId: 0, toSatId: 'target', toCellId: 0,
      },
    },
  };
  const candidate = resolveHandoverPresentationCandidate(input);
  assert.equal(candidate?.eventId, 'cinema:cinema-1');
  assert.equal(candidate?.durationMs, 4000);

  const armedInput = {
    ...input,
    cinema: { ...input.cinema, ready: false, armed: true },
  };
  assert.equal(resolveHandoverPresentationCandidate(armedInput), null);
});
