import assert from 'node:assert/strict';
import {
  resolveHandoverCinemaDisplayMs,
  resolveHandoverCinemaReady,
  resolveHandoverDisplayIsolation,
  resolveInterHandoverCinemaEnvelope,
  resolveInterCinemaFromAnchor,
  resolveInterCinemaPairAnchor,
  selectHandoverEventsForDisplay,
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
  assert.equal(state.suppressNaturalHandoverLayers, true);
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

const interCinemaPending = resolveHandoverDisplayIsolation({
  manualHandoverActive: false,
  cinemaCandidateActive: false,
  cinemaCandidateArmed: true,
  cinemaCandidateReady: false,
  cinemaCandidateKind: 'inter',
  presentationSource: 'cinema',
});
assert.equal(interCinemaPending.active, false, 'a cinema seek arm does not claim a drawable handover before the frame lands');
assert.equal(interCinemaPending.hidePrimaryServingBeam, false, 'the current serving beam remains visible during the seek arm');
assert.equal(interCinemaPending.hideNormalBeamField, false, 'the normal serving field remains visible during the seek arm');
assert.equal(interCinemaPending.hideCandidateFan, true, 'the stale live candidate fan is hidden during the seek arm');
assert.equal(interCinemaPending.hideTimelinePulse, true, 'natural timeline pulses cannot leak into the cinema seek arm');
assert.equal(interCinemaPending.suppressNaturalHandoverLayers, true, 'natural effects cannot leak into the cinema seek arm');

const manualArmed = resolveHandoverDisplayIsolation({
  manualHandoverActive: false,
  manualHandoverRequested: true,
  cinemaCandidateActive: false,
});
assert.equal(manualArmed.active, false, 'an unresolved manual cue does not claim a drawable transition');
assert.equal(manualArmed.suppressNaturalHandoverLayers, true, 'an unresolved manual cue still suppresses natural effects');

const retainedEvents = [
  { ueId: 'ue-other', sourceTimeSec: 12, marker: 'other' },
  { ueId: 'ue-primary', sourceTimeSec: 10, marker: 'old-primary' },
  { ueId: 'ue-primary', sourceTimeSec: 14, marker: 'latest-primary' },
] as const;
assert.deepEqual(
  selectHandoverEventsForDisplay(retainedEvents, 'ue-primary', false),
  [retainedEvents[2]],
  'the default display owner paints only the latest protagonist handover',
);
assert.deepEqual(
  selectHandoverEventsForDisplay(retainedEvents, 'ue-primary', true),
  retainedEvents,
  'the explicit other-UE display switch may widen the display set without changing truth',
);

const intraCinema = resolveHandoverDisplayIsolation({
  manualHandoverActive: false,
  cinemaCandidateActive: true,
  cinemaCandidateKind: 'intra',
});
assert.equal(intraCinema.hideNormalBeamField, false, 'intra keeps the existing beam field');
assert.equal(intraCinema.showCinemaCandidateFan, false, 'intra does not add an inter candidate fan');

const naturalWalkerEvent = resolveHandoverDisplayIsolation({
  manualHandoverActive: true,
  cinemaCandidateActive: true,
  cinemaCandidateKind: 'inter',
  presentationSource: 'walker',
});
assert.deepEqual(
  naturalWalkerEvent,
  {
    active: false,
    hidePrimaryServingBeam: false,
    hideCandidateFan: false,
    hideNormalBeamField: false,
    showCinemaCandidateFan: false,
    hideTimelinePulse: false,
    hideTimelineTriggered: false,
    hideTimelineEffects: false,
    suppressNaturalHandoverLayers: false,
  },
  'a natural Walker event must not take ownership of the teaching isolation layer',
);

const naturalPresentationBusy = resolveHandoverDisplayIsolation({
  manualHandoverActive: false,
  cinemaCandidateActive: false,
  cinemaCandidateArmed: true,
  cinemaCandidateReady: false,
  cinemaCandidateKind: 'inter',
  presentationSource: 'walker',
  presentationMode: 'presenting',
});
assert.equal(
  naturalPresentationBusy.suppressNaturalHandoverLayers,
  false,
  'an armed cinema request cannot suppress the natural owner while it is presenting',
);

const naturalInterPresentation = resolveHandoverDisplayIsolation({
  manualHandoverActive: false,
  cinemaCandidateActive: false,
  presentationSource: 'walker',
  naturalPresentationActive: true,
  presentationKind: 'inter',
  presentationMode: 'presenting',
});
assert.equal(naturalInterPresentation.active, true, 'the normalized natural inter owner claims the viewport');
assert.equal(naturalInterPresentation.hideNormalBeamField, true, 'natural inter replaces the live beam field with its latched pair');
assert.equal(naturalInterPresentation.showCinemaCandidateFan, true, 'natural inter paints the candidate satellite fan through the same owner');
assert.equal(naturalInterPresentation.suppressNaturalHandoverLayers, true, 'natural inter suppresses competing timeline effects');

const naturalInterCandidatePending = resolveHandoverDisplayIsolation({
  manualHandoverActive: false,
  cinemaCandidateActive: false,
  naturalInterCandidatePending: true,
});
assert.equal(naturalInterCandidatePending.active, false, 'a pending inter candidate does not claim the story before the event fires');
assert.equal(naturalInterCandidatePending.hidePrimaryServingBeam, false, 'the serving beam remains visible during the pre-fire candidate window');
assert.equal(naturalInterCandidatePending.hideCandidateFan, true, 'the pre-fire candidate cannot paint a competing ordinary fan');
assert.equal(naturalInterCandidatePending.hideNormalBeamField, false, 'the normal serving field remains visible before the story owner starts');
assert.equal(naturalInterCandidatePending.showCinemaCandidateFan, false, 'the normalized target fan is not shown before the story owner starts');

const naturalIntraPresentation = resolveHandoverDisplayIsolation({
  manualHandoverActive: false,
  cinemaCandidateActive: false,
  presentationSource: 'walker',
  naturalPresentationActive: true,
  presentationKind: 'intra',
  presentationMode: 'presenting',
});
assert.equal(naturalIntraPresentation.active, false, 'natural intra keeps the ordinary field and pulse path');

const presentationCooldown = resolveHandoverDisplayIsolation({
  manualHandoverActive: false,
  cinemaCandidateActive: false,
  cinemaCandidateArmed: true,
  cinemaCandidateReady: false,
  cinemaCandidateKind: 'inter',
  presentationMode: 'cooldown',
});
assert.equal(
  presentationCooldown.suppressNaturalHandoverLayers,
  false,
  'the shared cooldown cannot be converted into a second cinema owner',
);

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
  suppressNaturalHandoverLayers: false,
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
const interBeforeCandidate = resolveInterHandoverCinemaEnvelope(0.12, interPeak);
assert.equal(interBeforeCandidate.phase, 'serving', 'inter keeps the serving phase before the candidate arrives');
assert.equal(interBeforeCandidate.fromOpacity, interPeak, 'inter keeps the source beam fully visible before the candidate arrives');
assert.equal(interBeforeCandidate.toOpacity, 0, 'inter does not show the candidate before the serving phase ends');

const interOverlap = resolveInterHandoverCinemaEnvelope(0.3, interPeak);
assert(interOverlap.fromOpacity > 0 && interOverlap.toOpacity > 0, 'inter keeps both sides visible during the handover overlap');
assert.equal(interOverlap.fromOpacity, interPeak, 'inter does not fade the source while the candidate is first appearing');

const interReleasing = resolveInterHandoverCinemaEnvelope(0.7, interPeak);
assert.equal(interReleasing.phase, 'releasing', 'inter enters release only after the candidate has appeared');
assert(interReleasing.fromOpacity > 0, 'inter source remains visible while it fades out');
assert.equal(interReleasing.toOpacity, interPeak, 'inter candidate is fully visible while the source fades out');

const interSettled = resolveInterHandoverCinemaEnvelope(0.9, interPeak);
assert.equal(interSettled.phase, 'settled', 'inter reaches settled state before the animation ends');
assert.equal(interSettled.fromOpacity, 0, 'inter source is gone only after the overlap and release');
assert.equal(interSettled.toOpacity, interPeak, 'inter candidate remains the settled link');
assert(interSettled.toOpacity > 0 && interSettled.phase === 'settled', 'inter settled tail is present but shorter than the old quarter-window tail');

console.log('handoverDisplayIsolation.test.ts: PASS');
