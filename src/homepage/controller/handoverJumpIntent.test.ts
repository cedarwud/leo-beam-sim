import assert from 'node:assert/strict';
import test from 'node:test';

import type { LiveWalkerHandoverEvent } from '../../scene/liveWalkerHandoverEventIndex';
import {
  createHomepageHandoverJumpIntent,
  resolveHomepageHandoverJumpIntent,
} from './handoverJumpIntent';

function sourceEvent(
  id: string,
  kind: 'intra' | 'inter',
): LiveWalkerHandoverEvent {
  return {
    id,
    sourceTimeSec: 62,
    kind,
  } as LiveWalkerHandoverEvent;
}

test('a Director intent waits for the current index instead of using stale events', () => {
  const intent = createHomepageHandoverJumpIntent('inter');
  const event = sourceEvent('inter-62', 'inter');

  assert.equal(
    resolveHomepageHandoverJumpIntent(intent, {
      indexBuilding: true,
      matchingEvent: event,
    }),
    null,
  );
  const selection = resolveHomepageHandoverJumpIntent(intent, {
    indexBuilding: false,
    matchingEvent: event,
  });
  assert.ok(selection);
  assert.equal(selection.kind, 'inter');
  assert.equal(selection.event, event);
  assert.equal(selection.eventId, 'inter-62');
});

test('an intent is dropped when the rebuilt source has no matching event', () => {
  assert.equal(
    resolveHomepageHandoverJumpIntent(createHomepageHandoverJumpIntent('inter'), {
      indexBuilding: false,
      matchingEvent: null,
    }),
    null,
  );
  assert.equal(
    resolveHomepageHandoverJumpIntent(
      createHomepageHandoverJumpIntent('inter'),
      { indexBuilding: false, matchingEvent: sourceEvent('intra-26', 'intra') },
    ),
    null,
  );
});

test('no intent means no hidden Director action', () => {
  assert.equal(
    resolveHomepageHandoverJumpIntent(null, {
      indexBuilding: false,
      matchingEvent: sourceEvent('inter-62', 'inter'),
    }),
    null,
  );
});

console.log('homepage handover jump intent checks pass');
