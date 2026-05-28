#!/usr/bin/env node
// validate-phase-d-app-wire.tsx
//
// PR-lambda / D-S3 acceptance validator:
//   (a) App.tsx imports fetchUserTrainedBundleEnvelope from training-trigger path
//   (b) App.tsx imports fetchModqnReplayBundleEnvelope from replay-bundle barrel
//   (c) App.tsx keeps playback shell/display/validation imports
//   (d) handleLoadIntoScene fetches, validates, atomically swaps, and fail-closes
//   (e) handleRevertToPaperFaithful reuses the Phase 7C fetch and swaps back
//   (f) load-into-scene-error-banner renders only when userTrainedLoadError is set
//   (g) revert-to-paper-faithful renders only for user-trained provenance
//   (h) fetchArtifactManifest is not used by handleLoadIntoScene
//   (i) startup Phase 7C fetch useEffect remains present
//
// Run: node --import tsx/esm scripts/validate-phase-d-app-wire.tsx

import * as fs from 'node:fs';

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

function extractUseCallbackBody(source: string, constName: string): string {
  const marker = `const ${constName} = useCallback`;
  const start = source.indexOf(marker);
  if (start === -1) return '';
  const arrow = source.indexOf('=>', start);
  if (arrow === -1) return '';
  const open = source.indexOf('{', arrow);
  if (open === -1) return '';

  let depth = 0;
  for (let index = open; index < source.length; index++) {
    const char = source[index];
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  return '';
}

function extractBlockBody(source: string, blockStartPattern: RegExp): string {
  const match = blockStartPattern.exec(source);
  if (match === null || match.index === undefined) return '';
  const open = source.indexOf('{', match.index);
  if (open === -1) return '';

  let depth = 0;
  for (let index = open; index < source.length; index++) {
    const char = source[index];
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  return '';
}

function hasMutationBeforeReturn(block: string): boolean {
  const beforeReturn = block.slice(0, block.indexOf('return;'));
  return /setModqnReplayEnvelope|setModqnReplayShellModel|setModqnReplayDisplayState|setSelectedUserTrainedJobId|setBundleProvenanceKind/.test(beforeReturn);
}

const appPath = 'src/App.tsx';
const appSource = fs.readFileSync(appPath, 'utf8');
const trainingEnvAdapterSource = fs.readFileSync('src/app/trainingEnvAxesProfileAdapter.ts', 'utf8');
const replayBundleImport = appSource.match(/import\s*\{[\s\S]*?\}\s*from\s*['"]\.\/modqn\/replay-bundle['"];/)?.[0] ?? '';
const handleLoadIntoSceneBody = extractUseCallbackBody(appSource, 'handleLoadIntoScene');
const handleRevertToPaperFaithfulBody = extractUseCallbackBody(appSource, 'handleRevertToPaperFaithful');
const loadCatchBody = extractBlockBody(handleLoadIntoSceneBody, /catch\s*\(\s*err\s*\)/);
const loadIssueBody = extractBlockBody(handleLoadIntoSceneBody, /if\s*\(\s*issue\s*!==\s*null\s*\)/);

// ---------------------------------------------------------------------------
// (a) Source imports: user-trained envelope fetcher
// ---------------------------------------------------------------------------
console.log('\n(a) User-trained envelope import');
{
  assert(
    appSource.includes("import { fetchUserTrainedBundleEnvelope } from './modqn/training-trigger/userTrainedBundleFetch';"),
    'App.tsx imports fetchUserTrainedBundleEnvelope from training-trigger path',
  );
}

// ---------------------------------------------------------------------------
// (b) Source imports: Phase 7C fetch remains in replay-bundle barrel
// ---------------------------------------------------------------------------
console.log('\n(b) Phase 7C envelope import');
{
  assert(
    replayBundleImport.includes('fetchModqnReplayBundleEnvelope'),
    'App.tsx imports fetchModqnReplayBundleEnvelope from replay-bundle barrel',
  );
}

// ---------------------------------------------------------------------------
// (c) Source imports: playback model/display/validation helpers remain
// ---------------------------------------------------------------------------
console.log('\n(c) Playback helper imports');
{
  assert(
    replayBundleImport.includes('createModqnReplayPlaybackShellModel'),
    'App.tsx imports createModqnReplayPlaybackShellModel',
  );
  assert(
    replayBundleImport.includes('createModqnReplayPlaybackDisplayState'),
    'App.tsx imports createModqnReplayPlaybackDisplayState',
  );
  assert(
    replayBundleImport.includes('getModqnReplayPlaybackModelValidationIssue'),
    'App.tsx imports getModqnReplayPlaybackModelValidationIssue',
  );
}

// ---------------------------------------------------------------------------
// (d) handleLoadIntoScene: fetch, validate, atomic swap, error gating
// ---------------------------------------------------------------------------
console.log('\n(d) handleLoadIntoScene wire');
{
  assert(handleLoadIntoSceneBody.length > 0, 'handleLoadIntoScene body is present');
  assert(
    handleLoadIntoSceneBody.includes('await fetchUserTrainedBundleEnvelope'),
    'handleLoadIntoScene awaits fetchUserTrainedBundleEnvelope',
  );
  assert(
    handleLoadIntoSceneBody.includes('createModqnReplayPlaybackShellModel(result.envelope)'),
    'handleLoadIntoScene builds playback shell from result.envelope',
  );
  assert(
    handleLoadIntoSceneBody.includes('getModqnReplayPlaybackModelValidationIssue(liveShell)'),
    'handleLoadIntoScene validates the playback shell',
  );
  assert(
    handleLoadIntoSceneBody.includes('setModqnReplayEnvelope(result.envelope)'),
    'handleLoadIntoScene sets modqnReplayEnvelope from result.envelope',
  );
  assert(
    handleLoadIntoSceneBody.includes('setModqnReplayShellModel(liveShell)'),
    'handleLoadIntoScene sets modqnReplayShellModel from liveShell',
  );
  assert(
    handleLoadIntoSceneBody.includes('setModqnReplayDisplayState(createModqnReplayPlaybackDisplayState(liveShell))'),
    'handleLoadIntoScene sets display state from liveShell',
  );
  assert(
    handleLoadIntoSceneBody.includes("setBundleProvenanceKind('user-trained')"),
    'handleLoadIntoScene flips provenance to user-trained on success',
  );
  assert(
    handleLoadIntoSceneBody.includes('setUserTrainedLoadError(null)'),
    'handleLoadIntoScene clears userTrainedLoadError on success',
  );
  assert(
    /catch\s*\(\s*err\s*\)\s*\{[\s\S]*setUserTrainedLoadError\(/.test(handleLoadIntoSceneBody),
    'handleLoadIntoScene catch branch sets userTrainedLoadError',
  );
  assert(
    /if\s*\(\s*issue\s*!==\s*null\s*\)\s*\{[\s\S]*setUserTrainedLoadError\(issue\.message\)/.test(handleLoadIntoSceneBody),
    'handleLoadIntoScene validation issue branch sets userTrainedLoadError',
  );
  assert(
    loadCatchBody.includes('return;') && !hasMutationBeforeReturn(loadCatchBody),
    'handleLoadIntoScene catch branch returns before replay/provenance mutation',
  );
  assert(
    loadIssueBody.includes('return;') && !hasMutationBeforeReturn(loadIssueBody),
    'handleLoadIntoScene validation issue branch returns before replay/provenance mutation',
  );
}

// ---------------------------------------------------------------------------
// (e) handleRevertToPaperFaithful: no-arg Phase 7C fetch and state restore
// ---------------------------------------------------------------------------
console.log('\n(e) handleRevertToPaperFaithful wire');
{
  assert(handleRevertToPaperFaithfulBody.length > 0, 'handleRevertToPaperFaithful body is present');
  assert(
    handleRevertToPaperFaithfulBody.includes('await fetchModqnReplayBundleEnvelope()'),
    'handleRevertToPaperFaithful awaits fetchModqnReplayBundleEnvelope() with no args',
  );
  assert(
    handleRevertToPaperFaithfulBody.includes('setModqnReplayEnvelope(result.envelope)'),
    'handleRevertToPaperFaithful sets modqnReplayEnvelope from result.envelope',
  );
  assert(
    handleRevertToPaperFaithfulBody.includes('setModqnReplayShellModel(liveShell)'),
    'handleRevertToPaperFaithful sets modqnReplayShellModel from liveShell',
  );
  assert(
    handleRevertToPaperFaithfulBody.includes('setModqnReplayDisplayState(createModqnReplayPlaybackDisplayState(liveShell))'),
    'handleRevertToPaperFaithful sets display state from liveShell',
  );
  assert(
    handleRevertToPaperFaithfulBody.includes('setSelectedUserTrainedJobId(null)'),
    'handleRevertToPaperFaithful clears selected user-trained job id',
  );
  assert(
    handleRevertToPaperFaithfulBody.includes("setBundleProvenanceKind('paper-faithful')"),
    'handleRevertToPaperFaithful flips provenance to paper-faithful',
  );
  assert(
    handleRevertToPaperFaithfulBody.includes('setUserTrainedLoadError(null)'),
    'handleRevertToPaperFaithful clears userTrainedLoadError on success',
  );
}

// ---------------------------------------------------------------------------
// (f) UI: load-into-scene error banner is conditional on load error
// ---------------------------------------------------------------------------
console.log('\n(f) Load-into-scene error banner');
{
  assert(
    appSource.includes('data-testid="load-into-scene-error-banner"'),
    'load-into-scene-error-banner testid is rendered',
  );
  assert(
    /userTrainedLoadError\s*!==\s*null\s*\?\s*\([\s\S]*data-testid="load-into-scene-error-banner"/.test(appSource),
    'load-into-scene-error-banner is conditional on userTrainedLoadError !== null',
  );
}

// ---------------------------------------------------------------------------
// (g) UI: revert button is conditional on user-trained provenance
// ---------------------------------------------------------------------------
console.log('\n(g) Revert button');
{
  assert(
    appSource.includes('data-testid="revert-to-paper-faithful"'),
    'revert-to-paper-faithful testid is rendered',
  );
  assert(
    /bundleProvenanceKind\s*===\s*'user-trained'\s*\?\s*\([\s\S]*data-testid="revert-to-paper-faithful"/.test(appSource),
    'revert-to-paper-faithful is conditional on bundleProvenanceKind === user-trained',
  );
}

// ---------------------------------------------------------------------------
// (h) Regression: ArtifactManifest is not called by handleLoadIntoScene
// ---------------------------------------------------------------------------
console.log('\n(h) Artifact manifest removal');
{
  assert(
    !/import\s*\{[^}]*fetchArtifactManifest[^}]*\}\s*from\s*['"]\.\/modqn\/training-trigger\/artifactManifest['"]/.test(appSource),
    'App.tsx does not import fetchArtifactManifest',
  );
  assert(
    !handleLoadIntoSceneBody.includes('fetchArtifactManifest'),
    'handleLoadIntoScene does not call fetchArtifactManifest',
  );
}

// ---------------------------------------------------------------------------
// (i) Regression: startup Phase 7C useEffect remains no-arg and sets the triple
// ---------------------------------------------------------------------------
console.log('\n(i) Startup Phase 7C useEffect');
{
  assert(
    /useEffect\(\(\)\s*=>\s*\{[\s\S]*fetchModqnReplayBundleEnvelope\(\)[\s\S]*\.then\(result\s*=>/.test(appSource),
    'startup useEffect still calls fetchModqnReplayBundleEnvelope() with no args',
  );
  assert(
    /fetchModqnReplayBundleEnvelope\(\)[\s\S]*setModqnReplayEnvelope\(result\.envelope\)/.test(appSource),
    'startup useEffect still sets modqnReplayEnvelope',
  );
  assert(
    /fetchModqnReplayBundleEnvelope\(\)[\s\S]*setModqnReplayShellModel\(liveShell\)/.test(appSource),
    'startup useEffect still sets modqnReplayShellModel',
  );
  assert(
    /fetchModqnReplayBundleEnvelope\(\)[\s\S]*setModqnReplayDisplayState\([\s\S]*createModqnReplayPlaybackDisplayState\(liveShell\)[\s\S]*\)/.test(appSource),
    'startup useEffect still sets modqnReplayDisplayState from liveShell when valid',
  );
}

// ---------------------------------------------------------------------------
// (j) Training env truth: nSatellites is total satellite count
// ---------------------------------------------------------------------------
console.log('\n(j) Training env satellite-count truth');
{
  assert(
    trainingEnvAdapterSource.includes('function serviceAreaPassTargetsSecForSatelliteCount'),
    'training env adapter derives display pass targets from total satellite count',
  );
  assert(
    trainingEnvAdapterSource.includes('satsPerPlane: null'),
    'sceneTopologyFromTrainingEnvAxes does not map total nSatellites into satsPerPlane',
  );
  assert(
    trainingEnvAdapterSource.includes('const totalSatellites = Math.max(1, Math.trunc(envAxes.nSatellites))'),
    'applyTrainingEnvAxesToProfile normalizes total satellite count',
  );
  assert(
    trainingEnvAdapterSource.includes('planes: totalSatellites')
      && trainingEnvAdapterSource.includes('satsPerPlane: 1'),
    'applyTrainingEnvAxesToProfile renders total satellite count as planes x one satellite',
  );
  assert(
    !appSource.includes('satsPerPlane: envAxes.nSatellites')
      && !trainingEnvAdapterSource.includes('satsPerPlane: envAxes.nSatellites'),
    'App + training env adapter do not multiply MODQN training satellite count by display planes',
  );
}

console.log(`\n[validate-phase-d-app-wire] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
