export const SELECTABLE_TLE_ARTIFACT_SCHEMA = 'selectable-tle-artifact-envelope-v1' as const;

export const SELECTABLE_TLE_RUN_KEY_PREFIX = 'selectable-tle-run:' as const;

export type TleArtifactStatus = 'bootstrap' | 'accepted';

export type TleArtifactChunkKind =
  | 'bootstrap-frame'
  | 'pass-index'
  | 'ntpu-range'
  | 'global-object-index'
  | 'global-current';

export interface TleArtifactChunkRef {
  readonly kind: TleArtifactChunkKind;
  readonly schema: string;
  readonly contentSha256: string;
  readonly byteLength: number;
  /** Opaque immutable lookup key. Adapters map it to storage or transport. */
  readonly immutableKey: string;
  readonly startAnchorIndexInclusive?: number;
  readonly endAnchorIndexExclusive?: number;
  readonly anchorIndex?: number;
  readonly lod?: 'overview' | 'full-current';
}

export interface TleArtifactSourceReceipt {
  readonly archiveId: 'starlink' | 'oneweb';
  readonly publicationSha256: string;
  readonly sourceSnapshotDigest: string;
  readonly snapshotKey: string;
  readonly snapshotSha256: string;
  readonly requestedT0Utc: string;
  readonly appliedT0Utc: string;
}

export interface TleArtifactGeometryIdentity {
  readonly durationS: number;
  readonly stepS: number;
  readonly anchorCount: number;
  readonly coarseStepS: number;
  readonly chunkDurationS: number;
  readonly endpointPaddingS: number;
  readonly horizonElevationDeg: number;
  readonly coarseGuardElevationDeg: number;
  readonly observerId: string;
  readonly observerCoordinates: {
    readonly latitudeDeg: number;
    readonly longitudeDeg: number;
    readonly altitudeM: number;
  };
  readonly visibilityPolicyRevision: string;
  readonly coarseIndexRevision: string;
  readonly exactSgp4Revision: string;
}

export interface TleArtifactAnalysisIdentity {
  readonly canonicalScenarioRevision: string;
  readonly parametersSha256: string;
  readonly formulaVersion: string;
  readonly linkShapeVersion: string;
  readonly analysisRunId: string;
}

export interface TleArtifactChunkSet {
  readonly bootstrapFrame: TleArtifactChunkRef;
  readonly passIndex?: TleArtifactChunkRef;
  readonly ntpuRanges?: readonly TleArtifactChunkRef[];
  readonly globalObjectIndex?: TleArtifactChunkRef;
  readonly globalFirstCurrent?: TleArtifactChunkRef;
  readonly globalCurrents?: readonly TleArtifactChunkRef[];
}

export interface TleArtifactChunkEnvelope<Payload = unknown> {
  readonly schema: string;
  readonly kind: TleArtifactChunkKind;
  readonly runKey: string;
  readonly passIndexKey: string;
  readonly sourceSnapshotDigest: string;
  readonly geometryRunId: string;
  readonly analysisRunId: string;
  readonly recordCount: number;
  readonly startAnchorIndexInclusive?: number;
  readonly endAnchorIndexExclusive?: number;
  readonly anchorIndex?: number;
  readonly lod?: 'overview' | 'full-current';
  readonly payload: Payload;
}

export interface SelectableTleArtifactManifest {
  readonly schema: typeof SELECTABLE_TLE_ARTIFACT_SCHEMA;
  readonly status: TleArtifactStatus;
  readonly runKey: string;
  readonly passIndexKey: string;
  readonly geometryRunId: string;
  readonly source: TleArtifactSourceReceipt;
  readonly geometry: TleArtifactGeometryIdentity;
  readonly analysis: TleArtifactAnalysisIdentity;
  readonly chunks: TleArtifactChunkSet;
}

/**
 * Structurally validated manifest declaration. This type intentionally has no
 * `runReady` flag: parsing metadata or painting a bootstrap frame cannot unlock
 * the public timeline. Publication readiness belongs to the complete producer
 * gate after every required child and canonical frame has been verified.
 */
export type ValidatedTleArtifactManifest = SelectableTleArtifactManifest;
