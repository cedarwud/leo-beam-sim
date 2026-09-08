/**
 * CHARACTERIZATION TEST — what a MOUNTED cone/callout draws.
 *
 * This is a photograph, not a specification. Every literal below was produced
 * by running the code.
 *
 * ## The blind spot this closes
 *
 * `scene/appearanceCharacterization.test.ts` photographs the cone RESOLVERS —
 * the values computed before a cone reaches the scene graph. The mount then
 * discarded those values on the homepage and computed its own, so the pinned
 * photograph and the drawn pixel were different numbers and nothing compared
 * them. Measured, before the convergence, on a non-hero serving beam:
 *
 *     sat-a beam 1   resolver -> #69e95d     mount -> #8ad183   <- drawn
 *
 * ## What is pinned here
 *
 *   1. The mount and the shared paint path now produce the SAME colour for the
 *      same beam and the same primary-identity answer. That is the property
 *      that broke.
 *   2. The two surfaces' primary-identity rules, as a truth table. They differ,
 *      that difference is deliberate and preserved, and it is now one table
 *      instead of two expressions in two files.
 *   3. The RECORDED FRONTIER: the mount still drops the handover shade on the
 *      homepage. That is unchanged behaviour, pinned so that turning it on is a
 *      visible, deliberate change rather than a silent one.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  MOUNT_APPLIES_HANDOVER_SHADE,
  PRIMARY_IDENTITY_BEAM_RULES,
  resolveMountedConeColor,
  resolvePrimaryIdentityBeam,
} from './mountedConeAppearance';
import { paintConeItem } from './paintConeItems';
import { homepageBeamIdentityLookup } from '../homepage/controller/homepageSatelliteVisualIdentity';

const eeByKey = new Map<string, number>([['sat-a:1', 0.4]]);
const homepageColorFor = homepageBeamIdentityLookup(eeByKey);

const coneItem = (satId: string, beamId: number, extra: Record<string, unknown> = {}) => ({
  satId,
  cellId: beamId - 1,
  beamId,
  color: '#itemcolor',
  ...extra,
});

test('the mount paints the homepage projection through the shared ladder', () => {
  // Pinned literals, produced by running the code. `sat-a` beam 1 carries a
  // finite EE (0.4) and beam 2 does not, so both the EE and the slot fallback
  // paths are photographed.
  assert.equal(
    resolveMountedConeColor({
      item: coneItem('sat-a', 1), roleColor: '#role', homepageIdentity: true,
      primaryIdentityBeam: true, homepageColorFor,
    }),
    '#61e955',
  );
  assert.equal(
    resolveMountedConeColor({
      item: coneItem('sat-a', 1), roleColor: '#role', homepageIdentity: true,
      primaryIdentityBeam: false, homepageColorFor,
    }),
    '#84cf7d',
  );
  assert.equal(
    resolveMountedConeColor({
      item: coneItem('sat-serving', 2), roleColor: '#role', homepageIdentity: true,
      primaryIdentityBeam: true, homepageColorFor,
    }),
    '#3361eb',
  );
  assert.equal(
    resolveMountedConeColor({
      item: coneItem('sat-serving', 2), roleColor: '#role', homepageIdentity: true,
      primaryIdentityBeam: false, homepageColorFor,
    }),
    '#637dcc',
  );
});

test('the mount and the shared paint path cannot disagree about one beam', () => {
  for (const satId of ['sat-a', 'sat-serving', 'shell-a-P0-S3']) {
    for (const beamId of [1, 2, 5]) {
      for (const primaryIdentityBeam of [true, false]) {
        const item = coneItem(satId, beamId);
        const mounted = resolveMountedConeColor({
          item, roleColor: '#role', homepageIdentity: true, primaryIdentityBeam, homepageColorFor,
        });
        // The shared path, as `servingConeItems.ts` runs it: the same ladder,
        // the same source, the same flag.
        const shared = paintConeItem(item, {
          resolveIdentityColor: homepageColorFor,
          prominence: 'serving',
          isServingOrCandidate: primaryIdentityBeam,
        }).color;
        assert.equal(
          mounted, shared,
          `${satId}/${beamId} primary=${primaryIdentityBeam}: the mount recomputed a different colour than the shared path`,
        );
      }
    }
  }
});

test('the mount paints the role colour when the homepage does not own identity', () => {
  assert.equal(
    resolveMountedConeColor({
      item: coneItem('sat-a', 1), roleColor: '#role', homepageIdentity: false,
      primaryIdentityBeam: true, homepageColorFor,
    }),
    '#role',
  );
  // A missing source is a miss, not a licence to invent: the role colour stands.
  assert.equal(
    resolveMountedConeColor({
      item: coneItem('sat-a', 1), roleColor: '#role', homepageIdentity: true,
      primaryIdentityBeam: true, homepageColorFor: undefined,
    }),
    '#role',
  );
});

test('RECORDED FRONTIER: the mount drops the handover shade on the homepage', () => {
  assert.equal(
    MOUNT_APPLIES_HANDOVER_SHADE, false,
    'this is the behaviour that was measured, not a target; flipping it recolours every homepage handover cone',
  );
  // Every (kind, side) reaches the same unshaded colour, which is what "the
  // handover table has no effect here" means in numbers rather than in prose.
  const unshaded = '#61e955';
  for (const kind of ['intra', 'inter'] as const) {
    for (const role of ['handoverSource', 'handoverTarget']) {
      assert.equal(
        resolveMountedConeColor({
          item: coneItem('sat-a', 1, { kind, role }),
          roleColor: '#role', homepageIdentity: true,
          primaryIdentityBeam: true, homepageColorFor,
        }),
        unshaded,
        `kind=${kind} role=${role}`,
      );
    }
  }
});

test('the primary-identity truth table, one row per surface', () => {
  const rows: readonly (readonly [
    'cone' | 'callout', string | undefined, string, boolean, boolean,
  ])[] = [
    // surface, role, renderKey, isPrimaryServing, expected
    ['cone', undefined, 'k-from', false, false],
    ['cone', undefined, 'k-to', false, false],
    ['cone', undefined, 'k', true, true],
    ['cone', 'candidatePrimary', 'k', false, true],
    ['cone', 'triggered', 'k', false, true],
    ['cone', 'handoverSource', 'k', false, true],
    ['cone', 'handoverTarget', 'k', false, true],
    ['cone', 'servingFan', 'k', false, false],
    ['callout', undefined, 'k-from', false, false],
    ['callout', undefined, 'k-to', false, true],
    ['callout', undefined, 'k', true, true],
    ['callout', 'candidatePrimary', 'k', false, true],
    ['callout', 'triggered', 'k', false, true],
    ['callout', 'handoverSource', 'k', false, false],
    ['callout', 'handoverTarget', 'k', false, true],
    ['callout', 'servingFan', 'k-to', false, true],
    ['callout', 'servingFan', 'k', false, false],
  ];
  for (const [surface, role, renderKey, isPrimaryServing, expected] of rows) {
    assert.equal(
      resolvePrimaryIdentityBeam({ surface, role, renderKey, isPrimaryServing }),
      expected,
      `${surface} role=${role} renderKey=${renderKey} primaryServing=${isPrimaryServing}`,
    );
  }
});

test('the cone surface ignores the render key; the callout reads it', () => {
  assert.equal(PRIMARY_IDENTITY_BEAM_RULES.cone.readsRenderKey, false);
  assert.equal(PRIMARY_IDENTITY_BEAM_RULES.callout.readsRenderKey, true);
  // The measured consequence: a `-to` suffix promotes a callout and not a cone.
  assert.equal(
    resolvePrimaryIdentityBeam({ surface: 'cone', role: undefined, renderKey: 'x-to', isPrimaryServing: false }),
    false,
  );
  assert.equal(
    resolvePrimaryIdentityBeam({ surface: 'callout', role: undefined, renderKey: 'x-to', isPrimaryServing: false }),
    true,
  );
});

test('the two surfaces differ in exactly one appearance field', () => {
  assert.deepEqual(PRIMARY_IDENTITY_BEAM_RULES.cone.handoverSides, ['source', 'target']);
  assert.deepEqual(PRIMARY_IDENTITY_BEAM_RULES.callout.handoverSides, ['target']);
  assert.equal(
    PRIMARY_IDENTITY_BEAM_RULES.cone.primaryServing,
    PRIMARY_IDENTITY_BEAM_RULES.callout.primaryServing,
  );
  assert.equal(
    PRIMARY_IDENTITY_BEAM_RULES.cone.candidatePrimary,
    PRIMARY_IDENTITY_BEAM_RULES.callout.candidatePrimary,
  );
  assert.equal(
    PRIMARY_IDENTITY_BEAM_RULES.cone.triggered,
    PRIMARY_IDENTITY_BEAM_RULES.callout.triggered,
  );
});

/**
 * WIRING, not just the owner.
 *
 * Both mounts are React components inside the r3f canvas and are not
 * unit-testable, so the wiring is pinned by source. A seam nobody calls is the
 * same as no seam; that is exactly how the mount kept its private colour
 * authority while every board stayed green.
 */
test('both mounts ask the table instead of computing a colour', () => {
  for (const file of ['SinrLiveCellBeamCones.tsx', 'SinrLiveCellBeamCallouts.tsx']) {
    const source = readFileSync(new URL(`../viz/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(
      source, /homepageSatelliteBeamColor\s*\(/,
      `${file} must not compose the homepage projection itself`,
    );
    assert.match(
      source, /resolveMountedConeColor\(\{/,
      `${file} must take its colour from the mounted-cone table`,
    );
    assert.match(
      source, /resolvePrimaryIdentityBeam\(\{/,
      `${file} must take its primary-identity answer from the mounted-cone table`,
    );
  }
});
