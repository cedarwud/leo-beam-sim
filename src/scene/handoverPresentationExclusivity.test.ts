import assert from 'node:assert/strict';

import {
  advanceHandoverPresentation,
  createHandoverPresentationState,
  type HandoverPresentationEvent,
} from './handoverPresentationOwner';

const endpoint = (satId: string, cellId: number) => ({ satId, cellId, drawable: true });

const inter: HandoverPresentationEvent = {
  eventId: 'inter-active',
  source: 'walker',
  kind: 'inter',
  from: endpoint('sat-a', 0),
  to: endpoint('sat-b', 0),
  durationMs: 6000,
};

const intra: HandoverPresentationEvent = {
  eventId: 'intra-competing',
  source: 'manual',
  kind: 'intra',
  from: endpoint('sat-b', 0),
  to: endpoint('sat-b', 1),
  durationMs: 8000,
};

const started = advanceHandoverPresentation(createHandoverPresentationState(), {
  nowMs: 0,
  candidate: inter,
  owner: 'natural',
});
const duringInter = advanceHandoverPresentation(started.state, {
  nowMs: 100,
  candidate: intra,
  owner: 'manual',
});
assert.equal(
  duringInter.view.event?.eventId,
  inter.eventId,
  'intra must not preempt an active inter presentation',
);

const completed = advanceHandoverPresentation(started.state, {
  nowMs: inter.durationMs,
  candidate: intra,
  owner: 'manual',
});
assert.equal(completed.state.mode, 'cooldown');
assert.equal(
  completed.view.active,
  false,
  'the completed inter must enter a quiet interval before another story starts',
);

const duringCooldown = advanceHandoverPresentation(completed.state, {
  nowMs: inter.durationMs + 100,
  candidate: intra,
  owner: 'manual',
});
assert.equal(
  duringCooldown.view.active,
  false,
  'an explicit intra request must not bypass the shared cooldown',
);

console.log('handover presentation exclusivity test passed');
