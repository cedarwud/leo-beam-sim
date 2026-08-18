import type {
  TleArtifactAnalysisIdentity,
  TleArtifactChunkEnvelope,
  TleArtifactChunkKind,
  TleArtifactChunkRef,
  TleArtifactGeometryIdentity,
  TleArtifactSourceReceipt,
  ValidatedTleArtifactManifest,
} from '../runArtifact';

/**
 * Transport-neutral contract for an accepted selectable-TLE run.
 *
 * This module deliberately contains data only.  It must remain safe to carry
 * over `postMessage`, a JSON HTTP response, or an immutable artifact loader;
 * adapters may add cancellation and scheduling around it, but must not put
 * functions, React state, or a live RunBundle in a payload.
 */
export const RUN_PAYLOAD_PROTOCOL_SCHEMA = 'selectable-tle-run-payload-v1' as const;

export const RUN_PAYLOAD_MESSAGE_TYPES = {
  request: 'run-payload/request',
  progress: 'run-payload/progress',
  bootstrap: 'run-payload/bootstrap',
  accepted: 'run-payload/accepted',
  error: 'run-payload/error',
  cancel: 'run-payload/cancel',
} as const;

export type RunPayloadMessageType = typeof RUN_PAYLOAD_MESSAGE_TYPES[keyof typeof RUN_PAYLOAD_MESSAGE_TYPES];

/** JSON-safe payload value used by the baseline artifact/API contract. */
export type SerializableJsonPrimitive = string | number | boolean | null;
export type SerializableJsonValue =
  | SerializableJsonPrimitive
  | readonly SerializableJsonValue[]
  | { readonly [key: string]: SerializableJsonValue };

export type RunPayloadGeometryConfig = Pick<
  TleArtifactGeometryIdentity,
  | 'durationS'
  | 'stepS'
  | 'anchorCount'
  | 'coarseStepS'
  | 'chunkDurationS'
  | 'endpointPaddingS'
  | 'horizonElevationDeg'
  | 'coarseGuardElevationDeg'
>;

export interface RunPayloadObserver {
  readonly id: TleArtifactGeometryIdentity['observerId'];
  readonly coordinates: TleArtifactGeometryIdentity['observerCoordinates'];
}

export type RunPayloadAnalysisConfig = Pick<
  TleArtifactAnalysisIdentity,
  | 'canonicalScenarioRevision'
  | 'parametersSha256'
  | 'formulaVersion'
  | 'linkShapeVersion'
>;

/** The domain input; request correlation is carried by the message envelope. */
export interface SelectableRunRequest {
  readonly archiveId: TleArtifactSourceReceipt['archiveId'];
  readonly requestedT0Utc: TleArtifactSourceReceipt['requestedT0Utc'];
  readonly observer: RunPayloadObserver;
  readonly geometry: RunPayloadGeometryConfig;
  readonly analysis: RunPayloadAnalysisConfig;
}

export interface RunPayloadIdentity {
  readonly runKey: ValidatedTleArtifactManifest['runKey'];
  readonly passIndexKey: ValidatedTleArtifactManifest['passIndexKey'];
  readonly geometryRunId: ValidatedTleArtifactManifest['geometryRunId'];
  readonly analysisRunId: TleArtifactAnalysisIdentity['analysisRunId'];
  readonly sourceSnapshotDigest: TleArtifactSourceReceipt['sourceSnapshotDigest'];
}

/** The identity fields required on every chunk request and response. */
export type RunPayloadChunkIdentity =
  & Pick<
    TleArtifactChunkRef,
    | 'kind'
    | 'schema'
    | 'contentSha256'
    | 'byteLength'
    | 'immutableKey'
    | 'startAnchorIndexInclusive'
    | 'endAnchorIndexExclusive'
    | 'anchorIndex'
    | 'lod'
  >
  & Pick<
    TleArtifactChunkEnvelope<SerializableJsonValue>,
    | 'runKey'
    | 'passIndexKey'
    | 'sourceSnapshotDigest'
    | 'geometryRunId'
    | 'analysisRunId'
  >;

export type RunPayloadChunkEnvelope<Payload extends SerializableJsonValue = SerializableJsonValue> =
  RunPayloadChunkIdentity
  & Pick<TleArtifactChunkEnvelope<Payload>, 'recordCount' | 'payload'>;

export type RunPayloadBootstrapManifest = Omit<ValidatedTleArtifactManifest, 'status'> & {
  readonly status: 'bootstrap';
};

export type RunPayloadAcceptedManifest = Omit<ValidatedTleArtifactManifest, 'status'> & {
  readonly status: 'accepted';
};

export interface RunPayloadPlan {
  readonly protocol: typeof RUN_PAYLOAD_PROTOCOL_SCHEMA;
  readonly request: SelectableRunRequest;
  readonly identity: RunPayloadIdentity;
  /** A plan may begin as bootstrap and becomes accepted only at publication. */
  readonly manifest: RunPayloadBootstrapManifest | RunPayloadAcceptedManifest;
}

export type RunPayloadRunIdentity = Pick<RunPayloadIdentity, 'runKey' | 'passIndexKey'>;

export type RunPayloadGlobalLod = NonNullable<TleArtifactChunkRef['lod']>;

export type RunPayloadGlobalRequest = RunPayloadRunIdentity & {
  readonly anchorIndex: number;
  readonly lod: RunPayloadGlobalLod;
};

export type RunPayloadNtpuRangeRequest = RunPayloadRunIdentity & {
  readonly startAnchorIndexInclusive: number;
  readonly endAnchorIndexExclusive: number;
};

export interface RunPayloadBootstrapPayload {
  readonly manifest: RunPayloadBootstrapManifest;
  readonly bootstrapFrame: RunPayloadChunkEnvelope;
  readonly sourceKind: 'ARCHIVED_TLE';
  readonly propagationModel: 'SGP4';
  readonly frameId: string;
  readonly instantUtc: string;
  /** Full first canonical frame; later anchors use the compact timeline. */
  readonly frame: SerializableJsonValue;
}

export interface RunPayloadCanonicalAnchor {
  readonly anchorIndex: number;
  readonly instantUtc: string;
  readonly frameId: string;
  readonly tleFrameId: string;
  readonly selectedSatelliteId: string;
  readonly candidateSatelliteId: string | null;
  readonly selection: SerializableJsonValue;
  readonly handover: SerializableJsonValue | null;
  /** Canonical values at this anchor, without repeating the full TLE scene. */
  readonly canonical: SerializableJsonValue;
}

export interface RunPayloadCanonicalTimeline {
  readonly runKey: RunPayloadIdentity['runKey'];
  readonly passIndexKey: RunPayloadIdentity['passIndexKey'];
  readonly geometryRunId: RunPayloadIdentity['geometryRunId'];
  readonly analysisRunId: RunPayloadIdentity['analysisRunId'];
  readonly sourceKind: 'ARCHIVED_TLE';
  readonly propagationModel: 'SGP4';
  readonly durationS: number;
  readonly stepS: number;
  readonly anchorCount: number;
  readonly anchors: readonly RunPayloadCanonicalAnchor[];
  readonly anchorSelections: SerializableJsonValue;
  readonly handoverTrace: SerializableJsonValue;
  readonly evaluation: SerializableJsonValue;
  /** Real geometry fallback count is surfaced rather than hidden as evidence. */
  readonly visibleGeometryFallbackAnchorCount: number;
}

export interface RunPayloadAcceptedPayload {
  readonly manifest: RunPayloadAcceptedManifest;
  readonly acceptedAnchorCount: number;
  readonly acceptedIntervalCount: number;
  readonly timeline: RunPayloadCanonicalTimeline;
}

/** Result returned by an injected dense producer before Worker publication. */
export interface RunPayloadWorkerBuildResult {
  readonly plan: RunPayloadPlan;
  readonly bootstrap: RunPayloadBootstrapPayload;
  readonly accepted: RunPayloadAcceptedPayload;
}

export interface RunPayloadGlobalFramePayload {
  readonly chunk: RunPayloadChunkEnvelope;
}

export interface RunPayloadNtpuRangePayload {
  readonly chunk: RunPayloadChunkEnvelope;
}

export type RunPayloadPhase =
  | 'snapshot-resolving'
  | 'coarse-indexing'
  | 'exact-confirming'
  | 'pass-indexing'
  | 'ntpu-canonical-building'
  | 'payload-packaging'
  | 'accepted'
  | 'cancelled'
  | 'failed';

export interface RunPayloadMessageBase {
  readonly protocol: typeof RUN_PAYLOAD_PROTOCOL_SCHEMA;
  readonly requestId: string;
}

export interface RunPayloadRequestMessage extends RunPayloadMessageBase {
  readonly type: typeof RUN_PAYLOAD_MESSAGE_TYPES.request;
  readonly request: SelectableRunRequest;
}

export interface RunPayloadProgressMessage extends RunPayloadMessageBase {
  readonly type: typeof RUN_PAYLOAD_MESSAGE_TYPES.progress;
  readonly phase: Exclude<RunPayloadPhase, 'accepted' | 'cancelled' | 'failed'>;
  readonly completedUnits: number;
  readonly totalUnits: number;
  readonly identity?: RunPayloadIdentity;
  readonly detail?: string;
}

export interface RunPayloadBootstrapMessage extends RunPayloadMessageBase {
  readonly type: typeof RUN_PAYLOAD_MESSAGE_TYPES.bootstrap;
  readonly identity: RunPayloadIdentity;
  readonly payload: RunPayloadBootstrapPayload;
}

export interface RunPayloadAcceptedMessage extends RunPayloadMessageBase {
  readonly type: typeof RUN_PAYLOAD_MESSAGE_TYPES.accepted;
  readonly identity: RunPayloadIdentity;
  readonly payload: RunPayloadAcceptedPayload;
}

export interface RunPayloadErrorMessage extends RunPayloadMessageBase {
  readonly type: typeof RUN_PAYLOAD_MESSAGE_TYPES.error;
  readonly phase: RunPayloadPhase;
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly identity?: RunPayloadIdentity;
}

export interface RunPayloadCancelMessage extends RunPayloadMessageBase {
  readonly type: typeof RUN_PAYLOAD_MESSAGE_TYPES.cancel;
  readonly reason?: string;
}

export type RunPayloadMessage =
  | RunPayloadRequestMessage
  | RunPayloadProgressMessage
  | RunPayloadBootstrapMessage
  | RunPayloadAcceptedMessage
  | RunPayloadErrorMessage
  | RunPayloadCancelMessage;

export type RunPayloadResponseMessage = Exclude<
  RunPayloadMessage,
  RunPayloadRequestMessage | RunPayloadCancelMessage
>;
