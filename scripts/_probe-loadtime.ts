#!/usr/bin/env node
// THROWAWAY load-time probe. Measures WHERE page-load time goes: network/compile
// vs runtime warm. Run against a WARM vite (reload cost) — note cold-compile is a
// separate one-time first-hit cost. APP_URL=http://localhost:3000.
import { chromium } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const LANE = process.env.LANE ?? 'sinr-live';

async function main(): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
    let biggest: Array<{ url: string; kb: number; ms: number }> = [];
    page.on('response', async r => {
      try {
        const h = r.headers();
        const len = Number(h['content-length'] ?? '0');
        if (len > 80_000) biggest.push({ url: r.url().split('/').slice(-1)[0].slice(0, 50), kb: Math.round(len / 1024), ms: 0 });
      } catch { /* ignore */ }
    });

    const t0 = Date.now();
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    const tDom = Date.now() - t0;
    await page.waitForSelector('.leo-app-shell', { timeout: 60_000 });
    const tShell = Date.now() - t0;
    // Switch to the live lane (user's first interaction).
    await page.click(`[data-testid="lane-experience-${LANE}"]`).catch(() => {});
    await page.waitForSelector(`.leo-app-shell[data-scene-lane="${LANE}"]`, { timeout: 30_000 }).catch(() => {});
    const tLane = Date.now() - t0;
    await page.waitForSelector('canvas[data-camera-position]', { timeout: 60_000 });
    const tCanvas = Date.now() - t0;
    let tUe = -1;
    try {
      await page.waitForFunction(() => {
        const c = document.querySelector('canvas[data-camera-position]');
        return Number(c?.getAttribute('data-rendered-ue-count') ?? '0') > 0;
      }, undefined, { timeout: 120_000 });
      tUe = Date.now() - t0;
    } catch { tUe = -1; }

    const nav = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const res = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      return {
        domInteractive: n ? Math.round(n.domInteractive) : null,
        domComplete: n ? Math.round(n.domComplete) : null,
        transferTotalKb: Math.round(res.reduce((s, r) => s + (r.transferSize || 0), 0) / 1024),
        decodedTotalKb: Math.round(res.reduce((s, r) => s + (r.decodedBodySize || 0), 0) / 1024),
        resourceCount: res.length,
        slowest: res.map(r => ({ n: r.name.split('/').slice(-1)[0].slice(0, 40), ms: Math.round(r.duration) }))
          .sort((a, b) => b.ms - a.ms).slice(0, 8),
      };
    });

    console.log(JSON.stringify({
      milestones_ms: { domcontentloaded: tDom, appShell: tShell, laneSwitched: tLane, canvasPresent: tCanvas, ueRendered: tUe },
      navTiming: { domInteractive: nav.domInteractive, domComplete: nav.domComplete },
      weight: { transferTotalKb: nav.transferTotalKb, decodedTotalKb: nav.decodedTotalKb, resourceCount: nav.resourceCount },
      slowestResources: nav.slowest,
      bigResponses: biggest.sort((a, b) => b.kb - a.kb).slice(0, 8),
    }, null, 2));
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
