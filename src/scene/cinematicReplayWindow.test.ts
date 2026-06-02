#!/usr/bin/env node

import {
  resolveCinematicReplayWindow,
  shouldEndCinematicReplay,
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

const AUTO_END_WINDOW: CinematicReplayWindow = {
  eventId: 'e',
  kind: 'intra',
  eventSec: 10,
  startSec: 8,
  endSec: 15,
  windowDurationSec: 7,
};

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

check('shouldEndCinematicReplay ignores null window', () => {
  assert.equal(shouldEndCinematicReplay(null, 'focused', 98, 99), false, 'shouldEnd');
});

check('shouldEndCinematicReplay waits through acquiring even past end', () => {
  assert.equal(shouldEndCinematicReplay(AUTO_END_WINDOW, 'acquiring', 15, 16), false, 'shouldEnd');
});

check('shouldEndCinematicReplay ignores restoring phase', () => {
  assert.equal(shouldEndCinematicReplay(AUTO_END_WINDOW, 'restoring', 15, 16), false, 'shouldEnd');
});

check('shouldEndCinematicReplay ignores idle phase', () => {
  assert.equal(shouldEndCinematicReplay(AUTO_END_WINDOW, 'idle', 15, 16), false, 'shouldEnd');
});

check('shouldEndCinematicReplay stays active before window end (forward play)', () => {
  assert.equal(shouldEndCinematicReplay(AUTO_END_WINDOW, 'focused', 14, 14.999), false, 'shouldEnd');
});

check('shouldEndCinematicReplay ends exactly at window end', () => {
  assert.equal(shouldEndCinematicReplay(AUTO_END_WINDOW, 'focused', 14, 15), true, 'shouldEnd');
});

check('shouldEndCinematicReplay ends after window end', () => {
  assert.equal(shouldEndCinematicReplay(AUTO_END_WINDOW, 'focused', 14, 16), true, 'shouldEnd');
});

check('shouldEndCinematicReplay ignores non-finite current time', () => {
  assert.equal(shouldEndCinematicReplay(AUTO_END_WINDOW, 'focused', 14, Number.NaN), false, 'shouldEnd');
});

check('shouldEndCinematicReplay ends on loop wrap / backward seek before window end', () => {
  // currentTime jumped back well below the previous sample while focused (still < endSec).
  assert.equal(shouldEndCinematicReplay(AUTO_END_WINDOW, 'focused', 14.9, 0.5), true, 'shouldEnd');
});

check('shouldEndCinematicReplay tolerates tiny backward jitter (not a wrap)', () => {
  // diff smaller than CINEMATIC_WRAP_BACKSTEP_SEC and still before end → keep playing.
  assert.equal(shouldEndCinematicReplay(AUTO_END_WINDOW, 'focused', 14.0005, 14), false, 'shouldEnd');
});

check('shouldEndCinematicReplay ignores wrap when not focused', () => {
  assert.equal(shouldEndCinematicReplay(AUTO_END_WINDOW, 'acquiring', 14.9, 0.5), false, 'shouldEnd');
});

console.log(`[cinematicReplayWindow.test] PASS ${passed}/0`);
