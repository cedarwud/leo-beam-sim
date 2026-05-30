import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BEAM_HOPPING_TOGGLE_PATH = path.join(REPO_ROOT, 'src/ui/modqn-controls/BeamHoppingToggle.tsx');

function readSource(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

const PASSED: string[] = [];

function pass(label: string): void {
  PASSED.push(label);
}

function expect(condition: boolean, label: string): void {
  assert.ok(condition, label);
  pass(label);
}

function validateSupersededToggleRemoval(): void {
  const phaseHDoc = readSource('docs/phase-h-live-sim-modqn-visual-parity-sdd.md');
  const phaseIS6Validator = readSource('scripts/validate-phase-i-s6-hud-preview-banner.tsx');
  const appSource = readSource('src/App.tsx');
  const runtimeStepSource = readSource('src/scene/runtimeFrameStep.ts');
  const sceneLaneGovernance = readSource('docs/frontend-render-governance.md');

  expect(
    phaseHDoc.includes('§4.4 (beam hopping toggle) SUPERSEDED'),
    'Phase H S4 beam hopping toggle is explicitly superseded',
  );
  expect(
    phaseHDoc.includes('Phase I removes the toggle UI') || phaseIS6Validator.includes('BeamHoppingToggle source removal'),
    'Phase I records BeamHoppingToggle removal',
  );
  expect(!existsSync(BEAM_HOPPING_TOGGLE_PATH), 'BeamHoppingToggle.tsx remains removed');
  expect(!appSource.includes('BeamHoppingToggle'), 'App.tsx does not mount BeamHoppingToggle');
  expect(!appSource.includes('applyBeamHoppingDemoOverride'), 'App.tsx does not apply removed beam-hopping demo override');
  expect(
    runtimeStepSource.includes('beamHopStatesBySatId') && runtimeStepSource.includes('profile.beamHopping'),
    'Simulation truth path still owns beam hopping state',
  );
  expect(
    sceneLaneGovernance.includes('Top-bar controls are also lane-owned'),
    'Frontend governance covers top-bar control ownership instead of restoring the old toggle',
  );
}

validateSupersededToggleRemoval();

assert.ok(PASSED.length >= 7, `expected >= 7 assertions; got ${PASSED.length}`);

console.log(`validate-phase-h-s4-beam-hopping-toggle: PASS (${PASSED.length}/0 assertions)`);
