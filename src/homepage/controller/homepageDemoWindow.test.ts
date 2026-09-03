import assert from 'node:assert/strict';
import test from 'node:test';

import type { LiveWalkerHandoverEvent } from '../../scene/liveWalkerHandoverEventIndex';
import {
  HOMEPAGE_QUICK_JUMP_LEAD_IN_SEC,
  resolveHomepageQuickJumpSourceSec,
  selectHomepageDemoWindow,
} from './homepageDemoWindow';
import {
  createHomepageTeachingStops,
  findCurrentHomepageTeachingStop,
  findNextHomepageTeachingStop,
  findPreviousHomepageTeachingStop,
} from './homepageTeachingTimeline';

function event(overrides: Partial<LiveWalkerHandoverEvent> = {}): LiveWalkerHandoverEvent {
  const kind = overrides.kind ?? 'intra';
  return {
    id: 'event-default',
    sourceTimeSec: 0,
    kind,
    fromSatId: 'sat-a',
    fromBeamId: 1,
    toSatId: kind === 'inter' ? 'sat-b' : 'sat-a',
    toBeamId: 2,
    fromCellId: 3,
    toCellId: 3,
    fromSinrDb: -2,
    toSinrDb: 1,
    deltaDb: 3,
    sourceStartSec: 0,
    sourceEndSec: 0,
    clickTargetSec: 0,
    primaryUeId: 'live-ue-0',
    count: 1,
    ...overrides,
  };
}

test('selects ordered intra then inter events without changing their references', () => {
  const events = [
    event({ id: 'intra-26', kind: 'intra', sourceTimeSec: 26, sourceStartSec: 16, sourceEndSec: 46, clickTargetSec: 26 }),
    event({ id: 'inter-62', kind: 'inter', sourceTimeSec: 62, sourceStartSec: 52, sourceEndSec: 82, clickTargetSec: 62 }),
  ];
  const window = selectHomepageDemoWindow(events, 0, 7200);

  assert.ok(window);
  assert.deepEqual(window.events.map(selected => selected.id), ['intra-26', 'inter-62']);
  assert.equal(window.events[0], events[0]);
  assert.equal(window.events[1], events[1]);
  assert.equal(window.leadInSec, 16);
  assert.equal(window.endSec, 82);
  assert.equal(window.firstEventId, 'intra-26');
  assert.equal(window.lastEventId, 'inter-62');
  assert.equal(window.alignment.aligned, true);
  assert.ok(Object.isFrozen(window));
  assert.ok(Object.isFrozen(window.events));
});

test('homepage quick jump stays inside the existing source event window', () => {
  const selectedEvent = event({
    id: 'intra-26',
    kind: 'intra',
    sourceTimeSec: 26,
    sourceStartSec: 16,
    sourceEndSec: 46,
    clickTargetSec: 26,
  });

  assert.equal(
    resolveHomepageQuickJumpSourceSec(selectedEvent),
    26 - HOMEPAGE_QUICK_JUMP_LEAD_IN_SEC,
  );
  assert.equal(
    resolveHomepageQuickJumpSourceSec({ ...selectedEvent, sourceStartSec: 25 }),
    25,
  );
  assert.equal(
    resolveHomepageQuickJumpSourceSec({ ...selectedEvent, sourceStartSec: Number.NaN }),
    null,
  );
});

test('teaching stops stay on the selected source window and step without a second clock', () => {
  const window = selectHomepageDemoWindow([
    event({ id: 'intra-26', kind: 'intra', sourceTimeSec: 26, sourceStartSec: 16, sourceEndSec: 46, clickTargetSec: 26 }),
    event({ id: 'inter-62', kind: 'inter', sourceTimeSec: 62, sourceStartSec: 52, sourceEndSec: 82, clickTargetSec: 62 }),
  ], 0, 7200);
  assert.ok(window);

  const stops = createHomepageTeachingStops(window);
  assert.deepEqual(stops.map(stop => stop.id), [
    'intra-candidates',
    'intra-commit',
    'inter-candidates',
    'inter-commit',
    'end',
  ]);
  assert.deepEqual(stops.map(stop => stop.sourceTimeSec), [16, 26, 52, 62, 82]);
  assert.equal(findNextHomepageTeachingStop(stops, 26)?.id, 'inter-candidates');
  assert.equal(findPreviousHomepageTeachingStop(stops, 26)?.id, 'intra-candidates');
  assert.equal(findCurrentHomepageTeachingStop(stops, 61)?.id, 'inter-candidates');
  assert.equal(findNextHomepageTeachingStop(stops, 82), null);
});

test('returns null when the source sequence has no intra event', () => {
  assert.equal(
    selectHomepageDemoWindow([
      event({ id: 'inter-62', kind: 'inter', sourceTimeSec: 62, sourceStartSec: 52, sourceEndSec: 82, clickTargetSec: 62 }),
    ], 0, 7200),
    null,
  );
});

test('returns null when the source sequence has no subsequent inter event', () => {
  assert.equal(
    selectHomepageDemoWindow([
      event({ id: 'intra-26', kind: 'intra', sourceTimeSec: 26, sourceStartSec: 16, sourceEndSec: 46, clickTargetSec: 26 }),
    ], 0, 7200),
    null,
  );
});

test('rejects out-of-order events and different-UE pairs', () => {
  assert.equal(
    selectHomepageDemoWindow([
      event({ id: 'inter-62', kind: 'inter', sourceTimeSec: 62, sourceStartSec: 52, sourceEndSec: 82, clickTargetSec: 62 }),
      event({ id: 'intra-26', kind: 'intra', sourceTimeSec: 26, sourceStartSec: 16, sourceEndSec: 46, clickTargetSec: 26 }),
    ], 0, 7200),
    null,
    'out-of-order source events',
  );

  assert.equal(
    selectHomepageDemoWindow([
      event({ id: 'intra-26', kind: 'intra', sourceTimeSec: 26, sourceStartSec: 16, sourceEndSec: 46, clickTargetSec: 26, ueId: 'live-ue-1' }),
      event({ id: 'inter-62', kind: 'inter', sourceTimeSec: 62, sourceStartSec: 52, sourceEndSec: 82, clickTargetSec: 62, ueId: 'live-ue-2' }),
    ], 0, 7200),
    null,
    'different UE pair',
  );
});

test('continues to the later same-protagonist inter event in a mixed-UE source index', () => {
  const events = [
    event({
      id: 'intra-26',
      kind: 'intra',
      sourceTimeSec: 26,
      sourceStartSec: 16,
      sourceEndSec: 46,
      clickTargetSec: 26,
      ueId: 'live-ue-a',
      primaryUeId: 'live-ue-a',
    }),
    event({
      id: 'inter-40-other-protagonist',
      kind: 'inter',
      sourceTimeSec: 40,
      sourceStartSec: 30,
      sourceEndSec: 60,
      clickTargetSec: 40,
      ueId: 'live-ue-b',
      primaryUeId: 'live-ue-b',
    }),
    event({
      id: 'inter-62',
      kind: 'inter',
      sourceTimeSec: 62,
      sourceStartSec: 52,
      sourceEndSec: 82,
      clickTargetSec: 62,
      ueId: 'live-ue-a',
      primaryUeId: 'live-ue-a',
    }),
  ];

  const window = selectHomepageDemoWindow(events, 0, 7200);

  assert.ok(window);
  assert.deepEqual(window.events.map(selected => selected.id), ['intra-26', 'inter-62']);
  assert.equal(window.events[0], events[0]);
  assert.equal(window.events[1], events[2]);
  assert.equal(window.events[0].fromCellId, window.events[1].fromCellId);
  assert.equal(window.events[0].toCellId, window.events[1].toCellId);
});

test('skips a disconnected inter event and selects the later continuous service handover', () => {
  const events = [
    event({
      id: 'intra-26',
      kind: 'intra',
      sourceTimeSec: 26,
      sourceStartSec: 16,
      sourceEndSec: 46,
      clickTargetSec: 26,
      fromSatId: 'sat-a',
      toSatId: 'sat-a',
    }),
    event({
      id: 'inter-disconnected',
      kind: 'inter',
      sourceTimeSec: 40,
      sourceStartSec: 30,
      sourceEndSec: 60,
      clickTargetSec: 40,
      fromSatId: 'sat-b',
      toSatId: 'sat-c',
    }),
    event({
      id: 'inter-continuous',
      kind: 'inter',
      sourceTimeSec: 62,
      sourceStartSec: 52,
      sourceEndSec: 82,
      clickTargetSec: 62,
      fromSatId: 'sat-a',
      toSatId: 'sat-d',
    }),
  ];

  const window = selectHomepageDemoWindow(events, 0, 7200);

  assert.ok(window);
  assert.deepEqual(window.events.map(selected => selected.id), ['intra-26', 'inter-continuous']);
  assert.equal(window.alignment.checks['inter-follows-intra'], true);
});

test('rejects a source pair that does not carry the two accepted handover geometries', () => {
  const validInter = event({
    id: 'inter-62',
    kind: 'inter',
    sourceTimeSec: 62,
    sourceStartSec: 52,
    sourceEndSec: 82,
    clickTargetSec: 62,
  });

  assert.equal(
    selectHomepageDemoWindow([
      event({
        id: 'intra-different-cell',
        sourceTimeSec: 26,
        sourceStartSec: 16,
        sourceEndSec: 46,
        clickTargetSec: 26,
        fromCellId: 3,
        toCellId: 4,
      }),
      validInter,
    ], 0, 7200),
    null,
    'intra must stay on one geographic cell',
  );

  assert.equal(
    selectHomepageDemoWindow([
      event({
        id: 'intra-same-beam',
        sourceTimeSec: 26,
        sourceStartSec: 16,
        sourceEndSec: 46,
        clickTargetSec: 26,
        fromBeamId: 1,
        toBeamId: 1,
      }),
      validInter,
    ], 0, 7200),
    null,
    'intra must replace the beam identity',
  );

  assert.equal(
    selectHomepageDemoWindow([
      event({ id: 'intra-26', sourceTimeSec: 26, sourceStartSec: 16, sourceEndSec: 46, clickTargetSec: 26 }),
      event({
        ...validInter,
        toSatId: 'sat-a',
      }),
    ], 0, 7200),
    null,
    'inter must cross satellites',
  );
});

test('rejects a pair whose source events cross the duration', () => {
  assert.equal(
    selectHomepageDemoWindow([
      event({ id: 'intra-26', kind: 'intra', sourceTimeSec: 26, sourceStartSec: 16, sourceEndSec: 46, clickTargetSec: 26 }),
      event({ id: 'inter-62', kind: 'inter', sourceTimeSec: 62, sourceStartSec: 52, sourceEndSec: 82, clickTargetSec: 62 }),
    ], 0, 60),
    null,
  );
});

test('rejects an incomplete overlap when clamped targets do not cover both source events', () => {
  assert.equal(
    selectHomepageDemoWindow([
      event({ id: 'intra-10', kind: 'intra', sourceTimeSec: 10, sourceStartSec: 12, sourceEndSec: 15, clickTargetSec: 10 }),
      event({ id: 'inter-20', kind: 'inter', sourceTimeSec: 20, sourceStartSec: 19, sourceEndSec: 18, clickTargetSec: 20 }),
    ], 0, 30),
    null,
  );
});

test('clamps existing click targets at both duration boundaries', () => {
  const window = selectHomepageDemoWindow([
    event({ id: 'intra-2', kind: 'intra', sourceTimeSec: 2, sourceStartSec: -10, sourceEndSec: 4, clickTargetSec: 2 }),
    event({ id: 'inter-8', kind: 'inter', sourceTimeSec: 8, sourceStartSec: 6, sourceEndSec: 99, clickTargetSec: 8 }),
  ], 0, 10);

  assert.ok(window);
  assert.equal(window.leadInSec, 0);
  assert.equal(window.endSec, 10);
});

test('keeps the current pair active until its clamped end, then selects the next pair', () => {
  const window = selectHomepageDemoWindow([
    event({ id: 'intra-2', kind: 'intra', sourceTimeSec: 2, sourceStartSec: 0, sourceEndSec: 4, clickTargetSec: 2 }),
    event({ id: 'inter-8', kind: 'inter', sourceTimeSec: 8, sourceStartSec: 6, sourceEndSec: 10, clickTargetSec: 8 }),
    event({ id: 'intra-20', kind: 'intra', sourceTimeSec: 20, sourceStartSec: 18, sourceEndSec: 24, clickTargetSec: 20 }),
    event({ id: 'inter-30', kind: 'inter', sourceTimeSec: 30, sourceStartSec: 28, sourceEndSec: 32, clickTargetSec: 30 }),
  ], 11, 60);

  assert.ok(window);
  assert.equal(window.firstEventId, 'intra-20');
  assert.equal(window.lastEventId, 'inter-30');
});
