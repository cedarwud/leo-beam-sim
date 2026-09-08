/**
 * Phase-H sinr-live RICH-RENDER durable browser gate.
 *
 * Provenance audit 2026-06-04: the entire Phase-H S1-S8 suite is
 * `readSource() + includes()` string assertions; the "rich render"
 * (live beams + satellites + callouts actually paint) claim rested on the
 * read-only audit D1 eyes-on only, with no durable browser gate. This drives the
 * REAL live SINR engine in a browser and asserts, via the live canvas telemetry
 * (`SceneTelemetry`), that satellites and beam cones actually render — a genuine
 * live-engine check, not a fixture or a source string.
 *
 * DATA SOURCE: live-engine (the in-browser live SINR Walker simulation).
 *
 * Requires a running dev server. Run: `npm run validate:phase-h:sinr-live-render:browser`.
 */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
const CANVAS = 'canvas[data-camera-position]';

async function numAttr(page: Page, selector: string, name: string): Promise<number> {
  const v = await page.getAttribute(selector, name);
  return v === null ? NaN : Number(v);
}

export async function assertSinrLiveRender(page: Page, consoleErrors: readonly string[] = []): Promise<void> {

    // The live SINR lane is selected and the canvas mounts.
    assert.equal(await page.getAttribute(SHELL, 'data-scene-lane'), 'sinr-live', 'lane resolves to sinr-live');
    // Wait on 'attached' (not the default 'visible'): headless layout can report
    // the canvas mid-resize (width 585) and race the 'visible' check to a false
    // timeout, even though the live render is already up. The telemetry poll below
    // is the real readiness gate. (Provenance re-audit 2026-06-04 flake fix.)
    await page.waitForSelector(CANVAS, { timeout: 20000, state: 'attached' });

    // The live engine actually renders satellites + beam cones. Headless
    // SwiftShader steps the rAF loop slowly, so poll the live telemetry until the
    // rich render appears (or time out → FAIL, the rich-render claim is false).
    let sats = NaN;
    let beamCones = NaN;
    let beamSats = NaN;
    for (let i = 0; i < 40; i += 1) {
      sats = await numAttr(page, CANVAS, 'data-visible-satellite-count');
      beamCones = await numAttr(page, CANVAS, 'data-beam-cone-count');
      beamSats = await numAttr(page, CANVAS, 'data-beam-satellite-count');
      if (sats > 0 && beamCones > 0) break;
      await page.waitForTimeout(300);
    }
    assert.ok(sats > 0, `live SINR lane renders satellites (data-visible-satellite-count=${sats})`);
    assert.ok(beamCones > 0, `live SINR lane renders beam cones (data-beam-cone-count=${beamCones})`);
    assert.ok(beamSats > 0, `live SINR lane has beam-bearing satellites (data-beam-satellite-count=${beamSats})`);
    console.log(`[sinr-live-render] live-engine render OK: ${sats} satellites, ${beamCones} beam cones, ${beamSats} beam-sats`);

    // No artifact-lane leak: the honest satellite compass + artifact badge stay off.
    assert.equal(await page.locator('[data-testid="artifact-satellite-compass"]').count(), 0, 'artifact compass must not leak onto the live lane');
    assert.equal(await page.locator('[data-testid="artifact-source-badge"]').count(), 0, 'artifact source badge must not leak onto the live lane');

    const realErrors = consoleErrors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon/.test(e));
    assert.deepEqual(realErrors, [], `no real console errors: ${JSON.stringify(realErrors)}`);
    console.log('[sinr-live-render] PASS (DATA SOURCE = live SINR engine)');
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
    await assertSinrLiveRender(page, consoleErrors);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => {
    console.error('[sinr-live-render] FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
