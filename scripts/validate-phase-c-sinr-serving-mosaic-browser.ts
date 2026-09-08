/**
 * Phase C durable browser gate: the SINR-serving MOSAIC (S2) — the ~100-UE
 * population coloured by serving beam (a real partition, not mono "decoration") —
 * RENDERS on the LIVE WALKER sinr-live lane and is ABSENT on the MODQN lane.
 *
 * SCOPE (post-LIVE-RUN-delete): the always-on `SinrServingAggregate` HUD readout
 * (served N/N · per-beam load · mean SINR) this gate also used to assert was REMOVED
 * from the UI. This gate now proves the 3D mosaic RENDER only — the mesh-derived
 * distinct-colour count written to the InstancedMesh buffer — which is the durable
 * "the population partitions across serving beams" proof and is independent of any
 * HUD. The served/beam DATA itself is gated at the MODEL level by
 * validate:s4:serving-equivalence + validate:phase-c:sinr-serving-mosaic:model.
 *
 * DATA SOURCE: live-engine — the in-browser live SINR Walker simulation
 * (`?sceneSource=live-sim&appMode=sinr-experiment`), default 100 UEs. Every UE's
 * serving (satId, beamId) is the live HandoverManager's real assignment; the mosaic
 * colour is a display-only encoding of that truth. NOT producer MODQN.
 *
 * Asserts (hard), all on `sinr-live`:
 *  - the 3D mosaic coloured the markers: the MESH-derived canvas dataset
 *    `data-sinr-serving-mosaic-color-count` > 1 (distinct colours really written to
 *    the InstancedMesh buffer — multi-beam partition, the G3 money shot);
 *  - that telemetry does NOT leak onto the MODQN cell lane.
 *
 * Requires a running dev server (`npm run dev`); pass APP_URL or argv[2] to
 * override. Run: `npm run validate:phase-c:sinr-serving-mosaic:browser`.
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
const ANY_CANVAS = 'canvas';
const MESH_ATTR = 'data-sinr-serving-mosaic-color-count';

async function attr(page: Page, selector: string, name: string): Promise<string | null> {
  return page.getAttribute(selector, name);
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
    const browser: Browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-crashpad', '--disable-breakpad'],
    });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', e => consoleErrors.push(`PAGEERROR ${e.message}`));
    await page.addInitScript(() => {
      const params = new URLSearchParams(window.location.search);
      window.localStorage.removeItem('leo-beam-sim.scene-topology.v1');
      if (params.get('appMode') === 'sinr-experiment') {
        window.localStorage.setItem('leo-beam-sim.app-mode.v1', 'sinr-experiment');
        window.localStorage.removeItem('leo-beam-sim.profile-by-app-mode.v1');
      }
    });

    await page.goto(`${appUrl}/?sceneSource=live-sim&appMode=sinr-experiment`, { waitUntil: 'domcontentloaded' });

    assert.equal(await attr(page, SHELL, 'data-scene-lane'), 'sinr-live', 'lane resolves to sinr-live');
    // The 100-UE population init is slower than the single-UE path; wait generously.
    await page.waitForSelector(ANY_CANVAS, { timeout: 20000 });

    // Wait for ONE healthy frame where the 3D mosaic has populated + partitioned: the
    // mesh-derived distinct-colour count > 1 (distinct colours really written to the
    // InstancedMesh buffer). Single atomic read so transient service-drops (real
    // live-sim churn at satellite transitions / loop wraps clear the secondary serving
    // for a beat) cannot race the assertion — this proves the mosaic genuinely ACHIEVES
    // a multi-beam partition, not that it is mono-free every single frame.
    const meshHandle = await page.waitForFunction(
      () => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return false;
        const raw = canvas.getAttribute('data-sinr-serving-mosaic-color-count');
        const mesh = raw === null ? NaN : Number(raw);
        return mesh > 1 ? mesh : false;
      },
      undefined,
      { timeout: 60000, polling: 500 },
    );
    const mesh = (await meshHandle.jsonValue()) as number;

    // The money shot: the 3D mosaic wrote distinct serving-beam colours to the mesh
    // (UEs partition across multiple serving beams — not mono).
    assert.ok(mesh > 1, `mosaic wrote ${mesh} distinct instance colours to the mesh (non-mono multi-beam partition)`);
    console.log(`[sinr-serving-mosaic] healthy frame: mesh=${mesh} distinct serving-beam colours`);

    // No artifact-lane leak onto the live lane.
    assert.equal(await page.locator('[data-testid="artifact-satellite-compass"]').count(), 0, 'artifact compass must not leak onto the live lane');

    // ── The mosaic telemetry must NOT leak onto the MODQN cell lane ──
    // appMode is read from localStorage (not the URL), so seed it before the load.
    await page.addInitScript(() => {
      window.localStorage.setItem('leo-beam-sim.app-mode.v1', 'modqn-demo');
    });
    await page.goto(`${appUrl}/?sceneSource=live-sim`, { waitUntil: 'domcontentloaded' });
    assert.equal(await attr(page, SHELL, 'data-scene-lane'), 'modqn-live-cell-preview', 'second load resolves to the MODQN cell lane');
    await page.waitForSelector(ANY_CANVAS, { timeout: 20000 });
    await page.waitForTimeout(3000);
    // The mosaic mesh-colour telemetry threading is GATED to the sinr-live mosaic lane:
    // NO canvas on the MODQN lane may carry the sinr-serving telemetry attribute (ALL
    // canvases swept: a chart canvas mounted before the scene canvas must not shadow a
    // real leak). Known limit: one off-lane sampled (the other two lanes share the same
    // render-plan ternaries); the colour-map DERIVATION gate itself is pinned in
    // governance (S5-2 graduated MainScene call-edge locks).
    const offLaneTelemetryHits = await page.evaluate((meshAttr) => {
      const hits: string[] = [];
      const canvases = document.querySelectorAll('canvas');
      for (const canvas of canvases) {
        if (canvas.getAttribute(meshAttr) !== null) hits.push(`${meshAttr}=${canvas.getAttribute(meshAttr)}`);
      }
      return { hits, canvasCount: canvases.length };
    }, MESH_ATTR);
    assert.ok(offLaneTelemetryHits.canvasCount >= 1, 'OFF half is non-vacuous (a canvas is mounted on the MODQN lane)');
    assert.deepEqual(
      offLaneTelemetryHits.hits,
      [],
      `sinr-serving telemetry must not thread on any MODQN-lane canvas (sinr-live-gated): ${JSON.stringify(offLaneTelemetryHits.hits)}`,
    );

    const realErrors = consoleErrors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon/.test(e));
    assert.deepEqual(realErrors, [], `no real console errors: ${JSON.stringify(realErrors)}`);

    console.log('[sinr-serving-mosaic] PASS — ambient 100-UE 3D mosaic on sinr-live (mesh-derived colour count > 1); absent on the MODQN lane (DATA SOURCE = live Walker SINR)');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[sinr-serving-mosaic] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
