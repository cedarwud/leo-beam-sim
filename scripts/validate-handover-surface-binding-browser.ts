/**
 * R4 production gate: scene, rail and caption must publish the same complete
 * handover identity. The acceptance contract is independent of production
 * composers and also proves DOM identity mutations turn the gate red.
 */
import assert from 'node:assert/strict';
import type { Page } from '@playwright/test';

import {
  assertR4AcceptedRoot,
  assertR4SurfaceSet,
  validateR4SurfaceSet,
  type R4AcceptedRootTelemetry,
  type R4HandoverSource,
  type R4SurfaceTelemetry,
} from './lib/handover-surface-acceptance.ts';
import {
  MEASURED_BROWSER_GATE_FLOORS_MS,
  runBrowserValidator,
} from './lib/browser-gate.ts';

const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:3000';
const SCENE = '[data-testid="leo-main-scene"]';
const CANVAS = `${SCENE} canvas`;
const HOME_RAIL = '[data-testid="homepage-beam-rail"]';
const LIVE_CAPTION = '[data-testid="scene-narrative-caption"]';
const TEACHING_RAIL = '[data-testid="handover-teaching-rail"]';
const TEACHING_CAPTION = '[data-testid="handover-teaching-caption"]';

interface SurfaceCapture {
  readonly scene: R4SurfaceTelemetry;
  readonly rail: R4SurfaceTelemetry;
  readonly caption: R4SurfaceTelemetry;
  readonly root: R4AcceptedRootTelemetry | null;
  readonly geometry: string;
}

interface CaptureInput {
  readonly scene: string;
  readonly rail: string;
  readonly caption: string;
  readonly root: string | null;
  readonly mutationSelector: string | null;
}

async function captureSurfaceSet(
  page: Page,
  input: CaptureInput,
): Promise<SurfaceCapture | null> {
  return page.evaluate((selectors): SurfaceCapture | null => {
    const scene = document.querySelector<HTMLElement>(selectors.scene);
    const rail = document.querySelector<HTMLElement>(selectors.rail);
    const caption = document.querySelector<HTMLElement>(selectors.caption);
    if (scene === null || rail === null || caption === null) return null;

    const mutationTarget = selectors.mutationSelector === null
      ? null
      : document.querySelector<HTMLElement>(selectors.mutationSelector);
    const mutationAttribute = 'data-handover-surface-story-id';
    const originalMutationValue = mutationTarget?.getAttribute(mutationAttribute) ?? null;
    if (mutationTarget !== null) {
      mutationTarget.setAttribute(mutationAttribute, `${originalMutationValue ?? ''}::r4-mutation`);
    }

    const telemetry: R4SurfaceTelemetry[] = [];
    for (const element of [scene, rail, caption]) {
      telemetry.push({
        surface: element.dataset.handoverSurface ?? '',
        binding: element.dataset.handoverSurfaceBinding ?? '',
        contract: element.dataset.handoverSurfaceContract ?? '',
        activeSource: element.dataset.handoverSurfaceActiveSource ?? '',
        source: element.dataset.handoverSurfaceStorySource ?? '',
        storyId: element.dataset.handoverSurfaceStoryId ?? '',
        kind: element.dataset.handoverSurfaceStoryKind ?? '',
        pairKey: element.dataset.handoverSurfaceStoryPairKey ?? '',
        phase: element.dataset.handoverSurfaceStoryPhase ?? '',
        committed: element.dataset.handoverSurfaceStoryCommitted ?? '',
        producer: element.dataset.handoverSurfaceStoryProducer ?? '',
        claimClass: element.dataset.handoverSurfaceStoryClaimClass ?? '',
        decisionEvidence: element.dataset.handoverSurfaceStoryDecisionEvidence ?? '',
        disclosure: element.dataset.handoverSurfaceStoryDisclosure ?? '',
        decisionInputAllowed: element.dataset.handoverSurfaceStoryDecisionInputAllowed ?? '',
        snapshotId: element.dataset.handoverSurfaceStorySnapshotId ?? '',
        episodeId: element.dataset.handoverSurfaceStoryEpisodeId ?? '',
        sourceFrameId: element.dataset.handoverSurfaceStorySourceFrameId ?? '',
        clockBasis: element.dataset.handoverSurfaceStoryClockBasis ?? '',
        clockCurrentSec: element.dataset.handoverSurfaceStoryClockCurrentSec ?? '',
        clockDurationSec: element.dataset.handoverSurfaceStoryClockDurationSec ?? '',
        identity: element.dataset.handoverSurfaceStoryIdentity ?? '',
      });
    }

    const rootElement = selectors.root === null
      ? null
      : document.querySelector<HTMLElement>(selectors.root);
    const result: SurfaceCapture = {
      scene: telemetry[0]!,
      rail: telemetry[1]!,
      caption: telemetry[2]!,
      root: rootElement === null ? null : {
        snapshotId: rootElement.dataset.acceptedHandoverSnapshotId ?? '',
        episodeId: rootElement.dataset.acceptedHandoverEpisodeId ?? '',
        sourceFrameId: rootElement.dataset.acceptedHandoverSourceFrameId ?? '',
        phase: rootElement.dataset.acceptedHandoverPhase ?? '',
        simTimeSec: rootElement.dataset.acceptedHandoverSimTimeSec ?? '',
      },
      geometry: scene.dataset.handoverTeachingConeGeometry ?? '',
    };

    if (mutationTarget !== null) {
      if (originalMutationValue === null) mutationTarget.removeAttribute(mutationAttribute);
      else mutationTarget.setAttribute(mutationAttribute, originalMutationValue);
    }
    return result;
  }, input);
}

function surfacesReady(
  capture: SurfaceCapture | null,
  source: R4HandoverSource,
): boolean {
  if (capture === null) return false;
  return validateR4SurfaceSet(
    source,
    capture.scene,
    capture.rail,
    capture.caption,
  ).length === 0;
}

async function waitForSurfaceSet(
  page: Page,
  source: R4HandoverSource,
  rail: string,
  caption: string,
  root: string | null,
  timeoutMs: number,
): Promise<SurfaceCapture> {
  const deadline = Date.now() + timeoutMs;
  let lastCapture: SurfaceCapture | null = null;
  while (Date.now() < deadline) {
    lastCapture = await captureSurfaceSet(page, {
      scene: CANVAS,
      rail,
      caption,
      root,
      mutationSelector: null,
    });
    if (surfacesReady(lastCapture, source)) return lastCapture;
    await page.waitForTimeout(50);
  }
  throw new Error(
    `Timed out waiting for ${source} R4 surfaces: ${JSON.stringify(lastCapture)}`,
  );
}

async function pauseLiveTimeline(page: Page): Promise<void> {
  const toggle = page.getByTestId('timeline-toggle-play').first();
  await toggle.waitFor({ state: 'visible', timeout: 30_000 });
  if (await toggle.getAttribute('aria-label') === 'Pause timeline') {
    await toggle.click({ timeout: 30_000 });
  }
  await page.waitForFunction(() => (
    document.querySelector('[data-testid="timeline-toggle-play"]')
      ?.getAttribute('aria-label') === 'Play timeline'
  ), undefined, { timeout: 30_000 });
}

async function pauseTeachingTimeline(page: Page): Promise<void> {
  const toggle = page.getByTestId('teaching-pause').first();
  await toggle.waitFor({ state: 'visible', timeout: 30_000 });
  const label = (await toggle.textContent()) ?? '';
  if (label.includes('Pause') || label.includes('暫停')) {
    await toggle.click({ timeout: 30_000 });
  }
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-testid="teaching-pause"]')
      ?.textContent ?? '';
    return text.includes('Play') || text.includes('播放');
  }, undefined, { timeout: 30_000 });
}

async function proveBrowserMutationRedGreen(
  page: Page,
  pristine: SurfaceCapture,
): Promise<void> {
  for (const mutationSelector of [CANVAS, HOME_RAIL, LIVE_CAPTION]) {
    const mutated = await captureSurfaceSet(page, {
      scene: CANVAS,
      rail: HOME_RAIL,
      caption: LIVE_CAPTION,
      root: SCENE,
      mutationSelector,
    });
    assert.ok(mutated, `mutation capture missing for ${mutationSelector}`);
    const errors = validateR4SurfaceSet(
      'accepted',
      mutated.scene,
      mutated.rail,
      mutated.caption,
    );
    assert.ok(errors.length > 0, `${mutationSelector} mutation stayed green`);

    const restored = await captureSurfaceSet(page, {
      scene: CANVAS,
      rail: HOME_RAIL,
      caption: LIVE_CAPTION,
      root: SCENE,
      mutationSelector: null,
    });
    assert.ok(restored, `restored capture missing for ${mutationSelector}`);
    assertR4SurfaceSet('accepted', restored.scene, restored.rail, restored.caption);
    assert.ok(restored.root);
    assertR4AcceptedRoot(restored.scene, restored.root);
  }

  assertR4SurfaceSet('accepted', pristine.scene, pristine.rail, pristine.caption);
}

await runBrowserValidator({
  validator: 'handover-surface-binding',
  appUrl: APP_URL,
  floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.quickCanvas,
  readyTimeoutMs: 120_000,
}, async ({ page }) => {
  await page.locator(CANVAS).first().waitFor({ state: 'attached', timeout: 120_000 });
  await page.locator(HOME_RAIL).first().waitFor({ state: 'attached', timeout: 120_000 });

  let accepted = await waitForSurfaceSet(
    page,
    'accepted',
    HOME_RAIL,
    LIVE_CAPTION,
    SCENE,
    120_000,
  );
  assertR4SurfaceSet('accepted', accepted.scene, accepted.rail, accepted.caption);
  assert.ok(accepted.root, 'accepted root telemetry is missing');
  assertR4AcceptedRoot(accepted.scene, accepted.root);

  // Mutation attribution requires one fixed accepted publication. Pausing via
  // the production timeline control prevents a legitimate next frame from
  // racing the three DOM reads while the gate mutates them one at a time.
  await pauseLiveTimeline(page);
  accepted = await waitForSurfaceSet(
    page,
    'accepted',
    HOME_RAIL,
    LIVE_CAPTION,
    SCENE,
    30_000,
  );
  assertR4SurfaceSet('accepted', accepted.scene, accepted.rail, accepted.caption);
  assert.ok(accepted.root, 'paused accepted root telemetry is missing');
  assertR4AcceptedRoot(accepted.scene, accepted.root);
  await proveBrowserMutationRedGreen(page, accepted);

  for (const kind of ['intra', 'inter'] as const) {
    await page.getByTestId(`director-${kind}-focus`).first().click({ timeout: 30_000 });
    await pauseTeachingTimeline(page);
    const teaching = await waitForSurfaceSet(
      page,
      'teaching',
      TEACHING_RAIL,
      TEACHING_CAPTION,
      null,
      30_000,
    );
    assertR4SurfaceSet('teaching', teaching.scene, teaching.rail, teaching.caption);
    assert.equal(teaching.scene.kind, kind);
    assert.ok(teaching.geometry.length > 0, `${kind} teaching geometry missing`);
    assert.ok(
      teaching.geometry.includes(teaching.scene.storyId),
      `${kind} geometry does not carry the accepted teaching story id`,
    );
    console.log(
      `${kind}: ${teaching.scene.storyId} ${teaching.scene.pairKey}`
      + ` phase=${teaching.scene.phase} clock=${teaching.scene.clockCurrentSec}`,
    );
  }

  await page.waitForTimeout(MEASURED_BROWSER_GATE_FLOORS_MS.quickCanvas);
  console.log(
    `accepted: ${accepted.scene.storyId} ${accepted.scene.pairKey}`
    + ` episode=${accepted.scene.episodeId} frame=${accepted.scene.sourceFrameId}`,
  );
  console.log('PASS: R4 shared projection and browser mutation red→green proof.');
});
