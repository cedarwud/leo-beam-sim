#!/usr/bin/env node
// THROWAWAY audit: capture sinr-live current render state + sample telemetry over
// time to measure the 4 axes (sat count / HO frequency / cone style / served mosaic).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const OUT_DIR = join('output', 'audit-sinr-live');
const SHELL = '.leo-app-shell';
const SAMPLES = 8;
const INTERVAL_MS = 4000;

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
    const consoleErrors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SHELL, { timeout: 20_000 });
    const lane = await page.getAttribute(SHELL, 'data-scene-lane');
    await page.waitForSelector('canvas[data-camera-position]', { timeout: 30_000 });
    await page.waitForFunction(() => {
      const c = document.querySelector('canvas[data-camera-position]');
      const n = Number(c?.getAttribute('data-rendered-ue-count') ?? '0');
      return Number.isFinite(n) && n > 0;
    }, undefined, { timeout: 90_000 });
    await page.waitForTimeout(1500);

    const readFrame = async () => page.evaluate(() => {
      const c = document.querySelector('canvas[data-camera-position]') as HTMLElement | null;
      const agg = document.querySelector('[data-testid="sinr-serving-aggregate"]') as HTMLElement | null;
      const aggText = (document.querySelector('[data-testid="sinr-serving-served-readout"]') as HTMLElement | null)?.textContent ?? null;
      return {
        canvas: c ? { ...c.dataset } : null,
        aggregate: agg ? { ...agg.dataset } : null,
        servedText: aggText,
      };
    });

    // first screenshot
    await page.screenshot({ path: join(OUT_DIR, 'sinr-live-00-full.png'), fullPage: false });
    await page.locator('canvas[data-camera-position]').first().screenshot({ path: join(OUT_DIR, 'sinr-live-00-canvas.png') });

    const series: any[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      series.push({ t: i * INTERVAL_MS, ...(await readFrame()) });
      if (i < SAMPLES - 1) await page.waitForTimeout(INTERVAL_MS);
    }

    // last screenshot
    await page.screenshot({ path: join(OUT_DIR, 'sinr-live-99-full.png'), fullPage: false });
    await page.locator('canvas[data-camera-position]').first().screenshot({ path: join(OUT_DIR, 'sinr-live-99-canvas.png') });

    await writeFile(join(OUT_DIR, 'series.json'), `${JSON.stringify({ lane, consoleErrors, series }, null, 2)}\n`, 'utf8');

    // compact console summary
    console.log(`lane=${lane} consoleErrors=${consoleErrors.length}`);
    const keys = ['renderedUeCount', 'beamConeCount', 'sinrServingMosaicColorCount', 'satelliteCount', 'renderedSatelliteCount'];
    for (const s of series) {
      const cv = s.canvas ?? {};
      const ag = s.aggregate ?? {};
      console.log(`t=${String(s.t).padStart(6)}ms served=${s.servedText ?? '?'} avgSinr=${ag.avgSinrDb ?? '?'} cones=${cv.beamConeCount ?? '?'} mosaicColors=${cv.sinrServingMosaicColorCount ?? '?'} ue=${cv.renderedUeCount ?? '?'}`);
    }
    // dump all canvas keys once for discovery
    if (series[0]?.canvas) console.log('CANVAS_KEYS:', Object.keys(series[0].canvas).join(','));
    if (series[0]?.aggregate) console.log('AGG_KEYS:', Object.keys(series[0].aggregate).join(','));
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
