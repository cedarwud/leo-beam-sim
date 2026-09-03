/**
 * Focused browser gate for the TLE Journey's 122-second teaching clock.
 *
 * Requires a running Vite server. Use APP_URL/PLAYWRIGHT_BASE_URL to select
 * it, or the simulator's fixed local port 3000.
 */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';

import { SIX_ACTS_VISIBLE_ROUTES } from '../src/course/nav/sixActsRoutes.ts';

const ROUTE = '/course/tle-journey';
const SCREENSHOT_DIR = resolve('output/playwright/tle-journey-r1');
const VIEWPORTS = Object.freeze([
  { width: 1920, height: 1080, name: 'desktop' },
  { width: 390, height: 844, name: 'mobile' },
  { width: 320, height: 568, name: 'mobile-compact' },
]);

async function detectAppUrl(): Promise<string> {
  const explicit = process.env.APP_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? process.argv[2];
  const candidates = explicit
    ? [explicit]
    : ['http://127.0.0.1:3000'];
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
  await page.waitForSelector('main.tle-journey[data-transport-duration="122.0"]', { state: 'attached', timeout: 20_000 });
  await page.waitForSelector('[data-testid="tle-journey-transport"]', { state: 'attached', timeout: 20_000 });
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
    expected => document.querySelector('main.tle-journey')?.getAttribute('data-transport-time') === Number(expected).toFixed(1),
    value,
    { timeout: 5_000 },
  );
}

type BrowserRect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

async function requiredBox(page: Page, selector: string, label: string): Promise<BrowserRect> {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `${label}: ${selector} has a rendered browser rectangle`);
  return box;
}

function rectanglesOverlap(first: BrowserRect, second: BrowserRect): boolean {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
}

async function assertResponsiveSceneClearance(page: Page, baseUrl: string): Promise<void> {
  const viewports = [
    { width: 1440, height: 900, label: 'laptop' },
    { width: 390, height: 844, label: 'phone' },
    { width: 320, height: 568, label: 'compact phone' },
  ] as const;

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await waitForRoute(page, baseUrl);
    const main = page.locator('main.tle-journey');
    if (await main.getAttribute('data-transport-playing') === 'true') {
      await page.getByTestId('transport-play-pause').click();
    }

    await setRangeValue(page, 50.2);
    await page.waitForTimeout(240);
    const engineFlow = await requiredBox(page, '.tle-journey__engine-flow', `${viewport.label} SGP4`);
    const engineControls = await requiredBox(page, '.tle-journey__engine-controls', `${viewport.label} SGP4 controls`);
    const nav = await requiredBox(page, '.six-acts-nav.is-stage', `${viewport.label} scene navigation`);
    let transport = await requiredBox(page, '.teaching-transport', `${viewport.label} transport`);
    assert.ok(
      engineControls.y + engineControls.height + 8 <= transport.y,
      `${viewport.label}: SGP4 controls stay at least 8px above the transport`,
    );
    assert.ok(
      engineFlow.x + engineFlow.width + 4 <= nav.x,
      `${viewport.label}: SGP4 visual stays left of persistent scene navigation`,
    );
    assert.ok(
      nav.y + nav.height + 8 <= transport.y,
      `${viewport.label}: persistent scene navigation stays at least 8px above the transport`,
    );

    await setRangeValue(page, 98);
    await page.waitForTimeout(240);
    const passVisual = await requiredBox(page, '.tle-journey__pass-duo', `${viewport.label} pass visual`);
    const passScrubber = await requiredBox(page, '.pass-scrubber', `${viewport.label} pass scrubber`);
    const passTimestamps = await requiredBox(page, '.pass-timestamps', `${viewport.label} pass timestamps`);
    transport = await requiredBox(page, '.teaching-transport', `${viewport.label} pass transport`);
    assert.ok(
      passScrubber.y + passScrubber.height + 8 <= transport.y,
      `${viewport.label}: pass scrubber stays at least 8px above the transport`,
    );
    assert.ok(
      passTimestamps.y + passTimestamps.height + 8 <= transport.y,
      `${viewport.label}: pass timestamps stay at least 8px above the transport`,
    );
    assert.ok(
      passVisual.x + passVisual.width + 4 <= nav.x,
      `${viewport.label}: pass visual stays left of persistent scene navigation`,
    );

    await setRangeValue(page, 122);
    await page.waitForTimeout(240);
    const finale = await requiredBox(page, '.tle-journey__pass-final-actions', `${viewport.label} pass finale`);
    const inspector = await requiredBox(page, '.tle-journey__pause-tools', `${viewport.label} inspector trigger`);
    transport = await requiredBox(page, '.teaching-transport', `${viewport.label} pass-finale transport`);
    assert.ok(
      finale.y + finale.height + 8 <= transport.y,
      `${viewport.label}: pass-finale actions stay at least 8px above the transport`,
    );
    assert.equal(
      rectanglesOverlap(finale, inspector),
      false,
      `${viewport.label}: inspector trigger does not cover pass-finale actions`,
    );
  }
}

async function assertReadableAndContained(page: Page, width: number, height: number): Promise<void> {
  const report = await page.evaluate(() => {
    const roots = [
      document.querySelector<HTMLElement>('.tle-journey__theater'),
      document.querySelector<HTMLElement>('[data-testid="tle-journey-transport"]'),
    ].filter((root): root is HTMLElement => root !== null);
    const leaves = roots.flatMap(root => [...root.querySelectorAll<HTMLElement>('*')]
      .filter(node => node.children.length === 0)
      .filter(node => node.textContent?.trim().length)
      .filter(node => !node.closest('[aria-hidden="true"], .sr-only'))
      .map(node => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return {
          text: node.textContent?.trim().slice(0, 120) ?? '',
          fontSize: Number.parseFloat(style.fontSize),
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      })
      .filter(node => node.width > 0 && node.height > 0));
    const controls = roots.flatMap(root => [...root.querySelectorAll<HTMLElement>('button, input, select, textarea')]
      .filter(node => !node.closest('[aria-hidden="true"], .sr-only'))
      .map(node => {
        const rect = node.getBoundingClientRect();
        return { tag: node.tagName, label: node.getAttribute('aria-label') ?? node.textContent?.trim() ?? '', width: rect.width, height: rect.height };
      })
      .filter(node => node.width > 0 && node.height > 0));
    const subtitleLines = [...document.querySelectorAll<HTMLElement>('.tle-journey__subtitle-bar .subtitle-text p')].map(node => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return { text: node.textContent?.trim() ?? '', lineBoxes: range.getClientRects().length };
    });
    const subtitle = document.querySelector<HTMLElement>('.tle-journey__subtitle-bar')?.getBoundingClientRect();
    const transport = document.querySelector<HTMLElement>('[data-testid="tle-journey-transport"]')?.getBoundingClientRect();
    return {
      leaves,
      controls,
      subtitleLines,
      subtitleBottom: subtitle?.bottom ?? 0,
      transportTop: transport?.top ?? window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    };
  });

  assert.ok(report.leaves.every(item => item.fontSize >= 16), `${width}x${height}: meaningful TLE text below 16px: ${JSON.stringify(report.leaves.filter(item => item.fontSize < 16))}`);
  assert.ok(report.leaves.every(item => item.left >= -1 && item.right <= width + 1 && item.top >= -1 && item.bottom <= height + 1), `${width}x${height}: meaningful text clipped: ${JSON.stringify(report.leaves.filter(item => item.left < -1 || item.right > width + 1 || item.top < -1 || item.bottom > height + 1))}`);
  assert.ok(report.controls.every(item => item.width >= 44 && item.height >= 44), `${width}x${height}: control below 44px: ${JSON.stringify(report.controls.filter(item => item.width < 44 || item.height < 44))}`);
  const maximumWrappedLinesPerCaption = width <= 360 ? 4 : width <= 720 ? 3 : 2;
  assert.ok(report.subtitleLines.every(item => item.lineBoxes <= maximumWrappedLinesPerCaption), `${width}x${height}: subtitle wrapping is excessive: ${JSON.stringify(report.subtitleLines)}`);
  assert.ok(report.transportTop >= report.subtitleBottom - 1, `${width}x${height}: subtitle overlaps bottom transport`);
  assert.ok(report.scrollWidth <= report.innerWidth + 1, `${width}x${height}: horizontal overflow (${report.scrollWidth} > ${report.innerWidth})`);
}

async function assertPictureFirstComposition(page: Page, width: number, height: number): Promise<void> {
  const report = await page.evaluate(() => {
    const theater = document.querySelector<HTMLElement>('.tle-journey__theater')?.getBoundingClientRect();
    const subtitle = document.querySelector<HTMLElement>('.tle-journey__subtitle-bar');
    const currentBeat = document.querySelector<HTMLElement>('.tle-journey__beat');
    const activeBeatLeaves = currentBeat ? Array.from(currentBeat.querySelectorAll<HTMLElement>('*'))
      .filter(function(node) { return node.children.length === 0; })
      .filter(function(node) { return Boolean(node.textContent?.trim().length); })
      .filter(function(node) { return node.closest('[aria-hidden="true"], .sr-only') === null; })
      .map(function(node) {
        const rect = node.getBoundingClientRect();
        return { text: node.textContent?.trim().slice(0, 80) ?? '', left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      })
      .filter(function(node) { return node.width > 0 && node.height > 0; }) : [];
    const pauseButton = document.querySelector<HTMLElement>('.tle-journey__pause-tools button')?.getBoundingClientRect();
    const radarNode = document.querySelector<HTMLElement>('.tle-journey__pass-duo .pass-panel.is-radar');
    const radarStyle = radarNode ? window.getComputedStyle(radarNode) : null;
    const radarRect = radarNode?.getBoundingClientRect();
    const legacySelectors = ['.six-acts-bridge', '.tle-journey__footer', '.tle-journey__top-bar'];
    return {
      activeBeatId: document.querySelector<HTMLElement>('main.tle-journey')?.dataset.beat ?? 'unknown',
      theaterWidth: theater?.width ?? 0,
      theaterHeight: theater?.height ?? 0,
      subtitlePosition: subtitle ? window.getComputedStyle(subtitle).position : 'missing',
      activeBeatChildren: currentBeat ? Array.from(currentBeat.children)
        .filter(function(node) {
          const element = node as HTMLElement;
          const style = window.getComputedStyle(element);
          return style.display !== 'none' && !element.classList.contains('sr-only');
      }).length : 0,
      activeBeatLeaves,
      inspectorCollisions: activeBeatLeaves
        .filter(leaf => pauseButton !== undefined && leaf.left < pauseButton.right && leaf.right > pauseButton.left && leaf.top < pauseButton.bottom && leaf.bottom > pauseButton.top)
        .map(leaf => leaf.text),
      mobileRadarVisible: radarStyle !== null && radarStyle.display !== 'none' && radarStyle.visibility !== 'hidden' && (radarRect?.width ?? 0) > 0 && (radarRect?.height ?? 0) > 0,
      visibleLegacyChrome: legacySelectors.filter(selector => {
        const node = document.querySelector<HTMLElement>(selector);
        if (!node) return false;
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      }),
    };
  });

  assert.ok(report.theaterWidth >= width * .9, `${width}x${height}: active theater is not frame-wide (${report.theaterWidth}px)`);
  assert.ok(report.theaterHeight >= height * .7, `${width}x${height}: active theater is not dominant (${report.theaterHeight}px)`);
  if (report.activeBeatId !== 'raw-record' && report.activeBeatId !== 'column-walk') {
    assert.equal(report.subtitlePosition, 'missing', `${width}x${height}: ${report.activeBeatId} must not cover its in-scene evidence with a lower-left caption`);
  } else {
    assert.equal(report.subtitlePosition, 'absolute', `${width}x${height}: caption is not a transient overlay`);
  }
  assert.ok(report.activeBeatChildren >= 1, `${width}x${height}: active beat has no dominant visual`);
  assert.ok(report.activeBeatLeaves.every(item => item.left >= -1 && item.right <= width + 1 && item.top >= -1 && item.bottom <= height + 1), `${width}x${height}: active beat text is outside the frame: ${JSON.stringify(report.activeBeatLeaves.filter(item => item.left < -1 || item.right > width + 1 || item.top < -1 || item.bottom > height + 1))}`);
  assert.deepEqual(report.inspectorCollisions, [], `${width}x${height}: inspector obscures active beat text: ${JSON.stringify(report.inspectorCollisions)}`);
  assert.deepEqual(report.visibleLegacyChrome, [], `${width}x${height}: persistent dashboard chrome is visible: ${JSON.stringify(report.visibleLegacyChrome)}`);
  if (width <= 720) assert.equal(report.mobileRadarVisible, false, `${width}x${height}: mobile stacks a second pass surface`);
}

async function assertPersistentNavigation(page: Page): Promise<void> {
  const nav = page.getByTestId('six-acts-stage-nav');
  assert.equal(await nav.count(), 1, 'TLE Journey carries persistent scene navigation');
  assert.equal(await nav.locator('.six-acts-nav__acts a').count(), SIX_ACTS_VISIBLE_ROUTES.length, 'all released experiments are directly reachable');
  assert.equal(await nav.locator('a[href="/"]').count(), 1, 'the homepage is directly reachable');
  const current = nav.locator('.six-acts-nav__acts a[aria-current="page"]');
  assert.equal(await current.count(), 1, 'exactly one scene is current');
  assert.equal(await current.getAttribute('href'), ROUTE, 'Act 2 is marked current');
  assert.equal(await current.locator('em').evaluate(node => getComputedStyle(node).color), 'rgb(255, 255, 255)', 'the current act number remains white');
}

async function assertOrbitUsesRealModelAndKeepsCenterClear(page: Page): Promise<void> {
  const orbit = page.locator('.tle-journey__canvas-wrap');
  assert.equal(await orbit.getAttribute('data-satellite-model-path'), '/models/satellite-starlink.glb', 'Act 2 names the Starlink GLB used for the propagated satellite');
  assert.equal(await orbit.getAttribute('data-satellite-material'), 'opaque-lit', 'Act 2 keeps the real GLB opaque and intentionally lit');
  assert.ok(Number(await orbit.getAttribute('data-satellite-stage-scale')) <= 0.2, 'Act 2 keeps the satellite model at a restrained stage scale');
  assert.equal(await orbit.getAttribute('data-orbit-start-utc'), '2026-08-24T14:31:31.856Z', 'orbit window starts at the latest archived Starlink epoch');
  assert.equal(await orbit.getAttribute('data-orbit-end-utc'), '2026-08-24T16:03:44.831Z', 'orbit window ends one SGP4 period later');
  assert.equal(await orbit.getAttribute('data-orbit-longitude-shift-deg'), '-23.30', 'orbit window reports the Earth-fixed westward shift');
  assert.equal(await orbit.getAttribute('data-orbit-endpoint-markers'), 'foreground', 'orbit endpoints use foreground markers so they remain inspectable on the globe');
  assert.equal(await orbit.getAttribute('data-orbit-endpoint-path'), 'same-trail', 'orbit endpoint markers use the exact first and last points of the rendered trail');
  assert.equal(await orbit.getAttribute('data-orbit-motion-source'), 'SGP4-ECEF-shared-position', 'the moving satellite and highlighted path use the same SGP4/ECEF position source');
  const currentPosition = (await orbit.getAttribute('data-orbit-current-position') ?? '').split(',').map(Number);
  assert.equal(currentPosition.length, 3, 'the current satellite position exposes all three scene coordinates');
  assert.ok(currentPosition.every(Number.isFinite), `current satellite position is finite: ${currentPosition}`);
  assert.equal(await page.getByTestId('tle-orbit-start-label').count(), 1, 'orbit start label is visible in the 3D scene');
  assert.equal(await page.getByTestId('tle-orbit-end-label').count(), 1, 'orbit end label is visible in the 3D scene');
  for (const label of [page.getByTestId('tle-orbit-start-label'), page.getByTestId('tle-orbit-end-label')]) {
    const fontSize = await label.evaluate(node => Number.parseFloat(getComputedStyle(node).fontSize));
    assert.ok(fontSize >= 16, `orbit endpoint label is readable (${fontSize}px)`);
  }

  const report = await page.evaluate(() => {
    const center = {
      left: window.innerWidth * .34,
      right: window.innerWidth * .66,
      top: window.innerHeight * .22,
      bottom: window.innerHeight * .76,
    };
    const selectors = [
      '.tle-journey__hud-badge',
      '.tle-journey__hud-link',
      '.tle-journey__orbit-window-readout',
      '.tle-journey__subtitle-bar',
      '.tle-journey__pause-tools',
      '[data-testid="six-acts-stage-nav"]',
      '[data-testid="tle-journey-transport"]',
    ];
    const collisions = selectors.flatMap(selector => [...document.querySelectorAll<HTMLElement>(selector)]
      .filter(node => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      })
      .map(node => {
        const rect = node.getBoundingClientRect();
        return {
          selector,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      })
      .filter(rect => rect.left < center.right && rect.right > center.left && rect.top < center.bottom && rect.bottom > center.top));
    return { center, collisions };
  });
  assert.deepEqual(report.collisions, [], `Act 2 HTML overlays stay out of the central inspection area: ${JSON.stringify(report)}`);
}

async function assertTransportInteraction(page: Page): Promise<void> {
  const main = page.locator('main.tle-journey');
  const transport = page.getByTestId('tle-journey-transport');
  assert.equal(await main.getAttribute('data-transport-duration'), '122.0', 'TLE Journey uses the authored 10/40/24/24/24-second pacing');

  const play = page.getByTestId('transport-play-pause');
  if (await main.getAttribute('data-transport-playing') === 'true') await play.click();
  assert.equal(await main.getAttribute('data-transport-playing'), 'false', 'paused transport is truthful');

  await setRangeValue(page, 10);
  assert.equal(await main.getAttribute('data-beat'), 'column-walk', '10s seek lands on beat 2');
  await setRangeValue(page, 55);
  assert.equal(await main.getAttribute('data-beat'), 'sgp4-contract', '55s seek lands in beat 3');
  await page.getByTestId('transport-rewind').click();
  assert.equal(await main.getAttribute('data-transport-time'), '50.0', '-5s is exact');
  await page.getByTestId('transport-forward').click();
  assert.equal(await main.getAttribute('data-transport-time'), '55.0', '+5s returns exactly');

  for (const speed of [0.5, 1, 1.5, 2]) {
    await page.getByTestId('transport-speed-current').click();
    await page.getByTestId(`transport-speed-${speed}`).click();
    assert.equal(await main.getAttribute('data-transport-speed'), String(speed), `${speed}x speed is applied`);
  }

  await setRangeValue(page, 0);
  await page.getByTestId('transport-speed-current').click();
  await page.getByTestId('transport-speed-2').click();
  await play.click();
  await page.waitForTimeout(260);
  await play.click();
  const fastTime = Number(await main.getAttribute('data-transport-time'));
  assert.ok(fastTime >= 0.3, `2x playback advances the shared course clock (${fastTime})`);

  await setRangeValue(page, 122);
  assert.equal(await main.getAttribute('data-beat'), 'observer-pass', 'terminal seek stays on the pass-prediction finale');
  assert.equal(await page.getByTestId('tle-journey-pass-finale').count(), 1, 'pass-prediction finale exposes replay and Act 3 handoff');
  await play.click();
  await page.waitForTimeout(20);
  assert.equal(await main.getAttribute('data-transport-playing'), 'true', 'Play at end restarts the course');
  assert.ok(Number(await main.getAttribute('data-transport-time')) < 1, 'restart begins at course time zero');
  await play.click();

  await assertReadableAndContained(page, 1920, 1080);
  assert.equal(await transport.getAttribute('data-transport-visible'), 'true', 'paused transport remains visible');
}

async function assertAct2CopyAndPacing(page: Page): Promise<void> {
  const main = page.locator('main.tle-journey');

  await setRangeValue(page, 0);
  const rawConsole = page.locator('.tle-journey__raw-console');
  const rawText = await rawConsole.textContent() ?? '';
  assert.doesNotMatch(rawText, /學生一律/, 'the raw station does not show the removed student-only instruction');
  assert.equal(await rawConsole.locator('.tle-journey__console-title').textContent(), '封存 TLE · STARLINK-1008', 'first station uses a concise source title');
  assert.equal(await rawConsole.locator('.tle-journey__console-meta').textContent(), '每行 69 字元 · 包含空白', 'the fixed-width TLE format explicitly counts spaces');
  const rawSubtitle = page.locator('.tle-journey__subtitle-bar[data-station-id="raw-record"]');
  const rawSubtitleLayout = await rawSubtitle.evaluate(node => {
    const paragraphs = [...node.querySelectorAll<HTMLElement>('.subtitle-text p')];
    return {
      width: node.getBoundingClientRect().width,
      paragraphs: paragraphs.map(paragraph => {
        const range = document.createRange();
        range.selectNodeContents(paragraph);
        const rect = paragraph.getBoundingClientRect();
        return { text: paragraph.textContent ?? '', lineBoxes: range.getClientRects().length, top: rect.top, bottom: rect.bottom };
      }),
    };
  });
  assert.ok(rawSubtitleLayout.width >= 1_200, `first station subtitle block is wide enough for two single-line statements (${rawSubtitleLayout.width}px)`);
  assert.deepEqual(rawSubtitleLayout.paragraphs.map(paragraph => paragraph.lineBoxes), [1, 1], `first station subtitle statements do not wrap: ${JSON.stringify(rawSubtitleLayout.paragraphs)}`);
  assert.ok(rawSubtitleLayout.paragraphs[1]!.top > rawSubtitleLayout.paragraphs[0]!.bottom, 'first station subtitle statements have a visible line gap');
  assert.match(rawSubtitleLayout.paragraphs[1]!.text, /69 個固定字元位置（包含空白）/, 'first station explains that all fixed positions, including spaces, count toward 69 characters');
  assert.match(rawSubtitleLayout.paragraphs[1]!.text, /第 69 個字元.*檢核碼/, 'first station identifies the final checksum character');
  const firstCodeSize = await rawConsole.locator('.tle-journey__code-line code').first().evaluate(node => Number.parseFloat(getComputedStyle(node).fontSize));
  assert.ok(firstCodeSize >= 30, `first station primary TLE text is projector-sized (${firstCodeSize}px)`);

  const valueSizes: number[] = [];
  for (const checkpoint of [0, 10, 50, 74, 98, 122]) {
    await setRangeValue(page, checkpoint);
    const valueSize = await page.locator('.tle-journey__beat .tle-journey__key-value:visible').first().evaluate(node => Number.parseFloat(getComputedStyle(node).fontSize));
    valueSizes.push(valueSize);
    assert.ok(valueSize >= 20, `beat at ${checkpoint}s exposes a large key value (${valueSize}px)`);
  }
  assert.ok(valueSizes[0]! > valueSizes[1]!, `beat 1 remains the largest first-read cue (${valueSizes.join(', ')})`);

  await setRangeValue(page, 74);
  assert.equal(await main.getAttribute('data-beat'), 'satellite-orbit', 'authored beat timing reaches Act 2 beat 4 at 74s');
  assert.equal(await page.locator('.tle-journey__subtitle-bar').count(), 0, 'beat 4 does not cover the 3D scene with a lower-left caption');
  const beatFourReadout = await page.getByTestId('tle-orbit-window-readout').textContent() ?? '';
  assert.match(beatFourReadout, /2,594|2594/, 'beat 4 exposes the computed ground-track distance');
  assert.match(beatFourReadout, /向西 23.30°/, 'beat 4 gives the computed Earth-fixed longitude shift inside its readout');
  assert.match(beatFourReadout, /地球自轉/, 'beat 4 explains why one inertial period does not close in the Earth-fixed frame');

  await setRangeValue(page, 55);
  assert.equal(await main.getAttribute('data-beat'), 'sgp4-contract', '55s reaches the SGP4 transformation');
  assert.equal(await page.locator('.tle-journey__subtitle-bar').count(), 0, 'SGP4 controls and model note are not covered by a lower-left caption');
  assert.match(await page.locator('.tle-journey__engine-controls .engine-hint').textContent() ?? '', /模型.*非即時實測遙測/, 'SGP4 scientific scope remains visible inside the scene');
  assert.equal(await main.getAttribute('data-sgp4-output-mode'), 'staged-time-lapse', 'SGP4 publishes a staged teaching time-lapse rather than frame-by-frame output');
  const formulaGuide = page.getByTestId('tle-sgp4-formula-guide');
  await formulaGuide.first().waitFor({ state: 'visible' });
  const formulaBox = await requiredBox(page, '[data-testid="tle-sgp4-formula-guide"]', 'SGP4 formula row');
  const engineFlowBox = await requiredBox(page, '.tle-journey__engine-flow', 'SGP4 three-column flow');
  const leftInputBox = await requiredBox(page, '.tle-journey__engine-flow .flow-token.is-offset, .tle-journey__engine-flow .flow-in', 'SGP4 left input block');
  const transformerBox = await requiredBox(page, '.tle-journey__engine-flow .flow-transformer', 'SGP4 transformer');
  assert.ok(formulaBox.x >= engineFlowBox.x - 1, 'SGP4 formula row stays inside the flow frame');
  assert.ok(formulaBox.y >= leftInputBox.y + leftInputBox.height - 1, 'SGP4 formula row follows the left input block vertically');
  assert.ok(formulaBox.x + formulaBox.width + 4 <= transformerBox.x, 'SGP4 formula row stays under the left input column instead of covering the transformer or output');
  const formulaCopy = await formulaGuide.first().textContent() ?? '';
  assert.match(formulaCopy, /TLE, Δt.*SGP4.*rTEME.*vTEME/s, 'SGP4 exposes the single input-to-output transformation');
  assert.doesNotMatch(formulaCopy, /r_TEME|v_TEME|T_orbit|1440.*n/, 'SGP4 scene uses mathematical subscripts without literal underscores or duplicated mean-motion derivation');
  assert.equal(await formulaGuide.first().locator('sub').count(), 2, 'SGP4 renders TEME labels as semantic mathematical subscripts');
  assert.deepEqual(
    await formulaGuide.first().locator('sub').allTextContents(),
    ['TEME', 'TEME'],
    'both SGP4 output components carry the TEME subscript',
  );
  assert.match(formulaCopy, /r 是位置向量.*\(x, y, z\) 是它的三個分量/s, 'SGP4 explains why the position vector is shown as x, y, z');
  assert.match(formulaCopy, /v 是速度向量.*\|v\| 顯示其速率/s, 'SGP4 explains that the displayed speed is the magnitude of the velocity vector');
  assert.match(
    await page.locator('.flow-in .flow-param:nth-child(2) .param-label').textContent() ?? '',
    /Δt = t − tepoch/,
    'SGP4 places the time-offset relationship beside its input',
  );
  assert.equal(
    await page.locator('.flow-in .flow-param:nth-child(2) .param-label sub').textContent(),
    'epoch',
    'the TLE epoch is rendered as a semantic subscript',
  );
  const temeDefinition = page.getByTestId('tle-teme-position-definition');
  await temeDefinition.first().waitFor({ state: 'visible' });
  assert.match(await page.locator('.flow-out .flow-card-head h3').textContent() ?? '', /TEME 狀態向量（r、v）/, 'the output card names the r and v state vectors');
  assert.match(await page.locator('.flow-out .flow-output-row .row-name').textContent() ?? '', /位置向量 r = \(x, y, z\) km/, 'the output card identifies x, y, z as the position-vector components');
  assert.match(await page.locator('.flow-output-grid .row-name').nth(1).textContent() ?? '', /速率 \|v\|/, 'the output card labels speed as the magnitude of v');
  const temeDefinitionCopy = await temeDefinition.first().textContent() ?? '';
  assert.match(temeDefinitionCopy, /三個數字的定義.*TEME.*單位 km/, 'SGP4 labels the coordinate frame and unit beside the output tuple');
  assert.match(temeDefinitionCopy, /x.*TEME X 軸/s, 'SGP4 defines the x position component');
  assert.match(temeDefinitionCopy, /y.*TEME Y 軸/s, 'SGP4 defines the y position component');
  assert.match(temeDefinitionCopy, /z.*TEME Z 軸/s, 'SGP4 defines the z position component');
  assert.match(temeDefinitionCopy, /不是經緯度/, 'SGP4 prevents the Cartesian tuple from being misread as geographic coordinates');
  assert.equal(await page.getByTestId('tle-teme-axis-x').count(), 1, 'x axis definition is rendered once');
  assert.equal(await page.getByTestId('tle-teme-axis-y').count(), 1, 'y axis definition is rendered once');
  assert.equal(await page.getByTestId('tle-teme-axis-z').count(), 1, 'z axis definition is rendered once');

  await setRangeValue(page, 56.2);
  const play = page.getByTestId('transport-play-pause');
  await play.click();
  const timeLapse = page.getByTestId('tle-sgp4-time-lapse');
  await timeLapse.waitFor({ state: 'visible' });
  const compression = Number(await timeLapse.getAttribute('data-time-compression-factor'));
  assert.ok(compression >= 300, `SGP4 time compression is disclosed (${compression}x)`);
  assert.match(
    await timeLapse.textContent() ?? '',
    /分鐘軌道濃縮為 18 秒.*4 個代表時刻.*4\.5 秒.*非即時速度/s,
    'the scene explains why the output changes faster than physical time',
  );
  const heldOffset = await main.getAttribute('data-sgp4-offset-min');
  await page.waitForTimeout(450);
  assert.equal(await main.getAttribute('data-sgp4-offset-min'), heldOffset, 'one representative TEME output remains readable instead of changing every frame');
  await play.click();

  await setRangeValue(page, 60.6);
  assert.equal(await main.getAttribute('data-sgp4-checkpoint-index'), '1', 'the second representative orbital instant begins at the authored checkpoint');
  assert.notEqual(await main.getAttribute('data-sgp4-offset-min'), heldOffset, 'the output advances only when the next representative instant begins');

  await setRangeValue(page, 98);
  assert.equal(await page.locator('.tle-journey__subtitle-bar').count(), 0, 'beat 5 removes the lower-left overlay that covered pass labels');
  const passStage = page.locator('.tle-journey__beat--pass');
  assert.equal(await passStage.getAttribute('data-pass-satellite-id'), '44714', 'beat 5 identifies the archived Starlink satellite used for the pass');
  assert.equal(await passStage.getAttribute('data-pass-source-path'), '/tle-archive/starlink/starlink_20260824.tle', 'beat 5 retains the latest checked-in TLE source path');
  assert.equal(await passStage.getAttribute('data-pass-propagation-model'), 'SGP4', 'beat 5 identifies its propagation model');
  assert.equal(await passStage.getAttribute('data-pass-observer'), 'NTPU_WGS84', 'beat 5 identifies the NTPU WGS84 observer');
  assert.equal(await passStage.getAttribute('data-pass-minimum-elevation-deg'), '10', 'beat 5 uses the explicit 10-degree observation threshold');
  assert.equal(await passStage.getAttribute('data-pass-sample-step-sec'), '5', 'beat 5 discloses its five-second sampling resolution');
  assert.equal(await passStage.getAttribute('data-pass-duration-sec'), '370', 'beat 5 exposes the computed above-threshold sampled duration');
  const beatFiveCopy = await page.getByTestId('tle-pass-model-note').textContent() ?? '';
  assert.match(beatFiveCopy, /封存 TLE.*SGP4.*每 5 秒取樣/, 'beat 5 identifies the archived-TLE SGP4 sampling basis');
  assert.match(beatFiveCopy, /僅指這一次模型通過/, 'beat 5 does not generalize the 6.2-minute result to all passes');
  const axisLabels = await passStage.locator('.pass-axis-label').allTextContents();
  assert.ok(axisLabels.some(label => /X｜相對通過時間/.test(label)), 'NTPU elevation history labels its X axis');
  assert.ok(axisLabels.some(label => /Y｜地面仰角/.test(label)), 'NTPU elevation history labels its Y axis');

  await assertColumnWalkSubtitles(page);
}

async function assertInspectorSpecification(page: Page): Promise<void> {
  const main = page.locator('main.tle-journey');
  if (await main.getAttribute('data-transport-playing') === 'true') {
    await page.getByTestId('transport-play-pause').click();
  }
  await page.locator('.tle-journey__btn.is-inspector').click();
  const drawer = page.locator('.tle-journey__inspector-drawer');
  await drawer.waitFor({ state: 'visible' });
  await drawer.getByRole('tab', { name: '科學權威與 Provenance' }).click();
  const provenance = drawer.locator('.inspector-provenance');
  const source = provenance.locator('.prov-item').first();
  assert.equal(await source.getAttribute('data-source-path'), '/tle-archive/starlink/starlink_20260824.tle', 'the source path remains in machine-readable provenance');
  assert.match(await source.textContent() ?? '', /資料來源 \(Source\).*Starlink · 2026-08-24/s, 'visible Source shows only constellation and archive date');
  assert.doesNotMatch(await provenance.textContent() ?? '', /\/tle-archive\//, 'the local archive path is not exposed as visible source copy');
  const dimensions = await drawer.locator('.inspector-content').evaluate(node => {
    const rect = node.getBoundingClientRect();
    const body = node.querySelector<HTMLElement>('.inspector-body');
    const tab = node.querySelector<HTMLElement>('.inspector-tabs button');
    return {
      width: rect.width,
      bodyFontSize: body ? Number.parseFloat(getComputedStyle(body).fontSize) : 0,
      tabFontSize: tab ? Number.parseFloat(getComputedStyle(tab).fontSize) : 0,
    };
  });
  assert.ok(dimensions.width >= 840, `desktop data specification drawer is wide enough (${dimensions.width}px)`);
  assert.ok(dimensions.bodyFontSize >= 16.8, `data specification body is readable (${dimensions.bodyFontSize}px)`);
  assert.ok(dimensions.tabFontSize >= 16, `data specification tabs are readable (${dimensions.tabFontSize}px)`);
  await drawer.locator('.inspector-close').click();
  await drawer.waitFor({ state: 'detached' });
}

async function assertColumnWalkSubtitles(page: Page): Promise<void> {
  const checkpoints = [
    { time: 10, id: 'l1-epoch', label: 'Epoch', range: '第 1 行 · 第 19–32 欄', raw: '26236.60522982' },
    { time: 18, id: 'l1-checksum', label: '檢核碼', range: '第 1 行 · 第 69 欄', raw: '2' },
    { time: 26, id: 'l2-inclination', label: '傾角', range: '第 2 行 · 第 9–16 欄', raw: '53.1483' },
    { time: 34, id: 'l2-meanmotion', label: '平均運動', range: '第 2 行 · 第 53–63 欄', raw: '15.61546781' },
    { time: 42, id: 'l2-checksum', label: '檢核碼', range: '第 2 行 · 第 69 欄', raw: '2' },
  ] as const;
  const subtitle = page.locator('.tle-journey__subtitle-bar[data-station-id="column-walk"]');
  const keyPoint = page.getByTestId('tle-column-walk-key-point');
  const observedExplanations = new Set<string>();

  for (const checkpoint of checkpoints) {
    await setRangeValue(page, checkpoint.time);
    assert.equal(await subtitle.getAttribute('data-field-id'), checkpoint.id, `${checkpoint.time}s selects ${checkpoint.id}`);
    assert.equal(await subtitle.getAttribute('data-field-range'), checkpoint.range, `${checkpoint.time}s exposes the field row/column range`);
    assert.equal(await subtitle.getAttribute('data-field-raw'), checkpoint.raw, `${checkpoint.time}s exposes the raw field value`);
    const caption = await subtitle.textContent() ?? '';
    assert.match(caption, new RegExp(checkpoint.label), `${checkpoint.time}s names the selected field`);
    assert.match(caption, new RegExp(checkpoint.raw.replace('.', '\\.'), 'g'), `${checkpoint.time}s prints the raw value in the caption`);
    const explanation = (await keyPoint.textContent() ?? '').trim();
    assert.ok(explanation.length >= 48, `${checkpoint.time}s has a concrete field explanation`);
    observedExplanations.add(explanation);
  }
  assert.equal(observedExplanations.size, checkpoints.length, 'five column-walk checkpoints publish five distinct explanations');
  const coversPrimaryScannerVisual = await page.evaluate(() => {
    const subtitle = document.querySelector<HTMLElement>('.tle-journey__subtitle-bar');
    const scannerDisplay = document.querySelector<HTMLElement>('.scanner-line-display');
    if (!subtitle || !scannerDisplay) return true;
    const caption = subtitle.getBoundingClientRect();
    const primary = scannerDisplay.getBoundingClientRect();
    return caption.left < primary.right
      && caption.right > primary.left
      && caption.top < primary.bottom
      && caption.bottom > primary.top;
  });
  assert.equal(coversPrimaryScannerVisual, false, 'column-walk subtitle stays outside the primary scanner visual');

  const overlapsScannerEvidence = await page.evaluate(() => {
    const subtitle = document.querySelector<HTMLElement>('.tle-journey__subtitle-bar')?.getBoundingClientRect();
    if (!subtitle) return ['subtitle-missing'];
    return [...document.querySelectorAll<HTMLElement>(
      '.tle-journey__scanner-console, .scanner-line-display, .scanner-compact-hud, .scanner-stepper-row',
    )]
      .filter(node => {
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && rect.width > 0
          && rect.height > 0
          && subtitle.left < rect.right
          && subtitle.right > rect.left
          && subtitle.top < rect.bottom
          && subtitle.bottom > rect.top;
      })
      .map(node => node.className);
  });
  assert.deepEqual(
    overlapsScannerEvidence,
    [],
    'column-walk caption does not cover the scanner console or its active field evidence',
  );

  const expectedManualIds = checkpoints.map(checkpoint => checkpoint.id);
  for (const [index, checkpoint] of checkpoints.entries()) {
    await page.locator('.scanner-step-pill').nth(index).click();
    assert.equal(await page.locator('main.tle-journey').getAttribute('data-transport-playing'), 'false', 'manual field selection pauses the shared clock');
    assert.equal(await subtitle.getAttribute('data-field-id'), checkpoint.id, `manual selection stays on ${checkpoint.id}`);
  }
  assert.deepEqual(expectedManualIds, checkpoints.map(checkpoint => checkpoint.id), 'manual field order matches the narrated five-field order');

  // At accelerated playback the same selectedFieldId source must update the
  // caption without requiring a seek or a manual tab click.
  await setRangeValue(page, 10);
  await page.getByTestId('transport-speed-current').click();
  await page.getByTestId('transport-speed-8').click();
  await page.getByTestId('transport-play-pause').click();
  await page.waitForFunction(
    () => document.querySelector('.tle-journey__subtitle-bar')?.getAttribute('data-field-id') === 'l1-checksum',
    undefined,
    { timeout: 5_000 },
  );
  assert.equal(await page.locator('main.tle-journey').getAttribute('data-transport-playing'), 'true', 'autoplay remains active while the field caption advances');
  await page.getByTestId('transport-play-pause').click();
}

async function assertAutoHideAccess(page: Page): Promise<void> {
  const main = page.locator('main.tle-journey');
  const transport = page.getByTestId('tle-journey-transport');
  const play = page.getByTestId('transport-play-pause');
  await play.click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(24, 240);
  await page.waitForTimeout(3_200);
  assert.equal(await transport.getAttribute('data-transport-visible'), 'false', 'playing transport auto-hides');
  assert.equal(await transport.evaluate(node => getComputedStyle(node).pointerEvents), 'none', 'hidden transport does not block stage');
  const hidden = await transport.evaluate(node => ({
    ariaHidden: node.getAttribute('aria-hidden'),
    inert: node.hasAttribute('inert'),
    tabbables: [...node.querySelectorAll<HTMLElement>('button,input,a,[tabindex]')].filter(control => control.getAttribute('tabindex') !== '-1').length,
  }));
  assert.equal(hidden.ariaHidden, 'true', 'hidden transport leaves the accessibility tree');
  assert.equal(hidden.inert, true, 'hidden transport is inert');
  assert.equal(hidden.tabbables, 0, 'hidden transport has no invisible tabbables');

  await page.mouse.move(80, 1078);
  await page.waitForFunction(() => document.querySelector('[data-testid="tle-journey-transport"]')?.getAttribute('data-transport-visible') === 'true');
  await page.mouse.move(960, 420);
  await page.waitForTimeout(2_800);
  await page.keyboard.down('Alt');
  await page.keyboard.press('t');
  await page.keyboard.up('Alt');
  await page.waitForFunction(() => document.querySelector('[data-testid="tle-journey-transport"]')?.getAttribute('data-transport-visible') === 'true');
  await page.waitForTimeout(120);
  assert.equal(await play.evaluate(node => document.activeElement === node), true, 'Alt+T reveals and focuses the play control');
  await play.click();
  assert.equal(await main.getAttribute('data-transport-playing'), 'false', 'focus recovery leaves the clock controllable');
}

async function capture(page: Page, baseUrl: string, viewport: typeof VIEWPORTS[number], slug: string): Promise<string> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await waitForRoute(page, baseUrl);
  await page.waitForTimeout(240);
  const path = resolve(SCREENSHOT_DIR, `${viewport.name}-${slug}.png`);
  await page.screenshot({ path, type: 'png', scale: 'css' });
  return path;
}

async function main(): Promise<void> {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const baseUrl = await detectAppUrl();
  const browser: Browser = await chromium.launch();
  const consoleErrors: string[] = [];
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => consoleErrors.push(error.message));

  try {
    await waitForRoute(page, baseUrl);
    await assertPersistentNavigation(page);
    await assertAct2CopyAndPacing(page);
    await assertInspectorSpecification(page);
    await assertTransportInteraction(page);
    await setRangeValue(page, 10);
    await page.waitForTimeout(240);
    await assertPictureFirstComposition(page, 1920, 1080);
    const desktopPaused = resolve(SCREENSHOT_DIR, 'desktop-column-walk-paused.png');
    await page.screenshot({ path: desktopPaused, type: 'png', scale: 'css' });
    await setRangeValue(page, 74);
    await page.waitForTimeout(400);
    await assertOrbitUsesRealModelAndKeepsCenterClear(page);
    const desktopOrbit = resolve(SCREENSHOT_DIR, 'desktop-orbit-paused.png');
    await page.screenshot({ path: desktopOrbit, type: 'png', scale: 'css' });
    await assertReadableAndContained(page, 1920, 1080);
    await assertPictureFirstComposition(page, 1920, 1080);
    if (await page.locator('main.tle-journey').getAttribute('data-transport-playing') === 'true') {
      await page.getByTestId('transport-play-pause').click();
      await page.waitForFunction(
        () => document.querySelector('main.tle-journey')?.getAttribute('data-transport-playing') === 'false',
      );
    }
    await setRangeValue(page, 122);
    await page.waitForTimeout(700);
    const desktopPassFinale = resolve(SCREENSHOT_DIR, 'desktop-observer-pass-finale.png');
    await page.screenshot({ path: desktopPassFinale, type: 'png', scale: 'css' });
    await setRangeValue(page, 10);
    await page.getByTestId('transport-speed-current').click();
    await page.getByTestId('transport-speed-1').click();
    await assertAutoHideAccess(page);

    const mobileScreenshots: string[] = [];
    for (const viewport of VIEWPORTS.filter(candidate => candidate.width <= 720)) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await waitForRoute(page, baseUrl);
      const mobileMain = page.locator('main.tle-journey');
      const mobilePlay = page.getByTestId('transport-play-pause');
      if (await mobileMain.getAttribute('data-transport-playing') === 'true') await mobilePlay.click();
      await setRangeValue(page, 98);
      await page.waitForTimeout(450);
      await assertPersistentNavigation(page);
      await assertPictureFirstComposition(page, viewport.width, viewport.height);
      await assertReadableAndContained(page, viewport.width, viewport.height);
      const mobilePass = resolve(SCREENSHOT_DIR, `${viewport.name}-observer-pass-paused.png`);
      await page.screenshot({ path: mobilePass, type: 'png', scale: 'css' });
      mobileScreenshots.push(mobilePass);
    }

    await assertResponsiveSceneClearance(page, baseUrl);

    assert.deepEqual(consoleErrors, [], `browser console errors: ${JSON.stringify(consoleErrors)}`);
    console.log(JSON.stringify({
      baseUrl,
      screenshots: [desktopPaused, desktopOrbit, desktopPassFinale, ...mobileScreenshots],
      viewports: VIEWPORTS,
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
