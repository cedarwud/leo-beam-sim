#!/usr/bin/env node
// Phase I-S6 HUD preview banner + BeamHoppingToggle removal validator.
//
// Acceptance source:
// docs/modqn-handover-story-layer-sdd.md §Rendering Policy and
// docs/modqn-realistic-beam-geometry-cross-repo-sdd.md §11.3.6 supersession
// of Phase H BeamHoppingToggle.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AppExperienceMode } from '../src/app/appExperienceMode.ts';
import type { SimState } from '../src/scene/types.ts';
import {
  MODQN_LIVE_CELL_PREVIEW_BANNER_TEXT,
  ModqnSceneHud,
} from '../src/ui/modqn-controls/ModqnSceneHud.tsx';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_PATH = path.join(REPO_ROOT, 'src/App.tsx');
const BEAM_HOPPING_TOGGLE_PATH = path.join(
  REPO_ROOT,
  'src/ui/modqn-controls/BeamHoppingToggle.tsx',
);
const PREVIEW_TEXT = MODQN_LIVE_CELL_PREVIEW_BANNER_TEXT;

const PASSED: string[] = [];

function pass(label: string): void {
  PASSED.push(label);
  console.log(`  [PASS] ${label}`);
}

function expect(condition: boolean, label: string, detail?: string): void {
  assert.ok(condition, detail ?? label);
  pass(label);
}

function readSource(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

function makeSimState(overrides: Partial<SimState> = {}): SimState {
  return {
    simTimeSec: 42.3,
    intraHoCount: 2,
    hoCount: 5,
    ...overrides,
  } as SimState;
}

interface HudRenderOptions {
  readonly appMode?: AppExperienceMode;
  readonly sceneSource?: 'live-sim' | 'artifact-replay';
  readonly bundleProvenanceKind?: 'paper-faithful' | 'user-trained';
  readonly simState?: SimState;
}

function renderHud({
  appMode = 'modqn-demo',
  sceneSource = 'live-sim',
  bundleProvenanceKind = 'paper-faithful',
  simState = makeSimState(),
}: HudRenderOptions = {}): string {
  return renderToStaticMarkup(
    <ModqnSceneHud
      appMode={appMode}
      simState={simState}
      bundleProvenanceKind={bundleProvenanceKind}
      sceneSource={sceneSource}
    />,
  );
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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getOpeningTagByTestId(markup: string, testId: string): string {
  const regex = new RegExp(`<[a-z][\\w-]*\\b[^>]*data-testid="${escapeRegex(testId)}"[^>]*>`);
  const match = markup.match(regex);
  assert.ok(match, `Opening tag with data-testid="${testId}" not found`);
  return match[0];
}

function getOpeningTagBySelector(markup: string, selectorAttr: string, selectorValue: string): string {
  const regex = new RegExp(
    `<[a-z][\\w-]*\\b[^>]*${escapeRegex(selectorAttr)}="${escapeRegex(selectorValue)}"[^>]*>`,
  );
  const match = markup.match(regex);
  assert.ok(match, `Opening tag with ${selectorAttr}="${selectorValue}" not found`);
  return match[0];
}

function getAttribute(tag: string, attr: string): string | null {
  const match = tag.match(new RegExp(`\\s${escapeRegex(attr)}="([^"]*)"`));
  return match?.[1] ?? null;
}

function getElementTextByTestId(markup: string, testId: string): string {
  const regex = new RegExp(
    `<([a-z][\\w-]*)\\b[^>]*data-testid="${escapeRegex(testId)}"[^>]*>([\\s\\S]*?)<\\/\\1>`,
  );
  const match = markup.match(regex);
  assert.ok(match, `Element with data-testid="${testId}" not found`);
  return decodeHtmlText(match[2] ?? '');
}

function getTruthTone(markup: string): string | null {
  return getAttribute(getOpeningTagBySelector(markup, 'data-truth-chip', 'live'), 'data-truth-chip')
    ?? getAttribute(getOpeningTagBySelector(markup, 'data-truth-chip', 'paper'), 'data-truth-chip')
    ?? getAttribute(getOpeningTagBySelector(markup, 'data-truth-chip', 'user'), 'data-truth-chip');
}

function validateLiveHudBanner(): void {
  console.log('\n(a) live-sim HUD preview banner');
  const markup = renderHud({
    sceneSource: 'live-sim',
    simState: makeSimState({ simTimeSec: 42.3, intraHoCount: 2, hoCount: 5 }),
  });
  const rootTag = getOpeningTagByTestId(markup, 'modqn-scene-hud');
  const bannerTag = getOpeningTagByTestId(markup, 'modqn-scene-hud-preview-banner');
  const headerIndex = markup.indexOf('<header class="leo-modqn-scene-hud__chip"');
  const bannerIndex = markup.indexOf('data-testid="modqn-scene-hud-preview-banner"');
  const metricsIndex = markup.indexOf('<dl class="leo-modqn-scene-hud__metrics"');

  expect(bannerIndex >= 0, 'Banner element exists in modqn-demo live-sim');
  expect(
    getElementTextByTestId(markup, 'modqn-scene-hud-preview-banner') === PREVIEW_TEXT,
    'Banner text matches SDD verbatim',
  );
  expect(
    headerIndex >= 0 && headerIndex < bannerIndex && bannerIndex < metricsIndex,
    'Banner renders after chip header and before metrics dl',
  );
  expect(
    getAttribute(rootTag, 'data-preview-stage') === 'phase-i',
    'HUD root exposes data-preview-stage="phase-i"',
  );
  expect(
    getAttribute(bannerTag, 'data-preview-stage') === 'phase-i',
    'Banner exposes data-preview-stage="phase-i"',
  );
  expect(
    getAttribute(bannerTag, 'data-preview-source') === 'profile-derived-demo',
    'Banner exposes profile-derived source boundary',
  );
  expect(
    getAttribute(bannerTag, 'data-backend-snr-truth') === 'nadir',
    'Banner exposes backend SNR truth as nadir',
  );
  expect(
    getAttribute(bannerTag, 'data-producer-proof') === 'false',
    'Banner exposes non-producer-proof state',
  );
  expect(
    getAttribute(bannerTag, 'data-phase-target') === 'phase-iii',
    'Banner exposes Phase III backend target',
  );
  expect(rootTag.includes('data-testid="modqn-scene-hud"'), 'Existing HUD root testid remains present');
  expect(
    getElementTextByTestId(markup, 'modqn-scene-hud-sim-time') === '42.3s',
    'Existing sim-time testid remains present with correct value',
  );
  expect(
    getElementTextByTestId(markup, 'modqn-scene-hud-intra-ho') === '2',
    'Existing intra-HO testid remains present with correct value',
  );
  expect(
    getElementTextByTestId(markup, 'modqn-scene-hud-inter-ho') === '3',
    'Existing inter-HO testid remains present with correct value',
  );
  expect(
    getAttribute(bannerTag, 'class') === 'leo-modqn-scene-hud__preview-banner',
    'Banner has stable preview-banner class',
  );
}

function validateTruthChipTones(): void {
  console.log('\n(b) truth-chip tone preservation');
  const liveMarkup = renderHud({ sceneSource: 'live-sim' });
  const paperMarkup = renderHud({
    sceneSource: 'artifact-replay',
    bundleProvenanceKind: 'paper-faithful',
  });
  const userMarkup = renderHud({
    sceneSource: 'artifact-replay',
    bundleProvenanceKind: 'user-trained',
  });

  for (const [label, markup, expectedTone] of [
    ['live-sim', liveMarkup, 'live'],
    ['paper-faithful replay', paperMarkup, 'paper'],
    ['user-trained replay', userMarkup, 'user'],
  ] as const) {
    const rootTone = getAttribute(getOpeningTagByTestId(markup, 'modqn-scene-hud'), 'data-truth-tone');
    const chipTag = getOpeningTagBySelector(markup, 'data-truth-chip', expectedTone);
    const chipTone = getAttribute(chipTag, 'data-truth-chip');
    expect(chipTone === expectedTone, `Truth chip tone ${expectedTone} when scene is ${label}`);
    expect(rootTone === chipTone, `data-truth-tone matches chip tone for ${label}`);
  }
}

function validateModeAndReplayBanner(): void {
  console.log('\n(c) mode gating and source boundary');
  // 'hobs-demo' was the pre-rename name of the non-MODQN mode; the current
  // AppExperienceMode union is exactly ['sinr-experiment','modqn-demo'], so
  // 'sinr-experiment' is the same "outside modqn-demo" probe with a legal value
  // (ModqnSceneHud gates on `appMode !== 'modqn-demo'` → identical null render).
  const hobsMarkup = renderHud({ appMode: 'sinr-experiment' });
  expect(hobsMarkup === '', 'HUD returns null outside modqn-demo');

  const replayMarkup = renderHud({
    sceneSource: 'artifact-replay',
    bundleProvenanceKind: 'paper-faithful',
  });
  expect(
    !replayMarkup.includes('data-testid="modqn-scene-hud-preview-banner"'),
    'Live preview banner is absent for artifact-replay component input',
  );
}

function validateBeamHoppingRemoval(): void {
  console.log('\n(d) BeamHoppingToggle source removal');
  const appSource = readFileSync(APP_PATH, 'utf8');
  const hudSource = readSource('src/ui/modqn-controls/ModqnSceneHud.tsx');

  expect(!appSource.includes('BeamHoppingToggle'), 'App.tsx has 0 occurrences of BeamHoppingToggle');
  expect(
    !appSource.includes('applyBeamHoppingDemoOverride'),
    'App.tsx has 0 occurrences of applyBeamHoppingDemoOverride',
  );
  expect(!appSource.includes('BeamHoppingDemoState'), 'App.tsx has 0 occurrences of BeamHoppingDemoState');
  expect(
    !appSource.includes('DEFAULT_BEAM_HOPPING_DEMO_STATE'),
    'App.tsx has 0 occurrences of DEFAULT_BEAM_HOPPING_DEMO_STATE',
  );
  expect(!existsSync(BEAM_HOPPING_TOGGLE_PATH), 'BeamHoppingToggle.tsx no longer exists');
  expect(
    hudSource.includes('data-backend-snr-truth="nadir"'),
    'HUD source exposes backend SNR truth boundary telemetry',
  );
  expect(
    hudSource.includes('data-preview-source="profile-derived-demo"'),
    'HUD source exposes profile-derived preview source telemetry',
  );
}

validateLiveHudBanner();
validateTruthChipTones();
validateModeAndReplayBanner();
validateBeamHoppingRemoval();

assert.ok(PASSED.length >= 18, `expected >= 18 assertions; got ${PASSED.length}`);

console.log(`\nvalidate-phase-i-s6-hud-preview-banner: PASS (${PASSED.length}/0 assertions)`);
