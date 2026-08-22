#!/usr/bin/env node
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SIX_ACTS_ARMS,
  SixActsSelectionError,
  getSixActsArmSpec,
  selectSixActsCandidate,
  type SixActsArmCandidate,
} from './armStrategy';

function candidate(overrides: Partial<SixActsArmCandidate> = {}): SixActsArmCandidate {
  return {
    satelliteId: '49194',
    beamId: 0,
    rateMbps: 10,
    projectedSystemPowerW: 10,
    ...overrides,
  };
}

test('an arm changes only the ranking rule', () => {
  assert.deepStrictEqual(
    SIX_ACTS_ARMS.map(spec => `${spec.id}:${spec.rankBy}`),
    ['baseline:rate', 'eco:rate-per-system-power'],
  );
});

test('an arm spec carries no power cap and no seed to set', () => {
  // Ruling 2026-08-22: those two are the forbidden ways to express an arm, so
  // the spec offers no field to express them with.
  for (const spec of SIX_ACTS_ARMS) {
    const keys = Object.keys(spec);
    assert.deepStrictEqual(keys.sort(), ['formula', 'id', 'labelZhHant', 'rankBy', 'whyZhHant']);
    const serialized = JSON.stringify(spec);
    assert.ok(!/cap|seed|pMax|powerLimit/i.test(serialized));
  }
});

test('the formulas use the active symbol authority', () => {
  assert.strictEqual(getSixActsArmSpec('baseline').formula, 'R_{u,s,v}');
  assert.strictEqual(getSixActsArmSpec('eco').formula, 'R_{u,s,v} / P^N');
});

test('baseline takes the fastest candidate, eco the most efficient', () => {
  const candidates = [
    candidate({ satelliteId: 'fast-and-thirsty', rateMbps: 20, projectedSystemPowerW: 20 }),
    candidate({ satelliteId: 'slower-and-lean', rateMbps: 12, projectedSystemPowerW: 6 }),
  ];

  const baseline = selectSixActsCandidate(candidates, 'baseline');
  const eco = selectSixActsCandidate(candidates, 'eco');

  assert.strictEqual(baseline.chosen.satelliteId, 'fast-and-thirsty');
  assert.strictEqual(baseline.score, 20);
  assert.strictEqual(eco.chosen.satelliteId, 'slower-and-lean');
  assert.strictEqual(eco.score, 2);
  assert.strictEqual(baseline.armsAgree, false);
  assert.strictEqual(eco.armsAgree, false);
});

test('agreement between the arms is reported, not hidden', () => {
  // At many operating points the two rules pick the same satellite. Saying so
  // is the honest result; a lesson must not claim a difference that is absent.
  const candidates = [
    candidate({ satelliteId: 'best-at-both', rateMbps: 20, projectedSystemPowerW: 5 }),
    candidate({ satelliteId: 'worse-at-both', rateMbps: 10, projectedSystemPowerW: 10 }),
  ];

  assert.strictEqual(selectSixActsCandidate(candidates, 'baseline').armsAgree, true);
  assert.strictEqual(selectSixActsCandidate(candidates, 'eco').armsAgree, true);
});

test('ties keep the earlier candidate so replays are deterministic', () => {
  const candidates = [
    candidate({ satelliteId: 'first', rateMbps: 10, projectedSystemPowerW: 5 }),
    candidate({ satelliteId: 'second', rateMbps: 10, projectedSystemPowerW: 5 }),
  ];

  assert.strictEqual(selectSixActsCandidate(candidates, 'baseline').chosen.satelliteId, 'first');
  assert.strictEqual(selectSixActsCandidate(candidates, 'eco').chosen.satelliteId, 'first');
});

test('eco needs a positive projected system power', () => {
  assert.throws(
    () => selectSixActsCandidate([candidate({ projectedSystemPowerW: 0 })], 'eco'),
    error => {
      assert.ok(error instanceof SixActsSelectionError);
      assert.strictEqual(error.code, 'INVALID_SYSTEM_POWER');
      return true;
    },
  );
  // Baseline never divides, so a zero projection is not its problem — but the
  // arms cannot be compared on that data, and that is reported as unknown.
  const baseline = selectSixActsCandidate([candidate({ projectedSystemPowerW: 0 })], 'baseline');
  assert.strictEqual(baseline.chosen.satelliteId, '49194');
  assert.strictEqual(baseline.armsAgree, null);
});

test('an empty candidate set is a typed failure', () => {
  assert.throws(() => selectSixActsCandidate([], 'eco'), error => {
    assert.ok(error instanceof SixActsSelectionError);
    assert.strictEqual(error.code, 'NO_CANDIDATES');
    return true;
  });
});
