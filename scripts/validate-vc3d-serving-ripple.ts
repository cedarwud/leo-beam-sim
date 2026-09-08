import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import { MEASURED_BROWSER_GATE_FLOORS_MS, runBrowserValidator } from './lib/browser-gate.ts';
import { BEAM_ROLE_TOKENS, SATELLITE_TINT_PALETTE, satelliteTint, satelliteTintIndex } from '../src/constants/beamRoleTokens.ts';
import {
  GROUND_RIPPLE_RING_COUNT,
  PENDING_RIPPLE_CYCLE_SEC,
  PENDING_RIPPLE_EXPAND_SEC,
  PENDING_RIPPLE_RADIUS_MULTIPLIER,
  SERVING_RIPPLE_CYCLE_SEC,
  SERVING_RIPPLE_EXPAND_SEC,
  SERVING_RIPPLE_RADIUS_MULTIPLIER,
  createGroundRippleInstances,
  groundRippleSpec,
  isPendingRippleBeam,
  isServingRippleBeam,
  resolveGroundRippleEnvelope,
  resolveGroundRippleTargets,
} from '../src/viz/ServingGroundRipple.tsx';
import type { BeamTarget } from '../src/viz/SatelliteBeams.tsx';
import { satelliteGlyph } from '../src/viz/glyphs.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';
import { freezeRaf } from './_v3-deterministic-fixture.ts';

interface PixelRgb {
  r: number;
  g: number;
  b: number;
}

interface Vc3dBrowserFixtureResult {
  canvasReady: boolean;
  targetCount: number;
  ringCount: number;
  targets: Array<{
    id: string;
    role: string;
    beamId: number;
    color: string;
    groundX: number;
    groundZ: number;
  }>;
  gate: {
    servingEnabled: boolean;
    pendingEnabled: boolean;
    paused: boolean;
    reducedMotion: boolean;
    recentHoActive: boolean;
  };
  envelopeSamples: Array<{
    role: string;
    atSec: number;
    progress: number;
    radius: number;
    opacity: number;
    visible: boolean;
  }>;
  samplePlan: {
    backgroundColor: string;
    viewport: { width: number; height: number };
    expectedColors: string[];
    ringCountPerTarget: number;
  };
}

const CHECKPOINT_PATH = fileURLToPath(
  new URL('../docs/visual-clarity-proposal/manual-checkpoints/vc3d-post-slice-1440x900.png', import.meta.url),
);
const FOOTPRINT_RADIUS = 80;

function createBeam(input: {
  satelliteId: string;
  displayOrder: number;
  beamId: number;
  role?: BeamTarget['role'];
  isServing?: boolean;
  isScheduledActive?: boolean;
  showBeam?: boolean;
}): BeamTarget {
  const satelliteVisualIndex = satelliteTintIndex(input.satelliteId, input.displayOrder);

  return {
    beamId: input.beamId,
    groundX: input.displayOrder * 48,
    groundZ: 0,
    isServing: input.isServing ?? false,
    isScheduledActive: input.isScheduledActive ?? true,
    isPrimary: Boolean(input.role || input.isServing),
    showBeam: input.showBeam ?? true,
    frequencyIndex: input.displayOrder,
    satelliteTintColor: satelliteTint(input.satelliteId, input.displayOrder),
    satelliteGlyph: satelliteGlyph(satelliteVisualIndex),
    satelliteVisualIndex,
    role: input.role,
    sinrDb: 18 - input.displayOrder,
  };
}

function assertPlanInvariants(): void {
  const serving = createBeam({
    satelliteId: 'shell-pro-53-P0-S0',
    displayOrder: 0,
    beamId: 3,
    role: 'serving',
    isServing: true,
  });
  const pending = createBeam({
    satelliteId: 'shell-pro-53-P0-S1',
    displayOrder: 1,
    beamId: 5,
    role: 'prepared',
  });
  const approach = createBeam({
    satelliteId: 'shell-pro-53-P0-S2',
    displayOrder: 2,
    beamId: 7,
    role: 'approach',
  });
  const recent = createBeam({
    satelliteId: 'shell-pro-53-P0-S3',
    displayOrder: 3,
    beamId: 9,
    role: 'secondary',
  });
  const inactiveServing = createBeam({
    satelliteId: 'shell-pro-53-P0-S4',
    displayOrder: 0,
    beamId: 11,
    role: 'serving',
    isServing: true,
    isScheduledActive: false,
  });
  const hiddenPending = createBeam({
    satelliteId: 'shell-pro-53-P0-S5',
    displayOrder: 1,
    beamId: 13,
    role: 'prepared',
    showBeam: false,
  });
  const otherActive = createBeam({
    satelliteId: 'shell-pro-53-P0-S6',
    displayOrder: 2,
    beamId: 15,
  });

  assert.equal(isServingRippleBeam(serving), true, 'serving beam must qualify for serving ripple');
  assert.equal(isPendingRippleBeam(pending), true, 'prepared beam must qualify for pending ripple');
  assert.equal(isPendingRippleBeam(approach), false, 'approach beam must not get pending ripple');
  assert.equal(isPendingRippleBeam(recent), false, 'recent-source beam must not get pending ripple');
  assert.equal(isServingRippleBeam(inactiveServing), false, 'off-slot serving beam must not get serving ripple');
  assert.equal(isPendingRippleBeam(hiddenPending), false, 'hidden pending beam must not get pending ripple');
  assert.equal(isPendingRippleBeam(otherActive), false, 'otherActive beam must not get pending ripple');

  const satBeams = new Map<string, BeamTarget[]>([
    ['shell-pro-53-P0-S0', [serving, otherActive]],
    ['shell-pro-53-P0-S1', [pending, approach, recent]],
  ]);
  const enabled = resolveGroundRippleTargets({ satBeams, footprintRadius: FOOTPRINT_RADIUS });

  assert.deepEqual(
    enabled.map(target => target.role).sort(),
    ['pending', 'serving'],
    'only serving and pending roles may emit ground ripples',
  );
  assert.equal(createGroundRippleInstances(enabled).length, enabled.length * GROUND_RIPPLE_RING_COUNT);
  assert.equal(resolveGroundRippleTargets({ satBeams, footprintRadius: FOOTPRINT_RADIUS, servingEnabled: false }).length, 1);
  assert.equal(resolveGroundRippleTargets({ satBeams, footprintRadius: FOOTPRINT_RADIUS, pendingEnabled: false }).length, 1);
  assert.equal(resolveGroundRippleTargets({ satBeams, footprintRadius: FOOTPRINT_RADIUS, paused: true }).length, 0);
  assert.equal(resolveGroundRippleTargets({ satBeams, footprintRadius: FOOTPRINT_RADIUS, reducedMotion: true }).length, 0);
  assert.equal(resolveGroundRippleTargets({ satBeams, footprintRadius: FOOTPRINT_RADIUS, recentHoActive: true }).length, 0);

  const servingSpec = groundRippleSpec('serving');
  const pendingSpec = groundRippleSpec('pending');
  assert.equal(servingSpec.color, BEAM_ROLE_TOKENS.serving.color, 'serving ripple must use serving role color');
  assert.equal(pendingSpec.color, BEAM_ROLE_TOKENS.pending.color, 'pending ripple must use pending role color');
  assert.equal(servingSpec.cycleSec, SERVING_RIPPLE_CYCLE_SEC);
  assert.equal(servingSpec.expandSec, SERVING_RIPPLE_EXPAND_SEC);
  assert.equal(pendingSpec.cycleSec, PENDING_RIPPLE_CYCLE_SEC);
  assert.equal(pendingSpec.expandSec, PENDING_RIPPLE_EXPAND_SEC);
  assert.ok(
    !SATELLITE_TINT_PALETTE.includes(servingSpec.color as (typeof SATELLITE_TINT_PALETTE)[number])
    && !SATELLITE_TINT_PALETTE.includes(pendingSpec.color as (typeof SATELLITE_TINT_PALETTE)[number]),
    'groundRipple must not use satellite-tint colors',
  );
  assert.ok(
    PENDING_RIPPLE_RADIUS_MULTIPLIER < SERVING_RIPPLE_RADIUS_MULTIPLIER,
    'pending ripple must stay smaller than serving ripple',
  );

  const servingHalf = resolveGroundRippleEnvelope(
    { ...servingSpec, footprintRadius: FOOTPRINT_RADIUS },
    SERVING_RIPPLE_EXPAND_SEC / 2,
  );
  const servingEnd = resolveGroundRippleEnvelope(
    { ...servingSpec, footprintRadius: FOOTPRINT_RADIUS },
    SERVING_RIPPLE_EXPAND_SEC,
  );
  const pendingEnd = resolveGroundRippleEnvelope(
    { ...pendingSpec, footprintRadius: FOOTPRINT_RADIUS },
    PENDING_RIPPLE_EXPAND_SEC,
  );

  assert.ok(servingHalf.visible, 'serving ripple must be visible midway through expansion');
  assert.ok(servingHalf.radius > 0 && servingHalf.radius < FOOTPRINT_RADIUS * SERVING_RIPPLE_RADIUS_MULTIPLIER);
  assert.ok(servingHalf.opacity > servingEnd.opacity, 'serving ripple must fade over its expansion');
  assert.equal(servingEnd.opacity, 0, 'serving ripple must fade to zero at the outer radius');
  assert.ok(Math.abs(servingEnd.radius - FOOTPRINT_RADIUS * SERVING_RIPPLE_RADIUS_MULTIPLIER) <= 1e-9);
  assert.ok(Math.abs(pendingEnd.radius - FOOTPRINT_RADIUS * PENDING_RIPPLE_RADIUS_MULTIPLIER) <= 1e-9);
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

async function installVc3dFixture(page: Page): Promise<void> {
  await page.addScriptTag({
    type: 'module',
    content: `
      import { renderVc3ServingRippleFixture } from '/src/validation/vc3ServingRippleFixture.tsx';
      window.__renderVc3ServingRippleFixture = renderVc3ServingRippleFixture;
    `,
  });
  await page.waitForFunction(() => typeof window.__renderVc3ServingRippleFixture === 'function');
}

async function sampleGroundRippleCanvas(
  page: Page,
): Promise<{
  nonBackgroundPixels: number;
  nearestRolePixelDeltaE: number;
}> {
  const targetColors = JSON.stringify([BEAM_ROLE_TOKENS.serving.color, BEAM_ROLE_TOKENS.pending.color]);
  return page.evaluate(`
    (() => {
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
      function blendLocal(background, foregroundHex, opacity) {
        const foreground = hexToRgbLocal(foregroundHex);
        return {
          r: Math.min(255, Math.round(background.r + foreground.r * opacity)),
          g: Math.min(255, Math.round(background.g + foreground.g * opacity)),
          b: Math.min(255, Math.round(background.b + foreground.b * opacity)),
        };
      }

      const source = document.querySelector('canvas');
      if (!(source instanceof HTMLCanvasElement)) throw new Error('vc3d canvas was not rendered');
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('could not allocate 2D canvas for vc3d pixel sample');
      context.drawImage(source, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const background = { r: data[0], g: data[1], b: data[2] };
      const targetColors = ${targetColors};
      const targetPixels = targetColors.flatMap(color => [0.42, 0.26, 0.16, 0.1].map(opacity => blendLocal(background, color, opacity)));
      let nonBackgroundPixels = 0;
      let nearestRolePixelDeltaE = Number.POSITIVE_INFINITY;

      for (let index = 0; index < data.length; index += 4) {
        const pixel = { r: data[index], g: data[index + 1], b: data[index + 2] };
        if (deltaLocal(pixel, background) < 3) continue;
        nonBackgroundPixels += 1;
        for (const target of targetPixels) {
          nearestRolePixelDeltaE = Math.min(nearestRolePixelDeltaE, deltaLocal(pixel, target));
        }
      }

      return { nonBackgroundPixels, nearestRolePixelDeltaE };
    })()
  `);
}

function assertBrowserEnvelopeSamples(result: Vc3dBrowserFixtureResult): void {
  const byRole = new Map<string, Vc3dBrowserFixtureResult['envelopeSamples']>();
  for (const sample of result.envelopeSamples) {
    const samples = byRole.get(sample.role) ?? [];
    samples.push(sample);
    byRole.set(sample.role, samples);
  }

  for (const [role, samples] of byRole.entries()) {
    assert.equal(samples.length, 3, `${role} must report three envelope samples`);
    assert.equal(samples[0].radius, 0, `${role} ripple must start at radius zero`);
    assert.ok(samples[1].visible, `${role} ripple must be visible at the midpoint sample`);
    assert.ok(samples[1].radius > samples[0].radius, `${role} ripple radius must expand`);
    assert.ok(samples[2].radius > samples[1].radius, `${role} ripple radius must keep expanding to the edge`);
    assert.ok(samples[2].opacity < samples[1].opacity, `${role} ripple opacity must fade`);
    assert.ok(samples[2].opacity <= 1e-9, `${role} ripple must fade to zero at the edge`);
  }
}

async function assertBrowserFixture(
  browser: Browser,
  appUrl: string,
): Promise<{
  enabled: Vc3dBrowserFixtureResult;
  enabledSample: Awaited<ReturnType<typeof sampleGroundRippleCanvas>>;
  gateResults: Record<string, Vc3dBrowserFixtureResult>;
  blankSamples: Record<string, Awaited<ReturnType<typeof sampleGroundRippleCanvas>>>;
}> {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await installVc3dFixture(page);

    const enabled = await page.evaluate(async () => window.__renderVc3ServingRippleFixture()) as Vc3dBrowserFixtureResult;
    await page.locator('canvas').waitFor({ timeout: 5000 });
    await page.waitForTimeout(250);
    const enabledSample = await sampleGroundRippleCanvas(page);
    assert.equal(enabled.canvasReady, true, 'Phase 3D browser fixture did not report a canvas');
    assert.deepEqual(enabled.targets.map(target => target.role).sort(), ['pending', 'serving']);
    assert.equal(enabled.targetCount, 2, 'enabled fixture must render serving and pending ripple targets');
    assert.equal(enabled.ringCount, 2 * GROUND_RIPPLE_RING_COUNT, 'enabled fixture rendered the wrong ring count');
    assertBrowserEnvelopeSamples(enabled);
    assert.ok(enabledSample.nonBackgroundPixels > 24, 'enabled Phase 3D fixture canvas looked blank');
    assert.ok(
      enabledSample.nearestRolePixelDeltaE <= 18,
      `enabled Phase 3D ripple pixels were not close to role colors: deltaE ${enabledSample.nearestRolePixelDeltaE.toFixed(2)}`,
    );

    const gateInputs = {
      servingDisabled: { servingEnabled: false },
      pendingDisabled: { pendingEnabled: false },
      effectsDisabled: { servingEnabled: false, pendingEnabled: false },
      paused: { paused: true },
      reducedMotion: { reducedMotion: true },
      recentHoActive: { recentHoActive: true },
    };
    const gateResults: Record<string, Vc3dBrowserFixtureResult> = {};
    const blankSamples: Record<string, Awaited<ReturnType<typeof sampleGroundRippleCanvas>>> = {};

    for (const [label, input] of Object.entries(gateInputs)) {
      const result = await page.evaluate(
        async fixtureInput => window.__renderVc3ServingRippleFixture(fixtureInput),
        input,
      ) as Vc3dBrowserFixtureResult;
      await page.locator('canvas').waitFor({ timeout: 5000 });
      await page.waitForTimeout(120);
      gateResults[label] = result;

      if (label === 'servingDisabled') {
        assert.deepEqual(result.targets.map(target => target.role), ['pending'], 'serving gate must not disable pending ripple');
        continue;
      }
      if (label === 'pendingDisabled') {
        assert.deepEqual(result.targets.map(target => target.role), ['serving'], 'pending gate must not disable serving ripple');
        continue;
      }

      const sample = await sampleGroundRippleCanvas(page);
      assert.equal(result.targetCount, 0, `${label} fixture must render zero ripple targets`);
      assert.ok(sample.nonBackgroundPixels < 8, `${label} fixture left visible ground-ripple pixels: ${sample.nonBackgroundPixels}`);
      blankSamples[label] = sample;
    }

    return { enabled, enabledSample, gateResults, blankSamples };
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
        let state = 3304 >>> 0;
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
    await page.waitForTimeout(2600);
    await freezeRaf(page, 2600);
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

  console.log('Visual Clarity Phase 3D serving-ripple validation passed.');
  console.log(JSON.stringify({
    v1: {
      roleFiltering: 'passed',
      independentServingPendingGates: 'passed',
      reducedMotionPausedRecentHoGates: 'passed',
      roleColorChannel: 'passed',
      radiusEnvelope: 'passed',
    },
    v3: {
      appUrl,
      enabled: browserFixture.enabled,
      enabledSample: browserFixture.enabledSample,
      gateResults: browserFixture.gateResults,
      blankSamples: browserFixture.blankSamples,
      manualScreenshotCheckpoint: checkpointPath,
    },
    result: 'PASS',
  }, null, 2));
}

void runBrowserValidator(
  {
    validator: 'validate-vc3d-serving-ripple',
    appUrl: process.env.APP_URL ?? process.argv[2],
    floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.quickCanvas,
  },
  async () => main(),
).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
