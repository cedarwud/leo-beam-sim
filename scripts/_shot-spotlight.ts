#!/usr/bin/env node
// THROWAWAY: enable Spotlight, capture at the default camera, then zoom OUT via
// wheel and capture again — to show the "black on zoom-out" FogExp2 saturation.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Page } from '@playwright/test';

const URL = process.env.SHOT_URL ?? 'http://localhost:3000/';
const TAG = process.env.SHOT_TAG ?? 'before';
const OUT = join('output', 'shot');
const SPOT = 'input[aria-label="Spotlight mode: highlight serving beam path"]';

async function cam(page: Page): Promise<string> {
  return page.$eval('canvas[data-camera-position]', el =>
    (el as HTMLElement).dataset.cameraPosition ?? 'unset').catch(() => 'no-canvas');
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
    await page.waitForSelector(SPOT, { timeout: 30_000 });
    await page.waitForTimeout(6000);
    // enable spotlight
    await page.click(SPOT);
    await page.waitForTimeout(2500);
    const camDefault = await cam(page);
    await page.screenshot({ path: join(OUT, `spotlight-${TAG}-default.png`), fullPage: false });
    // zoom OUT: hover canvas, wheel down (dolly out) repeatedly
    const box = await page.$eval('canvas[data-camera-position]', el => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(box.x, box.y);
    const ITERS = Number(process.env.SHOT_ZOOM_ITERS ?? '16');
    for (let i = 0; i < ITERS; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(100); }
    await page.waitForTimeout(1500);
    const camZoom = await cam(page);
    await page.screenshot({ path: join(OUT, `spotlight-${TAG}-zoomed.png`), fullPage: false });
    console.log(`camDefault=${camDefault}\ncamZoomedOut=${camZoom}`);
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
