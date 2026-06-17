/**
 * Phase C durable browser gate (C4): the ambient live-handover PULSE — the SINGLE
 * handover-visual layer after the C3 collapse — RENDERS every handover cone it
 * resolves. The "done == looks right" gate for the collapsed HO layer
 * (sinr-live-render-consolidation-sdd.md §4/§8 C4).
 *
 * INVARIANTS:
 *  A. COUNT == RENDER (settled, the C4 invariant): the resolver pulse count
 *     (`data-sinr-live-handover-pulse-cone-count`) === the MESH-derived rendered
 *     count (`data-sinr-live-handover-pulse-cone-rendered-count`), with BOTH > 0 — so
 *     every recorded handover the resolver turns into a cone (the count is derived
 *     from the model's `recentHandoverEvents` truth) actually DRAWS as a mesh, i.e.
 *     >= 1 pulse cone renders per recorded handover in the retention window.
 *     The two attrs are written at DIFFERENT React lifecycle points (a render prop vs
 *     the cone group's layout effect / unmount cleanup), so under fast pulse churn
 *     they skew by a frame. The gate therefore reads them with the sim PAUSED — the
 *     pulse frozen, the layout effect converged — where the equality is exact. This
 *     is the read-race lesson applied to async WRITES (project_browser_gate_drift).
 *  B. THE PULSE FIRES LIVE: during the running burst the mesh-derived rendered count
 *     goes > 0 — the cones draw on the live lane, not only when paused.
 *
 * Warm-up: the first handover burst is ~42s of sim-time past the cold-attach guard
 * (pingPongGuardSec 30 + TTT 3.5); crank playback to 20x so it elapses in a few
 * seconds of wall time. The director is NEVER armed — this is the always-on ambient
 * pulse, not a manual cinema.
 *
 * Requires a running dev server. Run: `npm run validate:phase-c:handover-pulse:render:browser`.
 * DATA SOURCE: live-engine (in-browser live SINR cell simulation).
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
const CANVAS = 'canvas[data-camera-position]';

interface PulseSnap {
  count: number;
  rendered: number;
  t: number;
}

async function readSnap(page: Page): Promise<PulseSnap> {
  return page.evaluate((canvasSel) => {
    const c = document.querySelector(canvasSel) as HTMLElement | null;
    const countRaw = c?.dataset.sinrLiveHandoverPulseConeCount;
    const renderedRaw = c?.dataset.sinrLiveHandoverPulseConeRenderedCount;
    const tRaw = c?.dataset.simTimeSec;
    return {
      count: countRaw === undefined || countRaw === '' ? NaN : Number(countRaw),
      rendered: renderedRaw === undefined || renderedRaw === '' ? NaN : Number(renderedRaw),
      t: tRaw === undefined || tRaw === '' ? NaN : Number(tRaw),
    };
  }, CANVAS);
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const browser: Browser = await chromium.launch();
  try {
    const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => consoleErrors.push(`PAGEERROR ${e.message}`));

    await page.goto(`${appUrl}/?sceneSource=live-sim&appMode=sinr-experiment`, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.getAttribute(SHELL, 'data-scene-lane'), 'sinr-live', 'lane resolves to sinr-live');
    await page.waitForSelector(CANVAS, { timeout: 20000, state: 'attached' });
    for (let i = 0; i < 40; i += 1) {
      const v = await page.getAttribute(CANVAS, 'data-sinr-live-cell-beam-cone-count');
      if (v && Number(v) > 0) break;
      await page.waitForTimeout(300);
    }
    const fast = page.locator('[data-testid="timeline-speed-20x"]').first();
    if (await fast.count()) await fast.click();
    const toggle = page.locator('[data-testid="timeline-toggle-play"]').first();

    let everRendered = false; // B: the pulse draws meshes on the live lane
    let settledOk = false;    // A: a settled (paused) lit-pulse frame captured
    let settledCount = NaN;
    let settledRendered = NaN;

    // Up to a few warm-up→pause attempts: catch the pulse lit, then freeze + read.
    for (let attempt = 0; attempt < 6 && !settledOk; attempt += 1) {
      let lit = false;
      for (let i = 0; i < 30 && !lit; i += 1) {
        const s = await readSnap(page);
        if (s.rendered > 0) { everRendered = true; lit = true; }
        if (!lit) await page.waitForTimeout(500);
      }
      if (!lit) continue;
      // PAUSE → freeze the pulse + let the layout effect converge → exact count==render.
      if (await toggle.count()) await toggle.click();
      await page.waitForTimeout(1500);
      const s = await readSnap(page);
      if (s.count > 0 && s.rendered > 0) {
        settledCount = s.count;
        settledRendered = s.rendered;
        settledOk = true;
        console.log(`[handover-pulse-render] settled (paused) at t=${s.t}s: count=${s.count} rendered=${s.rendered}`);
      }
      // Resume for the next attempt (or to leave the sim running on success).
      if (await toggle.count()) await toggle.click();
      if (!settledOk) await page.waitForTimeout(400);
    }

    // B — the pulse fired live (the cones draw, not only when paused).
    assert.ok(everRendered, 'the ambient pulse rendered >= 1 cone on the live lane (handovers draw, mesh-derived)');
    // A — settled count == render with both > 0 (every resolved handover cone drew).
    assert.ok(settledOk, 'captured a settled (paused) lit-pulse frame for the count==render check');
    assert.ok(settledCount > 0, `the paused frame has resolved handover cones (count=${settledCount})`);
    assert.equal(
      settledRendered,
      settledCount,
      `COUNT==RENDER (settled) — a recorded-handover pulse cone resolved but did not draw (count=${settledCount} rendered=${settledRendered})`,
    );

    const realErrors = consoleErrors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon/.test(e));
    assert.deepEqual(realErrors, [], `no real console errors: ${JSON.stringify(realErrors)}`);
    console.log(
      `[handover-pulse-render] PASS — the ambient pulse fired live; settled count==render exact (${settledCount} cones), ` +
        `so every recorded handover in the retention window renders its pulse cone(s)`,
    );
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[handover-pulse-render] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
