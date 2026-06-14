// Accurate load-time probe. Polls via setTimeout + evaluate (NOT Playwright
// waitForFunction): the app's continuous R3F rAF loop starves rAF-based polling and
// inflates waitForFunction times by seconds, so a wall-clock setTimeout poll reads
// the true "when did the pixel/UE appear" milestones. Used for honest before/after.
import { chromium } from '@playwright/test';
const URL = process.env.APP_URL ?? 'http://localhost:4173';
const TARGET = Number(process.env.UE_TARGET ?? '100');
const RUNS = Number(process.env.RUNS ?? '3');

async function once(): Promise<Record<string, number>> {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1680, height: 1050 } });
  const t0 = Date.now();
  await p.goto(URL, { waitUntil: 'domcontentloaded' });
  const m: Record<string, number> = { shell: -1, canvas: -1, firstPaint: -1, ue25: -1, fullPop: -1, index: -1 };
  for (let i = 0; i < 200; i++) {
    const s = await p.evaluate(() => {
      const cv = document.querySelector('canvas[data-camera-position]');
      const d = document.querySelector('[data-testid="director-controls"]');
      return {
        shell: !!document.querySelector('.leo-app-shell'),
        canvas: !!cv,
        ue: Number(cv?.getAttribute('data-rendered-ue-count') ?? '0'),
        index: d?.getAttribute('data-director-inter-enabled') === '1' || d?.getAttribute('data-director-intra-enabled') === '1',
      };
    }).catch(() => ({ shell: false, canvas: false, ue: 0, index: false }));
    const t = Date.now() - t0;
    if (m.shell < 0 && s.shell) m.shell = t;
    if (m.canvas < 0 && s.canvas) m.canvas = t;
    if (m.firstPaint < 0 && s.ue >= 1) m.firstPaint = t;
    if (m.ue25 < 0 && s.ue >= 25) m.ue25 = t;
    if (m.fullPop < 0 && s.ue >= TARGET) m.fullPop = t;
    if (m.index < 0 && s.index) m.index = t;
    if (m.fullPop >= 0 && m.index >= 0) break;
    await new Promise(r => setTimeout(r, 150));
  }
  await b.close();
  return m;
}

const all: Record<string, number>[] = [];
for (let r = 0; r < RUNS; r++) { const m = await once(); all.push(m); console.log(`run ${r + 1}: ${JSON.stringify(m)}`); }
const med = (k: string): number => { const xs = all.map(a => a[k]).filter(x => x >= 0).sort((a, b) => a - b); return xs.length ? xs[Math.floor(xs.length / 2)] : -1; };
console.log(`MEDIAN: firstPaint=${med('firstPaint')}ms ue25=${med('ue25')}ms fullPop=${med('fullPop')}ms index=${med('index')}ms`);
