import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveCanonicalTeachingLinkSnapshot,
  type CanonicalTeachingLinkSnapshotSource,
} from './canonicalTeachingLinkSnapshot';

const source: CanonicalTeachingLinkSnapshotSource = {
  links: [{
    userIndex: 0,
    userId: 'ue-7',
    beamId: 2,
    satelliteId: 'sat-serving',
    offAxisAngleRad: Math.PI / 6,
    sinrDb: 11.25,
    rateBps: 4_000_000,
  }],
  candidateLink: { satelliteId: 'sat-candidate' },
  runAnchor: { elapsedSec: 90 },
  canonical: { transmitGainUb: [[0.25, 0.5, 0.75]] },
  power: { systemPowerW: 3.5 },
  ee: { instantaneousBitsPerJ: 1_142_857.14 },
};

test('projects the first canonical link with teaching-panel units', () => {
  const snapshot = deriveCanonicalTeachingLinkSnapshot(source);
  assert.deepEqual({ ...snapshot, thetaDeg: undefined }, {
    ueId: 'ue-7',
    servingSatelliteId: 'sat-serving',
    candidateSatelliteId: 'sat-candidate',
    timeSec: 90,
    thetaDeg: undefined,
    transmitGainLinear: 0.75,
    sinrDb: 11.25,
    throughputMbps: 4,
    systemPowerW: 3.5,
    energyEfficiencyBitsPerJoule: 1_142_857.14,
  });
  assert.ok(Math.abs(snapshot.thetaDeg! - 30) < 1e-12);
});

test('fails closed when the accepted frame has no link', () => {
  const emptyFrame: CanonicalTeachingLinkSnapshotSource = {
    ...source,
    links: [],
  };

  assert.deepEqual(deriveCanonicalTeachingLinkSnapshot(null), {
    ueId: null,
    servingSatelliteId: null,
    candidateSatelliteId: null,
    timeSec: null,
    thetaDeg: null,
    transmitGainLinear: null,
    sinrDb: null,
    throughputMbps: null,
    systemPowerW: null,
    energyEfficiencyBitsPerJoule: null,
  });
  assert.deepEqual(deriveCanonicalTeachingLinkSnapshot(emptyFrame), {
    ueId: null,
    servingSatelliteId: null,
    candidateSatelliteId: null,
    timeSec: null,
    thetaDeg: null,
    transmitGainLinear: null,
    sinrDb: null,
    throughputMbps: null,
    systemPowerW: null,
    energyEfficiencyBitsPerJoule: null,
  });
});
