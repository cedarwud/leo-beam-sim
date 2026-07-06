#!/usr/bin/env node
// THROWAWAY: capture the HO-Slow readout idle, then poll until a handover makes it
// "applied" (data-auto-slow-applied=1) and capture that too. Proves the slow shows.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const URL = process.env.SHOT_URL ?? 'http://localhost:3000/';
const OUT = join('output', 'shot');

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
    await page.waitForSelector('[data-testid="ho-slow-status"]', { timeout: 30_000 });
    await page.waitForTimeout(3000);
    const idleText = await page.$eval('[data-testid="ho-slow-status"]', el => el.textContent ?? '');
    await page.screenshot({ path: join(OUT, 'hoslow-idle-full.png'), fullPage: false });
    let applied = false;
    let appliedText = '';
    const deadline = 120_000;
    const start = await page.evaluate(() => performance.now());
    while (true) {
      const st = await page.$eval('[data-testid="ho-slow-status"]', el => ({
        applied: el.getAttribute('data-auto-slow-applied'),
        active: el.getAttribute('data-auto-slow-active'),
        text: el.textContent ?? '',
      }));
      if (st.applied === '1') {
        applied = true;
        appliedText = st.text;
        await page.screenshot({ path: join(OUT, 'hoslow-applied-full.png'), fullPage: false });
        break;
      }
      const now = await page.evaluate(() => performance.now());
      if (now - start > deadline) break;
      await page.waitForTimeout(400);
    }
    console.log(`idle="${idleText.trim()}" appliedCaught=${applied} applied="${appliedText.trim()}"`);
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
