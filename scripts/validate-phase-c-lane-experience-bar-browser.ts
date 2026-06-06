/**
 * S1 durable browser gate: the top-level LaneExperienceBar actually navigates
 * between all four scene lanes IN-APP (closes the showcase navigation gap — the
 * artifact-replay lane, with its flowchart / Plane-C dashboard / satellite
 * compass / Director cinematic, was previously reachable ONLY via the
 * ?sceneSource=artifact-replay URL param, and the modqn-replay-proof lane was
 * three sidebar clicks deep).
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
const SEG = (lane: string) => `[data-testid="lane-experience-${lane}"]`;
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

    // 2) MODQN Live → cell-preview lane + MODQN visual-layer preset control.
    await selectLane(page, 'modqn-live-cell-preview');
    await page.waitForSelector(PRESET, { timeout: 10_000 });
    assert.equal(
      await page.getAttribute(SEG('modqn-live-cell-preview'), 'data-active'),
      'true',
      'MODQN Live segment is active after selection',
    );

    // 3) MODQN Proof → replay-proof lane.
    await selectLane(page, 'modqn-replay-proof');

    // 4) Artifact Showcase → artifact-replay lane. The per-frame decision metric
    //    tiles mount in the scene-view sidebar (content=metrics); FIX-1 honesty
    //    attribute is stamped. (C5 removed the Dashboard view + flowchart dock.)
    await selectLane(page, 'artifact-replay');
    await page.waitForSelector('[data-testid="artifact-replay-sidebar"]', { timeout: 15_000 });
    await page.waitForSelector(`${DASHBOARD}[data-content="metrics"]`, { timeout: 15_000 });
    const artifactSource = await page.getAttribute(SHELL, 'data-artifact-source');
    assert.ok(
      artifactSource !== null && artifactSource !== '',
      `artifact lane stamps the FIX-1 data-artifact-source attribute (got ${String(artifactSource)})`,
    );

    // 5) back to SINR Live → lane flips back and the artifact surface is torn down.
    await selectLane(page, 'sinr-live');
    await page.waitForFunction(
      sel => document.querySelector(sel) === null,
      '[data-testid="artifact-replay-sidebar"]',
      { timeout: 10_000 },
    );
    assert.equal(await sceneLane(page), 'sinr-live', 'switching back resolves the sinr-live lane');

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
