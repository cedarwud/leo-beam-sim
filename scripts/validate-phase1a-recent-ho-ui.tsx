import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HandoverManager } from '../src/engine/handover/handover-manager.ts';
import type { LinkSample } from '../src/engine/signal/types.ts';
import { loadProfile } from '../src/profiles/index.ts';
import type { LinkBudgetTerms, SimState } from '../src/scene/types.ts';
import { createSceneTopologyState } from '../src/sceneTopology.ts';
import { createSceneVisualScaleState } from '../src/sceneVisualScale.ts';
import { createSignalTuningState } from '../src/signalTuning.ts';
import {
  assertNoTestId,
  assertTestId,
  assertTestIdAttr,
  assertValueInAttrElement,
  assertValueInTestId,
  attrValuesIn,
} from './lib/dom-structure.ts';
import { InfoPanel } from '../src/ui/InfoPanel.tsx';
import { DEFAULT_ENERGY_TUNING } from '../src/teaching/energyModel.ts';
import { SignalTuningPanel } from '../src/ui/SignalTuningPanel.tsx';
import { formatSatelliteLabel } from '../src/utils/formatSatelliteLabel.ts';

const PROFILE_ID = 'hobs-2024-candidate-rich';
const EPOCH_UTC_MS = Date.UTC(2026, 0, 1, 0, 0, 0);
const SOURCE_SAT_ID = 'shell-pro-53-P0-S0';
const TARGET_SAT_ID = 'shell-polar-P1-S3';
const SOURCE_BEAM_ID = 2;
const TARGET_BEAM_ID = 5;

function createLinkSample(satId: string, beamId: number, sinrDb: number): LinkSample {
  return {
    satId,
    beamId,
    rsrpDbm: -90 + sinrDb,
    sinrDb,
    signalDbm: -100 + sinrDb,
    intraInterferenceDbm: -118,
    interInterferenceDbm: -116,
    noiseDbm: -104,
    denominatorDbm: -103,
    txPowerDbm: 50,
    pathLossDb: 152,
    beamGainDb: 39,
    steeringLossDb: 1,
    receiverGainDbi: 0,
  };
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

function runDeterministicHandoverReplay() {
  const profile = loadProfile(PROFILE_ID);
  const manager = new HandoverManager(profile.handover);
  let simTimeMs = EPOCH_UTC_MS;

  const step = (sourceSinrDb: number, targetSinrDb: number, dtSec = 1) => {
    simTimeMs += dtSec * 1000;
    return manager.update([
      createLinkSample(SOURCE_SAT_ID, SOURCE_BEAM_ID, sourceSinrDb),
      createLinkSample(TARGET_SAT_ID, TARGET_BEAM_ID, targetSinrDb),
    ], dtSec, simTimeMs);
  };

  const initialDecision = step(18, -20);
  assert.equal(initialDecision.action, 'inter-handover');
  assert.equal(initialDecision.target?.satId, SOURCE_SAT_ID);
  assert.equal(manager.state.satId, SOURCE_SAT_ID);

  let interHandoverDecision = null as ReturnType<typeof step> | null;
  // The initial attach arms the engine's ping-pong guard (`pingPongGuardSec`),
  // during which every tick returns "handover guard active" before the pending /
  // trigger-time logic can run. The deterministic inter-HO can therefore only
  // commit AFTER the guard expires and a stable pending has held for
  // `triggerTimeSec`. Derive the step budget from the profile's own timing so
  // this replay self-heals when those params are retuned (e.g. PR-5 raised
  // `pingPongGuardSec` 5s → 30s, which silently starved the old hard-coded
  // 8-step loop). dt is 1s per step, so budget ≈ guard + trigger + margin.
  const interHandoverStepBudget = Math.ceil(
    profile.handover.pingPongGuardSec + profile.handover.triggerTimeSec,
  ) + 8;
  for (let i = 0; i < interHandoverStepBudget; i += 1) {
    const decision = step(2, 22);
    if (decision.action === 'inter-handover') {
      interHandoverDecision = decision;
      break;
    }
  }

  assert.ok(interHandoverDecision, 'expected deterministic inter-HO replay to enter recent-HO linger');
  assert.equal(interHandoverDecision.target?.satId, TARGET_SAT_ID);
  assert.equal(manager.state.satId, TARGET_SAT_ID);

  const lastEvent = manager.eventLog[manager.eventLog.length - 1];
  assert.equal(lastEvent.fromSatId, SOURCE_SAT_ID);
  assert.equal(lastEvent.fromBeamId, SOURCE_BEAM_ID);
  assert.equal(lastEvent.toSatId, TARGET_SAT_ID);
  assert.equal(lastEvent.toBeamId, TARGET_BEAM_ID);

  return {
    profile,
    sourceSinrDb: lastEvent.fromSinrDb ?? 2,
    targetSinrDb: lastEvent.toSinrDb,
    deltaDb: lastEvent.deltaDb ?? null,
    hoCount: manager.eventLog.length,
    reason: interHandoverDecision.reason,
    // Elapsed sim seconds the replay consumed to reach the committed inter-HO.
    // Feeds the SimState fixture's required `simTimeSec` so the recent-HO UI renders.
    simTimeSec: (simTimeMs - EPOCH_UTC_MS) / 1000,
  };
}

function createRecentHoState(): SimState {
  const replay = runDeterministicHandoverReplay();

  return {
    profileId: replay.profile.id,
    formulaFamilyLabel: 'HOBS Legacy',
    physicalServing: {
      satId: TARGET_SAT_ID,
      beamId: TARGET_BEAM_ID,
      sinrDb: replay.targetSinrDb,
      elevationDeg: 52.1,
      rangeKm: 870,
      status: 'live',
    },
    panelPrimary: {
      role: 'ho-source',
      satId: SOURCE_SAT_ID,
      beamId: SOURCE_BEAM_ID,
      sinrDb: replay.sourceSinrDb,
      elevationDeg: 47.8,
      rangeKm: 910,
      status: 'recent-ho',
    },
    panelComparison: {
      role: 'ho-target',
      satId: TARGET_SAT_ID,
      beamId: TARGET_BEAM_ID,
      sinrDb: replay.targetSinrDb,
      elevationDeg: 52.1,
      rangeKm: 870,
      status: 'recent-ho',
    },
    simTimeSec: replay.simTimeSec,
    // SimState fields added after this fixture was written; inert values —
    // InfoPanel never destructures intraHoCount/lastHoEvent/recentHo*-beam ids,
    // satelliteVisualIdentityById already defaults to {}, and servingCellId is
    // short-circuited behind the non-null servingBeamId/comparisonBeamId here.
    satelliteVisualIdentityById: {},
    servingCellId: null,
    recentHoSourceBeamId: null,
    recentHoTargetBeamId: null,
    recentHoDeltaDb: null,
    lastHoEvent: null,
    intraHoCount: 0,
    servingSatId: SOURCE_SAT_ID,
    servingBeamId: SOURCE_BEAM_ID,
    servingElevationDeg: 47.8,
    servingRangeKm: 910,
    pendingTargetSatId: null,
    pendingTargetBeamId: null,
    pendingTargetSinrDb: null,
    comparisonSatId: TARGET_SAT_ID,
    comparisonBeamId: TARGET_BEAM_ID,
    comparisonElevationDeg: 52.1,
    comparisonRangeKm: 870,
    comparisonSinrDb: replay.targetSinrDb,
    comparisonKind: 'recent-ho',
    sinrDeltaDb: replay.deltaDb,
    recentHoSourceSatId: SOURCE_SAT_ID,
    recentHoTargetSatId: TARGET_SAT_ID,
    sinrDb: replay.sourceSinrDb,
    physicalServingBudget: createBudgetTerms(2),
    servingBudget: createBudgetTerms(0),
    handoverOffsetDb: replay.profile.handover.offsetDb,
    handoverTriggerProgressSec: 0,
    handoverTriggerSec: replay.profile.handover.triggerTimeSec,
    hoCount: replay.hoCount,
    lastHoReason: replay.reason,
    beamHopEnabled: replay.profile.beamHopping.enabled,
    beamHopSlotIndex: 182,
    beamHopSlotSec: replay.profile.beamHopping.slotSec,
    servingBeamActiveThisSlot: true,
    servingSatActiveBeamIds: [TARGET_BEAM_ID],
    pendingTargetActiveBeamIds: [],
  };
}

function assertContains(text: string, expected: string): void {
  assert.ok(text.includes(expected), `expected rendered UI to contain "${expected}"`);
}

function assertNotContains(text: string, unexpected: string): void {
  assert.ok(!text.includes(unexpected), `expected rendered UI not to contain "${unexpected}"`);
}

function run(): void {
  const simState = createRecentHoState();
  const profile = loadProfile(PROFILE_ID);
  const sourceLabel = formatSatelliteLabel(SOURCE_SAT_ID);
  const targetLabel = formatSatelliteLabel(TARGET_SAT_ID);

  const combinedMarkup = renderToStaticMarkup(
    <InfoPanel {...simState} showFormulaTerms profile={profile} />,
  );
  const combinedText = decodeHtmlText(combinedMarkup);
  // NOTE (agent-M): the four uppercase role tokens / role captions below are the
  // one invariant on this surface with no structural carrier yet — the duel
  // columns expose POSITION (`data-duel-block`) but not ROLE. Adding
  // `data-panel-role` + `data-panel-role-caption` to the two columns in
  // src/ui/info-panel/DuelSignalColumn.tsx would let these become structural.
  // They stay for now; dropping them would weaken the gate.
  assertContains(combinedText, 'HO SOURCE');
  assertContains(combinedText, 'previous source');
  assertContains(combinedText, 'HO TARGET');
  assertContains(combinedText, 'recent target / serving now');
  assertContains(combinedText, sourceLabel);
  assertContains(combinedText, targetLabel);

  // The right panel owns the formula evidence, and that evidence stays tied to
  // the PHYSICAL SERVING link. The fixture feeds two different budgets
  // (physicalServingBudget = createBudgetTerms(2) -> -90.0 dBm, servingBudget =
  // createBudgetTerms(0) -> -92.0 dBm), so the signal term reads -90.0 dBm only
  // if the grid is sourced from physical serving. The old gate pinned the words
  // "physical serving source", which would have survived exactly that drift.
  assertTestId(combinedMarkup, 'formula-term-evidence');
  assertTestIdAttr(combinedMarkup, 'formula-term-evidence', 'data-ownership', 'formula-verification');
  assertValueInAttrElement(combinedMarkup, 'data-term', 'signalDbm', '-90.0 dBm', 'recent-HO right panel');
  assertNotContains(combinedText, '-92.0 dBm');

  const tuningMarkup = renderToStaticMarkup(
    // Aligned to the CURRENT SignalTuningPanelProps: the removed legacy props
    // (currentSinrDb/formulaSource/handover-policy sextet) were never destructured
    // by the panel any more, so dropping them is render-identical; the negative
    // needles below still assert the panel owns no serving/HO-source identity copy.
    <SignalTuningPanel
      baseProfile={profile}
      tuning={createSignalTuningState(profile)}
      topology={createSceneTopologyState()}
      sceneVisualScale={createSceneVisualScaleState()}
      appMode="sinr-experiment"
      hasOverrides={false}
      formulaBudget={simState.physicalServingBudget}
      onTuningChange={() => {}}
      onTopologyChange={() => {}}
      onSceneVisualScaleChange={() => {}}
      energyTuning={DEFAULT_ENERGY_TUNING}
      onEnergyTuningChange={() => {}}
      onReset={() => {}}
    />,
  );
  const tuningText = decodeHtmlText(tuningMarkup);

  // LEFT PANEL keeps G^R discoverable: its own tab in the formula strip, and its
  // own numerator-side tile in the formula map showing the live receiver gain.
  // (Asserted structurally; the old pins on the words "receiver gain" /
  // "Receiver Gain" broke the moment the panel was translated.)
  assert.ok(
    tuningMarkup.includes('id="sinr-formula-tab-receiver-gain"'),
    'expected G^R to keep its own tab in the SINR formula tab strip',
  );
  assertTestIdAttr(tuningMarkup, 'formula-map-gr', 'data-term-owner', 'receiver-gain');
  assertTestIdAttr(tuningMarkup, 'formula-map-gr', 'data-formula-side', 'numerator');
  assertValueInTestId(tuningMarkup, 'formula-map-gr', '0.0 dBi');

  assertNotContains(tuningText, 'HOBS paper parameter table does not provide');
  assertNotContains(tuningText, 'Research Override / teaching control');
  assertNotContains(tuningText, '0 dBi fixed');
  assertNotContains(tuningText, targetLabel);
  assertNotContains(tuningText, sourceLabel);
  // The tuning panel owns NO operational readout: no evidence block, no term
  // cells, no display-ownership claim of any kind.
  assertNoTestId(tuningMarkup, 'formula-term-evidence', 'left panel');
  assertNoTestId(tuningMarkup, 'formula-verification-card', 'left panel');
  assert.deepEqual(attrValuesIn(tuningMarkup, 'data-term'), [], 'left panel must not render formula term cells');
  assert.deepEqual(attrValuesIn(tuningMarkup, 'data-ownership'), [], 'left panel must claim no display ownership');
  assertNotContains(tuningText, 'ACTIVE SERVING');
  assertNotContains(tuningText, 'HO SOURCE');

  console.log('Phase 1A recent-HO UI validation passed.');
  console.log(JSON.stringify({
    profileId: PROFILE_ID,
    source: { satId: SOURCE_SAT_ID, label: sourceLabel, beamId: SOURCE_BEAM_ID },
    physicalServing: { satId: TARGET_SAT_ID, label: targetLabel, beamId: TARGET_BEAM_ID },
    asserted: {
      rightPanel: ['HO SOURCE', 'previous source', 'HO TARGET', 'recent target / serving now', 'formula terms sourced from physicalServingBudget, not the recent-HO card'],
      leftPanel: ['G^R keeps its own formula tab', 'G^R map tile is numerator-side and shows the live receiver gain', 'no formula term cells and no display-ownership claim'],
      forbiddenLeftPanelCopy: ['Formula Verification', 'SINR Formula Terms', 'Current formula terms', 'ACTIVE SERVING', 'HO SOURCE', sourceLabel, targetLabel],
    },
  }, null, 2));
}

run();
