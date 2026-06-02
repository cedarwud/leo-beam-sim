#!/usr/bin/env node

import {
  resolveCinematicReplayWindow,
  type CinematicReplayWindow,
} from './cinematicReplayWindow';
import type { HandoverRailEvent, HandoverRailEventKind } from '../ui/HandoverEventRail';

const assert = {
  equal<TValue>(actual: TValue, expected: TValue, label: string): void {
    if (!Object.is(actual, expected)) {
      throw new Error(`${label}: expected ${String(expected)}, got ${String(actual)}`);
    }
  },
};

let passed = 0;

function pass(label: string): void {
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}: ${label}`);
}

function check(label: string, fn: () => void): void {
  fn();
  pass(label);
}

function ev(
  id: string,
  kind: HandoverRailEventKind,
  timeSec: number,
  sourceTimeSec?: number,
): HandoverRailEvent {
  return {
    id,
    timeSec,
    ...(sourceTimeSec === undefined ? {} : { sourceTimeSec }),
    kind,
    title: 'event',
    fromLabel: 'from',
    toLabel: 'to',
    detail: 'detail',
    source: 'live-walker',
  };
}

function requireWindow(value: CinematicReplayWindow | null, label: string): CinematicReplayWindow {
  if (!value) {
    throw new Error(`${label}: expected window, got null`);
  }
  return value;
}

console.log('cinematicReplayWindow.test');

check('next>=now picks the upcoming event', () => {
  const window = requireWindow(resolveCinematicReplayWindow([
    ev('a', 'intra', 5),
    ev('b', 'intra', 15),
    ev('c', 'intra', 30),
  ], 'intra', 10, 60), 'window');

  assert.equal(window.eventSec, 15, 'eventSec');
  assert.equal(window.startSec, 13, 'startSec');
  assert.equal(window.endSec, 20, 'endSec');
});

check('event exactly at now counts as next', () => {
  const window = requireWindow(resolveCinematicReplayWindow([
    ev('a', 'intra', 10),
  ], 'intra', 10, 60), 'window');

  assert.equal(window.eventSec, 10, 'eventSec');
});

check('all events behind now fall back to earliest', () => {
  const window = requireWindow(resolveCinematicReplayWindow([
    ev('a', 'intra', 5),
    ev('b', 'intra', 15),
  ], 'intra', 40, 60), 'window');

  assert.equal(window.eventSec, 5, 'eventSec');
});

check('kind filter picks only the requested handover kind', () => {
  const events = [
    ev('intra-a', 'intra', 5),
    ev('inter-a', 'inter', 8),
  ];
  const interWindow = requireWindow(resolveCinematicReplayWindow(events, 'inter', 0, 60), 'inter');
  const intraWindow = requireWindow(resolveCinematicReplayWindow(events, 'intra', 0, 60), 'intra');

  assert.equal(interWindow.eventSec, 8, 'inter eventSec');
  assert.equal(intraWindow.eventSec, 5, 'intra eventSec');
});

check('no event of requested kind returns null', () => {
  assert.equal(resolveCinematicReplayWindow([
    ev('inter-a', 'inter', 8),
  ], 'intra', 0, 60), null, 'window');
});

check('empty events return null', () => {
  assert.equal(resolveCinematicReplayWindow([], 'intra', 0, 60), null, 'window');
});

check('clamp at start keeps window start at zero', () => {
  const window = requireWindow(resolveCinematicReplayWindow([
    ev('a', 'intra', 1),
  ], 'intra', 0, 60), 'window');

  assert.equal(window.startSec, 0, 'startSec');
});

check('clamp at end keeps window end within duration', () => {
  const window = requireWindow(resolveCinematicReplayWindow([
    ev('a', 'intra', 18),
  ], 'intra', 0, 20), 'window');

  assert.equal(window.endSec, 20, 'endSec');
});

check('window collapse returns null', () => {
  assert.equal(resolveCinematicReplayWindow([
    ev('a', 'intra', 1),
  ], 'intra', 0, 0.0001, { leadInSec: 0, leadOutSec: 0 }), null, 'window');
});

check('nowSec NaN is treated as zero', () => {
  const window = requireWindow(resolveCinematicReplayWindow([
    ev('a', 'intra', 5),
    ev('b', 'intra', 15),
  ], 'intra', Number.NaN, 60), 'window');

  assert.equal(window.eventSec, 5, 'eventSec');
});

check('sourceTimeSec takes precedence over display timeSec', () => {
  const window = requireWindow(resolveCinematicReplayWindow([
    ev('a', 'intra', 99, 4),
  ], 'intra', 0, 60), 'window');

  assert.equal(window.eventSec, 4, 'eventSec');
  assert.equal(window.startSec, 2, 'startSec');
});

check('deterministic tie-break picks earlier event id for equal times', () => {
  const window = requireWindow(resolveCinematicReplayWindow([
    ev('event-b', 'intra', 10),
    ev('event-a', 'intra', 10),
  ], 'intra', 0, 60), 'window');

  assert.equal(window.eventId, 'event-a', 'eventId');
});

check('opts override lead-in and lead-out defaults', () => {
  const window = requireWindow(resolveCinematicReplayWindow([
    ev('a', 'intra', 10),
  ], 'intra', 0, 60, { leadInSec: 3, leadOutSec: 7 }), 'window');

  assert.equal(window.startSec, 7, 'startSec');
  assert.equal(window.endSec, 17, 'endSec');
  assert.equal(window.windowDurationSec, 10, 'windowDurationSec');
});

console.log(`[cinematicReplayWindow.test] PASS ${passed}/0`);
