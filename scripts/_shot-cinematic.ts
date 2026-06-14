#!/usr/bin/env node
// THROWAWAY cinematic taste-tune capture (B1). Drives a LIVE lane, arms HO Focus,
// records the cinematic FSM + fade timeline + key frames so the user can judge
// LEAD_IN/LEAD_OUT/fade/framing. Output output/cinematic/.
//   APP_URL=http://localhost:3000 LANE=sinr-live KIND=inter \
//     node --import tsx/esm scripts/_shot-cinematic.ts label
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Page } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const LANE = process.env.LANE ?? 'sinr-live';
const KIND = process.env.KIND ?? 'inter'; // intra | inter
// SRC=artifact-replay -> drive the artifact-replay lane via ?sceneSource URL
// (branch-1 cinematic-window path), skipping the live lane-button + UE-count gate.
const SRC = process.env.SRC ?? '';
const LABEL = process.argv[2] ?? 'now';
const OUT_DIR = join('output', 'cinematic');
const SHELL = '.leo-app-shell';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Sample { t: number; dp: string | null; fp: string | null; bg: string }

// Single-level anonymous arrow, no inner named fns -> no tsx __name wrap.
async function readState(page: Page): Promise<Sample> {
  const s = await page.evaluate(() => {
    const dc = document.querySelector('[data-testid="director-controls"]');
    const ov = document.querySelector('[data-testid="cinematic-seek-fade-overlay"]');
    return {
      dp: dc ? dc.getAttribute('data-director-phase') : null,
      fp: ov ? ov.getAttribute('data-fade-phase') : null,
      bg: ov ? getComputedStyle(ov).backgroundColor : '',
    };
  }).catch(() => ({ dp: null, fp: null, bg: '' }));
  return { t: 0, ...s };
}

async function sampleFor(page: Page, ms: number, t0: number, out: Sample[]): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const s = await readState(page);
    out.push({ ...s, t: Date.now() - t0 });
    await sleep(60);
  }
}

async function snap(page: Page, name: string): Promise<void> {
  const s = await readState(page);
  await page.screenshot({ path: join(OUT_DIR, `${LABEL}-${name}.png`), fullPage: false });
  console.log(`  shot ${name}: directorPhase=${s.dp} fade=${s.fp}`);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const errs: string[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

    const targetLane = SRC || LANE;
    const gotoUrl = SRC ? `${APP_URL}/?sceneSource=${SRC}` : APP_URL;
    await page.goto(gotoUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SHELL, { timeout: 30_000 });

    if (!SRC) {
      await page.click(`[data-testid="lane-experience-${LANE}"]`);
    }
    await page.waitForSelector(`${SHELL}[data-scene-lane="${targetLane}"]`, { timeout: 30_000 });
    if (SRC) {
      // Artifact-replay: wait for the director controls to arm (artifact streamed
      // + replayController ready); no live UE-count gate on the replay scene.
      await page.waitForSelector('[data-testid="director-controls"]', { timeout: 30_000 });
      console.log(`lane=${targetLane} (artifact-replay) ready; waiting for events...`);
    } else {
      await page.waitForSelector('canvas[data-camera-position]', { timeout: 30_000 });
      await page.waitForFunction(() => {
        const c = document.querySelector('canvas[data-camera-position]');
        return Number(c?.getAttribute('data-rendered-ue-count') ?? '0') > 0;
      }, undefined, { timeout: 90_000 });
      console.log(`lane=${targetLane} ready; warming sim for live HO events...`);
    }

    const enabledAttr = KIND === 'intra' ? 'data-director-intra-enabled' : 'data-director-inter-enabled';
    let enabled = false;
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      const v = await page.locator('[data-testid="director-controls"]').getAttribute(enabledAttr).catch(() => null);
      if (v === '1') { enabled = true; break; }
      await sleep(750);
    }
    const controls = await page.$eval('[data-testid="director-controls"]', el => ({
      phase: (el as HTMLElement).dataset.directorPhase,
      intra: (el as HTMLElement).dataset.directorIntraEnabled,
      inter: (el as HTMLElement).dataset.directorInterEnabled,
    })).catch(() => null);
    console.log(`director-controls: ${JSON.stringify(controls)} (${KIND} enabled=${enabled})`);

    await snap(page, '00-baseline');
    if (!enabled) {
      console.log(`WARN: ${KIND}-HO Focus never enabled in 90s. Capturing baseline only.`);
      await writeFile(join(OUT_DIR, `${LABEL}-timeline.json`), JSON.stringify({ enabled, controls, errs }, null, 2));
      return;
    }

    const samples: Sample[] = [];
    const t0 = Date.now();
    console.log(`clicking ${KIND}-HO Focus...`);
    await page.click(`[data-testid="director-${KIND}-focus"]`);

    // Fast 300ms fade: sample tightly + grab a frame mid-fade.
    await sampleFor(page, 260, t0, samples);
    await snap(page, '01-fade');
    await sampleFor(page, 500, t0, samples);
    await snap(page, '02-postseek');
    await sampleFor(page, 2300, t0, samples);
    await snap(page, '03-slowmo-3s');
    await sampleFor(page, 5000, t0, samples);
    await snap(page, '04-slowmo-8s');
    await sampleFor(page, 7000, t0, samples);
    await snap(page, '05-slowmo-15s');

    // Watch for auto-restore (phase back to idle) up to ~17s more.
    let restoredAtMs: number | null = null;
    const watchDeadline = Date.now() + 17_000;
    while (Date.now() < watchDeadline) {
      const s = await readState(page);
      samples.push({ ...s, t: Date.now() - t0 });
      if (s.dp === 'idle') { restoredAtMs = Date.now() - t0; break; }
      await sleep(400);
    }
    await snap(page, '06-end');

    // Compress: keep samples where dp|fp changes, plus every ~500ms.
    const compact: Sample[] = [];
    let prevKey = '';
    let lastT = -1000;
    for (const s of samples) {
      const key = `${s.dp}|${s.fp}`;
      if (key !== prevKey || s.t - lastT >= 500) { compact.push(s); prevKey = key; lastT = s.t; }
    }
    await writeFile(join(OUT_DIR, `${LABEL}-timeline.json`), JSON.stringify({
      enabled, controls, autoRestoredSec: restoredAtMs === null ? null : restoredAtMs / 1000,
      samples: compact, consoleErrors: errs,
    }, null, 2));
    console.log(`autoRestored=${restoredAtMs !== null}${restoredAtMs !== null ? ` @${(restoredAtMs / 1000).toFixed(1)}s` : ''}  samples=${compact.length}  consoleErrors=${errs.length}`);
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
