/**
 * Tests for THE handover appearance table.
 *
 * Pure: no React, no canvas, no clock. Per the previous session's lesson, the
 * ability to write a test in this shape is the only reliable signal that the
 * seam was cut in the right place — so if these ever need a renderer to run,
 * the module has drifted back into the scene layer.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colorForServingBeam } from '../constants/servingColour';
import { HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR } from '../constants/handoverVisualIdentity';
import {
  HANDOVER_APPEARANCE_MODIFIERS,
  applyHandoverShade,
  handoverModifierFor,
  resolveHandoverSide,
} from './handoverAppearanceModifiers';
import { resolveBaseIdentityColor } from './resolveBeamAppearance';

test('intra shades both sides and inter shades neither', () => {
  assert.equal(HANDOVER_APPEARANCE_MODIFIERS.intra.source.shade, 'source');
  assert.equal(HANDOVER_APPEARANCE_MODIFIERS.intra.target.shade, 'target');
  assert.equal(HANDOVER_APPEARANCE_MODIFIERS.inter.source.shade, null);
  assert.equal(HANDOVER_APPEARANCE_MODIFIERS.inter.target.shade, null);
});

test('steady state contributes no modifier', () => {
  assert.equal(handoverModifierFor({ kind: null, side: 'source', phase: null }), null);
  assert.equal(handoverModifierFor({ kind: 'intra', side: null, phase: null }), null);
});

test('the side is resolved from role first, then from the render key', () => {
  assert.equal(resolveHandoverSide({ role: 'handoverSource' }), 'source');
  assert.equal(resolveHandoverSide({ role: 'handoverTarget' }), 'target');
  // role wins over a render key that says otherwise
  assert.equal(resolveHandoverSide({ role: 'handoverSource', renderKey: 'x-to' }), 'source');
  assert.equal(resolveHandoverSide({ renderKey: 'ho-3-from' }), 'source');
  assert.equal(resolveHandoverSide({ renderKey: 'ho-3-trig-to' }), 'target');
  // an item that names no side must not be guessed into one
  assert.equal(resolveHandoverSide({}), null);
  assert.equal(resolveHandoverSide({ role: 'servingFan', renderKey: 'cell-4' }), null);
});

test('an intra shade keeps the satellite hue and only moves lightness', () => {
  const identity = colorForServingBeam('shell-a-P0-S3', 2).markerColor;
  const source = applyHandoverShade(identity, HANDOVER_APPEARANCE_MODIFIERS.intra.source);
  const target = applyHandoverShade(identity, HANDOVER_APPEARANCE_MODIFIERS.intra.target);

  assert.notEqual(source, identity, 'the source side must be visibly distinct');
  assert.notEqual(target, identity, 'the target side must be visibly distinct');
  assert.notEqual(source, target, 'the two sides must be distinguishable from each other');

  const luminance = (hex: string): number => {
    const [r, g, b] = hex.slice(1).match(/../g)!.map(c => Number.parseInt(c, 16));
    return (0.2126 * r! + 0.7152 * g! + 0.0722 * b!) / 255;
  };
  assert.ok(
    luminance(source) < luminance(target),
    `intra source must be darker than intra target (source=${source} target=${target})`,
  );
});

test('inter leaves the identity colour exactly alone', () => {
  const identity = colorForServingBeam('shell-a-P1-S1', 4).markerColor;
  assert.equal(applyHandoverShade(identity, HANDOVER_APPEARANCE_MODIFIERS.inter.source), identity);
  assert.equal(applyHandoverShade(identity, HANDOVER_APPEARANCE_MODIFIERS.inter.target), identity);
});

/**
 * The invariant this module claims in its header: a modifier may shade an
 * identity colour, never replace it.
 *
 * `emphasizeIntraHandoverColor` raises saturation to at least 0.78, which on a
 * colour with no hue MANUFACTURES one. Without the guard in `applyHandoverShade`
 * the grey `#808080` comes back as `#c81919` — red — and the neutral identity
 * fallback comes back a vivid blue. A beam turning red is a strong claim in this
 * scene, and it would be fiction.
 */
test('a colour with no hue is passed through rather than given one', () => {
  for (const achromatic of ['#808080', '#ffffff', '#000000', '#3a3a3a']) {
    assert.equal(
      applyHandoverShade(achromatic, HANDOVER_APPEARANCE_MODIFIERS.intra.source),
      achromatic,
      `${achromatic} must not acquire a hue from a handover shade`,
    );
  }
  assert.equal(
    applyHandoverShade(
      HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR,
      HANDOVER_APPEARANCE_MODIFIERS.intra.target,
    ),
    HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR,
    'the neutral identity fallback must survive a handover shade unchanged',
  );
});

test('an unreadable colour is returned untouched instead of guessed at', () => {
  assert.equal(applyHandoverShade('', HANDOVER_APPEARANCE_MODIFIERS.intra.source), '');
  assert.equal(applyHandoverShade('rebeccapurple', HANDOVER_APPEARANCE_MODIFIERS.intra.source), 'rebeccapurple');
});

test('the beam identity ladder preserves today values across its source grid', () => {
  const sources = {
    planColorFor: () => '#plan',
    homepageColorFor: (_satId: string, _beamId: number, isServingOrCandidate: boolean) =>
      isServingOrCandidate ? '#homepage-serving' : '#homepage-ambient',
    acceptedColorFor: () => '#accepted',
  };

  assert.equal(
    resolveBaseIdentityColor('shell-a-P0-S3', 2, sources),
    '#plan',
    'comparison plan outranks homepage and accepted colours',
  );
  assert.equal(
    resolveBaseIdentityColor('shell-a-P0-S3', 2, {
      homepageColorFor: sources.homepageColorFor,
      acceptedColorFor: sources.acceptedColorFor,
    }, { isServingOrCandidate: false }),
    '#homepage-ambient',
  );
  assert.equal(
    resolveBaseIdentityColor('shell-a-P0-S3', 2, {
      homepageColorFor: sources.homepageColorFor,
      acceptedColorFor: sources.acceptedColorFor,
    }, { isServingOrCandidate: true }),
    '#homepage-serving',
  );
  assert.equal(
    resolveBaseIdentityColor('sat-serving', 1, {
      acceptedColorFor: sources.acceptedColorFor,
    }),
    '#accepted',
    'accepted snapshot is used when homepage has no source',
  );
  assert.equal(
    resolveBaseIdentityColor('sat-serving', 1, {}),
    '#bee561',
    'deterministic identity is the final valid-id rung',
  );
  assert.equal(resolveBaseIdentityColor('', 1, {}), '#94a3b8');
  assert.equal(resolveBaseIdentityColor('sat-serving', Number.NaN, {}), '#94a3b8');
});
