import assert from 'node:assert/strict';

import { DEFAULT_SIMULATOR_PARAMETERS } from '../../simulator/types';
import { TLE_SOURCE_KIND, parseTleEpoch } from '../index';
import { TleRunWorkerError, TleRunWorkerTransport, type TleRunWorkerPort } from './workerTransport';
import type { TleRunBundle } from './index';
import type { TleRunWorkerMessage } from './workerProtocol';

class FakeWorkerPort implements TleRunWorkerPort {
  readonly posted: Array<{ readonly message: TleRunWorkerMessage; readonly transfer: readonly Transferable[] }> = [];
  private listener: ((event: { readonly data: unknown }) => void) | null = null;

  postMessage(message: TleRunWorkerMessage, transfer: Transferable[] = []): void {
    this.posted.push({ message, transfer });
  }

  addEventListener(_type: 'message', listener: (event: { readonly data: unknown }) => void): void {
    this.listener = listener;
  }

  removeEventListener(_type: 'message', listener: (event: { readonly data: unknown }) => void): void {
    if (this.listener === listener) this.listener = null;
  }

  emit(message: unknown): void {
    this.listener?.({ data: message });
  }
}

const selection = {
  catalog: { archiveId: 'worker-test-archive' },
  snapshot: { sha256: 'e'.repeat(64) },
  manifest: { archiveId: 'worker-test-archive', maxPropagationAgeMs: 1, entries: [] },
} as never;
const input = {
  selection,
  t0Utc: '2026-08-16T00:00:00.000Z',
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
  frameOptions: { userPositionOverridesKm: [] },
};

const port = new FakeWorkerPort();
const transport = new TleRunWorkerTransport(port);
const firstAbort = new AbortController();
const firstProgress: string[] = [];
const first = transport.build(input, {
  signal: firstAbort.signal,
  onProgress: message => firstProgress.push(message.requestId),
});
const firstRequest = port.posted[0]?.message;
assert.equal(firstRequest?.type, 'build');
const firstRequestId = firstRequest?.requestId;
assert.equal(typeof firstRequestId, 'string');
port.emit({
  protocol: 'tle-run-worker-v1',
  type: 'progress',
  requestId: firstRequestId,
  phase: 'geometry',
  progress: {
    status: 'running', completedAnchors: 1, totalAnchors: 241, anchorIndex: 0,
    anchorUtc: input.t0Utc, fraction: 1 / 241, progress: 1 / 241,
  },
});
assert.deepEqual(firstProgress, [firstRequestId]);
firstAbort.abort();
await assert.rejects(first, error => error instanceof TleRunWorkerError && error.code === 'CANCELLED');
assert.equal(port.posted[port.posted.length - 1]?.message.type, 'cancel');

// A late response for an aborted request is ignored and cannot resolve a
// replacement request. This is the transport-side stale publication guard.
port.emit({
  protocol: 'tle-run-worker-v1',
  type: 'error',
  requestId: firstRequestId,
  code: 'WORKER_BUILD_FAILED',
  message: 'late stale error',
  retryable: true,
});
const secondAbort = new AbortController();
const second = transport.build(input, { signal: secondAbort.signal });
const secondRequest = port.posted[port.posted.length - 1]?.message;
assert.equal(secondRequest?.type, 'build');
assert.notEqual(secondRequest?.requestId, firstRequestId);
secondAbort.abort();
await assert.rejects(second, error => error instanceof TleRunWorkerError && error.code === 'CANCELLED');

// Analysis-only dispatch snapshots a live RunBundle without transferring its
// storage.  A deliberately small seam fixture is sufficient here because the
// transport test checks the request boundary; the Worker runtime test covers
// hydration plus the accepted identity envelope with a real archived run.
const liveGeometryRun = {
  runId: 'geometry-worker-transport-test',
  runIdentity: 'geometry-worker-transport-identity',
  archiveId: 'worker-test-archive',
  publicationSha256: 'e'.repeat(64),
  t0Utc: '2026-08-16T00:00:00.000Z',
  durationS: 7_200,
  stepS: 30,
  anchorCount: 241,
  manifest: {
    archiveId: 'worker-test-archive',
    maxPropagationAgeMs: 1,
    entries: [{
      satelliteId: 'WORKER-TEST-1',
      satelliteName: 'WORKER-TEST-1',
      epochUtc: parseTleEpoch('1 44057U 19010A   26015.11930051  .00000099  00000+0  22629-3 0  9996').epochUtc,
      line1: '1 44057U 19010A   26015.11930051  .00000099  00000+0  22629-3 0  9996',
      line2: '2 44057  87.9018 259.2641 0001826  72.2132 287.9198 13.16594815331428',
      sourcePath: 'worker-test.tle',
      sourceKind: TLE_SOURCE_KIND,
    }],
  },
  resolvedSnapshots: [],
  satellites: [{
    satelliteId: 'WORKER-TEST-1',
    satelliteName: 'WORKER-TEST-1',
    sourcePath: 'worker-test.tle',
    sourceKind: TLE_SOURCE_KIND,
    tleEpochUtc: '2026-08-16T00:00:00.000Z',
    catalogNumber: '00001',
  }],
  satelliteCount: 1,
  exclusionProvenance: {
    sourceCount: 0,
    resolvedCount: 0,
    includedCount: 1,
    excludedCount: 0,
    exclusions: [],
  },
  computationMetrics: {
    mode: 'full-reference',
    inputRecords: 0,
    coarseAnchorCount: 0,
    coarseSamples: 0,
    fineCandidateCount: 0,
    fineSamples: 0,
    visibilityScreenSamples: 0,
    visibilityScreenCandidateCount: 0,
    visibilityScreenStepS: null,
    workingSatelliteCount: 0,
    totalSamples: 0,
    reductionRatio: 0,
    coarseStepS: null,
    safetyMarginDeg: null,
    guardWindowS: null,
    wallTimeMs: 0,
  },
  readStateByIndex: () => ({
    positionTemeKm: { x: 1, y: 2, z: 3 },
    velocityTemeKmPerSec: { x: 4, y: 5, z: 6 },
  }),
} as unknown as TleRunBundle;
const livePositionBefore = liveGeometryRun.readStateByIndex(0, 0).positionTemeKm.x;
const analysisOnly = transport.rebuildAnalysis({
  selection,
  geometryRun: liveGeometryRun,
  passPlan: {} as never,
  parameters: DEFAULT_SIMULATOR_PARAMETERS,
  frameOptions: { userPositionOverridesKm: [] },
});
const analysisOnlyRequest = port.posted[port.posted.length - 1]?.message;
assert.equal(analysisOnlyRequest?.type, 'rebuild-analysis');
if (analysisOnlyRequest?.type === 'rebuild-analysis') {
  assert.ok(analysisOnlyRequest.geometryRun.positionsTemeKm.byteLength > 0);
  assert.equal(analysisOnlyRequest.geometryRun.runId, liveGeometryRun.runId);
}
assert.equal(liveGeometryRun.readStateByIndex(0, 0).positionTemeKm.x, livePositionBefore);
const analysisOnlyRequestId = analysisOnlyRequest?.requestId;
assert.equal(typeof analysisOnlyRequestId, 'string');
transport.cancel(analysisOnlyRequestId as string, 'test cleanup');
await assert.rejects(analysisOnly, error => error instanceof TleRunWorkerError && error.code === 'CANCELLED');
transport.dispose();

console.log('TLE Worker transport request/abort/stale guards passed');
