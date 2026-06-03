/**
 * Artifact-replay 3D scene REAL-DATA durable browser gate.
 *
 * Provenance audit 2026-06-04: the standing scene validators (p1ab/p2a/p3) run
 * the SYNTHETIC 10x10 fixture; the only real-100-UE evidence was a one-time
 * manual playwright screenshot with no committed gate. This gate hits the dev
 * server's REAL producer-pinned 89s artifact and asserts the 3D scene actually
 * renders the real ~100-UE distribution (via the new `data-rendered-ue-count`
 * canvas telemetry), is NOT fail-closed, and shows NO honesty badge (the FIX-1
 * no-badge path on real data).
 *
 * DATA SOURCE: certifies ONLY `producer-pinned`. LOUD-SKIPs (exit 0) on a known
 * non-producer source UNLESS REQUIRE_PRODUCER_ARTIFACT=1 (then hard FAIL).
 *
 * Requires a running dev server. Run: `npm run validate:phase-c:artifact-scene:real-data:browser`.
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
const CANVAS = 'canvas[data-camera-position]';
const BADGE = '[data-testid="artifact-source-badge"]';
const FAIL_CLOSED = '[data-testid="artifact-scene-fail-closed"]';
const MIN_UE = 90; // the real baseline carries 100 UEs; allow a small worldPos-absent margin
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

    const KNOWN_NON_PRODUCER = ['synthetic-fixture-fallback', 'header-absent', 'external-artifact-path'];
    const source = await attr(page, SHELL, 'data-artifact-source');
    if (source !== 'producer-pinned') {
      if (REQUIRE_REAL) {
        throw new Error(`REQUIRE_PRODUCER_ARTIFACT set but data-artifact-source="${source ?? 'absent'}" — cannot certify the real-100-UE scene.`);
      }
      if (source && KNOWN_NON_PRODUCER.includes(source)) {
        skipped = true;
        console.log(`[scene-real] SKIP — data-artifact-source="${source}", not producer-pinned. Regenerate via FIX-2. Exiting 0. (Set REQUIRE_PRODUCER_ARTIFACT=1 to hard-fail.)`);
        return;
      }
      throw new Error(`unexpected data-artifact-source="${source ?? 'absent'}" after load`);
    }
    console.log('[scene-real] DATA SOURCE = producer-pinned (real 89s baseline MODQN replay)');

    const playbackStatus = await page.locator('[data-testid="artifact-replay-playback-status"]').innerText().catch(() => '');
    const durMatch = playbackStatus.match(/\/\s*(\d+(?:\.\d+)?)s/);
    const durationSec = durMatch ? Number(durMatch[1]) : NaN;
    assert.ok(durationSec >= 60 && durationSec <= 120, `artifact duration in 60-120s (got ${durationSec}s)`);

    // Scene is NOT fail-closed and the canvas actually mounted.
    assert.equal(await page.locator(FAIL_CLOSED).count(), 0, 'real artifact scene is not fail-closed');
    await page.waitForSelector(CANVAS, { timeout: 15000 });

    // The real ~100-UE distribution actually rendered (durable observable).
    let renderedUe = 0;
    for (let i = 0; i < 24; i += 1) {
      renderedUe = Number(await attr(page, CANVAS, 'data-rendered-ue-count'));
      if (Number.isFinite(renderedUe) && renderedUe >= MIN_UE) break;
      await page.waitForTimeout(250);
    }
    assert.ok(
      Number.isFinite(renderedUe) && renderedUe >= MIN_UE,
      `real 100-UE distribution renders (data-rendered-ue-count=${renderedUe}, need >=${MIN_UE})`,
    );

    // FIX-1 no-badge path on real producer data.
    assert.equal(await page.locator(BADGE).count(), 0, 'no honesty badge on the real producer-pinned source');
    console.log(`[scene-real] real-data OK: ${renderedUe} UE markers rendered, not fail-closed, no badge`);

    const realErrors = consoleErrors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon/.test(e));
    assert.deepEqual(realErrors, [], `no real console errors: ${JSON.stringify(realErrors)}`);
    console.log('[scene-real] PASS (DATA SOURCE = real producer-pinned artifact)');
  } finally {
    await browser.close();
  }
  if (skipped) return;
}

main().catch(err => {
  console.error('[scene-real] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
