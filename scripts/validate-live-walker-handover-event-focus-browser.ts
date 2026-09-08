#!/usr/bin/env node
// QUARANTINED 2026-09-07 — same root cause as validate-phase-c-handover-cinema-browser.ts
// and validate-phase-c-director-cinematic-live-browser.ts (both QUARANTINED 2026-06-20).
// The 49db65d right-sidebar restore removed the live-tab handoverEventRail as a parked,
// non-functional feature ("rebuild later"), so this gate hard-fails waiting for
// [data-testid="handover-event-rail"], which only src/ui/HandoverEventRail.tsx renders and
// nothing mounts on the live lane. Script kept + still runnable manually; already absent
// from every aggregate chain in package.json, matching the two gates above. Re-arm it when
// the live-lane handover rail is rebuilt -- this is a parked feature, NOT a product
// regression, and NOT a gate to retire.

import assert from 'node:assert/strict';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';
import { APP_EPOCH_MS } from '../src/app/appRuntimeConfig.ts';
import { loadProfile } from '../src/profiles/index.ts';

const APP_MODE_STORAGE_KEY = 'leo-beam-sim.app-mode.v1';
const LIVE_WALKER_DURATION_SEC = '7200.000';
const WALKER_PROFILE = loadProfile('hobs-2024-candidate-rich');
const MODQN_DEMO_START_CACHE_KEY = [
  'demo_start',
  WALKER_PROFILE.id,
  String(APP_EPOCH_MS),
  String(JSON.stringify(WALKER_PROFILE.orbit.shells).length),
].join('_');

type AppMode = 'sinr-experiment' | 'modqn-demo';
type SceneLane = 'sinr-live' | 'modqn-live-cell-preview' | 'modqn-replay-proof';

interface BrowserProbe {
  readonly page: Page;
  readonly errors: readonly string[];
  readonly requestFailures: readonly string[];
  readonly httpFailures: readonly string[];
}

// DOMStringMap spreads type as string | undefined per key; the validator's
// datasetNumber/assertDatasetValue helpers already assert presence fail-loud.
type Dataset = Record<string, string | undefined>;

function liveSourceUrl(appUrl: string): string {
  const url = new URL(appUrl);
  url.searchParams.delete('sceneSource');
  return url.toString();
}

async function createContext(browser: Browser, appMode: AppMode): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((input: {
    readonly storageKey: string;
    readonly mode: AppMode;
    readonly modqnDemoStartCacheKey: string;
  }) => {
    const { storageKey, mode, modqnDemoStartCacheKey } = input;
    window.localStorage.setItem(storageKey, mode);
    if (mode === 'modqn-demo') {
      window.localStorage.setItem(modqnDemoStartCacheKey, '0');
    }
  }, {
    storageKey: APP_MODE_STORAGE_KEY,
    mode: appMode,
    modqnDemoStartCacheKey: MODQN_DEMO_START_CACHE_KEY,
  });
  return context;
}

function isExpectedTrainingBackendFailure(entry: string): boolean {
  return /https?:\/\/(?:127\.0\.0\.1|localhost):8765\//.test(entry)
    && /ERR_CONNECTION_REFUSED|net::ERR_FAILED|ECONNREFUSED/i.test(entry);
}

function assertNoUnexpectedBrowserErrors(
  errors: readonly string[],
  requestFailures: readonly string[],
  httpFailures: readonly string[],
  label: string,
): void {
  const unexpectedRequests = requestFailures.filter(entry => !isExpectedTrainingBackendFailure(entry));
  const expectedBackendNoise = requestFailures.some(isExpectedTrainingBackendFailure);
  const unexpectedConsole = errors.filter(entry => !(
    expectedBackendNoise
    && entry === 'console: Failed to load resource: net::ERR_CONNECTION_REFUSED'
  ));
  assert.deepEqual(
    [...unexpectedRequests, ...httpFailures, ...unexpectedConsole],
    [],
    `unexpected browser errors in ${label}:\n${[
      ...unexpectedRequests,
      ...httpFailures,
      ...unexpectedConsole,
    ].join('\n')}`,
  );
}

async function openAppPage(
  browser: Browser,
  appUrl: string,
  appMode: AppMode,
): Promise<BrowserProbe> {
  const context = await createContext(browser, appMode);
  const page = await context.newPage();
  const errors: string[] = [];
  const requestFailures: string[] = [];
  const httpFailures: string[] = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', request => {
    requestFailures.push(`${request.url()} ${request.failure()?.errorText ?? 'request failed'}`);
  });
  page.on('response', response => {
    if (response.status() >= 400) httpFailures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(liveSourceUrl(appUrl), { waitUntil: 'domcontentloaded' });
  await page.locator(`.leo-app-shell[data-app-mode="${appMode}"]`).waitFor({ timeout: 30000 });
  return { page, errors, requestFailures, httpFailures };
}

async function closePage(page: Page): Promise<void> {
  await page.context().close().catch(() => undefined);
}

async function readDataset(page: Page, selector: string): Promise<Dataset> {
  return page.locator(selector).first().evaluate(element => ({
    ...((element as HTMLElement).dataset),
  }));
}

function datasetNumber(dataset: Dataset, key: string, label: string): number {
  const raw = dataset[key];
  assert.ok(raw !== undefined && raw !== '', `${label} missing ${key}`);
  const value = Number(raw);
  assert.ok(Number.isFinite(value), `${label} ${key} is not finite: ${raw}`);
  return value;
}

function assertDatasetValue(dataset: Dataset, key: string, expected: string, label: string): void {
  assert.equal(dataset[key], expected, `${label} ${key}`);
}

function assertClose(actual: number, expected: number, label: string, tolerance = 0.001): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, got ${actual}`,
  );
}

async function waitForSceneLane(page: Page, lane: SceneLane): Promise<void> {
  await page.locator(`.leo-app-shell[data-scene-lane="${lane}"]`).waitFor({ timeout: 30000 });
  await page.locator(`.leo-shell-canvas[data-scene-lane="${lane}"]`).waitFor({ timeout: 30000 });
  await page.locator('[data-testid="handover-event-rail"]').waitFor({ timeout: 30000 });
}

async function waitForRailEventCount(page: Page, minEventCount: number): Promise<void> {
  await page.waitForFunction((minimum: number) => {
    const rail = document.querySelector<HTMLElement>('[data-testid="handover-event-rail"]');
    if (rail === null) return false;
    return Number(rail.dataset.eventCount ?? '0') >= minimum
      && Number(rail.dataset.markerClusterCount ?? '0') >= minimum;
  }, minEventCount, { timeout: 45000 });
}

async function clickFirstHandoverEventRow(page: Page): Promise<Dataset> {
  const row = page.locator('[data-testid^="handover-event-row-"]').first();
  await row.waitFor({ timeout: 10000 });
  const rowDataset = await row.evaluate(element => ({
    ...((element as HTMLElement).dataset),
  }));
  assertDatasetValue(rowDataset, 'clickTargetSec', rowDataset.sourceTimeSec ?? '', 'handover event row');
  await row.click();
  return rowDataset;
}

async function validateLiveSinrFocus(browser: Browser, appUrl: string): Promise<void> {
  const { page, errors, requestFailures, httpFailures } = await openAppPage(browser, appUrl, 'sinr-experiment');
  try {
    await waitForSceneLane(page, 'sinr-live');
    await waitForRailEventCount(page, 1);

    const railBefore = await readDataset(page, '[data-testid="handover-event-rail"]');
    assertDatasetValue(railBefore, 'sourceOwner', 'live-walker', 'SINR rail');
    assertDatasetValue(railBefore, 'horizonKind', 'live-walker-window', 'SINR rail');
    assertDatasetValue(railBefore, 'horizonSec', LIVE_WALKER_DURATION_SEC, 'SINR rail');
    assertDatasetValue(railBefore, 'claimKind', 'profile-derived-forecast', 'SINR rail');
    assertDatasetValue(railBefore, 'axisKind', 'source-time', 'SINR rail');
    assertDatasetValue(railBefore, 'focusEnabled', 'true', 'SINR rail');
    assert.ok(datasetNumber(railBefore, 'intraCount', 'SINR rail') > 0, 'SINR rail needs intra events');
    assert.ok(datasetNumber(railBefore, 'interCount', 'SINR rail') > 0, 'SINR rail needs inter events');

    const rowDataset = await clickFirstHandoverEventRow(page);
    const clickTargetSec = datasetNumber(rowDataset, 'clickTargetSec', 'handover event row');

    await page.locator('[data-testid="handover-event-slow-focus"]').waitFor({ timeout: 10000 });
    await page.waitForFunction((expected: string) => {
      const app = document.querySelector<HTMLElement>('.leo-app-shell');
      const rail = document.querySelector<HTMLElement>('[data-testid="handover-event-rail"]');
      const focus = document.querySelector<HTMLElement>('[data-testid="handover-event-slow-focus"]');
      return app?.dataset.liveTimelineSeekTarget === expected
        && rail?.dataset.focusOpen === 'true'
        && rail?.dataset.focusClickTargetSec === expected
        && focus?.dataset.clickTargetSec === expected;
    }, clickTargetSec.toFixed(3), { timeout: 10000 });

    const railAfter = await readDataset(page, '[data-testid="handover-event-rail"]');
    const focus = await readDataset(page, '[data-testid="handover-event-slow-focus"]');
    const appShell = await readDataset(page, '.leo-app-shell');
    assertDatasetValue(railAfter, 'focusOpen', 'true', 'SINR rail');
    assertDatasetValue(railAfter, 'focusAxisKind', 'display-stretched', 'SINR rail');
    assertDatasetValue(focus, 'sourceOwner', 'live-walker', 'SINR focus');
    assertDatasetValue(focus, 'horizonKind', 'live-walker-window', 'SINR focus');
    assertDatasetValue(focus, 'axisKind', 'display-stretched', 'SINR focus');
    assertClose(datasetNumber(focus, 'clickTargetSec', 'SINR focus'), clickTargetSec, 'SINR focus click target');
    assertClose(
      datasetNumber(appShell, 'liveTimelineSeekTarget', 'app shell'),
      clickTargetSec,
      'live Walker rail source-time seek target',
    );
    assertNoUnexpectedBrowserErrors(errors, requestFailures, httpFailures, 'SINR live focus');
  } finally {
    await closePage(page);
  }
}

async function validateModqnLivePreviewEmptyBoundary(browser: Browser, appUrl: string): Promise<void> {
  const { page, errors, requestFailures, httpFailures } = await openAppPage(browser, appUrl, 'modqn-demo');
  try {
    await waitForSceneLane(page, 'modqn-live-cell-preview');
    await page.waitForFunction(() => {
      const rail = document.querySelector<HTMLElement>('[data-testid="handover-event-rail"]');
      return rail !== null && rail.dataset.horizonSec === '7200.000';
    }, undefined, { timeout: 45000 });

    const rail = await readDataset(page, '[data-testid="handover-event-rail"]');
    assertDatasetValue(rail, 'sourceOwner', 'live-walker', 'MODQN live preview rail');
    assertDatasetValue(rail, 'horizonKind', 'live-walker-window', 'MODQN live preview rail');
    assertDatasetValue(rail, 'horizonSec', LIVE_WALKER_DURATION_SEC, 'MODQN live preview rail');
    assertDatasetValue(rail, 'claimKind', 'overlay-demo', 'MODQN live preview rail');
    assertDatasetValue(rail, 'focusEnabled', 'true', 'MODQN live preview rail');
    assertDatasetValue(rail, 'focusOpen', 'false', 'MODQN live preview rail');
    assert.equal(datasetNumber(rail, 'eventCount', 'MODQN live preview rail'), 0, 'MODQN live preview primary UE index stays source-backed empty');
    assert.equal(datasetNumber(rail, 'markerClusterCount', 'MODQN live preview rail'), 0, 'MODQN live preview must not fake handover markers');
    await page.locator('[data-testid="handover-event-rail-empty"]').waitFor({ timeout: 5000 });
    assert.equal(
      await page.locator('[data-testid="handover-event-slow-focus"]').count(),
      0,
      'MODQN live preview must not open a focus panel without source-backed events',
    );
    assertNoUnexpectedBrowserErrors(errors, requestFailures, httpFailures, 'MODQN live preview boundary');
  } finally {
    await closePage(page);
  }
}

async function validateModqnReplayProofDoesNotInheritLiveFocus(browser: Browser, appUrl: string): Promise<void> {
  const { page, errors, requestFailures, httpFailures } = await openAppPage(browser, appUrl, 'modqn-demo');
  try {
    await waitForSceneLane(page, 'modqn-live-cell-preview');
    await page.locator('[data-testid="modqn-replay-cue-panel"][data-replay-ready="1"]').waitFor({ timeout: 30000 });
    await page.locator('[data-testid="modqn-replay-proof-viewport-toggle"]').click();
    await waitForSceneLane(page, 'modqn-replay-proof');

    const rail = await readDataset(page, '[data-testid="handover-event-rail"]');
    assertDatasetValue(rail, 'sourceOwner', 'modqn-producer-trace', 'MODQN replay proof rail');
    assertDatasetValue(rail, 'horizonKind', 'producer-trace', 'MODQN replay proof rail');
    assertDatasetValue(rail, 'claimKind', 'producer-proof', 'MODQN replay proof rail');
    assertDatasetValue(rail, 'focusEnabled', 'false', 'MODQN replay proof rail');
    assertDatasetValue(rail, 'focusOpen', 'false', 'MODQN replay proof rail');
    assert.notEqual(rail.horizonSec, LIVE_WALKER_DURATION_SEC, 'MODQN replay proof must not inherit the live Walker horizon');
    assert.ok(datasetNumber(rail, 'sourceGapCount', 'MODQN replay proof rail') > 0, 'MODQN replay proof keeps producer trace source-gap labeling');
    assert.equal(
      await page.locator('[data-testid="handover-event-slow-focus"]').count(),
      0,
      'MODQN replay proof must not render the live Walker slow-motion focus panel',
    );

    const markers = page.locator('[data-testid^="handover-event-marker-"]');
    if (await markers.count() > 0) {
      await markers.first().click();
      const railAfterClick = await readDataset(page, '[data-testid="handover-event-rail"]');
      assertDatasetValue(railAfterClick, 'focusOpen', 'false', 'MODQN replay proof rail after marker click');
      assert.equal(
        await page.locator('[data-testid="handover-event-slow-focus"]').count(),
        0,
        'MODQN replay proof marker clicks must not open live focus',
      );
    }
    assertNoUnexpectedBrowserErrors(errors, requestFailures, httpFailures, 'MODQN replay proof boundary');
  } finally {
    await closePage(page);
  }
}

async function main(): Promise<void> {
  const appUrl = await detectAppUrl();
  const browser = await chromium.launch();
  try {
    await validateLiveSinrFocus(browser, appUrl);
    await validateModqnLivePreviewEmptyBoundary(browser, appUrl);
    await validateModqnReplayProofDoesNotInheritLiveFocus(browser, appUrl);
  } finally {
    await browser.close().catch(() => undefined);
  }

  console.log(JSON.stringify({
    appUrl,
    liveSinrFocus: 'PASS',
    modqnLivePreviewBoundary: 'PASS',
    modqnReplayProofBoundary: 'PASS',
    result: 'PASS',
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
