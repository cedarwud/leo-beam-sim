import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  getFormulaFamilyLabel,
  loadProfile,
} from '../src/profiles/index.ts';
import type { Profile } from '../src/profiles/types.ts';
import type { LinkBudgetTerms, SimState } from '../src/scene/types.ts';
import { DiagnosticsDrawer } from '../src/ui/DiagnosticsDrawer.tsx';
import { InfoPanel } from '../src/ui/InfoPanel.tsx';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const RESEARCH_PROFILE_ID = 'hobs-2024-tr38811-research';
const LEGACY_PROFILE_ID = 'hobs-2024-paper-default';
const CHECKPOINT_PATH = fileURLToPath(
  new URL('../docs/visual-clarity-proposal/manual-checkpoints/vc4d-post-slice-diagnostics-drawer-1440x900.png', import.meta.url),
);

interface RenderedSurfaces {
  infoMarkup: string;
  drawerMarkup: string;
  infoText: string;
  drawerText: string;
}

interface BrowserBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function createBudgetTerms(txPowerDbm: number): LinkBudgetTerms {
  return {
    signalDbm: -91,
    intraInterferenceDbm: -120,
    interInterferenceDbm: -118,
    noiseDbm: -104,
    denominatorDbm: -103,
    txPowerDbm,
    pathLossDb: 152,
    beamGainDb: 39,
    steeringLossDb: 1,
    receiverGainDbi: 0,
  };
}

function createSimState(profile: Profile, physicalServingBudget: LinkBudgetTerms | null): SimState {
  return {
    profileId: profile.id,
    formulaFamilyLabel: getFormulaFamilyLabel(profile.formulaFamily),
    satelliteVisualIdentityById: {},
    physicalServing: {
      satId: 'sat-dpc',
      beamId: 3,
      sinrDb: 12.5,
      elevationDeg: 49.2,
      rangeKm: 910,
      status: 'live',
    },
    panelPrimary: {
      role: 'serving',
      satId: 'sat-dpc',
      beamId: 3,
      sinrDb: 12.5,
      elevationDeg: 49.2,
      rangeKm: 910,
      status: 'live',
    },
    panelComparison: {
      role: 'candidate',
      satId: 'sat-candidate',
      beamId: 5,
      sinrDb: 9.1,
      elevationDeg: 42.4,
      rangeKm: 980,
      status: 'derived',
    },
    servingSatId: 'sat-dpc',
    servingBeamId: 3,
    servingElevationDeg: 49.2,
    servingRangeKm: 910,
    pendingTargetSatId: null,
    pendingTargetBeamId: null,
    pendingTargetSinrDb: null,
    comparisonSatId: 'sat-candidate',
    comparisonBeamId: 5,
    comparisonElevationDeg: 42.4,
    comparisonRangeKm: 980,
    comparisonSinrDb: 9.1,
    comparisonKind: 'candidate',
    sinrDeltaDb: -3.4,
    recentHoSourceSatId: null,
    recentHoTargetSatId: null,
    sinrDb: 12.5,
    physicalServingBudget,
    servingBudget: physicalServingBudget,
    handoverOffsetDb: profile.handover.offsetDb,
    handoverTriggerProgressSec: 0,
    handoverTriggerSec: profile.handover.triggerTimeSec,
    hoCount: 2,
    lastHoReason: 'validation handover complete',
    beamHopEnabled: profile.beamHopping.enabled,
    beamHopSlotIndex: 8,
    beamHopSlotSec: profile.beamHopping.slotSec,
    servingBeamActiveThisSlot: true,
    servingSatActiveBeamIds: [3, 4],
    pendingTargetActiveBeamIds: [5],
  };
}

function decodeHtmlText(markup: string): string {
  return markup
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderSurfaces(
  profile: Profile,
  uiMode: 'presentation' | 'tuning' | 'diagnostics',
  physicalServingBudget: LinkBudgetTerms | null = createBudgetTerms(47.5),
): RenderedSurfaces {
  const state = createSimState(profile, physicalServingBudget);
  // The removed UI-mode mapped to: InfoPanel formula terms on tuning|diagnostics,
  // DiagnosticsDrawer expanded only on diagnostics. Preserve that mapping here.
  const showFormulaTerms = uiMode === 'tuning' || uiMode === 'diagnostics';
  const expanded = uiMode === 'diagnostics';
  const infoMarkup = renderToStaticMarkup(
    <InfoPanel {...state} showFormulaTerms={showFormulaTerms} profile={profile} />,
  );
  const drawerMarkup = renderToStaticMarkup(
    <DiagnosticsDrawer {...state} expanded={expanded} profile={profile} />,
  );
  return {
    infoMarkup,
    drawerMarkup,
    infoText: decodeHtmlText(infoMarkup),
    drawerText: decodeHtmlText(drawerMarkup),
  };
}

function assertContains(text: string, expected: string): void {
  assert.ok(text.includes(expected), `expected rendered UI to contain "${expected}"`);
}

function assertNotContains(text: string, unexpected: string): void {
  assert.ok(!text.includes(unexpected), `expected rendered UI not to contain "${unexpected}"`);
}

function assertContainsInsensitive(text: string, expected: string): void {
  assert.ok(
    text.toLowerCase().includes(expected.toLowerCase()),
    `expected rendered UI to contain "${expected}"`,
  );
}

function assertNotContainsInsensitive(text: string, unexpected: string): void {
  assert.ok(
    !text.toLowerCase().includes(unexpected.toLowerCase()),
    `expected rendered UI not to contain "${unexpected}"`,
  );
}

function assertSsr(): void {
  const researchProfile = loadProfile(RESEARCH_PROFILE_ID);
  const legacyProfile = loadProfile(LEGACY_PROFILE_ID);

  const diagnostics = renderSurfaces(researchProfile, 'diagnostics');
  assertContains(diagnostics.drawerMarkup, 'data-testid="diagnostics-drawer"');
  assertContains(diagnostics.drawerMarkup, 'data-drawer-state="expanded"');
  assertContains(diagnostics.drawerText, 'BEAM HOPPING');
  assertContains(diagnostics.drawerText, 'Physical Serving Beam Active');
  assertContains(diagnostics.drawerText, 'Handover policy (effective)');
  assertContains(diagnostics.drawerText, 'DPC: research power policy');
  assertContains(diagnostics.drawerText, '47.5 dBm physical-serving effective P_t');
  assertContains(diagnostics.drawerText, 'DEBUG / VALIDATION');
  assertContains(diagnostics.drawerText, 'HO Count');
  assertNotContains(diagnostics.infoText, 'BEAM HOPPING');
  assertNotContains(diagnostics.infoText, 'Handover policy (effective)');
  assertNotContains(diagnostics.infoText, 'DPC: research power policy');
  assertNotContains(diagnostics.infoText, 'DEBUG / VALIDATION');

  const missingBudget = renderSurfaces(researchProfile, 'diagnostics', null);
  assertContains(missingBudget.drawerText, 'missing from current LinkBudgetTerms');

  for (const mode of ['presentation', 'tuning'] as const) {
    const collapsed = renderSurfaces(researchProfile, mode);
    assertContains(collapsed.drawerMarkup, 'data-drawer-state="collapsed"');
    assertContains(collapsed.drawerText, 'Diagnostics');
    assertNotContains(collapsed.drawerText, 'DPC: research power policy');
    assertNotContains(collapsed.drawerText, 'BEAM HOPPING');
    assertNotContains(collapsed.infoText, 'BEAM HOPPING');
    assertNotContains(collapsed.infoText, 'DPC: research power policy');
  }

  const legacyDiagnostics = renderSurfaces(legacyProfile, 'diagnostics');
  assertContains(legacyDiagnostics.drawerText, 'BEAM HOPPING');
  assertNotContains(legacyDiagnostics.drawerText, 'DPC: research power policy');
}

async function measureBox(page: Page, selector: string, label: string): Promise<BrowserBox> {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `${label} box missing for ${selector}`);
  return box;
}

async function expandDiagnostics(page: Page): Promise<void> {
  await page.locator('[data-testid="diagnostics-drawer-tab"]').click();
  await page
    .locator('[data-testid="diagnostics-drawer"][data-drawer-state="expanded"]')
    .waitFor({ timeout: 5000 });
}

async function assertBrowser(): Promise<{
  appUrl: string;
  collapsedState: string | null;
  diagnosticsState: string | null;
  infoPanel: BrowserBox;
  drawer: BrowserBox;
  screenshotBytes: number;
}> {
  const appUrl = await detectAppUrl();
  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    try {
      await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
      await page.locator('.leo-shell-right .leo-info-panel').waitFor({ timeout: 30000 });
      await page.locator('[data-testid="diagnostics-drawer"]').waitFor({ timeout: 5000 });
      await page.locator('.leo-shell-canvas canvas').waitFor({ timeout: 30000 });

      const collapsedState = await page.locator('[data-testid="diagnostics-drawer"]').getAttribute('data-drawer-state');
      assert.equal(collapsedState, 'collapsed', 'the diagnostics drawer must start collapsed by default');
      assert.equal(await page.locator('[data-testid="dpc-status-block"]').count(), 0, 'DPC block must not render while the drawer is collapsed');

      await expandDiagnostics(page);
      const drawer = page.locator('[data-testid="diagnostics-drawer"]');
      const diagnosticsState = await drawer.getAttribute('data-drawer-state');
      assert.equal(diagnosticsState, 'expanded', 'diagnostics mode should expand the diagnostics drawer');
      await page.locator('[data-testid="diagnostics-drawer-beam-hopping"]').waitFor({ timeout: 5000 });
      await page.locator('[data-testid="handover-policy-readout"]').waitFor({ timeout: 5000 });
      await page.locator('[data-testid="diagnostics-drawer-debug-validation"]').waitFor({ timeout: 5000 });

      const infoText = await page.locator('.leo-shell-right .leo-info-panel').innerText();
      const drawerText = await drawer.innerText();
      assertContainsInsensitive(drawerText, 'BEAM HOPPING');
      assertContainsInsensitive(drawerText, 'Handover policy (effective)');
      assertContainsInsensitive(drawerText, 'DEBUG / VALIDATION');
      assertNotContainsInsensitive(infoText, 'BEAM HOPPING');
      assertNotContainsInsensitive(infoText, 'Handover policy (effective)');
      assertNotContainsInsensitive(infoText, 'DEBUG / VALIDATION');

      const infoPanel = await measureBox(page, '.leo-shell-right .leo-info-panel', 'diagnostics InfoPanel');
      const drawerBox = await measureBox(page, '[data-testid="diagnostics-drawer"]', 'diagnostics drawer');
      assert.ok(infoPanel.width >= 420 && infoPanel.height >= 160, `diagnostics InfoPanel collapsed: ${JSON.stringify(infoPanel)}`);
      assert.ok(drawerBox.width >= 420 && drawerBox.height >= 240, `diagnostics drawer collapsed: ${JSON.stringify(drawerBox)}`);

      await mkdir(dirname(CHECKPOINT_PATH), { recursive: true });
      const screenshot = await page.screenshot({ path: CHECKPOINT_PATH, fullPage: true });
      assert.ok(screenshot.length > 5000, `diagnostics drawer screenshot looked blank: ${screenshot.length} bytes`);

      return {
        appUrl,
        collapsedState,
        diagnosticsState,
        infoPanel,
        drawer: drawerBox,
        screenshotBytes: screenshot.length,
      };
    } finally {
      await context.close().catch(() => {});
    }
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  assertSsr();
  const browser = await assertBrowser();

  console.log('Visual Clarity Phase 4D diagnostics-drawer validation passed.');
  console.log(JSON.stringify({
    browser,
    manualScreenshotCheckpoint: CHECKPOINT_PATH,
    result: 'PASS',
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
