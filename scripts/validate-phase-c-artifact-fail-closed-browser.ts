/**
 * Artifact-replay FAIL-CLOSED durable browser gate.
 *
 * Provenance audit 2026-06-04: the fail-closed path (App.tsx ~1948-1956 — when
 * the artifact 404s / fails to load, the viewport renders an honest empty div
 * instead of falling back to live simulation) was reasoned-about but NEVER
 * tested. For a render-truth campaign whose whole premise is "do not silently
 * show fake/empty data as real," an untested degraded path is a real gap.
 *
 * DATA SOURCE: route-mock-404 (INTENTIONAL — this gate exercises the failure
 * path, so it deliberately forces the artifact fetch to 404). It asserts the
 * scene fails closed (honest empty div, no canvas) and does NOT leak a synthetic
 * fallback or a live-sim scene.
 *
 * Requires a running dev server. Run: `npm run validate:phase-c:artifact-fail-closed:browser`.
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const ARTIFACT_ROUTE = '**/showcase-artifacts/visual-showcase-v1.json';
const SHELL = '.leo-app-shell';
const FAIL_CLOSED = '[data-testid="artifact-scene-fail-closed"]';
const CANVAS = 'canvas[data-camera-position]';

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const browser: Browser = await chromium.launch();
  try {
    const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    // Force the artifact fetch to 404 — the degraded path under test.
    await page.route(ARTIFACT_ROUTE, route => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }));

    await page.goto(`${appUrl}/?sceneSource=artifact-replay`, { waitUntil: 'domcontentloaded' });

    // The viewport must fail closed: the honest empty div appears.
    await page.waitForSelector(FAIL_CLOSED, { timeout: 30000 });
    assert.equal(await page.locator(FAIL_CLOSED).count(), 1, 'fail-closed honest div renders on artifact load failure');

    // It must stay on the artifact lane (no silent fallback to a live lane).
    assert.equal(await page.getAttribute(SHELL, 'data-scene-lane'), 'artifact-replay', 'lane stays artifact-replay (no live fallback)');
    assert.equal(await page.getAttribute(FAIL_CLOSED, 'data-scene-lane'), 'artifact-replay', 'fail-closed div is the artifact lane surface');

    // No 3D scene canvas mounted — the viewport did NOT render fabricated/empty geometry.
    assert.equal(await page.locator(CANVAS).count(), 0, 'no 3D scene canvas renders while failed closed (no synthetic leak)');

    // The sidebar reflects the not-loaded truth (not a silent loading spinner forever).
    const loaded = await page.getAttribute('[data-testid="artifact-replay-sidebar"]', 'data-artifact-loaded');
    assert.equal(loaded, 'false', 'sidebar reports artifact NOT loaded');

    // The fail-closed div carries an honest message (error or loading text), not blank.
    const text = (await page.locator(FAIL_CLOSED).innerText().catch(() => '')).trim();
    assert.ok(text.length > 0, `fail-closed div shows an honest message (got "${text.slice(0, 80)}")`);

    console.log(`[artifact-fail-closed] PASS — fail-closed div renders, lane stays artifact-replay, no canvas, message="${text.slice(0, 60)}" (DATA SOURCE = route-mock-404)`);

    const realErrors = consoleErrors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon|404|Failed to load|not found/i.test(e));
    // The 404 itself is expected; only flag UNEXPECTED errors.
    assert.deepEqual(realErrors, [], `no unexpected console errors: ${JSON.stringify(realErrors)}`);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('[artifact-fail-closed] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
