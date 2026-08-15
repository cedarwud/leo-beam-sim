export const TLE_PASS_INDEX_SCHEMA_VERSION = 'tle-pass-index-v1' as const;

export interface PassIndexBuildConfig {
  readonly durationS: number;
  readonly exactStepS: number;
  readonly coarseStepS: number;
  readonly chunkDurationS: number;
  readonly endpointPaddingS: number;
  readonly horizonElevationDeg: number;
  readonly coarseGuardElevationDeg: number;
}

export interface PassIndexChunkWindow {
  readonly chunkIndex: number;
  readonly startS: number;
  readonly endS: number;
  readonly paddedStartS: number;
  readonly paddedEndS: number;
  readonly startAnchorIndexInclusive: number;
  readonly endAnchorIndexExclusive: number;
}

export interface PassIndexExclusionProof {
  /** Names the conservative algorithm whose contract proves non-intersection. */
  readonly revision: string;
  /** Human-readable proof basis retained for audit; sparse samples are not proof. */
  readonly basis: string;
}

export type PassIndexCoarseDisposition =
  | { readonly kind: 'candidate'; readonly reason: string }
  | { readonly kind: 'uncertain'; readonly reason: string }
  | { readonly kind: 'excluded'; readonly proof: PassIndexExclusionProof };

export type PassIndexCoarseClassifier = (
  satelliteId: string,
  chunk: PassIndexChunkWindow,
) => PassIndexCoarseDisposition;

export interface PassIndexExclusionReceipt {
  readonly satelliteId: string;
  readonly proof: PassIndexExclusionProof;
}

export interface PassIndexUncertaintyReceipt {
  readonly satelliteId: string;
  readonly reason: string;
}

export interface PassIndexChunkReceipt extends PassIndexChunkWindow {
  /** Candidate and uncertain identities admitted to exact confirmation. */
  readonly candidateIds: readonly string[];
  /** Identities removed only by an explicit conservative proof. */
  readonly exclusions: readonly PassIndexExclusionReceipt[];
  readonly uncertainties: readonly PassIndexUncertaintyReceipt[];
}

export interface TimeChunkedCandidateIndex {
  readonly schemaVersion: typeof TLE_PASS_INDEX_SCHEMA_VERSION;
  readonly config: PassIndexBuildConfig;
  readonly sourceSatelliteCount: number;
  readonly chunks: readonly PassIndexChunkReceipt[];
  /** Diagnostics only; exact work remains time-local per chunk. */
  readonly candidateUnionIds: readonly string[];
  readonly uncertainIds: readonly string[];
  /** Identities conservatively excluded from every chunk in the requested window. */
  readonly excludedIds: readonly string[];
  readonly candidateMembershipCount: number;
  readonly classificationAttemptCount: number;
}

export interface PassIndexIdentityInput {
  readonly archiveId: string;
  readonly publicationSha256: string;
  readonly resolvedSnapshotDigest: string;
  readonly requestedT0Utc: string;
  readonly observer: {
    readonly id: string;
    readonly latitudeDeg: number;
    readonly longitudeDeg: number;
    readonly heightKm: number;
  };
  readonly visibilityPolicyRevision: string;
  readonly coarseIndexRevision: string;
  readonly exactSgp4Revision: string;
  readonly config: PassIndexBuildConfig;
}

export interface BuildTimeChunkedCandidateIndexInput {
  readonly satelliteIds: readonly string[];
  readonly config: PassIndexBuildConfig;
  /**
   * Classifies one satellite for one time-local chunk. Throwing, malformed, or
   * blank results fail open as `uncertain` and are admitted to exact work.
   */
  readonly classify: PassIndexCoarseClassifier;
}
