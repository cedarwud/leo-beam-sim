/**
 * CHARACTERIZATION TEST — the satellite identity hue decision before convergence.
 *
 * These literals were read from the running serving-colour and homepage
 * projection implementations before the owner was moved. The grid covers
 * Walker/non-Walker ids, the compact homepage family collisions, beam-slot
 * fallback, and finite-EE serving/context projections. It deliberately does
 * not compute any expected value by calling the implementation differently.
 *
 * Pure: no React, no canvas, no clock.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  colorForServingSatellite,
  servingIdentityPaletteHueAt,
  servingIdentityPaletteIndex,
} from '../constants/servingColour';
import {
  homepageSatelliteBaseColor,
  homepageSatelliteColorForBeam,
  homepageSatellitePaletteIndex,
} from '../homepage/controller/homepageSatelliteVisualIdentity';

const IDENTITY_GRID = [
  ['shell-a-P0-S0', 12, 202, '#96ceee', 1, '#476de1'],
  ['shell-a-P0-S1', 0, 48, '#e2c550', 2, '#54e147'],
  ['shell-a-P1-S0', 10, 242, '#aaa7f1', 5, '#e18747'],
  ['shell-b-P0-S0', 3, 264, '#bf9fef', 5, '#e18747'],
  ['sat-42', 1, 216, '#96b9ee', 5, '#e18747'],
  ['sat-7', 0, 48, '#e2c550', 2, '#54e147'],
] as const;

test('satellite identity hue allocation stays pinned across the identity grid', () => {
  for (const [satelliteId, servingSlot, servingHue, servingColor, homepageSlot, homepageBase] of IDENTITY_GRID) {
    assert.equal(servingIdentityPaletteIndex(satelliteId), servingSlot, `${satelliteId} serving slot`);
    assert.equal(servingIdentityPaletteHueAt(servingSlot), servingHue, `${satelliteId} serving hue`);
    assert.equal(colorForServingSatellite(satelliteId).markerColor, servingColor, `${satelliteId} serving colour`);
    assert.equal(homepageSatellitePaletteIndex(satelliteId), homepageSlot, `${satelliteId} homepage slot`);
    assert.equal(homepageSatelliteBaseColor(satelliteId), homepageBase, `${satelliteId} homepage base colour`);
  }
});

test('homepage hue projection stays pinned across beam, role, and EE inputs', () => {
  const cases = [
    {
      satelliteId: 'shell-a-P0-S0',
      beamId: 0,
      options: undefined,
      expected: {
        paletteIndex: 1,
        hueDegrees: 225,
        shadeIndex: 0,
        saturation: 0.4,
        lightness: 0.74,
        color: '#a2afd7',
        emissiveColor: '#7e91c8',
      },
    },
    {
      satelliteId: 'shell-a-P0-S1',
      beamId: 2,
      options: { isServing: true, eeNormalized: 0.75 },
      expected: {
        paletteIndex: 2,
        hueDegrees: 115,
        shadeIndex: 3,
        saturation: 0.835,
        lightness: 0.54,
        color: '#38ec28',
        emissiveColor: '#21c512',
      },
    },
    {
      satelliteId: 'shell-a-P1-S0',
      beamId: 2,
      options: { isServing: false, eeNormalized: 0.75 },
      expected: {
        paletteIndex: 5,
        hueDegrees: 25,
        shadeIndex: 3,
        saturation: 0.52,
        lightness: 0.575,
        color: '#cb895a',
        emissiveColor: '#c98554',
      },
    },
  ] as const;

  for (const { satelliteId, beamId, options, expected } of cases) {
    const actual = homepageSatelliteColorForBeam(satelliteId, beamId, options);
    assert.equal(actual.paletteIndex, expected.paletteIndex, `${satelliteId} homepage palette index`);
    assert.equal(actual.hueDegrees, expected.hueDegrees, `${satelliteId} homepage hue`);
    assert.equal(actual.shadeIndex, expected.shadeIndex, `${satelliteId} beam shade index`);
    assert.equal(actual.saturation, expected.saturation, `${satelliteId} saturation`);
    assert.equal(actual.lightness, expected.lightness, `${satelliteId} lightness`);
    assert.equal(actual.color, expected.color, `${satelliteId} homepage colour`);
    assert.equal(actual.emissiveColor, expected.emissiveColor, `${satelliteId} homepage emissive colour`);
  }
});
