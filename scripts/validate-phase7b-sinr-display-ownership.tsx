import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHandoverPolicyTuningState } from '../src/handoverPolicyTuning.ts';
import { loadProfile } from '../src/profiles/index.ts';
import type { Profile } from '../src/profiles/types.ts';
import type { LinkBudgetTerms, SimState } from '../src/scene/types.ts';
import { createSignalTuningState } from '../src/signalTuning.ts';
import { InfoPanel } from '../src/ui/InfoPanel.tsx';
import { SignalTuningPanel } from '../src/ui/SignalTuningPanel.tsx';
import { formatSatelliteLabel } from '../src/utils/formatSatelliteLabel.ts';

const PROFILE_ID = 'hobs-2024-candidate-rich';
const SERVING_SAT_ID = 'shell-pro-53-P0-S0';
const CANDIDATE_SAT_ID = 'shell-polar-P1-S3';
const RECENT_SOURCE_SAT_ID = 'shell-retro-P3-S4';
const SERVING_BEAM_ID = 2;
const CANDIDATE_BEAM_ID = 5;
const RECENT_SOURCE_BEAM_ID = 1;

function createBudgetTerms(seed = 0): LinkBudgetTerms {
  return {
    signalDbm: -88.5 + seed,
    intraInterferenceDbm: -113.2 + seed,
    interInterferenceDbm: -110.7 + seed,
    noiseDbm: -103.8,
    denominatorDbm: -106.3 + seed,
    txPowerDbm: 50.5,
    pathLossDb: 151.8,
    beamGainDb: 5.6,
    steeringLossDb: 1.2,
    receiverGainDbi: 2.5,
  };
}

function createTuningState(profile: Profile) {
  const base = createSignalTuningState(profile);
  return {
    ...base,
    maxTxPowerDbm: base.maxTxPowerDbm + 1,
    ueAntennaMaxGainDbi: base.ueAntennaMaxGainDbi + 2.5,
    frequencyReuse: Math.min(base.frequencyReuse + 1, 7),
  };
}

function createSimState(profile: Profile): SimState {
  return {
    profileId: profile.id,
    formulaFamilyLabel: 'HOBS Legacy',
    physicalServing: {
      satId: SERVING_SAT_ID,
      beamId: SERVING_BEAM_ID,
      sinrDb: 13.4,
      elevationDeg: 54.2,
      rangeKm: 860,
      status: 'live',
    },
    panelPrimary: {
      role: 'serving',
      satId: SERVING_SAT_ID,
      beamId: SERVING_BEAM_ID,
      sinrDb: 13.4,
      elevationDeg: 54.2,
      rangeKm: 860,
      status: 'live',
    },
    panelComparison: {
      role: 'candidate',
      satId: CANDIDATE_SAT_ID,
      beamId: CANDIDATE_BEAM_ID,
      sinrDb: 11.1,
      elevationDeg: 47.4,
      rangeKm: 940,
      status: 'derived',
    },
    servingSatId: SERVING_SAT_ID,
    servingBeamId: SERVING_BEAM_ID,
    servingElevationDeg: 54.2,
    servingRangeKm: 860,
    pendingTargetSatId: null,
    pendingTargetBeamId: null,
    pendingTargetSinrDb: null,
    comparisonSatId: CANDIDATE_SAT_ID,
    comparisonBeamId: CANDIDATE_BEAM_ID,
    comparisonElevationDeg: 47.4,
    comparisonRangeKm: 940,
    comparisonSinrDb: 11.1,
    comparisonKind: 'candidate',
    sinrDeltaDb: -2.3,
    recentHoSourceSatId: null,
    recentHoTargetSatId: null,
    sinrDb: 13.4,
    physicalServingBudget: createBudgetTerms(),
    servingBudget: createBudgetTerms(),
    handoverOffsetDb: profile.handover.offsetDb,
    handoverTriggerProgressSec: 0,
    handoverTriggerSec: profile.handover.triggerTimeSec,
    hoCount: 0,
    lastHoReason: '',
    beamHopEnabled: profile.beamHopping.enabled,
    beamHopSlotIndex: 8,
    beamHopSlotSec: profile.beamHopping.slotSec,
    servingBeamActiveThisSlot: true,
    servingSatActiveBeamIds: [SERVING_BEAM_ID],
    pendingTargetActiveBeamIds: [CANDIDATE_BEAM_ID],
  };
}

function createRecentHoState(profile: Profile): SimState {
  return {
    ...createSimState(profile),
    physicalServing: {
      satId: SERVING_SAT_ID,
      beamId: SERVING_BEAM_ID,
      sinrDb: 14.2,
      elevationDeg: 55.1,
      rangeKm: 850,
      status: 'live',
    },
    panelPrimary: {
      role: 'ho-source',
      satId: RECENT_SOURCE_SAT_ID,
      beamId: RECENT_SOURCE_BEAM_ID,
      sinrDb: 6.4,
      elevationDeg: 39.2,
      rangeKm: 1010,
      status: 'recent-ho',
    },
    panelComparison: {
      role: 'ho-target',
      satId: SERVING_SAT_ID,
      beamId: SERVING_BEAM_ID,
      sinrDb: 14.2,
      elevationDeg: 55.1,
      rangeKm: 850,
      status: 'recent-ho',
    },
    servingSatId: RECENT_SOURCE_SAT_ID,
    servingBeamId: RECENT_SOURCE_BEAM_ID,
    servingElevationDeg: 39.2,
    servingRangeKm: 1010,
    comparisonSatId: SERVING_SAT_ID,
    comparisonBeamId: SERVING_BEAM_ID,
    comparisonElevationDeg: 55.1,
    comparisonRangeKm: 850,
    comparisonSinrDb: 14.2,
    comparisonKind: 'recent-ho',
    recentHoSourceSatId: RECENT_SOURCE_SAT_ID,
    recentHoTargetSatId: SERVING_SAT_ID,
    sinrDb: 6.4,
    physicalServingBudget: createBudgetTerms(1),
    servingBudget: createBudgetTerms(-1),
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

function renderTuningPanel(profile: Profile, state: SimState) {
  const markup = renderToStaticMarkup(
    <SignalTuningPanel
      baseProfile={profile}
      tuning={createTuningState(profile)}
      hasOverrides
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
  );

  return { markup, text: decodeHtmlText(markup) };
}

function assertContains(text: string, expected: string): void {
  assert.ok(text.includes(expected), `expected rendered UI to contain "${expected}"`);
}

function assertNotContains(text: string, unexpected: string): void {
  assert.ok(!text.includes(unexpected), `expected rendered UI not to contain "${unexpected}"`);
}

function run(): void {
  const profile = loadProfile(PROFILE_ID);
  const operationalState = createSimState(profile);

  const infoMarkup = renderToStaticMarkup(
    <InfoPanel {...operationalState} uiMode="tuning" profile={profile} />,
  );
  const infoText = decodeHtmlText(infoMarkup);

  assertContains(infoMarkup, 'data-testid="info-panel-primary-sinr-status"');
  assertContains(infoMarkup, 'data-testid="info-panel-comparison-sinr-status"');
  assertContains(infoMarkup, 'data-ownership="operational-sinr-status"');
  assertContains(infoText, 'ACTIVE SERVING');
  assertContains(infoText, 'BEST CANDIDATE');
  assertContains(infoText, '13.4 dB');
  assertContains(infoText, '11.1 dB');

  const { markup: tuningMarkup, text: tuningText } = renderTuningPanel(profile, operationalState);
  assertContains(tuningMarkup, 'data-testid="formula-result-readout"');
  assertContains(tuningMarkup, 'data-ownership="formula-verification"');
  assertContains(tuningMarkup, 'data-visual-weight="secondary"');
  assertContains(tuningMarkup, 'data-testid="formula-term-evidence"');
  assertContains(tuningMarkup, 'data-visual-weight="primary"');
  assertContains(tuningText, 'Formula Verification');
  assertContains(tuningText, 'selected source formula result');
  assertContains(tuningText, 'Formula term evidence');
  assertContains(tuningText, 'numerator / signalDbm');
  assertContains(tuningText, 'intra interference');
  assertContains(tuningText, 'inter interference');
  assertContains(tuningText, 'noise σ² / noiseDbm');
  assertContains(tuningText, 'transmit gain pattern');
  assertContains(tuningText, 'receiver gain');
  assertContains(tuningText, 'path loss');
  assertContains(tuningText, 'effective transmit power');
  assertContains(tuningText, 'Overrides feeding computeLinkBudget');
  assertContains(tuningMarkup, 'data-term="signalDbm"');
  assertContains(tuningMarkup, 'data-term="transmitGain"');
  assertContains(tuningMarkup, 'data-term="receiverGain"');
  assertContains(tuningMarkup, 'data-term="pathLoss"');
  assertContains(tuningMarkup, 'data-term="intraInterference"');
  assertContains(tuningMarkup, 'data-term="interInterference"');
  assertContains(tuningMarkup, 'data-term="noiseDbm"');
  assertNotContains(tuningText, 'ACTIVE SERVING');
  assertNotContains(tuningText, 'BEST CANDIDATE');
  assertNotContains(tuningText, 'PENDING TARGET');

  const recentHoState = createRecentHoState(profile);
  const recentInfoText = decodeHtmlText(renderToStaticMarkup(
    <InfoPanel {...recentHoState} uiMode="tuning" profile={profile} />,
  ));
  const recentTuningText = renderTuningPanel(profile, recentHoState).text;
  const physicalServingLabel = formatSatelliteLabel(SERVING_SAT_ID);
  const hoSourceLabel = formatSatelliteLabel(RECENT_SOURCE_SAT_ID);

  assertContains(recentInfoText, 'HO SOURCE');
  assertContains(recentInfoText, hoSourceLabel);
  assertContains(recentTuningText, physicalServingLabel);
  assertContains(recentTuningText, 'physical serving source');
  assertNotContains(recentTuningText, hoSourceLabel);
  assertNotContains(recentTuningText, 'HO SOURCE');
  assertNotContains(recentTuningText, 'ACTIVE SERVING');

  console.log('Phase 7B SINR display ownership validation passed.');
  console.log(JSON.stringify({
    profileId: PROFILE_ID,
    asserted: {
      rightPanel: [
        'Tuning-mode InfoPanel owns operational serving SINR status',
        'Tuning-mode InfoPanel owns operational candidate SINR status',
      ],
      leftPanel: [
        'SignalTuningPanel labels SINR as selected source formula result',
        'formula terms have primary visual-weight marker',
        'final formula result has secondary visual-weight marker',
        'active runtime overrides are shown as computeLinkBudget inputs',
      ],
      recentHo: [
        'right panel may show recent HO source',
        'left formula source remains physicalServing and does not call HO source active serving',
      ],
    },
  }, null, 2));
}

run();
