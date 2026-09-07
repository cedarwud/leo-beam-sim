import assert from 'node:assert/strict';
import test from 'node:test';

import type { SinrLiveCellHandoverEvent } from './sinrLiveCellModel';
import {
  resolveRecentInterHandoverEvent,
  resolveRecentPrimaryHandoverEvent,
} from './recentHandoverPresentationEvent';

function event(
  overrides: Partial<SinrLiveCellHandoverEvent> = {},
): SinrLiveCellHandoverEvent {
  return {
    ueId: 'ue-primary',
    kind: 'intra',
    sourceTimeSec: 10,
    fromSatId: 'sat-a',
    fromCellId: 0,
    toSatId: 'sat-a',
    toCellId: 1,
    ...overrides,
  };
}

test('prefers a retained primary inter event over a newer primary intra event', () => {
  const olderInter = event({
    kind: 'inter',
    sourceTimeSec: 9,
    fromSatId: 'sat-a',
    toSatId: 'sat-b',
  });
  const newerIntra = event({ sourceTimeSec: 11 });

  assert.strictEqual(
    resolveRecentPrimaryHandoverEvent({
      events: [olderInter, newerIntra],
      primaryUeId: 'ue-primary',
      simTimeSec: 12,
    }),
    olderInter,
  );
});

test('selects the newest retained primary intra event and ignores other UEs', () => {
  const oldPrimary = event({ sourceTimeSec: 9 });
  const otherUe = event({ ueId: 'ue-other', sourceTimeSec: 11 });
  const latestPrimary = event({ sourceTimeSec: 11 });

  assert.strictEqual(
    resolveRecentPrimaryHandoverEvent({
      events: [oldPrimary, otherUe, latestPrimary],
      primaryUeId: 'ue-primary',
      simTimeSec: 12,
    }),
    latestPrimary,
  );
});

test('fails closed for missing endpoints, future events, and expired events', () => {
  const invalidEndpoint = event({ fromSatId: null });
  const future = event({ sourceTimeSec: 13 });
  const expired = event({ sourceTimeSec: 7 });

  assert.equal(
    resolveRecentPrimaryHandoverEvent({
      events: [invalidEndpoint, future, expired],
      primaryUeId: 'ue-primary',
      simTimeSec: 12,
    }),
    null,
  );
  assert.equal(
    resolveRecentPrimaryHandoverEvent({
      events: [event({ sourceTimeSec: 11 })],
      primaryUeId: 'ue-primary',
      simTimeSec: 12,
      retentionSec: -1,
    }),
    null,
  );
});

test('selects the newest retained inter event across all UEs', () => {
  const olderInter = event({
    kind: 'inter',
    ueId: 'ue-other',
    sourceTimeSec: 9,
    fromSatId: 'sat-a',
    toSatId: 'sat-b',
  });
  const newerInter = event({
    kind: 'inter',
    sourceTimeSec: 11,
    fromSatId: 'sat-b',
    toSatId: 'sat-c',
  });

  assert.strictEqual(
    resolveRecentInterHandoverEvent({
      events: [olderInter, newerInter],
      simTimeSec: 12,
    }),
    newerInter,
  );
});

test('does not let an intra, missing endpoint, or expired inter event suppress the scene', () => {
  assert.equal(
    resolveRecentInterHandoverEvent({
      events: [
        event({ kind: 'intra', sourceTimeSec: 11 }),
        event({ kind: 'inter', sourceTimeSec: 11, fromSatId: null }),
        event({ kind: 'inter', sourceTimeSec: 7, fromSatId: 'sat-a', toSatId: 'sat-b' }),
      ],
      simTimeSec: 12,
    }),
    null,
  );
});
