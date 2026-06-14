// Test the EXIT_BTN reliability: arm intra, wait for focused, click director-exit-focus,
// check whether phase returns to idle. If it doesn't, the exit button click is broken
// (overlap / actionability) — which forces the gate's teardown onto the auto-restore.
import { chromium } from '@playwright/test';
const URL = process.env.APP_URL ?? 'http://localhost:3000';
const SHELL = '.leo-app-shell';
const INTRA = '[data-testid="director-intra-focus"]';
const EXIT = '[data-testid="director-exit-focus"]';

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
const phase = async () => p.evaluate(s => document.querySelector(s)?.getAttribute('data-director-phase') ?? null, SHELL);
for (let i = 0; i < 400; i++) {
  const en = await p.evaluate(() => document.querySelector('[data-testid="director-controls"]')?.getAttribute('data-director-intra-enabled'));
  if (en === '1') break;
  await new Promise(r => setTimeout(r, 150));
}
for (let arm = 0; arm < 3; arm++) {
  await p.click(INTRA).catch(() => {});
  // wait for focused
  let reached = false;
  for (let i = 0; i < 60; i++) { if (await phase() === 'focused') { reached = true; break; } await new Promise(r => setTimeout(r, 200)); }
  if (!reached) { console.log(`arm ${arm + 1}: never reached focused`); continue; }
  // try to click EXIT
  let clickOk = true; const t0 = Date.now();
  try { await p.click(EXIT, { timeout: 2500 }); } catch (e) { clickOk = false; console.log('  CLICK-ERR', (e instanceof Error ? e.message : String(e)).split('\n').slice(0, 4).join(' | ').slice(0, 280)); }
  const clickMs = Date.now() - t0;
  // did phase go idle within 3s of the click?
  let wentIdle = false;
  for (let i = 0; i < 20; i++) { if (await phase() === 'idle') { wentIdle = true; break; } await new Promise(r => setTimeout(r, 150)); }
  console.log(`arm ${arm + 1}: exitClick=${clickOk ? 'OK' : 'FAILED'}(${clickMs}ms) -> phase=${await phase()} wentIdle=${wentIdle}`);
  // settle
  for (let i = 0; i < 80; i++) { if (await phase() === 'idle') break; await new Promise(r => setTimeout(r, 200)); }
  await new Promise(r => setTimeout(r, 800));
}
await b.close();
