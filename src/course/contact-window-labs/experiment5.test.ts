import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  computeLookAngleAtInstant,
  computeSinglePassContactOpportunity,
  findCrossingInstant,
} from './singlePassModel';
import {
  DEFAULT_EXPERIMENT_5_SEARCH_DURATION_SEC,
  DEFAULT_EXPERIMENT_5_SEARCH_START_UTC,
  EXPERIMENT_5_ALTERNATIVE_SATELLITES,
  EXPERIMENT_5_PRIMARY_SATELLITE,
  NTPU_LAB_OBSERVER,
} from './fixtures';
import { SUPPORTED_ELEVATION_MASKS_DEG } from './types';
import { twoline2satrec } from 'satellite.js';
import { propagate, type EciVec3 } from 'satellite.js';
import { deriveObserverLinkGeometry, NTPU_TLE_OBSERVER } from '../../simulator/observer';

test('Experiment 5: SGP4 look angle derivation produces valid topocentric geometry over NTPU', () => {
  const satrec = twoline2satrec(
    EXPERIMENT_5_PRIMARY_SATELLITE.line1,
    EXPERIMENT_5_PRIMARY_SATELLITE.line2,
  );
  assert.equal(satrec.error, 0);

  const startMs = Date.parse(DEFAULT_EXPERIMENT_5_SEARCH_START_UTC);
  const look = computeLookAngleAtInstant(satrec, startMs, NTPU_LAB_OBSERVER);
  assert.ok(look !== null, 'look angle should not be null');
  assert.ok(Number.isFinite(look.azimuthDeg), 'azimuth must be finite');
  assert.ok(look.azimuthDeg >= 0 && look.azimuthDeg < 360, 'azimuth must be in [0, 360)');
  assert.ok(Number.isFinite(look.elevationDeg), 'elevation must be finite');
  assert.ok(look.elevationDeg >= -90 && look.elevationDeg <= 90, 'elevation must be in [-90, 90]');
  assert.ok(look.rangeKm > 0, 'range must be positive');
});

test('Experiment 5: look angles stay numerically aligned with the repository observer transform', () => {
  const satrec = twoline2satrec(
    EXPERIMENT_5_PRIMARY_SATELLITE.line1,
    EXPERIMENT_5_PRIMARY_SATELLITE.line2,
  );
  const instantMs = Date.parse(DEFAULT_EXPERIMENT_5_SEARCH_START_UTC);
  const propagated = propagate(satrec, new Date(instantMs));
  if (propagated === null || !propagated.position) {
    throw new Error('SGP4 must produce a TEME position');
  }

  const canonical = deriveObserverLinkGeometry(
    propagated.position as EciVec3<number>,
    new Date(instantMs).toISOString(),
    NTPU_TLE_OBSERVER,
  );
  const model = computeLookAngleAtInstant(satrec, instantMs, NTPU_LAB_OBSERVER);
  assert.ok(model);
  assert.ok(Math.abs(model.azimuthDeg - canonical.azimuthDeg) < 1e-9);
  assert.ok(Math.abs(model.elevationDeg - canonical.elevationDeg) < 1e-9);
  assert.ok(Math.abs(model.rangeKm - canonical.rangeKm) < 1e-9);
});

test('Experiment 5: Exact crossing root-finding locates threshold crossing with high precision', () => {
  const satrec = twoline2satrec(
    EXPERIMENT_5_PRIMARY_SATELLITE.line1,
    EXPERIMENT_5_PRIMARY_SATELLITE.line2,
  );
  const startMs = Date.parse(DEFAULT_EXPERIMENT_5_SEARCH_START_UTC);
  const stepMs = 15000;

  // Scan until crossing 10 deg
  let beforeMs = -1;
  let afterMs = -1;
  for (let t = startMs; t <= startMs + 4 * 3600 * 1000; t += stepMs) {
    const p1 = computeLookAngleAtInstant(satrec, t, NTPU_LAB_OBSERVER);
    const p2 = computeLookAngleAtInstant(satrec, t + stepMs, NTPU_LAB_OBSERVER);
    if (p1 && p2 && p1.elevationDeg < 10 && p2.elevationDeg >= 10) {
      beforeMs = t;
      afterMs = t + stepMs;
      break;
    }
  }

  assert.ok(beforeMs > 0 && afterMs > 0, 'should find a rising crossing');
  const crossing = findCrossingInstant(satrec, beforeMs, afterMs, 10, NTPU_LAB_OBSERVER);
  assert.ok(crossing !== null, 'crossing should not be null');
  assert.ok(Math.abs(crossing.elevationDeg - 10) < 0.05, `elevation ${crossing.elevationDeg} should be ~10 deg`);
  assert.ok(crossing.instantMs >= beforeMs && crossing.instantMs <= afterMs);
});

test('Experiment 5: Computes complete single-pass contact geometry with AOS, Peak, LOS, and duration', () => {
  const result = computeSinglePassContactOpportunity({
    tle: EXPERIMENT_5_PRIMARY_SATELLITE,
    observer: NTPU_LAB_OBSERVER,
    minimumElevationDeg: 10,
    searchStartUtc: DEFAULT_EXPERIMENT_5_SEARCH_START_UTC,
    searchDurationSec: DEFAULT_EXPERIMENT_5_SEARCH_DURATION_SEC,
  });

  assert.equal(result.satelliteId, '44714');
  assert.equal(result.satelliteName, 'STARLINK-1008');
  assert.equal(result.hasContact, true);
  assert.ok(result.aos !== null);
  assert.ok(result.peak !== null);
  assert.ok(result.los !== null);

  // AOS invariants
  assert.equal(result.aos.eventType, 'AOS');
  assert.ok(Math.abs(result.aos.elevationDeg - 10) < 0.05, `AOS elevation ${result.aos.elevationDeg} should be near 10°`);
  assert.ok(result.aos.azimuthDeg >= 0 && result.aos.azimuthDeg < 360);
  assert.ok(result.aos.rangeKm > 0);

  // LOS invariants
  assert.equal(result.los.eventType, 'LOS');
  assert.ok(Math.abs(result.los.elevationDeg - 10) < 0.05, `LOS elevation ${result.los.elevationDeg} should be near 10°`);
  assert.ok(result.los.azimuthDeg >= 0 && result.los.azimuthDeg < 360);
  assert.ok(result.los.rangeKm > 0);

  // Peak invariants
  assert.equal(result.peak.eventType, 'PEAK');
  assert.ok(result.peak.maxElevationDeg >= 10, 'Peak elevation must be >= minimum elevation mask');
  assert.ok(result.peak.maxElevationDeg >= result.aos.elevationDeg);
  assert.ok(result.peak.maxElevationDeg >= result.los.elevationDeg);

  // Chronology: AOS <= Peak <= LOS
  assert.ok(result.aos.instantMs <= result.peak.instantMs, 'AOS must precede or equal Peak');
  assert.ok(result.peak.instantMs <= result.los.instantMs, 'Peak must precede or equal LOS');

  // Duration invariants
  assert.ok(result.durationSec > 0, 'Duration must be positive');
  assert.equal(result.durationMinutes, result.durationSec / 60);
  assert.equal(
    result.durationSec,
    (result.los.instantMs - result.aos.instantMs) / 1000,
  );

  // Scientific Provenance Check
  assert.equal(result.provenance.isGuaranteedRfService, false);
  assert.equal(result.provenance.scientificCategory, 'GEOMETRIC_CONTACT_OPPORTUNITY');
  assert.equal(result.provenance.propagationModel, 'SGP4');
});

test('Experiment 5: Elevation mask sensitivity strictly decreases contact duration as mask increases (5° -> 10° -> 20° -> 30°)', () => {
  const result = computeSinglePassContactOpportunity({
    tle: EXPERIMENT_5_PRIMARY_SATELLITE,
    observer: NTPU_LAB_OBSERVER,
    minimumElevationDeg: 10,
    searchStartUtc: DEFAULT_EXPERIMENT_5_SEARCH_START_UTC,
    searchDurationSec: DEFAULT_EXPERIMENT_5_SEARCH_DURATION_SEC,
  });

  assert.equal(result.multiMaskComparison.length, 4);
  const [m5, m10, m20, m30] = result.multiMaskComparison;

  assert.equal(m5?.elevationMaskDeg, 5);
  assert.equal(m10?.elevationMaskDeg, 10);
  assert.equal(m20?.elevationMaskDeg, 20);
  assert.equal(m30?.elevationMaskDeg, 30);

  assert.ok(m5?.hasContact, '5° mask should have contact');
  assert.ok(m10?.hasContact, '10° mask should have contact');

  // Strict monotonic duration decrease
  assert.ok(
    (m5?.durationSec ?? 0) >= (m10?.durationSec ?? 0),
    `5° duration (${m5?.durationSec}s) must be >= 10° duration (${m10?.durationSec}s)`,
  );

  if (m20?.hasContact) {
    assert.ok(
      (m10?.durationSec ?? 0) >= (m20?.durationSec ?? 0),
      `10° duration (${m10?.durationSec}s) must be >= 20° duration (${m20?.durationSec}s)`,
    );
  }

  if (m30?.hasContact) {
    assert.ok(
      (m20?.durationSec ?? 0) >= (m30?.durationSec ?? 0),
      `20° duration (${m20?.durationSec}s) must be >= 30° duration (${m30?.durationSec}s)`,
    );
  }
});

test('Experiment 5: Successfully evaluates alternative archived satellites (Starlink & OneWeb)', () => {
  for (const altSat of EXPERIMENT_5_ALTERNATIVE_SATELLITES) {
    const result = computeSinglePassContactOpportunity({
      tle: altSat,
      observer: NTPU_LAB_OBSERVER,
      minimumElevationDeg: 10,
      searchStartUtc: DEFAULT_EXPERIMENT_5_SEARCH_START_UTC,
      searchDurationSec: 12 * 3600, // 12 hours window to guarantee pass
    });

    assert.equal(result.satelliteId, altSat.satelliteId);
    assert.equal(result.satelliteName, altSat.satelliteName);
    assert.equal(result.provenance.isGuaranteedRfService, false);
    if (result.hasContact) {
      assert.ok(result.durationSec > 0);
      assert.ok(result.peak !== null);
      assert.ok(result.peak.maxElevationDeg >= 10);
    }
  }
});
