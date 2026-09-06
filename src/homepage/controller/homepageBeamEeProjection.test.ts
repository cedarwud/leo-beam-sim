import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  homepageBeamEeKey,
  homepageBeamEeNormalizedByKey,
  homepageSatelliteEeProgressById,
  type HomepageBeamEeSource,
} from './homepageBeamEeProjection';

/**
 * The scale `6b9474e` substituted for `metric.eeNormalized`, restated here.
 *
 * Written out rather than imported because the production copy was deleted: the
 * point of these tests is that this mapping must NOT reappear, so the tests
 * carry their own copy of the thing they forbid. If someone reintroduces it,
 * the assertions below compare against it and fail.
 */
function fixedScale(eeBitsPerJoule: number): number {
  return Math.max(0, Math.min(1, (eeBitsPerJoule - 80_000) / (180_000 - 80_000)));
}

/**
 * One realistic homepage frame, mid-handover.
 *
 * The demo EE producer bounds every value into 80,000-180,000 bits/J and seeds
 * attach at 176,000 (serving) / 145,000 (replacement), so the whole frame lands
 * in the top third of that band. `eeNormalized` is what `beamMetrics.ts`
 * publishes for it: frame-relative over min 145,000 / max 176,000.
 */
const FRAME: readonly (HomepageBeamEeSource & { readonly energyEfficiencyBitsPerJoule: number | null })[] = [
  { satelliteId: 'sat-serving', beamId: 3, energyEfficiencyBitsPerJoule: 176_000, eeNormalized: 1 },
  { satelliteId: 'sat-serving', beamId: 4, energyEfficiencyBitsPerJoule: 145_000, eeNormalized: 0 },
  { satelliteId: 'sat-target', beamId: 1, energyEfficiencyBitsPerJoule: 170_000, eeNormalized: 0.8064516129032258 },
  { satelliteId: 'sat-dark', beamId: 0, energyEfficiencyBitsPerJoule: null, eeNormalized: null },
];

test('the per-beam map is the published eeNormalized, not a re-derivation from bits/J', () => {
  const byKey = homepageBeamEeNormalizedByKey(FRAME);

  for (const metric of FRAME) {
    assert.equal(
      byKey.get(homepageBeamEeKey(metric.satelliteId, metric.beamId)),
      metric.eeNormalized,
      `${metric.satelliteId}:${metric.beamId} must carry the frame-relative value verbatim`,
    );
  }

  // The discriminator: on this frame the two mappings disagree on every beam.
  // Without this, a re-derivation could pass the pass-through assertions above
  // on a frame where the scales happen to coincide.
  for (const metric of FRAME) {
    if (metric.energyEfficiencyBitsPerJoule === null) continue;
    assert.notEqual(
      byKey.get(homepageBeamEeKey(metric.satelliteId, metric.beamId)),
      fixedScale(metric.energyEfficiencyBitsPerJoule),
      `${metric.satelliteId}:${metric.beamId} must not be the fixed 80k-180k scale`,
    );
  }
});

test('the frame-relative projection keeps a readable gradient where the fixed scale flattens it', () => {
  const byKey = homepageBeamEeNormalizedByKey(FRAME);
  const finite = [...byKey.values()].filter((value): value is number => value !== null);
  const spread = Math.max(...finite) - Math.min(...finite);

  const fixed = FRAME
    .map(metric => metric.energyEfficiencyBitsPerJoule)
    .filter((ee): ee is number => ee !== null)
    .map(fixedScale);
  const fixedSpread = Math.max(...fixed) - Math.min(...fixed);

  // This is the acceptance sentence "beam colour goes faint to strong" stated
  // as a number. Every beam in a demo frame sits in the top third of the
  // 80k-180k band, so the fixed scale compresses the whole handover into about
  // a third of the available contrast.
  assert.equal(spread, 1, 'a frame-relative normalization spans the full range');
  assert.ok(
    fixedSpread < 0.35,
    `the fixed scale was expected to flatten this frame; it spread ${fixedSpread.toFixed(3)}`,
  );
  assert.ok(spread > fixedSpread * 2, 'the published normalization must stay the more legible one');
});

test('a single-beam frame reads as the neutral midpoint, not as near-maximum', () => {
  // `beamMetrics.normalizeEe` returns 0.5 when a frame has no contrast to
  // measure. The fixed scale would call the same beam 0.96 -- an isolated beam
  // rendered as though it were the strongest thing on screen.
  const lone: readonly HomepageBeamEeSource[] = [
    { satelliteId: 'sat-only', beamId: 0, eeNormalized: 0.5 },
  ];
  assert.equal(homepageBeamEeNormalizedByKey(lone).get('sat-only:0'), 0.5);
  assert.ok(fixedScale(176_000) > 0.9, 'the scale this replaces would have called it near-maximum');
});

test('satellite progress takes that satellite s best beam', () => {
  const progress = homepageSatelliteEeProgressById(FRAME);
  assert.equal(progress.get('sat-serving'), 1, 'the better of 1 and 0');
  assert.equal(progress.get('sat-target'), 0.8064516129032258);
});

test('a satellite with no measurable EE stays in the map as null rather than disappearing', () => {
  const progress = homepageSatelliteEeProgressById(FRAME);
  assert.equal(progress.has('sat-dark'), true, 'a satellite present in the frame must stay present');
  assert.equal(progress.get('sat-dark'), null);
});

test('a later measurable beam replaces an earlier unmeasurable one for the same satellite', () => {
  const progress = homepageSatelliteEeProgressById([
    { satelliteId: 'sat-x', beamId: 0, eeNormalized: null },
    { satelliteId: 'sat-x', beamId: 1, eeNormalized: 0.4 },
  ]);
  assert.equal(progress.get('sat-x'), 0.4, 'null must not shadow a real measurement');
});

test('non-finite and out-of-range values are handled rather than propagated', () => {
  const progress = homepageSatelliteEeProgressById([
    { satelliteId: 'sat-nan', beamId: 0, eeNormalized: Number.NaN },
    { satelliteId: 'sat-high', beamId: 0, eeNormalized: 1.4 },
    { satelliteId: 'sat-low', beamId: 0, eeNormalized: -0.2 },
  ]);
  assert.equal(progress.get('sat-nan'), null, 'NaN is not a measurement');
  assert.equal(progress.get('sat-high'), 1, 'progress is clamped for the renderer');
  assert.equal(progress.get('sat-low'), 0);
});

test('an empty frame produces empty maps rather than throwing', () => {
  assert.equal(homepageBeamEeNormalizedByKey([]).size, 0);
  assert.equal(homepageSatelliteEeProgressById([]).size, 0);
});
