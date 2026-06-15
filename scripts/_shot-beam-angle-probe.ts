#!/usr/bin/env node
// THROWAWAY probe: capture SINR-live vs MODQN-live to inspect spine-particle /
// beam ground-target angles ("balls thrown parallel off-field"). Multi-frame so
// the moving balls trace the beam lines.
//   APP_URL=http://localhost:3000 node --import tsx/esm scripts/_shot-beam-angle-probe.ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Page } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const OUT_DIR = join('output', 'beam-angle-probe');
const SHELL = '.leo-app-shell';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage: false });
}
async function canvasData(page: Page): Promise<Record<string, string | undefined>> {
  return page.$eval('canvas[data-camera-position]', el => ({ ...(el as HTMLElement).dataset })).catch(() => ({}));
}
async function waitPainted(page: Page): Promise<void> {
  await page.waitForSelector(SHELL, { timeout: 30_000 });
  await page.waitForSelector('canvas[data-camera-position]', { timeout: 30_000 });
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas[data-camera-position]');
    return Number(c?.getAttribute('data-rendered-ue-count') ?? '0') > 0;
  }, undefined, { timeout: 90_000 });
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const log: Record<string, unknown> = {};
  const errs: string[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await waitPainted(page);
    await sleep(6000);
    await shot(page, '01-sinr-a');
    log['sinr_spine_count'] = await page.$eval('canvas', () => {
      // count spine particle meshes is not exposed; capture dataset instead
      const c = document.querySelector('canvas[data-camera-position]') as HTMLElement | null;
      return c?.dataset.uploadParticleRenderedCount ?? 'n/a';
    }).catch(() => 'n/a');
    log['01_sinr'] = await canvasData(page);
    await sleep(1500); await shot(page, '01-sinr-b');
    await sleep(1500); await shot(page, '01-sinr-c');

    // MODQN
    await page.click('[data-testid="lane-experience-modqn-live-cell-preview"]');
    await page.waitForSelector(`${SHELL}[data-scene-lane="modqn-live-cell-preview"]`, { timeout: 30_000 });
    await sleep(6000);
    await shot(page, '02-modqn-a');
    log['02_modqn'] = await canvasData(page);
    await sleep(1500); await shot(page, '02-modqn-b');
    await sleep(1500); await shot(page, '02-modqn-c');

    // fast-forward MODQN to spread balls / trigger hops
    const fast = page.locator('[data-testid="timeline-speed-20x"]').first();
    if (await fast.count()) { await fast.click(); }
    await sleep(4000); await shot(page, '02-modqn-warm-a');
    await sleep(2000); await shot(page, '02-modqn-warm-b');

    log['consoleErrors'] = errs.slice(0, 20);
    await writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify(log, null, 2));
    console.log('PROBE DONE', JSON.stringify({ errs: errs.length }));
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
