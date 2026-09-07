import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBeamInfoItems } from './beamInfoItems';

const basePresentation = {
  homepageVisualIdentity: false,
  multiCandidateCentralOverlayActive: false,
  multiCandidateIdentityTransitionActive: false,
  active: false,
  event: null,
};

test('deduplicates by satellite, cell, and exact beam while dropping display-only items', () => {
  const first = { satId: 'sat-a', cellId: 0, beamId: 10, label: 'first' };
  const duplicate = { satId: 'sat-a', cellId: 0, beamId: 10, label: 'duplicate' };
  const second = { satId: 'sat-a', cellId: 0, beamId: 11, label: 'second' };
  const hidden = { satId: 'sat-b', cellId: 1, beamId: 12, displayOnly: true, label: 'hidden' };

  const result = resolveBeamInfoItems({
    layers: {
      additiveCinemaHandoverPair: [first],
      additiveTriggeredIntra: [duplicate, hidden],
      authorityHandoverPair: [second],
      serving: [],
    },
    presentation: basePresentation,
  });

  assert.deepEqual(result, [first, second]);
});

test('accepted homepage presentation keeps the two endpoint beams when both are available', () => {
  const source = { satId: 'sat-a', cellId: 0, beamId: 10, label: 'source' };
  const target = { satId: 'sat-b', cellId: 1, beamId: 11, label: 'target' };
  const unrelated = { satId: 'sat-c', cellId: 2, beamId: 12, label: 'unrelated' };

  const result = resolveBeamInfoItems({
    layers: {
      additiveCinemaHandoverPair: [unrelated],
      additiveTriggeredIntra: [source],
      authorityHandoverPair: [target],
      serving: [],
    },
    presentation: {
      ...basePresentation,
      homepageVisualIdentity: true,
      multiCandidateCentralOverlayActive: true,
      active: true,
      event: {
        eventId: 'event-1',
        source: 'walker',
        kind: 'inter',
        from: { satId: 'sat-a', cellId: 0, beamId: 10, drawable: true },
        to: { satId: 'sat-b', cellId: 1, beamId: 11, drawable: true },
        durationMs: 1000,
      },
    },
  });

  assert.deepEqual(result, [source, target]);
});

test('falls back to all deduplicated items when an endpoint is not rendered', () => {
  const item = { satId: 'sat-a', cellId: 0, label: 'available' };
  const result = resolveBeamInfoItems({
    layers: {
      additiveCinemaHandoverPair: [],
      additiveTriggeredIntra: [item],
      authorityHandoverPair: [],
      serving: [],
    },
    presentation: {
      ...basePresentation,
      homepageVisualIdentity: true,
      multiCandidateIdentityTransitionActive: true,
      active: true,
      event: {
        eventId: 'event-2',
        source: 'walker',
        kind: 'inter',
        from: { satId: 'missing', cellId: 0, drawable: false },
        to: { satId: 'sat-a', cellId: 0, drawable: true },
        durationMs: 1000,
      },
    },
  });

  assert.deepEqual(result, [item]);
});
