// G1-LEFT-DEFAULT rewrite. This gate used to assert the SINR-live left rail held
// the SignalTuningPanel "tuning drawer" with per-uiMode widths and signal/handover
// tab switching. G1-LEFT-DEFAULT replaced that: the SINR-live left rail is now a
// light read-only orientation card, and the SINR-formula + handover-policy tuners
// moved into the non-modal ⚙ Advanced drawer. This gate now asserts the NEW
// arrangement plus the durable invariants the old gate protected (left-panel
// clicks must not leak into the canvas OrbitControls; the canvas still rotates on
// drag).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import { bootDeterministicPage } from './_v3-deterministic-fixture.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const CHECKPOINT_PATH = fileURLToPath(
  new URL('../docs/visual-clarity-proposal/manual-checkpoints/vc4b-post-slice-tuning-drawer-1440x900.png', import.meta.url),
);

interface BrowserBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function measureBox(page: Page, selector: string, label: string): Promise<BrowserBox> {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `${label} box missing for ${selector}`);
  return box;
}

async function screenshotCanvasHash(page: Page): Promise<string> {
  const screenshot = await page.locator('.leo-shell-canvas canvas').screenshot();
  assert.ok(screenshot.length > 5000, `canvas screenshot looked blank: ${screenshot.length} bytes`);
  return hashBuffer(screenshot);
}

async function dragInsideBox(page: Page, box: BrowserBox, deltaX: number, deltaY: number): Promise<void> {
  const startX = box.x + box.width * 0.5;
  const startY = box.y + box.height * 0.5;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(80);
}

async function readCanvasPointerDownCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scope = window as typeof window & {
      __vc4bCanvasPointerDowns?: number;
      __vc4bCanvasPointerProbeInstalled?: boolean;
    };
    const canvas = document.querySelector('.leo-shell-canvas canvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('canvas missing for pointer probe');
    if (!scope.__vc4bCanvasPointerProbeInstalled) {
      scope.__vc4bCanvasPointerDowns = 0;
      canvas.addEventListener('pointerdown', () => {
        scope.__vc4bCanvasPointerDowns = (scope.__vc4bCanvasPointerDowns ?? 0) + 1;
      }, { capture: true });
      scope.__vc4bCanvasPointerProbeInstalled = true;
    }
    return scope.__vc4bCanvasPointerDowns ?? 0;
  });
}

async function assertClickDoesNotHitCanvas(page: Page, box: BrowserBox, label: string): Promise<void> {
  const before = await readCanvasPointerDownCount(page);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForTimeout(80);
  const after = await readCanvasPointerDownCount(page);
  assert.equal(before, after, `${label} click reached the canvas pointer handler; left-panel events may be leaking into OrbitControls`);
}

async function main(): Promise<void> {
  const appUrl = await detectAppUrl();
  const browser = await chromium.launch();

  try {
    const page = await bootDeterministicPage({ chromium }, {
      browser,
      url: appUrl,
      seed: 4601,
      rafMs: 1800,
      viewport: { width: 1440, height: 900 },
      waitForSelector: '.leo-shell-row',
    });

    try {
      await page.locator('.leo-shell-canvas canvas').waitFor({ timeout: 10_000 });
      await page.locator('.leo-shell-left .leo-sidebar-tab-shell').waitFor({ timeout: 10_000 });
      await page.locator('.leo-shell-right .leo-info-panel').waitFor({ timeout: 10_000 });

      // (1) The SINR-live left default is the light read-only orientation card.
      await page.locator('[data-testid="sinr-live-orientation-card"]').waitFor({ timeout: 5000 });
      assert.equal(
        await page.locator('[data-testid="signal-tuning-drawer-handle"]').isVisible(),
        false,
        'the retired collapsed tuning handle must not appear in the default left rail (the tuner moved to the ⚙ Advanced drawer)',
      );

      // (2) Layout sanity: the left slot, canvas, and right panel keep usable widths.
      const canvasSlot = await measureBox(page, '.leo-shell-canvas', 'canvas slot');
      const leftSlot = await measureBox(page, '.leo-shell-left', 'left slot');
      const rightPanel = await measureBox(page, '.leo-shell-right .leo-info-panel', 'right panel');
      assert.ok(canvasSlot.width >= 280, `canvas slot width collapsed: ${canvasSlot.width}`);
      assert.ok(canvasSlot.height >= 300, `canvas slot height collapsed: ${canvasSlot.height}`);
      assert.ok(leftSlot.width >= 280, `left slot width collapsed: ${leftSlot.width}`);
      assert.ok(rightPanel.width >= 320, `right panel width regressed: ${rightPanel.width}`);

      // (3) Durable invariant: clicking the left panel must not leak into the canvas.
      const leftPanel = await measureBox(page, '.leo-shell-left .leo-sidebar-tab-shell', 'left panel');
      await assertClickDoesNotHitCanvas(page, leftPanel, 'left summary panel');

      // (4) Durable invariant: the canvas still rotates on drag.
      const dragBefore = await screenshotCanvasHash(page);
      await dragInsideBox(page, canvasSlot, 180, 48);
      const dragAfter = await screenshotCanvasHash(page);
      assert.notEqual(dragBefore, dragAfter, 'dragging inside the canvas did not change the frame; OrbitControls may not be receiving pointer events');

      // (5) The relocated tuners live in the non-modal ⚙ Advanced drawer.
      await page.locator('[data-testid="sinr-live-display-trigger"]').click();
      await page.locator('[data-testid="sinr-live-display-drawer"]').waitFor({ timeout: 5000 });
      // Display & camera section is default-open.
      await page.locator('[data-testid="beam-density-control"]').waitFor({ timeout: 5000 });
      // Expand the relocated SINR-formula section.
      await page.locator('[data-testid="sinr-live-advanced-formula"] > summary').click();
      await page.locator('[data-testid="sinr-formula-page"]').waitFor({ timeout: 5000 });
      // Expand the relocated handover-policy section.
      await page.locator('[data-testid="sinr-live-advanced-handover"] > summary').click();
      await page.locator('[data-testid="handover-policy-controls"]').waitFor({ timeout: 5000 });

      // (6) The non-modal drawer panel still does not leak clicks into the canvas.
      const drawerBox = await measureBox(page, '[data-testid="sinr-live-display-drawer"]', 'advanced drawer');
      await assertClickDoesNotHitCanvas(page, drawerBox, 'advanced drawer panel');

      // (7) The disclosure closes on Escape.
      await page.keyboard.press('Escape');
      await page.locator('[data-testid="sinr-live-display-drawer"]').waitFor({ state: 'detached', timeout: 5000 });

      await mkdir(dirname(CHECKPOINT_PATH), { recursive: true });
      await page.screenshot({ path: CHECKPOINT_PATH, fullPage: true });

      console.log('Visual Clarity Phase 4B tuning-drawer (G1-LEFT-DEFAULT) validation passed.');
      console.log(JSON.stringify({
        appUrl,
        canvasSlot,
        leftSlot,
        rightPanel,
        manualScreenshotCheckpoint: CHECKPOINT_PATH,
        result: 'PASS',
      }, null, 2));
    } finally {
      await page.context().close().catch(() => {});
    }
  } finally {
    await browser.close();
  }
}

main();
