/**
 * Phase 1a browser smoke: the artifact-replay decision metric tiles render in a
 * real browser under the artifact-replay lane.
 *
 * C5 update: the full-area Dashboard view + ViewModeToggle were removed; the app
 * always shows the 3D scene. The MODQN pipeline flowchart (which lived in the
 * Dashboard view) is deferred to the future data-flow diagram project, so this
 * gate no longer checks the dock/flowchart. The per-frame decision metric tiles
 * (C4) stay in the artifact-replay sidebar (`data-content="metrics"`); this gate
 * checks they render with INV-1 provenance chips and fail closed on gaps.
 *
 * It route-fulfills `/showcase-artifacts/visual-showcase-v1.json` with the
 * repo-local synthetic validator fixture, so it does not depend on the pinned
 * producer artifact (which may be absent in a given checkout) or on the vite
 * dev-server fixture fallback.
 *
 * Requires a running dev server (e.g. `npm run dev`); pass APP_URL or argv[2]
 * to override auto-detection. Run: `npm run validate:phase-d:dashboard:browser`.
 */
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from '@playwright/test';
import { detectAppUrl } from './_vc2-browser-fixture.ts';
import { loadValidatorVisualShowcaseArtifact } from './visualShowcaseValidatorFixture.ts';

const ARTIFACT_ROUTE = '**/showcase-artifacts/visual-showcase-v1.json';
const DASHBOARD = '[data-testid="algorithm-dashboard"]';

interface SceneMetricsResult {
  readonly metricsContent: string | null;
  readonly metricsLoaded: string | null;
  readonly provenanceChips: number;
  readonly flowchartNodesInSidebar: number;
  readonly dockCount: number;
}

async function checkSceneMetrics(page: Page, appUrl: string): Promise<SceneMetricsResult> {
  const target = new URL(appUrl);
  target.searchParams.set('sceneSource', 'artifact-replay');
  await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });

  // The decision metric tiles live in the artifact-replay sidebar (scene view).
  const metrics = page.locator(`${DASHBOARD}[data-content="metrics"]`);
  await metrics.waitFor({ state: 'visible', timeout: 20000 });
  const metricsContent = await metrics.getAttribute('data-content');
  const metricsLoaded = await metrics.getAttribute('data-artifact-loaded');
  const provenanceChips = await metrics.locator('[data-testid="algorithm-dashboard-provenance-chip"]').count();
  const flowchartNodesInSidebar = await metrics.locator('[data-testid="algorithm-flowchart-node"]').count();
  // The Dashboard view/dock was removed (C5): it must not mount anywhere.
  const dockCount = await page.locator('[data-testid="algorithm-dock"]').count();

  return { metricsContent, metricsLoaded, provenanceChips, flowchartNodesInSidebar, dockCount };
}

async function main(): Promise<void> {
  const appUrl = await detectAppUrl();
  const browser: Browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const consoleErrors: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', error => consoleErrors.push(`PAGEERROR ${error.message}`));

    const { artifact } = loadValidatorVisualShowcaseArtifact();
    await page.route(ARTIFACT_ROUTE, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(artifact) }));

    const scene = await checkSceneMetrics(page, appUrl);

    assert.equal(scene.metricsContent, 'metrics', 'scene view mounts the metrics dashboard in the sidebar');
    assert.equal(scene.metricsLoaded, 'true', 'sidebar metrics report artifact loaded');
    assert.ok(scene.provenanceChips >= 7, `every metric tile shows an INV-1 provenance chip (got ${scene.provenanceChips})`);
    assert.equal(scene.flowchartNodesInSidebar, 0, 'the flowchart does not render in the sidebar metrics (C4 split)');
    assert.equal(scene.dockCount, 0, 'the AlgorithmDock / Dashboard view is removed (C5)');

    assert.deepEqual(consoleErrors, [], 'no console/page errors in artifact-replay mode');

    console.log(JSON.stringify({ appUrl, scene, result: 'PASS' }, null, 2));
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
