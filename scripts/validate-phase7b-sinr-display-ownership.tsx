import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadProfile } from '../src/profiles/index.ts';
import type { Profile } from '../src/profiles/types.ts';
import type { LinkBudgetTerms, SimState } from '../src/scene/types.ts';
import { createSceneTopologyState } from '../src/sceneTopology.ts';
import { createSceneVisualScaleState } from '../src/sceneVisualScale.ts';
import { createSignalTuningState } from '../src/signalTuning.ts';
import {
  assertAttr,
  assertContainsTestId,
  assertNoTestId,
  assertTestId,
  assertTestIdAttr,
  assertValueInAttrElement,
  attrValuesIn,
} from './lib/dom-structure.ts';
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
    // SimState fields added after this fixture was written; inert values —
    // InfoPanel never destructures simTimeSec/intraHoCount/lastHoEvent/recentHo*,
    // satelliteVisualIdentityById already defaults to {}, and servingCellId is
    // short-circuited behind the non-null servingBeamId/comparisonBeamId here.
    satelliteVisualIdentityById: {},
    servingCellId: null,
    recentHoSourceBeamId: null,
    recentHoTargetBeamId: null,
    recentHoDeltaDb: null,
    lastHoEvent: null,
    simTimeSec: 0,
    intraHoCount: 0,
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
    // Aligned to the CURRENT SignalTuningPanelProps. The ownership point this
    // validator makes is now enforced structurally too: the panel interface no
    // longer even ACCEPTS currentSinrDb/formulaSource — the old "feed it SINR and
    // assert it does not display it" props were silently ignored (never
    // destructured), so dropping them is render-identical; the negative needles
    // below still assert the panel renders no operational SINR readout.
    <SignalTuningPanel
      baseProfile={profile}
      tuning={createTuningState(profile)}
      topology={createSceneTopologyState()}
      sceneVisualScale={createSceneVisualScaleState()}
      appMode="sinr-experiment"
      hasOverrides
      formulaBudget={state.physicalServingBudget}
      onTuningChange={() => {}}
      onTopologyChange={() => {}}
      onSceneVisualScaleChange={() => {}}
      onReset={() => {}}
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

/**
 * The ten SINR formula terms, as the right panel's evidence grid names them.
 * `data-term` is the contract; the visible label is copy and may be translated.
 */
const FORMULA_TERMS = [
  'signalDbm',
  'effectiveTxPower',
  'transmitGain',
  'receiverGain',
  'pathLoss',
  'scanLoss',
  'intraInterference',
  'interInterference',
  'noiseDbm',
  'denominator',
] as const;

function run(): void {
  const profile = loadProfile(PROFILE_ID);
  const operationalState = createSimState(profile);

  const infoMarkup = renderToStaticMarkup(
    <InfoPanel {...operationalState} showFormulaTerms profile={profile} />,
  );
  const infoText = decodeHtmlText(infoMarkup);

  // RIGHT PANEL owns operational SINR status: two duel columns, each declaring
  // its ownership, plus the physical-serving formula verification block.
  assertTestId(infoMarkup, 'info-panel-primary-sinr-status');
  assertTestId(infoMarkup, 'info-panel-comparison-sinr-status');
  assertTestIdAttr(infoMarkup, 'info-panel-primary-sinr-status', 'data-ownership', 'operational-sinr-status');
  assertTestIdAttr(infoMarkup, 'info-panel-comparison-sinr-status', 'data-ownership', 'operational-sinr-status');
  assertTestIdAttr(infoMarkup, 'info-panel-primary-sinr-status', 'data-duel-block', 'serving');
  assertTestIdAttr(infoMarkup, 'info-panel-comparison-sinr-status', 'data-duel-block', 'comparison');
  assertTestIdAttr(infoMarkup, 'formula-result-readout', 'data-ownership', 'formula-verification');
  assertTestIdAttr(infoMarkup, 'formula-term-evidence', 'data-ownership', 'formula-verification');

  // The two operational SINR readouts show the values they were handed, in their
  // own columns (numbers + unit symbols survive translation).
  assertValueInAttrElement(infoMarkup, 'data-duel-block', 'serving', '13.4 dB', 'right panel');
  assertValueInAttrElement(infoMarkup, 'data-duel-block', 'comparison', '11.1 dB', 'right panel');

  // The formula evidence grid still exposes all ten terms, by term identity.
  assert.deepEqual(
    attrValuesIn(infoMarkup, 'data-term'),
    [...FORMULA_TERMS],
    'right panel must keep the full SINR formula term grid',
  );

  // NOTE (agent-M): the uppercase role tokens ACTIVE SERVING / BEST CANDIDATE /
  // HO SOURCE are still asserted as literal copy below. They are the one
  // invariant on this surface with no structural carrier yet: the duel columns
  // expose POSITION (`data-duel-block`) but not ROLE. Adding
  // `data-panel-role="serving|ho-source|pending|ho-target|candidate|none"` to
  // the two columns in `src/ui/info-panel/DuelSignalColumn.tsx` would let these
  // become structural too. Until then they stay, because dropping them would
  // weaken the gate.
  assertContains(infoText, 'ACTIVE SERVING');
  assertContains(infoText, 'BEST CANDIDATE');

  // LEFT PANEL keeps the editable formula tabs and controls…
  const { markup: tuningMarkup, text: tuningText } = renderTuningPanel(profile, operationalState);
  assertTestId(tuningMarkup, 'sinr-formula-tabs');
  assertContainsTestId(tuningMarkup, 'signal-power-controls', 'pt-signal-power-control');
  // …and owns NO operational readout: no formula result, no term evidence, and
  // no element claiming either ownership role.
  assertNoTestId(tuningMarkup, 'formula-result-readout', 'left panel');
  assertNoTestId(tuningMarkup, 'formula-term-evidence', 'left panel');
  assertNoTestId(tuningMarkup, 'info-panel-primary-sinr-status', 'left panel');
  assertNoTestId(tuningMarkup, 'info-panel-comparison-sinr-status', 'left panel');
  assert.deepEqual(attrValuesIn(tuningMarkup, 'data-ownership'), [], 'left panel must claim no display ownership');
  assert.deepEqual(attrValuesIn(tuningMarkup, 'data-term'), [], 'left panel must not render formula term cells');
  assertNotContains(tuningText, 'ACTIVE SERVING');
  assertNotContains(tuningText, 'BEST CANDIDATE');
  assertNotContains(tuningText, 'PENDING TARGET');

  // RECENT-HO: the right panel may re-point its primary column at the HO source,
  // but the formula evidence must stay tied to PHYSICAL SERVING.
  const recentHoState = createRecentHoState(profile);
  const recentInfoMarkup = renderToStaticMarkup(
    <InfoPanel {...recentHoState} showFormulaTerms profile={profile} />,
  );
  const recentInfoText = decodeHtmlText(recentInfoMarkup);
  const recentTuningText = renderTuningPanel(profile, recentHoState).text;
  const physicalServingLabel = formatSatelliteLabel(SERVING_SAT_ID);
  const hoSourceLabel = formatSatelliteLabel(RECENT_SOURCE_SAT_ID);

  assertContains(recentInfoText, hoSourceLabel);
  assertContains(recentInfoText, physicalServingLabel);
  // See the note above: HO SOURCE has no structural carrier yet either.
  assertContains(recentInfoText, 'HO SOURCE');
  assertTestId(recentInfoMarkup, 'formula-term-evidence');

  /*
   * THE ACTUAL OWNERSHIP CLAIM, asserted directly.
   *
   * The fixture deliberately feeds two DIFFERENT budgets: physicalServingBudget
   * = createBudgetTerms(1) and servingBudget = createBudgetTerms(-1). So the
   * signal term reads -87.5 dBm if the grid is (correctly) sourced from the
   * physical serving link, and -89.5 dBm if it has drifted to the recent-HO
   * source card. The old gate only pinned the words "physical serving source",
   * which would have survived exactly that drift.
   */
  assertValueInAttrElement(recentInfoMarkup, 'data-term', 'signalDbm', '-87.5 dBm', 'recent-HO right panel');
  assertNotContains(
    decodeHtmlText(recentInfoMarkup).replace(/-87\.5 dBm/g, ''),
    '-89.5 dBm',
  );

  assertNotContains(recentTuningText, hoSourceLabel);
  assertNotContains(recentTuningText, physicalServingLabel);
  assertNotContains(recentTuningText, 'HO SOURCE');
  assertNotContains(recentTuningText, 'ACTIVE SERVING');

  console.log('Phase 7B SINR display ownership validation passed.');
  console.log(JSON.stringify({
    profileId: PROFILE_ID,
    asserted: {
      rightPanel: [
        'Tuning-mode InfoPanel owns operational serving SINR status',
        'Tuning-mode InfoPanel owns operational candidate SINR status',
        'Tuning-mode InfoPanel owns physical serving formula result and formula term evidence',
      ],
      leftPanel: [
        'SignalTuningPanel keeps editable SINR formula tabs and controls',
        'SignalTuningPanel no longer repeats operational serving/candidate or formula result readouts',
      ],
      recentHo: [
        'right panel may show recent HO source',
        'right formula terms remain tied to physicalServing and do not depend on the recent-HO source card',
      ],
    },
  }, null, 2));
}

run();
