import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLiveWalkerEventIndexSourceGapReasons } from './liveWalkerEventIndexSourceGap';

const liveInput = {
  sceneSource: 'live-sim' as const,
  isWalkerSceneActive: true,
  sceneLane: 'sinr-live' as const,
  indexBuilding: false,
  indexSourceGapReasons: [] as readonly string[],
};

test('reports rebuilding before an existing index gap while the live index is building', () => {
  assert.deepEqual(resolveLiveWalkerEventIndexSourceGapReasons({
    ...liveInput,
    indexBuilding: true,
    indexSourceGapReasons: ['stale source gap'],
  }), ['Source gap: rebuilding the live handover index for the current parameters.']);
});

test('reports an explicit not-ready gap when the live index is absent', () => {
  assert.deepEqual(resolveLiveWalkerEventIndexSourceGapReasons({
    ...liveInput,
    indexSourceGapReasons: null,
  }), ['Source gap: live-scene handover event index is not ready.']);
});

test('passes through source gaps outside the live index surface', () => {
  const sourceGaps = ['source gap from the owning lane'];
  assert.deepEqual(resolveLiveWalkerEventIndexSourceGapReasons({
    ...liveInput,
    sceneSource: 'artifact-replay',
    indexSourceGapReasons: sourceGaps,
  }), sourceGaps);
});
