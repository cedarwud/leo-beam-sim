#!/usr/bin/env node

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(path: string): string {
  return readFileSync(join(ROOT_DIR, path), 'utf8');
}

function assertIncludes(source: string, needle: string, label: string): void {
  assert.ok(source.includes(needle), `${label} missing ${needle}`);
}

function assertNotIncludes(source: string, needle: string, label: string): void {
  assert.ok(!source.includes(needle), `${label} unexpectedly includes ${needle}`);
}

console.log('validate-beam-presentation-audit');

const auditPath = 'docs/beam-presentation-calibration-audit.md';
assert.ok(existsSync(join(ROOT_DIR, auditPath)), 'D7 audit document exists');

const audit = read(auditPath);
for (const phrase of [
  'This document is intentionally an audit, not a visual patch.',
  'APP_URL=http://localhost:3001 npm run capture:beam-presentation-audit',
  'SINR tuning beam controls',
  'Beam density / callouts',
  'MODQN visual-layer presets',
  'Live steered beam cones',
  'SINR cell-truth beam cones',
  'MODQN replay scene layer',
  'Training form beam parameters',
  'Beam hopping schedule',
  'Canonical Color Language Proposal',
  'Beam-Hopping Display Contract',
  'Do not widen beams or increase steering angle',
]) {
  assertIncludes(audit, phrase, `audit contract includes ${phrase}`);
}

const renderPlan = read('src/scene/sceneLaneRenderPlan.ts');
assertIncludes(
  renderPlan,
  'const showSinrLiveCellBeams = false;',
  'D7 keeps ambient SINR cell-truth cones parked',
);
assertIncludes(
  renderPlan,
  "input.sceneLane === 'modqn-replay-proof'",
  'MODQN replay proof lane remains explicit',
);
assertIncludes(
  renderPlan,
  "handoverStoryLayerPolicy:\n      showSinrLiveViewport\n        ? 'sinr-live'",
  'handover story ownership remains lane-gated',
);

const replayTelemetry = read('src/scene/modqn-replay-visuals/useReplaySceneTelemetry.tsx');
assertIncludes(
  replayTelemetry,
  "data-handover-story-fake-beam-hopping', '0'",
  'MODQN replay telemetry keeps fake beam hopping disabled',
);

const sourceGaps = read('src/modqn/replay-source-gaps/sourceGaps.ts');
assertIncludes(sourceGaps, 'beamHopping.activeSchedule', 'active schedule source gap is registered');
assertIncludes(sourceGaps, 'beamHopping.nextSchedule', 'next schedule source gap is registered');
for (const forbidden of [
  "requiredProducerField: 'selectedServing",
  "requiredProducerField: 'previousServing",
  "requiredProducerField: 'decisionActionValidityMask",
  "requiredProducerField: 'actionValidityMask",
]) {
  assertNotIncludes(sourceGaps, forbidden, 'beam hopping source gaps do not use serving/mask aliases');
}

const advancedControls = read('src/ui/modqn-controls/ModqnAdvancedDisplayControls.tsx');
assertIncludes(
  advancedControls,
  'Optional display controls. Producer replay and artifact truth stay unchanged.',
  'MODQN Advanced display controls carry truth-boundary copy',
);
assertIncludes(
  advancedControls,
  'data-testid="modqn-layer-preset-control"',
  'MODQN visual-layer presets remain in Advanced',
);

const controlBar = read('src/ui/ControlBar.tsx');
assertIncludes(
  controlBar,
  "const showSinrLiveControls = sceneLane === 'sinr-live';",
  'beam density and callout controls stay SINR-live scoped',
);
assertIncludes(
  controlBar,
  'data-testid="beam-density-control"',
  'beam density control is inventoried',
);
assertIncludes(
  controlBar,
  'data-testid="beam-info-toggle"',
  'beam callout control is inventoried',
);

const beamTokens = read('src/constants/beamRoleTokens.ts');
assertIncludes(beamTokens, 'BEAM_FREQUENCY_COLORS', 'frequency reuse color palette exists');
assertIncludes(beamTokens, 'SATELLITE_TINT_PALETTE', 'satellite identity tint palette exists');
assertIncludes(beamTokens, 'BEAM_ROLE_TOKENS', 'beam role token source exists');

const captureScript = read('scripts/capture-beam-presentation-audit.ts');
assertIncludes(captureScript, 'http://localhost:3001', 'D7 capture defaults to existing port 3001');
assertIncludes(captureScript, "'output'", 'D7 capture writes under ignored output folder');
assertIncludes(captureScript, "'beam-presentation-audit'", 'D7 capture writes beam-presentation audit folder');
assertIncludes(captureScript, "'2026-06-10'", 'D7 capture writes dated D7 audit folder');
assertIncludes(captureScript, 'data-testid="modqn-replay-cinema-readiness"', 'D7 capture records D6 replay readiness');
assertNotIncludes(captureScript, 'npm run dev', 'D7 capture must not start a dev server');

console.log('PASS: D7 beam presentation audit guardrails are documented and validator-backed');
