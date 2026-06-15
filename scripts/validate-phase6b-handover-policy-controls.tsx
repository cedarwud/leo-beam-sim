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
import {
  resolveHandoverToastState,
  type HandoverToastInput,
} from '../src/viz/handoverToastState.ts';
import { createSignalTuningState, applySignalTuning } from '../src/signalTuning.ts';
import { HandoverPolicyControls } from '../src/ui/HandoverPolicyControls.tsx';
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

function renderTuningMarkups() {
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
      formulaBudget={null}
      onTuningChange={() => {}}
      onReset={() => {}}
    />,
  );
  const handoverMarkup = renderToStaticMarkup(
    <HandoverPolicyControls
      draft={draft}
      applied={applied}
      hasDraftChanges
      hasOverrides
      onDraftChange={() => {}}
      onApply={() => {}}
      onReset={() => {}}
    />,
  );

  return {
    signalMarkup,
    handoverMarkup,
    text: decodeHtmlText(handoverMarkup),
    profile,
    applied,
    draft,
  };
}

// G1-declutter (commit c37535e) REMOVED the old top-level left-sidebar tab model
// (`type LeftSidebarTab = 'objective' | 'signal' | 'handover'` + a "Handover
// policy" sidebar tab). The current model is a light 'summary' | 'evidence' left
// rail; the HandoverPolicyControls + SignalTuningPanel power tools now render as
// the `handoverPolicySection` / `sinrFormulaSection` of the ⚙ Advanced
// SinrLiveDisplayDrawer. This asserts the CURRENT placement truth, not the dead
// top-level-tab scaffolding.
function assertHandoverPolicyLivesInAdvancedDrawer(): void {
  const runtimeModelSource = readFileSync(
    new URL('../src/app/appRuntimeModel.ts', import.meta.url),
    'utf8',
  );
  const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const signalPanelSource = readFileSync(new URL('../src/ui/SignalTuningPanel.tsx', import.meta.url), 'utf8');

  // The old triplet tab model is intentionally gone; the left rail is summary/evidence.
  assertContains(runtimeModelSource, "export type LeftSidebarTab = 'summary' | 'evidence'");
  assertNotContains(runtimeModelSource, "'objective' | 'signal' | 'handover'");

  // HandoverPolicyControls is injected as the handoverPolicySection of the ⚙
  // Advanced SinrLiveDisplayDrawer — NOT a top-level sidebar tab. Assert the
  // ordered nesting: drawer open → handoverPolicySection prop → the controls.
  const drawerIndex = appSource.indexOf('<SinrLiveDisplayDrawer');
  const handoverSectionIndex = appSource.indexOf('handoverPolicySection={', drawerIndex);
  const handoverControlsIndex = appSource.indexOf('<HandoverPolicyControls', handoverSectionIndex);
  assert.ok(drawerIndex >= 0, 'expected the SINR-live Advanced drawer mount');
  assert.ok(
    handoverSectionIndex > drawerIndex,
    'expected handoverPolicySection prop inside the Advanced drawer',
  );
  assert.ok(
    handoverControlsIndex > handoverSectionIndex,
    'expected HandoverPolicyControls passed as the Advanced drawer handoverPolicySection',
  );
  assertContains(appSource, 'sinrFormulaSection={');

  // SignalTuningPanel must stay a distinct layer (no embedded handover policy).
  assertNotContains(signalPanelSource, 'HandoverPolicyControls');
  assertNotContains(signalPanelSource, 'handover-policy-page');
  assertNotContains(signalPanelSource, 'tuning-page-tabs');
}

function assertTuningPlacementAndCopy(): void {
  const { signalMarkup, handoverMarkup, text } = renderTuningMarkups();
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

  assertContains(signalMarkup, 'data-testid="sinr-formula-page"');
  assertContains(signalMarkup, 'data-testid="sinr-formula-tabs"');
  assertContains(handoverMarkup, 'data-testid="handover-policy-controls"');
  assertNotContains(signalMarkup, 'data-testid="handover-policy-controls"');
  assertNotContains(decodeHtmlText(signalMarkup), 'Handover Policy Research Controls');
  assertHandoverPolicyLivesInAdvancedDrawer();
}

function assertModeVisibility(): void {
  const profile = loadProfile(PROFILE_ID);
  const initialState = createInitialSimState(profile);
  const presentationText = decodeHtmlText(renderToStaticMarkup(
    <InfoPanel {...initialState} profile={profile} />,
  ));
  assertNotContains(presentationText, 'Handover Policy Research Controls');
  assertNotContains(presentationText, 'Apply policy changes');
  assertNotContains(presentationText, 'Reset to profile defaults');
  assertNotContains(presentationText, 'Handover policy (effective)');

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
      profile={profile}
      handoverMode="decision-overlay-on-live-sinr"
    />,
  ));
  // Re-pinned to current MODQN-overlay live-status copy (getLiveStatusModeCopy
  // in src/ui/InfoPanel.tsx). The consolidation refactors 16e7207 (S4-4a) /
  // cc959d7 (S5-2b) reworded these strings; the assert INTENT is unchanged —
  // the MODQN-overlay mode panel must show MODQN-replay-overlay serving copy +
  // the live Δ SINR + decision-timing gate, and must NOT show "replay evidence".
  assertContains(modqnLiveStatusText, 'MODQN replay decision overlay');
  assertContains(modqnLiveStatusText, 'serving beam displays the MODQN replay decision overlay');
  assertContains(modqnLiveStatusText, 'MODQN overlay serving link');
  assertContains(modqnLiveStatusText, 'live SINR reference');
  assertContains(modqnLiveStatusText, 'live Δ SINR');
  assertContains(modqnLiveStatusText, 'decision timing threshold');
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

function assertIntraSwitchPreview(): void {
  const profile = loadProfile(PROFILE_ID);
  const manager = new HandoverManager({
    ...profile.handover,
    pingPongGuardSec: 0,
    intraSwitchTimeSec: 2,
    sinrSmoothingSec: 0,
  });
  let simTimeMs = Date.UTC(2026, 0, 1, 0, 0, 0);
  const step = (samples: LinkSample[], dt = 1) => {
    simTimeMs += dt * 1000;
    return manager.update(samples, dt, simTimeMs);
  };

  step([createLinkSample('source-sat', 1, 20)]);
  assert.equal(manager.getIntraSwitchPreview(), null, 'preview should be null before any intra target is queued');

  const pendingIntra = step([
    createLinkSample('source-sat', 1, 10),
    createLinkSample('source-sat', 2, 12),
  ], 0.5);
  assert.equal(pendingIntra.action, 'stay');
  assert.deepEqual(manager.getIntraSwitchPreview(), {
    satId: 'source-sat',
    fromBeamId: 1,
    toBeamId: 2,
    triggerTimeSec: 0.5,
    triggerTimeTargetSec: 2,
    progress: 0.25,
  });

  const committedIntra = step([
    createLinkSample('source-sat', 1, 10),
    createLinkSample('source-sat', 2, 12),
  ], 1.5);
  assert.equal(committedIntra.action, 'intra-switch');
  assert.equal(manager.getIntraSwitchPreview(), null, 'preview should clear after committed intra-switch');
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
  assertContains(source, 'const resetToReplayStartFrame = useCallback((options?: { timeShift?: boolean }) => {');
  // S3-3: resetToReplayStartFrame delegates to the single buildRuntimeStateAt recipe,
  // which builds the fresh state at the (cold-start) target offset and renders a
  // paused zero-delta reseat frame — never a blank createEmptyFrame.
  assertContains(source, 'createRuntimeFrameStepState(targetOffset)');
  assertContains(source, 'paused: true');
  assertContains(source, 'deltaSec: 0');
  assertContains(source, 'frameRef.current = frame');
  assertNotContains(block, 'frameRef.current = createEmptyFrame(runtimeStateRef.current.simTimeSec)');
  assertNotContains(block, 'beamPowerControlRef.current =');
}

function assertInterHandoverUsesBeamLevelVisualParity(): void {
  // intra-vis SDD §5.2 B6: inter-HO uses the same beam-level display language
  // as intra-HO (yellow source, blue target) via a generic `handoverRole`
  // channel + a display-only wall-clock latch parallel to intra. PR-2 reused
  // the existing wall-clock latch constant; PR-4 (B5 / §13.1) renames the
  // constant to `HANDOVER_VISUAL_LATCH_WALLCLOCK_MS` and widens both latches
  // to 6000 ms.
  const runtimeSource = readFileSync(new URL('../src/scene/runtimeFrameStep.ts', import.meta.url), 'utf8');
  const vizSource = readFileSync(new URL('../src/scene/useBeamViz.ts', import.meta.url), 'utf8');
  const beamSource = readFileSync(new URL('../src/viz/SatelliteBeams.tsx', import.meta.url), 'utf8');
  const calloutSource = readFileSync(new URL('../src/viz/BeamCalloutContent.tsx', import.meta.url), 'utf8');
  const tokenSource = readFileSync(new URL('../src/constants/beamRoleTokens.ts', import.meta.url), 'utf8');

  assertContains(runtimeSource, 'const HANDOVER_VISUAL_LATCH_WALLCLOCK_MS = 6000');
  assertContains(runtimeSource, 'state.interHandoverEvent = {');
  assertContains(runtimeSource, 'state.interHandoverVizLatch = {');
  assertContains(vizSource, "interRoleByBeamId.set(servingBeamId, 'interSource')");
  assertContains(vizSource, "interRoleByBeamId.set(pendingTargetBeamId, 'interTargetNewServing')");
  assertContains(vizSource, "interRoleByBeamId.set(committedInterEvent.fromBeamId, 'interSource')");
  assertContains(vizSource, "interRoleByBeamId.set(committedInterEvent.toBeamId, 'interTargetNewServing')");
  assertContains(vizSource, 'handoverRole,');
  assertContains(vizSource, 'handoverTransitionProgress,');
  assertContains(beamSource, "handoverRole === 'interSource'");
  assertContains(beamSource, "handoverRole === 'interTargetNewServing'");
  assertContains(beamSource, 'HANDOVER_SOURCE_COLOR');
  assertContains(beamSource, 'HANDOVER_TARGET_COLOR');
  assertContains(calloutSource, 'data-handover-role');
  assertContains(calloutSource, 'data-handover-color');
  assertContains(tokenSource, "input.role === 'intraSource' || input.role === 'interSource'");
  assertContains(tokenSource, "input.role === 'intraTargetNewServing' || input.role === 'interTargetNewServing'");
}

function makeToastInput(transitionProgress: HandoverToastInput['transitionProgress']): HandoverToastInput {
  return { transitionProgress };
}

function assertHandoverToastFollowsActivePolicyState(): void {
  // intra-vis SDD §5.2 B5: toast follows the active intra preview / committed
  // wall-clock latch and the inter pending / committed wall-clock latch.
  // It must not use a synthetic setTimeout or the recent-HO linger window.
  const toastSource = readFileSync(new URL('../src/viz/HandoverToastOverlay.tsx', import.meta.url), 'utf8');
  const stateSource = readFileSync(new URL('../src/viz/handoverToastState.ts', import.meta.url), 'utf8');

  // No transition state at all → no toast.
  assert.equal(resolveHandoverToastState(makeToastInput({}), 2, 1500), null);

  // Inter pending: pending pre-trigger phase, pending* fields populated.
  const interPendingToast = resolveHandoverToastState(makeToastInput({
    inter: {
      fromSatId: 'source-sat',
      fromBeamId: '1',
      toSatId: 'target-sat',
      toBeamId: '4',
      progress01: 0.5,
      expiresAtSec: 0,
      kind: 'pending',
      pendingProgressSec: 0.75,
      pendingTargetSec: 1.5,
    },
  }), 1.5, 1500);
  assert.equal(interPendingToast?.kind, 'inter');
  assert.equal(interPendingToast?.sourceSatId, 'source-sat');
  assert.equal(interPendingToast?.sourceBeamId, 1);
  assert.equal(interPendingToast?.targetSatId, 'target-sat');
  assert.equal(interPendingToast?.targetBeamId, 4);
  assert.equal(interPendingToast?.progressSec, 0.75);
  assert.equal(interPendingToast?.targetSec, 1.5);
  assert.equal(interPendingToast?.progressRatio, 0.5);

  // Inter committed: wall-clock latch active.
  const interTransitionToast = resolveHandoverToastState(makeToastInput({
    inter: {
      fromSatId: 'source-sat',
      fromBeamId: '1',
      toSatId: 'target-sat',
      toBeamId: '4',
      progress01: 0.5,
      expiresAtSec: 85,
      kind: 'committed',
      wallClockStartMs: 1000,
      wallClockExpiresMs: 7000,
    },
  }), 1.5, 4000);
  assert.equal(interTransitionToast?.kind, 'inter');
  assert.equal(interTransitionToast?.sourceSatId, 'source-sat');
  assert.equal(interTransitionToast?.sourceBeamId, 1);
  assert.equal(interTransitionToast?.targetSatId, 'target-sat');
  assert.equal(interTransitionToast?.targetBeamId, 4);
  assert.equal(interTransitionToast?.progressSec, 3);
  assert.equal(interTransitionToast?.targetSec, 6);
  assert.equal(interTransitionToast?.progressRatio, 0.5);

  // Intra preview: dwell preview, intra wins over a concurrent inter pending state.
  const intraPreviewToast = resolveHandoverToastState(makeToastInput({
    intra: {
      fromBeamId: '1',
      toBeamId: '2',
      progress01: 0.3,
      expiresAtSec: 0,
      kind: 'preview',
      satId: 'source-sat',
      previewProgressSec: 0.6,
      previewTargetSec: 2,
    },
    inter: {
      fromSatId: 'source-sat',
      fromBeamId: '1',
      toSatId: 'target-sat',
      toBeamId: '4',
      progress01: 0.4,
      expiresAtSec: 0,
      kind: 'pending',
      pendingProgressSec: 0.8,
      pendingTargetSec: 2,
    },
  }), 1.5, 1500);
  assert.equal(intraPreviewToast?.kind, 'intra');
  assert.equal(intraPreviewToast?.sourceSatId, 'source-sat');
  assert.equal(intraPreviewToast?.sourceBeamId, 1);
  assert.equal(intraPreviewToast?.targetSatId, 'source-sat');
  assert.equal(intraPreviewToast?.targetBeamId, 2);
  assert.equal(intraPreviewToast?.progressSec, 0.6);
  assert.equal(intraPreviewToast?.targetSec, 2);
  assert.equal(intraPreviewToast?.progressRatio, 1);

  // Intra committed: wall-clock latch active.
  const intraTransitionToast = resolveHandoverToastState(makeToastInput({
    intra: {
      fromBeamId: '1',
      toBeamId: '2',
      progress01: 0.5,
      expiresAtSec: 42.4,
      kind: 'committed',
      satId: 'source-sat',
      wallClockStartMs: 1000,
      wallClockExpiresMs: 4000,
    },
  }), 1.5, 2500);
  assert.equal(intraTransitionToast?.kind, 'intra');
  assert.equal(intraTransitionToast?.progressSec, 1.5);
  assert.equal(intraTransitionToast?.targetSec, 3);
  assert.equal(intraTransitionToast?.progressRatio, 0.5);

  // Past the wall-clock latch expiry → no toast.
  assert.equal(resolveHandoverToastState(makeToastInput({
    intra: {
      fromBeamId: '1',
      toBeamId: '2',
      progress01: 1,
      expiresAtSec: 42.4,
      kind: 'committed',
      satId: 'source-sat',
      wallClockStartMs: 1000,
      wallClockExpiresMs: 4000,
    },
  }), 1.5, 4500), null);

  // Source contract: toast reads NormalizedSceneFrame.transitionProgress
  // (intra preview / committed + inter pending / committed); never recentHo
  // or synthetic setTimeout.
  assertContains(toastSource, 'resolveHandoverToastState(frame, interTriggerSec, wallClockNowMs)');
  assertContains(stateSource, 'transitionProgress.intra');
  assertContains(stateSource, 'transitionProgress.inter');
  assertContains(stateSource, "kind === 'preview'");
  assertContains(stateSource, "kind === 'committed'");
  assertContains(stateSource, "kind === 'pending'");
  assertContains(stateSource, 'wallClockExpiresMs');
  assertNotContains(toastSource, 'setTimeout');
  assertNotContains(stateSource, 'setTimeout');
  assertNotContains(stateSource, 'recentHo');
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
  assertIntraSwitchPreview();
  assertServedBeamCannotRepeatWithinSatelliteEpoch();
  assertHandoverResetReturnsToReplayStart();
  assertInterHandoverUsesBeamLevelVisualParity();
  assertHandoverToastFollowsActivePolicyState();

  console.log('Phase 6C handover policy Advanced-drawer placement validation passed.');
  console.log(JSON.stringify({
    profileId: PROFILE_ID,
    asserted: {
      placement: 'No top-level handover sidebar tab; the ⚙ Advanced SinrLiveDisplayDrawer hosts the handover-policy + SINR-formula sections (left rail is summary/evidence)',
      copy: ['policy: sinr-offset read-only', 'Handover attach threshold', 'Intra-HO limit per satellite', 'no standalone handover SINR threshold label'],
      state: ['draft does not alter effective policy', 'apply updates effective policy', 'reset state clears stale handover evidence', 'inter gate preempts intra', 'post-inter guard blocks immediate intra', 'intra dwell preview surfaces while accumulating', 'intra epoch guard resets after inter-HO'],
      preservation: ['handover reset returns to replay start offset', 'handover reset publishes a zero-delta initial frame'],
      visualParity: ['inter source/target beams use the same yellow/blue beam-level overlay as intra', 'inter visual latch is display-only wall-clock state', 'handover visual latch widened to 6.0 s wall-clock'],
      toast: ['intra toast follows intra preview / committed state', 'inter toast follows pending / committed state', 'no synthetic toast timeout, no recentHo dependency'],
    },
  }, null, 2));
}

run();
