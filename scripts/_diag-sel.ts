// Dense-poll the explainer winner-row selection (sel) + focusedEventId + phase to
// catch the brief sel->0 transient the gate trips on (winner-row getAttribute 30s
// timeout). 50ms cadence. Multiple arms to sample.
import { chromium } from '@playwright/test';
const URL = process.env.APP_URL ?? 'http://localhost:3000';
const SHELL = '.leo-app-shell';
const INTRA = '[data-testid="director-intra-focus"]';
const EXPLAINER = '[data-testid="handover-cinema-sinr-explainer"]';
const ROW = '[data-testid="sinr-candidate-row"]';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.addInitScript(() => {
  window.localStorage.setItem('leo-beam-sim.scene-topology.v1', JSON.stringify({
    satsPerPlane: null, beamCountPerSatellite: null, cellServingCount: null,
    ueCount: 100, ueDistributionMode: 'random', ueMobilityMode: 'random-walk',
    ueMobilityParams: { speedKmPerSec: 5, waypointCount: 4, manhattanGridSpacingKm: 5 },
    enableUeTrails: null,
  }));
});
await p.goto(`${URL}/?sceneSource=live-sim&appMode=sinr-experiment`, { waitUntil: 'domcontentloaded' });
const snap = async () => p.evaluate(({ SHELL, ROW, EXPLAINER }) => {
  const rows = Array.from(document.querySelectorAll(ROW));
  return {
    phase: document.querySelector(SHELL)?.getAttribute('data-director-phase') ?? null,
    eid: document.querySelector(SHELL)?.getAttribute('data-live-director-focus-event-id')?.slice(-14) ?? null,
    exp: !!document.querySelector(EXPLAINER),
    rows: rows.length,
    sel: rows.filter(r => r.getAttribute('data-is-selected') === 'true').length,
    intraEn: document.querySelector('[data-testid="director-controls"]')?.getAttribute('data-director-intra-enabled') ?? null,
  };
}, { SHELL, ROW, EXPLAINER });
for (let i = 0; i < 400; i++) { const s = await snap(); if (s.intraEn === '1') break; await new Promise(r => setTimeout(r, 150)); }

for (let arm = 0; arm < 4; arm++) {
  console.log(`\n=== ARM #${arm + 1} ===`);
  await p.click(INTRA).catch(() => {});
  let minSel = 9, sawSel0WhileExp = false, prev = '';
  const t0 = Date.now();
  for (let i = 0; i < 200; i++) {
    await new Promise(r => setTimeout(r, 50));
    const s = await snap();
    if (s.exp) { minSel = Math.min(minSel, s.sel); if (s.sel === 0) sawSel0WhileExp = true; }
    const line = `${s.phase}|exp=${s.exp}|rows=${s.rows}|sel=${s.sel}|eid=${s.eid}`;
    if (line !== prev) { console.log(`  t+${Date.now() - t0}ms ${line}`); prev = line; }
    if (s.phase === 'idle' && i > 30) break;
  }
  console.log(`  arm#${arm + 1}: minSelWhileExp=${minSel === 9 ? '-' : minSel} sawSel0WhileExp=${sawSel0WhileExp} (gate trips if sel=0 while reading)`);
  for (let i = 0; i < 80; i++) { const s = await snap(); if (s.phase === 'idle' && !s.exp) break; await new Promise(r => setTimeout(r, 150)); }
}
await b.close();
