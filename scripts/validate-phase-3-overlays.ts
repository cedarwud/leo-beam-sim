#!/usr/bin/env node
// validate-phase-3-overlays.ts
//
// Phase 3 consolidation gate (Master SDD v2 §4/§6/§8). The three Phase 3
// beam-load overlays — the instanced contention GLOW (S3), the 3D beam-load
// CYLINDER (S4), and the upload PARTICLES (S5) — must:
//   (a) be CELL-LANE-ONLY: they render solely on the modqn-live-cell-preview
//       lane (gated on showCellOverlay), and are INERT on sinr-live,
//       modqn-replay-proof, and artifact-replay (replay/proof lanes must not
//       mount these live overlays);
//   (b) keep the §8 perf gates wired: the secondary-UE CPU throttle and the
//       upload-particle caps exist as named constants;
//   (c) be backed by their per-aspect validators, all chained by validate:phase-3.
//
// CPU-frame-time + particle-cap behavior are asserted by validate:phase-3:cpu-budget
// and validate:phase-3:upload-particles; this gate asserts the lane-clean wiring
// + that those gates exist and are aggregated.
//
// Run: node --import tsx/esm scripts/validate-phase-3-overlays.ts

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSceneLaneRenderPlan } from '../src/scene/sceneLaneRenderPlan.ts';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string): string => readFileSync(join(ROOT_DIR, p), 'utf8');

let passed = 0;
function ok(condition: boolean, label: string): void {
  assert.ok(condition, label);
  passed += 1;
  console.log(`  [PASS] ${label}`);
}

function renderPlan(
  sceneLane: Parameters<typeof resolveSceneLaneRenderPlan>[0]['sceneLane'],
  sceneSource: Parameters<typeof resolveSceneLaneRenderPlan>[0]['sceneSource'],
  modqnServiceAllocationEnabled = false,
): ReturnType<typeof resolveSceneLaneRenderPlan> {
  return resolveSceneLaneRenderPlan({
    sceneLane,
    sceneSource,
    beamCalloutsEnabled: true,
    beamDensity: 'all',
    cinematicMode: 'spotlight',
    effectsEnabled: { servingRipple: true, pendingRipple: true, orbitTrail: true, spineParticles: true },
    paused: false,
    reducedMotion: false,
    recentHoActive: false,
    modqnServiceAllocationEnabled,
  });
}

const mainScene = read('src/scene/MainScene.tsx');
const runtimeFrameStep = read('src/scene/runtimeFrameStep.ts');
const uploadParticles = read('src/viz/beamLoadUploadParticles.ts');
const packageJson = read('package.json');

console.log('\n(a) cell-lane-only / replay-clean (RUNTIME render plan)');
// showCellOverlay is the single gate every Phase 3 overlay rides; it is true
// ONLY on the live modqn-live-cell-preview lane.
ok(renderPlan('modqn-live-cell-preview', 'live-sim').showCellOverlay === true,
  'cell-preview (live) owns showCellOverlay — the Phase 3 overlay surface');
ok(renderPlan('sinr-live', 'live-sim').showCellOverlay === false,
  'sinr-live does NOT mount Phase 3 cell overlays');
ok(renderPlan('modqn-replay-proof', 'artifact-replay').showCellOverlay === false,
  'modqn-replay-proof (recorded artifact stage) does NOT mount Phase 3 cell overlays');
ok(renderPlan('artifact-replay', 'artifact-replay').showCellOverlay === false,
  'artifact-replay does NOT mount Phase 3 cell overlays');

console.log('\n(b) overlay mounts gated cell-lane-only + parked behind the producer gate (SOURCE)');
// S-FLAG-2: the Phase 3 overlay family (contention glow + cylinder + particles) is
// now PARKED behind the `showModqnServiceAllocation` producer-readiness gate
// (default OFF) on top of the cell-lane `showCellOverlay` gate. It stays cell-lane
// only AND off the default surface until the producer baseline is non-degenerate.
ok(renderPlan('modqn-live-cell-preview', 'live-sim').showModqnServiceAllocation === false,
  'cell-preview parks the service-allocation overlay family OFF by default (degenerate producer baseline)');
ok(renderPlan('modqn-live-cell-preview', 'live-sim', true).showModqnServiceAllocation === true,
  'cell-preview un-parks the overlay family when producer-readiness is enabled');
ok(renderPlan('sinr-live', 'live-sim', true).showModqnServiceAllocation === false,
  'enabling the producer gate cannot leak the overlay family onto sinr-live');
ok(mainScene.includes('const beamLoadContentionEnabled = showModqnServiceAllocation && modqnVisualLayers.serviceMap;'),
  'contention glow is gated showModqnServiceAllocation && serviceMap (S3 + S-FLAG-2)');
// cylinder mounts inside the explain-handover block, now also behind the producer gate
const cylinderGate = mainScene.indexOf('{showCellOverlay && modqnVisualLayers.handoverStory && showModqnServiceAllocation && (');
ok(cylinderGate >= 0 && mainScene.includes('<BeamLoadCylinder'),
  'beam-load cylinder mounts under explain-handover + producer gate (showCellOverlay && handoverStory && showModqnServiceAllocation) (S4 + S-FLAG-2)');
// particles gated via uploadParticlesEnabled = showCellOverlay && showModqnServiceAllocation && ... handoverStory
const upStart = mainScene.indexOf('const uploadParticlesEnabled =');
const upGate = upStart >= 0 ? mainScene.slice(upStart, upStart + 220) : '';
ok(upGate.includes('showCellOverlay')
  && upGate.includes('showModqnServiceAllocation')
  && upGate.includes('modqnVisualLayers.handoverStory'),
  'upload particles gated showCellOverlay && showModqnServiceAllocation && handoverStory (S5 + S-FLAG-2)');
ok(mainScene.includes('<BeamLoadUploadParticles'), 'upload particle layer is mounted');

console.log('\n(c) §8 perf gates wired (constants present)');
ok(runtimeFrameStep.includes('export const SECONDARY_UE_RECOMPUTE_HZ = 12;'),
  'secondary-UE CPU throttle constant present (S1 §8 CPU gate)');
ok(uploadParticles.includes('UPLOAD_PARTICLES_PER_CONE_HARD_CAP = 128'),
  'upload particle per-cone hard cap = 128 (§8)');
ok(uploadParticles.includes('UPLOAD_PARTICLES_GLOBAL_CAP = 256'),
  'upload particle global cap = 256 (§8)');
ok(uploadParticles.includes('MAX_FOCUS_CONES = 2'),
  'active focused cones capped at 2 (§8)');

console.log('\n(d) per-aspect validators exist + aggregated');
for (const v of ['validate:phase-3:cpu-budget', 'validate:phase-3:beam-load', 'validate:phase-3:upload-particles', 'validate:phase-3:overlays']) {
  ok(packageJson.includes(`"${v}"`), `package exposes ${v}`);
}
const aggregateStart = packageJson.indexOf('"validate:phase-3":');
const aggregate = aggregateStart >= 0 ? packageJson.slice(aggregateStart, aggregateStart + 360) : '';
ok(
  aggregate.includes('validate:phase-3:cpu-budget')
  && aggregate.includes('validate:phase-3:beam-load')
  && aggregate.includes('validate:phase-3:upload-particles')
  && aggregate.includes('validate:phase-3:overlays'),
  'validate:phase-3 aggregate chains all four Phase 3 validators',
);

console.log(`\nPhase 3 overlays validator: ${passed} passed, 0 failed`);
