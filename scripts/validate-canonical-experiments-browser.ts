/** Browser gate for the Act 5/6 geometric contact-window experiments. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { MEASURED_BROWSER_GATE_FLOORS_MS, runBrowserValidator } from './lib/browser-gate.ts';

import {
  SIX_ACTS_ACT5_HREF,
  SIX_ACTS_ACT6_HREF,
  SIX_ACTS_VISIBLE_ROUTES,
} from '../src/course/nav/sixActsRoutes.ts';

const BASE_URL = process.env.APP_URL ?? process.argv[2] ?? 'http://127.0.0.1:3000';
const SCREENSHOT_DIR = resolve('output/playwright/contact-window-labs');

async function openAct(page: Page, act: 5 | 6): Promise<void> {
  const route = act === 5 ? SIX_ACTS_ACT5_HREF : SIX_ACTS_ACT6_HREF;
  await page.goto(new URL(route, BASE_URL).toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(`[data-testid="contact-window-act${act}"]`, { state: 'visible', timeout: 30_000 });
  await page.waitForSelector('.contact-prediction__stage svg', { state: 'visible', timeout: 30_000 });
}

async function assertStageNavigation(page: Page, act: 5 | 6): Promise<void> {
  const nav = page.getByTestId('six-acts-stage-nav');
  // Derived, not hardcoded: the registry publishes Acts 1-4 and marks 5/6
  // hiddenFromNavigation (src/course/nav/sixActsRoutes.ts), a split locked by
  // sixActsRoutes.test.ts. Reading the registry keeps this gate correct the next
  // time an act is published or withdrawn.
  assert.equal(await nav.locator('.six-acts-nav__acts a').count(), SIX_ACTS_VISIBLE_ROUTES.length);
  // count() does not wait, so a raw CSS probe can sample the stage nav before the
  // home link is attached and report 0 for a link that src/course/nav/SixActsNav.tsx
  // does render (variant === 'stage' emits <a class="six-acts-nav__stage-home"
  // href="/" aria-label="回首頁">). Wait on the accessible name, then verify the
  // resolved pathname -- still a real, clickable public link, no state injection.
  const home = nav.getByRole('link', { name: '回首頁' });
  await home.waitFor({ state: 'attached', timeout: 30_000 });
  assert.equal(await home.count(), 1, 'stage nav exposes exactly one home link');
  assert.equal(
    new URL(await home.getAttribute('href') ?? '', page.url()).pathname,
    '/',
    'stage nav home link resolves to the homepage',
  );
  // aria-current can only mark a link the nav actually renders. Acts 5/6 are
  // hiddenFromNavigation, so on those stages there is no link to mark and the old
  // unconditional `count() === 1` asserted something the registry forbids. Derive the
  // expectation instead: published act -> exactly one current link carrying its label;
  // withdrawn act -> exactly zero. The withdrawn branch is a real assertion, not a
  // skip: republishing an act without revisiting this gate turns it red.
  const actIsPublished = SIX_ACTS_VISIBLE_ROUTES.some(entry => entry.actLabel === String(act));
  const current = nav.locator('a[aria-current="page"]');
  if (!actIsPublished) {
    assert.equal(
      await current.count(),
      0,
      `act ${act} is hiddenFromNavigation, so no stage nav link may claim aria-current`,
    );
    return;
  }
  assert.equal(await current.count(), 1, `act ${act} marks exactly one stage nav link current`);
  assert.equal(await current.locator('em').innerText(), String(act));
  assert.equal(await current.locator('em').evaluate(node => getComputedStyle(node).color), 'rgb(255, 255, 255)');
}

async function assertDesktopComposition(page: Page, label: string): Promise<void> {
  const report = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('.contact-prediction__stage')?.getBoundingClientRect();
    const caption = document.querySelector<HTMLElement>('.contact-prediction__subtitle')?.getBoundingClientRect();
    const panels = [...document.querySelectorAll<HTMLElement>('.contact-prediction__experiment-bar')];
    if (!stage || !caption) throw new Error('contact lab composition is incomplete');
    const overlaps = panels.map(panel => {
      const rect = panel.getBoundingClientRect();
      return Math.max(0, Math.min(rect.right, stage.right) - Math.max(rect.left, stage.left))
        * Math.max(0, Math.min(rect.bottom, stage.bottom) - Math.max(rect.top, stage.top));
    });
    return {
      stageWidth: stage.width,
      stageHeight: stage.height,
      captionOverlap: Math.max(0, Math.min(caption.right, stage.right) - Math.max(caption.left, stage.left))
        * Math.max(0, Math.min(caption.bottom, stage.bottom) - Math.max(caption.top, stage.top)),
      overlaps,
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      panelOverflow: panels.map(panel => panel.scrollHeight - panel.clientHeight),
      rootHeight: document.querySelector<HTMLElement>('.contact-lab')?.getBoundingClientRect().height ?? 0,
      viewportHeight: innerHeight,
    };
  });
  assert.ok(report.stageWidth >= 900, `${label}: central stage is too narrow (${report.stageWidth}px)`);
  assert.ok(report.stageHeight >= 600, `${label}: central stage is too short (${report.stageHeight}px)`);
  assert.ok(report.overlaps.every(value => value <= 1), `${label}: a side rail covers the central stage`);
  assert.ok(report.captionOverlap <= 1, `${label}: subtitle covers the central stage`);
  assert.ok(report.horizontalOverflow <= 1, `${label}: horizontal overflow ${report.horizontalOverflow}px`);
  assert.ok(report.panelOverflow.every(value => value <= 2), `${label}: desktop side-rail content is clipped ${report.panelOverflow.join(',')}`);
  assert.ok(Math.abs(report.rootHeight - report.viewportHeight) <= 2, `${label}: transport must remain inside one desktop viewport`);
}

async function assertTruthBoundary(page: Page, act: 5 | 6): Promise<void> {
  const main = page.getByTestId(`contact-window-act${act}`);
  assert.equal(await main.getAttribute('data-scientific-category'), 'GEOMETRIC_CONTACT_OPPORTUNITY');
  assert.equal(await main.getAttribute('data-guaranteed-rf-service'), 'false');
  const text = await main.innerText();
  assert.match(text, /SGP4/);
  assert.match(text, /NTPU/);
  assert.equal(await main.getAttribute('data-default-constellation'), 'Starlink');
  assert.doesNotMatch(text, /\/tle-archive\//, 'local source paths must not be visible');
}

async function runAct5(page: Page): Promise<void> {
  await openAct(page, 5);
  await assertStageNavigation(page, 5);
  await assertTruthBoundary(page, 5);
  assert.equal(await page.getByTestId('contact-prediction-chart').count(), 1);
  assert.equal(await page.locator('.contact-lab__skyplot').count(), 0, 'guided prediction keeps one explanatory chart');
  assert.equal(await page.locator('.contact-lab__formula').count(), 0, 'formula ledger does not compete with AOS/LOS lesson');
  const main = page.getByTestId('contact-window-act5');
  const initialDuration = Number.parseFloat(await main.getAttribute('data-duration-minutes') ?? 'NaN');
  assert.ok(initialDuration > 0);
  assert.match(await page.getByTestId('prediction-source-summary').innerText(), /STARLINK-1008.*44714/s);
  assert.match(await page.getByTestId('prediction-phase-subtitle').innerText(), /時間游標|最低幾何仰角|AOS|LOS|幾何窗口/);
  assert.equal(await page.locator('.contact-lab__schedule-chart').count(), 0, '24-hour schedule is outside the core learning objective');
  assert.equal(await page.locator('.contact-lab__transport-buttons button').count(), 2);
  const timeRange = page.getByTestId('contact-prediction-time-range');
  assert.equal(await timeRange.count(), 1, 'Act 5 exposes one seekable time cursor');
  const initialTime = await page.getByTestId('prediction-current-time').innerText();
  await timeRange.fill('820');
  const scrubbedTime = await page.getByTestId('prediction-current-time').innerText();
  assert.notEqual(scrubbedTime, initialTime, 'dragging the timeline changes the UTC/elevation readout');
  assert.match(await page.locator('.contact-lab__transport-buttons button').first().innerText(), /繼續播放|從頭播放/);
  assert.equal(await page.locator('.contact-lab__transport a').getAttribute('href'), SIX_ACTS_ACT6_HREF);
  await assertDesktopComposition(page, 'Act 5');
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'act5-desktop.png') });
}

async function runAct6(page: Page): Promise<void> {
  await openAct(page, 6);
  await assertStageNavigation(page, 6);
  await assertTruthBoundary(page, 6);
  assert.equal(await page.getByTestId('contact-prediction-chart').count(), 1);
  assert.equal(await page.locator('.contact-lab__schedule-row').count(), 0);
  const main = page.getByTestId('contact-window-act6');
  assert.equal(await page.getByTestId('contact-mask-5').count(), 0, '5° is not presented as a general classroom operating choice');
  const durationAtTen = Number.parseFloat(await main.getAttribute('data-duration-minutes') ?? 'NaN');
  await page.getByTestId('contact-mask-30').click();
  assert.equal(await main.getAttribute('data-mask-deg'), '10', 'draft input does not silently change the published result');
  await page.getByTestId('run-contact-prediction').click();
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-mask-deg') === '30');
  const durationAtThirty = Number.parseFloat(await main.getAttribute('data-duration-minutes') ?? 'NaN');
  assert.ok(durationAtThirty < durationAtTen, `30° duration ${durationAtThirty} must be below 10° ${durationAtTen}`);
  assert.match(await page.getByTestId('prediction-comparison-conclusion').innerText(), /AOS.*LOS.*通聯時長/);
  assert.equal(await page.locator('.contact-prediction__actions a').getAttribute('href'), '/');
  await assertDesktopComposition(page, 'Act 6');
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'act6-desktop.png') });
}

async function captureNarrow(browser: Browser, act: 5 | 6, width: number, height: number): Promise<void> {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  try {
    await openAct(page, act);
    await assertStageNavigation(page, act);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(overflow <= 1, `Act ${act} ${width}px horizontal overflow: ${overflow}px`);
    assert.deepEqual(errors, [], `Act ${act} ${width}px console errors: ${JSON.stringify(errors)}`);
    await page.screenshot({ path: resolve(SCREENSHOT_DIR, `act${act}-${width}x${height}.png`), fullPage: true });
  } finally {
    await page.close();
  }
}

async function main(): Promise<void> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
    args: ['--no-sandbox', '--disable-crashpad', '--disable-breakpad'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  try {
    await runAct5(page);
    await runAct6(page);
    await captureNarrow(browser, 5, 390, 844);
    await captureNarrow(browser, 6, 320, 720);
    assert.deepEqual(errors, [], `desktop console errors: ${JSON.stringify(errors)}`);
    console.log(`[contact-window-labs-browser] PASS; screenshots: ${SCREENSHOT_DIR}`);
  } finally {
    await page.close();
    await browser.close();
  }
}

void runBrowserValidator(
  {
    validator: 'validate-canonical-experiments-browser',
    appUrl: BASE_URL,
    floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.layout,
  },
  async () => main(),
).catch(error => {
  console.error('[contact-window-labs-browser] FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
