import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveHandoverMarkerSatelliteIds } from './handoverMarkerSatelliteIds';

test('unions comparison, candidate, cinema, and authority satellites', () => {
  const ids = resolveHandoverMarkerSatelliteIds({
    multiCandidateSceneVisualActive: true,
    multiCandidateCentralMarkerSatelliteIds: new Set(['ambient-a', 'shared']),
    renderedCandidateSatelliteId: 'candidate-a',
    candidateComparisonSceneActive: true,
    candidateReviewRenderPlanPresent: true,
    candidateComparisonVisibleSatelliteIds: new Set(['review-a', 'shared']),
    handoverCinemaCandidate: { fromSatId: 'cinema-from', toSatId: 'cinema-to' },
    authorityTransition: {
      from: { satelliteId: 'authority-from' },
      to: { satelliteId: 'authority-to' },
    },
  });

  assert.deepEqual([...ids], [
    'ambient-a', 'shared', 'candidate-a', 'review-a',
    'cinema-from', 'cinema-to', 'authority-from', 'authority-to',
  ]);
});

test('does not retain stale shortlist ids when the comparison plan is absent', () => {
  const ids = resolveHandoverMarkerSatelliteIds({
    multiCandidateSceneVisualActive: false,
    multiCandidateCentralMarkerSatelliteIds: new Set(['stale']),
    renderedCandidateSatelliteId: null,
    candidateComparisonSceneActive: true,
    candidateReviewRenderPlanPresent: false,
    candidateComparisonVisibleSatelliteIds: new Set(['stale-review']),
    handoverCinemaCandidate: null,
    authorityTransition: null,
  });

  assert.deepEqual([...ids], []);
});
