import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import { MEASURED_BROWSER_GATE_FLOORS_MS, runBrowserValidator } from './lib/browser-gate.ts';
import * as THREE from 'three';
import { satelliteTint, satelliteTintIndex } from '../src/constants/beamRoleTokens.ts';
import type { VisibleSat } from '../src/scene/types.ts';
import {
  SPINE_PARTICLE_CYCLE_SEC,
  SPINE_PARTICLES_PER_BEAM,
  isSpineParticleBeam,
  normalizeSpineParticleProgress,
  resolveSpineParticleOpacity,
  resolveSpineParticlePlans,
  resolveSpineParticlePosition,
} from '../src/viz/SpineParticles.tsx';
import type { BeamTarget } from '../src/viz/SatelliteBeams.tsx';
import { satelliteGlyph } from '../src/viz/glyphs.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';
import { bootDeterministicPage } from './_v3-deterministic-fixture.ts';

interface Vc3bBrowserFixtureResult {
  canvasReady: boolean;
  eventBeamCount: number;
  particleCount: number;
  particlesPerEventBeam: number;
  particleColors: string[];
  excludedBeamCount: number;
  gate: {
    enabled: boolean;
    paused: boolean;
    reducedMotion: boolean;
  };
  samplePlan: {
    backgroundColor: string;
    viewport: { width: number; height: number };
    expectedParticleColors: string[];
  };
}

const CHECKPOINT_PATH = fileURLToPath(
  new URL('../docs/visual-clarity-proposal/manual-checkpoints/vc3b-post-slice-1440x900.png', import.meta.url),
);

function createSatellite(satelliteId: string, displayOrder: number): VisibleSat {
  const satelliteVisualIndex = satelliteTintIndex(satelliteId, displayOrder);

  return {
    id: satelliteId,
    shellId: 'validation-shell',
    altitudeKm: 550,
    world: new THREE.Vector3(displayOrder * 80, 180, 120),
    topo: { eastKm: 0, northKm: 0, upKm: 0, elevationDeg: 55, azimuthDeg: 90, rangeKm: 650 },
    latDeg: 0,
    lonDeg: 0,
    satelliteTintColor: satelliteTint(satelliteId, displayOrder),
    satelliteGlyph: satelliteGlyph(satelliteVisualIndex),
    satelliteVisualIndex,
  };
}

function createBeam(input: {
  satelliteId: string;
  displayOrder: number;
  beamId: number;
  role?: BeamTarget['role'];
  isServing?: boolean;
  isScheduledActive?: boolean;
}): BeamTarget {
  const satelliteVisualIndex = satelliteTintIndex(input.satelliteId, input.displayOrder);

  return {
    beamId: input.beamId,
    groundX: input.displayOrder * 80,
    groundZ: 0,
    isServing: input.isServing ?? false,
    isScheduledActive: input.isScheduledActive ?? true,
    isPrimary: Boolean(input.role),
    showBeam: true,
    frequencyIndex: input.displayOrder,
    satelliteTintColor: satelliteTint(input.satelliteId, input.displayOrder),
    satelliteGlyph: satelliteGlyph(satelliteVisualIndex),
    satelliteVisualIndex,
    role: input.role,
    sinrDb: 18,
  };
}

function assertPlanInvariants(): void {
  const serving = createBeam({
    satelliteId: 'shell-pro-53-P0-S0',
    displayOrder: 0,
    beamId: 1,
    role: 'serving',
    isServing: true,
  });
  const pending = createBeam({
    satelliteId: 'shell-pro-53-P0-S1',
    displayOrder: 1,
    beamId: 2,
    role: 'prepared',
  });
  const approach = createBeam({
    satelliteId: 'shell-pro-53-P0-S2',
    displayOrder: 2,
    beamId: 3,
    role: 'approach',
  });
  const recentSource = createBeam({
    satelliteId: 'shell-pro-53-P0-S3',
    displayOrder: 3,
    beamId: 4,
    role: 'secondary',
  });
  const otherActive = createBeam({
    satelliteId: 'shell-pro-53-P0-S4',
    displayOrder: 0,
    beamId: 5,
  });
  const offSlotPending = createBeam({
    satelliteId: 'shell-pro-53-P0-S5',
    displayOrder: 1,
    beamId: 6,
    role: 'prepared',
    isScheduledActive: false,
  });

  assert.equal(isSpineParticleBeam(serving), true, 'serving beam must qualify for spine particles');
  assert.equal(isSpineParticleBeam(pending), true, 'pending beam must qualify for spine particles');
  assert.equal(isSpineParticleBeam(approach), true, 'approach beam must qualify for spine particles');
  assert.equal(isSpineParticleBeam(recentSource), true, 'recent-source beam must qualify for spine particles');
  assert.equal(isSpineParticleBeam(otherActive), false, 'otherActive beams must not get spine particles');
  assert.equal(isSpineParticleBeam(offSlotPending), false, 'off-slot event beams must not imply active drift');

  const satellites = [
    createSatellite('shell-pro-53-P0-S0', 0),
    createSatellite('shell-pro-53-P0-S1', 1),
  ];
  const satBeams = new Map<string, BeamTarget[]>([
    [satellites[0].id, [serving, otherActive]],
    [satellites[1].id, [pending, offSlotPending]],
  ]);
  const enabled = resolveSpineParticlePlans({ satellites, satBeams });

  assert.equal(enabled.length, 2 * SPINE_PARTICLES_PER_BEAM, 'each event beam must get the declared particle count');
  assert.ok(
    enabled.every(plan => plan.color === satelliteTint(plan.satelliteId, plan.satelliteId.endsWith('S0') ? 0 : 1)),
    'particle color must come from the satellite tint channel',
  );
  assert.equal(resolveSpineParticlePlans({ satellites, satBeams, enabled: false }).length, 0);
  assert.equal(resolveSpineParticlePlans({ satellites, satBeams, paused: true }).length, 0);
  assert.equal(resolveSpineParticlePlans({ satellites, satBeams, reducedMotion: true }).length, 0);

  const samplePlan = enabled[0];
  const startPosition = resolveSpineParticlePosition(samplePlan, 0);
  const laterPosition = resolveSpineParticlePosition(samplePlan, SPINE_PARTICLE_CYCLE_SEC / 3);
  assert.ok(laterPosition.distanceTo(samplePlan.end) < startPosition.distanceTo(samplePlan.end), 'particle must drift toward ground');
  assert.equal(normalizeSpineParticleProgress(0, 0), 0);
  assert.ok(resolveSpineParticleOpacity(0.5) > resolveSpineParticleOpacity(0), 'particle opacity must crest mid-spine');
}

async function installVc3bFixture(page: Page): Promise<void> {
  await page.addScriptTag({
    type: 'module',
    content: `
      import { renderVc3SpineParticlesFixture } from '/src/validation/vc3SpineParticlesFixture.tsx';
      window.__renderVc3SpineParticlesFixture = renderVc3SpineParticlesFixture;
    `,
  });
  await page.waitForFunction(() => typeof window.__renderVc3SpineParticlesFixture === 'function');
}

async function sampleSpineParticleCanvas(
  page: Page,
  fixture: Vc3bBrowserFixtureResult,
): Promise<{
  nonBackgroundPixels: number;
  nearestTintDeltaE: number;
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
      function deltaLocal(a, b) {
        const left = labLocal(a);
        const right = labLocal(b);
        return Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]);
      }
      function alphaBlendLocal(backgroundHex, foregroundHex, opacity) {
        const background = hexToRgbLocal(backgroundHex);
        const foreground = hexToRgbLocal(foregroundHex);
        return {
          r: Math.round(background.r * (1 - opacity) + foreground.r * opacity),
          g: Math.round(background.g * (1 - opacity) + foreground.g * opacity),
          b: Math.round(background.b * (1 - opacity) + foreground.b * opacity),
        };
      }
      function alphaBlendRgbLocal(background, foregroundHex, opacity) {
        const foreground = hexToRgbLocal(foregroundHex);
        return {
          r: Math.round(background.r * (1 - opacity) + foreground.r * opacity),
          g: Math.round(background.g * (1 - opacity) + foreground.g * opacity),
          b: Math.round(background.b * (1 - opacity) + foreground.b * opacity),
        };
      }

      const source = document.querySelector('canvas');
      if (!(source instanceof HTMLCanvasElement)) throw new Error('vc3b canvas was not rendered');
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('could not allocate 2D canvas for vc3b pixel sample');
      context.drawImage(source, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const background = { r: data[0], g: data[1], b: data[2] };
      const targets = fixture.samplePlan.expectedParticleColors.flatMap(color => [
        alphaBlendRgbLocal(background, color, 0.86),
        alphaBlendRgbLocal(background, color, 0.57),
      ]);
      let nonBackgroundPixels = 0;
      let nearestTintDeltaE = Infinity;
      for (let index = 0; index < data.length; index += 4) {
        const pixel = { r: data[index], g: data[index + 1], b: data[index + 2] };
        if (deltaLocal(pixel, background) < 3) continue;
        nonBackgroundPixels += 1;
        for (const target of targets) {
          nearestTintDeltaE = Math.min(nearestTintDeltaE, deltaLocal(pixel, target));
        }
      }
      return { nonBackgroundPixels, nearestTintDeltaE };
    })()
  `);
}

async function assertBrowserFixture(
  browser: Browser,
  appUrl: string,
): Promise<{
  enabled: Vc3bBrowserFixtureResult;
  enabledSample: Awaited<ReturnType<typeof sampleSpineParticleCanvas>>;
  disabledSamples: Record<string, Awaited<ReturnType<typeof sampleSpineParticleCanvas>>>;
}> {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await installVc3bFixture(page);

    const enabled = await page.evaluate(async () => window.__renderVc3SpineParticlesFixture()) as Vc3bBrowserFixtureResult;
    await page.locator('canvas').waitFor({ timeout: 5000 });
    await page.waitForTimeout(350);
    const enabledSample = await sampleSpineParticleCanvas(page, enabled);
    assert.equal(enabled.canvasReady, true, 'Phase 3B browser fixture did not report a canvas');
    assert.equal(enabled.eventBeamCount, 4, 'Phase 3B fixture should expose four event beams');
    assert.equal(enabled.excludedBeamCount, 1, 'Phase 3B fixture should exclude one non-event beam');
    assert.equal(enabled.particleCount, 4 * SPINE_PARTICLES_PER_BEAM, 'enabled fixture rendered the wrong particle count');
    assert.equal(enabled.particlesPerEventBeam, SPINE_PARTICLES_PER_BEAM, 'fixture particle-per-beam mismatch');
    assert.ok(enabledSample.nonBackgroundPixels > 40, 'enabled Phase 3B fixture canvas looked blank');
    assert.ok(
      enabledSample.nearestTintDeltaE <= 14,
      `enabled Phase 3B particles were not close to satellite tint colors: deltaE ${enabledSample.nearestTintDeltaE.toFixed(2)}`,
    );

    const disabledInputs = {
      effectsDisabled: { enabled: false },
      paused: { paused: true },
      reducedMotion: { reducedMotion: true },
    };
    const disabledSamples: Record<string, Awaited<ReturnType<typeof sampleSpineParticleCanvas>>> = {};

    for (const [label, input] of Object.entries(disabledInputs)) {
      const result = await page.evaluate(
        async fixtureInput => window.__renderVc3SpineParticlesFixture(fixtureInput),
        input,
      ) as Vc3bBrowserFixtureResult;
      await page.locator('canvas').waitFor({ timeout: 5000 });
      await page.waitForTimeout(100);
      const sample = await sampleSpineParticleCanvas(page, result);
      assert.equal(result.particleCount, 0, `${label} fixture must render zero particles`);
      assert.ok(sample.nonBackgroundPixels < 8, `${label} fixture left visible particle pixels`);
      disabledSamples[label] = sample;
    }

    return { enabled, enabledSample, disabledSamples };
  } finally {
    await page.close().catch(() => {});
  }
}

async function captureManualCheckpoint(browser: Browser, appUrl: string): Promise<string> {
  await mkdir(dirname(CHECKPOINT_PATH), { recursive: true });
  const page = await bootDeterministicPage({ chromium }, {
    url: appUrl,
    browser,
    seed: 3302,
    rafMs: 1900,
    viewport: { width: 1440, height: 900 },
  });

  try {
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: CHECKPOINT_PATH });
    return CHECKPOINT_PATH;
  } finally {
    await page.context().close().catch(() => {});
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

  console.log('Visual Clarity Phase 3B spine-particles validation passed.');
  console.log(JSON.stringify({
    v1: {
      eventBeamFiltering: 'passed',
      gatingPlan: 'passed',
      driftEnvelope: 'passed',
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

void runBrowserValidator(
  {
    validator: 'validate-vc3b-spine-particles',
    appUrl: process.env.APP_URL ?? process.argv[2],
    floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.quickCanvas,
  },
  async () => main(),
).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
