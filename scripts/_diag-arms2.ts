// Pin the intra never-fire mechanism: per arm, did the SEEK land (simTime jump to
// ~seekTarget) and did the focus FIRE (phase left idle)? Distinguishes:
//   seek-miss (simTime never reaches seekTarget) vs landing-miss (reached but no fire).
// Run ALONE + APP_URL.
import { chromium } from '@playwright/test';
const URL = process.env.APP_URL ?? 'http://localhost:3000';
const N = Number(process.env.ARMS ?? 12);
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
      seek: Number(document.querySelector(SHELL)?.getAttribute('data-live-timeline-seek-target') ?? 'NaN'),
      simTime: Number(document.querySelector(CANVAS)?.getAttribute('data-sim-time-sec') ?? 'NaN'),
      intraEn: document.querySelector('[data-testid="director-controls"]')?.getAttribute('data-director-intra-enabled') ?? null,
    }), { SHELL, CANVAS });
  } catch { return null; }
};
for (let i = 0; i < 400; i++) { const s = await read(); if (s?.intraEn === '1') break; await new Promise(r => setTimeout(r, 150)); }

console.log('arm | armed | seekTgt | minDistToTgt | seekLanded | fired | verdict');
for (let arm = 0; arm < N; arm++) {
  const at = await read();
  if (!at) { console.log(`${arm + 1} | browser closed`); break; }
  const armed = at.simTime;
  await p.click(INTRA).catch(() => {});
  let fired = false, seekTgt = NaN, minDist = Infinity, landed = false;
  const t0 = Date.now();
  for (let i = 0; i < 170; i++) {
    await new Promise(r => setTimeout(r, 80));
    const s = await read();
    if (!s) break;
    if (Number.isFinite(s.seek)) seekTgt = s.seek;
    if (Number.isFinite(s.seek) && Number.isFinite(s.simTime)) {
      const d = Math.abs(s.simTime - s.seek);
      minDist = Math.min(minDist, d);
      if (d <= 1.5) landed = true; // simTime came within landing tol of seekTarget
    }
    if (s.phase && s.phase !== 'idle') { fired = true; break; }
    if (Date.now() - t0 > 12000) break;
  }
  const verdict = fired ? 'FIRED' : landed ? 'LANDING-MISS (seek landed, no fire)' : 'SEEK-MISS (simTime never reached target)';
  console.log(`${arm + 1} | ${armed.toFixed(1).padStart(7)} | ${Number.isFinite(seekTgt) ? seekTgt.toFixed(0) : '-'} | ${minDist === Infinity ? '-' : minDist.toFixed(1)} | ${landed} | ${fired} | ${verdict}`);
  for (let i = 0; i < 80; i++) { const s = await read(); if (s?.phase === 'idle') break; await new Promise(r => setTimeout(r, 150)); }
  await new Promise(r => setTimeout(r, 700));
}
await b.close();
