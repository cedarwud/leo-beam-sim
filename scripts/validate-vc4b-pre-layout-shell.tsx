import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import { MEASURED_BROWSER_GATE_FLOORS_MS, runBrowserValidator } from './lib/browser-gate.ts';
import { bootDeterministicPage } from './_v3-deterministic-fixture.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const CHECKPOINT_PATH = fileURLToPath(
  new URL('../docs/visual-clarity-proposal/manual-checkpoints/vc4b-pre-post-slice-layout-shell-1440x900.png', import.meta.url),
);

interface BrowserBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ViewportResult {
  viewport: string;
  shell: BrowserBox;
  canvasSlot: BrowserBox;
  canvas: BrowserBox;
  leftPanel: BrowserBox;
  rightPanel: BrowserBox;
  checkpoint?: string;
}

function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function rectOverlapArea(a: BrowserBox, b: BrowserBox): number {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

async function measureBox(page: Page, selector: string, label: string): Promise<BrowserBox> {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `${label} box missing for ${selector}`);
  return box;
}

async function screenshotCanvasHash(page: Page): Promise<string> {
  const screenshot = await page.locator('canvas').screenshot();
  assert.ok(screenshot.length > 5000, `canvas screenshot looked blank: ${screenshot.length} bytes`);
  return hashBuffer(screenshot);
}

async function dragInsideBox(page: Page, box: BrowserBox, deltaX: number, deltaY: number): Promise<void> {
  const startX = box.x + box.width * 0.5;
  const startY = box.y + box.height * 0.5;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}

async function assertCanvasDragRotates(page: Page, canvasSlot: BrowserBox): Promise<{ before: string; after: string }> {
  const before = await screenshotCanvasHash(page);
  await dragInsideBox(page, canvasSlot, 170, 44);
  const after = await screenshotCanvasHash(page);
  assert.notEqual(
    before,
    after,
    `dragging inside the canvas slot did not change the canvas frame; OrbitControls may not be receiving pointer events`,
  );
  return { before, after };
}

async function assertRightPanelDragDoesNotRotate(page: Page, rightPanel: BrowserBox): Promise<{ before: string; after: string }> {
  const before = await screenshotCanvasHash(page);
  await dragInsideBox(page, rightPanel, 120, 28);
  const after = await screenshotCanvasHash(page);
  assert.equal(
    before,
    after,
    `dragging inside the right InfoPanel changed the canvas frame; panel pointer events leaked into OrbitControls`,
  );
  return { before, after };
}

async function assertViewport(
  browser: Browser,
  appUrl: string,
  viewport: { width: number; height: number },
  saveCheckpoint: boolean,
): Promise<ViewportResult> {
  const page = await bootDeterministicPage({ chromium }, {
    browser,
    url: appUrl,
    seed: 4501,
    rafMs: 1800,
    viewport,
    waitForSelector: '.leo-shell-row',
  });

  try {
    await page.locator('.leo-shell-left').waitFor({ timeout: 5000 });
    await page.locator('.leo-shell-right .leo-info-panel').waitFor({ timeout: 5000 });
    await page.locator('.leo-shell-canvas canvas').waitFor({ timeout: 5000 });

    const shell = await measureBox(page, '.leo-shell-row', `${viewport.width}x${viewport.height} shell row`);
    const canvasSlot = await measureBox(page, '.leo-shell-canvas', `${viewport.width}x${viewport.height} canvas slot`);
    const canvas = await measureBox(page, '.leo-shell-canvas canvas', `${viewport.width}x${viewport.height} canvas`);
    const leftPanel = await measureBox(page, '.leo-shell-left', `${viewport.width}x${viewport.height} left rail`);
    // Measure the right shell REGION (not the InfoPanel's content-dependent
    // height — its grid intentionally overflows/scrolls). This is a layout-SHELL
    // gate; the durable invariant is that the right region keeps usable space and
    // does not overlap the canvas/left rail. (Symmetric with the .leo-shell-left
    // measure above; was .leo-shell-right .leo-info-panel before the UI-mode switch
    // — which the gate used to surface via tuning mode — went away.)
    const rightPanel = await measureBox(page, '.leo-shell-right', `${viewport.width}x${viewport.height} right region`);

    assert.ok(shell.width > 0 && shell.height > 0, `${viewport.width}x${viewport.height} shell row collapsed`);
    assert.ok(canvasSlot.width >= 240, `${viewport.width}x${viewport.height} canvas slot width collapsed: ${canvasSlot.width}`);
    assert.ok(canvasSlot.height >= 160, `${viewport.width}x${viewport.height} canvas slot height collapsed: ${canvasSlot.height}`);
    assert.ok(leftPanel.width >= 160 && leftPanel.height >= 140, `${viewport.width}x${viewport.height} left panel collapsed: ${JSON.stringify(leftPanel)}`);
    assert.ok(rightPanel.width >= 160 && rightPanel.height >= 140, `${viewport.width}x${viewport.height} right panel collapsed: ${JSON.stringify(rightPanel)}`);

    assert.ok(
      Math.abs(canvas.width - canvasSlot.width) <= 2,
      `${viewport.width}x${viewport.height} canvas width does not match flex slot: ${JSON.stringify({ canvas, canvasSlot })}`,
    );
    assert.ok(
      Math.abs(canvas.height - canvasSlot.height) <= 2,
      `${viewport.width}x${viewport.height} canvas height does not match flex slot: ${JSON.stringify({ canvas, canvasSlot })}`,
    );

    assert.equal(rectOverlapArea(canvasSlot, leftPanel), 0, `${viewport.width}x${viewport.height} left panel overlaps canvas slot`);
    assert.equal(rectOverlapArea(canvasSlot, rightPanel), 0, `${viewport.width}x${viewport.height} right panel overlaps canvas slot`);
    assert.equal(rectOverlapArea(leftPanel, rightPanel), 0, `${viewport.width}x${viewport.height} side panels overlap each other`);

    await screenshotCanvasHash(page);

    let checkpoint: string | undefined;
    if (saveCheckpoint) {
      await mkdir(dirname(CHECKPOINT_PATH), { recursive: true });
      await page.screenshot({ path: CHECKPOINT_PATH, fullPage: true });
      checkpoint = CHECKPOINT_PATH;
    }

    return {
      viewport: `${viewport.width}x${viewport.height}`,
      shell,
      canvasSlot,
      canvas,
      leftPanel,
      rightPanel,
      checkpoint,
    };
  } finally {
    await page.context().close().catch(() => {});
  }
}

async function assertPointerBehavior(browser: Browser, appUrl: string): Promise<{
  canvasDrag: { before: string; after: string };
  rightPanelDrag: { before: string; after: string };
}> {
  const page = await bootDeterministicPage({ chromium }, {
    browser,
    url: appUrl,
    seed: 4502,
    rafMs: 1800,
    viewport: { width: 1440, height: 900 },
    waitForSelector: '.leo-shell-row',
  });

  try {
    const canvasSlot = await measureBox(page, '.leo-shell-canvas', 'pointer canvas slot');
    const rightPanel = await measureBox(page, '.leo-shell-right .leo-info-panel', 'pointer right panel');
    const canvasDrag = await assertCanvasDragRotates(page, canvasSlot);
    const rightPanelDrag = await assertRightPanelDragDoesNotRotate(page, rightPanel);
    return { canvasDrag, rightPanelDrag };
  } finally {
    await page.context().close().catch(() => {});
  }
}

async function main(): Promise<void> {
  const appUrl = await detectAppUrl();
  const browser = await chromium.launch();
  let viewports: ViewportResult[];
  let pointerBehavior: Awaited<ReturnType<typeof assertPointerBehavior>>;

  try {
    viewports = [
      await assertViewport(browser, appUrl, { width: 1440, height: 900 }, true),
      await assertViewport(browser, appUrl, { width: 1366, height: 768 }, false),
      await assertViewport(browser, appUrl, { width: 768, height: 1024 }, false),
      await assertViewport(browser, appUrl, { width: 390, height: 844 }, false),
    ];
    pointerBehavior = await assertPointerBehavior(browser, appUrl);
  } finally {
    await browser.close();
  }

  console.log('Visual Clarity Phase 4B-pre layout-shell validation passed.');
  console.log(JSON.stringify({
    appUrl,
    viewports,
    pointerBehavior,
    manualScreenshotCheckpoint: CHECKPOINT_PATH,
    result: 'PASS',
  }, null, 2));
}

void runBrowserValidator(
  {
    validator: 'validate-vc4b-pre-layout-shell',
    appUrl: process.env.APP_URL ?? process.argv[2],
    floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.layout,
  },
  async () => main(),
).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
