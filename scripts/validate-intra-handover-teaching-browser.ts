/**
 * Browser proof for the isolated intra-satellite teaching episode.
 *
 * This validator checks the rendered route, not only the director model:
 * source identity, truthful fail-closed fields, one primary cue, sparse
 * composition, transport interaction, mobile bounds, and console cleanliness.
 */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';

import { detectAppUrl } from './_vc2-browser-fixture.ts';
import {
  INTRA_HANDOVER_TEACHING_BEATS,
  INTRA_HANDOVER_TEACHING_DURATION_SEC,
  INTRA_HANDOVER_TEACHING_ROUTE,
} from '../src/prototype/intra-handover-teaching/intraHandoverTeachingDirector.ts';
import { buildIntraHandoverTeachingSource } from '../src/prototype/intra-handover-teaching/intraHandoverTeachingSource.ts';

const SCREENSHOT_DIR = resolve('output/playwright/intra-handover-teaching-r1');
const REPORT_PATH = resolve(SCREENSHOT_DIR, 'browser-measurements.json');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

interface ConsoleProbe {
  readonly pageErrors: string[];
  readonly consoleErrors: string[];
  readonly requestFailures: string[];
  readonly httpFailures: string[];
}

interface ViewportMeasurement {
  readonly width: number;
  readonly height: number;
  readonly beat: string;
  readonly exposedRatio: number;
  readonly collisions: readonly string[];
  readonly outside: readonly string[];
  readonly fontSizes: readonly number[];
  readonly touchTargets: readonly { readonly name: string; readonly width: number; readonly height: number }[];
}

const measurements: ViewportMeasurement[] = [];

function routeUrl(appUrl: string, controls = true): string {
  const url = new URL(INTRA_HANDOVER_TEACHING_ROUTE, appUrl);
  if (controls) url.searchParams.set('controls', '1');
  return url.toString();
}

function installProbe(page: Page): ConsoleProbe {
  const probe: ConsoleProbe = { pageErrors: [], consoleErrors: [], requestFailures: [], httpFailures: [] };
  page.on('pageerror', error => probe.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') probe.consoleErrors.push(message.text());
  });
  page.on('requestfailed', request => {
    probe.requestFailures.push(`${request.url()} ${request.failure()?.errorText ?? 'request failed'}`);
  });
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.svg')) {
      probe.httpFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  return probe;
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector<HTMLElement>('[data-testid="intra-handover-teaching"]')?.dataset.sourceStatus === 'ready',
    undefined,
    { timeout: 45_000 },
  );
  await page.locator('[data-testid="intra-handover-teaching-stage"]').waitFor({ timeout: 10_000 });
}

async function seekTo(page: Page, timeSec: number): Promise<void> {
  const range = page.locator('[data-testid="transport-timeline-range"]');
  await range.evaluate((element, value) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, timeSec);
  await page.waitForFunction(
    expected => Math.abs(Number(document.querySelector<HTMLElement>('[data-testid="intra-handover-teaching"]')?.dataset.timeSec) - expected) < .65,
    timeSec,
    { timeout: 5_000 },
  );
}

async function assertSourceTruth(page: Page): Promise<void> {
  const source = buildIntraHandoverTeachingSource();
  assert.equal(source.available, true, source.available ? '' : source.reason);
  if (!source.available) return;
  const main = page.locator('[data-testid="intra-handover-teaching"]');
  assert.equal(await main.getAttribute('data-source-status'), 'ready');
  assert.equal(await main.getAttribute('data-source-owner'), 'live-walker');
  assert.equal(await main.getAttribute('data-claim-kind'), 'live-truth');
  assert.equal(await main.getAttribute('data-source-contract'), 'live-walker-intra-beam-switch-v1');
  assert.equal(await main.getAttribute('data-event-id'), source.intraEvent.id);
  assert.equal(await main.getAttribute('data-source-intra-from-satellite'), source.intraEvent.fromSatId);
  assert.equal(await main.getAttribute('data-source-intra-to-satellite'), source.intraEvent.toSatId);
  assert.equal(await main.getAttribute('data-source-intra-from-beam'), String(source.intraEvent.fromBeamId));
  assert.equal(await main.getAttribute('data-source-intra-to-beam'), String(source.intraEvent.toBeamId));
  assert.equal(await main.getAttribute('data-satellite-identity-stable'), 'true');
  assert.equal(await main.getAttribute('data-beam-identity-changed'), 'true');
  assert.equal(await main.getAttribute('data-ttt-available'), 'false');
  assert.equal(await main.getAttribute('data-ee-available'), 'false');

  const badge = page.locator('[data-testid="source-badge"]');
  assert.equal(await badge.getAttribute('data-event-id'), source.intraEvent.id);
  assert.equal(await badge.getAttribute('data-source-owner'), 'live-walker');
  assert.match(await badge.innerText(), /coarse offline forecast/);
  const identity = page.locator('[data-testid="source-identity-display"]');
  assert.equal(await identity.getAttribute('data-source-from-satellite'), source.intraEvent.fromSatId);
  assert.equal(await identity.getAttribute('data-source-to-satellite'), source.intraEvent.toSatId);
  assert.equal(await identity.getAttribute('data-source-from-beam'), String(source.intraEvent.fromBeamId));
  assert.equal(await identity.getAttribute('data-source-to-beam'), String(source.intraEvent.toBeamId));

  const comparisonFrom = await main.getAttribute('data-source-inter-from-satellite');
  const comparisonTo = await main.getAttribute('data-source-inter-to-satellite');
  assert.ok(comparisonFrom && comparisonTo && comparisonFrom !== comparisonTo, 'comparison event proves an inter-satellite identity change');
}

async function measureComposition(page: Page, label: string): Promise<ViewportMeasurement> {
  const report = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-testid="intra-handover-teaching"]');
    const stage = document.querySelector<HTMLElement>('[data-testid="intra-handover-teaching-stage"]');
    if (!root || !stage) throw new Error('teaching root/stage missing');
    const stageRect = stage.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const overlays = [...root.querySelectorAll<HTMLElement>('[data-stage-occluder="true"]')]
      .filter(node => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
      })
      .map(node => ({ node, rect: node.getBoundingClientRect(), name: node.dataset.testid ?? node.className }));
    const cols = 48;
    const rows = 27;
    const centralLeftRatio = viewport.width <= 720 ? .2 : .28;
    const centralRightRatio = viewport.width <= 720 ? .8 : .72;
    const centralTopRatio = viewport.width <= 720 ? .2 : .23;
    const centralBottomRatio = viewport.width <= 720 ? .6 : .68;
    let covered = 0;
    let centralCells = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < cols; column += 1) {
        const x = stageRect.left + (column + .5) / cols * stageRect.width;
        const y = stageRect.top + (row + .5) / rows * stageRect.height;
        const central = x >= stageRect.left + stageRect.width * centralLeftRatio
          && x <= stageRect.left + stageRect.width * centralRightRatio
          && y >= stageRect.top + stageRect.height * centralTopRatio
          && y <= stageRect.top + stageRect.height * centralBottomRatio;
        if (!central) continue;
        centralCells += 1;
        if (overlays.some(({ rect }) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)) covered += 1;
      }
    }
    const safe = {
      left: stageRect.left + stageRect.width * .28,
      right: stageRect.left + stageRect.width * .72,
      top: stageRect.top + stageRect.height * .23,
      bottom: stageRect.top + stageRect.height * .68,
    };
    const centralCollisions = overlays
      .filter(({ rect }) => rect.left < safe.right && rect.right > safe.left && rect.top < safe.bottom && rect.bottom > safe.top)
      .map(({ name }) => name);
    const collisions: string[] = [];
    for (let index = 0; index < overlays.length; index += 1) {
      for (let next = index + 1; next < overlays.length; next += 1) {
        const first = overlays[index]!;
        const second = overlays[next]!;
        const overlapWidth = Math.max(0, Math.min(first.rect.right, second.rect.right) - Math.max(first.rect.left, second.rect.left));
        const overlapHeight = Math.max(0, Math.min(first.rect.bottom, second.rect.bottom) - Math.max(first.rect.top, second.rect.top));
        if (overlapWidth * overlapHeight > 24 * 24) collisions.push(`${first.name}↔${second.name}`);
      }
    }
    const requiredText = [
      ...root.querySelectorAll<HTMLElement>('.intra-teaching__eyebrow, .intra-teaching__header h1, .intra-teaching__header p, .intra-teaching__source-badge, .intra-teaching__primary-cue, .intra-teaching__caption, .intra-teaching__identity-proof, .intra-teaching__inspect, .intra-teaching__inspect button'),
    ];
    const fontSizes = requiredText.map(element => Number.parseFloat(getComputedStyle(element).fontSize));
    const captionSize = Number.parseFloat(getComputedStyle(root.querySelector<HTMLElement>('[data-caption-line="true"]')!).fontSize);
    const cueKickerSize = Number.parseFloat(getComputedStyle(root.querySelector<HTMLElement>('.intra-teaching__cue-kicker')!).fontSize);
    const cueStrongSize = Number.parseFloat(getComputedStyle(root.querySelector<HTMLElement>('.intra-teaching__cue-facts strong')!).fontSize);
    const controlFontSizes = [...root.querySelectorAll<HTMLElement>('button, .teaching-transport__time, .teaching-transport__btn-label, .teaching-transport__btn-text, .teaching-transport__speed-btn')]
      .map(element => Number.parseFloat(getComputedStyle(element).fontSize));
    const worldLabelSizes = [...root.querySelectorAll<SVGTextElement>('.intra-teaching__svg-label')]
      .map(element => Number.parseFloat(getComputedStyle(element).fontSize));
    const controls = [...root.querySelectorAll<HTMLElement>('button, input[type="range"]')]
      .map(element => {
        const rect = element.getBoundingClientRect();
        return { name: element.getAttribute('aria-label') ?? element.dataset.testid ?? element.tagName, width: rect.width, height: rect.height };
      });
    const outside = controls
      .filter(({ name }) => name !== '教學時間軸進度')
      .map(({ name }) => {
        const element = [...root.querySelectorAll<HTMLElement>('button, input[type="range"]')].find(item => (item.getAttribute('aria-label') ?? item.dataset.testid ?? item.tagName) === name)!;
        const rect = element.getBoundingClientRect();
        return { name, rect };
      })
      .filter(({ rect }) => rect.left < 0 || rect.top < 0 || rect.right > viewport.width || rect.bottom > viewport.height)
      .map(({ name }) => name);
    return {
      exposedRatio: centralCells > 0 ? 1 - covered / centralCells : 0,
      centralCollisions,
      collisions,
      outside,
      fontSizes,
      captionSize,
      cueKickerSize,
      cueStrongSize,
      controlFontSizes,
      worldLabelSizes,
      controls,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: viewport.width,
    };
  });
  assert.ok(report.exposedRatio >= .70, `${label}: central visual exposure is ${(report.exposedRatio * 100).toFixed(1)}%`);
  if (report.viewportWidth >= 760) assert.deepEqual(report.centralCollisions, [], `${label}: edge teaching chrome does not cover the central visual`);
  assert.deepEqual(report.collisions, [], `${label}: teaching overlays do not collide: ${report.collisions.join(', ')}`);
  assert.deepEqual(report.outside, [], `${label}: controls stay inside viewport`);
  assert.ok(report.fontSizes.every(size => size >= 16), `${label}: visible instructional text is >=16px (${report.fontSizes.join(', ')})`);
  const mobile = report.viewportWidth <= 720;
  assert.ok(report.captionSize >= (mobile ? 22 : 28), `${label}: primary subtitle is >=${mobile ? 22 : 28}px`);
  assert.ok(report.cueKickerSize >= (mobile ? 19 : 22), `${label}: key cue label is >=${mobile ? 19 : 22}px`);
  assert.ok(report.cueStrongSize >= (mobile ? 19 : 22), `${label}: key cue value is >=${mobile ? 19 : 22}px`);
  assert.ok(report.controlFontSizes.every(size => size >= 18), `${label}: controls are >=18px (${report.controlFontSizes.join(', ')})`);
  assert.ok(report.worldLabelSizes.every(size => size >= 17), `${label}: world labels are >=17px (${report.worldLabelSizes.join(', ')})`);
  assert.equal(report.scrollWidth, report.viewportWidth, `${label}: no horizontal overflow`);
  assert.ok(report.controls.filter(control => control.name !== '教學時間軸進度').every(control => control.width >= 44 && control.height >= 44), `${label}: touch controls are >=44px`);
  const measurement = {
    width: report.viewportWidth,
    height: await page.evaluate(() => window.innerHeight),
    beat: await page.locator('[data-testid="intra-handover-teaching"]').getAttribute('data-beat') ?? label,
    exposedRatio: report.exposedRatio,
    collisions: report.collisions,
    outside: report.outside,
    fontSizes: report.fontSizes,
    touchTargets: report.controls.filter(control => control.name !== '教學時間軸進度'),
  };
  measurements.push(measurement);
  return measurement;
}

async function assertPrimaryCueAndCaption(page: Page, beatId: string): Promise<void> {
  assert.equal(await page.locator('[data-primary-cue="true"]').count(), 1, `${beatId}: exactly one primary cue`);
  assert.equal(await page.locator('[data-caption-line="true"]').count(), 1, `${beatId}: exactly one caption line`);
  assert.ok(await page.locator('[data-caption-line="true"]').innerText().then(text => text.trim().endsWith('。')), `${beatId}: caption is a complete sentence`);
  assert.equal(await page.locator('[data-testid="intra-handover-teaching"]').getAttribute('data-camera-director'), 'automatic');
  assert.equal(await page.locator('[data-testid="intra-handover-teaching"]').getAttribute('data-beat'), beatId);
}

async function assertTransport(page: Page): Promise<void> {
  const transport = page.locator('[data-testid="intra-handover-teaching-transport"]');
  assert.equal(await transport.count(), 1, 'shared teaching transport is mounted');
  assert.equal(await transport.locator('[data-testid^="transport-speed-"]').count(), 4, 'all four transport speeds are mounted');
  assert.equal(await transport.locator('[data-testid="transport-rewind"]').count(), 1);
  assert.equal(await transport.locator('[data-testid="transport-forward"]').count(), 1);
  assert.equal(await transport.locator('[data-testid="transport-timeline-range"]').count(), 1);
  const playPause = transport.locator('[data-testid="transport-play-pause"]');
  await playPause.click();
  const pausedAt = Number(await page.locator('[data-testid="intra-handover-teaching"]').getAttribute('data-time-sec'));
  await page.waitForTimeout(300);
  const pausedAfter = Number(await page.locator('[data-testid="intra-handover-teaching"]').getAttribute('data-time-sec'));
  assert.ok(Math.abs(pausedAfter - pausedAt) < .3, 'play/pause pauses the deterministic clock');
  await transport.locator('[data-testid="transport-forward"]').click();
  assert.ok(Number(await page.locator('[data-testid="intra-handover-teaching"]').getAttribute('data-time-sec')) > pausedAt, '+5 seek advances the lesson');
  await transport.locator('[data-testid="transport-rewind"]').click();
  for (const speed of [0.5, 1, 1.5, 2] as const) {
    await transport.locator(`[data-testid="transport-speed-${speed}"]`).click();
    assert.equal(await page.locator('[data-testid="intra-handover-teaching"]').getAttribute('data-speed'), String(speed), `${speed}x is selected`);
  }
  await seekTo(page, 42);
  assert.equal(await page.locator('[data-testid="intra-handover-inspect"]').count(), 0, 'inspection checkpoint is only present on receipt/after beats');
  await seekTo(page, 58);
  const inspect = page.locator('[data-testid="intra-handover-inspect"]');
  assert.equal(await inspect.count(), 1, 'receipt beat exposes before/after inspection');
  await inspect.locator('[data-testid="inspect-after"]').click();
  assert.equal(await inspect.locator('[data-testid="inspect-after"]').getAttribute('aria-pressed'), 'true');
  await inspect.locator('[data-testid="inspect-before"]').click();
  assert.equal(await inspect.locator('[data-testid="inspect-before"]').getAttribute('aria-pressed'), 'true');
}

async function assertLearningLoop(page: Page): Promise<void> {
  await seekTo(page, 25);
  const root = page.locator('[data-testid="intra-handover-teaching"]');
  assert.equal(await root.getAttribute('data-learning-loop-phase'), 'prediction', 'candidate beat is the learner prediction checkpoint');
  const prediction = page.locator('[data-testid="intra-handover-prediction"]');
  assert.equal(await prediction.count(), 1, 'candidate beat exposes one meaningful beam choice');
  await prediction.locator('[data-testid="predict-old-beam"]').click();
  assert.equal(await root.getAttribute('data-prediction'), 'old', 'learner prediction is retained');
  assert.match(await prediction.locator('[data-testid="prediction-outcome"]').innerText(), /v\d+/);

  await seekTo(page, 47);
  assert.equal(await root.getAttribute('data-learning-loop-phase'), 'visible-consequence', 'switch beat exposes the visible consequence');
  assert.equal(await page.locator('[data-testid="intra-handover-consequence"]').count(), 1, 'switch consequence is rendered');
  assert.match(await page.locator('[data-testid="intra-handover-consequence"]').innerText(), /來源事件切到新 beam|服務 beam 已切到/);

  await seekTo(page, 58);
  assert.equal(await root.getAttribute('data-learning-loop-phase'), 'causal-explanation', 'receipt beat explains source-backed fields');
  assert.match(await page.locator('[data-testid="intra-handover-consequence"]').innerText(), /EE|beam/);

  await seekTo(page, 76);
  assert.equal(await root.getAttribute('data-learning-loop-phase'), 'transfer-check', 'final beat is the intra/inter transfer check');
  assert.match(await page.locator('[data-caption-line="true"]').innerText(), /跨衛星換手/);
  assert.equal(await root.getAttribute('data-satellite-identity-stable'), 'true');
  assert.equal(await root.getAttribute('data-beam-identity-changed'), 'true');
}

async function captureDesktopBeats(page: Page): Promise<void> {
  await page.locator('[data-testid="transport-play-pause"]').click();
  for (const beat of INTRA_HANDOVER_TEACHING_BEATS) {
    const target = beat.startSec + Math.min(.8, (beat.endSec - beat.startSec) / 3);
    await seekTo(page, target);
    await assertPrimaryCueAndCaption(page, beat.id);
    await measureComposition(page, `desktop-${beat.id}`);
    const screenshotPath = resolve(SCREENSHOT_DIR, `desktop-${String(beat.order).padStart(2, '0')}-${beat.id}.png`);
    await page.screenshot({ path: screenshotPath });
    assert.ok(existsSync(screenshotPath), `${beat.id}: desktop screenshot exists`);
  }
}

async function captureMobileKeyBeats(page: Page): Promise<void> {
  for (const [width, height] of [[390, 844], [320, 720]] as const) {
    await page.setViewportSize({ width, height });
    for (const beatId of ['establish', 'switch', 'receipt', 'compare'] as const) {
      const beat = INTRA_HANDOVER_TEACHING_BEATS.find(candidate => candidate.id === beatId)!;
      await seekTo(page, beat.startSec + .7);
      await assertPrimaryCueAndCaption(page, beat.id);
      await measureComposition(page, `${width}x${height}-${beat.id}`);
      const screenshotPath = resolve(SCREENSHOT_DIR, `mobile-${width}x${height}-${beat.id}.png`);
      await page.screenshot({ path: screenshotPath });
      assert.ok(existsSync(screenshotPath), `${width}x${height} ${beat.id}: mobile screenshot exists`);
    }
  }
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const browser: Browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const probe = installProbe(page);
  try {
    await page.goto(routeUrl(appUrl), { waitUntil: 'domcontentloaded' });
    await waitForReady(page);
    await assertSourceTruth(page);
    const initialTime = Number(await page.locator('[data-testid="intra-handover-teaching"]').getAttribute('data-time-sec'));
    assert.equal(await page.locator('[data-testid="intra-handover-teaching"]').getAttribute('data-playing'), 'true', 'lesson starts self-playing');
    await page.waitForTimeout(1200);
    const autoplayTime = Number(await page.locator('[data-testid="intra-handover-teaching"]').getAttribute('data-time-sec'));
    assert.ok(autoplayTime > initialTime, 'self-playing clock advances');
    await assertTransport(page);
    await assertLearningLoop(page);
    await captureDesktopBeats(page);
    await captureMobileKeyBeats(page);

    const realErrors = [...probe.pageErrors, ...probe.consoleErrors, ...probe.requestFailures, ...probe.httpFailures];
    assert.deepEqual(realErrors, [], `zero browser errors: ${JSON.stringify(realErrors)}`);
    writeFileSync(REPORT_PATH, JSON.stringify({
      generatedAt: new Date().toISOString(),
      route: INTRA_HANDOVER_TEACHING_ROUTE,
      durationSec: INTRA_HANDOVER_TEACHING_DURATION_SEC,
      screenshots: 'desktop all eight beats; mobile 390x844 and 320x720 key beats',
      measurements,
    }, null, 2));
    console.log(`[intra-handover-teaching-browser] PASS — source identity, 8 sparse beats, autoplay, transport seek/speeds, 1920/390/320 bounds, interaction checkpoint, and console cleanliness verified`);
    console.log(`[intra-handover-teaching-browser] screenshots: ${SCREENSHOT_DIR}`);
    console.log(`[intra-handover-teaching-browser] report: ${REPORT_PATH}`);
  } finally {
    await page.close().catch(() => undefined);
    await browser.close();
  }
}

main().catch(error => {
  console.error('[intra-handover-teaching-browser] FAILED:', error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
