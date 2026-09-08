/**
 * DOM-only port of validate-phase-c-artifact-fail-closed-browser.ts.
 *
 * The original route-mock-404 is represented by the harness fetch response;
 * every assertion remains about the rendered DOM/state contract, not layout.
 */
import assert from 'node:assert/strict';
import { mountJsdomApp } from './lib/jsdom-app-harness.tsx';

const SHELL = '.leo-app-shell';
const FAIL_CLOSED = '[data-testid="artifact-scene-fail-closed"]';
const CANVAS = 'canvas[data-camera-position]';
const ARTIFACT_PATH = '/showcase-artifacts/visual-showcase-v1.json';

async function main(): Promise<void> {
  const started = performance.now();
  const app = await mountJsdomApp('?sceneSource=artifact-replay', {
    pathname: '/simulator',
    fetchResponses: {
      [ARTIFACT_PATH]: { status: 404, body: 'not found' },
    },
  });
  try {
    await app.page.waitForSelector(FAIL_CLOSED, { timeout: 30_000 });
    assert.equal(await app.page.locator(FAIL_CLOSED).count(), 1, 'fail-closed honest div renders on artifact load failure');

    assert.equal(await app.page.getAttribute(SHELL, 'data-scene-lane'), 'artifact-replay', 'lane stays artifact-replay (no live fallback)');
    assert.equal(await app.page.getAttribute(FAIL_CLOSED, 'data-scene-lane'), 'artifact-replay', 'fail-closed div is the artifact lane surface');

    assert.equal(await app.page.locator(CANVAS).count(), 0, 'no 3D scene canvas renders while failed closed (no synthetic leak)');

    const loaded = await app.page.getAttribute('[data-testid="artifact-replay-sidebar"]', 'data-artifact-loaded');
    assert.equal(loaded, 'false', 'sidebar reports artifact NOT loaded');

    const message = (await app.page.locator(FAIL_CLOSED).innerText()).trim();
    assert.ok(message.length > 0, `fail-closed div shows an honest message (got "${message.slice(0, 80)}")`);

    const realErrors = app.errors.filter(e => !/ERR_CONNECTION_REFUSED|:8765|favicon|404|Failed to load|not found/i.test(e));
    assert.deepEqual(realErrors, [], `no unexpected console errors: ${JSON.stringify(realErrors)}`);
    const wallSeconds = (performance.now() - started) / 1000;
    console.log(`[artifact-fail-closed-dom] PASS — fail-closed div renders, lane stays artifact-replay, no canvas, message="${message.slice(0, 60)}" wall_seconds=${wallSeconds.toFixed(2)} harness=jsdom`);
  } finally {
    app.close();
  }
}

main().catch(error => {
  console.error('[artifact-fail-closed-dom] FAILED:', error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
