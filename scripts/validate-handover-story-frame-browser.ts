/**
 * Proves the production canvas consumes the normalized handover-story boundary.
 * The test enters both deterministic instructor stories and checks that their
 * provenance cannot be mistaken for accepted decision evidence.
 */
import assert from 'node:assert/strict';

import {
  MEASURED_BROWSER_GATE_FLOORS_MS,
  runBrowserValidator,
} from './lib/browser-gate.ts';

const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:3000';
const CANVAS_SELECTOR = '[data-testid="leo-main-scene"] canvas';

interface StoryTelemetry {
  readonly source: string;
  readonly available: string;
  readonly id: string;
  readonly kind: string;
  readonly phase: string;
  readonly pairKey: string;
  readonly claimClass: string;
  readonly producer: string;
  readonly decisionInputAllowed: string;
  readonly snapshotId: string;
  readonly sourceFrameId: string;
  readonly clockBasis: string;
  readonly teachingId: string;
}
async function readStoryTelemetry(
  canvas: import('@playwright/test').Locator,
): Promise<StoryTelemetry> {
  return canvas.evaluate(node => ({
    source: node.getAttribute('data-handover-story-active-source') ?? '',
    available: node.getAttribute('data-handover-story-available-sources') ?? '',
    id: node.getAttribute('data-handover-story-id') ?? '',
    kind: node.getAttribute('data-handover-story-kind') ?? '',
    phase: node.getAttribute('data-handover-story-phase') ?? '',
    pairKey: node.getAttribute('data-handover-story-pair-key') ?? '',
    claimClass: node.getAttribute('data-handover-story-claim-class') ?? '',
    producer: node.getAttribute('data-handover-story-producer') ?? '',
    decisionInputAllowed:
      node.getAttribute('data-handover-story-decision-input-allowed') ?? '',
    snapshotId: node.getAttribute('data-handover-story-snapshot-id') ?? '',
    sourceFrameId: node.getAttribute('data-handover-story-source-frame-id') ?? '',
    clockBasis: node.getAttribute('data-handover-story-clock-basis') ?? '',
    teachingId: node.getAttribute('data-handover-story-teaching-id') ?? '',
  }));
}

function assertTeachingStory(
  telemetry: StoryTelemetry,
  expectedKind: 'intra' | 'inter',
): void {
  assert.equal(telemetry.source, 'teaching');
  assert.ok(telemetry.available.split(',').includes('teaching'));
  assert.ok(telemetry.id.length > 0);
  assert.equal(telemetry.kind, expectedKind);
  assert.ok(
    ['serving', 'measuring', 'holding', 'switching', 'settled']
      .includes(telemetry.phase),
  );
  assert.ok(telemetry.pairKey.startsWith(`${expectedKind}:`));
  assert.equal(telemetry.claimClass, 'authored-teaching');
  assert.equal(telemetry.producer, 'teaching');
  assert.equal(telemetry.decisionInputAllowed, '0');
  assert.equal(telemetry.snapshotId, '');
  assert.equal(telemetry.sourceFrameId, '');
  assert.equal(telemetry.clockBasis, 'teaching-script');
  assert.equal(telemetry.teachingId, telemetry.id);
}

await runBrowserValidator({
  validator: 'handover-story-frame',
  appUrl: APP_URL,
  floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.quickCanvas,
  readyTimeoutMs: 120_000,
}, async ({ page }) => {
  const canvas = page.locator(CANVAS_SELECTOR).first();
  await canvas.waitFor({ state: 'attached', timeout: 120_000 });

  for (const kind of ['intra', 'inter'] as const) {
    await page.getByTestId(`director-${kind}-focus`).first().click({ timeout: 30_000 });
    await page.waitForFunction(({ selector, expectedKind }) => {
      const node = document.querySelector(selector);
      return node?.getAttribute('data-handover-story-active-source') === 'teaching'
        && node.getAttribute('data-handover-story-kind') === expectedKind;
    }, { selector: CANVAS_SELECTOR, expectedKind: kind }, { timeout: 30_000 });

    const telemetry = await readStoryTelemetry(canvas);
    assertTeachingStory(telemetry, kind);
    console.log(`${kind}: ${telemetry.id} ${telemetry.pairKey}`);
  }

  await page.waitForTimeout(MEASURED_BROWSER_GATE_FLOORS_MS.quickCanvas);
  console.log('PASS: live scene and instructor fixtures share the handover-story frame.');
});
