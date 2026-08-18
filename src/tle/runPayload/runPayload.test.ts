import assert from 'node:assert/strict';

import {
  RUN_PAYLOAD_MESSAGE_TYPES,
  RUN_PAYLOAD_PROTOCOL_SCHEMA,
  type InProcessRunPayloadAdapter,
  type RunPayloadAcceptedMessage,
  type RunPayloadBootstrapMessage,
  type RunPayloadChunkEnvelope,
  type RunPayloadGlobalFramePayload,
  type RunPayloadIdentity,
  type RunPayloadMessage,
  type RunPayloadNtpuRangePayload,
  type RunPayloadPlan,
  type RunPayloadProgressMessage,
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

const identity: RunPayloadIdentity = {
  runKey: `selectable-tle-run:${'a'.repeat(64)}`,
  passIndexKey: `tle-pass-index:${'b'.repeat(64)}`,
  geometryRunId: 'geometry-run-test-v1',
  analysisRunId: 'analysis-run-test-v1',
  sourceSnapshotDigest: 'd'.repeat(64),
};

const chunk: RunPayloadChunkEnvelope = {
  kind: 'bootstrap-frame',
  schema: 'bootstrap-frame-v1',
  contentSha256: 'c'.repeat(64),
  byteLength: 17,
  immutableKey: 'sha256/bootstrap-frame-v1',
  runKey: identity.runKey,
  passIndexKey: identity.passIndexKey,
  sourceSnapshotDigest: identity.sourceSnapshotDigest,
  geometryRunId: identity.geometryRunId,
  analysisRunId: identity.analysisRunId,
  recordCount: 1,
  payload: { frame: 0, instantUtc: request.requestedT0Utc },
};

const bootstrapMessage: RunPayloadBootstrapMessage = {
  protocol: RUN_PAYLOAD_PROTOCOL_SCHEMA,
  type: RUN_PAYLOAD_MESSAGE_TYPES.bootstrap,
  requestId: 'request-1',
  identity,
  payload: {
    manifest: {
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
      chunks: { bootstrapFrame: chunk },
    },
    bootstrapFrame: chunk,
    sourceKind: 'ARCHIVED_TLE',
    propagationModel: 'SGP4',
    frameId: 'analysis-bootstrap-frame-v1',
    instantUtc: request.requestedT0Utc,
    frame: { frameId: 'analysis-bootstrap-frame-v1', instantUtc: request.requestedT0Utc },
  },
};

const acceptedMessage: RunPayloadAcceptedMessage = {
  protocol: RUN_PAYLOAD_PROTOCOL_SCHEMA,
  type: RUN_PAYLOAD_MESSAGE_TYPES.accepted,
  requestId: 'request-1',
  identity,
  payload: {
    manifest: { ...bootstrapMessage.payload.manifest, status: 'accepted' },
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

const progressMessage: RunPayloadProgressMessage = {
  protocol: RUN_PAYLOAD_PROTOCOL_SCHEMA,
  type: RUN_PAYLOAD_MESSAGE_TYPES.progress,
  requestId: 'request-1',
  phase: 'exact-confirming',
  completedUnits: 20,
  totalUnits: 241,
  identity,
};

function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

assert.deepEqual(roundTrip(bootstrapMessage), bootstrapMessage);
assert.deepEqual(roundTrip(acceptedMessage), acceptedMessage);
assert.deepEqual(roundTrip(progressMessage), progressMessage);
assert.equal(bootstrapMessage.identity.runKey, chunk.runKey);
assert.equal(bootstrapMessage.identity.passIndexKey, chunk.passIndexKey);
assert.equal(acceptedMessage.payload.acceptedAnchorCount, 241);

const messages: readonly RunPayloadMessage[] = [
  {
    protocol: RUN_PAYLOAD_PROTOCOL_SCHEMA,
    type: RUN_PAYLOAD_MESSAGE_TYPES.request,
    requestId: 'request-1',
    request,
  },
  progressMessage,
  bootstrapMessage,
  acceptedMessage,
  {
    protocol: RUN_PAYLOAD_PROTOCOL_SCHEMA,
    type: RUN_PAYLOAD_MESSAGE_TYPES.error,
    requestId: 'request-1',
    phase: 'failed',
    code: 'unavailable',
    message: 'synthetic test failure',
    retryable: false,
  },
  {
    protocol: RUN_PAYLOAD_PROTOCOL_SCHEMA,
    type: RUN_PAYLOAD_MESSAGE_TYPES.cancel,
    requestId: 'request-1',
    reason: 'superseded',
  },
];
assert.equal(messages.length, 6);
assert.ok(messages.every(message => message.protocol === RUN_PAYLOAD_PROTOCOL_SCHEMA));

const plan: RunPayloadPlan = {
  protocol: RUN_PAYLOAD_PROTOCOL_SCHEMA,
  request,
  identity,
  manifest: bootstrapMessage.payload.manifest,
};

const fakeNtpU: RunPayloadNtpuRangePayload = {
  chunk: {
    ...chunk,
    kind: 'ntpu-range',
    schema: 'ntpu-range-v1',
    startAnchorIndexInclusive: 0,
    endAnchorIndexExclusive: 121,
    payload: { anchors: [0, 30, 60] },
  },
};

const fakeGlobal: RunPayloadGlobalFramePayload = {
  chunk: {
    ...chunk,
    kind: 'global-current',
    schema: 'global-current-v1',
    anchorIndex: 0,
    lod: 'overview',
    payload: { objectIds: ['sat-1'] },
  },
};

const adapter: InProcessRunPayloadAdapter = {
  kind: 'in-process',
  async resolve() {
    return plan;
  },
  async loadGlobal() {
    return fakeGlobal;
  },
  async loadNtpU() {
    return fakeNtpU;
  },
};

assert.equal(adapter.kind, 'in-process');
assert.equal((await adapter.resolve(request)).identity.runKey, identity.runKey);
assert.equal(
  (await adapter.loadNtpU(plan, {
    runKey: identity.runKey,
    passIndexKey: identity.passIndexKey,
    startAnchorIndexInclusive: 0,
    endAnchorIndexExclusive: 121,
  })).chunk.passIndexKey,
  identity.passIndexKey,
);
assert.equal(
  (await adapter.loadGlobal(plan, {
    runKey: identity.runKey,
    passIndexKey: identity.passIndexKey,
    anchorIndex: 0,
    lod: 'overview',
  })).chunk.runKey,
  identity.runKey,
);

console.log('run-payload contract and adapter tests passed');
