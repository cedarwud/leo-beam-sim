import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  compute24HourMultiSatSchedule,
  selectMaximumDurationSingleReceiverSchedule,
} from './multiSatScheduleModel';
import {
  DEFAULT_24_HOUR_SCHEDULE_START_UTC,
  EXPERIMENT_6_CONSTELLATION_SATELLITES,
  NTPU_LAB_OBSERVER,
} from './fixtures';

test('Experiment 6: 24-hour schedule extracts multi-satellite passes in chronological order', () => {
  const result = compute24HourMultiSatSchedule({
    satellites: EXPERIMENT_6_CONSTELLATION_SATELLITES,
    observer: NTPU_LAB_OBSERVER,
    minimumElevationDeg: 10,
    startUtc: DEFAULT_24_HOUR_SCHEDULE_START_UTC,
    durationHours: 24,
    sampleStepSec: 30,
  });

  assert.equal(result.satelliteCount, EXPERIMENT_6_CONSTELLATION_SATELLITES.length);
  assert.ok(result.totalPassesCount > 0, 'should extract passes over 24 hours');
  assert.equal(result.passes.length, result.totalPassesCount);

  // Strictly chronological by AOS
  for (let i = 0; i < result.passes.length - 1; i += 1) {
    const current = result.passes[i]!;
    const next = result.passes[i + 1]!;
    assert.ok(
      current.aos.instantMs <= next.aos.instantMs,
      `Pass ${current.passId} AOS (${current.aos.instantUtc}) must precede or equal next pass ${next.passId} AOS (${next.aos.instantUtc})`,
    );
  }

  // Pass integrity
  for (const pass of result.passes) {
    assert.ok(pass.durationSec > 0);
    assert.equal(pass.durationMinutes, pass.durationSec / 60);
    assert.ok(pass.aos.instantMs <= pass.peak.instantMs);
    assert.ok(pass.peak.instantMs <= pass.los.instantMs);
    assert.ok(pass.peak.maxElevationDeg >= 10);
  }
});

test('Experiment 6: uses fresh archived TLEs, the canonical NTPU observer, and a deterministic schedule', () => {
  assert.deepEqual(NTPU_LAB_OBSERVER, {
    id: 'ntpu-wgs84-v1',
    label: 'NTPU (National Taipei University, Sanxia)',
    latitudeDeg: 24.9441667,
    longitudeDeg: 121.3713889,
    heightKm: 0.05,
  });

  const startMs = Date.parse(DEFAULT_24_HOUR_SCHEDULE_START_UTC);
  const maxArchiveAgeMs = 7 * 24 * 60 * 60 * 1000;
  for (const satellite of EXPERIMENT_6_CONSTELLATION_SATELLITES) {
    assert.match(satellite.sourcePath ?? '', /^\/tle-archive\/oneweb\//);
    assert.ok(satellite.epochUtc, `${satellite.satelliteId} must carry its TLE epoch`);
    assert.ok(
      Math.abs(startMs - Date.parse(satellite.epochUtc!)) <= maxArchiveAgeMs,
      `${satellite.satelliteId} TLE epoch must be within the archive freshness bound for the schedule window`,
    );
  }

  const request = {
    satellites: EXPERIMENT_6_CONSTELLATION_SATELLITES,
    observer: NTPU_LAB_OBSERVER,
    minimumElevationDeg: 10 as const,
    startUtc: DEFAULT_24_HOUR_SCHEDULE_START_UTC,
    durationHours: 24 as const,
    sampleStepSec: 30 as const,
  };
  const first = compute24HourMultiSatSchedule(request);
  const second = compute24HourMultiSatSchedule(request);
  const stable = (result: typeof first) => ({
    ...result,
    provenance: { ...result.provenance, calculatedAtUtc: 'fixed-for-test' },
  });
  assert.deepEqual(stable(first), stable(second), 'same source inputs must yield the same schedule metrics and intervals');
  assert.equal(first.provenance.isGuaranteedRfService, false);
  assert.equal(first.provenance.scientificCategory, 'GEOMETRIC_CONTACT_OPPORTUNITY');
});

test('Experiment 6: Accurately computes Total Contact Opportunity Minutes vs. Merged Coverage Time', () => {
  const result = compute24HourMultiSatSchedule({
    satellites: EXPERIMENT_6_CONSTELLATION_SATELLITES,
    observer: NTPU_LAB_OBSERVER,
    minimumElevationDeg: 10,
    startUtc: DEFAULT_24_HOUR_SCHEDULE_START_UTC,
    durationHours: 24,
  });

  const sumPassDurations = result.passes.reduce((acc, p) => acc + p.durationMinutes, 0);
  assert.ok(
    Math.abs(result.totalContactOpportunityMinutes - sumPassDurations) < 1e-6,
    'totalContactOpportunityMinutes must exactly match sum of pass durations',
  );

  // Merged coverage must be <= raw opportunity minutes (due to simultaneous passes)
  assert.ok(
    result.totalMergedContactCoverageMinutes <= result.totalContactOpportunityMinutes + 1e-6,
    `Merged coverage (${result.totalMergedContactCoverageMinutes}m) must be <= opportunity (${result.totalContactOpportunityMinutes}m)`,
  );

  // Merged coverage cannot exceed 24 hours (1440 minutes)
  assert.ok(
    result.totalMergedContactCoverageMinutes <= 1440,
    `Merged coverage (${result.totalMergedContactCoverageMinutes}m) cannot exceed 1440m`,
  );

  // Duty cycle percentage check
  const expectedDutyCycle = (result.totalMergedContactCoverageMinutes / 1440) * 100;
  assert.ok(Math.abs(result.coverageDutyCyclePercent - expectedDutyCycle) < 1e-4);
});

test('Experiment 6: Computes longest outage and partition sum equals 24 hours', () => {
  const result = compute24HourMultiSatSchedule({
    satellites: EXPERIMENT_6_CONSTELLATION_SATELLITES,
    observer: NTPU_LAB_OBSERVER,
    minimumElevationDeg: 10,
    startUtc: DEFAULT_24_HOUR_SCHEDULE_START_UTC,
    durationHours: 24,
  });

  assert.ok(result.outages.length > 0, 'should have outage gaps in 8-sat subset');
  assert.ok(result.longestOutage !== null, 'longest outage must not be null');

  // Verify longestOutage is indeed the max
  for (const outage of result.outages) {
    assert.ok(
      result.longestOutage.durationSec >= outage.durationSec,
      'longestOutage must have duration >= every other outage',
    );
    assert.ok(outage.durationMinutes > 0);
    assert.ok(outage.startMs < outage.endMs);
  }

  // Check that (Merged Coverage Time + Total Outage Time) equals 24 hours (1440 minutes)
  const totalMinutes = result.totalMergedContactCoverageMinutes + result.totalOutageMinutes;
  assert.ok(
    Math.abs(totalMinutes - 1440) < 0.5,
    `Total partition (${totalMinutes.toFixed(2)}m) must equal 1440 minutes`,
  );
});

test('Experiment 6: Tracks overlap opportunities and concurrency distribution', () => {
  const result = compute24HourMultiSatSchedule({
    satellites: EXPERIMENT_6_CONSTELLATION_SATELLITES,
    observer: NTPU_LAB_OBSERVER,
    minimumElevationDeg: 10,
    startUtc: DEFAULT_24_HOUR_SCHEDULE_START_UTC,
    durationHours: 24,
  });

  assert.equal(result.overlapCount, result.overlaps.length);
  for (const overlap of result.overlaps) {
    assert.ok(overlap.satelliteCount >= 2, 'overlap must have >= 2 satellites');
    assert.ok(overlap.durationSec > 0);
    assert.equal(overlap.overlappingSatellites.length, overlap.satelliteCount);
  }

  assert.ok(result.maxConcurrentSatellites >= 1);

  // Concurrency distribution sums to 1440 minutes (24h)
  const dist = result.concurrencyDistributionMinutes;
  const distSum = (dist[0] ?? 0) + (dist[1] ?? 0) + (dist[2] ?? 0) + (dist[3] ?? 0);
  assert.ok(
    Math.abs(distSum - 1440) < 0.5,
    `Concurrency distribution sum (${distSum}m) must equal 1440m`,
  );
});

test('Experiment 6: Elevation mask adjustment (10° vs 20°) decreases contact opportunity and increases outages', () => {
  const result10 = compute24HourMultiSatSchedule({
    satellites: EXPERIMENT_6_CONSTELLATION_SATELLITES,
    observer: NTPU_LAB_OBSERVER,
    minimumElevationDeg: 10,
    startUtc: DEFAULT_24_HOUR_SCHEDULE_START_UTC,
    durationHours: 24,
  });

  const result20 = compute24HourMultiSatSchedule({
    satellites: EXPERIMENT_6_CONSTELLATION_SATELLITES,
    observer: NTPU_LAB_OBSERVER,
    minimumElevationDeg: 20,
    startUtc: DEFAULT_24_HOUR_SCHEDULE_START_UTC,
    durationHours: 24,
  });

  // Higher mask => less or equal opportunity
  assert.ok(
    result10.totalContactOpportunityMinutes >= result20.totalContactOpportunityMinutes,
    `10° opportunity (${result10.totalContactOpportunityMinutes}m) must be >= 20° opportunity (${result20.totalContactOpportunityMinutes}m)`,
  );

  // Higher mask => more or equal outage time
  assert.ok(
    result20.totalOutageMinutes >= result10.totalOutageMinutes - 0.1,
    `20° outage (${result20.totalOutageMinutes}m) must be >= 10° outage (${result10.totalOutageMinutes}m)`,
  );

  // Scientific Provenance Check
  assert.equal(result10.provenance.isGuaranteedRfService, false);
  assert.equal(result10.provenance.scientificCategory, 'GEOMETRIC_CONTACT_OPPORTUNITY');
});

test('Experiment 6: one-receiver schedule contains no overlap and reports its explicit objective boundary', () => {
  const result = compute24HourMultiSatSchedule({
    satellites: EXPERIMENT_6_CONSTELLATION_SATELLITES,
    observer: NTPU_LAB_OBSERVER,
    minimumElevationDeg: 10,
    startUtc: DEFAULT_24_HOUR_SCHEDULE_START_UTC,
    durationHours: 24,
  });
  const selected = selectMaximumDurationSingleReceiverSchedule(result.passes);
  assert.equal(selected.objective, 'MAXIMUM_GEOMETRIC_OPPORTUNITY_DURATION');
  assert.equal(selected.assumption, 'ONE_TRACKING_CHANNEL_ZERO_SWITCH_GUARD');
  assert.ok(selected.windows.length > 0);
  assert.ok(selected.totalDurationMinutes <= result.totalContactOpportunityMinutes + 1e-9);
  for (let index = 1; index < selected.windows.length; index += 1) {
    assert.ok(
      selected.windows[index - 1]!.los.instantMs <= selected.windows[index]!.aos.instantMs,
      'selected one-receiver windows must not overlap',
    );
  }
});
