import assert from 'node:assert/strict';

import {
  MEASURED_BROWSER_GATE_FLOORS_MS,
  runBrowserValidator,
} from './lib/browser-gate';

const TIMEOUT_MS = 30_000;
const RETIRED_PATH = '/prototype/intra-handover-teaching';

void runBrowserValidator({
  validator: 'R7 retired Intra route compatibility',
  floorMs: MEASURED_BROWSER_GATE_FLOORS_MS.multiCanvas,
}, async ({ appUrl, page }) => {
  const origin = new URL(appUrl).origin;
  await page.goto(
    `${origin}${RETIRED_PATH}?controls=1#checkpoint`,
    { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS },
  );
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root?.dataset.leoAppReady === 'true';
  }, undefined, { timeout: TIMEOUT_MS });

  const url = new URL(page.url());
  assert.equal(url.pathname, '/');
  assert.equal(url.searchParams.get('controls'), '1');
  assert.equal(url.searchParams.get('retiredSurface'), 'intra-handover-teaching');
  assert.equal(url.hash, '#checkpoint');

  await page.locator('.leo-app-shell').waitFor({ state: 'visible', timeout: TIMEOUT_MS });
  await page.getByTestId('student-guided-flow-launch').waitFor({
    state: 'visible',
    timeout: TIMEOUT_MS,
  });
  for (const testId of [
    'intra-handover-teaching',
    'intra-handover-teaching-stage',
    'intra-handover-scene-visual',
  ]) {
    assert.equal(await page.getByTestId(testId).count(), 0, `${testId} must be retired`);
  }

  await page.waitForTimeout(MEASURED_BROWSER_GATE_FLOORS_MS.multiCanvas);
  console.log('R7 retired route redirects to the canonical R5/R6 homepage shell.');
  console.log(`R7 compatibility URL=${url.pathname}${url.search}${url.hash}`);
});
