#!/usr/bin/env node
// validate-phase-b-loader.tsx
//
// Phase B PR-delta acceptance validator:
//   (a) user-trained manifest fields round-trip through parseModqnManifest
//   (b) producer-official manifests without those fields still parse
//   (c) invalid userTrained type is rejected
//   (d) invalid userTrainingMetadata.jobId type is rejected
//
// Run: node --import tsx/esm scripts/validate-phase-b-loader.tsx

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseModqnManifest } from '../src/modqn/replay-bundle/loader';

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

function assertThrowsContaining(label: string, action: () => void, fragments: readonly string[]): void {
  try {
    action();
    fail(label, 'expected throw');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const missing = fragments.filter(fragment => !message.includes(fragment));
    assert(missing.length === 0, label, `message "${message}" missing ${missing.join(', ')}`);
  }
}

const baseManifest = {
  bundleSchemaVersion: 'phase-03a-replay-bundle-v1',
  paperId: 'PAP-2024-MORL-MULTIBEAM',
  baselineSurface: {
    beamCountPerSatellite: 7,
    totalBeamCount: 28,
    episodesCompleted: 1000,
    satelliteCount: 4,
    userCount: 100,
    methodFamily: 'MODQN',
  },
  claimBoundary: {
    notFullPaperFaithfulReproduction: true,
    not19Or37BeamTrainedEvidence: true,
  },
};

console.log('\n(a) HAPPY PATH - new manifest round-trips 3 fields');
{
  const fixtureJson = fs.readFileSync(
    path.resolve(import.meta.dirname ?? process.cwd(), '../src/modqn/replay-bundle/fixtures/user-trained-stub.json'),
    'utf8',
  );
  const result = parseModqnManifest(fixtureJson);

  assert(result.userTrained === true, 'userTrained round-trips as true');
  assert(result.paperFaithful === false, 'paperFaithful round-trips as false');
  assert(result.userTrainingMetadata !== undefined, 'userTrainingMetadata exists');
  assert(
    result.userTrainingMetadata?.jobId === '01HXY00000000000000000ABCD',
    'userTrainingMetadata.jobId round-trips',
    `got ${result.userTrainingMetadata?.jobId}`,
  );
  assert(
    result.userTrainingMetadata?.trainerSubcommand === 'baseline',
    'userTrainingMetadata.trainerSubcommand round-trips',
    `got ${result.userTrainingMetadata?.trainerSubcommand}`,
  );
  assert(
    result.userTrainingMetadata?.submittedAtMs === 1747000000000,
    'userTrainingMetadata.submittedAtMs round-trips',
    `got ${result.userTrainingMetadata?.submittedAtMs}`,
  );
  assert(
    result.userTrainingMetadata?.serviceVersion === 'modqn-training-service@0.1.0',
    'userTrainingMetadata.serviceVersion round-trips',
    `got ${result.userTrainingMetadata?.serviceVersion}`,
  );
  assert(result.userTrainingMetadata?.hyperparams !== undefined, 'userTrainingMetadata.hyperparams exists');
}

console.log('\n(b) MISSING FIELD PATH - old producer-official manifest still parses');
{
  const result = parseModqnManifest(JSON.stringify(baseManifest));

  assert(result.userTrained === undefined, 'producer manifest userTrained remains undefined');
  assert(result.paperFaithful === undefined, 'producer manifest paperFaithful remains undefined');
  assert(result.userTrainingMetadata === undefined, 'producer manifest userTrainingMetadata remains undefined');
}

console.log('\n(c) INVALID TYPE - wrong type on userTrained throws');
{
  assertThrowsContaining(
    'userTrained string is rejected',
    () => parseModqnManifest(JSON.stringify({ ...baseManifest, userTrained: 'yes' })),
    ['manifest.userTrained', 'boolean'],
  );
}

console.log('\n(d) INVALID TYPE - wrong type on userTrainingMetadata.jobId throws');
{
  assertThrowsContaining(
    'userTrainingMetadata.jobId number is rejected',
    () => parseModqnManifest(JSON.stringify({ ...baseManifest, userTrainingMetadata: { jobId: 42 } })),
    ['manifest.userTrainingMetadata.jobId', 'string'],
  );
}

console.log(`\n[validate-phase-b-loader] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
