/**
 * Proves that the production live scene consumes the typed core surface plan.
 * Pure plan tests are insufficient: a disconnected plan can stay green while
 * MainScene silently returns to local JSX decisions.
 *
 * Requires a running app. APP_URL may override the default port.
 */
import assert from 'node:assert/strict';

import { CORE_BEAM_SURFACE_IDS } from '../src/scene/sceneSurfaceRegistry.ts';
import {
  MEASURED_BROWSER_GATE_FLOORS_MS,
  runBrowserValidator,
} from './lib/browser-gate.ts';

const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:3000';
const CANVAS_SELECTOR = '[data-testid="leo-main-scene"] canvas';

await runBrowserValidator({
  validator: 'scene-surface-plan',
  appUrl: APP_URL,
  floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.quickCanvas,
  readyTimeoutMs: 120_000,
}, async ({ page }) => {
  const canvas = page.locator(CANVAS_SELECTOR).first();
  await canvas.waitFor({ state: 'attached', timeout: 120_000 });
  await page.waitForFunction(selector => {
    const node = document.querySelector(selector);
    return Boolean(node?.getAttribute('data-scene-story-owner'));
  }, CANVAS_SELECTOR, { timeout: 120_000 });
  const telemetry = await canvas.evaluate(node => ({
    storyOwner: node.getAttribute('data-scene-story-owner') ?? '',
    mounted: node.getAttribute('data-scene-core-mounted-surfaces') ?? '',
    visible: node.getAttribute('data-scene-core-visible-surfaces') ?? '',
    reasons: node.getAttribute('data-scene-core-surface-reasons') ?? '',
  }));

  assert.ok(
    ['steady', 'candidate-review', 'handover', 'teaching'].includes(telemetry.storyOwner),
    `unknown story owner: ${telemetry.storyOwner}`,
  );
  const reasonEntries = telemetry.reasons.split(';').filter(Boolean);
  assert.equal(
    reasonEntries.length,
    CORE_BEAM_SURFACE_IDS.length,
    'the canvas did not publish one reason for every core surface',
  );
  for (const id of CORE_BEAM_SURFACE_IDS) {
    assert.ok(
      reasonEntries.some(entry => entry.startsWith(`${id}=`)),
      `missing surface reason: ${id}`,
    );
  }

  const registered = new Set<string>(CORE_BEAM_SURFACE_IDS);
  const publishedIds = [telemetry.mounted, telemetry.visible]
    .flatMap(value => value.split(','))
    .filter(Boolean);
  for (const id of publishedIds) {
    assert.ok(registered.has(id), `canvas published an unregistered surface: ${id}`);
  }
  // The shared browser gate rejects validators that finish below the measured
  // floor. Keep this check observable long enough to prove the browser phase ran.
  await page.waitForTimeout(MEASURED_BROWSER_GATE_FLOORS_MS.quickCanvas);

  console.log(`story-owner=${telemetry.storyOwner}`);
  console.log(`mounted=${telemetry.mounted || '<none>'}`);
  console.log(`visible=${telemetry.visible || '<none>'}`);
  console.log(`surface-reasons=${reasonEntries.length}/${CORE_BEAM_SURFACE_IDS.length}`);
  console.log('PASS: production canvas consumes the complete core scene surface plan.');
});
