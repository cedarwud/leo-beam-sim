import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { satelliteTint, satelliteTintIndex } from '../src/constants/beamRoleTokens.ts';
import { getFormulaFamilyLabel, loadProfile } from '../src/profiles/index.ts';
import type { Profile } from '../src/profiles/types.ts';
import type { LinkBudgetTerms, SatelliteVisualIdentity, SimState } from '../src/scene/types.ts';
import { InfoPanel } from '../src/ui/InfoPanel.tsx';
import { formatBeamIdentity } from '../src/utils/formatSatelliteLabel.ts';
import { glyphSymbolForKind, satelliteGlyph } from '../src/viz/glyphs.ts';
import { bootDeterministicPage } from './_v3-deterministic-fixture.ts';
import { detectAppUrl } from './_vc2-browser-fixture.ts';

const PROFILE_ID = 'hobs-2024-candidate-rich';
const SERVING_SAT_ID = 'shell-pro-53-P0-S3';
const PENDING_SAT_ID = 'shell-retro000-P4-S10';
const RECENT_SOURCE_SAT_ID = 'shell-pro-53-P1-S0';
const RECENT_TARGET_SAT_ID = 'shell-polar-090-P0-S3';
const SERVING_BEAM_ID = 5;
const PENDING_BEAM_ID = 11;
const RECENT_SOURCE_BEAM_ID = 6;
const RECENT_TARGET_BEAM_ID = 4;
const CHECKPOINT_DIR = fileURLToPath(
  new URL('../docs/visual-clarity-proposal/manual-checkpoints/', import.meta.url),
);

type Scenario = 'idle' | 'pending' | 'recent-ho';

interface RenderedScenario {
  scenario: Scenario;
  state: SimState;
  markup: string;
  text: string;
}

interface BrowserBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BrowserHtmlOptions {
  panelWidthPx?: number;
}

const DUEL_LAYOUT_CSS = `
  .leo-info-panel {
    container-type: inline-size;
  }

  .leo-duel-card {
    container-type: inline-size;
  }

  .leo-duel-card-body {
    grid-template-areas:
      "serving"
      "decision"
      "comparison";
    grid-template-columns: minmax(0, 1fr);
  }

  .leo-duel-card-body > [data-duel-block="serving"] {
    grid-area: serving;
  }

  .leo-duel-card-body > [data-duel-block="decision"] {
    grid-area: decision;
  }

  .leo-duel-card-body > [data-duel-block="comparison"] {
    grid-area: comparison;
  }

  .leo-duel-decision-metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .leo-duel-trigger-row {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    align-items: center;
    gap: 12px;
  }

  @container (min-width: 380px) {
    .leo-duel-card-body {
      grid-template-areas:
        "serving comparison"
        "decision decision";
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
  }

  @container (min-width: 680px) {
    .leo-duel-card-body {
      grid-template-areas: "serving decision comparison";
      grid-template-columns: minmax(0, 1fr) minmax(120px, 0.64fr) minmax(0, 1fr);
      gap: 8px;
    }

    .leo-duel-decision-strip {
      align-content: center !important;
      padding: 10px 8px !important;
    }

    .leo-duel-decision-metrics {
      grid-template-columns: minmax(0, 1fr);
      gap: 7px;
    }

    .leo-duel-trigger-row {
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
    }
  }
`;

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

function assertContains(text: string, expected: string): void {
  assert.ok(text.includes(expected), `expected rendered output to contain "${expected}"\nRendered: ${text}`);
}

function assertNotContains(text: string, unexpected: string): void {
  assert.ok(!text.includes(unexpected), `expected rendered output not to contain "${unexpected}"\nRendered: ${text}`);
}

function countOccurrences(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

function extractTagByTestId(markup: string, testId: string): string {
  const match = markup.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`));
  assert.ok(match, `expected rendered markup to include data-testid="${testId}"`);
  return match[0];
}

function extractAttr(markup: string, attr: string): string {
  const match = markup.match(new RegExp(`${attr}="([^"]*)"`));
  assert.ok(match, `expected rendered markup to include ${attr}`);
  return match[1];
}

function createBudgetTerms(seed: number): LinkBudgetTerms {
  return {
    signalDbm: -92 + seed,
    intraInterferenceDbm: -118 + seed,
    interInterferenceDbm: -116 + seed,
    noiseDbm: -104,
    denominatorDbm: -103 + seed,
    txPowerDbm: 50,
    pathLossDb: 152 - seed,
    beamGainDb: 39,
    steeringLossDb: 1,
    receiverGainDbi: 0,
  };
}

function createVisualIdentity(satId: string, displayOrder: number): SatelliteVisualIdentity {
  const satelliteVisualIndex = satelliteTintIndex(satId, displayOrder);
  return {
    satelliteTintColor: satelliteTint(satId, displayOrder),
    satelliteGlyph: satelliteGlyph(satelliteVisualIndex),
    satelliteVisualIndex,
  };
}

function createVisualIdentityMap(): SimState['satelliteVisualIdentityById'] {
  return {
    [SERVING_SAT_ID]: createVisualIdentity(SERVING_SAT_ID, 0),
    [PENDING_SAT_ID]: createVisualIdentity(PENDING_SAT_ID, 1),
    [RECENT_SOURCE_SAT_ID]: createVisualIdentity(RECENT_SOURCE_SAT_ID, 2),
    [RECENT_TARGET_SAT_ID]: createVisualIdentity(RECENT_TARGET_SAT_ID, 3),
  };
}

function baseState(profile: Profile): SimState {
  return {
    profileId: profile.id,
    formulaFamilyLabel: getFormulaFamilyLabel(profile.formulaFamily),
    satelliteVisualIdentityById: createVisualIdentityMap(),
    physicalServing: {
      satId: SERVING_SAT_ID,
      beamId: SERVING_BEAM_ID,
      sinrDb: 18.4,
      elevationDeg: 54.2,
      rangeKm: 870,
      status: 'live',
    },
    panelPrimary: {
      role: 'serving',
      satId: SERVING_SAT_ID,
      beamId: SERVING_BEAM_ID,
      sinrDb: 18.4,
      elevationDeg: 54.2,
      rangeKm: 870,
      status: 'live',
    },
    panelComparison: {
      role: 'none',
      satId: null,
      beamId: null,
      sinrDb: null,
      elevationDeg: null,
      rangeKm: null,
      status: 'none',
    },
    servingSatId: SERVING_SAT_ID,
    servingBeamId: SERVING_BEAM_ID,
    servingElevationDeg: 54.2,
    servingRangeKm: 870,
    pendingTargetSatId: null,
    pendingTargetBeamId: null,
    pendingTargetSinrDb: null,
    comparisonSatId: null,
    comparisonBeamId: null,
    comparisonElevationDeg: null,
    comparisonRangeKm: null,
    comparisonSinrDb: null,
    comparisonKind: null,
    sinrDeltaDb: null,
    recentHoSourceSatId: null,
    recentHoTargetSatId: null,
    sinrDb: 18.4,
    physicalServingBudget: createBudgetTerms(0),
    servingBudget: createBudgetTerms(1),
    handoverOffsetDb: profile.handover.offsetDb,
    handoverTriggerProgressSec: 0,
    handoverTriggerSec: profile.handover.triggerTimeSec,
    hoCount: 0,
    lastHoReason: '',
    beamHopEnabled: profile.beamHopping.enabled,
    beamHopSlotIndex: 12,
    beamHopSlotSec: profile.beamHopping.slotSec,
    servingBeamActiveThisSlot: true,
    servingSatActiveBeamIds: [SERVING_BEAM_ID],
    pendingTargetActiveBeamIds: [],
  };
}

function createScenarioState(profile: Profile, scenario: Scenario): SimState {
  const state = baseState(profile);

  if (scenario === 'pending') {
    return {
      ...state,
      panelComparison: {
        role: 'pending',
        satId: PENDING_SAT_ID,
        beamId: PENDING_BEAM_ID,
        sinrDb: 21.2,
        elevationDeg: 56.4,
        rangeKm: 820,
        status: 'live',
      },
      pendingTargetSatId: PENDING_SAT_ID,
      pendingTargetBeamId: PENDING_BEAM_ID,
      pendingTargetSinrDb: 21.2,
      comparisonSatId: PENDING_SAT_ID,
      comparisonBeamId: PENDING_BEAM_ID,
      comparisonElevationDeg: 56.4,
      comparisonRangeKm: 820,
      comparisonSinrDb: 21.2,
      comparisonKind: 'pending',
      sinrDeltaDb: 2.8,
      handoverTriggerProgressSec: 1.2,
      lastHoReason: `inter-HO: ${PENDING_SAT_ID} B${PENDING_BEAM_ID}, 1.2/${profile.handover.triggerTimeSec.toFixed(1)}s`,
      pendingTargetActiveBeamIds: [PENDING_BEAM_ID],
    };
  }

  if (scenario === 'recent-ho') {
    return {
      ...state,
      physicalServing: {
        satId: RECENT_TARGET_SAT_ID,
        beamId: RECENT_TARGET_BEAM_ID,
        sinrDb: 20.7,
        elevationDeg: 58.1,
        rangeKm: 790,
        status: 'live',
      },
      panelPrimary: {
        role: 'ho-source',
        satId: RECENT_SOURCE_SAT_ID,
        beamId: RECENT_SOURCE_BEAM_ID,
        sinrDb: 12.1,
        elevationDeg: 50.1,
        rangeKm: 900,
        status: 'recent-ho',
      },
      panelComparison: {
        role: 'ho-target',
        satId: RECENT_TARGET_SAT_ID,
        beamId: RECENT_TARGET_BEAM_ID,
        sinrDb: 20.7,
        elevationDeg: 58.1,
        rangeKm: 790,
        status: 'recent-ho',
      },
      servingSatId: RECENT_SOURCE_SAT_ID,
      servingBeamId: RECENT_SOURCE_BEAM_ID,
      servingElevationDeg: 50.1,
      servingRangeKm: 900,
      comparisonSatId: RECENT_TARGET_SAT_ID,
      comparisonBeamId: RECENT_TARGET_BEAM_ID,
      comparisonElevationDeg: 58.1,
      comparisonRangeKm: 790,
      comparisonSinrDb: 20.7,
      comparisonKind: 'recent-ho',
      sinrDeltaDb: 8.6,
      recentHoSourceSatId: RECENT_SOURCE_SAT_ID,
      recentHoTargetSatId: RECENT_TARGET_SAT_ID,
      sinrDb: 12.1,
      hoCount: 1,
      lastHoReason: `inter-HO: ${RECENT_TARGET_SAT_ID} B${RECENT_TARGET_BEAM_ID}, completed`,
      servingSatActiveBeamIds: [RECENT_SOURCE_BEAM_ID],
      pendingTargetActiveBeamIds: [RECENT_TARGET_BEAM_ID],
    };
  }

  return state;
}

function renderScenario(profile: Profile, scenario: Scenario): RenderedScenario {
  const state = createScenarioState(profile, scenario);
  const markup = renderToStaticMarkup(
    <InfoPanel {...state} profile={profile} />,
  );
  return {
    scenario,
    state,
    markup,
    text: decodeHtmlText(markup),
  };
}

function assertV2Scenario(profile: Profile, rendered: RenderedScenario): void {
  assert.equal(
    countOccurrences(rendered.markup, /data-testid="info-panel-duel-card"/g),
    1,
    `${rendered.scenario} must render one duel card`,
  );
  assertContains(rendered.markup, 'data-testid="info-panel-duel-center"');
  assertContains(rendered.markup, 'data-testid="info-panel-duel-body"');
  assertContains(rendered.markup, 'data-testid="info-panel-duel-trigger-progress"');
  assertContains(rendered.markup, 'data-testid="info-panel-primary-sinr-status"');
  assertContains(rendered.markup, 'data-testid="info-panel-comparison-sinr-status"');
  assertContains(rendered.markup, 'data-testid="info-panel-primary-sinr-status-sinr-readout"');
  assertContains(rendered.markup, 'data-testid="info-panel-comparison-sinr-status-sinr-readout"');
  assertContains(rendered.markup, 'data-layout-policy="compact-two-column-standard-container-query"');
  assertContains(rendered.markup, 'data-duel-block="serving"');
  assertContains(rendered.markup, 'data-duel-block="decision"');
  assertContains(rendered.markup, 'data-duel-block="comparison"');
  assertContains(rendered.text, 'Beam duel');
  assertContains(rendered.text, 'Δ SINR');
  assertContains(rendered.text, 'Need Offset');
  assertContains(rendered.text, 'Trigger Time');
  assertNotContains(rendered.text, 'Handover decision');

  const primaryIdentity = formatBeamIdentity({
    satId: rendered.state.servingSatId,
    beamId: rendered.state.servingBeamId,
    frequencyReuse: profile.beams.frequencyReuse,
  });
  assert.equal(
    extractAttr(extractTagByTestId(rendered.markup, 'info-panel-primary-beam-identity'), 'data-beam-identity'),
    primaryIdentity,
    `${rendered.scenario} primary identity drifted`,
  );
  assertContains(rendered.text, primaryIdentity);

  const primaryGlyph = rendered.state.satelliteVisualIdentityById[rendered.state.servingSatId ?? '']?.satelliteGlyph;
  assert.ok(primaryGlyph, `${rendered.scenario} primary glyph missing from visual identity map`);
  assert.equal(
    extractAttr(extractTagByTestId(rendered.markup, 'info-panel-primary-beam-identity'), 'data-satellite-glyph'),
    primaryGlyph,
    `${rendered.scenario} primary glyph drifted`,
  );
  assertContains(rendered.text, glyphSymbolForKind(primaryGlyph));

  const comparisonTag = extractTagByTestId(rendered.markup, 'info-panel-comparison-beam-identity');
  const activeIdentityCount = rendered.state.comparisonSatId && rendered.state.comparisonBeamId !== null ? 2 : 1;
  assert.equal(
    countOccurrences(rendered.markup, /data-testid="info-panel-satellite-glyph"/g),
    activeIdentityCount,
    `${rendered.scenario} inline glyph echo count drifted`,
  );
  if (rendered.state.comparisonSatId && rendered.state.comparisonBeamId !== null) {
    const comparisonIdentity = formatBeamIdentity({
      satId: rendered.state.comparisonSatId,
      beamId: rendered.state.comparisonBeamId,
      frequencyReuse: profile.beams.frequencyReuse,
    });
    const comparisonGlyph = rendered.state.satelliteVisualIdentityById[rendered.state.comparisonSatId]?.satelliteGlyph;
    assert.ok(comparisonGlyph, `${rendered.scenario} comparison glyph missing from visual identity map`);
    assert.equal(
      extractAttr(comparisonTag, 'data-beam-identity'),
      comparisonIdentity,
      `${rendered.scenario} comparison identity drifted`,
    );
    assert.equal(
      extractAttr(comparisonTag, 'data-satellite-glyph'),
      comparisonGlyph,
      `${rendered.scenario} comparison glyph drifted`,
    );
    assertContains(rendered.text, comparisonIdentity);
    assertContains(rendered.text, glyphSymbolForKind(comparisonGlyph));
  } else {
    assert.equal(comparisonTag.includes('data-beam-identity='), false, 'idle comparison must not expose an active beam identity');
    assert.equal(comparisonTag.includes('data-satellite-glyph='), false, 'idle comparison must not expose an active glyph identity');
  }

  if (rendered.scenario === 'idle') {
    assertContains(rendered.text, 'ACTIVE SERVING');
    assertContains(rendered.text, 'COMPARISON');
    assertContains(rendered.text, 'idle');
    assertContains(rendered.markup, 'data-trigger-progress="0"');
  } else if (rendered.scenario === 'pending') {
    assertContains(rendered.text, 'PENDING TARGET');
    assertContains(rendered.text, 'pending');
    assertContains(rendered.text, '+2.8 dB');
    const progressPercent = Math.round(
      rendered.state.handoverTriggerProgressSec / rendered.state.handoverTriggerSec * 100,
    );
    assertContains(rendered.markup, `data-trigger-progress="${progressPercent}"`);
  } else {
    assertContains(rendered.text, 'HO SOURCE');
    assertContains(rendered.text, 'HO TARGET');
    assertContains(rendered.text, 'recent HO');
  }
}

function browserHtml(markup: string, options: BrowserHtmlOptions = {}): string {
  const widthOverride = options.panelWidthPx === undefined
    ? ''
    : `.leo-info-panel { width: ${options.panelWidthPx}px !important; }`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: #020912;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        overflow: hidden;
      }
      .leo-info-panel {
        max-height: calc(100vh - 24px);
        overflow-y: auto;
      }
      ${DUEL_LAYOUT_CSS}
      ${widthOverride}
    </style>
  </head>
  <body>${markup}</body>
</html>`;
}

async function screenshotPath(name: string): Promise<string> {
  const path = `${CHECKPOINT_DIR}${name}`;
  await mkdir(dirname(path), { recursive: true });
  return path;
}

async function assertNoHorizontalOverlap(page: Page, leftSelector: string, rightSelector: string, label: string): Promise<void> {
  const left = await page.locator(leftSelector).boundingBox();
  const right = await page.locator(rightSelector).boundingBox();
  assert.ok(left, `${label} left box missing`);
  assert.ok(right, `${label} right box missing`);
  assert.ok(
    left.x + left.width <= right.x + 1,
    `${label} boxes overlap horizontally: ${JSON.stringify({ left, right })}`,
  );
}

async function measureBox(page: Page, selector: string, label: string): Promise<BrowserBox> {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `${label} box missing for ${selector}`);
  return box;
}

async function assertReadoutFitsColumn(page: Page, readoutSelector: string, columnSelector: string, label: string): Promise<void> {
  const readout = await page.locator(readoutSelector).boundingBox();
  const column = await page.locator(columnSelector).boundingBox();
  assert.ok(readout, `${label} SINR readout box missing`);
  assert.ok(column, `${label} SINR column box missing`);
  assert.ok(
    readout.x >= column.x && readout.x + readout.width <= column.x + column.width + 1,
    `${label} SINR readout overflowed its column: ${JSON.stringify({ readout, column })}`,
  );
}

async function assertSinrReadoutFont(page: Page, readoutSelector: string, label: string): Promise<void> {
  const fontSize = await page.locator(readoutSelector).evaluate(element => {
    const valueElement = element.querySelector('span') ?? element;
    return Number.parseFloat(getComputedStyle(valueElement).fontSize);
  });
  assert.ok(
    fontSize >= 31.5,
    `${label} SINR readout font regressed below readable size: ${fontSize}px`,
  );
}

async function assertIdentityFont(page: Page, identitySelector: string, label: string): Promise<void> {
  const fontSize = await page.locator(identitySelector).evaluate(element => (
    Number.parseFloat(getComputedStyle(element).fontSize)
  ));
  assert.ok(
    fontSize >= 15.5,
    `${label} beam identity font regressed below readable size: ${fontSize}px`,
  );
}

async function assertReadableDuelTypography(page: Page, label: string): Promise<void> {
  await assertIdentityFont(page, '[data-testid="info-panel-primary-beam-identity"]', `${label} primary`);
  await assertIdentityFont(page, '[data-testid="info-panel-comparison-beam-identity"]', `${label} comparison`);
  await assertSinrReadoutFont(page, '[data-testid="info-panel-primary-sinr-status-sinr-readout"]', `${label} primary`);
  await assertSinrReadoutFont(page, '[data-testid="info-panel-comparison-sinr-status-sinr-readout"]', `${label} comparison`);
}

async function assertStandardTwoColumnDuelLayout(page: Page, label: string): Promise<void> {
  const card = await measureBox(page, '[data-testid="info-panel-duel-card"]', `${label} duel card`);
  const primary = await measureBox(page, '[data-testid="info-panel-primary-sinr-status"]', `${label} primary block`);
  const decision = await measureBox(page, '[data-testid="info-panel-duel-center"]', `${label} decision strip`);
  const comparison = await measureBox(page, '[data-testid="info-panel-comparison-sinr-status"]', `${label} comparison block`);
  const rowSkew = Math.abs(primary.y - comparison.y);
  const signalBottom = Math.max(primary.y + primary.height, comparison.y + comparison.height);

  assert.ok(
    rowSkew <= 2,
    `${label} standard layout must place serving and comparison on the same row: ${JSON.stringify({ primary, comparison })}`,
  );
  assert.ok(
    primary.x + primary.width <= comparison.x + 1,
    `${label} standard layout serving/comparison columns overlap: ${JSON.stringify({ primary, comparison })}`,
  );
  assert.ok(
    decision.y >= signalBottom - 1,
    `${label} decision strip must sit below both signal columns: ${JSON.stringify({ primary, comparison, decision })}`,
  );
  assert.ok(
    decision.width >= card.width * 0.78,
    `${label} decision strip must span both standard columns: ${JSON.stringify({ card, decision })}`,
  );
  assert.ok(
    decision.x <= primary.x + 1 && decision.x + decision.width >= comparison.x + comparison.width - 1,
    `${label} decision strip did not cover the serving/comparison column span: ${JSON.stringify({ primary, decision, comparison })}`,
  );

  for (const [name, box] of [['primary', primary], ['comparison', comparison]] as const) {
    assert.ok(
      box.width >= card.width * 0.34,
      `${label} ${name} column is too narrow for readable text: ${JSON.stringify({ card, box })}`,
    );
    assert.ok(
      box.x >= card.x && box.x + box.width <= card.x + card.width + 1,
      `${label} ${name} block escaped the connected duel card: ${JSON.stringify({ card, box })}`,
    );
  }
  assert.ok(
    Math.abs(primary.width - comparison.width) <= 4,
    `${label} serving/comparison columns are visually imbalanced: ${JSON.stringify({ primary, comparison })}`,
  );
  assert.ok(
    decision.x >= card.x && decision.x + decision.width <= card.x + card.width + 1,
    `${label} decision strip escaped the connected duel card: ${JSON.stringify({ card, decision })}`,
  );
}

async function assertNarrowStackedDuelLayout(
  browser: Browser,
  rendered: RenderedScenario,
): Promise<{ scenario: Scenario; panelBox: BrowserBox; cardBox: BrowserBox }> {
  const page = await browser.newPage({ viewport: { width: 500, height: 720 } });

  try {
    await page.setContent(browserHtml(rendered.markup, { panelWidthPx: 360 }), { waitUntil: 'load' });
    const panelBox = await measureBox(page, '.leo-info-panel', `${rendered.scenario} narrow panel`);
    const cardBox = await measureBox(page, '[data-testid="info-panel-duel-card"]', `${rendered.scenario} narrow duel card`);
    const primary = await measureBox(page, '[data-testid="info-panel-primary-sinr-status"]', `${rendered.scenario} narrow primary block`);
    const decision = await measureBox(page, '[data-testid="info-panel-duel-center"]', `${rendered.scenario} narrow decision strip`);
    const comparison = await measureBox(page, '[data-testid="info-panel-comparison-sinr-status"]', `${rendered.scenario} narrow comparison block`);

    assert.ok(cardBox.width < 380, `${rendered.scenario} narrow fixture must remain below the 2-column threshold: ${JSON.stringify(cardBox)}`);
    assert.ok(
      primary.y + primary.height <= decision.y + 1,
      `${rendered.scenario} narrow layout must stack serving before decision: ${JSON.stringify({ primary, decision })}`,
    );
    assert.ok(
      decision.y + decision.height <= comparison.y + 1,
      `${rendered.scenario} narrow layout must stack decision before comparison: ${JSON.stringify({ decision, comparison })}`,
    );

    for (const [name, box] of [['primary', primary], ['decision', decision], ['comparison', comparison]] as const) {
      assert.ok(
        box.width >= cardBox.width * 0.82,
        `${rendered.scenario} narrow ${name} block is too narrow for readable text: ${JSON.stringify({ cardBox, box })}`,
      );
      assert.ok(
        box.x >= cardBox.x && box.x + box.width <= cardBox.x + cardBox.width + 1,
        `${rendered.scenario} narrow ${name} block escaped the connected duel card: ${JSON.stringify({ cardBox, box })}`,
      );
    }

    await assertReadableDuelTypography(page, `${rendered.scenario} narrow`);
    await assertDescendantsStayInside(
      page,
      '[data-testid="info-panel-duel-card"]',
      `${rendered.scenario} narrow duel card`,
    );

    return { scenario: rendered.scenario, panelBox, cardBox };
  } finally {
    await page.close().catch(() => {});
  }
}

async function assertWideDuelLayout(
  browser: Browser,
  rendered: RenderedScenario,
): Promise<{ scenario: Scenario; panelBox: BrowserBox; cardBox: BrowserBox }> {
  const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });

  try {
    await page.setContent(browserHtml(rendered.markup, { panelWidthPx: 760 }), { waitUntil: 'load' });
    const panelBox = await measureBox(page, '.leo-info-panel', `${rendered.scenario} wide panel`);
    const cardBox = await measureBox(page, '[data-testid="info-panel-duel-card"]', `${rendered.scenario} wide duel card`);
    const primary = await measureBox(page, '[data-testid="info-panel-primary-sinr-status"]', `${rendered.scenario} wide primary block`);
    const decision = await measureBox(page, '[data-testid="info-panel-duel-center"]', `${rendered.scenario} wide decision strip`);
    const comparison = await measureBox(page, '[data-testid="info-panel-comparison-sinr-status"]', `${rendered.scenario} wide comparison block`);
    const rowSkew = Math.max(
      Math.abs(primary.y - decision.y),
      Math.abs(decision.y - comparison.y),
      Math.abs(primary.y - comparison.y),
    );

    assert.ok(cardBox.width >= 700, `${rendered.scenario} wide duel card did not receive a wide enough container`);
    assert.ok(rowSkew <= 2, `${rendered.scenario} wide layout did not switch to one row: ${JSON.stringify({ primary, decision, comparison })}`);
    assert.ok(decision.width >= 120, `${rendered.scenario} wide decision column too narrow: ${JSON.stringify(decision)}`);
    assert.ok(primary.width > decision.width, `${rendered.scenario} wide serving block should stay wider than decision strip`);
    assert.ok(comparison.width > decision.width, `${rendered.scenario} wide comparison block should stay wider than decision strip`);
    await assertNoHorizontalOverlap(
      page,
      '[data-testid="info-panel-primary-sinr-status"]',
      '[data-testid="info-panel-duel-center"]',
      `${rendered.scenario} wide primary/decision`,
    );
    await assertNoHorizontalOverlap(
      page,
      '[data-testid="info-panel-duel-center"]',
      '[data-testid="info-panel-comparison-sinr-status"]',
      `${rendered.scenario} wide decision/comparison`,
    );
    await assertReadableDuelTypography(page, `${rendered.scenario} wide`);

    return { scenario: rendered.scenario, panelBox, cardBox };
  } finally {
    await page.close().catch(() => {});
  }
}

async function assertDescendantsStayInside(page: Page, containerSelector: string, label: string): Promise<void> {
  const overflow = await page.locator(containerSelector).evaluate(element => {
    const container = element.getBoundingClientRect();
    const offenders: Array<{ tag: string; text: string; rect: { left: number; right: number; width: number } }> = [];

    for (const child of Array.from(element.querySelectorAll('*'))) {
      const rect = child.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.left < container.left - 1 || rect.right > container.right + 1) {
        offenders.push({
          tag: child.tagName.toLowerCase(),
          text: (child.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
          rect: {
            left: rect.left,
            right: rect.right,
            width: rect.width,
          },
        });
      }
    }

    return {
      container: {
        left: container.left,
        right: container.right,
        width: container.width,
      },
      offenders,
    };
  });

  assert.deepEqual(
    overflow.offenders,
    [],
    `${label} descendants overflowed ${containerSelector}: ${JSON.stringify(overflow)}`,
  );
}

async function assertBrowserScenario(
  browser: Browser,
  rendered: RenderedScenario,
): Promise<{ scenario: Scenario; screenshot: string; panelBox: BrowserBox }> {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const checkpoint = await screenshotPath(`vc4a-fixture-${rendered.scenario}-1440x900.png`);

  try {
    await page.setContent(browserHtml(rendered.markup), { waitUntil: 'load' });
    const panel = page.locator('.leo-info-panel');
    const card = page.locator('[data-testid="info-panel-duel-card"]');
    await card.waitFor({ timeout: 5000 });
    const panelBox = await panel.boundingBox();
    const cardBox = await card.boundingBox();
    assert.ok(panelBox, `${rendered.scenario} panel box missing`);
    assert.ok(cardBox, `${rendered.scenario} duel card box missing`);
    assert.ok(panelBox.width > 300, `${rendered.scenario} panel width collapsed: ${panelBox.width}`);
    assert.ok(panelBox.height > 120, `${rendered.scenario} panel height collapsed: ${panelBox.height}`);
    assert.ok(panelBox.x >= 0 && panelBox.y >= 0, `${rendered.scenario} panel escaped viewport`);
    assert.ok(
      panelBox.x + panelBox.width <= 1440 && panelBox.y + panelBox.height <= 900,
      `${rendered.scenario} panel overflowed viewport: ${JSON.stringify(panelBox)}`,
    );
    assert.ok(
      cardBox.x >= panelBox.x && cardBox.x + cardBox.width <= panelBox.x + panelBox.width + 1,
      `${rendered.scenario} duel card escaped panel horizontally`,
    );
    await assertStandardTwoColumnDuelLayout(page, `${rendered.scenario} standard fixture`);
    await assertReadableDuelTypography(page, `${rendered.scenario} standard fixture`);
    await assertReadoutFitsColumn(
      page,
      '[data-testid="info-panel-primary-sinr-status-sinr-readout"]',
      '[data-testid="info-panel-primary-sinr-status"]',
      rendered.scenario,
    );
    await assertReadoutFitsColumn(
      page,
      '[data-testid="info-panel-comparison-sinr-status-sinr-readout"]',
      '[data-testid="info-panel-comparison-sinr-status"]',
      rendered.scenario,
    );
    await assertDescendantsStayInside(
      page,
      '[data-testid="info-panel-duel-center"]',
      `${rendered.scenario} decision strip`,
    );
    await assertDescendantsStayInside(
      page,
      '[data-testid="info-panel-duel-card"]',
      `${rendered.scenario} duel card`,
    );
    await page.screenshot({ path: checkpoint, fullPage: true });
    return { scenario: rendered.scenario, screenshot: checkpoint, panelBox };
  } finally {
    await page.close().catch(() => {});
  }
}

async function assertLiveAppViewport(
  browser: Browser,
  appUrl: string,
  viewport: { width: number; height: number },
  saveCheckpoint: boolean,
): Promise<{ viewport: string; panelBox: BrowserBox; checkpoint?: string }> {
  const page = await bootDeterministicPage({ chromium }, {
    browser,
    url: appUrl,
    seed: 4401,
    rafMs: 1800,
    viewport,
    waitForSelector: '[data-testid="info-panel-duel-card"]',
  });

  try {
    const panelBox = await page.locator('.leo-info-panel').boundingBox();
    const cardBox = await page.locator('[data-testid="info-panel-duel-card"]').boundingBox();
    const controlBox = await page.locator('.leo-control-bar').boundingBox();
    assert.ok(panelBox, `${viewport.width}x${viewport.height} live panel box missing`);
    assert.ok(cardBox, `${viewport.width}x${viewport.height} live duel card box missing`);
    assert.ok(panelBox.width > 300, `${viewport.width}x${viewport.height} live panel width collapsed`);
    assert.ok(panelBox.x >= 0 && panelBox.y >= 0, `${viewport.width}x${viewport.height} live panel escaped viewport`);
    assert.ok(
      panelBox.x + panelBox.width <= viewport.width && panelBox.y + Math.min(panelBox.height, viewport.height) <= viewport.height + 1,
      `${viewport.width}x${viewport.height} live panel overflowed viewport: ${JSON.stringify(panelBox)}`,
    );
    if (controlBox) {
      const separatedVertically = panelBox.y >= controlBox.y + controlBox.height || controlBox.y >= panelBox.y + panelBox.height;
      const separatedHorizontally = panelBox.x >= controlBox.x + controlBox.width || controlBox.x >= panelBox.x + panelBox.width;
      assert.ok(
        separatedVertically || separatedHorizontally,
      `${viewport.width}x${viewport.height} live panel overlapped ControlBar: ${JSON.stringify({ panelBox, controlBox })}`,
      );
    }
    await assertStandardTwoColumnDuelLayout(page, `${viewport.width}x${viewport.height} live`);
    await assertReadableDuelTypography(page, `${viewport.width}x${viewport.height} live`);
    await assertDescendantsStayInside(
      page,
      '[data-testid="info-panel-duel-card"]',
      `${viewport.width}x${viewport.height} live duel card`,
    );

    let checkpoint: string | undefined;
    if (saveCheckpoint) {
      checkpoint = await screenshotPath(`vc4a-post-slice-duel-card-${viewport.width}x${viewport.height}.png`);
      await page.screenshot({ path: checkpoint, fullPage: true });
    }

    return { viewport: `${viewport.width}x${viewport.height}`, panelBox, checkpoint };
  } finally {
    await page.context().close().catch(() => {});
  }
}

async function main(): Promise<void> {
  const profile = loadProfile(PROFILE_ID);
  const rendered = (['idle', 'pending', 'recent-ho'] as const).map(scenario => renderScenario(profile, scenario));
  rendered.forEach(scenario => assertV2Scenario(profile, scenario));

  const appUrl = await detectAppUrl();
  const browser = await chromium.launch();
  let fixtureScreenshots: Array<Awaited<ReturnType<typeof assertBrowserScenario>>>;
  let liveViewports: Array<Awaited<ReturnType<typeof assertLiveAppViewport>>>;
  let wideLayout: Awaited<ReturnType<typeof assertWideDuelLayout>>;
  let narrowLayouts: Array<Awaited<ReturnType<typeof assertNarrowStackedDuelLayout>>>;

  try {
    fixtureScreenshots = [];
    for (const scenario of rendered) {
      fixtureScreenshots.push(await assertBrowserScenario(browser, scenario));
    }

    narrowLayouts = [];
    for (const scenario of rendered) {
      narrowLayouts.push(await assertNarrowStackedDuelLayout(browser, scenario));
    }

    const pendingScenario = rendered.find(item => item.scenario === 'pending');
    assert.ok(pendingScenario, 'pending scenario missing for wide duel-card layout check');
    wideLayout = await assertWideDuelLayout(browser, pendingScenario);

    liveViewports = [
      await assertLiveAppViewport(browser, appUrl, { width: 1440, height: 900 }, true),
      await assertLiveAppViewport(browser, appUrl, { width: 1366, height: 768 }, false),
    ];
  } finally {
    await browser.close();
  }

  console.log('Visual Clarity Phase 4A duel-card validation passed.');
  console.log(JSON.stringify({
    v2: {
      scenarios: rendered.map(item => item.scenario),
      duelCardCount: 'one per scenario',
      standardLayout: '2-column serving/comparison with decision strip spanning both columns',
      narrowLayout: 'stacked serving -> decision strip -> comparison below 380px card containers',
      wideLayout: '3-column only when container is at least 680px',
      decisionStrip: ['Δ SINR', 'Need Offset', 'Trigger Time', 'state badge'],
      identityParity: 'primary and comparison data-beam-identity assertions passed',
      splitHandoverCardRemoved: 'passed',
    },
    v3: {
      appUrl,
      fixtureScreenshots,
      narrowLayouts,
      wideLayout,
      liveViewports,
      manualScreenshotCheckpoint: liveViewports.find(item => item.checkpoint)?.checkpoint,
    },
    result: 'PASS',
  }, null, 2));
}

main();
