// Decisive intra-focus reliability sample: N arms in ONE clean session, dense poll,
// crash-safe. Per arm: armedCursor, seekTarget, eventSec, seekDirection, fired?,
// fireDelayMs, focusedDurationMs. Reveals the intermittency + its correlation with
// seek direction (fwd/bwd). Run ALONE (no concurrent browser) + APP_URL.
import { chromium } from '@playwright/test';
const URL = process.env.APP_URL ?? 'http://localhost:3000';
const N = Number(process.env.ARMS ?? 8);
const SHELL = '.leo-app-shell';
const CANVAS = 'canvas[data-camera-position]';
const INTRA = '[data-testid="director-intra-focus"]';

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

const read = async () => {
  try {
    return await p.evaluate(({ SHELL, CANVAS }) => ({
      phase: document.querySelector(SHELL)?.getAttribute('data-director-phase') ?? null,
      eventSec: document.querySelector(SHELL)?.getAttribute('data-live-director-focus-event-sec') ?? null,
      seek: document.querySelector(SHELL)?.getAttribute('data-live-timeline-seek-target') ?? null,
      simTime: Number(document.querySelector(CANVAS)?.getAttribute('data-sim-time-sec') ?? 'NaN'),
      intraEn: document.querySelector('[data-testid="director-controls"]')?.getAttribute('data-director-intra-enabled') ?? null,
    }), { SHELL, CANVAS });
  } catch { return null; }
};

for (let i = 0; i < 400; i++) { const s = await read(); if (s?.intraEn === '1') break; await new Promise(r => setTimeout(r, 150)); }

console.log('arm | armedCur | seekTgt | eventSec | dir | fired | fireMs | focusedMs | note');
for (let arm = 0; arm < N; arm++) {
  const at = await read();
  if (!at) { console.log(`${arm + 1} | browser closed`); break; }
  const armedCur = at.simTime;
  await p.click(INTRA).catch(() => {});
  let fireMs = -1, focusedStart = -1, focusedEnd = -1, seekTgt: string | null = null, eventSec: string | null = null;
  const t0 = Date.now();
  for (let i = 0; i < 180; i++) {
    await new Promise(r => setTimeout(r, 80));
    const s = await read();
    if (!s) break;
    if (seekTgt === null && s.seek) seekTgt = s.seek;
    if (eventSec === null && s.eventSec) eventSec = s.eventSec;
    const t = Date.now() - t0;
    if (s.phase && s.phase !== 'idle' && fireMs < 0) fireMs = t;
    if (s.phase === 'focused' && focusedStart < 0) focusedStart = t;
    if (focusedStart >= 0 && focusedEnd < 0 && s.phase !== 'focused' && s.phase !== 'acquiring') focusedEnd = t;
    if (focusedEnd >= 0) break; // focus done
    if (t > 13000 && fireMs < 0) break; // never fired within 13s
  }
  const seekNum = Number(seekTgt);
  const dir = Number.isFinite(seekNum) ? (seekNum >= armedCur ? 'fwd' : 'bwd') : '?';
  const focusedMs = focusedStart >= 0 ? (focusedEnd >= 0 ? focusedEnd - focusedStart : Date.now() - t0 - focusedStart) : 0;
  const fired = fireMs >= 0;
  const note = !fired ? 'NEVER-FIRED' : focusedMs < 3000 ? 'SHORT-HOLD' : 'ok';
  console.log(`${arm + 1} | ${armedCur.toFixed(1).padStart(8)} | ${(seekTgt ?? '-').padStart(7)} | ${(eventSec ?? '-').padStart(8)} | ${dir} | ${fired} | ${String(fireMs).padStart(6)} | ${String(focusedMs).padStart(9)} | ${note}`);
  // settle to idle
  for (let i = 0; i < 60; i++) { const s = await read(); if (s?.phase === 'idle') break; await new Promise(r => setTimeout(r, 150)); }
  await new Promise(r => setTimeout(r, 600));
}
await b.close();
