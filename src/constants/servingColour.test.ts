import assert from 'node:assert/strict';
import test from 'node:test';

import {
  colorForServingBeam,
  colorForServingSatellite,
  emphasizeIntraHandoverColor,
  servingIdentityPaletteHueAt,
  servingIdentityPaletteIndex,
} from './servingColour';

function circularHueDistance(left: number, right: number): number {
  const distance = Math.abs(left - right) % 360;
  return Math.min(distance, 360 - distance);
}

function hueFromHex(color: string): number {
  const channels = color.slice(1).match(/../g)!.map(value => Number.parseInt(value, 16) / 255);
  const [red, green, blue] = channels;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  if (delta === 0) return 0;
  const raw = maximum === red
    ? 60 * (((green - blue) / delta) % 6)
    : maximum === green
      ? 60 * (((blue - red) / delta) + 2)
      : 60 * (((red - green) / delta) + 4);
  return (raw + 360) % 360;
}

test('Walker satellite identities use a stable, interleaved, non-red palette', () => {
  const satelliteIds = Array.from({ length: 16 }, (_, slot) => `starlink-P0-S${slot}`);
  const paletteSlots = satelliteIds.map(servingIdentityPaletteIndex);
  const hues = paletteSlots.map(servingIdentityPaletteHueAt);
  const colors = satelliteIds.map(id => colorForServingSatellite(id).markerColor);

  assert.equal(new Set(paletteSlots).size, 16, 'one Walker plane must exercise every palette slot');
  assert.equal(new Set(colors).size, 16, 'one Walker plane must receive distinct identity colours');
  assert.ok(
    Math.min(...hues.map((hue, index) => circularHueDistance(hue, hues[(index + 1) % hues.length]!))) >= 70,
    `adjacent identity hues are too close: ${hues.join(',')}`,
  );
  assert.ok(
    hues.every(hue => hue >= 25 && hue <= 330),
    `identity palette must exclude red/carmine hues: ${hues.join(',')}`,
  );
});

test('same-satellite beam shades stay readable and keep one hue family', () => {
  const satelliteId = 'starlink-P0-S1';
  const hues = [0, 1, 2, 3, 4, 5, 6].map(beamId => colorForServingBeam(satelliteId, beamId).markerColor);
  const distinct = new Set(hues);

  assert.equal(distinct.size, hues.length, 'the first five beam identities need visible shade steps');
  const satelliteHue = servingIdentityPaletteHueAt(servingIdentityPaletteIndex(satelliteId));
  assert.ok(
    hues.every(color => circularHueDistance(hueFromHex(color), satelliteHue) <= 3),
    `same-satellite shades must stay on one hue anchor (${satelliteHue}°): ${hues.join(',')}`,
  );
  // The lifted blue family must not fall back to a navy/black-looking shade.
  for (const color of hues) {
    const channels = color.slice(1).match(/../g)!.map(value => Number.parseInt(value, 16));
    assert.ok(Math.max(...channels) >= 190, `${color} is too dark for the live globe`);
  }
  const channelBrightness = hues.map(color => {
    const channels = color.slice(1).match(/../g)!.map(value => Number.parseInt(value, 16));
    return channels.reduce((sum, channel) => sum + channel, 0);
  });
  assert.ok(
    Math.min(
      ...channelBrightness.slice(1).map((brightness, index) => brightness - channelBrightness[index]!),
    ) >= 20,
    `adjacent beam shades need a visible brightness step: ${channelBrightness.join(',')}`,
  );
});

test('seven configured beams do not collapse an intra switch into one colour', () => {
  const satelliteId = 'shell-pro-53-P8-S5';
  const from = colorForServingBeam(satelliteId, 2).markerColor;
  const to = colorForServingBeam(satelliteId, 7).markerColor;
  assert.notEqual(from, to, 'beam 2 → beam 7 must remain visibly distinct');
  const brightness = (color: string) => color.slice(1).match(/../g)!
    .map(value => Number.parseInt(value, 16))
    .reduce((sum, channel) => sum + channel, 0);
  assert.ok(
    Math.abs(brightness(from) - brightness(to)) >= 60,
    `beam 2 → beam 7 needs a clear tonal change: ${from} → ${to}`,
  );
});

test('blue and purple beam shades stay above the dark-scene floor', () => {
  for (const satelliteId of ['shell-pro-42-P20-S3', 'shell-pro-53-P13-S6']) {
    const colors = [0, 1, 2, 3, 4].map(beamId => colorForServingBeam(satelliteId, beamId).markerColor);
    assert.equal(new Set(colors).size, colors.length, `${satelliteId} shades must remain distinct`);
    for (const color of colors) {
      const channels = color.slice(1).match(/../g)!.map(value => Number.parseInt(value, 16));
      assert.ok(Math.max(...channels) >= 190, `${satelliteId} ${color} is too dark for the live globe`);
    }
  }
});

test('representative handover pairs change identity family instead of role colour', () => {
  const pairs = [
    ['shell-pro-53-P13-S7', 'shell-candidate-70-P25-S1'],
    ['shell-pro-42-P20-S3', 'shell-pro-42-P16-S5'],
    ['shell-pro-53-P23-S2', 'shell-pro-53-P13-S6'],
  ] as const;
  for (const [from, to] of pairs) {
    const fromHue = servingIdentityPaletteHueAt(servingIdentityPaletteIndex(from));
    const toHue = servingIdentityPaletteHueAt(servingIdentityPaletteIndex(to));
    assert.ok(
      circularHueDistance(fromHue, toHue) >= 70,
      `${from} → ${to} should have a visible hue change (${fromHue} → ${toHue})`,
    );
    assert.notEqual(
      colorForServingSatellite(from).markerColor,
      colorForServingSatellite(to).markerColor,
      `${from} → ${to} must not collapse to one satellite colour`,
    );
  }
});

test('intra transition treatment preserves hue while making source and target distinct', () => {
  const base = colorForServingBeam('starlink-P0-S1', 3).markerColor;
  const source = emphasizeIntraHandoverColor(base, 'source');
  const target = emphasizeIntraHandoverColor(base, 'target');
  assert.notEqual(source, target, 'intra source and target must not collapse to one colour');
  assert.ok(circularHueDistance(hueFromHex(source), hueFromHex(base)) <= 3);
  assert.ok(circularHueDistance(hueFromHex(target), hueFromHex(base)) <= 3);
  const brightness = (color: string) => color.slice(1).match(/../g)!
    .map(value => Number.parseInt(value, 16))
    .reduce((sum, channel) => sum + channel, 0);
  assert.ok(
    brightness(target) - brightness(source) >= 80,
    `intra source/target separation is too small: ${source} -> ${target}`,
  );
});

test('intra transition treatment does not turn a blue identity into a near-black shade', () => {
  const base = colorForServingBeam('shell-pro-42-P20-S3', 0).markerColor;
  const source = emphasizeIntraHandoverColor(base, 'source');
  const target = emphasizeIntraHandoverColor(base, 'target');
  for (const color of [source, target]) {
    const channels = color.slice(1).match(/../g)!.map(value => Number.parseInt(value, 16));
    assert.ok(Math.max(...channels) >= 160, `${color} is too dark for the transition carrier`);
  }
});
