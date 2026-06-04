import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEAM_ROLE_TOKENS } from '../src/constants/beamRoleTokens';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

function validateServingOpacityBump(): void {
  const serving = BEAM_ROLE_TOKENS.serving;
  expect(serving.coneOpacity >= 0.55, 'Serving cone opacity bumped to >= 0.55 for live-sim 3D contrast');
  expect(serving.discOpacity >= 0.4, 'Serving disc opacity bumped to >= 0.40 for live-sim 3D contrast');
  expect(
    serving.coneOpacity === 0.58,
    `Serving cone opacity matches H-S7 target 0.58; got ${serving.coneOpacity}`,
  );
  expect(
    serving.discOpacity === 0.42,
    `Serving disc opacity matches H-S7 target 0.42; got ${serving.discOpacity}`,
  );
}

function validateOtherRolesUnchanged(): void {
  expect(BEAM_ROLE_TOKENS.pending.coneOpacity === 0.38, 'Pending cone opacity unchanged');
  expect(BEAM_ROLE_TOKENS.pending.discOpacity === 0.25, 'Pending disc opacity unchanged');
  expect(BEAM_ROLE_TOKENS.approach.coneOpacity === 0.24, 'Approach cone opacity unchanged');
  expect(BEAM_ROLE_TOKENS.approach.discOpacity === 0.16, 'Approach disc opacity unchanged');
  expect(BEAM_ROLE_TOKENS.recentSource.coneOpacity === 0.2, 'RecentSource cone opacity unchanged');
  expect(BEAM_ROLE_TOKENS.otherActive.coneOpacity === 0.12, 'OtherActive cone opacity unchanged');
  expect(BEAM_ROLE_TOKENS.inactive.coneOpacity === 0.055, 'Inactive cone opacity unchanged');
}

function validateFootprintFormulaDocumented(): void {
  const source = readSource('src/scene/beam-geometry-pure.ts');
  expect(
    source.includes('altitudeKm * Math.tan(halfBeamRad)'),
    'Paper beamwidth footprint formula present',
  );
  expect(
    source.includes('§5') && source.includes('modqn-training-truth-visualization-sdd'),
    'Formula cites training-truth SDD §5',
  );
  expect(
    source.includes('780') && source.includes('13.6'),
    'Formula comment shows worked example for paper-faithful 780 km / 2 deg',
  );
}

function validateRoleTokensHeader(): void {
  const source = readSource('src/constants/beamRoleTokens.ts');
  expect(
    source.includes('Phase H §4.7'),
    'BEAM_ROLE_TOKENS comments reference Phase H §4.7',
  );
}

function validateProfileBeamwidthInRange(): void {
  const profileJson = JSON.parse(
    readSource('src/profiles/modqn-4sat-7beam-paper-faithful.json'),
  );
  const beamwidthRad = profileJson.antenna.beamwidth3dBRad;
  expect(
    Math.abs(beamwidthRad - (2 * Math.PI / 180)) < 1e-9,
    'Profile beamwidth is 2 deg in radians per training-truth SDD §3.1',
  );
  const altitudeKm = profileJson.orbit.shells[0].altitudeKm;
  expect(altitudeKm === 780, 'Profile altitude is 780 km per training-truth SDD §3.1');
  const expectedFootprintKm = altitudeKm * Math.tan(beamwidthRad / 2);
  expect(
    Math.abs(expectedFootprintKm - 13.617) < 0.05,
    `Paper-faithful beam footprint radius ~13.62 km; computed ${expectedFootprintKm.toFixed(3)} km`,
  );
}

function validatePhaseHInvariantsPreserved(): void {
  const source = readSource('src/scene/MainScene.tsx');
  const renderPlan = readSource('src/scene/sceneLaneRenderPlan.ts');
  expect(
    renderPlan.includes('const showLiveBeamCones = showSinrLiveViewport;'),
    'H-S1 invariant preserved',
  );
}

validateServingOpacityBump();
validateOtherRolesUnchanged();
validateFootprintFormulaDocumented();
validateRoleTokensHeader();
validateProfileBeamwidthInRange();
validatePhaseHInvariantsPreserved();

assert.ok(PASSED.length >= 18, `expected >= 18 assertions; got ${PASSED.length}`);

console.log(`validate-phase-h-s7-beam-material: PASS (${PASSED.length}/0 assertions)`);
