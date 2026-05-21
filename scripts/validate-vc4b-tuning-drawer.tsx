import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import { bootDeterministicPage } from './_v3-deterministic-fixture.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const CHECKPOINT_PATH = fileURLToPath(
  new URL('../docs/visual-clarity-proposal/manual-checkpoints/vc4b-post-slice-tuning-drawer-1440x900.png', import.meta.url),
);

type UiMode = 'presentation' | 'tuning' | 'diagnostics';

interface BrowserBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ModeResult {
  mode: UiMode;
  shell: BrowserBox;
  canvasSlot: BrowserBox;
  canvas: BrowserBox;
  leftSlot: BrowserBox;
  leftPanel: BrowserBox;
  rightPanel: BrowserBox;
  drawerState: string | null;
  handleVisible: boolean;
  contentVisible: boolean;
  panelClickCanvasPointers: { before: number; after: number };
  canvasDragHash: { before: string; after: string };
  checkpoint?: string;
}

const EXPECTED_DRAWER_WIDTH: Record<UiMode, number> = {
  presentation: 432,
  tuning: 432,
  diagnostics: 460,
};

function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

function assertClose(actual: number, expected: number, tolerance: number, label: string): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label} expected ${expected}px ± ${tolerance}px, got ${actual}px`,
  );
}

async function measureBox(page: Page, selector: string, label: string): Promise<BrowserBox> {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `${label} box missing for ${selector}`);
  return box;
}

async function selectUiMode(page: Page, mode: UiMode): Promise<void> {
  const modeSelect = page.locator('select[aria-label="UI mode"]');
  await modeSelect.waitFor({ timeout: 5000 });
  await modeSelect.selectOption(mode);
  await page.locator(`.leo-app-shell[data-ui-mode="${mode}"]`).waitFor({ timeout: 5000 });
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

async function clickDrawerControl(page: Page, mode: UiMode, leftPanel: BrowserBox): Promise<void> {
  if (mode === 'presentation') {
    await page.mouse.click(leftPanel.x + leftPanel.width * 0.5, leftPanel.y + leftPanel.height * 0.5);
    return;
  }

  await page.locator('#left-sidebar-tab-handover').click();
  await page.waitForTimeout(80);
  await page.locator('#left-sidebar-tab-signal').click();
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

async function assertDrawerClickDoesNotHitCanvas(
  page: Page,
  mode: UiMode,
  leftPanel: BrowserBox,
): Promise<{ before: number; after: number }> {
  const before = await readCanvasPointerDownCount(page);
  await clickDrawerControl(page, mode, leftPanel);
  const after = await readCanvasPointerDownCount(page);
  assert.equal(
    before,
    after,
    `${mode} drawer interaction reached the canvas pointer handler; panel events may be leaking into OrbitControls`,
  );
  return { before, after };
}

async function assertCanvasDragRotates(page: Page, canvasSlot: BrowserBox): Promise<{ before: string; after: string }> {
  const before = await screenshotCanvasHash(page);
  await dragInsideBox(page, canvasSlot, 180, 48);
  const after = await screenshotCanvasHash(page);
  assert.notEqual(
    before,
    after,
    'dragging inside the canvas slot did not change the canvas frame; OrbitControls may not be receiving pointer events',
  );
  return { before, after };
}

async function assertMode(
  browser: Browser,
  appUrl: string,
  mode: UiMode,
  saveCheckpoint: boolean,
): Promise<ModeResult> {
  const page = await bootDeterministicPage({ chromium }, {
    browser,
    url: appUrl,
    seed: 4601,
    rafMs: 1800,
    viewport: { width: 1440, height: 900 },
    waitForSelector: '.leo-shell-row',
  });

  try {
    console.log(`[vc4b] ${mode}: booted`);
    await selectUiMode(page, mode);
    console.log(`[vc4b] ${mode}: selected`);
    await page.locator('.leo-shell-canvas canvas').waitFor({ timeout: 5000 });
    await page.locator('.leo-shell-left .leo-sidebar-tab-shell').waitFor({ timeout: 5000 });
    await page.locator('.leo-shell-right .leo-info-panel').waitFor({ timeout: 5000 });

    const shell = await measureBox(page, '.leo-shell-row', `${mode} shell row`);
    const canvasSlot = await measureBox(page, '.leo-shell-canvas', `${mode} canvas slot`);
    const canvas = await measureBox(page, '.leo-shell-canvas canvas', `${mode} canvas`);
    const leftSlot = await measureBox(page, '.leo-shell-left', `${mode} left slot`);
    const leftPanel = await measureBox(page, '.leo-shell-left .leo-sidebar-tab-shell', `${mode} left panel`);
    const rightPanel = await measureBox(page, '.leo-shell-right .leo-info-panel', `${mode} right panel`);
    const expectedWidth = EXPECTED_DRAWER_WIDTH[mode];
    const drawerState = await page.locator('.leo-shell-left .leo-sidebar-tab-shell').getAttribute('data-sidebar-side');
    const handleVisible = await page.locator('[data-testid="signal-tuning-drawer-handle"]').isVisible();
    const contentVisible = await page.locator('.leo-shell-left .leo-sidebar-tab-panel').isVisible();

    assertClose(leftSlot.width, expectedWidth, 3, `${mode} left shell slot width`);
    assertClose(leftPanel.width, expectedWidth, 3, `${mode} tuning drawer width`);
    assert.ok(canvasSlot.width >= 280, `${mode} canvas slot width collapsed: ${canvasSlot.width}`);
    assert.ok(canvasSlot.height >= 300, `${mode} canvas slot height collapsed: ${canvasSlot.height}`);
    assert.ok(rightPanel.width >= 320, `${mode} right panel width regressed: ${rightPanel.width}`);
    assertClose(canvas.width, canvasSlot.width, 2, `${mode} canvas width`);
    assertClose(canvas.height, canvasSlot.height, 2, `${mode} canvas height`);

    assert.equal(drawerState, 'left', `${mode} mode should keep the left sidebar tab shell mounted`);
    assert.equal(handleVisible, false, `${mode} mode should not expose the retired collapsed tuning handle in the top-level sidebar`);
    assert.equal(contentVisible, true, `${mode} mode should keep the top-level sidebar panel visible`);

    const panelClickCanvasPointers = await assertDrawerClickDoesNotHitCanvas(page, mode, leftPanel);
    console.log(`[vc4b] ${mode}: drawer pointer isolation passed`);
    const canvasDragHash = await assertCanvasDragRotates(page, canvasSlot);
    console.log(`[vc4b] ${mode}: canvas drag passed`);

    let checkpoint: string | undefined;
    if (saveCheckpoint) {
      await mkdir(dirname(CHECKPOINT_PATH), { recursive: true });
      await page.screenshot({ path: CHECKPOINT_PATH, fullPage: true });
      checkpoint = CHECKPOINT_PATH;
    }

    return {
      mode,
      shell,
      canvasSlot,
      canvas,
      leftSlot,
      leftPanel,
      rightPanel,
      drawerState,
      handleVisible,
      contentVisible,
      panelClickCanvasPointers,
      canvasDragHash,
      checkpoint,
    };
  } finally {
    await page.context().close().catch(() => {});
  }
}

async function main(): Promise<void> {
  const appUrl = await detectAppUrl();
  const browser = await chromium.launch();
  let modes: ModeResult[];

  try {
    modes = [
      await assertMode(browser, appUrl, 'presentation', true),
      await assertMode(browser, appUrl, 'tuning', false),
      await assertMode(browser, appUrl, 'diagnostics', false),
    ];
  } finally {
    await browser.close();
  }

  const byMode = Object.fromEntries(modes.map(result => [result.mode, result])) as Record<UiMode, ModeResult>;
  assert.ok(
    byMode.presentation.canvasSlot.width > byMode.diagnostics.canvasSlot.width + 40,
    'presentation mode did not keep the canvas wider than the diagnostics sidebar layout',
  );
  assert.ok(
    Math.abs(byMode.presentation.canvasSlot.width - byMode.tuning.canvasSlot.width) <= 4,
    'presentation and tuning mode should share the same top-level sidebar width at the 1440px checkpoint',
  );

  console.log('Visual Clarity Phase 4B tuning-drawer validation passed.');
  console.log(JSON.stringify({
    appUrl,
    modes,
    manualScreenshotCheckpoint: CHECKPOINT_PATH,
    result: 'PASS',
  }, null, 2));
}

main();
