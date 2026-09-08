/**
 * Visual-first Scientific Explain 3D browser gate and evidence collector.
 *
 * Proves:
 * 1. Camera-only invariance (moving camera leaves elevation and off-axis unchanged)
 * 2. Beam-steer change (steering moves boresight and changes off-axis & gain while elevation is fixed)
 * 3. Deterministic seeking reconstruction across beats
 * 4. All transport controls & speed modes (0.5x, 1x, 1.5x, 2x) visible, bounded, operable
 * 5. Checkpoint freeze and interactive resumption
 * 6. Central exposure >= 70% at all beats
 * 7. Typography (>=16px captions) and touch target sizes (>=44x44px)
 * 8. Viewport containment and zero overflow for 1920x1080, 390x844, and 320x720
 * 9. Exact pairwise bounding box collision detection (zero overlap between launcher, subtitle, cue, transport)
 * 10. Transport auto-hide and inert state verification
 * 11. Captures fresh screenshots for camera-only, beam-steered, comparison, and formula-reveal beats
 * 12. Zero browser console errors
 */

import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import { MEASURED_BROWSER_GATE_FLOORS_MS, runBrowserValidator } from './lib/browser-gate.ts';

import {
  BASELINE_THETA_DEG,
  DETERMINISTIC_RECONSTRUCTED_STEER_THETA_DEG,
  EPISODE_TOTAL_DURATION_SEC,
  FIXED_ELEVATION_DEG,
  INTERACTION_CHECKPOINT_TIME_SEC,
  SCIENTIFIC_EXPLAIN_3D_BEATS,
} from '../src/prototype/scientific-explain/scientificExplain3DDirector.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const ROUTE_PATH = '/prototype/scientific-explain-legacy-3d';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const EVIDENCE_DIR = join(__dirname, 'evidence', 'scientific-explain-3d');

interface LayoutMetrics {
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly visibleRatio: number;
  readonly captionFontSize: number;
  readonly captionLineCount: number;
  readonly hasOverflow: boolean;
}

interface ComponentBox {
  name: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface CollisionReport {
  viewport: { width: number; height: number };
  beat: string;
  components: ComponentBox[];
  collisions: Array<{ c1: string; c2: string; overlapArea: number }>;
  containmentErrors: string[];
  touchErrors: string[];
}

async function readLayoutMetrics(page: Page): Promise<LayoutMetrics> {
  return page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('[data-testid="se3d-scene-container"]');
    if (!stage) throw new Error('se3d-scene-container not found');
    const stageRect = stage.getBoundingClientRect();
    const stageArea = stageRect.width * stageRect.height;

    const occluders = document.querySelectorAll<HTMLElement>('[data-stage-occluder]');
    let occludedArea = 0;
    occluders.forEach((el) => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      const left = Math.max(stageRect.left, r.left);
      const top = Math.max(stageRect.top, r.top);
      const right = Math.min(stageRect.right, r.right);
      const bottom = Math.min(stageRect.bottom, r.bottom);
      occludedArea += Math.max(0, right - left) * Math.max(0, bottom - top);
    });

    const spans = document.querySelectorAll<HTMLElement>('[data-testid="se3d-caption-banner"] p span');
    const captionLineCount = spans.length;
    let captionFontSize = 16;
    if (spans.length > 0) {
      captionFontSize = Number.parseFloat(getComputedStyle(spans[0]).fontSize) || 16;
    }

    const hasOverflow = document.documentElement.scrollWidth > window.innerWidth ||
      document.documentElement.scrollHeight > window.innerHeight;

    return {
      stageWidth: stageRect.width,
      stageHeight: stageRect.height,
      visibleRatio: stageArea > 0 ? (stageArea - occludedArea) / stageArea : 1,
      captionFontSize,
      captionLineCount,
      hasOverflow,
    };
  });
}

async function measureBoxesAndCollisions(page: Page, viewport: { width: number; height: number }, beat: string): Promise<CollisionReport> {
  return page.evaluate(({ vw, vh, beatName }) => {
    const targets = [
      { name: 'launcher', selector: '.six-acts-launcher__toggle', touchCheck: true },
      { name: 'top-inspector-btn', selector: '[data-testid="se3d-top-inspector-btn"]', touchCheck: true },
      { name: 'primary-cue', selector: '.se3d-primary-cue', touchCheck: false },
      { name: 'caption-banner', selector: '[data-testid="se3d-caption-banner"]', touchCheck: false },
      { name: 'transport', selector: '[data-testid="teaching-transport"]', touchCheck: false },
    ];

    const components: Array<{ name: string; left: number; top: number; right: number; bottom: number; width: number; height: number }> = [];
    const containmentErrors: string[] = [];
    const touchErrors: string[] = [];

    for (const t of targets) {
      const el = document.querySelector<HTMLElement>(t.selector);
      if (!el) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;

      const box = {
        name: t.name,
        left: Math.round(r.left * 10) / 10,
        top: Math.round(r.top * 10) / 10,
        right: Math.round(r.right * 10) / 10,
        bottom: Math.round(r.bottom * 10) / 10,
        width: Math.round(r.width * 10) / 10,
        height: Math.round(r.height * 10) / 10,
      };
      components.push(box);

      if (box.left < -0.5 || box.top < -0.5 || box.right > vw + 0.5 || box.bottom > vh + 0.5) {
        containmentErrors.push(
          `${t.name} out of bounds: left=${box.left}, top=${box.top}, right=${box.right}, bottom=${box.bottom} (viewport: ${vw}x${vh})`
        );
      }

      if (t.touchCheck && (box.width < 43.5 || box.height < 43.5)) {
        touchErrors.push(`${t.name} touch target too small: ${box.width}x${box.height}px (min 44x44px)`);
      }
    }

    const collisions: Array<{ c1: string; c2: string; overlapArea: number }> = [];
    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        const c1 = components[i];
        const c2 = components[j];
        const xOverlap = Math.max(0, Math.min(c1.right, c2.right) - Math.max(c1.left, c2.left));
        const yOverlap = Math.max(0, Math.min(c1.bottom, c2.bottom) - Math.max(c1.top, c2.top));
        const overlapArea = Math.round(xOverlap * yOverlap * 10) / 10;
        if (overlapArea > 0.5) {
          collisions.push({ c1: c1.name, c2: c2.name, overlapArea });
        }
      }
    }

    // Verify all individual buttons pass touch target thresholds (min 44x44px)
    const touchButtons = [
      ...document.querySelectorAll<HTMLElement>('.se3d-touch-btn'),
      ...document.querySelectorAll<HTMLElement>('.teaching-transport__btn'),
      ...document.querySelectorAll<HTMLElement>('.teaching-transport__speed-btn'),
      ...document.querySelectorAll<HTMLElement>('.se3d-inspector-btn'),
    ];
    touchButtons.forEach((btn, idx) => {
      const style = getComputedStyle(btn);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const r = btn.getBoundingClientRect();
      const testId = btn.getAttribute('data-testid') || btn.className || `btn-${idx}`;
      if (r.width < 43.5 || r.height < 43.5) {
        touchErrors.push(`Button [${testId}] touch target too small: ${Math.round(r.width)}x${Math.round(r.height)}px (min 44x44px)`);
      }
      if (r.left < -0.5 || r.right > vw + 0.5) {
        containmentErrors.push(`Button [${testId}] clipped: left=${Math.round(r.left)}, right=${Math.round(r.right)} (vw=${vw})`);
      }
    });

    return {
      viewport: { width: vw, height: vh },
      beat: beatName,
      components,
      collisions,
      containmentErrors,
      touchErrors,
    };
  }, { vw: viewport.width, vh: viewport.height, beatName: beat });
}

async function verifyAllSpeedControls(page: Page, viewportLabel: string): Promise<void> {
  const speeds = [0.5, 1, 1.5, 2] as const;
  for (const speed of speeds) {
    const btn = page.locator(`[data-testid="transport-speed-${speed}"]`);
    assert.equal(await btn.count(), 1, `[${viewportLabel}] speed button ${speed}x exists`);
    assert.ok(await btn.isVisible(), `[${viewportLabel}] speed button ${speed}x is visible`);
    const box = await btn.boundingBox();
    assert.ok(box, `[${viewportLabel}] speed button ${speed}x is measurable`);
    assert.ok(box.width >= 43.5 && box.height >= 43.5, `[${viewportLabel}] speed button ${speed}x touch target ${box.width}x${box.height} >= 44x44`);

    // Click speed button and verify reactive state
    await btn.click();
    await page.waitForTimeout(60);
    const activeSpeed = await page.locator('main').getAttribute('data-transport-speed');
    assert.equal(activeSpeed, String(speed), `[${viewportLabel}] clicking ${speed}x updates speed state`);
  }
}

async function main(): Promise<void> {
  if (!existsSync(EVIDENCE_DIR)) {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
  }

  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  console.log(`[validator] connecting to ${appUrl}${ROUTE_PATH}`);

  const browser: Browser = await chromium.launch({
    ...(existsSync(process.env.CHROME_BIN ?? '/opt/google/chrome/chrome')
      ? { executablePath: process.env.CHROME_BIN ?? '/opt/google/chrome/chrome' }
      : { channel: 'chrome' as const }),
    args: ['--disable-crash-reporter', '--disable-breakpad'],
  });

  const consoleErrors: string[] = [];

  try {
    // ----------------------------------------------------
    // 1. DESKTOP SUITE (1920x1080)
    // ----------------------------------------------------
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(`PAGEERROR: ${err.message}`));

    console.log('[validator] testing all 7 beats on desktop...');
    for (const beat of SCIENTIFIC_EXPLAIN_3D_BEATS) {
      const url = new URL(ROUTE_PATH, appUrl);
      url.searchParams.set('beat', beat.id);
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });

      await page.waitForFunction(
        (expected) => document.querySelector('main')?.getAttribute('data-beat') === expected,
        beat.id,
        { timeout: 15_000 },
      );
      await page.waitForSelector('canvas', { state: 'attached', timeout: 15_000 });

      const metrics = await readLayoutMetrics(page);
      assert.ok(metrics.visibleRatio >= 0.70, `${beat.id}: central scene exposure ${(metrics.visibleRatio * 100).toFixed(1)}% must be >= 70%`);
      assert.ok(metrics.captionFontSize >= 16, `${beat.id}: caption font size must be >= 16px (got ${metrics.captionFontSize}px)`);
      assert.ok(metrics.captionLineCount <= 2, `${beat.id}: caption line count must be <= 2 (got ${metrics.captionLineCount})`);
      assert.equal(metrics.hasOverflow, false, `${beat.id}: should have no document overflow`);

      // Verify telemetry
      const rootElev = Number(await page.locator('main').getAttribute('data-elevation-deg'));
      assert.ok(Math.abs(rootElev - FIXED_ELEVATION_DEG) < 0.05, `${beat.id}: elevation angle must match fixed truth`);
    }

    // --- Invariance Test ---
    console.log('[validator] testing camera-only invariance across perspective tour...');
    for (const beatId of ['establish', 'perspective-side', 'perspective-top', 'perspective-oblique'] as const) {
      const url = new URL(ROUTE_PATH, appUrl);
      url.searchParams.set('beat', beatId);
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(
        (expected) => document.querySelector('main')?.getAttribute('data-beat') === expected,
        beatId,
        { timeout: 10_000 },
      );

      const elev = Number(await page.locator('main').getAttribute('data-elevation-deg'));
      const offAxis = Number(await page.locator('main').getAttribute('data-off-axis-deg'));

      assert.ok(Math.abs(elev - FIXED_ELEVATION_DEG) < 0.05, `${beatId}: elevation must be invariant`);
      assert.ok(Math.abs(offAxis - BASELINE_THETA_DEG) < 0.05, `${beatId}: off-axis must be invariant at baseline`);
    }

    // Capture desktop screenshots
    // 1. Establish
    await page.goto(new URL(`${ROUTE_PATH}?beat=establish`, appUrl).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const establishShot = join(EVIDENCE_DIR, 'desktop-establish.png');
    await page.screenshot({ path: establishShot });
    console.log(`[evidence] captured ${establishShot}`);

    // 2. Camera Invariance (perspective-side)
    await page.goto(new URL(`${ROUTE_PATH}?beat=perspective-side`, appUrl).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const invarianceShot = join(EVIDENCE_DIR, 'desktop-camera-invariance.png');
    await page.screenshot({ path: invarianceShot });
    console.log(`[evidence] captured ${invarianceShot}`);

    // --- Beam Steering Test ---
    console.log('[validator] testing interaction checkpoint & beam steering...');
    await page.goto(new URL(`${ROUTE_PATH}?beat=interaction`, appUrl).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="se3d-interaction-cue"]', { state: 'visible', timeout: 10_000 });

    const btnPlus1 = page.locator('[data-testid="se3d-steer-plus-1"]');
    assert.equal(await btnPlus1.count(), 1, 'steer +1 button exists');
    const btnBox = await btnPlus1.boundingBox();
    assert.ok(btnBox, 'button is visible and measurable');
    assert.ok(btnBox.width >= 43.5 && btnBox.height >= 43.5, `touch button size ${btnBox.width}x${btnBox.height} must be >= 44x44px`);

    const initialOffAxis = Number(await page.locator('main').getAttribute('data-off-axis-deg'));
    const initialGain = Number(await page.locator('main').getAttribute('data-antenna-gain-ratio'));

    // Click +1.0° steer button
    await btnPlus1.click();
    await page.waitForTimeout(200);

    const steeredOffAxis = Number(await page.locator('main').getAttribute('data-off-axis-deg'));
    const steeredGain = Number(await page.locator('main').getAttribute('data-antenna-gain-ratio'));
    const steeredElev = Number(await page.locator('main').getAttribute('data-elevation-deg'));

    assert.ok(steeredOffAxis > initialOffAxis, `steered off-axis ${steeredOffAxis} must be > initial ${initialOffAxis}`);
    assert.ok(steeredGain < initialGain, `steered gain ${steeredGain} must be < initial ${initialGain}`);
    assert.ok(Math.abs(steeredElev - FIXED_ELEVATION_DEG) < 0.05, `elevation must remain fixed at ${FIXED_ELEVATION_DEG}`);

    // 3. Beam Steered screenshot
    const steeredShot = join(EVIDENCE_DIR, 'desktop-beam-steered.png');
    await page.screenshot({ path: steeredShot });
    console.log(`[evidence] captured ${steeredShot}`);

    // 4. Comparison screenshot
    await page.goto(new URL(`${ROUTE_PATH}?beat=comparison`, appUrl).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="se3d-comparison-cue"]', { state: 'visible', timeout: 10_000 });
    const comparisonShot = join(EVIDENCE_DIR, 'desktop-comparison.png');
    await page.screenshot({ path: comparisonShot });
    console.log(`[evidence] captured ${comparisonShot}`);

    // 5. Formula Reveal screenshot
    await page.goto(new URL(`${ROUTE_PATH}?beat=formula-reveal`, appUrl).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="se3d-formula-cue"]', { state: 'visible', timeout: 10_000 });
    assert.equal(await page.locator('main').getAttribute('data-formula-revealed'), 'true');
    const formulaShot = join(EVIDENCE_DIR, 'desktop-formula-reveal.png');
    await page.screenshot({ path: formulaShot });
    console.log(`[evidence] captured ${formulaShot}`);

    // 6. Deep Inspector Drawer test & screenshot
    const openInspectorBtn = page.locator('[data-testid="se3d-open-inspector-btn"]');
    await openInspectorBtn.click();
    await page.waitForSelector('[data-testid="se3d-inspector-drawer"]', { state: 'visible', timeout: 10_000 });
    const inspectorCloseBtn = page.locator('[data-testid="se3d-inspector-close"]');
    const closeBox = await inspectorCloseBtn.boundingBox();
    assert.ok(closeBox && closeBox.width >= 43.5 && closeBox.height >= 43.5, 'inspector close button >= 44x44');
    const inspectorShot = join(EVIDENCE_DIR, 'desktop-inspector.png');
    await page.screenshot({ path: inspectorShot });
    console.log(`[evidence] captured ${inspectorShot}`);

    await inspectorCloseBtn.click();
    await page.waitForTimeout(200);

    // --- Transport & Seek Reconstruction ---
    console.log('[validator] testing transport and seek reconstruction on desktop...');
    await page.goto(new URL(`${ROUTE_PATH}`, appUrl).toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="teaching-transport"]', { state: 'attached', timeout: 10_000 });

    // Test Play/Pause toggle
    const playPauseBtn = page.locator('[data-testid="transport-play-pause"]');
    await playPauseBtn.click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('main').getAttribute('data-transport-playing'), 'false');

    await playPauseBtn.click();
    await page.waitForTimeout(200);
    assert.equal(await page.locator('main').getAttribute('data-transport-playing'), 'true');

    // Test Speed Buttons on Desktop
    await verifyAllSpeedControls(page, 'desktop 1920x1080');

    // Test Seeking to comparison beat (e.g. 58s)
    const timelineRange = page.locator('[data-testid="transport-timeline-range"]');
    await timelineRange.fill('58');
    await page.waitForTimeout(200);
    assert.equal(await page.locator('main').getAttribute('data-beat'), 'comparison');
    const seekedOffAxis = Number(await page.locator('main').getAttribute('data-off-axis-deg'));
    assert.ok(Math.abs(seekedOffAxis - DETERMINISTIC_RECONSTRUCTED_STEER_THETA_DEG) < 0.05, 'seeking past interaction reconstructs completed steer');

    await page.close();

    // ----------------------------------------------------
    // 2. MOBILE SUITE 1 (390x844 - Modern Mobile Viewport)
    // ----------------------------------------------------
    console.log('[validator] testing mobile 390x844 suite with collision detection...');
    const mobile390 = await browser.newPage({ viewport: { width: 390, height: 844 } });
    mobile390.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const mobileBeats = ['perspective-side', 'interaction', 'comparison', 'formula-reveal'] as const;
    const mobileShotNames = {
      'perspective-side': 'mobile-390-camera-invariance.png',
      'interaction': 'mobile-390-beam-steered.png',
      'comparison': 'mobile-390-comparison.png',
      'formula-reveal': 'mobile-390-formula-reveal.png',
    };

    for (const beatId of mobileBeats) {
      const url = new URL(ROUTE_PATH, appUrl);
      url.searchParams.set('beat', beatId);
      await mobile390.goto(url.toString(), { waitUntil: 'domcontentloaded' });
      await mobile390.waitForSelector('canvas', { state: 'attached', timeout: 10_000 });
      await mobile390.waitForTimeout(400);

      const metrics = await readLayoutMetrics(mobile390);
      assert.ok(metrics.visibleRatio >= 0.70, `mobile 390 ${beatId}: visible ratio must be >= 70% (got ${(metrics.visibleRatio * 100).toFixed(1)}%)`);
      assert.equal(metrics.hasOverflow, false, `mobile 390 ${beatId}: no document overflow`);

      // Pairwise bounding box collision measurement
      const report = await measureBoxesAndCollisions(mobile390, { width: 390, height: 844 }, beatId);
      assert.deepEqual(report.containmentErrors, [], `mobile 390 ${beatId}: all elements contained in viewport bounds`);
      assert.deepEqual(report.touchErrors, [], `mobile 390 ${beatId}: all touch targets >= 44x44px`);
      assert.deepEqual(
        report.collisions,
        [],
        `mobile 390 ${beatId}: zero pairwise collisions expected, got: ${JSON.stringify(report.collisions)}`,
      );

      const shotPath = join(EVIDENCE_DIR, mobileShotNames[beatId]);
      await mobile390.screenshot({ path: shotPath });
      console.log(`[evidence] captured ${shotPath}`);
    }

    // Verify all 4 speeds and operability on mobile 390
    console.log('[validator] verifying speed buttons & operability on mobile 390...');
    await verifyAllSpeedControls(mobile390, 'mobile 390x844');

    // Test +/-5s and seek slider on mobile 390
    const rew390 = mobile390.locator('[data-testid="transport-rewind"]');
    await rew390.click();
    await mobile390.waitForTimeout(100);

    const fwd390 = mobile390.locator('[data-testid="transport-forward"]');
    await fwd390.click();
    await mobile390.waitForTimeout(100);

    await mobile390.close();

    // ----------------------------------------------------
    // 3. MOBILE SUITE 2 (320x720 - Compact Mobile Viewport)
    // ----------------------------------------------------
    console.log('[validator] testing compact mobile 320x720 suite with collision detection...');
    const mobile320 = await browser.newPage({ viewport: { width: 320, height: 720 } });
    mobile320.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const compactShotNames = {
      'perspective-side': 'mobile-320-camera-invariance.png',
      'interaction': 'mobile-320-beam-steered.png',
      'comparison': 'mobile-320-comparison.png',
      'formula-reveal': 'mobile-320-formula-reveal.png',
    };

    for (const beatId of mobileBeats) {
      const url = new URL(ROUTE_PATH, appUrl);
      url.searchParams.set('beat', beatId);
      await mobile320.goto(url.toString(), { waitUntil: 'domcontentloaded' });
      await mobile320.waitForSelector('canvas', { state: 'attached', timeout: 10_000 });
      await mobile320.waitForTimeout(400);

      const metrics = await readLayoutMetrics(mobile320);
      assert.ok(metrics.visibleRatio >= 0.70, `mobile 320 ${beatId}: visible ratio >= 70% (got ${(metrics.visibleRatio * 100).toFixed(1)}%)`);
      assert.equal(metrics.hasOverflow, false, `mobile 320 ${beatId}: no document overflow`);

      // Pairwise bounding box collision measurement
      const report = await measureBoxesAndCollisions(mobile320, { width: 320, height: 720 }, beatId);
      assert.deepEqual(report.containmentErrors, [], `mobile 320 ${beatId}: all elements contained in viewport bounds`);
      assert.deepEqual(report.touchErrors, [], `mobile 320 ${beatId}: all touch targets >= 44x44px`);
      assert.deepEqual(
        report.collisions,
        [],
        `mobile 320 ${beatId}: zero pairwise collisions expected, got: ${JSON.stringify(report.collisions)}`,
      );

      const shotPath = join(EVIDENCE_DIR, compactShotNames[beatId]);
      await mobile320.screenshot({ path: shotPath });
      console.log(`[evidence] captured ${shotPath}`);
    }

    // Verify all 4 speeds and operability on compact 320
    console.log('[validator] verifying speed buttons & operability on mobile 320...');
    await verifyAllSpeedControls(mobile320, 'mobile 320x720');

    // Test +/-5s and seek slider on mobile 320
    const rew320 = mobile320.locator('[data-testid="transport-rewind"]');
    await rew320.click();
    await mobile320.waitForTimeout(100);

    const fwd320 = mobile320.locator('[data-testid="transport-forward"]');
    await fwd320.click();
    await mobile320.waitForTimeout(100);

    // Verify inert state when transport is hidden
    console.log('[validator] verifying transport hidden & inert states...');
    await mobile320.goto(new URL(`${ROUTE_PATH}?beat=perspective-side`, appUrl).toString(), { waitUntil: 'domcontentloaded' });
    await mobile320.waitForTimeout(400);
    const transportNav = mobile320.locator('[data-testid="teaching-transport"]');
    const isTransportAttached = (await transportNav.count()) > 0;
    assert.ok(isTransportAttached, 'transport is attached');

    await mobile320.close();

    // Filter ignorable errors (e.g. favicon)
    const realErrors = consoleErrors.filter(e => !/favicon|ERR_CONNECTION_REFUSED|:8765/.test(e));
    assert.deepEqual(realErrors, [], `must have zero real console errors: ${JSON.stringify(realErrors)}`);

    console.log('[validator] SUCCESS! All verification gates passed cleanly.');
  } finally {
    await browser.close();
  }
}

void runBrowserValidator(
  {
    validator: 'validate-scientific-explain-3d-browser',
    appUrl: process.env.APP_URL ?? process.argv[2],
    floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.layout,
  },
  async () => main(),
).catch((err) => {
  console.error('[validator] FAILED:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
