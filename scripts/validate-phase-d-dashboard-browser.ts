/**
 * Phase 1a browser smoke: the offline algorithm dashboard + MODQN flowchart
 * (S1-S4) actually render and animate in a real browser under the
 * artifact-replay lane.
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

interface DashboardSmokeResult {
  readonly dockVisible: boolean;
  readonly dockMode: string | null;
  readonly dashboardInsideDock: number;
  readonly dashboardLoaded: string | null;
  readonly nodes: number;
  readonly edges: number;
  readonly provenanceChips: number;
  readonly pulseDriver: string | null;
  readonly animatableEdges: number;
  readonly idleEdges: number;
  readonly pulseObserved: boolean;
  readonly collapsedAfterToggle: string | null;
  readonly dashboardCountWhileCollapsed: number;
  readonly collapsedAfterRestore: string | null;
  readonly consoleErrors: readonly string[];
}

async function runDashboardSmoke(browser: Browser, appUrl: string): Promise<DashboardSmokeResult> {
  const page: Page = await browser.newPage();
  const consoleErrors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => consoleErrors.push(`PAGEERROR ${error.message}`));

  const { artifact } = loadValidatorVisualShowcaseArtifact();
  await page.route(ARTIFACT_ROUTE, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(artifact) }));

  try {
    const target = new URL(appUrl);
    target.searchParams.set('sceneSource', 'artifact-replay');
    await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
    const dock = page.locator('[data-testid="algorithm-dock"]');
    await dock.waitFor({ state: 'visible', timeout: 20000 });
    const dashboard = dock.locator('[data-testid="algorithm-dashboard"]');
    await dashboard.waitFor({ state: 'visible', timeout: 20000 });

    const dockVisible = await dock.isVisible();
    const dockMode = await dock.getAttribute('data-mode');
    const dashboardInsideDock = await dashboard.count();
    const dashboardLoaded = await dashboard.getAttribute('data-artifact-loaded');
    const nodes = await dock.locator('[data-testid="algorithm-flowchart-node"]').count();
    const edges = await dock.locator('[data-testid="algorithm-flowchart-edge"]').count();
    const provenanceChips = await dock.locator('[data-testid="algorithm-dashboard-provenance-chip"]').count();
    const pulseDriver = await dock.locator('[data-testid="algorithm-flowchart"]').getAttribute('data-pulse-driver');
    const animatableEdges = await dock
      .locator('[data-testid="algorithm-flowchart-edge"][data-animatable="true"]').count();
    const idleEdges = await dock
      .locator('[data-testid="algorithm-flowchart-edge"][data-animatable="false"]').count();

    let pulseObserved = false;
    for (let attempt = 0; attempt < 24 && !pulseObserved; attempt += 1) {
      pulseObserved = await dock.locator('.leo-algorithm-flowchart__edge--active').count() > 0;
      if (!pulseObserved) await page.waitForTimeout(250);
    }

    const toggle = dock.locator('[data-testid="algorithm-dock-toggle"]');
    await toggle.click();
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="algorithm-dock"]')?.getAttribute('data-collapsed') === 'true');
    const collapsedAfterToggle = await dock.getAttribute('data-collapsed');
    const dashboardCountWhileCollapsed = await dock.locator('[data-testid="algorithm-dashboard"]').count();
    await toggle.click();
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="algorithm-dock"]')?.getAttribute('data-collapsed') === 'false');
    const collapsedAfterRestore = await dock.getAttribute('data-collapsed');
    await dashboard.waitFor({ state: 'visible', timeout: 10000 });

    return {
      dockVisible,
      dockMode,
      dashboardInsideDock,
      dashboardLoaded,
      nodes,
      edges,
      provenanceChips,
      pulseDriver,
      animatableEdges,
      idleEdges,
      pulseObserved,
      collapsedAfterToggle,
      dashboardCountWhileCollapsed,
      collapsedAfterRestore,
      consoleErrors,
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  const appUrl = await detectAppUrl();
  const browser = await chromium.launch();
  try {
    const result = await runDashboardSmoke(browser, appUrl);

    assert.equal(result.dockVisible, true, 'algorithm dock is visible');
    assert.equal(result.dockMode, 'artifact', 'artifact replay renders the dock artifact mode path');
    assert.equal(result.dashboardInsideDock, 1, 'dashboard renders inside the algorithm dock');
    assert.equal(result.dashboardLoaded, 'true', 'dashboard reports artifact loaded');
    assert.equal(result.nodes, 8, 'flowchart renders all 8 MODQN pipeline nodes');
    assert.equal(result.edges, 8, 'flowchart renders all 8 edges');
    assert.ok(result.provenanceChips >= 8, 'every dashboard tile shows an INV-1 provenance chip');
    assert.equal(result.pulseDriver, 'raf', 'flowchart pulses are rAF-driven (G4)');
    assert.ok(result.animatableEdges >= 1, 'at least one producer-backed edge is animatable');
    assert.ok(result.idleEdges >= 1, 'the unbound reward->qnet edge stays idle (G1)');
    assert.ok(result.pulseObserved, 'an edge actually pulses during replay');
    assert.equal(result.collapsedAfterToggle, 'true', 'dock toggle collapses the dock');
    assert.equal(result.dashboardCountWhileCollapsed, 0, 'dashboard body is hidden while dock is collapsed');
    assert.equal(result.collapsedAfterRestore, 'false', 'dock toggle expands the dock again');
    assert.deepEqual(result.consoleErrors, [], 'no console/page errors in artifact-replay mode');

    console.log(JSON.stringify({ appUrl, ...result, result: 'PASS' }, null, 2));
  } finally {
    await browser.close().catch(() => undefined);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
