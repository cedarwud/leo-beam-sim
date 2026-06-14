// Diagnose gate-5 real failure: gate times out waiting for the winner candidate row
// ([data-is-selected="true"]) AFTER selectedCount===1 passed. Tests whether the
// explainer's selected-winner row is STABLE through the focus, or vanishes/flips
// (teardown vs selection churn) — the exact targets the gate reads at lines 138-157.
// Multiple arms to sample the random-walk variability. Needs npx vite dev + APP_URL.
import { chromium } from '@playwright/test';
const URL = process.env.APP_URL ?? 'http://localhost:3000';
const SHELL = '.leo-app-shell';
const CANVAS = 'canvas[data-camera-position]';
const INTRA_BTN = '[data-testid="director-intra-focus"]';
const EXPLAINER = '[data-testid="handover-cinema-sinr-explainer"]';
const ROW = '[data-testid="sinr-candidate-row"]';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs: string[] = [];
p.on('pageerror', e => errs.push(`PAGEERROR ${e.message}`.slice(0, 160)));
await p.addInitScript(() => {
  window.localStorage.setItem('leo-beam-sim.scene-topology.v1', JSON.stringify({
    satsPerPlane: null, beamCountPerSatellite: null, cellServingCount: null,
    ueCount: 100, ueDistributionMode: 'random', ueMobilityMode: 'random-walk',
    ueMobilityParams: { speedKmPerSec: 5, waypointCount: 4, manhattanGridSpacingKm: 5 },
    enableUeTrails: null,
  }));
});
await p.goto(`${URL}/?sceneSource=live-sim&appMode=sinr-experiment`, { waitUntil: 'domcontentloaded' });
// rAF-starvation-safe readiness poll (no waitForSelector).
const snap = async () => p.evaluate(({ ROW, EXPLAINER, SHELL, CANVAS }) => {
  const rows = Array.from(document.querySelectorAll(ROW));
  return {
    phase: document.querySelector(SHELL)?.getAttribute('data-director-phase') ?? null,
    explainer: !!document.querySelector(EXPLAINER),
    intraEn: document.querySelector('[data-testid="director-controls"]')?.getAttribute('data-director-intra-enabled') ?? null,
    simTime: document.querySelector(CANVAS)?.getAttribute('data-sim-time-sec') ?? null,
    hl: document.querySelector(CANVAS)?.getAttribute('data-candidate-handover-highlight-rendered-count') ?? null,
    rowCount: rows.length,
    selectedCount: rows.filter(r => r.getAttribute('data-is-selected') === 'true').length,
    rows: rows.map(r => `${r.getAttribute('data-role')}/sel=${r.getAttribute('data-is-selected')}/sat=${r.getAttribute('data-sat-id')}/cell=${r.getAttribute('data-cell-id')}`),
  };
}, { ROW, EXPLAINER, SHELL, CANVAS });

for (let i = 0; i < 400; i++) { const s = await snap(); if (s.intraEn === '1') break; await new Promise(r => setTimeout(r, 150)); }

for (let arm = 0; arm < 6; arm++) {
  console.log(`\n=== ARM #${arm + 1} ===`);
  await p.click(INTRA_BTN).catch(() => {});
  let sawExplainer = false; let minSel = 99; let maxSel = 0; let focusedFrames = 0;
  let prevLine = '';
  const t0 = Date.now();
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 200));
    const s = await snap();
    if (s.explainer) sawExplainer = true;
    if (s.explainer) { minSel = Math.min(minSel, s.selectedCount); maxSel = Math.max(maxSel, s.selectedCount); }
    if (s.phase === 'focused') focusedFrames++;
    const line = `${s.phase}|exp=${s.explainer}|rows=${s.rowCount}|sel=${s.selectedCount}|hl=${s.hl}`;
    if (line !== prevLine) {
      console.log(`  t+${(Date.now() - t0)}ms ${line}  ${s.explainer ? JSON.stringify(s.rows) : ''}`);
      prevLine = line;
    }
    if (s.phase === 'idle' && i > 8 && sawExplainer) break;
  }
  console.log(`  SUMMARY arm#${arm + 1}: sawExplainer=${sawExplainer} focusedFrames=${focusedFrames} selectedCount range=[${minSel === 99 ? '-' : minSel},${maxSel}] (gate needs ==1 stable)`);
  // settle back to idle before next arm
  for (let i = 0; i < 40; i++) { const s = await snap(); if (s.phase === 'idle' && !s.explainer) break; await new Promise(r => setTimeout(r, 200)); }
}
console.log('\npageErrors:', JSON.stringify(errs.slice(0, 3)));
await b.close();
