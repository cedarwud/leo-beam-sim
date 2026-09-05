import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_EE_THRESHOLD_KBIT_PER_JOULE } from './eeThreshold';
import {
  assertMintedPermit,
  mintContinuityEePermit,
  mintInitialAttachPermit,
  mintLegacyEeBlindPermit,
  mintMeasuredEePermit,
  permitIsEeBlind,
  type EeCommitPermit,
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
  // The target was passed in and never asserted, so dropping or corrupting it
  // while building the evidence object went unnoticed. The permit's whole
  // purpose is to record what it was granted against.
  assert.equal(permit!.evidence.targetEeBitsPerJoule, 500_000);
  assert.equal(permit!.evidence.thresholdBitsPerJoule, THRESHOLD_BITS_PER_JOULE);
  assert.equal(permitIsEeBlind(permit!), false);
});

test('a fabricated permit object is rejected even though it satisfies the type', () => {
  // The type brand is phantom, so a JSON round-trip through `any` produces an
  // object tsc accepts and the source-text guard cannot see (it is not a type
  // assertion). Runtime identity is what rejects it.
  const forged = JSON.parse(JSON.stringify({
    path: 'live-cell:ee-optimization',
    evidence: {
      kind: 'measured',
      servingEeBitsPerJoule: 200_000,
      targetEeBitsPerJoule: 100_000,
      thresholdBitsPerJoule: 135_000,
    },
  })) as EeCommitPermit;
  assert.throws(
    () => assertMintedPermit(forged, 'test'),
    /was not issued by eeCommitPermit\.ts/,
  );
});

test('a genuinely minted permit passes the check exactly once', () => {
  const real = mintInitialAttachPermit('manager:initial-attach');
  assert.doesNotThrow(() => assertMintedPermit(real, 'test'));
  // A permit authorizes ONE commit. Replaying it would let evidence gathered
  // for one frame authorize a commit in a later frame where it no longer holds.
  assert.throws(() => assertMintedPermit(real, 'test'), /already been used/);
});

test('negative EE is refused: it is an error sentinel, not evidence', () => {
  // EE is bits per joule and cannot be negative. Comparing two negatives
  // produces an ordering that means nothing, and the old code minted on it:
  // serving -10, target 0 satisfied "target strictly better" and authorized a
  // handover onto a link carrying no data at all.
  assert.equal(
    mintMeasuredEePermit({
      path: 'live-cell:ee-optimization',
      servingEeBitsPerJoule: -10,
      targetEeBitsPerJoule: 0,
      thresholdBitsPerJoule: 50_000,
    }),
    null,
  );
  assert.equal(
    mintMeasuredEePermit({
      path: 'live-cell:ee-optimization',
      servingEeBitsPerJoule: -50,
      targetEeBitsPerJoule: -20,
      thresholdBitsPerJoule: -10,
    }),
    null,
    'a negative threshold is not a configuration this rule can be evaluated against',
  );
  assert.equal(
    mintContinuityEePermit({
      path: 'live-cell:service-continuity-fallback',
      servingEeBitsPerJoule: -1,
      thresholdBitsPerJoule: 135_000,
    }),
    null,
    'a -1 measurement sentinel must not read as "below the floor"',
  );
});

test('a zero-EE target is refused, though the strictly-better rule already covers it', () => {
  // Honest note, because the first version of this test claimed more than it
  // proved: with serving EE required to be non-negative, `target > serving`
  // already implies `target > 0`, so the explicit `targetEeBitsPerJoule <= 0`
  // check in production cannot be triggered independently. It is kept as
  // defence in depth, and this test documents the composite behaviour rather
  // than pretending to exercise that branch alone.
  assert.equal(
    mintMeasuredEePermit({
      path: 'live-cell:ee-optimization',
      servingEeBitsPerJoule: 0,
      targetEeBitsPerJoule: 0,
      thresholdBitsPerJoule: 135_000,
    }),
    null,
    'a dead link is never a handover target, by whichever rule rejects it first',
  );
});

test('a structural clone of a real permit is still rejected', () => {
  const real = mintInitialAttachPermit('manager:initial-attach');
  const clone = { ...real } as EeCommitPermit;
  assert.throws(() => assertMintedPermit(clone, 'test'), /was not issued/);
});

test('a non-finite threshold is refused rather than minting on absent evidence', () => {
  assert.equal(
    mintMeasuredEePermit({
      path: 'live-cell:ee-optimization',
      servingEeBitsPerJoule: 100_000,
      targetEeBitsPerJoule: 200_000,
      thresholdBitsPerJoule: Number.NaN,
    }),
    null,
    'every comparison against NaN is false, so this would otherwise mint on no evidence',
  );
});
