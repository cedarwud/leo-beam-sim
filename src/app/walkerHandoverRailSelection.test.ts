import test from 'node:test';
import assert from 'node:assert/strict';
import type { HandoverRailEvent } from '../ui/HandoverEventRail';
import type { SceneLane } from './sceneLane';
import type { SceneSourceMode } from './appPersistence';
import {
  selectWalkerHandoverRailEvents,
  type WalkerHandoverRailSelectionInput,
} from './walkerHandoverRailSelection';

function event(id: string): HandoverRailEvent {
  return {
    id,
    timeSec: 0,
    kind: 'intra',
    title: id,
    fromLabel: id,
    toLabel: id,
    source: 'live-observed',
  };
}

function createInput(
  sceneSource: SceneSourceMode,
  sceneLane: SceneLane,
): WalkerHandoverRailSelectionInput {
  return {
    scene: { sceneSource, sceneLane },
    events: {
      artifact: [event('artifact')],
      liveObserved: [event('observed')],
      liveWalker: [event('walker')],
      modqn: [event('modqn')],
    },
  };
}

test('artifact source takes precedence over every scene lane', () => {
  const selected = selectWalkerHandoverRailEvents(
    createInput('artifact-replay', 'modqn-replay-proof'),
  );

  assert.deepEqual(selected.map(item => item.id), ['artifact']);
});

test('live and replay lanes select their owning rail event source', () => {
  assert.deepEqual(
    selectWalkerHandoverRailEvents(createInput('live-sim', 'sinr-live')).map(item => item.id),
    ['walker'],
  );
  assert.deepEqual(
    selectWalkerHandoverRailEvents(createInput('live-sim', 'modqn-live-cell-preview')).map(item => item.id),
    ['walker'],
  );
  assert.deepEqual(
    selectWalkerHandoverRailEvents(createInput('live-sim', 'modqn-replay-proof')).map(item => item.id),
    ['modqn'],
  );
  assert.deepEqual(
    selectWalkerHandoverRailEvents(createInput('live-sim', 'artifact-replay')).map(item => item.id),
    ['observed'],
  );
});
