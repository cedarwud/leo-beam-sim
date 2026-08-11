/**
 * Archived-TLE boundary types.
 *
 * These types intentionally contain no file-system or application-state
 * concerns.  A build step or controller injects the manifest into this
 * boundary; the browser-side modules only validate, resolve, and propagate
 * the supplied records.
 */

export const TLE_SOURCE_KIND = 'ARCHIVED_TLE' as const;
export const TLE_PROPAGATION_MODEL = 'SGP4' as const;
export const TLE_TIME_ZONE = 'Asia/Taipei' as const;

export type TleSourceKind = typeof TLE_SOURCE_KIND;
export type TlePropagationModel = typeof TLE_PROPAGATION_MODEL;

export interface TleArchiveEntry {
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly epochUtc: string;
  readonly line1: string;
  readonly line2: string;
  readonly sourcePath: string;
  readonly sourceKind: TleSourceKind;
}

/**
 * The maximum permitted age is archive metadata, not a hidden component
 * constant.  `maxAgeMs` is accepted as a source-manifest compatibility alias
 * by the validator, but normalized manifests always expose
 * `maxPropagationAgeMs`.
 */
export interface TleArchiveManifest {
  readonly entries: readonly TleArchiveEntry[];
  readonly maxPropagationAgeMs: number;
  readonly archiveId?: string;
  readonly generatedAtUtc?: string;
  readonly maxAgeMs?: number;
}

export interface TleArchiveManifestOptions {
  readonly maxPropagationAgeMs?: number;
  readonly maxAgeMs?: number;
  readonly archiveId?: string;
  readonly generatedAtUtc?: string;
}

export interface ParsedTleEpoch {
  readonly epochUtc: string;
  readonly epochMs: number;
  readonly epochYear: number;
  readonly dayOfYear: number;
}

export interface TleSatelliteIdentity {
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly catalogNumber: string;
}

export interface ValidatedTleLines {
  readonly line1: string;
  readonly line2: string;
  readonly identity: TleSatelliteIdentity;
  readonly epoch: ParsedTleEpoch;
}

export interface TleSnapshotProvenance {
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly sourcePath: string;
  readonly sourceKind: TleSourceKind;
  readonly epochUtc: string;
  readonly line1: string;
  readonly line2: string;
  readonly archiveId?: string;
}

export interface ResolvedTleSnapshot extends TleArchiveEntry {
  readonly requestedInstantUtc: string;
  readonly ageMs: number;
  readonly maxPropagationAgeMs: number;
  readonly provenance: TleSnapshotProvenance;
}

export interface Vector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/**
 * satellite.js returns TEME coordinates.  They are kept under the explicit
 * TEME names here; the ECI aliases are retained as a compatibility convenience
 * for consumers that use the common ECI label for this propagation output.
 */
export interface PropagatedSatelliteState {
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly requestedInstantUtc: string;
  readonly tleEpochUtc: string;
  readonly sourcePath: string;
  readonly sourceKind: TleSourceKind;
  readonly propagationModel: TlePropagationModel;
  readonly positionTemeKm: Vector3;
  readonly velocityTemeKmPerSec: Vector3;
  readonly positionEciKm: Vector3;
  readonly velocityEciKmPerSec: Vector3;
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly provenance: TleSnapshotProvenance;
}

export interface TlePropagationFrameProvenance {
  readonly archiveId?: string;
  readonly sourceKind: TleSourceKind;
  readonly propagationModel: TlePropagationModel;
  readonly snapshots: readonly TleSnapshotProvenance[];
}

export interface TlePropagationFrame {
  readonly frameId: string;
  readonly requestedInstantUtc: string;
  readonly resolvedEpochsUtc: Readonly<Record<string, string>>;
  readonly sourceKind: TleSourceKind;
  readonly propagationModel: TlePropagationModel;
  readonly satellites: readonly PropagatedSatelliteState[];
  readonly provenance: TlePropagationFrameProvenance;
}

export interface ResolveTleSnapshotOptions {
  readonly satelliteId?: string;
  readonly maxPropagationAgeMs?: number;
  readonly maxAgeMs?: number;
}

export interface CreateTlePropagationFrameOptions extends ResolveTleSnapshotOptions {
  readonly satelliteIds?: readonly string[];
}

export type UtcInstantInput = string | Date;
