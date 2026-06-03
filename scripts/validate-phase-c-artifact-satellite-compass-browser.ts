/**
 * FIX-5 Option C durable browser validator: the honest satellite-azimuth HUD
 * compass renders on the artifact-replay lane and its markers match the REAL
 * producer ring (docs/showcase-render-truth-fix-backlog.md FIX-5).
 *
 * DATA SOURCE policy (render-truth campaign rule): runs against whatever the dev
 * server actually serves and reads the FIX-1 `data-artifact-source` honesty
 * attribute. It certifies the compass ONLY on the real `producer-pinned` 89s
 * baseline MODQN artifact (4 satellites on the flat ECI-proxy ring). On an
 * explicit known non-producer source it LOUD-SKIPs (exit 0) — a fresh checkout
 * without the regenerated artifact must not red-fail, but it also must not
 * pretend it verified the real ring. Regenerate via the FIX-2 recipe.
 *
 * Asserts (hard, on real data): the compass mounts on artifact-replay; it
 * surfaces exactly 4 azimuth markers (one per visible satellite); the markers'
 * `data-azimuth-deg` are pairwise distinct and ~90° apart around the circle (the
 * real flat ring property — sat-0 +X / sat-1 +Z / sat-2 −X / sat-3 −Z); the
 * data-driven elevation flag is `false` (the proxy carries no elevation); and the
 * azimuth-only honesty caption is present. Also asserts the compass does NOT
 * mount on a live lane (no leak).
 *
 * Requires a running dev server (`npm run dev`); pass APP_URL or argv[2] to
 * override. Run: `npm run validate:phase-c:artifact-satellite-compass:browser`.
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
const COMPASS = '[data-testid="artifact-satellite-compass"]';
const MARKER = '[data-testid="artifact-satellite-azimuth-marker"]';
const HONESTY = '[data-testid="artifact-satellite-compass-honesty"]';
const HONESTY_LABEL = 'Satellites — orbital azimuth only (ECI proxy, no elevation/Earth-rotation)';
const EXPECTED_SATELLITES = 4;
const GAP_MIN = 55;
const GAP_MAX = 125;

async function attr(page: Page, selector: string, name: string): Promise<string | null> {
  return page.getAttribute(selector, name);
}

/** Circular gaps (deg) between sorted azimuths, including the wraparound gap. */
function circularGaps(azimuths: readonly number[]): number[] {
  const sorted = [...azimuths].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i]! - sorted[i - 1]!);
  gaps.push(360 - sorted[sorted.length - 1]! + sorted[0]!); // wraparound
  return gaps;
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const browser: Browser = await chromium.launch();
  let skipped = false;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${appUrl}/?sceneSource=artifact-replay`, { waitUntil: 'domcontentloaded' });
    // Hard-require the artifact to load; a load failure must FAIL, not skip.
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="artifact-replay-sidebar"]')
          ?.getAttribute('data-artifact-loaded') === 'true',
      undefined,
      { timeout: 30000 },
    );

    // ── DATA SOURCE gate (FIX-1 honesty attribute) ──
    const KNOWN_NON_PRODUCER = ['synthetic-fixture-fallback', 'header-absent', 'external-artifact-path'];
    const source = await attr(page, SHELL, 'data-artifact-source');
    if (source !== 'producer-pinned') {
      if (source && KNOWN_NON_PRODUCER.includes(source)) {
        skipped = true;
        console.log(
          `[satellite-compass] SKIP — data-artifact-source="${source}", not the real producer ` +
            `artifact. The azimuth-ring gate needs the producer-pinned 89s artifact (4 satellites). ` +
            `Regenerate via FIX-2 (docs/showcase-render-truth-fix-backlog.md), then re-run. Exiting 0.`,
        );
        return;
      }
      throw new Error(
        `unexpected data-artifact-source="${source ?? 'absent'}" after the artifact loaded — ` +
          `the gate cannot trust the lane state`,
      );
    }
    console.log('[satellite-compass] DATA SOURCE = producer-pinned (real 89s baseline MODQN replay)');

    // Content invariant: the intended 60-120s baseline replay, not a 10s smoke.
    const playbackStatus = await page
      .locator('[data-testid="artifact-replay-playback-status"]')
      .innerText()
      .catch(() => '');
    const durMatch = playbackStatus.match(/\/\s*(\d+(?:\.\d+)?)s/);
    const durationSec = durMatch ? Number(durMatch[1]) : NaN;
    assert.ok(
      durationSec >= 60 && durationSec <= 120,
      `artifact duration in the 60-120s window (got ${durationSec}s from "${playbackStatus.trim()}")`,
    );
    const summary = await page
      .locator('[data-testid="artifact-replay-source-summary"]')
      .innerText()
      .catch(() => '');
    assert.ok(
      /baseline\s*modqn|phase\s*01h/i.test(summary),
      `real baseline MODQN scenario surfaced (got "${summary.replace(/\s+/g, ' ').trim().slice(0, 100)}")`,
    );
    console.log(`[satellite-compass] content invariant OK: duration=${durationSec}s`);

    // ── Compass present on the artifact lane ──
    await page.waitForSelector(COMPASS, { timeout: 15000 });
    assert.equal(await page.locator(COMPASS).count(), 1, 'compass mounts exactly once on artifact-replay');

    const satCountAttr = Number(await attr(page, COMPASS, 'data-satellite-count'));
    const markerCount = await page.locator(MARKER).count();
    assert.equal(markerCount, satCountAttr, 'rendered marker count matches the declared satellite count');
    assert.equal(
      markerCount,
      EXPECTED_SATELLITES,
      `compass surfaces ${EXPECTED_SATELLITES} azimuth markers (one per visible satellite on the real ring)`,
    );

    // Elevation flag is data-driven and false for the flat ECI proxy.
    assert.equal(
      await attr(page, COMPASS, 'data-has-elevation'),
      'false',
      'compass reports NO elevation data (the flat ECI proxy never carried it)',
    );
    // The compass renders ONLY for the flat ECI proxy frame; the real producer
    // artifact is exactly that frame, so it surfaces the proxy kind it is honest
    // about (a real ecef-km artifact would render NO compass).
    assert.equal(
      await attr(page, COMPASS, 'data-frame-kind'),
      'eci-km-no-earth-rotation-proxy',
      'compass is gated to and labels the flat ECI proxy frame',
    );

    // Marker azimuths: read, assert distinct + ~90° apart around the circle.
    const azimuths: number[] = [];
    const ids: string[] = [];
    for (let i = 0; i < markerCount; i++) {
      const marker = page.locator(MARKER).nth(i);
      const deg = Number(await marker.getAttribute('data-azimuth-deg'));
      const id = (await marker.getAttribute('data-sat-id')) ?? `?${i}`;
      assert.ok(Number.isFinite(deg) && deg >= 0 && deg < 360, `marker ${id} azimuth in [0,360) (got ${deg})`);
      azimuths.push(deg);
      ids.push(id);
    }
    const distinct = new Set(azimuths.map(a => a.toFixed(1)));
    assert.equal(distinct.size, azimuths.length, `azimuths are pairwise distinct (${azimuths.join(', ')})`);
    const gaps = circularGaps(azimuths);
    for (const gap of gaps) {
      assert.ok(
        gap >= GAP_MIN && gap <= GAP_MAX,
        `ring gap ~90° in [${GAP_MIN},${GAP_MAX}] (gaps: ${gaps.map(g => g.toFixed(1)).join(', ')})`,
      );
    }
    console.log(
      `[satellite-compass] real ring OK: ${markerCount} sats {${ids.join(', ')}} ` +
        `azimuths=[${azimuths.map(a => a.toFixed(1)).join(', ')}]° gaps=[${gaps.map(g => g.toFixed(1)).join(', ')}]°`,
    );

    // Honesty caption present + exact.
    const honesty = (await page.locator(HONESTY).innerText().catch(() => '')).trim();
    assert.equal(honesty, HONESTY_LABEL, 'azimuth-only honesty caption present and exact');
    console.log(`[satellite-compass] honesty caption OK: "${honesty}"`);

    // ── No leak onto a live lane ──
    await page.goto(`${appUrl}/?sceneSource=live-sim&appMode=sinr-experiment`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SHELL, { timeout: 15000 });
    await page.waitForTimeout(500);
    assert.equal(
      await page.locator(COMPASS).count(),
      0,
      'satellite azimuth compass must NOT mount on the live SINR lane (lane-owned)',
    );
    console.log('[satellite-compass] no leak: compass absent on sinr-live lane');

    const realErrors = consoleErrors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon/.test(e));
    assert.equal(realErrors.length, 0, `no real console errors: ${JSON.stringify(realErrors)}`);

    console.log(
      '[satellite-compass] PASS — 4 azimuth markers ~90° apart on the real ring, no elevation, ' +
        'honest caption, lane-owned (DATA SOURCE = real producer-pinned artifact)',
    );
  } finally {
    await browser.close();
  }
  if (skipped) return;
}

main().catch(err => {
  console.error('[satellite-compass] FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
