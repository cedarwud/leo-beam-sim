import assert from 'node:assert/strict';
import test from 'node:test';

import { candidateLinkKey } from '../../engine/handover/candidateDecisionContract';
import { createCandidateInspectionStore } from './candidateInspectionSelection';

const pairA = candidateLinkKey('SAT-A', 3);
const pairB = candidateLinkKey('SAT-B', 1);
const pairC = candidateLinkKey('SAT-C', 2);

test('candidate inspection selection is episode-scoped and presentation-only', () => {
  const store = createCandidateInspectionStore();
  const updates: number[] = [];
  const unsubscribe = store.subscribe(() => updates.push(store.getSnapshot().revision));

  store.activateSnapshot({ episodeId: 'episode-a', snapshotId: 'snapshot-1', validKeys: [pairA] });
  const accepted = store.setPinnedRequest({
    episodeId: 'episode-a',
    basedOnSnapshotId: 'snapshot-1',
    pinnedKey: pairA,
  });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.reason, 'accepted');
  assert.equal(store.getSnapshot().basedOnSnapshotId, 'snapshot-1');
  assert.deepEqual(store.getSnapshot().pinnedKey, pairA);
  assert.notEqual(store.getSnapshot().pinnedKey, pairA, 'the store owns an immutable key copy');

  const toggledOff = store.togglePinnedRequest({
    episodeId: 'episode-a',
    basedOnSnapshotId: 'snapshot-1',
    pinnedKey: pairA,
  });
  assert.equal(toggledOff.accepted, true);
  assert.equal(store.getSnapshot().pinnedKey, null);

  const toggledOn = store.togglePinnedRequest({
    episodeId: 'episode-a',
    basedOnSnapshotId: 'snapshot-1',
    pinnedKey: pairA,
  });
  assert.equal(toggledOn.accepted, true);
  assert.deepEqual(store.getSnapshot().pinnedKey, pairA);

  store.activateSnapshot({ episodeId: 'episode-b', snapshotId: 'snapshot-b', validKeys: [pairB] });
  assert.equal(store.getSnapshot().episodeId, 'episode-b');
  assert.equal(store.getSnapshot().basedOnSnapshotId, 'snapshot-b');
  assert.equal(store.getSnapshot().pinnedKey, null, 'a new episode cannot inherit an old pin');

  const revisionBeforeNoop = store.getSnapshot().revision;
  store.setPinnedRequest({
    episodeId: 'episode-b',
    basedOnSnapshotId: 'snapshot-b',
    pinnedKey: null,
  });
  assert.equal(store.getSnapshot().revision, revisionBeforeNoop, 'idempotent writes do not repaint');
  assert.deepEqual(updates, [1, 2, 3, 4, 5]);
  unsubscribe();
});

test('an accepted snapshot advance revalidates a retained pin and updates its anchor', () => {
  const store = createCandidateInspectionStore();
  store.activateSnapshot({ episodeId: 'episode-a', snapshotId: 'snapshot-1', validKeys: [pairA, pairB] });
  store.setPinnedRequest({ episodeId: 'episode-a', basedOnSnapshotId: 'snapshot-1', pinnedKey: pairA });

  const result = store.activateSnapshot({
    episodeId: 'episode-a',
    snapshotId: 'snapshot-2',
    validKeys: [pairA, pairB],
  });
  assert.equal(result.accepted, true);
  assert.equal(result.revalidated, true);
  assert.equal(result.reason, 'stale-snapshot-revalidated');
  assert.equal(store.getSnapshot().basedOnSnapshotId, 'snapshot-2');
  assert.deepEqual(store.getSnapshot().pinnedKey, pairA);
  assert.equal(store.getSnapshot().pinResolution?.reason, 'stale-snapshot-revalidated');
});

test('a stale request is revalidated against the latest accepted key set', () => {
  const store = createCandidateInspectionStore();
  store.activateSnapshot({ episodeId: 'episode-a', snapshotId: 'snapshot-1', validKeys: [pairA] });

  // The request was emitted before publication advanced. It is accepted only
  // because the pair is still present in the latest accepted snapshot.
  store.activateSnapshot({ episodeId: 'episode-a', snapshotId: 'snapshot-2', validKeys: [pairA, pairB] });
  const result = store.setPinnedRequest({
    episodeId: 'episode-a',
    basedOnSnapshotId: 'snapshot-1',
    pinnedKey: pairB,
  });
  assert.equal(result.accepted, true);
  assert.equal(result.revalidated, true);
  assert.equal(result.reason, 'stale-snapshot-revalidated');
  assert.equal(store.getSnapshot().basedOnSnapshotId, 'snapshot-2');
  assert.deepEqual(store.getSnapshot().pinnedKey, pairB);
});

test('an absent stale pair is rejected without evicting a newer pin', () => {
  const store = createCandidateInspectionStore();
  store.activateSnapshot({ episodeId: 'episode-a', snapshotId: 'snapshot-1', validKeys: [pairA, pairB] });
  store.setPinnedRequest({ episodeId: 'episode-a', basedOnSnapshotId: 'snapshot-1', pinnedKey: pairA });
  store.activateSnapshot({ episodeId: 'episode-a', snapshotId: 'snapshot-2', validKeys: [pairA] });

  const result = store.setPinnedRequest({
    episodeId: 'episode-a',
    basedOnSnapshotId: 'snapshot-1',
    pinnedKey: pairB,
  });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'pair-not-present');
  assert.deepEqual(store.getSnapshot().pinnedKey, pairA, 'a stale request cannot evict a newer pin');
  assert.equal(store.getSnapshot().basedOnSnapshotId, 'snapshot-2');
});

test('episode-mismatched and unanchored requests fail closed', () => {
  const store = createCandidateInspectionStore();
  store.activateSnapshot({ episodeId: 'episode-a', snapshotId: 'snapshot-1', validKeys: [pairA] });

  const wrongEpisode = store.setPinnedRequest({
    episodeId: 'episode-old',
    basedOnSnapshotId: 'snapshot-1',
    pinnedKey: pairA,
  });
  assert.equal(wrongEpisode.accepted, false);
  assert.equal(wrongEpisode.reason, 'episode-mismatch');
  assert.equal(store.getSnapshot().pinnedKey, null);

  const other = createCandidateInspectionStore();
  other.activateEpisode('episode-a');
  const unanchored = other.setPinnedKey('episode-a', pairA);
  assert.equal(unanchored.accepted, false);
  assert.equal(unanchored.reason, 'snapshot-unavailable');
  assert.equal(other.getSnapshot().pinnedKey, null);
});

test('a stale clear request is safe and never resurrects a pin', () => {
  const store = createCandidateInspectionStore();
  store.activateSnapshot({ episodeId: 'episode-a', snapshotId: 'snapshot-1', validKeys: [pairA, pairC] });
  store.setPinnedRequest({ episodeId: 'episode-a', basedOnSnapshotId: 'snapshot-1', pinnedKey: pairA });
  store.activateSnapshot({ episodeId: 'episode-a', snapshotId: 'snapshot-2', validKeys: [pairA, pairC] });

  const result = store.setPinnedRequest({
    episodeId: 'episode-a',
    basedOnSnapshotId: 'snapshot-1',
    pinnedKey: null,
  });
  assert.equal(result.accepted, true);
  assert.equal(store.getSnapshot().pinnedKey, null);
  assert.equal(store.getSnapshot().basedOnSnapshotId, 'snapshot-2');
});
