import assert from 'node:assert/strict';

import {
  decodeRunPayloadMessage,
  encodeRunPayloadMessage,
  installRunPayloadWorker,
  RUN_PAYLOAD_MESSAGE_TYPES,
  RUN_PAYLOAD_PROTOCOL_SCHEMA,
  roundTripRunPayloadMessage,
  RunPayloadCodecError,
  RunPayloadWorkerTransport,
  createRunPayloadWorkerRuntime,
  type RunPayloadBootstrapManifest,
  type RunPayloadChunkEnvelope,
  type RunPayloadMessage,
  type RunPayloadRequestMessage,
  type RunPayloadResponseMessage,
  type RunPayloadWorkerBuildResult,
  type RunPayloadWorkerMessageEvent,
  type RunPayloadWorkerPort,
  type SelectableRunRequest,
} from './index';

const request: SelectableRunRequest = {
  archiveId: 'starlink',
  requestedT0Utc: '2026-08-12T12:00:00.000Z',
  observer: {
    id: 'ntpu-wgs84-v1',
    coordinates: { latitudeDeg: 24.9441667, longitudeDeg: 121.3713889, altitudeM: 50 },
  },
  geometry: {
    durationS: 7_200,
    stepS: 30,
    anchorCount: 241,
    coarseStepS: 120,
    chunkDurationS: 600,
    endpointPaddingS: 120,
    horizonElevationDeg: 0,
    coarseGuardElevationDeg: -20,
  },
  analysis: {
    canonicalScenarioRevision: 'family-b-thesis-3.13-3.17-v1',
    parametersSha256: 'f'.repeat(64),
    formulaVersion: 'angle-aware-ee-v3',
    linkShapeVersion: 'canonical-link-shape-v1',
  },
};

const identity = {
  runKey: `selectable-tle-run:${'a'.repeat(64)}`,
  passIndexKey: `tle-pass-index:${'b'.repeat(64)}`,
  geometryRunId: 'geometry-run-test-v1',
  analysisRunId: 'analysis-run-test-v1',
  sourceSnapshotDigest: 'd'.repeat(64),
} as const;

const bootstrapManifest: RunPayloadBootstrapManifest = {
  schema: 'selectable-tle-artifact-envelope-v1',
  status: 'bootstrap',
  runKey: identity.runKey,
  passIndexKey: identity.passIndexKey,
  geometryRunId: identity.geometryRunId,
  source: {
    archiveId: request.archiveId,
    publicationSha256: 'e'.repeat(64),
    sourceSnapshotDigest: identity.sourceSnapshotDigest,
    snapshotKey: 'tle-snapshot/starlink/20260812',
    snapshotSha256: '1'.repeat(64),
    requestedT0Utc: request.requestedT0Utc,
    appliedT0Utc: request.requestedT0Utc,
  },
  geometry: {
    ...request.geometry,
    observerId: request.observer.id,
    observerCoordinates: request.observer.coordinates,
    visibilityPolicyRevision: 'horizon-v1',
    coarseIndexRevision: 'proof-envelope-v1',
    exactSgp4Revision: 'satellite-js-6.0.2',
  },
  analysis: {
    ...request.analysis,
    analysisRunId: identity.analysisRunId,
  },
  chunks: {
    bootstrapFrame: {
      kind: 'bootstrap-frame',
      schema: 'bootstrap-frame-v1',
      contentSha256: 'c'.repeat(64),
      byteLength: 20,
      immutableKey: 'sha256/bootstrap-frame-v1',
    },
  },
};

const chunk: RunPayloadChunkEnvelope = {
  kind: 'bootstrap-frame',
  schema: 'bootstrap-frame-v1',
  contentSha256: 'c'.repeat(64),
  byteLength: 20,
  immutableKey: 'sha256/bootstrap-frame-v1',
  runKey: identity.runKey,
  passIndexKey: identity.passIndexKey,
  sourceSnapshotDigest: identity.sourceSnapshotDigest,
  geometryRunId: identity.geometryRunId,
  analysisRunId: identity.analysisRunId,
  recordCount: 1,
  payload: { frame: 0, instantUtc: request.requestedT0Utc },
};

function buildResult(requestInput: SelectableRunRequest): RunPayloadWorkerBuildResult {
  const manifest = {
    ...bootstrapManifest,
    source: {
      ...bootstrapManifest.source,
      requestedT0Utc: requestInput.requestedT0Utc,
      appliedT0Utc: requestInput.requestedT0Utc,
    },
  };
  return {
    plan: {
      protocol: RUN_PAYLOAD_PROTOCOL_SCHEMA,
      request: requestInput,
      identity,
      manifest,
    },
    bootstrap: {
      manifest,
      bootstrapFrame: chunk,
      sourceKind: 'ARCHIVED_TLE',
      propagationModel: 'SGP4',
      frameId: 'analysis-bootstrap-frame-v1',
      instantUtc: requestInput.requestedT0Utc,
      frame: { frameId: 'analysis-bootstrap-frame-v1', instantUtc: requestInput.requestedT0Utc },
    },
    accepted: {
      manifest: { ...manifest, status: 'accepted' },
      acceptedAnchorCount: 241,
      acceptedIntervalCount: 240,
      timeline: {
        runKey: identity.runKey,
        passIndexKey: identity.passIndexKey,
        geometryRunId: identity.geometryRunId,
        analysisRunId: identity.analysisRunId,
        sourceKind: 'ARCHIVED_TLE',
        propagationModel: 'SGP4',
        durationS: 7_200,
        stepS: 30,
        anchorCount: 241,
        anchors: [],
        anchorSelections: [],
        handoverTrace: { anchors: [] },
        evaluation: { sampleCount: 240 },
        visibleGeometryFallbackAnchorCount: 0,
      },
    },
  };
}

const requestMessage = (requestId: string): RunPayloadRequestMessage => ({
  protocol: RUN_PAYLOAD_PROTOCOL_SCHEMA,
  type: RUN_PAYLOAD_MESSAGE_TYPES.request,
  requestId,
  request,
});

async function settle(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>(resolve => setTimeout(resolve, 0));
}

// The codec accepts both JSON strings and structured-clone objects and rejects
// functions/non-finite values before they reach a Worker boundary.
const progress: RunPayloadMessage = {
  protocol: RUN_PAYLOAD_PROTOCOL_SCHEMA,
  type: RUN_PAYLOAD_MESSAGE_TYPES.progress,
  requestId: 'codec-1',
  phase: 'exact-confirming',
  completedUnits: 2,
  totalUnits: 3,
  identity,
};
assert.deepEqual(roundTripRunPayloadMessage(progress), progress);
assert.deepEqual(
  decodeRunPayloadMessage(encodeRunPayloadMessage(progress)),
  progress,
);
assert.throws(
  () => encodeRunPayloadMessage({ ...progress, completedUnits: Number.NaN } as RunPayloadMessage),
  RunPayloadCodecError,
);
assert.throws(
  () => decodeRunPayloadMessage({ ...progress, protocol: 'wrong-v1' }),
  /protocol schema mismatch/,
);

// A tiny injected dense builder proves ordering without propagating a real TLE.
const events: RunPayloadResponseMessage[] = [];
const runtime = createRunPayloadWorkerRuntime(
  async (requestInput, context) => {
    context.reportProgress({ phase: 'exact-confirming', completedUnits: 1, totalUnits: 1 });
    assert.equal(context.signal.aborted, false);
    return buildResult(requestInput);
  },
  event => events.push(event),
);
runtime.handle(requestMessage('success-1'));
await settle();
assert.deepEqual(events.map(event => event.type), [
  RUN_PAYLOAD_MESSAGE_TYPES.progress,
  RUN_PAYLOAD_MESSAGE_TYPES.bootstrap,
  RUN_PAYLOAD_MESSAGE_TYPES.accepted,
]);
assert.ok(events.every(event => event.requestId === 'success-1'));
runtime.dispose();

// A newer request aborts the previous producer and prevents stale publication.
const staleEvents: RunPayloadResponseMessage[] = [];
const gates = new Map<string, () => void>();
const staleRuntime = createRunPayloadWorkerRuntime(
  async (requestInput, context) => {
    await new Promise<void>((resolve, reject) => {
      gates.set(requestInput.requestedT0Utc, resolve);
      context.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
    return buildResult(requestInput);
  },
  event => staleEvents.push(event),
);
const first = { ...request, requestedT0Utc: '2026-08-12T12:00:00.000Z' };
const second = { ...request, requestedT0Utc: '2026-08-12T12:00:30.000Z' };
staleRuntime.handle({ ...requestMessage('stale-1'), request: first });
await Promise.resolve();
staleRuntime.handle({ ...requestMessage('fresh-2'), request: second });
await Promise.resolve();
gates.get(first.requestedT0Utc)?.();
gates.get(second.requestedT0Utc)?.();
await settle();
assert.deepEqual(
  staleEvents.filter(event => event.type === RUN_PAYLOAD_MESSAGE_TYPES.accepted).map(event => event.requestId),
  ['fresh-2'],
);
assert.equal(staleEvents.some(event => event.requestId === 'stale-1'), false);
staleRuntime.dispose();

// Explicit cancel emits one terminal cancellation and never an accepted run.
const cancelEvents: RunPayloadResponseMessage[] = [];
let cancelled = false;
const cancelRuntime = createRunPayloadWorkerRuntime(
  async (_requestInput, context) => {
    await new Promise<void>((_resolve, reject) => {
      context.signal.addEventListener('abort', () => {
        cancelled = true;
        reject(new Error('aborted'));
      }, { once: true });
    });
    return buildResult(request);
  },
  event => cancelEvents.push(event),
);
cancelRuntime.handle(requestMessage('cancel-1'));
await Promise.resolve();
cancelRuntime.handle({
  protocol: RUN_PAYLOAD_PROTOCOL_SCHEMA,
  type: RUN_PAYLOAD_MESSAGE_TYPES.cancel,
  requestId: 'cancel-1',
  reason: 'superseded by a newer Apply',
});
await settle();
assert.equal(cancelled, true);
assert.deepEqual(cancelEvents.map(event => event.type), [RUN_PAYLOAD_MESSAGE_TYPES.error]);
assert.equal(
  cancelEvents[0]?.type === RUN_PAYLOAD_MESSAGE_TYPES.error
    ? cancelEvents[0].phase
    : undefined,
  'cancelled',
);
cancelRuntime.dispose();

class FakePort implements RunPayloadWorkerPort {
  readonly sent: RunPayloadMessage[] = [];
  private readonly listeners = new Set<(event: RunPayloadWorkerMessageEvent) => void>();

  postMessage(message: RunPayloadMessage): void {
    this.sent.push(message);
  }

  addEventListener(_type: 'message', listener: (event: RunPayloadWorkerMessageEvent) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: RunPayloadWorkerMessageEvent) => void): void {
    this.listeners.delete(listener);
  }

  dispatch(data: unknown): void {
    for (const listener of this.listeners) listener({ data });
  }
}

// Transport sends a codec-checked object and only forwards response messages.
const port = new FakePort();
const transportEvents: RunPayloadResponseMessage[] = [];
const transport = new RunPayloadWorkerTransport(port);
transport.subscribe(event => transportEvents.push(event));
transport.request('transport-1', request);
assert.equal(port.sent[0]?.type, RUN_PAYLOAD_MESSAGE_TYPES.request);
port.dispatch(progress);
assert.equal(transportEvents.length, 1);
assert.equal(transportEvents[0]?.requestId, 'codec-1');
transport.cancel('transport-1', 'test cancellation');
assert.equal(port.sent[1]?.type, RUN_PAYLOAD_MESSAGE_TYPES.cancel);
transport.dispose();

// Dedicated entry converts malformed input into an explicit error message.
const workerPort = new FakePort();
const uninstall = installRunPayloadWorker(workerPort, async requestInput => buildResult(requestInput));
workerPort.dispatch({ protocol: 'wrong-v1', type: RUN_PAYLOAD_MESSAGE_TYPES.request, requestId: 'bad-1' });
assert.equal(workerPort.sent[0]?.type, RUN_PAYLOAD_MESSAGE_TYPES.error);
assert.equal(workerPort.sent[0]?.requestId, 'bad-1');
uninstall();

console.log('run-payload codec, worker runtime, stale cancellation, and transport tests passed');
