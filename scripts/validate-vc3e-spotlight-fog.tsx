import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import { MEASURED_BROWSER_GATE_FLOORS_MS, runBrowserValidator } from './lib/browser-gate.ts';
import {
  BEAM_FREQUENCY_COLORS,
  BEAM_ROLE_TOKENS,
  type BeamVisualRole,
} from '../src/constants/beamRoleTokens.ts';
import {
  CINEMATIC_LIGHT_DIM_MULTIPLIER,
  CINEMATIC_NON_EVENT_CONE_OPACITY_MULTIPLIER,
  resolveCinematicConeOpacityMultiplier,
  resolveCinematicLightIntensity,
  resolveCinematicSpotlightTargets,
  spotlightRoleForBeam,
} from '../src/scene/cinematicEffects.ts';
import { deriveRuntimeVisualSettings } from '../src/scene/runtimeConfig.ts';
import type { BeamTarget } from '../src/viz/SatelliteBeams.tsx';
import { satelliteGlyph } from '../src/viz/glyphs.ts';
import { satelliteTint, satelliteTintIndex } from '../src/constants/beamRoleTokens.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';
import { freezeRaf } from './_v3-deterministic-fixture.ts';

interface FixtureResult {
  canvasReady: boolean;
  cinematicMode: 'off' | 'spotlight';
  fogActive: boolean;
  dimmedLightIntensity: {
    hemisphere: number;
    ambient: number;
    directional: number;
  };
  spotlightTargets: Array<{
    role: string;
    beamId: number;
    color: string;
    groundX: number;
    groundZ: number;
    intensity: number;
  }>;
  samplePlan: {
    backgroundColor: string;
    viewport: { width: number; height: number };
    points: Record<'serving' | 'pending' | 'nonEvent' | 'campus', { x: number; y: number }>;
  };
}

interface BrightnessSample {
  brightness: Record<'serving' | 'pending' | 'nonEvent' | 'campus', number>;
  rgb: Record<'serving' | 'pending' | 'nonEvent' | 'campus', { r: number; g: number; b: number }>;
}

const CHECKPOINT_PATH = fileURLToPath(
  new URL('../docs/visual-clarity-proposal/manual-checkpoints/vc3e-post-slice-spotlight-1440x900.png', import.meta.url),
);

function createBeam(input: {
  satelliteId: string;
  displayOrder: number;
  beamId: number;
  role?: BeamTarget['role'];
  isServing?: boolean;
  showBeam?: boolean;
  isScheduledActive?: boolean;
}): BeamTarget {
  const satelliteVisualIndex = satelliteTintIndex(input.satelliteId, input.displayOrder);

  return {
    beamId: input.beamId,
    groundX: input.displayOrder * 70,
    groundZ: input.displayOrder * 24,
    isServing: input.isServing ?? false,
    isScheduledActive: input.isScheduledActive ?? true,
    isPrimary: Boolean(input.role || input.isServing),
    showBeam: input.showBeam ?? true,
    frequencyIndex: input.displayOrder,
    satelliteTintColor: satelliteTint(input.satelliteId, input.displayOrder),
    satelliteGlyph: satelliteGlyph(satelliteVisualIndex),
    satelliteVisualIndex,
    role: input.role,
    sinrDb: 20 - input.displayOrder,
  };
}

function assertInvariantSurface(): void {
  assert.equal(deriveRuntimeVisualSettings(false).cinematicMode, 'off');
  assert.equal(resolveCinematicLightIntensity(1, 'spotlight'), CINEMATIC_LIGHT_DIM_MULTIPLIER);
  assert.equal(resolveCinematicLightIntensity(1, 'off'), 1);

  const roleTokenSnapshot = JSON.stringify(BEAM_ROLE_TOKENS);
  const visualRoles: BeamVisualRole[] = [
    'serving',
    'pending',
    'approach',
    'recentSource',
    'otherActive',
    'inactive',
  ];

  for (const visualRole of visualRoles) {
    const expected = visualRole === 'otherActive' || visualRole === 'inactive'
      ? CINEMATIC_NON_EVENT_CONE_OPACITY_MULTIPLIER
      : 1;
    assert.equal(
      resolveCinematicConeOpacityMultiplier(visualRole, 'spotlight'),
      expected,
      `${visualRole} cinematic cone opacity multiplier drifted`,
    );
    assert.equal(resolveCinematicConeOpacityMultiplier(visualRole, 'off'), 1);
  }

  assert.equal(JSON.stringify(BEAM_ROLE_TOKENS), roleTokenSnapshot, 'cinematic helpers must not mutate role tokens');

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
  const hiddenServing = createBeam({
    satelliteId: 'shell-pro-53-P0-S4',
    displayOrder: 0,
    beamId: 11,
    role: 'serving',
    isServing: true,
    showBeam: false,
  });
  const inactivePending = createBeam({
    satelliteId: 'shell-pro-53-P0-S5',
    displayOrder: 1,
    beamId: 13,
    role: 'prepared',
    isScheduledActive: false,
  });
  const otherActive = createBeam({
    satelliteId: 'shell-pro-53-P0-S6',
    displayOrder: 2,
    beamId: 15,
  });

  assert.equal(spotlightRoleForBeam(serving), 'serving');
  assert.equal(spotlightRoleForBeam(pending), 'pending');
  assert.equal(spotlightRoleForBeam(approach), null);
  assert.equal(spotlightRoleForBeam(recent), null);
  assert.equal(spotlightRoleForBeam(hiddenServing), null);
  assert.equal(spotlightRoleForBeam(inactivePending), null);
  assert.equal(spotlightRoleForBeam(otherActive), null);

  const satBeams = new Map<string, BeamTarget[]>([
    ['shell-pro-53-P0-S0', [serving, otherActive]],
    ['shell-pro-53-P0-S1', [pending, approach, recent]],
  ]);
  const offTargets = resolveCinematicSpotlightTargets({ satBeams, cinematicMode: 'off' });
  const spotlightTargets = resolveCinematicSpotlightTargets({ satBeams, cinematicMode: 'spotlight' });

  assert.equal(offTargets.length, 0, 'off mode must not emit cinematic event lights');
  assert.deepEqual(
    spotlightTargets.map(target => target.role).sort(),
    ['pending', 'serving'],
    'spotlight mode must light only serving and pending regions',
  );
  assert.equal(spotlightTargets[0].color, BEAM_ROLE_TOKENS.serving.color);
  assert.equal(spotlightTargets[1].color, BEAM_ROLE_TOKENS.pending.color);
  assert.ok(
    spotlightTargets.every(target => !BEAM_FREQUENCY_COLORS.includes(target.color as (typeof BEAM_FREQUENCY_COLORS)[number])),
    'event spotlights must not use frequency colors',
  );
}

async function installVc3eFixture(page: Page): Promise<void> {
  await page.addScriptTag({
    type: 'module',
    content: `
      import { renderVc3SpotlightFogFixture } from '/src/validation/vc3SpotlightFogFixture.tsx';
      window.__renderVc3SpotlightFogFixture = renderVc3SpotlightFogFixture;
    `,
  });
  await page.waitForFunction(() => typeof window.__renderVc3SpotlightFogFixture === 'function');
}

async function sampleBrightness(page: Page, fixture: FixtureResult): Promise<BrightnessSample> {
  return page.evaluate(`
    (() => {
      const fixture = ${JSON.stringify(fixture)};
      const source = document.querySelector('canvas');
      if (!(source instanceof HTMLCanvasElement)) throw new Error('vc3e canvas was not rendered');

      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('could not allocate 2D canvas for vc3e pixel sample');
      context.drawImage(source, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;

      function pixelAt(x, y) {
        const clampedX = Math.max(0, Math.min(canvas.width - 1, x));
        const clampedY = Math.max(0, Math.min(canvas.height - 1, y));
        const offset = (clampedY * canvas.width + clampedX) * 4;
        return { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
      }

      function brightness(rgb) {
        return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
      }

      function averageNear(point) {
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        const centerX = Math.round(point.x);
        const centerY = Math.round(point.y);
        for (let y = centerY - 10; y <= centerY + 10; y += 1) {
          for (let x = centerX - 10; x <= centerX + 10; x += 1) {
            const pixel = pixelAt(x, y);
            r += pixel.r;
            g += pixel.g;
            b += pixel.b;
            count += 1;
          }
        }

        return {
          r: Math.round(r / count),
          g: Math.round(g / count),
          b: Math.round(b / count),
        };
      }

      const rgb = {
        serving: averageNear(fixture.samplePlan.points.serving),
        pending: averageNear(fixture.samplePlan.points.pending),
        nonEvent: averageNear(fixture.samplePlan.points.nonEvent),
        campus: averageNear(fixture.samplePlan.points.campus),
      };

      return {
        rgb,
        brightness: {
          serving: brightness(rgb.serving),
          pending: brightness(rgb.pending),
          nonEvent: brightness(rgb.nonEvent),
          campus: brightness(rgb.campus),
        },
      };
    })()
  `);
}

async function waitForBrightnessSample(page: Page, fixture: FixtureResult): Promise<BrightnessSample> {
  let lastSample: BrightnessSample | null = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.waitForTimeout(attempt === 0 ? 180 : 120);
    lastSample = await sampleBrightness(page, fixture);
    const maxBrightness = Math.max(...Object.values(lastSample.brightness));
    if (maxBrightness > 0.05) return lastSample;
  }

  assert.ok(lastSample, 'vc3e brightness sampler did not run');
  return lastSample;
}

async function assertFixtureViewport(
  browser: Browser,
  appUrl: string,
  viewport: { width: number; height: number },
): Promise<{
  viewport: { width: number; height: number };
  off: FixtureResult;
  offSample: BrightnessSample;
  spotlight: FixtureResult;
  spotlightSample: BrightnessSample;
  offRepeat: FixtureResult;
  offRepeatSample: BrightnessSample;
}> {
  async function renderFixture(
    cinematicMode: 'off' | 'spotlight',
  ): Promise<{ fixture: FixtureResult; sample: BrightnessSample }> {
    const page = await browser.newPage({ viewport });

    try {
      await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
      await installVc3eFixture(page);

      const fixture = await page.evaluate(
        async input => window.__renderVc3SpotlightFogFixture(input),
        { cinematicMode, viewport },
      ) as FixtureResult;
      await page.locator('canvas').waitFor({ timeout: 5000 });
      const sample = await waitForBrightnessSample(page, fixture);
      return { fixture, sample };
    } finally {
      await page.close().catch(() => {});
    }
  }

  const { fixture: off, sample: offSample } = await renderFixture('off');
  const { fixture: spotlight, sample: spotlightSample } = await renderFixture('spotlight');
  const { fixture: offRepeat, sample: offRepeatSample } = await renderFixture('off');

  assert.equal(off.canvasReady, true, `${viewport.width}x${viewport.height} off fixture did not render canvas`);
  assert.equal(off.fogActive, false, 'off fixture must not attach fog');
  assert.equal(off.spotlightTargets.length, 0, 'off fixture must not emit event spotlights');
  assert.equal(spotlight.fogActive, true, 'spotlight fixture must attach fog');
  assert.deepEqual(
    spotlight.spotlightTargets.map(target => target.role).sort(),
    ['pending', 'serving'],
    'spotlight fixture must emit serving and pending lights',
  );

  const nonEventDrop = offSample.brightness.nonEvent - spotlightSample.brightness.nonEvent;
  const campusDrop = offSample.brightness.campus - spotlightSample.brightness.campus;
  const servingDelta = Math.abs(offSample.brightness.serving - spotlightSample.brightness.serving);
  const pendingDelta = Math.abs(offSample.brightness.pending - spotlightSample.brightness.pending);
  const offRepeatDelta = Math.max(
    Math.abs(offSample.brightness.serving - offRepeatSample.brightness.serving),
    Math.abs(offSample.brightness.pending - offRepeatSample.brightness.pending),
    Math.abs(offSample.brightness.nonEvent - offRepeatSample.brightness.nonEvent),
    Math.abs(offSample.brightness.campus - offRepeatSample.brightness.campus),
  );

  assert.ok(
    nonEventDrop >= 0.4,
    `${viewport.width}x${viewport.height} non-event brightness drop too small: ${nonEventDrop.toFixed(3)}`,
  );
  assert.ok(
    campusDrop >= 0.4,
    `${viewport.width}x${viewport.height} campus brightness drop too small: ${campusDrop.toFixed(3)}`,
  );
  assert.ok(
    servingDelta <= 0.05,
    `${viewport.width}x${viewport.height} serving brightness drift too high: ${servingDelta.toFixed(3)}`,
  );
  assert.ok(
    pendingDelta <= 0.05,
    `${viewport.width}x${viewport.height} pending brightness drift too high: ${pendingDelta.toFixed(3)}`,
  );
  assert.ok(
    offRepeatDelta <= 0.02,
    `${viewport.width}x${viewport.height} off-mode repeat drift too high: ${offRepeatDelta.toFixed(3)}`,
  );

  return {
    viewport,
    off,
    offSample,
    spotlight,
    spotlightSample,
    offRepeat,
    offRepeatSample,
  };
}

async function assertAppToggleAndUiContrast(
  browser: Browser,
  appUrl: string,
): Promise<{
  navigationEventsAfterToggle: number;
  checkboxStates: { initial: boolean; spotlight: boolean; off: boolean };
  contrastRatio: number;
  checkpointPath: string;
}> {
  await mkdir(dirname(CHECKPOINT_PATH), { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.addInitScript({
    content: `
      (() => {
        let state = 5303 >>> 0;
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

  let navigationEventsAfterToggle = 0;

  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('.leo-shell-right').waitFor({ timeout: 30000 });
    await page.locator('canvas').waitFor({ timeout: 30000 });
    await page.evaluate(() => document.fonts?.ready);

    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) navigationEventsAfterToggle += 1;
    });

    // Spotlight remains a global presentation control in the top row. It is
    // intentionally independent from the canonical input/result rails below.
    await page.locator('[data-testid="sinr-live-quick-controls"]').waitFor({ timeout: 5000 });
    const checkbox = page.getByRole('checkbox', { name: /Spotlight mode/i });
    const initial = await checkbox.isChecked();
    await checkbox.check();
    await page.waitForTimeout(320);
    const spotlight = await checkbox.isChecked();
    await checkbox.uncheck();
    await page.waitForTimeout(180);
    const off = await checkbox.isChecked();
    await checkbox.check();
    await page.waitForTimeout(900);
    await freezeRaf(page, 1900);
    await page.screenshot({ path: CHECKPOINT_PATH });

    assert.equal(initial, false, 'spotlight control must default to off');
    assert.equal(spotlight, true, 'spotlight control did not toggle on');
    assert.equal(off, false, 'spotlight control did not toggle back off');
    assert.equal(navigationEventsAfterToggle, 0, 'spotlight toggle must not navigate or reload the app');

    const contrastRatio = await page.evaluate<number>(`
      (() => {
        const element = document.querySelector('[data-testid="homepage-tle-scenario-disclosure"]');
        if (!(element instanceof HTMLElement)) {
          throw new Error('canonical homepage TLE scenario disclosure was not found');
        }

        function parseRgb(input) {
          const match = input.match(/rgba?\\(([^)]+)\\)/);
          if (!match) return { r: 255, g: 255, b: 255, a: 1 };
          const parts = match[1].split(',').map(part => Number.parseFloat(part.trim()));
          return {
            r: parts[0] ?? 255,
            g: parts[1] ?? 255,
            b: parts[2] ?? 255,
            a: parts[3] ?? 1,
          };
        }

        function linearize(value) {
          const normalized = value / 255;
          return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        }

        function luminance(rgb) {
          return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
        }

        const foreground = parseRgb(getComputedStyle(element).color);
        let background = { r: 2, g: 9, b: 18, a: 1 };
        let current = element;

        while (current) {
          const parsed = parseRgb(getComputedStyle(current).backgroundColor);
          if (parsed.a > 0.1) {
            background = parsed;
            break;
          }
          current = current.parentElement;
        }

        const fgLuminance = luminance(foreground);
        const bgLuminance = luminance(background);
        const lighter = Math.max(fgLuminance, bgLuminance);
        const darker = Math.min(fgLuminance, bgLuminance);
        return (lighter + 0.05) / (darker + 0.05);
      })()
    `);

    assert.ok(contrastRatio >= 4.5, `spotlight mode UI contrast below AA: ${contrastRatio.toFixed(2)}`);

    return {
      navigationEventsAfterToggle,
      checkboxStates: { initial, spotlight, off },
      contrastRatio,
      checkpointPath: CHECKPOINT_PATH,
    };
  } finally {
    await context.close().catch(() => {});
  }
}

async function main(): Promise<void> {
  assertInvariantSurface();

  const appUrl = await detectAppUrl();
  const browser = await chromium.launch();
  let fixtureResults: Array<Awaited<ReturnType<typeof assertFixtureViewport>>>;
  let appToggle: Awaited<ReturnType<typeof assertAppToggleAndUiContrast>>;

  try {
    fixtureResults = [
      await assertFixtureViewport(browser, appUrl, { width: 1440, height: 900 }),
      await assertFixtureViewport(browser, appUrl, { width: 1366, height: 768 }),
    ];
    appToggle = await assertAppToggleAndUiContrast(browser, appUrl);
  } finally {
    await browser.close();
  }

  console.log('Visual Clarity Phase 3E spotlight-fog validation passed.');
  console.log(JSON.stringify({
    v1: {
      defaultOff: 'passed',
      presentationOnlyRuntimeGate: 'passed',
      nonEventConeOpacityMultiplier: CINEMATIC_NON_EVENT_CONE_OPACITY_MULTIPLIER,
      tokenMutationCheck: 'passed',
      spotlightTargetSelection: 'passed',
    },
    v3: {
      appUrl,
      fixtureResults,
      appToggle,
    },
    result: 'PASS',
  }, null, 2));
}

void runBrowserValidator(
  {
    validator: 'validate-vc3e-spotlight-fog',
    appUrl: process.env.APP_URL ?? process.argv[2],
    floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.quickCanvas,
  },
  async () => main(),
).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
