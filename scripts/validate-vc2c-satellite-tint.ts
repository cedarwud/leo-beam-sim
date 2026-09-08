import assert from 'node:assert/strict';
import {
  BEAM_ROLE_TOKENS,
  SATELLITE_TINT_PALETTE,
} from '../src/constants/beamRoleTokens.ts';
import { resolveSatelliteTintedColor } from '../src/viz/SatelliteMarker.tsx';
import { assertCanvasNonBlank, sampleCanvas, withVc2Browser } from './_vc2-browser-fixture.ts';
import { MEASURED_BROWSER_GATE_FLOORS_MS, runBrowserValidator } from './lib/browser-gate.ts';

function hexToRgb255(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function colorDistance(a: string, b: string): number {
  const left = hexToRgb255(a);
  const right = hexToRgb255(b);
  return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
}

function assertMaterialTintHelper(): void {
  const baseColor = '#aaccff';
  const tintedColors = SATELLITE_TINT_PALETTE.map(tint => resolveSatelliteTintedColor(baseColor, tint));

  for (let index = 0; index < tintedColors.length; index += 1) {
    assert.notEqual(tintedColors[index], baseColor, `${SATELLITE_TINT_PALETTE[index]} did not affect the marker body color`);
  }

  for (let index = 0; index < tintedColors.length - 1; index += 1) {
    assert.ok(
      colorDistance(tintedColors[index], tintedColors[index + 1]) >= 12,
      `consecutive marker body tints ${index} and ${index + 1} are not perceptually separated`,
    );
  }

  assert.equal(
    BEAM_ROLE_TOKENS.serving.color,
    '#facc15',
    'serving marker text color should remain role-owned and unchanged',
  );
}

async function assertBrowserFixture() {
  return withVc2Browser(async (page, appUrl) => {
    const modelResponse = await fetch(new URL('/models/satellite-starlink.glb', appUrl));
    assert.ok(modelResponse.ok, 'satellite GLB model was not reachable through the Vite dev server');

    const result = await page.evaluate(async () => window.__renderVc2NonTextChannelsFixture());
    const sample = await sampleCanvas(page);
    assertCanvasNonBlank(sample, 'Phase 2C');
    assert.equal(result.canvasReady, true, 'Phase 2C browser fixture did not render a canvas');

    const fixtureTints = result.beams.map(beam => beam.satelliteTintColor.toLowerCase());
    const paletteLower = SATELLITE_TINT_PALETTE.map(color => color.toLowerCase());
    // S2: tint is satId-stable (was displayOrder%len → trivially 4-distinct).
    // Assert multiple distinct PALETTE tints render, not a hash-luck count of 4.
    assert.ok(new Set(fixtureTints).size >= 2, `Phase 2C fixture marker tints are mono (${new Set(fixtureTints).size} distinct)`);
    assert.ok(fixtureTints.every(tint => paletteLower.includes(tint)), 'Phase 2C fixture exposed a non-palette marker tint');

    return {
      sample,
      modelFetch: 'passed',
      markerTintInputs: result.beams.map(beam => ({
        satId: beam.satId,
        tint: beam.satelliteTintColor,
      })),
    };
  });
}

async function main(): Promise<void> {
  assertMaterialTintHelper();
  const browser = await assertBrowserFixture();

  console.log('Visual Clarity Phase 2C satellite-tint validation passed.');
  console.log(JSON.stringify({
    v1: {
      materialTintHelper: 'passed',
      markerTextRoleColorUnchanged: 'passed',
    },
    v3: browser,
    result: 'PASS',
  }, null, 2));
}

void runBrowserValidator(
  {
    validator: 'validate-vc2c-satellite-tint',
    appUrl: process.env.APP_URL ?? process.argv[2],
    floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.multiCanvas,
  },
  async () => main(),
).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
