/**
 * Tests for the single precedence ladder for satellite identity colours.
 *
 * Pure: no React, no DOM, no clock.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colorForServingSatellite } from '../constants/servingColour';
import { HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR } from '../constants/handoverVisualIdentity';
import {
  resolveSatelliteIdentityColor,
  type SatelliteIdentitySources,
} from './resolveSatelliteAppearance';

test('each rung wins in order: homepage over accepted over deterministic', () => {
  const satId = 'sat-alpha';
  const homepageColor = '#112233';
  const acceptedColor = '#445566';
  const deterministicColor = colorForServingSatellite(satId).markerColor;

  // 1. All available -> homepage wins
  const allSources: SatelliteIdentitySources = {
    homepageColorFor: id => (id === satId ? homepageColor : undefined),
    acceptedColorFor: id => (id === satId ? acceptedColor : undefined),
  };
  assert.equal(
    resolveSatelliteIdentityColor(satId, allSources),
    homepageColor,
    'homepage projection must win when present',
  );

  // 2. Homepage absent -> accepted wins
  const acceptedSources: SatelliteIdentitySources = {
    homepageColorFor: undefined,
    acceptedColorFor: id => (id === satId ? acceptedColor : undefined),
  };
  assert.equal(
    resolveSatelliteIdentityColor(satId, acceptedSources),
    acceptedColor,
    'accepted snapshot must win over deterministic identity',
  );

  // 3. Homepage and accepted absent -> deterministic identity wins
  const emptySources: SatelliteIdentitySources = {};
  assert.equal(
    resolveSatelliteIdentityColor(satId, emptySources),
    deterministicColor,
    'deterministic identity must win when no published sources are available',
  );
});

test('a rung that returns undefined or empty string falls through to the next', () => {
  const satId = 'sat-beta';
  const acceptedColor = '#778899';
  const deterministicColor = colorForServingSatellite(satId).markerColor;

  // Homepage returns undefined -> falls to accepted
  assert.equal(
    resolveSatelliteIdentityColor(satId, {
      homepageColorFor: () => undefined,
      acceptedColorFor: () => acceptedColor,
    }),
    acceptedColor,
    'undefined homepage falls through to accepted',
  );

  // Homepage returns empty string -> falls to accepted
  assert.equal(
    resolveSatelliteIdentityColor(satId, {
      homepageColorFor: () => '',
      acceptedColorFor: () => acceptedColor,
    }),
    acceptedColor,
    'empty homepage string falls through to accepted',
  );

  // Homepage returns undefined, accepted returns undefined -> falls to deterministic
  assert.equal(
    resolveSatelliteIdentityColor(satId, {
      homepageColorFor: () => undefined,
      acceptedColorFor: () => undefined,
    }),
    deterministicColor,
    'undefined accepted falls through to deterministic',
  );

  // Homepage returns empty string, accepted returns empty string -> falls to deterministic
  assert.equal(
    resolveSatelliteIdentityColor(satId, {
      homepageColorFor: () => '',
      acceptedColorFor: () => '',
    }),
    deterministicColor,
    'empty accepted string falls through to deterministic',
  );
});

test('an empty satId returns the neutral colour', () => {
  // Empty satId with no sources
  assert.equal(
    resolveSatelliteIdentityColor('', {}),
    HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR,
    'empty satId must return neutral fallback colour',
  );

  // Even if sources return values, empty satId must not invent an identity
  assert.equal(
    resolveSatelliteIdentityColor('', {
      homepageColorFor: () => '#ff0000',
      acceptedColorFor: () => '#00ff00',
    }),
    HANDOVER_VISUAL_IDENTITY_NEUTRAL_FALLBACK_COLOR,
    'empty satId must short-circuit to neutral regardless of source contents',
  );
});

test('the deterministic rung equals colorForServingSatellite(satId).markerColor', () => {
  for (const satId of ['sat-1', 'sat-99', 'shell-a-P0-S1', 'Walker-Delta']) {
    const expected = colorForServingSatellite(satId).markerColor;
    assert.equal(
      resolveSatelliteIdentityColor(satId, {}),
      expected,
      `deterministic rung for ${satId} must match colorForServingSatellite(satId).markerColor`,
    );
  }
});

test('the regression this exists to prevent: accepted rung can never be skipped by a caller', () => {
  const satId = 'sat-gamma';
  const publishedAcceptedColor = '#33aaff';

  // Caller A: on homepage where homepage has no entry for this satellite (e.g. ambient or outside palette)
  const callerWithHomepageSources: SatelliteIdentitySources = {
    homepageColorFor: _id => undefined,
    acceptedColorFor: id => (id === satId ? publishedAcceptedColor : undefined),
  };

  // Caller B: a different call site or surface that supplies no homepage sources
  const callerWithoutHomepageSources: SatelliteIdentitySources = {
    acceptedColorFor: id => (id === satId ? publishedAcceptedColor : undefined),
  };

  const colorA = resolveSatelliteIdentityColor(satId, callerWithHomepageSources);
  const colorB = resolveSatelliteIdentityColor(satId, callerWithoutHomepageSources);

  // Both must resolve to the SAME accepted colour, neither skipping it to deterministic identity
  assert.equal(
    colorA,
    publishedAcceptedColor,
    'caller with homepage source miss must resolve to accepted snapshot',
  );
  assert.equal(
    colorB,
    publishedAcceptedColor,
    'caller without homepage source must resolve to accepted snapshot',
  );
  assert.equal(
    colorA,
    colorB,
    'both call sites must agree on the identical accepted colour',
  );

  // Crucially, neither returns the deterministic colour when accepted is present
  const deterministic = colorForServingSatellite(satId).markerColor;
  assert.notEqual(
    colorA,
    deterministic,
    'accepted snapshot must not be bypassed in favor of deterministic fallback',
  );
});
