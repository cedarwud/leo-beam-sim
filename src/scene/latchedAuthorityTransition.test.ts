import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveLatchedAuthorityTransition } from './latchedAuthorityTransition';

const transition = {
  eventId: 'event-1',
  episodeId: 'episode-1',
  sourceFrameId: 'frame-1',
  simTimeMs: 1200,
  kind: 'inter' as const,
  boundary: 'selected' as const,
  from: { satelliteId: 'sat-a', beamId: 1 },
  to: { satelliteId: 'sat-b', beamId: 2 },
};

test('keeps a selected transition selected until a commit is observed', () => {
  const result = resolveLatchedAuthorityTransition({
    multiCandidateCentralOverlayActive: true,
    multiCandidateIdentityTransitionActive: false,
    presentationActive: true,
    presentationEvent: { eventId: 'event-1' },
    authorityTransition: transition,
    authorityPresentationCommitObserved: false,
  });

  assert.equal(result?.boundary, 'selected');
  assert.equal(result?.eventId, 'event-1');
});

test('promotes the presentation boundary when the receipt is observed', () => {
  const result = resolveLatchedAuthorityTransition({
    multiCandidateCentralOverlayActive: false,
    multiCandidateIdentityTransitionActive: true,
    presentationActive: true,
    presentationEvent: { eventId: 'event-1' },
    authorityTransition: transition,
    authorityPresentationCommitObserved: true,
  });

  assert.equal(result?.boundary, 'committed');
});

test('fails closed for inactive or mismatched episodes', () => {
  const base = {
    multiCandidateCentralOverlayActive: true,
    multiCandidateIdentityTransitionActive: false,
    presentationActive: true,
    presentationEvent: { eventId: 'other-event' },
    authorityTransition: transition,
    authorityPresentationCommitObserved: true,
  };

  assert.equal(resolveLatchedAuthorityTransition(base), null);
  assert.equal(resolveLatchedAuthorityTransition({
    ...base,
    presentationEvent: { eventId: 'event-1' },
    presentationActive: false,
  }), null);
});
