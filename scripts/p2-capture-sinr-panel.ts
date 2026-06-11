#!/usr/bin/env node
// S5-2b throwaway: capture the sinr-live InfoPanel (ACTIVE SERVING card) — the
// before/after surface for the cell-truth re-point. Outputs to output/p2/.
// Run warm vite on :3000: APP_URL=http://localhost:3000 LABEL=after node ... p2-capture-sinr-panel.ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const LABEL = process.env.LABEL ?? 'after';
const OUT_DIR = join('output', 'p2');
const SHELL = '.leo-app-shell';

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SHELL, { timeout: 30_000 });
    const lane = await page.getAttribute(SHELL, 'data-scene-lane');
    await page.waitForSelector('canvas[data-camera-position]', { timeout: 30_000 });
    await page.waitForFunction(() => {
      const c = document.querySelector('canvas[data-camera-position]');
      const n = Number(c?.getAttribute('data-rendered-ue-count') ?? '0');
      return Number.isFinite(n) && n > 0;
    }, undefined, { timeout: 90_000 });
    await page.waitForTimeout(2500); // let the panel latch a stable serving frame

    const panel = page.locator('.leo-info-panel').first();
    const present = await panel.count();
    if (present === 0) {
      console.log(`WARN lane=${lane} no .leo-info-panel mounted — dumping full shell`);
      await page.screenshot({ path: join(OUT_DIR, `sinr-panel-${LABEL}-FULL.png`), fullPage: true });
    } else {
      await panel.screenshot({ path: join(OUT_DIR, `sinr-panel-${LABEL}.png`) });
    }
    const text = present > 0 ? (await panel.innerText()).replace(/\s+/g, ' ').trim() : '(no panel)';
    const servingIdentity = await page.locator('[data-testid="info-panel-primary-beam-identity"]').first().innerText().catch(() => '?');
    const comparisonIdentity = await page.locator('[data-testid="info-panel-comparison-beam-identity"]').first().innerText().catch(() => '?');
    await writeFile(
      join(OUT_DIR, `sinr-panel-${LABEL}.json`),
      `${JSON.stringify({ lane, servingIdentity, comparisonIdentity, panelText: text }, null, 2)}\n`,
      'utf8',
    );
    console.log(`PASS label=${LABEL} lane=${lane}`);
    console.log(`  serving=${servingIdentity}`);
    console.log(`  comparison=${comparisonIdentity}`);
    console.log(`  panel="${text.slice(0, 360)}"`);
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
