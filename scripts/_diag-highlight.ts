// Diagnostic for gate-5 (handover-cinema) HIGHLIGHT rings = 0. Arms intra-focus
// then polls the highlight mesh-rendered-count over the WHOLE focus lifecycle
// (alongside FSM phase + pair rendered count for cross-reference). If highlight
// is stuck 0 while pair goes 2 on the same data/lifecycle, it isolates the break
// to the highlight's telemetry/attach path (not data resolution).
import { chromium } from '@playwright/test';
const URL = process.env.APP_URL ?? 'http://localhost:3000';
const SHELL = '.leo-app-shell';
const CANVAS = 'canvas[data-camera-position]';
const INTRA_BTN = '[data-testid="director-intra-focus"]';
const EXPLAINER = '[data-testid="handover-cinema-sinr-explainer"]';

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
await p.waitForSelector(CANVAS, { timeout: 20000 });
await p.waitForFunction(() => document.querySelector('[data-testid="director-controls"]')?.getAttribute('data-director-intra-enabled') === '1', undefined, { timeout: 60000, polling: 250 });

const get = (sel: string, name: string) => p.getAttribute(sel, name);

for (let arm = 0; arm < 3; arm++) {
  console.log(`\n=== ARM #${arm + 1} ===`);
  await p.click(INTRA_BTN);
  try {
    await p.waitForSelector(EXPLAINER, { timeout: 12000 });
  } catch {
    console.log('  explainer never appeared (intra never fired)');
  }
  console.log('  t / phase / hlRendered / pairItems / pairRendered / eid');
  let prev = '';
  for (let i = 0; i < 75; i++) {
    await new Promise(r => setTimeout(r, 200));
    const phase = await get(SHELL, 'data-director-phase');
    const hl = await get(CANVAS, 'data-candidate-handover-highlight-rendered-count');
    const items = await get(CANVAS, 'data-sinr-live-cell-handover-pair-cone-count');
    const rendered = await get(CANVAS, 'data-sinr-live-cell-handover-pair-cone-rendered-count');
    const eid = await get(SHELL, 'data-live-director-focus-event-id');
    const key = `${phase}|${hl}|${items}|${rendered}`;
    if (key !== prev) {
      console.log(`  t+${(i + 1) * 200}ms phase=${phase} hl=${hl} pairItems=${items} pairRendered=${rendered} eid=${eid?.slice(-18) ?? null}`);
      prev = key;
    }
    if (phase === 'idle' && i > 5) break;
  }
  // wait for return to idle before next arm
  await p.waitForFunction(() => document.querySelector('.leo-app-shell')?.getAttribute('data-director-phase') === 'idle', undefined, { timeout: 20000, polling: 200 }).catch(() => {});
}
console.log('\npageErrors:', JSON.stringify(errs.slice(0, 3)));
await b.close();
