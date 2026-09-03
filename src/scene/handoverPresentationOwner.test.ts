import assert from 'node:assert/strict';

import { HANDOVER_CONE_PHASE_END } from '../constants/sinrLiveConeStyle';
import { resolveLegacyAutoSlowActive } from '../usePlaybackControls';
import {
  advanceHandoverPresentation,
  createHandoverPresentationState,
  resolveHandoverPresentationPhase,
  type HandoverPresentationEvent,
} from './handoverPresentationOwner';

assert.equal(
  resolveLegacyAutoSlowActive({ visibleHandoverActive: false }),
  false,
  'a pending candidate without a drawable handover must not enable HO Slow',
);

assert.equal(
  resolveLegacyAutoSlowActive({ visibleHandoverActive: true }),
  true,
  'a drawable active handover enables HO Slow',
);

assert.equal(
  resolveLegacyAutoSlowActive({ visibleHandoverActive: false, candidateComparisonActive: true }),
  true,
  'a real multi-candidate comparison enables display-only focus speed',
);

const walkerEvent: HandoverPresentationEvent = {
  eventId: 'walker-inter-1',
  source: 'walker',
  kind: 'inter',
  from: { satId: 'sat-a', cellId: 2, drawable: true },
  to: { satId: 'sat-b', cellId: 2, drawable: true },
  durationMs: 6000,
};

const started = advanceHandoverPresentation(createHandoverPresentationState(), {
  nowMs: 1000,
  candidate: walkerEvent,
});
assert.equal(started.view.active, true);
assert.equal(started.view.autoSlowActive, true);
assert.equal(started.view.phase, 'serving');

const competingEvent: HandoverPresentationEvent = {
  ...walkerEvent,
  eventId: 'walker-inter-2',
  from: { satId: 'sat-b', cellId: 2, drawable: true },
  to: { satId: 'sat-c', cellId: 2, drawable: true },
};
const notPreempted = advanceHandoverPresentation(started.state, {
  nowMs: 2000,
  candidate: competingEvent,
});
assert.equal(notPreempted.view.event?.eventId, walkerEvent.eventId);

const manualEvent: HandoverPresentationEvent = {
  ...walkerEvent,
  eventId: 'manual-intra-1',
  source: 'manual',
  kind: 'intra',
  from: { satId: 'sat-a', cellId: 2, drawable: true },
  to: { satId: 'sat-a', cellId: 3, drawable: true },
  durationMs: 8000,
};
const sameCellIntraEvent: HandoverPresentationEvent = {
  ...manualEvent,
  eventId: 'natural-intra-same-cell-1',
  from: { satId: 'sat-a', cellId: 2, beamId: 3, drawable: true },
  to: { satId: 'sat-a', cellId: 2, beamId: 423, drawable: true },
};
const sameCellIntraStarted = advanceHandoverPresentation(createHandoverPresentationState(), {
  nowMs: 2000,
  candidate: sameCellIntraEvent,
});
assert.equal(sameCellIntraStarted.view.active, true, 'same-cell intra with distinct beam ids is drawable');
assert.equal(sameCellIntraStarted.view.event?.from.beamId, 3);
assert.equal(sameCellIntraStarted.view.event?.to.beamId, 423);

const intraPhaseSamples = [
  { progress01: 0.1, phase: 'serving' },
  { progress01: HANDOVER_CONE_PHASE_END.serving + 0.001, phase: 'measuring' },
  { progress01: HANDOVER_CONE_PHASE_END.measuring + 0.001, phase: 'holding' },
  { progress01: HANDOVER_CONE_PHASE_END.holding + 0.001, phase: 'releasing' },
  { progress01: HANDOVER_CONE_PHASE_END.releasing + 0.001, phase: 'settled' },
] as const;
for (const sample of intraPhaseSamples) {
  const stepped = advanceHandoverPresentation(sameCellIntraStarted.state, {
    nowMs: 2000 + 8000 * sample.progress01,
    candidate: sameCellIntraEvent,
  });
  assert.equal(
    stepped.view.phase,
    sample.phase,
    `intra owner phase follows the shared cone boundary at ${sample.progress01}`,
  );
}

const manualStarted = advanceHandoverPresentation(started.state, {
  nowMs: 2100,
  candidate: manualEvent,
  owner: 'manual',
});
assert.equal(manualStarted.view.event?.eventId, walkerEvent.eventId, 'a manual teaching owner cannot preempt a natural event');
assert.equal(manualStarted.view.event?.source, 'walker');

const cinemaCandidate: HandoverPresentationEvent = {
  ...walkerEvent,
  eventId: 'cinema-inter-1',
  source: 'cinema',
};
const cinemaArm = advanceHandoverPresentation(started.state, {
  nowMs: 2100,
  candidate: null,
  owner: 'cinema',
});
assert.equal(cinemaArm.view.event?.eventId, walkerEvent.eventId, 'an explicit cinema arm cannot clear an active natural story');
const cinemaStarted = advanceHandoverPresentation(cinemaArm.state, {
  nowMs: 2200,
  candidate: cinemaCandidate,
  owner: 'cinema',
});
assert.equal(cinemaStarted.view.event?.eventId, walkerEvent.eventId, 'a landed cinema candidate waits for the active story to finish');

const completed = advanceHandoverPresentation(notPreempted.state, {
  nowMs: 7100,
  candidate: competingEvent,
});
assert.equal(completed.state.mode, 'cooldown');
assert.equal(completed.view.active, false);
assert.equal(completed.view.autoSlowActive, false);

const cooldown = advanceHandoverPresentation(completed.state, {
  nowMs: 8000,
  candidate: competingEvent,
});
assert.equal(cooldown.view.active, false, 'a rapid second handover is suppressed during cooldown');
const staleAfterCooldown = advanceHandoverPresentation(cooldown.state, {
  nowMs: 9000,
  candidate: competingEvent,
});
assert.equal(staleAfterCooldown.view.active, false, 'an event seen during cooldown is not replayed afterward');

const tleEvent: HandoverPresentationEvent = {
  ...walkerEvent,
  eventId: 'tle-inter-1',
  source: 'tle',
};
const tleStarted = advanceHandoverPresentation(staleAfterCooldown.state, {
  nowMs: 9100,
  candidate: tleEvent,
});
assert.equal(tleStarted.view.active, true, 'the same source-neutral contract accepts a TLE event');

assert.equal(resolveHandoverPresentationPhase('inter', 0.12), 'serving');
assert.equal(resolveHandoverPresentationPhase('inter', 0.3), 'measuring');
assert.equal(resolveHandoverPresentationPhase('inter', 0.9), 'settled');
const settled = advanceHandoverPresentation(tleStarted.state, {
  nowMs: 9100 + 6000 * 0.9,
  candidate: tleEvent,
});
assert.equal(settled.view.targetRole, 'serving', 'the acquired link is serving-yellow in the settled phase');
assert.equal(settled.view.autoSlowActive, false, 'settled tail is no longer an in-progress HO Slow');

const missingTarget: HandoverPresentationEvent = {
  ...walkerEvent,
  eventId: 'walker-undrawable',
  to: { ...walkerEvent.to, drawable: false },
};
const rejected = advanceHandoverPresentation(createHandoverPresentationState(), {
  nowMs: 0,
  candidate: missingTarget,
});
assert.equal(rejected.view.active, false, 'missing geometry fails closed');

console.log('handover presentation owner keeps HO Slow aligned with a visible handover');
