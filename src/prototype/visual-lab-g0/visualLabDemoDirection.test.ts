import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveVisualLabDemoDirection, type VisualLabDemoSceneInput } from './visualLabDemoDirection';

const scene: VisualLabDemoSceneInput = {
  satellites: [
    { satelliteId: 'low', topocentric: { elevationDeg: 30 } },
    { satelliteId: 'high', topocentric: { elevationDeg: 70 } },
  ],
  serving: { satelliteId: 'accepted-serving' },
  candidate: { availability: 'available', satelliteId: 'candidate' },
  representative: {
    availability: 'available',
    user: { index: 4, cellIndex: 2 },
  },
  users: [{ index: 4, cellIndex: 2 }],
  activeBeamTargets: { targets: [{ beamId: 8, cellIndex: 2 }] },
};

test('inter demo chooses the highest retained satellite and maps the representative beam', () => {
  const direction = deriveVisualLabDemoDirection({
    replay: { kind: 'inter-handover', elapsedMs: 1_600 },
    view: { phase: 'intervention', beat: 'before' },
    scene,
  });

  assert.deepEqual(direction, {
    storyId: 'demo:inter-handover',
    storyKind: 'inter-handover',
    beat: 'before',
    cameraCue: 'handover-before',
    fromSatelliteId: 'high',
    toSatelliteId: 'low',
    fromBeamId: null,
    toBeamId: null,
    userIndex: 4,
    revision: 'demo:inter-handover:intervention:20',
  });
});

test('intra demo preserves serving identity and falls back to the first user when representative data is unavailable', () => {
  const direction = deriveVisualLabDemoDirection({
    replay: { kind: 'intra-handover', elapsedMs: 5_250 },
    view: { phase: 'decision', beat: 'decision' },
    scene: {
      ...scene,
      representative: { availability: 'unavailable', user: null },
      serving: { satelliteId: 'accepted-serving' },
    },
  });

  assert.equal(direction?.fromSatelliteId, 'accepted-serving');
  assert.equal(direction?.toSatelliteId, 'accepted-serving');
  assert.equal(direction?.fromBeamId, 8);
  assert.equal(direction?.toBeamId, 8);
  assert.equal(direction?.userIndex, 4);
  assert.equal(direction?.cameraCue, 'handover-decision');
});

test('demo direction stays absent without an accepted local scene', () => {
  assert.equal(deriveVisualLabDemoDirection({
    replay: { kind: 'inter-handover', elapsedMs: 0 },
    view: { phase: 'baseline', beat: 'before' },
    scene: null,
  }), null);
});
