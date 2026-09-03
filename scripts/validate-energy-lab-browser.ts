/**
 * Browser gate for the scene-first Energy Lab R1 candidate.
 *
 * Requires a running Vite server. APP_URL, PLAYWRIGHT_BASE_URL, or argv[2]
 * may select it. The validator captures fresh prediction, low-power, outage,
 * and finale frames at desktop plus 390x844 and 320x720.
 */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';

import {
  ENERGY_LAB_ACT6_DURATION_SEC,
  ENERGY_LAB_CHECKPOINTS,
  ENERGY_LAB_DURATION_SEC,
  bestSampledEnergyLabPoint,
  energyLabSampleAt,
} from '../src/course/energy-lab/energyLabDirector.ts';
import { SIX_ACTS_ACT6_HREF } from '../src/course/nav/sixActsRoutes.ts';

const ROUTE = '/course/energy-lab';
const SCREENSHOT_DIR = resolve('output/playwright/energy-lab-r1');
const VIEWPORTS = Object.freeze([
  { width: 1920, height: 1080, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile-390' },
  { width: 320, height: 720, name: 'mobile-320' },
]);

type Viewport = (typeof VIEWPORTS)[number];

async function detectAppUrl(): Promise<string> {
  const explicit = process.env.APP_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? process.argv[2];
  if (explicit) return explicit;
  const candidates = explicit
    ? [explicit]
    : ['http://127.0.0.1:3000', 'http://127.0.0.1:4319', 'http://127.0.0.1:49319', 'http://127.0.0.1:5173'];
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate);
      if (response.ok) return candidate;
    } catch {
      // Probe the next local server.
    }
  }
  throw new Error(`Could not find a running simulator server: ${candidates.join(', ')}`);
}

async function waitForRoute(page: Page, baseUrl: string): Promise<void> {
  await page.goto(new URL(ROUTE, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main.energy-lab[data-transport-duration="84.0"]', { state: 'attached', timeout: 20_000 });
  await page.waitForSelector('[data-testid="energy-lab-scene"]', { state: 'visible', timeout: 20_000 });
  await page.waitForSelector('[data-testid="energy-lab-transport"]', { state: 'attached', timeout: 20_000 });
}

async function setRangeValue(page: Page, value: number): Promise<void> {
  const range = page.getByTestId('transport-timeline-range');
  await range.evaluate((node, nextValue) => {
    if (!(node instanceof HTMLInputElement)) throw new Error('transport range is not an input');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(node, String(nextValue));
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await page.waitForFunction(
    expected => document.querySelector('main.energy-lab')?.getAttribute('data-transport-time') === Number(expected).toFixed(1),
    value,
    { timeout: 5_000 },
  );
}

function area(rect: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }): number {
  return Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top);
}

function intersectionArea(
  left: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number },
  right: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number },
): number {
  return Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
    * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
}

async function assertComposition(page: Page, viewport: Viewport): Promise<Record<string, number>> {
  const report = await page.evaluate(() => {
    const viewportRect = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    const scene = document.querySelector<HTMLElement>('[data-testid="energy-lab-scene"]');
    const theater = document.querySelector<HTMLElement>('.energy-lab__theater');
    if (!scene || !theater) throw new Error('energy-lab scene/theater missing');
    const overlays = [
      '[data-primary-teaching="true"]',
      '.energy-lab__scene-readout',
      '.energy-lab__metric-tether',
      '.energy-lab__trace',
      '.energy-lab__checkpoint-zone',
      '.energy-lab__receipt',
      '[data-testid="energy-lab-transport"]',
    ].flatMap(selector => [...document.querySelectorAll<HTMLElement>(selector)])
      .filter(node => {
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return !node.hidden && style.display !== 'none' && style.visibility !== 'hidden'
          && Number(style.opacity) > .05 && rect.width > 0 && rect.height > 0;
      })
      .map(node => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      })
      .filter(rect => rect.right > 0 && rect.bottom > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight);
    const xs = [...new Set([0, window.innerWidth, ...overlays.flatMap(rect => [rect.left, rect.right])])].sort((a, b) => a - b);
    let overlayArea = 0;
    for (let index = 0; index < xs.length - 1; index += 1) {
      const left = xs[index]!;
      const right = xs[index + 1]!;
      if (right <= left) continue;
      const spans = overlays
        .filter(rect => rect.left < right && rect.right > left)
        .map(rect => ({ top: rect.top, bottom: rect.bottom }))
        .sort((a, b) => a.top - b.top);
      let y = 0;
      for (const span of spans) {
        const top = Math.max(0, span.top);
        const bottom = Math.min(window.innerHeight, span.bottom);
        if (bottom <= top) continue;
        if (top > y) overlayArea += (right - left) * (top - y);
        y = Math.max(y, bottom);
      }
      if (y < window.innerHeight) overlayArea += (right - left) * (window.innerHeight - y);
    }
    // The loop above accumulates the uncovered area; subtract it from the
    // viewport so the reported value is the actual overlay coverage ratio.
    const uncoveredArea = overlayArea;
    const coveredArea = window.innerWidth * window.innerHeight - uncoveredArea;
    const centralCore = {
      left: window.innerWidth * .30,
      top: window.innerHeight * .22,
      right: window.innerWidth * .70,
      bottom: window.innerHeight * .76,
    };
    const coreXs = [...new Set([
      centralCore.left,
      centralCore.right,
      ...overlays.flatMap(rect => [Math.max(centralCore.left, rect.left), Math.min(centralCore.right, rect.right)]),
    ])]
      .filter(x => x >= centralCore.left && x <= centralCore.right)
      .sort((a, b) => a - b);
    let centralCoveredArea = 0;
    for (let index = 0; index < coreXs.length - 1; index += 1) {
      const left = coreXs[index]!;
      const right = coreXs[index + 1]!;
      if (right <= left) continue;
      const spans = overlays
        .filter(rect => rect.left < right && rect.right > left)
        .map(rect => ({
          top: Math.max(centralCore.top, rect.top),
          bottom: Math.min(centralCore.bottom, rect.bottom),
        }))
        .filter(span => span.bottom > span.top)
        .sort((a, b) => a.top - b.top);
      let y = centralCore.top;
      for (const span of spans) {
        if (span.top > y) y = span.top;
        if (span.bottom > y) {
          centralCoveredArea += (right - left) * (span.bottom - y);
          y = span.bottom;
        }
      }
    }
    const centralArea = (centralCore.right - centralCore.left) * (centralCore.bottom - centralCore.top);
    const sceneRect = scene.getBoundingClientRect();
    const theaterRect = theater.getBoundingClientRect();
    return {
      scene: { left: sceneRect.left, top: sceneRect.top, right: sceneRect.right, bottom: sceneRect.bottom },
      theater: { left: theaterRect.left, top: theaterRect.top, right: theaterRect.right, bottom: theaterRect.bottom },
      overlayCoverageRatio: coveredArea / (window.innerWidth * window.innerHeight),
      centralOcclusionRatio: centralCoveredArea / centralArea,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      overlayCount: overlays.length,
    };
  });

  const sceneWidthRatio = (report.scene.right - report.scene.left) / viewport.width;
  const sceneHeightRatio = (report.scene.bottom - report.scene.top) / viewport.height;
  assert.ok(sceneWidthRatio >= .98, `${viewport.name}: scene width is not dominant: ${JSON.stringify(report.scene)}`);
  assert.ok(sceneHeightRatio >= .98, `${viewport.name}: scene height is not dominant: ${JSON.stringify(report.scene)}`);
  const totalOverlayBudget = viewport.name === 'desktop' ? .30 : .50;
  assert.ok(report.overlayCoverageRatio <= totalOverlayBudget, `${viewport.name}: overlays cover ${(report.overlayCoverageRatio * 100).toFixed(1)}% of the scene`);
  assert.ok(report.centralOcclusionRatio <= .40, `${viewport.name}: central scene is occluded ${(report.centralOcclusionRatio * 100).toFixed(1)}%`);
  assert.ok(report.scrollWidth <= report.innerWidth + 1, `${viewport.name}: horizontal overflow ${report.scrollWidth} > ${report.innerWidth}`);
  assert.equal(await page.locator('[data-scene-exposure="central-stage-100-percent"]').count(), 1, `${viewport.name}: central scene exposure contract is declared`);
  return {
    sceneWidthRatio,
    sceneHeightRatio,
    overlayCoverageRatio: report.overlayCoverageRatio,
    centralOcclusionRatio: report.centralOcclusionRatio,
    overlayCount: report.overlayCount,
  };
}

async function assertTransientTextBudget(page: Page, label: string): Promise<void> {
  const report = await page.evaluate(() => {
    const primary = document.querySelectorAll('[data-primary-teaching="true"]');
    const caption = document.querySelector<HTMLElement>('[data-testid="energy-lab-caption"]');
    const range = caption ? document.createRange() : null;
    if (range && caption) range.selectNodeContents(caption);
    const captionText = caption?.textContent?.trim() ?? '';
    return {
      primaryCount: primary.length,
      captionLines: range?.getClientRects().length ?? 0,
      captionSentences: captionText.split(/[。！？!?]/u).filter(Boolean).length,
      declaredCount: document.querySelector('main.energy-lab')?.getAttribute('data-transient-caption-count'),
    };
  });
  assert.equal(report.primaryCount, 1, `${label}: exactly one primary teaching cue`);
  assert.ok(report.captionLines <= 2, `${label}: caption wraps to ${report.captionLines} lines`);
  assert.ok(report.captionSentences <= 2, `${label}: caption has ${report.captionSentences} sentences`);
  assert.equal(report.declaredCount, '1', `${label}: transient caption budget is declared`);
}

async function assertCurrentActNumberWhite(page: Page, label: string): Promise<void> {
  const currentNumber = page.getByTestId('six-acts-stage-nav').locator('a[aria-current="page"] em');
  assert.equal(await currentNumber.count(), 1, `${label}: exactly one current act number`);
  assert.equal(
    await currentNumber.evaluate(node => window.getComputedStyle(node).color),
    'rgb(255, 255, 255)',
    `${label}: current act number is white`,
  );
}

async function assertControlBounds(page: Page, viewport: Viewport): Promise<void> {
  const report = await page.evaluate(() => {
    const controls = [...document.querySelectorAll<HTMLElement>('.energy-lab__theater button, .energy-lab__theater select')]
      .filter(node => {
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return !node.hidden && style.display !== 'none' && style.visibility !== 'hidden'
          && Number(style.opacity) > .05 && rect.width > 0 && rect.height > 0;
      })
      .map(node => {
        const rect = node.getBoundingClientRect();
        return {
          label: node.getAttribute('aria-label') ?? node.textContent?.trim() ?? '',
          width: rect.width,
          height: rect.height,
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
        };
      });
    const slider = document.querySelector<HTMLElement>('[data-testid="transport-timeline-range"]');
    const sliderWrap = document.querySelector<HTMLElement>('.teaching-transport__timeline-wrap');
    const sliderRect = slider?.getBoundingClientRect();
    const sliderWrapRect = sliderWrap?.getBoundingClientRect();
    return {
      controls,
      slider: sliderRect ? { width: sliderRect.width, height: sliderRect.height } : null,
      sliderWrap: sliderWrapRect ? { width: sliderWrapRect.width, height: sliderWrapRect.height } : null,
    };
  });
  assert.ok(report.controls.length >= 2, `${viewport.name}: expected visible lesson controls`);
  assert.ok(report.controls.every(control => control.width >= 44 && control.height >= 44), `${viewport.name}: undersized control ${JSON.stringify(report.controls)}`);
  assert.ok((report.slider?.width ?? 0) >= 120, `${viewport.name}: timeline slider is too narrow`);
  assert.ok((report.sliderWrap?.height ?? 0) >= 8, `${viewport.name}: timeline hit area is missing`);
  assert.ok(report.controls.every(control => control.left >= -1 && control.top >= -1 && control.right <= viewport.width + 1 && control.bottom <= viewport.height + 1), `${viewport.name}: control escapes viewport ${JSON.stringify(report.controls)}`);
}

async function assertMobileCollisions(page: Page, viewport: Viewport): Promise<void> {
  if (!viewport.name.startsWith('mobile')) return;
  const report = await page.evaluate(() => {
    const selectors = [
      '.energy-lab__lesson',
      '.energy-lab__scene-readout',
      '.energy-lab__trace',
      '.energy-lab__metric-tether',
      '.energy-lab__checkpoint-zone',
      '.energy-lab__receipt',
      '[data-testid="energy-lab-transport"]',
    ];
    const boxes = Object.fromEntries(selectors.flatMap(selector => {
      const node = document.querySelector<HTMLElement>(selector);
      if (!node) return [];
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= .05) return [];
      const rect = node.getBoundingClientRect();
      return [[selector, { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }]];
    }));
    return boxes;
  }) as Record<string, { left: number; top: number; right: number; bottom: number }>;
  const forbiddenPairs = [
    ['.energy-lab__lesson', '.energy-lab__trace'],
    ['.energy-lab__lesson', '.energy-lab__scene-readout'],
    ['.energy-lab__checkpoint-zone', '[data-testid="energy-lab-transport"]'],
    ['.energy-lab__receipt', '[data-testid="energy-lab-transport"]'],
  ] as const;
  for (const [left, right] of forbiddenPairs) {
    const a = report[left];
    const b = report[right];
    if (!a || !b) continue;
    assert.equal(intersectionArea(a, b), 0, `${viewport.name}: ${left} collides with ${right}`);
  }
}

async function assertTransportHiddenInert(page: Page): Promise<void> {
  await setRangeValue(page, 20);
  await page.getByTestId('transport-play-pause').click();
  await page.waitForFunction(() => document.querySelector('[data-testid="energy-lab-transport"]')?.getAttribute('data-transport-playing') === 'true');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(120, 260);
  const transport = page.locator('[data-testid="energy-lab-transport"]');
  await page.waitForFunction(
    () => document.querySelector('[data-testid="energy-lab-transport"]')?.getAttribute('data-transport-visible') === 'false',
    undefined,
    { timeout: 6_000 },
  );
  assert.equal(await transport.getAttribute('data-transport-visible'), 'false', 'playing transport auto-hides');
  assert.equal(await transport.getAttribute('aria-hidden'), 'true', 'hidden transport is removed from the accessibility tree');
  assert.equal(await transport.evaluate(node => node.hasAttribute('inert')), true, 'hidden transport is inert');
  assert.equal(await transport.evaluate(node => [...node.querySelectorAll<HTMLElement>('button,input,select,a,[tabindex]')].filter(control => control.getAttribute('tabindex') !== '-1').length), 0, 'hidden transport has no tabbables');
  assert.equal(await transport.evaluate(node => window.getComputedStyle(node).pointerEvents), 'none', 'hidden transport does not block the scene');

  await page.mouse.move(80, (await page.evaluate(() => window.innerHeight)) - 8);
  await page.waitForFunction(() => document.querySelector('[data-testid="energy-lab-transport"]')?.getAttribute('data-transport-visible') === 'true');
  await page.mouse.move(120, 260);
  await page.waitForFunction(
    () => document.querySelector('[data-testid="energy-lab-transport"]')?.getAttribute('data-transport-visible') === 'false',
    undefined,
    { timeout: 6_000 },
  );
  // Headless system Chrome reserves Alt+T before it reaches the page. Dispatch
  // the same DOM key contract so this gate still tests the app's documented path.
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', {
    altKey: true,
    bubbles: true,
    cancelable: true,
    code: 'KeyT',
    key: 't',
  })));
  await page.waitForFunction(() => document.querySelector('[data-testid="energy-lab-transport"]')?.getAttribute('data-transport-visible') === 'true');
  await page.waitForTimeout(100);
  assert.equal(await page.getByTestId('transport-play-pause').evaluate(node => document.activeElement === node), true, 'Alt+T reveals and focuses play');
  await page.getByTestId('transport-play-pause').click();
}

async function assertTransportInteraction(page: Page): Promise<void> {
  await setRangeValue(page, 12);
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-beat'), 'baseline');
  await page.getByTestId('transport-forward').click();
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-transport-time'), '17.0');
  await page.getByTestId('transport-rewind').click();
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-transport-time'), '12.0');
  await page.getByTestId('transport-speed-current').click();
  await page.getByTestId('transport-speed-2').click();
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-transport-speed'), '2');
  await page.getByTestId('transport-speed-current').click();
  await page.getByTestId('transport-speed-0.5').click();
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-transport-speed'), '0.5');
  await setRangeValue(page, 0);
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-question-answer'), 'hidden');
  await page.getByTestId('energy-lab-prediction-service-fails').click();
  await page.waitForFunction(() => document.querySelector('main.energy-lab')?.getAttribute('data-transport-playing') === 'true');
  await page.getByTestId('transport-play-pause').click();
}

async function assertScientificStates(page: Page): Promise<void> {
  const low = energyLabSampleAt(0.02).point;
  const best = bestSampledEnergyLabPoint();

  await setRangeValue(page, 37);
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-beat'), 'downward-sweep');
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-current-power-w'), '0.02');
  assert.equal(Number(await page.locator('main.energy-lab').getAttribute('data-current-rate-mbps')), Number(low.totalRateMbps.toFixed(6)));
  assert.equal(await page.locator('[data-testid="energy-lab-scene"]').getAttribute('data-scene-state'), 'outage');

  await setRangeValue(page, 44);
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-beat'), 'outage-reveal');
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-question-answer'), 'service-fails');
  assert.equal(await page.locator('[data-testid="energy-lab-scene-readout"]').innerText().then(text => /0 \/ 4 UE/.test(text)), true);

  await setRangeValue(page, 72);
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-beat'), 'checkpoint-compare');
  for (const powerW of ENERGY_LAB_CHECKPOINTS.slice(0, 3)) {
    const testId = `energy-lab-checkpoint-${String(powerW).replace('.', '-')}`;
    await page.getByTestId(testId).click();
    assert.equal(await page.locator('main.energy-lab').getAttribute('data-selected-checkpoint'), String(powerW));
    assert.match(await page.getByTestId('energy-lab-checkpoint-readout').innerText(), new RegExp(`${powerW.toFixed(2)} W`));
  }

  await setRangeValue(page, ENERGY_LAB_DURATION_SEC);
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-beat'), 'finale');
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-current-power-w'), String(best.powerW));
  assert.equal(Number(await page.locator('main.energy-lab').getAttribute('data-current-ee-mbit-per-j')), Number(best.point.eeMbitPerJ.toFixed(6)));
  assert.equal(await page.locator('[data-testid="energy-lab-ee-trace"] circle').count(), 10);
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-best-service-valid-power'), '0.8');
  assert.match(await page.getByTestId('energy-lab-caption').innerText(), /0\.80 W.*固定教學資料/);
  assert.equal(await page.locator('.energy-lab__platform-cta, [data-testid="platform-drawer"]').count(), 0);

  await page.getByTestId('transport-play-pause').click();
  await page.waitForTimeout(40);
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-transport-playing'), 'true', 'Act 5 Play at the finale restarts immediately');
  assert.ok(Number(await page.locator('main.energy-lab').getAttribute('data-transport-time')) < 1, 'Act 5 replay begins at time zero');
  await page.getByTestId('transport-play-pause').click();
}

async function assertAct6(page: Page, baseUrl: string): Promise<void> {
  await page.goto(new URL(SIX_ACTS_ACT6_HREF, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(`main.energy-lab[data-act="6"][data-transport-duration="${ENERGY_LAB_ACT6_DURATION_SEC.toFixed(1)}"]`, { state: 'attached', timeout: 20_000 });
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-route-href'), SIX_ACTS_ACT6_HREF);
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-local-receipt-persistence'), 'local-only');
  const nav = page.getByTestId('six-acts-stage-nav');
  assert.equal(await nav.locator('.six-acts-nav__acts a').count(), 6, 'Act 6 keeps direct access to all six scenes');
  assert.equal(await nav.locator('a[href="/"]').count(), 1, 'Act 6 can return to the homepage');
  assert.equal(await nav.locator(`a[href="${SIX_ACTS_ACT6_HREF}"][aria-current="page"]`).count(), 1, 'Act 6 is independently current');
  await assertCurrentActNumberWhite(page, 'Act 6');

  await setRangeValue(page, ENERGY_LAB_ACT6_DURATION_SEC);
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-beat'), 'act6-receipt');
  const receipt = page.getByTestId('energy-lab-local-receipt');
  assert.equal(await receipt.count(), 1, 'Act 6 ends on one local evidence receipt');
  assert.match(await receipt.innerText(), /本機證據收據.*本機 JSON.*未傳送/s);
  assert.equal(await page.getByTestId('energy-lab-download-receipt').count(), 1, 'Act 6 exposes a local JSON download');
  assert.equal(await page.locator('.energy-lab__platform-cta, [data-testid="platform-drawer"]').count(), 0, 'Act 6 makes no platform-upload claim');
  assert.doesNotMatch(await page.locator('main.energy-lab').innerText(), /handover|遠端保存|上傳平台/i);

  await page.getByTestId('transport-play-pause').click();
  await page.waitForTimeout(40);
  assert.equal(await page.locator('main.energy-lab').getAttribute('data-transport-playing'), 'true', 'Act 6 Play at the receipt restarts immediately');
  assert.ok(Number(await page.locator('main.energy-lab').getAttribute('data-transport-time')) < 1, 'Act 6 replay begins at time zero');
  await page.getByTestId('transport-play-pause').click();
}

async function captureState(page: Page, baseUrl: string, viewport: Viewport, timeSec: number, slug: string): Promise<string> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await waitForRoute(page, baseUrl);
  await setRangeValue(page, timeSec);
  await page.waitForTimeout(500);
  const path = resolve(SCREENSHOT_DIR, `${viewport.name}-${slug}.png`);
  await page.screenshot({ path, type: 'png', scale: 'css' });
  return path;
}

async function captureAct6Receipt(page: Page, baseUrl: string, viewport: Viewport): Promise<string> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(new URL(SIX_ACTS_ACT6_HREF, baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main.energy-lab[data-act="6"]', { state: 'attached', timeout: 20_000 });
  await setRangeValue(page, ENERGY_LAB_ACT6_DURATION_SEC);
  await page.waitForTimeout(500);
  const path = resolve(SCREENSHOT_DIR, `${viewport.name}-act6-local-receipt.png`);
  await page.screenshot({ path, type: 'png', scale: 'css' });
  return path;
}

async function assertFullTimeline(page: Page): Promise<void> {
  const expected = [
    [0, 'prediction'],
    [12, 'baseline'],
    [24, 'downward-sweep'],
    [44, 'outage-reveal'],
    [56, 'upward-sweep'],
    [72, 'checkpoint-compare'],
    [84, 'finale'],
  ] as const;
  for (const [timeSec, beat] of expected) {
    await setRangeValue(page, timeSec);
    assert.equal(await page.locator('main.energy-lab').getAttribute('data-beat'), beat, `timeline ${timeSec}s resolves ${beat}`);
  }
}

async function main(): Promise<void> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const baseUrl = await detectAppUrl();
  const browser: Browser = process.env.PLAYWRIGHT_CDP_URL
    ? await chromium.connectOverCDP(process.env.PLAYWRIGHT_CDP_URL)
    : await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? '/usr/bin/google-chrome',
      args: ['--no-sandbox', '--disable-crashpad', '--disable-breakpad'],
    });
  const consoleErrors: string[] = [];
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));
  const screenshots: string[] = [];
  const measurements: Record<string, Record<string, number>> = {};

  try {
    await waitForRoute(page, baseUrl);
    assert.equal(await page.locator('main.energy-lab').getAttribute('data-prediction-gate'), 'open');
    assert.equal(await page.locator('main.energy-lab').getAttribute('data-question-answer'), 'hidden');
    assert.equal(await page.getByTestId('energy-lab-prediction-service-survives').count(), 1);
    assert.equal(await page.getByTestId('energy-lab-prediction-service-fails').count(), 1);
    const sceneCanvas = page.getByTestId('energy-lab-scene-canvas');
    assert.equal(await sceneCanvas.getAttribute('data-satellite-model-path'), '/models/satellite-oneweb.glb', 'Energy Lab uses the OneWeb GLB');
    assert.ok(Number(await sceneCanvas.getAttribute('data-satellite-stage-scale')) <= 1, 'Energy Lab satellite remains at a restrained scale');
    assert.equal(await sceneCanvas.getAttribute('data-beam-ground-y'), '0', 'Energy Lab beam base terminates on the ground plane');
    assert.equal(await page.locator('main.energy-lab').innerText().then(text => /不一定|not necessarily/i.test(text)), false);
    assert.equal(await page.getByTestId('six-acts-stage-nav').locator('.six-acts-nav__acts a').count(), 6);
    assert.equal(await page.getByTestId('six-acts-stage-nav').locator('a[href="/"]').count(), 1);
    await assertCurrentActNumberWhite(page, 'Act 5');
    await assertTransientTextBudget(page, 'prediction');
    await assertTransportInteraction(page);
    await assertTransportHiddenInert(page);
    await assertFullTimeline(page);
    await assertScientificStates(page);
    await assertAct6(page, baseUrl);

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await waitForRoute(page, baseUrl);
      await setRangeValue(page, 12);
      await assertComposition(page, viewport).then(report => { measurements[`${viewport.name}-baseline`] = report; });
      await assertTransientTextBudget(page, `${viewport.name}-baseline`);
      await assertControlBounds(page, viewport);
      await assertMobileCollisions(page, viewport);

      screenshots.push(await captureState(page, baseUrl, viewport, 0, 'prediction'));
      screenshots.push(await captureState(page, baseUrl, viewport, 37, 'false-win-low-power'));
      screenshots.push(await captureState(page, baseUrl, viewport, 44, 'outage-reveal'));
      screenshots.push(await captureState(page, baseUrl, viewport, ENERGY_LAB_DURATION_SEC, 'optimum-finale'));
      screenshots.push(await captureAct6Receipt(page, baseUrl, viewport));
    }

    assert.deepEqual(consoleErrors, [], `browser console errors: ${JSON.stringify(consoleErrors)}`);
    console.log(JSON.stringify({
      baseUrl,
      route: ROUTE,
      screenshots,
      viewports: VIEWPORTS,
      measurements,
      consoleErrors,
      result: 'PASS',
    }, null, 2));
  } finally {
    await page.close();
    await browser.close();
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
