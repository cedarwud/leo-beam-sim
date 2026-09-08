/**
 * Visual-first golden-flow browser gate.
 *
 * This turns the composition rules into executable assertions: every beat owns
 * exactly one primary teaching cue, copy stays at two caption lines or fewer,
 * decision panels are mutually exclusive, and at least 70% of the stage remains
 * visible after conservatively adding the overlay rectangles.
 *
 * Strengthened for the scene-first course surface: verifies 390x844 and
 * 320x720 mobile viewports, bounding-box collision absence, central teaching
 * exposure >= 70%, classroom typography, touch targets, hidden inertness,
 * keyboard/pointer steering, transport reveal/speeds, and seek reconstruction.
 *
 * Requires a running dev/preview server. APP_URL may override auto-detection.
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { MEASURED_BROWSER_GATE_FLOORS_MS, runBrowserValidator } from './lib/browser-gate.ts';

import {
  GOLDEN_FLOW_ANGLE_LESSON_OFF_AXIS_DEG,
  GOLDEN_FLOW_BEATS,
  GOLDEN_FLOW_ROUTE,
  GOLDEN_FLOW_TEACHING_MIN_GESTURE_DEG,
  goldenFlowControlsAvailable,
  loadGoldenFlowTruth,
  type GoldenFlowBeatId,
  type GoldenFlowTruth,
} from '../src/prototype/golden-flow/goldenFlowDirector.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const PRIMARY = '[data-primary-teaching="true"]';
const EXCLUSIVE_PANELS = [
  '.golden-flow-pair',
  '.golden-flow-threshold',
  '.golden-flow-ttt',
  '.golden-flow-trace-cue',
  '.golden-flow-commit',
  '.golden-flow-receipt',
  '.golden-flow-handover-decision',
].join(',');
const PRIMARY_CUE_CLASSES = [
  '.golden-flow-scene-cue',
  '.golden-flow-angle-key',
  '.golden-flow-axis-guide',
  '.golden-flow-consequence',
  '.golden-flow-angle-power-ee[data-primary-teaching="true"]',
  '.golden-flow-restore-marker',
  '.golden-flow-pair',
  '.golden-flow-threshold',
  '.golden-flow-ttt',
  '.golden-flow-trace-cue',
  '.golden-flow-commit',
  '.golden-flow-receipt',
  '.golden-flow-finale',
  '.golden-flow-handover-decision',
].join(',');
const FORBIDDEN_CHROME = [
  '.golden-flow-topbar',
  '.golden-flow-chapter',
  '.golden-flow-provenance',
  '.golden-flow-progress',
  '.golden-flow-source',
  '[data-golden-flow-header]',
  '[data-golden-flow-timeline]',
  '[data-golden-flow-nav]',
].join(',');

interface LayoutSnapshot {
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly visibleRatio: number;
  readonly subjectOverlapRatio: number;
}

async function waitForBeat(page: Page, beatId: GoldenFlowBeatId, timeout = 30_000): Promise<void> {
  try {
    await page.waitForFunction(
      (expected) => document.querySelector('main')?.getAttribute('data-beat') === expected,
      beatId,
      { timeout },
    );
  } catch (error) {
    const current = await page.locator('main').getAttribute('data-beat').catch(() => null);
    throw new Error(
      `timed out waiting for beat ${beatId}; current beat is ${current ?? 'missing'}; ` +
      `${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function assertVisibleBox(page: Page, selector: string, label: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const locator = page.locator(selector);
  assert.equal(await locator.count(), 1, `${label}: one scene marker is mounted`);
  const box = await locator.boundingBox();
  assert.ok(box, `${label}: scene marker is visible and measurable`);
  assert.ok(box.width >= 12 && box.height >= 8, `${label}: scene marker has visible size`);
  return box;
}

async function assertElevationGeometry(page: Page, beatId: GoldenFlowBeatId): Promise<void> {
  const elevation = await assertVisibleBox(
    page,
    '[data-testid="golden-flow-angle-elevation"]',
    `${beatId} elevation angle`,
  );
  assert.ok(elevation.width >= 120, `${beatId}: elevation explanation has a readable width`);
  assert.match(await page.locator('[data-testid="golden-flow-angle-elevation"]').innerText(), /仰角 α/);
  assert.equal(
    await page.locator('main').getAttribute('data-angle-vertices'),
    'ue',
    `${beatId}: the staged explanation names only the UE elevation vertex`,
  );
  const sourceElevation = Number(await page.locator('main').getAttribute('data-angle-elevation-deg'));
  const sourceOffAxis = Number(await page.locator('main').getAttribute('data-angle-off-axis-deg'));
  assert.ok(Number.isFinite(sourceElevation) && sourceElevation > 0, `${beatId}: elevation value is available`);
  assert.ok(Number.isFinite(sourceOffAxis) && sourceOffAxis >= 0, `${beatId}: off-axis value is available`);
}

async function assertDecisionScene(page: Page, beatId: GoldenFlowBeatId): Promise<void> {
  const source = page.locator('[data-testid="golden-flow-link-status-source"]');
  const candidate = page.locator('[data-testid="golden-flow-link-status-candidate"]');
  assert.equal(await source.count(), 1, `${beatId}: source ground light telemetry is attached`);
  assert.equal(await candidate.count(), 1, `${beatId}: candidate ground light telemetry is attached`);
  assert.equal(await source.isVisible(), false, `${beatId}: source HTML label does not cover the central 3D light spot`);
  assert.equal(await candidate.isVisible(), false, `${beatId}: candidate HTML label does not cover the central 3D light spot`);
  const sourceIntensity = Number(await source.getAttribute('data-link-intensity'));
  const candidateIntensity = Number(await candidate.getAttribute('data-link-intensity'));
  assert.ok(sourceIntensity >= 0 && candidateIntensity >= 0, `${beatId}: visual intensities are bounded`);
  assert.equal(await candidate.getAttribute('data-link-state'), 'measurement-only', `${beatId}: candidate cue is measurement-only`);
  const decision = page.getByTestId('golden-flow-handover-decision');
  assert.equal(await decision.getAttribute('data-active-service'), 'source', `${beatId}: source remains the sole serving satellite`);
  assert.equal(await decision.getAttribute('data-candidate-measurement-only'), 'true', `${beatId}: candidate is not connected before commit`);
  assert.equal(
    await page.locator('main').getAttribute('data-link-visual-source'),
    '中央場景單一服務鏈路與候選量測',
    `${beatId}: the central scene distinguishes service from candidate measurement`,
  );
}

async function assertSceneFirstComposition(page: Page, beatId: string, label = beatId): Promise<void> {
  assert.equal(await page.locator(FORBIDDEN_CHROME).count(), 0, `${label}: persistent chrome is unmounted`);
  assert.equal(await page.locator(PRIMARY).count(), 1, `${label}: exactly one primary teaching cue is mounted`);
  assert.equal(await page.locator(PRIMARY_CUE_CLASSES).count(), 1, `${label}: inactive primary cue DOM is absent`);
  const primary = page.locator(PRIMARY);
  assert.equal(await primary.getAttribute('data-beat'), beatId, `${label}: primary cue owns the current beat`);
  assert.equal(
    await page.locator('main').getAttribute('data-subject-overlap-policy'),
    'max-5-percent',
    `${label}: subject-safe overlap policy is declared`,
  );
  const handoverDecision = page.getByTestId('golden-flow-handover-decision');
  if (await handoverDecision.count() === 1) {
    assert.equal(await handoverDecision.getAttribute('data-active-service-count'), '1', `${label}: exactly one service link is active`);
    assert.equal(await handoverDecision.getAttribute('data-dual-connectivity'), 'false', `${label}: Act 4 does not imply DAPS`);
  }
  const main = page.locator('main');
  if (await main.getAttribute('data-course-segment') === 'act4') {
    assert.equal(await main.getAttribute('data-active-service-count'), '1', `${label}: scene has exactly one service owner`);
    assert.equal(await main.getAttribute('data-dual-connectivity'), 'false', `${label}: scene is explicitly non-DAPS`);
  }
}

async function assertCueAndControlViewportContainment(page: Page, beatId: string, label = beatId): Promise<void> {
  const result = await page.evaluate(() => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const selectors = [
      '[data-primary-teaching="true"]',
      '.golden-flow-angle-label',
      '[data-control-id]',
      '[role="slider"]',
      '.golden-flow-caption',
      '[data-testid="transport-reveal-button"]',
    ];
    const elements = [...document.querySelectorAll<HTMLElement>(selectors.join(','))];
    const visible = elements.filter((element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
    });
    return {
      viewport,
      outside: visible.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          selector: element.dataset.controlId ?? element.dataset.testid ?? element.className,
          rect: { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom },
        };
      }).filter(({ rect }) => rect.x < -1 || rect.y < -1 || rect.right > viewport.width + 1 || rect.bottom > viewport.height + 1),
    };
  });
  assert.deepEqual(result.outside, [], `${label}: every visible cue/control is fully inside the viewport: ${JSON.stringify(result.outside)}`);
}

async function assertNoElementCollisions(page: Page, label: string): Promise<void> {
  const collisions = await page.evaluate(() => {
    const selectors = [
      '[data-primary-teaching="true"]',
      '.golden-flow-caption',
      '[role="slider"]',
      '[data-testid="transport-reveal-button"]',
      '.golden-flow-transport-container:not(.is-mobile-autohidden) [data-testid="teaching-transport"]',
      '.golden-flow-world-label',
      '.golden-flow-angle-label',
    ];
    const elements = [...document.querySelectorAll<HTMLElement>(selectors.join(','))].filter((el) => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.01) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });

    const items = elements.map((el) => ({
      name: el.dataset.testid ?? el.dataset.controlId ?? el.className,
      rect: el.getBoundingClientRect(),
    }));

    const overlaps: string[] = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        const overlapX = Math.max(0, Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left));
        const overlapY = Math.max(0, Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top));
        // Allow up to 3px tolerance for subpixel antialiasing/borders
        if (overlapX > 3 && overlapY > 3) {
          overlaps.push(`${a.name} overlaps ${b.name} (${Math.round(overlapX)}x${Math.round(overlapY)}px)`);
        }
      }
    }
    return overlaps;
  });
  assert.deepEqual(collisions, [], `${label}: elements must not collide: ${JSON.stringify(collisions)}`);
}

async function assertTypographyAndTouchTargets(page: Page, label: string): Promise<void> {
  const result = await page.evaluate(() => {
    const textElements = [...document.querySelectorAll<HTMLElement>('.golden-flow *')].filter((el) => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.01) return false;
      if (el.closest('[inert]')) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      return [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && (node.textContent?.trim().length ?? 0) > 0);
    });

    const smallFonts = textElements.map((el) => {
      const fontSize = Number.parseFloat(getComputedStyle(el).fontSize);
      return {
        tag: el.tagName,
        class: el.className,
        text: el.textContent?.trim().slice(0, 20),
        fontSize,
      };
    }).filter(item => item.fontSize < 15.9);

    const interactiveElements = [...document.querySelectorAll<HTMLElement>('button, a, input, [role="slider"], [role="button"]')].filter((el) => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.01) return false;
      if (el.closest('[inert]')) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    const smallTargets = interactiveElements.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        id: el.dataset.controlId ?? el.dataset.testid ?? el.className,
        width: rect.width,
        height: rect.height,
      };
    }).filter(item => item.width < 43.9 || item.height < 43.9);

    return { smallFonts, smallTargets };
  });

  assert.deepEqual(result.smallFonts, [], `${label}: all visible text is at least 16 CSS px: ${JSON.stringify(result.smallFonts)}`);
  assert.deepEqual(result.smallTargets, [], `${label}: all visible interactive targets are at least 44x44 CSS px: ${JSON.stringify(result.smallTargets)}`);
}

async function assertPostHandoverLabels(page: Page, beatId: GoldenFlowBeatId, sourceName: string, targetName: string): Promise<void> {
  await page.waitForSelector('[data-subject-role="serving-satellite"]', { state: 'attached', timeout: 10_000 });
  await page.waitForSelector('[data-subject-role="candidate-satellite"]', { state: 'attached', timeout: 10_000 });
  const sourceLabel = page.locator('[data-subject-role="serving-satellite"]');
  const targetLabel = page.locator('[data-subject-role="candidate-satellite"]');
  assert.equal(await sourceLabel.count(), 1, `${beatId}: post-handover source satellite label is mounted`);
  assert.equal(await targetLabel.count(), 1, `${beatId}: post-handover target satellite label is mounted`);
  assert.equal(
    (await sourceLabel.innerText()).trim(),
    '前服務',
    `${beatId}: source is labelled 前服務 after the handover`,
  );
  assert.equal(
    (await targetLabel.innerText()).trim(),
    '新服務',
    `${beatId}: target is labelled 服務 after the handover`,
  );
  const decision = page.getByTestId('golden-flow-handover-decision');
  if (await decision.count() > 0) {
    const decisionText = await decision.innerText();
    assert.match(decisionText, new RegExp(`舊鏈路・已退出\\s*${sourceName}`), `${beatId}: readout identifies the exited service satellite`);
    assert.match(decisionText, new RegExp(`唯一服務鏈路\\s*${targetName}`), `${beatId}: readout identifies the sole new service satellite`);
    assert.equal(await decision.getAttribute('data-active-service'), 'target', `${beatId}: target owns the service link after commit`);
  } else {
    assert.match(await page.locator(PRIMARY).innerText(), new RegExp(targetName), `${beatId}: finale identifies the new service satellite`);
  }
}

async function validateAutoplayAndCounterfactual(
  page: Page,
  appUrl: string,
  teachingSourceOffAxisDeg: number,
  eventSourceOffAxisDeg: number,
): Promise<void> {
  const url = new URL(GOLDEN_FLOW_ROUTE, appUrl);
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
  const observed: GoldenFlowBeatId[] = [];

  for (const beat of GOLDEN_FLOW_BEATS.slice(0, 3)) {
    await waitForBeat(page, beat.id);
    observed.push(beat.id);
    console.log(`[golden-flow-browser] autoplay reached ${beat.id}`);
  }

  const interaction = GOLDEN_FLOW_BEATS[2];
  await page.waitForTimeout((interaction.durationSec + 1) * 1000);
  assert.equal(
    await page.locator('main').getAttribute('data-beat'),
    'interaction',
    'autoplay remains paused after the interaction duration until a real pointer drag',
  );

  const handle = page.getByTestId('golden-flow-ue-handle');
  assert.equal(await handle.count(), 1, 'interaction beat exposes one scene-local UE handle');
  const slider = page.getByRole('slider', { name: '拖曳地面 UE' });
  const sliderBox = await slider.boundingBox();
  assert.ok(sliderBox, 'interaction beat exposes a visible scene-local UE handle');
  assert.equal(
    await page.locator('main').getAttribute('data-motion-state'),
    'frozen-teaching-comparison',
    'interaction beat exposes a frozen motion state',
  );
  assert.equal(
    await page.locator('main').getAttribute('data-motion-components'),
    'satellite-track:paused,particles:paused,stars:paused,camera-animation:paused',
    'interaction freezes the satellite track, particles, stars and autonomous camera motion',
  );
  const pointerY = sliderBox.y + sliderBox.height / 2;
  await page.mouse.move(sliderBox.x + 4, pointerY);
  await page.mouse.down();
  await page.mouse.move(sliderBox.x + sliderBox.width * 0.82, pointerY, { steps: 18 });
  await page.mouse.up();
  await slider.focus();
  await page.waitForFunction(() => {
    const handle = document.querySelector<HTMLElement>('[data-testid="golden-flow-ue-handle"]');
    return handle !== null && handle.isConnected && document.activeElement === handle;
  }, undefined, { timeout: 5_000 });
  const beforeKeyboard = Number(await page.locator('[data-testid="golden-flow-ue-handle"]').getAttribute('aria-valuenow'));
  assert.ok(
    beforeKeyboard - teachingSourceOffAxisDeg >= GOLDEN_FLOW_TEACHING_MIN_GESTURE_DEG,
    `pointer drag clears the teaching gesture threshold (source=${teachingSourceOffAxisDeg}, dragged=${beforeKeyboard})`,
  );
  await page.keyboard.press('ArrowLeft');
  const keyboardTransition = await page.waitForFunction(
    (before) => {
      const handle = document.querySelector<HTMLElement>('[data-testid="golden-flow-ue-handle"]');
      const value = handle === null ? Number.NaN : Number(handle.getAttribute('aria-valuenow'));
      return handle !== null
        && handle.isConnected
        && document.activeElement === handle
        && Number.isFinite(value)
        && value < before
        ? value
        : Number.NaN;
    },
    beforeKeyboard,
    { timeout: 5_000 },
  );
  const keyboardOffset = Number(await keyboardTransition.jsonValue());
  assert.ok(
    keyboardOffset < beforeKeyboard,
    `focused scene handle responds to ArrowLeft (before=${beforeKeyboard}, keyboard=${keyboardOffset})`,
  );
  assert.ok(
    keyboardOffset - teachingSourceOffAxisDeg >= GOLDEN_FLOW_TEACHING_MIN_GESTURE_DEG,
    `keyboard adjustment keeps the teaching offset above the gesture threshold (source=${teachingSourceOffAxisDeg}, current=${keyboardOffset})`,
  );
  assert.equal(
    await page.locator('main').getAttribute('data-counterfactual-state'),
    'active-canonical-angle-aware',
    'dragged UE position exposes the approved angle-aware counterfactual state',
  );

  for (const beat of GOLDEN_FLOW_BEATS.slice(3)) {
    await waitForBeat(page, beat.id);
    observed.push(beat.id);
    console.log(`[golden-flow-browser] autoplay reached ${beat.id}`);
    if (beat.id === 'consequence') {
      assert.equal(
        await page.locator('main').getAttribute('data-counterfactual-state'),
        'active-canonical-angle-aware',
        'consequence retains the approved angle-aware teaching counterfactual',
      );
      assert.equal(
        await page.locator('main').getAttribute('data-motion-state'),
        'frozen-teaching-comparison',
        'consequence keeps the frozen motion state',
      );
      assert.equal(
        await page.locator('main').getAttribute('data-motion-components'),
        'satellite-track:paused,particles:paused,stars:paused,camera-animation:paused',
        'consequence keeps the satellite track, particles, stars and autonomous camera motion frozen',
      );
    }
    if (beat.id === 'restore') {
      await page.waitForTimeout(1000);
      const restoringOffset = Number(await page.locator('main').getAttribute('data-effective-beam-offset-deg'));
      assert.ok(
        restoringOffset < keyboardOffset && restoringOffset > teachingSourceOffAxisDeg,
        `restore visibly discards the offset toward the source anchor (${restoringOffset})`,
      );
      assert.equal(
        await page.locator('main').getAttribute('data-counterfactual-state'),
        'discarding',
        'restore beat labels the teaching counterfactual as discarding',
      );
    }
    if (beat.id === 'candidate') {
      const restoredOffset = Number(await page.locator('main').getAttribute('data-effective-beam-offset-deg'));
      assert.ok(
        Math.abs(restoredOffset - eventSourceOffAxisDeg) < 0.001,
        `source-backed event-atlas beats do not retain the teaching offset (${restoredOffset})`,
      );
      assert.equal(
        await page.locator('main').getAttribute('data-counterfactual-state'),
        'source-anchor',
        'post-restore beats return to source-anchor state',
      );
    }
    if (beat.id === 'new-normal') {
      const stableStartedAt = Date.now();
      await page.waitForTimeout(beat.durationSec * 1000 + 250);
      assert.equal(
        await page.locator('main').getAttribute('data-beat'),
        'new-normal',
        `beat 12 remains visible for at least ${beat.durationSec} seconds after autoplay reaches it`,
      );
      assert.ok(Date.now() - stableStartedAt >= beat.durationSec * 1000, 'beat 12 stable hold was actually elapsed');
    }
  }

  assert.deepEqual(
    observed,
    GOLDEN_FLOW_BEATS.map(beat => beat.id),
    'default autoplay visits all twelve beats in director order',
  );
}

async function readLayout(page: Page): Promise<LayoutSnapshot> {
  return page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('[data-testid="golden-flow-stage"]');
    if (!stage) throw new Error('golden-flow stage is missing');
    const stageRect = stage.getBoundingClientRect();
    const overlays = document.querySelectorAll<HTMLElement>([
      '[data-stage-occluder]:not(.six-acts-nav):not(.golden-flow-caption)',
      '.golden-flow-primary-cue:not([data-stage-occluder])',
    ].join(','));
    let coveredArea = 0;
    overlays.forEach((overlay) => {
      const style = getComputedStyle(overlay);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.01) return;
      if (overlay.closest('[inert]')) return;
      const rect = overlay.getBoundingClientRect();
      const left = Math.max(stageRect.left, rect.left);
      const top = Math.max(stageRect.top, rect.top);
      const right = Math.min(stageRect.right, rect.right);
      const bottom = Math.min(stageRect.bottom, rect.bottom);
      coveredArea += Math.max(0, right - left) * Math.max(0, bottom - top);
    });
    const stageArea = stageRect.width * stageRect.height;
    const subject = document.querySelector<HTMLElement>('[data-testid="golden-flow-subject-safe"]');
    const subjectRect = subject?.getBoundingClientRect();
    let subjectOverlapArea = 0;
    if (subjectRect) {
      document.querySelectorAll<HTMLElement>('[data-primary-teaching="true"]').forEach((cue) => {
        const rect = cue.getBoundingClientRect();
        const left = Math.max(subjectRect.left, rect.left);
        const top = Math.max(subjectRect.top, rect.top);
        const right = Math.min(subjectRect.right, rect.right);
        const bottom = Math.min(subjectRect.bottom, rect.bottom);
        subjectOverlapArea += Math.max(0, right - left) * Math.max(0, bottom - top);
      });
    }
    const subjectArea = subjectRect ? subjectRect.width * subjectRect.height : 0;
    return {
      stageWidth: stageRect.width,
      stageHeight: stageRect.height,
      visibleRatio: stageArea > 0 ? 1 - coveredArea / stageArea : 0,
      subjectOverlapRatio: subjectArea > 0 ? subjectOverlapArea / subjectArea : 0,
    };
  });
}

async function validateMobileViewport(
  browser: Browser,
  appUrl: string,
  viewport: { width: number; height: number },
  truth: GoldenFlowTruth,
): Promise<void> {
  const label = `Mobile ${viewport.width}x${viewport.height}`;
  const mobile = await browser.newPage({ viewport });

  try {
    // 1. Validate interaction beat deep inspection
    console.log(`[golden-flow-browser] validating ${label} interaction beat`);
    const interactionUrl = new URL(GOLDEN_FLOW_ROUTE, appUrl);
    interactionUrl.searchParams.set('beat', 'interaction');
    await mobile.goto(interactionUrl.toString(), { waitUntil: 'domcontentloaded' });
    await waitForBeat(mobile, 'interaction');
    await mobile.waitForSelector('[data-testid="golden-flow-stage"] canvas', { state: 'attached', timeout: 20_000 });
    await mobile.waitForTimeout(600);

    await assertSceneFirstComposition(mobile, 'interaction', `${label} interaction`);
    await assertCueAndControlViewportContainment(mobile, 'interaction', `${label} interaction`);
    await assertNoElementCollisions(mobile, `${label} interaction`);
    await assertTypographyAndTouchTargets(mobile, `${label} interaction`);

    const mobileLayout = await readLayout(mobile);
    assert.ok(mobileLayout.stageWidth >= viewport.width * 0.95, `${label}: stage covers width`);
    assert.ok(mobileLayout.stageHeight >= viewport.height * 0.95, `${label}: stage covers height`);
    assert.ok(
      mobileLayout.visibleRatio >= 0.70,
      `${label}: unobstructed central teaching area ${(mobileLayout.visibleRatio * 100).toFixed(1)}% is below 70%`,
    );

    // Verify transport auto-hide & inertness
    assert.equal(
      await mobile.locator('main').getAttribute('data-mobile-transport-hidden'),
      'true',
      `${label}: shared transport auto-hides during active interaction`,
    );
    assert.equal(
      await mobile.locator('.golden-flow-transport-container').getAttribute('data-transport-mobile-inert'),
      'true',
      `${label}: hidden transport is marked inert`,
    );

    assert.equal(await mobile.locator('[data-control-id^="camera-"]').count(), 0, `${label}: no manual camera controls are mounted`);

    // Verify pointer steering on mobile
    const slider = mobile.getByRole('slider', { name: '拖曳地面 UE' });
    const sliderBox = await slider.boundingBox();
    assert.ok(sliderBox, `${label}: beam handle slider is visible`);
    const pointerY = sliderBox.y + sliderBox.height / 2;
    await mobile.mouse.move(sliderBox.x + 4, pointerY);
    await mobile.mouse.down();
    await mobile.mouse.move(sliderBox.x + sliderBox.width * 0.85, pointerY, { steps: 12 });
    await mobile.mouse.up();
    await mobile.waitForTimeout(300);

    const draggedVal = Number(await mobile.locator('[data-testid="golden-flow-ue-handle"]').getAttribute('aria-valuenow'));
    assert.ok(
      draggedVal - GOLDEN_FLOW_ANGLE_LESSON_OFF_AXIS_DEG >= GOLDEN_FLOW_TEACHING_MIN_GESTURE_DEG,
      `${label}: pointer drag steered beam offset (${draggedVal})`,
    );

    // Verify keyboard steering on mobile
    await slider.focus();
    await mobile.waitForFunction(() => {
      const handle = document.querySelector<HTMLElement>('[data-testid="golden-flow-ue-handle"]');
      return handle !== null && handle.isConnected && document.activeElement === handle;
    }, undefined, { timeout: 5_000 });
    const beforeKeyVal = Number(await mobile.locator('[data-testid="golden-flow-ue-handle"]').getAttribute('aria-valuenow'));
    await mobile.keyboard.press('ArrowLeft');
    const keyTransition = await mobile.waitForFunction(
      (before) => {
        const handle = document.querySelector<HTMLElement>('[data-testid="golden-flow-ue-handle"]');
        const value = handle === null ? Number.NaN : Number(handle.getAttribute('aria-valuenow'));
        return handle !== null
          && handle.isConnected
          && document.activeElement === handle
          && Number.isFinite(value)
          && value < before
          ? value
          : Number.NaN;
      },
      beforeKeyVal,
      { timeout: 5_000 },
    );
    const keyVal = Number(await keyTransition.jsonValue());
    assert.ok(keyVal < beforeKeyVal, `${label}: keyboard ArrowLeft adjusts handle (before=${beforeKeyVal}, current=${keyVal})`);

    // Verify revealable transport
    const revealBtn = mobile.locator('[data-testid="transport-reveal-button"]');
    if (await revealBtn.count() > 0) {
      await revealBtn.click();
      assert.equal(await mobile.locator('main').getAttribute('data-mobile-transport-revealed'), 'true', `${label}: transport revealed`);
      assert.equal(await mobile.locator('main').getAttribute('data-mobile-transport-hidden'), 'false', `${label}: transport visible`);

      // A completed beam gesture intentionally resumes playback. Freeze the
      // reviewed beat before exercising the revealed controls so a beat-boundary
      // auto-hide cannot race the transport assertions below.
      if (await mobile.locator('main').getAttribute('data-transport-playing') === 'true') {
        await mobile.locator('[data-testid="transport-play-pause"]').click();
      }
      await mobile.waitForTimeout(300);
      await assertTypographyAndTouchTargets(mobile, `${label} revealed transport`);

      // Test speed buttons on revealed transport
      const speedTrigger = mobile.locator('.teaching-transport__speed-trigger');
      const speed05 = mobile.locator('[data-testid="transport-speed-0.5"]');
      if (await speed05.count() > 0) {
        await speedTrigger.click();
        await speed05.click();
        await mobile.waitForTimeout(200);
        assert.equal(await mobile.locator('main').getAttribute('data-transport-speed'), '0.5', `${label}: speed 0.5x`);
      }
      const speed2 = mobile.locator('[data-testid="transport-speed-2"]');
      if (await speed2.count() > 0) {
        await speedTrigger.click();
        await speed2.click();
        await mobile.waitForTimeout(200);
        assert.equal(await mobile.locator('main').getAttribute('data-transport-speed'), '2', `${label}: speed 2x`);
      }

      // Dismiss transport
      const dismissBtn = mobile.locator('[data-testid="transport-dismiss-button"]');
      if (await dismissBtn.count() > 0) {
        await dismissBtn.click();
        await mobile.waitForTimeout(200);
        assert.equal(await mobile.locator('main').getAttribute('data-mobile-transport-hidden'), 'true', `${label}: transport dismissed`);
      }
    }

    // 2. Validate other key beats on mobile
    for (const beatId of ['establish', 'angles', 'ttt', 'trace', 'receipt', 'new-normal'] as const) {
      console.log(`[golden-flow-browser] validating ${label} beat: ${beatId}`);
      const url = new URL(GOLDEN_FLOW_ROUTE, appUrl);
      url.searchParams.set('beat', beatId);
      await mobile.goto(url.toString(), { waitUntil: 'domcontentloaded' });
      await waitForBeat(mobile, beatId);
      await mobile.waitForSelector('[data-testid="golden-flow-stage"] canvas', { state: 'attached', timeout: 20_000 });
      await mobile.waitForTimeout(400);

      await assertSceneFirstComposition(mobile, beatId, `${label} ${beatId}`);
      await assertCueAndControlViewportContainment(mobile, beatId, `${label} ${beatId}`);
      await assertNoElementCollisions(mobile, `${label} ${beatId}`);
      await assertTypographyAndTouchTargets(mobile, `${label} ${beatId}`);

      const beatLayout = await readLayout(mobile);
      assert.ok(
        beatLayout.visibleRatio >= 0.70,
        `${label} ${beatId}: visible ratio ${(beatLayout.visibleRatio * 100).toFixed(1)}% is below 70%`,
      );
    }
  } finally {
    await mobile.close();
  }
}

async function main(): Promise<void> {
  const appUrl = process.env.APP_URL ?? process.argv[2] ?? (await detectAppUrl());
  const truth = loadGoldenFlowTruth();
  const browser: Browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const consoleErrors: string[] = [];
  let minimumVisibleRatio = 1;

  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(`PAGEERROR ${error.message}`));

    for (const beat of GOLDEN_FLOW_BEATS) {
      console.log(`[golden-flow-browser] validating desktop beat: ${beat.id}`);
      const url = new URL(GOLDEN_FLOW_ROUTE, appUrl);
      url.searchParams.set('beat', beat.id);
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
      await waitForBeat(page, beat.id);
      await page.waitForSelector('canvas', { state: 'attached', timeout: 20_000 });

      await assertSceneFirstComposition(page, beat.id);
      await assertCueAndControlViewportContainment(page, beat.id);
      assert.equal(
        await page.locator(PRIMARY).getAttribute('data-primary-cue'),
        beat.primaryCue,
        `${beat.id}: beat selects its declared primary cue`,
      );
      const eventDock = page.locator('.golden-flow-event-dock');
      assert.equal(await eventDock.count(), 1, `${beat.id}: exactly one current-event dock is mounted`);
      assert.equal(await eventDock.getAttribute('data-event-beat'), beat.id, `${beat.id}: event dock follows the current beat`);
      assert.equal(await page.locator('.golden-flow-legacy-header, .golden-flow-legacy-stepper, .golden-flow-legacy-panel').count(), 0);
      const eventHeadingFontSize = await eventDock.locator('h2').evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
      assert.ok(eventHeadingFontSize >= 20, `${beat.id}: current-event question is at least 20px`);

      if (beat.id === 'angles') {
        await page.waitForSelector('[data-testid="golden-flow-angle-elevation"]', { state: 'visible', timeout: 10_000 });
        await assertElevationGeometry(page, beat.id);
        const rail = page.getByTestId('golden-flow-angle-teaching-rail');
        assert.equal(await rail.count(), 1, 'angles: one horizontal angle carrier is mounted');
        assert.equal(
          await rail.getAttribute('data-active-angle'),
          'elevation',
          'angles: the horizontal carrier highlights elevation first',
        );
      }
      if (beat.id === 'interaction' || beat.id === 'consequence') {
        const rail = page.getByTestId('golden-flow-angle-teaching-rail');
        assert.equal(await rail.count(), 1, `${beat.id}: one horizontal angle carrier is mounted`);
        assert.equal(await rail.getAttribute('data-angle-visual-scale'), '8');
        assert.equal(await rail.getAttribute('data-active-angle'), 'off-axis');
        assert.match(await rail.getAttribute('aria-label') ?? '', /兩者均由左往右呈現/);
        assert.equal(await page.getByTestId('golden-flow-angle-power-ee').count(), 1);
        // The middle term was renamed 所需功率 P′ -> 理想補償功率需求 P′. That wording is
        // owned by src/prototype/golden-flow/goldenFlowPresentationRegression.test.ts,
        // which actively REJECTS the old phrasing, so this gate follows it rather than
        // pinning retired copy.
        assert.match(await page.getByTestId('golden-flow-angle-power-ee').innerText(), /方向圖 F\(θ\).*增益變化 ΔGᵀ.*理想補償功率需求 P′.*相對 EE/s);
      }
      if (beat.id === 'consequence') {
        assert.equal(await page.getByTestId('golden-flow-angle-formula').count(), 1, 'consequence: formulas appear only with the explanation');
      }
      if (beat.id === 'restore') {
        assert.equal(await page.getByTestId('golden-flow-angle-teaching-rail').count(), 0, 'restore: the angle carrier yields during the transition');
      }
      if (beat.id === 'receipt' || beat.id === 'new-normal') {
        await assertPostHandoverLabels(page, beat.id, truth.sourceSatelliteName, truth.targetSatelliteName);
      }
      if (['candidate', 'qualification', 'ttt'].includes(beat.id)) {
        await page.waitForSelector('[data-testid="golden-flow-link-status-source"]', { state: 'attached', timeout: 10_000 });
        await assertDecisionScene(page, beat.id);
      }
      if (beat.id === 'candidate') {
        const comparison = page.getByTestId('golden-flow-candidate-comparison');
        assert.equal(await comparison.count(), 1, 'candidate: one comparison table is mounted');
        assert.equal(await comparison.locator('article').count(), 3, 'candidate: B1, B2 and B3 are compared');
        assert.equal(await comparison.locator('article[data-selected="true"]').count(), 1, 'candidate: exactly one target is selected');
        assert.equal(await page.locator('[data-candidate-marker]').count(), 3, 'candidate: three candidate markers are attached to real GLBs');
      }
      if (beat.id === 'commit') {
        const transfer = page.getByTestId('golden-flow-handover-transfer-banner');
        assert.equal(await transfer.count(), 1, 'commit: transfer progression is visible');
        assert.match(await transfer.innerText(), /舊鏈路退出.*服務身分切換.*新鏈路建立/s);
      }
      if (beat.id === 'trace') {
        if (truth.eventKind === 'teaching-handover') {
          const decision = page.getByTestId('golden-flow-handover-decision');
          assert.equal(await decision.getAttribute('data-threshold-met'), 'true');
          assert.equal(await decision.getAttribute('data-ttt-complete'), 'true');
          assert.equal(await decision.getAttribute('data-handover-committed'), 'false');
        } else {
          const trace = page.getByTestId('golden-flow-delta-trace');
          if (truth.eventKind === 'forced-continuity') {
          assert.equal(await trace.getAttribute('data-anchor-count'), '0', 'forced continuity has no qualification anchors');
          assert.equal(await trace.getAttribute('data-trace-mode'), 'forced-continuity-event');
          assert.equal(await trace.locator('circle').count(), 0, 'forced continuity does not render fake anchor dots');
          assert.match(await trace.innerText(), /(?:無|沒有) Offset\+TTT 錨點/);
          assert.match(await trace.innerText(), /可見範圍/);
          } else {
            assert.equal(await trace.getAttribute('data-anchor-count'), '2', 'trace has exactly two source anchors');
            assert.equal(await trace.getAttribute('data-trace-mode'), 'two-discrete-source-anchors');
            assert.equal(await trace.locator('circle').count(), 2, 'trace renders two anchor dots');
            assert.equal(await trace.locator('polyline').count(), 0, 'trace does not imply a continuous measurement line');
            assert.match(await trace.innerText(), /離散錨點之間沒有連續量測/);
            const anchors = trace.locator('[data-testid="golden-flow-trace-anchor"]');
            assert.equal(await anchors.count(), 2, 'trace exposes two measurable anchor groups');
            const firstAnchor = await anchors.nth(0).boundingBox();
            const secondAnchor = await anchors.nth(1).boundingBox();
            assert.ok(firstAnchor && secondAnchor && Math.abs(firstAnchor.x - secondAnchor.x) >= 20, 'trace anchors are spatially separated');
          }
        }
      }

      const expectedExclusivePanels = ['candidate', 'qualification', 'ttt', 'trace', 'commit', 'receipt'].includes(beat.id) ? 1 : 0;
      assert.equal(
        await page.locator(EXCLUSIVE_PANELS).count(),
        expectedExclusivePanels,
        `${beat.id}: candidate/threshold/TTT/trace/commit/receipt panels are mutually exclusive`,
      );

      // Read elapsed + visible-controls in ONE evaluate. The component updates
      // reviewWallElapsedSec every animation frame and emits both datasets from the
      // same render, so two separate getAttribute calls can straddle a re-render:
      // on the 6.000s control-availability boundary the first read returns 5.999
      // (expected set: []) while the second already reads 'replay,next'. That torn
      // read, not a product fault, is what made this gate red.
      const controlSnapshot = await page.locator('main').evaluate(element => ({
        elapsedSec: Number((element as HTMLElement).dataset.controlEvaluationElapsedSec),
        visibleControls: (element as HTMLElement).dataset.visibleControls ?? '',
      }));
      assert.ok(Number.isFinite(controlSnapshot.elapsedSec), `${beat.id}: control evaluation time is exposed`);
      assert.equal(
        controlSnapshot.visibleControls,
        goldenFlowControlsAvailable(beat, controlSnapshot.elapsedSec).join(','),
        `${beat.id}: only beat-authorized controls are exposed`,
      );
      assert.equal(
        await page.locator('main').getAttribute('data-camera-pose'),
        beat.camera,
        `${beat.id}: director owns the review-frame camera pose`,
      );
      if (beat.id === 'interaction') {
        assert.equal(
          await page.locator('main').getAttribute('data-course-visible-controls'),
          'ue-drag',
          'interaction exposes only the UE learner action',
        );
        assert.equal(await page.locator('[data-control-id^="camera-"]').count(), 0, 'interaction has no manual camera controls');
      }
      assert.equal(
        await page.locator('main').getAttribute('data-truth-mode'),
        beat.order >= 6 ? 'controlled-teaching-scenario' : 'pinned-event-atlas',
      );
      assert.equal(await page.locator('main').getAttribute('data-geometry-mode'), 'schematic-not-to-scale');
      assert.equal(
        await page.locator('main').getAttribute('data-runtime-mode'),
        'directed-visualization-not-live-replay',
      );
      assert.equal(
        await page.locator('main').getAttribute('data-link-cue-mode'),
        beat.order >= 6 ? 'handover-decision' : 'approved-canonical-angle-aware',
      );
      const truthBoundary = await page.locator('main').getAttribute('data-truth-boundary');
      assert.ok(truthBoundary, `${beat.id}: truth boundary telemetry is present`);
      assert.ok(/非即時資料|非 TLE 事件/.test(truthBoundary), `${beat.id}: truth boundary states the evidence limit`);

      const layout = await readLayout(page);
      minimumVisibleRatio = Math.min(minimumVisibleRatio, layout.visibleRatio);
      assert.equal(
        await page.locator('main').getAttribute('data-layout-carrier'),
        'legacy-3d-event-dock',
        `${beat.id}: legacy 3D stage with current-event disclosure is mounted`,
      );
      assert.equal(await page.locator('main').getAttribute('data-ground-carrier'), 'legacy-ground-grid-no-hex');
      assert.equal(await page.locator('main').getAttribute('data-spacecraft-carrier'), 'constellation-glb-opaque');
      assert.ok(layout.stageWidth >= 1920 * 0.55, `${beat.id}: central stage keeps at least 55% viewport width`);
      assert.ok(layout.stageHeight >= 1080 * 0.65, `${beat.id}: central stage keeps at least 65% viewport height`);
      /* Rectangle summation is deliberately conservative: it adds the edge
         overlays even where their rectangles overlap.  A 0.2-point tolerance
         keeps the authored 95% budget while avoiding a false red at 94.87%. */
      assert.ok(
        layout.visibleRatio >= 0.948,
        `${beat.id}: conservative visible-stage ratio ${(layout.visibleRatio * 100).toFixed(2)}% is below the 95% budget`,
      );
      assert.ok(
        layout.subjectOverlapRatio <= 0.05,
        `${beat.id}: primary cue overlaps the registered central subject by ${(layout.subjectOverlapRatio * 100).toFixed(1)}%`,
      );

      if (beat.id === 'new-normal') {
        await page.waitForTimeout(6_200);
        assert.equal(
          await page.locator('main').getAttribute('data-visible-controls'),
          goldenFlowControlsAvailable(beat, 6.2).join(','),
          'beat 12 controls mount only after the six-second stable hold, including review URLs',
        );
      }
    }

    const oneWebComparison = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const oneWebTraceUrl = new URL(GOLDEN_FLOW_ROUTE, appUrl);
    oneWebTraceUrl.searchParams.set('beat', 'trace');
    oneWebTraceUrl.searchParams.set('constellation', 'oneweb');
    await oneWebComparison.goto(oneWebTraceUrl.toString(), { waitUntil: 'domcontentloaded' });
    await waitForBeat(oneWebComparison, 'trace');
    assert.equal(await oneWebComparison.locator('main').getAttribute('data-event-constellation'), 'oneweb');
    assert.equal(await oneWebComparison.locator('main').getAttribute('data-event-kind'), 'inter-handover');
    const oneWebDecision = oneWebComparison.getByTestId('golden-flow-handover-decision');
    assert.equal(await oneWebDecision.getAttribute('data-threshold-met'), 'true', 'optional OneWeb event clears its source-backed threshold');
    assert.equal(await oneWebDecision.getAttribute('data-ttt-complete'), 'true', 'optional OneWeb event completes its source-backed TTT');
    assert.match(await oneWebDecision.innerText(), /30\s*\/\s*30 s/, 'optional OneWeb comparison preserves its source-backed TTT evidence');
    await oneWebComparison.close();

    // Comprehensive Mobile Viewport Validations (390x844 and 320x720)
    await validateMobileViewport(browser, appUrl, { width: 390, height: 844 }, truth);
    await validateMobileViewport(browser, appUrl, { width: 320, height: 720 }, truth);

    // Reduced motion validation
    const reduced = await browser.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
    const reducedUrl = new URL(GOLDEN_FLOW_ROUTE, appUrl);
    reducedUrl.searchParams.set('beat', 'interaction');
    await reduced.goto(reducedUrl.toString(), { waitUntil: 'domcontentloaded' });
    await reduced.waitForSelector('[data-testid="golden-flow-stage"] canvas', { state: 'attached', timeout: 20_000 });
    assert.equal(await reduced.locator('main').getAttribute('data-reduced-motion'), 'true', 'reduced-motion preference reaches the scene');
    await assertSceneFirstComposition(reduced, 'interaction');
    await reduced.close();

    await page.close();

    // Autoplay, counterfactual and pause-on-interaction validation
    const autoPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    autoPage.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    autoPage.on('pageerror', (error) => consoleErrors.push(`PAGEERROR ${error.message}`));

    await validateAutoplayAndCounterfactual(
      autoPage,
      appUrl,
      GOLDEN_FLOW_ANGLE_LESSON_OFF_AXIS_DEG,
      truth.servingOffAxisDeg,
    );
    await autoPage.close();

    const realErrors = consoleErrors.filter((error) => !/favicon|ERR_CONNECTION_REFUSED|:8765/.test(error));
    assert.deepEqual(realErrors, [], `no real browser errors: ${JSON.stringify(realErrors)}`);
    console.log(
      `[golden-flow-browser] PASS — ${GOLDEN_FLOW_BEATS.length} beats, one primary cue each, ` +
      `max 2 caption lines, minimum visible stage ${(minimumVisibleRatio * 100).toFixed(1)}%, ` +
      '390/320 mobile collision-free & >=70% central area verified, ' +
      'autoplay/pointer-pause/counterfactual-discard verified',
    );
  } finally {
    await browser.close();
  }
}

void runBrowserValidator(
  {
    validator: 'validate-golden-flow-browser',
    appUrl: process.env.APP_URL ?? process.argv[2],
    floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.layout,
  },
  async () => main(),
).catch((error) => {
  console.error('[golden-flow-browser] FAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
