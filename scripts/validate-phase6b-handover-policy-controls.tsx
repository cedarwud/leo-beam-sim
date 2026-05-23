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
import { HandoverPolicyControls } from '../src/ui/HandoverPolicyControls.tsx';
import { InfoPanel } from '../src/ui/InfoPanel.tsx';
import { SidebarTabShell, type SidebarTabItem } from '../src/ui/SidebarTabShell.tsx';
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

type LeftSidebarTab = 'objective' | 'signal' | 'handover';

const LEFT_SIDEBAR_TABS: readonly SidebarTabItem<LeftSidebarTab>[] = [
  { key: 'signal', label: 'SINR formula', description: 'SINR tuning' },
  { key: 'handover', label: 'Handover policy', description: 'decision timing gates' },
];

const MODQN_LEFT_SIDEBAR_TABS: readonly SidebarTabItem<LeftSidebarTab>[] = [
  { key: 'objective', label: 'MODQN objective', description: 'post-hoc ω weights' },
  { key: 'handover', label: 'Handover policy', description: 'decision timing gates' },
];

function renderSidebarTextAndMarkup() {
  const profile = loadProfile(PROFILE_ID);
  const applied = createHandoverPolicyTuningState(profile);
  const draft = {
    ...applied,
    offsetDb: applied.offsetDb + 1,
    triggerTimeSec: applied.triggerTimeSec + 0.5,
    sinrThresholdDb: applied.sinrThresholdDb + 1,
  };
  const signalMarkup = renderToStaticMarkup(
    <SignalTuningPanel
      baseProfile={profile}
      tuning={createSignalTuningState(profile)}
      hasOverrides={false}
      uiMode="tuning"
      formulaBudget={null}
      onTuningChange={() => {}}
      onReset={() => {}}
    />,
  );
  const handoverControls = (
    <HandoverPolicyControls
      draft={draft}
      applied={applied}
      hasDraftChanges
      hasOverrides
      onDraftChange={() => {}}
      onApply={() => {}}
      onReset={() => {}}
    />
  );
  const handoverMarkup = renderToStaticMarkup(handoverControls);
  const sidebarMarkup = renderToStaticMarkup(
    <SidebarTabShell
      label="Simulation control sidebar"
      side="left"
      tabs={LEFT_SIDEBAR_TABS}
      activeKey="handover"
      onChange={() => {}}
    >
      {handoverControls}
    </SidebarTabShell>,
  );
  const modqnSidebarMarkup = renderToStaticMarkup(
    <SidebarTabShell
      label="Simulation control sidebar"
      side="left"
      tabs={MODQN_LEFT_SIDEBAR_TABS}
      activeKey="handover"
      onChange={() => {}}
    >
      {handoverControls}
    </SidebarTabShell>,
  );

  return {
    signalMarkup,
    handoverMarkup,
    sidebarMarkup,
    modqnSidebarMarkup,
    text: decodeHtmlText(sidebarMarkup),
    profile,
    applied,
    draft,
  };
}

function assertAppOwnsTopLevelHandoverTab(): void {
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const signalPanelSource = readFileSync(new URL('../src/ui/SignalTuningPanel.tsx', import.meta.url), 'utf8');
  const styleSource = readFileSync(new URL('../src/styles/main.scss', import.meta.url), 'utf8');

  assertContains(appSource, "type LeftSidebarTab = 'objective' | 'signal' | 'handover'");
  assertContains(appSource, "{ key: 'objective', label: 'MODQN objective'");
  assertContains(appSource, "{ key: 'signal', label: 'SINR formula'");
  assertContains(appSource, "{ key: 'handover', label: 'Handover policy'");
  assertContains(appSource, 'SINR_LEFT_SIDEBAR_TABS');
  assertContains(appSource, 'MODQN_LEFT_SIDEBAR_TABS');
  assertContains(appSource, 'SINR_RIGHT_SIDEBAR_TABS');
  assertContains(appSource, 'MODQN_RIGHT_SIDEBAR_TABS');
  assertContains(appSource, 'getLeftSidebarTabsForMode');
  assertContains(appSource, 'getRightSidebarTabsForMode');
  assertContains(appSource, '<SidebarTabShell');
  assertContains(appSource, '<HandoverPolicyControls');
  assertContains(styleSource, '.leo-sidebar-tab-shell[data-tab-count="2"] .leo-sidebar-tab-list');
  assertNotContains(signalPanelSource, 'HandoverPolicyControls');
  assertNotContains(signalPanelSource, 'handover-policy-page');
  assertNotContains(signalPanelSource, 'tuning-page-tabs');
}

function assertTuningPlacementAndCopy(): void {
  const { signalMarkup, handoverMarkup, sidebarMarkup, modqnSidebarMarkup, text } = renderSidebarTextAndMarkup();
  assertContains(text, 'SINR formula');
  assertContains(text, 'Handover policy');
  assertNotContains(text, 'MODQN objective');
  assertContains(text, 'Handover Policy Research Controls');
  assertContains(text, 'policy: sinr-offset');
  assertContains(text, 'read-only');
  assertContains(text, 'Handover offset margin');
  assertContains(text, 'Inter-HO trigger time');
  assertContains(text, 'Ping-pong guard window');
  assertContains(text, 'Decision SINR smoothing');
  assertContains(text, 'Same-satellite beam dwell');
  assertContains(text, 'Intra-HO limit per satellite');
  assertContains(text, 'Maximum same-satellite beam switches before the next inter-satellite handover resets the counter.');
  assertContains(text, 'Pending target hold');
  assertContains(text, 'Handover attach threshold');
  assertContains(text, 'Apply policy changes');
  assertContains(text, 'Reset to profile defaults');
  assertContains(text, 'Applied value remains');
  assertNotContains(text, 'policy selector');
  assertNotContains(text, 'SINR threshold');

  const topLevelTabsIndex = sidebarMarkup.indexOf('class="leo-sidebar-tab-list"');
  const objectiveTabIndex = sidebarMarkup.indexOf('id="left-sidebar-tab-objective"');
  const signalTabIndex = sidebarMarkup.indexOf('id="left-sidebar-tab-signal"');
  const handoverTabIndex = sidebarMarkup.indexOf('id="left-sidebar-tab-handover"');
  const policyIndex = sidebarMarkup.indexOf('data-testid="handover-policy-controls"');
  assert.ok(topLevelTabsIndex >= 0, 'expected sidebar top-level tab list');
  assert.equal(objectiveTabIndex, -1, 'SINR mode sidebar must not expose MODQN objective tab');
  assert.ok(signalTabIndex > topLevelTabsIndex, 'expected SINR formula tab in SINR mode sidebar');
  assert.ok(handoverTabIndex > signalTabIndex, 'expected Handover policy tab next to SINR formula in SINR mode');
  assert.ok(policyIndex > handoverTabIndex, 'handover policy controls must render in the active top-level sidebar panel');

  const modqnText = decodeHtmlText(modqnSidebarMarkup);
  assertContains(modqnText, 'MODQN objective');
  assertContains(modqnText, 'Handover policy');
  assertContains(modqnText, 'Handover Policy Research Controls');
  assert.equal(
    modqnSidebarMarkup.indexOf('id="left-sidebar-tab-signal"'),
    -1,
    'MODQN mode sidebar must not expose SINR formula tab',
  );
  assert.ok(
    modqnSidebarMarkup.indexOf('id="left-sidebar-tab-handover"') > modqnSidebarMarkup.indexOf('id="left-sidebar-tab-objective"'),
    'MODQN mode sidebar must expose Handover policy next to MODQN objective',
  );

  assertContains(signalMarkup, 'data-testid="sinr-formula-page"');
  assertContains(signalMarkup, 'data-testid="sinr-formula-tabs"');
  assertContains(handoverMarkup, 'data-testid="handover-policy-controls"');
  assertNotContains(signalMarkup, 'data-testid="handover-policy-controls"');
  assertNotContains(decodeHtmlText(signalMarkup), 'Handover Policy Research Controls');
  assertAppOwnsTopLevelHandoverTab();
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

  const modqnLiveStatusState = {
    ...initialState,
    panelComparison: {
      ...initialState.panelComparison,
      role: 'candidate' as const,
      status: 'derived' as const,
      satId: 'candidate-sat',
      beamId: 2,
      sinrDb: 12,
    },
    comparisonSatId: 'candidate-sat',
    comparisonBeamId: 2,
    comparisonSinrDb: 12,
  };
  const modqnLiveStatusText = decodeHtmlText(renderToStaticMarkup(
    <InfoPanel
      {...modqnLiveStatusState}
      uiMode="presentation"
      profile={profile}
      handoverMode="modqn-replay"
    />,
  ));
  assertContains(modqnLiveStatusText, 'MODQN replay');
  assertContains(modqnLiveStatusText, 'MODQN selects serving; SINR metrics are live');
  assertContains(modqnLiveStatusText, 'MODQN-selected live link');
  assertContains(modqnLiveStatusText, 'live SINR reference');
  assertContains(modqnLiveStatusText, 'Δ live SINR');
  assertContains(modqnLiveStatusText, 'Timing Gate');
  assertNotContains(modqnLiveStatusText, 'MODQN replay evidence');
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

function assertIntraSwitchEpochGuard(): void {
  const profile = loadProfile(PROFILE_ID);
  const manager = new HandoverManager({
    ...profile.handover,
    triggerTimeSec: 1,
    pingPongGuardSec: 0,
    intraSwitchTimeSec: 1,
    maxIntraSwitchesPerServingEpoch: 1,
    sinrSmoothingSec: 0,
  });
  let simTimeMs = Date.UTC(2026, 0, 1, 0, 0, 0);
  const step = (samples: LinkSample[]) => {
    simTimeMs += 1000;
    return manager.update(samples, 1, simTimeMs);
  };

  step([createLinkSample('source-sat', 1, 20)]);
  assert.equal(manager.state.satId, 'source-sat');
  assert.equal(manager.state.beamId, 1);

  const firstIntra = step([
    createLinkSample('source-sat', 1, 10),
    createLinkSample('source-sat', 2, 12),
  ]);
  assert.equal(firstIntra.action, 'intra-switch');
  assert.equal(manager.state.beamId, 2);

  const blockedIntra = step([
    createLinkSample('source-sat', 2, 10),
    createLinkSample('source-sat', 3, 14),
  ]);
  assert.equal(blockedIntra.action, 'stay');
  assert.match(blockedIntra.reason, /intra-switch epoch limit reached/);
  assert.equal(manager.state.satId, 'source-sat');
  assert.equal(manager.state.beamId, 2);

  step([
    createLinkSample('source-sat', 2, 10),
    createLinkSample('source-sat', 3, 14),
    createLinkSample('target-sat', 1, 20),
  ]);
  const inter = step([
    createLinkSample('source-sat', 2, 10),
    createLinkSample('source-sat', 3, 14),
    createLinkSample('target-sat', 1, 20),
  ]);
  assert.equal(inter.action, 'inter-handover');
  assert.equal(manager.state.satId, 'target-sat');
  assert.equal(manager.state.beamId, 1);

  const intraAfterInterReset = step([
    createLinkSample('target-sat', 1, 8),
    createLinkSample('target-sat', 2, 12),
  ]);
  assert.equal(intraAfterInterReset.action, 'intra-switch');
  assert.equal(manager.state.satId, 'target-sat');
  assert.equal(manager.state.beamId, 2);
}

function assertInterGatePreemptsIntraSwitch(): void {
  const profile = loadProfile(PROFILE_ID);
  const manager = new HandoverManager({
    ...profile.handover,
    triggerTimeSec: 1,
    pingPongGuardSec: 0,
    intraSwitchTimeSec: 1,
    maxIntraSwitchesPerServingEpoch: 2,
    sinrSmoothingSec: 0,
  });
  let simTimeMs = Date.UTC(2026, 0, 1, 0, 0, 0);
  const step = (samples: LinkSample[]) => {
    simTimeMs += 1000;
    return manager.update(samples, 1, simTimeMs);
  };

  step([createLinkSample('source-sat', 1, 20)]);
  const pendingInter = step([
    createLinkSample('source-sat', 1, 10),
    createLinkSample('source-sat', 2, 12),
    createLinkSample('target-sat', 1, 20),
  ]);
  assert.equal(pendingInter.action, 'stay');
  assert.deepEqual(manager.state.pendingTarget, { satId: 'target-sat', beamId: 1 });
  assert.equal(manager.state.satId, 'source-sat');
  assert.equal(manager.state.beamId, 1);

  const inter = step([
    createLinkSample('source-sat', 1, 10),
    createLinkSample('source-sat', 2, 12),
    createLinkSample('target-sat', 1, 20),
  ]);
  assert.equal(inter.action, 'inter-handover');
  assert.equal(manager.state.satId, 'target-sat');
  assert.equal(manager.state.beamId, 1);

  const conservativeManager = new HandoverManager({
    ...profile.handover,
    offsetDb: 5,
    pingPongGuardSec: 0,
    intraSwitchTimeSec: 1,
    sinrSmoothingSec: 0,
  });
  let conservativeTimeMs = Date.UTC(2026, 0, 1, 0, 0, 0);
  const conservativeStep = (samples: LinkSample[]) => {
    conservativeTimeMs += 1000;
    return conservativeManager.update(samples, 1, conservativeTimeMs);
  };
  conservativeStep([createLinkSample('source-sat', 1, 20)]);
  const notQualifiedInter = conservativeStep([
    createLinkSample('source-sat', 1, 10),
    createLinkSample('source-sat', 2, 12),
    createLinkSample('target-sat', 1, 14),
  ]);
  assert.equal(notQualifiedInter.action, 'stay');
  assert.equal(conservativeManager.state.satId, 'source-sat');
  assert.equal(conservativeManager.state.beamId, 1);
}

function assertPostInterGuardBlocksImmediateIntra(): void {
  const profile = loadProfile(PROFILE_ID);
  const manager = new HandoverManager({
    ...profile.handover,
    triggerTimeSec: 1,
    pingPongGuardSec: 3,
    intraSwitchTimeSec: 1,
    maxIntraSwitchesPerServingEpoch: 1,
    sinrSmoothingSec: 0,
  });
  let simTimeMs = Date.UTC(2026, 0, 1, 0, 0, 0);
  const step = (samples: LinkSample[]) => {
    simTimeMs += 1000;
    return manager.update(samples, 1, simTimeMs);
  };

  step([createLinkSample('source-sat', 1, 20)]);
  step([createLinkSample('source-sat', 1, 18)]);
  step([createLinkSample('source-sat', 1, 18)]);
  step([createLinkSample('source-sat', 1, 18)]);
  step([
    createLinkSample('source-sat', 1, 10),
    createLinkSample('target-sat', 1, 20),
  ]);
  const inter = step([
    createLinkSample('source-sat', 1, 10),
    createLinkSample('target-sat', 1, 20),
  ]);
  assert.equal(inter.action, 'inter-handover');
  assert.equal(manager.state.satId, 'target-sat');

  const guardedIntra = step([
    createLinkSample('target-sat', 1, 8),
    createLinkSample('target-sat', 2, 12),
  ]);
  assert.equal(guardedIntra.action, 'stay');
  assert.match(guardedIntra.reason, /handover guard active/);
  assert.equal(manager.state.beamId, 1);

  step([
    createLinkSample('target-sat', 1, 8),
    createLinkSample('target-sat', 2, 12),
  ]);
  const intraAfterGuard = step([
    createLinkSample('target-sat', 1, 8),
    createLinkSample('target-sat', 2, 12),
  ]);
  assert.equal(intraAfterGuard.action, 'intra-switch');
  assert.equal(manager.state.beamId, 2);
}

function assertServedBeamCannotRepeatWithinSatelliteEpoch(): void {
  const profile = loadProfile(PROFILE_ID);
  const manager = new HandoverManager({
    ...profile.handover,
    pingPongGuardSec: 0,
    intraSwitchTimeSec: 1,
    maxIntraSwitchesPerServingEpoch: 3,
    sinrSmoothingSec: 0,
  });
  let simTimeMs = Date.UTC(2026, 0, 1, 0, 0, 0);
  const step = (samples: LinkSample[]) => {
    simTimeMs += 1000;
    return manager.update(samples, 1, simTimeMs);
  };

  step([createLinkSample('source-sat', 1, 20)]);
  step([
    createLinkSample('source-sat', 1, 10),
    createLinkSample('source-sat', 2, 12),
  ]);
  assert.equal(manager.state.beamId, 2);

  const repeatAttempt = step([
    createLinkSample('source-sat', 1, 14),
    createLinkSample('source-sat', 2, 10),
  ]);
  assert.equal(repeatAttempt.action, 'stay');
  assert.match(repeatAttempt.reason, /beam B1 already served/);
  assert.equal(manager.state.beamId, 2);
}

function assertHandoverResetReturnsToReplayStart(): void {
  const source = readFileSync(new URL('../src/scene/useSimulation.ts', import.meta.url), 'utf8');
  const effectEnd = source.indexOf('}, [handoverResetKey]);');
  assert.ok(effectEnd > 0, 'expected a dedicated handoverResetKey effect');
  const effectStart = source.lastIndexOf('useEffect(() => {', effectEnd);
  assert.ok(effectStart >= 0, 'expected handoverResetKey useEffect start');
  const block = source.slice(effectStart, effectEnd);
  assertContains(block, 'resetToReplayStartFrame();');
  assertContains(source, 'const resetToReplayStartFrame = useCallback(() => {');
  assertContains(source, 'createRuntimeFrameStepState(startOffset)');
  assertContains(source, 'paused: true');
  assertContains(source, 'deltaSec: 0');
  assertContains(source, 'frameRef.current = frame');
  assertNotContains(block, 'frameRef.current = createEmptyFrame(runtimeStateRef.current.simTimeSec)');
  assertNotContains(block, 'beamPowerControlRef.current =');
}

function run(): void {
  assertTuningPlacementAndCopy();
  assertModeVisibility();
  assertDraftApplySeparation();
  assertResetClearsStaleEvidence();
  assertHandoverManagerResetCoverage();
  assertIntraSwitchEpochGuard();
  assertInterGatePreemptsIntraSwitch();
  assertPostInterGuardBlocksImmediateIntra();
  assertServedBeamCannotRepeatWithinSatelliteEpoch();
  assertHandoverResetReturnsToReplayStart();

  console.log('Phase 6C handover policy top-level sidebar tab validation passed.');
  console.log(JSON.stringify({
    profileId: PROFILE_ID,
    asserted: {
      placement: 'Top mode selector owns SINR/MODQN; left sidebar shows mode-specific controls',
      copy: ['policy: sinr-offset read-only', 'Handover attach threshold', 'Intra-HO limit per satellite', 'no standalone handover SINR threshold label'],
      state: ['draft does not alter effective policy', 'apply updates effective policy', 'reset state clears stale handover evidence', 'inter gate preempts intra', 'post-inter guard blocks immediate intra', 'intra epoch guard resets after inter-HO'],
      preservation: ['handover reset returns to replay start offset', 'handover reset publishes a zero-delta initial frame'],
    },
  }, null, 2));
}

run();
