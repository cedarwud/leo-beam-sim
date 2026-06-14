import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  getFormulaFamilyLabel,
  loadProfile,
} from '../src/profiles/index.ts';
import type { Profile } from '../src/profiles/types.ts';
import type { LinkBudgetTerms, SimState } from '../src/scene/types.ts';
import { createHandoverPolicyTuningState } from '../src/handoverPolicyTuning.ts';
import { createSignalTuningState } from '../src/signalTuning.ts';
import { DiagnosticsDrawer } from '../src/ui/DiagnosticsDrawer.tsx';
import { InfoPanel } from '../src/ui/InfoPanel.tsx';
import { SignalTuningPanel } from '../src/ui/SignalTuningPanel.tsx';

const RESEARCH_PROFILE_ID = 'hobs-2024-tr38811-research';
const LEGACY_PROFILE_ID = 'hobs-2024-paper-default';

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
    recentHoSourceBeamId: null,
    recentHoTargetBeamId: null,
    recentHoDeltaDb: null,
    lastHoEvent: null,
    simTimeSec: 0,
    sinrDb: 12.5,
    physicalServingBudget,
    servingBudget: physicalServingBudget,
    handoverOffsetDb: profile.handover.offsetDb,
    handoverTriggerProgressSec: 0,
    handoverTriggerSec: profile.handover.triggerTimeSec,
    hoCount: 0,
    intraHoCount: 0,
    lastHoReason: '',
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

function renderInfoText(profile: Profile, uiMode: 'presentation' | 'tuning' | 'diagnostics'): string {
  const state = createSimState(profile, createBudgetTerms(47.5));
  return decodeHtmlText(renderToStaticMarkup(
    <>
      <InfoPanel {...state} uiMode={uiMode} profile={profile} />
      <DiagnosticsDrawer {...state} uiMode={uiMode} profile={profile} />
    </>,
  ));
}

function renderTuningText(profile: Profile): string {
  const state = createSimState(profile, createBudgetTerms(47.5));
  return decodeHtmlText(renderToStaticMarkup(
    <SignalTuningPanel
      baseProfile={profile}
      tuning={createSignalTuningState(profile)}
      hasOverrides={false}
      currentSinrDb={state.physicalServing.sinrDb ?? -Infinity}
      formulaBudget={state.physicalServingBudget}
      formulaSource={state.physicalServing}
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
  ));
}

function assertContains(text: string, expected: string): void {
  assert.ok(text.includes(expected), `expected rendered UI to contain "${expected}"`);
}

function assertNotContains(text: string, unexpected: string): void {
  assert.ok(!text.includes(unexpected), `expected rendered UI not to contain "${unexpected}"`);
}

function run(): void {
  const researchProfile = loadProfile(RESEARCH_PROFILE_ID);
  const legacyProfile = loadProfile(LEGACY_PROFILE_ID);

  assert.equal(researchProfile.formulaFamily, 'hobs-tr38811');
  assert.ok(researchProfile.channel.beamPowerControl, 'research profile must define beamPowerControl');
  assert.equal(legacyProfile.formulaFamily, 'hobs-legacy');
  assert.equal(legacyProfile.channel.beamPowerControl, undefined);

  const diagnosticsText = renderInfoText(researchProfile, 'diagnostics');
  assertContains(diagnosticsText, 'DPC: research power policy');
  assertContains(diagnosticsText, 'TR 38.811-gated research power policy');
  assertContains(diagnosticsText, 'Enabled only for HOBS + TR 38.811 research profile');
  assertContains(diagnosticsText, 'Base P_t remains the Tuning control');
  assertContains(diagnosticsText, 'DPC may override per-beam P_{n,m}(t)');
  assertContains(diagnosticsText, 'Update Period');
  assertContains(diagnosticsText, 'Step Size');
  assertContains(diagnosticsText, 'Min Effective');
  assertContains(diagnosticsText, 'Max / Clamp');
  assertContains(diagnosticsText, 'SINR Threshold');
  assertContains(diagnosticsText, '47.5 dBm physical-serving effective P_t');

  const missingBudgetText = decodeHtmlText(renderToStaticMarkup(
    <>
      <InfoPanel
        {...createSimState(researchProfile, null)}
        uiMode="diagnostics"
        profile={researchProfile}
      />
      <DiagnosticsDrawer
        {...createSimState(researchProfile, null)}
        uiMode="diagnostics"
        profile={researchProfile}
      />
    </>,
  ));
  assertContains(missingBudgetText, 'missing from current LinkBudgetTerms');

  const presentationText = renderInfoText(researchProfile, 'presentation');
  assertNotContains(presentationText, 'DPC: research power policy');
  assertNotContains(presentationText, 'Update Period');
  assertNotContains(presentationText, 'physical-serving effective P_t');

  const tuningInfoText = renderInfoText(researchProfile, 'tuning');
  const tuningPanelText = renderTuningText(researchProfile);
  assertNotContains(tuningInfoText, 'DPC: research power policy');
  assertNotContains(tuningInfoText, 'Update Period');
  assertNotContains(tuningPanelText, 'DPC: research power policy');
  assertNotContains(tuningPanelText, 'Update Period');
  assertNotContains(tuningPanelText, 'Step Size');
  assertNotContains(tuningPanelText, 'SINR Threshold');
  assertContains(tuningPanelText, 'Base transmit power before dynamic power control overrides.');

  const legacyDiagnosticsText = renderInfoText(legacyProfile, 'diagnostics');
  assertNotContains(legacyDiagnosticsText, 'DPC: research power policy');
  assertNotContains(legacyDiagnosticsText, 'Enabled only for HOBS + TR 38.811 research profile');
  assertNotContains(legacyDiagnosticsText, 'Max / Clamp');

  console.log('Phase 5B Diagnostics DPC status validation passed.');
  console.log(JSON.stringify({
    researchProfileId: researchProfile.id,
    legacyProfileId: legacyProfile.id,
    asserted: {
      diagnosticsResearch: [
        'read-only DPC status block',
        'TR 38.811 research gate copy',
        'base P_t versus effective per-beam DPC power copy',
        'current effective physical-serving P_t from LinkBudgetTerms',
      ],
      hiddenSurfaces: [
        'Presentation mode',
        'Tuning mode editable-control surface',
        'legacy profile Diagnostics',
      ],
    },
  }, null, 2));
}

run();
