import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  annotateOtherHandoverDisplayUes,
  filterOtherHandoverDisplayUes,
  selectOtherHandoverUeIds,
  type OtherHandoverUeState,
} from './otherHandoverUeSelector';

function ue(
  id: string,
  pendingTargetSatId: string | null,
  triggerProgressSec: number,
): OtherHandoverUeState {
  return { id, pendingTargetSatId, triggerProgressSec };
}

test('selects only ongoing secondary handovers, orders by progress, and applies the cap', () => {
  const selected = selectOtherHandoverUeIds({
    primaryUeId: 'ue-0',
    triggerTimeSec: 3,
    maxOtherHandoverUes: 2,
    ues: [
      ue('ue-0', 'sat-primary-target', 2.9),
      ue('ue-1', 'sat-a', 1.2),
      ue('ue-2', 'sat-b', 2.4),
      ue('ue-3', 'sat-completed', 3),
      ue('ue-4', null, 2.8),
      ue('ue-5', 'sat-invalid-progress', Number.NaN),
    ],
  });

  assert.deepEqual(selected, ['ue-2', 'ue-1']);
});

test('retains source order for equal progress and fails closed for a zero cap', () => {
  const ues = [
    ue('ue-a', 'sat-a', 1),
    ue('ue-b', 'sat-b', 1),
  ];

  assert.deepEqual(
    selectOtherHandoverUeIds({
      primaryUeId: 'primary',
      triggerTimeSec: 2,
      maxOtherHandoverUes: 1,
      ues,
    }),
    ['ue-a'],
  );
  assert.deepEqual(
    selectOtherHandoverUeIds({
      primaryUeId: 'primary',
      triggerTimeSec: 2,
      maxOtherHandoverUes: 0,
      ues,
    }),
    [],
  );
});

test('keeps the normal UE population when no secondary handover is active', () => {
  const ues = [{ id: 'live-ue-0' }, { id: 'live-ue-1' }, { id: 'live-ue-2' }];
  assert.deepEqual(
    filterOtherHandoverDisplayUes(ues, 'live-ue-0', new Set()),
    ues,
  );
  assert.deepEqual(
    filterOtherHandoverDisplayUes(ues, 'live-ue-0', new Set(['live-ue-2'])),
    [ues[0], ues[2]],
  );
});

test('marks selected secondary UEs for a visible handover cue', () => {
  const ues = [
    { id: 'live-ue-0', markerColor: '#ff0000' },
    { id: 'live-ue-1', markerColor: '#00ff00' },
    { id: 'live-ue-2', markerColor: '#0000ff' },
  ];

  assert.deepEqual(
    annotateOtherHandoverDisplayUes(ues, 'live-ue-0', new Set(['live-ue-2'])),
    [
      { ...ues[0], isOtherHandover: false },
      { ...ues[1], isOtherHandover: false },
      { ...ues[2], isOtherHandover: true },
    ],
  );
});

test('GroundScene owns an explicit visual cue for selected handover UEs', () => {
  const groundSceneSource = readFileSync(
    new URL('../viz/GroundScene.tsx', import.meta.url),
    'utf8',
  );
  assert.match(groundSceneSource, /isOtherHandover/);
  assert.match(groundSceneSource, /SecondaryUeHandoverRings/);
});
