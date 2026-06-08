/**
 * S1 durable browser gate: the top-level LaneExperienceBar + the in-MODQN
 * ModqnViewToggle sub-nav together navigate all four scene lanes IN-APP. After
 * the 4->2 nav consolidation (docs/modqn-tab-consolidation-plan.md) the top bar
 * exposes two primary segments (SINR / MODQN); the two remaining MODQN lanes
 * (modqn-replay-proof, artifact-replay) are reached via the in-MODQN sub-nav,
 * not top tabs. nav != lane (ADR-002): the MODQN top segment stays active across
 * all three MODQN sub-lanes. (Originally closed the showcase navigation gap — the
 * artifact-replay lane was once reachable ONLY via ?sceneSource=artifact-replay,
 * and the modqn-replay-proof lane was three sidebar clicks deep.)
 *
 * This gate is lane/provenance agnostic — it verifies the navigation MECHANICS,
 * not artifact truth — so it passes whether the dev server serves the real
 * producer artifact or the synthetic fixture fallback. It asserts:
 *   - the bar mounts, defaults to sinr-live;
 *   - clicking each segment flips the authoritative data-scene-lane;
 *   - MODQN Live exposes the MODQN visual-layer preset control;
 *   - Artifact Showcase mounts the scene-view decision metric tiles
 *     (content=metrics sidebar) and stamps the FIX-1 data-artifact-source attribute;
 *   - switching back to a live lane tears the artifact surface back down;
 *   - no uncaught page errors fire across the whole tour.
 *
 * Requires a running dev server (`npm run dev`); pass APP_URL or argv[2] to
 * override. Run: `npm run validate:phase-c:lane-experience-bar:browser`.
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SHELL = '.leo-app-shell';
const BAR = '[data-testid="lane-experience-bar"]';
// 4->2 nav consolidation: the top bar exposes ONLY the 2 primary segments
// (sinr-live / modqn-live-cell-preview). The other 2 MODQN lanes are reachable
// via the in-MODQN ModqnViewToggle sub-nav (modqn-view-*), not top tabs.
const SEG = (lane: string) => `[data-testid="lane-experience-${lane}"]`;
const SUBNAV = '[data-testid="modqn-view-toggle"]';
const MV = (lane: string) => `[data-testid="modqn-view-${lane}"]`;
const PRESET = '[data-testid="modqn-layer-preset-control"]';
const DASHBOARD = '[data-testid="algorithm-dashboard"]';

async function sceneLane(page: Page): Promise<string | null> {
  return page.getAttribute(SHELL, 'data-scene-lane');
}

async function selectLane(page: Page, lane: string): Promise<void> {
  await page.click(SEG(lane));
  await page.waitForFunction(
    ([sel, want]) => document.querySelector(sel)?.getAttribute('data-scene-lane') === want,
    [SHELL, lane] as const,
    { timeout: 15_000 },
  );
}

// Pick a MODQN sub-lane through the in-MODQN sub-nav (must already be on a MODQN
// lane so the sub-nav is mounted).
async function selectModqnView(page: Page, lane: string): Promise<void> {
  await page.click(MV(lane));
  await page.waitForFunction(
    ([sel, want]) => document.querySelector(sel)?.getAttribute('data-scene-lane') === want,
    [SHELL, lane] as const,
    { timeout: 15_000 },
  );
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const browser: Browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors: string[] = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    // 1) default live load → bar present, defaults to sinr-live.
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SHELL, { timeout: 20_000 });
    await page.waitForSelector(BAR, { timeout: 10_000 });
    assert.equal(await sceneLane(page), 'sinr-live', 'default load should resolve the sinr-live lane');
    assert.equal(
      await page.getAttribute(SEG('sinr-live'), 'data-active'),
      'true',
      'sinr-live segment is active by default',
    );

    // 2) MODQN top tab → cell-preview lane + MODQN visual-layer preset control.
    //    The in-MODQN sub-nav appears, defaulting to the Live (cell-preview) view.
    await selectLane(page, 'modqn-live-cell-preview');
    await page.waitForSelector(PRESET, { timeout: 10_000 });
    assert.equal(
      await page.getAttribute(SEG('modqn-live-cell-preview'), 'data-active'),
      'true',
      'MODQN segment is active after selection',
    );
    await page.waitForSelector(SUBNAV, { timeout: 10_000 });
    assert.equal(
      await page.getAttribute(MV('modqn-live-cell-preview'), 'data-active'),
      'true',
      'in-MODQN sub-nav defaults to the Live (cell-preview) view',
    );

    // 3) MODQN Proof → replay-proof lane, via the in-MODQN sub-nav (no longer a
    //    top tab). The MODQN top segment stays active throughout (nav != lane).
    await selectModqnView(page, 'modqn-replay-proof');
    assert.equal(
      await page.getAttribute(SEG('modqn-live-cell-preview'), 'data-active'),
      'true',
      'MODQN top segment stays active across MODQN sub-lanes (non-injective nav -> lane)',
    );

    // 4) Artifact Showcase → artifact-replay lane, via the in-MODQN sub-nav. The
    //    per-frame decision metric tiles mount in the scene-view sidebar
    //    (content=metrics); FIX-1 honesty attribute is stamped.
    await selectModqnView(page, 'artifact-replay');
    await page.waitForSelector('[data-testid="artifact-replay-sidebar"]', { timeout: 15_000 });
    await page.waitForSelector(`${DASHBOARD}[data-content="metrics"]`, { timeout: 15_000 });
    const artifactSource = await page.getAttribute(SHELL, 'data-artifact-source');
    assert.ok(
      artifactSource !== null && artifactSource !== '',
      `artifact lane stamps the FIX-1 data-artifact-source attribute (got ${String(artifactSource)})`,
    );

    // 5) back to SINR → lane flips back, the artifact surface is torn down, and
    //    the in-MODQN sub-nav unmounts (it is gated to MODQN lanes).
    await selectLane(page, 'sinr-live');
    await page.waitForFunction(
      sel => document.querySelector(sel) === null,
      '[data-testid="artifact-replay-sidebar"]',
      { timeout: 10_000 },
    );
    assert.equal(await sceneLane(page), 'sinr-live', 'switching back resolves the sinr-live lane');
    assert.equal(
      await page.$(SUBNAV),
      null,
      'in-MODQN sub-nav is hidden on the SINR experience',
    );

    assert.equal(pageErrors.length, 0, `no uncaught page errors during the lane tour:\n${pageErrors.join('\n')}`);
    console.log('validate:phase-c:lane-experience-bar:browser passed');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
