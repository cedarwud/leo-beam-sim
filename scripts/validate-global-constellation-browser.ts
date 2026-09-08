/**
 * Browser gate for the visual-first global constellation slice.
 *
 * This gate checks rendered state, not only the existence of React nodes: one
 * selected point cloud at a time, height guides, exact artifact facts, camera
 * poses, persistent scene navigation, the paused local reveal interaction, and
 * the full-viewport stage are all asserted.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { MEASURED_BROWSER_GATE_FLOORS_MS, runBrowserValidator } from './lib/browser-gate.ts';

import {
  GLOBAL_CONSTELLATION_BEATS,
  GLOBAL_CONSTELLATION_CHROME_TIMINGS,
  GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC,
  GLOBAL_CONSTELLATION_FACTS,
  GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC,
  GLOBAL_CONSTELLATION_NTPU_REVEAL_CHECKPOINT_COURSE_TIME_SEC,
  GLOBAL_CONSTELLATION_NTPU_REVEAL_END_COURSE_TIME_SEC,
  GLOBAL_CONSTELLATION_ROUTE,
  globalConstellationReviewFrameCourseTime,
  type GlobalConstellationBeatId,
} from '../src/prototype/global-constellation/globalConstellationDirector.ts';
import { SIX_ACTS_VISIBLE_ROUTES } from '../src/course/nav/sixActsRoutes.ts';
import {
  GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD,
  GLOBAL_CONSTELLATION_CAMERA_SETTLE_REQUIRED_FRAMES,
  GLOBAL_CONSTELLATION_STABLE_HOLD_MS,
} from '../src/prototype/global-constellation/globalConstellationCamera.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const SCREENSHOT_DIR = resolve('output/playwright/global-constellation');
const CONTACT_SHEET_PATH = resolve(SCREENSHOT_DIR, 'check-edge-choreography-contact-sheet.png');
const MEASUREMENT_REPORT_PATH = resolve(SCREENSHOT_DIR, 'acceptance-measurements.json');

interface BrowserRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

interface ResponsiveMeasurement {
  readonly width: number;
  readonly height: number;
  readonly beat: GlobalConstellationBeatId;
  readonly text: readonly { readonly text: string; readonly fontSize: number; readonly rect: BrowserRect }[];
  readonly controls: readonly { readonly label: string; readonly rect: BrowserRect; readonly disabled: boolean }[];
  readonly collisions: readonly { readonly name: string; readonly first: BrowserRect; readonly second: BrowserRect }[];
}

const responsiveMeasurements: ResponsiveMeasurement[] = [];

function assertCaptionContinuity(): void {
  for (let index = 0; index < GLOBAL_CONSTELLATION_BEATS.length - 1; index += 1) {
    const beat = GLOBAL_CONSTELLATION_BEATS[index]!;
    const nextBeat = GLOBAL_CONSTELLATION_BEATS[index + 1]!;
    const currentTiming = GLOBAL_CONSTELLATION_CHROME_TIMINGS[beat.id].caption
      ?? GLOBAL_CONSTELLATION_CHROME_TIMINGS[beat.id]['finale-copy'];
    const nextTiming = GLOBAL_CONSTELLATION_CHROME_TIMINGS[nextBeat.id].caption
      ?? GLOBAL_CONSTELLATION_CHROME_TIMINGS[nextBeat.id]['finale-copy'];
    assert.ok(currentTiming, `${beat.id}: caption timing exists`);
    assert.ok(nextTiming, `${nextBeat.id}: caption timing exists`);
    assert.ok(currentTiming.enterAtSec <= 0.25, `${beat.id}: caption starts promptly`);
    assert.ok(beat.durationSec - currentTiming.exitUntilSec <= 0.2, `${beat.id}: no long blank tail`);
    const gapSec = beat.durationSec - currentTiming.exitUntilSec + nextTiming.enterAtSec;
    assert.ok(gapSec <= 0.251, `${beat.id} -> ${nextBeat.id}: caption gap is short (${gapSec}s)`);
  }
}

async function waitForReady(page: Page, beatId: GlobalConstellationBeatId): Promise<void> {
  await page.waitForFunction(
    (expected) => document.querySelector('main')?.getAttribute('data-beat') === expected
      && document.querySelector('main')?.getAttribute('data-artifacts-ready') === 'true',
    beatId,
    { timeout: 40_000 },
  );
  await page.waitForSelector('[data-testid="global-constellation-stage"] canvas', { state: 'attached', timeout: 20_000 });
}

async function assertPersistentStageNavigation(page: Page, beatId: string): Promise<void> {
  const nav = page.getByTestId('six-acts-stage-nav');
  assert.equal(await nav.count(), 1, `${beatId}: persistent scene navigation is mounted`);
  const links = nav.locator('.six-acts-nav__acts a');
  assert.equal(await links.count(), SIX_ACTS_VISIBLE_ROUTES.length, `${beatId}: stage navigation exposes all released experiments`);
  for (const [index, route] of SIX_ACTS_VISIBLE_ROUTES.entries()) {
    const link = links.nth(index);
    const href = await link.getAttribute('href');
    assert.equal(href, route.href, `${beatId}: stage navigation link ${route.actLabel} targets the canonical route`);
    const box = await link.boundingBox();
    assert.ok(box && box.width >= 44 && box.height >= 44, `${beatId}: scene link ${route.actLabel} has a >=44px tap target (${JSON.stringify(box)})`);
  }
  const current = nav.locator('a[aria-current="page"]');
  assert.equal(await current.count(), 1, `${beatId}: current scene is marked in the persistent navigation`);
  assert.equal(await current.getAttribute('href'), GLOBAL_CONSTELLATION_ROUTE, `${beatId}: Global scene is the active navigation entry`);
  const home = nav.locator('a[href="/"]');
  assert.equal(await home.count(), 1, `${beatId}: stage navigation exposes the homepage at all times`);
  const homeBox = await home.boundingBox();
  assert.ok(homeBox && homeBox.width >= 44 && homeBox.height >= 44, `${beatId}: homepage link has a >=44px tap target`);
}

async function assertStageLayout(page: Page, beatId: string, expectedWidth = 1920, expectedHeight = 1080, minimumExposed = .85): Promise<void> {
  const layout = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('[data-testid="global-constellation-stage"]');
    if (!stage) throw new Error('global constellation stage is missing');
    const rect = stage.getBoundingClientRect();
    const overlays = [...document.querySelectorAll<HTMLElement>('[data-stage-occluder="true"]')]
      .filter(node => !node.matches('[data-scene-anchor-label="true"]'))
      .map(node => node.getBoundingClientRect())
      .filter(rectangle => rectangle.width > 0 && rectangle.height > 0);
    const area = rect.width * rect.height;
    // A union grid avoids counting the header/caption overlap twice.
    const cols = 48;
    const rows = 27;
    let covered = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < cols; column += 1) {
        const x = rect.left + (column + .5) / cols * rect.width;
        const y = rect.top + (row + .5) / rows * rect.height;
        if (overlays.some(overlay => x >= overlay.left && x <= overlay.right && y >= overlay.top && y <= overlay.bottom)) {
          covered += 1;
        }
      }
    }
    return {
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      exposedRatio: 1 - covered / (cols * rows),
      areaRatio: area / (window.innerWidth * window.innerHeight),
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  assert.equal(layout.width, expectedWidth, `${beatId}: stage fills the requested viewport width`);
  assert.equal(layout.height, expectedHeight, `${beatId}: stage fills the requested viewport height`);
  assert.ok(layout.areaRatio >= .85, `${beatId}: stage area is ${(layout.areaRatio * 100).toFixed(1)}%`);
  if (minimumExposed > 0) assert.ok(layout.exposedRatio >= minimumExposed, `${beatId}: exposed stage is ${(layout.exposedRatio * 100).toFixed(1)}%`);
  assert.equal(layout.scrollWidth, layout.viewportWidth, `${beatId}: no horizontal overflow`);
  assert.equal(await page.locator('[data-side-panel], .global-constellation__panel, [class*="metrics-rail"]').count(), 0, `${beatId}: no student side panels or metrics rail`);
}

async function assertSafeCompositor(page: Page, beatId: string): Promise<void> {
  const report = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('[data-testid="global-constellation-stage"]');
    if (!stage) throw new Error('global constellation stage is missing');
    const stageRect = stage.getBoundingClientRect();
    const safe = {
      left: stageRect.left + stageRect.width * .16,
      right: stageRect.left + stageRect.width * .84,
      top: stageRect.top + stageRect.height * .14,
      bottom: stageRect.top + stageRect.height * .78,
    };
    const visible = [...document.querySelectorAll<HTMLElement>('[data-stage-occluder="true"]')]
      .filter(node => !node.matches('[data-scene-anchor-label="true"]'))
      .map(node => {
        const rect = node.getBoundingClientRect();
        return {
          node,
          rect,
          id: node.getAttribute('data-chrome-id') ?? '',
          phase: node.getAttribute('data-chrome-phase') ?? '',
          cluster: node.getAttribute('data-chrome-cluster') ?? '',
          className: typeof node.className === 'string' ? node.className : '',
        };
      })
      .filter(item => item.rect.width > 0 && item.rect.height > 0 && item.phase !== 'hidden');
    const intersects = visible.filter(item => (
      item.rect.left < safe.right
      && item.rect.right > safe.left
      && item.rect.top < safe.bottom
      && item.rect.bottom > safe.top
    ));
    const edgeClusters = [...new Set(visible.filter(item => item.cluster === 'edge').map(item => item.cluster))];
    const subtitleClusters = [...new Set(visible.filter(item => item.cluster === 'subtitle').map(item => item.cluster))];
    const transparentTextOnlyIds = visible
      .filter(item => item.node.getAttribute('data-chrome-role')?.startsWith('text-only-') === true)
      .filter(item => item.node.getAttribute('data-chrome-role') !== 'text-only-subtitle'
        || Number(item.node.getAttribute('data-subtitle-lines')) <= 2)
      .filter(item => {
        const style = window.getComputedStyle(item.node);
        return (style.backgroundColor === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'transparent')
          && style.borderStyle === 'none'
          && style.boxShadow === 'none';
      })
      .map(item => item.id);
    const largeOrCardLike = visible.filter(item => {
      const area = item.rect.width * item.rect.height;
      const isTransparentTextOnly = transparentTextOnlyIds.includes(item.id);
      const isRequiredStageNavigation = item.node.getAttribute('data-testid') === 'six-acts-stage-nav';
      return !isTransparentTextOnly && !isRequiredStageNavigation && (area > stageRect.width * stageRect.height * .05
        || /primary-cue|card|panel|rail|dashboard|footer/i.test(item.className));
    });
    return {
      stageWidth: stageRect.width,
      safe,
      visible: visible.map(item => ({ id: item.id, phase: item.phase, cluster: item.cluster, className: item.className })),
      intersects: intersects.map(item => ({ id: item.id, className: item.className })),
      edgeClusters,
      subtitleClusters,
      transparentTextOnlyIds,
      largeOrCardLike: largeOrCardLike.map(item => ({ id: item.id, className: item.className })),
    };
  });
  // On compact screens, readable edge annotations necessarily consume more of
  // the horizontal composition; the desktop safe-area rule is not meaningful
  // at that width.  Card/panel and overflow checks remain active below.
  if (report.stageWidth >= 760) {
    assert.deepEqual(report.intersects, [], `${beatId}: no DOM teaching chrome intersects the central safe area`);
  }
  assert.ok(report.edgeClusters.length <= 1, `${beatId}: at most one edge teaching cluster is visible`);
  assert.ok(report.subtitleClusters.length <= 1, `${beatId}: at most one subtitle cluster is visible`);
  assert.ok(report.transparentTextOnlyIds.every(id => id === 'caption' || id === 'finale-copy' || id === 'edge-number' || id === 'height-labels'), `${beatId}: only semantic text-only chrome uses the large-area exception`);
  assert.deepEqual(report.largeOrCardLike, [], `${beatId}: no large card/panel styling remains`);
  assert.equal(await page.locator('[data-primary-teaching="true"], .global-constellation-primary-cue, .global-constellation-footer').count(), 0, `${beatId}: retired central cue/footer DOM is absent`);
}

const EXPECTED_HOLD_CHROME: Readonly<Record<GlobalConstellationBeatId, readonly string[]>> = Object.freeze({
  'earth-question': ['title', 'caption'],
  'starlink-density': ['truth', 'edge-number', 'caption'],
  'oneweb-compare': ['truth', 'edge-number', 'caption'],
  'height-cross-section': ['caption'],
  'ntpu-reveal': ['reveal', 'caption'],
  'starlink-visible': ['edge-number', 'caption'],
  'oneweb-visible': ['edge-number', 'caption'],
  'stable-finale': ['finale-copy', 'replay'],
});

async function waitForDirectorHold(page: Page, beatId: GlobalConstellationBeatId): Promise<void> {
  await page.waitForFunction(
    () => document.querySelector('main')?.getAttribute('data-chrome-hold') === 'true',
    undefined,
    { timeout: 10_000 },
  );
  const expected = EXPECTED_HOLD_CHROME[beatId];
  const visible = [...new Set(await page.locator('[data-stage-occluder="true"]').evaluateAll(nodes => nodes
    .filter(node => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    })
    .map(node => node.getAttribute('data-chrome-id'))
    .filter((value): value is string => value !== null)))].sort();
  const expectedVisible = await page.evaluate(({ base, heightBeat }) => window.innerWidth <= 420 && heightBeat
    ? [...base, 'height-labels']
    : base, { base: [...expected, 'beat-counter'], heightBeat: beatId === 'height-cross-section' });
  assert.deepEqual(visible, expectedVisible.sort(), `${beatId}: director-owned hold chrome is the expected sparse set`);
}

async function captureContactSheet(page: Page, screenshots: readonly { beatId: GlobalConstellationBeatId; path: string }[]): Promise<void> {
  const cells = screenshots.map(({ beatId, path }) => {
    const data = readFileSync(path).toString('base64');
    return `<figure><img src="data:image/png;base64,${data}" alt="${beatId}"><figcaption>${beatId}</figcaption></figure>`;
  }).join('');
  await page.setViewportSize({ width: 1920, height: 1180 });
  await page.setContent(`<!doctype html><html><head><style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; color: #dcefe9; background: #020a10; font: 600 18px/1.2 sans-serif; }
    main { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
    figure { margin: 0; padding: 0; }
    img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; border: 1px solid rgba(130, 210, 196, .3); }
    figcaption { padding-top: 7px; color: #9fc1bc; font: 600 14px/1.2 monospace; letter-spacing: .04em; }
  </style></head><body><main>${cells}</main></body></html>`);
  await page.screenshot({ path: CONTACT_SHEET_PATH, fullPage: true });
}

async function assertCanvasPainted(page: Page, beatId: string): Promise<void> {
  const sample = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('global constellation canvas missing');
    return {
      width: canvas.width,
      height: canvas.height,
      webgl: canvas.getContext('webgl2') !== null || canvas.getContext('webgl') !== null,
    };
  });
  assert.ok(sample.width > 0 && sample.height > 0, `${beatId}: WebGL canvas has dimensions`);
  assert.equal(sample.webgl, true, `${beatId}: WebGL context is live, not only a DOM shell`);
}

async function assertProjectionTruthCue(page: Page, beatId: GlobalConstellationBeatId): Promise<void> {
  const cue = page.locator('[data-testid="global-constellation-truth-cue"]');
  assert.equal(await cue.count(), 1, `${beatId}: count interpretation has one in-context truth cue`);
  const details = await cue.evaluate(node => {
    const lines = [...node.querySelectorAll<HTMLElement>('[data-truth-line="true"]')];
    const rect = node.getBoundingClientRect();
    return {
      text: node.textContent ?? '',
      lineCount: lines.length,
      fontSizes: lines.map(line => Number.parseFloat(window.getComputedStyle(line).fontSize)),
      visible: rect.width > 0 && rect.height > 0,
    };
  });
  assert.equal(details.lineCount, 2, `${beatId}: truth cue stays at two short lines`);
  assert.equal(details.visible, true, `${beatId}: truth cue is visibly rendered`);
  assert.ok(details.fontSizes.every(size => size >= 16), `${beatId}: truth cue is projector-readable (${details.fontSizes.join(', ')}px)`);
  assert.match(details.text, /2026-08-25.*UTC 12:00/);
  assert.match(details.text, /封存 TLE.*SGP4/);
  assert.match(details.text, /標記非實體尺寸/);
}

async function assertBeat(page: Page, beatId: GlobalConstellationBeatId, expectedWidth = 1920, expectedHeight = 1080, minimumExposed = .85, requirePainted = true): Promise<void> {
  const beat = GLOBAL_CONSTELLATION_BEATS.find(candidate => candidate.id === beatId);
  assert.ok(beat, `director contains ${beatId}`);
  await waitForReady(page, beatId);
  await assertPersistentStageNavigation(page, beatId);
  const beatCounter = page.getByTestId('global-constellation-beat-counter');
  assert.equal(await beatCounter.count(), 1, `${beatId}: beat counter is mounted`);
  const beatCounterDetails = await beatCounter.evaluate(node => {
    const strong = node.querySelector('strong');
    const rect = node.getBoundingClientRect();
    return {
      text: strong?.textContent?.trim() ?? '',
      index: node.getAttribute('data-beat-counter-index'),
      total: node.getAttribute('data-beat-counter-total'),
      fontSize: strong ? Number.parseFloat(window.getComputedStyle(strong).fontSize) : 0,
      rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
    };
  });
  assert.equal(beatCounterDetails.text, `${String(beat.order).padStart(2, '0')} / ${String(GLOBAL_CONSTELLATION_BEATS.length).padStart(2, '0')}`, `${beatId}: visible beat counter follows the active beat`);
  assert.equal(beatCounterDetails.index, String(beat.order), `${beatId}: beat counter index is truthful`);
  assert.equal(beatCounterDetails.total, String(GLOBAL_CONSTELLATION_BEATS.length), `${beatId}: beat counter total is truthful`);
  assert.ok(beatCounterDetails.fontSize >= 16, `${beatId}: beat counter is readable (${beatCounterDetails.fontSize}px)`);
  assert.ok(beatCounterDetails.rect.width > 0 && beatCounterDetails.rect.height > 0, `${beatId}: beat counter is visible`);
  assert.equal(await page.locator('[data-primary-teaching="true"], .global-constellation-primary-cue').count(), 0, `${beatId}: the old central PrimaryCue compositor is retired`);
  assert.equal(await page.locator('main').getAttribute('data-primary-cue'), beat.primaryCue, `${beatId}: director cue identity remains in the state contract`);
  assert.ok((await page.locator('[data-caption-line="true"]').count()) <= 2, `${beatId}: captions have at most two lines`);
  assert.equal(await page.locator('main').getAttribute('data-camera-pose'), beat.camera, `${beatId}: director owns camera pose`);
  assert.equal(await page.locator('main').getAttribute('data-camera-director'), 'automatic', `${beatId}: camera is director-controlled`);
  assert.equal(await page.locator('main').getAttribute('data-render-mode'), 'archived-tle-sgp4-first-frame-display');
  assert.equal(await page.locator('main').getAttribute('data-fixed-instant'), GLOBAL_CONSTELLATION_FACTS.instantUtc);
  assert.equal(await page.locator('main').getAttribute('data-world-frame'), GLOBAL_CONSTELLATION_FACTS.worldFrame);
  assert.equal(await page.locator('main').getAttribute('data-focus-target'), beat.focusTarget, `${beatId}: focus target follows director`);
  assert.equal(await page.locator('main').getAttribute('data-artifact-starlink-count'), String(GLOBAL_CONSTELLATION_FACTS.starlink.count));
  assert.equal(await page.locator('main').getAttribute('data-artifact-oneweb-count'), String(GLOBAL_CONSTELLATION_FACTS.oneweb.count));
  assert.equal(await page.locator('main').getAttribute('data-artifact-starlink-visible'), String(GLOBAL_CONSTELLATION_FACTS.starlink.ntpuHorizonVisible));
  assert.equal(await page.locator('main').getAttribute('data-artifact-oneweb-visible'), String(GLOBAL_CONSTELLATION_FACTS.oneweb.ntpuHorizonVisible));
  assert.equal(await page.locator('main').getAttribute('data-ntpu-minimum-elevation-deg'), '10');
  assert.equal(await page.locator('main').getAttribute('data-ntpu-starlink-visible'), String(GLOBAL_CONSTELLATION_FACTS.starlink.ntpuVisibleAtMinimumElevation));
  assert.equal(await page.locator('main').getAttribute('data-ntpu-oneweb-visible'), String(GLOBAL_CONSTELLATION_FACTS.oneweb.ntpuVisibleAtMinimumElevation));
  assert.equal(await page.locator('main').getAttribute('data-artifact-starlink-snapshot'), GLOBAL_CONSTELLATION_FACTS.starlink.snapshotPath);
  assert.equal(await page.locator('main').getAttribute('data-artifact-oneweb-snapshot'), GLOBAL_CONSTELLATION_FACTS.oneweb.snapshotPath);
  assert.equal(await page.locator('main').getAttribute('data-artifact-starlink-sha256'), GLOBAL_CONSTELLATION_FACTS.starlink.snapshotSha256);
  assert.equal(await page.locator('main').getAttribute('data-artifact-oneweb-sha256'), GLOBAL_CONSTELLATION_FACTS.oneweb.snapshotSha256);
  const truthBoundary = await page.locator('main').getAttribute('data-truth-boundary') ?? '';
  assert.match(truthBoundary, /封存 TLE.*SGP4/);
  assert.match(truthBoundary, /不是服務覆蓋/);
  await assertStageLayout(page, beatId, expectedWidth, expectedHeight, minimumExposed);
  await assertSafeCompositor(page, beatId);
  if (requirePainted) {
    // Give the first WebGL frame and the director's reveal tween one paint turn.
    await page.waitForTimeout(350);
    await assertCanvasPainted(page, beatId);
  }
}

async function assertExclusiveConstellation(
  page: Page,
  beatId: string,
  selected: 'starlink' | 'oneweb',
): Promise<void> {
  const other = selected === 'starlink' ? 'oneweb' : 'starlink';
  const rememberedSelection = await page.locator('main').getAttribute('data-selected-constellation');
  assert.ok(rememberedSelection === 'starlink' || rememberedSelection === 'oneweb', `${beatId}: manual comparison selection remains explicit`);
  assert.equal(await page.locator('main').getAttribute('data-displayed-constellation'), selected, `${beatId}: authored display selects the expected constellation`);
  assert.equal(await page.locator('main').getAttribute(`data-point-cloud-${selected}`), 'visible', `${beatId}: selected ${selected} point cloud is rendered`);
  assert.equal(await page.locator('main').getAttribute(`data-point-cloud-${other}`), 'hidden', `${beatId}: unselected ${other} point cloud is not mounted visibly`);
  assert.equal(await page.locator(`[data-rendered-constellation="${selected}"]`).count(), 1, `${beatId}: scene renderer mounts only ${selected}`);
  assert.equal(await page.locator('[data-rendered-constellation="starlink"], [data-rendered-constellation="oneweb"]').count(), 1, `${beatId}: exactly one constellation renderer is mounted`);
  assert.equal(await page.locator('main').getAttribute('data-encoding-starlink'), '#58e6d0', `${beatId}: Starlink encoding is stable`);
  assert.equal(await page.locator('main').getAttribute('data-encoding-oneweb'), '#f6c86c', `${beatId}: OneWeb encoding is stable`);
}

async function assertSelectedCount(page: Page, beatId: string, selected: 'starlink' | 'oneweb'): Promise<void> {
  const expectedCount = selected === 'starlink'
    ? GLOBAL_CONSTELLATION_FACTS.starlink.count
    : GLOBAL_CONSTELLATION_FACTS.oneweb.count;
  const count = page.locator('[data-chrome-id="edge-number"] strong');
  assert.equal(await count.count(), 1, `${beatId}: selected constellation count is shown once`);
  assert.equal((await count.innerText()).replace(/,/g, ''), String(expectedCount), `${beatId}: selected constellation count is truthful`);
}

async function assertComparisonChromeStaysBright(page: Page, label: string): Promise<void> {
  const appearance = await page.evaluate(() => {
    const edge = document.querySelector<HTMLElement>('[data-chrome-id="edge-number"]');
    const caption = document.querySelector<HTMLElement>('[data-testid="global-constellation-caption"]');
    if (edge === null || caption === null) return null;
    const edgeStyle = getComputedStyle(edge);
    const captionStyle = getComputedStyle(caption);
    return {
      edgeOpacity: edgeStyle.opacity,
      edgeFilter: edgeStyle.filter,
      captionOpacity: captionStyle.opacity,
      captionFilter: captionStyle.filter,
    };
  });
  assert.deepEqual(appearance, {
    edgeOpacity: '1',
    edgeFilter: 'none',
    captionOpacity: '1',
    captionFilter: 'none',
  }, `${label}: switching constellation does not dim the left readout or bottom caption`);
}

async function assertManualComparisonSelector(page: Page): Promise<void> {
  const selector = page.getByTestId('global-constellation-selector');
  assert.equal(await selector.count(), 1, 'oneweb-compare: manual constellation selector is mounted');
  const buttons = selector.locator('button[data-constellation]');
  assert.equal(await buttons.count(), 2, 'oneweb-compare: selector exposes Starlink and OneWeb controls');
  assert.equal(await page.locator('main').getAttribute('data-autoplay-paused'), 'true', 'oneweb-compare: comparison starts paused for manual selection');

  await buttons.filter({ hasText: 'Starlink' }).click();
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-selected-constellation') === 'starlink');
  await assertExclusiveConstellation(page, 'oneweb-compare after Starlink selection', 'starlink');
  await assertSelectedCount(page, 'oneweb-compare after Starlink selection', 'starlink');
  assert.equal(await page.locator('main').getAttribute('data-autoplay-paused'), 'true', 'oneweb-compare: changing selection keeps the checkpoint paused');

  await buttons.filter({ hasText: 'OneWeb' }).click();
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-selected-constellation') === 'oneweb');
  await assertExclusiveConstellation(page, 'oneweb-compare after OneWeb selection', 'oneweb');
  await assertSelectedCount(page, 'oneweb-compare after OneWeb selection', 'oneweb');
}

async function assertNtpUFormula(page: Page, beatId: string): Promise<void> {
  const boundary = await page.locator('main').getAttribute('data-truth-boundary');
  assert.match(boundary ?? '', /封存 TLE.*SGP4.*atan2\(U, √\(E²\+N²\)\).*≥ 10°/, `${beatId}: NTPU truth boundary names the archived propagation and explicit classroom elevation mask`);
  assert.match(boundary ?? '', /不是服務覆蓋/, `${beatId}: NTPU truth boundary does not claim service coverage`);
  const caption = await page.locator('[data-testid="global-constellation-caption"]').innerText().catch(() => '');
  if (beatId === 'ntpu-reveal') {
    assert.match(caption, /2026-08-25 12:00 UTC.*這一個封存時刻/s, `${beatId}: visible caption limits the result to one archived instant`);
    assert.match(caption, /α = atan2\(U, √\(E²\+N²\)\).*≥ 10°/s, `${beatId}: visible caption keeps the formula beside the calculated result`);
    assert.match(caption, /不代表服務/s, `${beatId}: visible caption keeps the geometry/service boundary beside the formula`);
  }
}

async function assertNtpUDiagramReadability(page: Page, beatId: string, desktop: boolean): Promise<void> {
  const measure = async (selector: string) => {
    const locator = page.locator(selector);
    if (await locator.count() === 0) return null;
    return locator.first().evaluate(node => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return {
        fontSize: Number.parseFloat(style.fontSize),
        display: style.display,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    });
  };
  const viewport = page.viewportSize();
  assert.ok(viewport, `${beatId}: browser viewport is available`);
  const [angle, horizon, zenith, satellite, satelliteDetail, ntpu] = await Promise.all([
    measure('[data-testid="global-elevation-angle"]'),
    measure('[data-testid="global-elevation-horizon"]'),
    measure('[data-testid="global-elevation-zenith"]'),
    measure('[data-testid="global-elevation-satellite-direction"]'),
    measure('.global-elevation-label--satellite small'),
    measure('[data-testid="global-ntpu-label"]'),
  ]);
  const report = { viewport, angle, horizon, zenith, satellite, satelliteDetail, ntpu };
  const labels = [report.angle, report.horizon, report.zenith, report.satellite, report.ntpu];
  assert.ok(labels.every(label => label !== null && label.width > 0 && label.height > 0), `${beatId}: all NTPU teaching labels are visibly rendered (${JSON.stringify(report)})`);
  const visibleLabels = labels.filter((label): label is NonNullable<typeof label> => label !== null);
  assert.ok(visibleLabels.every(label => label.fontSize >= 20), `${beatId}: NTPU diagram labels keep a 20px floor (${JSON.stringify(report)})`);
  assert.ok((report.angle?.fontSize ?? 0) >= (desktop ? 26 : 24), `${beatId}: the 10 degree result is prominent (${JSON.stringify(report.angle)})`);
  assert.ok((report.ntpu?.fontSize ?? 0) >= 22, `${beatId}: NTPU identity is readable (${JSON.stringify(report.ntpu)})`);
  if (desktop) {
    assert.ok(report.satelliteDetail !== null && report.satelliteDetail.display !== 'none' && report.satelliteDetail.fontSize >= 18, `${beatId}: the diagram provenance line is at least 18px on desktop (${JSON.stringify(report.satelliteDetail)})`);
    const ntpuCenterX = ((report.ntpu?.left ?? 0) + (report.ntpu?.right ?? 0)) / 2;
    assert.ok((report.horizon?.right ?? Number.POSITIVE_INFINITY) < ntpuCenterX - 100, `${beatId}: the horizon label remains in a separate left lane (${JSON.stringify(report)})`);
    assert.ok((report.satellite?.left ?? Number.NEGATIVE_INFINITY) > ntpuCenterX + 200, `${beatId}: the boundary satellite and label project to screen-right (${JSON.stringify(report)})`);
    assert.ok((report.angle?.right ?? Number.POSITIVE_INFINITY) < (report.satellite?.left ?? Number.NEGATIVE_INFINITY) - 16, `${beatId}: the alpha result stays left of the boundary label (${JSON.stringify(report)})`);
    assert.ok((report.zenith?.bottom ?? Number.POSITIVE_INFINITY) < (report.ntpu?.top ?? Number.NEGATIVE_INFINITY) - 180, `${beatId}: local-up label remains vertically separated (${JSON.stringify(report)})`);
  }
  assert.ok(visibleLabels.every(label => label.left >= 0
    && label.right <= report.viewport.width
    && label.top >= 0
    && label.bottom <= report.viewport.height), `${beatId}: NTPU labels are not clipped (${JSON.stringify(report)})`);
}

async function startGlobalConstellationFromZero(page: Page): Promise<void> {
  // Loading the 3D artifacts can take longer than the first scripted beat on a
  // busy host.  Reset interaction probes to a deterministic course frame so
  // host startup time is never mistaken for user playback.
  await setRangeValue(page.getByTestId('transport-timeline-range'), 0);
  if (await page.locator('main').getAttribute('data-transport-playing') !== 'true') {
    await page.getByTestId('transport-play-pause').click();
  }
  await page.waitForFunction(
    () => document.querySelector('main')?.getAttribute('data-transport-playing') === 'true',
    undefined,
    { timeout: 5_000 },
  );
}

async function assertComparisonCheckpointPause(page: Page, appUrl: string): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(new URL(GLOBAL_CONSTELLATION_ROUTE, appUrl).toString(), { waitUntil: 'domcontentloaded' });
  await waitForReady(page, 'earth-question');
  await startGlobalConstellationFromZero(page);
  await page.waitForFunction((expectedTime) => {
    const main = document.querySelector('main');
    return main?.getAttribute('data-beat') === 'oneweb-compare'
      && main.getAttribute('data-transport-time') === expectedTime
      && main.getAttribute('data-comparison-state') === 'awaiting-oneweb'
      && main.getAttribute('data-autoplay-paused') === 'true';
  }, GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC.toFixed(1), { timeout: 20_000 });
  await assertExclusiveConstellation(page, 'oneweb-compare checkpoint', 'starlink');
  assert.equal(await page.locator('main').getAttribute('data-artifact-starlink-count'), String(GLOBAL_CONSTELLATION_FACTS.starlink.count), 'oneweb-compare checkpoint retains the archived Starlink count before timed chrome enters');
  assert.equal(await page.getByTestId('global-constellation-selector').count(), 1, 'oneweb-compare checkpoint exposes the manual selector');

  const play = page.getByTestId('transport-play-pause');
  await play.click();
  await page.waitForTimeout(250);
  assert.equal(await page.locator('main').getAttribute('data-transport-time'), GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC.toFixed(1), 'comparison checkpoint Play cannot bypass manual selection');
  assert.equal(await page.locator('main').getAttribute('data-autoplay-paused'), 'true', 'comparison checkpoint remains paused until a constellation is selected');

  await page.getByTestId('global-constellation-selector').locator('button[data-constellation="oneweb"]').click();
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-selected-constellation') === 'oneweb');
  assert.equal(await page.locator('main').getAttribute('data-comparison-state'), 'completed', 'manual OneWeb selection authorizes continuation');
  await assertExclusiveConstellation(page, 'oneweb-compare checkpoint after selection', 'oneweb');
  await assertSelectedCount(page, 'oneweb-compare checkpoint after selection', 'oneweb');
  await assertComparisonChromeStaysBright(page, 'oneweb-compare after OneWeb selection');
  await page.getByTestId('global-constellation-selector').locator('button[data-constellation="starlink"]').click();
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-selected-constellation') === 'starlink');
  await assertComparisonChromeStaysBright(page, 'oneweb-compare after switching back to Starlink');
  await page.getByTestId('global-constellation-selector').locator('button[data-constellation="oneweb"]').click();
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-selected-constellation') === 'oneweb');
  await assertComparisonChromeStaysBright(page, 'oneweb-compare after switching again to OneWeb');
  await play.click();
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-transport-playing') === 'true');
  await page.waitForFunction((checkpoint) => Number(document.querySelector('main')?.getAttribute('data-transport-time')) > checkpoint + .45, GLOBAL_CONSTELLATION_COMPARISON_CHECKPOINT_COURSE_TIME_SEC, { timeout: 3_000 });
  await play.click();
}

async function assertLocalRevealInteraction(page: Page, appUrl: string): Promise<void> {
  await page.goto(new URL(`${GLOBAL_CONSTELLATION_ROUTE}?beat=ntpu-reveal`, appUrl).toString(), { waitUntil: 'domcontentloaded' });
  await assertBeat(page, 'ntpu-reveal');
  assert.equal(await page.locator('main').getAttribute('data-autoplay-paused'), 'true', 'NTPU beat pauses autoplay before the student action');
  assert.equal(await page.locator('main').getAttribute('data-visible-controls'), 'reveal-ntpu');
  const button = page.getByTestId('global-constellation-reveal');
  assert.equal(await button.count(), 1, 'NTPU beat exposes one scene-local reveal control');
  await button.focus();
  assert.equal(await button.evaluate(node => document.activeElement === node), true, 'reveal control is keyboard focusable');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-beat') === 'starlink-visible');
  assert.equal(await page.locator('main').getAttribute('data-visibility-mask'), 'starlink', 'keyboard reveal transitions to Starlink mask beat');
  await assertExclusiveConstellation(page, 'NTPU keyboard reveal', 'starlink');
  assert.equal(await page.getByTestId('global-elevation-angle').count(), 1, 'keyboard reveal adds one readable elevation construction');
  assert.equal(await page.locator('main').getAttribute('data-artifact-starlink-count'), String(GLOBAL_CONSTELLATION_FACTS.starlink.count), 'reveal is display-only and retains Starlink count');
  assert.equal(await page.locator('main').getAttribute('data-artifact-oneweb-count'), String(GLOBAL_CONSTELLATION_FACTS.oneweb.count), 'reveal is display-only and retains OneWeb count');

  await page.goto(new URL(`${GLOBAL_CONSTELLATION_ROUTE}?beat=ntpu-reveal`, appUrl).toString(), { waitUntil: 'domcontentloaded' });
  await assertBeat(page, 'ntpu-reveal');
  const pointerButton = page.getByTestId('global-constellation-reveal');
  await pointerButton.click();
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-beat') === 'starlink-visible');
  assert.equal(await page.locator('main').getAttribute('data-visibility-mask'), 'starlink', 'pointer reveal transitions to the same mask state');
  await assertExclusiveConstellation(page, 'NTPU pointer reveal', 'starlink');
}

async function assertResponsive(page: Page, appUrl: string, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  const probeBeats: readonly GlobalConstellationBeatId[] = [
    'oneweb-visible',
    'oneweb-compare',
    'ntpu-reveal',
    'height-cross-section',
    'stable-finale',
  ];

  for (const probeBeat of probeBeats) {
    await page.goto(new URL(`${GLOBAL_CONSTELLATION_ROUTE}?beat=${probeBeat}`, appUrl).toString(), { waitUntil: 'domcontentloaded' });
    await assertBeat(page, probeBeat, width, height, 0, false);
    await waitForDirectorHold(page, probeBeat);
    await page.waitForTimeout(350);
    const report = await page.evaluate(() => {
      const textNodes = [...document.querySelectorAll<HTMLElement>([
        '[data-stage-occluder="true"] span',
        '[data-stage-occluder="true"] strong',
        '[data-stage-occluder="true"] small',
        '[data-testid="teaching-transport"] button',
        '[data-testid="teaching-transport"] .teaching-transport__time-current',
        '[data-testid="teaching-transport"] .teaching-transport__time-sep',
        '[data-testid="teaching-transport"] .teaching-transport__time-duration',
      ].join(','))]
        .filter((node, index, nodes) => nodes.indexOf(node) === index)
        .filter(node => {
          const rect = node.getBoundingClientRect();
          const style = window.getComputedStyle(node);
          return (node.textContent ?? '').trim().length > 0
            && rect.width > 0
            && rect.height > 0
            && style.visibility !== 'hidden'
            && style.display !== 'none';
        })
        .map(node => {
          const rect = node.getBoundingClientRect();
          return {
            text: (node.textContent ?? '').trim(),
            fontSize: Number.parseFloat(window.getComputedStyle(node).fontSize),
            rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
          };
        });
      const controls = [...document.querySelectorAll<HTMLElement>(
        '[data-testid="teaching-transport"] button, [data-stage-occluder="true"] button, [data-stage-occluder="true"] a',
      )]
        .filter((node, index, nodes) => nodes.indexOf(node) === index)
        .filter(node => {
          const rect = node.getBoundingClientRect();
          const style = window.getComputedStyle(node);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        })
        .map(node => {
          const rect = node.getBoundingClientRect();
          return {
            label: (node.getAttribute('aria-label') ?? node.textContent ?? '').trim(),
            rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
            disabled: node instanceof HTMLButtonElement && node.disabled,
          };
        });
      const collisionPairs = [
        ['reveal-vs-caption', '[data-testid="global-constellation-reveal"]', '[data-testid="global-constellation-caption"]'],
        ['caption-vs-stage-nav', '[data-testid="global-constellation-caption"]', '[data-testid="six-acts-stage-nav"]'],
        ['height-starlink-vs-oneweb', '[data-mobile-height-guide="starlink"]', '[data-mobile-height-guide="oneweb"]'],
        ['finale-copy-vs-replay', '[data-testid="global-constellation-finale-copy"]', '[data-control-id="replay"]'],
      ] as const;
      const collisions = collisionPairs.flatMap(([name, firstSelector, secondSelector]) => {
        const first = document.querySelector<HTMLElement>(firstSelector);
        const second = document.querySelector<HTMLElement>(secondSelector);
        if (!first || !second) return [];
        const firstRect = first.getBoundingClientRect();
        const secondRect = second.getBoundingClientRect();
        const firstStyle = window.getComputedStyle(first);
        const secondStyle = window.getComputedStyle(second);
        const bothVisible = firstRect.width > 0 && firstRect.height > 0
          && secondRect.width > 0 && secondRect.height > 0
          && firstStyle.visibility !== 'hidden' && firstStyle.display !== 'none'
          && secondStyle.visibility !== 'hidden' && secondStyle.display !== 'none';
        const intersects = firstRect.left < secondRect.right
          && firstRect.right > secondRect.left
          && firstRect.top < secondRect.bottom
          && firstRect.bottom > secondRect.top;
        if (!bothVisible || !intersects) return [];
        return [{
          name,
          first: { left: firstRect.left, right: firstRect.right, top: firstRect.top, bottom: firstRect.bottom, width: firstRect.width, height: firstRect.height },
          second: { left: secondRect.left, right: secondRect.right, top: secondRect.top, bottom: secondRect.bottom, width: secondRect.width, height: secondRect.height },
        }];
      });
      return {
        text: textNodes,
        controls,
        collisions,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      };
    });
    assert.ok(report.text.every(item => item.fontSize >= 16), `${width}x${height}/${probeBeat}: meaningful text is at least 16px (${JSON.stringify(report.text.filter(item => item.fontSize < 16))})`);
    assert.ok(report.text.every(item => item.rect.left >= -1 && item.rect.right <= width + 1), `${width}x${height}/${probeBeat}: meaningful text stays inside viewport (${JSON.stringify(report.text.filter(item => item.rect.left < -1 || item.rect.right > width + 1))})`);
    assert.ok(report.controls.every(item => item.rect.width >= 44 && item.rect.height >= 44), `${width}x${height}/${probeBeat}: visible controls have 44px tap targets (${JSON.stringify(report.controls)})`);
    assert.ok(report.scrollWidth <= report.innerWidth + 1, `${width}x${height}/${probeBeat}: no horizontal overflow`);
    assert.deepEqual(report.collisions, [], `${width}x${height}/${probeBeat}: teaching text/control collision report is empty (${JSON.stringify(report.collisions)})`);
    responsiveMeasurements.push({ width, height, beat: probeBeat, text: report.text, controls: report.controls, collisions: report.collisions });
    console.log(`[global-constellation-browser] measured ${width}x${height}/${probeBeat} ${JSON.stringify({ textNodes: report.text.length, controls: report.controls.length, collisions: report.collisions.length })}`);

    if (probeBeat === 'oneweb-compare') {
      await assertProjectionTruthCue(page, probeBeat);
      await assertExclusiveConstellation(page, probeBeat, 'starlink');
      await assertSelectedCount(page, probeBeat, 'starlink');
      await assertManualComparisonSelector(page);
    }
    if (probeBeat === 'ntpu-reveal') {
      assert.equal(await page.locator('main').getAttribute('data-autoplay-paused'), 'true', `${width}px: NTPU reveal review frame is paused`);
      assert.equal(await page.getByTestId('global-constellation-reveal').count(), 1, `${width}px: NTPU reveal control is mounted`);
    }
    if (probeBeat === 'oneweb-visible') {
      await assertNtpUDiagramReadability(page, `${width}px/${probeBeat}`, false);
    }
    if (probeBeat === 'height-cross-section') {
      await page.waitForFunction(() => document.querySelectorAll('[data-mobile-height-guide]').length === 2, undefined, { timeout: 10_000 });
      const heightLabels = await page.locator('[data-mobile-height-guide]').evaluateAll(nodes => nodes.map(node => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return { text: node.textContent?.trim() ?? '', fontSize: Number.parseFloat(style.fontSize), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      }));
      assert.equal(heightLabels.length, 2, `${width}px: both median-height labels render`);
      assert.ok(heightLabels.every(label => label.fontSize >= 16), `${width}px: height labels are readable (${JSON.stringify(heightLabels)})`);
      assert.ok(heightLabels.every(label => label.left >= 0 && label.right <= width && label.top >= 0 && label.bottom <= height), `${width}px: height labels are not clipped (${JSON.stringify(heightLabels)})`);
      assert.ok(heightLabels[0]!.bottom <= heightLabels[1]!.top || heightLabels[1]!.bottom <= heightLabels[0]!.top, `${width}px: height labels have separate vertical lanes (${JSON.stringify(heightLabels)})`);
    }
    if (probeBeat === 'stable-finale') {
      for (const selector of ['[data-control-id="replay"]']) {
        const box = await page.locator(selector).boundingBox();
        assert.ok(box && box.width >= 44 && box.height >= 44, `${width}px: finale control ${selector} is a real >=44px rendered box (${JSON.stringify(box)})`);
        const fontSize = await page.locator(selector).evaluate(node => Number.parseFloat(window.getComputedStyle(node).fontSize));
        assert.ok(fontSize >= 16, `${width}px: finale control ${selector} is >=16px (${fontSize}px)`);
      }
    }
  }
}

async function assertReviewClockAndTransport(page: Page, appUrl: string): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(new URL(`${GLOBAL_CONSTELLATION_ROUTE}?beat=oneweb-visible`, appUrl).toString(), { waitUntil: 'domcontentloaded' });
  await assertBeat(page, 'oneweb-visible', 1920, 1080, 0, false);
  const initial = await page.locator('main').getAttribute('data-transport-time');
  assert.equal(initial, globalConstellationReviewFrameCourseTime(6).toFixed(1), 'review mode starts one readable second into the requested beat');
  assert.equal(await page.locator('main').getAttribute('data-transport-playing'), 'false', 'review mode starts paused');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('main').getAttribute('data-transport-time'), initial, 'paused review time does not advance');

  const play = page.getByTestId('transport-play-pause');
  await play.click();
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-transport-playing') === 'true');
  await page.waitForTimeout(180);
  const resumed = Number(await page.locator('main').getAttribute('data-transport-time'));
  assert.ok(resumed >= globalConstellationReviewFrameCourseTime(6), `first Play resumes from the displayed review time (${resumed})`);
  await play.click();
  const pausedAt = Number(await page.locator('main').getAttribute('data-transport-time'));
  await page.waitForTimeout(180);
  assert.equal(Number(await page.locator('main').getAttribute('data-transport-time')), pausedAt, 'pause freezes the same displayed time');

  await page.getByTestId('transport-rewind').click();
  const rewoundAt = Number(await page.locator('main').getAttribute('data-transport-time'));
  assert.equal(Number((pausedAt - rewoundAt).toFixed(1)), 5, 'rewind is exactly five seconds');
  await page.getByTestId('transport-forward').click();
  assert.equal(Number(await page.locator('main').getAttribute('data-transport-time')), pausedAt, 'forward returns exactly five seconds');
  assert.equal(await page.locator('main').getAttribute('data-reveal-interaction-state'), 'completed', 'seek to the later beat reconstructs the completed reveal');

  const range = page.getByTestId('transport-timeline-range');
  await setRangeValue(range, 20);
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-transport-time') === '20.0');
  assert.equal(await page.locator('main').getAttribute('data-transport-time'), '20.0', 'direct seek writes the exact requested time');
  assert.equal(await page.locator('main').getAttribute('data-reveal-interaction-state'), 'awaiting-reveal', 'seek before the reveal boundary restores awaiting-reveal');

  const fractionalCheckpoint = GLOBAL_CONSTELLATION_NTPU_REVEAL_END_COURSE_TIME_SEC - .1;
  const fractionalCheckpointText = fractionalCheckpoint.toFixed(1);
  await setRangeValue(range, fractionalCheckpoint);
  await page.waitForFunction(expected => document.querySelector('main')?.getAttribute('data-transport-time') === expected, fractionalCheckpoint.toFixed(1));
  const fractional = await page.locator('main').evaluate(main => {
    const rangeInput = main.querySelector<HTMLInputElement>('[data-testid="transport-timeline-range"]');
    return {
      beat: main.getAttribute('data-beat'),
      dataTime: main.getAttribute('data-transport-time'),
      rangeValue: rangeInput?.value ?? null,
      ariaValueNow: rangeInput?.getAttribute('aria-valuenow') ?? null,
      ariaValueText: rangeInput?.getAttribute('aria-valuetext') ?? null,
      display: main.querySelector('[data-testid="transport-time-display"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    };
  });
  assert.equal(fractional.dataTime, fractionalCheckpointText, `fractional seek keeps the exact tenth in the main state (${JSON.stringify(fractional)})`);
  assert.equal(fractional.rangeValue, fractionalCheckpointText, `fractional seek keeps the exact range value (${JSON.stringify(fractional)})`);
  assert.equal(fractional.ariaValueNow, fractionalCheckpointText, `fractional seek does not round the reveal boundary (${JSON.stringify(fractional)})`);
  assert.equal(fractional.ariaValueText, `00:${fractionalCheckpointText} / 01:06.0`);
  assert.match(fractional.display, new RegExp(`^00:${fractionalCheckpointText.replace('.', '\\.')}\\s*\\/\\s*01:06\\.0$`));
  await setRangeValue(range, GLOBAL_CONSTELLATION_NTPU_REVEAL_END_COURSE_TIME_SEC);
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-beat') === 'starlink-visible');
  assert.equal(await page.locator('main').getAttribute('data-transport-time'), GLOBAL_CONSTELLATION_NTPU_REVEAL_END_COURSE_TIME_SEC.toFixed(1), 'the reveal boundary reconstructs the next beat');
  assert.equal(await range.getAttribute('aria-valuenow'), String(GLOBAL_CONSTELLATION_NTPU_REVEAL_END_COURSE_TIME_SEC), 'aria-valuenow follows the exact reveal boundary');

  for (const speed of [0.5, 1, 1.5, 2]) {
    await setRangeValue(range, 20);
    await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-transport-time') === '20.0');
    await selectTransportSpeed(page, speed);
    assert.equal(await page.locator('main').getAttribute('data-transport-speed'), String(speed), `${speed}x speed is applied as a real transport state`);
    await play.click();
    await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-transport-playing') === 'true');
    const start = await page.locator('main').evaluate(main => ({ time: Number(main.getAttribute('data-transport-time')), now: performance.now() }));
    await page.waitForTimeout(600);
    const end = await page.locator('main').evaluate(main => ({ time: Number(main.getAttribute('data-transport-time')), now: performance.now() }));
    await play.click();
    const observedRatio = (end.time - start.time) / ((end.now - start.now) / 1000);
    assert.ok(Math.abs(observedRatio - speed) <= .3, `${speed}x clock ratio is observed at ${observedRatio.toFixed(2)}x over ${(end.now - start.now).toFixed(0)}ms`);
  }

  await setRangeValue(range, GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC);
  await page.waitForFunction(expected => document.querySelector('main')?.getAttribute('data-transport-time') === expected, GLOBAL_CONSTELLATION_NOMINAL_DURATION_SEC.toFixed(1));
  assert.equal(await page.locator('main').getAttribute('data-transport-playing'), 'false', 'exact end seek is paused before the explicit replay action');
  await play.click();
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    return main?.getAttribute('data-beat') === 'earth-question'
      && main.getAttribute('data-transport-playing') === 'true'
      && Number(main.getAttribute('data-transport-time')) < 2;
  });
  assert.equal(await page.locator('main').getAttribute('data-transport-playing'), 'true', 'Play at the exact end restarts playback immediately');
  assert.equal(await page.locator('main').getAttribute('data-beat'), 'earth-question', 'Play at the exact end returns to the first beat');
  await play.click();
}

async function assertRevealCheckpointPause(page: Page, appUrl: string): Promise<void> {
  for (const speed of [0.5, 2]) {
    await page.goto(new URL(`${GLOBAL_CONSTELLATION_ROUTE}?beat=ntpu-reveal`, appUrl).toString(), { waitUntil: 'domcontentloaded' });
    await assertBeat(page, 'ntpu-reveal', 1920, 1080, 0, false);
    const range = page.getByTestId('transport-timeline-range');
    const checkpointApproach = GLOBAL_CONSTELLATION_NTPU_REVEAL_CHECKPOINT_COURSE_TIME_SEC - .3;
    await setRangeValue(range, checkpointApproach);
    await page.waitForFunction(expected => document.querySelector('main')?.getAttribute('data-transport-time') === expected, checkpointApproach.toFixed(1));
    await selectTransportSpeed(page, speed);
    await page.getByTestId('transport-play-pause').click();
    await page.waitForFunction((checkpoint) => {
      const main = document.querySelector('main');
      return main?.getAttribute('data-interaction-state') === 'awaiting-reveal'
        && main.getAttribute('data-autoplay-paused') === 'true'
        && Number(main.getAttribute('data-transport-time')) >= checkpoint;
    }, GLOBAL_CONSTELLATION_NTPU_REVEAL_CHECKPOINT_COURSE_TIME_SEC, { timeout: 3_000 });
    const checkpoint = await page.locator('main').evaluate(main => ({
      beat: main.getAttribute('data-beat'),
      time: Number(main.getAttribute('data-transport-time')),
      paused: main.getAttribute('data-autoplay-paused'),
      interaction: main.getAttribute('data-interaction-state'),
      chrome: main.getAttribute('data-visible-chrome'),
    }));
    assert.equal(checkpoint.beat, 'ntpu-reveal', `${speed}x: natural playback remains in the reveal beat`);
    assert.ok(Math.abs(checkpoint.time - GLOBAL_CONSTELLATION_NTPU_REVEAL_CHECKPOINT_COURSE_TIME_SEC) <= .1, `${speed}x: playback stops on the first readable reveal frame (${checkpoint.time})`);
    assert.equal(checkpoint.paused, 'true', `${speed}x: natural playback pauses at the checkpoint`);
    assert.equal(checkpoint.interaction, 'awaiting-reveal', `${speed}x: checkpoint remains awaiting-reveal`);
    assert.match(checkpoint.chrome ?? '', /(^|,)reveal(,|$)/, `${speed}x: reveal chrome remains mounted at the checkpoint`);
    await page.waitForTimeout(450);
    assert.equal(Number(await page.locator('main').getAttribute('data-transport-time')), checkpoint.time, `${speed}x: course clock remains frozen while Display awaits activation`);
    const button = page.getByTestId('global-constellation-reveal');
    assert.equal(await button.count(), 1, `${speed}x: reveal action remains mounted at the checkpoint`);
    assert.equal(await button.isEnabled(), true, `${speed}x: reveal action remains actionable at the checkpoint`);
    const rect = await button.boundingBox();
    assert.ok(rect && rect.width >= 44 && rect.height >= 44, `${speed}x: reveal action retains its tap target`);
    await button.click();
    await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-beat') === 'starlink-visible');
    assert.equal(await page.locator('main').getAttribute('data-reveal-interaction-state'), 'completed', `${speed}x: reveal action completes the checkpoint`);
  }
}

async function assertCanvasPlaybackAndPausedOrbit(page: Page, appUrl: string): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(new URL(GLOBAL_CONSTELLATION_ROUTE, appUrl).toString(), { waitUntil: 'domcontentloaded' });
  await waitForReady(page, 'earth-question');
  await startGlobalConstellationFromZero(page);
  const canvasWrap = page.getByTestId('global-constellation-canvas');
  const box = await canvasWrap.boundingBox();
  assert.ok(box, '3D stage has a clickable browser rectangle');
  const x = box.x + box.width * 0.66;
  const y = box.y + box.height * 0.5;

  await page.mouse.click(x, y);
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-transport-playing') === 'false');
  assert.equal(await canvasWrap.getAttribute('data-orbit-enabled'), 'true', 'a short scene click pauses and unlocks orbit controls');
  assert.equal(await page.locator('main').getAttribute('data-camera-interaction'), 'orbit-enabled');

  const revisionBefore = Number(await canvasWrap.getAttribute('data-orbit-revision'));
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 130, y + 45, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction((before) => Number(document.querySelector('[data-testid="global-constellation-canvas"]')?.getAttribute('data-orbit-revision')) > before, revisionBefore);
  assert.equal(await page.locator('main').getAttribute('data-transport-playing'), 'false', 'dragging the paused globe does not accidentally resume playback');

  await page.mouse.click(x, y);
  await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-transport-playing') === 'true');
  assert.equal(await canvasWrap.getAttribute('data-orbit-enabled'), 'false', 'a second short scene click resumes and returns camera control to the director');
  assert.equal(await page.locator('main').getAttribute('data-camera-interaction'), 'director-locked');
}

async function assertNaturalPlaybackConsoleClean(page: Page, appUrl: string): Promise<void> {
  const errors: string[] = [];
  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === 'error') errors.push(message.text());
  };
  const onPageError = (error: Error) => errors.push(`PAGEERROR ${error.message}`);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(new URL(GLOBAL_CONSTELLATION_ROUTE, appUrl).toString(), { waitUntil: 'domcontentloaded' });
    await waitForReady(page, 'earth-question');
    await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-transport-playing') === 'true');
    await page.waitForFunction(() => Number(document.querySelector('main')?.getAttribute('data-transport-time')) >= 1.2, undefined, { timeout: 5_000 });

    // Continue from the real natural clock into the reveal checkpoint. This is
    // the smallest browser path that exercises the RAF setter, the pause edge,
    // and the one-gesture checkpoint without hiding console failures.
    const range = page.getByTestId('transport-timeline-range');
    await setRangeValue(range, GLOBAL_CONSTELLATION_NTPU_REVEAL_CHECKPOINT_COURSE_TIME_SEC - .3);
    await selectTransportSpeed(page, 2);
    await page.getByTestId('transport-play-pause').click();
    await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-autoplay-paused') === 'true', undefined, { timeout: 3_000 });
    await page.getByTestId('global-constellation-reveal').click();
    await page.waitForFunction(() => document.querySelector('main')?.getAttribute('data-beat') === 'starlink-visible');
    await page.waitForFunction((endTime) => Number(document.querySelector('main')?.getAttribute('data-transport-time')) >= endTime + .5, GLOBAL_CONSTELLATION_NTPU_REVEAL_END_COURSE_TIME_SEC, { timeout: 3_000 });
    await page.getByTestId('transport-play-pause').click();
    assert.deepEqual(errors, [], `natural playback emits no React/browser console errors: ${JSON.stringify(errors)}`);
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }
}

async function setRangeValue(range: ReturnType<Page['getByTestId']>, value: number): Promise<void> {
  await range.evaluate((node, nextValue) => {
    if (!(node instanceof HTMLInputElement)) throw new Error('transport range is not an input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(node, String(nextValue));
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function selectTransportSpeed(page: Page, speed: number): Promise<void> {
  const option = page.getByTestId(`transport-speed-${speed}`);
  if (!(await option.isVisible())) {
    await page.getByTestId('transport-speed-current').click();
    await option.waitFor({ state: 'visible' });
  }
  await option.click();
}

async function assertTransportAutoHideAccess(page: Page, appUrl: string): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(new URL(`${GLOBAL_CONSTELLATION_ROUTE}?beat=oneweb-visible`, appUrl).toString(), { waitUntil: 'domcontentloaded' });
  await assertBeat(page, 'oneweb-visible', 1920, 1080, 0, false);
  await page.getByTestId('transport-play-pause').click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(960, 500);
  await page.waitForFunction(
    () => document.querySelector('[data-testid="teaching-transport"]')?.getAttribute('data-transport-visible') === 'false',
    undefined,
    { timeout: 6_000 },
  );
  assert.equal(await page.locator('[data-testid="teaching-transport"]').getAttribute('data-transport-visible'), 'false', 'playing transport auto-hides');
  assert.equal(await page.locator('[data-testid="teaching-transport"]').evaluate(node => getComputedStyle(node).pointerEvents), 'none', 'hidden transport does not block the WebGL canvas');
  const hiddenFocus = await page.locator('[data-testid="teaching-transport"]').evaluate(node => ({
    ariaHidden: node.getAttribute('aria-hidden'),
    inert: node.hasAttribute('inert'),
    tabbables: [...node.querySelectorAll<HTMLElement>('button,input,a,[tabindex]')].filter(control => control.getAttribute('tabindex') !== '-1').length,
  }));
  assert.equal(hiddenFocus.ariaHidden, 'true', 'hidden transport is removed from the accessibility tree');
  assert.equal(hiddenFocus.inert, true, 'hidden transport is inert');
  assert.equal(hiddenFocus.tabbables, 0, 'hidden transport exposes no invisible tabbables');

  await page.mouse.move(100, 1078);
  await page.waitForFunction(() => document.querySelector('[data-testid="teaching-transport"]')?.getAttribute('data-transport-visible') === 'true');
  assert.equal(await page.locator('[data-testid="teaching-transport"]').getAttribute('aria-hidden'), null, 'bottom-edge pointer reveals the transport');
  await page.waitForTimeout(2_800);
  await page.keyboard.press('Alt+t');
  await page.waitForFunction(() => document.querySelector('[data-testid="teaching-transport"]')?.getAttribute('data-transport-visible') === 'true');
  assert.equal(await page.getByTestId('transport-play-pause').evaluate(node => document.activeElement === node), true, 'Alt+T reveals and focuses the play control');
}

async function waitForCameraSettled(page: Page, beatId: string): Promise<void> {
  await page.waitForFunction(
    ({ threshold, requiredFrames }) => {
      const main = document.querySelector('main');
      const positionError = Number(main?.getAttribute('data-camera-position-error'));
      const targetError = Number(main?.getAttribute('data-camera-target-error'));
      const settledFrames = Number(main?.getAttribute('data-camera-settled-frames'));
      return main?.getAttribute('data-camera-settled') === 'true'
        && Number.isFinite(positionError)
        && Number.isFinite(targetError)
        && positionError <= threshold
        && targetError <= threshold
        && settledFrames >= requiredFrames;
    },
    {
      threshold: GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD,
      requiredFrames: GLOBAL_CONSTELLATION_CAMERA_SETTLE_REQUIRED_FRAMES,
    },
    { timeout: 15_000 },
  ).catch(error => {
    throw new Error(`${beatId}: camera never reached measured settled boundary: ${error instanceof Error ? error.message : error}`);
  });
}

async function assertCameraSettled(page: Page, beatId: string): Promise<void> {
  const telemetry = await page.locator('main').evaluate(main => ({
    settled: main?.getAttribute('data-camera-settled'),
    positionError: Number(main?.getAttribute('data-camera-position-error')),
    targetError: Number(main?.getAttribute('data-camera-target-error')),
    settledFrames: Number(main?.getAttribute('data-camera-settled-frames')),
  }));
  assert.equal(telemetry.settled, 'true', `${beatId}: camera settled flag is measured`);
  assert.ok(telemetry.positionError <= GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD, `${beatId}: position error is inside settle boundary`);
  assert.ok(telemetry.targetError <= GLOBAL_CONSTELLATION_CAMERA_SETTLE_ERROR_THRESHOLD_WORLD, `${beatId}: target error is inside settle boundary`);
  assert.ok(telemetry.settledFrames >= GLOBAL_CONSTELLATION_CAMERA_SETTLE_REQUIRED_FRAMES, `${beatId}: settle frame count is consecutive`);
}

async function assertFinaleHold(page: Page, appUrl: string): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(new URL(`${GLOBAL_CONSTELLATION_ROUTE}?beat=stable-finale`, appUrl).toString(), { waitUntil: 'domcontentloaded' });
  await assertBeat(page, 'stable-finale');
  await page.getByTestId('transport-play-pause').click();
  await waitForCameraSettled(page, 'stable-finale');
  await assertCameraSettled(page, 'stable-finale');
  assert.equal(await page.locator('main').getAttribute('data-camera-pose'), 'synthesis', 'finale remains a global synthesis frame');
  assert.equal(await page.locator('main').getAttribute('data-focus-target'), 'global-earth', 'finale focus remains global rather than returning to the local NTPU reticle');
  assert.equal(await page.locator('main').getAttribute('data-focus-reticle'), 'hidden', 'finale does not expose a stale local surface reticle');
  assert.equal(await page.locator('main').getAttribute('data-finale-link-result'), 'none', 'finale has no link result geometry');
  assert.equal(await page.locator('main').getAttribute('data-final-motion'), 'frozen', 'finale progress motion is frozen');
  assert.equal(await page.locator('main').getAttribute('data-visible-controls'), 'replay');
  assert.equal(await page.getByRole('button', { name: '重新播放' }).count(), 1);
  const bridge = page.locator('[data-final-bridge-copy="true"]');
  assert.equal(await bridge.count(), 1, 'finale exposes one bridge copy');
  assert.equal(await bridge.locator(':scope > span').count(), 1, 'finale bridge copy stays to one concise instruction');
  const bridgeText = await bridge.innerText();
  assert.match(bridgeText, /播放/);
  assert.match(bridgeText, /重新播放/);
  assert.doesNotMatch(bridgeText, /下一幕|下一個場景|next/i, 'finale copy does not hard-code a next-scene handoff');
  const next = page.locator('[data-control-id="next"]');
  assert.equal(await next.count(), 1, 'finale exposes one explicit, learner-controlled next-scene action');
  assert.equal(await next.getAttribute('href'), '/course/tle-journey');
  const chromeBefore = await page.locator('main').getAttribute('data-visible-chrome');
  assert.equal(chromeBefore, 'finale-copy,replay', 'finale chrome is visible during its measured hold');
  const holdStartedAt = await page.evaluate(() => performance.now());
  await page.waitForTimeout(GLOBAL_CONSTELLATION_STABLE_HOLD_MS);
  const measuredHoldMs = await page.evaluate(startedAt => performance.now() - startedAt, holdStartedAt);
  assert.ok(measuredHoldMs >= GLOBAL_CONSTELLATION_STABLE_HOLD_MS, `stable hold measured ${measuredHoldMs.toFixed(0)}ms after settle`);
  assert.equal(await page.locator('main').getAttribute('data-beat'), 'stable-finale', 'finale remains stable for at least six seconds');
  await assertCameraSettled(page, 'stable-finale after hold');
  assert.equal(await page.locator('main').getAttribute('data-visible-chrome'), 'finale-copy,replay', 'finale remains a stable frame with replay chrome available');
}

async function captureCurrentResponsiveEvidence(page: Page, appUrl: string): Promise<void> {
  const captures = [
    { width: 390, height: 844, suffix: 'mobile-390', beats: ['oneweb-compare', 'ntpu-reveal', 'height-cross-section', 'stable-finale'] as const },
    { width: 320, height: 720, suffix: 'mobile-320', beats: ['oneweb-compare', 'ntpu-reveal', 'height-cross-section', 'stable-finale'] as const },
  ];
  for (const capture of captures) {
    await page.setViewportSize({ width: capture.width, height: capture.height });
    for (const beatId of capture.beats) {
      await page.goto(new URL(`${GLOBAL_CONSTELLATION_ROUTE}?beat=${beatId}`, appUrl).toString(), { waitUntil: 'domcontentloaded' });
      await assertBeat(page, beatId, capture.width, capture.height, 0, false);
      await waitForDirectorHold(page, beatId);
      await waitForCameraSettled(page, beatId);
      await page.waitForFunction(() => document.querySelector('[data-testid="teaching-transport"]')?.getAttribute('data-transport-visible') === 'true');
      // The review frame is paused; allow the opacity transition to settle so
      // the capture cannot contain a half-faded rail.
      await page.waitForTimeout(350);
      const screenshotPath = resolve(SCREENSHOT_DIR, `current-${capture.suffix}-${beatId}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`[global-constellation-browser] screenshot ${screenshotPath}`);
    }
  }
}

async function main(): Promise<void> {
  assertCaptionContinuity();
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const launchBrowser = (): Promise<Browser> => chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  let browser: Browser = await launchBrowser();
  const consoleErrors: string[] = [];
  try {
    let page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const screenshots: Array<{ beatId: GlobalConstellationBeatId; path: string }> = [];
    const trackPageErrors = (nextPage: Page) => {
      nextPage.on('console', message => {
        if (message.type() !== 'error') return;
        const location = message.location().url;
        consoleErrors.push(`${message.text()}${location ? ` @ ${location}` : ''}`);
      });
      nextPage.on('pageerror', error => consoleErrors.push(`PAGEERROR ${error.message}`));
    };
    trackPageErrors(page);
    for (const [beatIndex, beat] of GLOBAL_CONSTELLATION_BEATS.entries()) {
      // A fresh page per review frame keeps WebGL point-cloud resources from
      // accumulating across nine independent visual assertions. Restart the
      // browser process as well so software-WebGL resources are reclaimed
      // deterministically between heavy review frames.
      if (beatIndex > 0) {
        await page.close().catch(() => undefined);
        await browser.close();
        browser = await launchBrowser();
        page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
        trackPageErrors(page);
      }
      const url = new URL(GLOBAL_CONSTELLATION_ROUTE, appUrl);
      url.searchParams.set('beat', beat.id);
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
      await assertBeat(page, beat.id);
      // Review routes intentionally open paused at a shared readable frame;
      // advance only after the clock/resume contract has been established.
      await page.getByTestId('transport-play-pause').click();
      await waitForDirectorHold(page, beat.id);
      await waitForCameraSettled(page, beat.id);
      // Review-frame screenshots must not land inside the rail's fade. Pause
      // after the director/camera hold so the complete transport is either
      // stably visible or deliberately absent in every capture.
      if (await page.locator('main').getAttribute('data-transport-playing') === 'true') {
        await page.getByTestId('transport-play-pause').click();
      }
      await page.waitForFunction(() => document.querySelector('[data-testid="teaching-transport"]')?.getAttribute('data-transport-visible') === 'true');
      await page.waitForTimeout(350);
      const screenshotPath = resolve(SCREENSHOT_DIR, `beat-${String(beat.order).padStart(2, '0')}-${beat.id}.png`);
      await page.screenshot({ path: screenshotPath });
      screenshots.push({ beatId: beat.id, path: screenshotPath });
      const numericLabels = await page.locator('[data-short-number="true"]').count();
      assert.ok(numericLabels <= 2, `${beat.id}: no more than two short numeric labels (${numericLabels})`);
      if (beat.id === 'earth-question') {
        assert.equal(await page.locator('main').getAttribute('data-point-cloud-starlink'), 'visible');
        assert.equal(await page.locator('main').getAttribute('data-point-cloud-oneweb'), 'hidden');
        await assertExclusiveConstellation(page, beat.id, 'starlink');
      }
      if (beat.id === 'ntpu-reveal') {
        assert.equal(await page.locator('main').getAttribute('data-point-cloud-starlink'), 'hidden', `${beat.id}: no Starlink satellites appear before reveal`);
        assert.equal(await page.locator('main').getAttribute('data-point-cloud-oneweb'), 'hidden', `${beat.id}: no OneWeb satellites appear before reveal`);
        assert.equal(await page.locator('main').getAttribute('data-displayed-constellation'), 'none', `${beat.id}: pre-reveal scene is ground-station only`);
        assert.equal(await page.locator('main').getAttribute('data-visible-only'), 'false', `${beat.id}: no visibility mask is rendered before the action`);
        assert.equal(await page.locator('main').getAttribute('data-rendered-point-count'), '0', `${beat.id}: pre-reveal rendered satellite count is zero`);
        assert.equal(await page.getByTestId('global-elevation-angle').count(), 0, `${beat.id}: selected-satellite geometry waits for reveal`);
        assert.equal(await page.locator('[data-rendered-constellation="none"]').count(), 1, `${beat.id}: scene explicitly records the empty pre-reveal state`);
        await assertNtpUFormula(page, beat.id);
        assert.match(await page.getByTestId('global-constellation-reveal').locator('xpath=..').innerText(), /左側按鈕|下一步/, `${beat.id}: the local action explicitly tells the learner what to press`);
      }
      if (beat.id === 'starlink-density') {
        await assertProjectionTruthCue(page, beat.id);
        await assertExclusiveConstellation(page, beat.id, 'starlink');
        await assertSelectedCount(page, beat.id, 'starlink');
      }
      if (beat.id === 'oneweb-compare') {
        await assertProjectionTruthCue(page, beat.id);
        await assertExclusiveConstellation(page, beat.id, 'starlink');
        await assertSelectedCount(page, beat.id, 'starlink');
        await assertManualComparisonSelector(page);
      }
      if (beat.id === 'height-cross-section') {
        assert.equal(await page.locator('main').getAttribute('data-height-guides'), 'visible');
        assert.equal(await page.locator('main').getAttribute('data-height-labels'), 'visible');
        assert.equal(await page.locator('[data-testid="global-height-guide-starlink"]').count(), 1);
        assert.equal(await page.locator('[data-testid="global-height-guide-oneweb"]').count(), 1);
        assert.match(await page.locator('[data-testid="global-constellation-caption"]').innerText(), /中位高度/);
        assert.doesNotMatch(await page.locator('[data-testid="global-constellation-caption"]').innerText(), /guide/i);
        await assertExclusiveConstellation(page, beat.id, 'starlink');
      }
      if (beat.id === 'starlink-visible') {
        assert.equal(await page.locator('main').getAttribute('data-visibility-mask'), 'starlink');
        assert.equal(await page.locator('main').getAttribute('data-rendered-point-count'), String(GLOBAL_CONSTELLATION_FACTS.starlink.ntpuVisibleAtMinimumElevation));
        assert.equal(await page.locator('main').getAttribute('data-ntpu-starlink-visible'), String(GLOBAL_CONSTELLATION_FACTS.starlink.ntpuVisibleAtMinimumElevation));
        assert.equal(await page.locator('main').getAttribute('data-artifact-starlink-visible'), String(GLOBAL_CONSTELLATION_FACTS.starlink.ntpuHorizonVisible));
        await assertExclusiveConstellation(page, beat.id, 'starlink');
        await assertNtpUFormula(page, beat.id);
        await assertNtpUDiagramReadability(page, beat.id, true);
        assert.equal(await page.getByTestId('global-elevation-angle').getAttribute('data-elevation-deg'), '10.00');
      }
      if (beat.id === 'oneweb-visible') {
        assert.equal(await page.locator('main').getAttribute('data-visibility-mask'), 'oneweb');
        assert.equal(await page.locator('main').getAttribute('data-rendered-point-count'), String(GLOBAL_CONSTELLATION_FACTS.oneweb.ntpuVisibleAtMinimumElevation));
        assert.equal(await page.locator('main').getAttribute('data-ntpu-oneweb-visible'), String(GLOBAL_CONSTELLATION_FACTS.oneweb.ntpuVisibleAtMinimumElevation));
        assert.equal(await page.locator('main').getAttribute('data-artifact-oneweb-visible'), String(GLOBAL_CONSTELLATION_FACTS.oneweb.ntpuHorizonVisible));
        await assertExclusiveConstellation(page, beat.id, 'oneweb');
        await assertNtpUFormula(page, beat.id);
        await assertNtpUDiagramReadability(page, beat.id, true);
        assert.equal(await page.getByTestId('global-elevation-angle').getAttribute('data-elevation-deg'), '10.00');
        assert.match(
          await page.locator('.global-constellation-edge-number').getAttribute('class') ?? '',
          /global-constellation-edge-number--left/,
          `${beat.id}: OneWeb observation stays on the unobstructed left edge`,
        );
      }
      if (beat.id === 'stable-finale') {
        const selected = await page.locator('main').getAttribute('data-selected-constellation');
        assert.ok(selected === 'starlink' || selected === 'oneweb', `${beat.id}: finale/process frame has one selected constellation`);
        await assertExclusiveConstellation(page, beat.id, selected === 'oneweb' ? 'oneweb' : 'starlink');
        await assertNtpUFormula(page, beat.id);
      }
      console.log(`[global-constellation-browser] inspected ${beat.id}`);
    }
    await captureContactSheet(page, screenshots);
    console.log(`[global-constellation-browser] screenshots written to ${SCREENSHOT_DIR}`);
    console.log(`[global-constellation-browser] contact sheet written to ${CONTACT_SHEET_PATH}`);
    // The contact sheet intentionally replaces the document. Start the
    // interaction gates on a fresh WebGL page so detached frames/resources
    // cannot make the subsequent browser evidence flaky.
    await page.close().catch(() => undefined);
    await browser.close();
    browser = await launchBrowser();
    page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    trackPageErrors(page);
    console.log('[global-constellation-browser] validating review clock and transport');
    await assertReviewClockAndTransport(page, appUrl);
    console.log('[global-constellation-browser] validating comparison checkpoint');
    await assertComparisonCheckpointPause(page, appUrl);
    console.log('[global-constellation-browser] validating reveal checkpoint');
    await assertRevealCheckpointPause(page, appUrl);
    console.log('[global-constellation-browser] validating canvas playback and paused orbit interaction');
    await assertCanvasPlaybackAndPausedOrbit(page, appUrl);
    console.log('[global-constellation-browser] validating natural playback console');
    await assertNaturalPlaybackConsoleClean(page, appUrl);
    console.log('[global-constellation-browser] validating transport auto-hide access');
    await assertTransportAutoHideAccess(page, appUrl);
    console.log('[global-constellation-browser] validating local reveal interaction');
    await assertLocalRevealInteraction(page, appUrl);
    console.log('[global-constellation-browser] validating responsive 1920');
    await assertResponsive(page, appUrl, 1920, 1080);
    console.log('[global-constellation-browser] validating responsive 390');
    await assertResponsive(page, appUrl, 390, 844);
    console.log('[global-constellation-browser] validating responsive 320');
    await assertResponsive(page, appUrl, 320, 720);
    console.log('[global-constellation-browser] capturing responsive evidence');
    await captureCurrentResponsiveEvidence(page, appUrl);
    console.log('[global-constellation-browser] validating final hold');
    await assertFinaleHold(page, appUrl);
    writeFileSync(MEASUREMENT_REPORT_PATH, JSON.stringify({
      generatedAt: new Date().toISOString(),
      route: GLOBAL_CONSTELLATION_ROUTE,
      viewports: [{ width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 320, height: 720 }],
      measurements: responsiveMeasurements,
    }, null, 2));
    console.log(`[global-constellation-browser] measurements written to ${MEASUREMENT_REPORT_PATH}`);
    const realErrors = consoleErrors.filter(error => !/favicon|ERR_CONNECTION_REFUSED|:8765/.test(error));
    assert.deepEqual(realErrors, [], `no real browser errors: ${JSON.stringify(realErrors)}`);
    console.log('[global-constellation-browser] PASS — 8 truthful beat counters, persistent six-scene plus homepage navigation, exclusive point-cloud selection, real NTPU visible-only masks and elevation geometry, click-to-toggle plus paused orbit control, manual comparison checkpoint, exact fractional seek, end-of-course replay, all four speed ratios, natural-playback console cleanliness, 1920/390/320 measured text/touch/collision checks, artifacts, camera/point-cloud state, keyboard+pointer reveal and stable final hold verified');
  } finally {
    await browser.close();
  }
}

void runBrowserValidator(
  {
    validator: 'validate-global-constellation-browser',
    appUrl: process.env.APP_URL ?? process.argv[2],
    floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.layout,
  },
  async () => main(),
).catch(error => {
  console.error('[global-constellation-browser] FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
