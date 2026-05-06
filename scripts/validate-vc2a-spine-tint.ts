import assert from 'node:assert/strict';
import {
  BEAM_FREQUENCY_COLORS,
  BEAM_ROLE_TOKENS,
  SATELLITE_TINT_PALETTE,
  satelliteTint,
  satelliteTintIndex,
} from '../src/constants/beamRoleTokens.ts';
import { assertCanvasNonBlank, sampleCanvas, withVc2Browser } from './_vc2-browser-fixture.ts';

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  ];
}

function linearize(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function lab(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map(linearize);
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (value: number) => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function deltaE(a: string, b: string): number {
  const labA = lab(a);
  const labB = lab(b);
  return Math.hypot(labA[0] - labB[0], labA[1] - labB[1], labA[2] - labB[2]);
}

function assertPaletteInvariants(): void {
  for (let left = 0; left < SATELLITE_TINT_PALETTE.length; left += 1) {
    for (let right = left + 1; right < SATELLITE_TINT_PALETTE.length; right += 1) {
      assert.ok(
        deltaE(SATELLITE_TINT_PALETTE[left], SATELLITE_TINT_PALETTE[right]) >= 12,
        `satellite tint palette entries ${left} and ${right} are too close`,
      );
    }
  }

  for (const tint of SATELLITE_TINT_PALETTE) {
    assert.ok(
      Math.min(contrastRatio(tint, '#1b2735'), contrastRatio(tint, '#090a0f')) >= 3,
      `${tint} failed the non-text contrast floor against the MainScene background`,
    );

    for (const token of Object.values(BEAM_ROLE_TOKENS)) {
      assert.ok(deltaE(tint, token.color) >= 15, `${tint} is too close to role color ${token.color}`);
    }

    for (const frequencyColor of BEAM_FREQUENCY_COLORS) {
      assert.ok(deltaE(tint, frequencyColor) >= 15, `${tint} is too close to frequency color ${frequencyColor}`);
    }
  }
}

function assertAssignmentStability(): void {
  const satIds = ['shell-pro-53-P0-S0', 'shell-pro-53-P0-S1', 'shell-pro-53-P0-S2', 'shell-pro-53-P0-S3'];
  const first = satIds.map((satId, index) => ({
    index: satelliteTintIndex(satId, index),
    tint: satelliteTint(satId, index),
  }));
  const second = satIds.map((satId, index) => ({
    index: satelliteTintIndex(satId, index),
    tint: satelliteTint(satId, index),
  }));

  assert.deepEqual(second, first, 'satellite tint assignment changed for an unchanged visible-satellite set');
  assert.equal(first[0].tint.toLowerCase(), '#ffffff', 'display-order zero should reserve white for the lead satellite');
}

async function assertBrowserFixture() {
  return withVc2Browser(async page => {
    const result = await page.evaluate(async () => window.__renderVc2NonTextChannelsFixture());
    const sample = await sampleCanvas(page);
    assertCanvasNonBlank(sample, 'Phase 2A');
    assert.equal(result.canvasReady, true, 'Phase 2A browser fixture did not render a canvas');
    assert.ok(result.beams.length >= 3, 'Phase 2A fixture did not expose three visible satellites');

    for (const beam of result.beams.slice(0, 3)) {
      assert.equal(
        beam.satelliteTintColor.toLowerCase(),
        SATELLITE_TINT_PALETTE[beam.satelliteVisualIndex].toLowerCase(),
        `${beam.satId} did not carry its assigned satellite tint`,
      );
      assert.notEqual(
        beam.satelliteTintColor.toLowerCase(),
        beam.roleColor.toLowerCase(),
        `${beam.satId} leaked the role color into the satellite tint channel`,
      );
    }

    return { sample, fixtureBeams: result.beams.map(beam => ({
      satId: beam.satId,
      tint: beam.satelliteTintColor,
      glyph: beam.satelliteGlyph,
    })) };
  });
}

async function main(): Promise<void> {
  assertPaletteInvariants();
  assertAssignmentStability();
  const browser = await assertBrowserFixture();

  console.log('Visual Clarity Phase 2A spine-tint validation passed.');
  console.log(JSON.stringify({
    v1: {
      paletteContrast: 'passed',
      paletteDeltaE: 'passed',
      assignmentStability: 'passed',
    },
    v3: browser,
    result: 'PASS',
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
