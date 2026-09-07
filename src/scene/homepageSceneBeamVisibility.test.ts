import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveHomepageSceneBeamVisibility,
  type HomepageSceneBeamVisibilityInput,
} from './homepageSceneBeamVisibility';

const presentation = {
  eventId: 'presentation-1',
  source: 'walker' as const,
  kind: 'inter' as const,
  from: { satId: 'source', cellId: 0, beamId: 1, drawable: true },
  to: { satId: 'target', cellId: 1, beamId: 2, drawable: true },
  durationMs: 2000,
};

function baseInput(): HomepageSceneBeamVisibilityInput {
  return {
    displayHeroRecord: { servingSatId: 'source', cellId: 0, beamId: 1 },
    primaryServingRecord: null,
    renderedCandidateSatelliteId: 'target',
    presentedHandoverPairCandidate: null,
    handoverPresentationCandidate: presentation,
    handoverAuthorityJoin: null,
    cinemaPairCandidate: null,
    recentPrimaryHandoverEvent: null,
  };
}

test('maps serving, prepared, and presented identities without React state', () => {
  const identities = resolveHomepageSceneBeamVisibility(baseInput());

  assert.deepEqual([...identities].sort(), [
    'source|0|1',
    'target|0|2',
    'target|1|2',
  ]);
});

test('preserves exact beam identity when a presentation pair shares a cell', () => {
  const input: HomepageSceneBeamVisibilityInput = {
    ...baseInput(),
    presentedHandoverPairCandidate: {
      eventId: 'intra-1',
      ueId: 'ue-0',
      kind: 'intra',
      sourceTimeSec: 2,
      fromSatId: 'source',
      fromCellId: 0,
      fromBeamId: 11,
      toSatId: 'source',
      toCellId: 0,
      toBeamId: 12,
    },
  };

  const identities = resolveHomepageSceneBeamVisibility(input);

  assert.equal(identities.has('source|0|11'), true);
  assert.equal(identities.has('source|0|12'), true);
});
