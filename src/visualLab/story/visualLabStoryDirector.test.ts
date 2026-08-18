import assert from 'node:assert/strict';

import type { VisualLabStoryControllerState } from './visualLabStoryController';
import { deriveVisualLabStorySceneDirection } from './visualLabStoryDirector';

function state(
  kind: 'inter-handover' | 'intra-handover',
  phase: 'before' | 'decision' | 'after',
): Pick<VisualLabStoryControllerState, 'status' | 'activeStoryId' | 'activeStoryKind' | 'activeStep' | 'stories'> {
  const beamTrace = kind === 'intra-handover'
    ? {
        traceId: 'trace-1',
        from: { satelliteId: 'sat-a', beamId: 2, userIndex: 4, userId: 'ue-5' },
        to: { satelliteId: 'sat-a', beamId: 5, userIndex: 4, userId: 'ue-5' },
      }
    : null;
  return {
    status: 'paused',
    activeStoryId: 'story-1',
    activeStoryKind: kind,
    activeStep: {
      id: `story-1:${phase}`,
      phase,
      index: phase === 'before' ? 0 : phase === 'decision' ? 1 : 2,
      instantUtc: '2026-08-12T12:00:00.000Z',
      anchorIndex: 1,
      point: null,
      marker: null,
      beamTrace,
    },
    stories: [{
      storyId: 'story-1',
      kind,
      descriptor: {
        storyId: 'story-1',
        kind,
        availability: { status: 'available', reason: null, sourceKind: 'accepted-canonical-real' },
        source: kind === 'inter-handover'
          ? { kind: 'inter-handover', eventId: 'event-1', fromSatelliteId: 'sat-a', toSatelliteId: 'sat-b' }
          : { kind: 'intra-handover', traceId: 'trace-1', from: beamTrace!.from, to: beamTrace!.to },
      },
      availability: { status: 'available', reason: null, sourceKind: 'accepted-canonical-real' },
      steps: [],
    }],
  } as unknown as Pick<VisualLabStoryControllerState, 'status' | 'activeStoryId' | 'activeStoryKind' | 'activeStep' | 'stories'>;
}

const inter = deriveVisualLabStorySceneDirection(state('inter-handover', 'decision'), true);
assert.equal(inter?.cameraCue, 'handover-decision');
assert.equal(inter?.fromSatelliteId, 'sat-a');
assert.equal(inter?.toSatelliteId, 'sat-b');
assert.equal(inter?.fromBeamId, null);

const intra = deriveVisualLabStorySceneDirection(state('intra-handover', 'after'), true);
assert.equal(intra?.cameraCue, 'handover-after');
assert.equal(intra?.fromSatelliteId, 'sat-a');
assert.equal(intra?.toSatelliteId, 'sat-a');
assert.equal(intra?.fromBeamId, 2);
assert.equal(intra?.toBeamId, 5);
assert.equal(intra?.userIndex, 4);

assert.equal(deriveVisualLabStorySceneDirection(state('inter-handover', 'before'), false), null);

console.log('Visual Lab story director derives source-backed camera and scene cues.');

