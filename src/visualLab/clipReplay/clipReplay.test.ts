import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  VISUAL_LAB_CLIP_IDS,
  VISUAL_LAB_CLIP_UNPUBLISHED_REASON,
  clipEntryCanLaunch,
  clipEntryLaunchTarget,
  createVisualLabClipEntries,
  createVisualLabClipReplayState,
  launchVisualLabClip,
  selectVisualLabClip,
  selectedVisualLabClip,
  setVisualLabClipLaunchState,
} from './model';

const entrySource = await readFile(new URL('./VisualLabClipEntry.tsx', import.meta.url), 'utf8');
const styleSource = await readFile(new URL('./VisualLabClipEntry.scss', import.meta.url), 'utf8');

assert.deepEqual(VISUAL_LAB_CLIP_IDS, [
  'inter-handover',
  'intra-beam-handover',
  'link-gain-ab',
  'power-cap-ab',
]);
for (const id of VISUAL_LAB_CLIP_IDS) {
  assert.match(entrySource, /data-clip-id/);
  assert.match(entrySource, /data-clip-action="select"/);
  assert.match(entrySource, /data-clip-action="launch"/);
  assert.match(styleSource, /min-height: 44px/);
  assert.match(styleSource, /font-size: 14px/);
  void id;
}
assert.match(entrySource, /onSelect/);
assert.match(entrySource, /onLaunch/);
assert.match(entrySource, /aria-pressed/);
assert.match(entrySource, /aria-disabled/);
assert.match(entrySource, /data-clip-status/);
assert.match(entrySource, /data-clip-launchable/);
assert.match(styleSource, /--vlab-bg/);
assert.match(styleSource, /--clip-service/);
assert.match(styleSource, /--light/);
assert.match(styleSource, /prefers-reduced-motion/);
assert.doesNotMatch(entrySource, /fake|mock|placeholder/i);

const unavailable = createVisualLabClipEntries();
assert.equal(unavailable.length, 4);
assert.ok(unavailable.every(entry => entry.status === 'unavailable'));
assert.equal(unavailable[0]?.reason, VISUAL_LAB_CLIP_UNPUBLISHED_REASON);
assert.ok(unavailable.every(entry => !clipEntryCanLaunch(entry)));

const pendingWithoutReason = createVisualLabClipEntries({
  'inter-handover': { status: 'pending', reason: null, runtimeId: 'pending-inter' },
});
assert.equal(pendingWithoutReason[0]?.status, 'pending');
assert.ok(pendingWithoutReason[0]?.reason, 'pending source state retains an explanation');
assert.ok(!clipEntryCanLaunch(pendingWithoutReason[0]!));

const availableWithoutRuntime = createVisualLabClipEntries({
  'inter-handover': { status: 'available', reason: null, runtimeId: null },
});
assert.equal(availableWithoutRuntime[0]?.status, 'unavailable');
assert.equal(availableWithoutRuntime[0]?.reason, 'This replay has no launchable runtime target.');
assert.ok(!clipEntryCanLaunch(availableWithoutRuntime[0]!));

const available = createVisualLabClipEntries({
  'inter-handover': {
    status: 'available',
    reason: null,
    runtimeId: 'event-123',
    sourceLabel: 'SAT-A → SAT-B',
  },
  'intra-beam-handover': {
    status: 'pending',
    reason: 'trace pending',
    runtimeId: 'intra-handover',
  },
  'link-gain-ab': {
    status: 'available',
    reason: null,
    runtimeId: 'beamwidth',
  },
  'power-cap-ab': {
    status: 'available',
    reason: null,
    runtimeId: 'power-cap',
  },
});
const preparable = createVisualLabClipEntries({
  'intra-beam-handover': {
    status: 'preparing',
    reason: 'beam-hopping trace will be built from the accepted TLE run',
    runtimeId: 'intra-handover',
  },
});
assert.equal(preparable[1]?.status, 'preparing');
assert.ok(clipEntryCanLaunch(preparable[1]!));
assert.deepEqual(clipEntryLaunchTarget(preparable[1]!), {
  clipId: 'intra-beam-handover',
  runtime: 'guided',
  runtimeId: 'intra-handover',
});
assert.equal(available[0]?.status, 'available');
assert.deepEqual(clipEntryLaunchTarget(available[0]!), {
  clipId: 'inter-handover',
  runtime: 'guided',
  runtimeId: 'event-123',
});
assert.equal(clipEntryLaunchTarget(available[1]!), null);
assert.deepEqual(clipEntryLaunchTarget(available[2]!), {
  clipId: 'link-gain-ab',
  runtime: 'causal',
  runtimeId: 'beamwidth',
});
assert.deepEqual(clipEntryLaunchTarget(available[3]!), {
  clipId: 'power-cap-ab',
  runtime: 'causal',
  runtimeId: 'power-cap',
});

const firstPlayable = createVisualLabClipReplayState(
  createVisualLabClipEntries({
    'inter-handover': { status: 'unavailable', reason: 'accepted inter trace missing', runtimeId: null },
    'intra-beam-handover': { status: 'pending', reason: 'accepted beam trace pending', runtimeId: 'intra-handover' },
  }),
);
assert.equal(firstPlayable.selectedClipId, 'intra-beam-handover');

let state = createVisualLabClipReplayState(available, 'power-cap-ab');
assert.equal(state.selectedClipId, 'power-cap-ab');
assert.equal(selectedVisualLabClip(state)?.id, 'power-cap-ab');
state = selectVisualLabClip(state, 'inter-handover');
assert.equal(state.selectedClipId, 'inter-handover');
assert.equal(selectedVisualLabClip(state)?.sourceLabel, 'SAT-A → SAT-B');
assert.equal(selectVisualLabClip(state, 'not-a-clip' as never), state);
state = setVisualLabClipLaunchState(state, 'launching');
assert.equal(state.launchState, 'launching');
state = setVisualLabClipLaunchState(state, 'error', 'launch failed');
assert.equal(state.error, 'launch failed');
const prepared = launchVisualLabClip(createVisualLabClipReplayState(available), 'link-gain-ab');
assert.equal(prepared?.state.launchState, 'launching');
assert.deepEqual(prepared?.target, {
  clipId: 'link-gain-ab',
  runtime: 'causal',
  runtimeId: 'beamwidth',
});
assert.equal(launchVisualLabClip(createVisualLabClipReplayState(unavailable), 'power-cap-ab'), null);

console.log('visual-lab clip replay entry/model contract tests passed');
