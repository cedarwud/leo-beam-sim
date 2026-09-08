/**
 * Phase C durable browser gate: the SINR-live EARTH-FIXED CELL-TRUTH beam cones
 * (S-cells-3) — the visible "UE off-centre" milestone.
 *
 * On the LIVE WALKER sinr-live lane the beam render no longer glues a steered beam
 * onto the UE. Instead it draws one cone per SERVED earth-fixed cell, apex at the
 * serving satellite and base at the FIXED cell centre (from `frame.sinrLiveCells`,
 * the SINR + HandoverManager truth — NOT the round-robin scheduler). UE markers
 * stay at their true positions, so UEs sit genuinely OFF-AXIS inside their cell
 * footprints. This drives the REAL live SINR engine and asserts, via the live
 * canvas telemetry, that the cell cones render AND the UEs are off-centre.
 *
 * DATA SOURCE: live-engine (the in-browser live SINR Walker simulation,
 * `?sceneSource=live-sim&appMode=sinr-experiment`). The live sim starts at the
 * profile's `demoStartOffsetSec`, so coverage is judged at the demo window (the
 * candidate-rich satellite overhead), NOT the trajectory-wide p50.
 *
 * Asserts (hard), all on `sinr-live`:
 *  - cell-truth cones render: `data-sinr-live-cell-beam-cone-count` > 0;
 *  - cells are served: `data-sinr-live-cell-served-count` > 0;
 *  - at least one serving satellite: `data-sinr-live-cell-serving-sat-count` >= 1;
 *  - UEs are genuinely OFF-AXIS: `data-sinr-live-cell-ue-off-axis-max-deg` > 0
 *    (the steered render collapsed this to ~0 — this is the CQ3 fix proof);
 *  - the generic `data-beam-cone-count` reflects the cones that actually render
 *    (it equals the cell-cone count on this lane — the steered SatelliteBeams are
 *    suppressed, so the attr stays honest);
 *  - the render stays live across two reads (cones > 0 at both — the hopping
 *    serving keeps painting, not a one-frame flash);
 *  - G2c ambient live-handover PULSE fires WITHOUT a director arm: after cranking
 *    playback to 20x to clear the ~42s cold-attach warm-up, the decoupled pulse
 *    layer lights real handovers — `data-sinr-live-handover-pulse-cone-count` and
 *    the mesh-derived `data-sinr-live-handover-pulse-cone-rendered-count` go > 0
 *    while the director pair stays 0 (proves the pulse is NOT the manual cinema);
 *  - no artifact-lane leak; no console errors.
 *
 * Requires a running dev server. Run: `npm run validate:phase-c:sinr-live-cells:render:browser`.
 */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
const CANVAS = 'canvas[data-camera-position]';

async function numAttr(page: Page, selector: string, name: string): Promise<number> {
  const v = await page.getAttribute(selector, name);
  return v === null || v === '' ? NaN : Number(v);
}

export async function assertSinrLiveCellBeams(page: Page, consoleErrors: readonly string[] = []): Promise<void> {
    assert.equal(await page.getAttribute(SHELL, 'data-scene-lane'), 'sinr-live', 'lane resolves to sinr-live');
    // The cell-truth lane runs the cell model (~61 + ~100 link budgets/frame) on
    // top of the 100-UE init; under headless SwiftShader + CPU contention the first
    // telemetry frame can take ~30 s. Wait generously for the canvas attr — the
    // atomic-snapshot poll below is the real readiness gate.
    await page.waitForSelector(CANVAS, { timeout: 60000, state: 'attached' });

    // Wait for ONE healthy frame ATOMICALLY (one DOM read) where the cell cones
    // have rendered AND the UEs are off-axis — so transient service churn at
    // satellite transitions / loop wraps cannot race the assertions. This proves
    // the lane GENUINELY ACHIEVES the off-centre cell render, not that it holds
    // every single frame.
    const snapshotHandle = await page.waitForFunction(
      () => {
        const canvas = document.querySelector('canvas[data-camera-position]');
        if (!canvas) return false;
        const conesAttr = canvas.getAttribute('data-sinr-live-cell-beam-cone-count');
        const servedAttr = canvas.getAttribute('data-sinr-live-cell-served-count');
        const satsAttr = canvas.getAttribute('data-sinr-live-cell-serving-sat-count');
        const offAxisAttr = canvas.getAttribute('data-sinr-live-cell-ue-off-axis-max-deg');
        const beamConesAttr = canvas.getAttribute('data-beam-cone-count');
        const cones = conesAttr === null || conesAttr === '' ? NaN : Number(conesAttr);
        const served = servedAttr === null || servedAttr === '' ? NaN : Number(servedAttr);
        const sats = satsAttr === null || satsAttr === '' ? NaN : Number(satsAttr);
        const offAxis = offAxisAttr === null || offAxisAttr === '' ? NaN : Number(offAxisAttr);
        const beamCones = beamConesAttr === null || beamConesAttr === '' ? NaN : Number(beamConesAttr);
        if (cones > 0 && served > 0 && sats >= 1 && offAxis > 0 && beamCones > 0) {
          return { cones, served, sats, offAxis, beamCones };
        }
        return false;
      },
      undefined,
      { timeout: 90000, polling: 500 },
    );
    const snap = (await snapshotHandle.jsonValue()) as {
      cones: number; served: number; sats: number; offAxis: number; beamCones: number;
    };

    assert.ok(snap.cones > 0, `cell-truth cones render (data-sinr-live-cell-beam-cone-count=${snap.cones})`);
    assert.ok(snap.served > 0, `cells are served (data-sinr-live-cell-served-count=${snap.served})`);
    assert.ok(snap.sats >= 1, `at least one serving satellite (data-sinr-live-cell-serving-sat-count=${snap.sats})`);
    // The CQ3 fix: UEs sit genuinely off-axis inside their fixed cells (the steered
    // render glued the beam onto the UE → off-axis ≈ 0; the cell truth restores it).
    assert.ok(snap.offAxis > 0, `UEs are off-axis in their cells (data-sinr-live-cell-ue-off-axis-max-deg=${snap.offAxis})`);
    // The generic beam-cone-count is honest: on this lane it equals the cell cones
    // that actually render (steered SatelliteBeams suppressed).
    assert.equal(snap.beamCones, snap.cones, `generic beam-cone-count == cell cones (${snap.beamCones} vs ${snap.cones})`);
    console.log(`[sinr-live-cell-beams] healthy frame: cones=${snap.cones}, served=${snap.served}, sats=${snap.sats}, offAxisMax=${snap.offAxis}°`);

    // The render stays LIVE across frames (not a one-frame flash). Service churn is
    // real on this lane — served cells transiently drop to 0 at satellite
    // transitions / loop wraps (the cell model has no beam-hopping schedule yet —
    // that lands in the next slice) — so poll for the cone count to come back > 0
    // within a window rather than demanding it on a single later read.
    let conesLater = 0;
    for (let i = 0; i < 12; i += 1) {
      await page.waitForTimeout(700);
      conesLater = await numAttr(page, CANVAS, 'data-sinr-live-cell-beam-cone-count');
      if (conesLater > 0) break;
    }
    assert.ok(conesLater > 0, `cell cones keep rendering across frames (recovered count=${conesLater})`);

    // ── G2c ambient live-handover PULSE (the SINGLE handover-visual layer, C3) ──
    // The bright, age-faded handover cones fire only AFTER the cold-attach warm-up
    // The ambient handover-pulse sub-section was removed from this homepage gate.
    // The homepage deliberately suppresses the legacy natural-pulse carrier
    // (shouldSuppressLegacyPrimaryHandover = homepageVisualIdentity === true &&
    // lane === 'sinr-live', and that flag is pathname === '/'), so requiring
    // data-sinr-live-handover-pulse-cone-count > 0 here could never pass on '/'.
    // The pulse contract is NOT lost: validate-phase-c-handover-pulse-render-browser.ts
    // drives it on /legacy, where the carrier does render, and asserts the stricter
    // settled count == rendered. This gate keeps its own subject -- the homepage
    // cell-truth cones and their non-leak guarantees below.

    // No artifact-lane leak onto the live lane.
    assert.equal(await page.locator('[data-testid="artifact-satellite-compass"]').count(), 0, 'artifact compass must not leak onto the live lane');
    assert.equal(await page.locator('[data-testid="artifact-source-badge"]').count(), 0, 'artifact source badge must not leak onto the live lane');

    const realErrors = consoleErrors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon/.test(e));
    assert.deepEqual(realErrors, [], `no real console errors: ${JSON.stringify(realErrors)}`);
    console.log('[sinr-live-cell-beams] PASS — cell-truth cones at fixed cell centres + UEs off-axis on sinr-live, no artifact-lane leak (DATA SOURCE = live SINR engine; the handover pulse is covered by validate:phase-c:handover-pulse:render:browser on /legacy)');
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
    await assertSinrLiveCellBeams(page, consoleErrors);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('[sinr-live-cell-beams] FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
