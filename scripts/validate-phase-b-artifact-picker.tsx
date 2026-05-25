#!/usr/bin/env node
// validate-phase-b-artifact-picker.tsx
//
// PR-theta acceptance validator:
//   (a) fetchArtifactManifest pure parse
//   (b) ArtifactPicker exposes required testids and read-only poll wiring
//   (c) ClaimBoundaryBanner renders user-trained chip only on rendered path
//   (d) ModqnEvidenceTab renders user-trained header chip
//   (e) App.tsx wires picker, load handler, and provenance state
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
    'data-testid="artifact-picker-entry"',
    'data-testid="artifact-picker-user-trained-chip"',
    'data-testid="artifact-picker-load"',
    'data-testid="artifact-picker-empty"',
    'data-testid="artifact-picker-producer-empty"',
  ]) {
    assert(source.includes(testId), `ArtifactPicker includes ${testId}`);
  }
  assert(/>user-trained</.test(source), 'ArtifactPicker chip text is exactly user-trained');
  assert(source.includes("appMode === 'modqn-demo'"), 'ArtifactPicker gates on modqn-demo');
  assert(source.includes('if (!enabled) return null;'), 'ArtifactPicker component has enabled null return');
  assert(source.includes('if (!enabled) return;'), 'ArtifactPicker useEffect has enabled early return');
  assert(source.includes('getJobs('), 'ArtifactPicker polls getJobs');
  assert(source.includes('readSubmittedJobIds('), 'ArtifactPicker reads submitted job history');
  assert(source.includes('clearTimeout('), 'ArtifactPicker cleans up poll timeout');
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

// ---------------------------------------------------------------------------
// (d) source grep: ModqnEvidenceTab chip render
// ---------------------------------------------------------------------------
console.log('\n(d) ModqnEvidenceTab user-trained chip');
{
  const source = fs.readFileSync('src/ui/ModqnEvidenceTab.tsx', 'utf8');
  assert(
    source.includes("bundleProvenanceKind?: 'paper-faithful' | 'user-trained'"),
    'ModqnEvidenceTab exposes bundleProvenanceKind prop',
  );
  assert(
    source.includes('data-testid="modqn-evidence-user-trained-chip"'),
    'ModqnEvidenceTab includes user-trained chip testid',
  );
  assert(/>user-trained</.test(source), 'ModqnEvidenceTab chip text is exactly user-trained');
  assert(
    source.includes("bundleProvenanceKind === 'user-trained'"),
    'ModqnEvidenceTab chip is gated on user-trained provenance',
  );
}

// ---------------------------------------------------------------------------
// (e) source grep: App.tsx wires picker + provenance state
// ---------------------------------------------------------------------------
console.log('\n(e) App.tsx artifact picker wiring');
{
  const source = fs.readFileSync('src/App.tsx', 'utf8');
  assert(source.includes('import { ArtifactPicker }'), 'App.tsx imports ArtifactPicker');
  assert(source.includes('import { fetchArtifactManifest }'), 'App.tsx imports fetchArtifactManifest');
  assert(source.includes('useState<string | null>(null)'), 'App.tsx tracks selectedUserTrainedJobId');
  assert(
    source.includes("useState<'paper-faithful' | 'user-trained'>('paper-faithful')"),
    'App.tsx tracks bundle provenance state',
  );
  assert(source.includes('handleLoadIntoScene'), 'App.tsx defines handleLoadIntoScene callback');
  assert(source.includes('<ArtifactPicker'), 'App.tsx mounts ArtifactPicker');
  assert(
    source.includes('onLoadIntoScene={handleLoadIntoScene}'),
    'App.tsx wires JobsPanel load callback',
  );
  assert(
    countOccurrences(source, 'bundleProvenanceKind={bundleProvenanceKind}') >= 2,
    'App.tsx passes bundleProvenanceKind to banner and evidence tab',
  );
}

console.log(`\n[validate-phase-b-artifact-picker] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
