import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HandoverManager } from '../src/engine/handover/handover-manager.ts';
import type { LinkSample } from '../src/engine/signal/types.ts';
import {
  applyHandoverPolicyTuning,
  createHandoverPolicyTuningState,
  getHandoverPolicyResetKey,
  sameHandoverPolicyTuning,
} from '../src/handoverPolicyTuning.ts';
import { loadProfile } from '../src/profiles/index.ts';
import { createInitialSimState } from '../src/scene/initialSimState.ts';
import { createSignalTuningState, applySignalTuning } from '../src/signalTuning.ts';
import { DiagnosticsDrawer } from '../src/ui/DiagnosticsDrawer.tsx';
import { InfoPanel } from '../src/ui/InfoPanel.tsx';
import { SignalTuningPanel } from '../src/ui/SignalTuningPanel.tsx';

const PROFILE_ID = 'hobs-2024-candidate-rich';

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
  assert.ok(text.includes(expected), `expected rendered UI to contain "${expected}"`);
}

function assertNotContains(text: string, unexpected: string): void {
  assert.ok(!text.includes(unexpected), `expected rendered UI not to contain "${unexpected}"`);
}

function renderTuningPanelTextAndMarkup() {
  const profile = loadProfile(PROFILE_ID);
  const applied = createHandoverPolicyTuningState(profile);
  const draft = {
    ...applied,
    offsetDb: applied.offsetDb + 1,
    triggerTimeSec: applied.triggerTimeSec + 0.5,
    sinrThresholdDb: applied.sinrThresholdDb + 1,
  };
  const markup = renderToStaticMarkup(
    <SignalTuningPanel
      baseProfile={profile}
      tuning={createSignalTuningState(profile)}
      hasOverrides={false}
      currentSinrDb={12.5}
      formulaBudget={null}
      formulaSource={{
        satId: null,
        beamId: null,
        sinrDb: null,
        elevationDeg: null,
        rangeKm: null,
        status: 'none',
      }}
      handoverDraft={draft}
      appliedHandoverPolicy={applied}
      hasHandoverDraftChanges
      hasHandoverOverrides
      onTuningChange={() => {}}
      onReset={() => {}}
      onHandoverDraftChange={() => {}}
      onApplyHandoverPolicy={() => {}}
      onResetHandoverPolicy={() => {}}
    />,
  );

  return { markup, text: decodeHtmlText(markup), profile, applied, draft };
}

function assertTuningPlacementAndCopy(): void {
  const { markup, text } = renderTuningPanelTextAndMarkup();
  assertContains(text, 'SINR Formula');
  assertContains(text, 'Handover Policy');
  assertContains(text, 'Handover Policy Research Controls');
  assertContains(text, 'policy: sinr-offset');
  assertContains(text, 'read-only');
  assertContains(text, 'Handover offset margin');
  assertContains(text, 'Inter-HO trigger time');
  assertContains(text, 'Ping-pong guard window');
  assertContains(text, 'Decision SINR smoothing');
  assertContains(text, 'Same-satellite beam dwell');
  assertContains(text, 'Pending target hold');
  assertContains(text, 'Handover attach threshold');
  assertContains(text, 'Apply policy changes');
  assertContains(text, 'Reset to profile defaults');
  assertContains(text, 'Applied value remains');
  assertNotContains(text, 'policy selector');
  assertNotContains(text, 'SINR threshold');

  const pageTabsIndex = markup.indexOf('data-testid="tuning-page-tabs"');
  const sinrPageIndex = markup.indexOf('data-testid="sinr-formula-page"');
  const handoverPageIndex = markup.indexOf('data-testid="handover-policy-page"');
  const tabIndex = markup.indexOf('data-testid="sinr-formula-tabs"');
  const coverageAuditIndex = markup.indexOf('data-testid="sinr-coverage-audit"');
  const coverageDisclosureIndex = markup.indexOf('data-testid="sinr-coverage-assumptions-disclosure"');
  const policyIndex = markup.indexOf('data-testid="handover-policy-controls"');
  assert.ok(pageTabsIndex >= 0, 'expected top-level Tuning page tabs');
  assert.ok(sinrPageIndex > pageTabsIndex, 'expected SINR Formula tab panel after top-level tabs');
  assert.ok(handoverPageIndex > sinrPageIndex, 'expected independent Handover Policy tab panel outside SINR page');
  assert.ok(tabIndex >= 0, 'expected SINR formula tab marker');
  assert.ok(tabIndex > sinrPageIndex, 'SINR formula tabs must live inside the SINR Formula page');
  assert.equal(coverageAuditIndex, -1, 'Phase 9H removes the old always-visible coverage audit block');
  assert.equal(coverageDisclosureIndex, -1, 'coverage / assumptions is no longer a separate SINR-page disclosure');
  assert.ok(policyIndex > handoverPageIndex, 'handover policy controls must live inside the Handover Policy page');

  const sinrPageMarkup = markup.slice(sinrPageIndex, handoverPageIndex);
  const handoverPageMarkup = markup.slice(handoverPageIndex);
  assertNotContains(sinrPageMarkup, 'data-testid="handover-policy-controls"');
  assertNotContains(decodeHtmlText(sinrPageMarkup), 'Handover Policy Research Controls');
  assertContains(handoverPageMarkup, 'data-testid="handover-policy-controls"');
}

function assertModeVisibility(): void {
  const profile = loadProfile(PROFILE_ID);
  const initialState = createInitialSimState(profile);
  const presentationText = decodeHtmlText(renderToStaticMarkup(
    <>
      <InfoPanel {...initialState} uiMode="presentation" profile={profile} />
      <DiagnosticsDrawer {...initialState} uiMode="presentation" profile={profile} />
    </>,
  ));
  assertNotContains(presentationText, 'Handover Policy Research Controls');
  assertNotContains(presentationText, 'Apply policy changes');
  assertNotContains(presentationText, 'Reset to profile defaults');
  assertNotContains(presentationText, 'Handover policy (effective)');

  const diagnosticsText = decodeHtmlText(renderToStaticMarkup(
    <>
      <InfoPanel {...initialState} uiMode="diagnostics" profile={profile} />
      <DiagnosticsDrawer {...initialState} uiMode="diagnostics" profile={profile} />
    </>,
  ));
  assertContains(diagnosticsText, 'Handover policy (effective)');
  assertContains(diagnosticsText, 'policy sinr-offset (read-only)');
  assertContains(diagnosticsText, 'Handover attach threshold');
  assertNotContains(diagnosticsText, 'Handover Policy Research Controls');
  assertNotContains(diagnosticsText, 'Apply policy changes');
  assertNotContains(diagnosticsText, 'Reset to profile defaults');
}

function assertDraftApplySeparation(): void {
  const profile = loadProfile(PROFILE_ID);
  const signalTunedProfile = applySignalTuning(profile, createSignalTuningState(profile));
  const applied = createHandoverPolicyTuningState(profile);
  const draft = {
    ...applied,
    offsetDb: applied.offsetDb + 2,
    triggerTimeSec: applied.triggerTimeSec + 1,
  };

  const effectiveBeforeApply = applyHandoverPolicyTuning(signalTunedProfile, applied);
  assert.equal(effectiveBeforeApply.handover.offsetDb, profile.handover.offsetDb);
  assert.equal(effectiveBeforeApply.handover.triggerTimeSec, profile.handover.triggerTimeSec);
  assert.ok(!sameHandoverPolicyTuning(draft, applied), 'draft must be distinct from applied policy before Apply');
  assert.notEqual(getHandoverPolicyResetKey(draft), getHandoverPolicyResetKey(applied));

  const effectiveAfterApply = applyHandoverPolicyTuning(signalTunedProfile, draft);
  assert.equal(effectiveAfterApply.handover.offsetDb, draft.offsetDb);
  assert.equal(effectiveAfterApply.handover.triggerTimeSec, draft.triggerTimeSec);
  assert.equal(effectiveAfterApply.handover.policy, 'sinr-offset');
}

function assertResetClearsStaleEvidence(): void {
  const profile = loadProfile(PROFILE_ID);
  const applied = {
    ...createHandoverPolicyTuningState(profile),
    offsetDb: profile.handover.offsetDb + 1,
  };
  const effectiveProfile = applyHandoverPolicyTuning(profile, applied);
  const clearedState = createInitialSimState(effectiveProfile);

  assert.equal(clearedState.pendingTargetSatId, null);
  assert.equal(clearedState.pendingTargetBeamId, null);
  assert.equal(clearedState.pendingTargetSinrDb, null);
  assert.equal(clearedState.handoverTriggerProgressSec, 0);
  assert.equal(clearedState.recentHoSourceSatId, null);
  assert.equal(clearedState.recentHoTargetSatId, null);
  assert.equal(clearedState.comparisonSatId, null);
  assert.equal(clearedState.comparisonBeamId, null);
  assert.equal(clearedState.sinrDeltaDb, null);
  assert.equal(clearedState.hoCount, 0);
  assert.equal(clearedState.lastHoReason, '');
  assert.equal(clearedState.physicalServingBudget, null);
  assert.equal(clearedState.servingBudget, null);
  assert.equal(clearedState.panelPrimary.role, 'none');
  assert.equal(clearedState.panelComparison.role, 'none');
  assert.equal(clearedState.handoverOffsetDb, applied.offsetDb);
}

function assertHandoverManagerResetCoverage(): void {
  const profile = loadProfile(PROFILE_ID);
  const manager = new HandoverManager({
    ...profile.handover,
    triggerTimeSec: 2,
    pingPongGuardSec: 0,
    sinrSmoothingSec: 0,
  });
  let simTimeMs = Date.UTC(2026, 0, 1, 0, 0, 0);
  simTimeMs += 1000;
  manager.update([createLinkSample('source-sat', 1, 20)], 1, simTimeMs);
  simTimeMs += 1000;
  manager.update([
    createLinkSample('source-sat', 1, 10),
    createLinkSample('target-sat', 2, 14),
  ], 1, simTimeMs);

  assert.equal(manager.state.satId, 'source-sat');
  assert.deepEqual(manager.state.pendingTarget, { satId: 'target-sat', beamId: 2 });
  assert.ok(manager.state.triggerTimeSec > 0);
  assert.equal(manager.eventLog.length, 1);

  manager.reset();

  assert.equal(manager.state.satId, null);
  assert.equal(manager.state.beamId, null);
  assert.equal(manager.state.triggerTimeSec, 0);
  assert.equal(manager.state.pendingTarget, null);
  assert.equal(manager.eventLog.length, 0);
  assert.equal(manager.getTrackedSinrDb('target-sat', 2), null);
}

function assertHandoverResetPreservesReplayAndDpc(): void {
  const source = readFileSync(new URL('../src/scene/useSimulation.ts', import.meta.url), 'utf8');
  const effectEnd = source.indexOf('}, [handoverResetKey]);');
  assert.ok(effectEnd > 0, 'expected a dedicated handoverResetKey effect');
  const effectStart = source.lastIndexOf('useEffect(() => {', effectEnd);
  assert.ok(effectStart >= 0, 'expected handoverResetKey useEffect start');
  const block = source.slice(effectStart, effectEnd);
  assertContains(block, 'frameRef.current = createEmptyFrame(simTimeRef.current)');
  assertContains(block, 'publishNextFrameRef.current = true');
  assertNotContains(block, 'simTimeRef.current =');
  assertNotContains(block, 'beamPowerControlRef.current =');
}

function run(): void {
  assertTuningPlacementAndCopy();
  assertModeVisibility();
  assertDraftApplySeparation();
  assertResetClearsStaleEvidence();
  assertHandoverManagerResetCoverage();
  assertHandoverResetPreservesReplayAndDpc();

  console.log('Phase 6C handover policy independent tab validation passed.');
  console.log(JSON.stringify({
    profileId: PROFILE_ID,
    asserted: {
      placement: 'Tuning-only independent SINR Formula and Handover Policy tab panels',
      copy: ['policy: sinr-offset read-only', 'Handover attach threshold', 'no standalone handover SINR threshold label'],
      state: ['draft does not alter effective policy', 'apply updates effective policy', 'reset state clears stale handover evidence'],
      preservation: ['handover-only reset does not assign simTimeRef.current', 'handover-only reset does not clear beamPowerControlRef'],
    },
  }, null, 2));
}

run();
