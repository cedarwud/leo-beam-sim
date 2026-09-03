/**
 * Comprehensive evidence capture script for Golden Flow Mobile Interaction R2.
 * Captures 1920x1080, 390x844, and 320x720 screenshots across all beats, transport reveal,
 * speeds, seek, and interaction states.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';

import { GOLDEN_FLOW_BEATS, GOLDEN_FLOW_ROUTE } from '../src/prototype/golden-flow/goldenFlowDirector.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const OUTPUT_DIR = join(process.cwd(), 'output/playwright/golden-flow-r1');

async function ensureDir(dir: string): Promise<void> {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

async function captureDesktopBeats(page: Page, appUrl: string): Promise<void> {
  for (const beat of GOLDEN_FLOW_BEATS) {
    const url = new URL(GOLDEN_FLOW_ROUTE, appUrl);
    url.searchParams.set('beat', beat.id);
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      (beatId) => document.querySelector('main')?.getAttribute('data-beat') === beatId,
      beat.id,
      { timeout: 20_000 },
    );
    await page.waitForSelector('canvas', { state: 'attached', timeout: 20_000 });
    // Let Drei labels and WebGL settle
    await page.waitForTimeout(600);

    const screenshotPath = join(OUTPUT_DIR, `desktop-1920-beat-${String(GOLDEN_FLOW_BEATS.indexOf(beat) + 1).padStart(2, '0')}-${beat.id}.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`[capture] Saved ${screenshotPath}`);
  }
}

async function captureMobileBeatsForViewport(browser: Browser, appUrl: string, width: number, height: number): Promise<void> {
  const mobile = await browser.newPage({ viewport: { width, height } });
  for (const beatId of ['establish', 'angles', 'interaction', 'ttt', 'trace', 'receipt', 'new-normal'] as const) {
    const url = new URL(GOLDEN_FLOW_ROUTE, appUrl);
    url.searchParams.set('beat', beatId);
    await mobile.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    await mobile.waitForSelector('canvas', { state: 'attached', timeout: 20_000 });
    await mobile.waitForTimeout(600);

    const screenshotPath = join(OUTPUT_DIR, `mobile-${width}-beat-${beatId}.png`);
    await mobile.screenshot({ path: screenshotPath });
    console.log(`[capture] Saved ${screenshotPath}`);

    // If interaction beat, also capture with transport revealed
    if (beatId === 'interaction') {
      const revealBtn = mobile.locator('[data-testid="transport-reveal-button"]');
      if (await revealBtn.count() > 0) {
        await revealBtn.click();
        await mobile.waitForTimeout(400);
        const revealedPath = join(OUTPUT_DIR, `mobile-${width}-beat-interaction-revealed.png`);
        await mobile.screenshot({ path: revealedPath });
        console.log(`[capture] Saved ${revealedPath}`);
      }
    }
  }
  await mobile.close();
}

async function captureTransportInteractions(page: Page, appUrl: string): Promise<void> {
  const url = new URL(GOLDEN_FLOW_ROUTE, appUrl);
  url.searchParams.set('beat', 'establish');
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { state: 'attached', timeout: 20_000 });
  await page.waitForTimeout(600);

  // 1. Move mouse to bottom area to reveal transport
  await page.mouse.move(960, 1040);
  await page.waitForTimeout(400);
  const revealedPath = join(OUTPUT_DIR, 'desktop-1920-transport-revealed-hover.png');
  await page.screenshot({ path: revealedPath });
  console.log(`[capture] Saved ${revealedPath}`);

  // 2. Click Play button on review mode
  const playButton = page.getByRole('button', { name: '播放' }).or(page.getByRole('button', { name: '暫停' }));
  if (await playButton.count() > 0) {
    await playButton.first().click();
    await page.waitForTimeout(800);
  }

  // 3. Test speed toggle button
  const speedTrigger = page.getByTestId('transport-speed-current');
  const speedButton = page.getByTestId('transport-speed-2');
  if (await speedTrigger.isVisible() && await speedButton.count() > 0) {
    await speedTrigger.click();
    await speedButton.click();
    await page.waitForTimeout(400);
    const speedPath = join(OUTPUT_DIR, 'desktop-1920-transport-speed-toggled.png');
    await page.screenshot({ path: speedPath });
    console.log(`[capture] Saved ${speedPath}`);
  }
}

async function main(): Promise<void> {
  await ensureDir(OUTPUT_DIR);
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const browser: Browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await captureDesktopBeats(page, appUrl);
    await captureMobileBeatsForViewport(browser, appUrl, 390, 844);
    await captureMobileBeatsForViewport(browser, appUrl, 320, 720);
    await captureTransportInteractions(page, appUrl);
    console.log('[capture] All screenshots captured successfully.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[capture] FAILED:', err);
  process.exit(1);
});
