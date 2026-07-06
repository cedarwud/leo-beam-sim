#!/usr/bin/env node
// THROWAWAY: poll the sinr-live canvas telemetry for the SEMANTIC events — a blue
// candidate cone + an orange→green triggered-intra flip — and screenshot the frame each
// first fires, so the semantic palette is PIXEL-verified (not just gate-green). domcontent
// (not networkidle — R3F never idles). node --import tsx scripts/_shot-semantic.ts
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
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
    await page.waitForSelector('canvas', { timeout: 30_000 });
    await page.waitForTimeout(8000); // warm

    let maxCand = 0, maxTrig = 0, maxPulse = 0;
    let candShot = false, trigShot = false;
    const start = await page.evaluate(() => performance.now());
    for (let i = 0; i < 600; i += 1) {
      const d = await page.evaluate(() => {
        const cv = document.querySelector('canvas') as HTMLCanvasElement | null;
        const ds = cv ? cv.dataset : ({} as DOMStringMap);
        return {
          cand: Number(ds.sinrLiveCellCandidateConeRenderedCount ?? '0'),
          trig: Number(ds.sinrLiveTriggeredIntraConeRenderedCount ?? '0'),
          pulse: Number(ds.sinrLiveHandoverPulseConeRenderedCount ?? '0'),
        };
      });
      maxCand = Math.max(maxCand, d.cand);
      maxTrig = Math.max(maxTrig, d.trig);
      maxPulse = Math.max(maxPulse, d.pulse);
      if (d.cand > 0 && !candShot) {
        await page.screenshot({ path: join(OUT, 'sem-candidate-full.png') });
        const cv = await page.$('canvas'); if (cv) await cv.screenshot({ path: join(OUT, 'sem-candidate-canvas.png') });
        candShot = true;
        console.log(`CANDIDATE blue captured: cand=${d.cand}`);
      }
      if (d.trig > 0 && !trigShot) {
        await page.screenshot({ path: join(OUT, 'sem-flip-full.png') });
        const cv = await page.$('canvas'); if (cv) await cv.screenshot({ path: join(OUT, 'sem-flip-canvas.png') });
        trigShot = true;
        console.log(`TRIGGERED-INTRA orange→green flip captured: trig=${d.trig}`);
      }
      if (candShot && trigShot) break;
      const now = await page.evaluate(() => performance.now());
      if (now - start > 185_000) break;
      await page.waitForTimeout(200);
    }
    console.log(`maxCandidate=${maxCand} maxTriggeredIntra=${maxTrig} maxPulse=${maxPulse} candShot=${candShot} trigShot=${trigShot}`);
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
