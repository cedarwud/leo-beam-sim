// VC4B tuning-rail gate. The homepage now mounts the canonical archived-TLE
// source/parameter rail inline in the left shell. Keep this browser check focused
// on that active structure and the durable shell/pointer invariants; retired
// tab-shell, collapsed-handle, and handover-policy selectors are not part of the
// homepage contract.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import { bootDeterministicPage } from './_v3-deterministic-fixture.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const CHECKPOINT_PATH = fileURLToPath(
  new URL('../docs/visual-clarity-proposal/manual-checkpoints/vc4b-post-slice-tuning-drawer-1440x900.png', import.meta.url),
);

interface BrowserBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function measureBox(page: Page, selector: string, label: string): Promise<BrowserBox> {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `${label} box missing for ${selector}`);
  return box;
}

async function screenshotCanvasHash(page: Page): Promise<string> {
  const screenshot = await page.locator('.leo-shell-canvas canvas').screenshot();
  assert.ok(screenshot.length > 5000, `canvas screenshot looked blank: ${screenshot.length} bytes`);
  return hashBuffer(screenshot);
}

async function dragInsideBox(page: Page, box: BrowserBox, deltaX: number, deltaY: number): Promise<void> {
  const startX = box.x + box.width * 0.5;
  const startY = box.y + box.height * 0.5;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(80);
}

async function readCanvasPointerDownCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scope = window as typeof window & {
      __vc4bCanvasPointerDowns?: number;
      __vc4bCanvasPointerProbeInstalled?: boolean;
    };
    const canvas = document.querySelector('.leo-shell-canvas canvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('canvas missing for pointer probe');
    if (!scope.__vc4bCanvasPointerProbeInstalled) {
      scope.__vc4bCanvasPointerDowns = 0;
      canvas.addEventListener('pointerdown', () => {
        scope.__vc4bCanvasPointerDowns = (scope.__vc4bCanvasPointerDowns ?? 0) + 1;
      }, { capture: true });
      scope.__vc4bCanvasPointerProbeInstalled = true;
    }
    return scope.__vc4bCanvasPointerDowns ?? 0;
  });
}

async function assertClickDoesNotHitCanvas(page: Page, box: BrowserBox, label: string): Promise<void> {
  const before = await readCanvasPointerDownCount(page);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForTimeout(80);
  const after = await readCanvasPointerDownCount(page);
  assert.equal(before, after, `${label} click reached the canvas pointer handler; left-panel events may be leaking into OrbitControls`);
}

async function main(): Promise<void> {
  const appUrl = await detectAppUrl();
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: {
      cookies: [],
      origins: [{
        origin: new URL(appUrl).origin,
        localStorage: [{ name: 'leo-beam-sim.app-mode.v1', value: 'modqn-demo' }],
      }],
    },
  });

  try {
    const page = await bootDeterministicPage({ chromium }, {
      context,
      url: appUrl,
      seed: 4601,
      rafMs: 1800,
      viewport: { width: 1440, height: 900 },
      waitForSelector: '.leo-shell-row',
    });

    try {
      await page.locator('.leo-shell-canvas canvas').waitFor({ timeout: 30_000 });
      await page.locator('.leo-shell-left').waitFor({ timeout: 30_000 });
      assert.equal(
        await page.locator('[data-testid="leo-shell-canvas"]').getAttribute('data-scene-lane'),
        'sinr-live',
        'the root homepage must resolve to the SINR workspace even when stale MODQN state was persisted',
      );
      assert.equal(
        await page.locator('[data-testid="sinr-live-quick-controls"]').count(),
        1,
        'the restored homepage main scene must retain its beam/handover quick controls',
      );
      assert.equal(
        await page.locator('[data-testid="timeline-bar"]').count(),
        1,
        'the restored homepage main scene must retain its live timeline',
      );
      await page.locator('[data-testid="sinr-live-display"]').waitFor({ timeout: 30_000 });
      await page.locator('[data-testid="homepage-canonical-controls"]').waitFor({ timeout: 30_000 });
      await page.locator('[data-testid="homepage-tle-scenario-disclosure"]').waitFor({ timeout: 10_000 });
      await page.locator('[data-testid="signal-tuning-main-tabs"]').waitFor({ timeout: 10_000 });
      await page.locator('[data-testid="homepage-sinr-parameters"]').waitFor({ timeout: 10_000 });
      await page.locator('[data-testid="sinr-tab-g0-control"]').waitFor({ timeout: 10_000 });
      await page.locator('.leo-shell-right').waitFor({ timeout: 10_000 });
      await page.locator('[data-testid="homepage-results-overview"]').waitFor({ timeout: 30_000 });
      try {
        await page.locator('[data-testid="homepage-results-overview"][data-frame-status="ready"]').waitFor({ timeout: 90_000 });
      } catch (error) {
        console.error('Homepage canonical readiness diagnostics', JSON.stringify({
          frameStatus: await page.locator('[data-testid="homepage-results-overview"]').getAttribute('data-frame-status'),
          resultStatus: await page.locator('[data-testid="homepage-right-rail-frame-status"]').textContent(),
          sourceSummary: await page.locator('[data-testid="homepage-tle-scenario-disclosure"]').textContent(),
        }, null, 2));
        throw error;
      }
      await page.locator('[data-testid="info-panel-duel-card"]').waitFor({ timeout: 10_000 });
      await page.locator('[data-testid="formula-verification-card"]').waitFor({ timeout: 10_000 });
      await page.locator('[data-testid="homepage-sinr-results"]').waitFor({ state: 'visible', timeout: 10_000 });

      const sceneProbe = page.locator('[data-testid="render-isolation-probe"]');
      const rightRail = page.locator('[data-testid="homepage-right-rail"]');
      const initialAnalysisFrameId = await rightRail.getAttribute('data-analysis-frame-id');
      const initialTleFrameId = await rightRail.getAttribute('data-tle-frame-id');
      const initialSatelliteId = await rightRail.getAttribute('data-selected-satellite-id');
      assert.ok(initialAnalysisFrameId, 'the accepted right-rail analysis frame id is missing');
      assert.ok(initialTleFrameId, 'the accepted right-rail TLE frame id is missing');
      assert.ok(initialSatelliteId, 'the accepted right-rail satellite id is missing');
      assert.equal(
        await sceneProbe.getAttribute('data-scene-source'),
        'archived-tle',
        'the homepage centre must retain the established campus renderer while consuming the accepted archived-TLE frame',
      );
      assert.equal(
        await sceneProbe.getAttribute('data-uav-visible'),
        '1',
        'the restored SINR main scene must retain its established UAV layer',
      );
      assert.equal(
        await page.locator('[data-testid="canonical-tle-scene-legend"]').count(),
        0,
        'the Earth-orbit scene legend belongs to /simulator, not the homepage centre',
      );
      const canonicalComparison = page.locator('[data-testid="homepage-canonical-serving-comparison"]');
      assert.equal(
        await canonicalComparison.getAttribute('data-analysis-frame-id'),
        initialAnalysisFrameId,
        'the serving/candidate card must consume the accepted analysis frame',
      );
      assert.equal(
        await canonicalComparison.getAttribute('data-serving-satellite-id'),
        initialSatelliteId,
        'the serving column must identify the satellite selected by the accepted frame',
      );
      assert.ok(
        await canonicalComparison.getAttribute('data-candidate-satellite-id'),
        'the same-frame candidate satellite is missing',
      );
      assert.ok(
        await canonicalComparison.getAttribute('data-serving-sinr-db'),
        'the serving column is not publishing canonical SINR',
      );
      assert.ok(
        await canonicalComparison.getAttribute('data-candidate-sinr-db'),
        'the candidate column is not publishing its same-frame counterfactual SINR',
      );
      assert.equal(
        await page.locator('[data-testid="formula-verification-card"]').getAttribute('data-formula-authority'),
        'canonical-tle-analysis-frame',
        'the formula-term card must not expose the legacy computeLinkBudget authority',
      );
      assert.equal(
        await page.locator('[data-testid="info-panel-duel-trigger-progress"]').getAttribute('data-handover-decision'),
        'not-in-frame',
        'TLE snapshot comparison must not fabricate a handover decision state',
      );
      await page.locator('[data-testid="canonical-link-power-comparison"]').waitFor({ timeout: 5000 });
      for (const testId of [
        'canonical-serving-requested-power',
        'canonical-candidate-requested-power',
        'canonical-serving-actual-power',
        'canonical-candidate-actual-power',
        'canonical-serving-rate',
        'canonical-candidate-rate',
      ]) {
        assert.notEqual(
          (await page.locator(`[data-testid="${testId}"]`).innerText()).trim(),
          '—',
          `${testId} must expose its same-frame canonical value`,
        );
      }
      assert.doesNotMatch(
        await page.locator('.leo-shell-row').innerText(),
        /\b[A-Za-zγσ]+_[A-Za-z0-9]/,
        'visible formula symbols must use typographic subscripts instead of raw underscores',
      );

      // (1) The active homepage rail owns the source selector, canonical tabs,
      // and genuine editable canonical inputs. Retired policy controls stay absent.
      assert.equal(
        await page.locator('.leo-shell-left .leo-sidebar-tab-shell').count(),
        0,
        'the homepage must not remount the retired left sidebar tab shell',
      );
      assert.equal(
        await page.locator('[data-testid="signal-tuning-drawer-handle"]').count(),
        0,
        'the retired collapsed tuning handle must not appear in the homepage rail',
      );
      assert.equal(
        await page.locator('[data-testid="handover-policy-controls"]').count(),
        0,
        'legacy handover-policy controls must not appear in the canonical homepage rail',
      );
      assert.equal(
        await page.locator('[data-testid="signal-tuning-main-tabs"] [role="tab"]').count(),
        4,
        'the canonical homepage rail must expose exactly four analysis tabs',
      );
      assert.deepEqual(
        await page.locator('[data-testid="signal-tuning-main-tabs"] [role="tab"] span').allTextContents(),
        ['SINR', 'EE', 'Power', 'Throughput'],
        'the canonical homepage tab order must remain SINR / EE / Power / Throughput',
      );
      assert.equal(
        await page.locator('#signal-tuning-main-tab-sinr').getAttribute('aria-selected'),
        'true',
        'SINR must be the default canonical homepage tab',
      );
      assert.equal(
        await page.locator('[data-testid="homepage-tle-scenario-toggle"]').getAttribute('aria-expanded'),
        'false',
        'TLE source details must default collapsed so the analysis controls stay in the first viewport',
      );
      assert.equal(
        await page.locator('[data-testid="homepage-canonical-source-controls"]').count(),
        0,
        'the full TLE selector must not permanently consume the analysis rail',
      );
      assert.equal(
        await page.locator('[data-testid="homepage-model-parameter-reset-button"]').isDisabled(),
        true,
        'the model reset must start disabled while all controls are at adapter defaults',
      );
      await page.locator('[data-testid="homepage-tle-scenario-toggle"]').click();
      await page.locator('[data-testid="homepage-canonical-source-controls"]').waitFor({ timeout: 5000 });
      assert.ok(
        await page.locator('[data-testid="homepage-constellation-control"]').getAttribute('data-source-provenance'),
        'the constellation selector must state its source/provenance',
      );
      assert.ok(
        await page.locator('[data-testid="homepage-tle-time-control"]').getAttribute('data-reset-value'),
        'the TLE time selector must state its reset value',
      );
      await page.locator('#homepage-constellation-oneweb').check({ force: true });
      await page.locator('[data-testid="homepage-canonical-source-controls"][data-accepted-constellation="oneweb"]').waitFor({ timeout: 90_000 });
      await page.locator('[data-testid="homepage-results-overview"][data-frame-status="ready"]').waitFor({ timeout: 90_000 });
      await page.waitForFunction(
        previousId => {
          const right = document.querySelector('[data-testid="homepage-right-rail"]');
          const nextId = right?.getAttribute('data-analysis-frame-id');
          return Boolean(nextId)
            && nextId !== previousId;
        },
        initialAnalysisFrameId,
        { timeout: 90_000 },
      );
      await page.locator('#homepage-constellation-starlink').check({ force: true });
      await page.locator('[data-testid="homepage-canonical-source-controls"][data-accepted-constellation="starlink"]').waitFor({ timeout: 90_000 });
      await page.locator('[data-testid="homepage-results-overview"][data-frame-status="ready"]').waitFor({ timeout: 90_000 });
      await page.locator('[data-testid="homepage-tle-scenario-toggle"]').click();
      assert.equal(
        await page.locator('[data-testid="homepage-canonical-source-controls"]').count(),
        0,
        'collapsing the TLE disclosure must restore the compact analysis rail',
      );
      assert.equal(
        await page.locator('.leo-app-shell').getAttribute('data-app-mode'),
        'sinr-experiment',
        'a stale persisted MODQN mode must not replace the canonical homepage',
      );
      assert.equal(
        await page.locator('[data-testid="modqn-view-toggle"]').count(),
        0,
        'the homepage must not expose the retired Live / Proof navigation',
      );
      assert.equal(
        await page.locator('.leo-shell-right .leo-sidebar-tab-shell').count(),
        0,
        'the homepage result rail must not expose Live status / MODQN evidence tabs',
      );
      assert.equal(
        await page.locator('[data-testid="homepage-results-overview"]').count(),
        1,
        'the right rail must keep one persistent canonical result overview',
      );
      for (const testId of [
        'homepage-overview-ee',
        'homepage-overview-sinr',
        'homepage-overview-throughput',
        'homepage-overview-system-power',
        'homepage-overview-actual-power',
        'homepage-overview-qos',
      ]) {
        assert.equal(
          await page.locator(`[data-testid="${testId}"]`).count(),
          1,
          `${testId} must remain visible regardless of the active left tab`,
        );
      }
      assert.equal(
        await page.locator('[data-testid="homepage-serving-comparison"] [data-testid="info-panel-duel-card"]').count(),
        1,
        'the serving/candidate comparison must remain in the homepage right rail',
      );
      assert.equal(
        await page.locator('[data-testid="homepage-result-details"]').getAttribute('open'),
        '',
        'the full active-tab calculated fields must remain visible below the overview',
      );
      assert.equal(
        await page.locator('[data-testid="formula-verification-card"]').isVisible(),
        true,
        'the original SINR formula-term breakdown must remain visible below the serving/candidate duel',
      );
      assert.equal(
        await page.locator('[data-testid="sinr-tab-g0-control"] input[type="range"]').count(),
        1,
        'the default SINR page must lead with an editable canonical input instead of read-only derived values',
      );

      // (2) Layout sanity: the left slot, canvas, and right panel keep usable widths.
      const canvasSlot = await measureBox(page, '.leo-shell-canvas', 'canvas slot');
      const leftSlot = await measureBox(page, '.leo-shell-left', 'left slot');
      const rightPanel = await measureBox(page, '.leo-shell-right', 'right result rail');
      assert.ok(canvasSlot.width >= 280, `canvas slot width collapsed: ${canvasSlot.width}`);
      assert.ok(canvasSlot.height >= 300, `canvas slot height collapsed: ${canvasSlot.height}`);
      assert.ok(leftSlot.width >= 280, `left slot width collapsed: ${leftSlot.width}`);
      assert.ok(rightPanel.width >= 320, `right panel width regressed: ${rightPanel.width}`);

      // (3) Durable invariant: clicking the left panel must not leak into the canvas.
      const leftPanel = await measureBox(page, '[data-testid="homepage-canonical-controls"]', 'canonical tuning rail');
      await assertClickDoesNotHitCanvas(page, leftPanel, 'canonical tuning rail');

      // (4) Durable invariant: the canvas still rotates on drag.
      const dragBefore = await screenshotCanvasHash(page);
      await dragInsideBox(page, canvasSlot, 180, 48);
      const dragAfter = await screenshotCanvasHash(page);
      assert.notEqual(dragBefore, dragAfter, 'dragging inside the canvas did not change the frame; OrbitControls may not be receiving pointer events');

      // (5) Switching the canonical rail to editable-input tabs keeps the same
      // source/parameter surface and exposes the expected page structures.
      await page.locator('#signal-tuning-main-tab-power').click();
      await page.locator('[data-testid="power-canonical-page"]').waitFor({ timeout: 5000 });
      await page.locator('[data-testid="homepage-power-results"]').waitFor({ state: 'visible', timeout: 5000 });
      for (const testId of ['power-result-requested', 'power-result-actual', 'power-result-pa', 'power-result-rfc', 'power-result-baseband', 'power-result-event', 'power-result-system']) {
        assert.equal(await page.locator(`[data-testid="${testId}"]`).isVisible(), true, `${testId} must remain visible on the right`);
      }
      const backoffControl = page.locator('[data-testid="power-tab-backoff-control"]');
      await backoffControl.waitFor({ timeout: 5000 });
      assert.ok(await backoffControl.getAttribute('data-source-provenance'), 'backoff source/provenance is missing');
      assert.ok(await backoffControl.getAttribute('data-reset-value'), 'backoff reset value is missing');
      const rfcControl = page.locator('[data-testid="power-tab-rfc-control"]');
      await rfcControl.waitFor({ timeout: 5000 });
      const overviewEe = page.locator('[data-testid="homepage-overview-ee"]');
      const eeBeforeRfcChange = await overviewEe.textContent();
      await rfcControl.locator('input[type="range"]').fill('1');
      await page.waitForFunction(
        ({ selector, before }) => document.querySelector(selector)?.textContent !== before,
        { selector: '[data-testid="homepage-overview-ee"]', before: eeBeforeRfcChange },
        { timeout: 5000 },
      );
      const eeAfterRfcChange = await overviewEe.textContent();
      assert.notEqual(
        eeAfterRfcChange,
        eeBeforeRfcChange,
        'changing a left-side power parameter must immediately update the persistent EE result',
      );
      assert.equal(
        await page.locator('[data-testid="homepage-model-parameter-reset-button"]').isEnabled(),
        true,
        'editing a canonical parameter must enable the shared reset action',
      );
      await page.locator('[data-testid="homepage-model-parameter-reset-button"]').click();
      assert.equal(
        await rfcControl.locator('input[type="range"]').inputValue(),
        '0.338',
        'the shared reset action must restore the homepage adapter RF-chain-power default',
      );
      await page.locator('#signal-tuning-main-tab-throughput').click();
      await page.locator('[data-testid="throughput-canonical-page"]').waitFor({ timeout: 5000 });
      await page.locator('[data-testid="throughput-tab-served-users-control"]').waitFor({ timeout: 5000 });
      await page.locator('[data-testid="homepage-throughput-results"]').waitFor({ state: 'visible', timeout: 5000 });
      for (const testId of ['throughput-result-gamma', 'throughput-result-requested-power', 'throughput-result-actual-power', 'throughput-result-sinr', 'throughput-result-rate', 'throughput-result-total-rate', 'throughput-result-qos']) {
        assert.equal(await page.locator(`[data-testid="${testId}"]`).isVisible(), true, `${testId} must remain visible on the right`);
      }
      await page.locator('#signal-tuning-main-tab-energy').click();
      await page.locator('[data-testid="homepage-ee-parameters"]').waitFor({ timeout: 5000 });
      await page.locator('[data-testid="homepage-ee-results"]').waitFor({ state: 'visible', timeout: 5000 });
      for (const testId of ['ee-result-throughput', 'ee-result-system-power', 'ee-result-instantaneous', 'ee-result-delivered-bits', 'ee-result-consumed-energy', 'ee-result-evaluation', 'ee-result-sample-count']) {
        assert.equal(await page.locator(`[data-testid="${testId}"]`).isVisible(), true, `${testId} must remain visible on the right`);
      }
      await page.locator('#signal-tuning-main-tab-sinr').click();
      await page.locator('[data-testid="homepage-sinr-parameters"]').waitFor({ timeout: 5000 });
      for (const testId of ['sinr-result-requested-power', 'sinr-result-actual-power', 'sinr-result-signal', 'sinr-result-interference', 'sinr-result-noise', 'sinr-result-value']) {
        assert.equal(await page.locator(`[data-testid="${testId}"]`).isVisible(), true, `${testId} must remain visible on the right`);
      }
      await page.locator('#canonical-sinr-section-tab-beam').click();
      await page.locator('[data-testid="sinr-tab-g0-control"]').waitFor({ timeout: 5000 });
      await page.locator('[data-testid="sinr-tab-theta3db-control"]').waitFor({ timeout: 5000 });
      await page.locator('#canonical-sinr-section-tab-power').click();
      await page.locator('[data-testid="sinr-tab-beam-cap-control"]').waitFor({ timeout: 5000 });
      await page.locator('[data-testid="sinr-tab-satellite-cap-control"]').waitFor({ timeout: 5000 });
      await page.locator('#canonical-sinr-section-tab-receiver').click();
      await page.locator('[data-testid="sinr-tab-receiver-gain-control"]').waitFor({ timeout: 5000 });
      await page.locator('#canonical-sinr-section-tab-interference').click();
      await page.locator('[data-testid="sinr-tab-lagged-interference-control"]').waitFor({ timeout: 5000 });
      await page.locator('#canonical-sinr-section-tab-noise').click();
      await page.locator('[data-testid="sinr-tab-noise-control"]').waitFor({ timeout: 5000 });
      await page.locator('[data-testid="homepage-results-overview"]').waitFor({ timeout: 30_000 });

      await mkdir(dirname(CHECKPOINT_PATH), { recursive: true });
      await page.screenshot({ path: CHECKPOINT_PATH, fullPage: true });

      console.log('Visual Clarity Phase 4B canonical tuning-rail validation passed.');
      console.log(JSON.stringify({
        appUrl,
        canvasSlot,
        leftSlot,
        rightPanel,
        manualScreenshotCheckpoint: CHECKPOINT_PATH,
        result: 'PASS',
      }, null, 2));
    } finally {
      await page.context().close().catch(() => {});
    }
  } finally {
    await browser.close();
  }
}

await main();
