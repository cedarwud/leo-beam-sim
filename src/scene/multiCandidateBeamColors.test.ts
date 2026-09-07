import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveMultiCandidateBeamColors } from './multiCandidateBeamColors';

test('builds cell and beam indexes and lets the authority links refresh both indexes', () => {
  const result = resolveMultiCandidateBeamColors({
    sceneInstructions: [{
      satelliteId: 'sat-a',
      beamId: 11,
      cellId: 2,
      isServing: true,
      isCandidate: false,
    }],
    authorityDisplayedLinks: [{
      satelliteId: 'sat-a',
      beamId: 3,
      isServing: false,
      isCandidate: true,
    }],
    authorityActive: true,
    resolveBeamColor: (_satelliteId, beamId, _fallback, highlighted) => (
      `resolved:${beamId}:${highlighted ? 'highlighted' : 'plain'}`
    ),
  });

  assert.equal(result.bySatelliteCell.get('sat-a/2'), 'resolved:3:highlighted');
  assert.equal(result.bySatelliteBeam.get('sat-a/11'), 'resolved:11:highlighted');
  assert.equal(result.bySatelliteBeam.get('sat-a/3'), 'resolved:3:highlighted');
});

test('does not add authority links while the authority layer is inactive', () => {
  const result = resolveMultiCandidateBeamColors({
    sceneInstructions: [],
    authorityDisplayedLinks: [{
      satelliteId: 'sat-b',
      beamId: 4,
      isServing: true,
      isCandidate: false,
    }],
    authorityActive: false,
    resolveBeamColor: (_satelliteId, _beamId, fallback) => fallback,
  });

  assert.equal(result.bySatelliteCell.size, 0);
  assert.equal(result.bySatelliteBeam.size, 0);
});
