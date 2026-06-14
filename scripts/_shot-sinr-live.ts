#!/usr/bin/env node
// THROWAWAY fast single-shot: capture ONE settled sinr-live canvas frame for the
// cone-style screenshot loop. Output output/shot/ (gitignored). Arg = label suffix.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const LABEL = process.argv[2] ?? 'now';
const OUT_DIR = join('output', 'shot');
const SHELL = '.leo-app-shell';

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
    const errs: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SHELL, { timeout: 20_000 });
    await page.waitForSelector('canvas[data-camera-position]', { timeout: 30_000 });
    await page.waitForFunction(() => {
      const c = document.querySelector('canvas[data-camera-position]');
      return Number(c?.getAttribute('data-rendered-ue-count') ?? '0') > 0;
    }, undefined, { timeout: 90_000 });
    await page.waitForTimeout(8000); // let cones warm + serving acquire
    const cv = await page.$eval('canvas[data-camera-position]', el => ({
      cones: (el as HTMLElement).dataset.beamConeCount,
      served: (el as HTMLElement).dataset.sinrLiveCellServedCount,
    }));
    await page.screenshot({ path: join(OUT_DIR, `sinr-live-${LABEL}-full.png`), fullPage: false });
    await page.locator('canvas[data-camera-position]').first().screenshot({ path: join(OUT_DIR, `sinr-live-${LABEL}-canvas.png`) });
    console.log(`shot=${LABEL} cones=${cv.cones} served=${cv.served} consoleErrors=${errs.length}`);
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
