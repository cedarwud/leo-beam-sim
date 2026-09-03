/**
 * Record the global constellation directed flow at the classroom master size.
 * The WebM includes the real scene-local NTPU reveal action and holds the last
 * beat for more than six seconds so a lecturer can pause on the synthesis.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';

import {
  GLOBAL_CONSTELLATION_BEATS,
  GLOBAL_CONSTELLATION_ROUTE,
} from '../src/prototype/global-constellation/globalConstellationDirector.ts';
import {
  GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD,
  GLOBAL_CONSTELLATION_CAMERA_SETTLE_REQUIRED_FRAMES,
  GLOBAL_CONSTELLATION_STABLE_HOLD_MS,
} from '../src/prototype/global-constellation/globalConstellationCamera.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const WIDTH = 1920;
const HEIGHT = 1080;
const OUTPUT_DIR = join(process.cwd(), 'output/playwright/global-constellation');
const OUTPUT_PATH = join(OUTPUT_DIR, 'global-constellation-1920-final.webm');
const MANIFEST_PATH = join(OUTPUT_DIR, 'global-constellation-1920-final.manifest.json');

interface CapturedBeat {
  readonly beat: string;
  readonly screenshot: string;
  readonly elapsedMs: number;
}

interface FinaleStabilityEvidence {
  readonly cameraSettledElapsedMs: number;
  readonly positionErrorWorld: number;
  readonly targetErrorWorld: number;
  readonly settledFrames: number;
  readonly stableHoldRequiredMs: number;
  readonly stableHoldMeasuredAfterBoundaryMs: number;
  readonly stableHoldWaitMeasuredMs: number;
}

async function waitForBeat(page: Page, beatId: string, timeout = 50_000): Promise<void> {
  await page.waitForFunction(
    expected => document.querySelector('main')?.getAttribute('data-beat') === expected
      && document.querySelector('main')?.getAttribute('data-artifacts-ready') === 'true',
    beatId,
    { timeout },
  );
}

async function waitForCameraSettled(page: Page): Promise<Readonly<{
  readonly positionErrorWorld: number;
  readonly targetErrorWorld: number;
  readonly settledFrames: number;
}>> {
  await page.waitForFunction(
    ({ threshold, requiredFrames }) => {
      const main = document.querySelector('main');
      const positionError = Number(main?.getAttribute('data-camera-position-error'));
      const targetError = Number(main?.getAttribute('data-camera-target-error'));
      const settledFrames = Number(main?.getAttribute('data-camera-settled-frames'));
      return main?.getAttribute('data-camera-settled') === 'true'
        && Number.isFinite(positionError)
        && Number.isFinite(targetError)
        && positionError <= threshold
        && targetError <= threshold
        && settledFrames >= requiredFrames;
    },
    {
      threshold: GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD,
      requiredFrames: GLOBAL_CONSTELLATION_CAMERA_SETTLE_REQUIRED_FRAMES,
    },
    { timeout: 15_000 },
  );
  const telemetry = await page.locator('main').evaluate(main => ({
    positionErrorWorld: Number(main?.getAttribute('data-camera-position-error')),
    targetErrorWorld: Number(main?.getAttribute('data-camera-target-error')),
    settledFrames: Number(main?.getAttribute('data-camera-settled-frames')),
  }));
  assert.ok(telemetry.positionErrorWorld <= GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD);
  assert.ok(telemetry.targetErrorWorld <= GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD);
  assert.ok(telemetry.settledFrames >= GLOBAL_CONSTELLATION_CAMERA_SETTLE_REQUIRED_FRAMES);
  return telemetry;
}

async function captureBeat(page: Page, beat: string, startedAt: number, captures: CapturedBeat[]): Promise<void> {
  const screenshot = join(OUTPUT_DIR, `beat-${String(captures.length + 1).padStart(2, '0')}-${beat}.png`);
  await page.screenshot({ path: screenshot });
  captures.push({ beat, screenshot, elapsedMs: Date.now() - startedAt });
}

async function assertFinaleBridge(page: Page): Promise<void> {
  assert.equal(await page.locator('main').getAttribute('data-camera-pose'), 'finale');
  assert.equal(await page.locator('main').getAttribute('data-focus-target'), 'ntpu-local');
  assert.equal(await page.locator('main').getAttribute('data-focus-reticle'), 'visible');
  assert.equal(await page.locator('main').getAttribute('data-finale-link-result'), 'none');
  assert.equal(await page.locator('main').getAttribute('data-final-motion'), 'frozen');
  const bridge = page.locator('[data-final-bridge-copy="true"]');
  assert.equal(await bridge.count(), 1, 'recorder sees one finale bridge copy');
  assert.equal(await bridge.locator(':scope > span').count(), 2, 'recorder sees two finale bridge lines');
  assert.match(await bridge.innerText(), /下一幕才把視野縮到一條地面—衛星鏈路/);
  assert.match(await bridge.innerText(), /先分清仰角與離軸角，再看它們怎麼進入換手判斷/);
  assert.equal(await page.getByRole('link', { name: '下一幕：鏈路角度' }).getAttribute('href'), '/prototype/visual-first-golden-flow');
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const captures: CapturedBeat[] = [];
  const startedAt = Date.now();
  let browser: Browser | null = null;
  let page: Page | null = null;
  let videoPath: string | null = null;
  let finaleStability: FinaleStabilityEvidence | null = null;

  try {
    browser = await chromium.launch({
      ...(existsSync(process.env.CHROME_BIN ?? '/opt/google/chrome/chrome')
        ? { executablePath: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome' }
        : { channel: 'chrome' as const }),
      // Keep recording deterministic in WSL/headless Chrome; Playwright's
      // unsafe SwiftShader fallback still paints the Three.js canvas.
      args: ['--disable-crash-reporter', '--disable-breakpad', '--disable-gpu'],
    });
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      recordVideo: { dir: OUTPUT_DIR, size: { width: WIDTH, height: HEIGHT } },
    });
    page = await context.newPage();
    const video = page.video();
    await page.goto(new URL(GLOBAL_CONSTELLATION_ROUTE, appUrl).toString(), { waitUntil: 'domcontentloaded' });

    for (const beat of GLOBAL_CONSTELLATION_BEATS) {
      await waitForBeat(page, beat.id);
      const finaleSettled = beat.id === 'stable-finale' ? await waitForCameraSettled(page) : null;
      const finaleSettledAtRecorderMs = finaleSettled ? Date.now() - startedAt : null;
      if (beat.id === 'stable-finale') await assertFinaleBridge(page);
      // Let the camera/director and point cloud settle before each handoff still.
      await page.waitForTimeout(500);
      await captureBeat(page, beat.id, startedAt, captures);
      if (beat.id === 'ntpu-reveal') {
        const button = page.getByTestId('global-constellation-reveal');
        await button.click();
        await waitForBeat(page, 'starlink-visible');
      }
      if (beat.id === 'stable-finale') {
        const holdWaitStartedAt = Date.now();
        await page.waitForTimeout(GLOBAL_CONSTELLATION_STABLE_HOLD_MS);
        const stableHoldWaitMeasuredMs = Date.now() - holdWaitStartedAt;
        const stableHoldMeasuredAfterBoundaryMs = Date.now() - startedAt - (finaleSettledAtRecorderMs ?? 0);
        assert.ok(stableHoldWaitMeasuredMs >= GLOBAL_CONSTELLATION_STABLE_HOLD_MS, 'stable hold wait is measured after camera settlement');
        assert.equal(await page.locator('main').getAttribute('data-beat'), 'stable-finale');
        assert.equal(await page.locator('main').getAttribute('data-camera-settled'), 'true');
        assert.equal(await page.locator('main').getAttribute('data-final-motion'), 'frozen');
        const finaleBeatCounter = page.getByTestId('global-constellation-beat-counter');
        assert.equal(await finaleBeatCounter.getAttribute('data-beat-counter-index'), '9', 'recorder sees the truthful ninth-beat counter');
        assert.equal(await finaleBeatCounter.getAttribute('data-beat-counter-total'), '9', 'recorder sees the nine-beat total');
        assert.equal(await finaleBeatCounter.locator('strong').innerText(), '09 / 09', 'recorder sees the rendered finale counter');
        finaleStability = {
          cameraSettledElapsedMs: finaleSettledAtRecorderMs ?? 0,
          positionErrorWorld: finaleSettled?.positionErrorWorld ?? Number.NaN,
          targetErrorWorld: finaleSettled?.targetErrorWorld ?? Number.NaN,
          settledFrames: finaleSettled?.settledFrames ?? 0,
          stableHoldRequiredMs: GLOBAL_CONSTELLATION_STABLE_HOLD_MS,
          stableHoldMeasuredAfterBoundaryMs,
          stableHoldWaitMeasuredMs,
        };
      }
    }

    await page.close();
    videoPath = video ? await video.path() : null;
    await context.close();
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => undefined);
    if (browser) await browser.close();
  }

  assert.ok(videoPath, 'Playwright did not produce a WebM recording');
  assert.ok(finaleStability, 'recorder captured a measured camera-settled finale boundary');
  renameSync(videoPath, OUTPUT_PATH);
  writeFileSync(MANIFEST_PATH, JSON.stringify({
    route: GLOBAL_CONSTELLATION_ROUTE,
    viewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 },
    truthMode: '固定 2026-08-25 archived TLE / SGP4 artifact；非 live count',
    beatCount: GLOBAL_CONSTELLATION_BEATS.length,
    nominalDurationSec: GLOBAL_CONSTELLATION_BEATS.reduce((sum, beat) => sum + beat.durationSec, 0),
    stableFinaleSec: GLOBAL_CONSTELLATION_STABLE_HOLD_MS / 1000,
    cameraSettlement: {
      boundary: 'data-camera-settled=true after camera position/target errors stay within threshold for required consecutive frames',
      thresholdWorld: GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD,
      requiredFrames: GLOBAL_CONSTELLATION_CAMERA_SETTLE_REQUIRED_FRAMES,
      elapsedMs: finaleStability?.cameraSettledElapsedMs,
      positionErrorWorld: finaleStability?.positionErrorWorld,
      targetErrorWorld: finaleStability?.targetErrorWorld,
      settledFrames: finaleStability?.settledFrames,
    },
    stableHold: {
      requiredMs: finaleStability?.stableHoldRequiredMs,
      measuredAfterBoundaryMs: finaleStability?.stableHoldMeasuredAfterBoundaryMs,
      waitMeasuredMs: finaleStability?.stableHoldWaitMeasuredMs,
      verified: (finaleStability?.stableHoldWaitMeasuredMs ?? 0) >= GLOBAL_CONSTELLATION_STABLE_HOLD_MS,
    },
    video: OUTPUT_PATH,
    screenshots: captures,
  }, null, 2));
  console.log(`[global-constellation-record] PASS — ${OUTPUT_PATH}`);
  console.log(`[global-constellation-record] SCREENSHOTS — ${captures.length} beat frames; manifest ${MANIFEST_PATH}`);
}

main().catch(error => {
  console.error('[global-constellation-record] FAILED:', error instanceof Error ? error.message : error);
  process.exit(1);
});
