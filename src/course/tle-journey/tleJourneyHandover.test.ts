#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getTleJourneyHandoverFrame,
  TLE_JOURNEY_HANDOVER_SOURCE,
} from './tleJourneyHandover';
import { validateTleLines } from '../../tle/validation';

test('archived Starlink handover donor remains source-backed outside the Act 2 sequence', () => {
  const before = getTleJourneyHandoverFrame(0);
  const early = getTleJourneyHandoverFrame(0.25);
  const monitored = getTleJourneyHandoverFrame(0.49);
  const committed = getTleJourneyHandoverFrame(0.51);
  const settled = getTleJourneyHandoverFrame(1);

  assert.equal(TLE_JOURNEY_HANDOVER_SOURCE.eventType, 'forced-continuity');
  assert.equal(TLE_JOURNEY_HANDOVER_SOURCE.sourcePath, '/tle-archive/starlink/starlink_20260824.tle');
  assert.equal(TLE_JOURNEY_HANDOVER_SOURCE.triggerInstantUtc, '2026-08-25T12:06:00.000Z');
  assert.equal(TLE_JOURNEY_HANDOVER_SOURCE.fromSatelliteName, 'STARLINK-32700');
  assert.equal(TLE_JOURNEY_HANDOVER_SOURCE.toSatelliteName, 'STARLINK-4773');
  assert.equal(
    validateTleLines(TLE_JOURNEY_HANDOVER_SOURCE.fromTleLine1, TLE_JOURNEY_HANDOVER_SOURCE.fromTleLine2).identity.satelliteId,
    TLE_JOURNEY_HANDOVER_SOURCE.fromSatelliteId,
  );
  assert.equal(
    validateTleLines(TLE_JOURNEY_HANDOVER_SOURCE.toTleLine1, TLE_JOURNEY_HANDOVER_SOURCE.toTleLine2).identity.satelliteId,
    TLE_JOURNEY_HANDOVER_SOURCE.toSatelliteId,
  );
  assert.equal(before.servingSatelliteId, TLE_JOURNEY_HANDOVER_SOURCE.fromSatelliteId);
  assert.equal(before.ratio, 0);
  assert.equal(early.ratio, 0.25);
  assert.equal(monitored.state, 'pending');
  assert.equal(monitored.ratio, 0.49);
  assert.equal(monitored.candidateSatelliteId, TLE_JOURNEY_HANDOVER_SOURCE.toSatelliteId);
  assert.equal(committed.servingSatelliteId, TLE_JOURNEY_HANDOVER_SOURCE.toSatelliteId);
  assert.equal(committed.state, 'forced-continuity');
  assert.equal(committed.event, 'forced-continuity');
  assert.equal(committed.ratio, 0.51);
  assert.equal(settled.ratio, 1);
  assert.notEqual(before.servingSatelliteId, committed.servingSatelliteId);
});
