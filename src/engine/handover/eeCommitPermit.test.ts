import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE } from './eeThreshold';
import {
  mintInitialAttachPermit,
  mintLegacyEeBlindPermit,
  mintMeasuredEePermit,
  permitIsEeBlind,
} from './eeCommitPermit';

/**
 * The expected value is written here as a literal on purpose.
 *
 * A red-team exercise changed DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE from 135 to
 * 130 and nothing failed: every check either derived its expectation from the
 * production constant, or exercised EE values far from the boundary. A test
 * that reads the constant it is meant to protect cannot detect a change to it.
 */
const AUTHORITATIVE_THRESHOLD_KBIT_PER_JOULE = 135;
const THRESHOLD_BITS_PER_JOULE = AUTHORITATIVE_THRESHOLD_KBIT_PER_JOULE * 1000;

test('the default EE threshold is 135 Kbit/J, asserted independently of the constant', () => {
  assert.equal(DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE, AUTHORITATIVE_THRESHOLD_KBIT_PER_JOULE);
});

test('a serving link one bit/J below the floor may be replaced; exactly at the floor may not', () => {
  const belowFloor = mintMeasuredEePermit({
    path: 'live-cell:ee-optimization',
    servingEeBitsPerJoule: THRESHOLD_BITS_PER_JOULE - 1,
    targetEeBitsPerJoule: THRESHOLD_BITS_PER_JOULE * 2,
    thresholdBitsPerJoule: THRESHOLD_BITS_PER_JOULE,
  });
  assert.notEqual(belowFloor, null, '134_999 bit/J is below the floor and must be replaceable');

  const atFloor = mintMeasuredEePermit({
    path: 'live-cell:ee-optimization',
    servingEeBitsPerJoule: THRESHOLD_BITS_PER_JOULE,
    targetEeBitsPerJoule: THRESHOLD_BITS_PER_JOULE * 2,
    thresholdBitsPerJoule: THRESHOLD_BITS_PER_JOULE,
  });
  assert.equal(atFloor, null, 'a link exactly at the floor is still healthy and must not hand over');
});

test('a target no better than the serving link is refused even when the serving link is unhealthy', () => {
  const notBetter = mintMeasuredEePermit({
    path: 'live-cell:ee-optimization',
    servingEeBitsPerJoule: 100_000,
    targetEeBitsPerJoule: 100_000,
    thresholdBitsPerJoule: THRESHOLD_BITS_PER_JOULE,
  });
  assert.equal(notBetter, null, 'an equal-EE target is not an improvement');

  const worse = mintMeasuredEePermit({
    path: 'live-cell:ee-optimization',
    servingEeBitsPerJoule: 100_000,
    targetEeBitsPerJoule: 90_000,
    thresholdBitsPerJoule: THRESHOLD_BITS_PER_JOULE,
  });
  assert.equal(worse, null, 'a worse target must never be admitted');
});

test('absent or non-finite evidence is refused rather than treated as zero', () => {
  for (const serving of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(
      mintMeasuredEePermit({
        path: 'live-cell:ee-optimization',
        servingEeBitsPerJoule: serving,
        targetEeBitsPerJoule: 200_000,
        thresholdBitsPerJoule: THRESHOLD_BITS_PER_JOULE,
      }),
      null,
      `serving EE ${String(serving)} is not evidence`,
    );
  }
  assert.equal(
    mintMeasuredEePermit({
      path: 'live-cell:ee-optimization',
      servingEeBitsPerJoule: 100_000,
      targetEeBitsPerJoule: null,
      thresholdBitsPerJoule: THRESHOLD_BITS_PER_JOULE,
    }),
    null,
    'a target with no measured EE is not evidence',
  );
});

test('initial attach is authorized without EE evidence, and says so on the permit', () => {
  const permit = mintInitialAttachPermit('manager:initial-attach');
  assert.equal(permit.evidence.kind, 'initial-attach');
  assert.equal(permitIsEeBlind(permit), false, 'initial attach is not an EE-blind gap; it has no prior link');
});

test('an EE-blind permit is marked as such so the oracle can ledger it', () => {
  const permit = mintLegacyEeBlindPermit('manager:intra-dwell');
  assert.equal(permit.evidence.kind, 'legacy-ee-blind');
  assert.equal(permitIsEeBlind(permit), true);
  assert.equal(permit.path, 'manager:intra-dwell');
});

test('a measured permit records the evidence it was granted against', () => {
  const permit = mintMeasuredEePermit({
    path: 'live-cell:ee-optimization',
    servingEeBitsPerJoule: 120_000,
    targetEeBitsPerJoule: 500_000,
    thresholdBitsPerJoule: THRESHOLD_BITS_PER_JOULE,
  });
  assert.notEqual(permit, null);
  assert.equal(permit!.evidence.kind, 'measured');
  if (permit!.evidence.kind !== 'measured') return;
  assert.equal(permit!.evidence.servingEeBitsPerJoule, 120_000);
  assert.equal(permit!.evidence.thresholdBitsPerJoule, THRESHOLD_BITS_PER_JOULE);
  assert.equal(permitIsEeBlind(permit!), false);
});
