import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { computeLinkBudget } from '../src/engine/signal/link-budget.ts';
import { sampleLosStateTr38811 } from '../src/engine/signal/los-probability.ts';
import { computeFsplDb, computePathLossDb } from '../src/engine/signal/path-loss.ts';
import type { ActiveBeamAssignment, SatelliteSnapshot, UEPosition } from '../src/engine/signal/types.ts';
import { createHandoverPolicyTuningState } from '../src/handoverPolicyTuning.ts';
import { loadProfile, profileList } from '../src/profiles/index.ts';
import {
  DEFAULT_CHANNEL_LOSS_OVERRIDES,
  DEFAULT_TR38811_CHANNEL,
  type PathLossComponent,
  type Profile,
} from '../src/profiles/types.ts';
import { createInitialSimState } from '../src/scene/initialSimState.ts';
import type { LinkBudgetTerms, SignalSourceState, SimState } from '../src/scene/types.ts';
import {
  applySignalTuning,
  createSignalTuningState,
  getSignalTuningEvidenceKey,
  getSignalTuningResetKey,
  hasSignalTuningOverrides,
} from '../src/signalTuning.ts';
import { InfoPanel } from '../src/ui/InfoPanel.tsx';
import { SignalTuningPanel } from '../src/ui/SignalTuningPanel.tsx';

const EPSILON_DB = 1e-9;

const ue: UEPosition = {
  latDeg: 40,
  lonDeg: 116,
  offsetEastKm: 0,
  offsetNorthKm: 0,
};

const snapshots: SatelliteSnapshot[] = [
  {
    id: 'sat-a',
    shellId: 'shell-a',
    altitudeKm: 550,
    ecefKm: [0, 0, 0],
    rangeKm: 900,
    elevationDeg: 55,
    azimuthDeg: 40,
    beamCellsKm: [
      { beamId: 1, offsetEastKm: 0, offsetNorthKm: 0, scanAngleDeg: 0 },
      { beamId: 4, offsetEastKm: 8, offsetNorthKm: 0, scanAngleDeg: 2 },
    ],
  },
  {
    id: 'sat-b',
    shellId: 'shell-b',
    altitudeKm: 550,
    ecefKm: [0, 0, 0],
    rangeKm: 940,
    elevationDeg: 50,
    azimuthDeg: 150,
    beamCellsKm: [
      { beamId: 1, offsetEastKm: -7, offsetNorthKm: 3, scanAngleDeg: 3 },
    ],
  },
];

const activeAssignments: ActiveBeamAssignment[] = [
  { satId: 'sat-a', beamId: 1 },
  { satId: 'sat-a', beamId: 4 },
  { satId: 'sat-b', beamId: 1 },
];

function assertClose(actual: number, expected: number, message: string): void {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
    assert.equal(actual, expected, message);
    return;
  }

  assert.ok(
    Math.abs(actual - expected) <= EPSILON_DB,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

function assertContains(text: string, expected: string): void {
  assert.ok(text.includes(expected), `expected content to contain "${expected}"`);
}

function assertNotContains(text: string, unexpected: string): void {
  assert.ok(!text.includes(unexpected), `expected content not to contain "${unexpected}"`);
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

function stripPhase8bChannelDefaults(profile: Profile): Profile {
  const {
    lossOverrides: _lossOverrides,
    tr38811: _tr38811,
    ...channel
  } = profile.channel;

  return {
    ...profile,
    channel,
  };
}

function computeSamples(profile: Profile, simTimeSec = 60) {
  return computeLinkBudget(ue, snapshots, {
    formulaFamily: profile.formulaFamily,
    channel: profile.channel,
    antenna: profile.antenna,
    ueAntenna: profile.ueAntenna,
    beams: profile.beams,
    activeAssignments,
    simTimeSec,
  }).sort((a, b) => a.satId.localeCompare(b.satId) || a.beamId - b.beamId);
}

function assertSameBudgetSamples(
  actual: ReturnType<typeof computeSamples>,
  expected: ReturnType<typeof computeSamples>,
  label: string,
): void {
  assert.equal(actual.length, expected.length, `${label}: sample count`);

  for (let i = 0; i < expected.length; i += 1) {
    const actualSample = actual[i];
    const expectedSample = expected[i];
    assert.equal(actualSample.satId, expectedSample.satId, `${label}: sat id @ ${i}`);
    assert.equal(actualSample.beamId, expectedSample.beamId, `${label}: beam id @ ${i}`);
    assertClose(actualSample.pathLossDb, expectedSample.pathLossDb, `${label}: pathLossDb`);
    assertClose(actualSample.signalDbm, expectedSample.signalDbm, `${label}: signalDbm`);
    assertClose(actualSample.intraInterferenceDbm, expectedSample.intraInterferenceDbm, `${label}: intraInterferenceDbm`);
    assertClose(actualSample.interInterferenceDbm, expectedSample.interInterferenceDbm, `${label}: interInterferenceDbm`);
    assertClose(actualSample.noiseDbm, expectedSample.noiseDbm, `${label}: noiseDbm`);
    assertClose(actualSample.denominatorDbm, expectedSample.denominatorDbm, `${label}: denominatorDbm`);
    assertClose(actualSample.sinrDb, expectedSample.sinrDb, `${label}: sinrDb`);
  }
}

function profileWithPathLossComponents(
  profile: Profile,
  components: PathLossComponent[],
  lossOverrides: Profile['channel']['lossOverrides'],
): Profile {
  return {
    ...profile,
    channel: {
      ...profile.channel,
      pathLossComponents: components,
      lossOverrides,
    },
  };
}

function computeSinglePathLoss(profile: Profile): number {
  const sample = computeSamples(profile)[0];
  assert.ok(sample, 'expected at least one link-budget sample');
  return sample.pathLossDb;
}

function assertDefaultPreservation(): void {
  for (const profile of profileList) {
    const baseTuning = createSignalTuningState(profile);
    assert.equal(
      hasSignalTuningOverrides(profile, baseTuning),
      false,
      `${profile.id} Phase 8B defaults must not create a runtime override`,
    );
    assert.equal(baseTuning.atmosphericZenithLossDb, DEFAULT_CHANNEL_LOSS_OVERRIDES.atmosphericZenithLossDb);
    assert.equal(baseTuning.scintillationScaleDb, DEFAULT_CHANNEL_LOSS_OVERRIDES.scintillationScaleDb);
    assert.equal(baseTuning.shadowFadingMarginDb, DEFAULT_CHANNEL_LOSS_OVERRIDES.shadowFadingMarginDb);
    assert.equal(baseTuning.tr38811NlosClutterLossDb, DEFAULT_TR38811_CHANNEL.nlosClutterLossDb);

    const prePhase8bProfile = stripPhase8bChannelDefaults(profile);
    const explicitDefaultProfile = applySignalTuning(profile, baseTuning);
    assertSameBudgetSamples(
      computeSamples(explicitDefaultProfile),
      computeSamples(prePhase8bProfile),
      `${profile.id} default-preservation`,
    );
  }

  const elevationDeg = 30;
  const sinEl = Math.sin(elevationDeg * Math.PI / 180);
  const expectedOldLoss =
    computeFsplDb(900, 28)
    + DEFAULT_CHANNEL_LOSS_OVERRIDES.atmosphericZenithLossDb / sinEl
    + DEFAULT_CHANNEL_LOSS_OVERRIDES.scintillationScaleDb / sinEl
    + DEFAULT_CHANNEL_LOSS_OVERRIDES.shadowFadingMarginDb;
  assertClose(
    computePathLossDb(900, 28, elevationDeg, ['fspl', 'atmospheric', 'scintillation', 'shadow-fading']),
    expectedOldLoss,
    'default path loss must preserve pre-Phase-8B constants',
  );
}

function assertDisabledTermsDoNotContribute(): void {
  const profile = loadProfile('hobs-2024-paper-default');
  const allComponents = createSignalTuningState(profile).pathLossComponents;
  const highOverrideByComponent = {
    atmospheric: { ...DEFAULT_CHANNEL_LOSS_OVERRIDES, atmosphericZenithLossDb: 1 },
    scintillation: { ...DEFAULT_CHANNEL_LOSS_OVERRIDES, scintillationScaleDb: 1 },
    'shadow-fading': { ...DEFAULT_CHANNEL_LOSS_OVERRIDES, shadowFadingMarginDb: 10 },
  } satisfies Record<'atmospheric' | 'scintillation' | 'shadow-fading', typeof DEFAULT_CHANNEL_LOSS_OVERRIDES>;

  for (const component of ['atmospheric', 'scintillation', 'shadow-fading'] as const) {
    const withoutComponent = allComponents.filter(entry => entry !== component);
    const defaultOff = profileWithPathLossComponents(
      profile,
      withoutComponent,
      DEFAULT_CHANNEL_LOSS_OVERRIDES,
    );
    const highOff = profileWithPathLossComponents(profile, withoutComponent, highOverrideByComponent[component]);
    assertClose(
      computeSinglePathLoss(highOff),
      computeSinglePathLoss(defaultOff),
      `${component} numeric override must not contribute while toggle is off`,
    );
  }
}

function buildSingleSnapshot(satId: string, beamId: number, elevationDeg: number): SatelliteSnapshot[] {
  return [{
    id: satId,
    shellId: 'hobs-baseline',
    altitudeKm: 550,
    ecefKm: [0, 0, 0],
    rangeKm: 900,
    elevationDeg,
    azimuthDeg: 0,
    beamCellsKm: [
      { beamId, offsetEastKm: 0, offsetNorthKm: 0, scanAngleDeg: 0 },
    ],
  }];
}

function findSimTimeForLosState(
  satId: string,
  beamId: number,
  elevationDeg: number,
  desiredLosState: boolean,
): number {
  for (let second = 0; second < 2000; second += 1) {
    const seedKey = `${satId}|${beamId}|${second}`;
    if (sampleLosStateTr38811(elevationDeg, DEFAULT_TR38811_CHANNEL.environment, seedKey) === desiredLosState) {
      return second + 0.25;
    }
  }

  throw new Error(`could not find deterministic ${desiredLosState ? 'LoS' : 'NLoS'} seed`);
}

function computeSingleTr38811Sample(profile: Profile, simTimeSec: number, elevationDeg: number) {
  const satId = 'sat-tr';
  const beamId = 1;
  const samples = computeLinkBudget(ue, buildSingleSnapshot(satId, beamId, elevationDeg), {
    formulaFamily: profile.formulaFamily,
    channel: profile.channel,
    antenna: profile.antenna,
    ueAntenna: profile.ueAntenna,
    beams: profile.beams,
    activeAssignments: [{ satId, beamId }],
    simTimeSec,
  });
  const sample = samples.find(entry => entry.satId === satId && entry.beamId === beamId);
  assert.ok(sample, 'expected single TR 38.811 sample');
  return sample;
}

function withNlosClutter(profile: Profile, nlosClutterLossDb: number): Profile {
  return {
    ...profile,
    channel: {
      ...profile.channel,
      tr38811: {
        ...DEFAULT_TR38811_CHANNEL,
        ...profile.channel.tr38811,
        nlosClutterLossDb,
      },
    },
  };
}

function assertTr38811NlosClutterGating(): void {
  const trProfile = loadProfile('hobs-2024-tr38811-research');
  const legacyProfile = loadProfile('hobs-2024-paper-default');
  const elevationDeg = 10;
  const nlosTimeSec = findSimTimeForLosState('sat-tr', 1, elevationDeg, false);
  const losTimeSec = findSimTimeForLosState('sat-tr', 1, elevationDeg, true);

  const lowNlos = computeSingleTr38811Sample(withNlosClutter(trProfile, 20), nlosTimeSec, elevationDeg);
  const highNlos = computeSingleTr38811Sample(withNlosClutter(trProfile, 30), nlosTimeSec, elevationDeg);
  assertClose(highNlos.pathLossDb - lowNlos.pathLossDb, 10, 'NLoS clutter delta must enter pathLossDb');
  assertClose(lowNlos.signalDbm - highNlos.signalDbm, 10, 'NLoS clutter delta must lower signalDbm');
  assertClose(highNlos.denominatorDbm, lowNlos.denominatorDbm, 'NLoS clutter must not directly change denominator');
  assertClose(lowNlos.sinrDb - highNlos.sinrDb, 10, 'NLoS clutter delta must lower SINR');

  const lowLos = computeSingleTr38811Sample(withNlosClutter(trProfile, 20), losTimeSec, elevationDeg);
  const highLos = computeSingleTr38811Sample(withNlosClutter(trProfile, 30), losTimeSec, elevationDeg);
  assertClose(highLos.pathLossDb, lowLos.pathLossDb, 'NLoS clutter must not affect seeded LoS samples');
  assertClose(highLos.signalDbm, lowLos.signalDbm, 'NLoS clutter must not affect LoS signalDbm');
  assertClose(highLos.sinrDb, lowLos.sinrDb, 'NLoS clutter must not affect LoS SINR');

  const legacyLow = computeSingleTr38811Sample(withNlosClutter(legacyProfile, 0), nlosTimeSec, elevationDeg);
  const legacyHigh = computeSingleTr38811Sample(withNlosClutter(legacyProfile, 40), nlosTimeSec, elevationDeg);
  assertClose(legacyHigh.pathLossDb, legacyLow.pathLossDb, 'NLoS clutter must be ignored outside hobs-tr38811');
}

function createBudgetTerms(): LinkBudgetTerms {
  return {
    signalDbm: -91,
    intraInterferenceDbm: -120,
    interInterferenceDbm: -118,
    noiseDbm: -104,
    denominatorDbm: -103,
    txPowerDbm: 50,
    pathLossDb: 152,
    beamGainDb: 39,
    steeringLossDb: 1,
    receiverGainDbi: 0,
  };
}

function createFormulaSource(): SignalSourceState {
  return {
    satId: 'sat-a',
    beamId: 1,
    sinrDb: 12.5,
    elevationDeg: 55,
    rangeKm: 900,
    status: 'live',
  };
}

function createInfoState(profile: Profile): SimState {
  const source = createFormulaSource();
  const budget = createBudgetTerms();
  const base = createInitialSimState(profile);

  return {
    ...base,
    physicalServing: source,
    panelPrimary: { ...source, role: 'serving' },
    servingSatId: source.satId,
    servingBeamId: source.beamId,
    servingElevationDeg: source.elevationDeg,
    servingRangeKm: source.rangeKm,
    sinrDb: source.sinrDb ?? -Infinity,
    physicalServingBudget: budget,
    servingBudget: budget,
    servingBeamActiveThisSlot: true,
  };
}

function renderLossPanelMarkup(profile: Profile, tuning = createSignalTuningState(profile)): string {
  return renderToStaticMarkup(
    <SignalTuningPanel
      baseProfile={profile}
      tuning={tuning}
      hasOverrides={hasSignalTuningOverrides(profile, tuning)}
      currentSinrDb={12.5}
      formulaBudget={createBudgetTerms()}
      formulaSource={createFormulaSource()}
      initialActiveTab="loss"
      handoverDraft={createHandoverPolicyTuningState(profile)}
      appliedHandoverPolicy={createHandoverPolicyTuningState(profile)}
      hasHandoverDraftChanges={false}
      hasHandoverOverrides={false}
      onTuningChange={() => {}}
      onReset={() => {}}
      onHandoverDraftChange={() => {}}
      onApplyHandoverPolicy={() => {}}
      onResetHandoverPolicy={() => {}}
    />,
  );
}

function assertPhase8DNlosClutterUx(): void {
  const trProfile = loadProfile('hobs-2024-tr38811-research');
  const trTuning = createSignalTuningState(trProfile);
  const editedTrTuning = {
    ...trTuning,
    tr38811NlosClutterLossDb: trTuning.tr38811NlosClutterLossDb + 5,
  };
  const editedTrProfile = applySignalTuning(trProfile, editedTrTuning);

  assert.equal(trProfile.formulaFamily, 'hobs-tr38811');
  assert.equal(trTuning.tr38811NlosClutterLossDb, 20, 'TR 38.811 profile keeps the Phase 8B default');
  assert.equal(
    hasSignalTuningOverrides(trProfile, editedTrTuning),
    true,
    'editing L_cl,NLoS in hobs-tr38811 must update tuning override state',
  );
  assert.notEqual(
    getSignalTuningEvidenceKey(editedTrTuning),
    getSignalTuningEvidenceKey(trTuning),
    'editing L_cl,NLoS must mark formula evidence stale through the tuning evidence key',
  );
  assert.equal(
    editedTrProfile.channel.tr38811?.nlosClutterLossDb,
    editedTrTuning.tr38811NlosClutterLossDb,
    'editing L_cl,NLoS must flow into channel.tr38811.nlosClutterLossDb',
  );

  const trMarkup = renderLossPanelMarkup(trProfile, trTuning);
  const trText = decodeHtmlText(trMarkup);
  assertContains(trMarkup, 'data-testid="lcl-nlos-control"');
  assertContains(trMarkup, 'aria-label="NLoS clutter loss (dB)"');
  assert.match(
    trMarkup,
    /aria-label="NLoS clutter loss \(dB\)" aria-disabled="false" min="0" max="40" step="0\.5"/,
    'hobs-tr38811 L_cl,NLoS must render as an editable 0-40 dB range',
  );
  assertContains(trText, 'Editable in the HOBS + TR 38.811 research profile');
  assertContains(trText, 'Seeded LoS samples do not change');
  assertNotContains(trMarkup, 'data-testid="lcl-nlos-inactive-callout"');

  const legacyProfile = loadProfile('hobs-2024-paper-default');
  const legacyMarkup = renderLossPanelMarkup(legacyProfile);
  const legacyText = decodeHtmlText(legacyMarkup);
  assert.equal(legacyProfile.formulaFamily, 'hobs-legacy');
  assertNotContains(legacyMarkup, 'data-testid="lcl-nlos-inactive-callout"');
  assertNotContains(legacyMarkup, 'data-control-type="inactive-callout"');
  assertNotContains(legacyMarkup, 'aria-label="NLoS clutter loss TR 38.811-only inactive"');
  assertNotContains(legacyMarkup, 'data-testid="lcl-nlos-control"');
  assertNotContains(legacyMarkup, 'aria-label="NLoS clutter loss (dB)"');
  assertNotContains(legacyText, 'Lcl,NLoS');
  assertNotContains(legacyText, 'NLoS clutter loss');
  assertNotContains(legacyText, 'TR 38.811 NLoS clutter');
  assertNotContains(legacyText, 'Legacy HOBS formulas ignore this value');
  assertNotContains(legacyText, 'Seeded LoS samples do not change');
}

function assertPlacementCopyAndStaleMarkup(): void {
  const tuningSource = readFileSync(new URL('../src/ui/SignalTuningPanel.tsx', import.meta.url), 'utf8');
  assertContains(tuningSource, 'testId="loss-formula-controls"');
  assertContains(tuningSource, 'title="Formula controls"');
  assertContains(tuningSource, 'testId="loss-research-override"');
  assertContains(tuningSource, 'title="Research Override"');
  assertContains(tuningSource, 'not HOBS paper-backed parameter ranges');
  assertContains(tuningSource, 'disabled={!atmosphericEnabled}');
  assertContains(tuningSource, 'disabled={!scintillationEnabled}');
  assertContains(tuningSource, 'disabled={!shadowFadingEnabled}');
  assertContains(tuningSource, 'isTr38811Formula && (');
  assertContains(tuningSource, 'testId="lcl-nlos-control"');
  assertNotContains(tuningSource, 'NlosClutterInactiveCallout');
  assertContains(tuningSource, 'Read-only in Phase 8B; no editable environment selector');
  assertNotContains(tuningSource, 'TR 38.811 environment selector');
  assertNotContains(tuningSource, 'beamPowerControl');

  const profile = loadProfile('hobs-2024-paper-default');
  const staleTuningMarkup = renderToStaticMarkup(
    <SignalTuningPanel
      baseProfile={profile}
      tuning={createSignalTuningState(profile)}
      hasOverrides={false}
      currentSinrDb={12.5}
      formulaBudget={createBudgetTerms()}
      formulaSource={createFormulaSource()}
      isFormulaEvidenceStale
      handoverDraft={createHandoverPolicyTuningState(profile)}
      appliedHandoverPolicy={createHandoverPolicyTuningState(profile)}
      hasHandoverDraftChanges={false}
      hasHandoverOverrides={false}
      onTuningChange={() => {}}
      onReset={() => {}}
      onHandoverDraftChange={() => {}}
      onApplyHandoverPolicy={() => {}}
      onResetHandoverPolicy={() => {}}
    />,
  );
  const staleTuningText = decodeHtmlText(staleTuningMarkup);
  assertContains(staleTuningText, 'SINR Formula Tuning');
  assertNotContains(staleTuningMarkup, 'data-testid="formula-term-evidence"');

  const staleInfoMarkup = renderToStaticMarkup(
    <InfoPanel
      {...createInfoState(profile)}
      uiMode="tuning"
      profile={profile}
      isFormulaEvidenceStale
    />,
  );
  const staleInfoText = decodeHtmlText(staleInfoMarkup);
  assertContains(staleInfoMarkup, 'data-formula-evidence-status="stale"');
  assertContains(staleInfoText, 'stale after edit; waiting for next recomputed frame');
  assertContains(staleInfoText, 'Formula evidence is stale after a runtime edit');
  assertContains(staleInfoMarkup, 'data-testid="formula-term-evidence"');
  assertContains(staleInfoMarkup, 'data-testid="formula-term-grid"');
  assertContains(staleInfoMarkup, 'data-term="signalDbm"');
  assertContains(staleInfoMarkup, 'data-term="denominator"');
  assertContains(staleInfoText, '-91.0 dBm stale');
}

function assertResetAndRuntimeBoundaries(): void {
  const signalTuningSource = readFileSync(new URL('../src/signalTuning.ts', import.meta.url), 'utf8');
  const resetStart = signalTuningSource.indexOf('export function getSignalTuningResetKey');
  assert.ok(resetStart >= 0, 'expected getSignalTuningResetKey');
  const resetBlock = signalTuningSource.slice(resetStart);
  assertContains(resetBlock, 'beamwidth3dBDeg');
  assertContains(resetBlock, 'maxSteeringAngleDeg');
  assertNotContains(resetBlock, 'atmosphericZenithLossDb');
  assertNotContains(resetBlock, 'scintillationScaleDb');
  assertNotContains(resetBlock, 'shadowFadingMarginDb');
  assertNotContains(resetBlock, 'tr38811NlosClutterLossDb');

  const defaultResetKey = getSignalTuningResetKey(createSignalTuningState(loadProfile('hobs-2024-paper-default')));
  const lossEdited = {
    ...createSignalTuningState(loadProfile('hobs-2024-paper-default')),
    atmosphericZenithLossDb: 0.6,
    scintillationScaleDb: 0.4,
    shadowFadingMarginDb: 5,
    tr38811NlosClutterLossDb: 35,
  };
  assert.equal(
    getSignalTuningResetKey(lossEdited),
    defaultResetKey,
    'loss-only edits must not enter structural signal reset key',
  );

  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assertContains(appSource, 'setStaleFormulaEvidenceKey(getSignalTuningEvidenceKey(next))');
  assertContains(appSource, 'isFormulaEvidenceStale={staleFormulaEvidenceKey !== null}');
  assertNotContains(appSource, 'setSimState(createInitialSimState(effectiveProfile));');

  const useSimulationSource = readFileSync(new URL('../src/scene/useSimulation.ts', import.meta.url), 'utf8');
  assertContains(useSimulationSource, 'Profile-backed SINR controls must refresh the React UI even when simulation time is paused.');
  assertContains(useSimulationSource, 'publishNextFrameRef.current = true;');
}

function run(): void {
  assertDefaultPreservation();
  assertDisabledTermsDoNotContribute();
  assertTr38811NlosClutterGating();
  assertPhase8DNlosClutterUx();
  assertPlacementCopyAndStaleMarkup();
  assertResetAndRuntimeBoundaries();

  console.log('Phase 8B/8D path-loss research controls validation passed.');
  console.log(JSON.stringify({
    asserted: {
      defaults: [
        'profile/default-backed values preserve pre-Phase-8B pathLossDb, signalDbm, denominator terms, and SINR',
        'default tuning state does not create runtime overrides',
      ],
      ui: [
        'Loss tab contains Formula controls and Research Override sections',
        'Research Override copy marks non-paper teaching / sensitivity controls',
        'hobs-tr38811 renders editable L_cl,NLoS control and legacy profiles hide L_cl,NLoS entirely',
        'formula evidence is marked stale between edit and recompute',
      ],
      runtime: [
        'L_g, L_sc, and L_sf numeric overrides are inactive when toggles are off',
        'L_cl,NLoS is gated to hobs-tr38811 and seeded NLoS samples',
        'loss-only edits do not enter the structural reset key',
      ],
    },
  }, null, 2));
}

run();
