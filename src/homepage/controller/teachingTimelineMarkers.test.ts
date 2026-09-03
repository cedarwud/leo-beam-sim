import assert from 'node:assert/strict';
import test from 'node:test';
import type { HandoverRailEvent } from '../../ui/HandoverEventRail';
import { selectHomepageTeachingTimelineMarkers } from './teachingTimelineMarkers';

function event(overrides: Partial<HandoverRailEvent>): HandoverRailEvent {
  return {
    id: 'event-default',
    timeSec: 0,
    sourceTimeSec: 0,
    clickTargetSec: 0,
    kind: 'intra',
    title: 'handover',
    fromLabel: 'SAT-A C0',
    toLabel: 'SAT-A C1',
    source: 'sinr-live-cell-truth',
    ...overrides,
  };
}

test('selects the first natural intra and inter events in the teaching window', () => {
  const markers = selectHomepageTeachingTimelineMarkers([
    event({ id: 'inter-40', kind: 'inter', sourceTimeSec: 40, clickTargetSec: 40, fromLabel: 'SAT-A C1', toLabel: 'SAT-B C2' }),
    event({ id: 'intra-4', sourceTimeSec: 4, clickTargetSec: 4 }),
    event({ id: 'intra-12', sourceTimeSec: 12, clickTargetSec: 12 }),
    event({ id: 'inter-80', kind: 'inter', sourceTimeSec: 80, clickTargetSec: 80 }),
  ], { durationSec: 7200, teachingWindowSec: 60 });

  assert.deepEqual(
    markers.map(marker => [marker.kind, marker.sourceTimeSec, marker.clickTargetSec]),
    [['intra', 4, 4], ['inter', 40, 40]],
  );
  assert.deepEqual(
    markers.map(marker => marker.id),
    ['teaching-intra-intra-4', 'teaching-inter-inter-40'],
  );
  assert.match(markers[0]!.ariaLabel, /INTRA handover.*source event intra-4/);
  assert.match(markers[1]!.title, /INTER teaching event.*source event inter-40/);
});

test('keeps an earlier inter from being paired with a later intra', () => {
  const markers = selectHomepageTeachingTimelineMarkers([
    event({ id: 'inter-before', kind: 'inter', sourceTimeSec: 40, clickTargetSec: 40 }),
    event({ id: 'intra-pair', sourceTimeSec: 476, clickTargetSec: 476 }),
    event({ id: 'inter-pair', kind: 'inter', sourceTimeSec: 606, clickTargetSec: 606 }),
  ], { durationSec: 7200, teachingWindowSec: 60 });

  assert.deepEqual(
    markers.map(marker => [marker.kind, marker.sourceTimeSec]),
    [['intra', 476], ['inter', 606]],
  );
});

test('keeps the marker pair on one continuous service chain', () => {
  const markers = selectHomepageTeachingTimelineMarkers([
    event({
      id: 'intra-pair',
      sourceTimeSec: 10,
      clickTargetSec: 10,
      toSatId: 'SAT-A',
    }),
    event({
      id: 'inter-disconnected',
      kind: 'inter',
      sourceTimeSec: 20,
      clickTargetSec: 20,
      fromSatId: 'SAT-B',
      toSatId: 'SAT-C',
    }),
    event({
      id: 'inter-continuous',
      kind: 'inter',
      sourceTimeSec: 30,
      clickTargetSec: 30,
      fromSatId: 'SAT-A',
      toSatId: 'SAT-D',
    }),
  ], { durationSec: 7200 });

  assert.deepEqual(
    markers.map(marker => [marker.kind, marker.sourceTimeSec]),
    [['intra', 10], ['inter', 30]],
  );
});

test('does not expose a partial marker track when no complete teaching pair exists', () => {
  const markers = selectHomepageTeachingTimelineMarkers([
    event({ id: 'intra-120', sourceTimeSec: 120, clickTargetSec: 118 }),
  ], { durationSec: 7200, teachingWindowSec: 60 });

  assert.deepEqual(markers, []);
});

test('ignores invalid/out-of-horizon events and clamps a source-backed click target', () => {
  const markers = selectHomepageTeachingTimelineMarkers([
    event({ id: 'outside', sourceTimeSec: 7210, clickTargetSec: 7210 }),
    event({ id: 'invalid', timeSec: Number.NaN, sourceTimeSec: Number.NaN, clickTargetSec: 0 }),
    event({ id: 'valid', sourceTimeSec: 10, clickTargetSec: -5 }),
    event({ id: 'valid-inter', kind: 'inter', sourceTimeSec: 20, clickTargetSec: 20 }),
  ], { durationSec: 7200 });

  assert.equal(markers.length, 2);
  const intraMarker = markers.find(marker => marker.kind === 'intra');
  assert.ok(intraMarker);
  assert.equal(intraMarker.sourceTimeSec, 10);
  assert.equal(intraMarker.clickTargetSec, 0);
});
