/**
 * Source-backed moments that may be offered by the Visual Lab.
 *
 * A bookmark is an observation anchor, not a preset result.  It carries the
 * exact archived publication and instant used to measure its descriptors so a
 * caller can resolve the same source again instead of treating a label as
 * evidence.
 */

export const VISUAL_LAB_BOOKMARK_ARTIFACT_SCHEMA = 'visual-lab-bookmarks-v1' as const;
export const VISUAL_LAB_BOOKMARK_GENERATOR_VERSION = 'visual-lab-bookmarks-generator-v1' as const;

export type VisualLabBookmarkConstellation = 'oneweb' | 'starlink';

export interface VisualLabBookmarkLocalizedCopy {
  readonly 'zh-Hant': string;
  readonly en: string;
}

export interface VisualLabBookmarkSource {
  readonly catalogUrl: string;
  readonly archiveId: string;
  readonly archiveContentSha256: string;
  readonly archiveDate: string;
  readonly path: string;
  readonly sha256: string;
  readonly recordCount: number;
  readonly maxPropagationAgeMs: number;
  readonly sourceKind: 'ARCHIVED_TLE';
  readonly propagationModel: 'SGP4';
  /** The frame id produced by the real SGP4 measurement pass. */
  readonly measuredFrameId: string;
  readonly propagatedSatelliteCount: number;
  readonly propagationExclusionCount: number;
}

export interface VisualLabBookmarkDescriptors {
  /** Number of propagated satellites at or above the NTPU horizon. */
  readonly visibleSatelliteCount: number;
  /** Number of satellites successfully propagated by the SGP4 frame. */
  readonly propagatedSatelliteCount: number;
  /** Elevation of the highest-elevation visible satellite. */
  readonly selectedElevationDeg: number;
  /** Slant range of the selected highest-elevation satellite. */
  readonly selectedRangeKm: number;
  /** Azimuth of the selected highest-elevation satellite. */
  readonly selectedAzimuthDeg: number;
  /** Highest visible elevation minus lowest visible elevation. */
  readonly elevationSpreadDeg: number;
  /** Circular azimuth coverage of the visible set. */
  readonly visibleAzimuthSpanDeg: number;
  /** Maximum visible range minus minimum visible range. */
  readonly visibleRangeSpanKm: number;
  readonly selectedSatelliteId: string;
  /** The next-highest visible identity, when at least two are visible. */
  readonly comparisonSatelliteId: string | null;
}

export type VisualLabBookmarkSelectionRole =
  | 'max-visible-count-seed'
  | 'descriptor-contrast';

export interface VisualLabBookmark {
  readonly id: string;
  /** Selection order within its constellation; this is not a quality grade. */
  readonly selectionRank: number;
  readonly selectionRole: VisualLabBookmarkSelectionRole;
  readonly constellation: VisualLabBookmarkConstellation;
  /** Exact source instant, canonicalized as an ISO-8601 UTC value. */
  readonly instantUtc: string;
  /** The same instant rendered as an Asia/Taipei wall-clock value. */
  readonly instantTaipei: string;
  readonly source: VisualLabBookmarkSource;
  readonly descriptors: VisualLabBookmarkDescriptors;
  readonly copy: Readonly<{
    readonly label: VisualLabBookmarkLocalizedCopy;
    readonly caption: VisualLabBookmarkLocalizedCopy;
  }>;
}

export interface VisualLabBookmarkCatalogSummary {
  readonly constellation: VisualLabBookmarkConstellation;
  readonly catalogUrl: string;
  readonly archiveId: string;
  readonly archiveContentSha256: string;
  readonly snapshotCount: number;
  readonly firstArchiveDate: string;
  readonly lastArchiveDate: string;
  readonly maxPropagationAgeMs: number;
}

export interface VisualLabBookmarkSelectionPolicy {
  readonly candidateInstantBasis: 'snapshot-max-epoch-utc';
  readonly candidateSnapshotsPerConstellation: number;
  readonly selectedPerConstellation: number;
  readonly descriptorDistance: readonly [
    'visibleSatelliteCount',
    'selectedElevationDeg',
    'elevationSpreadDeg',
    'visibleAzimuthSpanDeg',
    'selectedRangeKm',
    'visibleRangeSpanKm',
  ];
  readonly measurementObserverId: 'ntpu-wgs84-v1';
  readonly measurementApi: 'createTlePropagationFrameWithSatelliteExclusions+deriveObserverLinkGeometry';
}

export interface VisualLabBookmarksArtifact {
  readonly schema: typeof VISUAL_LAB_BOOKMARK_ARTIFACT_SCHEMA;
  readonly generatorVersion: typeof VISUAL_LAB_BOOKMARK_GENERATOR_VERSION;
  /** Deterministic source-derived generation marker, not wall-clock metadata. */
  readonly generatedAtUtc: string;
  readonly timeZone: 'Asia/Taipei';
  readonly sourceCatalogs: readonly VisualLabBookmarkCatalogSummary[];
  readonly selectionPolicy: VisualLabBookmarkSelectionPolicy;
  readonly claimCeiling: VisualLabBookmarkLocalizedCopy;
  readonly bookmarks: readonly VisualLabBookmark[];
}

export interface VisualLabBookmarkCandidate {
  readonly constellation: VisualLabBookmarkConstellation;
  readonly instantUtc: string;
  readonly source: VisualLabBookmarkSource;
  readonly descriptors: VisualLabBookmarkDescriptors;
}

export interface RankedVisualLabBookmarkCandidate {
  readonly candidate: VisualLabBookmarkCandidate;
  readonly selectionRank: number;
  readonly selectionRole: VisualLabBookmarkSelectionRole;
  /** Descriptor-space distance from the nearest already-selected candidate. */
  readonly diversityScore: number;
}
