/**
 * Browser gate for the Act 3 / Act 4 scene-first course segments.
 *
 * The full Golden Flow validator owns the 12-beat evidence path. This focused
 * gate owns only the course query contract: segment boundaries, interaction
 * pause, segment end stops, released edge handoffs, and chrome absence.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { chromium, type Browser, type Page } from '@playwright/test';
import { MEASURED_BROWSER_GATE_FLOORS_MS, runBrowserValidator } from './lib/browser-gate.ts';

import {
  GOLDEN_FLOW_ACT3_HREF,
  GOLDEN_FLOW_ACT4_HREF,
  GOLDEN_FLOW_ROUTE,
} from '../src/prototype/golden-flow/goldenFlowRoutes.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const LEGACY_CHROME = [
  '.leo-shell-left',
  '.leo-shell-right',
  '.leo-shell-top-chrome',
  '[data-testid="shell-chrome-controls"]',
  '[data-testid="six-acts-cinema-overlay"]',
  '.golden-flow-topbar',
  '.golden-flow-chapter',
  '.golden-flow-provenance',
  '.golden-flow-progress',
  '.golden-flow-source',
].join(',');

async function waitForBeat(page: Page, beat: string, timeout = 30_000): Promise<void> {
  await page.waitForFunction(
    (expected) => document.querySelector('main')?.getAttribute('data-beat') === expected,
    beat,
    { timeout },
  );
}

async function assertSceneFirstSurface(page: Page, label: string): Promise<void> {
  assert.equal(await page.locator(LEGACY_CHROME).count(), 0, `${label}: legacy shell chrome is absent`);
  const stage = page.locator('[data-testid="golden-flow-stage"]');
  assert.equal(await stage.count(), 1, `${label}: Golden Flow stage is mounted`);
  const stageBox = await stage.boundingBox();
  assert.ok(stageBox, `${label}: stage has a measurable box`);
  const viewport = page.viewportSize();
  assert.ok(viewport, `${label}: viewport is configured`);
  assert.equal(
    await page.locator('main').getAttribute('data-layout-carrier'),
    'legacy-3d-event-dock',
    `${label}: the legacy 3D stage with event-only disclosure is mounted`,
  );
  assert.equal(await page.locator('main').getAttribute('data-ground-carrier'), 'legacy-ground-grid-no-hex');
  assert.equal(await page.locator('main').getAttribute('data-spacecraft-carrier'), 'constellation-glb-opaque');
  assert.ok(stageBox.width >= viewport.width * 0.55, `${label}: central stage keeps at least 55% viewport width`);
  assert.ok(stageBox.height >= viewport.height * 0.65, `${label}: central stage keeps at least 65% viewport height`);
  assert.equal(await page.locator('.golden-flow-legacy-panel').count(), 0, `${label}: persistent side rails are absent`);
  const eventDock = page.locator('.golden-flow-event-dock');
  assert.equal(await eventDock.count(), 1, `${label}: exactly one current-event dock is mounted`);
  const dockBox = await eventDock.boundingBox();
  assert.ok(dockBox, `${label}: event dock has a measurable box`);
  assert.ok(dockBox.y >= stageBox.y + stageBox.height - 1, `${label}: event dock stays outside the central 3D stage`);
  assert.equal(await page.locator('[data-primary-teaching="true"]').count(), 1, `${label}: exactly one primary cue is mounted`);
  assert.equal(await page.locator('.golden-flow-primary-cue').count(), 1, `${label}: inactive cue DOM is absent`);
  assert.equal(await page.locator(LEGACY_CHROME).count(), 0, `${label}: all persistent chrome is absent on core beat`);
  const subjectOverlap = await page.evaluate(() => {
    const subject = document.querySelector<HTMLElement>('[data-testid="golden-flow-subject-safe"]')?.getBoundingClientRect();
    const cue = document.querySelector<HTMLElement>('[data-primary-teaching="true"]')?.getBoundingClientRect();
    if (!subject || !cue) return 1;
    const left = Math.max(subject.left, cue.left);
    const top = Math.max(subject.top, cue.top);
    const right = Math.min(subject.right, cue.right);
    const bottom = Math.min(subject.bottom, cue.bottom);
    const overlap = Math.max(0, right - left) * Math.max(0, bottom - top);
    return subject.width * subject.height > 0 ? overlap / (subject.width * subject.height) : 1;
  });
  assert.ok(subjectOverlap <= 0.05, `${label}: primary cue overlap is ${(subjectOverlap * 100).toFixed(1)}%, above 5%`);
}

async function assertAct3EventDockLayout(page: Page, label: string): Promise<void> {
  const initial = await page.evaluate(() => {
    const dock = document.querySelector<HTMLElement>('.golden-flow-event-dock');
    const readout = document.querySelector<HTMLElement>('.golden-flow-event-dock__readout');
    const copy = document.querySelector<HTMLElement>('.golden-flow-event-dock__copy');
    const reveal = document.querySelector<HTMLElement>('[data-testid="transport-reveal-button"]');
    const transport = document.querySelector<HTMLElement>('[data-testid="teaching-transport"]');
    if (!dock || !readout || !copy || !transport) {
      return null;
    }
    const dockRect = dock.getBoundingClientRect();
    const readoutRect = readout.getBoundingClientRect();
    const copyRect = copy.getBoundingClientRect();
    const revealRect = reveal?.getBoundingClientRect();
    const transportRect = transport.getBoundingClientRect();
    return {
      mobile: window.matchMedia('(max-width: 760px)').matches,
      dock: { top: dockRect.top, right: dockRect.right, bottom: dockRect.bottom },
      readout: { top: readoutRect.top, right: readoutRect.right, bottom: readoutRect.bottom },
      copy: { top: copyRect.top, bottom: copyRect.bottom },
      reveal: revealRect ? { top: revealRect.top, bottom: revealRect.bottom } : null,
      transport: { top: transportRect.top },
      dockScroll: {
        clientHeight: dock.clientHeight,
        scrollHeight: dock.scrollHeight,
        clientWidth: dock.clientWidth,
        scrollWidth: dock.scrollWidth,
      },
    };
  });

  assert.ok(initial, `${label}: event-dock layout surfaces are mounted`);
  assert.ok(
    initial.dockScroll.scrollWidth <= initial.dockScroll.clientWidth + 1,
    `${label}: event dock has no horizontal content overflow (${initial.dockScroll.scrollWidth} > ${initial.dockScroll.clientWidth})`,
  );

  if (!initial.mobile) {
    assert.ok(
      initial.readout.top >= initial.dock.top - 1 && initial.readout.bottom <= initial.dock.bottom + 1,
      `${label}: desktop readout stays inside event dock (${JSON.stringify(initial.readout)} vs ${JSON.stringify(initial.dock)})`,
    );
    assert.ok(
      initial.dockScroll.scrollHeight <= initial.dockScroll.clientHeight + 1,
      `${label}: desktop event dock does not clip scroll content (${initial.dockScroll.scrollHeight} > ${initial.dockScroll.clientHeight})`,
    );
    return;
  }

  assert.ok(
    initial.reveal &&
    initial.reveal.top >= initial.dock.bottom - 1 && initial.reveal.bottom <= initial.transport.top + 1,
    `${label}: transport reveal affordance sits between the sheet and transport`,
  );
  assert.ok(
    initial.reveal && (
      initial.reveal.bottom <= initial.copy.top || initial.reveal.top >= initial.copy.bottom
    ),
    `${label}: transport reveal affordance does not cover the teaching copy`,
  );

  const finalReadout = await page.evaluate(() => {
    const dock = document.querySelector<HTMLElement>('.golden-flow-event-dock');
    const readout = document.querySelector<HTMLElement>('.golden-flow-event-dock__readout');
    if (!dock || !readout) return null;
    dock.scrollTop = dock.scrollHeight;
    const dockRect = dock.getBoundingClientRect();
    const readoutRect = readout.getBoundingClientRect();
    return {
      scrolled: dock.scrollTop > 0,
      dockBottom: dockRect.bottom,
      readoutBottom: readoutRect.bottom,
    };
  });
  assert.ok(finalReadout, `${label}: mobile event dock can be scrolled`);
  assert.ok(finalReadout.scrolled, `${label}: mobile event dock exposes scrollable teaching content`);
  assert.ok(
    finalReadout.readoutBottom <= finalReadout.dockBottom + 1,
    `${label}: mobile readout tail is reachable inside the sheet (${JSON.stringify(finalReadout)})`,
  );

  const reveal = page.locator('[data-testid="transport-reveal-button"]');
  await reveal.click();
  await page.waitForTimeout(80);
  const revealed = await page.evaluate(() => {
    const dock = document.querySelector<HTMLElement>('.golden-flow-event-dock');
    const transport = document.querySelector<HTMLElement>('[data-testid="teaching-transport"]');
    if (!dock || !transport) return null;
    return {
      dockBottom: dock.getBoundingClientRect().bottom,
      transportTop: transport.getBoundingClientRect().top,
      transportOpacity: Number.parseFloat(getComputedStyle(transport).opacity),
    };
  });
  assert.ok(revealed, `${label}: revealed transport layout is measurable`);
  assert.ok(revealed.transportOpacity > 0, `${label}: transport is visible after reveal`);
  assert.ok(
    revealed.dockBottom <= revealed.transportTop - 8,
    `${label}: revealed transport does not cover the Act 3 sheet (${JSON.stringify(revealed)})`,
  );
}

async function assertEdgeControlsOutsideSafeArea(page: Page, label: string): Promise<void> {
  const result = await page.evaluate(() => {
    const safeRect = document.querySelector<HTMLElement>('[data-testid="golden-flow-subject-safe"]')?.getBoundingClientRect();
    if (!safeRect) return [];
    const safe = {
      left: safeRect.left,
      right: safeRect.right,
      top: safeRect.top,
      bottom: safeRect.bottom,
    };
    const controls = [...document.querySelectorAll<HTMLElement>('[data-course-segment-finale], .golden-flow-finale')];
    return controls.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        className: element.className,
        intersectsSafeArea: rect.left < safe.right
          && rect.right > safe.left
          && rect.top < safe.bottom
          && rect.bottom > safe.top,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
    });
  });
  assert.ok(result.length > 0, `${label}: finale controls are rendered`);
  assert.ok(result.every(control => !control.intersectsSafeArea), `${label}: finale controls stay outside central safe area`);
}

async function validateAct3(page: Page, appUrl: string): Promise<void> {
  await page.goto(new URL(GOLDEN_FLOW_ACT3_HREF, appUrl).toString(), { waitUntil: 'domcontentloaded' });
  await waitForBeat(page, 'establish');
  assert.equal(await page.locator('main').getAttribute('data-course-segment'), 'act3');
  assert.equal(await page.locator('main').getAttribute('data-course-segment-start'), 'establish');
  assert.equal(await page.locator('main').getAttribute('data-course-segment-end'), 'restore');
  assert.equal(await page.locator('main').getAttribute('data-course-beat-index'), '1');

  await waitForBeat(page, 'angles');
  await assertSceneFirstSurface(page, 'Act 3 angles');
  assert.equal(await page.locator('[data-testid="golden-flow-angle-elevation"]').count(), 1);

  await waitForBeat(page, 'interaction');
  await assertSceneFirstSurface(page, 'Act 3 interaction');
  await assertAct3EventDockLayout(page, 'Act 3 interaction');
  assert.equal(await page.locator('main').getAttribute('data-course-visible-controls'), 'ue-drag');
  assert.equal(await page.locator('[data-control-id^="camera-"]').count(), 0, 'Act 3 has no manual camera controls');
  await page.waitForTimeout(11_000);
  assert.equal(await page.locator('main').getAttribute('data-beat'), 'interaction', 'Act 3 interaction waits for real input');
  const slider = page.getByRole('slider', { name: '拖曳地面 UE' });
  const sliderBox = await slider.boundingBox();
  assert.ok(sliderBox, 'Act 3 interaction has a real pointer/keyboard handle');
  await page.mouse.move(sliderBox.x + 4, sliderBox.y + sliderBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(sliderBox.x + 124, sliderBox.y + sliderBox.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction(
    () => document.querySelector('main')?.getAttribute('data-interaction-complete') === 'true',
    undefined,
    { timeout: 5_000 },
  );
  assert.equal(await page.locator('main').getAttribute('data-interaction-complete'), 'true', 'Act 3 interaction completes after drag');

  await waitForBeat(page, 'consequence');
  await assertAct3EventDockLayout(page, 'Act 3 consequence');
  await waitForBeat(page, 'restore');
  await page.waitForFunction(
    () => document.querySelector('main')?.getAttribute('data-course-segment-ended') === 'true',
    undefined,
    { timeout: 10_000 },
  );
  assert.equal(await page.locator('main').getAttribute('data-beat'), 'restore', 'Act 3 restore does not advance to candidate');
  assert.equal(await page.locator('main').getAttribute('data-course-segment-ended'), 'true', 'Act 3 course segment ends at restore');
  assert.equal(await page.locator('main').getAttribute('data-course-visible-controls'), 'replay-act3,next-act4');
  assert.equal(await page.locator('[data-course-segment-finale]').count(), 1);
  assert.equal(await page.locator('[data-control-id="next-act4"]').getAttribute('href'), GOLDEN_FLOW_ACT4_HREF);
  await assertEdgeControlsOutsideSafeArea(page, 'Act 3 finale');
}

async function validateAct3Mobile(browser: Browser, appUrl: string, viewport: { width: number; height: number }): Promise<void> {
  const page = await browser.newPage({ viewport });
  try {
    for (const beat of ['interaction', 'consequence'] as const) {
      const url = new URL(GOLDEN_FLOW_ACT3_HREF, appUrl);
      url.searchParams.set('beat', beat);
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
      await waitForBeat(page, beat);
      await assertAct3EventDockLayout(page, `Act 3 ${beat} ${viewport.width}x${viewport.height}`);
    }
  } finally {
    await page.close();
  }
}

async function validateAct4(page: Page, appUrl: string): Promise<void> {
  await page.goto(new URL(GOLDEN_FLOW_ACT4_HREF, appUrl).toString(), { waitUntil: 'domcontentloaded' });
  await waitForBeat(page, 'candidate');
  assert.equal(await page.locator('main').getAttribute('data-course-segment'), 'act4');
  assert.equal(await page.locator('main').getAttribute('data-course-segment-start'), 'candidate');
  assert.equal(await page.locator('main').getAttribute('data-course-segment-end'), 'new-normal');
  assert.equal(await page.locator('main').getAttribute('data-course-beat-index'), '1');
  assert.equal(await page.locator('[data-testid="golden-flow-angle-elevation"]').count(), 0, 'Act 4 never shows angle beats');
  assert.equal(await page.locator('[data-testid="golden-flow-angle-off-axis"]').count(), 0, 'Act 4 never shows angle beats');

  for (const beat of ['qualification', 'ttt', 'trace', 'commit', 'receipt', 'new-normal']) {
    await waitForBeat(page, beat);
    if (beat !== 'new-normal') await assertSceneFirstSurface(page, `Act 4 ${beat}`);
  }
  await page.waitForFunction(
    () => document.querySelector('main')?.getAttribute('data-course-segment-ended') === 'true',
    undefined,
    { timeout: 10_000 },
  );
  assert.equal(await page.locator('main').getAttribute('data-course-segment-ended'), 'true', 'Act 4 course segment ends at new-normal');
  assert.equal(await page.locator('main').getAttribute('data-course-visible-controls'), 'replay');
  assert.equal(await page.locator('[data-control-id="next"]').count(), 0, 'hidden Act 5 is not linked from the Act 4 finale');
  await assertEdgeControlsOutsideSafeArea(page, 'Act 4 finale');
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const browser: Browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await validateAct3(page, appUrl);
    await validateAct4(page, appUrl);
    await validateAct3Mobile(browser, appUrl, { width: 390, height: 844 });
    await validateAct3Mobile(browser, appUrl, { width: 320, height: 720 });
    console.log('[golden-flow-course-segments-browser] PASS — Act 3/4 boundaries, pause, chrome, and released edge handoffs verified');
  } finally {
    await browser.close();
  }
}

void runBrowserValidator(
  {
    validator: 'validate-golden-flow-course-segments-browser',
    appUrl: process.env.APP_URL ?? process.argv[2],
    floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.layout,
  },
  async () => main(),
).catch((error) => {
  console.error('[golden-flow-course-segments-browser] FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
