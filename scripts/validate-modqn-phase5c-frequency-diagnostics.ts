import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  getFormulaFamilyLabel,
  loadProfile,
} from '../src/profiles/index.ts';
import type { Profile } from '../src/profiles/types.ts';
import type {
  LinkBudgetTerms,
  SimState,
  VisualFrequencyDiagnosticsState,
} from '../src/scene/types.ts';
import { DiagnosticsDrawer } from '../src/ui/DiagnosticsDrawer.tsx';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE_ID = 'hobs-2024-candidate-rich';

function readRepoFile(relativePath: string): string {
  return readFileSync(join(ROOT_DIR, relativePath), 'utf8');
}

function createBudgetTerms(): LinkBudgetTerms {
  return {
    signalDbm: -91,
    intraInterferenceDbm: -120,
    interInterferenceDbm: -118,
    noiseDbm: -104,
    denominatorDbm: -103,
    txPowerDbm: 48,
    pathLossDb: 152,
    beamGainDb: 39,
    steeringLossDb: 1,
    receiverGainDbi: 0,
  };
}

function createSimState(
  profile: Profile,
  visualFrequencyDiagnostics?: VisualFrequencyDiagnosticsState,
): SimState {
  const physicalServingBudget = createBudgetTerms();

  return {
    profileId: profile.id,
    formulaFamilyLabel: getFormulaFamilyLabel(profile.formulaFamily),
    satelliteVisualIdentityById: {},
    physicalServing: {
      satId: 'sat-primary',
      beamId: 5,
      sinrDb: 12.5,
      elevationDeg: 49.2,
      rangeKm: 910,
      status: 'live',
    },
    panelPrimary: {
      role: 'serving',
      satId: 'sat-primary',
      beamId: 5,
      sinrDb: 12.5,
      elevationDeg: 49.2,
      rangeKm: 910,
      status: 'live',
    },
    panelComparison: {
      role: 'candidate',
      satId: 'sat-comparison',
      beamId: 7,
      sinrDb: 9.1,
      elevationDeg: 42.4,
      rangeKm: 980,
      status: 'derived',
    },
    visualFrequencyDiagnostics,
    servingSatId: 'sat-primary',
    servingBeamId: 5,
    servingElevationDeg: 49.2,
    servingRangeKm: 910,
    pendingTargetSatId: null,
    pendingTargetBeamId: null,
    pendingTargetSinrDb: null,
    comparisonSatId: 'sat-comparison',
    comparisonBeamId: 7,
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
    hoCount: 1,
    intraHoCount: 0,
    simTimeSec: 120,
    lastHoReason: 'validation handover complete',
    beamHopEnabled: profile.beamHopping.enabled,
    beamHopSlotIndex: 8,
    beamHopSlotSec: profile.beamHopping.slotSec,
    servingBeamActiveThisSlot: true,
    servingSatActiveBeamIds: [5],
    pendingTargetActiveBeamIds: [7],
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

function renderDrawerText(
  profile: Profile,
  visualFrequencyDiagnostics?: VisualFrequencyDiagnosticsState,
): string {
  const state = createSimState(profile, visualFrequencyDiagnostics);
  return decodeHtmlText(renderToStaticMarkup(
    React.createElement(DiagnosticsDrawer, {
      ...state,
      uiMode: 'diagnostics',
      profile,
    }),
  ));
}

function assertContains(text: string, expected: string): void {
  assert.ok(text.includes(expected), `expected rendered diagnostics drawer to contain "${expected}"`);
}

function assertNotContains(text: string, unexpected: string): void {
  assert.ok(!text.includes(unexpected), `expected rendered diagnostics drawer not to contain "${unexpected}"`);
}

function assertDrawerSurfacesFrequencyDiagnostics(): void {
  const profile = loadProfile(PROFILE_ID);

  const metadataText = renderDrawerText(profile, {
    primary: {
      satId: 'sat-primary',
      beamId: 5,
      frequencyIndex: 2,
      frequencyIndexSource: 'core-layout',
      runtimeFrequencyReuse: 3,
      coreLayoutFrequencyReuse: 3,
    },
    comparison: {
      satId: 'sat-comparison',
      beamId: 7,
      frequencyIndex: 3,
      frequencyIndexSource: 'runtime-frequency-reuse-compatibility',
      runtimeFrequencyReuse: 4,
      coreLayoutFrequencyReuse: 1,
    },
  });
  assertContains(metadataText, 'VISUAL FREQUENCY SOURCE');
  assertContains(metadataText, 'Primary F F3');
  assertContains(metadataText, 'Primary Source core-layout');
  assertContains(metadataText, 'Primary Runtime K K=3');
  assertContains(metadataText, 'Primary Core FRF FRF=3');
  assertContains(metadataText, 'Comparison F F4');
  assertContains(metadataText, 'Comparison Source runtime-frequency-reuse-compatibility');
  assertContains(metadataText, 'Comparison Runtime K K=4');
  assertContains(metadataText, 'Comparison Core FRF FRF=1');
  assertNotContains(metadataText, 'core-backed truth');

  const fallbackText = renderDrawerText(profile, {
    primary: {
      satId: 'sat-primary',
      beamId: 5,
      frequencyIndex: 1,
      frequencyIndexSource: 'fallback-numeric-modulo',
      runtimeFrequencyReuse: null,
      coreLayoutFrequencyReuse: null,
    },
    comparison: {
      satId: 'sat-comparison',
      beamId: 7,
      frequencyIndex: null,
      frequencyIndexSource: 'not-visible',
      runtimeFrequencyReuse: null,
      coreLayoutFrequencyReuse: null,
    },
  });
  assertContains(fallbackText, 'Primary F F2');
  assertContains(fallbackText, 'Primary Source fallback-numeric-modulo');
  assertContains(fallbackText, 'Comparison F');
  assertContains(fallbackText, 'Comparison Source not-visible');

  const missingPayloadText = renderDrawerText(profile);
  assertContains(missingPayloadText, 'Primary Source not-visible');
  assertContains(missingPayloadText, 'Comparison Source not-visible');
}

function assertStaticWiringAndBoundaries(): void {
  const typesSource = readRepoFile('src/scene/types.ts');
  const useBeamVizSource = readRepoFile('src/scene/useBeamViz.ts');
  const beamVizModelSource = readRepoFile('src/scene/beamVizModel.ts');
  const drawerSource = readRepoFile('src/ui/DiagnosticsDrawer.tsx');
  const packageJson = JSON.parse(readRepoFile('package.json')) as {
    scripts?: Record<string, string>;
  };
  const docsSource = readRepoFile('docs/modqn-baseline-phase5c-frequency-diagnostics.md');

  assert.match(
    typesSource,
    /visualFrequencyDiagnostics\?: VisualFrequencyDiagnosticsState/,
    'SimState lost the visual frequency diagnostics payload',
  );
  assert.match(
    typesSource,
    /frequencyIndexSource: VisualFrequencyDiagnosticsSource/,
    'visual frequency diagnostics lost explicit source typing',
  );
  assert.match(
    typesSource,
    /\| 'not-visible'/,
    'visual frequency diagnostics lost the not-visible source',
  );
  assert.match(
    useBeamVizSource,
    /visualFrequencyByBeamKey = new Map<string, BeamFrequencyIndexResolution>/,
    'Phase 5B visual frequency map is no longer part of the stageable VizFrame contract',
  );
  assert.match(
    useBeamVizSource,
    /visualFrequencyByBeamKey\.set\(coneEntryKey\(/,
    'Phase 5B visual frequency map is no longer keyed by the shared cone entry key',
  );
  assert.match(
    beamVizModelSource,
    /return `\$\{satelliteId\}:B\$\{beamId\}`/,
    'Phase 5B visual frequency map key drifted from ${satId}:B${beamId}',
  );
  assert.doesNotMatch(
    drawerSource,
    /resolveBeamFrequencyIndex|getBeamFrequencyIndex/,
    'DiagnosticsDrawer recomputed visual frequency labels instead of rendering the diagnostics payload',
  );
  assert.match(
    drawerSource,
    /formatFrequencyLabel/,
    'DiagnosticsDrawer does not format frequency indexes as F* labels',
  );
  assert.match(
    drawerSource,
    /VISUAL FREQUENCY SOURCE/,
    'DiagnosticsDrawer lost the visual frequency diagnostics section',
  );
  assert.equal(
    packageJson.scripts?.['validate:modqn:phase5c-frequency-diagnostics'],
    'node --import tsx/esm scripts/validate-modqn-phase5c-frequency-diagnostics.ts',
    'package.json lost the Phase 5C validator script',
  );
  assert.match(
    docsSource,
    /runtime K=`2`, `4`, `5`, and `6`[\s\S]*runtime-frequency-reuse-compatibility/,
    'Phase 5C docs do not preserve unsupported-K runtime compatibility wording',
  );
  assert.match(
    docsSource,
    /not MODQN\s+replay evidence/,
    'Phase 5C docs lost the replay evidence claim boundary',
  );

  const nonScopePathPattern = new RegExp(['src\\/engine\\/sig', 'nal|src\\/engine\\/hand', 'over'].join(''));
  const producerIdentityPattern = new RegExp(['parseModqnReplay', 'Bundle|createBeamLayoutBridge', 'Identity'].join(''));
  const replayEvidencePattern = new RegExp(['HOBS\\/SINR live output as MODQN replay', ' evidence'].join(''), 'i');

  for (const relativePath of [
    'src/scene/types.ts',
    'src/scene/useBeamViz.ts',
    'src/ui/DiagnosticsDrawer.tsx',
    'scripts/validate-modqn-phase5c-frequency-diagnostics.ts',
    'docs/modqn-baseline-phase5c-frequency-diagnostics.md',
  ]) {
    const source = readRepoFile(relativePath);
    assert.doesNotMatch(source, nonScopePathPattern, `${relativePath} touched non-scope engine paths`);
    assert.doesNotMatch(source, producerIdentityPattern, `${relativePath} derived producer replay identity`);
    assert.doesNotMatch(source, replayEvidencePattern, `${relativePath} presented live output as replay evidence`);
  }
}

function assertClaimBoundaryText(): void {
  for (const relativePath of [
    'docs/modqn-baseline-phase5c-frequency-diagnostics.md',
    'scripts/validate-modqn-phase5c-frequency-diagnostics.ts',
    'src/ui/DiagnosticsDrawer.tsx',
  ]) {
    const text = readRepoFile(relativePath);
    for (const [lineIndex, line] of text.split(/\r?\n/).entries()) {
      const normalized = line.replace(/\s+/g, ' ');
      const referencesExtendedCounts = /(19\s*\/\s*37|19[- ]?beam|37[- ]?beam|19\s+or\s+37)/i.test(normalized);
      const referencesEvidence = /trained[- ]baseline MODQN evidence|trained baseline MODQN evidence/i.test(normalized);
      const isNegatedBoundary = /\b(not|no|must not|does not|do not|without|unless|forbidden|reject|remain|remains|sensitivity\/demo|extension only|false|claim boundary)\b/i.test(normalized);

      assert.equal(
        referencesExtendedCounts && referencesEvidence && !isNegatedBoundary,
        false,
        `${relativePath}:${lineIndex + 1} leaks an unsupported 19/37 evidence claim`,
      );
    }
  }
}

function run(): void {
  assertDrawerSurfacesFrequencyDiagnostics();
  assertStaticWiringAndBoundaries();
  assertClaimBoundaryText();

  console.log('MODQN Phase 5C frequency diagnostics validation passed.');
  console.log(JSON.stringify({
    simStatePayload: 'visualFrequencyDiagnostics',
    entries: ['primary', 'comparison'],
    mapKey: '${satId}:B${beamId}',
    sources: [
      'core-layout',
      'runtime-frequency-reuse-compatibility',
      'fallback-numeric-modulo',
      'not-visible',
    ],
    diagnosticsOnly: true,
  }, null, 2));
}

run();
