#!/usr/bin/env node
// G3 Step 4 browser smoke (scratch). Drives the real app at APP_URL, loads the
// Family-B dense-Q proof, and asserts DecisionViz renders proof-ready Q1/Q2/Q3 +
// the honest (non-degenerate) Family-B banner. Screenshots before/after.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const OUT_DIR = join('output', 'g3-family-b-dense-q');
const SHELL = '.leo-app-shell';

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(SHELL, { timeout: 30_000 });

    // MODQN live-cell lane exposes the 'MODQN evidence' right tab (DecisionViz).
    await page.click('[data-testid="lane-experience-modqn-live-cell-preview"]');
    await page.waitForSelector(`${SHELL}[data-scene-lane="modqn-live-cell-preview"]`, { timeout: 30_000 });
    await page.click('#right-sidebar-tab-modqn');
    await page.waitForSelector('[data-testid="modqn-family-b-mode-selector"]', { timeout: 30_000 });
    await page.waitForSelector('[data-testid="load-family-b-dense-q"]', { timeout: 30_000 });

    const beforeStatus = await page
      .locator('[data-testid="decision-viz-dense-q-proof"]')
      .getAttribute('data-dense-q-proof-status')
      .catch(() => null);
    const beforeBanner = await page
      .locator('[data-testid="degenerate-data-banner"]')
      .getAttribute('data-modqn-banner-mode')
      .catch(() => null);
    await page.screenshot({ path: join(OUT_DIR, 'before-load.png'), fullPage: true });

    // Load the Family-B dense-Q proof window.
    await page.click('[data-testid="load-family-b-dense-q"]');

    // DecisionViz must flip to proof-ready (fetch + parse 1000 rows can take time).
    await page.waitForSelector(
      '[data-testid="decision-viz-dense-q-proof"][data-dense-q-proof-status="proof-ready"]',
      { timeout: 90_000 },
    );

    const proofText = (await page.locator('[data-testid="decision-viz-dense-q-proof"]').innerText()).replace(/\s+/g, ' ');
    for (const token of ['Q1', 'Q2', 'Q3']) {
      if (!proofText.includes(token)) fail(`DecisionViz proof readout missing ${token}: "${proofText}"`);
    }

    const selectedActionIndex = await page
      .locator('[data-testid="decision-viz-dense-q-proof"]')
      .getAttribute('data-selected-action-index');
    const selfCheck = await page
      .locator('[data-testid="decision-viz-dense-q-proof"]')
      .getAttribute('data-self-check-status');
    if (selfCheck !== 'passed') fail(`DecisionViz proof self-check is "${selfCheck}", expected "passed"`);

    const bannerMode = await page
      .locator('[data-testid="degenerate-data-banner"]')
      .getAttribute('data-modqn-banner-mode');
    if (bannerMode !== 'family-b-dense-q') {
      fail(`banner mode is "${bannerMode}", expected "family-b-dense-q" (honest non-degenerate disclosure)`);
    }
    const bannerText = await page.locator('[data-testid="degenerate-data-banner"]').innerText();
    if (/degenerate/i.test(bannerText)) fail(`Family-B banner must NOT call the run degenerate: "${bannerText}"`);

    await page.screenshot({ path: join(OUT_DIR, 'after-load.png'), fullPage: true });

    // Revert restores the baseline degenerate-banner mode (non-vacuous control).
    await page.click('[data-testid="revert-to-baseline-from-family-b"]');
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="degenerate-data-banner"]');
      return el?.getAttribute('data-modqn-banner-mode') === 'degenerate-baseline';
    }, { timeout: 30_000 });
    await page.screenshot({ path: join(OUT_DIR, 'after-revert.png'), fullPage: true });

    console.log(JSON.stringify({
      result: 'PASS',
      beforeStatus,
      beforeBanner,
      afterStatus: 'proof-ready',
      selectedActionIndex,
      selfCheck,
      bannerMode,
      proofReadout: proofText.slice(0, 200),
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
