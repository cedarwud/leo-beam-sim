#!/usr/bin/env node
// THROWAWAY: capture sinr-live + modqn-live frames after the main.scss family
// split, to eyeball-diff against the baseline (cascade-flip check). Output
// output/shot/.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const LABEL = process.argv[2] ?? 'split';
const OUT = join('output', 'shot');
const SHELL = '.leo-app-shell';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
    const errs: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SHELL, { timeout: 30_000 });
    await page.waitForSelector('canvas[data-camera-position]', { timeout: 30_000 });
    await page.waitForFunction(() => Number(document.querySelector('canvas[data-camera-position]')?.getAttribute('data-rendered-ue-count') ?? '0') > 0, undefined, { timeout: 90_000 });
    await sleep(7000);
    await page.screenshot({ path: join(OUT, `${LABEL}-sinr-live.png`) });

    await page.click('[data-testid="lane-experience-modqn-live-cell-preview"]');
    await page.waitForSelector(`${SHELL}[data-scene-lane="modqn-live-cell-preview"]`, { timeout: 30_000 });
    await sleep(6000);
    await page.screenshot({ path: join(OUT, `${LABEL}-modqn-live.png`) });
    console.log(`shots done. consoleErrors=${errs.length}${errs.length ? ' :: ' + errs.slice(0, 3).join(' | ') : ''}`);
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
