import { chromium } from '@playwright/test';
const URL = process.env.SHOT_URL ?? 'http://localhost:3000/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2 });
const errs: string[] = [];
p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(()=>{});
let best = -1;
for (let t=0; t<22; t++) {
  await p.waitForTimeout(1500);
  const d = await p.evaluate(() => {
    const c = document.querySelector('canvas') as HTMLCanvasElement | null;
    const ds = c ? c.dataset : ({} as any);
    return {
      foot: ds.sinrLiveCellFootprintRingRenderedCount ?? '∅',
      cand: ds.sinrLiveCellCandidateFootprintRenderedCount ?? '∅',
      cone: ds.sinrLiveCellBeamConeCount ?? '∅',
      serv: ds.sinrLiveCellServingSatCount ?? '∅',
      ssid: ds.servingSatelliteId ?? '∅',
    };
  });
  console.log(`t=${((t+1)*1.5).toFixed(1)}s foot=${d.foot} cand=${d.cand} cone=${d.cone} servSat=${d.serv} ssid=${d.ssid}`);
  const fn = Number(d.foot);
  if (Number.isFinite(fn) && fn > best) {
    best = fn;
    const cv = await p.$('canvas');
    if (cv) await cv.screenshot({ path: 'output/shot/hexpoll-best.png' });
    await p.screenshot({ path: 'output/shot/hexpoll-crop.png', clip: { x: 360, y: 240, width: 1000, height: 680 } });
  }
}
console.log('BEST footprint count =', best, ' consoleErrors=', errs.length);
await b.close();
