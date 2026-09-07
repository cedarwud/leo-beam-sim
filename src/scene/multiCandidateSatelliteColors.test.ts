import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveMultiCandidateSatelliteColors } from './multiCandidateSatelliteColors';

test('keeps accepted colours ahead of candidate and ambient fallbacks', () => {
  const colors = resolveMultiCandidateSatelliteColors({
    acceptedSatelliteIdentities: [{ satelliteId: 'sat-a', cssColor: '#accepted' }],
    candidateSatelliteIdentities: [
      { satelliteId: 'sat-a', satelliteColor: '#candidate-a' },
      { satelliteId: 'sat-b', satelliteColor: '#candidate-b' },
    ],
    ambientSatelliteIds: ['sat-a', 'sat-b', 'sat-c'],
    resolveSceneSatelliteColor: (_satelliteId, fallback) => `resolved:${fallback}`,
    resolveAmbientFallbackColor: satelliteId => `ambient:${satelliteId}`,
  });

  assert.deepEqual([...colors.entries()], [
    ['sat-a', 'resolved:#accepted'],
    ['sat-b', 'resolved:#candidate-b'],
    ['sat-c', 'ambient:sat-c'],
  ]);
});

test('does not create entries for an unresolved colour and does not overwrite a prior entry', () => {
  const colors = resolveMultiCandidateSatelliteColors({
    acceptedSatelliteIdentities: [],
    candidateSatelliteIdentities: [{ satelliteId: 'sat-b', satelliteColor: '#candidate' }],
    ambientSatelliteIds: ['sat-a', 'sat-b'],
    resolveSceneSatelliteColor: () => '#candidate',
    resolveAmbientFallbackColor: satelliteId => satelliteId === 'sat-a' ? '' : '#ambient',
  });

  assert.deepEqual([...colors.entries()], [
    ['sat-b', '#candidate'],
    ['sat-a', ''],
  ]);
});
