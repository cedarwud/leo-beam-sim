#!/usr/bin/env node
// THROWAWAY baseline capture for the frontend-overhaul session. Captures the
// primary surfaces so we have a before-picture to compare every visual change
// against. Output output/frontend-baseline/.
//   APP_URL=http://localhost:3000 node --import tsx/esm scripts/_shot-baseline.ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Page } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const OUT_DIR = join('output', 'frontend-baseline');
const SHELL = '.leo-app-shell';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage: false });
}

async function canvasData(page: Page): Promise<Record<string, string | undefined>> {
  return page.$eval('canvas[data-camera-position]', el => ({ ...(el as HTMLElement).dataset })).catch(() => ({}));
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const log: Record<string, unknown> = {};
  const errs: string[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

    // --- 1. sinr-live default (settled) ---
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SHELL, { timeout: 30_000 });
    await page.waitForSelector('canvas[data-camera-position]', { timeout: 30_000 });
    await page.waitForFunction(() => {
      const c = document.querySelector('canvas[data-camera-position]');
      return Number(c?.getAttribute('data-rendered-ue-count') ?? '0') > 0;
    }, undefined, { timeout: 90_000 });
    await sleep(8000);
    await shot(page, '01-sinr-live-default');
    log['01_sinr_default'] = await canvasData(page);

    // --- 2. sinr-live warm (fast-forward to fire handover pulse + settle mosaic) ---
    const fast = page.locator('[data-testid="timeline-speed-20x"]').first();
    if (await fast.count()) { await fast.click(); }
    await sleep(9000);
    await shot(page, '02-sinr-live-warm');
    log['02_sinr_warm'] = await canvasData(page);

    // --- 3. sinr-live + arm inter-HO cinema ---
    // restore 1x first so the cinema slow-mo reads naturally
    const oneX = page.locator('[data-testid="timeline-speed-1x"]').first();
    if (await oneX.count()) { await oneX.click(); }
    await sleep(1000);
    let armed = false;
    const dl = Date.now() + 60_000;
    while (Date.now() < dl) {
      const v = await page.locator('[data-testid="director-controls"]').getAttribute('data-director-inter-enabled').catch(() => null);
      if (v === '1') { armed = true; break; }
      await sleep(750);
    }
    log['cinema_inter_enabled'] = armed;
    if (armed) {
      await page.click('[data-testid="director-inter-focus"]');
      await sleep(900);
      await shot(page, '03-cinema-fade');
      await sleep(3000);
      await shot(page, '04-cinema-slowmo');
      log['cinema_phase'] = await page.locator('[data-testid="director-controls"]').getAttribute('data-director-phase').catch(() => null);
      // exit
      await page.click('[data-testid="director-exit-focus"]').catch(() => {});
      await sleep(1500);
    }

    // --- 4. MODQN tab ---
    await page.click('[data-testid="lane-experience-modqn-live-cell-preview"]');
    await page.waitForSelector(`${SHELL}[data-scene-lane="modqn-live-cell-preview"]`, { timeout: 30_000 });
    await sleep(6000);
    await shot(page, '05-modqn-live');
    log['05_modqn'] = await canvasData(page);

    log['consoleErrors'] = errs.slice(0, 20);
    await writeFile(join(OUT_DIR, 'baseline-meta.json'), JSON.stringify(log, null, 2));
    console.log('BASELINE DONE');
    console.log(JSON.stringify({ armed, errs: errs.length }, null, 2));
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
