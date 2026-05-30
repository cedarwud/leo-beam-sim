#!/usr/bin/env node

import assert from 'node:assert/strict';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const APP_MODE_STORAGE_KEY = 'leo-beam-sim.app-mode.v1';

function withSceneSource(appUrl: string, sceneSource: 'live-sim' | 'artifact-replay'): string {
  const url = new URL(appUrl);
  if (sceneSource === 'artifact-replay') url.searchParams.set('sceneSource', 'artifact-replay');
  else url.searchParams.delete('sceneSource');
  return url.toString();
}

async function createModqnContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((storageKey: string) => {
    window.localStorage.setItem(storageKey, 'modqn-demo');
  }, APP_MODE_STORAGE_KEY);
  return context;
}

interface BrowserProbe {
  readonly page: Page;
  readonly errors: readonly string[];
  readonly requestFailures: readonly string[];
  readonly httpFailures: readonly string[];
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
  const unexpectedHttpFailures = httpFailures.filter(entry => !(
    label === 'artifact lane'
    && /^404 http:\/\/127\.0\.0\.1:\d+\/showcase-artifacts\/visual-showcase-v1\.json$/.test(entry)
  ));
  const expectedHttp404Count = httpFailures.length - unexpectedHttpFailures.length;
  let remainingExpectedGeneric404Console = expectedHttp404Count;
  const unexpectedConsole = errors.filter(entry => {
    if (expectedBackendNoise && entry === 'console: Failed to load resource: net::ERR_CONNECTION_REFUSED') {
      return false;
    }
    if (
      remainingExpectedGeneric404Console > 0
      && entry === 'console: Failed to load resource: the server responded with a status of 404 (Not Found)'
    ) {
      remainingExpectedGeneric404Console -= 1;
      return false;
    }
    return true;
  });
  assert.deepEqual(
    [...unexpectedRequests, ...unexpectedHttpFailures, ...unexpectedConsole],
    [],
    `unexpected browser errors in ${label}:\n${[
      ...unexpectedRequests,
      ...unexpectedHttpFailures,
      ...unexpectedConsole,
    ].join('\n')}`,
  );
}

async function openModqnPage(
  browser: Browser,
  appUrl: string,
  sceneSource: 'live-sim' | 'artifact-replay',
): Promise<BrowserProbe> {
  const context = await createModqnContext(browser);
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
    if (response.status() >= 400) {
      httpFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.goto(withSceneSource(appUrl, sceneSource), { waitUntil: 'domcontentloaded' });
  await page.locator('.leo-app-shell[data-app-mode="modqn-demo"]').waitFor({ timeout: 30000 });
  return { page, errors, requestFailures, httpFailures };
}

async function closePage(page: Page): Promise<void> {
  await page.context().close().catch(() => undefined);
}

async function validateProofLane(browser: Browser, appUrl: string): Promise<void> {
  const { page, errors, requestFailures, httpFailures } = await openModqnPage(browser, appUrl, 'live-sim');
  try {
    await page.locator('.leo-app-shell[data-scene-lane="modqn-live-cell-preview"]').waitFor({ timeout: 30000 });
    await page.locator('.leo-shell-canvas[data-scene-lane="modqn-live-cell-preview"]').waitFor({ timeout: 30000 });
    await page.locator('[data-testid="modqn-replay-cue-panel"][data-replay-ready="1"]').waitFor({ timeout: 30000 });
    assert.equal(
      await page.locator('[data-testid="modqn-replay-source-gap-list"]').count(),
      0,
      'live cell preview must not show the replay-proof source-gap list before proof toggle',
    );
    assert.equal(
      await page.locator('[data-testid="modqn-evidence-source-gap-list"]').count(),
      0,
      'live cell preview must not show MODQN evidence source gaps in the right sidebar',
    );
    assert.equal(
      await page.locator('canvas[data-modqn-replay-scene-layer]').count(),
      0,
      'live cell preview must not publish replay proof canvas telemetry',
    );

    await page.locator('[data-testid="modqn-replay-proof-viewport-toggle"]').click();
    await page.locator('.leo-app-shell[data-scene-lane="modqn-replay-proof"]').waitFor({ timeout: 30000 });
    await page.locator('.leo-shell-canvas[data-scene-lane="modqn-replay-proof"]').waitFor({ timeout: 30000 });
    await page.locator('[data-testid="modqn-replay-source-gap-list"]').waitFor({ timeout: 30000 });
    await page.locator('[data-testid="modqn-evidence-source-gap-list"]').waitFor({ timeout: 30000 });

    const replayGapCount = await page.locator('[data-testid="modqn-replay-source-gap-item"]').count();
    const evidenceGapCount = await page.locator('[data-testid="modqn-evidence-source-gap-item"]').count();
    assert.ok(replayGapCount >= 7, `expected replay panel source gaps, got ${replayGapCount}`);
    assert.ok(evidenceGapCount >= 7, `expected evidence source gaps, got ${evidenceGapCount}`);

    for (const testId of ['modqn-replay-source-gap-item', 'modqn-evidence-source-gap-item']) {
      await page
        .locator(`[data-testid="${testId}"][data-source-gap-field="beamHopping.activeSchedule"]`)
        .first()
        .waitFor({ timeout: 5000 });
      await page
        .locator(`[data-testid="${testId}"][data-source-gap-field="beamHopping.nextSchedule"]`)
        .first()
        .waitFor({ timeout: 5000 });
    }

    await page.waitForFunction(() => (
      document.querySelector('canvas')?.getAttribute('data-modqn-replay-scene-layer') === 'ready'
    ));
    await page.waitForFunction(() => (
      document.querySelector('canvas')?.getAttribute('data-handover-story-layer') === 'modqn-replay-source-backed'
    ));
    await page.waitForFunction(() => (
      document.querySelector('canvas')?.getAttribute('data-handover-story-fake-beam-hopping') === '0'
    ));
    await page.waitForFunction(() => (
      document.querySelector('canvas')?.getAttribute('data-handover-story-source-gap') === 'beam-hopping-schedule'
    ));
    await page.waitForFunction(() => (
      Number(document.querySelector('canvas')?.getAttribute('data-modqn-replay-source-gap-count') ?? '0') > 0
    ));
    assert.equal(
      await page.locator('[data-testid^="service-status-banner"]').count(),
      0,
      'MODQN replay proof lane must not expose the live training-service banner',
    );
    assertNoUnexpectedBrowserErrors(errors, requestFailures, httpFailures, 'proof lane');
  } finally {
    await closePage(page);
  }
}

async function validateArtifactLane(browser: Browser, appUrl: string): Promise<void> {
  const { page, errors, requestFailures, httpFailures } = await openModqnPage(browser, appUrl, 'artifact-replay');
  try {
    await page.locator('.leo-app-shell[data-scene-lane="artifact-replay"]').waitFor({ timeout: 30000 });
    await page.locator('.leo-shell-canvas[data-scene-lane="artifact-replay"]').waitFor({ timeout: 30000 });
    await page.locator('[data-testid="artifact-replay-sidebar"], [data-testid="artifact-scene-fail-closed"]').first().waitFor({ timeout: 30000 });
    assert.equal(
      await page.locator('[data-testid="modqn-replay-source-gap-list"]').count(),
      0,
      'artifact replay must not show MODQN replay source-gap list',
    );
    assert.equal(
      await page.locator('[data-testid="modqn-evidence-source-gap-list"]').count(),
      0,
      'artifact replay must not show MODQN evidence source-gap list',
    );
    assert.equal(
      await page.locator('canvas[data-modqn-replay-scene-layer]').count(),
      0,
      'artifact replay must not publish MODQN replay proof canvas telemetry',
    );
    const liveSimulationEnabled = await page.locator('canvas').first().getAttribute('data-live-simulation-enabled').catch(() => null);
    if (liveSimulationEnabled !== null) {
      assert.equal(liveSimulationEnabled, '0', 'artifact replay canvas must keep live simulation disabled');
    }
    assertNoUnexpectedBrowserErrors(errors, requestFailures, httpFailures, 'artifact lane');
  } finally {
    await closePage(page);
  }
}

async function main(): Promise<void> {
  const appUrl = await detectAppUrl();
  const browser = await chromium.launch();
  try {
    await validateProofLane(browser, appUrl);
    await validateArtifactLane(browser, appUrl);
  } finally {
    await browser.close().catch(() => undefined);
  }

  console.log(JSON.stringify({
    appUrl,
    proofLane: 'PASS',
    artifactLane: 'PASS',
    result: 'PASS',
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
