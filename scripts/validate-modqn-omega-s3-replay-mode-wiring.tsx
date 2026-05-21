#!/usr/bin/env node
// validate-modqn-omega-s3-replay-mode-wiring.tsx
//
// S3 acceptance validator (SDD §9.4):
//   (a) override is null / no-op in sinr-offset mode (truth invariance)
//   (b) reScalarize returns correct argmax for a synthetic candidates array
//   (c) fallback fires when all candidates lack objectiveQ
//   (d) reference artifact profile constant is 'modqn-1sat-7beam'
//   (e) localStorage persistence: sinr-offset and modqn-replay are persisted;
//       omega-heuristic is NOT persisted
//   (f) ModqnHandoverModeContext is exported from useModqnHandoverState
//   (g) data-handover-criterion attribute is added to leo-shell-canvas in App.tsx
//   (h) DiagnosticsDrawer accepts handoverMode + rescalarizeFallbackCount props
//   (i) ControlBar accepts handoverMode + onHandoverModeChange props and
//       exposes only the public SINR / MODQN replay modes
//   (j) S3HandoverManager subclass exists in useSimulation.ts (overrides update)
//   (k) MODQN evidence / replay telemetry are mode-gated and cannot look live in SINR mode
//
// Run: node --import tsx/esm scripts/validate-modqn-omega-s3-replay-mode-wiring.tsx

import { reScalarize } from '../src/modqn/replay-bundle/rescalarize';
import {
  HANDOVER_MODE_STORAGE_KEY,
  persistHandoverMode,
  readPersistedHandoverMode,
  DEFAULT_RUNTIME_HANDOVER_MODE,
  ModqnHandoverModeContext,
  ModqnHandoverModeProvider,
  type RuntimeHandoverMode,
} from '../src/ui/useModqnHandoverState';
import { MODQN_1SAT_7BEAM_PROFILE_ID } from '../src/profiles';
import * as fs from 'node:fs';
import * as path from 'node:path';

let passed = 0;
let failed = 0;

function pass(label: string): void {
  console.log(`  [PASS] ${label}`);
  passed++;
}

function fail(label: string, detail?: string): void {
  console.error(`  [FAIL] ${label}${detail ? `: ${detail}` : ''}`);
  failed++;
}

function assert(cond: boolean, label: string, detail?: string): void {
  if (cond) {
    pass(label);
  } else {
    fail(label, detail);
  }
}

// ---------------------------------------------------------------------------
// (a) Override is null in sinr-offset mode — verified via ModqnHandoverModeContext
//     default value. The default context has mode='sinr-offset'.
// ---------------------------------------------------------------------------
console.log('\n(a) Override null in sinr-offset mode — context default');
{
  assert(
    DEFAULT_RUNTIME_HANDOVER_MODE === 'sinr-offset',
    'DEFAULT_RUNTIME_HANDOVER_MODE is sinr-offset',
  );
  assert(
    ModqnHandoverModeContext !== undefined && ModqnHandoverModeContext !== null,
    'ModqnHandoverModeContext is exported',
  );
  assert(
    ModqnHandoverModeProvider !== undefined,
    'ModqnHandoverModeProvider is exported',
  );
}

// ---------------------------------------------------------------------------
// (b) reScalarize correct argmax
// ---------------------------------------------------------------------------
console.log('\n(b) reScalarize argmax over synthetic candidates');
{
  // Candidate 0: high throughput, low handover, low load
  // Candidate 1: low throughput, high handover, high load
  // With ω = (0.5, 0.3, 0.2) argmax should be candidate 0.
  const candidates = [
    {
      beamId: 'SAT-0:B0',
      beamIndex: 0,
      satId: 'SAT-0',
      satIndex: 0,
      localBeamIndex: 0,
      objectiveQ: { throughput: 0.9, handover: 0.2, loadBalance: 0.3 },
    },
    {
      beamId: 'SAT-0:B1',
      beamIndex: 1,
      satId: 'SAT-0',
      satIndex: 0,
      localBeamIndex: 1,
      objectiveQ: { throughput: 0.3, handover: 0.8, loadBalance: 0.7 },
    },
  ];
  const omega1 = { throughput: 0.5, handover: 0.3, loadBalance: 0.2 };
  // Q(c0) = 0.5*0.9 + 0.3*0.2 + 0.2*0.3 = 0.45 + 0.06 + 0.06 = 0.57
  // Q(c1) = 0.5*0.3 + 0.3*0.8 + 0.2*0.7 = 0.15 + 0.24 + 0.14 = 0.53
  const r1 = reScalarize(candidates, omega1);
  assert(r1 !== null, 'reScalarize returns non-null for valid candidates');
  assert(r1?.beamId === 0, 'argmax selects candidate 0 (beamId=localBeamIndex=0)', `got beamId=${r1?.beamId}`);
  assert(r1?.satId === 'SAT-0', 'satId matches', `got ${r1?.satId}`);
  assert(r1?.wasFallback === false, 'wasFallback=false when objectiveQ present');

  // With ω = (0.1, 0.8, 0.1) argmax should be candidate 1.
  const omega2 = { throughput: 0.1, handover: 0.8, loadBalance: 0.1 };
  // Q(c0) = 0.1*0.9 + 0.8*0.2 + 0.1*0.3 = 0.09 + 0.16 + 0.03 = 0.28
  // Q(c1) = 0.1*0.3 + 0.8*0.8 + 0.1*0.7 = 0.03 + 0.64 + 0.07 = 0.74
  const r2 = reScalarize(candidates, omega2);
  assert(r2 !== null, 'reScalarize returns non-null for valid candidates (omega2)');
  assert(r2?.beamId === 1, 'argmax selects candidate 1 (beamId=localBeamIndex=1)', `got beamId=${r2?.beamId}`);

  // Empty candidates → null (caller defers to sinr-offset).
  const r3 = reScalarize([], { throughput: 0.4, handover: 0.3, loadBalance: 0.3 });
  assert(r3 === null, 'empty candidates → null');

  // Undefined candidates → null.
  const r4 = reScalarize(undefined, { throughput: 0.4, handover: 0.3, loadBalance: 0.3 });
  assert(r4 === null, 'undefined candidates → null');
}

// ---------------------------------------------------------------------------
// (c) Fallback fires when all candidates lack objectiveQ
// ---------------------------------------------------------------------------
console.log('\n(c) Fallback fires when all candidates lack objectiveQ');
{
  const candidatesNoQ = [
    {
      beamId: 'SAT-0:B0',
      beamIndex: 0,
      satId: 'SAT-0',
      satIndex: 0,
      localBeamIndex: 5,
      // no objectiveQ
    },
    {
      beamId: 'SAT-0:B1',
      beamIndex: 1,
      satId: 'SAT-0',
      satIndex: 0,
      localBeamIndex: 6,
      // no objectiveQ
    },
  ];
  const rFallback = reScalarize(candidatesNoQ, { throughput: 0.4, handover: 0.3, loadBalance: 0.3 });
  assert(rFallback !== null, 'non-null result even without objectiveQ (fallback path)');
  assert(rFallback?.wasFallback === true, 'wasFallback=true when all candidates lack objectiveQ');
  assert(rFallback?.beamId === 5, 'falls back to candidates[0].localBeamIndex=5', `got ${rFallback?.beamId}`);

  // Producer-side naming (r1Throughput etc.) should also work.
  const candidatesProducerNaming = [
    {
      beamId: 'SAT-0:B0',
      beamIndex: 0,
      satId: 'SAT-1',
      satIndex: 1,
      localBeamIndex: 2,
      objectiveQ: { r1Throughput: 0.7, r2Handover: 0.4, r3LoadBalance: 0.5 },
    },
  ];
  const rProducer = reScalarize(candidatesProducerNaming, { throughput: 0.4, handover: 0.3, loadBalance: 0.3 });
  assert(rProducer !== null, 'producer naming works');
  assert(rProducer?.wasFallback === false, 'wasFallback=false with producer naming Q');
  assert(rProducer?.satId === 'SAT-1', 'satId from producer naming candidate');
}

// ---------------------------------------------------------------------------
// (d) Reference artifact profile: modqn-1sat-7beam constant
// ---------------------------------------------------------------------------
console.log('\n(d) Reference artifact profile: modqn-1sat-7beam constant');
{
  assert(
    MODQN_1SAT_7BEAM_PROFILE_ID === 'modqn-1sat-7beam',
    "MODQN_1SAT_7BEAM_PROFILE_ID === 'modqn-1sat-7beam'",
    `got: ${MODQN_1SAT_7BEAM_PROFILE_ID}`,
  );
}

// ---------------------------------------------------------------------------
// (e) localStorage persistence: sinr-offset + modqn-replay persisted;
//     omega-heuristic never persisted
// ---------------------------------------------------------------------------
console.log('\n(e) localStorage persistence rules');
{
  // Verify HANDOVER_MODE_STORAGE_KEY is set
  assert(
    typeof HANDOVER_MODE_STORAGE_KEY === 'string' && HANDOVER_MODE_STORAGE_KEY.length > 0,
    'HANDOVER_MODE_STORAGE_KEY is a non-empty string',
    HANDOVER_MODE_STORAGE_KEY,
  );

  // Test localStorage behavior via a mock (Node doesn't have window.localStorage)
  // We test the function logic by verifying the source code directly.
  const persistSrc = fs.readFileSync(
    path.resolve(import.meta.dirname ?? process.cwd(), '../src/ui/useModqnHandoverState.ts'),
    'utf8',
  );
  assert(
    persistSrc.includes("'omega-heuristic'") && persistSrc.includes('PERSISTABLE_MODES'),
    'persistHandoverMode references PERSISTABLE_MODES with omega-heuristic exclusion',
  );
  assert(
    persistSrc.includes("stored === 'sinr-offset' || stored === 'modqn-replay'"),
    'readPersistedHandoverMode only accepts sinr-offset or modqn-replay',
  );
}

// ---------------------------------------------------------------------------
// (f) ModqnHandoverModeContext is exported + has omegaActive field
// ---------------------------------------------------------------------------
console.log('\n(f) ModqnHandoverModeContext shape');
{
  // The default context value should have omegaActive.
  const ctxDefault = (ModqnHandoverModeContext as { _defaultValue?: unknown } & typeof ModqnHandoverModeContext);
  // Access via displayName trick or just verify by import success.
  assert(
    typeof ModqnHandoverModeContext === 'object' && ModqnHandoverModeContext !== null,
    'ModqnHandoverModeContext is an object',
  );
  assert(
    typeof ModqnHandoverModeProvider === 'function',
    'ModqnHandoverModeProvider is a function',
  );
  const hookSrc = fs.readFileSync(
    path.resolve(import.meta.dirname ?? process.cwd(), '../src/ui/useModqnHandoverState.ts'),
    'utf8',
  );
  assert(
    hookSrc.includes('const activeOmega = modeCtxIsDefault ? omegaActive : modeCtx.omegaActive')
    && hookSrc.includes('omegaActive: activeOmega'),
    'useModqnHandoverState returns context omegaActive when a provider is present',
  );
  assert(
    hookSrc.includes('currentRowSelectedServing')
    && hookSrc.includes('currentSlotIndex')
    && hookSrc.includes('currentTimeSec'),
    'BundleSidebarSnapshot exposes current-slot producer selectedServing for evidence trace',
  );
  void ctxDefault; // suppress unused
}

// ---------------------------------------------------------------------------
// (g) data-handover-criterion in App.tsx JSX
// ---------------------------------------------------------------------------
console.log('\n(g) App.tsx data-handover-criterion attribute');
{
  const appSrc = fs.readFileSync(
    path.resolve(import.meta.dirname ?? process.cwd(), '../src/App.tsx'),
    'utf8',
  );
  assert(
    appSrc.includes('data-handover-criterion'),
    'App.tsx contains data-handover-criterion attribute',
  );
  assert(
    appSrc.includes("handoverMode === 'modqn-replay' ? 'modqn-replay' : 'sinr-offset'"),
    "App.tsx switches data-handover-criterion between 'modqn-replay' and 'sinr-offset'",
  );
  assert(
    appSrc.includes("if (handoverMode !== 'modqn-replay')") && appSrc.includes('return null;'),
    'App.tsx nulls rendered MODQN replay display state outside modqn-replay mode',
  );
}

// ---------------------------------------------------------------------------
// (h) DiagnosticsDrawer accepts handoverMode + rescalarizeFallbackCount
// ---------------------------------------------------------------------------
console.log('\n(h) DiagnosticsDrawer props');
{
  const drawSrc = fs.readFileSync(
    path.resolve(import.meta.dirname ?? process.cwd(), '../src/ui/DiagnosticsDrawer.tsx'),
    'utf8',
  );
  assert(
    drawSrc.includes('handoverMode'),
    'DiagnosticsDrawer.tsx contains handoverMode prop',
  );
  assert(
    drawSrc.includes('rescalarizeFallbackCount'),
    'DiagnosticsDrawer.tsx contains rescalarizeFallbackCount prop',
  );
  assert(
    drawSrc.includes("handoverMode === 'modqn-replay'"),
    "DiagnosticsDrawer.tsx gates fallback section on handoverMode === 'modqn-replay'",
  );
  assert(
    drawSrc.includes('diagnostics-drawer-rescalarize-fallback'),
    'DiagnosticsDrawer.tsx has rescalarize fallback section testid',
  );
}

// ---------------------------------------------------------------------------
// (i) ControlBar accepts handoverMode + onHandoverModeChange
// ---------------------------------------------------------------------------
console.log('\n(i) ControlBar props');
{
  const cbSrc = fs.readFileSync(
    path.resolve(import.meta.dirname ?? process.cwd(), '../src/ui/ControlBar.tsx'),
    'utf8',
  );
  assert(
    cbSrc.includes('handoverMode'),
    'ControlBar.tsx contains handoverMode prop',
  );
  assert(
    cbSrc.includes('onHandoverModeChange'),
    'ControlBar.tsx contains onHandoverModeChange prop',
  );
  assert(
    cbSrc.includes("mode: 'sinr-offset'") && cbSrc.includes("mode: 'modqn-replay'"),
    'ControlBar.tsx exposes sinr-offset and modqn-replay entries',
  );
  assert(
    !cbSrc.includes("mode: 'omega-heuristic'"),
    'ControlBar.tsx does not expose omega-heuristic as a top-level mode',
  );
  assert(
    cbSrc.includes('handover-mode-control'),
    'ControlBar.tsx has handover-mode-control testid group',
  );
  assert(
    cbSrc.includes("handover-mode-${option.mode}") || cbSrc.includes("handover-mode-modqn-replay"),
    'ControlBar.tsx has handover-mode-modqn-replay testid (static or template literal)',
  );
}

// ---------------------------------------------------------------------------
// (j) S3HandoverManager subclass in useSimulation.ts
// ---------------------------------------------------------------------------
console.log('\n(j) S3HandoverManager in useSimulation.ts');
{
  const simSrc = fs.readFileSync(
    path.resolve(import.meta.dirname ?? process.cwd(), '../src/scene/useSimulation.ts'),
    'utf8',
  );
  assert(
    simSrc.includes('S3HandoverManager'),
    'useSimulation.ts contains S3HandoverManager',
  );
  assert(
    simSrc.includes('override update'),
    'S3HandoverManager has override update method',
  );
  assert(
    simSrc.includes("overrideRef.current") && simSrc.includes("'modqn-replay'"),
    "useSimulation.ts sets overrideRef only when handoverMode === 'modqn-replay'",
  );
  assert(
    simSrc.includes('reScalarize'),
    'useSimulation.ts imports and uses reScalarize',
  );
  assert(
    simSrc.includes('resolveModqnReplayOverrideTarget')
    && simSrc.includes('candidate.satId === serving.satId')
    && simSrc.includes('sortedBySinrDesc.find(candidate => candidate.beamId === result.beamId)'),
    'useSimulation.ts maps producer MODQN local beam choice onto the current visual scene candidates',
  );
  // Truth invariance: when mode !== 'modqn-replay', overrideRef.current is set to null.
  assert(
    simSrc.includes('handoverModeRef.current === \'modqn-replay\' ? decisionOverride : null'),
    'useSimulation.ts nulls overrideRef when not modqn-replay (truth invariance)',
  );
  assert(
    simSrc.includes('const resetToReplayStartFrame = useCallback(() => {')
    && simSrc.includes('createRuntimeFrameStepState(startOffset)')
    && simSrc.includes('paused: true')
    && simSrc.includes('deltaSec: 0')
    && simSrc.includes('frameRef.current = frame'),
    'useSimulation.ts mode/handover reset returns to replay start and publishes an attached zero-delta frame',
  );
}

// ---------------------------------------------------------------------------
// (k) Evidence / telemetry mode gating
// ---------------------------------------------------------------------------
console.log('\n(k) Evidence / telemetry mode gating');
{
  const appSrc = fs.readFileSync(
    path.resolve(import.meta.dirname ?? process.cwd(), '../src/App.tsx'),
    'utf8',
  );
  const evidenceSrc = fs.readFileSync(
    path.resolve(import.meta.dirname ?? process.cwd(), '../src/ui/ModqnEvidenceTab.tsx'),
    'utf8',
  );
  const infoSrc = fs.readFileSync(
    path.resolve(import.meta.dirname ?? process.cwd(), '../src/ui/InfoPanel.tsx'),
    'utf8',
  );
  const replayLayerSrc = fs.readFileSync(
    path.resolve(import.meta.dirname ?? process.cwd(), '../src/scene/modqn-replay-visuals/index.tsx'),
    'utf8',
  );
  const telemetrySrc = fs.readFileSync(
    path.resolve(import.meta.dirname ?? process.cwd(), '../src/scene/modqn-replay-visuals/useReplaySceneTelemetry.tsx'),
    'utf8',
  );
  assert(
    appSrc.includes('readInitialRuntimeState') && appSrc.includes('selectedProfileId: DEFAULT_PROFILE_ID')
    && !appSrc.includes('selectedProfileId: handoverMode === \'modqn-replay\''),
    'App.tsx keeps modqn-replay mode profile-preserving on boot instead of forcing the 1-sat profile',
  );
  assert(
    !appSrc.includes('window.confirm')
    && !appSrc.includes('modqn-replay requires the modqn-1sat-7beam profile')
    && !appSrc.includes('resetRuntimeToProfile(targetProfileId)')
    && !appSrc.includes('previousNonModqnProfileIdRef'),
    'App.tsx enters modqn-replay without confirmation or automatic profile switching',
  );
  assert(
    appSrc.includes('getLeftSidebarTabsForMode')
    && appSrc.includes('SINR_LEFT_SIDEBAR_TABS')
    && appSrc.includes('MODQN_LEFT_SIDEBAR_TABS'),
    'App.tsx shows mode-specific left sidebar controls instead of concurrent SINR/MODQN tabs',
  );
  assert(
    appSrc.includes('getRightSidebarTabsForMode')
    && appSrc.includes('SINR_RIGHT_SIDEBAR_TABS')
    && appSrc.includes('MODQN_RIGHT_SIDEBAR_TABS'),
    'App.tsx hides MODQN evidence tab from the right sidebar outside MODQN replay mode',
  );
  assert(
    appSrc.includes('handoverMode={handoverMode}'),
    'App.tsx passes handoverMode into live status and MODQN evidence panels',
  );
  assert(
    appSrc.includes('showModqnReplayScene={false}'),
    'App.tsx hides the producer replay debug overlay from the center scene',
  );
  assert(
    evidenceSrc.includes('modqn-evidence-mode-status')
    && evidenceSrc.includes('modqn-evidence-decision-trace')
    && evidenceSrc.includes('modqn-evidence-producer-selected')
    && evidenceSrc.includes('modqn-evidence-rescalarized-selected')
    && evidenceSrc.includes('modqn-evidence-selection-changed')
    && evidenceSrc.includes('modqn-evidence-mapped-live-serving')
    && evidenceSrc.includes('reScalarize')
    && evidenceSrc.includes('scoreModqnPolicyCandidate')
    && !evidenceSrc.includes('LiveKpiStrip'),
    'ModqnEvidenceTab renders applied omega decision trace without embedding the live KPI strip',
  );
  assert(
    infoSrc.includes('live-status-handover-mode')
    && infoSrc.includes('HANDOVER MODE')
    && infoSrc.includes('MODQN selects serving; SINR metrics are live')
    && infoSrc.includes('MODQN-selected live link')
    && infoSrc.includes('live SINR reference')
    && infoSrc.includes('Δ live SINR'),
    'InfoPanel exposes mode-aware Live status wording for active handover mode',
  );
  assert(
    replayLayerSrc.includes('useReplaySceneTelemetry(visualState, showBoard)'),
    'MODQN replay canvas telemetry is gated by showBoard',
  );
  assert(
    telemetrySrc.includes('if (!enabled)') && telemetrySrc.includes('removeReplayCanvasAttributes(canvas)'),
    'Replay telemetry removes canvas attributes when MODQN replay layer is inactive',
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n---');
console.log(`S3 validator: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
console.log('All S3 acceptance checks passed.');
