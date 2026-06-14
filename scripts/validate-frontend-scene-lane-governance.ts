import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveSceneLane,
  shouldRenderModqnReplayScene,
} from '../src/app/sceneLane.ts';
import {
  resolveTimelineRailDescriptor,
} from '../src/app/timelineRailAuthority.ts';
import {
  getDefaultLeftSidebarTabForSceneLane,
  getDefaultRightSidebarTabForSceneLane,
  getLeftSidebarTabsForSceneLane,
  getRightSidebarTabsForSceneLane,
} from '../src/app/appRuntimeModel.ts';
import {
  isSceneLaneSourceCompatible,
  MODQN_SERVICE_ALLOCATION_PRODUCER_READY,
  resolveSceneLaneRenderPlan,
  resolveSceneLaneUeMarkerShape,
} from '../src/scene/sceneLaneRenderPlan.ts';
import { resolveModqnVisualLayers } from '../src/scene/modqnVisualLayers.ts';
import {
  assertAndSummarizeTangleLockGroups,
  recordTangleLockGroup,
} from './governance-quarantine/tangle-locks.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function readRepoFile(path: string): string {
  return readFileSync(join(ROOT_DIR, path), 'utf8');
}

function assertContains(source: string, needle: string, label: string): void {
  assert.ok(source.includes(needle), `${label} missing ${needle}`);
}

function assertNotContains(source: string, needle: string, label: string): void {
  assert.ok(!source.includes(needle), `${label} unexpectedly contains ${needle}`);
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

// S0 quarantine wrapper (scripts/governance-quarantine/tangle-locks.ts): the
// wrapped TANGLE-PIN locks still execute on every run, but they are scheduled
// for WHOLESALE deletion by the consolidation slice named in the registry,
// replaced by that slice's behavior gates. Never patch needles inside a group.
function tangleLockGroup(groupId: string, run: () => void): void {
  recordTangleLockGroup(groupId);
  run();
}

function tabKeys<T extends string>(tabs: readonly { readonly key: T }[]): T[] {
  return tabs.map(tab => tab.key);
}

function renderPlan(
  sceneLane: Parameters<typeof resolveSceneLaneRenderPlan>[0]['sceneLane'],
  sceneSource: Parameters<typeof resolveSceneLaneRenderPlan>[0]['sceneSource'],
  replayProofLayerRequested = false,
  cinematicMode: Parameters<typeof resolveSceneLaneRenderPlan>[0]['cinematicMode'] = 'spotlight',
  modqnServiceAllocationEnabled = false,
): ReturnType<typeof resolveSceneLaneRenderPlan> {
  return resolveSceneLaneRenderPlan({
    sceneLane,
    sceneSource,
    beamCalloutsEnabled: true,
    beamDensity: 'all',
    cinematicMode,
    effectsEnabled: {
      servingRipple: true,
      pendingRipple: true,
      orbitTrail: true,
      spineParticles: true,
    },
    paused: false,
    reducedMotion: false,
    recentHoActive: false,
    replayProofLayerRequested,
    modqnServiceAllocationEnabled,
  });
}

assert.equal(
  resolveSceneLane({ appMode: 'sinr-experiment', sceneSource: 'live-sim' }),
  'sinr-live',
  'SINR live mode should resolve to the SINR scene lane',
);
assert.equal(
  resolveSceneLane({ appMode: 'modqn-demo', sceneSource: 'live-sim' }),
  'modqn-live-cell-preview',
  'MODQN live mode should default to the clean cell preview lane',
);
assert.equal(
  resolveSceneLane({ appMode: 'modqn-demo', sceneSource: 'live-sim', modqnReplayProofRequested: true }),
  'modqn-replay-proof',
  'MODQN replay proof should require an explicit proof request',
);
assert.equal(
  resolveSceneLane({ appMode: 'modqn-demo', sceneSource: 'artifact-replay', modqnReplayProofRequested: true }),
  'artifact-replay',
  'artifact replay should outrank app mode and proof request',
);
assert.equal(
  shouldRenderModqnReplayScene('sinr-live'),
  false,
  'SINR lane must not render MODQN replay proof',
);
assert.equal(
  shouldRenderModqnReplayScene('modqn-live-cell-preview'),
  false,
  'MODQN live cell preview must not render MODQN replay proof',
);
assert.equal(
  shouldRenderModqnReplayScene('artifact-replay'),
  false,
  'artifact replay must not render MODQN replay proof',
);
assert.equal(
  shouldRenderModqnReplayScene('modqn-replay-proof'),
  true,
  'only the explicit MODQN replay proof lane may render the replay scene layer',
);

{
  const replayCinemaGate = readRepoFile('src/modqn/replay-bundle/replayHandoverCinemaGate.ts');
  assertContains(
    replayCinemaGate,
    'buildModqnDenseQProof',
    'MODQN D6 replay handover cinema gate must require dense-Q proof',
  );
  assertContains(
    replayCinemaGate,
    'entities.satellites.trajectory',
    'MODQN D6 replay handover cinema gate must source-gap satellite trajectory',
  );
  assertContains(
    replayCinemaGate,
    'entities.beams.footprints',
    'MODQN D6 replay handover cinema gate must source-gap beam footprints',
  );
  assertContains(
    replayCinemaGate,
    'metrics.reward',
    'MODQN D6 replay handover cinema gate must source-gap reward proof',
  );
  assertNotContains(
    replayCinemaGate,
    'liveWalker',
    'MODQN D6 replay handover cinema gate must not consume live Walker state',
  );
  assertNotContains(
    replayCinemaGate,
    'sinr',
    'MODQN D6 replay handover cinema gate must not consume live SINR state',
  );
  assertNotContains(
    replayCinemaGate,
    '../scene',
    'MODQN D6 replay handover cinema gate must not depend on renderer fallbacks',
  );

  const replayCuePanel = readRepoFile('src/ui/ModqnReplayCuePanel.tsx');
  assertContains(
    replayCuePanel,
    'data-testid="modqn-replay-cinema-readiness"',
    'MODQN replay cue panel must expose the D6 readiness stamp',
  );
}

assert.equal(isSceneLaneSourceCompatible({ sceneLane: 'sinr-live', sceneSource: 'live-sim' }), true);
assert.equal(isSceneLaneSourceCompatible({ sceneLane: 'modqn-live-cell-preview', sceneSource: 'live-sim' }), true);
assert.equal(isSceneLaneSourceCompatible({ sceneLane: 'modqn-replay-proof', sceneSource: 'live-sim' }), true);
assert.equal(isSceneLaneSourceCompatible({ sceneLane: 'artifact-replay', sceneSource: 'artifact-replay' }), true);
assert.equal(isSceneLaneSourceCompatible({ sceneLane: 'artifact-replay', sceneSource: 'live-sim' }), false);
assert.equal(isSceneLaneSourceCompatible({ sceneLane: 'sinr-live', sceneSource: 'artifact-replay' }), false);
assert.equal(resolveSceneLaneUeMarkerShape('sinr-live'), 'cylinder');
assert.equal(resolveSceneLaneUeMarkerShape('modqn-live-cell-preview'), 'sphere');
assert.equal(resolveSceneLaneUeMarkerShape('modqn-replay-proof'), 'sphere');
assert.equal(resolveSceneLaneUeMarkerShape('artifact-replay'), 'sphere');

{
  const sinr = renderPlan('sinr-live', 'live-sim');
  assert.equal(sinr.sourceCompatible, true, 'SINR live source should be compatible');
  assert.equal(sinr.showLiveSceneEffects, true, 'SINR live should own live effects');
  assert.equal(sinr.showCinematicSpotlight, true, 'SINR live should own spotlight effects when requested');
  assert.equal(sinr.effectiveCinematicMode, 'spotlight', 'SINR live may keep spotlight mode');
  assert.equal(sinr.showUav, true, 'SINR live should own UAV visibility');
  assert.equal(sinr.showCellOverlay, false, 'SINR live should not own MODQN cell overlay');
  assert.equal(sinr.showReplayProofLayer, false, 'SINR live should not own MODQN replay proof');
  assert.equal(sinr.handoverStoryLayerPolicy, 'sinr-live', 'SINR live should keep the SINR handover story path');
  assert.equal(sinr.showProfileHandoverStoryLayer, false, 'SINR live must not mount the profile-derived story overlay');
  // Handover-cinema candidate highlight (S1) is gated on the director cinematic
  // mode, so it is OFF under spotlight even on its own lane.
  assert.equal(sinr.showCandidateHandoverHighlight, false, 'SINR live candidate highlight stays off outside director mode');

  const cellPreview = renderPlan('modqn-live-cell-preview', 'live-sim');
  assert.equal(cellPreview.sourceCompatible, true, 'MODQN cell lane live source should be compatible');
  assert.equal(cellPreview.showCellOverlay, true, 'MODQN cell lane should own cell overlay');
  assert.equal(cellPreview.showLiveSatelliteMarkers, true, 'MODQN cell lane should keep satellite anchors');
  assert.equal(cellPreview.showLiveBeamCones, false, 'MODQN cell lane should hide legacy live beam cones');
  assert.equal(cellPreview.showLiveSceneEffects, false, 'MODQN cell lane should not inherit SINR live effects');
  assert.equal(cellPreview.showCinematicSpotlight, false, 'MODQN cell lane should not inherit spotlight effects');
  assert.equal(cellPreview.effectiveCinematicMode, 'off', 'MODQN cell lane should force cinematic mode off');
  assert.equal(cellPreview.handoverStoryLayerPolicy, 'profile-derived-demo', 'MODQN cell lane may own the profile-derived story overlay');
  assert.equal(cellPreview.showProfileHandoverStoryLayer, true, 'MODQN cell lane should mount the profile-derived story overlay');

  // S-FLAG-2: the MODQN service-allocation overlay family (all-UE service map +
  // readout/legend/diagnostics grid, per-cell UE-count badges, phase-3 beam-load
  // cylinder + upload particles) is PARKED OFF by default — every MODQN lane
  // replays a degenerate producer baseline (100 UEs/one beam, 0 handovers, 1 sat)
  // that makes the all-UE allocation meaningless noise. The default MODQN-LIVE
  // surface keeps the hex cell overlay (with its cones/markers/cinema/HUD); only
  // this family is parked, and the code + data path stays intact (G3 scaffolding).
  assert.equal(
    cellPreview.showModqnServiceAllocation,
    false,
    'MODQN cell lane parks the service-allocation overlay family OFF by default (degenerate producer baseline)',
  );
  assert.equal(
    cellPreview.showCellOverlay,
    true,
    'MODQN cell lane still owns the hex cell overlay while the service-allocation family is parked',
  );
  assert.equal(
    MODQN_SERVICE_ALLOCATION_PRODUCER_READY,
    false,
    'the MODQN service-allocation producer-readiness gate ships parked OFF (un-park only once the producer baseline is non-degenerate)',
  );
  // Producer un-park / dev override (`?modqnServiceAllocation=1`) flips the family
  // ON — but ONLY on the cell lane (the gate is AND-ed with showCellOverlay).
  const cellPreviewUnparked = renderPlan('modqn-live-cell-preview', 'live-sim', false, 'spotlight', true);
  assert.equal(
    cellPreviewUnparked.showModqnServiceAllocation,
    true,
    'MODQN cell lane un-parks the service-allocation family when producer-readiness is enabled',
  );
  // Enabling the gate can never leak the family onto a SINR / replay-proof /
  // artifact lane — those never own the MODQN cell overlay.
  assert.equal(
    renderPlan('sinr-live', 'live-sim', false, 'spotlight', true).showModqnServiceAllocation,
    false,
    'SINR live must never own the MODQN service-allocation family even when the producer gate is enabled',
  );
  assert.equal(
    renderPlan('modqn-replay-proof', 'live-sim', true, 'spotlight', true).showModqnServiceAllocation,
    false,
    'MODQN replay proof must never own the service-allocation family even when the producer gate is enabled',
  );
  assert.equal(
    renderPlan('artifact-replay', 'artifact-replay', false, 'spotlight', true).showModqnServiceAllocation,
    false,
    'artifact replay must never own the MODQN service-allocation family even when the producer gate is enabled',
  );

  const proof = renderPlan('modqn-replay-proof', 'live-sim', true);
  assert.equal(proof.sourceCompatible, true, 'MODQN proof lane live source should be compatible');
  assert.equal(proof.showReplayProofLayer, true, 'MODQN proof lane should honor explicit proof request');
  assert.equal(proof.showCellOverlay, false, 'MODQN proof lane should not render cell overlay');
  assert.equal(proof.showLiveBeamCones, false, 'MODQN proof lane should not render legacy live beam cones');
  assert.equal(proof.showLiveSceneEffects, false, 'MODQN proof lane should not inherit SINR live effects');
  assert.equal(proof.showCinematicSpotlight, false, 'MODQN proof lane should not inherit spotlight effects');
  assert.equal(proof.effectiveCinematicMode, 'off', 'MODQN proof lane should force cinematic mode off');
  assert.equal(proof.handoverStoryLayerPolicy, 'modqn-replay-source-backed', 'MODQN proof lane must stay source-backed');
  assert.equal(proof.showProfileHandoverStoryLayer, false, 'MODQN proof lane must not mount the profile-derived story overlay');

  const artifact = renderPlan('artifact-replay', 'artifact-replay');
  assert.equal(artifact.sourceCompatible, true, 'artifact replay source should be compatible');
  assert.equal(artifact.isArtifactReplay, true, 'artifact replay plan should mark artifact replay');
  assert.equal(artifact.showArtifactFpsCounter, true, 'artifact replay may expose artifact FPS diagnostics');
  assert.equal(artifact.showCellOverlay, false, 'artifact replay should not render live cell overlay');
  assert.equal(artifact.showReplayProofLayer, false, 'artifact replay should not render MODQN proof layer');
  assert.equal(artifact.showCinematicSpotlight, false, 'artifact replay should not inherit spotlight effects');
  assert.equal(artifact.effectiveCinematicMode, 'off', 'artifact replay should force cinematic mode off');
  assert.equal(artifact.handoverStoryLayerPolicy, 'artifact-owned', 'artifact replay should keep handover story artifact-owned');
  assert.equal(artifact.showProfileHandoverStoryLayer, false, 'artifact replay must not mount the profile-derived story overlay');

  // ── Handover-cinema candidate-beam highlight (S1) lane ownership ──
  // Lane-owned to sinr-live ONLY, and only while the director cinematic is engaged.
  // Inert on the MODQN cell preview, the replay-proof lane (Rule#8), and artifact.
  assert.equal(
    renderPlan('sinr-live', 'live-sim', false, 'director').showCandidateHandoverHighlight,
    true,
    'SINR live owns the handover-cinema candidate highlight under director mode',
  );
  assert.equal(
    renderPlan('modqn-live-cell-preview', 'live-sim', false, 'director').showCandidateHandoverHighlight,
    false,
    'MODQN cell preview must not mount the S1 candidate highlight (sinr-live only)',
  );
  assert.equal(
    renderPlan('modqn-replay-proof', 'live-sim', true, 'director').showCandidateHandoverHighlight,
    false,
    'MODQN replay proof must stay inert for the candidate highlight (Rule#8)',
  );
  assert.equal(
    renderPlan('artifact-replay', 'artifact-replay', false, 'director').showCandidateHandoverHighlight,
    false,
    'artifact replay must not mount the live SINR candidate highlight',
  );

  // ── SINR-serving mosaic (S2) lane ownership ──
  // Lane-owned to sinr-live ONLY and always-on (NOT director-gated): the ambient
  // default that colours every UE by its serving beam. It is a DISTINCT
  // SINR-serving layer, never the MODQN cell overlay — inert on every MODQN /
  // artifact lane.
  assert.equal(
    renderPlan('sinr-live', 'live-sim').showSinrServingMosaic,
    true,
    'SINR live owns the SINR-serving mosaic as an always-on ambient default (spotlight mode, no director)',
  );
  assert.equal(
    renderPlan('sinr-live', 'live-sim', false, 'director').showSinrServingMosaic,
    true,
    'SINR-serving mosaic stays on under director focus too (it is the ambient base, not focus-scoped)',
  );
  assert.equal(
    renderPlan('modqn-live-cell-preview', 'live-sim').showSinrServingMosaic,
    false,
    'MODQN cell preview must not mount the SINR-serving mosaic (it owns the MODQN cell overlay instead)',
  );
  assert.equal(
    renderPlan('modqn-replay-proof', 'live-sim', true).showSinrServingMosaic,
    false,
    'MODQN replay proof must stay inert for the SINR-serving mosaic (Rule#8)',
  );
  assert.equal(
    renderPlan('artifact-replay', 'artifact-replay').showSinrServingMosaic,
    false,
    'artifact replay must not mount the live SINR-serving mosaic',
  );

  // ── SINR-live earth-fixed cell-truth beam cones (S5-2) — UN-PARKED, the lane's render ──
  // S5-2 (one beam render, the consolidation finish-line): the cell-truth CONES are
  // now the sinr-live lane's mounted beam render — `showSinrLiveCellBeams =
  // showSinrLiveViewport` (sceneLaneRenderPlan.ts), so the steered SatelliteBeams
  // auto-suppress (`&& !showSinrLiveCellBeams`) and the UE anchor is retired (UEs
  // render off-centre). The cones stay inert on every MODQN / artifact lane (the
  // sibling asserts below survived the QUAR-RENDER-RESET retirement). The
  // connected-sat-has-beam invariant now measures this cone render (D1 must-hold
  // flip, S5-3). See docs/s5-one-beam-render-plan.md.
  assert.equal(
    renderPlan('sinr-live', 'live-sim').showSinrLiveCellBeams,
    true,
    'S5-2: SINR live mounts the cell-truth cones as its beam render (steered SatelliteBeams retired on the lane)',
  );
  assert.equal(
    renderPlan('sinr-live', 'live-sim', false, 'director').showSinrLiveCellBeams,
    true,
    'S5-2: cell-truth cones stay mounted under director focus too',
  );
  assert.equal(
    renderPlan('modqn-live-cell-preview', 'live-sim').showSinrLiveCellBeams,
    false,
    'MODQN cell preview must not mount the cell-truth cones (it owns the MODQN cell overlay instead)',
  );
  assert.equal(
    renderPlan('modqn-replay-proof', 'live-sim', true).showSinrLiveCellBeams,
    false,
    'MODQN replay proof must stay inert for the cell-truth cones (Rule#8)',
  );
  assert.equal(
    renderPlan('artifact-replay', 'artifact-replay').showSinrLiveCellBeams,
    false,
    'artifact replay must not mount the live cell-truth cones',
  );

  // ── SINR-live ambient live-handover PULSE (G2c) lane ownership ──
  // Lane-owned to sinr-live ONLY and ALWAYS-ON ambient — DELIBERATELY NOT
  // director-gated (the decouple from the manual-arm cinema): the bright, age-faded
  // cones of the real per-frame handovers. Inert on every MODQN / artifact lane.
  assert.equal(
    renderPlan('sinr-live', 'live-sim').showSinrLiveHandoverPulse,
    true,
    'G2c: SINR live owns the ambient live-handover pulse as an always-on ambient default (no director arm)',
  );
  assert.equal(
    renderPlan('sinr-live', 'live-sim', false, 'director').showSinrLiveHandoverPulse,
    true,
    'G2c: the live pulse stays on under director focus too (it is decoupled from the cinematic gate, not focus-scoped)',
  );
  assert.equal(
    renderPlan('modqn-live-cell-preview', 'live-sim').showSinrLiveHandoverPulse,
    false,
    'MODQN cell preview must not mount the SINR live-handover pulse',
  );
  assert.equal(
    renderPlan('modqn-replay-proof', 'live-sim', true).showSinrLiveHandoverPulse,
    false,
    'MODQN replay proof must stay inert for the SINR live-handover pulse (Rule#8)',
  );
  assert.equal(
    renderPlan('artifact-replay', 'artifact-replay').showSinrLiveHandoverPulse,
    false,
    'artifact replay must not mount the SINR live-handover pulse',
  );

  const incompatibleArtifact = renderPlan('artifact-replay', 'live-sim');
  assert.equal(incompatibleArtifact.sourceCompatible, false, 'artifact lane must reject live-sim source');
  assert.equal(incompatibleArtifact.showSinrServingMosaic, false, 'incompatible sinr-live source must not show the mosaic');
  assert.equal(incompatibleArtifact.showSinrLiveCellBeams, false, 'incompatible sinr-live source must not show the cell-truth cones');
  assert.equal(incompatibleArtifact.showSinrLiveHandoverPulse, false, 'incompatible sinr-live source must not show the live-handover pulse');
  assert.equal(incompatibleArtifact.isLiveScene, false, 'incompatible artifact lane must not become live scene');
  assert.equal(incompatibleArtifact.showArtifactFpsCounter, false, 'incompatible artifact lane must not show artifact diagnostics');
  assert.equal(incompatibleArtifact.showLiveSceneEffects, false, 'incompatible artifact lane must not show live effects');
  assert.equal(incompatibleArtifact.handoverStoryLayerPolicy, 'disabled', 'incompatible artifact lane must disable handover story ownership');
}

assert.deepEqual(
  tabKeys(getRightSidebarTabsForSceneLane('sinr-live', 'sinr-offset')),
  ['live'],
  'SINR live lane right sidebar should only expose live status',
);
assert.equal(
  getDefaultRightSidebarTabForSceneLane('sinr-live', 'sinr-offset'),
  'live',
  'SINR live lane should default the right sidebar to live status',
);
assert.deepEqual(
  tabKeys(getRightSidebarTabsForSceneLane('modqn-live-cell-preview', 'decision-overlay-on-live-sinr')),
  ['live', 'modqn'],
  'MODQN live cell preview right sidebar offers live status + co-visible MODQN evidence (opt-in tab)',
);
assert.equal(
  getDefaultRightSidebarTabForSceneLane('modqn-live-cell-preview', 'decision-overlay-on-live-sinr'),
  'live',
  'MODQN live cell preview still DEFAULTS the right sidebar to live status (MODQN evidence is opt-in)',
);
assert.deepEqual(
  tabKeys(getLeftSidebarTabsForSceneLane('modqn-live-cell-preview', 'decision-overlay-on-live-sinr')),
  ['evidence'],
  'S4: MODQN live cell preview left sidebar collapses to the sole Evidence / Replay rail (Setup moved to the Advanced drawer)',
);
assert.equal(
  getDefaultLeftSidebarTabForSceneLane('modqn-live-cell-preview', 'decision-overlay-on-live-sinr'),
  'evidence',
  'S3: MODQN live cell preview defaults the left sidebar to the Evidence / Replay tab',
);
assert.deepEqual(
  tabKeys(getLeftSidebarTabsForSceneLane('modqn-replay-proof', 'decision-overlay-on-live-sinr')),
  ['evidence'],
  'S3: MODQN replay proof lane shares the unified MODQN left rail (no per-sub-lane reshuffle)',
);
assert.equal(
  getDefaultLeftSidebarTabForSceneLane('modqn-replay-proof', 'decision-overlay-on-live-sinr'),
  'evidence',
  'S3: MODQN replay proof lane defaults the left sidebar to the Evidence / Replay tab',
);
assert.deepEqual(
  tabKeys(getRightSidebarTabsForSceneLane('modqn-replay-proof', 'decision-overlay-on-live-sinr')),
  ['modqn'],
  'MODQN replay proof lane right sidebar should only expose MODQN evidence',
);
assert.equal(
  getDefaultRightSidebarTabForSceneLane('modqn-replay-proof', 'decision-overlay-on-live-sinr'),
  'modqn',
  'MODQN replay proof lane should default the right sidebar to MODQN evidence',
);
assert.deepEqual(
  tabKeys(getLeftSidebarTabsForSceneLane('artifact-replay', 'decision-overlay-on-live-sinr')),
  ['evidence'],
  'S3: artifact replay lane shares the unified MODQN left rail (artifact source folds into Evidence)',
);
assert.deepEqual(
  tabKeys(getRightSidebarTabsForSceneLane('artifact-replay', 'decision-overlay-on-live-sinr')),
  ['artifact'],
  'artifact replay lane right sidebar should only expose artifact truth',
);
assert.equal(
  getDefaultLeftSidebarTabForSceneLane('artifact-replay', 'decision-overlay-on-live-sinr'),
  'evidence',
  'S3: artifact replay lane defaults the left sidebar to the Evidence / Replay tab',
);
assert.equal(
  getDefaultRightSidebarTabForSceneLane('artifact-replay', 'decision-overlay-on-live-sinr'),
  'artifact',
  'artifact replay lane should default the right sidebar to artifact truth',
);

// ── S3 left-rail unification: the 3 MODQN sub-lanes SHARE one left sidebar ──
// After the purpose-merge, toggling the in-MODQN ModqnViewToggle sub-nav
// (live / proof / artifact) must NOT reshuffle the left rail. The right rail is
// intentionally left per-sub-lane (this slice touches the left rail only).
assert.deepEqual(
  tabKeys(getLeftSidebarTabsForSceneLane('modqn-live-cell-preview', 'decision-overlay-on-live-sinr')),
  tabKeys(getLeftSidebarTabsForSceneLane('modqn-replay-proof', 'decision-overlay-on-live-sinr')),
  'S3: MODQN live + proof sub-lanes share the same unified left rail',
);
assert.deepEqual(
  tabKeys(getLeftSidebarTabsForSceneLane('modqn-live-cell-preview', 'decision-overlay-on-live-sinr')),
  tabKeys(getLeftSidebarTabsForSceneLane('artifact-replay', 'decision-overlay-on-live-sinr')),
  'S3: MODQN live + artifact sub-lanes share the same unified left rail',
);
// G1-LEFT-DEFAULT: the SINR-live left rail is a single light read-only 'summary'
// orientation card (SidebarTabShell hides the tablist at one tab); the heavy
// SINR-formula + handover-policy tuners moved into the ⚙ Advanced drawer.
assert.deepEqual(
  tabKeys(getLeftSidebarTabsForSceneLane('sinr-live', 'sinr-offset')),
  ['summary'],
  'SINR live lane left rail is the single light summary card (tuners moved to the Advanced drawer)',
);
assert.equal(
  getDefaultLeftSidebarTabForSceneLane('sinr-live', 'sinr-offset'),
  'summary',
  'SINR live lane defaults the left sidebar to the light summary orientation card',
);

const appSource = readRepoFile('src/App.tsx');
const railBuildersSource = readRepoFile('src/app/handoverRailBuilders.ts');
const appRuntimeModelSource = readRepoFile('src/app/appRuntimeModel.ts');
const appRuntimeConfigSource = readRepoFile('src/app/appRuntimeConfig.ts');
const appPersistenceSource = readRepoFile('src/app/appPersistence.ts');
const appExperienceModeSource = readRepoFile('src/app/appExperienceMode.ts');
const modqnServingCountSource = readRepoFile('src/modqn/servingCount.ts');
const timelineAuthoritySource = readRepoFile('src/app/timelineRailAuthority.ts');
const controlBarSource = readRepoFile('src/ui/ControlBar.tsx');
// G1-CONTROLBAR-ADV: the SINR-live display/camera controls relocated off the top
// bar into a lane-mounted Advanced drawer that reuses the shared shell.
const sinrLiveDisplayDrawerSource = readRepoFile('src/ui/SinrLiveDisplayDrawer.tsx');
// G2-TICKER: the publisher that publishes the rolling handover log onto SimState.
const useSimStatePublisherSource = readRepoFile('src/scene/useSimStatePublisher.ts');
const advancedDrawerShellSource = readRepoFile('src/ui/AdvancedDrawerShell.tsx');
const modqnAdvancedDisplayControlsSource = readRepoFile('src/ui/modqn-controls/ModqnAdvancedDisplayControls.tsx');
const topologyTabSource = readRepoFile('src/ui/signal-tuning/TopologyTab.tsx');
const timelineBarSource = readRepoFile('src/ui/TimelineBar.tsx');
const handoverRailSource = readRepoFile('src/ui/HandoverEventRail.tsx');
const modqnHudSource = readRepoFile('src/ui/modqn-controls/ModqnSceneHud.tsx');
const modqnVisualLayersSource = readRepoFile('src/scene/modqnVisualLayers.ts');
const cellHandoverArcsSource = readRepoFile('src/viz/CellHandoverArcs.tsx');
const modqnServiceMapSource = readRepoFile('src/scene/modqnServiceMap.ts');
const cellOverlaySource = readRepoFile('src/viz/CellOverlay.tsx');
const cellBeamConesSource = readRepoFile('src/viz/CellBeamCones.tsx');
const beamLoadCylinderSource = readRepoFile('src/viz/BeamLoadCylinder.tsx');
const beamLoadUploadParticlesSource = readRepoFile('src/viz/BeamLoadUploadParticles.tsx');
const handoverStoryLayerSource = readRepoFile('src/viz/HandoverStoryLayer.tsx');
const beamLoadUploadParticleHelpersSource = readRepoFile('src/viz/beamLoadUploadParticles.ts');
const groundSceneSource = readRepoFile('src/viz/GroundScene.tsx');
const modqnReplayCuePanelSource = readRepoFile('src/ui/ModqnReplayCuePanel.tsx');
const mainSceneSource = readRepoFile('src/scene/MainScene.tsx');
const candidateBeamHighlightSource = readRepoFile('src/viz/CandidateBeamHighlight.tsx');
const sinrOffsetExplainerSource = readRepoFile('src/ui/SinrOffsetExplainer.tsx');
const handoverCinemaSource = readRepoFile('src/app/handoverCinema.ts');
const sinrLiveCellHandoverEventIndexSource = readRepoFile('src/scene/sinrLiveCellHandoverEventIndex.ts');
const cellScheduleSource = readRepoFile('src/scene/useCellSchedule.ts');
const baseSceneLayoutSource = readRepoFile('src/scene/BaseSceneLayout.tsx');
const sceneTelemetrySource = readRepoFile('src/scene/SceneTelemetry.tsx');
const simStatePublisherSource = readRepoFile('src/scene/useSimStatePublisher.ts');
const panelStateSource = readRepoFile('src/scene/panelState.ts');
const sceneLaneRenderPlanSource = readRepoFile('src/scene/sceneLaneRenderPlan.ts');
const replayLayerSource = readRepoFile('src/scene/modqn-replay-visuals/index.tsx');
const replayTelemetrySource = readRepoFile('src/scene/modqn-replay-visuals/useReplaySceneTelemetry.tsx');
const algorithmDockSource = readRepoFile('src/showcase/dashboard/AlgorithmDock.tsx');
const algorithmDashboardSource = readRepoFile('src/showcase/dashboard/AlgorithmDashboard.tsx');
const liveTelemetryPanelSource = readRepoFile('src/showcase/dashboard/LiveTelemetryPanel.tsx');
const governanceDoc = readRepoFile('docs/frontend-render-governance.md');
const laneSdd = readRepoFile('docs/frontend-mode-lane-separation-sdd.md');
const handoverStorySdd = readRepoFile('docs/modqn-handover-story-layer-sdd.md');
const realisticGeometrySdd = readRepoFile('docs/modqn-realistic-beam-geometry-cross-repo-sdd.md');
const realisticGeometryProducerBrief = readRepoFile('docs/modqn-realistic-beam-geometry-phase-ii-producer-brief.md');
const adr = readRepoFile('docs/decisions/ADR-001-scene-lane-render-boundary.md');
const agentsDoc = readRepoFile('AGENTS.md');
const claudeDoc = readRepoFile('CLAUDE.md');
const packageJson = readRepoFile('package.json');

assertContains(modqnServingCountSource, 'MODQN_SERVING_COUNT_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const', 'MODQN formal serving-count options are L=2..8');
assertContains(modqnServingCountSource, 'MODQN_PAPER_BASELINE_SERVING_COUNT = 4', 'MODQN serving-count model labels L=4 as baseline');
assertContains(modqnServingCountSource, 'MODQN_PAPER_SWEEP_MAX_SERVING_COUNT = 8', 'MODQN serving-count model labels L=8 as sweep max');
assertContains(modqnServingCountSource, 'MODQN_BEAMS_PER_SERVING_SATELLITE = 7', 'MODQN serving-count model keeps 7 beams per serving satellite');
assertContains(modqnServingCountSource, 'return MODQN_PAPER_SWEEP_MAX_SERVING_COUNT', 'MODQN serving-count model migrates legacy L=12 to L=8');
assertContains(realisticGeometrySdd, 'formal `L ∈ {2,3,4,5,6,7,8}`', 'Realistic geometry SDD defers to formal L=2..8 serving authority');
assertContains(realisticGeometrySdd, 'display-only active-cell cap of 28', 'Realistic geometry SDD labels 28 as display-only cap');
assertContains(realisticGeometrySdd, 'display active-cell cap preserves a readable 28/37 hopping overlay', 'Realistic geometry SDD keeps 28/37 hopping as display overlay wording');
assertNotContains(realisticGeometrySdd, 'serving L ∈ {4, 8, 12}', 'Realistic geometry SDD must not keep stale L=12 active design');
assertNotContains(realisticGeometrySdd, 'Phase III training **sweeps `L ∈ {4, 8, 12}`', 'Realistic geometry SDD must not keep stale L=12 training sweep');
assertNotContains(realisticGeometrySdd, 'K = 28 keeps hopping', 'Realistic geometry SDD must not label 28-cell hopping as fixed action truth');
assertNotContains(realisticGeometrySdd, 'With K = 28 active per slot', 'Realistic geometry SDD scheduler text must not label display cap as action truth');
assertNotContains(realisticGeometrySdd, 'K=28 per slot', 'Realistic geometry SDD validator table must not label display cap as action truth');
assertContains(realisticGeometryProducerBrief, '2026-06-01 serving-authority update', 'Producer brief carries serving-authority supersession warning');
assertContains(realisticGeometryProducerBrief, 'Serving cap **L ∈ {2,3,4,5,6,7,8}**', 'Producer brief uses formal L=2..8 serving cap');
assertContains(realisticGeometryProducerBrief, 'display-only cell-overlay cap', 'Producer brief keeps 28 cap display-only unless producer exports it');
assertNotContains(realisticGeometryProducerBrief, 'Serving cap **L ∈ {4,8,12}**', 'Producer brief must not preserve stale formal L=12 selector');
assertNotContains(realisticGeometryProducerBrief, 'sweep set {4,8,12}', 'Producer brief must not preserve stale L=12 sweep set');
assertContains(topologyTabSource, 'MODQN_SERVING_COUNT_OPTIONS.map', 'TopologyTab renders formal MODQN serving-count options from shared model');
assertContains(topologyTabSource, 'paper-faithful baseline', 'TopologyTab labels L=4 as baseline');
assertContains(topologyTabSource, 'paper sweep max / rich demo', 'TopologyTab labels L=8 as paper sweep max / rich demo');
assertContains(topologyTabSource, 'L x 7 MODQN beam actions', 'TopologyTab presents MODQN action catalog as L x 7');
assertNotContains(topologyTabSource, 'topology-tab-serving-count-option-12', 'TopologyTab must not expose L=12 as a formal selector option');
assertNotContains(topologyTabSource, 'K=28 active beams', 'TopologyTab must not claim fixed K=28 across serving counts');
assertContains(appPersistenceSource, 'normalizePersistedModqnServingCount(record.cellServingCount)', 'appPersistence normalizes persisted MODQN serving count');
assertNotContains(appPersistenceSource, 'record.cellServingCount === 12', 'appPersistence must not accept L=12 as a normal value');
assertContains(appRuntimeConfigSource, 'normalizeRuntimeModqnServingCount(input.sceneTopology.cellServingCount)', 'appRuntimeConfig normalizes runtime MODQN serving count');
// S-ADV-3: the default MODQN-LIVE preset is the minimal hex-rings-only surface; the
// service map / story cues / handover arcs are an explicit Advanced opt-in (Rule#10).
assertContains(modqnVisualLayersSource, "DEFAULT_MODQN_VISUAL_LAYER_PRESET: ModqnVisualLayerPreset = 'minimal'", 'MODQN visual layers default to the minimal hex-rings-only preset');
assert.equal(resolveModqnVisualLayers('minimal').activeCellOverlay, true, 'minimal preset keeps the hex cell overlay');
assert.equal(resolveModqnVisualLayers('minimal').serviceMap, false, 'minimal preset hides the all-UE service map');
assert.equal(resolveModqnVisualLayers('minimal').ueCountBadges, false, 'minimal preset hides per-cell UE-count badges');
assert.equal(resolveModqnVisualLayers('minimal').beamCones, false, 'minimal preset hides cell beam cones');
assert.equal(resolveModqnVisualLayers('minimal').handoverStory, false, 'minimal preset hides the profile-derived story layer');
assert.equal(resolveModqnVisualLayers('minimal').handoverCues, false, 'minimal preset hides the next-slot cell-change arcs');
assertContains(cellHandoverArcsSource, "CELL_HANDOVER_ARCS_SYNTHETIC_CAPTION = 'Next-slot cell changes (synthetic preview)'", 'cell-change arcs carry an honest synthetic-preview caption (S-ADV-3)');
assertContains(modqnVisualLayersSource, "'service-allocation'", 'MODQN visual layers include service allocation preset');
assertContains(modqnVisualLayersSource, "'explain-handover'", 'MODQN visual layers include explain handover preset');
assertContains(modqnVisualLayersSource, 'beamCones: false', 'MODQN baseline preset keeps beam cones off');
assertContains(modqnVisualLayersSource, "beamConeScope: 'all-serving-satellites'", 'MODQN service/debug presets can show all serving satellite cones');
assertContains(modqnVisualLayersSource, "beamConeScope: 'focus-satellite'", 'MODQN explain preset keeps beam cones focused');
assertContains(modqnVisualLayersSource, 'handoverCues: false', 'MODQN baseline preset keeps handover cues off');
assertContains(modqnVisualLayersSource, 'handoverCues: true', 'MODQN explain/debug presets can enable handover cues');
assertContains(cellBeamConesSource, 'resolveCellBeamConeSatelliteCount', 'CellBeamCones exposes serving-satellite render-count telemetry');
assertContains(cellBeamConesSource, "resolvedScope === 'focus-satellite'", 'CellBeamCones supports focused satellite scope');
assertContains(cellBeamConesSource, "'all-serving-satellites'", 'CellBeamCones supports multi-satellite service allocation scope');
assertContains(modqnServiceMapSource, 'deriveModqnServiceMap', 'MODQN service map derives all-UE service rendering state');
assertContains(modqnServiceMapSource, 'ueCountByCellId', 'MODQN service map exposes per-cell served UE counts');
assertContains(modqnServiceMapSource, 'activeCellCountBySatId', 'MODQN service map exposes per-satellite active-cell counts');
assertContains(modqnServiceMapSource, 'buildModqnCellServiceReadout', 'MODQN service map builds a cell service readout');
assertContains(modqnServiceMapSource, "claimKind: 'overlay-demo'", 'MODQN service readout keeps overlay-demo claim kind');
assertContains(modqnServiceMapSource, 'slotSec', 'MODQN service readout carries display slot duration');
assertContains(modqnServiceMapSource, 'nextChangedCellCount', 'MODQN service readout carries next-slot change count');
assertContains(modqnServiceMapSource, 'activeBeamIds', 'MODQN service readout carries active beam ids without producer-proof claims');
assertContains(cellOverlaySource, 'showUeCounts', 'CellOverlay supports explicit UE-count badge visibility');
assertContains(modqnAdvancedDisplayControlsSource, 'modqn-layer-preset-control', 'Advanced display controls expose MODQN layer preset control');
assertContains(modqnAdvancedDisplayControlsSource, 'MODQN_VISUAL_LAYER_PRESETS.map', 'Advanced display controls render presets from shared MODQN visual layer model');
assertContains(modqnAdvancedDisplayControlsSource, "'service-allocation': 'Service'", 'Advanced display controls label the service allocation preset');
assertContains(appSource, 'const [modqnVisualLayerPreset, setModqnVisualLayerPreset]', 'App owns MODQN visual layer preset state');
assertContains(appRuntimeConfigSource, 'resolveModqnVisualLayers(modqnVisualLayerPreset)', 'appRuntimeConfig resolves MODQN visual layers into runtime flags');
assertContains(cellScheduleSource, 'DISPLAY_CELL_SCHEDULE_MAX_ACTIVE_CELLS_PER_SLOT', 'useCellSchedule names the 28-cell cap as display-only');
// (S0: dropped the 'MODQN action catalog truth is L x 7' COMMENT-text pin — zero
// behavior content; the display-cap honesty stays locked by the two asserts here.)
assertNotContains(cellScheduleSource, 'PAPER_ACTIVE_BEAMS_PER_SLOT', 'useCellSchedule must not name the display cap as paper action truth');
assertContains(appExperienceModeSource, "'sinr-experiment': 'hobs-2024-candidate-rich'", 'SINR default profile remains HOBS candidate-rich');
assertContains(packageJson, '"validate:live-walker:7200-timeline"', 'package exposes committed 7200s live Walker validator');
assertContains(appRuntimeConfigSource, 'LIVE_SIM_TIMELINE_DURATION_SEC = 7200', 'live timeline is 7200s only with committed validator coverage');
assertNotContains(appRuntimeConfigSource, 'LIVE_SIM_TIMELINE_DURATION_SEC = 1200', 'live timeline must not fall back to the old 1200s window');

// (S0: App.tsx internal-wiring text pins below are quarantined for S6 — the
// honesty keeps extracted from this region follow AFTER the group close.)
tangleLockGroup('QUAR-S6-BUS', () => {
assertContains(appSource, "from './app/sceneLane'", 'App scene lane import');
assertContains(appSource, 'modqnReplayProofRequested: modqnReplayProofRequestActive', 'App explicit proof request into scene lane resolver');
assertContains(appSource, 'shouldRenderModqnReplayScene(sceneLane)', 'App replay proof lane gate');
assertContains(appSource, 'showModqnReplayScene={showModqnReplayScene}', 'App MainScene replay prop');
assertContains(appSource, 'sceneLane={sceneLane}', 'App MainScene lane prop');
assertContains(appSource, 'sceneLane={sceneLane}', 'App ControlBar lane prop');
assertContains(appSource, "from './app/timelineRailAuthority'", 'App imports timeline and rail authority module');
assertContains(appSource, "from './app/liveWalkerHandoverRailAdapter'", 'App imports the live Walker rail adapter');
assertContains(appSource, "from './scene/liveWalkerHandoverEventIndex'", 'App imports the live Walker event index helper');
assertContains(timelineAuthoritySource, 'export function resolveTimelineRailDescriptor', 'Timeline authority exports descriptor resolver');
assertContains(timelineAuthoritySource, "'profile-derived-forecast'", 'Timeline authority models profile-derived live Walker forecast claims');
assertContains(appSource, 'buildLiveWalkerHandoverEventIndex({', 'App builds the live Walker event index outside render');
assertContains(appSource, 'liveWalkerHandoverEventIndexToRailEvents(liveWalkerHandoverEventIndex)', 'App adapts live Walker event index to rail events');
assertContains(railBuildersSource, 'function getModqnReplayVisualTimeline', 'handoverRailBuilders derives a slow-motion MODQN replay display axis (extracted from App)');
assertContains(railBuildersSource, 'MODQN_REPLAY_VISUAL_MIN_DISPLAY_DURATION_SEC = 60', 'handoverRailBuilders stretches the short legacy producer trace into a readable display playback window');
assertContains(appSource, 'producerTraceDisplayDurationSec', 'App separates MODQN producer source horizon from display-stretched rail duration');
assertContains(timelineAuthoritySource, 'const producerSourceTimeline: TimelineSurfaceDescriptor', 'Timeline authority keeps producer source timeline separate from display-stretched rail axis');
assertContains(timelineAuthoritySource, "return { timeline: liveTimeline, rail: liveRail };", 'Timeline authority keeps MODQN live preview rail on the live Walker event index');
assertContains(timelineAuthoritySource, "return { timeline: producerSourceTimeline, rail: producerTrace };", 'Timeline authority keeps MODQN replay proof bottom timeline on producer source time');
assertContains(timelineAuthoritySource, 'horizonSec: producerDurationSec', 'Timeline authority keeps producer source horizon seconds separate from display duration');
assertContains(appSource, 'horizonSec={timelineRailDescriptor.timeline.horizonSec}', 'App passes source horizon seconds to TimelineBar separately');
assertContains(timelineAuthoritySource, "horizonKind: 'producer-trace'", 'Timeline authority models producer trace horizon explicitly');
assertContains(timelineAuthoritySource, 'LEGACY_PRODUCER_TRACE_SOURCE_GAP', 'Timeline authority carries legacy producer trace source-gap copy');
assertContains(appSource, 'const liveTimelineWindowStartSec = demoStartOffset;', 'App anchors live timeline display to the selected live Walker window');
assertContains(appSource, 'simState.simTimeSec - liveTimelineWindowStartSec', 'App displays live timeline as window elapsed time, not absolute sim offset');
assertContains(appSource, 'demoStartOffsetSec: demoStartOffset', 'App does not mutate the live Walker window start when seeking');
assertContains(appSource, 'const absoluteTargetSec = liveTimelineWindowStartSec + target;', 'App converts bottom timeline elapsed seek to absolute Walker time');
assertContains(appSource, "if (sceneLane === 'sinr-live' || sceneLane === 'modqn-live-cell-preview') return liveWalkerHandoverRailEvents;", 'App routes live lanes to the live Walker event index rail');
assertContains(appSource, "if (sceneLane === 'modqn-replay-proof') return modqnHandoverRailEvents;", 'App keeps MODQN replay proof on producer rail events');
});
// Honesty / authority keeps extracted from the quarantined App-bus region:
assertContains(appSource, 'data-scene-lane={sceneLane}', 'App browser lane telemetry');
assertNotContains(appSource, 'producerDisplayTimeline', 'App must not promote the slow-motion producer rail axis into the bottom timeline');
assertContains(appSource, 'durationSec={timelineRailDescriptor.rail.durationSec}', 'App handover rail uses descriptor-owned duration');
assertContains(appSource, 'sourceLabel={timelineRailDescriptor.rail.sourceLabel}', 'App handover rail uses descriptor-owned source label');
assertContains(appSource, 'sourceOwner={timelineRailDescriptor.rail.sourceOwner}', 'App handover rail exposes descriptor source owner');
assertContains(appSource, 'sourceGapReasons={timelineRailDescriptor.rail.sourceGapReasons}', 'App handover rail exposes descriptor source gaps');
assertContains(appSource, 'const timelineDurationSec = timelineRailDescriptor.timeline.durationSec;', 'App timeline duration is descriptor-owned');
assertNotContains(
  appSource,
  "const timelineDurationSec = sceneSource === 'artifact-replay'",
  'App must not derive timeline horizon from sceneSource alone',
);
assertNotContains(
  appSource,
  "const handoverRailSourceLabel = sceneSource === 'artifact-replay'",
  'App must not derive handover rail source labels from free sceneSource strings',
);

// C5: the AlgorithmDock is no longer mounted in App (Dashboard view removed). Its
// component file is retained for the future MODQN data-flow diagram project, so the
// component-shape asserts below still run; only the App-side mount is gone.
assert.equal(
  countOccurrences(appSource, '<AlgorithmDock'),
  0,
  'App no longer mounts the AlgorithmDock (C5: Dashboard view removed; dock code retained, unmounted)',
);

assertContains(
  algorithmDockSource,
  'data-testid="algorithm-dock"',
  'AlgorithmDock exposes root test id',
);
assertContains(
  algorithmDockSource,
  'data-testid="algorithm-dock-toggle"',
  'AlgorithmDock exposes collapse toggle test id',
);
assertContains(
  algorithmDockSource,
  'aria-expanded={!collapsed}',
  'AlgorithmDock toggle declares expanded state',
);
assert.equal(
  countOccurrences(algorithmDockSource, '<AlgorithmDashboard'),
  1,
  'AlgorithmDock mounts AlgorithmDashboard exactly once',
);
assertContains(
  algorithmDockSource,
  'variant="dock"',
  'AlgorithmDock renders the dashboard in dock layout variant',
);
assertContains(
  algorithmDockSource,
  'content="flowchart"',
  'AlgorithmDock renders only the flowchart in the dashboard view (C4 split)',
);
assert.equal(
  countOccurrences(algorithmDockSource, '<LiveTelemetryPanel'),
  1,
  'AlgorithmDock mounts LiveTelemetryPanel exactly once',
);
assertContains(
  algorithmDockSource,
  'mode === \'artifact\'',
  'AlgorithmDock keeps artifact and live modes distinct',
);
assertNotContains(algorithmDockSource, "from 'three", 'AlgorithmDock must not import three');
assertNotContains(algorithmDockSource, 'from "three', 'AlgorithmDock must not import three');
assertNotContains(algorithmDockSource, '@react-three/', 'AlgorithmDock must not import react-three');
assertNotContains(algorithmDockSource, '../scene/', 'AlgorithmDock must not import scene modules');
assertNotContains(algorithmDockSource, '../../scene/', 'AlgorithmDock must not import scene modules');
assertNotContains(algorithmDockSource, '../viz/', 'AlgorithmDock must not import viz modules');
assertNotContains(algorithmDockSource, '../../viz/', 'AlgorithmDock must not import viz modules');
assertNotContains(algorithmDockSource, '<Canvas', 'AlgorithmDock must not mount Canvas');

{
  const dockTestIdIndex = algorithmDockSource.indexOf('data-testid="algorithm-dock"');
  const dashboardMountIndex = algorithmDockSource.indexOf('<AlgorithmDashboard');
  assert.ok(dockTestIdIndex >= 0, 'AlgorithmDock root test id exists');
  assert.ok(
    dashboardMountIndex > dockTestIdIndex,
    'AlgorithmDashboard is mounted inside the AlgorithmDock source',
  );
  assertContains(
    algorithmDockSource,
    'MODQN Algorithm Pipeline',
    'AlgorithmDock identifies the dock region',
  );
  assertContains(
    algorithmDockSource,
    'MODQN Live Training',
    'AlgorithmDock identifies the live dock region',
  );
}

assertContains(
  algorithmDashboardSource,
  'data-testid="algorithm-dashboard"',
  'AlgorithmDashboard exposes root test id',
);
assertContains(
  algorithmDashboardSource,
  'buildDashboardSeriesModel(artifact)',
  'AlgorithmDashboard consumes the Plane-C dashboard series model',
);
assertContains(
  algorithmDashboardSource,
  'provenance.status',
  'AlgorithmDashboard renders INV-1 provenance status',
);
assertContains(
  algorithmDashboardSource,
  'data-testid="algorithm-dashboard-provenance-chip"',
  'AlgorithmDashboard exposes provenance chips',
);
assertContains(
  algorithmDashboardSource,
  'source gap - not shown',
  'AlgorithmDashboard fails closed on source gaps',
);

// ── C4: flowchart stays in the Dashboard view, the per-frame decision metric
//    tiles move to the artifact-replay sidebar (scene view, co-visible with 3D).
//    The split is display-only (Rule#6) — same artifact fields, different host.
assertContains(
  algorithmDashboardSource,
  "content?: 'all' | 'flowchart' | 'metrics'",
  'AlgorithmDashboard exposes the flowchart/metrics content split (C4)',
);
assertContains(
  algorithmDashboardSource,
  'data-content={content}',
  'AlgorithmDashboard stamps its content section on the root for view/lane gating',
);
// (no-3D / no-scene / no-viz import guards for AlgorithmDashboard are asserted in
//  the existing block below — not duplicated here.)

// App mounts the metric tiles in the artifact-replay sidebar, display-only +
// lane-owned. The flowchart host stays in the AlgorithmDock (Dashboard view).
assertContains(
  appSource,
  "from './showcase/dashboard/AlgorithmDashboard'",
  'App imports AlgorithmDashboard for the artifact-replay sidebar metrics',
);
assert.equal(
  countOccurrences(appSource, '<AlgorithmDashboard'),
  1,
  'App mounts AlgorithmDashboard exactly once (artifact-replay sidebar metrics)',
);
tangleLockGroup('QUAR-S6-BUS', () => {
  const metricsMountIndex = appSource.indexOf('<AlgorithmDashboard');
  assert.ok(metricsMountIndex >= 0, 'App AlgorithmDashboard mount exists');
  const metricsSlice = appSource.slice(metricsMountIndex, metricsMountIndex + 220);
  assertContains(metricsSlice, 'content="metrics"', 'App sidebar dashboard renders only the metric tiles (C4 split)');
  assertContains(metricsSlice, 'variant="sidebar"', 'App sidebar dashboard uses the sidebar layout variant');
  const artifactTabIndex = appSource.indexOf("activeRightSidebarTab === 'artifact'");
  const liveTabIndex = appSource.indexOf("activeRightSidebarTab === 'live'");
  assert.ok(
    artifactTabIndex >= 0 && artifactTabIndex < metricsMountIndex && metricsMountIndex < liveTabIndex,
    'App sidebar metrics are lane-owned inside the artifact right-sidebar branch',
  );
});
assertNotContains(algorithmDashboardSource, "from 'three", 'AlgorithmDashboard must not import three');
assertNotContains(algorithmDashboardSource, 'from "three', 'AlgorithmDashboard must not import three');
assertNotContains(algorithmDashboardSource, '@react-three/', 'AlgorithmDashboard must not import react-three');
assertNotContains(algorithmDashboardSource, '../scene/', 'AlgorithmDashboard must not import scene modules');
assertNotContains(algorithmDashboardSource, '../../scene/', 'AlgorithmDashboard must not import scene modules');
assertNotContains(algorithmDashboardSource, '../viz/', 'AlgorithmDashboard must not import viz modules');
assertNotContains(algorithmDashboardSource, '../../viz/', 'AlgorithmDashboard must not import viz modules');
assertNotContains(algorithmDashboardSource, '<Canvas', 'AlgorithmDashboard must not mount Canvas');

assertContains(
  liveTelemetryPanelSource,
  'data-testid="live-telemetry-panel"',
  'LiveTelemetryPanel exposes root test id',
);
assertContains(
  liveTelemetryPanelSource,
  'data-plane="A"',
  'LiveTelemetryPanel declares Plane A provenance',
);
assertContains(
  liveTelemetryPanelSource,
  'data-testid="live-telemetry-provenance-chip"',
  'LiveTelemetryPanel exposes INV-1 provenance chips',
);
assertContains(
  liveTelemetryPanelSource,
  'source gap - not shown',
  'LiveTelemetryPanel fails closed on source gaps',
);
assertContains(
  liveTelemetryPanelSource,
  'data-testid="live-telemetry-status-badge"',
  'LiveTelemetryPanel exposes INV-2 status badge',
);
assertNotContains(liveTelemetryPanelSource, "from 'three", 'LiveTelemetryPanel must not import three');
assertNotContains(liveTelemetryPanelSource, 'from "three', 'LiveTelemetryPanel must not import three');
assertNotContains(liveTelemetryPanelSource, '@react-three/', 'LiveTelemetryPanel must not import react-three');
assertNotContains(liveTelemetryPanelSource, '../scene/', 'LiveTelemetryPanel must not import scene modules');
assertNotContains(liveTelemetryPanelSource, '../../scene/', 'LiveTelemetryPanel must not import scene modules');
assertNotContains(liveTelemetryPanelSource, '../viz/', 'LiveTelemetryPanel must not import viz modules');
assertNotContains(liveTelemetryPanelSource, '../../viz/', 'LiveTelemetryPanel must not import viz modules');
assertNotContains(liveTelemetryPanelSource, '<Canvas', 'LiveTelemetryPanel must not mount Canvas');

// Headless Plane-A feed: the single store publisher, mounted independent of any
// sidebar tab so the live dock is never starved (codex [P1]).
const trainingTelemetryFeedSource = readRepoFile('src/showcase/dashboard/TrainingTelemetryFeed.tsx');
assertContains(
  trainingTelemetryFeedSource,
  'publishTelemetryEvent',
  'TrainingTelemetryFeed feeds the live telemetry store',
);
assertContains(
  trainingTelemetryFeedSource,
  'return null',
  'TrainingTelemetryFeed is headless (renders nothing)',
);
assertNotContains(trainingTelemetryFeedSource, "from 'three", 'TrainingTelemetryFeed must not import three');
assertNotContains(trainingTelemetryFeedSource, 'from "three', 'TrainingTelemetryFeed must not import three');
assertNotContains(trainingTelemetryFeedSource, '@react-three/', 'TrainingTelemetryFeed must not import react-three');
assertNotContains(trainingTelemetryFeedSource, '../scene/', 'TrainingTelemetryFeed must not import scene modules');
assertNotContains(trainingTelemetryFeedSource, '../../scene/', 'TrainingTelemetryFeed must not import scene modules');
assertNotContains(trainingTelemetryFeedSource, '../viz/', 'TrainingTelemetryFeed must not import viz modules');
assertNotContains(trainingTelemetryFeedSource, '../../viz/', 'TrainingTelemetryFeed must not import viz modules');
assertNotContains(trainingTelemetryFeedSource, '<Canvas', 'TrainingTelemetryFeed must not mount Canvas');
assertContains(
  appSource,
  "<TrainingTelemetryFeed enabled={appMode === 'modqn-demo'}",
  'App mounts the headless telemetry feed for modqn-demo independent of any tab',
);

// ── FIX-1: render-truth honesty — a non-producer artifact source is loud ──
// The dev middleware stamps `X-Showcase-Artifact-Source`. When the pinned
// producer artifact is absent it falls back to a synthetic fixture; the app
// must read that header, warn, expose it as scene telemetry, and render a
// visible badge so synthetic data can never be silently mistaken for a
// producer result (audit 2026-06-03 A2/A4). Display-only; no truth change.
const artifactSourceBadgeSource = readRepoFile('src/ui/ArtifactSourceBadge.tsx');
assertContains(
  appSource,
  "r.headers.get('X-Showcase-Artifact-Source')",
  'App reads the artifact-source transport header on the replay fetch',
);
assertContains(
  appSource,
  'artifactSource !== PRODUCER_PINNED_SOURCE',
  'App warns whenever the artifact source is not the pinned producer artifact',
);
assertContains(
  appSource,
  "r.headers.get('X-Showcase-Artifact-Source') ?? HEADER_ABSENT_SOURCE",
  'App maps a completed header-absent 200 to the distinct sentinel, not the loading null',
);
assertContains(
  appSource,
  'artifactSource === SYNTHETIC_FIXTURE_SOURCE',
  'App warn copy only calls the synthetic fixture "synthetic"; unverified sources say unverified',
);
assertContains(
  artifactSourceBadgeSource,
  "HEADER_ABSENT_SOURCE = 'header-absent'",
  'badge names the header-absent sentinel distinct from the loading null',
);
assertContains(
  artifactSourceBadgeSource,
  'source === HEADER_ABSENT_SOURCE',
  'badge renders the honesty surface for a completed response with no source header',
);
assertContains(
  appSource,
  "from './ui/ArtifactSourceBadge'",
  'App imports the render-truth honesty badge',
);
assertContains(
  appSource,
  '<ArtifactSourceBadge source={showcaseArtifactSource} />',
  'App mounts the artifact-source honesty badge in the artifact-replay lane',
);
assertContains(
  appSource,
  'data-artifact-source={',
  'App exposes the resolved artifact source as scene telemetry',
);
assertContains(
  artifactSourceBadgeSource,
  "PRODUCER_PINNED_SOURCE = 'producer-pinned'",
  'badge pins the real producer source token',
);
assertContains(
  artifactSourceBadgeSource,
  "SYNTHETIC_FIXTURE_SOURCE = 'synthetic-fixture-fallback'",
  'badge names the synthetic fixture fallback source token',
);
assertContains(
  artifactSourceBadgeSource,
  'source === null || source === PRODUCER_PINNED_SOURCE',
  'badge stays silent for the real producer source and the unknown/loading state',
);
assertContains(
  artifactSourceBadgeSource,
  'data-testid="artifact-source-badge"',
  'badge exposes a browser test id for the honesty surface',
);
// FIX-4: the durable Director cinematic browser gate reads these shell telemetry
// attributes (director FSM phase + effective playback speed). Lock them so they
// cannot be silently removed and quietly disable the gate.
assertContains(
  appSource,
  'data-director-phase={camera.directorPhase}',
  'App exposes the director FSM phase as shell telemetry for the cinematic gate',
);
assertContains(
  appSource,
  'data-effective-speed={playback.effectiveSpeed',
  'App exposes the effective playback speed as shell telemetry for the cinematic gate',
);

// ── ITEM #C / D4: live source Director seek-to-next-HO + sat-pair framing ──
// The live Director button mirrors the artifact cinematic (seek to the next
// handover + 0.25x slow-mo + frame the satellite pair) on the live lanes. On
// SINR-live D4 this is the sinrLiveCells cell-truth index; on MODQN preview it
// stays the live Walker overlay-demo index. Honesty: the seek target is a
// real source-time (resolveLiveWalkerFocusWindow returns window.startSec, never a
// fabricated horizon — docs/live-walker-handover-event-map-sdd.md) and the claim
// stays live-truth / overlay-demo, never producer proof. Lock the
// resolver, the live seek + deferred sat-pair focus wiring, and the claim telemetry.
const liveWalkerDirectorFocusSource = readRepoFile('src/scene/liveWalkerDirectorFocus.ts');
tangleLockGroup('QUAR-C1-DIRECTOR', () => {
assertContains(
  liveWalkerDirectorFocusSource,
  'const window = resolveCinematicReplayWindow(events, kind, nowSec, durationSec);',
  'live Walker Director resolver reuses the proven cinematic event selection',
);
assertContains(
  liveWalkerDirectorFocusSource,
  'seekTargetSec: window.startSec,',
  'live Walker Director seek target is a real source-time lead-in, not a fabricated horizon',
);
});
assertContains(
  liveWalkerDirectorFocusSource,
  "export type LiveWalkerDirectorFocusClaimKind = 'live-truth' | 'profile-derived-forecast' | 'overlay-demo';",
  'live Director focus claim allows SINR cell truth and overlay-demo, never producer proof',
);
// P3: the director orchestration (requestDirectorFocus + the cinematic/live focus
// lifecycle) was extracted from App into useDirectorOrchestration; App keeps the
// honesty TELEMETRY JSX + the lane-mapped claim const and mounts the hook.
const directorOrchestrationSource = readRepoFile('src/app/useDirectorOrchestration.ts');
tangleLockGroup('QUAR-C1-DIRECTOR', () => {
assertContains(
  appSource,
  'useDirectorOrchestration({',
  'App wires the extracted director orchestration hook',
);
assertContains(
  directorOrchestrationSource,
  "from '../scene/liveWalkerDirectorFocus'",
  'director hook imports the live Walker Director focus resolver',
);
assertContains(
  directorOrchestrationSource,
  'resolveLiveWalkerFocusWindow(',
  'director hook resolves the next live Walker handover for the Director focus',
);
});
assertContains(
  appSource,
  "sceneLane === 'modqn-live-cell-preview' ? 'overlay-demo' : 'live-truth'",
  'App labels the live Director focus claim by lane (overlay-demo vs SINR cell truth)',
);
tangleLockGroup('QUAR-C1-DIRECTOR', () => {
assertContains(
  appSource,
  'createSinrLiveCellHandoverEventIndexBuilder({',
  'App builds the SINR-live handover index incrementally (chunked) from sinrLiveCells cell truth',
);
});
assertContains(
  sinrLiveCellHandoverEventIndexSource,
  "sourceOwner: 'sinr-live-cell-truth'",
  'SINR cell-truth event index declares its source owner',
);
assertContains(
  sinrLiveCellHandoverEventIndexSource,
  "runtimeFramePath: 'stepRuntimeFrame+sinrLiveCells'",
  'SINR cell-truth event index records the additive sinrLiveCells trajectory path',
);
tangleLockGroup('QUAR-C1-DIRECTOR', () => {
assertContains(
  directorOrchestrationSource,
  'pendingLiveFocusRef.current = {',
  'director hook arms a deferred live Director focus so the sat-pair pose reads the post-seek frame',
);
assertContains(
  directorOrchestrationSource,
  'camera.requestInterFocus(pending.framing)',
  'director hook passes the resolved live sat-pair framing into the inter-HO Director focus',
);
});
assertContains(
  appSource,
  'data-live-director-focus-claim={directorFocusEnabled ? liveDirectorFocusClaimKind : undefined}',
  'App exposes the live Director focus claim as honesty telemetry',
);
assertContains(
  appSource,
  'data-live-director-focus-event-sec={liveDirectorFocusEventSec !== null ? liveDirectorFocusEventSec.toFixed(3) : undefined}',
  'App exposes the resolved live Director focus event source-time (binds the seek to a real indexed event)',
);
tangleLockGroup('QUAR-C1-DIRECTOR', () => {
assertContains(
  directorOrchestrationSource,
  'const cancelPendingLiveFocus = useCallback(() => {',
  'director hook can cancel an armed-but-unfired live Director focus',
);
assertContains(
  directorOrchestrationSource,
  '}, [sceneLane, cancelPendingLiveFocus]);',
  'director hook cancels a stale armed live Director focus on a lane switch (no cross-lane sat-pair leak)',
);
});
assertNotContains(
  liveWalkerDirectorFocusSource,
  'Math.random',
  'live Walker Director resolver must not fabricate event times',
);

// ── FIX-5 Option C: honest satellite azimuth HUD (artifact-replay only) ──
// A 2D DOM compass-rose HUD recovers the truthful ground-plane azimuth of the
// producer's flattened ECI-proxy satellites without fabricating the missing
// overhead elevation. It is a Shared Surface (no new viewport proof layer): it
// must import no three / react-three / Canvas, must stay lane-owned (mounted
// only on artifact-replay), and must keep its azimuth-only honesty caption so
// it cannot silently start overclaiming elevation/Earth-rotation truth.
const artifactSatelliteCompassSource = readRepoFile('src/ui/ArtifactSatelliteCompass.tsx');
const artifactSatelliteAzimuthsSource = readRepoFile('src/ui/artifactSatelliteAzimuths.ts');
const SATELLITE_COMPASS_HONESTY_LABEL =
  'Satellites — orbital azimuth only (ECI proxy, no elevation/Earth-rotation)';
assertContains(
  artifactSatelliteCompassSource,
  SATELLITE_COMPASS_HONESTY_LABEL,
  'satellite compass keeps the azimuth-only / no-elevation honesty caption',
);
assertContains(
  artifactSatelliteCompassSource,
  'export const SATELLITE_COMPASS_HONESTY_LABEL',
  'satellite compass exports the honesty caption so the governance gate can lock it',
);
assertContains(
  artifactSatelliteCompassSource,
  'data-testid="artifact-satellite-compass"',
  'satellite compass exposes its root test id for the real-data browser smoke',
);
assertContains(
  artifactSatelliteCompassSource,
  'data-testid="artifact-satellite-azimuth-marker"',
  'satellite compass exposes per-satellite azimuth markers for the browser smoke',
);
assertContains(
  artifactSatelliteCompassSource,
  'data-has-elevation={hasElevationData',
  'satellite compass surfaces the data-driven elevation flag (false for the flat proxy)',
);
// Proxy-only gate (codex FIX-5 P2): the azimuth-only / "no elevation" caption is
// truthful ONLY for the flattened ECI proxy. The compass must render nothing for
// a real ecef-km / mixed / elevation-bearing frame, or it overclaims a missing
// limitation in the opposite direction.
assertContains(
  artifactSatelliteCompassSource,
  'if (!isFlatEciProxy) return null',
  'satellite compass renders ONLY for the flat ECI proxy frame (no proxy caption on real geometry)',
);
assertContains(
  artifactSatelliteCompassSource,
  'data-frame-kind="eci-km-no-earth-rotation-proxy"',
  'satellite compass surfaces the proxy frame kind it is honest about',
);
assertContains(
  artifactSatelliteAzimuthsSource,
  'isFlatEciProxy',
  'azimuth helper derives the flat-ECI-proxy gate',
);
assertContains(
  artifactSatelliteAzimuthsSource,
  "FLAT_ECI_PROXY_FRAME = 'eci-km-no-earth-rotation-proxy'",
  'azimuth helper pins the flat ECI proxy frame it gates on',
);
// no-3D-viewport-layer property: a DOM HUD, never a Canvas / three render layer.
assertNotContains(artifactSatelliteCompassSource, "from 'three", 'satellite compass must not import three');
assertNotContains(artifactSatelliteCompassSource, 'from "three', 'satellite compass must not import three');
assertNotContains(artifactSatelliteCompassSource, '@react-three/', 'satellite compass must not import react-three');
assertNotContains(artifactSatelliteCompassSource, '<Canvas', 'satellite compass must not mount a Canvas (no 3D viewport layer)');
assertNotContains(artifactSatelliteCompassSource, 'useFrame', 'satellite compass must not drive a render-loop frame hook');
// display-only: it reads only the NormalizedSceneFrame satellite TYPE + the pure
// azimuth helper; it must not import a scene/viz runtime composer.
assertContains(
  artifactSatelliteCompassSource,
  "import type { NormalizedSatellite } from '../scene/NormalizedSceneFrame'",
  'satellite compass reads only the satellite type (display-only, no scene runtime import)',
);
assertContains(
  artifactSatelliteCompassSource,
  "import { deriveSatelliteAzimuths } from './artifactSatelliteAzimuths'",
  'satellite compass derives azimuths via the pure unit-tested helper',
);
assertContains(
  artifactSatelliteAzimuthsSource,
  'export function deriveSatelliteAzimuths',
  'azimuth helper exports the pure derivation',
);
assertContains(
  artifactSatelliteAzimuthsSource,
  'hasElevationData',
  'azimuth helper reports whether real elevation was present (never fabricated)',
);
assertNotContains(artifactSatelliteAzimuthsSource, "from 'three", 'azimuth helper stays pure (no three import)');
// App mounts it exactly once, lane-gated to artifact-replay.
assertContains(
  appSource,
  "from './ui/ArtifactSatelliteCompass'",
  'App imports the honest satellite azimuth compass',
);
assert.equal(
  countOccurrences(appSource, '<ArtifactSatelliteCompass'),
  1,
  'ArtifactSatelliteCompass is mounted exactly once',
);
tangleLockGroup('QUAR-S6-BUS', () => {
  const compassMountIndex = appSource.indexOf('<ArtifactSatelliteCompass');
  assert.ok(compassMountIndex >= 0, 'ArtifactSatelliteCompass mount exists in App');
  const compassGuardSlice = appSource.slice(Math.max(0, compassMountIndex - 160), compassMountIndex);
  assertContains(
    compassGuardSlice,
    "sceneLane === 'artifact-replay'",
    'ArtifactSatelliteCompass mount is lane-gated to artifact-replay',
  );
});
assertContains(
  governanceDoc,
  'Artifact Satellite Azimuth HUD (FIX-5 Option C)',
  'governance doc documents the satellite azimuth HUD shared surface',
);
assertContains(
  governanceDoc,
  'never the missing elevation',
  'governance doc records the HUD never fabricates elevation',
);

// The dev middleware is the header EMITTER for the honesty surface — it must
// derive the source from the loader's resolved source, never hardcode synthetic,
// so an env-provided / regenerated real artifact is not mislabeled as fake.
const viteConfigSource = readRepoFile('vite.config.ts');
assertContains(
  viteConfigSource,
  "source.kind === 'synthetic'",
  'dev middleware derives the artifact-source header from the loader source',
);
assertContains(
  viteConfigSource,
  "'external-artifact-path'",
  'dev middleware labels an env-provided external artifact distinctly from the synthetic fixture',
);
assertNotContains(
  viteConfigSource,
  "res.setHeader('X-Showcase-Artifact-Source', 'synthetic-fixture-fallback')",
  'dev middleware must not hardcode the synthetic header on the loader fallback path',
);

// ── Track-2 design-token bridge: value-preserving INV colour contract ──
// The INV-1/2/3 colours are now named :root tokens (src/styles/main.scss). These
// assertions lock both (a) the token VALUES so a future edit cannot silently
// drift an INV colour, and (b) that the INV selectors REFERENCE the tokens so the
// contract cannot be bypassed by re-hardcoding the hex. Together they prove the
// staleness != offline and source-gap distinctions stay byte-identical.
const mainScssSource = readRepoFile('src/styles/main.scss');
for (const [token, value] of [
  // INV-1 truth-plane (chip text + border are distinct hues, both locked)
  ['--leo-plane-live', '#76ead7'],
  ['--leo-plane-live-border', 'rgba(118, 234, 215, 0.5)'],
  ['--leo-plane-paper', '#8fc0ff'],
  ['--leo-plane-paper-border', 'rgba(120, 178, 255, 0.5)'],
  ['--leo-plane-user', '#ffce82'],
  ['--leo-plane-user-border', 'rgba(255, 200, 110, 0.5)'],
  // INV-2 telemetry status (stalled freeze-grey is distinct from offline red)
  ['--leo-telemetry-live-border', 'rgba(129, 246, 188, 0.32)'],
  ['--leo-telemetry-stalled-border', 'rgba(193, 205, 214, 0.32)'],
  ['--leo-telemetry-stalled-bg', 'rgba(160, 173, 184, 0.12)'],
  ['--leo-telemetry-stalled-text', 'rgba(218, 226, 232, 0.88)'],
  ['--leo-telemetry-offline-border', 'rgba(255, 118, 118, 0.32)'],
  ['--leo-telemetry-offline-bg', 'rgba(255, 118, 118, 0.1)'],
  ['--leo-telemetry-offline-text', 'rgba(255, 205, 205, 0.94)'],
  ['--leo-telemetry-frozen-filter', 'grayscale(0.42)'],
  ['--leo-telemetry-idle-border', 'rgba(138, 162, 184, 0.34)'],
  // INV-3 source-gap (absent producer channel; never fabricated)
  ['--leo-source-gap-chip-border', 'rgba(255, 190, 69, 0.34)'],
  ['--leo-source-gap-chip-bg', 'rgba(255, 190, 69, 0.09)'],
  ['--leo-source-gap-chip-text', 'rgba(255, 217, 142, 0.92)'],
  ['--leo-source-gap-text', 'rgba(255, 190, 69, 0.86)'],
  // Interactive accent (teal #76ead7 === rgb(118,234,215))
  ['--leo-accent-rgb', '118, 234, 215'],
] as const) {
  assertContains(
    mainScssSource,
    `${token}: ${value};`,
    `design token ${token} keeps its value-preserving INV literal`,
  );
}
assertContains(mainScssSource, 'color: var(--leo-plane-live);', 'INV-1 live truth-tone chip references the plane-live token');
assertContains(mainScssSource, 'color: var(--leo-plane-paper);', 'INV-1 paper truth-tone chip references the plane-paper token');
assertContains(mainScssSource, 'color: var(--leo-plane-user);', 'INV-1 user truth-tone chip references the plane-user token');
assertContains(mainScssSource, 'border-color: var(--leo-telemetry-stalled-border);', 'INV-2 stalled badge references the staleness token (distinct from offline)');
assertContains(mainScssSource, 'border-color: var(--leo-telemetry-offline-border);', 'INV-2 offline badge references the offline token (distinct from stalled)');
assertContains(mainScssSource, 'border-color: var(--leo-telemetry-idle-border);', 'INV-2 idle badge references the idle token (no-run state distinct from offline)');
assertContains(liveTelemetryPanelSource, 'data-telemetry-status="idle"', 'LiveTelemetryPanel renders an idle (not offline) badge for the no-run empty state');
assertContains(mainScssSource, 'filter: var(--leo-telemetry-frozen-filter);', 'INV-2 frozen tile references the freeze-filter token');
assertContains(mainScssSource, 'background: var(--leo-source-gap-chip-bg);', 'INV-3 source-gap chip references the source-gap background token');
assertContains(mainScssSource, 'color: var(--leo-source-gap-chip-text);', 'INV-3 source-gap chip references the source-gap text token');

{
  const baseInput = {
    sceneSource: 'live-sim' as const,
    liveDurationSec: 7200,
    liveCurrentTimeSec: 42,
    artifactDurationSec: 300,
    artifactCurrentTimeSec: 7,
    artifactHandoverEventCount: 0,
    producerTraceRange: {
      startSec: 1,
      endSec: 10,
      durationSec: 10,
      rangeLabel: '1s-10s',
    },
    producerTraceCurrentTimeSec: 1,
    producerTraceDisplayDurationSec: 60,
    producerTraceDisplayCurrentTimeSec: 18,
    bundleProvenanceKind: 'paper-faithful' as const,
  };
  const livePreview = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'modqn-live-cell-preview',
  });
  assert.equal(livePreview.timeline.sourceOwner, 'live-walker', 'MODQN live preview bottom timeline uses live Walker source');
  assert.equal(livePreview.timeline.horizonKind, 'live-walker-window', 'MODQN live preview bottom timeline uses live Walker horizon');
  assert.equal(livePreview.timeline.durationSec, 7200, 'MODQN live preview bottom timeline uses the validated 7200s live Walker window');
  assert.ok(livePreview.timeline.horizonLabel.includes('2 h'), 'MODQN live preview bottom timeline may label the validated live Walker horizon as 2 h');
  assert.equal(livePreview.timeline.claimKind, 'overlay-demo', 'MODQN live preview bottom timeline is an overlay/demo claim');
  assert.equal(livePreview.rail.sourceOwner, 'live-walker', 'MODQN live preview rail uses the live Walker event index');
  assert.equal(livePreview.rail.horizonKind, 'live-walker-window', 'MODQN live preview rail uses the live Walker 7200s horizon');
  assert.equal(livePreview.rail.durationSec, 7200, 'MODQN live preview rail does not inherit the 10s producer trace');
  assert.equal(livePreview.rail.claimKind, 'overlay-demo', 'MODQN live preview rail labels live Walker events as overlay/demo');
  assert.equal(livePreview.rail.axisKind, 'source-time', 'MODQN live preview rail click targets use source time');

  const sinrLive = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'sinr-live',
  });
  assert.equal(sinrLive.rail.sourceOwner, 'sinr-live-cell-truth', 'SINR live rail uses the sinrLiveCells event index');
  assert.equal(sinrLive.rail.horizonKind, 'live-walker-window', 'SINR live rail uses the live Walker 7200s horizon');
  assert.equal(sinrLive.rail.claimKind, 'live-truth', 'SINR precomputed rail is cell-truth live truth');
  assert.equal(sinrLive.rail.axisKind, 'source-time', 'SINR live rail click targets use source time');

  const proof = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'modqn-replay-proof',
  });
  assert.equal(proof.timeline.sourceOwner, 'modqn-producer-trace', 'MODQN replay proof bottom timeline uses producer source');
  assert.equal(proof.timeline.horizonKind, 'producer-trace', 'MODQN replay proof bottom timeline uses producer horizon');
  assert.equal(proof.timeline.durationSec, 10, 'MODQN replay proof bottom timeline keeps the 10s producer horizon');
  assert.equal(proof.timeline.axisKind, 'source-time', 'MODQN replay proof bottom timeline uses source time');
  assert.equal(proof.timeline.claimKind, 'producer-proof', 'MODQN replay proof bottom timeline is producer proof');

  const artifactGap = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'artifact-replay',
    sceneSource: 'artifact-replay',
  });
  assert.equal(artifactGap.timeline.sourceOwner, 'artifact-replay', 'artifact replay bottom timeline uses artifact source');
  assert.equal(artifactGap.rail.sourceGapReasons.length, 1, 'artifact replay rail fails closed without a handover event index');
  const artifactWithEvents = resolveTimelineRailDescriptor({
    ...baseInput,
    sceneLane: 'artifact-replay',
    sceneSource: 'artifact-replay',
    artifactHandoverEventCount: 3,
  });
  assert.equal(artifactWithEvents.rail.sourceGapReasons.length, 0, 'artifact replay rail accepts artifact-owned events when indexed');
}
assertContains(appSource, 'const [modqnReplayProofRequested, setModqnReplayProofRequested] = useState(false);', 'App explicit proof request state');
assertContains(appSource, "handoverMode === 'decision-overlay-on-live-sinr'", 'App proof request is limited to decision overlay mode');
assertContains(appSource, 'setModqnReplayProofRequested(false)', 'App proof request reset outside eligible lane');
assertContains(appSource, "proofViewportActive={sceneLane === 'modqn-replay-proof'}", 'App wires proof viewport active state into cue panel');
assertContains(appSource, 'canToggleModqnReplayProof ? setModqnReplayProofRequested : undefined', 'App wires proof viewport toggle callback only when eligible');
assertContains(appSource, 'getLeftSidebarTabsForSceneLane(sceneLane, handoverMode)', 'App lane-aware left sidebar tabs');
assertContains(appSource, 'getRightSidebarTabsForSceneLane(sceneLane, handoverMode)', 'App lane-aware right sidebar tabs');
assertContains(appSource, "activeLeftSidebarTab === 'evidence'", 'App unified MODQN Evidence/Replay left sidebar branch');
assertContains(appSource, 'data-testid="artifact-replay-sidebar"', 'App folds the artifact source summary into the Evidence left rail (artifact sub-view)');
// S4: the MODQN Setup power tools left the rail for the Advanced drawer — the
// left rail no longer has a 'setup' branch.
assertNotContains(appSource, "activeLeftSidebarTab === 'setup'", 'S4: App no longer renders a Setup left sidebar branch (moved to the Advanced drawer)');
assertContains(appSource, "activeRightSidebarTab === 'artifact'", 'App artifact right sidebar branch');
assertContains(appSource, "sceneSource !== 'artifact-replay' || activeSceneFrame !== undefined", 'App artifact scene fail-closed gate');
assertContains(appSource, 'data-testid="artifact-scene-fail-closed"', 'App artifact scene fail-closed placeholder');
assertContains(appSource, "if (sceneSource === 'artifact-replay') return;", 'App skips MODQN replay bundle startup fetch in artifact replay');
assertContains(appSource, "sceneSource !== 'artifact-replay' && modqnReplayFetchError !== null", 'App hides MODQN bundle fetch banner in artifact replay');
tangleLockGroup('QUAR-S6-BUS', () => {
assertContains(
  appSource,
  "sceneLane === 'modqn-live-cell-preview' && (",
  'App should hide the MODQN Phase I HUD outside the live cell lane',
);
assertContains(
  appSource,
  "sceneLane === 'modqn-live-cell-preview' && <ServiceStatusBanner appMode={appMode} />",
  'App should hide the MODQN training service banner outside the live cell lane',
);
});
assertNotContains(
  appSource,
  "showModqnReplayScene={appMode === 'modqn-demo'}",
  'App must not mount MODQN replay proof from appMode alone',
);
assertContains(appRuntimeModelSource, 'MODQN_LEFT_SIDEBAR_TABS', 'App runtime model MODQN left tab (S4 Evidence only; Setup moved to the Advanced drawer)');
assertContains(appRuntimeModelSource, "key: 'evidence'", 'App runtime model exposes the Evidence / Replay left tab');
assertNotContains(appRuntimeModelSource, "key: 'setup'", 'S4: App runtime model no longer exposes a Setup left tab (Advanced drawer hosts the power tools)');
assertContains(appRuntimeModelSource, 'ARTIFACT_RIGHT_SIDEBAR_TABS', 'App runtime model artifact right tabs');
assertContains(appRuntimeModelSource, 'MODQN_REPLAY_PROOF_RIGHT_SIDEBAR_TABS', 'App runtime model replay proof right tabs');
assertContains(appRuntimeModelSource, "lane === 'artifact-replay'", 'App runtime model artifact lane override');
assertContains(appRuntimeModelSource, "lane === 'modqn-replay-proof'", 'App runtime model MODQN proof lane override');
assertContains(appRuntimeModelSource, "lane === 'modqn-live-cell-preview') return MODQN_RIGHT_SIDEBAR_TABS", 'App runtime model offers cell preview right sidebar live status + co-visible MODQN evidence');
assertContains(appRuntimeModelSource, "if (lane === 'modqn-replay-proof') return 'modqn';", 'App runtime model defaults proof right sidebar to MODQN evidence');

assertContains(timelineBarSource, 'data-source-owner={sourceOwner}', 'TimelineBar exposes source owner telemetry');
assertContains(timelineBarSource, 'data-horizon-kind={horizonKind}', 'TimelineBar exposes horizon kind telemetry');
assertContains(timelineBarSource, 'readonly horizonSec?: number;', 'TimelineBar accepts source horizon seconds separately from display duration');
assertContains(timelineBarSource, 'data-horizon-sec={safeHorizonSec.toFixed(3)}', 'TimelineBar exposes source horizon seconds telemetry');
assertContains(timelineBarSource, 'data-claim-kind={claimKind}', 'TimelineBar exposes claim kind telemetry');
assertContains(timelineBarSource, 'data-testid="timeline-source-label"', 'TimelineBar renders source/horizon label');
assertContains(handoverRailSource, 'data-source-owner={sourceOwner}', 'HandoverEventRail exposes source owner telemetry');
assertContains(handoverRailSource, 'data-horizon-kind={horizonKind}', 'HandoverEventRail exposes horizon kind telemetry');
assertContains(handoverRailSource, 'data-horizon-sec={safeDurationSec.toFixed(3)}', 'HandoverEventRail exposes source horizon seconds');
assertContains(handoverRailSource, 'data-source-gap-count={String(sourceGapReasons.length)}', 'HandoverEventRail exposes source gap count');
assertContains(handoverRailSource, "return 'producer trace';", 'HandoverEventRail labels MODQN rows as producer trace context');
assertContains(handoverRailSource, 'buildEventMapClusters', 'HandoverEventRail builds stable source-time event map clusters');
assertContains(handoverRailSource, 'data-map-layout="fixed-event-map"', 'HandoverEventRail exposes fixed event-map layout telemetry');
assertContains(handoverRailSource, 'data-map-order="source-time"', 'HandoverEventRail keeps source-time map ordering');
assertContains(handoverRailSource, 'data-cursor-mode="independent"', 'HandoverEventRail keeps playback cursor independent from map ordering');
// (S0: the display-stretched DUAL-AXIS design below is what C2's single-axis
// rework deletes; source-owner/claim/source-gap honesty attrs stay permanent above.)
tangleLockGroup('QUAR-C2-TIMELINE', () => {
assertContains(handoverRailSource, 'data-axis-kind={axisKind}', 'HandoverEventRail exposes source-time vs display-stretched axis telemetry');
assertContains(handoverRailSource, 'data-axis-sec={safeAxisDurationSec.toFixed(3)}', 'HandoverEventRail exposes display axis seconds separately from source horizon');
assertContains(handoverRailSource, 'data-axis-current-sec={safeAxisCurrentTimeSec.toFixed(3)}', 'HandoverEventRail exposes display axis cursor seconds');
assertContains(handoverRailSource, 'data-axis-playing={animateAxisCursor ? \'true\' : \'false\'}', 'HandoverEventRail exposes animated display-axis cursor state');
assertContains(handoverRailSource, 'data-axis-playback-rate={safeAxisPlaybackRate.toFixed(3)}', 'HandoverEventRail exposes display axis playback rate');
assertContains(handoverRailSource, 'displayTimeSec', 'HandoverEventRail supports display-stretched marker positions without mutating source time');
assertContains(handoverRailSource, 'sourceTimeSec', 'HandoverEventRail accepts explicit source time');
assertContains(handoverRailSource, 'clickTargetSec', 'HandoverEventRail accepts explicit source-time click targets');
assertContains(handoverRailSource, 'data-click-target-sec={cluster.clickTargetSec.toFixed(3)}', 'HandoverEventRail exposes source-time click target telemetry');
assertContains(handoverRailSource, 'onClick={() => selectClusterAndSeek(cluster)}', 'HandoverEventRail routes marker clicks through source-time selection');
assertContains(handoverRailSource, 'seekTo(cluster.clickTargetSec);', 'HandoverEventRail seeks to source click targets, not display axis positions');
assertContains(handoverRailSource, "sourceOwner === 'sinr-live-cell-truth'", 'HandoverEventRail allows D4 cell-truth source for slow-motion focus');
assertContains(handoverRailSource, "horizonKind === 'live-walker-window'", 'HandoverEventRail gates slow-motion focus to the live Walker source horizon');
assertContains(handoverRailSource, 'data-focus-axis-kind={slowMotionFocus?.axisKind ?? \'\'}', 'HandoverEventRail exposes focus display-axis telemetry');
assertContains(handoverRailSource, 'data-testid="handover-event-slow-focus"', 'HandoverEventRail renders the selected live Walker slow-motion focus panel');
assertContains(handoverRailSource, "axisKind: 'display-stretched'", 'HandoverEventRail slow-motion focus uses a display axis');
assertContains(handoverRailSource, '--handover-rail-axis-duration', 'HandoverEventRail drives display cursor animation from axis duration');
assertContains(appSource, 'axisPlaying={!playback.paused}', 'App pauses the handover rail display sweep with playback state');
assertContains(appSource, 'axisPlaybackRate={playback.effectiveSpeed}', 'App synchronizes handover rail display sweep with playback speed');
});
assertContains(handoverRailSource, 'data-marker-cluster-count={String(eventMapClusters.length)}', 'HandoverEventRail exposes marker cluster count');
assertContains(handoverRailSource, 'data-testid="handover-event-map-track"', 'HandoverEventRail renders a fixed event-map track');
assertContains(handoverRailSource, 'aria-label="Source-ordered handover event map"', 'HandoverEventRail list is source-ordered, not nearest-event ordered');
assertContains(handoverRailSource, "data-clustered={clustered ? 'true' : 'false'}", 'HandoverEventRail marks clustered same-time events');
assertNotContains(handoverRailSource, 'getNearestEvents', 'HandoverEventRail must not sort rows by distance to the playback cursor');
assertNotContains(handoverRailSource, 'nearestEvents', 'HandoverEventRail rows must not be cursor-nearest owned');
assertNotContains(handoverRailSource, '.slice(0, 6)', 'HandoverEventRail fixed event map must not cap rows by nearest window');
assertNotContains(handoverRailSource, 'Nearest handover events', 'HandoverEventRail must not present a cursor-relative nearest-event list');

assertContains(
  controlBarSource,
  "const isArtifactReplay = sceneLane === 'artifact-replay' || sceneSource === 'artifact-replay';",
  'ControlBar artifact replay branch guard',
);
assertContains(
  controlBarSource,
  'sceneLane?: SceneLane;',
  'ControlBar accepts scene lane',
);
// G1-CONTROLBAR-ADV: the SINR-live display/camera controls (beam density,
// beam-info callouts, camera presets, spotlight, HO-slow) moved off the top bar
// into the opt-in SinrLiveDisplayDrawer. The ControlBar no longer owns a
// live-only block — it keeps only the shared Mode select and the lane-aware UE
// filter. Lane-ownership is UNCHANGED: App mounts the drawer only on the
// SINR-live lane, mirroring the MODQN AdvancedSetupDrawer's `!== 'sinr-live'`
// gate. (Consolidation C1 removed the in-ControlBar playback speed slider; S5a
// moved MODQN display/policy controls into the Advanced drawer.)
assertNotContains(
  controlBarSource,
  'showSinrLiveControls',
  'ControlBar no longer derives a SINR-live-only control branch (G1-CONTROLBAR-ADV relocated it to SinrLiveDisplayDrawer)',
);
assertContains(
  appSource,
  "from './ui/SinrLiveDisplayDrawer'",
  'App imports the SINR-live display/camera drawer',
);
tangleLockGroup('QUAR-S6-BUS', () => {
  // The five relocated controls must NOT regress back into the top bar; each now
  // lives in the lane-mounted SinrLiveDisplayDrawer instead. A future edit that
  // re-hoists a control into the ControlBar is caught here.
  for (const [needle, label] of [
    ['data-testid="beam-density-control"', 'beam density controls'],
    ['data-testid="beam-info-toggle"', 'beam info toggle'],
    ['data-testid="camera-preset-control"', 'camera preset controls'],
    ['Spotlight', 'spotlight control copy'],
    ['HO Slow', 'HO slow control copy'],
  ] as const) {
    assertNotContains(
      controlBarSource,
      needle,
      `ControlBar must not re-own ${label} (relocated to SinrLiveDisplayDrawer)`,
    );
    assertContains(
      sinrLiveDisplayDrawerSource,
      needle,
      `SinrLiveDisplayDrawer owns the relocated ${label}`,
    );
  }
  // The drawer is SINR-live-lane-owned: App lane-gates it on the SINR-live lane.
  const sinrDrawerMountIndex = appSource.indexOf('<SinrLiveDisplayDrawer');
  assert.ok(sinrDrawerMountIndex >= 0, 'App mounts the SINR-live display drawer');
  const sinrDrawerGateIndex = appSource.lastIndexOf("sceneLane === 'sinr-live'", sinrDrawerMountIndex);
  assert.ok(
    sinrDrawerGateIndex >= 0 && sinrDrawerMountIndex - sinrDrawerGateIndex < 220,
    'App lane-gates the SINR-live display drawer on the SINR-live lane (mirrors the MODQN drawer gate)',
  );
});

// ── G1-LEFT-DEFAULT: SINR-live left rail = light orientation card; tuners → ⚙ ──
// The heavy SINR-formula + handover-policy tuners moved OFF the default left rail
// into the SINR-live ⚙ Advanced drawer (collapsible sections). The default left
// rail is a single light read-only orientation card. App must no longer render a
// 'signal'/'handover' left-tab branch, and the tuner panels must be injected into
// the drawer (not the SidebarTabShell).
const sinrOrientationCardSource = readRepoFile('src/ui/SinrLiveOrientationCard.tsx');
assertContains(
  appSource,
  "from './ui/SinrLiveOrientationCard'",
  'App imports the SINR-live left orientation card',
);
assertContains(
  appSource,
  '<SinrLiveOrientationCard',
  'App mounts the SINR-live orientation card on the summary left rail',
);
assertContains(
  appSource,
  "activeLeftSidebarTab === 'summary'",
  'App renders the light summary orientation card as the SINR-live left default',
);
assertNotContains(
  appSource,
  "activeLeftSidebarTab === 'signal'",
  'G1-LEFT-DEFAULT: App no longer renders a signal-tuning left tab branch (moved to the Advanced drawer)',
);
assertNotContains(
  appSource,
  "activeLeftSidebarTab === 'handover'",
  'G1-LEFT-DEFAULT: App no longer renders a handover-policy left tab branch (moved to the Advanced drawer)',
);
// The relocated tuners are injected into the SINR-live Advanced drawer as nodes.
assertContains(
  appSource,
  'sinrFormulaSection={',
  'App injects the SINR-formula tuner into the SINR-live Advanced drawer',
);
assertContains(
  appSource,
  'handoverPolicySection={',
  'App injects the handover-policy tuner into the SINR-live Advanced drawer',
);
assertContains(
  sinrLiveDisplayDrawerSource,
  'sinrFormulaSection',
  'SINR-live Advanced drawer hosts the relocated SINR-formula section',
);
assertContains(
  sinrLiveDisplayDrawerSource,
  'handoverPolicySection',
  'SINR-live Advanced drawer hosts the relocated handover-policy section',
);
assertContains(
  sinrOrientationCardSource,
  'deriveSinrServingMosaicAggregate',
  'orientation card reuses the shared serving aggregate (read-only, no invented truth)',
);
assertContains(
  sinrOrientationCardSource,
  'data-claim-kind="sinr-serving"',
  'orientation card is lane-truthful (sinr-serving claim, never MODQN/producer)',
);

assertContains(
  modqnReplayCuePanelSource,
  'readonly proofViewportActive?: boolean;',
  'MODQN replay cue proof viewport active prop',
);
assertContains(
  modqnReplayCuePanelSource,
  'readonly onProofViewportActiveChange?: (active: boolean) => void;',
  'MODQN replay cue proof viewport change prop',
);
assertContains(
  modqnReplayCuePanelSource,
  'data-testid="modqn-replay-proof-viewport-toggle"',
  'MODQN replay cue proof viewport toggle',
);
assertContains(
  modqnReplayCuePanelSource,
  "const label = active ? 'Hide proof from viewport' : 'Show proof in viewport';",
  'MODQN replay cue proof viewport toggle label',
);
assertContains(
  modqnReplayCuePanelSource,
  'aria-pressed={active}',
  'MODQN replay cue proof viewport toggle pressed state',
);
assertContains(
  modqnReplayCuePanelSource,
  'disabled={disabled}',
  'MODQN replay cue proof viewport toggle controller wiring guard',
);
assertContains(
  modqnReplayCuePanelSource,
  'Controller wiring required to change MODQN replay proof viewport',
  'MODQN replay cue proof viewport disabled wiring copy',
);

assertContains(
  mainSceneSource,
  'resolveSceneLaneRenderPlan({',
  'MainScene uses the scene lane render plan',
);
assertContains(
  sceneLaneRenderPlanSource,
  'export function isSceneLaneSourceCompatible',
  'Scene lane render plan exposes lane/source compatibility invariant',
);
assertContains(
  sceneLaneRenderPlanSource,
  "input.sceneLane === 'artifact-replay'",
  'Scene lane render plan treats artifact replay as a source-owned lane',
);
assertContains(
  sceneLaneRenderPlanSource,
  'sourceCompatible && input.sceneSource ===',
  'Scene lane render plan derives live/artifact source flags from compatibility',
);
assertContains(
  sceneLaneRenderPlanSource,
  "sceneLane === 'sinr-live' ? 'cylinder' : 'sphere'",
  'Scene lane render plan owns UE marker shape instead of raw appMode',
);
assertContains(
  sceneLaneRenderPlanSource,
  'showCinematicSpotlight',
  'Scene lane render plan owns cinematic spotlight gating',
);
// ── Handover-cinema candidate highlight (S1) lane-ownership source locks ──
assertContains(
  sceneLaneRenderPlanSource,
  'showCandidateHandoverHighlight',
  'Scene lane render plan owns the handover-cinema candidate-highlight gate',
);
assertContains(
  sceneLaneRenderPlanSource,
  "const showCandidateHandoverHighlight = showSinrLiveViewport && input.cinematicMode === 'director'",
  'Candidate highlight is gated sinr-live + director (no producer dependency, inert elsewhere)',
);
assertContains(
  mainSceneSource,
  'showCandidateHandoverHighlight && runtime.candidateHighlight',
  'MainScene mounts the candidate highlight only under the render-plan gate + an armed command',
);
assertContains(
  mainSceneSource,
  '<CandidateBeamHighlight',
  'MainScene mounts the lane-owned CandidateBeamHighlight layer',
);
assertContains(
  candidateBeamHighlightSource,
  'dataset.candidateHandoverHighlightRenderedCount',
  'Candidate highlight publishes a MESH-derived rendered-count observable (validator-provable render)',
);
assertContains(
  candidateBeamHighlightSource,
  'findCellGround(cellPlacementById, candidate.fromCellId)',
  'Candidate highlight uses cell placement for D4 cell-truth focused events',
);
assertContains(
  sinrOffsetExplainerSource,
  'data-claim-kind="sinr-offset"',
  'SINR explainer is stamped lane-truthful claim-kind="sinr-offset" (never producer/MODQN proof)',
);
assertContains(
  sinrOffsetExplainerSource,
  'data-source-owner={model.sourceOwner}',
  'SINR explainer exposes the D4 event source owner',
);
assertContains(
  sinrOffsetExplainerSource,
  'data-event-id={model.eventId}',
  'SINR explainer exposes the focused source event id',
);
assertContains(
  sinrOffsetExplainerSource,
  'data-off-axis-deg={row.offAxisDeg == null ? \'\' : row.offAxisDeg.toFixed(3)}',
  'SINR explainer exposes old/new off-axis fields from the cell-truth event',
);
assertContains(
  handoverCinemaSource,
  "index.sourceOwner === 'sinr-live-cell-truth'",
  'handover cinema fails closed unless D4 cell-truth events carry required cell/off-axis fields',
);
// ── SINR-serving mosaic (S2) lane-ownership + distinct-from-MODQN source locks ──
const sinrServingMosaicSource = readRepoFile('src/scene/sinrServingMosaic.ts');
const sinrServingAggregateSource = readRepoFile('src/ui/SinrServingAggregate.tsx');
assertContains(
  sceneLaneRenderPlanSource,
  'const showSinrServingMosaic = showSinrLiveViewport',
  'SINR-serving mosaic is gated sinr-live only (always-on ambient, no producer dependency)',
);
// QUAR-S4-SERVING block #1 RETIRED (S4-3): the mosaic module-ownership /
// queue-source / queue-conservation export-text pins were replaced by behaviour
// + VALUE asserts in validate:phase-c:sinr-serving-mosaic:model (the test
// imports + DRIVES every owned export; SINR_LIVE_SERVICE_QUEUE_SOURCE VALUE
// assert; cell-lane cross-surface ownership check) and by the keystone
// validate:s4:serving-equivalence gate (aggregate + queue derived from
// sim.sinrLiveCells on a real frame).
assertNotContains(
  sinrServingMosaicSource,
  "from './modqnServiceMap'",
  'SINR-serving mosaic must NOT import the MODQN cell overlay map (distinct lane-owned layer)',
);
// QUAR-S4-SERVING block #2 RETIRED (S4-3): the telemetry-THREADING JSX pins
// were replaced by the LIVE behaviour in
// validate:phase-c:sinr-serving-mosaic:browser — the ON half reads the
// mesh-derived colour count / queue-pressure buckets / 99 instances from the
// canvas dataset on sinr-live; the OFF half asserts those attributes are
// ABSENT on every MODQN-lane canvas. The block's DERIVATION-GATE needle was
// NOT behaviourally replaceable yet — re-wrapped below into QUAR-S5-BEAMRENDER
// together with block #3's colour-oracle wiring needle.
//
// S5-2 GRADUATION to PERMANENT (was QUAR-S5-BEAMRENDER): WHICH oracle feeds the
// 3D mosaic dots (cell truth, not steered) and the lane-gating of that derivation
// are RENDER-layer selection wiring. validate:phase-c:sinr-serving-mosaic:browser
// OFF-half covers the lane gate (the mosaic telemetry is ABSENT on every MODQN-lane
// canvas) and validate:s4:serving-equivalence E2/E3 prove the cell-colour FUNCTION;
// what is left is the MainScene CALL EDGE (it wires the cell-colour map, not steered).
// The mosaic is the S2/S4 layer (NOT the S5 cone render this slice flips); its full
// behavioural replacement is not cheaply available without a render diff, so these
// two wiring locks GRADUATE to permanent rather than retire with the cone pins — a
// one-line steered re-point/guard-delete would otherwise re-open the S4 two-oracle
// disease silently.
assertContains(
  mainSceneSource,
  'if (!showSinrServingMosaic) return null;',
  'MainScene derives the SINR-serving mosaic colours only under the render-plan gate (sinr-live) — deleting the guard would override MODQN service-map colours via the mosaic-first merge',
);
assertContains(
  mainSceneSource,
  'buildSinrServingUeColorMapFromCells(cellFrame.ues)',
  'the 3D mosaic colours UE markers from the CELL truth on sinr-live (one serving oracle per viewport — a steered re-point would silently resurrect the S4 dual-oracle disease)',
);
assertContains(
  groundSceneSource,
  'function publishInstanceColorTelemetry',
  'GroundScene publishes a MESH-derived distinct-colour count (validator-provable mosaic render)',
);
assertContains(
  groundSceneSource,
  'function publishInstanceContentionTelemetry',
  'GroundScene publishes GEOMETRY-derived queue-pressure bucket telemetry from the instanced aContention buffer',
);
assertContains(
  sinrServingAggregateSource,
  'data-claim-kind="sinr-serving"',
  'SINR-serving aggregate is stamped lane-truthful claim-kind="sinr-serving" (never producer/MODQN proof)',
);
assertContains(
  sinrServingAggregateSource,
  'data-queue-source={queueAggregate.source}',
  'SINR-serving aggregate exposes the queue source label from the same queue model',
);
assertContains(
  sinrServingAggregateSource,
  'data-testid="sinr-service-queue-summary"',
  'SINR-serving aggregate exposes dense queue metrics without per-UE labels',
);
assertContains(
  sinrServingAggregateSource,
  'data-testid="sinr-service-queue-heatmap"',
  'SINR-serving aggregate exposes a dense queue heatmap strip from the queue aggregate',
);
assertContains(
  sinrServingAggregateSource,
  'live SINR serving · not MODQN',
  'SINR-serving aggregate carries the lane-truthful "not MODQN" disclosure',
);
assertContains(
  appSource,
  '<SinrServingAggregate',
  'App mounts the SINR-serving aggregate HUD',
);
assertContains(
  appSource,
  "visible={sceneLane === 'sinr-live'}",
  'App gates the SINR-serving aggregate HUD to the sinr-live lane',
);

// ── SINR-live earth-fixed cell truth (S-cells-2, ADDITIVE) lane ownership ──
// The cell truth is a NEW optional SimFrame field (`sinrLiveCells`) produced by a
// pure runtime adapter, lane-owned to sinr-live ONLY. The load-bearing property
// is ADDITIVE: `runtimeFrameStep.ts` stays FROZEN and existing frame fields are
// byte-identical, so the three MODQN/artifact lanes see ZERO drift. Render does
// NOT consume the field until S-cells-3 — these locks pin that boundary.
// S3-3: useSimulation/runtimeFrameStep/cellLayout source pins moved to BEHAVIOR /
// structural / VALUE asserts in validate:s3:one-reset (QUAR-S3-STEP retirement), so
// those readRepoFile() handles are gone from this file.
const sinrLiveCellRuntimeSource = readRepoFile('src/scene/sinrLiveCellRuntime.ts');
const sceneTypesSource = readRepoFile('src/scene/types.ts');
// (a) the lane gate: MainScene owns the cell truth as sinr-live ONLY. QUAR-S3-STEP
//     block #1 RETIRED (S3-3): the brittle MainScene call-shape pin + the
//     useSimulation factory-call source-text pin are replaced by BEHAVIOR in
//     validate:s3:one-reset (the factory returns null off the lane / a model on it, a
//     null attach is a no-op) plus a robust MainScene lane-ownership assert there.
//     The permanent additive-boundary asserts below stay.
assertContains(
  sinrLiveCellRuntimeSource,
  'if (!useEarthFixedCellTruth) return null;',
  'cell-truth factory returns null when the lane gate is off (other-lane zero-drift)',
);
assertContains(
  sinrLiveCellRuntimeSource,
  'if (model === null) return;',
  'cell-truth attach is a no-op for a null model (additive: off-lane frames untouched)',
);
assertContains(
  sinrLiveCellRuntimeSource,
  'frame.sinrLiveCells = model.step(',
  'cell-truth attach mutates ONLY the new sinrLiveCells field',
);
// (c) purity / additivity structural locks: the runtime adapter must not pull the
//     scene-type hub or the frozen runtime stepper, so it CANNOT touch any other
//     frame field — and `runtimeFrameStep.ts` must stay free of cell-truth symbols
//     (FROZEN, S-cells-2-A).
assertNotContains(
  sinrLiveCellRuntimeSource,
  "from './types'",
  'cell-truth adapter must not import the SimFrame hub (stays additive + THREE-free)',
);
assertNotContains(
  sinrLiveCellRuntimeSource,
  "from './runtimeFrameStep'",
  'cell-truth adapter must not import the frozen runtime stepper',
);
// QUAR-S3-STEP block #2 RETIRED (S3-3): the FROZEN-text "no sinrLiveCell symbol" pin
// on runtimeFrameStep.ts is replaced by the structural import-boundary assert in
// validate:s3:one-reset (the runtime step does not import the cell adapter/model —
// cell truth ∉ step callee set; the additive boundary holds until S4 folds it).
// (d) the new SimFrame field is an optional, sinr-live-only addition.
assertContains(
  sceneTypesSource,
  'sinrLiveCells?: SinrLiveCellFrame;',
  'SimFrame carries the cell truth as an OPTIONAL field (undefined off the sinr-live lane)',
);
// (e) S-cells-3 FLIPS the S-cells-2 boundary: render now CONSUMES the cell truth.
//     MainScene reads `sim.sinrLiveCells` to draw the cell-truth beam cones.
assertContains(
  mainSceneSource,
  'sim.sinrLiveCells',
  'MainScene consumes the cell truth in S-cells-3 (cell-truth beam cone render)',
);
// (f) elevation-mask parity (runtime linkSats mask == cell-layout default == cell
//     adapter, all 15°). QUAR-S3-STEP block #3 RETIRED (S3-3): the 15° literal
//     triple-pin is replaced by imported-constant VALUE asserts in
//     validate:s3:one-reset (MIN_ELEVATION_DEG === DEFAULT_MIN_ELEVATION_DEG ===
//     SINR_LIVE_CELL_MIN_ELEVATION_DEG === 15) — stronger than the source-text pins.
// (g) the runtime-wiring gate is wired into package.json.
assertContains(
  packageJson,
  '"validate:phase-c:sinr-live-cells:runtime"',
  'package exposes the S-cells-2 runtime-wiring validator',
);

// ── SINR-live earth-fixed cell-truth RENDER (S-cells-3) lane ownership ──
// The cell truth becomes the lane's PRIMARY beam render: cones at FIXED cell
// centres (apex = serving sat, base = cell centre) replacing the steered,
// UE-anchored SatelliteBeams, so the UE renders visibly off-centre. Lane-owned to
// sinr-live ONLY via a NEW render-plan flag (NOT `showCellOverlay`, which stays
// MODQN-only). Serving comes from the SINR + HandoverManager cell truth, NEVER the
// round-robin `cellScheduler` (codex BLOCK-3).
const sinrLiveCellBeamConesSource = readRepoFile('src/viz/SinrLiveCellBeamCones.tsx');
const useBeamVizSource = readRepoFile('src/scene/useBeamViz.ts');
// (h) the new render-plan flag is lane-gated to the sinr-live viewport, NOT the
//     MODQN cell overlay.
assertContains(
  sceneLaneRenderPlanSource,
  'showSinrLiveCellBeams: boolean',
  'render plan declares the cell-truth beam-cone flag',
);
// S5-2: the ambient flag is now `= showSinrLiveViewport` (un-parked) — pinned by
// the flipped render-plan matrix above (showSinrLiveCellBeams TRUE on sinr-live).
// The cell-cone JSX, the D4 focus-pair mount + telemetry, and the steered-mount
// auto-suppress are no longer text-pinned here: the cone render is covered by
// validate:phase-c:sinr-live-cells:render(:browser) (incl. the D4 pair resolver
// sourceOwner-guard test) and the connected-sat-has-beam must-hold invariant; the
// UE-anchor retirement is wired through the shared visible-beam resolver. The
// QUAR-RENDER-RESET + cone QUAR-S5-BEAMRENDER text pins retired with S5-2.
// (k) BLOCK-3 import purity: the cone resolver consumes the cell TRUTH only — it
//     must NOT pull the round-robin scheduler (that display oracle stays
//     MODQN-lane-only in CellBeamCones.tsx).
assertNotContains(
  sinrLiveCellBeamConesSource,
  "from '../scene/useCellSchedule'",
  'cell-truth cone resolver must not import the round-robin useCellSchedule (BLOCK-3)',
);
assertNotContains(
  sinrLiveCellBeamConesSource,
  "from '../engine/cells/cellScheduler'",
  'cell-truth cone resolver must not import the round-robin cellScheduler (BLOCK-3)',
);
assertContains(
  sinrLiveCellBeamConesSource,
  "from '../scene/sinrLiveCellModel'",
  'cell-truth cone resolver consumes the SinrLiveCellFrame truth type',
);
// (l) S5-2: MainScene places cones from the same cell layout as the runtime truth —
//     the QUAR-S5-BEAMRENDER `buildSinrLiveCellLayout(profile)` text pin retired,
//     replaced by the cone-base==truth-cell-centre BEHAVIOUR invariant in
//     validate:phase-c:sinr-live-cells:render (resolver fed the real layout asserts
//     the cone base lands on the truth cell centre — stronger than the text pin).
// (m) the render gates are wired into package.json + the live-render suite.
assertContains(
  packageJson,
  '"validate:phase-c:sinr-live-cells:render"',
  'package exposes the S-cells-3 render model gate',
);
assertContains(
  packageJson,
  '"validate:phase-c:sinr-live-cells:render:browser"',
  'package exposes the S-cells-3 render browser gate',
);
// S5-2: the cell-cone render browser gate is RE-ADDED to the live-render suite —
// the cones are un-parked, so there ARE cones to assert (replaces the retired
// QUAR-RENDER-RESET ban that kept it out while parked).
assertContains(
  packageJson,
  'sinr-serving-mosaic:browser && npm run validate:phase-c:sinr-live-cells:render:browser',
  'live-render suite runs the un-parked cell-cone render browser gate (S5-2)',
);

// S5-2: the serving-cone render pins (serving-only / freq-reuse colour / blending /
// focus-scoping) RETIRED with QUAR-S5-BEAMRENDER. Their behaviour now lives in
// BEHAVIOUR gates: validate:phase-c:sinr-live-cells:render asserts serving-only
// cones + frequency-reuse colour + the style-token VALUES (ambient 0.08 < pair 0.30,
// 32 segments, NormalBlending) from constants/sinrLiveConeStyle.ts; the focus cap is
// retired (focusSatIds null = draw EVERY serving sat, D-STYLE A); and the INTENT —
// every connected sat shows a beam — is ENFORCED as a must-hold by the S0 invariant
// validate:s0:connected-sat-has-beam (cone-cripple positive control).
//
// PERMANENT wiring lock (D-STYLE A, draw-all): MainScene passes focusSatIds null to
// the cone resolver so EVERY serving sat is beamed (no focus narrowing). The s0
// must-hold + the validate:phase-c:sinr-live-cells:render "focusSatIds null draws
// every serving sat" control prove the BEHAVIOUR; this pins that MainScene does not
// silently re-introduce a focus cap that would leave serving sats beamless.
assertContains(
  mainSceneSource,
  'focusSatIds: null',
  'MainScene draws every serving sat (focusSatIds null) — no focus narrowing leaves a serving sat beamless (D-STYLE A)',
);

// ── SINR-live ambient live-handover PULSE (G2c) lane ownership + decouple locks ──
// The bright, age-faded cones of the real per-frame handovers
// (`frame.sinrLiveCells.recentHandoverEvents`). Lane-owned to sinr-live ONLY and
// ALWAYS-ON ambient — DELIBERATELY decoupled from the manual-arm director cinema
// (`showCandidateHandoverHighlight`) so the sim playing forward shows continuous
// handovers with no seek / no camera. Matrix asserts above prove the lane gating
// + the under-director decouple; these pin the WIRING.
// (1) the render-plan flag is declared + gated to the sinr-live viewport (NOT
//     director-coupled — `= showSinrLiveViewport`, no `&& cinematicMode` term).
assertContains(
  sceneLaneRenderPlanSource,
  'showSinrLiveHandoverPulse: boolean',
  'render plan declares the G2c live-handover pulse flag',
);
assertContains(
  sceneLaneRenderPlanSource,
  'const showSinrLiveHandoverPulse = showSinrLiveViewport',
  'G2c pulse is gated sinr-live only + ALWAYS-ON (decoupled from the director cinematic gate)',
);
// (2) MainScene derives the pulse cones under the always-on flag (NOT the
//     director-gated showCandidateHandoverHighlight) from the model's real
//     recentHandoverEvents truth — a Rule#6 display read-out, no fabricated HO.
assertContains(
  mainSceneSource,
  'recentHandoverEvents: sim.sinrLiveCells?.recentHandoverEvents',
  'MainScene feeds the live pulse from the model truth (real per-frame handovers, Rule#6)',
);
// (3) the pulse layer is mounted with a MESH-derived rendered-count observable so
//     the browser gate proves the bright cones actually drew (not just resolved).
assertContains(
  mainSceneSource,
  'telemetryCountDatasetKey="sinrLiveHandoverPulseConeRenderedCount"',
  'MainScene mounts the live-pulse cone layer with a mesh-derived rendered-count telemetry',
);
// (4) G2-TICKER: the always-on rolling handover COUNT HUD (complements the pulse
//     cones). Lane-gated to sinr-live, fed the PUBLISHED rolling log (not a
//     re-derived one) — display-only (its own deep gate is
//     validate:phase-c:handover-ticker:model). The publisher publishes the log
//     from the same model truth the pulse reads (Rule#6). These pin the wiring so
//     it cannot silently un-lane or be fed a fabricated source.
assertContains(
  appSource,
  "from './ui/SinrHandoverTicker'",
  'App imports the always-on handover ticker',
);
assertContains(
  appSource,
  'recentHandoverEvents={simState.recentHandoverEvents}',
  'handover ticker is fed the PUBLISHED rolling handover log (display-only, never re-derived)',
);
assertContains(
  useSimStatePublisherSource,
  'recentHandoverEvents: sim.sinrLiveCells?.recentHandoverEvents',
  'publisher publishes the rolling handover log from the model truth (Rule#6 display read-out)',
);

// QUAR-S4-SERVING block #3 RETIRED (S4-3): the de-punned publisher-shape text
// needles were replaced by validate:s4:serving-equivalence — it EXECUTES the
// real exported projection (buildPublishedPerUePositions) on a warmed live
// frame and asserts the published records are byte-identical to
// sim.sinrLiveCells.ues with servingBeamId null + typed servingCellId (the
// behavioural publisher-shape assert that also catches an alias-laundered
// re-pun), plus the 3D-map/HUD/queue/cone cross-consumer agreement. The
// structural sweep + typed-marker pins live on in validate:s4:pun-retired.
// The block's MainScene colour-oracle wiring needle was re-wrapped into
// QUAR-S5-BEAMRENDER above (render-selection wiring, S5 scope).
//
// S4-3 3-lens review (major): the equivalence gate certifies the EXPORTED
// projection — this call-edge pin guarantees the hook actually publishes
// through it (a re-inlined projection + dead export would otherwise pass every
// behavioural gate). Wrapped into QUAR-S6-BUS: the publisher collapse behind
// the NormalizedSceneFrame seam (the file's own P2 TODO) is bus-split scope,
// which replaces this with a single-channel contract test.
tangleLockGroup('QUAR-S6-BUS', () => {
assertContains(
  simStatePublisherSource,
  'const perUePositions = buildPublishedPerUePositions(sim);',
  'the live SimState publisher publishes the SAME projection validate:s4:serving-equivalence executes (call edge pinned — the gate is blind to a re-inlined projection)',
);
});

// ── EarthFixedCells green-disc retired (S-cells-4d) — one cell layout per viewport ──
// The legacy 20-hex steered-cover green-disc ground paint stays RETIRED: the
// cell-truth beam cones own the earth-fixed cell story, and two competing cell
// layouts on one viewport is a render-governance violation. S5-2 GRADUATED the
// QUAR-S5-BEAMRENDER source-text pin to a BEHAVIOURAL matrix assert (the flag is
// false on the render plan) + the permanent MainScene "do not mount" guard.
assert.equal(
  renderPlan('sinr-live', 'live-sim').showEarthFixedCells,
  false,
  'the legacy hex green-disc stays retired on sinr-live (one cell layout per viewport — the cell-truth cones own it)',
);
assertNotContains(
  mainSceneSource,
  '<EarthFixedCells',
  'MainScene must not mount the retired hex green-disc (no competing 2nd cell layout)',
);

// ── Beam hopping + serving continuity + coverage (S-cells-3 / 4a / 4b-fix) ──
// A satellite forms a fixed number of beams (leo = 7), so the cell truth caps each
// sat to SINR_LIVE_BEAMS_PER_SAT illuminated cells/slot. CONTINUITY: a beam that is
// already SERVING a cell stays LOCKED on it (a connected UE must not blink off every
// hop slot); only the SPARE beam budget hops over the sat's unserved reachable cells.
// Illumination is a scheduling gate; the SERVING sat of a lit cell is still chosen by
// SINR + the HandoverManager (B3 / codex BLOCK-3), never round-robin. Cell SIZE and
// link-budget GAIN come from the SAME realistic 3.32° beamwidth (one antenna);
// coverage of the 200×90 area is delivered by STEERING, not by widening the lobe.
// These locks pin that wiring so it cannot silently regress to a single satellite
// lighting every cell it can see, or to a timer that hops serving beams off their UEs.
const sinrLiveCellModelSource = readRepoFile('src/scene/sinrLiveCellModel.ts');
// QUAR-S4-SERVING block #4 RETIRED (S4-3): the beam-hopping cap / one-antenna
// beamwidth / illuminated-beams / serving-continuity text pins were replaced by
// behaviour bound to the RUNTIME consts: validate:phase-c:sinr-live-cells:model
// drives the cap (≤ SINR_LIVE_BEAMS_PER_SAT, with an uncapped positive control),
// the across-slot serving-continuity lock, the idle-honesty bound, and the
// illuminated-beam surface at the runtime-wired SINR_LIVE_HOP_SLOT_SEC; the
// factory wiring itself (beamsPerSat / beamwidth / hop slot reach the model;
// layout sized by the same beamwidth) is VALUE-asserted in
// validate:s4:serving-equivalence section V.
// The cap GATES candidate illumination; serving is still SINR + HandoverManager.
assertContains(
  sinrLiveCellModelSource,
  'manager.update(candidateSamples',
  'cell serving stays SINR + HandoverManager (illumination cap is not a serving oracle — BLOCK-3)',
);

// ── SINR-live antenna truth-input override (S-cells-4a) ──
// The showcase lane sets its OWN self-consistent peak gain + wider steering as a
// decoupled SINR-live-only truth-input (CLAUDE.md Rule#1/#4): the shared
// `profile.antenna` is NEVER mutated, so the steered lane + baseline-KPI windows
// stay byte-identical. Peak gain MUST be self-consistent with the beamwidth (no
// >100%-efficiency bug). These locks pin (1) the overrides are wired into the
// factory, (2) the model gates candidates by the EFFECTIVE (overridden) steering
// limit — not the profile's — so the candidate list matches the scan-loss ceiling,
// and (3) the runtime gate asserts gain↔beamwidth self-consistency.
// QUAR-S4-SERVING block #5 RETIRED (S4-3): the antenna-override literal text
// pins (`= 33.5` / `= 50`) and the override wiring text pins were replaced by
// imported-constant VALUE asserts + factory-wiring behaviour in
// validate:s4:serving-equivalence section V (the S3-3 pattern: assert on the
// imported const + the constructed model, never on source text); the gain↔
// beamwidth self-consistency relation is also locked by
// validate:phase-c:sinr-live-cells:runtime. The effective-steering assert below
// + the profile-mutation ban stay PERMANENT (structure/behaviour, not text pins).
assertContains(
  sinrLiveCellModelSource,
  'const maxSteer = this.antenna.maxSteeringAngleDeg',
  'cell model filters candidates by the EFFECTIVE (overridden) steering limit, not profile.antenna',
);
// The truth-input is decoupled: the shared profile antenna is left untouched so
// the steered lane + baseline KPI never drift. The override must NOT be written
// back into the profile.
assertNotContains(
  sinrLiveCellRuntimeSource,
  'profile.antenna.maxGainDbi =',
  'S-cells-4a must NOT mutate the shared profile peak gain (decoupled override only)',
);
// Self-consistency is the load-bearing guard against re-introducing the
// >100%-efficiency pairing; the runtime gate locks it via consistentPeakGainDbi.
const sinrLiveCellRuntimeTestSource = readRepoFile('src/scene/sinrLiveCellRuntime.test.ts');
assertContains(
  sinrLiveCellRuntimeTestSource,
  'consistentPeakGainDbi(SINR_LIVE_CELL_BEAMWIDTH_RAD, SINR_LIVE_CELL_ANTENNA_EFFICIENCY)',
  'runtime gate asserts gain↔beamwidth self-consistency (|maxGainDbi − consistentPeakGainDbi| < 0.5 dB)',
);

assertContains(
  sceneLaneRenderPlanSource,
  'export type HandoverStoryLayerPolicy',
  'Scene lane render plan owns handover story layer policy',
);
assertContains(
  sceneLaneRenderPlanSource,
  "handoverStoryLayerPolicy:",
  'Scene lane render plan exposes handover story layer telemetry policy',
);
assertContains(
  sceneLaneRenderPlanSource,
  "'profile-derived-demo'",
  'Scene lane render plan allows profile-derived MODQN demo story only by policy',
);
assertContains(
  sceneLaneRenderPlanSource,
  "effectiveCinematicMode: showCinematicSpotlight ? input.cinematicMode : 'off'",
  'Scene lane render plan disables cinematic mode outside the SINR live lane',
);
assertContains(
  mainSceneSource,
  'resolveSceneLaneUeMarkerShape(sceneLane)',
  'MainScene derives UE marker shape from scene lane',
);
tangleLockGroup('QUAR-S6-BUS', () => {
assertContains(
  mainSceneSource,
  "const showUav = sceneLane === 'sinr-live';",
  'MainScene render isolation probe derives UAV visibility from scene lane',
);
});
assertContains(
  mainSceneSource,
  'data-scene-lane={sceneLane}',
  'MainScene render isolation probe exposes scene lane',
);
assertContains(
  sceneTelemetrySource,
  'el.dataset.sceneLaneSourceCompatible',
  'MainScene canvas exposes lane/source compatibility telemetry'
);
assertContains(
  mainSceneSource,
  'deriveProfileHandoverStoryModel',
  'MainScene builds the profile-derived handover story model',
);
// ── S-FLAG-2: MODQN service-allocation overlay family producer gate ──
// The all-UE service map + readout/legend/diagnostics grid, the per-cell UE-count
// badges, and the phase-3 beam-load cylinder + upload particles are PARKED behind
// the `showModqnServiceAllocation` producer-readiness gate (default OFF), NOT the
// broad `showCellOverlay`. Every MODQN lane replays a degenerate producer baseline
// (100 UEs/one beam, 0 handovers, 1 sat) that makes the all-UE allocation
// meaningless noise. Lock the gate definition, the App/persistence un-park wiring,
// and every MainScene consumer so the family cannot silently regress back onto the
// default surface — while keeping the code + data path intact (G3 scaffolding).
assertContains(
  sceneLaneRenderPlanSource,
  'export const MODQN_SERVICE_ALLOCATION_PRODUCER_READY = false',
  'render plan ships the MODQN service-allocation producer gate parked OFF',
);
assertContains(
  sceneLaneRenderPlanSource,
  'showCellOverlay && (input.modqnServiceAllocationEnabled ?? false)',
  'render plan AND-s the service-allocation gate with showCellOverlay and defaults it OFF',
);
assertContains(
  appPersistenceSource,
  "params.get('modqnServiceAllocation') === '1'",
  'appPersistence exposes the ?modqnServiceAllocation=1 dev/validator un-park override',
);
assertContains(
  appSource,
  'MODQN_SERVICE_ALLOCATION_PRODUCER_READY || readModqnServiceAllocationOverrideFromUrl()',
  'App threads the producer-readiness gate OR the URL override into the runtime config',
);
assertContains(
  appRuntimeConfigSource,
  'modqnServiceAllocationEnabled: input.appMode === \'modqn-demo\'',
  'app runtime config only forwards the service-allocation gate on the modqn-demo lane',
);
assertContains(
  mainSceneSource,
  'modqnServiceAllocationEnabled: runtime.modqnServiceAllocationEnabled ?? false',
  'MainScene threads the service-allocation gate into the scene lane render plan input',
);
assertContains(
  mainSceneSource,
  'showModqnServiceAllocation && modqnVisualLayers.serviceMap',
  'MainScene gates the all-UE service map / readout / contention by the producer gate (not showCellOverlay)',
);
assertContains(
  mainSceneSource,
  'showUeCounts={modqnVisualLayers.ueCountBadges && showModqnServiceAllocation}',
  'MainScene gates the per-cell UE-count badges by the producer gate',
);
assertContains(
  mainSceneSource,
  'modqnServedUeCount={showModqnServiceAllocation ? modqnServiceMap.servedUeCount : 0}',
  'MainScene served-UE telemetry reports zero while the service-allocation family is parked',
);
assertContains(
  mainSceneSource,
  'modqnIdleUeCount={showModqnServiceAllocation ? modqnServiceMap.idleUeCount : 0}',
  'MainScene idle-UE telemetry rides the same producer gate as served (no stray showCellOverlay gate in the family)',
);
assertContains(
  mainSceneSource,
  "modqnServiceMapEnabled={showModqnServiceAllocation && modqnVisualLayers.serviceMap ? '1' : '0'}",
  'MainScene service-map-enabled telemetry honestly tracks the producer gate (parked = 0)',
);
assertNotContains(
  mainSceneSource,
  'const beamLoadContentionEnabled = showCellOverlay && modqnVisualLayers.serviceMap',
  'MainScene must not re-gate the service-allocation family by the broad showCellOverlay flag (S-FLAG-2 regression)',
);
assertContains(
  mainSceneSource,
  'deriveModqnServiceMap({',
  'MainScene derives MODQN all-UE service map for the cell lane',
);
assertContains(
  mainSceneSource,
  'buildModqnCellServiceReadout({',
  'MainScene builds the MODQN service readout from the cell schedule',
);
assertContains(
  mainSceneSource,
  'slotSec: CELL_SCHEDULE_VIZ_SLOT_SEC',
  'MainScene labels MODQN service diagnostics with the display cell-schedule slot duration',
);
assertContains(
  mainSceneSource,
  'modqnCellServiceReadout,',
  'MainScene passes MODQN service readout into SimState publisher',
);
assertContains(
  mainSceneSource,
  'markerColor: mosaic?.markerColor ?? service?.markerColor',
  'MainScene passes mosaic-or-cell-service colors to UE markers (sinr-serving mosaic falls back to the MODQN cell overlay only on the MODQN lane)',
);
assertContains(
  groundSceneSource,
  'const resolvedMarkerColor = markerColor ?? PRIMARY_COLOR',
  'GroundScene applies service-map colors to the primary UE marker',
);
assertContains(
  groundSceneSource,
  'markerColor={primary.markerColor}',
  'GroundScene threads primary UE marker color into PrimaryUeMarker',
);
assertContains(
  mainSceneSource,
  'ueCountByCellId={modqnServiceMap.ueCountByCellId}',
  'MainScene passes per-cell UE counts to CellOverlay',
);
assertContains(
  mainSceneSource,
  'const showCellReassignmentEventArcs = modqnVisualLayers.handoverCues',
  'MainScene gates profile-derived cell reassignment cues by MODQN visual preset',
);
assertContains(
  mainSceneSource,
  'selectProfileDerivedHandoverCues',
  'MainScene caps profile-derived handover cue density',
);
assertContains(
  mainSceneSource,
  'visible={showCellReassignmentEventArcs}',
  'MainScene wires cell reassignment event arcs through an explicit visibility gate',
);
assertContains(
  mainSceneSource,
  '<HandoverStoryLayer',
  'MainScene can mount the shared handover story layer',
);
assertContains(
  mainSceneSource,
  '{showProfileHandoverStoryLayer && modqnVisualLayers.handoverStory && (',
  'MainScene gates the shared story layer by scene lane render plan and MODQN visual preset',
);
assertContains(
  mainSceneSource,
  '{showCellOverlay && modqnVisualLayers.beamCones && (',
  'MainScene gates MODQN beam cones by visual preset',
);
assertContains(
  mainSceneSource,
  'beamConeScope: renderedCellBeamConeScope',
  'MainScene passes visual preset beam cone scope into render-count helper',
);
assertContains(
  mainSceneSource,
  'resolveCellBeamConeSatelliteCount',
  'MainScene computes MODQN beam-cone satellite telemetry',
);
assertContains(
  mainSceneSource,
  'beamConeScope={modqnVisualLayers.beamConeScope}',
  'MainScene passes visual preset beam cone scope to CellBeamCones',
);
// FIX-7 finding #1 (provenance audit 2026-06-04): the phase-3 contention glow
// MUST derive from the same profile-derived cell-schedule per-UE assignment that
// `modqnServiceMap` already displays (the lane's authoritative shown serving),
// NOT the dead `sim.perUePositions` HandoverManager serving (empty on the
// modqn-demo decision-overlay path). Lock the C1 source and forbid a regression
// to the empty live serving so the glow cannot silently go non-functional again.
assertContains(
  mainSceneSource,
  'deriveBeamLoadContention([...modqnServiceMap.ueById.values()].map(projection => ({',
  'MainScene derives phase-3 contention from the modqnServiceMap cell-schedule assignment (FIX-7 C1)',
);
assertNotContains(
  mainSceneSource,
  'deriveBeamLoadContention(sim.perUePositions',
  'MainScene must not re-wire phase-3 contention to the empty live HandoverManager serving (FIX-7 finding #1)',
);
assertContains(
  mainSceneSource,
  'const focusBeamLoad = beamLoadContentionEnabled',
  'MainScene derives focused UE beam load from the existing contention model',
);
assertContains(
  mainSceneSource,
  "beamLoadContention.byUeId.get(focusedCellBeamConeUe?.id ?? '')",
  'MainScene reuses the existing beamLoadContention by focused UE id',
);
assertContains(
  mainSceneSource,
  '<BeamLoadCylinder',
  'MainScene mounts the focused beam-load cylinder',
);
assertContains(
  mainSceneSource,
  '{showCellOverlay && modqnVisualLayers.handoverStory && showModqnServiceAllocation && (',
  'MainScene gates the focused beam-load cylinder to the explain/debug handover surface',
);
assertContains(
  mainSceneSource,
  'visible={(focusBeamLoad?.load ?? 0) > 0}',
  'MainScene hides the focused beam-load cylinder when the focused UE has no serving-beam load',
);
assertContains(
  beamLoadCylinderSource,
  'visible={false}',
  'BeamLoadCylinder keeps the pooled mesh hidden by default',
);
assertContains(
  beamLoadCylinderSource,
  'mesh.visible = shouldShow',
  'BeamLoadCylinder toggles visibility on the persistent mesh',
);
assertContains(
  beamLoadCylinderSource,
  'mesh.scale.set(1, height, 1)',
  'BeamLoadCylinder encodes beam load by cylinder height',
);
assertNotContains(
  beamLoadCylinderSource,
  'useFrame(',
  'BeamLoadCylinder must not use per-frame work for height updates',
);
assertNotContains(
  beamLoadCylinderSource,
  'new THREE.Mesh',
  'BeamLoadCylinder must not allocate meshes manually',
);
assertNotContains(
  beamLoadCylinderSource,
  '.dispose(',
  'BeamLoadCylinder must not manually dispose pooled objects',
);
assertContains(
  mainSceneSource,
  'import { BeamLoadUploadParticles }',
  'MainScene imports the focused upload-particle layer',
);
// FIX-7 follow-up (audit gap #2, last fake-risk; codex P2): the phase-3 S4 cylinder
// + S5 particles real-render gate reads MESH-derived telemetry the components
// publish from their ACTUAL post-write mesh state, so a broken mesh-write line is
// caught (a model-derived observable would pass while the mesh is broken). Lock the
// component telemetry writes so the render observables cannot be silently dropped.
assertContains(
  beamLoadCylinderSource,
  "gl.domElement.dataset.beamLoadCylinderRendered = mesh.visible ? 'true' : 'false';",
  'BeamLoadCylinder publishes its actual post-toggle mesh.visible as the S4 render observable',
);
assertContains(
  beamLoadUploadParticlesSource,
  'gl.domElement.dataset.uploadParticleRenderedCount = String(renderedCount);',
  'BeamLoadUploadParticles publishes the summed actual InstancedMesh instance count as the S5 render observable',
);
assertContains(
  beamLoadUploadParticlesSource,
  'mesh && mesh.visible ? mesh.count : 0',
  'BeamLoadUploadParticles render observable sums only visible meshes (real instance count)',
);
assertContains(
  handoverStoryLayerSource,
  'gl.domElement.dataset.handoverStoryRenderedMeshCount = String(renderedMeshCount);',
  'HandoverStoryLayer publishes its actual rendered ring/cue mesh count as the render observable (adversarial #4)',
);
assertContains(
  handoverStoryLayerSource,
  '(object as THREE.Mesh).isMesh && object.visible',
  'HandoverStoryLayer render observable counts only visible scene-graph meshes',
);
assertContains(
  mainSceneSource,
  'resolveCellBeamConeItems',
  'MainScene imports the focus cone resolver for upload particles',
);
assertContains(
  mainSceneSource,
  'const uploadParticlesEnabled =',
  'MainScene names the upload-particle gate',
);
assertContains(
  mainSceneSource,
  "modqnVisualLayerPreset === 'explain-handover'",
  'MainScene limits upload particles to the Explain Handover preset',
);
assertContains(
  mainSceneSource,
  '&& modqnVisualLayers.handoverStory',
  'MainScene keeps upload particles behind the handover-story preset layer',
);
assertContains(
  mainSceneSource,
  'resolveCellBeamConeItems({',
  'MainScene resolves focus cones through CellBeamCones authority',
);
assertContains(
  mainSceneSource,
  "beamConeScope: 'focus-satellite'",
  'MainScene forces upload particles to focused beam cones',
);
assertContains(
  mainSceneSource,
  '<BeamLoadUploadParticles',
  'MainScene mounts upload particles only behind the named gate',
);
assertContains(
  mainSceneSource,
  'focusCones={uploadParticleFocusCones}',
  'MainScene passes resolved focus cones to upload particles',
);
assertContains(
  mainSceneSource,
  'beamLoadContention={beamLoadContention}',
  'MainScene reuses the existing beamLoadContention model for upload particles',
);
assertContains(
  mainSceneSource,
  'focusedUe={focusedCellBeamConeUe}',
  'MainScene passes the focused UE to upload particles',
);
assertContains(
  mainSceneSource,
  'paused={paused}',
  'MainScene threads pause state into upload particles',
);
assertContains(
  mainSceneSource,
  'reducedMotion={runtime.reducedMotion}',
  'MainScene threads reduced-motion state into upload particles',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'UPLOAD_PARTICLES_DEFAULT = 96',
  'Upload particle default per-cone density cap is named',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'UPLOAD_PARTICLES_PER_CONE_HARD_CAP = 128',
  'Upload particle hard per-cone cap is named',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'UPLOAD_PARTICLES_GLOBAL_CAP = 256',
  'Upload particle global cap is named',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'MAX_FOCUS_CONES = 2',
  'Upload particle focused-cone cap is named',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'resolveUploadParticleConeCount',
  'Upload particle helpers clamp focus cone count',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'resolveUploadParticleCountForLoad',
  'Upload particle helpers derive capped count from normalized load',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'resolveUploadParticleGlobalCount',
  'Upload particle helpers enforce the global cap',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'resolveUploadParticleEnabledCount',
  'Upload particle helpers expose disabled/paused/reduced-motion gating',
);
assertContains(
  beamLoadUploadParticleHelpersSource,
  'normalizeUploadParticleProgress',
  'Upload particle helpers expose deterministic progress wrapping',
);
assertContains(
  beamLoadUploadParticlesSource,
  "from '../scene/beamLoadContention'",
  'Upload particle layer reads existing beam-load contention types/helpers',
);
assertContains(
  beamLoadUploadParticlesSource,
  'beamLoadContention.byUeId.get(input.focusedUe.id)',
  'Upload particle layer prefers focused UE load from the existing contention model',
);
assertContains(
  beamLoadUploadParticlesSource,
  'beamLoadContention.loadByBeamKey.get',
  'Upload particle layer may fall back to existing beamKey load without rebuilding a model',
);
assertContains(
  beamLoadUploadParticlesSource,
  'Array.from({ length: MAX_FOCUS_CONES }',
  'Upload particle layer predeclares exactly MAX_FOCUS_CONES mesh slots',
);
assertContains(
  beamLoadUploadParticlesSource,
  'UPLOAD_PARTICLES_PER_CONE_HARD_CAP',
  'Upload particle layer sizes each InstancedMesh slot by the hard per-cone cap',
);
assertContains(
  beamLoadUploadParticlesSource,
  'useMemo<ConstructorParameters<typeof THREE.InstancedMesh>>',
  'Upload particle layer memoizes InstancedMesh constructor args',
);
assertContains(
  beamLoadUploadParticlesSource,
  'args={meshArgs}',
  'Upload particle layer reuses memoized mesh args instead of reallocating on plan changes',
);
assertContains(
  beamLoadUploadParticlesSource,
  'mesh.count = plan?.count ?? 0',
  'Upload particle layer toggles active pool count from the plan',
);
assertContains(
  beamLoadUploadParticlesSource,
  'mesh.visible = (plan?.count ?? 0) > 0',
  'Upload particle layer hides unused pool slots via visibility',
);
assertContains(
  beamLoadUploadParticlesSource,
  'mesh.setMatrixAt(input.particleIndex, input.dummy.matrix)',
  'Upload particle useFrame path updates instance matrices',
);
assertContains(
  beamLoadUploadParticlesSource,
  'mesh.instanceMatrix.needsUpdate = true',
  'Upload particle layer marks instance matrices dirty after updates',
);
assertNotContains(
  beamLoadUploadParticlesSource,
  'useState',
  'Upload particle layer must not set React state from frame work',
);
assertNotContains(
  beamLoadUploadParticlesSource,
  'setState',
  'Upload particle layer must not call setState',
);
assertNotContains(
  beamLoadUploadParticlesSource,
  'new THREE.InstancedMesh',
  'Upload particle layer must not manually allocate InstancedMesh objects',
);
// The pooled geometry/material are useMemo-owned and passed to the instanced
// meshes via `args`, so R3F does NOT own/dispose them — the layer MUST release
// them, but ONLY in an unmount cleanup (never per-frame/per-plan). Assert the
// cleanup disposes exist AND that the useFrame body never disposes.
assertContains(
  beamLoadUploadParticlesSource,
  'particleGeometry.dispose()',
  'Upload particle layer releases its pooled geometry on unmount (leak guard)',
);
assertContains(
  beamLoadUploadParticlesSource,
  'particleMaterial.dispose()',
  'Upload particle layer releases its pooled material on unmount (leak guard)',
);
const uploadParticleUseFrameStart = beamLoadUploadParticlesSource.indexOf('useFrame(');
const uploadParticleUseFrameBody = uploadParticleUseFrameStart >= 0
  ? beamLoadUploadParticlesSource.slice(
    uploadParticleUseFrameStart,
    beamLoadUploadParticlesSource.indexOf('});', uploadParticleUseFrameStart),
  )
  : '';
assertNotContains(
  uploadParticleUseFrameBody,
  '.dispose(',
  'Upload particle useFrame path must not dispose pooled objects per frame',
);
assertContains(
  packageJson,
  '"validate:phase-3:upload-particles"',
  'package exposes the Phase 3 upload-particles validator',
);
assertContains(
  sceneTelemetrySource,
  'el.dataset.handoverStoryLayer',
  'MainScene canvas reports handover story layer policy'
);
assertContains(
  sceneTelemetrySource,
  'el.dataset.handoverStoryNextCount',
  'MainScene canvas reports next-slot story telemetry'
);
assertContains(
  sceneTelemetrySource,
  'el.dataset.modqnVisualLayerPreset',
  'MainScene canvas reports MODQN visual layer preset telemetry',
);
assertContains(
  sceneTelemetrySource,
  'el.dataset.cellBeamConeScope',
  'MainScene canvas reports MODQN beam cone scope telemetry',
);
assertContains(
  sceneTelemetrySource,
  'el.dataset.cellBeamConeSatelliteCount',
  'MainScene canvas reports MODQN beam cone satellite count telemetry',
);
assertContains(
  sceneTelemetrySource,
  'el.dataset.modqnServedUeCount',
  'MainScene canvas reports MODQN served UE count telemetry',
);
assertContains(
  sceneTelemetrySource,
  'el.dataset.modqnHandoverCuesVisible',
  'MainScene canvas reports MODQN handover cue visibility telemetry',
);
assertContains(
  modqnHudSource,
  'data-service-allocation-visible',
  'MODQN HUD exposes Service Allocation callout visibility telemetry',
);
assertContains(
  modqnHudSource,
  'data-testid="modqn-service-allocation-summary"',
  'MODQN HUD renders Service Allocation summary only through the Service preset',
);
assertContains(
  modqnHudSource,
  'data-service-active-satellite-count',
  'MODQN HUD exposes active service satellite count telemetry',
);
assertContains(
  cellBeamConesSource,
  'resolveCellBeamConeOpacity',
  'CellBeamCones exposes preset-aware cone opacity for Service Allocation readability',
);
assertContains(
  modqnHudSource,
  "modqnVisualLayerPreset === 'debug'",
  'MODQN HUD gates service diagnostics to Debug preset',
);
assertContains(
  modqnHudSource,
  'data-service-diagnostics-visible',
  'MODQN HUD exposes Debug-only diagnostics visibility telemetry',
);
assertContains(
  modqnHudSource,
  'data-testid="modqn-service-diagnostics"',
  'MODQN HUD renders schedule diagnostics only through the gated Debug block',
);
assertContains(
  modqnHudSource,
  'data-service-claim-kind',
  'MODQN HUD keeps service diagnostic claim kind visible',
);
assertContains(
  modqnHudSource,
  'data-queue-depth-source="source-gap"',
  'MODQN HUD exposes the queue-depth source gap',
);
assertContains(
  modqnHudSource,
  'data-beam-load-shown={beamLoadShown ? \'1\' : \'0\'}',
  'MODQN HUD reports whether the beam-load visual surface is active',
);
assertContains(
  modqnHudSource,
  'Queue/buffer depth: not modeled (full-buffer)',
  'MODQN HUD visibly distinguishes beam load from missing queue depth',
);
assertContains(
  governanceDoc,
  'source=profile-derived-demo',
  'Frontend governance documents the Debug diagnostics source boundary',
);
assertContains(
  laneSdd,
  'profile-derived schedule diagnostics',
  'Lane SDD documents Debug-only schedule diagnostics',
);
assertContains(
  handoverStorySdd,
  'slot duration, next-slot change count',
  'MODQN story SDD documents Debug schedule diagnostic fields',
);
assertContains(
  simStatePublisherSource,
  'modqnCellServiceReadout,',
  'SimState publisher forwards MODQN service readout',
);
assertContains(
  panelStateSource,
  'hasModqnCellServiceReadoutChanged',
  'panel state change detection includes MODQN service readout',
);
assertContains(
  mainSceneSource,
  'replayBackedHandoverStoryVisible',
  'MainScene keeps replay proof handover story telemetry source-backed',
);
assertContains(
  mainSceneSource,
  'function ArtifactSceneContent',
  'MainScene has a dedicated artifact scene composer',
);
assertContains(
  mainSceneSource,
  "sceneFrame?.sceneSource === 'artifact-replay'",
  'MainScene routes artifact frames away from the live scene composer',
);
assertContains(
  mainSceneSource,
  '<ArtifactSceneContent',
  'MainScene mounts the dedicated artifact scene composer',
);
assertContains(
  mainSceneSource,
  'liveSimulationEnabled="0"',
  'Artifact scene telemetry marks live simulation disabled'
);
assertContains(
  mainSceneSource,
  'liveSimulationEnabled="1"',
  'Live scene telemetry marks live simulation enabled'
);
{
  const artifactComposerIndex = mainSceneSource.indexOf('function ArtifactSceneContent');
  const liveHookIndex = mainSceneSource.indexOf('const sim = useSimulation(');
  const liveComposerIndex = mainSceneSource.indexOf('function SceneContent');
  assert.ok(
    artifactComposerIndex >= 0
      && liveHookIndex > liveComposerIndex
      && liveHookIndex > artifactComposerIndex,
    'ArtifactSceneContent must be declared before the live useSimulation hook and must not call it',
  );
  const artifactComposerBody = mainSceneSource.slice(artifactComposerIndex, liveComposerIndex);
  assertNotContains(
    artifactComposerBody,
    'useSimulation(',
    'ArtifactSceneContent must not call the live simulation hook',
  );
  assertNotContains(
    artifactComposerBody,
    'useBeamViz(',
    'ArtifactSceneContent must not call the live beam visual composer',
  );
  assertNotContains(
    artifactComposerBody,
    '<HandoverStoryLayer',
    'ArtifactSceneContent must not mount the profile-derived handover story layer',
  );
}
assertContains(
  sceneLaneRenderPlanSource,
  "input.sceneLane === 'modqn-live-cell-preview' && isLiveScene",
  'Scene lane render plan gates the live cell overlay lane',
);
assertContains(
  sceneLaneRenderPlanSource,
  'const showLiveSceneEffects = showSinrLiveViewport;',
  'Scene lane render plan gates live-only effects to SINR live',
);
assertContains(
  sceneLaneRenderPlanSource,
  "input.sceneLane === 'modqn-replay-proof'",
  'Scene lane render plan models explicit MODQN replay proof lane',
);
// (S0 note: the lane-gating PROPERTY is covered behaviorally by the renderPlan
// matrix; these whitespace-sensitive exact-JSX pins retire with S5.)
for (const [needle, label] of [
  ['{showLiveSceneEffects && <AmbientFootprintRings', 'ambient footprint rings'],
  ['{showLiveSceneEffects && (\\n        <HandoverLinks', 'handover links'],
  ['{showLiveSceneEffects && <IntraHandoverArrow', 'intra handover arrow'],
  ['{showLiveSceneEffects && <IntraGroundShockwave', 'intra ground shockwave'],
  ['{showHandoverToastOverlay && <HandoverToastOverlay', 'handover toast overlay'],
] as const) {
  assertContains(mainSceneSource, needle.replace('\\n', '\n'), `MainScene should source-gate ${label}`);
}

for (const [needle, label] of [
  ['{cinematicSpotlightActive && (\\n        <fogExp2', 'cinematic fog'],
  ['{cinematicSpotlightTargets.map(target => (', 'cinematic point lights'],
] as const) {
  assertContains(baseSceneLayoutSource, needle.replace('\\n', '\n'), `BaseSceneLayout should source-gate ${label}`);
}
assertContains(mainSceneSource, '<ModqnReplaySceneLayer', 'MainScene replay layer host');
assertContains(mainSceneSource, 'showBoard={showReplayProofLayer}', 'MainScene render-plan-gated replay layer');
assertContains(mainSceneSource, "enabled: sceneFrame.sceneSource !== 'artifact-replay'", 'MainScene disables live SimState publisher for artifact replay');
assertContains(readRepoFile('src/scene/useSimStatePublisher.ts'), 'if (!enabled) return;', 'live SimState publisher supports artifact fail-closed disable');
assertContains(
  replayLayerSource,
  'useReplaySceneTelemetry(visualState, showBoard)',
  'Replay telemetry should follow the replay layer gate',
);
assertContains(
  replayTelemetrySource,
  'removeReplayCanvasAttributes(canvas)',
  'Replay telemetry should clear canvas attributes outside proof lane',
);
assertContains(
  replayTelemetrySource,
  'data-handover-story-source-gap',
  'Replay telemetry should report beam-hopping source gaps',
);
assertContains(
  replayTelemetrySource,
  "data-handover-story-layer', 'modqn-replay-source-backed'",
  'Replay telemetry should report source-backed handover story policy',
);
assertContains(
  replayTelemetrySource,
  "data-handover-story-fake-beam-hopping', '0'",
  'Replay telemetry should explicitly reject fake beam hopping',
);
assertContains(
  replayLayerSource,
  'beam hopping schedule: source gap',
  'Replay scene layer should display beam-hopping source gap copy',
);

for (const [source, label] of [
  [governanceDoc, 'frontend render governance doc'],
  [laneSdd, 'frontend mode/lane SDD'],
  [adr, 'scene lane ADR'],
] as const) {
  assertContains(source, 'modqn-live-cell-preview', label);
  assertContains(source, 'modqn-replay-proof', label);
  assertContains(source, 'artifact-replay', label);
}

assertContains(handoverStorySdd, 'Handover Story Model', 'handover story SDD model section');
assertContains(handoverStorySdd, 'modqn-replay-proof', 'handover story SDD replay proof lane');
assertContains(handoverStorySdd, 'source gap', 'handover story SDD source gap policy');
assertContains(handoverStorySdd, 'not baseline proof', 'handover story SDD demo claim boundary');
assertContains(handoverStorySdd, 'suppresses these foreground event arcs', 'handover story SDD records MODQN preview event-arc suppression');
assertContains(governanceDoc, 'without foregrounding them as source-backed', 'governance doc records MODQN preview foreground-event suppression');

assertContains(
  agentsDoc,
  'Frontend Render Governance Rule',
  'AGENTS governance entry',
);
assertContains(
  claudeDoc,
  'Frontend Render Governance Rule',
  'CLAUDE governance entry',
);
assertContains(
  packageJson,
  '"validate:frontend:scene-lane-governance"',
  'package validation script',
);

// ── Lane Experience Switcher: the single in-app entry point for the lane axis ──
// LaneExperienceBar makes sceneSource (and therefore the whole artifact-replay
// lane) reachable in-app for the first time. It must stay a governance Shared
// Surface (no 3D import), mount exactly once lane-owned, and the transition must
// stay governance-safe (cancel armed/active Director focus + tear down stale
// artifact-replay state on leave) so it cannot become a naive setSceneSource.
const laneExperienceBarSource = readRepoFile('src/ui/LaneExperienceBar.tsx');
assertContains(
  appSource,
  "from './ui/LaneExperienceBar'",
  'App imports the top-level LaneExperienceBar',
);
assert.equal(
  countOccurrences(appSource, '<LaneExperienceBar'),
  1,
  'LaneExperienceBar is mounted exactly once',
);
assertContains(
  appSource,
  '<LaneExperienceBar value={sceneLane} onChange={handleExperienceChange} />',
  'LaneExperienceBar is fed the resolved scene lane and the governance-safe transition handler',
);
assertContains(
  appSource,
  'const [sceneSource, setSceneSource] = useState<SceneSourceMode>',
  'App owns a runtime sceneSource state (the lane switch is no longer URL-only)',
);
assertContains(
  appSource,
  'const handleExperienceChange = useCallback((targetLane: SceneLane) => {',
  'App owns the lane experience transition handler',
);
// (S0: the lane-transition PROPERTIES below — focus cancelled, artifact state
// torn down, URL synced — become an S6 behavior test; the slice pins retire.)
tangleLockGroup('QUAR-S6-BUS', () => {
  const handlerIndex = appSource.indexOf('const handleExperienceChange = useCallback');
  assert.ok(handlerIndex >= 0, 'handleExperienceChange exists');
  const handlerSlice = appSource.slice(handlerIndex, handlerIndex + 1400);
  assertContains(
    handlerSlice,
    'cancelPendingLiveFocus();',
    'lane switch cancels an armed/active Director focus (no cross-lane sat-pair leak)',
  );
  assertContains(
    handlerSlice,
    'camera.exitDirectorFocus();',
    'lane switch exits the Director focus FSM',
  );
  assertContains(
    handlerSlice,
    'setShowcaseArtifact(null);',
    'lane switch tears down stale artifact-replay state on leave (FIX-1 cannot show stale provenance)',
  );
  assertContains(
    handlerSlice,
    'syncSceneSourceToUrl(nextSceneSource);',
    'lane switch keeps the URL in sync so the lane stays deep-linkable / reload-stable',
  );
});
assertContains(
  appPersistenceSource,
  'export function syncSceneSourceToUrl(mode: SceneSourceMode): void',
  'appPersistence exposes the display-only URL sync for the runtime lane switch',
);
// ── 4 lanes -> 2 nav segments (modqn-tab-consolidation-plan.md) ──
// The top LaneExperienceBar collapsed from 4 segments to 2 (SINR / MODQN). It
// offers ONLY the two primary lanes; the other two MODQN lanes
// (modqn-replay-proof, artifact-replay) are NOT top tabs anymore — they are
// reachable solely through the in-MODQN ModqnViewToggle sub-nav. This is the
// nav != lane keystone (ADR-002) made literal: a non-injective map from 2 nav
// segments onto 4 SceneLanes. The SceneLane enum itself stays 4 (Rule#4).
for (const lane of [
  'sinr-live',
  'modqn-live-cell-preview',
] as const) {
  assertContains(
    laneExperienceBarSource,
    `lane: '${lane}'`,
    `LaneExperienceBar offers the ${lane} primary segment`,
  );
}
assert.equal(
  countOccurrences(laneExperienceBarSource, "lane: '"),
  2,
  'LaneExperienceBar offers EXACTLY two primary nav segments (4->2 consolidation)',
);
for (const lane of ['modqn-replay-proof', 'artifact-replay'] as const) {
  assertNotContains(
    laneExperienceBarSource,
    `lane: '${lane}'`,
    `LaneExperienceBar must NOT expose the ${lane} lane as a top tab (in-MODQN toggle owns it)`,
  );
}
assertContains(
  laneExperienceBarSource,
  'export function navSegmentForLane(lane: SceneLane): SceneLane {',
  'LaneExperienceBar collapses 4 lanes onto 2 segments via navSegmentForLane (nav != lane)',
);
assertContains(
  laneExperienceBarSource,
  'data-testid="lane-experience-bar"',
  'LaneExperienceBar exposes its root test id',
);
assertNotContains(laneExperienceBarSource, "from 'three", 'LaneExperienceBar must not import three');
assertNotContains(laneExperienceBarSource, 'from "three', 'LaneExperienceBar must not import three');
assertNotContains(laneExperienceBarSource, '@react-three/', 'LaneExperienceBar must not import react-three');
assertNotContains(laneExperienceBarSource, '<Canvas', 'LaneExperienceBar must not mount a Canvas (no 3D viewport layer)');
assertNotContains(laneExperienceBarSource, '../scene/', 'LaneExperienceBar must not import scene runtime modules');
assertNotContains(laneExperienceBarSource, '../viz/', 'LaneExperienceBar must not import viz modules');

// ── In-MODQN ModqnViewToggle sub-nav (owns the 2 non-top MODQN lanes) ──
// The two MODQN lanes the top bar dropped (modqn-replay-proof, artifact-replay)
// are reachable ONLY through this in-MODQN sub-nav, alongside the default
// modqn-live-cell-preview. It reuses App.handleExperienceChange (same
// governance-safe transition as the top bar), is mounted gated to non-SINR
// lanes, and is a Shared Surface (no 3D / scene / viz import).
const modqnViewToggleSource = readRepoFile('src/ui/ModqnViewToggle.tsx');
assertContains(
  appSource,
  "from './ui/ModqnViewToggle'",
  'App imports the in-MODQN ModqnViewToggle sub-nav',
);
assert.equal(
  countOccurrences(appSource, '<ModqnViewToggle'),
  1,
  'ModqnViewToggle is mounted exactly once',
);
assertContains(
  appSource,
  "{sceneLane !== 'sinr-live' && (",
  'ModqnViewToggle sub-nav is mounted gated to MODQN lanes (hidden on the SINR experience)',
);
assertContains(
  appSource,
  'onChange={handleExperienceChange}',
  'ModqnViewToggle reuses the governance-safe handleExperienceChange transition',
);
for (const lane of [
  'modqn-live-cell-preview',
  'modqn-replay-proof',
  'artifact-replay',
] as const) {
  assertContains(
    modqnViewToggleSource,
    `lane: '${lane}'`,
    `ModqnViewToggle offers the ${lane} sub-view (the in-MODQN entry for it)`,
  );
}
assertContains(
  modqnViewToggleSource,
  'data-testid="modqn-view-toggle"',
  'ModqnViewToggle exposes its root test id',
);
assertNotContains(modqnViewToggleSource, "from 'three", 'ModqnViewToggle must not import three');
assertNotContains(modqnViewToggleSource, 'from "three', 'ModqnViewToggle must not import three');
assertNotContains(modqnViewToggleSource, '@react-three/', 'ModqnViewToggle must not import react-three');
assertNotContains(modqnViewToggleSource, '<Canvas', 'ModqnViewToggle must not mount a Canvas (no 3D viewport layer)');
assertNotContains(modqnViewToggleSource, '../scene/', 'ModqnViewToggle must not import scene runtime modules');
assertNotContains(modqnViewToggleSource, '../viz/', 'ModqnViewToggle must not import viz modules');
assertContains(
  governanceDoc,
  'Lane Experience Switcher',
  'governance doc documents the lane experience switcher',
);
assertContains(
  governanceDoc,
  'It cancels any armed-but-unfired or active Director focus',
  'governance doc records the governance-safe Director-focus cancel on lane switch',
);

// ── Showcase exposure S4: ω-objective editor relocated into the Advanced drawer ──
// The MODQN runtime ω-weight editor (ModqnObjectiveTab) is the only EDIT surface
// for the live ω weights. S3 hosted it in a 'Setup' left tab; S4 moved the Setup
// power tools (training / jobs / ω-objective) out of the left rail into the
// opt-in AdvancedSetupDrawer, so the default MODQN left surface is the single
// Evidence / Replay tab. The editor stays mounted (KEEP-ACTIVE) — only relocated.
const modqnObjectiveTabSource = readRepoFile('src/ui/ModqnObjectiveTab.tsx');
const advancedSetupDrawerSource = readRepoFile('src/ui/AdvancedSetupDrawer.tsx');
const jobsPanelSource = readRepoFile('src/ui/modqn-training/JobsPanel.tsx');
assertContains(
  advancedSetupDrawerSource,
  "from './ModqnObjectiveTab'",
  'Advanced drawer imports the ω-weight objective editor',
);
assertContains(
  advancedSetupDrawerSource,
  '<ModqnObjectiveTab />',
  'Advanced drawer mounts the ω-weight objective editor',
);
assertContains(
  appSource,
  "from './ui/AdvancedSetupDrawer'",
  'App imports the Advanced setup drawer (hosts the relocated ω-objective editor + training + jobs)',
);
assertContains(
  modqnObjectiveTabSource,
  'applyOmega',
  'objective tab is the ω EDIT surface (apply)',
);
assertContains(
  modqnObjectiveTabSource,
  'resetOmega',
  'objective tab can reset ω to the bundle weights',
);
assertContains(
  modqnAdvancedDisplayControlsSource,
  'Display and policy',
  'Advanced display controls give the MODQN display/policy group a visible heading',
);
assertNotContains(
  controlBarSource,
  'data-testid="modqn-layer-preset-control"',
  'ControlBar no longer owns the MODQN visual-layer preset control',
);
// Consolidation C1: playback (play/pause + speed) lives ONLY in the bottom
// TimelineBar; the ControlBar must not duplicate it, and the redundant
// in-ControlBar SINR/MODQN handover-mode switch is gone (LaneExperienceBar owns
// the experience axis).
assertNotContains(
  controlBarSource,
  'data-testid="handover-mode-control"',
  'ControlBar no longer duplicates the SINR/MODQN switch (LaneExperienceBar owns it)',
);
assertNotContains(
  controlBarSource,
  'leo-control-bar__play',
  'ControlBar no longer duplicates the play/pause button (TimelineBar owns playback)',
);
assertNotContains(
  controlBarSource,
  'aria-label="Playback speed"',
  'ControlBar no longer duplicates the playback speed control (TimelineBar owns playback speed)',
);
assertContains(
  governanceDoc,
  'ω-weight editor',
  'governance doc records the revived ω-weight editor on the MODQN live lane',
);

// ── Showcase exposure S4: omega-heuristic decision policy + mandatory banner ──
// The omega-heuristic engine path was always live but had no UI entry. It is
// surfaced via a contained MODQN decision-policy toggle in the Advanced drawer
// only on the live-cell preview lane.
// GOVERNANCE: it is "NOT paper MODQN", so App MUST co-mount the disclosure banner
// whenever it is active on the live-cell preview lane, and it must never be
// exposed as a 3rd top-level mode or a replay/artifact policy control.
assertContains(
  modqnAdvancedDisplayControlsSource,
  'data-testid="modqn-decision-policy-control"',
  'Advanced display controls expose the MODQN decision-policy toggle (paper overlay <-> heuristic omega)',
);
assertContains(
  modqnAdvancedDisplayControlsSource,
  'data-testid="modqn-decision-policy-heuristic"',
  'Advanced display controls offer the heuristic omega (NOT paper) decision policy',
);
assertContains(
  modqnAdvancedDisplayControlsSource,
  'showDecisionPolicyControls &&',
  'Advanced display controls gate the live decision-policy toggle behind an explicit prop',
);
assertContains(
  advancedSetupDrawerSource,
  'showDecisionPolicyControls={showDecisionPolicyControls}',
  'Advanced drawer forwards the live decision-policy gate into the display controls',
);
assertContains(
  appSource,
  "showDecisionPolicyControls={sceneLane === 'modqn-live-cell-preview'}",
  'App exposes the MODQN decision-policy toggle only on the live-cell preview lane',
);
assertNotContains(
  controlBarSource,
  'data-testid="modqn-decision-policy-control"',
  'ControlBar no longer owns the MODQN decision-policy toggle',
);
assertNotContains(
  modqnAdvancedDisplayControlsSource,
  "mode: 'omega-heuristic'",
  'omega-heuristic must NOT be a 3rd top-level handover mode option',
);
assertContains(
  appSource,
  "from './ui/HeuristicNotPaperBanner'",
  'App imports the NOT-paper disclosure banner',
);
assertContains(
  appSource,
  "handoverMode === 'omega-heuristic' && sceneLane === 'modqn-live-cell-preview' && <HeuristicNotPaperBanner />",
  'App co-mounts the NOT-paper banner whenever omega-heuristic is active on the live-cell preview lane',
);
assertContains(
  appSource,
  "if (targetLane === 'artifact-replay') {\n      if (handoverMode === 'omega-heuristic')",
  'Artifact lane entry clears an active live-only omega-heuristic policy before returning',
);
assertContains(
  appSource,
  'onModqnDecisionPolicyChange={handleModqnDecisionPolicyChange}',
  'App wires the MODQN decision-policy toggle',
);
assertContains(
  governanceDoc,
  'modqn-decision-policy-control',
  'governance doc documents the MODQN decision-policy toggle',
);
assertContains(
  governanceDoc,
  'never surfaced without its disclosure',
  'governance doc records the mandatory NOT-paper banner co-mount',
);

// ── MODQN tab consolidation S4: degenerate-data honesty banner + Advanced drawer ──
// The MODQN lanes replay a DEGENERATE producer run (see the defects report): 100
// UEs on a single beam, 0 handovers, 1 satellite. Governance (CLAUDE.md Rule#3)
// requires a loud, non-citable disclosure on EVERY MODQN lane. Separately, the
// Setup power tools (training / jobs / ω-objective) move behind an opt-in drawer
// so the default MODQN surface is the evidence/replay story, not a training
// console (north star: 少按鈕 / 直覺 / 零學習).
const degenerateDataBannerSource = readRepoFile('src/ui/DegenerateDataBanner.tsx');
assertContains(
  degenerateDataBannerSource,
  'DEGENERATE_DATA_BANNER_TEXT',
  'Degenerate-data banner exports its pinned disclosure text',
);
assertContains(
  degenerateDataBannerSource,
  'do not cite',
  'Degenerate-data banner disclosure is explicitly non-citable',
);
assertContains(
  appSource,
  "from './ui/DegenerateDataBanner'",
  'App imports the degenerate-data honesty banner',
);
assertContains(
  appSource,
  "sceneLane !== 'sinr-live' && <DegenerateDataBanner />",
  'App mounts the degenerate-data banner on every MODQN lane (never on SINR)',
);
// G3: the Family-B dense-Q banner is the loudest claim-boundary surface for a
// non-paper-faithful, non-citable proof-of-wiring mode. Pin its honesty content
// exactly like the baseline degenerate text so a future edit cannot silently
// strip the disclosure or reintroduce a paper-faithful / beats-baseline / Pareto
// / effectiveness implication. (Adversarial-review finding, 2026-06-13.)
// Capture the constant up to the NEXT `export` (not the first `;`) — the banner
// prose itself contains an inner semicolon, which would truncate a `;`-delimited match.
const familyBBannerMatch = degenerateDataBannerSource.match(/FAMILY_B_DENSE_Q_BANNER_TEXT\s*=([\s\S]*?)export /);
assert.ok(familyBBannerMatch, 'Family-B honesty banner exports FAMILY_B_DENSE_Q_BANNER_TEXT');
const familyBBannerText = familyBBannerMatch[1];
for (const token of ['Grade-2 constrained', 'non-paper-faithful', 'do not cite', 'not a beats-baseline claim']) {
  assertContains(familyBBannerText, token, 'Family-B honesty banner disclosure');
}
for (const forbidden of ['degenerate', 'Pareto', 'effectiveness']) {
  assertNotContains(familyBBannerText, forbidden, 'Family-B honesty banner must not mislabel/overclaim');
}
assert.equal(
  countOccurrences(familyBBannerText, 'beats'),
  countOccurrences(familyBBannerText, 'not a beats-baseline'),
  'Family-B banner: every "beats" is the "not a beats-baseline" disclaimer',
);
assert.equal(
  countOccurrences(familyBBannerText, 'paper-faithful'),
  countOccurrences(familyBBannerText, 'non-paper-faithful'),
  'Family-B banner: every "paper-faithful" is negated as "non-paper-faithful"',
);
assertContains(
  degenerateDataBannerSource,
  'MODQN_FAMILY_B_DENSE_Q_EVIDENCE_STATUS',
  'Family-B honesty banner selects its text by the loaded evidence status (cannot be detached from the loaded bundle)',
);
assertContains(
  appSource,
  '<AdvancedSetupDrawer',
  'App mounts the Advanced setup drawer',
);
assertContains(
  appSource,
  'appMode={appMode}',
  'App passes appMode into the Advanced setup drawer',
);
assertContains(
  appSource,
  'handoverMode={handoverMode}',
  'App passes handoverMode into the Advanced setup drawer',
);
assertContains(
  appSource,
  'modqnVisualLayerPreset={modqnVisualLayerPreset}',
  'App passes the MODQN visual-layer preset into the Advanced setup drawer',
);
assertContains(
  appSource,
  "showDecisionPolicyControls={sceneLane === 'modqn-live-cell-preview'}",
  'App passes the live-cell decision-policy gate into the Advanced setup drawer',
);
assertContains(
  appSource,
  'onModqnVisualLayerPresetChange={setModqnVisualLayerPreset}',
  'App wires the MODQN visual-layer setter into the Advanced setup drawer',
);
assertContains(
  appSource,
  'onModqnDecisionPolicyChange={handleModqnDecisionPolicyChange}',
  'App wires the MODQN decision-policy setter into the Advanced setup drawer',
);
assertContains(
  appSource,
  'onLoadEntry={handleLoadIntoScene}',
  'App wires load-into-scene into the Model Library',
);
assertNotContains(
  appSource,
  'onLoadIntoScene={handleLoadIntoScene}',
  'Advanced drawer no longer owns load-into-scene after D2 Model Library cleanup',
);
assertNotContains(
  advancedSetupDrawerSource,
  'onLoadIntoScene',
  'Advanced drawer does not forward load-into-scene into JobsPanel',
);
assertContains(
  advancedSetupDrawerSource,
  "from './modqn-training/TrainingForm'",
  'Advanced drawer hosts the training form',
);
assertContains(
  advancedSetupDrawerSource,
  "from './modqn-training/JobsPanel'",
  'Advanced drawer hosts the jobs panel',
);
assertNotContains(
  jobsPanelSource,
  'jobs-panel-load-into-scene',
  'JobsPanel no longer renders the old completed-job Load into scene control',
);
// G1-CONTROLBAR-ADV: the trigger + modal scrim + focus management live in the
// shared AdvancedDrawerShell (reused by the SINR-live display drawer). The MODQN
// drawer keeps the `advanced-setup` testid prefix, so the drawer DOM — and the
// modality gate's testids — are byte-identical.
assertContains(
  advancedDrawerShellSource,
  'data-testid={`${testIdPrefix}-trigger`}',
  'Advanced drawer shell exposes the opt-in trigger (testid derived from the lane prefix)',
);
assertContains(
  advancedSetupDrawerSource,
  'testIdPrefix="advanced-setup"',
  'MODQN Advanced drawer keeps the advanced-setup testid prefix (byte-identical DOM)',
);
assertContains(
  sinrLiveDisplayDrawerSource,
  "from './AdvancedDrawerShell'",
  'SINR-live display drawer reuses the shared Advanced drawer shell',
);
assertContains(
  sinrLiveDisplayDrawerSource,
  'testIdPrefix="sinr-live-display"',
  'SINR-live display drawer mounts the shared shell under its own lane prefix',
);
assertContains(
  governanceDoc,
  'Advanced setup drawer',
  'governance doc records the S4 Advanced setup drawer',
);
assertContains(
  governanceDoc,
  'degenerate baseline',
  'governance doc records the S4 degenerate-data honesty banner',
);

// ── Consolidation C5: Dashboard view/route removed — only the 3D scene renders ──
// C3's top-level ViewModeToggle + full-area Dashboard view were removed: the app
// always shows the 3D Scene + sidebars. The ViewModeToggle / AlgorithmDock component
// files stay on disk (retained for the future MODQN data-flow diagram project) but are
// no longer mounted, and the MODQN pipeline flowchart is deferred to that project. The
// per-frame decision metric tiles stay in the artifact-replay sidebar (the
// AlgorithmDashboard content="metrics" block above).
assert.equal(
  countOccurrences(appSource, '<ViewModeToggle'),
  0,
  'App no longer mounts the ViewModeToggle (C5: Dashboard view removed)',
);
assertNotContains(
  appSource,
  "effectiveViewMode === 'dashboard'",
  'App has no dashboard-view branch — the 3D scene is the only view (C5)',
);
assertContains(
  governanceDoc,
  'Dashboard view',
  'governance doc records the dashboard view history (now removed)',
);

// ── Consolidation S0: the behavior-invariant harness is wired and stays wired ──
// The quarantined tangle groups above retire ONLY against these replacement
// gates (scripts/governance-quarantine/tangle-locks.ts) — losing the harness
// from package.json would silently void the retirement contract.
assertContains(packageJson, '"validate:s0:connected-sat-has-beam"', 'package exposes the S0 connected-sat-has-beam invariant gate');
assertContains(packageJson, '"validate:s0:geometry-trace"', 'package exposes the S0 geometry-trace golden gate');
assertContains(packageJson, '"validate:frontend:advanced-drawer-modality:browser"', 'package exposes the drawer modality behavior gate (z-order click-through class)');

assertAndSummarizeTangleLockGroups(line => console.log(line));
console.log('validate:frontend:scene-lane-governance passed');
