import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import * as THREE from 'three';
import { satelliteGlyph } from '../src/viz/glyphs.ts';
import { satelliteTint, satelliteTintIndex } from '../src/constants/beamRoleTokens.ts';
import type { VisibleSat } from '../src/scene/types.ts';
import {
  ORBIT_TRAIL_HEAD_OPACITY,
  ORBIT_TRAIL_OPACITY_FLOOR,
  ORBIT_TRAIL_SAMPLE_COUNT,
  ORBIT_TRAIL_SAMPLE_INTERVAL_SEC,
  ORBIT_TRAIL_TAIL_OPACITY,
  advanceOrbitTrailSamples,
  createOrbitTrailGeometry,
  createOrbitTrailOpacitySamples,
  createOrbitTrailSamples,
  resolveOrbitTrailOpacity,
  resolveOrbitTrailPlans,
  writeOrbitTrailGeometryPositions,
} from '../src/viz/OrbitTrail.tsx';
import { detectAppUrl } from './_vc2-browser-fixture.ts';
import { freezeRaf } from './_v3-deterministic-fixture.ts';

interface PixelRgb {
  r: number;
  g: number;
  b: number;
}

interface Vc3cBrowserFixtureResult {
  canvasReady: boolean;
  visibleSatelliteCount: number;
  trailCount: number;
  geometryIds: string[];
  attributeCounts: Array<{
    id: string;
    position: number;
    trailOpacity: number;
  }>;
  gate: {
    enabled: boolean;
    reducedMotion: boolean;
  };
  samplePlan: {
    backgroundColor: string;
    viewport: { width: number; height: number };
    expectedTrailColors: string[];
    firstTrailSamples: Array<{
      sampleIndex: number;
      x: number;
      y: number;
      opacity: number;
    }>;
  };
}

const CHECKPOINT_PATH = fileURLToPath(
  new URL('../docs/visual-clarity-proposal/manual-checkpoints/vc3c-post-slice-1440x900.png', import.meta.url),
);

function createSatellite(satelliteId: string, displayOrder: number): VisibleSat {
  const satelliteVisualIndex = satelliteTintIndex(satelliteId, displayOrder);

  return {
    id: satelliteId,
    shellId: 'validation-shell',
    altitudeKm: 550,
    world: new THREE.Vector3(displayOrder * 72, 180, 120),
    topo: { eastKm: 0, northKm: 0, upKm: 0, elevationDeg: 55, azimuthDeg: 90, rangeKm: 650 },
    latDeg: 0,
    lonDeg: 0,
    satelliteTintColor: satelliteTint(satelliteId, displayOrder),
    satelliteGlyph: satelliteGlyph(satelliteVisualIndex),
    satelliteVisualIndex,
  };
}

function assertOpacityEnvelope(): void {
  const opacities = createOrbitTrailOpacitySamples();

  assert.equal(opacities.length, ORBIT_TRAIL_SAMPLE_COUNT, 'orbit trail must expose exactly 25 opacity samples');
  assert.equal(opacities[0], ORBIT_TRAIL_HEAD_OPACITY, 'orbit trail head opacity drifted');
  assert.equal(opacities.at(-1), ORBIT_TRAIL_TAIL_OPACITY, 'orbit trail tail must fade to zero');

  opacities.forEach((opacity, index) => {
    assert.equal(opacity, resolveOrbitTrailOpacity(index), `opacity helper mismatch at sample ${index}`);
    if (opacity > 0) {
      assert.ok(
        opacity >= ORBIT_TRAIL_OPACITY_FLOOR,
        `non-zero opacity at sample ${index} must stay above the visibility floor`,
      );
    }
    if (index > 0) {
      assert.ok(
        opacity <= opacities[index - 1],
        `orbit trail opacity must monotonically decrease at sample ${index}`,
      );
    }
  });
}

function assertGeometryAndSampling(): void {
  const initial = new THREE.Vector3(1, 2, 3);
  const samples = createOrbitTrailSamples(initial);
  const geometry = createOrbitTrailGeometry(samples);

  try {
    assert.equal(samples.length, ORBIT_TRAIL_SAMPLE_COUNT, 'sample ring must keep the declared trail length');
    assert.ok(
      samples.every(sample => sample !== initial && sample.equals(initial)),
      'sample ring must clone the initial vector rather than aliasing it',
    );
    assert.equal(geometry.getAttribute('position').count, ORBIT_TRAIL_SAMPLE_COUNT);
    assert.equal(geometry.getAttribute('trailOpacity').count, ORBIT_TRAIL_SAMPLE_COUNT);

    const next = new THREE.Vector3(8, 9, 10);
    advanceOrbitTrailSamples(samples, next);
    writeOrbitTrailGeometryPositions(geometry, samples);
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;

    assert.equal(position.getX(0), next.x, 'head sample must advance to the latest satellite position');
    assert.equal(position.getY(0), next.y, 'head sample y-coordinate was not written');
    assert.equal(position.getZ(0), next.z, 'head sample z-coordinate was not written');
    assert.equal(position.getX(1), initial.x, 'previous head sample must shift to index 1');
  } finally {
    geometry.dispose();
  }
}

function assertPlanInvariants(): void {
  assert.equal(ORBIT_TRAIL_SAMPLE_INTERVAL_SEC, 0.2, 'orbit trail must sample at 200 ms intervals');
  assertOpacityEnvelope();
  assertGeometryAndSampling();

  const satellites = [
    createSatellite('shell-pro-53-P0-S0', 0),
    createSatellite('shell-pro-53-P0-S1', 1),
    createSatellite('shell-pro-53-P0-S2', 2),
  ];
  const plans = resolveOrbitTrailPlans({ satellites });

  assert.equal(plans.length, satellites.length, 'each visible satellite must get exactly one trail plan');
  assert.deepEqual(
    plans.map(plan => plan.color),
    satellites.map(satellite => satellite.satelliteTintColor),
    'trail colors must come from the satellite tint channel',
  );
  assert.ok(
    plans.every(plan => plan.sampleCount === ORBIT_TRAIL_SAMPLE_COUNT),
    'every trail plan must retain the 25-sample trail length',
  );
  assert.equal(resolveOrbitTrailPlans({ satellites, enabled: false }).length, 0);
  assert.equal(resolveOrbitTrailPlans({ satellites, reducedMotion: true }).length, 0);

  const geometries = plans.map(plan => createOrbitTrailGeometry(createOrbitTrailSamples(satellites[0].world)));
  try {
    assert.equal(
      new Set(geometries.map(geometry => geometry.uuid)).size,
      plans.length,
      'visible satellites must not share BufferGeometry instances',
    );
    assert.equal(
      new Set(geometries.map(geometry => geometry.getAttribute('position').array)).size,
      plans.length,
      'visible satellites must not share position attribute arrays',
    );
  } finally {
    geometries.forEach(geometry => geometry.dispose());
  }
}

function hexToRgb(hex: string): PixelRgb {
  const normalized = hex.replace('#', '');
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function linearize(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function labFromRgb(rgb: PixelRgb): [number, number, number] {
  const r = linearize(rgb.r);
  const g = linearize(rgb.g);
  const b = linearize(rgb.b);
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (value: number) => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function deltaERgb(left: PixelRgb, right: PixelRgb): number {
  const a = labFromRgb(left);
  const b = labFromRgb(right);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function alphaBlend(background: PixelRgb, foregroundHex: string, opacity: number): PixelRgb {
  const foreground = hexToRgb(foregroundHex);
  return {
    r: Math.round(background.r * (1 - opacity) + foreground.r * opacity),
    g: Math.round(background.g * (1 - opacity) + foreground.g * opacity),
    b: Math.round(background.b * (1 - opacity) + foreground.b * opacity),
  };
}

async function installVc3cFixture(page: Page): Promise<void> {
  await page.addScriptTag({
    type: 'module',
    content: `
      import { renderVc3OrbitTrailFixture } from '/src/validation/vc3OrbitTrailFixture.tsx';
      window.__renderVc3OrbitTrailFixture = renderVc3OrbitTrailFixture;
    `,
  });
  await page.waitForFunction(() => typeof window.__renderVc3OrbitTrailFixture === 'function');
}

async function sampleOrbitTrailCanvas(
  page: Page,
  fixture: Vc3cBrowserFixtureResult,
): Promise<{
  nonBackgroundPixels: number;
  firstTrailHeadDeltaE: number;
  firstTrailSampleDeltas: number[];
}> {
  return page.evaluate(`
    (() => {
      const fixture = ${JSON.stringify(fixture)};
      function hexToRgbLocal(hex) {
        const normalized = hex.replace('#', '');
        return {
          r: Number.parseInt(normalized.slice(0, 2), 16),
          g: Number.parseInt(normalized.slice(2, 4), 16),
          b: Number.parseInt(normalized.slice(4, 6), 16),
        };
      }
      function linearizeLocal(value) {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      }
      function labLocal(rgb) {
        const r = linearizeLocal(rgb.r);
        const g = linearizeLocal(rgb.g);
        const b = linearizeLocal(rgb.b);
        let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
        let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
        let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
        const f = value => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);
        x = f(x);
        y = f(y);
        z = f(z);
        return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
      }
      function deltaLocal(left, right) {
        const a = labLocal(left);
        const b = labLocal(right);
        return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      }
      function alphaBlendLocal(background, foregroundHex, opacity) {
        const foreground = hexToRgbLocal(foregroundHex);
        return {
          r: Math.round(background.r * (1 - opacity) + foreground.r * opacity),
          g: Math.round(background.g * (1 - opacity) + foreground.g * opacity),
          b: Math.round(background.b * (1 - opacity) + foreground.b * opacity),
        };
      }

      const source = document.querySelector('canvas');
      if (!(source instanceof HTMLCanvasElement)) throw new Error('vc3c canvas was not rendered');
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('could not allocate 2D canvas for vc3c pixel sample');
      context.drawImage(source, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const background = { r: data[0], g: data[1], b: data[2] };

      let nonBackgroundPixels = 0;
      for (let index = 0; index < data.length; index += 4) {
        const pixel = { r: data[index], g: data[index + 1], b: data[index + 2] };
        if (deltaLocal(pixel, background) > 3) nonBackgroundPixels += 1;
      }

      if (!fixture.samplePlan.expectedTrailColors[0]) {
        return {
          nonBackgroundPixels,
          firstTrailHeadDeltaE: Number.POSITIVE_INFINITY,
          firstTrailSampleDeltas: [],
        };
      }

      function strongestPixelNear(point) {
        let strongest = background;
        let strongestDelta = -Infinity;
        const centerX = Math.round(point.x);
        const centerY = Math.round(point.y);
        for (let y = centerY - 2; y <= centerY + 2; y += 1) {
          for (let x = centerX - 2; x <= centerX + 2; x += 1) {
            if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
            const offset = (y * canvas.width + x) * 4;
            const pixel = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
            const delta = deltaLocal(pixel, background);
            if (delta > strongestDelta) {
              strongest = pixel;
              strongestDelta = delta;
            }
          }
        }
        return { pixel: strongest, delta: strongestDelta };
      }

      const samples = fixture.samplePlan.firstTrailSamples.map(strongestPixelNear);
      const expectedHead = alphaBlendLocal(
        background,
        fixture.samplePlan.expectedTrailColors[0],
        fixture.samplePlan.firstTrailSamples[0].opacity,
      );

      return {
        nonBackgroundPixels,
        firstTrailHeadDeltaE: deltaLocal(samples[0].pixel, expectedHead),
        firstTrailSampleDeltas: samples.map(sample => sample.delta),
      };
    })()
  `);
}

async function assertBrowserFixture(
  browser: Browser,
  appUrl: string,
): Promise<{
  enabled: Vc3cBrowserFixtureResult;
  enabledSample: Awaited<ReturnType<typeof sampleOrbitTrailCanvas>>;
  disabledSamples: Record<string, Awaited<ReturnType<typeof sampleOrbitTrailCanvas>>>;
}> {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await installVc3cFixture(page);

    const enabled = await page.evaluate(async () => window.__renderVc3OrbitTrailFixture()) as Vc3cBrowserFixtureResult;
    await page.locator('canvas').waitFor({ timeout: 5000 });
    await page.waitForTimeout(150);
    const enabledSample = await sampleOrbitTrailCanvas(page, enabled);

    assert.equal(enabled.canvasReady, true, 'Phase 3C browser fixture did not report a canvas');
    assert.equal(enabled.visibleSatelliteCount, 3, 'Phase 3C fixture should expose three visible satellites');
    assert.equal(enabled.trailCount, 3, 'Phase 3C fixture should render one trail per visible satellite');
    assert.equal(
      new Set(enabled.geometryIds).size,
      enabled.geometryIds.length,
      'Phase 3C fixture trails must not share BufferGeometry instances',
    );
    assert.ok(
      enabled.attributeCounts.every(entry => entry.position === ORBIT_TRAIL_SAMPLE_COUNT),
      'every Phase 3C trail geometry must expose exactly 25 position samples',
    );
    assert.ok(
      enabled.attributeCounts.every(entry => entry.trailOpacity === ORBIT_TRAIL_SAMPLE_COUNT),
      'every Phase 3C trail geometry must expose exactly 25 opacity samples',
    );
    assert.ok(enabledSample.nonBackgroundPixels > 80, 'enabled Phase 3C fixture canvas looked blank');
    assert.ok(
      enabledSample.firstTrailHeadDeltaE <= 28,
      `enabled Phase 3C trail head color was not close to satellite tint: deltaE ${enabledSample.firstTrailHeadDeltaE.toFixed(2)}`,
    );

    for (let index = 1; index < enabledSample.firstTrailSampleDeltas.length; index += 1) {
      assert.ok(
        enabledSample.firstTrailSampleDeltas[index] <= enabledSample.firstTrailSampleDeltas[index - 1] + 8,
        `Phase 3C trail sample ${index} was brighter than the preceding sample`,
      );
    }
    assert.ok(
      enabledSample.firstTrailSampleDeltas[0] > enabledSample.firstTrailSampleDeltas.at(-1)! + 18,
      'Phase 3C trail opacity ramp did not visibly fade from head to tail',
    );

    const disabledInputs = {
      effectsDisabled: { enabled: false },
      reducedMotion: { reducedMotion: true },
    };
    const disabledSamples: Record<string, Awaited<ReturnType<typeof sampleOrbitTrailCanvas>>> = {};

    for (const [label, input] of Object.entries(disabledInputs)) {
      const result = await page.evaluate(
        async fixtureInput => window.__renderVc3OrbitTrailFixture(fixtureInput),
        input,
      ) as Vc3cBrowserFixtureResult;
      await page.locator('canvas').waitFor({ timeout: 5000 });
      await page.waitForTimeout(100);
      const sample = await sampleOrbitTrailCanvas(page, result);
      assert.equal(result.trailCount, 0, `${label} fixture must render zero orbit trails`);
      assert.ok(
        sample.nonBackgroundPixels < 8,
        `${label} fixture left visible orbit-trail pixels: ${sample.nonBackgroundPixels}`,
      );
      disabledSamples[label] = sample;
    }

    return { enabled, enabledSample, disabledSamples };
  } finally {
    await page.close().catch(() => {});
  }
}

async function captureManualCheckpoint(browser: Browser, appUrl: string): Promise<string> {
  await mkdir(dirname(CHECKPOINT_PATH), { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.addInitScript({
    content: `
      (() => {
        let state = 3303 >>> 0;
        Math.random = () => {
          state += 0x6d2b79f5;
          let value = state;
          value = Math.imul(value ^ (value >>> 15), value | 1);
          value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
          return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
        };
      })();
    `,
  });

  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="info-panel-primary-sinr-status"]').waitFor({ timeout: 30000 });
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(5400);
    await freezeRaf(page, 5400);
    await page.screenshot({ path: CHECKPOINT_PATH });
    return CHECKPOINT_PATH;
  } finally {
    await context.close().catch(() => {});
  }
}

async function main(): Promise<void> {
  assertPlanInvariants();

  const appUrl = await detectAppUrl();
  const browser = await chromium.launch();
  let browserFixture: Awaited<ReturnType<typeof assertBrowserFixture>>;
  let checkpointPath: string;

  try {
    browserFixture = await assertBrowserFixture(browser, appUrl);
    checkpointPath = await captureManualCheckpoint(browser, appUrl);
  } finally {
    await browser.close();
  }

  console.log('Visual Clarity Phase 3C orbit-trail validation passed.');
  console.log(JSON.stringify({
    v1: {
      oneTrailPerVisibleSatellite: 'passed',
      sampleLength: ORBIT_TRAIL_SAMPLE_COUNT,
      sampleIntervalSec: ORBIT_TRAIL_SAMPLE_INTERVAL_SEC,
      opacityEnvelope: 'passed',
      independentGeometry: 'passed',
      reducedMotionGate: 'passed',
    },
    v3: {
      appUrl,
      enabled: browserFixture.enabled,
      enabledSample: browserFixture.enabledSample,
      disabledSamples: browserFixture.disabledSamples,
      manualScreenshotCheckpoint: checkpointPath,
    },
    result: 'PASS',
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
