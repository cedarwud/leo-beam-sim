import assert from 'node:assert/strict';

import type { VisualLabGuidedReplayProgress } from '../../visualLab/guidedReplay';
import type { VisualLabStorySceneDirection } from '../../visualLab/story';
import type { VisualLabLocalHandover } from './visualLabLocalSceneAdapter';
import {
  canonicalHandoverPresentation,
  guidedHandoverPresentation,
  VISUAL_LAB_HANDOVER_CROSSFADE_SEC,
} from './visualLabHandoverPresentation';

const handover = (patch: Partial<VisualLabLocalHandover>): VisualLabLocalHandover => ({
  availability: 'available',
  state: 'attached',
  event: 'none',
  anchorIndex: 0,
  progressSec: 0,
  tttSec: 30,
  ratio: 0,
  servingSatelliteId: 'sat-a',
  candidateSatelliteId: 'sat-b',
  eventFromSatelliteId: null,
  eventToSatelliteId: null,
  reason: null,
  ...patch,
});

assert.equal(canonicalHandoverPresentation(handover({}), 12), null);
assert.equal(
  canonicalHandoverPresentation(handover({ availability: 'unavailable', state: 'pending' }), 0),
  null,
  'an unavailable candidate never opens a visual handover window',
);
assert.equal(
  canonicalHandoverPresentation(handover({ state: 'attached', event: 'inter-handover', eventFromSatelliteId: 'sat-a', eventToSatelliteId: 'sat-b' }), 0),
  null,
  'an event label without a committed state cannot manufacture a switch',
);
assert.equal(
  canonicalHandoverPresentation(handover({ state: 'pending', servingSatelliteId: '', candidateSatelliteId: 'sat-b' }), 0),
  null,
  'empty identities fail closed',
);

const pendingStart = canonicalHandoverPresentation(handover({ state: 'pending' }), 0);
const pendingLate = canonicalHandoverPresentation(handover({ state: 'pending' }), 24);
assert.ok(pendingStart && pendingLate);
assert.equal(pendingStart.phase, 'qualification');
assert.equal(pendingStart.targetCandidateOpacity, 0, 'qualification begins without a candidate fan');
assert.ok(pendingLate.targetCandidateOpacity > pendingStart.targetCandidateOpacity);
assert.ok(pendingLate.sourceBeamOpacity < pendingStart.sourceBeamOpacity);
assert.equal(pendingLate.targetServiceOpacity, 0);

const committed = handover({
  state: 'handover',
  event: 'inter-handover',
  servingSatelliteId: 'sat-b',
  eventFromSatelliteId: 'sat-a',
  eventToSatelliteId: 'sat-b',
});
const switchStart = canonicalHandoverPresentation(committed, 0);
const switchMiddle = canonicalHandoverPresentation(committed, VISUAL_LAB_HANDOVER_CROSSFADE_SEC / 2);
const settled = canonicalHandoverPresentation(committed, VISUAL_LAB_HANDOVER_CROSSFADE_SEC);
assert.ok(switchStart && switchMiddle);
assert.equal(switchStart.sourceBeamOpacity, 1);
assert.ok(switchStart.targetCandidateOpacity >= .22, 'the accepted blue candidate remains visible at the event anchor');
assert.ok(switchMiddle.sourceBeamOpacity < switchStart.sourceBeamOpacity);
assert.ok(switchMiddle.targetCandidateOpacity > switchStart.targetCandidateOpacity);
assert.ok(switchMiddle.targetServiceOpacity < 1);
assert.ok(settled);
assert.equal(settled.phase, 'settled');
assert.equal(settled.sourceBeamOpacity, 0);
assert.equal(settled.targetCandidateOpacity, 0);
assert.equal(settled.targetServiceOpacity, 1);
const settledContinuation = canonicalHandoverPresentation(
  { ...committed, presentationPhase: 'settled' },
  0,
);
assert.ok(settledContinuation);
assert.equal(settledContinuation.phase, 'settled');
assert.equal(settledContinuation.sourceBeamOpacity, 0);
assert.equal(settledContinuation.targetServiceOpacity, 1);

const direction: VisualLabStorySceneDirection = {
  storyId: 'event-1',
  storyKind: 'inter-handover',
  beat: 'decision',
  cameraCue: 'handover-decision',
  fromSatelliteId: 'sat-a',
  toSatelliteId: 'sat-b',
  fromBeamId: null,
  toBeamId: null,
  userIndex: null,
  revision: 'event-1:decision',
};
const progress = (stage: VisualLabGuidedReplayProgress['stage'], phaseFraction: number): VisualLabGuidedReplayProgress => ({
  stage,
  phaseElapsedMs: phaseFraction * 3_000,
  phaseDurationMs: 3_000,
  phaseFraction,
  overallFraction: phaseFraction,
  candidateEngaged: stage === 'candidate-approach' || stage === 'qualification' || stage === 'switch',
});
const guidedStart = guidedHandoverPresentation(direction, progress('setup', 0));
const guidedSwitch = guidedHandoverPresentation(direction, progress('switch', .75));
const guidedSettled = guidedHandoverPresentation(direction, progress('settle', .2));
assert.ok(guidedStart && guidedSwitch && guidedSettled);
assert.equal(guidedStart.targetCandidateOpacity, 0);
assert.ok(guidedSwitch.sourceBeamOpacity < 1);
assert.ok(guidedSwitch.targetCandidateOpacity > 0 || guidedSwitch.targetServiceOpacity > 0);
assert.equal(guidedSettled.sourceBeamOpacity, 0);
assert.equal(guidedSettled.targetServiceOpacity, 1);

console.log('visual-lab handover presentation uses source-backed identities and a readable crossfade');
