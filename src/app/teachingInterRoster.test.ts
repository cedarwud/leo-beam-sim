import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTeachingInterRosterSatelliteIds } from './teachingInterRoster';

test('keeps replacement spacecraft unique and ranks each by its best measured EE', () => {
  const result = resolveTeachingInterRosterSatelliteIds({
    servingSatelliteId: 'sat-serving',
    candidateSatelliteIds: ['sat-serving', 'sat-a', 'sat-b', 'sat-a'],
    beamMetrics: [
      { satelliteId: 'sat-serving', energyEfficiencyBitsPerJoule: 99 },
      { satelliteId: 'sat-a', energyEfficiencyBitsPerJoule: 4 },
      { satelliteId: 'sat-a', energyEfficiencyBitsPerJoule: 8 },
      { satelliteId: 'sat-b', energyEfficiencyBitsPerJoule: 6 },
    ],
  });

  assert.deepEqual(result, ['sat-a', 'sat-b']);
  assert.ok(Object.isFrozen(result));
});

test('adds measured replacement spacecraft that are absent from the rail roster', () => {
  assert.deepEqual(resolveTeachingInterRosterSatelliteIds({
    servingSatelliteId: 'sat-serving',
    candidateSatelliteIds: ['sat-roster'],
    beamMetrics: [
      { satelliteId: 'sat-measured', energyEfficiencyBitsPerJoule: 12 },
      { satelliteId: 'sat-roster', energyEfficiencyBitsPerJoule: 3 },
    ],
  }), ['sat-measured', 'sat-roster']);
});

test('retains candidate order when no finite EE differentiates the replacements', () => {
  assert.deepEqual(resolveTeachingInterRosterSatelliteIds({
    servingSatelliteId: null,
    candidateSatelliteIds: ['sat-a', 'sat-b'],
    beamMetrics: [
      { satelliteId: 'sat-a', energyEfficiencyBitsPerJoule: null },
      { satelliteId: 'sat-b', energyEfficiencyBitsPerJoule: null },
    ],
  }), ['sat-a', 'sat-b']);
});
