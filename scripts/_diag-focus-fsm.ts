// Diagnose #2: live intra-focus FSM instability. Polls the director FSM trajectory
// densely FROM the click (not after explainer asserts), dumping phase + focus
// event-sec + seek target + sim-time + speed, so we see whether fire happens, the
// seek direction (forward/backward vs the arm-time cursor), and how long `focused`
// holds. Set BTN=inter to compare the stable path. Run after `npx vite dev`.
import { chromium } from '@playwright/test';
const URL = process.env.APP_URL ?? 'http://localhost:3010';
const KIND = process.env.BTN === 'inter' ? 'inter' : 'intra';
const BTN = `[data-testid="director-${KIND}-focus"]`;
const SHELL = '.leo-app-shell';
const CANVAS = 'canvas[data-camera-position]';

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

// Poll for canvas + the kind-enabled flag WITHOUT waitForSelector (rAF-starvation safe).
const read = async () => p.evaluate(() => {
  const sh = document.querySelector('.leo-app-shell');
  const cv = document.querySelector('canvas[data-camera-position]');
  const d = document.querySelector('[data-testid="director-controls"]');
  return {
    hasCanvas: !!cv,
    intraEn: d?.getAttribute('data-director-intra-enabled') ?? null,
    interEn: d?.getAttribute('data-director-inter-enabled') ?? null,
    phase: sh?.getAttribute('data-director-phase') ?? null,
    eventSec: sh?.getAttribute('data-live-director-focus-event-sec') ?? null,
    eventId: sh?.getAttribute('data-live-director-focus-event-id') ?? null,
    seek: sh?.getAttribute('data-live-timeline-seek-target') ?? null,
    simTime: cv?.getAttribute('data-sim-time-sec') ?? null,
    speed: sh?.getAttribute('data-effective-speed') ?? null,
  };
});
let ready = false;
for (let i = 0; i < 400; i++) {
  const s = await read();
  if (s.hasCanvas && s[`${KIND}En` as 'intraEn' | 'interEn'] === '1') { ready = true; break; }
  await new Promise(r => setTimeout(r, 150));
}
if (!ready) { console.log(`NOT READY: ${KIND}-enabled never went 1`); await b.close(); process.exit(1); }

const atClick = await read();
console.log(`=== ${KIND}: armed at simTime=${atClick.simTime}s (now), clicking ${BTN} ===`);
await p.click(BTN);

console.log('  t(ms)  phase      eventSec  seek     simTime  speed');
let prev = '';
let firedAt = -1; let focusedStart = -1; let focusedEnd = -1;
const t0 = Date.now();
for (let i = 0; i < 130; i++) {
  await new Promise(r => setTimeout(r, 100));
  const s = await read();
  const t = Date.now() - t0;
  if (s.phase !== 'idle' && firedAt < 0) firedAt = t;
  if (s.phase === 'focused' && focusedStart < 0) focusedStart = t;
  if (focusedStart >= 0 && focusedEnd < 0 && s.phase !== 'focused') focusedEnd = t;
  const key = `${s.phase}|${s.eventSec}|${s.seek}`;
  if (key !== prev) {
    console.log(`  ${String(t).padStart(5)}  ${String(s.phase).padEnd(10)} ${String(s.eventSec).padStart(8)} ${String(s.seek).slice(0, 8).padStart(8)} ${String(s.simTime).padStart(7)} ${s.speed}`);
    prev = key;
  }
}
console.log(`SUMMARY ${KIND}: firedAt=${firedAt}ms focusedStart=${focusedStart}ms focusedDuration=${focusedEnd > 0 ? focusedEnd - focusedStart : (focusedStart > 0 ? '>poll-end' : 'NEVER')}`);
console.log('pageErrors:', JSON.stringify(errs.slice(0, 3)));
await b.close();
