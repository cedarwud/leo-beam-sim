// TEMP: why is the candidate highlight not mounting (hl=null) during a held focus?
// Reads the temp gating probe (diagShowHl/diagCandHl/diagCinMode) + phase + hl count.
import { chromium } from '@playwright/test';
const URL = process.env.APP_URL ?? 'http://localhost:3000';
const SHELL = '.leo-app-shell';
const CANVAS = 'canvas[data-camera-position]';
const INTRA = '[data-testid="director-intra-focus"]';
const EXPLAINER = '[data-testid="handover-cinema-sinr-explainer"]';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs: string[] = [];
p.on('pageerror', e => errs.push(`PAGEERROR ${e.message}`.slice(0, 200)));
p.on('console', m => { if (m.type() === 'error') errs.push(`CONSOLE ${m.text()}`.slice(0, 200)); });
await p.addInitScript(() => {
  window.localStorage.setItem('leo-beam-sim.scene-topology.v1', JSON.stringify({
    satsPerPlane: null, beamCountPerSatellite: null, cellServingCount: null,
    ueCount: 100, ueDistributionMode: 'random', ueMobilityMode: 'random-walk',
    ueMobilityParams: { speedKmPerSec: 5, waypointCount: 4, manhattanGridSpacingKm: 5 },
    enableUeTrails: null,
  }));
});
await p.goto(`${URL}/?sceneSource=live-sim&appMode=sinr-experiment`, { waitUntil: 'domcontentloaded' });
const snap = async () => p.evaluate(({ SHELL, CANVAS }) => {
  const cv = document.querySelector(CANVAS);
  return {
    phase: document.querySelector(SHELL)?.getAttribute('data-director-phase') ?? null,
    showHl: cv?.getAttribute('data-diag-show-hl') ?? null,
    candHl: cv?.getAttribute('data-diag-cand-hl') ?? null,
    cinMode: cv?.getAttribute('data-diag-cin-mode') ?? null,
    hl: cv?.getAttribute('data-candidate-handover-highlight-rendered-count') ?? null,
    hlGroup: cv?.getAttribute('data-diag-hl-group') ?? null,
    hlRaw: cv?.getAttribute('data-diag-hl-raw') ?? null,
    intraEn: document.querySelector('[data-testid="director-controls"]')?.getAttribute('data-director-intra-enabled') ?? null,
  };
}, { SHELL, CANVAS });
for (let i = 0; i < 400; i++) { const s = await snap(); if (s.intraEn === '1') break; await new Promise(r => setTimeout(r, 150)); }
await p.click(INTRA).catch(() => {});
try { await p.waitForSelector(EXPLAINER, { timeout: 12000 }); } catch { console.log('no explainer'); }
console.log('t / phase / showHl / candHl / cinMode / hl');
let prev = '';
for (let i = 0; i < 70; i++) {
  await new Promise(r => setTimeout(r, 200));
  const s = await snap();
  const line = `${s.phase}|showHl=${s.showHl}|candHl=${s.candHl}|cin=${s.cinMode}|hl=${s.hl}|grp=${s.hlGroup}|raw=${s.hlRaw}`;
  if (line !== prev) { console.log(`  t+${(i + 1) * 200}ms ${line}`); prev = line; }
  if (s.phase === 'idle' && i > 10) break;
}
console.log('ERRORS:', JSON.stringify(errs.slice(0, 6), null, 2));
await b.close();
