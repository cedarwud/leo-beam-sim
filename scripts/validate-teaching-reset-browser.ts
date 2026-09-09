/**
 * Tight browser regression for the owner-reported teaching-reset defects.
 *
 * This intentionally uses direct review locators so the loop stays fast: it
 * checks route identity, first-frame meaning, NTPU calculation disclosure,
 * persistent navigation, and the Act 3/4 central-stage text budget without
 * waiting through the authored films.
 */
import assert from 'node:assert/strict';
import { chromium, type Page } from '@playwright/test';
import { MEASURED_BROWSER_GATE_FLOORS_MS, runBrowserValidator } from './lib/browser-gate.ts';

import { SIX_ACTS_ROUTES, SIX_ACTS_VISIBLE_ROUTES } from '../src/course/nav/sixActsRoutes.ts';
import { GOLDEN_FLOW_ACT3_HREF, GOLDEN_FLOW_ACT4_HREF } from '../src/prototype/golden-flow/goldenFlowRoutes.ts';

const BASE_URL = process.env.APP_URL ?? process.argv[2] ?? 'http://127.0.0.1:3000';

async function waitForMain(page: Page): Promise<void> {
  await page.waitForSelector('main', { state: 'visible', timeout: 20_000 });
}

async function assertSixActStageNavigation(page: Page, expectedHref: string): Promise<void> {
  const nav = page.getByTestId('six-acts-stage-nav');
  assert.equal(await nav.count(), 1, `${expectedHref}: stage navigation is mounted`);
  assert.equal(SIX_ACTS_ROUTES.length, 6, 'the six-act registry has six separately addressable acts');
  assert.deepEqual(SIX_ACTS_ROUTES.map(route => route.actLabel), ['1', '2', '3', '4', '5', '6']);
  assert.deepEqual(SIX_ACTS_VISIBLE_ROUTES.map(route => route.actLabel), ['1', '2', '3', '4'], 'only the released four experiments appear in navigation');
  assert.equal(await nav.locator('a[href="/"]').count(), 1, `${expectedHref}: stage navigation can return home`);
  // SixActsNav (src/course/nav/SixActsNav.tsx) renders SIX_ACTS_VISIBLE_ROUTES,
  // not the full SIX_ACTS_ROUTES registry -- release-gating unreleased acts 5/6
  // out of the stage strip is the same deliberate restriction asserted two
  // lines above. This used to assert a hardcoded 6 from before the registry
  // was split into a full 6-entry registry plus a 4-entry visible subset.
  assert.equal(await nav.locator('.six-acts-nav__acts a').count(), SIX_ACTS_VISIBLE_ROUTES.length, `${expectedHref}: every released act is directly reachable`);
  const current = nav.locator('.six-acts-nav__acts a[aria-current="page"]');
  assert.equal(await current.count(), 1, `${expectedHref}: exactly one act is current`);
  const currentNumberColor = await current.locator('em').evaluate(node => getComputedStyle(node).color);
  assert.equal(currentNumberColor, 'rgb(255, 255, 255)', `${expectedHref}: current act number remains white`);
}

async function assertLegacyReferenceRestored(page: Page): Promise<void> {
  await page.goto(new URL('/prototype/scientific-explain-legacy-3d', BASE_URL).toString(), { waitUntil: 'domcontentloaded' });
  await waitForMain(page);
  assert.equal(await page.locator('main.se3d-prototype').count(), 1, 'legacy locator restores the original three-column reference');
  assert.equal(await page.locator('.se3d-controls').count(), 1, 'legacy reference keeps the INPUTS rail');
  assert.equal(await page.locator('.se3d-results').count(), 1, 'legacy reference keeps the OUTPUTS rail');
  assert.equal(await page.locator('.se3d-causal').count(), 1, 'legacy reference keeps the bottom causal chain');
  assert.equal(await page.locator('.se3d-stage-root').count(), 0, 'the replacement teaching compositor no longer occupies the legacy locator');
}

async function assertGlobalFirstFrameAndNtpU(page: Page): Promise<void> {
  const route = '/prototype/global-constellation';
  await page.goto(new URL(`${route}?beat=earth-question`, BASE_URL).toString(), { waitUntil: 'domcontentloaded' });
  await waitForMain(page);
  await page.waitForTimeout(1_000);
  assert.equal(await page.locator('main').getAttribute('data-point-cloud-starlink'), 'visible', 'Act 1 shows meaningful constellation geometry within its first second');
  assert.equal(Number(await page.locator('main').getAttribute('data-point-marker-size')), 0.026, 'satellite positions remain point-like while staying legible against the globe');
  assert.equal(await page.locator('main').getAttribute('data-orbit-boundary-overlay'), 'none', 'no decorative top/bottom orbit rings are superimposed');
  const opening = await page.getByTestId('global-constellation-caption').innerText();
  assert.match(opening, /Starlink.*OneWeb.*全球分布/s, 'Act 1 opens with the named comparison objective');
  assert.match(opening, /NTPU.*可見衛星/s, 'Act 1 states the local visibility objective before the Starlink observation');
  assert.match(opening, /每個亮點.*封存 TLE.*SGP4.*位置/s, 'Act 1 explains what every rendered point represents');
  await assertSixActStageNavigation(page, route);

  await page.goto(new URL(`${route}?beat=ntpu-reveal`, BASE_URL).toString(), { waitUntil: 'domcontentloaded' });
  await waitForMain(page);
  const caption = await page.getByTestId('global-constellation-caption').innerText();
  assert.match(caption, /封存 TLE.*SGP4/s, 'NTPU result names its archived propagation source at the moment of reveal');
  // GLOBAL_CONSTELLATION_NTPU_MINIMUM_ELEVATION_DEG is 10, not 0 -- every other
  // occurrence of this formula in the app (GLOBAL_CONSTELLATION_NTPU_GEOMETRY_CHAIN,
  // data-truth-boundary, this same file's own director.test.ts) reads "≥ 10°".
  assert.match(caption, /atan2\(U, √\(E²\+N²\)\).*≥ 10°/s, 'NTPU result keeps the visibility formula beside the reveal');
  assert.match(caption, /幾何可見.*不(?:等於|代表).*服務/s, 'NTPU result states the scientific boundary beside the formula');
  const reveal = page.getByTestId('global-constellation-reveal');
  assert.equal(await reveal.count(), 1, 'NTPU reveal has an explicit action');
  assert.match(await reveal.locator('xpath=..').innerText(), /左側.*按鈕|按下.*顯示幾何可見衛星/s, 'the NTPU pause explicitly points the learner to the left-side action');
  assert.equal(await page.locator('main').getAttribute('data-autoplay-paused'), 'true', 'formula and reveal remain paused until the learner continues');
}

async function assertGoldenCentralTextClear(page: Page, act: 3 | 4, beat: string): Promise<void> {
  const href = `${act === 3 ? GOLDEN_FLOW_ACT3_HREF : GOLDEN_FLOW_ACT4_HREF}?beat=${beat}`;
  await page.goto(new URL(href, BASE_URL).toString(), { waitUntil: 'domcontentloaded' });
  await waitForMain(page);
  await page.waitForSelector('[data-testid="golden-flow-stage"] canvas', { state: 'attached', timeout: 20_000 });
  await assertSixActStageNavigation(page, href);
  assert.equal(await page.locator('main').getAttribute('data-camera-distance-profile'), 'wide-classroom', `${href}: camera uses the wider classroom profile`);
  assert.ok(Number(await page.locator('main').getAttribute('data-satellite-stage-scale')) <= 0.85, `${href}: satellite GLB scale is restrained`);

  const report = await page.evaluate(() => {
    const safe = {
      left: innerWidth * 0.27,
      right: innerWidth * 0.73,
      top: innerHeight * 0.16,
      bottom: innerHeight * 0.78,
    };
    const selectors = [
      '[data-primary-teaching="true"]',
      '.golden-flow-caption',
      '.golden-flow-angle-readout',
      '.golden-flow-world-label',
      '.golden-flow-link-spotlight',
      '.golden-flow-impact-label',
    ];
    return selectors.flatMap(selector => [...document.querySelectorAll<HTMLElement>(selector)].map(node => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const visible = style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0.05 && rect.width > 0 && rect.height > 0;
      const intersection = visible
        ? Math.max(0, Math.min(rect.right, safe.right) - Math.max(rect.left, safe.left))
          * Math.max(0, Math.min(rect.bottom, safe.bottom) - Math.max(rect.top, safe.top))
        : 0;
      return { selector, text: node.textContent?.trim() ?? '', intersection };
    })).filter(item => item.intersection > 1);
  });
  assert.deepEqual(report, [], `${href}: no teaching text covers the central scene (${JSON.stringify(report)})`);
}

async function main(): Promise<void> {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-crashpad', '--disable-breakpad'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  try {
    await assertLegacyReferenceRestored(page);
    await assertGlobalFirstFrameAndNtpU(page);
    await assertGoldenCentralTextClear(page, 3, 'interaction');
    await assertGoldenCentralTextClear(page, 4, 'candidate');
    assert.deepEqual(errors, [], `browser console errors: ${JSON.stringify(errors)}`);
    console.log('[teaching-reset-browser] PASS');
  } finally {
    await page.close();
    await browser.close();
  }
}

void runBrowserValidator(
  {
    validator: 'validate-teaching-reset-browser',
    appUrl: BASE_URL,
    floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.layout,
  },
  async () => main(),
).catch(error => {
  console.error('[teaching-reset-browser] FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
