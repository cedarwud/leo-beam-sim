#!/usr/bin/env node
// THROWAWAY: capture a WARM sinr-live frame (20x fast-forward past the ~42s
// cold-attach warm-up) for the G2c live-pulse before/after loop. Output
// output/shot/ (gitignored). Arg = label suffix.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const LABEL = process.argv[2] ?? 'now';
const WARM_WALL_MS = Number(process.argv[3] ?? '9000');
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
    // Crank to 20x so ~42s sim-time cold-attach warm-up elapses in ~2-3s wall.
    const fast = page.locator('[data-testid="timeline-speed-20x"]').first();
    if (await fast.count()) await fast.click();
    await page.waitForTimeout(WARM_WALL_MS); // warm: ~20x * 9s ≈ 180s sim-time
    const cv = await page.$eval('canvas[data-camera-position]', el => {
      const d = (el as HTMLElement).dataset;
      return {
        cones: d.beamConeCount, served: d.sinrLiveCellServedCount,
        sinrCones: d.sinrLiveCellBeamConeCount, servingSats: d.sinrLiveCellServingSatCount,
        pair: d.sinrLiveCellHandoverPairConeCount, pulse: d.sinrLiveHandoverPulseConeCount,
        pulseRendered: d.sinrLiveHandoverPulseConeRenderedCount,
      };
    });
    await page.screenshot({ path: join(OUT_DIR, `pulse-${LABEL}-full.png`), fullPage: false });
    await page.locator('canvas[data-camera-position]').first().screenshot({ path: join(OUT_DIR, `pulse-${LABEL}-canvas.png`) });
    console.log(`shot=${LABEL} cones=${cv.cones} sinrCones=${cv.sinrCones} servingSats=${cv.servingSats} served=${cv.served} pair=${cv.pair} pulse=${cv.pulse ?? 'n/a'} pulseRendered=${cv.pulseRendered ?? 'n/a'} consoleErrors=${errs.length}`);
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
