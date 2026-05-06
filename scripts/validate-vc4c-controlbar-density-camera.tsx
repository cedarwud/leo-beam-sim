import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import type { BeamDensity, CameraPreset } from '../src/scene/types.ts';
import { UI_MODE_STORAGE_KEY, type UiMode } from '../src/ui/uiMode.ts';
import { REDUCED_MOTION_QUERY } from '../src/scene/runtimeConfig.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';
import { freezeRaf } from './_v3-deterministic-fixture.ts';

const CHECKPOINT_PATH = fileURLToPath(
  new URL('../docs/visual-clarity-proposal/manual-checkpoints/vc4c-post-slice-controlbar-density-camera-1440x900.png', import.meta.url),
);

type DensityLabel = 'few' | 'normal' | 'many';

interface BrowserVector {
  x: number;
  y: number;
  z: number;
}

interface CameraTelemetry {
  preset: string;
  transition: string;
  position: BrowserVector;
  target: BrowserVector;
}

interface DensityResult {
  defaultLabel: DensityLabel;
  counts: Record<DensityLabel, number>;
  modeResetLabels: {
    tuning: DensityLabel;
    diagnostics: DensityLabel;
    presentation: DensityLabel;
  };
}

interface CameraResult {
  preset: CameraPreset;
  telemetry: CameraTelemetry;
  screenshotBytes: number;
}

const DENSITY_BY_LABEL: Record<DensityLabel, BeamDensity> = {
  few: 'event-only',
  normal: 'event-plus-1',
  many: 'all',
};

const CAMERA_POSES: Record<CameraPreset, {
  position: BrowserVector;
  target: BrowserVector;
}> = {
  zenith: {
    position: { x: 0, y: 980, z: 1 },
    target: { x: 0, y: 0, z: 0 },
  },
  oblique: {
    position: { x: 0, y: 600, z: 750 },
    target: { x: 0, y: 0, z: 0 },
  },
  chase: {
    position: { x: 520, y: 260, z: -620 },
    target: { x: 0, y: 20, z: 0 },
  },
};

function buildInitScript(reducedMotion: boolean): string {
  return `
    (() => {
      window.localStorage.setItem(${JSON.stringify(UI_MODE_STORAGE_KEY)}, 'presentation');
      let state = 4403 >>> 0;
      Math.random = () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
      };

      if (${JSON.stringify(reducedMotion)}) {
        const originalMatchMedia = window.matchMedia?.bind(window);
        window.matchMedia = query => {
          if (query !== ${JSON.stringify(REDUCED_MOTION_QUERY)}) {
            return originalMatchMedia
              ? originalMatchMedia(query)
              : {
                matches: false,
                media: query,
                onchange: null,
                addListener() {},
                removeListener() {},
                addEventListener() {},
                removeEventListener() {},
                dispatchEvent() { return false; },
              };
          }

          return {
            matches: true,
            media: query,
            onchange: null,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() { return false; },
          };
        };
      }
    })();
  `;
}

function parseVector(value: string | undefined, label: string): BrowserVector {
  assert.ok(value, `${label} camera vector was missing`);
  const [x, y, z] = value.split(',').map(part => Number.parseFloat(part));
  assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z), `${label} camera vector was invalid: ${value}`);
  return { x, y, z };
}

function assertVectorClose(actual: BrowserVector, expected: BrowserVector, tolerance: number, label: string): void {
  for (const axis of ['x', 'y', 'z'] as const) {
    assert.ok(
      Math.abs(actual[axis] - expected[axis]) <= tolerance,
      `${label}.${axis} expected ${expected[axis]} +/- ${tolerance}, got ${actual[axis]}`,
    );
  }
}

async function bootAppPage(
  browser: Browser,
  appUrl: string,
  opts: { reducedMotion?: boolean } = {},
): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript({ content: buildInitScript(opts.reducedMotion ?? false) });
  const page = await context.newPage();

  try {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('.leo-app-shell[data-ui-mode="presentation"]').waitFor({ timeout: 30000 });
    await page.locator('.leo-shell-canvas canvas').waitFor({ timeout: 30000 });
    await page.locator('[data-testid="beam-density-control"]').waitFor({ timeout: 5000 });
    await page.locator('[data-testid="camera-preset-control"]').waitFor({ timeout: 5000 });
    await page.locator('[data-testid="beam-hop-status-pill"]').waitFor({ timeout: 5000 });
    return page;
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
}

async function waitForNextFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
}

async function activeDensityLabel(page: Page): Promise<DensityLabel> {
  for (const label of Object.keys(DENSITY_BY_LABEL) as DensityLabel[]) {
    const pressed = await page.locator(`[data-testid="beam-density-${label}"]`).getAttribute('aria-pressed');
    if (pressed === 'true') return label;
  }

  throw new Error('No beam-density segment was active');
}

async function countBeamCallouts(page: Page): Promise<number> {
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="beam-callout"]').length > 0, undefined, { timeout: 30000 });
  return page.locator('[data-testid="beam-callout"]').count();
}

async function selectDensity(page: Page, label: DensityLabel): Promise<number> {
  await page.locator(`[data-testid="beam-density-${label}"]`).click();
  await waitForNextFrame(page);
  assert.equal(await activeDensityLabel(page), label, `${label} density segment did not become active`);
  return countBeamCallouts(page);
}

async function waitForCalloutCountChange(page: Page, previousCount: number): Promise<number> {
  await page.waitForFunction(
    count => document.querySelectorAll('[data-testid="beam-callout"]').length !== count,
    previousCount,
    { timeout: 4000 },
  );
  return countBeamCallouts(page);
}

async function selectUiMode(page: Page, mode: UiMode): Promise<void> {
  await page.locator('select[aria-label="UI mode"]').selectOption(mode);
  await page.locator(`.leo-app-shell[data-ui-mode="${mode}"]`).waitFor({ timeout: 5000 });
  await waitForNextFrame(page);
}

async function assertDensityControls(page: Page): Promise<DensityResult> {
  const defaultLabel = await activeDensityLabel(page);
  assert.equal(defaultLabel, 'normal', 'presentation mode should default the density control to normal');
  assert.equal(DENSITY_BY_LABEL[defaultLabel], 'event-plus-1');

  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="beam-callout"]').length >= 2,
    undefined,
    { timeout: 15000 },
  );
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Play' }).waitFor({ timeout: 5000 });
  await waitForNextFrame(page);

  const normalCount = await countBeamCallouts(page);
  await page.locator('[data-testid="beam-density-few"]').click();
  const fewCount = await waitForCalloutCountChange(page, normalCount);
  assert.equal(await activeDensityLabel(page), 'few', 'few density segment did not become active');
  assert.ok(fewCount < normalCount, `few density should reduce callouts from normal: ${JSON.stringify({ fewCount, normalCount })}`);

  await page.locator('[data-testid="beam-density-many"]').click();
  const manyCount = await waitForCalloutCountChange(page, fewCount);
  assert.equal(await activeDensityLabel(page), 'many', 'many density segment did not become active');
  assert.ok(manyCount > fewCount, `many density should increase callouts from few: ${JSON.stringify({ fewCount, manyCount })}`);

  await selectUiMode(page, 'tuning');
  const tuning = await activeDensityLabel(page);
  assert.equal(tuning, 'many', 'tuning mode should reset density to many');

  await selectDensity(page, 'few');
  await selectUiMode(page, 'diagnostics');
  const diagnostics = await activeDensityLabel(page);
  assert.equal(diagnostics, 'many', 'diagnostics mode should reset density to many');

  await selectDensity(page, 'few');
  await selectUiMode(page, 'presentation');
  const presentation = await activeDensityLabel(page);
  assert.equal(presentation, 'normal', 'presentation mode should reset density override to normal');

  const bhText = (await page.locator('[data-testid="beam-hop-status-pill"]').innerText()).replace(/\s+/g, ' ').trim();
  assert.match(bhText, /^BH (S\d+|OFF)$/, `BH pill did not expose beam-hop status: ${bhText}`);

  return {
    defaultLabel,
    counts: {
      few: fewCount,
      normal: normalCount,
      many: manyCount,
    },
    modeResetLabels: {
      tuning,
      diagnostics,
      presentation,
    },
  };
}

async function readCameraTelemetry(page: Page): Promise<CameraTelemetry> {
  return page.evaluate(() => {
    const canvas = document.querySelector('.leo-shell-canvas canvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('canvas missing for camera telemetry');
    const position = canvas.dataset.cameraPosition;
    const target = canvas.dataset.cameraTarget;
    return {
      preset: canvas.dataset.cameraPreset ?? '',
      transition: canvas.dataset.cameraTransition ?? '',
      position,
      target,
    };
  }).then(raw => ({
    preset: raw.preset,
    transition: raw.transition,
    position: parseVector(raw.position, 'position'),
    target: parseVector(raw.target, 'target'),
  }));
}

async function waitForCameraPreset(page: Page, preset: CameraPreset): Promise<CameraTelemetry> {
  await page.locator(`[data-testid="camera-preset-${preset}"]`).click();
  await page.waitForFunction(
    expectedPreset => {
      const canvas = document.querySelector('.leo-shell-canvas canvas');
      if (!(canvas instanceof HTMLCanvasElement)) return false;
      return canvas.dataset.cameraPreset === expectedPreset
        && canvas.dataset.cameraTransition === 'idle';
    },
    preset,
    { timeout: 2200 },
  );

  const telemetry = await readCameraTelemetry(page);
  assert.equal(telemetry.preset, preset, `${preset} camera telemetry reported wrong preset`);
  assert.equal(telemetry.transition, 'idle', `${preset} camera telemetry did not settle`);
  assertVectorClose(telemetry.position, CAMERA_POSES[preset].position, 3, `${preset} camera position`);
  assertVectorClose(telemetry.target, CAMERA_POSES[preset].target, 2, `${preset} camera target`);
  return telemetry;
}

async function assertCameraControls(page: Page): Promise<CameraResult[]> {
  const results: CameraResult[] = [];

  for (const preset of ['zenith', 'oblique', 'chase'] as CameraPreset[]) {
    const telemetry = await waitForCameraPreset(page, preset);
    const screenshot = await page.locator('.leo-shell-canvas canvas').screenshot();
    assert.ok(screenshot.length > 5000, `${preset} camera screenshot looked blank: ${screenshot.length} bytes`);
    results.push({
      preset,
      telemetry,
      screenshotBytes: screenshot.length,
    });
  }

  await mkdir(dirname(CHECKPOINT_PATH), { recursive: true });
  await freezeRaf(page, 2600);
  await page.screenshot({ path: CHECKPOINT_PATH, fullPage: true });
  return results;
}

async function assertReducedMotionSnap(
  browser: Browser,
  appUrl: string,
): Promise<CameraTelemetry> {
  const page = await bootAppPage(browser, appUrl, { reducedMotion: true });

  try {
    await page.locator('[data-testid="camera-preset-zenith"]').click();
    await waitForNextFrame(page);
    const telemetry = await readCameraTelemetry(page);

    assert.equal(telemetry.preset, 'zenith', 'reduced-motion camera command did not apply zenith preset');
    assert.equal(telemetry.transition, 'idle', 'reduced-motion camera command should not animate');
    assertVectorClose(telemetry.position, CAMERA_POSES.zenith.position, 3, 'reduced-motion zenith camera position');
    assertVectorClose(telemetry.target, CAMERA_POSES.zenith.target, 2, 'reduced-motion zenith camera target');
    return telemetry;
  } finally {
    await page.context().close().catch(() => {});
  }
}

async function main(): Promise<void> {
  const appUrl = await detectAppUrl();
  const browser = await chromium.launch();
  let density: DensityResult;
  let camera: CameraResult[];
  let reducedMotion: CameraTelemetry;

  try {
    const page = await bootAppPage(browser, appUrl);
    try {
      density = await assertDensityControls(page);
      camera = await assertCameraControls(page);
    } finally {
      await page.context().close().catch(() => {});
    }

    reducedMotion = await assertReducedMotionSnap(browser, appUrl);
  } finally {
    await browser.close();
  }

  console.log('Visual Clarity Phase 4C controlbar-density-camera validation passed.');
  console.log(JSON.stringify({
    appUrl,
    density,
    camera,
    reducedMotion,
    manualScreenshotCheckpoint: CHECKPOINT_PATH,
    result: 'PASS',
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
