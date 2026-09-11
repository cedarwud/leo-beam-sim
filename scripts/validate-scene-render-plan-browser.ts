/**
 * Proves that production publishes and consumes one exhaustive SceneRenderPlan.
 * The gate checks every registered surface, then enters an authored lecture to
 * verify that owner, source, reason and render identity change together.
 */
import assert from 'node:assert/strict';

import {
  CORE_BEAM_SURFACE_IDS,
  SCENE_SURFACE_IDS,
  SCENE_SURFACE_REGISTRY,
} from '../src/scene/sceneSurfaceRegistry.ts';
import { SCENE_RENDER_PLAN_SCHEMA_VERSION } from '../src/scene/sceneRenderPlan.ts';
import {
  MEASURED_BROWSER_GATE_FLOORS_MS,
  runBrowserValidator,
} from './lib/browser-gate.ts';

const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:3000';
const CANVAS_SELECTOR = '[data-testid="leo-main-scene"] canvas';

interface PlanTelemetry {
  readonly version: string;
  readonly lane: string;
  readonly storyOwner: string;
  readonly storySource: string;
  readonly storyId: string;
  readonly storyPairKey: string;
  readonly surfaceCount: string;
  readonly mounted: string;
  readonly visible: string;
  readonly owners: string;
  readonly sources: string;
  readonly reasons: string;
  readonly identities: string;
  readonly coreMounted: string;
  readonly coreVisible: string;
  readonly teachingConeGeometry: string;
}

async function readPlanTelemetry(
  canvas: import('@playwright/test').Locator,
): Promise<PlanTelemetry> {
  return canvas.evaluate(node => ({
    version: node.getAttribute('data-scene-render-plan-version') ?? '',
    lane: node.getAttribute('data-scene-render-lane') ?? '',
    storyOwner: node.getAttribute('data-scene-render-story-owner') ?? '',
    storySource: node.getAttribute('data-scene-render-story-source') ?? '',
    storyId: node.getAttribute('data-scene-render-story-id') ?? '',
    storyPairKey: node.getAttribute('data-scene-render-story-pair-key') ?? '',
    surfaceCount: node.getAttribute('data-scene-render-surface-count') ?? '',
    mounted: node.getAttribute('data-scene-render-mounted-surfaces') ?? '',
    visible: node.getAttribute('data-scene-render-visible-surfaces') ?? '',
    owners: node.getAttribute('data-scene-render-surface-owners') ?? '',
    sources: node.getAttribute('data-scene-render-surface-sources') ?? '',
    reasons: node.getAttribute('data-scene-render-surface-reasons') ?? '',
    identities: node.getAttribute('data-scene-render-surface-identities') ?? '',
    coreMounted: node.getAttribute('data-scene-core-mounted-surfaces') ?? '',
    coreVisible: node.getAttribute('data-scene-core-visible-surfaces') ?? '',
    teachingConeGeometry: node.getAttribute('data-handover-teaching-cone-geometry') ?? '',
  }));
}

function parseEntries(label: string, raw: string): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  for (const entry of raw.split(';').filter(Boolean)) {
    const separator = entry.indexOf('=');
    assert.ok(separator > 0, `${label} entry has no key: ${entry}`);
    const key = entry.slice(0, separator);
    const value = entry.slice(separator + 1);
    assert.ok(value.length > 0, `${label} entry is empty: ${key}`);
    assert.equal(result.has(key), false, `${label} repeats ${key}`);
    result.set(key, value);
  }
  assert.equal(result.size, SCENE_SURFACE_IDS.length, `${label} is incomplete`);
  for (const id of SCENE_SURFACE_IDS) {
    assert.ok(result.has(id), `${label} is missing ${id}`);
  }
  return result;
}

function parseIdSet(label: string, raw: string): ReadonlySet<string> {
  const values = raw.split(',').filter(Boolean);
  assert.equal(new Set(values).size, values.length, `${label} contains duplicates`);
  const result = new Set(values);
  for (const id of result) {
    assert.ok(
      (SCENE_SURFACE_IDS as readonly string[]).includes(id),
      `${label} contains unregistered surface ${id}`,
    );
  }
  return result;
}

function assertExhaustivePlan(telemetry: PlanTelemetry): void {
  assert.equal(telemetry.version, String(SCENE_RENDER_PLAN_SCHEMA_VERSION));
  assert.ok(['live', 'archived-tle', 'artifact-replay'].includes(telemetry.lane));
  assert.equal(Number(telemetry.surfaceCount), SCENE_SURFACE_IDS.length);

  const owners = parseEntries('owners', telemetry.owners);
  const sources = parseEntries('sources', telemetry.sources);
  const reasons = parseEntries('reasons', telemetry.reasons);
  const identities = parseEntries('identities', telemetry.identities);
  const mounted = parseIdSet('mounted surfaces', telemetry.mounted);
  const visible = parseIdSet('visible surfaces', telemetry.visible);

  for (const id of SCENE_SURFACE_IDS) {
    assert.ok(
      ['shell', 'stage', 'steady', 'candidate-review', 'handover', 'teaching', 'replay']
        .includes(owners.get(id) ?? ''),
      `invalid owner for ${id}: ${owners.get(id)}`,
    );
    if (telemetry.lane !== 'artifact-replay') {
      assert.equal(sources.get(id), SCENE_SURFACE_REGISTRY[id].sourceClass);
    }
    assert.ok((reasons.get(id) ?? '').length > 0);
    assert.ok(
      identities.get(id)?.startsWith(`${telemetry.lane}:${id}:`),
      `render identity does not bind lane and surface: ${id}`,
    );
  }
  for (const id of visible) assert.ok(mounted.has(id), `visible surface is not mounted: ${id}`);
  assert.ok(mounted.has('scene.layout'));
  assert.equal(reasons.get('motion.handover-links'), 'retired-duplicate-grammar');
}

await runBrowserValidator({
  validator: 'scene-render-plan',
  appUrl: APP_URL,
  floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.quickCanvas,
  readyTimeoutMs: 120_000,
}, async ({ page }) => {
  const canvas = page.locator(CANVAS_SELECTOR).first();
  await canvas.waitFor({ state: 'attached', timeout: 120_000 });
  await page.waitForFunction(({ selector, count }) => {
    const node = document.querySelector(selector);
    return node?.getAttribute('data-scene-render-surface-count') === String(count);
  }, { selector: CANVAS_SELECTOR, count: SCENE_SURFACE_IDS.length }, { timeout: 120_000 });

  const steady = await readPlanTelemetry(canvas);
  assertExhaustivePlan(steady);
  const fullMounted = parseIdSet("full mounted surfaces", steady.mounted);
  const fullVisible = parseIdSet("full visible surfaces", steady.visible);
  const coreMounted = parseIdSet("core mounted surfaces", steady.coreMounted);
  const coreVisible = parseIdSet("core visible surfaces", steady.coreVisible);
  for (const id of CORE_BEAM_SURFACE_IDS) {
    assert.equal(fullMounted.has(id), coreMounted.has(id), `core/full mount drift: ${id}`);
    assert.equal(fullVisible.has(id), coreVisible.has(id), `core/full visibility drift: ${id}`);
  }


  await page.getByTestId('director-intra-focus').first().click({ timeout: 30_000 });
  await page.waitForFunction(selector => {
    const node = document.querySelector(selector);
    return node?.getAttribute('data-scene-render-story-owner') === 'teaching'
      && node.getAttribute('data-scene-render-story-source') === 'teaching'
      && Boolean(node.getAttribute('data-scene-render-story-id'));
  }, CANVAS_SELECTOR, { timeout: 30_000 });
  await page.waitForFunction(selector => {
    const node = document.querySelector(selector);
    return Boolean(node?.getAttribute("data-handover-teaching-cone-geometry"));
  }, CANVAS_SELECTOR, { timeout: 30_000 });


  const teaching = await readPlanTelemetry(canvas);
  assertExhaustivePlan(teaching);
  assert.equal(teaching.storyOwner, 'teaching');
  assert.equal(teaching.storySource, 'teaching');
  assert.ok(teaching.storyPairKey.startsWith('intra:'));
  const teachingOwners = parseEntries('teaching owners', teaching.owners);
  const teachingSources = parseEntries('teaching sources', teaching.sources);
  const teachingReasons = parseEntries('teaching reasons', teaching.reasons);
  const teachingIdentities = parseEntries('teaching identities', teaching.identities);
  const teachingMounted = parseIdSet('teaching mounted surfaces', teaching.mounted);
  assert.ok(teaching.teachingConeGeometry.length > 0, "teaching plan mounted but drew no cone");
  assert.equal(teachingOwners.get('teaching.handover-cones'), 'teaching');
  assert.equal(teachingSources.get('teaching.handover-cones'), 'teaching-fixture');
  assert.equal(teachingReasons.get('teaching.handover-cones'), 'visible');
  assert.ok(teachingMounted.has('teaching.handover-cones'));
  assert.equal(teachingMounted.has('handover.pulse-cones'), false);
  assert.ok(
    teachingIdentities.get('teaching.handover-cones')?.includes(teaching.storyId),
    'teaching render identity lost its story id',
  );

  await page.waitForTimeout(MEASURED_BROWSER_GATE_FLOORS_MS.quickCanvas);
  console.log(`lane=${steady.lane}`);
  console.log(`surfaces=${steady.surfaceCount}/${SCENE_SURFACE_IDS.length}`);
  console.log(`steady-owner=${steady.storyOwner} teaching-story=${teaching.storyId}`);
  console.log('PASS: production canvas publishes one exhaustive full scene render plan.');
});
