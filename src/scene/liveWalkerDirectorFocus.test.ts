#!/usr/bin/env node

import {
  resolveLiveWalkerFocusWindow,
  type LiveWalkerDirectorFocusTarget,
} from './liveWalkerDirectorFocus';
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
  sourceTimeSec: number,
  fromSatId?: string | null,
  toSatId?: string | null,
): HandoverRailEvent {
  return {
    id,
    timeSec: sourceTimeSec,
    sourceTimeSec,
    clickTargetSec: sourceTimeSec,
    ...(fromSatId === undefined ? {} : { fromSatId }),
    ...(toSatId === undefined ? {} : { toSatId }),
    kind,
    title: 'event',
    fromLabel: 'from',
    toLabel: 'to',
    detail: 'detail',
    source: 'live-walker',
  };
}

function requireTarget(value: LiveWalkerDirectorFocusTarget | null, label: string): LiveWalkerDirectorFocusTarget {
  if (!value) {
    throw new Error(`${label}: expected target, got null`);
  }
  return value;
}

console.log('liveWalkerDirectorFocus.test');

check('selects the next event at/after the live cursor', () => {
  const target = requireTarget(resolveLiveWalkerFocusWindow([
    ev('a', 'inter', 100, 'sat-a', 'sat-b'),
    ev('b', 'inter', 515, 'sat-c', 'sat-d'),
    ev('c', 'inter', 641, 'sat-e', 'sat-f'),
  ], 'inter', 450, 7200, 'profile-derived-forecast'), 'target');

  assert.equal(target.eventSec, 515, 'eventSec');
  // seek target is the lead-in BEFORE the event (2s default), never the event itself.
  assert.equal(target.seekTargetSec, 513, 'seekTargetSec');
  assert.equal(target.fromSatId, 'sat-c', 'fromSatId');
  assert.equal(target.toSatId, 'sat-d', 'toSatId');
});

check('kind filter selects only the requested handover kind', () => {
  const events = [
    ev('intra-a', 'intra', 200, 'sat-x', 'sat-x'),
    ev('inter-a', 'inter', 300, 'sat-y', 'sat-z'),
  ];
  const inter = requireTarget(resolveLiveWalkerFocusWindow(events, 'inter', 0, 7200, 'profile-derived-forecast'), 'inter');
  const intra = requireTarget(resolveLiveWalkerFocusWindow(events, 'intra', 0, 7200, 'profile-derived-forecast'), 'intra');
  assert.equal(inter.eventSec, 300, 'inter eventSec');
  assert.equal(intra.eventSec, 200, 'intra eventSec');
});

check('no event of the requested kind returns null', () => {
  assert.equal(
    resolveLiveWalkerFocusWindow([ev('inter-a', 'inter', 300)], 'intra', 0, 7200, 'profile-derived-forecast'),
    null,
    'target',
  );
});

check('empty events return null', () => {
  assert.equal(resolveLiveWalkerFocusWindow([], 'inter', 0, 7200, 'overlay-demo'), null, 'target');
});

check('all events behind the cursor fall back to the earliest', () => {
  const target = requireTarget(resolveLiveWalkerFocusWindow([
    ev('a', 'inter', 100, 'sat-a', 'sat-b'),
    ev('b', 'inter', 300, 'sat-c', 'sat-d'),
  ], 'inter', 7000, 7200, 'profile-derived-forecast'), 'target');
  assert.equal(target.eventSec, 100, 'eventSec');
});

check('seek target clamps to the window start (no negative horizon)', () => {
  const target = requireTarget(resolveLiveWalkerFocusWindow([
    ev('a', 'inter', 1, 'sat-a', 'sat-b'),
  ], 'inter', 0, 7200, 'profile-derived-forecast'), 'target');
  assert.equal(target.seekTargetSec, 0, 'seekTargetSec');
});

check('claim kind is echoed honestly (forecast)', () => {
  const target = requireTarget(resolveLiveWalkerFocusWindow([
    ev('a', 'inter', 100, 'sat-a', 'sat-b'),
  ], 'inter', 0, 7200, 'profile-derived-forecast'), 'target');
  assert.equal(target.claimKind, 'profile-derived-forecast', 'claimKind');
});

check('claim kind is echoed honestly (overlay-demo)', () => {
  const target = requireTarget(resolveLiveWalkerFocusWindow([
    ev('a', 'inter', 100, 'sat-a', 'sat-b'),
  ], 'inter', 0, 7200, 'overlay-demo'), 'target');
  assert.equal(target.claimKind, 'overlay-demo', 'claimKind');
});

check('missing satellite ids resolve to null (no fabrication)', () => {
  const target = requireTarget(resolveLiveWalkerFocusWindow([
    ev('a', 'inter', 100),
  ], 'inter', 0, 7200, 'profile-derived-forecast'), 'target');
  assert.equal(target.fromSatId, null, 'fromSatId');
  assert.equal(target.toSatId, null, 'toSatId');
});

console.log(`[liveWalkerDirectorFocus.test] PASS ${passed}/0`);
