/**
 * Phase-D dashboard/flowchart REAL-DATA durable browser gate.
 *
 * Provenance audit 2026-06-04: the standing `validate:phase-d:dashboard:browser`
 * gate route-fulfills the SYNTHETIC validator fixture (its own docstring admits
 * "does not depend on the pinned producer artifact"), so it can pass green
 * forever on fabricated data — the FIX-6 "real 82 intra-HO pulse" claim was a
 * one-off manual smoke with no committed gate behind it. This gate closes that:
 * it hits the dev server's REAL producer-pinned 89s artifact (no route mock),
 * asserts the dock/dashboard/flowchart render on real producer data, and that
 * the flowchart edge pulse fires on the artifact's REAL handover events.
 *
 * DATA SOURCE policy: reads the FIX-1 `data-artifact-source` honesty attribute.
 * Certifies ONLY `producer-pinned`. On a known non-producer source it LOUD-SKIPs
 * (exit 0) UNLESS REQUIRE_PRODUCER_ARTIFACT=1 (the `validate:real-data`
 * aggregate sets it), which turns the skip into a hard FAIL so the real-data
 * claim cannot silently green-skip on a fresh checkout.
 *
 * Requires a running dev server (`npm run dev`); pass APP_URL or argv[2].
 * Run: `npm run validate:phase-d:dashboard:real-data:browser`.
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
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
        throw new Error(`REQUIRE_PRODUCER_ARTIFACT set but data-artifact-source="${source ?? 'absent'}" — cannot certify the dashboard on real data.`);
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

    // ── Dock + dashboard render on real producer data ──
    const dock = page.locator('[data-testid="algorithm-dock"]');
    await dock.waitFor({ state: 'visible', timeout: 20000 });
    assert.equal(await dock.getAttribute('data-mode'), 'artifact', 'dock is in artifact mode');
    const dashboard = dock.locator('[data-testid="algorithm-dashboard"]');
    await dashboard.waitFor({ state: 'visible', timeout: 20000 });
    assert.equal(await dashboard.getAttribute('data-artifact-loaded'), 'true', 'dashboard reports artifact loaded');

    const nodes = await dock.locator('[data-testid="algorithm-flowchart-node"]').count();
    const edges = await dock.locator('[data-testid="algorithm-flowchart-edge"]').count();
    const chips = await dock.locator('[data-testid="algorithm-dashboard-provenance-chip"]').count();
    assert.equal(nodes, 8, 'flowchart renders all 8 MODQN pipeline nodes on real data');
    assert.equal(edges, 8, 'flowchart renders all 8 edges on real data');
    assert.ok(chips >= 8, `every dashboard tile shows an INV-1 provenance chip on real data (got ${chips})`);
    assert.equal(await dock.locator('[data-testid="algorithm-flowchart"]').getAttribute('data-pulse-driver'), 'raf', 'flowchart pulses are rAF-driven');

    // ── The pulse fires on the artifact's REAL handover events ──
    // The 89s baseline carries 82 intra-HO events; let playback run and assert an
    // edge actually goes active (not a synthetic-fixture handover schedule).
    let pulseObserved = false;
    for (let i = 0; i < 40 && !pulseObserved; i += 1) {
      pulseObserved = await dock.locator('.leo-algorithm-flowchart__edge--active').count() > 0;
      if (!pulseObserved) await page.waitForTimeout(250);
    }
    assert.ok(pulseObserved, 'a flowchart edge pulses on the REAL artifact handover events');
    console.log(`[dashboard-real] real-data OK: ${nodes} nodes / ${edges} edges / ${chips} chips, pulse on real events`);

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
