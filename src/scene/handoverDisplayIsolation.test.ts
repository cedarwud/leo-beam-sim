import assert from 'node:assert/strict';
import {
  resolveHandoverCinemaDisplayMs,
  resolveHandoverCinemaReady,
  resolveHandoverDisplayIsolation,
  resolveInterHandoverCinemaEnvelope,
  resolveInterCinemaFromAnchor,
  resolveInterCinemaPairAnchor,
  shouldSuppressInterSeekFade,
} from './handoverDisplayIsolation';
import { resolveDirectorFocusAutoExitMs } from '../useCameraControls';

function assertIsolated(input: Parameters<typeof resolveHandoverDisplayIsolation>[0]): void {
  const state = resolveHandoverDisplayIsolation(input);
  assert.equal(state.active, true);
  assert.equal(state.hidePrimaryServingBeam, true);
  assert.equal(state.hideCandidateFan, true);
  assert.equal(state.hideTimelinePulse, true);
  assert.equal(state.hideTimelineTriggered, true);
  assert.equal(state.hideTimelineEffects, true);
}

assertIsolated({ manualHandoverActive: true, cinemaCandidateActive: false });
assertIsolated({ manualHandoverActive: false, cinemaCandidateActive: true });

const interCinema = resolveHandoverDisplayIsolation({
  manualHandoverActive: false,
  cinemaCandidateActive: true,
  cinemaCandidateKind: 'inter',
});
assert.equal(interCinema.hideNormalBeamField, true, 'inter cinema hides the normal timeline beam field');
assert.equal(interCinema.showCinemaCandidateFan, true, 'inter cinema restores the candidate satellite fan');

const intraCinema = resolveHandoverDisplayIsolation({
  manualHandoverActive: false,
  cinemaCandidateActive: true,
  cinemaCandidateKind: 'intra',
});
assert.equal(intraCinema.hideNormalBeamField, false, 'intra keeps the existing beam field');
assert.equal(intraCinema.showCinemaCandidateFan, false, 'intra does not add an inter candidate fan');

const capturedFrom = resolveInterCinemaFromAnchor({
  eventId: 'evt-inter',
  captured: null,
  currentServingSatId: 'sat-before-seek',
  currentCellId: 3,
  fallbackSatId: 'sat-event-from',
  fallbackCellId: 8,
});
const stableFrom = resolveInterCinemaFromAnchor({
  eventId: 'evt-inter',
  captured: capturedFrom,
  currentServingSatId: 'sat-after-seek',
  currentCellId: 9,
  fallbackSatId: 'sat-event-from',
  fallbackCellId: 8,
});
assert.deepEqual(stableFrom, capturedFrom, 'inter from identity stays anchored across the seek');

const capturedPair = resolveInterCinemaPairAnchor({
  eventId: 'evt-inter',
  captured: null,
  fallback: {
    fromSatId: 'sat-before-seek',
    fromCellId: 3,
    toSatId: 'sat-event-target',
    toCellId: 8,
    fromApexWorld: { x: 1, y: 2, z: 3 },
    toApexWorld: { x: 4, y: 5, z: 6 },
  },
});
const stablePair = resolveInterCinemaPairAnchor({
  eventId: 'evt-inter',
  captured: capturedPair,
  fallback: {
    fromSatId: 'sat-after-seek',
    fromCellId: 9,
    toSatId: 'sat-next-live-target',
    toCellId: 12,
    fromApexWorld: { x: 10, y: 11, z: 12 },
    toApexWorld: { x: 13, y: 14, z: 15 },
  },
});
assert.deepEqual(
  stablePair,
  capturedPair,
  'inter source and target identities stay latched while the live frame is rebuilt',
);

const idle = resolveHandoverDisplayIsolation({
  manualHandoverActive: false,
  cinemaCandidateActive: false,
});
assert.deepEqual(idle, {
  active: false,
  hidePrimaryServingBeam: false,
  hideCandidateFan: false,
  hideNormalBeamField: false,
  showCinemaCandidateFan: false,
  hideTimelinePulse: false,
  hideTimelineTriggered: false,
  hideTimelineEffects: false,
});

assert.equal(shouldSuppressInterSeekFade('inter'), true, 'inter seek keeps the callback but suppresses the black veil');
assert.equal(shouldSuppressInterSeekFade('intra'), false, 'intra keeps its existing seek presentation');
assert.equal(shouldSuppressInterSeekFade('off'), false, 'idle keeps the existing seek presentation contract');
assert.equal(resolveHandoverCinemaDisplayMs('intra'), 8000, 'intra display duration remains unchanged');
assert.equal(resolveHandoverCinemaDisplayMs('inter'), 6000, 'inter display duration gives the serving beam one extra second');
assert.equal(resolveHandoverCinemaReady({
  active: true,
  kind: 'inter',
  requestedSeekKey: 'seek-next-inter',
  landedSeekKey: null,
}), false, 'inter clock waits for the requested live seek to land');
assert.equal(resolveHandoverCinemaReady({
  active: true,
  kind: 'inter',
  requestedSeekKey: 'seek-next-inter',
  landedSeekKey: 'seek-next-inter',
}), true, 'inter clock starts after the requested live seek lands');
assert.equal(resolveHandoverCinemaReady({
  active: true,
  kind: 'intra',
  requestedSeekKey: null,
  landedSeekKey: null,
}), true, 'intra keeps its existing cinema start contract');
assert.equal(resolveDirectorFocusAutoExitMs('intra'), 20000, 'intra focus hold remains unchanged');
assert.equal(resolveDirectorFocusAutoExitMs('inter'), 6500, 'inter focus hold is bounded separately');

const interPeak = 0.95;
const interBeforeCandidate = resolveInterHandoverCinemaEnvelope(0.24, interPeak);
assert.equal(interBeforeCandidate.phase, 'serving', 'inter keeps the serving phase before the candidate arrives');
assert.equal(interBeforeCandidate.fromOpacity, interPeak, 'inter keeps the source beam fully visible before the candidate arrives');
assert.equal(interBeforeCandidate.toOpacity, 0, 'inter does not show the candidate before the serving phase ends');

const interOverlap = resolveInterHandoverCinemaEnvelope(0.39, interPeak);
assert(interOverlap.fromOpacity > 0 && interOverlap.toOpacity > 0, 'inter keeps both sides visible during the handover overlap');
assert.equal(interOverlap.fromOpacity, interPeak, 'inter does not fade the source while the candidate is first appearing');

const interReleasing = resolveInterHandoverCinemaEnvelope(0.76, interPeak);
assert.equal(interReleasing.phase, 'releasing', 'inter enters release only after the candidate has appeared');
assert(interReleasing.fromOpacity > 0, 'inter source remains visible while it fades out');
assert.equal(interReleasing.toOpacity, interPeak, 'inter candidate is fully visible while the source fades out');

const interSettled = resolveInterHandoverCinemaEnvelope(0.9, interPeak);
assert.equal(interSettled.phase, 'settled', 'inter reaches settled state before the animation ends');
assert.equal(interSettled.fromOpacity, 0, 'inter source is gone only after the overlap and release');
assert.equal(interSettled.toOpacity, interPeak, 'inter candidate remains the settled link');
assert(interSettled.toOpacity > 0 && interSettled.phase === 'settled', 'inter settled tail is present but shorter than the old quarter-window tail');

console.log('handoverDisplayIsolation.test.ts: PASS');
