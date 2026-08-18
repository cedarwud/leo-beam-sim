/**
 * Pure geometry contracts used by the archived-TLE pass planner.
 *
 * The planner deliberately knows nothing about propagation, React, or the
 * run builder.  A caller supplies one common anchor axis and either an
 * indexed geometry table or a callback that reads a look-angle sample.
 */

export type PassAnchorTime = number | string | Date;

/**
 * A permissive input shape keeps the seam useful for small run adapters.  The
 * canonical fields are the `*Deg`/`rangeKm` names; short aliases are accepted
 * at the boundary and normalized by the extractor.
 */
export interface PassGeometrySample {
  readonly satelliteId?: string;
  readonly id?: string;
  readonly azimuthDeg?: number;
  readonly elevationDeg?: number;
  readonly rangeKm?: number;
  readonly azimuth?: number;
  readonly elevation?: number;
  readonly range?: number;
  readonly orbitalPlaneKey?: string;
  readonly orbitalPlane?: string;
  readonly planeKey?: string;
}

export interface PassAnchor {
  readonly time?: PassAnchorTime;
  readonly anchorTime?: PassAnchorTime;
  readonly timeSec?: number;
  readonly timestamp?: PassAnchorTime;
  readonly satellites?: readonly PassGeometrySample[] | Readonly<Record<string, PassGeometrySample | null | undefined>>;
  readonly geometry?: Readonly<Record<string, PassGeometrySample | null | undefined>>;
  readonly samples?: Readonly<Record<string, PassGeometrySample | null | undefined>>;
  readonly geometries?: Readonly<Record<string, PassGeometrySample | null | undefined>>;
  readonly [key: string]: unknown;
}

export type PassAnchorInput = PassAnchor | PassAnchorTime;

export type PassGeometryReader = (
  satelliteId: string,
  anchorTime: PassAnchorTime,
  anchorIndex: number,
) => PassGeometrySample | null | undefined;

export interface PassGeometrySource {
  /** Preferred explicit time axis. */
  readonly anchorTimes?: readonly PassAnchorTime[];
  /** `times` is accepted as a small adapter convenience. */
  readonly times?: readonly PassAnchorTime[];
  /** Anchors may be bare times or objects carrying per-anchor geometry. */
  readonly anchors?: readonly PassAnchorInput[];
  readonly satelliteIds?: readonly string[];
  /** Indexed rows: `samples[satelliteId][anchorIndex]`. */
  readonly samples?: Readonly<Record<string, readonly (PassGeometrySample | null | undefined)[]>>;
  readonly geometry?: Readonly<Record<string, readonly (PassGeometrySample | null | undefined)[]>>;
  readonly geometryBySatellite?: Readonly<Record<string, readonly (PassGeometrySample | null | undefined)[]>>;
  readonly perSatellite?: Readonly<Record<string, readonly (PassGeometrySample | null | undefined)[]>>;
  /** Callback alternatives.  All receive the same shared anchor index. */
  readonly sample?: PassGeometryReader;
  readonly getSample?: PassGeometryReader;
  readonly getGeometry?: PassGeometryReader;
  readonly getLookAngle?: PassGeometryReader;
  readonly [key: string]: unknown;
}

export interface PassExtractionOptions {
  /** Elevation at or above this value is considered above the horizon. */
  readonly horizonElevationDeg?: number;
  readonly minimumElevationDeg?: number;
}

export interface PassDiversityPolicy {
  readonly revision: string;
  readonly horizonElevationDeg: number;
  readonly highElevationDeg: number;
  readonly nearDuplicatePeakTimeSec: number;
  readonly simultaneousSkySeparationDeg: number;
  readonly aosLosSimilaritySec: number;
  readonly preferredPeakSeparationSec: number;
  readonly minimumCandidateOverlapSec: number;
  readonly minimumCandidateContinuationSec: number;
}

export interface PassPlannerOptions extends PassExtractionOptions {
  readonly policyRevision?: string;
  readonly highElevationDeg?: number;
  readonly nearDuplicatePeakTimeSec?: number;
  readonly duplicatePeakTimeSec?: number;
  readonly peakTimeSeparationSec?: number;
  readonly simultaneousSkySeparationDeg?: number;
  readonly simultaneousSeparationDeg?: number;
  readonly aosLosSimilaritySec?: number;
  readonly overlapSimilaritySec?: number;
  readonly preferredPeakSeparationSec?: number;
  readonly minimumCandidateOverlapSec?: number;
  readonly candidateOverlapSec?: number;
  readonly minimumCandidateContinuationSec?: number;
  readonly candidateContinuationSec?: number;
}

/** A complete, boundary-to-boundary visible pass. Times are seconds on the source axis. */
export interface PassEvent {
  readonly passId: string;
  readonly satelliteId: string;
  readonly aos: number;
  readonly peak: number;
  readonly los: number;
  readonly aosTimeSec: number;
  readonly peakTimeSec: number;
  readonly losTimeSec: number;
  readonly aosTime: number;
  readonly peakTime: number;
  readonly losTime: number;
  readonly maxElevationDeg: number;
  readonly peakAzimuthDeg: number;
  readonly peakRangeKm?: number;
  readonly entryAzimuthDeg: number;
  readonly exitAzimuthDeg: number;
  readonly entryRangeKm?: number;
  readonly exitRangeKm?: number;
  readonly durationSec: number;
  readonly orbitalPlaneKey?: string;
  readonly aosAnchorIndex: number;
  readonly peakAnchorIndex: number;
  readonly losAnchorIndex: number;
  readonly aosUtc?: string;
  readonly peakUtc?: string;
  readonly losUtc?: string;
  /** Complete events are false for both flags; boundary-clipped observations are excluded. */
  readonly boundaryClippedStart?: boolean;
  readonly boundaryClippedEnd?: boolean;
}

export interface ServiceAnchorSelection {
  readonly anchorIndex: number;
  readonly anchorTimeSec: number;
  readonly servingPassId: string | null;
  readonly candidatePassId: string | null;
}

export interface ServiceSequenceEntry extends PassEvent {
  readonly firstServingAnchorIndex: number;
  readonly lastServingAnchorIndex: number;
  readonly nextCandidatePassId: string | null;
}

export interface PassPlanProvenance {
  readonly policyRevision: string;
  readonly selectedPassIds: readonly string[];
}

export interface PassPlan {
  readonly policyRevision: string;
  readonly policy: PassDiversityPolicy;
  readonly anchorTimesSec: readonly number[];
  readonly anchorTimes: readonly PassAnchorTime[];
  readonly extractedPasses: readonly PassEvent[];
  readonly passes: readonly PassEvent[];
  readonly deduplicatedPasses: readonly PassEvent[];
  readonly selectedPasses: readonly ServiceSequenceEntry[];
  readonly selectedPassIds: readonly string[];
  readonly serviceSequence: readonly ServiceSequenceEntry[];
  readonly serviceAnchors: readonly ServiceAnchorSelection[];
  readonly nextCandidateByAnchor: readonly ServiceAnchorSelection[];
  readonly nextCandidateByPassId: Readonly<Record<string, string | null>>;
  readonly nextCandidateMapping: Readonly<Record<string, string | null>>;
  readonly provenance: PassPlanProvenance;
}
