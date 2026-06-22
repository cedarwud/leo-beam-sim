#!/usr/bin/env node
/**
 * shot.ts — the FAST pixel-proof for the non-structural fast-path
 * (docs/frontend-change-contract.md → "Fast-path — NON-STRUCTURAL changes").
 *
 * Captures the live :3000 scene to output/shot/<label>-{canvas,full}.png so a
 * colour / CSS / text / camera-pose tweak can be EYEBALLED in ~15s — instead of the
 * ~11min `validate:ready` browser smoke (6 serialized headless-Chrome WebGL tests),
 * which a non-structural change cannot break anyway.
 *
 * Tolerant by design: if vite is not on :3000 (or chromium can't launch) it WARNS and
 * exits 0 — the `validate:governance` gate is the pass/fail; THIS is the eyeball step
 * that needs a running app. Run it via `npm run validate:visual` (governance + this),
 * or standalone: `node --import tsx/esm scripts/shot.ts <label>` (SHOT_URL overrides).
 */
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const URL = process.env.SHOT_URL ?? 'http://localhost:3000/';
const LABEL = process.argv[2] ?? 'visual';
const OUT = join('output', 'shot');

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  // Fast reachability pre-check (≈instant when vite is down) so we never pay a 30s
  // browser goto-timeout just to discover the app isn't running.
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(URL, { signal: ctrl.signal });
    clearTimeout(t);
    await r.body?.cancel?.();
  } catch {
    console.warn(`[shot] ${URL} not reachable — start vite (npm run dev) for the pixel check. The governance gate already ran.`);
    return;
  }
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.warn(`[shot] chromium did not launch (${(e as Error).message}) — pixel proof SKIPPED. The governance gate already ran.`);
    return;
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
    const errs: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    // `domcontentloaded` (NOT `networkidle`): a live 3D SPA never goes network-idle
    // (rAF / HMR keep traffic up), so networkidle would always time out. Ignore the goto
    // result; the <canvas> check below is the real "did the scene mount" test.
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(7000); // let the scene warm + serving acquire
    const canvas = await page.$('canvas');
    if (canvas === null) {
      console.warn(`[shot] no <canvas> at ${URL} — is vite running + the scene mounted? (npm run dev). Pixel proof SKIPPED; governance already ran.`);
      return;
    }
    await page.screenshot({ path: join(OUT, `${LABEL}-full.png`), fullPage: false });
    await canvas.screenshot({ path: join(OUT, `${LABEL}-canvas.png`) });
    console.log(`[shot] captured output/shot/${LABEL}-{canvas,full}.png · consoleErrors=${errs.length}${errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''}`);
    console.log('[shot] LOOK at the PNG — that IS the pixel proof for the non-structural fast-path (no need for the ~11min validate:ready).');
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.warn(`[shot] ${(e as Error).message}`); });
