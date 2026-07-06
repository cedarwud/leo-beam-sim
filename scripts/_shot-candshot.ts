// THROWAWAY (P0.5 pre-flight): screenshot exactly when the candidate footprint mounts.
import { chromium } from '@playwright/test';
const URL = process.env.SHOT_URL ?? 'http://localhost:3000/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2 });
await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(()=>{});
let got = 0;
for (let t = 0; t < 40; t++) {
  await p.waitForTimeout(1500);
  const d = await p.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement | null;
    const ds = c ? c.dataset : ({} as any);
    return { cand: Number(ds.sinrLiveCellCandidateFootprintRenderedCount ?? -1), foot: ds.sinrLiveCellFootprintRingRenderedCount ?? '∅' };
  });
  if (d.cand >= 1) {
    got++;
    console.log(`t=${((t+1)*1.5).toFixed(1)}s cand=${d.cand} foot=${d.foot} -> shot ${got}`);
    const cv = await p.$('canvas');
    if (cv) await cv.screenshot({ path: `output/shot/candshot-${got}.png` });
    if (got >= 2) break;
  }
}
console.log('candidate frames captured =', got);
await b.close();
