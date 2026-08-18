#!/usr/bin/env node
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  angularSeparationDeg,
  deduplicatePassEvents,
  extractPassEvents,
  planPassDiversity,
  type PassGeometrySource,
} from './index';

function source(
  times: readonly number[],
  samples: Record<string, readonly (Record<string, unknown> | null)[]>,
): PassGeometrySource {
  return {
    anchorTimes: times,
    satelliteIds: Object.keys(samples),
    samples,
  };
}

function sample(elevationDeg: number, azimuthDeg: number, rangeKm = 900, orbitalPlaneKey?: string) {
  return { elevationDeg, azimuthDeg, rangeKm, ...(orbitalPlaneKey === undefined ? {} : { orbitalPlaneKey }) };
}

test('extracts complete passes and rejects passes truncated by either run boundary', () => {
  const geometry = source(
    [0, 30, 60, 90, 120, 150, 180, 210],
    {
      complete: [sample(-5, 20), sample(12, 30), sample(72, 45), sample(20, 60), sample(-4, 75), sample(-5, 80), sample(10, 100), sample(40, 110)],
      startsVisible: [sample(4, 10), sample(30, 20), sample(-3, 30), sample(-4, 40), sample(-5, 50), sample(-5, 60), sample(-5, 70), sample(-5, 80)],
      endsVisible: [sample(-5, 10), sample(-5, 20), sample(-5, 30), sample(10, 40), sample(60, 50), sample(20, 60), sample(3, 70), sample(1, 80)],
    },
  );
  const events = extractPassEvents(geometry);
  assert.equal(events.length, 1);
  const pass = events[0];
  assert.equal(pass.satelliteId, 'complete');
  assert.ok(Math.abs(pass.aos - 8.823529411764707) < 1e-12);
  assert.equal(pass.peak, 60);
  assert.equal(pass.los, 115);
  assert.equal(pass.maxElevationDeg, 72);
  assert.equal(pass.peakAzimuthDeg, 45);
  assert.equal(pass.peakRangeKm, 900);
  assert.ok(Math.abs(pass.entryAzimuthDeg - 22.941176470588232) < 1e-12);
  assert.equal(pass.exitAzimuthDeg, 72.5);
  assert.ok(pass.passId.startsWith('pass-complete-'));
});

test('orders extraction deterministically independent of satellite-id input order', () => {
  const first = source([0, 30, 60, 90], {
    zeta: [sample(-1, 180), sample(40, 190), sample(40, 200), sample(-1, 210)],
    alpha: [sample(-1, 10), sample(40, 20), sample(40, 30), sample(-1, 40)],
  });
  const second = source([0, 30, 60, 90], {
    alpha: [sample(-1, 10), sample(40, 20), sample(40, 30), sample(-1, 40)],
    zeta: [sample(-1, 180), sample(40, 190), sample(40, 200), sample(-1, 210)],
  });
  const firstEvents = extractPassEvents(first);
  const secondEvents = extractPassEvents(second);
  assert.deepEqual(firstEvents, secondEvents);
  assert.deepEqual(firstEvents.map(event => event.satelliteId), ['alpha', 'zeta']);
  assert.equal(firstEvents[0].passId, secondEvents[0].passId);
});

test('callback geometry uses one shared anchor axis without per-satellite shifting', () => {
  const calls: Array<{ satelliteId: string; anchorTime: number; anchorIndex: number }> = [];
  const geometry: PassGeometrySource = {
    anchorTimes: [0, 30, 60, 90, 120],
    satelliteIds: ['A', 'B'],
    sample: (satelliteId, anchorTime, anchorIndex) => {
      calls.push({ satelliteId, anchorTime: anchorTime as number, anchorIndex });
      const elevations: Record<string, readonly number[]> = {
        A: [-1, 40, 75, 40, -1],
        B: [-1, -1, 30, 70, -1],
      };
      return { azimuthDeg: satelliteId === 'A' ? 20 : 200, elevationDeg: elevations[satelliteId][anchorIndex], rangeKm: 900 };
    },
  };
  const events = extractPassEvents(geometry);
  assert.deepEqual(events.map(event => event.satelliteId), ['A', 'B']);
  assert.deepEqual(calls.filter(call => call.satelliteId === 'A').map(call => call.anchorTime), [0, 30, 60, 90, 120]);
  assert.deepEqual(calls.filter(call => call.satelliteId === 'B').map(call => call.anchorTime), [0, 30, 60, 90, 120]);
  assert.deepEqual(calls.filter(call => call.satelliteId === 'B').map(call => call.anchorIndex), [0, 1, 2, 3, 4]);
});

test('deduplicates near-identical passes but retains spatially distinct passes', () => {
  const geometry = source([0, 30, 60, 90, 120], {
    a: [sample(-1, 20), sample(45, 40, 900, 'plane-a'), sample(80, 50, 880, 'plane-a'), sample(35, 60, 900, 'plane-a'), sample(-1, 70)],
    b: [sample(-1, 21), sample(44, 41, 901, 'plane-a'), sample(79, 51, 881, 'plane-a'), sample(34, 61, 901, 'plane-a'), sample(-1, 71)],
    c: [sample(-1, 200), sample(43, 205, 901, 'plane-b'), sample(78, 210, 881, 'plane-b'), sample(33, 215, 901, 'plane-b'), sample(-1, 220)],
  });
  const events = extractPassEvents(geometry);
  assert.equal(events.length, 3);
  const deduplicated = deduplicatePassEvents(events);
  assert.equal(deduplicated.length, 2);
  assert.deepEqual(deduplicated.map(event => event.satelliteId), ['a', 'c']);
  assert.ok(angularSeparationDeg(50, 80, 51, 79) < 10);
  assert.ok(angularSeparationDeg(50, 80, 210, 78) > 10);
});

test('selects distinct high passes and exposes policy provenance', () => {
  const geometry = source([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 420, 450], {
    a: [sample(-1, 10), sample(30, 20), sample(75, 30, 900, 'p1'), sample(30, 40), sample(-1, 50), sample(-1, 60), sample(-1, 70), sample(-1, 80), sample(-1, 90), sample(-1, 100), sample(-1, 110), sample(-1, 120), sample(-1, 130), sample(-1, 140), sample(-1, 150), sample(-1, 160)],
    b: [sample(-1, 200), sample(-1, 210), sample(-1, 220), sample(-1, 230), sample(-1, 240), sample(25, 250), sample(72, 260, 900, 'p2'), sample(25, 270), sample(-1, 280), sample(-1, 290), sample(-1, 300), sample(-1, 310), sample(-1, 320), sample(-1, 330), sample(-1, 340), sample(-1, 350)],
  });
  const plan = planPassDiversity(geometry, { policyRevision: 'test-pass-policy-v7' });
  assert.equal(plan.policyRevision, 'test-pass-policy-v7');
  assert.deepEqual(plan.selectedPassIds, plan.provenance.selectedPassIds);
  assert.deepEqual(plan.serviceSequence.map(pass => pass.satelliteId), ['a', 'b']);
  assert.equal(plan.serviceSequence[0].nextCandidatePassId, null);
});

test('candidate is null until a real candidate is above horizon at the common anchor', () => {
  const geometry = source([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 420], {
    a: [sample(-1, 10), sample(30, 20), sample(70, 30), sample(30, 40), sample(-1, 50), sample(-1, 60), sample(-1, 70), sample(-1, 80), sample(-1, 90), sample(-1, 100), sample(-1, 110), sample(-1, 120), sample(-1, 130), sample(-1, 140), sample(-1, 150)],
    b: [sample(-1, 200), sample(-1, 210), sample(-1, 220), sample(-1, 230), sample(-1, 240), sample(-1, 250), sample(20, 260), sample(60, 270), sample(20, 280), sample(-1, 290), sample(-1, 300), sample(-1, 310), sample(-1, 320), sample(-1, 330), sample(-1, 340)],
  });
  const plan = planPassDiversity(geometry);
  const a = plan.passes.find(pass => pass.satelliteId === 'a')!;
  const b = plan.passes.find(pass => pass.satelliteId === 'b')!;
  const beforeB = plan.nextCandidateByAnchor.find(anchor => anchor.anchorTimeSec < b.aos && anchor.servingPassId === a.passId);
  assert.ok(beforeB);
  assert.equal(beforeB.candidatePassId, null);
  assert.equal(plan.nextCandidateByPassId[a.passId], null, 'candidate continuation is intentionally not qualified in this short pass');
});

test('returns null rather than inventing a candidate when overlap/continuation fail', () => {
  const geometry = source([0, 30, 60, 90, 120, 150, 180, 210, 240, 270], {
    a: [sample(-1, 10), sample(30, 20), sample(70, 30), sample(30, 40), sample(-1, 50), sample(-1, 60), sample(-1, 70), sample(-1, 80), sample(-1, 90), sample(-1, 100)],
    b: [sample(-1, 200), sample(-1, 210), sample(-1, 220), sample(20, 230), sample(70, 240), sample(20, 250), sample(-1, 260), sample(-1, 270), sample(-1, 280), sample(-1, 290)],
  });
  const plan = planPassDiversity(geometry);
  assert.ok(plan.nextCandidateByAnchor.every(anchor => anchor.candidatePassId === null));
  assert.ok(plan.nextCandidateByPassId[plan.passes[0]?.passId ?? 'missing'] === null);
});

test('builds A to B to C chain on one shared anchor axis', () => {
  const times = Array.from({ length: 31 }, (_, index) => index * 30);
  const makeSeries = (aos: number, peak: number, los: number, azimuth: number, plane: string) => times.map(time => {
    if (time < aos || time > los) return sample(-1, azimuth, 900, plane);
    const distance = Math.abs(time - peak);
    return sample(Math.max(-1, 80 - distance / 3), azimuth + (time - peak) / 4, 900, plane);
  });
  const plan = planPassDiversity(source(times, {
    A: makeSeries(30, 150, 300, 20, 'p1'),
    B: makeSeries(240, 390, 540, 140, 'p2'),
    C: makeSeries(480, 630, 780, 260, 'p3'),
  }));
  assert.deepEqual(plan.serviceSequence.map(pass => pass.satelliteId), ['A', 'B', 'C']);
  const a = plan.passes.find(pass => pass.satelliteId === 'A')!;
  const b = plan.passes.find(pass => pass.satelliteId === 'B')!;
  assert.equal(plan.nextCandidateByPassId[a.passId], b.passId);
  assert.equal(plan.nextCandidateByPassId[b.passId], plan.passes.find(pass => pass.satelliteId === 'C')!.passId);
  assert.ok(plan.nextCandidateByAnchor.every(anchor => anchor.anchorTimeSec % 30 === 0));
});

test('uses current masked geometry for service and candidate instead of pass peaks or LOS stickiness', () => {
  const times = Array.from({ length: 13 }, (_, index) => index * 30);
  const geometry = source(times, {
    // A wins on whole-pass peak, but is below the service mask at the target
    // anchor. The planner must not retain it merely because its LOS is later.
    A: [sample(-5, 10), sample(80, 20), sample(70, 30), sample(7.5, 40), sample(70, 50), sample(40, 60), sample(-5, 70), sample(-5, 80), sample(-5, 90), sample(-5, 100), sample(-5, 110), sample(-5, 120), sample(-5, 130)],
    // B has a better whole-pass peak than C, but is below the 15-degree mask
    // at the target anchor and therefore cannot be the candidate.
    B: [sample(-5, 160), sample(-5, 170), sample(20, 180), sample(3.6, 190), sample(79, 200), sample(60, 210), sample(50, 220), sample(40, 230), sample(30, 240), sample(20, 250), sample(10, 260), sample(-5, 270), sample(-5, 280)],
    C: [sample(-5, 300), sample(15, 310), sample(50, 320), sample(72, 330), sample(60, 340), sample(50, 350), sample(40, 0), sample(30, 10), sample(20, 20), sample(10, 30), sample(8, 40), sample(5, 50), sample(-5, 60)],
    // D is the strongest current valid service at the target anchor. Its LOS
    // is deliberately earlier than C's so C remains a real continuation.
    D: [sample(-5, 70), sample(20, 80), sample(55, 90), sample(74, 100), sample(68, 110), sample(60, 120), sample(50, 130), sample(0, 140), sample(-5, 150), sample(-5, 160), sample(-5, 170), sample(-5, 180), sample(-5, 190)],
  });

  const plan = planPassDiversity(geometry);
  const target = plan.serviceAnchors.find(anchor => anchor.anchorTimeSec === 90);
  assert.ok(target, 'target anchor should be planned');
  const serving = plan.passes.find(pass => pass.passId === target.servingPassId);
  const candidate = plan.passes.find(pass => pass.passId === target.candidatePassId);

  assert.equal(serving?.satelliteId, 'D');
  assert.equal(candidate?.satelliteId, 'C');
  assert.ok((serving?.maxElevationDeg ?? -Infinity) >= 15);
  assert.ok((candidate?.maxElevationDeg ?? -Infinity) >= 15);
});
