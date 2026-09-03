import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HOMEPAGE_SATELLITE_BEAM_LIGHTNESS_LEVELS,
  HOMEPAGE_SATELLITE_COLOR_COUNT,
  HOMEPAGE_SATELLITE_HUE_FAMILIES,
  homepageSatelliteBaseColor,
  homepageSatelliteColorForBeam,
  homepageSatellitePaletteIndex,
} from './homepageSatelliteVisualIdentity';

function rgbToHsl(color: string): { hue: number; saturation: number; lightness: number; channels: number[] } {
  const channels = color.slice(1).match(/../g)!.map(channel => Number.parseInt(channel, 16) / 255);
  const [red, green, blue] = channels;
  const maximum = Math.max(red!, green!, blue!);
  const minimum = Math.min(red!, green!, blue!);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  if (delta === 0) return { hue: 0, saturation: 0, lightness, channels };
  const rawHue = maximum === red
    ? ((green! - blue!) / delta) % 6
    : maximum === green
      ? ((blue! - red!) / delta) + 2
      : ((red! - green!) / delta) + 4;
  return {
    hue: ((rawHue * 60) % 360 + 360) % 360,
    saturation: delta / (1 - Math.abs((2 * lightness) - 1)),
    lightness,
    channels,
  };
}

function circularHueDistance(left: number, right: number): number {
  const distance = Math.abs(left - right) % 360;
  return Math.min(distance, 360 - distance);
}

function minimumFamilyHueDistance(hues: readonly number[]): number {
  let minimum = 360;
  for (let left = 0; left < hues.length; left += 1) {
    for (let right = left + 1; right < hues.length; right += 1) {
      minimum = Math.min(minimum, circularHueDistance(hues[left]!, hues[right]!));
    }
  }
  return minimum;
}

test('homepage exposes exactly six compact hue families', () => {
  assert.equal(HOMEPAGE_SATELLITE_COLOR_COUNT, 6);
  assert.equal(HOMEPAGE_SATELLITE_HUE_FAMILIES.length, HOMEPAGE_SATELLITE_COLOR_COUNT);
  assert.equal(
    new Set(HOMEPAGE_SATELLITE_HUE_FAMILIES.map(family => family.hueDegrees)).size,
    HOMEPAGE_SATELLITE_COLOR_COUNT,
  );
  assert.ok(HOMEPAGE_SATELLITE_HUE_FAMILIES.every(family => family.hueDegrees >= 25 && family.hueDegrees <= 300));
  assert.equal(HOMEPAGE_SATELLITE_HUE_FAMILIES.some(family => (family.name as string) === 'violet'), false);
  assert.equal(HOMEPAGE_SATELLITE_HUE_FAMILIES.some(family => family.hueDegrees >= 240 && family.hueDegrees <= 320), false);
  assert.ok(
    HOMEPAGE_SATELLITE_HUE_FAMILIES.every(family => family.hueDegrees >= 25 && family.hueDegrees <= 235),
    'homepage families must stay outside red and violet ranges',
  );
  assert.ok(
    minimumFamilyHueDistance(HOMEPAGE_SATELLITE_HUE_FAMILIES.map(family => family.hueDegrees)) >= 30,
    'inter-handover families need a visible hue gap after compositing',
  );
  assert.equal(typeof homepageSatelliteBaseColor('sat-a'), 'string');
});

test('one satellite keeps one hue across every beam, role, and EE bucket', () => {
  const satelliteId = 'shell-pro-42-P21-S1';
  const colors = [
    ...HOMEPAGE_SATELLITE_BEAM_LIGHTNESS_LEVELS.map((_, beamId) => (
      homepageSatelliteColorForBeam(satelliteId, beamId)
    )),
    homepageSatelliteColorForBeam(satelliteId, 0, { isServing: true, eeNormalized: 0.05 }),
    homepageSatelliteColorForBeam(satelliteId, 1, { isServing: false, eeNormalized: 0.95 }),
  ];
  assert.equal(new Set(colors.map(color => color.hueDegrees)).size, 1);
  const expectedHue = rgbToHsl(colors[0]!.color).hue;
  assert.ok(colors.every(color => {
    // Very pale sRGB colours quantise their HSL hue more aggressively than
    // vivid colours. The semantic hueDegrees token is the identity authority;
    // allow the rasterised readback a small pale-colour tolerance.
    return circularHueDistance(rgbToHsl(color.color).hue, expectedHue) <= 10
      && circularHueDistance(rgbToHsl(color.emissiveColor).hue, expectedHue) <= 10;
  }));
});

test('serving beams are substantially more vivid than contextual beams', () => {
  const serving = homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 2, {
    isServing: true,
    eeNormalized: 0.75,
  });
  const context = homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 2, {
    isServing: false,
    eeNormalized: 0.75,
  });
  const servingHsl = rgbToHsl(serving.color);
  const contextHsl = rgbToHsl(context.color);

  assert.ok(serving.saturation - context.saturation >= 0.30);
  assert.ok(servingHsl.saturation - contextHsl.saturation >= 0.30);
  assert.ok(serving.lightness < context.lightness);
  assert.ok(context.saturation >= 0.40, 'context tokens must retain the satellite hue');
  assert.ok(contextHsl.saturation >= 0.30, 'rasterised context colours must remain chromatic');
  assert.ok(context.lightness <= 0.76, 'context tokens must not wash toward white');
  assert.ok(context.lightness <= 0.70, 'context tokens must remain chromatic at the lightest shade');
  assert.notEqual(serving.color, context.color);
});

test('finite EE selects the intensity/lightness bucket instead of beam slot', () => {
  const low = homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 3, {
    isServing: true,
    eeNormalized: 0.05,
  });
  const high = homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 0, {
    isServing: true,
    eeNormalized: 0.95,
  });
  const sameEeDifferentBeam = homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 1, {
    isServing: true,
    eeNormalized: 0.95,
  });

  assert.notEqual(low.shadeIndex, high.shadeIndex);
  assert.ok(high.lightness < low.lightness, 'higher EE must be darker/deeper');
  assert.ok(high.saturation > low.saturation);
  assert.equal(high.color, sameEeDifferentBeam.color);
  assert.equal(high.shadeIndex, sameEeDifferentBeam.shadeIndex);
});

test('colors stay within bounded RGB/HSL values and never clip to white', () => {
  const colors = [
    homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 0),
    homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 3),
    homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 0, { isServing: true, eeNormalized: 1 }),
    homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 0, { isServing: false, eeNormalized: 1 }),
  ];

  for (const visualColor of colors) {
    const hsl = rgbToHsl(visualColor.color);
    assert.ok(hsl.channels.every(channel => channel >= 0 && channel <= 1));
    assert.ok(visualColor.saturation >= 0 && visualColor.saturation <= 1);
    assert.ok(visualColor.lightness >= 0 && visualColor.lightness <= 1);
    assert.ok(hsl.saturation >= 0 && hsl.saturation <= 1);
    assert.ok(hsl.lightness >= 0 && hsl.lightness <= 1);
    assert.notEqual(visualColor.color, '#ffffff');
    assert.notEqual(visualColor.emissiveColor, '#ffffff');
  }
});

test('beam overlap does not participate in the identity token', () => {
  const one = homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 2);
  const repeated = homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 2);
  assert.deepEqual(repeated, one);
  assert.equal(one.baseColor, homepageSatelliteBaseColor('shell-pro-42-P21-S1'));
  assert.ok(one.paletteIndex >= 0 && one.paletteIndex < HOMEPAGE_SATELLITE_COLOR_COUNT);
});

test('omitted EE keeps deterministic beam-slot fallback', () => {
  const slotTwo = homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 2);
  const repeatedSlot = homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 2 + HOMEPAGE_SATELLITE_BEAM_LIGHTNESS_LEVELS.length);
  const nullEe = homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 2, { eeNormalized: null });
  const invalidEe = homepageSatelliteColorForBeam('shell-pro-42-P21-S1', 2, { eeNormalized: Number.NaN });

  assert.equal(slotTwo.shadeIndex, 2);
  assert.deepEqual(repeatedSlot, slotTwo);
  assert.deepEqual(nullEe, slotTwo);
  assert.deepEqual(invalidEe, slotTwo);
});

test('palette index is deterministic and does not depend on display order', () => {
  const ids = ['shell-pro-42-P21-S1', 'shell-pro-42-P21-S2', 'shell-pro-42-P22-S0'];
  assert.deepEqual(
    ids.map(homepageSatellitePaletteIndex),
    [...ids].reverse().reverse().map(homepageSatellitePaletteIndex),
  );
});

test('inter-satellite source and target endpoints keep a strong hue contrast', () => {
  const pairs = [
    ['shell-pro-53-P13-S7', 'shell-candidate-70-P25-S1'],
    ['shell-pro-42-P20-S3', 'shell-pro-42-P16-S5'],
    ['shell-pro-53-P23-S2', 'shell-pro-53-P13-S6'],
  ] as const;

  for (const [sourceId, targetId] of pairs) {
    const source = homepageSatelliteColorForBeam(sourceId, 0);
    const target = homepageSatelliteColorForBeam(targetId, 0);
    const hueDistance = circularHueDistance(source.hueDegrees, target.hueDegrees);
    assert.ok(
      hueDistance >= 70,
      `${sourceId} -> ${targetId} should remain visibly separated (${source.hueDegrees}° -> ${target.hueDegrees}°)`,
    );
    assert.notEqual(source.paletteIndex, target.paletteIndex);
  }
});

test('adjacent Walker identity slots remain hue-separated after compression', () => {
  const colours = Array.from(
    { length: 16 },
    (_, slot) => homepageSatelliteColorForBeam(`starlink-P0-S${slot}`, 0),
  );
  const adjacentHueDistances = colours.map((colour, index) => (
    circularHueDistance(colour.hueDegrees, colours[(index + 1) % colours.length]!.hueDegrees)
  ));

  assert.ok(
    Math.min(...adjacentHueDistances) >= 70,
    `adjacent homepage identity families are too close: ${adjacentHueDistances.join(', ')}`,
  );
});
