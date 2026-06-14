// Diagnostic for gate-5 (handover-cinema) pair-cone = 0. Mirrors the gate's arm
// (random-walk localStorage + click intra-focus), then dumps the items-count attr
// (resolver output length, SceneTelemetry) vs the mesh-rendered-count attr (what the
// gate reads) to localise the break: items=0 → resolver returned empty (placement
// lookup miss); items=2 & rendered=0 → mesh telemetry/timing bug.
import { chromium } from '@playwright/test';
const URL = process.env.APP_URL ?? 'http://localhost:3007';
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
await p.waitForSelector(CANVAS, { timeout: 20000 });
await p.waitForFunction(() => document.querySelector('[data-testid="director-controls"]')?.getAttribute('data-director-intra-enabled') === '1', undefined, { timeout: 60000, polling: 250 });
await p.click(INTRA_BTN);
await p.waitForSelector(EXPLAINER, { timeout: 12000 });

const get = (sel: string, name: string) => p.getAttribute(sel, name);
const serving = p.locator(`${ROW}[data-role="serving"]`).first();
const winner = p.locator(`${ROW}[data-is-selected="true"]`).first();
const dump: Record<string, unknown> = {
  focusClaim: await get(SHELL, 'data-live-director-focus-claim'),
  focusSourceOwner: await get(SHELL, 'data-live-director-focus-source-owner'),
  focusEventId: await get(SHELL, 'data-live-director-focus-event-id'),
  servingSatId: await serving.getAttribute('data-sat-id'),
  winnerSatId: await winner.getAttribute('data-sat-id'),
  servingCellId: await serving.getAttribute('data-cell-id'),
  winnerCellId: await winner.getAttribute('data-cell-id'),
  // resolver output length (always set by SceneTelemetry):
  pairItemsCount: await get(CANVAS, 'data-sinr-live-cell-handover-pair-cone-count'),
  pairSourceOwner: await get(CANVAS, 'data-sinr-live-cell-handover-pair-source-owner'),
  pairEventId: await get(CANVAS, 'data-sinr-live-cell-handover-pair-event-id'),
  // mesh-derived (what the gate reads; set only when the cone component mounts):
  pairRenderedCount: await get(CANVAS, 'data-sinr-live-cell-handover-pair-cone-rendered-count'),
  highlightRenderedCount: await get(CANVAS, 'data-candidate-handover-highlight-rendered-count'),
};
console.log('=== AT ARM ===');
console.log(JSON.stringify(dump, null, 2));
// poll the FULL lifecycle over ~8s: directorPhase + focusEventId + cone counts.
// Shows exactly what state the cones vanish in (FSM idle? eventId cleared? index null?).
console.log('=== LIFECYCLE (t / phase / focusEventId / items / rendered) ===');
let prev = '';
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 200));
  const phase = await get(SHELL, 'data-director-phase');
  const eid = await get(SHELL, 'data-live-director-focus-event-id');
  const items = await get(CANVAS, 'data-sinr-live-cell-handover-pair-cone-count');
  const rendered = await get(CANVAS, 'data-sinr-live-cell-handover-pair-cone-rendered-count');
  const key = `${phase}|${eid}|${items}|${rendered}`;
  if (key !== prev) { console.log(`  t+${(i + 1) * 200}ms phase=${phase} eid=${eid?.slice(-22) ?? null} items=${items} rendered=${rendered}`); prev = key; }
}
console.log('pageErrors:', JSON.stringify(errs.slice(0, 3)));
await b.close();
