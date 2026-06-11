/**
 * Phase C durable browser gate: the SINR-serving MOSAIC + AGGREGATE (S2) is the
 * ambient default on the LIVE WALKER sinr-live lane. The ~100-UE population is
 * coloured by serving beam (a real partition, not mono "decoration"), and the
 * always-on aggregate HUD reads `served N/N` + per-beam load + mean live SINR.
 * S2a adds a display-owned, source-labelled `live-service-demo` queue accountant
 * to prove backlog pressure without claiming producer/MODQN queue truth.
 *
 * DATA SOURCE: live-engine — the in-browser live SINR Walker simulation
 * (`?sceneSource=live-sim&appMode=sinr-experiment`), default 100 UEs. Every UE's
 * serving (satId, beamId) is the live HandoverManager's real assignment; the
 * mosaic colour is a display-only encoding of that truth. This is NOT producer
 * MODQN: the aggregate carries `claim-kind="sinr-serving"` (asserted) and says
 * "not MODQN". No producer artifact required.
 *
 * Asserts (hard), all on `sinr-live`:
 *  - the aggregate HUD mounts with `data-claim-kind="sinr-serving"`;
 *  - the population is multi-UE (`data-total-count` > 1) and served
 *    (`data-served-count` > 1);
 *  - the mosaic is NON-MONO: `data-serving-beam-count` > 1 (UEs partition across
 *    multiple serving beams — the G3 money shot);
 *  - the mean served SINR is a finite number (`data-avg-sinr-db`);
 *  - per-beam load rows render;
 *  - queue accounting is labelled `live-service-demo` and exposes aggregate
 *    backlog metrics for all 100 UEs;
 *  - queue pressure reaches the secondary UE InstancedMesh via the
 *    `aContention` buffer (`99` secondary instances), with no per-UE text labels;
 *  - the 3D mosaic actually coloured the markers: the MESH-derived canvas dataset
 *    `data-sinr-serving-mosaic-color-count` > 1 (distinct colours really written to
 *    the InstancedMesh buffer — not just a model prop);
 *  - the aggregate is lane-truthful (says "not MODQN") and does NOT leak onto the
 *    MODQN cell lane.
 *
 * Requires a running dev server (`npm run dev`); pass APP_URL or argv[2] to
 * override. Run: `npm run validate:phase-c:sinr-serving-mosaic:browser`.
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
const ANY_CANVAS = 'canvas';
const AGGREGATE = '[data-testid="sinr-serving-aggregate"]';

async function attr(page: Page, selector: string, name: string): Promise<string | null> {
  return page.getAttribute(selector, name);
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const browser: Browser = await chromium.launch();
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

    // ── The ambient aggregate HUD mounts (always-on default, no arming) ──
    await page.waitForSelector(AGGREGATE, { timeout: 30000 });
    assert.equal(
      await attr(page, AGGREGATE, 'data-claim-kind'),
      'sinr-serving',
      'aggregate carries claim-kind="sinr-serving" (lane-truthful, not MODQN/producer)',
    );

    // Wait for ONE healthy frame where the mosaic has populated + partitioned —
    // read served/total/beams/mean-SINR + the mesh distinct-colour count ATOMICALLY
    // (one DOM read) so transient service-drops (real live-sim churn at satellite
    // transitions / loop wraps clear the secondary serving for a beat) cannot race
    // the assertions. This proves the mosaic genuinely ACHIEVES a multi-UE,
    // multi-beam served state — not that it is mono-free every single frame.
    const snapshotHandle = await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="sinr-serving-aggregate"]');
        const canvas = document.querySelector('canvas');
        if (!el || !canvas) return false;
        const served = Number(el.getAttribute('data-served-count'));
        const total = Number(el.getAttribute('data-total-count'));
        const beams = Number(el.getAttribute('data-serving-beam-count'));
        const meshAttr = canvas.getAttribute('data-sinr-serving-mosaic-color-count');
        const mesh = meshAttr === null ? NaN : Number(meshAttr);
        const queueMeshBucketAttr = canvas.getAttribute('data-sinr-service-queue-pressure-bucket-count');
        const queueMeshBuckets = queueMeshBucketAttr === null ? NaN : Number(queueMeshBucketAttr);
        const queueMeshInstanceAttr = canvas.getAttribute('data-sinr-service-queue-pressure-instance-count');
        const queueMeshInstances = queueMeshInstanceAttr === null ? NaN : Number(queueMeshInstanceAttr);
        const avgAttr = el.getAttribute('data-avg-sinr-db');
        const avg = avgAttr === null || avgAttr === '' ? NaN : Number(avgAttr);
        const loadRows = el.querySelectorAll('[data-testid="sinr-serving-beam-load"]').length;
        const queueSource = el.getAttribute('data-queue-source');
        const queueCapable = Number(el.getAttribute('data-queue-capable-count'));
        const queueAvg = Number(el.getAttribute('data-queue-avg-bits'));
        const queueP95 = Number(el.getAttribute('data-queue-p95-bits'));
        const queueMax = Number(el.getAttribute('data-queue-max-bits'));
        const queueStarved = Number(el.getAttribute('data-queue-starved-count'));
        const queueBuckets = Number(el.getAttribute('data-queue-pressure-bucket-count'));
        const queueSummary = el.querySelector('[data-testid="sinr-service-queue-summary"]');
        const queueFocus = el.querySelector('[data-testid="sinr-service-queue-focus-stories"]');
        const queueFocusRows = el.querySelectorAll('[data-testid="sinr-service-queue-focus-story"]').length;
        const highestPressureUe = queueFocus?.getAttribute('data-highest-pressure-ue-id') ?? '';
        const bestRescueUe = queueFocus?.getAttribute('data-best-rescue-ue-id') ?? '';
        const queueLabels = el.querySelectorAll('[data-testid="sinr-service-queue-ue-label"]').length;
        const queueHeatmapBins = [...el.querySelectorAll('[data-testid="sinr-service-queue-heatmap-bin"]')];
        const activeQueueHeatmapBins = queueHeatmapBins.filter(bin => Number(bin.getAttribute('data-bin-count')) > 0).length;
        if (
          total === 100 && served > 1 && served <= total && beams > 1
          && mesh > 1 && Number.isFinite(avg) && loadRows >= 1
          && queueSource === 'live-service-demo'
          && queueCapable === total
          && Number.isFinite(queueAvg) && queueAvg > 0
          && Number.isFinite(queueP95)
          && Number.isFinite(queueMax) && queueMax >= queueP95
          && Number.isFinite(queueStarved) && queueStarved >= 0
          && queueBuckets > 1
          && queueMeshBuckets > 1
          && queueMeshInstances === total - 1
          && queueSummary !== null
          && queueFocus !== null
          && queueFocusRows === 2
          && highestPressureUe !== ''
          && bestRescueUe !== ''
          && queueLabels === 0
          && queueHeatmapBins.length === 8
          && activeQueueHeatmapBins > 1
        ) {
          return {
            served,
            total,
            beams,
            mesh,
            avg,
            loadRows,
            queueSource,
            queueCapable,
            queueAvg,
            queueP95,
            queueMax,
            queueStarved,
            queueBuckets,
            queueMeshBuckets,
            queueMeshInstances,
            activeQueueHeatmapBins,
            highestPressureUe,
            bestRescueUe,
          };
        }
        return false;
      },
      undefined,
      { timeout: 60000, polling: 500 },
    );
    const snap = (await snapshotHandle.jsonValue()) as {
      served: number;
      total: number;
      beams: number;
      mesh: number;
      avg: number;
      loadRows: number;
      queueSource: string;
      queueCapable: number;
      queueAvg: number;
      queueP95: number;
      queueMax: number;
      queueStarved: number;
      queueBuckets: number;
      queueMeshBuckets: number;
      queueMeshInstances: number;
      activeQueueHeatmapBins: number;
      highestPressureUe: string;
      bestRescueUe: string;
    };

    assert.equal(snap.total, 100, `population uses the default 100-UE service proof size (total=${snap.total})`);
    assert.ok(snap.served > 1 && snap.served <= snap.total, `population is served (served=${snap.served}/${snap.total})`);
    // The money shot: UEs partition across multiple serving beams (not mono).
    assert.ok(snap.beams > 1, `mosaic is non-mono: ${snap.beams} distinct serving beams`);
    assert.ok(Number.isFinite(snap.avg), `mean served SINR is a finite number (got "${snap.avg}")`);
    assert.ok(snap.loadRows >= 1, `per-beam load rows render (got ${snap.loadRows})`);
    // The 3D mosaic actually coloured the markers (MESH-derived: distinct colours
    // written to the InstancedMesh buffer, not just a model prop).
    assert.ok(snap.mesh > 1, `mosaic wrote ${snap.mesh} distinct instance colours to the mesh (non-mono render)`);
    assert.equal(snap.queueSource, 'live-service-demo', 'queue HUD is source-labelled as live-service-demo');
    assert.equal(snap.queueCapable, snap.total, 'queue accountant covers every UE in the 100-UE population');
    assert.ok(snap.queueBuckets > 1, `queue aggregate exposes non-mono pressure buckets (${snap.queueBuckets})`);
    assert.ok(snap.activeQueueHeatmapBins > 1, `queue heatmap exposes ${snap.activeQueueHeatmapBins} active pressure bins`);
    assert.ok(snap.queueMeshBuckets > 1, `queue pressure wrote ${snap.queueMeshBuckets} distinct buckets to the instanced buffer`);
    assert.equal(snap.queueMeshInstances, 99, 'queue pressure is rendered through the 99 secondary UE instanced markers');
    assert.notEqual(snap.highestPressureUe, '', 'queue focus exposes a highest-pressure UE');
    assert.notEqual(snap.bestRescueUe, '', 'queue focus exposes a best-rescue UE');
    console.log(`[sinr-serving-mosaic] healthy frame: served=${snap.served}/${snap.total}, beams=${snap.beams}, mesh=${snap.mesh}, avg=${snap.avg} dB, queue=${snap.queueSource}, queueMeshBuckets=${snap.queueMeshBuckets}, queueInstances=${snap.queueMeshInstances}, pressure=${snap.highestPressureUe}, rescue=${snap.bestRescueUe}`);

    // Lane-truthful disclosure on the HUD.
    const hudText = await page.locator(AGGREGATE).innerText();
    assert.match(hudText, /not MODQN/i, 'aggregate HUD carries the "not MODQN" disclosure');
    assert.match(hudText, /live-service-demo/i, 'aggregate HUD carries the queue source label');
    assert.equal(
      await page.locator('[data-testid="sinr-service-queue-ue-label"]').count(),
      0,
      'queue pressure must not render 100 per-UE text labels',
    );

    // No artifact-lane leak onto the live lane.
    assert.equal(await page.locator('[data-testid="artifact-satellite-compass"]').count(), 0, 'artifact compass must not leak onto the live lane');

    // ── The aggregate must NOT leak onto the MODQN cell lane ──
    // appMode is read from localStorage (not the URL), so seed it before the load.
    await page.addInitScript(() => {
      window.localStorage.setItem('leo-beam-sim.app-mode.v1', 'modqn-demo');
    });
    await page.goto(`${appUrl}/?sceneSource=live-sim`, { waitUntil: 'domcontentloaded' });
    assert.equal(await attr(page, SHELL, 'data-scene-lane'), 'modqn-live-cell-preview', 'second load resolves to the MODQN cell lane');
    await page.waitForSelector(ANY_CANVAS, { timeout: 20000 });
    await page.waitForTimeout(3000);
    assert.equal(
      await page.locator(AGGREGATE).count(),
      0,
      'SINR-serving aggregate is lane-owned: it must NOT mount on the MODQN cell lane',
    );
    // S4-3 (QUAR-S4-SERVING block #2 replacement): the mosaic mesh-colour +
    // queue-pressure telemetry threading is GATED to the sinr-live mosaic lane.
    // The ON half is the healthy-frame snapshot above (mesh > 1, buckets > 1,
    // instances == 99 read from the canvas dataset); the OFF half is here — NO
    // canvas on the MODQN lane may carry the sinr-serving telemetry attributes
    // (ALL canvases swept: a chart canvas mounted before the scene canvas must
    // not shadow a real leak). Known limits: one off-lane sampled (the other
    // two lanes share the same render-plan ternaries) and the colour-map
    // DERIVATION gate itself is pinned in governance (QUAR-S5-BEAMRENDER).
    const offLaneTelemetryHits = await page.evaluate(() => {
      const attrs = [
        'data-sinr-serving-mosaic-color-count',
        'data-sinr-service-queue-pressure-bucket-count',
        'data-sinr-service-queue-pressure-instance-count',
      ];
      const hits = [];
      const canvases = document.querySelectorAll('canvas');
      for (const canvas of canvases) {
        for (const attr of attrs) {
          if (canvas.getAttribute(attr) !== null) hits.push(`${attr}=${canvas.getAttribute(attr)}`);
        }
      }
      return { hits, canvasCount: canvases.length };
    });
    assert.ok(offLaneTelemetryHits.canvasCount >= 1, 'OFF half is non-vacuous (a canvas is mounted on the MODQN lane)');
    assert.deepEqual(
      offLaneTelemetryHits.hits,
      [],
      `sinr-serving telemetry must not thread on any MODQN-lane canvas (sinr-live-gated): ${JSON.stringify(offLaneTelemetryHits.hits)}`,
    );

    const realErrors = consoleErrors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon/.test(e));
    assert.deepEqual(realErrors, [], `no real console errors: ${JSON.stringify(realErrors)}`);

    console.log('[sinr-serving-mosaic] PASS — ambient 100-UE mosaic + source-labelled live-service-demo queue aggregate on sinr-live (mesh-derived colour count > 1, instanced queue pressure buckets > 1, no per-UE queue labels, claim=sinr-serving); absent on the MODQN lane (DATA SOURCE = live Walker SINR)');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[sinr-serving-mosaic] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
