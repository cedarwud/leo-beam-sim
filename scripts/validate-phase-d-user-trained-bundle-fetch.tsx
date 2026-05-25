#!/usr/bin/env node
// validate-phase-d-user-trained-bundle-fetch.tsx
//
// PR-iota / D-S1 acceptance validator:
//   (a) user-trained bundle fetch imports runtime-fetch and artifactUrl
//   (b) user-trained bundle fetch imports only the allowed replay-state mode key
//   (c) fetchUserTrainedBundleEnvelope is the only exported async function
//   (d) valid mocked bundle surfaces return a user-trained runtime bundle fetch result
//   (e) manifest 404 throws ModqnRuntimeBundleFetchError with surface=manifest.json
//   (f) URL base is stripped before runtime-fetch appends relative paths
//   (g) module JSDoc references Phase D mini-SDD §6 + §10.1 and backend SDD §6.4
//
// Run: node --import tsx/esm scripts/validate-phase-d-user-trained-bundle-fetch.tsx

import * as fs from 'node:fs';
import {
  ModqnRuntimeBundleFetchError,
} from '../src/modqn/replay-bundle/runtime-fetch';
import {
  fetchUserTrainedBundleEnvelope,
} from '../src/modqn/training-trigger/userTrainedBundleFetch';

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

function withFetch<T>(stub: typeof fetch, action: () => Promise<T> | T): Promise<T> {
  const original = (globalThis as any).fetch;
  (globalThis as any).fetch = stub;
  return Promise.resolve(action()).finally(() => {
    if (original === undefined) {
      delete (globalThis as any).fetch;
    } else {
      (globalThis as any).fetch = original;
    }
  });
}

function okText(body: string): Response {
  return {
    ok: true,
    status: 200,
    text: async () => body,
  } as Response;
}

function httpText(status: number, body: string): Response {
  return {
    ok: false,
    status,
    text: async () => body,
  } as Response;
}

function beamReference(satIndex: number, localBeamIndex: number) {
  const satId = `sat-${satIndex}`;
  const beamIndex = (satIndex * 7) + localBeamIndex;
  return {
    beamId: `${satId}-beam-${localBeamIndex}`,
    beamIndex,
    satId,
    satIndex,
    localBeamIndex,
    validUnderDecisionMask: true,
    validUnderPostStepMask: true,
  };
}

function beamCatalog() {
  const beams = [];
  for (let satIndex = 0; satIndex < 4; satIndex++) {
    for (let localBeamIndex = 0; localBeamIndex < 7; localBeamIndex++) {
      beams.push(beamReference(satIndex, localBeamIndex));
    }
  }
  return beams;
}

function buildValidSevenBeamSurfaces(): Readonly<Record<string, string>> {
  const beams = beamCatalog();
  const masks = Array.from({ length: beams.length }, () => true);
  const zeros = Array.from({ length: beams.length }, () => 0);
  const satellites = Array.from({ length: 4 }, (_value, satIndex) => ({
    satId: `sat-${satIndex}`,
    satIndex,
  }));
  const rows = [];

  for (let rowIndex = 0; rowIndex < 1000; rowIndex++) {
    const slotIndex = Math.floor(rowIndex / 100) + 1;
    const isIntra = rowIndex < 82;
    const previousServing = beamReference(0, 0);
    const selectedServing = isIntra ? beamReference(0, 1) : previousServing;
    rows.push(JSON.stringify({
      slotIndex,
      timeSec: rowIndex,
      decisionTimeSec: rowIndex,
      userId: `user-${rowIndex % 100}`,
      userIndex: rowIndex % 100,
      userPosition: { xKm: rowIndex, yKm: 0, zKm: 0 },
      decisionUserPosition: { xKm: rowIndex, yKm: 0, zKm: 0 },
      previousServing,
      selectedServing,
      handoverEvent: {
        kind: isIntra ? 'intra-satellite-beam-switch' : 'none',
        eventId: isIntra ? `evt-${rowIndex}` : null,
      },
      beamCatalogOrder: 'satellite-major-beam-minor',
      visibilityMask: masks,
      actionValidityMask: masks,
      decisionVisibilityMask: masks,
      decisionActionValidityMask: masks,
      beamLoads: zeros,
      beamThroughputs: zeros,
      rewardVector: {
        r1Throughput: 0,
        r2Handover: isIntra ? -1 : 0,
        r3LoadBalance: 0,
      },
      scalarReward: isIntra ? -1 : 0,
      satelliteStates: satellites,
      beamStates: beams,
      kpiOverlay: {},
    }));
  }

  return {
    'manifest.json': JSON.stringify({
      bundleSchemaVersion: 'phase-03a-replay-bundle-v1',
      paperId: 'PAP-2024-MORL-MULTIBEAM',
      baselineSurface: {
        satelliteCount: 4,
        beamCountPerSatellite: 7,
        totalBeamCount: 28,
        episodesCompleted: 1,
      },
      claimBoundary: {
        notFullPaperFaithfulReproduction: true,
        not19Or37BeamTrainedEvidence: true,
      },
      beamCatalogOrder: 'satellite-major-beam-minor',
      replaySummary: {
        rowCount: 1000,
        slotCount: 10,
      },
    }),
    'provenance-map.json': JSON.stringify({
      bundleSchemaVersion: 'phase-03a-replay-bundle-v1',
      fields: {},
    }),
    'timeline/step-trace.jsonl': rows.join('\n'),
    'evaluation/summary.json': JSON.stringify({
      bundle_schema_version: 'phase-03a-replay-bundle-v1',
      paper_id: 'PAP-2024-MORL-MULTIBEAM',
    }),
  };
}

function fixtureFetch(
  surfaces: Readonly<Record<string, string>>,
  calls: string[] = [],
): typeof fetch {
  return (async (url: string | URL | Request) => {
    const urlText = String(url);
    calls.push(urlText);
    const matchedSurface = Object.keys(surfaces).find(surface => urlText.endsWith(`/${surface}`));
    if (matchedSurface === undefined) {
      return httpText(404, 'not found');
    }
    return okText(surfaces[matchedSurface]);
  }) as typeof fetch;
}

const modulePath = 'src/modqn/training-trigger/userTrainedBundleFetch.ts';
const moduleSource = fs.readFileSync(modulePath, 'utf8');

// ---------------------------------------------------------------------------
// (a) Source grep: runtime-fetch + artifactUrl imports
// ---------------------------------------------------------------------------
console.log('\n(a) Source imports');
{
  assert(
    moduleSource.includes("} from '../replay-bundle/runtime-fetch';"),
    'userTrainedBundleFetch imports from ../replay-bundle/runtime-fetch',
  );
  assert(
    moduleSource.includes("import { artifactUrl } from './serviceClient';"),
    'userTrainedBundleFetch imports artifactUrl from ./serviceClient',
  );
}

// ---------------------------------------------------------------------------
// (b) Source grep: only the allowed replay-state mode-key import
// ---------------------------------------------------------------------------
console.log('\n(b) Replay-state import boundary');
{
  assert(
    /import\s*\{\s*MODQN_USER_TRAINED_MODE_KEY\s*\}\s*from\s*['"]\.\.\/replay-bundle\/replay-state['"]/.test(moduleSource),
    'userTrainedBundleFetch imports only MODQN_USER_TRAINED_MODE_KEY from replay-state',
  );
  assert(
    !moduleSource.includes('createModqnReplayEnvelope')
      && !moduleSource.includes('ModqnReplayEnvelope')
      && !moduleSource.includes('MODQN_REPLAY_7BEAM_MODE_KEY'),
    'userTrainedBundleFetch does not import forbidden replay-state symbols',
  );
}

// ---------------------------------------------------------------------------
// (c) Source grep: exactly one exported async function
// ---------------------------------------------------------------------------
console.log('\n(c) Exported async function shape');
{
  const exportedAsyncFunctions = moduleSource.match(/export\s+async\s+function\s+\w+/g) ?? [];
  assert(
    exportedAsyncFunctions.length === 1,
    'userTrainedBundleFetch exports exactly one async function',
    exportedAsyncFunctions.join(', '),
  );
  assert(
    exportedAsyncFunctions[0] === 'export async function fetchUserTrainedBundleEnvelope',
    'exported async function is fetchUserTrainedBundleEnvelope',
    exportedAsyncFunctions[0],
  );
}

// ---------------------------------------------------------------------------
// (d) Composition: all four surfaces fetched; envelope assembly succeeds
//
// D-S3 passes the D-S2 user-trained mode key through this wrapper, so the
// synthetic 7-beam user-trained fixture now builds an envelope successfully.
// ---------------------------------------------------------------------------
console.log('\n(d) Composition: surfaces fetched + envelope success under user-trained mode');
{
  const calls: string[] = [];
  let result: Awaited<ReturnType<typeof fetchUserTrainedBundleEnvelope>> | null = null;
  await withFetch(
    fixtureFetch(buildValidSevenBeamSurfaces(), calls),
    async () => {
      result = await fetchUserTrainedBundleEnvelope({
        config: { baseUrl: 'http://backend.local:8765' },
        jobId: 'job-valid',
        clock: () => 1234,
      });
    },
  );
  assert(
    calls.some(u => u.endsWith('/manifest.json')),
    'D-S1 fetches manifest.json',
  );
  assert(
    calls.some(u => u.endsWith('/provenance-map.json')),
    'D-S1 fetches provenance-map.json',
  );
  assert(
    calls.some(u => u.endsWith('/timeline/step-trace.jsonl')),
    'D-S1 fetches timeline/step-trace.jsonl',
  );
  assert(
    calls.some(u => u.endsWith('/evaluation/summary.json')),
    'D-S1 fetches optional evaluation/summary.json',
  );
  assert(
    result?.envelope.modeKey === 'modqn-user-trained',
    'envelope modeKey is modqn-user-trained',
    result?.envelope.modeKey,
  );
  assert(
    result?.envelope.evidenceStatus === 'user-trained',
    'envelope evidenceStatus is user-trained',
    result?.envelope.evidenceStatus,
  );
  assert(
    result?.envelope.diagnostics.adapter.rowCount === 1000,
    'envelope diagnostics rowCount is 1000',
    String(result?.envelope.diagnostics.adapter.rowCount),
  );
  assert(
    result?.envelope.diagnostics.adapter.slotCount === 10,
    'envelope diagnostics slotCount is 10',
    String(result?.envelope.diagnostics.adapter.slotCount),
  );
}

// ---------------------------------------------------------------------------
// (e) Behavioral: manifest 404 throws ModqnRuntimeBundleFetchError
// ---------------------------------------------------------------------------
console.log('\n(e) Manifest 404 error surface');
await withFetch(
  (async (url: string | URL | Request) => {
    const urlText = String(url);
    if (urlText.endsWith('/manifest.json')) return httpText(404, 'missing');
    return fixtureFetch(buildValidSevenBeamSurfaces())(url as any);
  }) as typeof fetch,
  async () => {
    try {
      await fetchUserTrainedBundleEnvelope({
        config: { baseUrl: 'http://backend.local:8765' },
        jobId: 'job-missing-manifest',
      });
      fail('manifest 404 throws ModqnRuntimeBundleFetchError');
    } catch (error) {
      assert(
        error instanceof ModqnRuntimeBundleFetchError,
        'manifest 404 throws ModqnRuntimeBundleFetchError',
        error instanceof Error ? error.name : String(error),
      );
      assert(
        error instanceof ModqnRuntimeBundleFetchError && error.surface === 'manifest.json',
        'manifest 404 error surface is manifest.json',
        error instanceof ModqnRuntimeBundleFetchError ? error.surface : undefined,
      );
    }
  },
);

// ---------------------------------------------------------------------------
// (f) Behavioral: stripped URL base yields exactly <base>/<relative>
// ---------------------------------------------------------------------------
console.log('\n(f) URL base slash handling');
{
  const calls: string[] = [];
  await withFetch(
    fixtureFetch(buildValidSevenBeamSurfaces(), calls),
    async () => {
      try {
        await fetchUserTrainedBundleEnvelope({
          config: { baseUrl: 'http://backend.local:8765/' },
          jobId: 'job-url-base',
        });
      } catch {
        // This section only inspects the delegated fetch URL construction.
      }
    },
  );

  const expectedBase = 'http://backend.local:8765/artifacts/job-url-base';
  assert(
    calls.includes(`${expectedBase}/manifest.json`),
    'manifest URL is <base>/manifest.json',
    calls.join(', '),
  );
  assert(
    calls.includes(`${expectedBase}/provenance-map.json`),
    'provenance URL is <base>/provenance-map.json',
    calls.join(', '),
  );
  assert(
    calls.includes(`${expectedBase}/timeline/step-trace.jsonl`),
    'timeline URL is <base>/timeline/step-trace.jsonl',
    calls.join(', '),
  );
  assert(
    calls.every(url => !url.includes('/job-url-base//')),
    'delegated fetch URLs do not contain a double slash after job id',
    calls.join(', '),
  );
}

// ---------------------------------------------------------------------------
// (g) Source grep: JSDoc references required SDD sections
// ---------------------------------------------------------------------------
console.log('\n(g) JSDoc references');
{
  assert(
    moduleSource.includes('backend SDD §6.4'),
    'JSDoc references backend SDD §6.4',
  );
  assert(
    moduleSource.includes('Phase D training visualization mini-SDD §6 and §10.1'),
    'JSDoc references Phase D mini-SDD §6 and §10.1',
  );
}

console.log(`\n[validate-phase-d-user-trained-bundle-fetch] ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
