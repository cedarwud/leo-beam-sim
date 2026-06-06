/**
 * Phase-D dashboard decision-metrics REAL-DATA durable browser gate.
 *
 * Provenance audit 2026-06-04: the standing `validate:phase-d:dashboard:browser`
 * gate route-fulfills the SYNTHETIC validator fixture, so it can pass green
 * forever on fabricated data. This gate closes that: it hits the dev server's
 * REAL producer-pinned 89s artifact (no route mock) and asserts the per-frame
 * decision metric tiles render on real producer data.
 *
 * C5 update: the full-area Dashboard view + flowchart were removed (deferred to
 * the data-flow diagram project). The per-frame decision metric tiles (C4) live
 * in the artifact-replay sidebar (`data-content="metrics"`); this gate checks
 * them on real data.
 *
 * DATA SOURCE policy: reads the FIX-1 `data-artifact-source` honesty attribute.
 * Certifies ONLY `producer-pinned`. On a known non-producer source it LOUD-SKIPs
 * (exit 0) UNLESS REQUIRE_PRODUCER_ARTIFACT=1 (the `validate:real-data`
 * aggregate sets it), which turns the skip into a hard FAIL.
 *
 * Requires a running dev server (`npm run dev`); pass APP_URL or argv[2].
 * Run: `npm run validate:phase-d:dashboard:real-data:browser`.
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
const DASHBOARD = '[data-testid="algorithm-dashboard"]';
const REQUIRE_REAL = Boolean(process.env.REQUIRE_PRODUCER_ARTIFACT);

async function attr(page: Page, selector: string, name: string): Promise<string | null> {
  return page.getAttribute(selector, name);
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const browser: Browser = await chromium.launch();
  let skipped = false;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', e => consoleErrors.push(`PAGEERROR ${e.message}`));

    await page.goto(`${appUrl}/?sceneSource=artifact-replay`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => document.querySelector('[data-testid="artifact-replay-sidebar"]')?.getAttribute('data-artifact-loaded') === 'true',
      undefined,
      { timeout: 30000 },
    );

    // ── DATA SOURCE gate ──
    const KNOWN_NON_PRODUCER = ['synthetic-fixture-fallback', 'header-absent', 'external-artifact-path'];
    const source = await attr(page, SHELL, 'data-artifact-source');
    if (source !== 'producer-pinned') {
      if (REQUIRE_REAL) {
        throw new Error(`REQUIRE_PRODUCER_ARTIFACT set but data-artifact-source="${source ?? 'absent'}" — cannot certify the dashboard metrics on real data.`);
      }
      if (source && KNOWN_NON_PRODUCER.includes(source)) {
        skipped = true;
        console.log(`[dashboard-real] SKIP — data-artifact-source="${source}", not producer-pinned. Regenerate via FIX-2, then re-run. Exiting 0. (Set REQUIRE_PRODUCER_ARTIFACT=1 to hard-fail.)`);
        return;
      }
      throw new Error(`unexpected data-artifact-source="${source ?? 'absent'}" after load`);
    }
    console.log('[dashboard-real] DATA SOURCE = producer-pinned (real 89s baseline MODQN replay)');

    // Content invariant: the real 60-120s baseline, not a 10s smoke.
    const playbackStatus = await page.locator('[data-testid="artifact-replay-playback-status"]').innerText().catch(() => '');
    const durMatch = playbackStatus.match(/\/\s*(\d+(?:\.\d+)?)s/);
    const durationSec = durMatch ? Number(durMatch[1]) : NaN;
    assert.ok(durationSec >= 60 && durationSec <= 120, `artifact duration in 60-120s (got ${durationSec}s)`);

    // ── Decision metric tiles render on real data in the scene-view sidebar ──
    const metrics = page.locator(`${DASHBOARD}[data-content="metrics"]`);
    await metrics.waitFor({ state: 'visible', timeout: 20000 });
    assert.equal(await metrics.getAttribute('data-artifact-loaded'), 'true', 'sidebar metrics report artifact loaded on real data');
    const chips = await metrics.locator('[data-testid="algorithm-dashboard-provenance-chip"]').count();
    assert.ok(chips >= 7, `every metric tile shows an INV-1 provenance chip on real data (got ${chips})`);
    assert.equal(
      await metrics.locator('[data-testid="algorithm-flowchart-node"]').count(),
      0,
      'the flowchart does not render in the sidebar metrics (C4 split)',
    );
    // The Dashboard view/dock was removed (C5): it must not mount on real data either.
    assert.equal(await page.locator('[data-testid="algorithm-dock"]').count(), 0, 'the AlgorithmDock / Dashboard view is removed (C5)');
    console.log(`[dashboard-real] real-data OK: ${chips} metric chips on the real artifact, no flowchart/dock`);

    const realErrors = consoleErrors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon/.test(e));
    assert.deepEqual(realErrors, [], `no real console errors: ${JSON.stringify(realErrors)}`);
    console.log('[dashboard-real] PASS (DATA SOURCE = real producer-pinned artifact)');
  } finally {
    await browser.close();
  }
  if (skipped) return;
}

main().catch(err => {
  console.error('[dashboard-real] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
