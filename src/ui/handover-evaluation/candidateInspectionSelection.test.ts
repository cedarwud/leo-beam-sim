import assert from 'node:assert/strict';
import test from 'node:test';

import { candidateLinkKey } from '../../engine/handover/candidateDecisionContract';
import { createCandidateInspectionStore } from './candidateInspectionSelection';

test('candidate inspection selection is episode-scoped and presentation-only', () => {
  const store = createCandidateInspectionStore();
  const updates: number[] = [];
  const unsubscribe = store.subscribe(() => updates.push(store.getSnapshot().revision));

  store.activateEpisode('episode-a');
  const pair = candidateLinkKey('SAT-A', 3);
  store.setPinnedKey('episode-a', pair);
  assert.deepEqual(store.getSnapshot().pinnedKey, pair);
  assert.notEqual(store.getSnapshot().pinnedKey, pair, 'the store owns an immutable key copy');

  store.togglePinnedKey('episode-a', pair);
  assert.equal(store.getSnapshot().pinnedKey, null);
  store.togglePinnedKey('episode-a', pair);
  assert.deepEqual(store.getSnapshot().pinnedKey, pair);

  store.activateEpisode('episode-b');
  assert.equal(store.getSnapshot().episodeId, 'episode-b');
  assert.equal(store.getSnapshot().pinnedKey, null, 'a new episode cannot inherit an old pin');

  const revisionBeforeNoop = store.getSnapshot().revision;
  store.setPinnedKey('episode-b', null);
  assert.equal(store.getSnapshot().revision, revisionBeforeNoop, 'idempotent writes do not repaint');
  assert.deepEqual(updates, [1, 2, 3, 4, 5]);
  unsubscribe();
});
