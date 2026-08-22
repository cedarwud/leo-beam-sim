/**
 * Shape of the pinned six-acts teaching-window fixture.
 *
 * The fixture identifies ONE source-backed OneWeb handover window from the
 * published NTPU 90-day event atlas. It is data only: it carries no beat
 * timings, because the atlas is a 30 s coarse offline forecast and the director
 * calibrates beats against live replay dt instead.
 *
 * See docs/sdd/SIX-ACTS-P0-VERTICAL-SLICE-SDD.md (M1).
 */

export const SIX_ACTS_TEACHING_WINDOW_SCHEMA = 'six-acts-teaching-window-v1' as const;

/**
 * The fixture never supplies beat instants. Anything that renders a director
 * beat must resolve its time from the live replay clock.
 */
export const SIX_ACTS_BEAT_CALIBRATION = 'live-replay-dt' as const;

export const SIX_ACTS_TEACHING_WINDOW_BOUNDARY =
  'SOURCE-class atlas forecast at 30 s steps. Window identification only; not a beat timetable and not measured truth.';

/** Provenance class shown beside any classroom number. */
export type SixActsProvenanceClass = 'SOURCE' | 'MODEL-DERIVED' | 'COURSE-ASSUMPTION';

export interface SixActsTleIdentity {
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly epochUtc: string;
  readonly sourcePath: string;
  readonly line1: string;
  readonly line2: string;
}

export interface SixActsForecastLink {
  readonly satelliteId: string;
  readonly userId: string;
  readonly userIndex: number;
  readonly beamId: number;
  readonly elevationDeg: number;
  readonly rangeKm: number;
  readonly offAxisAngleRad: number;
  readonly actualPowerW: number;
  readonly sinrDb: number;
  readonly rateBps: number;
  readonly qosMet: boolean;
}

/**
 * One atlas anchor. Deliberately NOT named `Beat`: these instants identify the
 * window, they do not schedule the director.
 */
export interface SixActsAtlasForecastSample {
  readonly role: 'before' | 'decision' | 'after';
  readonly anchorIndex: number;
  readonly instantUtc: string;
  readonly state: string;
  readonly event: string;
  readonly servingSatelliteId: string;
  readonly candidateSatelliteId: string | null;
  readonly deltaSinrDb: number | null;
  readonly serving: SixActsForecastLink | null;
  readonly candidate: SixActsForecastLink | null;
  readonly concurrentVisibleSatelliteCount: number;
  readonly systemPowerW: number;
  readonly totalRateBps: number;
  readonly instantaneousEeBitsPerJ: number;
  readonly evaluationEeBitsPerJ: number;
}

export interface SixActsQualificationAnchor {
  readonly anchorIndex: number;
  readonly instantUtc: string;
  readonly deltaDb: number;
  readonly progressSec: number;
}

export interface SixActsTeachingWindowFixture {
  readonly schema: typeof SIX_ACTS_TEACHING_WINDOW_SCHEMA;
  readonly beatCalibration: typeof SIX_ACTS_BEAT_CALIBRATION;
  readonly boundary: string;
  readonly generationCommand: string;
  readonly provenance: {
    readonly atlasId: string;
    readonly atlasSchema: string;
    readonly atlasGeneratedAtUtc: string;
    readonly atlasArtifactPath: string;
    readonly atlasArtifactSha256: string;
    readonly sourceArchiveContentSha256: string;
    readonly configDigest: string;
    readonly canonicalParameterDigest: string;
    readonly canonicalScenarioDigest: string;
    readonly resolverRevision: string;
    readonly visibilityRevision: string;
    readonly exactSgp4Revision: string;
    readonly propagationMode: string;
    readonly evidenceClass: string;
    readonly observer: {
      readonly id: string;
      readonly label: string;
      readonly latitudeDeg: number;
      readonly longitudeDeg: number;
      readonly heightKm: number;
    };
    readonly search: {
      readonly startUtc: string;
      readonly endUtcExclusive: string;
      readonly windowStepSec: number;
      readonly physicalDurationSec: number;
    };
  };
  readonly selection: {
    readonly rank: number;
    readonly variantId: string;
    readonly logicalEventKey: string;
    readonly sourceEvent: 'inter-handover';
    readonly traceDigest: string;
    readonly geometryRunId: string;
    readonly analysisRunId: string;
    readonly rankingBasis: string;
    /**
     * The honesty pairing Act 4 must show: a valid-event count is meaningless
     * without the forced-continuity count beside it.
     */
    readonly populationContext: {
      readonly validInterHandoverCount: number;
      readonly forcedContinuityCount: number;
      readonly validInterHandoversPerPhysicalHour: number;
      readonly validAtLeast45DegCount: number;
    };
  };
  readonly window: {
    readonly constellation: string;
    readonly requestedT0Utc: string;
    readonly triggerInstantUtc: string;
    readonly triggerOffsetSec: number;
    readonly handoverPolicy: {
      readonly offsetDb: number;
      readonly tttSec: number;
      readonly anchorStepSec: number;
    };
    readonly evaluation: {
      readonly evaluationBitsPerJ: number;
      readonly deliveredBits: number;
      readonly consumedEnergyJ: number;
      readonly durationS: number;
      readonly sampleCount: number;
    };
  };
  readonly pair: {
    readonly from: SixActsTleIdentity;
    readonly to: SixActsTleIdentity;
  };
  readonly qualification: {
    readonly anchors: readonly SixActsQualificationAnchor[];
    readonly spanSec: number;
    readonly preCommit: {
      readonly servingSatelliteId: string;
      readonly candidateSatelliteId: string;
      readonly servingSinrDb: number;
      readonly candidateSinrDb: number;
      readonly deltaDb: number;
    };
    readonly postCommit: {
      readonly servingSatelliteId: string;
      readonly instantUtc: string;
    };
  };
  readonly atlasForecast: {
    readonly note: string;
    readonly stepSec: number;
    readonly samples: readonly SixActsAtlasForecastSample[];
  };
  readonly quality: {
    readonly minimumEventElevationDeg: number;
    readonly deltaSinrDynamicRangeDb: number;
    readonly candidateResidualVisibilitySec: number;
    readonly concurrentVisibleSatelliteCount: number;
    readonly complete: boolean;
  };
}
