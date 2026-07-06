// Cold first-arm never-fire crack: fresh page, ONE intra arm, capture the DIAG-SEEK
// (seek effect ran) + DIAG-LAND (handleLiveSeekLanded called) console logs + the FSM
// phase. Shows whether the seek effect runs, whether the landing fires, and the guard
// state — localising the cold never-fire.
import { chromium } from '@playwright/test';
const URL = process.env.APP_URL ?? 'http://localhost:3000';
const SHELL = '.leo-app-shell';
const INTRA = '[data-testid="director-intra-focus"]';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const logs: string[] = [];
p.on('console', m => { const t = m.text(); if (t.includes('DIAG-')) logs.push(`+${Date.now() % 100000} ${t}`.slice(0, 180)); });
p.on('pageerror', e => logs.push(`PAGEERROR ${e.message}`.slice(0, 160)));
await p.addInitScript(() => {
  window.localStorage.setItem('leo-beam-sim.scene-topology.v1', JSON.stringify({
    satsPerPlane: null, beamCountPerSatellite: null, cellServingCount: null,
    ueCount: 100, ueDistributionMode: 'random', ueMobilityMode: 'random-walk',
    ueMobilityParams: { speedKmPerSec: 5, waypointCount: 4, manhattanGridSpacingKm: 5 },
    enableUeTrails: null,
  }));
});
await p.goto(`${URL}/?sceneSource=live-sim&appMode=sinr-experiment`, { waitUntil: 'domcontentloaded' });
const phase = async () => p.evaluate(s => document.querySelector(s)?.getAttribute('data-director-phase') ?? null, SHELL);
for (let i = 0; i < 400; i++) {
  const en = await p.evaluate(() => {
    const d = document.querySelector('[data-testid="director-controls"]');
    return d?.getAttribute('data-director-intra-enabled') === '1' && d?.getAttribute('data-director-inter-enabled') === '1';
  });
  if (en) break;
  await new Promise(r => setTimeout(r, 150));
}
// Mirror the gate: read the explainer attrs (Playwright getAttribute) during the
// arming/focus, then check the FSM — the gate's sequence, which my evaluate-only
// chain diag did not replicate.
console.log('=== COLD FIRST ARM ===');
logs.length = 0;
await p.click(INTRA).catch(() => {});
let traj = ''; let prev: string | null = ''; const t0 = Date.now();
let reachedFocused = false; let focusedStart = -1; let focusedEnd = -1;
for (let i = 0; i < 110; i++) {
  await new Promise(r => setTimeout(r, 150));
  const ph = await phase();
  if (ph === 'focused') { reachedFocused = true; if (focusedStart < 0) focusedStart = Date.now() - t0; }
  if (focusedStart >= 0 && focusedEnd < 0 && ph !== 'focused' && ph !== 'acquiring') focusedEnd = Date.now() - t0;
  if (ph !== prev) { traj += ` ${Date.now() - t0}:${ph}`; prev = ph; }
  if (focusedEnd >= 0) break;
  if (i > 60 && ph === 'idle') break;
}
const holdMs = focusedStart >= 0 ? (focusedEnd >= 0 ? focusedEnd - focusedStart : Date.now() - t0 - focusedStart) : 0;
console.log('reachedFocused=', reachedFocused, 'holdMs=', holdMs, 'traj=', traj);
console.log('logs:'); for (const l of logs) console.log('  ', l);
await b.close();
