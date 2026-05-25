#!/usr/bin/env node
// validate-phase-d-user-trained-bundle-fetch.tsx
//
// PR-iota / D-S1 acceptance validator:
//   (a) user-trained bundle fetch imports runtime-fetch and artifactUrl
//   (b) D-S1 does not import replay-state
//   (c) fetchUserTrainedBundleEnvelope is the only exported async function
//   (d) valid mocked bundle surfaces return a runtime bundle fetch result
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
// (b) Source grep: no replay-state import
// ---------------------------------------------------------------------------
console.log('\n(b) No replay-state import');
{
  assert(
    !moduleSource.includes("../replay-bundle/replay-state")
      && !moduleSource.includes('../replay-bundle/replay-state'),
    'userTrainedBundleFetch does not import replay-state',
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
// (d) Composition: all four surfaces fetched; envelope assembly fail-closes
//
// Per Phase D mini-SDD §10.1: "If the user-trained bundle's shape happens to
// also pass Phase 7C's strict gate (it almost never will), D-S1's output is
// usable today. Otherwise the envelope build inside
// fetchModqnReplayBundleEnvelope will fail-close — that is the correct D-S1
// behavior. D-S2 fixes it." D-S1 proves only composition (URL building +
// surface fetching). End-to-end envelope success belongs to D-S2 (PR-κ).
// ---------------------------------------------------------------------------
console.log('\n(d) Composition: surfaces fetched + envelope fail-closes until D-S2');
{
  const calls: string[] = [];
  let caught: unknown = null;
  await withFetch(
    fixtureFetch(buildValidSevenBeamSurfaces(), calls),
    async () => {
      try {
        await fetchUserTrainedBundleEnvelope({
          config: { baseUrl: 'http://backend.local:8765' },
          jobId: 'job-valid',
          clock: () => 1234,
        });
      } catch (error) {
        caught = error;
      }
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
    caught instanceof Error
      && /sourcePath/i.test(caught.message)
      && caught.message.includes('selected path'),
    'envelope assembly fail-closes on non-Phase-7C sourcePath (D-S2 opens this gate)',
    caught instanceof Error ? caught.message : String(caught),
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
