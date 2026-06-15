#!/usr/bin/env node
// validate-phase-b-artifact-picker.tsx
//
// PR-theta acceptance validator:
//   (a) fetchArtifactManifest pure parse
//   (b) ArtifactPicker exposes required testids and read-only poll wiring
//   (c) ClaimBoundaryBanner renders user-trained chip only on rendered path
//   (d) ModqnEvidenceTab renders user-trained header chip
//   (e) App.tsx wires picker, load handler, and provenance state
//   (f) Track-2 claim/truth UI uses manifest/run_metadata-derived fields
//   (g) D2 Model Library admits only completed jobs with a loadable manifest
//
// Run: node --import tsx/esm scripts/validate-phase-b-artifact-picker.tsx

import * as fs from 'node:fs';
import { fetchArtifactManifest } from '../src/modqn/training-trigger/artifactManifest';

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

async function assertThrowsWith(label: string, fn: () => Promise<unknown>, needle: string): Promise<void> {
  try {
    await fn();
    fail(label, 'did not throw');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.includes(needle), label, message);
  }
}

function stubFetch(body: unknown, ok = true, status = 200): void {
  globalThis.fetch = (async () => ({
    ok,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

function nextClosingDivIndex(source: string, start: number): number {
  return start < 0 ? -1 : source.indexOf('</div>', start);
}

function countOccurrences(source: string, needle: string): number {
  let count = 0;
  let index = source.indexOf(needle);
  while (index >= 0) {
    count++;
    index = source.indexOf(needle, index + needle.length);
  }
  return count;
}

// ---------------------------------------------------------------------------
// (a) fetchArtifactManifest pure parse
// ---------------------------------------------------------------------------
console.log('\n(a) fetchArtifactManifest pure parse');
{
  const originalFetch = globalThis.fetch;

  stubFetch({
    userTrained: true,
    paperFaithful: false,
    userTrainingMetadata: {
      trainerSubcommand: 'baseline',
      submittedAtMs: 1747,
      serviceVersion: 'v0.1',
    },
  });
  const result = await fetchArtifactManifest({ baseUrl: 'http://test.local' }, 'JID');
  assert(result.userTrained === true, 'fetchArtifactManifest parses userTrained true');
  assert(result.paperFaithful === false, 'fetchArtifactManifest parses paperFaithful false');
  assert(result.trainerSubcommand === 'baseline', 'fetchArtifactManifest parses trainerSubcommand');
  assert(result.submittedAtMs === 1747, 'fetchArtifactManifest parses submittedAtMs');
  assert(result.serviceVersion === 'v0.1', 'fetchArtifactManifest parses serviceVersion');
  assert(result.jobId === 'JID', 'fetchArtifactManifest returns jobId');
  assert(result.raw.userTrained === true, 'fetchArtifactManifest passes through raw manifest');

  stubFetch({});
  const defaulted = await fetchArtifactManifest({ baseUrl: 'http://test.local' }, 'JID2');
  assert(defaulted.userTrained === false, 'fetchArtifactManifest defaults userTrained false');
  assert(defaulted.paperFaithful === true, 'fetchArtifactManifest defaults paperFaithful true');

  stubFetch({}, false, 404);
  await assertThrowsWith(
    'fetchArtifactManifest throws HTTP status on failure',
    () => fetchArtifactManifest({ baseUrl: 'http://test.local' }, 'JID3'),
    'HTTP 404',
  );

  globalThis.fetch = originalFetch;
}

// ---------------------------------------------------------------------------
// (b) source grep: ArtifactPicker testids + chip text
// ---------------------------------------------------------------------------
console.log('\n(b) ArtifactPicker source contract');
{
  const source = fs.readFileSync('src/ui/modqn-training/ArtifactPicker.tsx', 'utf8');
  for (const testId of [
    'data-testid="artifact-picker"',
    'data-testid="artifact-picker-paper-faithful-section"',
    'data-testid="artifact-picker-paper-faithful-entry"',
    'data-testid="artifact-picker-paper-faithful-truth-row"',
    'data-testid="revert-to-paper-faithful"',
    'data-testid="artifact-picker-producer-official-section"',
    'data-testid="artifact-picker-entry"',
    'data-testid="artifact-picker-user-trained-section"',
    'data-testid="artifact-picker-user-trained-chip"',
    'data-testid="artifact-picker-claim-mode-chip"',
    'data-testid="artifact-picker-truth-row"',
    'data-testid="artifact-picker-ablation-arm-card"',
    'data-testid="artifact-picker-ablation-truth"',
    'data-testid="artifact-picker-load"',
    'data-testid="artifact-picker-empty"',
    'data-testid="artifact-picker-producer-empty"',
    'data-testid="artifact-picker-synthetic-section"',
    'data-testid="artifact-picker-synthetic-entry"',
    'data-testid="artifact-picker-synthetic-load"',
  ]) {
    assert(source.includes(testId), `ArtifactPicker includes ${testId}`);
  }
  assert(/>user-trained</.test(source), 'ArtifactPicker chip text is exactly user-trained');
  assert(/>paper-faithful</.test(source), 'ArtifactPicker chip text includes paper-faithful');
  assert(source.includes('data-artifact-kind="paper-faithful"'), 'ArtifactPicker separates paper-faithful baseline entry');
  assert(source.includes('data-artifact-kind="producer-official"'), 'ArtifactPicker separates producer-official section');
  assert(source.includes('data-artifact-kind="synthetic-fixture"'), 'ArtifactPicker separates synthetic fixture entry');
  assert(source.includes('data-loadable="false"'), 'ArtifactPicker marks unavailable/non-proof artifacts as non-loadable');
  assert(source.includes('Not loadable as MODQN proof'), 'ArtifactPicker disables synthetic fallback proof loading');
  assert(source.includes("appMode === 'modqn-demo'"), 'ArtifactPicker gates on modqn-demo');
  assert(source.includes('if (!enabled) return null;'), 'ArtifactPicker component has enabled null return');
  assert(source.includes('if (!enabled) return;'), 'ArtifactPicker useEffect has enabled early return');
  assert(source.includes('getJobs('), 'ArtifactPicker polls getJobs');
  assert(
    !source.includes('readSubmittedJobIds('),
    'D2: ArtifactPicker no longer merges local submitted history into the Model Library',
  );
  assert(source.includes('clearTimeout('), 'ArtifactPicker cleans up poll timeout');
  assert(source.includes('claimModeFromManifest'), 'ArtifactPicker derives visible claimMode from manifest');
  assert(source.includes('paperFaithfulStatusFromManifest'), 'ArtifactPicker renders paperFaithful manifest status');
  assert(source.includes('seedTripletFromSources'), 'ArtifactPicker renders seed triplet truth from manifest/detail');
  assert(source.includes('envAxesFromSources(detailsById[job.jobId], manifestsById[job.jobId])'), 'ArtifactPicker filter options use manifest envAxes as well as job detail');
  assert(source.includes('data-surface="model-library"'), 'ArtifactPicker declares the Model Library surface');
  assert(source.includes('aria-label="MODQN model library"'), 'ArtifactPicker exposes model-library aria label');
}

// ---------------------------------------------------------------------------
// (c) source grep: ClaimBoundaryBanner chip render gated on user-trained
// ---------------------------------------------------------------------------
console.log('\n(c) ClaimBoundaryBanner user-trained chip');
{
  const source = fs.readFileSync('src/ui/ClaimBoundaryBanner.tsx', 'utf8');
  assert(
    source.includes("bundleProvenanceKind?: 'paper-faithful' | 'user-trained'"),
    'ClaimBoundaryBanner exposes bundleProvenanceKind prop',
  );
  assert(
    source.includes('data-testid="claim-boundary-banner-user-trained-chip"'),
    'ClaimBoundaryBanner includes user-trained chip testid',
  );
  assert(/>user-trained</.test(source), 'ClaimBoundaryBanner chip text is exactly user-trained');
  assert(
    source.includes("bundleProvenanceKind === 'user-trained'"),
    'ClaimBoundaryBanner chip is gated on user-trained provenance',
  );

  const renderedIndex = source.indexOf('claim-boundary-banner--rendered');
  const chipIndex = source.indexOf('data-testid="claim-boundary-banner-user-trained-chip"');
  const fallbackIndex = source.indexOf('claim-boundary-banner--fallback');
  const blockedIndex = source.indexOf('claim-boundary-banner--blocked');
  const fallbackClose = nextClosingDivIndex(source, fallbackIndex);
  const blockedClose = nextClosingDivIndex(source, blockedIndex);
  assert(chipIndex > renderedIndex, 'ClaimBoundaryBanner chip appears after rendered branch class');
  assert(
    !(chipIndex > fallbackIndex && chipIndex < fallbackClose),
    'ClaimBoundaryBanner chip does not appear inside fallback branch',
  );
  assert(
    !(chipIndex > blockedIndex && chipIndex < blockedClose),
    'ClaimBoundaryBanner chip does not appear inside blocked branch',
  );
}

// (d) The ModqnEvidenceTab user-trained chip check was retired with the
//     wall-of-text Evidence rail; provenance now lives on the DecisionViz card +
//     the Family-B disclosure line, validated elsewhere.

// ---------------------------------------------------------------------------
// (e) source grep: App.tsx wires picker + provenance state
// ---------------------------------------------------------------------------
console.log('\n(e) App.tsx artifact picker wiring');
{
  const source = fs.readFileSync('src/App.tsx', 'utf8');
  assert(source.includes('import { ArtifactPicker }'), 'App.tsx imports ArtifactPicker');
  assert(source.includes('fetchTrainingServiceManifest'), 'App.tsx imports fetchTrainingServiceManifest');
  assert(source.includes('useState<string | null>(null)'), 'App.tsx tracks selectedUserTrainedJobId');
  assert(
    source.includes("useState<'paper-faithful' | 'user-trained'>('paper-faithful')"),
    'App.tsx tracks bundle provenance state',
  );
  assert(source.includes('handleLoadIntoScene'), 'App.tsx defines handleLoadIntoScene callback');
  assert(source.includes('<ArtifactPicker'), 'App.tsx mounts ArtifactPicker');
  assert(
    source.includes('onLoadEntry={handleLoadIntoScene}'),
    'App.tsx wires Model Library load callback',
  );
  assert(
    source.includes('onLoadPaperFaithful={handleRevertToPaperFaithful}'),
    'App.tsx wires paper-faithful baseline load callback into Model Library',
  );
  assert(
    source.includes('artifactReplaySource={showcaseArtifactSource}'),
    'App.tsx passes artifact source state into the Model Library source separation UI',
  );
  assert(
    countOccurrences(source, 'bundleProvenanceKind={bundleProvenanceKind}') >= 2,
    'App.tsx passes bundleProvenanceKind to banner, Model Library, and evidence tab',
  );
}

// ---------------------------------------------------------------------------
// (f) Track-2 claim/truth display contract
// ---------------------------------------------------------------------------
console.log('\n(f) Track-2 claim/truth display contract');
{
  const source = fs.readFileSync('src/ui/modqn-training/ArtifactPicker.tsx', 'utf8');
  assert(
    source.includes("manifest.claimMode === 'pre-registered-evaluation'"),
    'ArtifactPicker preserves pre-registered-evaluation claimMode label',
  );
  assert(
    source.includes("manifest.claimMode === 'exploration' || manifest.claimMode === undefined"),
    'ArtifactPicker defaults missing manifest claimMode to exploration',
  );
  assert(
    source.includes("manifest.paperFaithful === false ? 'paperFaithful false' : 'paperFaithful unexpected'"),
    'ArtifactPicker makes paperFaithful=false visible and flags unexpected truth',
  );
  assert(
    source.includes('data-claim-mode={claimMode}'),
    'Same-env ablation cards expose claim mode as data attribute',
  );
  assert(
    source.includes('data-replay-status={replayStatusFromManifest(manifest)}'),
    'Same-env ablation cards expose replay presence as data attribute',
  );
  assert(
    source.includes('formatSeedTriplet(seedTriplet)'),
    'ArtifactPicker displays seedTriplet in entry and ablation truth rows',
  );
  assert(
    source.includes('formatObjectiveWeights(objectiveWeights)'),
    'ArtifactPicker displays objective weights before Load into scene',
  );
  assert(
    source.includes('requestModeFromSources(detail, manifest)'),
    'ArtifactPicker displays request mode before Load into scene',
  );
  assert(
    source.includes('checkpointStatusFromManifest(manifest)'),
    'ArtifactPicker displays checkpoint/config status before Load into scene',
  );
}

// ---------------------------------------------------------------------------
// (g) D2 Model Library loadability and lifecycle separation
// ---------------------------------------------------------------------------
console.log('\n(g) D2 Model Library loadability contract');
{
  const source = fs.readFileSync('src/ui/modqn-training/ArtifactPicker.tsx', 'utf8');
  assert(
    source.includes('function isLoadableManifest'),
    'ArtifactPicker centralizes loadability in isLoadableManifest',
  );
  assert(
    source.includes('manifest?.replayBundle?.present === true'),
    'ArtifactPicker requires replayBundle.present=true for loadable models',
  );
  assert(
    source.includes('const loadableJobs = doneJobs.filter(job => isLoadableManifest(manifestsById[job.jobId]))'),
    'ArtifactPicker builds the Model Library only from completed loadable jobs',
  );
  assert(
    !source.includes('const merged =') && !source.includes('historyById'),
    'ArtifactPicker no longer merges non-completed local history into the Model Library',
  );
  assert(
    source.includes('disabled={!isLoadableManifest(manifest)}'),
    'ArtifactPicker disables entry Load unless the manifest is loadable',
  );
  assert(
    source.includes('disabled={job === undefined || !isLoadableManifest(manifest)}'),
    'ArtifactPicker disables ablation Load unless that arm is loadable',
  );
  assert(
    source.includes("return 'replay unknown';"),
    'ArtifactPicker treats missing replayBundle.present as unknown, not yes',
  );
  assert(
    source.includes("disabled={bundleProvenanceKind === 'paper-faithful'}"),
    'ArtifactPicker disables paper-faithful load when baseline is already active',
  );
  assert(
    source.includes("disabled={job === undefined || !isLoadableManifest(manifest)}"),
    'ArtifactPicker disables missing/non-loadable ablation arms',
  );
  assert(
    source.includes('disabled>\n            Not loadable as MODQN proof'),
    'ArtifactPicker keeps synthetic fallback disabled as proof',
  );
}

console.log(`\n[validate-phase-b-artifact-picker] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
