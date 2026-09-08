import assert from 'node:assert/strict';
import test from 'node:test';

import { colorForServingBeam } from '../constants/servingColour';
import { resolveMultiCandidateBeamColors } from './multiCandidateBeamColors';
import { cellIdFromLinkBudgetBeamId } from './sinrLiveCellModel';

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
    resolveBeamColor: (_satelliteId, beamId, highlighted) => (
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
    resolveBeamColor: (_satelliteId, _beamId) => 'unused',
  });

  assert.equal(result.bySatelliteCell.size, 0);
  assert.equal(result.bySatelliteBeam.size, 0);
});

// Existing tests discard the fallback colour or leave maps empty when authority is inactive.
// This test asserts that the lookup miss fallback actually resolves from the beam id rather than the cell id.
test('resolves fallback colour from the beam id rather than the cell id on lookup miss', () => {
  const authorityBeamId = 3;
  const authorityCellId = cellIdFromLinkBudgetBeamId(authorityBeamId);

  const result = resolveMultiCandidateBeamColors({
    sceneInstructions: [{
      satelliteId: 'sat-a',
      beamId: 11,
      cellId: 2,
      isServing: true,
      isCandidate: false,
    }],
    authorityDisplayedLinks: [{
      satelliteId: 'sat-b',
      beamId: authorityBeamId,
      isServing: false,
      isCandidate: true,
    }],
    authorityActive: true,
    resolveBeamColor: (satelliteId, beamId) => colorForServingBeam(satelliteId, beamId).markerColor,
  });

  // Scene instruction loop: fallback must be derived from beamId (11), NOT cellId (2).
  assert.equal(
    result.bySatelliteBeam.get('sat-a/11'),
    colorForServingBeam('sat-a', 11).markerColor,
  );
  assert.notEqual(
    result.bySatelliteBeam.get('sat-a/11'),
    colorForServingBeam('sat-a', 2).markerColor,
  );
  assert.equal(
    result.bySatelliteCell.get('sat-a/2'),
    colorForServingBeam('sat-a', 11).markerColor,
  );
  assert.notEqual(
    result.bySatelliteCell.get('sat-a/2'),
    colorForServingBeam('sat-a', 2).markerColor,
  );

  // Authority displayed link loop: fallback must be derived from beamId (3), NOT authorityCellId (2).
  assert.equal(
    result.bySatelliteBeam.get('sat-b/3'),
    colorForServingBeam('sat-b', authorityBeamId).markerColor,
  );
  assert.notEqual(
    result.bySatelliteBeam.get('sat-b/3'),
    colorForServingBeam('sat-b', authorityCellId).markerColor,
  );
  assert.equal(
    result.bySatelliteCell.get(`sat-b/${authorityCellId}`),
    colorForServingBeam('sat-b', authorityBeamId).markerColor,
  );
  assert.notEqual(
    result.bySatelliteCell.get(`sat-b/${authorityCellId}`),
    colorForServingBeam('sat-b', authorityCellId).markerColor,
  );
});

