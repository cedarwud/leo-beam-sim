import type { SimulatorConstellation } from '../../simulator/types';
import type { TleRunComputationMetrics, TleRunPropagationMode } from '../run';

export const TLE_EVENT_ATLAS_SCHEMA_VERSION = 'canonical-tle-event-atlas-v1' as const;
export const TLE_EVENT_ATLAS_WINDOW_SCHEMA_VERSION = 'canonical-tle-event-atlas-window-v1' as const;
export const TLE_EVENT_ATLAS_SCORING_VERSION = 'teaching-clip-lexicographic-v1' as const;
export const TLE_EVENT_ATLAS_RESOLVER_REVISION = 'adr-005-frozen-publication-v1' as const;
export const TLE_EVENT_ATLAS_VISIBILITY_REVISION = 'ntpu-exact-sgp4-horizon-v1' as const;
export const TLE_EVENT_ATLAS_EXACT_SGP4_REVISION = 'satellite-js-sgp4-v1' as const;

export type TleEventAtlasEvidenceClass =
  | 'canonical-research'
  | 'provisional-candidate-pool';

export type TleEventAtlasEventType = 'inter-handover' | 'forced-continuity';

export interface TleEventAtlasSearchRange {
  readonly startUtc: string;
  readonly endUtcExclusive: string;
  readonly windowStepSec: number;
  readonly physicalDurationSec: number;
}

export interface TleEventAtlasObserverReceipt {
  readonly id: string;
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
  readonly heightKm: number;
}

export interface TleEventAtlasSourceReceipt {
  readonly archiveId: string;
  readonly archiveDate: string;
  readonly publicationPath: string;
  readonly publicationSha256: string;
  readonly publicationByteLength: number;
  readonly publicationRecordCount: number;
  readonly admittedRecordCount: number;
  readonly resolvedSnapshotDigest: string;
}

export interface TleEventAtlasTleIdentityReceipt {
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly epochUtc: string;
  readonly sourcePath: string;
  readonly line1: string;
  readonly line2: string;
}

export interface TleEventAtlasLinkSample {
  readonly satelliteId: string;
  readonly userId: string;
  readonly userIndex: number;
  readonly beamId: number;
  readonly elevationDeg: number;
  readonly rangeKm: number;
  readonly offAxisAngleRad: number;
  readonly requestedPowerW: number;
  readonly beforeSatelliteCapPowerW: number;
  readonly actualPowerW: number;
  readonly beamPowerHeadroomW: number;
  readonly satellitePowerHeadroomW: number | null;
  readonly signalW: number;
  readonly intraSatelliteInterferenceW: number | null;
  readonly interSatelliteInterferenceW: number | null;
  readonly totalInterferenceW: number;
  readonly noiseW: number;
  readonly sinrDb: number;
  readonly targetSinrDb: number | null;
  readonly linkMarginDb: number | null;
  readonly rateBps: number;
  readonly qosMet: boolean;
  readonly powerLimited: boolean;
}

export interface TleEventAtlasAnchorSample {
  readonly role: 'before' | 'decision' | 'after';
  readonly anchorIndex: number;
  readonly instantUtc: string;
  readonly state: string;
  readonly event: string;
  readonly progressSec: number;
  readonly cumulativeCount: number;
  readonly servingSatelliteId: string;
  readonly candidateSatelliteId: string | null;
  readonly deltaSinrDb: number | null;
  readonly serving: TleEventAtlasLinkSample;
  readonly candidate: TleEventAtlasLinkSample | null;
  readonly concurrentVisibleSatelliteCount: number;
  readonly systemPowerW: number;
  readonly totalRateBps: number;
  readonly instantaneousEeBitsPerJ: number;
  readonly evaluationEeBitsPerJ: number;
}

export interface TleEventAtlasClipQuality {
  readonly scoringVersion: typeof TLE_EVENT_ATLAS_SCORING_VERSION;
  readonly complete: boolean;
  readonly minimumEventElevationDeg: number | null;
  readonly deltaSinrDynamicRangeDb: number | null;
  readonly candidateResidualVisibilitySec: number | null;
  readonly concurrentVisibleSatelliteCount: number;
  readonly eventTimeMinimumElevationAtLeast45Deg: boolean;
  readonly eventTimeMinimumElevationAtLeast60Deg: boolean;
  readonly eventTimeMinimumElevationAtLeast75Deg: boolean;
}

export interface TleEventAtlasEventVariant {
  readonly variantId: string;
  readonly logicalEventKey: string;
  readonly sourceEventId: string;
  readonly sourceEvent: TleEventAtlasEventType;
  readonly constellation: SimulatorConstellation;
  readonly requestedT0Utc: string;
  readonly triggerAnchorIndex: number;
  readonly triggerInstantUtc: string;
  readonly fromSatelliteId: string;
  readonly toSatelliteId: string;
  readonly traceDigest: string;
  readonly geometryRunId: string;
  readonly analysisRunId: string;
  readonly passPolicyRevision: string;
  readonly handoverPolicy: {
    readonly offsetDb: number;
    readonly tttSec: number;
    readonly anchorStepSec: number;
  };
  readonly targetSelection: {
    readonly passId: string;
    readonly satelliteId: string;
    readonly sourceLocator: string;
  };
  readonly preCommit: {
    readonly servingSatelliteId: string;
    readonly candidateSatelliteId: string;
    readonly servingVisible: boolean;
    readonly candidateVisible: boolean;
    readonly servingSinrDb: number | null;
    readonly candidateSinrDb: number | null;
    readonly deltaDb: number | null;
  };
  readonly postCommit: {
    readonly servingSatelliteId: string;
    readonly anchorIndex: number;
    readonly instantUtc: string;
  };
  readonly qualificationAnchors: readonly {
    readonly anchorIndex: number;
    readonly instantUtc: string;
    readonly deltaDb: number;
    readonly progressSec: number;
  }[];
  readonly source: TleEventAtlasSourceReceipt;
  readonly tleIdentities: readonly TleEventAtlasTleIdentityReceipt[];
  readonly beforeAnchorIndex: number;
  readonly decisionAnchorIndex: number;
  readonly afterAnchorIndex: number;
  readonly anchors: readonly TleEventAtlasAnchorSample[];
  readonly quality: TleEventAtlasClipQuality;
}

interface TleEventAtlasWindowBase {
  readonly schema: typeof TLE_EVENT_ATLAS_WINDOW_SCHEMA_VERSION;
  readonly constellation: SimulatorConstellation;
  readonly requestedT0Utc: string;
  readonly evidenceClass: TleEventAtlasEvidenceClass;
  readonly propagationMode: TleRunPropagationMode;
  readonly configDigest: string;
}

export interface TleEventAtlasAcceptedWindowReceipt extends TleEventAtlasWindowBase {
  readonly status: 'accepted';
  readonly source: TleEventAtlasSourceReceipt;
  readonly geometryRunId: string;
  readonly analysisRunId: string;
  readonly traceDigest: string;
  readonly passPolicyRevision: string;
  readonly canonicalParameterDigest: string;
  readonly canonicalScenarioDigest: string;
  readonly handoverPolicy: {
    readonly offsetDb: number;
    readonly tttSec: number;
    readonly anchorStepSec: number;
  };
  readonly computationMetrics: TleRunComputationMetrics;
  readonly passCount: number;
  readonly extractedPassCount: number;
  readonly visibleGeometryFallbackAnchorCount: number;
  readonly evaluation: {
    readonly evaluationBitsPerJ: number;
    readonly deliveredBits: number;
    readonly consumedEnergyJ: number;
    readonly durationS: number;
    readonly sampleCount: number;
  };
  readonly events: readonly TleEventAtlasEventVariant[];
}

export interface TleEventAtlasRejectedWindowReceipt extends TleEventAtlasWindowBase {
  readonly status: 'rejected';
  readonly error: {
    readonly name: string;
    readonly code: string | null;
    readonly message: string;
  };
}

export type TleEventAtlasWindowReceipt =
  | TleEventAtlasAcceptedWindowReceipt
  | TleEventAtlasRejectedWindowReceipt;

export type TleEventAtlasPublishedWindowReceipt =
  | (Omit<TleEventAtlasAcceptedWindowReceipt, 'events'> & {
      readonly eventVariantCount: number;
    })
  | TleEventAtlasRejectedWindowReceipt;

export interface TleEventAtlasEventVariantReceipt {
  readonly variantId: string;
  readonly logicalEventKey: string;
  readonly sourceEvent: TleEventAtlasEventType;
  readonly requestedT0Utc: string;
  readonly triggerInstantUtc: string;
  readonly fromSatelliteId: string;
  readonly toSatelliteId: string;
  readonly traceDigest: string;
  readonly geometryRunId: string;
  readonly analysisRunId: string;
  readonly source: TleEventAtlasSourceReceipt;
  readonly quality: TleEventAtlasClipQuality;
}

export interface TleEventAtlasLogicalEvent {
  readonly logicalEventKey: string;
  readonly sourceEvent: TleEventAtlasEventType;
  readonly triggerInstantUtc: string;
  readonly fromSatelliteId: string;
  readonly toSatelliteId: string;
  readonly preferredVariantId: string;
  readonly variantIds: readonly string[];
}

export interface TleEventAtlasNumericDistribution {
  readonly count: number;
  readonly min: number | null;
  readonly p25: number | null;
  readonly median: number | null;
  readonly p75: number | null;
  readonly max: number | null;
}

export interface TleEventAtlasSummary {
  readonly coverageComplete: boolean;
  readonly populationClaimsAllowed: boolean;
  readonly expectedWindowCount: number;
  readonly acceptedWindowCount: number;
  readonly rejectedWindowCount: number;
  readonly eventVariantCount: number;
  readonly uniqueServingChangeCount: number;
  readonly validInterHandoverCount: number;
  readonly forcedContinuityCount: number;
  readonly forcedFractionOfServingChanges: number | null;
  readonly validInterHandoversPerPhysicalHour: number | null;
  readonly completeClipCount: number;
  readonly validAtLeast45DegCount: number;
  readonly validAtLeast60DegCount: number;
  readonly validAtLeast75DegCount: number;
  readonly uniqueSatellitePairCount: number;
  readonly minimumEventElevationDeg: TleEventAtlasNumericDistribution;
  readonly deltaSinrDynamicRangeDb: TleEventAtlasNumericDistribution;
  readonly candidateResidualVisibilitySec: TleEventAtlasNumericDistribution;
  readonly concurrentVisibleSatelliteCount: TleEventAtlasNumericDistribution;
}

export interface CanonicalTleEventAtlas {
  readonly schema: typeof TLE_EVENT_ATLAS_SCHEMA_VERSION;
  readonly atlasId: string;
  readonly generatedAtUtc: string;
  readonly constellation: SimulatorConstellation;
  readonly evidenceClass: TleEventAtlasEvidenceClass;
  readonly propagationMode: TleRunPropagationMode;
  readonly sourceArchiveContentSha256: string;
  readonly configDigest: string;
  readonly search: TleEventAtlasSearchRange;
  readonly observer: TleEventAtlasObserverReceipt;
  readonly canonicalParameterDigest: string;
  readonly canonicalScenarioDigest: string;
  readonly resolverRevision: typeof TLE_EVENT_ATLAS_RESOLVER_REVISION;
  readonly visibilityRevision: typeof TLE_EVENT_ATLAS_VISIBILITY_REVISION;
  readonly exactSgp4Revision: typeof TLE_EVENT_ATLAS_EXACT_SGP4_REVISION;
  /** Window identity/metrics only; full clips remain in the rebuildable cache. */
  readonly windows: readonly TleEventAtlasPublishedWindowReceipt[];
  /** Compact receipts for every overlapping source-backed variant. */
  readonly eventVariants: readonly TleEventAtlasEventVariantReceipt[];
  /** One complete, neutrally selected clip per de-duplicated physical event. */
  readonly preferredEvents: readonly TleEventAtlasEventVariant[];
  readonly logicalEvents: readonly TleEventAtlasLogicalEvent[];
  readonly rankedPreferredVariantIds: readonly string[];
  readonly summary: TleEventAtlasSummary;
}
