#!/usr/bin/env node
// P2 throwaway: capture a STABLE sinr-live frame (waits for the scene to actually
// render UEs, not the Loading overlay). Outputs to output/p2/ (gitignored).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3001';
const OUT_DIR = join('output', 'p2');
const SHELL = '.leo-app-shell';

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SHELL, { timeout: 20_000 });
    // default lane is sinr-live
    const lane = await page.getAttribute(SHELL, 'data-scene-lane');
    await page.waitForSelector('canvas[data-camera-position]', { timeout: 30_000 });
    // wait for the scene to actually render UE markers (not the Loading overlay)
    await page.waitForFunction(() => {
      const c = document.querySelector('canvas[data-camera-position]');
      const n = Number(c?.getAttribute('data-rendered-ue-count') ?? '0');
      return Number.isFinite(n) && n > 0;
    }, undefined, { timeout: 90_000 });
    await page.waitForTimeout(1500); // let a few frames settle
    const canvas = await page.$eval('canvas[data-camera-position]', el => ({ ...(el as HTMLElement).dataset }));
    await page.screenshot({ path: join(OUT_DIR, 'sinr-live-full.png'), fullPage: true });
    const cv = page.locator('canvas[data-camera-position]').first();
    await cv.screenshot({ path: join(OUT_DIR, 'sinr-live-canvas.png') });
    await writeFile(join(OUT_DIR, 'sinr-live.json'), `${JSON.stringify({ lane, canvas }, null, 2)}\n`, 'utf8');
    console.log(`PASS lane=${lane} renderedUeCount=${canvas.renderedUeCount ?? '?'}`);
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
