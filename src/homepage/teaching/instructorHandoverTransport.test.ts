import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  advanceInstructorHandoverTransport,
  closeInstructorHandoverTransport,
  createInstructorHandoverTransportState,
  openInstructorHandoverTransport,
  resolveInstructorHandoverTransportSnapshot,
  restartInstructorHandoverTransport,
  seekInstructorHandoverTransport,
  setInstructorHandoverPaused,
  setInstructorHandoverSpeed,
  type InstructorHandoverSpeed,
  type InstructorHandoverTransportState,
} from './instructorHandoverTransport';

function requireSnapshot(state: InstructorHandoverTransportState) {
  const snapshot = resolveInstructorHandoverTransportSnapshot(state);
  assert.ok(snapshot);
  return snapshot;
}

test('opening Intra owns one complete Intra then Inter source window', () => {
  const opened = openInstructorHandoverTransport(
    createInstructorHandoverTransportState(),
    'intra',
  );
  const snapshot = requireSnapshot(opened);
  assert.equal(snapshot.sourceTimeSec, 0);
  assert.equal(snapshot.segment.kind, 'intra');
  assert.equal(snapshot.windowStartSec, 0);
  assert.equal(snapshot.windowEndSec, 144);
  assert.equal(snapshot.windowDurationSec, 144);
  assert.equal(snapshot.beamCount, 7);
  assert.equal(snapshot.status, 'playing');
});

test('transport advances by source time and crosses into Inter deterministically', () => {
  let state = openInstructorHandoverTransport(createInstructorHandoverTransportState(), 'intra');
  state = advanceInstructorHandoverTransport(state, 71.999);
  assert.equal(requireSnapshot(state).segment.kind, 'intra');
  state = advanceInstructorHandoverTransport(state, 0.001);
  const boundary = requireSnapshot(state);
  assert.equal(boundary.sourceTimeSec, 72);
  assert.equal(boundary.segment.kind, 'inter');
  assert.equal(boundary.segmentTimeSec, 0);
});

test('different playback speeds reach the same source-time position', () => {
  const base = openInstructorHandoverTransport(createInstructorHandoverTransportState(), 'intra');
  const oneX = advanceInstructorHandoverTransport(base, 52);
  const twentyX = advanceInstructorHandoverTransport(
    setInstructorHandoverSpeed(base, 20),
    2.6,
  );
  const a = requireSnapshot(oneX);
  const b = requireSnapshot(twentyX);
  assert.equal(a.sourceTimeSec, b.sourceTimeSec);
  assert.equal(a.segment.kind, b.segment.kind);
  assert.equal(a.segmentTimeSec, b.segmentTimeSec);
});

test('pause is a true source-clock freeze', () => {
  let state = openInstructorHandoverTransport(createInstructorHandoverTransportState(), 'intra');
  state = advanceInstructorHandoverTransport(state, 10);
  state = setInstructorHandoverPaused(state, true);
  const paused = state;
  assert.equal(requireSnapshot(paused).status, 'paused');
  assert.equal(advanceInstructorHandoverTransport(paused, 100), paused);
});

test('seek is reversible and clamps to the selected entry window', () => {
  let intra = openInstructorHandoverTransport(createInstructorHandoverTransportState(), 'intra');
  intra = seekInstructorHandoverTransport(intra, 124);
  assert.equal(requireSnapshot(intra).segment.kind, 'inter');
  intra = seekInstructorHandoverTransport(intra, 12);
  assert.equal(requireSnapshot(intra).segment.kind, 'intra');

  let inter = openInstructorHandoverTransport(createInstructorHandoverTransportState(), 'inter');
  inter = seekInstructorHandoverTransport(inter, 0);
  const interSnapshot = requireSnapshot(inter);
  assert.equal(interSnapshot.sourceTimeSec, 72);
  assert.equal(interSnapshot.segment.kind, 'inter');
  assert.equal(interSnapshot.windowStartSec, 72);
  assert.equal(interSnapshot.windowEndSec, 144);
  assert.equal(interSnapshot.windowDurationSec, 72);
});

test('restart resets every transport field that can leak a prior run', () => {
  let state = openInstructorHandoverTransport(createInstructorHandoverTransportState(), 'intra');
  state = setInstructorHandoverSpeed(state, 5);
  state = seekInstructorHandoverTransport(state, 124);
  state = setInstructorHandoverPaused(state, true);
  const priorRunId = state.runId;
  state = restartInstructorHandoverTransport(state);
  const reset = requireSnapshot(state);
  assert.equal(reset.runId, priorRunId + 1);
  assert.equal(reset.sourceTimeSec, 0);
  assert.equal(reset.segment.kind, 'intra');
  assert.equal(reset.segmentTimeSec, 0);
  assert.equal(reset.status, 'playing');
  assert.equal(reset.speed, 5);
});

test('completion is explicit and Play at end restarts the same entry', () => {
  let state = openInstructorHandoverTransport(createInstructorHandoverTransportState(), 'inter');
  state = advanceInstructorHandoverTransport(state, 1000);
  const completed = requireSnapshot(state);
  assert.equal(completed.sourceTimeSec, 144);
  assert.equal(completed.status, 'complete');
  assert.equal(
    setInstructorHandoverPaused(state, true),
    state,
    'Pause at the end must preserve the explicit complete state',
  );
  const priorRunId = completed.runId;
  state = setInstructorHandoverPaused(state, false);
  const replay = requireSnapshot(state);
  assert.equal(replay.runId, priorRunId + 1);
  assert.equal(replay.sourceTimeSec, 72);
  assert.equal(replay.segment.kind, 'inter');
  assert.equal(replay.status, 'playing');
});

test('invalid deltas and speeds fail closed', () => {
  const state = openInstructorHandoverTransport(createInstructorHandoverTransportState(), 'intra');
  assert.equal(advanceInstructorHandoverTransport(state, Number.NaN), state);
  assert.equal(advanceInstructorHandoverTransport(state, -1), state);
  assert.equal(
    setInstructorHandoverSpeed(state, 3 as InstructorHandoverSpeed),
    state,
  );
});

test('close removes the scenario rather than retaining a hidden active segment', () => {
  const state = closeInstructorHandoverTransport(
    openInstructorHandoverTransport(createInstructorHandoverTransportState(), 'intra'),
  );
  assert.equal(resolveInstructorHandoverTransportSnapshot(state), null);
  assert.equal(state.entryKind, null);
  assert.equal(state.status, 'closed');
});

test('the pure transport owns no wall clock or browser runtime', async () => {
  const source = await readFile(
    new URL('./instructorHandoverTransport.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /Date\.now|performance\.now|requestAnimationFrame|setTimeout|setInterval/,
  );
});
