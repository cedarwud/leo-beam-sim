#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SAMPLE_TLE,
  TLE_JOURNEY_STATIONS,
  tleJourneyStationAt,
} from './tleJourneyStations';
import {
  calculateNtpuObserver3D,
  calculateOrbitTrailPoints,
  calculateOrbitTrailEndpointSummary,
  calculateSatelliteOrbitalResult,
  calculateSatelliteState,
  computeTleDigest,
  getTeachingPass,
  SCENE_EARTH_SCALE,
  TEME_POSITION_COMPONENT_DEFINITIONS,
  TLE_COORDINATE_CHAIN_DISCLOSURE,
} from './tleJourneyBeats';
import { deriveTleFacts, tleChecksum } from './tleFields';
import { findTleJourneyPass, sampleTleJourneyTrack } from './tleJourneyPass';

test('TLE Journey contains five ordered orbital-data and pass-prediction beats', () => {
  assert.strictEqual(TLE_JOURNEY_STATIONS.length, 5);

  const expectedIds = ['raw-record', 'column-walk', 'sgp4-contract', 'satellite-orbit', 'observer-pass'];
  for (let i = 0; i < 5; i++) {
    const station = TLE_JOURNEY_STATIONS[i]!;
    assert.strictEqual(station.order, i + 1);
    assert.strictEqual(station.id, expectedIds[i]);
    assert.ok(station.titleZhHant.length > 0);
    assert.ok(station.subtitleZhHant.length === 2);
    assert.ok(station.subtitleZhHant[0]!.length > 0);
    assert.ok(station.subtitleZhHant[1]!.length > 0);
    assert.ok(['SOURCE', 'MODEL-DERIVED', 'COURSE-ASSUMPTION'].includes(station.provenance));

    // Scientific honesty copy audit: no prohibited hype words
    assert.ok(!station.subtitleZhHant[0]!.includes('精確'), `Beat ${i + 1} subtitle 1 contains prohibited word 精確`);
    assert.ok(!station.subtitleZhHant[1]!.includes('精確'), `Beat ${i + 1} subtitle 2 contains prohibited word 精確`);
    assert.ok(!station.subtitleZhHant[0]!.includes('真實呈現'), `Beat ${i + 1} subtitle 1 contains prohibited word 真實呈現`);
    assert.ok(!station.subtitleZhHant[1]!.includes('真實呈現'), `Beat ${i + 1} subtitle 2 contains prohibited word 真實呈現`);
    assert.ok(!station.subtitleZhHant[0]!.includes('14.5'), `Beat ${i + 1} subtitle 1 contains uncomputed duration 14.5`);
    assert.ok(!station.subtitleZhHant[1]!.includes('14.5'), `Beat ${i + 1} subtitle 2 contains uncomputed duration 14.5`);
  }

  // Beat 5 keeps the geometry statement precise without presenting a
  // disclaimer sentence that the teaching brief explicitly removed.
  const beat5 = TLE_JOURNEY_STATIONS[4]!;
  const beat1 = TLE_JOURNEY_STATIONS[0]!;
  assert.match(beat1.subtitleZhHant[1]!, /69 個固定字元位置（包含空白）/);
  assert.match(beat1.subtitleZhHant[1]!, /第 69 個字元.*檢核碼/);
  assert.match(beat5.subtitleZhHant[1]!, /幾何關係/);
  assert.match(beat5.subtitleZhHant[0]!, /這筆封存 TLE.*本次仰角/);
  assert.doesNotMatch(beat5.subtitleZhHant[1]!, /TLE 幾何並非換手/);
  const beat4 = TLE_JOURNEY_STATIONS[3]!;
  assert.match(beat4.subtitleZhHant[1]!, /2,594 km/);
  assert.match(beat4.subtitleZhHant[1]!, /終點.*向西約 23.30°/);
  assert.match(beat4.subtitleZhHant[1]!, /終點.*向西約 23.30°.*地面位置不會重合/);
  assert.match(beat4.subtitleZhHant[0]!, /起點.*t₀.*終點.*t₀ \+ T/);
  assert.doesNotMatch(beat4.subtitleZhHant[1]!, /不保證/);

  assert.strictEqual(tleJourneyStationAt(1).id, 'raw-record');
  assert.strictEqual(tleJourneyStationAt(5).id, 'observer-pass');
  assert.throws(() => tleJourneyStationAt(6), RangeError);
  assert.throws(() => tleJourneyStationAt(99), RangeError);
});

test('SAMPLE_TLE carries valid checksums, sourcePath, and contentDigest', () => {
  assert.strictEqual(tleChecksum(SAMPLE_TLE.line1).valid, true);
  assert.strictEqual(tleChecksum(SAMPLE_TLE.line2).valid, true);
  assert.strictEqual(SAMPLE_TLE.catalogId, '44714');
  assert.strictEqual(SAMPLE_TLE.constellation, 'Starlink');
  assert.strictEqual(SAMPLE_TLE.nominalAltitudeKm, 384);
  assert.strictEqual(SAMPLE_TLE.sourcePath, '/tle-archive/starlink/starlink_20260824.tle');
  assert.ok(SAMPLE_TLE.contentDigest.length > 0);
  assert.strictEqual(SAMPLE_TLE.contentDigest, computeTleDigest(SAMPLE_TLE.line1, SAMPLE_TLE.line2));
});

test('SGP4 TEME position contract defines each Cartesian component', () => {
  assert.deepEqual(
    TEME_POSITION_COMPONENT_DEFINITIONS.map(definition => definition.axis),
    ['x', 'y', 'z'],
  );
  assert.match(TEME_POSITION_COMPONENT_DEFINITIONS[0]!.descriptionZhHant, /真赤道面/);
  assert.match(TEME_POSITION_COMPONENT_DEFINITIONS[1]!.descriptionZhHant, /正交方向/);
  assert.match(TEME_POSITION_COMPONENT_DEFINITIONS[2]!.descriptionZhHant, /真北極/);
});

test('Fail-closed: corrupt or invalid TLE input prevents SGP4 propagation downstream', () => {
  const corruptedLine2 = `${SAMPLE_TLE.line2.slice(0, 10)}9${SAMPLE_TLE.line2.slice(11)}`;

  // calculateSatelliteOrbitalResult returns typed error and does NOT propagate
  const result = calculateSatelliteOrbitalResult(SAMPLE_TLE.line1, corruptedLine2, 0);
  assert.strictEqual(result.ok, false);
  if (!result.ok) {
    assert.strictEqual(result.errorCode, 'INVALID_TLE');
    assert.ok(result.reason.includes('checksum') || result.reason.includes('CHECKSUM_MISMATCH'));
  }

  // calculateSatelliteState fails closed to null
  const nullState = calculateSatelliteState(SAMPLE_TLE.line1, corruptedLine2, 0);
  assert.strictEqual(nullState, null);

  // sampleTleJourneyTrack fails closed to empty array
  const emptySamples = sampleTleJourneyTrack(SAMPLE_TLE.line1, corruptedLine2, Date.parse('2026-08-25T00:00:00Z'), Date.parse('2026-08-25T01:00:00Z'), 30);
  assert.strictEqual(emptySamples.length, 0);

  // findTleJourneyPass fails closed to null
  const noPass = findTleJourneyPass(SAMPLE_TLE.line1, corruptedLine2, Date.parse('2026-08-25T00:00:00Z'), 3600, 30, 10);
  assert.strictEqual(noPass, null);

  // A forged line with a corrected checksum is still invalid when its NORAD
  // catalog identity disagrees with line 1.  Checksum validity is not an
  // orbital validation pass.
  const mismatchedCatalogWithoutChecksum = `${SAMPLE_TLE.line2.slice(0, 2)}99999${SAMPLE_TLE.line2.slice(7, 68)}0`;
  const correctedCatalogLine2 = `${mismatchedCatalogWithoutChecksum.slice(0, 68)}${tleChecksum(mismatchedCatalogWithoutChecksum).expected}`;
  assert.strictEqual(tleChecksum(correctedCatalogLine2).valid, true);
  const mismatchedCatalogResult = calculateSatelliteOrbitalResult(SAMPLE_TLE.line1, correctedCatalogLine2, 0);
  assert.strictEqual(mismatchedCatalogResult.ok, false);
  if (!mismatchedCatalogResult.ok) assert.strictEqual(mismatchedCatalogResult.errorCode, 'INVALID_TLE');
  assert.strictEqual(calculateSatelliteState(SAMPLE_TLE.line1, correctedCatalogLine2, 0), null);
});

test('calculateSatelliteState propagates valid Cartesian position, velocity, and altitude with ECEF scene mapping', () => {
  const result = calculateSatelliteOrbitalResult(SAMPLE_TLE.line1, SAMPLE_TLE.line2, 0);
  assert.strictEqual(result.ok, true);
  if (!result.ok) return;

  const stateAtEpoch = result.state;

  // Position TEME magnitude in km
  assert.ok(stateAtEpoch.radiusKm > 6600 && stateAtEpoch.radiusKm < 6900, `radius: ${stateAtEpoch.radiusKm}`);
  // Altitude in km (Starlink shell is roughly 390 km above WGS84)
  assert.ok(stateAtEpoch.altitudeKm > 350 && stateAtEpoch.altitudeKm < 450, `altitude: ${stateAtEpoch.altitudeKm}`);
  // Speed in km/s (LEO speed ~7.7 km/s)
  assert.ok(stateAtEpoch.speedKmPerSec > 7.4 && stateAtEpoch.speedKmPerSec < 8.2, `speed: ${stateAtEpoch.speedKmPerSec}`);

  // ECEF position matches 3D display coordinates:
  // Three.js X = ECF x * scale, Three.js Y = ECF z * scale, Three.js Z = -ECF y * scale
  assert.ok(Math.abs(stateAtEpoch.position3D[0] - stateAtEpoch.positionEcefKm.x * SCENE_EARTH_SCALE) < 1e-6);
  assert.ok(Math.abs(stateAtEpoch.position3D[1] - stateAtEpoch.positionEcefKm.z * SCENE_EARTH_SCALE) < 1e-6);
  assert.ok(Math.abs(stateAtEpoch.position3D[2] - (-stateAtEpoch.positionEcefKm.y * SCENE_EARTH_SCALE)) < 1e-6);

  // Coordinate disclosure chain
  assert.strictEqual(stateAtEpoch.coordinateDisclosure.length, 7);
  assert.strictEqual(stateAtEpoch.coordinateDisclosure, TLE_COORDINATE_CHAIN_DISCLOSURE);

  // Source identity
  assert.strictEqual(stateAtEpoch.source.catalogId, '44714');
  assert.strictEqual(stateAtEpoch.source.sourcePath, '/tle-archive/starlink/starlink_20260824.tle');
  assert.strictEqual(stateAtEpoch.source.sourceKind, 'ARCHIVED_TLE');
  assert.strictEqual(stateAtEpoch.source.propagationModel, 'SGP4');
});

test('calculateNtpuObserver3D returns consistent 3D position on Earth surface', () => {
  const observerState = calculateNtpuObserver3D();

  assert.ok(Math.abs(observerState.latitudeDeg - 24.9441667) < 1e-4);
  assert.ok(Math.abs(observerState.longitudeDeg - 121.3713889) < 1e-4);

  // Distance from origin in Three.js units should match earth radius (~2.48)
  const r3d = Math.hypot(observerState.position3D[0], observerState.position3D[1], observerState.position3D[2]);
  assert.ok(Math.abs(r3d - 2.48) < 0.05, `observer 3D radius: ${r3d}`);
});

test('calculateOrbitTrailPoints stays Earth-fixed across one inertial orbit', () => {
  const steps = 64;
  const trail = calculateOrbitTrailPoints(SAMPLE_TLE.line1, SAMPLE_TLE.line2, steps);

  assert.strictEqual(trail.length, steps + 1);
  const first = trail[0]!;
  const last = trail[trail.length - 1]!;

  // The propagated TEME state returns near its starting orbital phase after
  // one period, but the Earth has rotated underneath it.  In ECEF/scene
  // coordinates the endpoints must therefore be separated, rather than
  // falsely closing by applying one epoch GST to every sample.
  const dist = Math.hypot(first[0] - last[0], first[1] - last[1], first[2] - last[2]);
  assert.ok(dist > 0.8, `Earth-rotation endpoint separation is too small: ${dist}`);
});

test('SGP4 satellite positions stay on the rendered Earth-fixed trail', () => {
  const steps = 96;
  const trail = calculateOrbitTrailPoints(SAMPLE_TLE.line1, SAMPLE_TLE.line2, steps);
  const periodMin = deriveTleFacts(SAMPLE_TLE.line1, SAMPLE_TLE.line2).orbitalPeriodMin;

  const distanceToSegment = (
    point: readonly number[],
    first: readonly number[],
    second: readonly number[],
  ): number => {
    const dx = second[0]! - first[0]!;
    const dy = second[1]! - first[1]!;
    const dz = second[2]! - first[2]!;
    const denominator = dx * dx + dy * dy + dz * dz;
    const safeDenominator = denominator > 0 ? denominator : 1;
    const t = Math.max(0, Math.min(1, (
      (point[0]! - first[0]!) * dx
      + (point[1]! - first[1]!) * dy
      + (point[2]! - first[2]!) * dz
    ) / safeDenominator));
    return Math.hypot(
      point[0]! - (first[0]! + t * dx),
      point[1]! - (first[1]! + t * dy),
      point[2]! - (first[2]! + t * dz),
    );
  };

  for (const offsetMin of [0, periodMin * 0.25, periodMin * 0.5, periodMin * 0.75, periodMin]) {
    const state = calculateSatelliteState(SAMPLE_TLE.line1, SAMPLE_TLE.line2, offsetMin);
    assert.ok(state !== null);
    if (state === null) continue;
    const nearestDistance = trail.slice(0, -1).reduce((best, first, index) => (
      Math.min(best, distanceToSegment(state.position3D, first, trail[index + 1]!))
    ), Number.POSITIVE_INFINITY);
    assert.ok(nearestDistance < 0.01, `offset ${offsetMin.toFixed(2)} min is ${nearestDistance} scene units from the trail`);
  }
});

test('orbit window reports the Starlink Earth-fixed endpoint shift', () => {
  const summary = calculateOrbitTrailEndpointSummary(SAMPLE_TLE.line1, SAMPLE_TLE.line2);
  assert.ok(summary !== null);
  if (summary === null) return;

  assert.equal(summary.startInstantUtc, '2026-08-24T14:31:31.856Z');
  assert.equal(summary.endInstantUtc, '2026-08-24T16:03:44.831Z');
  assert.ok(summary.orbitalPeriodMin > 92 && summary.orbitalPeriodMin < 93);
  assert.ok(summary.groundTrackDistanceKm > 2500 && summary.groundTrackDistanceKm < 2700);
  assert.ok(summary.longitudeShiftDeg < -22 && summary.longitudeShiftDeg > -25);
  // The SGP4-derived ECEF values are the same values displayed by Beat 4.
  assert.ok(Math.abs(summary.startEcefKm.x + 277.027) < 0.01);
  assert.ok(Math.abs(summary.endEcefKm.y + 6095.134) < 0.01);
});

test('getTeachingPass identifies the roughly 6.2-minute Starlink pass above 10 degrees at NTPU', () => {
  const pass = getTeachingPass();
  assert.ok(pass !== null);

  // Peak elevation for the 01:24 UTC pass is ~82.5 degrees.
  assert.ok(pass.peakElevationDeg > 82 && pass.peakElevationDeg < 83, `peak elevation: ${pass.peakElevationDeg}`);
  // Five-second sampling resolves the above-10-degree interval to 370 s.
  assert.strictEqual(pass.durationSec, 370);
  assert.strictEqual((pass.durationSec / 60).toFixed(1), '6.2');
  assert.strictEqual(pass.minimumElevationDeg, 10);
  assert.strictEqual(pass.samples.length, 75);
});
