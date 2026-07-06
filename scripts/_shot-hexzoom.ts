// THROWAWAY: confirm footprint-hex telemetry + capture a zoomed ground crop.
import { chromium } from '@playwright/test';
const URL = process.env.SHOT_URL ?? 'http://localhost:3000/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2 });
const errs: string[] = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(()=>{});
await p.waitForTimeout(8000);
const ds = await p.evaluate(() => {
  const c = document.querySelector('canvas');
  const d = c ? { ...(c as HTMLCanvasElement).dataset } : {};
  const keys = Object.keys(d).filter(k => /footprint|Footprint|coneRendered|ConeRendered|servingCone|candidateCone/i.test(k));
  const out: Record<string,string> = {};
  for (const k of keys) out[k] = (d as any)[k];
  return out;
});
console.log('FOOTPRINT/CONE TELEMETRY:', JSON.stringify(ds, null, 2));
console.log('consoleErrors=', errs.length, errs.slice(0,3).join(' | '));
// full canvas at 2x
const cv = await p.$('canvas');
if (cv) await cv.screenshot({ path: 'output/shot/hexzoom-canvas2x.png' });
// zoomed ground crop (centre-lower region where the cells sit)
await p.screenshot({ path: 'output/shot/hexzoom-crop.png', clip: { x: 360, y: 280, width: 960, height: 620 } });
await b.close();
