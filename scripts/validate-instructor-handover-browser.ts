/**
 * R5 production gate for the deterministic seven-beam instructor scenario.
 * It exercises the real controls and compares root, scene, rail, and caption
 * telemetry with an acceptance contract independent of production composers.
 */
import assert from 'node:assert/strict';
import type { Page } from '@playwright/test';

import {
  assertR5InstructorSurfaceSet,
  validateR5InstructorSurfaceSet,
  validateR5ReplayEquivalence,
  type R5InstructorRootTelemetry,
  type R5InstructorTelemetry,
} from './lib/instructor-handover-acceptance.ts';
import {
  MEASURED_BROWSER_GATE_FLOORS_MS,
  runBrowserValidator,
} from './lib/browser-gate.ts';

const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:3000';
const ROOT = '.leo-app-shell';
const SCENE = '[data-testid="leo-main-scene"]';
const CANVAS = `${SCENE} canvas`;
const RAIL = '[data-testid="handover-teaching-rail"]';
const CAPTION = '[data-testid="handover-teaching-caption"]';
interface R5BrowserCapture {
  readonly root: R5InstructorRootTelemetry;
  readonly scene: R5InstructorTelemetry;
  readonly rail: R5InstructorTelemetry;
  readonly caption: R5InstructorTelemetry;
  readonly geometry: string;
  readonly timelineDisabled: string;
  readonly manualRequestId: string;
}

interface MutationInput {
  readonly selector: string;
  readonly attribute: string;
  readonly suffix: string;
}

async function capture(
  page: Page,
  mutation: MutationInput | null = null,
): Promise<R5BrowserCapture | null> {
  return page.evaluate(({ rootSelector, canvasSelector, railSelector, captionSelector, mutationInput }) => {
    const root = document.querySelector<HTMLElement>(rootSelector);
    const scene = document.querySelector<HTMLElement>(canvasSelector);
    const rail = document.querySelector<HTMLElement>(railSelector);
    const caption = document.querySelector<HTMLElement>(captionSelector);
    if (root === null || scene === null || rail === null || caption === null) return null;
    const mutationTarget = mutationInput === null
      ? null
      : document.querySelector<HTMLElement>(mutationInput.selector);
    const originalMutationValue = mutationTarget === null || mutationInput === null
      ? null
      : mutationTarget.getAttribute(mutationInput.attribute);
    if (mutationTarget !== null && mutationInput !== null) {
      mutationTarget.setAttribute(
        mutationInput.attribute,
        `${originalMutationValue ?? ''}${mutationInput.suffix}`,
      );
    }
    const telemetry: R5InstructorTelemetry[] = [];
    for (const element of [root, scene, rail, caption]) {
      const dataset = element.dataset;
      telemetry.push({
        surface: dataset.instructorSurface ?? '',
        binding: dataset.instructorScenarioBinding ?? '',
        scenarioId: dataset.instructorScenarioId ?? '',
        scenarioVersion: dataset.instructorScenarioVersion ?? '',
        beamCount: dataset.instructorBeamCount ?? '',
        runId: dataset.instructorRunId ?? '',
        entryKind: dataset.instructorEntryKind ?? '',
        segmentIndex: dataset.instructorSegmentIndex ?? '',
        segmentKind: dataset.instructorSegmentKind ?? '',
        status: dataset.instructorTransportStatus ?? '',
        paused: dataset.instructorPaused ?? '',
        speed: dataset.instructorSpeed ?? '',
        sourceTimeSec: dataset.instructorSourceTimeSec ?? '',
        segmentTimeSec: dataset.instructorSegmentTimeSec ?? '',
        durationSec: dataset.instructorDurationSec ?? '',
        windowStartSec: dataset.instructorWindowStartSec ?? '',
        windowEndSec: dataset.instructorWindowEndSec ?? '',
        complete: dataset.instructorComplete ?? '',
        storyId: dataset.instructorStoryId ?? '',
        pairKey: dataset.instructorStoryPairKey ?? '',
        phase: dataset.instructorStoryPhase ?? '',
        committed: dataset.instructorStoryCommitted ?? '',
      });
    }
    const rootTelemetry: R5InstructorRootTelemetry = {
      ...telemetry[0]!,
      runtimeBeamCount: root.dataset.instructorRuntimeBeamCount ?? '',
      runtimeCandidateBeamCount:
        root.dataset.instructorRuntimeCandidateBeamCount ?? '',
      sevenBeamAdmitted: root.dataset.instructorSevenBeamAdmitted ?? '',
    };
    const result: R5BrowserCapture = {
      root: rootTelemetry,
      scene: telemetry[1]!,
      rail: telemetry[2]!,
      caption: telemetry[3]!,
      geometry: scene.dataset.handoverTeachingConeGeometry ?? '',
      timelineDisabled: root.dataset.timelineDisabled ?? '',
      manualRequestId: root.dataset.manualHandoverRequestId ?? '',
    };
    if (mutationTarget !== null && mutationInput !== null) {
      if (originalMutationValue === null) {
        mutationTarget.removeAttribute(mutationInput.attribute);
      } else {
        mutationTarget.setAttribute(mutationInput.attribute, originalMutationValue);
      }
    }
    return result;
  }, {
    rootSelector: ROOT,
    canvasSelector: CANVAS,
    railSelector: RAIL,
    captionSelector: CAPTION,
    mutationInput: mutation,
  });
}

async function waitForValid(
  page: Page,
  timeoutMs: number = 30_000,
): Promise<R5BrowserCapture> {
  const deadline = Date.now() + timeoutMs;
  let lastCapture: R5BrowserCapture | null = null;
  let lastErrors: readonly string[] = [];
  while (Date.now() < deadline) {
    lastCapture = await capture(page);
    if (lastCapture !== null) {
      lastErrors = validateR5InstructorSurfaceSet(
        lastCapture.root,
        lastCapture.scene,
        lastCapture.rail,
        lastCapture.caption,
      );
      if (lastErrors.length === 0) return lastCapture;
    }
    await page.waitForTimeout(40);
  }
  throw new Error(
    `Timed out waiting for R5 instructor surfaces: ${JSON.stringify({
      lastCapture,
      lastErrors,
    })}`,
  );
}

async function pauseInstructor(page: Page): Promise<void> {
  const toggle = page.getByTestId('teaching-pause').first();
  await toggle.waitFor({ state: 'visible', timeout: 30_000 });
  const text = (await toggle.textContent()) ?? '';
  if (text.includes('Pause') || text.includes('暫停')) {
    await toggle.click({ timeout: 30_000 });
  }
  await page.waitForFunction(() => {
    const value = document.querySelector('[data-testid="teaching-pause"]')
      ?.textContent ?? '';
    return value.includes('Play') || value.includes('播放');
  }, undefined, { timeout: 30_000 });
}
async function playInstructor(page: Page): Promise<void> {
  const toggle = page.getByTestId('teaching-pause').first();
  await toggle.waitFor({ state: 'visible', timeout: 30_000 });
  const text = (await toggle.textContent()) ?? '';
  if (text.includes('Play') || text.includes('播放')) {
    await toggle.click({ timeout: 30_000 });
  }
  await page.waitForFunction(() => {
    const value = document.querySelector('[data-testid="teaching-pause"]')
      ?.textContent ?? '';
    return value.includes('Pause') || value.includes('暫停');
  }, undefined, { timeout: 30_000 });
}

async function seekInstructor(page: Page, sourceTimeSec: number): Promise<R5BrowserCapture> {
  const slider = page.getByTestId('teaching-seek').first();
  await slider.evaluate((element, value) => {
    const input = element as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, sourceTimeSec);
  const captured = await waitForValid(page);
  assert.ok(
    Math.abs(Number(captured.root.sourceTimeSec) - sourceTimeSec) <= 0.001,
    `seek landed at ${captured.root.sourceTimeSec}, expected ${sourceTimeSec}`,
  );
  return captured;
}

async function setInstructorSpeed(
  page: Page,
  speed: 1 | 2 | 5 | 10 | 20,
): Promise<R5BrowserCapture> {
  await page.getByTestId(`teaching-speed-${speed}x`).first().click({ timeout: 30_000 });
  const captured = await waitForValid(page);
  assert.equal(captured.root.speed, String(speed));
  return captured;
}

function assertStableInstructorOwnership(captureValue: R5BrowserCapture): void {
  assert.equal(captureValue.root.runtimeBeamCount, '7');
  assert.equal(captureValue.root.runtimeCandidateBeamCount, '7');
  assert.equal(captureValue.root.sevenBeamAdmitted, 'true');
  assert.equal(captureValue.timelineDisabled, 'true');
  assert.equal(
    captureValue.manualRequestId,
    '',
    'R5 must not arm the legacy manual wall-clock presentation',
  );
}

async function provePauseFreeze(
  page: Page,
  pristine: R5BrowserCapture,
): Promise<void> {
  await page.waitForTimeout(650);
  const frozen = await waitForValid(page);
  assert.deepEqual(
    validateR5ReplayEquivalence(pristine.root, frozen.root),
    [],
    'paused source time or story changed',
  );
  assert.equal(frozen.root.status, 'paused');
  assert.equal(frozen.root.paused, 'true');
}

async function proveMutationRedGreen(
  page: Page,
  pristine: R5BrowserCapture,
): Promise<void> {
  for (const selector of [CANVAS, RAIL, CAPTION]) {
    const mutated = await capture(page, {
      selector,
      attribute: 'data-instructor-story-id',
      suffix: '::r5-mutation',
    });
    assert.ok(mutated, `missing mutation capture for ${selector}`);
    assert.ok(
      validateR5InstructorSurfaceSet(
        mutated.root,
        mutated.scene,
        mutated.rail,
        mutated.caption,
      ).length > 0,
      `${selector} story mutation stayed green`,
    );
    const restored = await waitForValid(page);
    assertR5InstructorSurfaceSet(
      restored.root,
      restored.scene,
      restored.rail,
      restored.caption,
    );
  }

  const rootMutation = await capture(page, {
    selector: ROOT,
    attribute: 'data-instructor-source-time-sec',
    suffix: '::r5-mutation',
  });
  assert.ok(rootMutation, 'missing root mutation capture');
  assert.ok(
    validateR5InstructorSurfaceSet(
      rootMutation.root,
      rootMutation.scene,
      rootMutation.rail,
      rootMutation.caption,
    ).length > 0,
    'root source-time mutation stayed green',
  );
  const restored = await waitForValid(page);
  assert.deepEqual(validateR5ReplayEquivalence(pristine.root, restored.root), []);
}

async function assertSwitchingGeometry(
  captureValue: R5BrowserCapture,
): Promise<void> {
  assert.equal(captureValue.root.phase, 'switching');
  assert.ok(captureValue.geometry.length > 0, 'teaching cone geometry is missing');
  assert.ok(
    captureValue.geometry.includes(captureValue.root.storyId),
    'teaching geometry does not carry the shared story identity',
  );
}
await runBrowserValidator({
  validator: 'instructor-handover',
  appUrl: APP_URL,
  floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.quickCanvas,
  readyTimeoutMs: 120_000,
}, async ({ page }) => {
  await page.locator(CANVAS).first().waitFor({ state: 'attached', timeout: 120_000 });
  await page.getByTestId('director-intra-focus').first().waitFor({
    state: 'visible',
    timeout: 120_000,
  });
  const priorLiveState = await page.evaluate(() => ({
    selectedSpeed: document.querySelector<HTMLElement>('.leo-app-shell')
      ?.dataset.selectedSpeed ?? '',
    toggleLabel: document.querySelector<HTMLElement>('[data-testid="timeline-toggle-play"]')
      ?.getAttribute('aria-label') ?? '',
  }));

  await page.getByTestId('director-intra-focus').first().click({ timeout: 30_000 });
  await page.locator(RAIL).first().waitFor({ state: 'visible', timeout: 30_000 });
  await pauseInstructor(page);
  let current = await waitForValid(page);
  assert.equal(current.root.entryKind, 'intra');
  assert.equal(current.root.segmentKind, 'intra');
  assertStableInstructorOwnership(current);
  await provePauseFreeze(page, current);

  const speedBaseline = await seekInstructor(page, 52);
  await assertSwitchingGeometry(speedBaseline);
  for (const speed of [1, 2, 5, 10, 20] as const) {
    const speedCapture = await setInstructorSpeed(page, speed);
    assert.deepEqual(
      validateR5ReplayEquivalence(speedBaseline.root, speedCapture.root),
      [],
      `${speed}x changed the story at fixed source time`,
    );
  }
  const checkpoints = [
    0, 12, 28, 46, 52, 58, 71.9,
    72, 84, 100, 118, 124, 130, 144,
  ] as const;
  for (const sourceTimeSec of checkpoints) {
    current = await seekInstructor(page, sourceTimeSec);
    assertStableInstructorOwnership(current);
    if (sourceTimeSec === 52 || sourceTimeSec === 124) {
      await assertSwitchingGeometry(current);
    }
  }

  const firstRunId = speedBaseline.root.runId;
  await page.getByTestId('teaching-restart').first().click({ timeout: 30_000 });
  await pauseInstructor(page);
  const replayAt52 = await seekInstructor(page, 52);
  assert.notEqual(replayAt52.root.runId, firstRunId);
  assert.deepEqual(
    validateR5ReplayEquivalence(speedBaseline.root, replayAt52.root),
    [],
    'restart did not reconstruct the same source-time story',
  );
  await proveMutationRedGreen(page, replayAt52);
  await seekInstructor(page, 71.8);
  await setInstructorSpeed(page, 1);
  await playInstructor(page);
  await page.waitForFunction(() => {
    const root = document.querySelector<HTMLElement>('.leo-app-shell');
    return root?.dataset.instructorSegmentKind === 'inter'
      && Number(root.dataset.instructorSourceTimeSec ?? '0') >= 72;
  }, undefined, { timeout: 30_000 });
  await pauseInstructor(page);
  const crossedBoundary = await waitForValid(page);
  assert.equal(crossedBoundary.root.entryKind, 'intra');
  assert.equal(crossedBoundary.root.segmentKind, 'inter');
  assert.ok(Number(crossedBoundary.root.sourceTimeSec) < 84);
  assert.equal(crossedBoundary.root.phase, 'serving');
  assertStableInstructorOwnership(crossedBoundary);
  await page.getByTestId('teaching-close').first().click({ timeout: 30_000 });
  await page.locator(RAIL).first().waitFor({ state: 'detached', timeout: 30_000 });

  await page.getByTestId('director-inter-focus').first().click({ timeout: 30_000 });
  await page.locator(RAIL).first().waitFor({ state: 'visible', timeout: 30_000 });
  await pauseInstructor(page);
  const directInter = await waitForValid(page);
  assert.equal(directInter.root.entryKind, 'inter');
  assert.equal(directInter.root.segmentKind, 'inter');
  assert.equal(directInter.root.windowStartSec, '72');
  assert.equal(directInter.root.windowEndSec, '144');
  assert.equal(directInter.root.durationSec, '72');
  assertStableInstructorOwnership(directInter);

  const directInterSwitch = await seekInstructor(page, 124);
  await assertSwitchingGeometry(directInterSwitch);
  const directInterRunId = directInterSwitch.root.runId;
  await page.getByTestId('teaching-restart').first().click({ timeout: 30_000 });
  await pauseInstructor(page);
  const directInterRestart = await seekInstructor(page, 72);
  assert.notEqual(directInterRestart.root.runId, directInterRunId);
  assert.equal(directInterRestart.root.entryKind, 'inter');
  assert.equal(directInterRestart.root.segmentKind, 'inter');
  assert.equal(directInterRestart.root.phase, 'serving');
  await page.getByTestId('teaching-close').first().click({ timeout: 30_000 });
  await page.locator(RAIL).first().waitFor({ state: 'detached', timeout: 30_000 });
  const restoredLiveState = await page.evaluate(() => ({
    selectedSpeed: document.querySelector<HTMLElement>('.leo-app-shell')
      ?.dataset.selectedSpeed ?? '',
    toggleLabel: document.querySelector<HTMLElement>('[data-testid="timeline-toggle-play"]')
      ?.getAttribute('aria-label') ?? '',
  }));
  assert.deepEqual(restoredLiveState, priorLiveState);
  await page.waitForTimeout(MEASURED_BROWSER_GATE_FLOORS_MS.quickCanvas);

  console.log(
    `intra-run=${replayAt52.root.runId} boundary=${crossedBoundary.root.sourceTimeSec}`,
  );
  console.log(
    `direct-inter-run=${directInterRestart.root.runId}`
      + ` window=${directInterRestart.root.windowStartSec}`
      + `..${directInterRestart.root.windowEndSec}`,
  );
  console.log('PASS: R5 deterministic instructor Intra -> Inter vertical slices.');
});
